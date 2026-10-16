# DevOps CRM

A local sales workspace for managing contacts, tracking opportunities, and understanding a small sales pipeline. Built for Akshat Kushwaha's DevOps capstone.

Repository: https://github.com/AkshatKushwaha-exe/Devops-CRM

Presentation video (7½ minutes, captioned): [docs/devops-crm-presentation.mp4](docs/devops-crm-presentation.mp4)

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

Rollback procedure, database considerations, and setup: [docs/OPERATIONS.md](docs/OPERATIONS.md).

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

Rehearsed failure drills in an isolated namespace: an invalid image tag, a Service with wrong selectors, and HPA scaling under load. See [docs/OPERATIONS.md](docs/OPERATIONS.md#troubleshooting-exercises).

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

Submission evidence by requirement: [docs/SUBMISSION.md](docs/SUBMISSION.md). Live demo script: [docs/DEMO.md](docs/DEMO.md). See the [validation record](docs/VALIDATION.md) for every check that was executed, including the PostgreSQL runtime verification, restart persistence, and screenshots.

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
docs/                    Architecture, operations (CD, rollback, troubleshooting), validation, evidence, presentation video
```
