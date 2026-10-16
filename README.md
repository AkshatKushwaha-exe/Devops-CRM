# DevOps CRM

A local sales workspace for managing contacts, tracking opportunities, and understanding a small sales pipeline. Built for Akshat Kushwaha's DevOps capstone.

Repository: https://github.com/AkshatKushwaha-exe/Devops-CRM

Presentation video (7½ minutes, captioned): [devops-crm-presentation.mp4](devops-crm-presentation.mp4)

Live on AWS (until teardown after evaluation): http://devops-crm-471212951.ap-south-1.elb.amazonaws.com

## What works

- Dashboard with contact count, open deals, pipeline value, won revenue, win rate, and value by stage.
- Contact creation, editing, deletion, company/name/email search, relationship filters, and pagination.
- Deals connected to contacts, exact decimal INR values, expected close dates, and notes.
- Five pipeline stages: New, Qualified, Proposal, Won, and Lost. Change stages from the cards.
- Activity history recorded together with each successful data change.
- Responsive navigation, keyboard-accessible dialogs, loading/empty/error states, and retry controls.
- Validation, case-insensitive unique email addresses, and protection against deleting contacts with linked deals.

The CRM is a **single-user application**. The workspace name is a display label; authentication and multi-user permissions are not implemented, so do not expose a deployment publicly with real customer data.

## Stack

React + TypeScript + Vite · FastAPI · SQLAlchemy · Alembic · PostgreSQL · Pytest

PostgreSQL is the primary database. SQLite is also supported for a lightweight preview and isolated tests. Switching database URLs selects a different database; it does not transfer records. UI fonts and icons are bundled locally, with no runtime CDN dependency.

## Run with Docker Compose

Prerequisite: Docker with Compose v2. From a fresh checkout:

```bash
docker compose up --build
```

Open **http://localhost:3000** (API reference at http://localhost:3000/api/docs). Startup is ordered by health checks:

| Service | Image | Role |
|---|---|---|
| `db` | `postgres:18.6-alpine3.24` | PostgreSQL with the named volume `pgdata`; healthy when `pg_isready` passes |
| `migrate` | backend image | Runs `python -m app.migrate upgrade` once, then exits; the API does not start until it succeeds |
| `backend` | `backend/Dockerfile` | FastAPI on Alpine as UID 10001; healthy when `/ready` confirms the database and schema |
| `frontend` | `frontend/Dockerfile` | Multi-stage: Vite build → `nginx-unprivileged` (UID 101) serving the UI and proxying `/api/` to the backend |

The app containers run read-only with all Linux capabilities dropped. Only the frontend port is published; PostgreSQL and the API stay on the internal network.

```bash
docker compose down        # remove containers; data stays in the pgdata volume
docker compose up -d       # recreate; records are still there
docker compose down -v     # also delete the database volume
```

Copy `.env.example` to `.env` to change the database password or host port, or to run images published to GHCR instead of building locally.

**Migrations.** `app.migrate upgrade` takes a PostgreSQL advisory lock, so concurrent runs are safe: one applies the migration, the others wait and find the schema at head. If the database is *ahead* of the image, for example after rolling back to an older image, the schema is left unchanged. Schema changes must therefore stay backward compatible for one release (expand, then contract). `app.migrate wait` blocks until the schema is ready.

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request to `main` and every push to `main`:

```text
Backend lint + tests ─┐ (Ruff, Pytest, migrations up/down + drift check on PostgreSQL 18)
Browser tests ────────┤ (Playwright against the real API)
Helm + Terraform ─────┤ (helm lint --strict, kubeconform, terraform fmt/validate)
Frontend lint + tests → Frontend build ─┴→ Build images (amd64+arm64) → Trivy gate → Publish to GHCR → Deploy to EKS
                                                                 (main only)       (main only)
```

- **Images** are built once per architecture on native amd64 and arm64 runners, exported as tarballs, and scanned. Exactly those tarballs are pushed as `:<sha>-amd64` and `:<sha>-arm64`, then joined under one multi-arch `:<sha>` tag. Nothing is rebuilt after the scan.
- **Security gate:** Trivy (official image pinned by digest) scans OS packages, language dependencies, and secrets. Any HIGH or CRITICAL finding, fixed or unfixed, fails the job. Reports are uploaded as artifacts and to GitHub code scanning.
- **Tags:** `ghcr.io/akshatkushwaha-exe/devops-crm-{backend,frontend}:<full commit SHA>`, with OCI `revision`/`source` labels and a signed build-provenance attestation. Verify with `gh attestation verify oci://<image> --owner AkshatKushwaha-exe`.
- All third-party actions are pinned to commit SHAs.

## Continuous deployment

After publishing, CI calls [`deploy.yml`](.github/workflows/deploy.yml), which deploys **that exact SHA** to EKS:

- GitHub OIDC gives the job short-lived AWS credentials. There are no stored keys, and only the `production` environment of this repository can assume the role.
- `helm upgrade --install` runs the migration Job and waits for it (`--wait-for-jobs`), then waits for the rolling update and runs `helm test`. A failed upgrade rolls back automatically (`--rollback-on-failure`).
- The job polls the ALB until `/api/version` returns the deployed SHA, which also appears in the UI footer.

### Security scan result

Trivy scanned all four images (backend and frontend, amd64 and arm64). It checked their Alpine 3.24 OS packages, the Python and JavaScript dependencies inside them, and the image files for leaked secrets, comparing everything against public vulnerability databases. Every scan reported **0 CRITICAL, 0 HIGH, and 0 secrets**, so the gate passed and the images were published. A clean result means no known serious vulnerability affects these images today; if one is published later, the next pipeline run fails until the base image or dependency is upgraded.

### Rollback

| Situation | Action |
|---|---|
| The upgrade fails (pods not ready, migration Job fails, timeout) | Automatic: `--rollback-on-failure` restores the last good revision and the job fails |
| A release deployed but is bad | Actions → **Deploy** → *Run workflow* with the previous good SHA (same OIDC role and checks) |
| GitHub unavailable, cluster reachable | `helm -n crm history crm`, then `helm -n crm rollback crm <REVISION> --wait` |

Migrations are forward-only and backward compatible for one release, so an older image runs against a newer schema: `app.migrate` reports the database is ahead and leaves it unchanged. Recorded rollback and roll-forward: [docs/evidence/phase-6-cd/rollback.txt](docs/evidence/phase-6-cd/rollback.txt).

## Provision AWS with Terraform

[`terraform/`](terraform) creates a VPC (2 public + 2 private subnets, one NAT gateway), an EKS 1.36 cluster with a managed node group (2 × `m7i-flex.large`), the EBS CSI driver with a default `gp3` StorageClass, metrics-server, the AWS Load Balancer Controller for Ingress, and the GitHub OIDC deploy role. Prerequisites: Terraform ≥ 1.10, AWS CLI v2, kubectl, Helm 4, and an AWS profile for your own account.

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars    # optional; defaults match the example
terraform init
terraform plan -out tfplan
terraform apply tfplan                           # ~15–20 minutes
$(terraform output -raw kubeconfig_command)      # aws eks update-kubeconfig …
gh variable set AWS_DEPLOY_ROLE_ARN --body "$(terraform output -raw github_deploy_role_arn)"
gh variable set EKS_CLUSTER_NAME    --body "$(terraform output -raw cluster_name)"
gh variable set AWS_REGION          --body "$(terraform output -raw region)"
```

The stack costs about $0.38/hour. Tear it down after evaluation: `AWS_PROFILE=<profile> bash scripts/teardown-aws.sh` uninstalls the releases (so the ALB and EBS volume are deleted), runs `terraform destroy`, and records proof in `docs/evidence/phase-8-teardown/`.

PostgreSQL runs in the cluster as a StatefulSet on an EBS volume. For production, Amazon RDS for PostgreSQL (Multi-AZ, automated backups, point-in-time recovery) is the managed alternative: store its connection string as `DATABASE_URL` in a Secret and install with `--set postgresql.enabled=false --set externalDatabase.existingSecret=<secret>`. Migrations and readiness checks work unchanged.

## Deploy to Kubernetes with Helm

The chart in [`helm/devops-crm`](helm/devops-crm) installs:

| Resource | Details |
|---|---|
| `crm-frontend` Deployment + ClusterIP Service | 2 replicas of the Nginx UI image; `/healthz` probes; preStop drain; read-only root filesystem |
| `crm-backend` Deployment + ClusterIP Service | 2–6 replicas (HPA at 60% of a 100m CPU request); startup/liveness `/health`, readiness `/ready`; init container waits for migrations |
| `crm-migrate-r<revision>` Job | `python -m app.migrate upgrade` on every install, upgrade, and rollback |
| `crm-postgres` StatefulSet + ClusterIP Service | PostgreSQL 18 on a PersistentVolumeClaim (`volumeClaimTemplates`) with `pg_isready` probes |
| `crm-database` Secret, `crm-postgres` ConfigMap | Generated password reused on upgrades and kept on uninstall, so a reinstall still opens the retained volume |
| Ingress | `/api` → backend, `/` → frontend (`nginx` class locally, AWS ALB on EKS) |
| HPA, PodDisruptionBudgets, `helm test` hook | Autoscaling, `minAvailable: 1` during node drains, in-cluster smoke test |

All pods run as non-root with `RuntimeDefault` seccomp and all capabilities dropped.

### Local cluster (minikube)

```bash
minikube start --nodes 2
minikube addons enable metrics-server
minikube addons enable ingress
minikube addons enable storage-provisioner-rancher   # node-pinned local-path volumes

SHA=$(git rev-parse origin/main)   # any commit published by CI
helm upgrade --install crm helm/devops-crm -n crm --create-namespace \
  -f helm/devops-crm/values-local.yaml --set imageTag=$SHA --wait
helm test crm -n crm

kubectl -n ingress-nginx port-forward svc/ingress-nginx-controller 8088:80
# → http://localhost:8088 (the Ingress routes /api and /)
```

Images are multi-arch (linux/amd64 + linux/arm64), so the same `:<sha>` tag runs on Apple-silicon minikube, x86 EKS nodes, and Graviton.

Exercises used for validation:

```bash
kubectl -n crm delete pod -l app.kubernetes.io/component=backend --wait=false  # replacement
kubectl -n crm delete pod crm-postgres-0                                       # data persists
kubectl -n crm apply -f k8s/load-test.yaml && kubectl -n crm get hpa -w        # HPA scaling
```

## Monitoring and troubleshooting

`bash scripts/install-monitoring.sh` installs Prometheus and Grafana (kube-prometheus-stack) into the current cluster. The chart's ServiceMonitor scrapes the API's `/metrics`, a PrometheusRule adds four alerts, and Grafana loads the **DevOps CRM · Service overview** dashboard: traffic, latency percentiles, error ratio, CPU and memory per pod, HPA replicas, and waiting containers.

### Troubleshooting exercises

Both drills run in their own namespace, `crm-lab`, so the real application is never touched (`kubectl delete namespace crm-lab` cleans up).

**1. Invalid image tag** (`kubectl apply -f k8s/exercises/00-namespace.yaml -f k8s/exercises/01-invalid-image-tag.yaml`): pods stay `ImagePullBackOff`; `kubectl -n crm-lab describe pod -l app=lab-web` shows the tag was not found (a 39-character truncated SHA). Fix: `kubectl -n crm-lab set image deploy/lab-web web=ghcr.io/akshatkushwaha-exe/devops-crm-frontend:<published-sha>`.

**2. Service with wrong selectors** (`kubectl apply -f k8s/exercises/02-wrong-service-selector.yaml`): pods are Running, but requests are refused. `kubectl -n crm-lab get endpointslices -l kubernetes.io/service-name=lab-api-gateway` shows no endpoints; comparing `kubectl -n crm-lab describe svc lab-api-gateway | grep Selector` with `kubectl -n crm-lab get pods --show-labels` shows the mismatch. Fix: `kubectl -n crm-lab patch svc lab-api-gateway --type merge -p '{"spec":{"selector":{"app":"lab-api-gateway","tier":"edge"}}}'`.

**3. HPA scaling:** `kubectl -n crm apply -f k8s/load-test.yaml && kubectl -n crm get hpa crm-backend -w` scales the API from 2 to 6 pods within about a minute, and back down after `kubectl -n crm delete job crm-load-test`.

Recorded runs: [exercise 1](docs/evidence/phase-7-monitoring/exercise-1-invalid-image-tag.txt) · [exercise 2](docs/evidence/phase-7-monitoring/exercise-2-wrong-service-selector.txt) · [HPA](docs/evidence/phase-4-kubernetes/hpa-scaling.txt).

## Start locally (development)

Prerequisites: Node.js 22.12+ (Node 24 recommended), pnpm 10, uv, and Python 3.12. `uv` can install Python 3.12 automatically. Dependency downloads need internet access on the first run.

From the project root:

```bash
bash scripts/dev.sh --seed
```

The launcher installs locked dependencies, starts a private local PostgreSQL process on `127.0.0.1:55433`, applies migrations, inserts fictional demo data into an empty database, and starts the API and UI. The local PostgreSQL helper downloads platform-specific PostgreSQL binaries through `embedded-postgres`; no Docker or system database service is required. macOS arm64/x64 and Linux arm64/x64 are the intended environments for this Bash launcher.

- Application: **http://127.0.0.1:3000**
- API reference: **http://127.0.0.1:3000/api/docs** (also served directly by the API at `:8000/api/docs`)
- Health: http://127.0.0.1:8000/health
- Readiness: http://127.0.0.1:8000/ready
- Application metrics: http://127.0.0.1:8000/metrics

Press **Ctrl+C** to stop all three processes. Data persists under `.local/postgres/`. Logs are in `.local/`. Omit `--seed` to start with your current data or an empty workspace. Seeding never overwrites existing records.

For a preview without PostgreSQL:

```bash
bash scripts/dev.sh --sqlite --seed
```

This stores data in `.local/crm.db`. A restricted agent sandbox may block both PostgreSQL shared memory and localhost listeners; run the launcher from your normal terminal in that case.

### Use an existing PostgreSQL installation

Create an empty local database and user with permission to manage its schema. Then use separate terminals:

```bash
cd backend
uv sync --frozen --python 3.12
cp .env.example .env
# Edit DATABASE_URL in .env for your local database.
uv run alembic upgrade head
uv run python -m app.seed   # optional, fictional sample data
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

Vite proxies `/api` to the backend on port 8000. The browser uses same-origin requests. You can set `API_PROXY_TARGET` when launching Vite if the API uses a different port.

## Validation

Backend tests use a new temporary SQLite database **with real Alembic migrations for every test**. They never touch the development database.

```bash
cd backend
uv run pytest -v
uv run ruff check app alembic tests
uv run ruff format --check app alembic tests
```

```bash
cd frontend
pnpm test
pnpm build
pnpm format:check
```

The frontend component tests cover forms, API error handling, linked-contact deletion protection, stage changes, empty states, and retries. They use mocked HTTP responses. Browser tests run the real UI against the real API with a disposable database on ports 3011/8011:

```bash
cd frontend
pnpm exec playwright install chromium
pnpm test:e2e
```

Capture desktop and mobile screenshots of any running instance (local, Compose, Kubernetes, or AWS):

```bash
cd frontend
node scripts/capture-screenshots.mjs http://127.0.0.1:3000 ../docs/evidence/<name>
```

## Evidence

All under [`docs/evidence/`](docs/evidence). Account IDs are redacted.

| Requirement | Evidence |
|---|---|
| Running application | [devops-crm-presentation.mp4](devops-crm-presentation.mp4) · [phase-1-local/](docs/evidence/phase-1-local) desktop and mobile screenshots · [live on EKS](docs/evidence/phase-6-cd/chrome-live-overview-after.jpg) |
| Tests passing (`pytest -v`) | [tests/backend-pytest.txt](docs/evidence/tests/backend-pytest.txt) (37 passed) · [tests/frontend-tests.txt](docs/evidence/tests/frontend-tests.txt) |
| Commit history (≥ 10 commits) | [commit-history.txt](docs/evidence/commit-history.txt) (28 commits, excluding merges) |
| Docker Compose and browser at `localhost:3000` | [phase-2-compose/compose-status.txt](docs/evidence/phase-2-compose/compose-status.txt) · [desktop-overview.png](docs/evidence/phase-2-compose/desktop-overview.png) |
| Green pipeline and GHCR SHA tags | [Actions run 38931035243](https://github.com/AkshatKushwaha-exe/Devops-CRM/actions/runs/38931035243) · [actions-run-main.jpg](docs/evidence/phase-3-ci/actions-run-main.jpg) · [ghcr-backend-package.jpg](docs/evidence/phase-3-ci/ghcr-backend-package.jpg) |
| Trivy scan output | [demo-trivy-gates-and-publish.jpg](docs/evidence/phase-6-cd/demo-trivy-gates-and-publish.jpg) · [trivy-backend-summary.jpg](docs/evidence/phase-3-ci/trivy-backend-summary.jpg) · [trivy-backend/trivy.txt](docs/evidence/phase-3-ci/trivy-backend/trivy.txt) · [explanation](#security-scan-result) |
| Terraform plan and AWS console (VPC, EKS) | [terraform-apply.txt](docs/evidence/phase-5-aws/terraform-apply.txt) · [console-vpc.jpg](docs/evidence/phase-5-aws/console-vpc.jpg) · [console-eks-cluster.jpg](docs/evidence/phase-5-aws/console-eks-cluster.jpg) · `terraform destroy`: `phase-8-teardown/` after evaluation |
| Pods, Services, `helm list`, app through Ingress | [kubectl-helm-status.txt](docs/evidence/phase-6-cd/kubectl-helm-status.txt) · [cluster-state.txt](docs/evidence/phase-5-aws/cluster-state.txt) · [chrome-live-overview-after.jpg](docs/evidence/phase-6-cd/chrome-live-overview-after.jpg) |
| `/metrics`, Prometheus targets UP, Grafana | [metrics-endpoint.txt](docs/evidence/phase-7-monitoring/metrics-endpoint.txt) · [eks-prometheus-targets.jpg](docs/evidence/phase-7-monitoring/eks-prometheus-targets.jpg) · [eks-grafana-dashboard-top.jpg](docs/evidence/phase-7-monitoring/eks-grafana-dashboard-top.jpg) |
| Live demo: commit → pipeline → deployment | [PR #14](https://github.com/AkshatKushwaha-exe/Devops-CRM/pull/14) (accent green → indigo) · [demo-deploy-summary.jpg](docs/evidence/phase-6-cd/demo-deploy-summary.jpg) · [live-rollout-poll.txt](docs/evidence/phase-6-cd/live-rollout-poll.txt) (no failed requests during the rollout) |

## Data rules

- Each contact has a unique email, normalized to lowercase.
- A deal must reference an existing contact. Reassign or delete deals before deleting their contact.
- Values use `NUMERIC(12,2)`, accept at most two decimal places, and cannot be negative. Currency is INR throughout this version.
- Pipeline value and active-deal counts exclude Won and Lost. Won revenue is the sum of Won deals. These are all-time totals, not monthly totals.
- Win rate is won deals divided by all closed deals (Won + Lost); it is zero if no deals are closed.
- “On the horizon” lists the earliest expected close dates for open deals, including overdue deals.
- Activity is written in the same transaction as the change. Failed operations do not create activity entries.
- Demo data is fictional and explicitly opt-in; the application never seeds automatically on startup.

## Project layout

```text
backend/app/             API routes, models, validation, metrics, demo seed
backend/alembic/         Versioned schema migration
backend/tests/           API, business-rule, and migration tests
backend/Dockerfile       API image (Alpine, non-root)
frontend/Dockerfile      UI image (Vite build → unprivileged Nginx)
frontend/nginx/          Nginx site template: static UI, /api proxy, /healthz
docker-compose.yml       PostgreSQL, migration step, API, and UI
.github/workflows/       CI: tests → build → scan → publish
helm/devops-crm/         Helm chart (values-local.yaml for minikube, values-eks.yaml for AWS)
terraform/               VPC, EKS, node group, controllers, GitHub OIDC deploy role
k8s/                     Load test and troubleshooting exercises
monitoring/              kube-prometheus-stack values (scripts/install-monitoring.sh)
frontend/src/            React screens, components, styling, component tests
frontend/e2e/            Browser workflows
frontend/scripts/        Evidence screenshot capture
scripts/                 Local launch and database helper, browser-test server
docs/evidence/           Screenshots and terminal output for each requirement
devops-crm-presentation.mp4  Presentation video
```
