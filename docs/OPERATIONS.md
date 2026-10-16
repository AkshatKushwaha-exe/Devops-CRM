# Operations guide

## Continuous deployment

Every push to `main` runs [`ci.yml`](../.github/workflows/ci.yml). Its last job calls [`deploy.yml`](../.github/workflows/deploy.yml) with the commit SHA that was just tested, scanned, and published:

```text
publish (ghcr.io/…:<sha>) → Deploy to EKS
  1. verify both images exist for <sha>
  2. GitHub OIDC → sts:AssumeRoleWithWebIdentity → devops-crm-github-deploy (1 h max)
  3. aws eks update-kubeconfig
  4. helm upgrade --install crm --set imageTag=<sha>
       --wait=watcher --wait-for-jobs --rollback-on-failure --timeout 10m
       └─ Job crm-migrate-r<N>: python -m app.migrate upgrade
       └─ backend pods: init container waits for the schema, then rolling update (maxUnavailable 0)
  5. kubectl wait job/crm-migrate-r<N>; print migration logs
  6. kubectl rollout status (backend, frontend); helm test
  7. poll http://<ALB>/api/version until it reports <sha>; check / and /api/dashboard
```

The job runs in the `production` GitHub environment, which records each deployment with its URL. Deploys are serialized (`concurrency: deploy-production`) and never cancelled midway.

**One-time setup** after `terraform apply` (see [terraform/README.md](../terraform/README.md)):

```bash
gh variable set AWS_DEPLOY_ROLE_ARN --body "$(terraform -chdir=terraform output -raw github_deploy_role_arn)"
gh variable set EKS_CLUSTER_NAME    --body "$(terraform -chdir=terraform output -raw cluster_name)"
gh variable set AWS_REGION          --body ap-south-1
```

Until `AWS_DEPLOY_ROLE_ARN` exists, the deploy job is skipped and CI still publishes images.

**If *Configure AWS credentials* fails with `Not authorized to perform sts:AssumeRoleWithWebIdentity`,** compare the role's trusted `sub` values with what GitHub sends. Repositories with immutable OIDC subjects send `repo:<owner>@<owner-id>/<repo>@<repo-id>:environment:production`; see `gh api repos/<owner>/<repo>/actions/oidc/customization/sub` and set `github_oidc_subject_prefix` in Terraform.

**Seeing a change go live:** the UI footer shows `build <short sha>` from `/api/version`, which reports the `APP_VERSION` baked into the image at build time. Push a change and watch the footer flip to the new SHA once the deploy job finishes.

## Rollback

Pick the fastest option that fits:

| Situation | Action |
|---|---|
| The upgrade itself fails (pods not ready, migration Job fails, timeout) | Nothing to do: `--rollback-on-failure` restores the last good revision and the job fails red |
| A release deployed fine but is bad | **Run the Deploy workflow with the previous good SHA**: Actions → *Deploy* → *Run workflow* → `image-tag = <sha>`. Same OIDC role, same checks, and the version check proves the rollback |
| CI/GitHub unavailable, cluster reachable | `helm rollback` from a workstation (below) |

### Find the previous good version

```bash
helm -n crm history crm                 # revision, status, chart, description
helm -n crm get values crm --revision <N> | grep imageTag
gh run list --workflow CI --branch main --status success --limit 5   # SHAs of green runs
```

### Roll back with Helm

```bash
aws eks update-kubeconfig --name devops-crm --region ap-south-1
helm -n crm rollback crm <REVISION> --wait --timeout 10m
kubectl -n crm rollout status deploy/crm-backend deploy/crm-frontend
curl -s http://$(kubectl -n crm get ingress crm -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')/api/version
```

A Helm rollback creates a new revision, so it also creates a fresh `crm-migrate-r<N>` Job running the *older* image.

### What happens to the database

Schema migrations are forward-only and must stay backward compatible for one release (expand → migrate → contract). When an older image starts against a newer schema, `python -m app.migrate` reports `Database is ahead of this image (rollback); leaving schema unchanged.` and the API starts normally. No data is touched.

If a bad migration itself must be reverted, downgrade with the **newer** image, which knows both revisions, **before** rolling the code back:

```bash
kubectl -n crm run alembic-downgrade --rm -it --restart=Never \
  --image=ghcr.io/akshatkushwaha-exe/devops-crm-backend:<bad-sha> \
  --overrides='{"spec":{"containers":[{"name":"alembic-downgrade","image":"ghcr.io/akshatkushwaha-exe/devops-crm-backend:<bad-sha>","command":["alembic","downgrade","<target-revision>"],"envFrom":[],"env":[{"name":"DATABASE_URL","valueFrom":{"secretKeyRef":{"name":"crm-database","key":"DATABASE_URL"}}}]}]}}'
```

Take a logical backup first: `kubectl -n crm exec crm-postgres-0 -- pg_dump -U crm crm > crm-$(date +%F).sql`.

## Monitoring

```bash
bash scripts/install-monitoring.sh      # kube-prometheus-stack 92.9.0 into namespace "monitoring"
kubectl -n monitoring port-forward svc/kps-grafana 3001:80          # http://localhost:3001
kubectl -n monitoring get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d
kubectl -n monitoring port-forward svc/kps-prometheus 9090:9090     # http://localhost:9090/targets
```

The CRM chart ships the monitoring wiring, and it is rendered only when the Prometheus Operator CRDs exist:

- **ServiceMonitor `crm-backend`** scrapes `/metrics` on every API pod every 15 s (`crm_http_requests_total{method,route,status}`, `crm_http_request_duration_seconds` histogram).
- **PrometheusRule `crm-alerts`**: `CrmHighErrorRate` (5xx > 5% for 5 m), `CrmHighLatency` (p95 > 1 s for 10 m), `CrmApiUnavailable` (no ready API pods for 2 m), `CrmPodsWaiting` (ImagePullBackOff/CrashLoopBackOff for 5 m).
- **Grafana dashboard "DevOps CRM · Service overview"** (ConfigMap picked up by the Grafana sidecar):

| Row | Panels |
|---|---|
| Headline | Request rate · 5xx share · p95 latency · ready API pods |
| Traffic | Requests/s by route · responses by status class (2xx/4xx/5xx) |
| Latency & errors | p50/p95/p99 latency · 5xx ratio with the 5% alert line |
| Resources | CPU per pod · memory working set per pod |
| Scaling & health | HPA current vs desired replicas · containers waiting by reason (all namespaces) |

## Troubleshooting exercises

Both exercises run in their own namespace, `crm-lab`, so the real application is never touched. Clean up with `kubectl delete namespace crm-lab`. Recorded runs: [exercise 1](evidence/phase-7-monitoring/exercise-1-invalid-image-tag.txt), [exercise 2](evidence/phase-7-monitoring/exercise-2-wrong-service-selector.txt).

### Exercise 1: invalid image tag

```bash
kubectl apply -f k8s/exercises/00-namespace.yaml -f k8s/exercises/01-invalid-image-tag.yaml
```

| Step | Command | What you see |
|---|---|---|
| Symptom | `kubectl -n crm-lab rollout status deploy/lab-web` | Never completes; pods `0/1 ErrImagePull` → `ImagePullBackOff` |
| Events | `kubectl -n crm-lab describe pod -l app=lab-web` (Events section) | `Failed to pull image "…:b74afac…bcda": … not found` |
| Compare | `kubectl -n crm-lab get deploy lab-web -o jsonpath='{..image}'` and `gh api users/AkshatKushwaha-exe/packages/container/devops-crm-frontend/versions --jq '.[].metadata.container.tags[]'` | The deployed tag has 39 characters; the published SHA has 40 |
| Dashboard | Grafana → *Containers waiting, by reason* | `crm-lab · ImagePullBackOff` series appears |
| Fix | `kubectl -n crm-lab set image deploy/lab-web web=ghcr.io/akshatkushwaha-exe/devops-crm-frontend:<published-sha>` | Rollout completes; pods `1/1 Running` |

In the real release the same mistake is caught earlier: `deploy.yml` refuses a tag that is not 40 hex characters or not published. If it slips through Helm, `--rollback-on-failure` reverts it. Old pods keep serving during the failed rollout because `maxUnavailable: 0`.

### Exercise 2: Service with incorrect selectors

```bash
kubectl apply -f k8s/exercises/00-namespace.yaml -f k8s/exercises/02-wrong-service-selector.yaml
```

| Step | Command | What you see |
|---|---|---|
| Symptom | `kubectl -n crm-lab run probe --rm -i --restart=Never --image=busybox:1.37 -- wget -qO- -T 3 http://lab-api-gateway/healthz` | `Connection refused`, although the pods are `1/1 Running` |
| Endpoints | `kubectl -n crm-lab get endpointslices -l kubernetes.io/service-name=lab-api-gateway` | `ENDPOINTS <unset>`: the Service selects no pods |
| Compare | `kubectl -n crm-lab describe svc lab-api-gateway \| grep Selector` vs `kubectl -n crm-lab get pods --show-labels` | Selector `app=api-gateway,tier=frontend`; pods `app=lab-api-gateway,tier=edge` |
| Fix | `kubectl -n crm-lab patch svc lab-api-gateway --type merge -p '{"spec":{"selector":{"app":"lab-api-gateway","tier":"edge"}}}'` | EndpointSlice lists both pod IPs; `wget` returns `ok` and `/api/version` works through the proxy |

Rule of thumb: when pods are healthy but the Service is not, check **endpoints first**. An empty EndpointSlice always means a selector/label mismatch, or pods that are not Ready.

### Exercise 3: HPA scaling

```bash
kubectl -n crm apply -f k8s/load-test.yaml
kubectl -n crm get hpa crm-backend -w      # 2 → 4 → 6 within ~1 min
kubectl -n crm top pods -l app.kubernetes.io/component=backend
kubectl -n crm describe hpa crm-backend    # SuccessfulRescale events and reasons
kubectl -n crm delete job crm-load-test     # scales back to 2, one pod per minute
```

Watch Grafana's *API replicas (HPA)* and *CPU usage per pod* panels move together.

### General triage order

1. `kubectl get pods -A | grep -v Running` and `kubectl get events -A --sort-by=.lastTimestamp | tail -20`
2. `kubectl describe pod <pod>`: read **Events** (pull errors, probe failures, scheduling, OOMKilled)
3. `kubectl logs <pod> [-c container] [--previous]`: app and migration errors (`kubectl logs job/crm-migrate-r<N>`)
4. `kubectl get endpointslices -l kubernetes.io/service-name=<svc>`: is traffic reaching any pod?
5. `kubectl top pods/nodes`, then Grafana: resource pressure, latency, and error trends
