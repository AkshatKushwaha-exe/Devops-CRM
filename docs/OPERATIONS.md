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

**One-time setup** after `terraform apply` (see [infra/terraform/README.md](../infra/terraform/README.md)):

```bash
gh variable set AWS_DEPLOY_ROLE_ARN --body "$(terraform -chdir=infra/terraform output -raw github_deploy_role_arn)"
gh variable set EKS_CLUSTER_NAME    --body "$(terraform -chdir=infra/terraform output -raw cluster_name)"
gh variable set AWS_REGION          --body ap-south-1
```

Until `AWS_DEPLOY_ROLE_ARN` exists, the deploy job is skipped and CI still publishes images.

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
