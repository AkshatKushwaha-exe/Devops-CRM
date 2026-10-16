# Connected demonstration (≈15 minutes)

One story from user action to production, observability, and recovery. Rehearse it end to end before the evaluation.

## Before you start (5 minutes ahead)

```bash
export AWS_PROFILE=devops-crm AWS_REGION=ap-south-1
aws eks update-kubeconfig --name devops-crm
APP=http://$(kubectl -n crm get ingress crm -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo $APP; curl -s $APP/api/version   # http://devops-crm-471212951.ap-south-1.elb.amazonaws.com while the stack exists

kubectl -n monitoring port-forward svc/kps-grafana 3001:80 &       # Grafana
kubectl -n monitoring port-forward svc/kps-prometheus 9090:9090 &  # Prometheus
```

Open four browser tabs: the app (`$APP`), GitHub Actions, Grafana's **DevOps CRM · Service overview** dashboard (last 30 minutes, 10 s refresh), and Prometheus targets. Keep one terminal ready.

## 1. Use the product (2 min)

1. Open **Contacts** → **Add contact** (focus lands on *Full name*). Create *Riya Kapoor · Demo Labs*.
2. Open **Pipeline** → **Add deal**. Create *Demo rollout*, ₹1,20,000, linked to Riya, stage *Proposal*.
3. Move it to **Won**, then open **Overview**: won revenue and win rate update. The footer shows `build <sha>`.

*Talking point:* the browser calls same-origin `/api`. The ALB routes `/api` to FastAPI pods and `/` to Nginx pods. Data lives in PostgreSQL on an encrypted gp3 EBS volume.

## 2. Ship a visible change (5 min)

```bash
git checkout -b demo/visible-change
# e.g. change the Overview headline in frontend/src/Overview.tsx ("Good things are growing")
git commit -am "feat: refresh overview headline for demo"
git push -u origin demo/visible-change && gh pr create --fill
gh pr merge --merge          # after the PR checks pass
gh run watch                 # follow CI on main
```

Narrate the pipeline in the Actions graph: lint and tests (including Playwright and real-PostgreSQL migrations) → frontend build → arm64 images → Trivy gate (0 HIGH/CRITICAL) → publish `:<sha>` to GHCR → **Deploy to EKS**. In the deploy job, point out:

- *Configure AWS credentials*: OIDC, no stored keys, role `devops-crm-github-deploy`
- *Helm upgrade*: the migration Job `crm-migrate-r<N>` runs first; a rolling update follows with `maxUnavailable: 0`
- *Readiness through the load balancer*: polls until `/api/version` equals the new SHA

Meanwhile, in the terminal:

```bash
kubectl -n crm get pods -w                       # new ReplicaSet appears, old pods drain
helm -n crm history crm                          # new revision
```

Refresh the app: the new headline appears and the footer shows the new short SHA. The contact and deal from step 1 are still there.

## 3. Observe it (3 min)

In Grafana, show request rate by route, p50/p95/p99 latency, the 5xx ratio at 0%, and CPU and memory per pod. Generate visible load:

```bash
kubectl -n crm apply -f k8s/load-test.yaml
kubectl -n crm get hpa crm-backend -w            # 2 → 4 → 6 within about a minute
```

The *API replicas (HPA)* panel steps up as CPU crosses 60% of requests. Prometheus → *Status → Target health* shows `serviceMonitor/crm/crm-backend` gaining targets as pods scale. Clean up with `kubectl -n crm delete -f k8s/load-test.yaml`.

## 4. Break and fix something (4 min)

Pick one exercise; both are isolated in namespace `crm-lab`.

**Invalid image tag**

```bash
kubectl apply -f k8s/exercises/00-namespace.yaml -f k8s/exercises/01-invalid-image-tag.yaml
kubectl -n crm-lab get pods                         # ErrImagePull / ImagePullBackOff
kubectl -n crm-lab describe pod -l app=lab-web | sed -n '/Events/,$p'   # "...: not found"
# Grafana: "Containers waiting, by reason" shows crm-lab · ImagePullBackOff
kubectl -n crm-lab set image deploy/lab-web web=ghcr.io/akshatkushwaha-exe/devops-crm-frontend:$(git rev-parse origin/main)
kubectl -n crm-lab rollout status deploy/lab-web
```

**Service with incorrect selectors**

```bash
kubectl apply -f k8s/exercises/00-namespace.yaml -f k8s/exercises/02-wrong-service-selector.yaml
kubectl -n crm-lab get endpointslices -l kubernetes.io/service-name=lab-api-gateway   # no endpoints
kubectl -n crm-lab describe svc lab-api-gateway | grep Selector
kubectl -n crm-lab get pods --show-labels
kubectl -n crm-lab patch svc lab-api-gateway --type merge -p '{"spec":{"selector":{"app":"lab-api-gateway","tier":"edge"}}}'
```

Finish with `kubectl delete namespace crm-lab`.

## 5. Close: rollback (1 min, optional)

Actions → **Deploy** → *Run workflow* → `image-tag` = the previous SHA (from `helm -n crm history crm` or GHCR). The footer flips back. Mention that migrations stay forward-compatible: an older image starting against a newer schema logs `Database is ahead of this image` and leaves the schema unchanged.

## If something goes wrong live

| Symptom | First command |
|---|---|
| Deploy job red | Open the failed step; `--rollback-on-failure` has already restored the last good release |
| ALB 502/503 | `kubectl -n crm get pods`; `kubectl -n crm describe ingress crm` (target group events) |
| Grafana empty | Port-forward stopped: rerun it; check *Prometheus targets* |
| AWS session expired | `aws sts get-caller-identity --profile devops-crm`; role sessions last 4 hours, re-run any command to refresh |
