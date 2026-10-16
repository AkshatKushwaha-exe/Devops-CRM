# Validation record

Each phase records what was executed, where, and the observed result. Evidence screenshots live under [`docs/evidence/`](evidence/).

## Phase 1 — Local application against PostgreSQL

Validated on 16 October 2026 on macOS (Apple silicon) with Python 3.12, Node 24, and PostgreSQL 18.4 started by `scripts/dev.sh` (embedded-postgres).

### Automated checks

| Check | Command | Result |
|---|---|---|
| Backend tests | `uv run pytest` | 31 passed (isolated SQLite databases built by the real Alembic migration) |
| Backend lint/format | `uv run ruff check …` / `ruff format --check …` | Passed |
| Frontend component tests | `pnpm test` | 10 passed |
| Type check + production build | `pnpm build` | Passed |
| Frontend formatting | `pnpm format:check` | Passed |
| Browser tests (Playwright, Chromium) | `pnpm test:e2e` | 2 passed after the fixes below |

The browser suite had never been executed before this phase. Its first run found two defects, both fixed:

1. **Dialog focus (application bug).** React's `autoFocus` focused the first field before `dialog.showModal()` ran; `showModal()` then moved focus to the close button, so keyboard users started on "Close" instead of "Full name". `Modal` now focuses the element marked `data-autofocus` after opening.
2. **Ambiguous test locator.** `getByText("Browser Test Opportunity")` also matched the screen-reader label "Stage for Browser Test Opportunity". The test now targets the card's button by role and exact name.

### Runtime verification against PostgreSQL

Performed in Chrome against `http://127.0.0.1:3000`, with the API at `:8000` connected to PostgreSQL on `127.0.0.1:55433`.

| Step | Expected | Observed |
|---|---|---|
| Starting dashboard (seeded) | 8 contacts · 6 active · ₹5,30,000 pipeline · ₹1,35,000 won · 66.7% | Matched |
| Create contact `Neha.Verma@Lumen.example` (Customer) | Created; email normalized to lowercase; count 9 | Matched; dialog opened with focus on Full name |
| Create deal ₹2,50,000.75 (New) for that contact | 7 active · pipeline ₹7,80,000.75 | Matched (`780000.75`) |
| Move the deal New → Won | 6 active · pipeline ₹5,30,000 · won ₹3,85,000.75 · win rate 3/4 = 75% | Matched; activity feed records the creation and stage change |
| Direct SQL check | Rows present in PostgreSQL, `alembic_version = 0001` | `contacts.id=9`, `deals.id=10 value=250000.75 stage=won` |
| Ctrl+C the launcher | API, UI, and PostgreSQL stop; clean database shutdown | All three exited in 2 s; log ends with `database system is shut down` |
| Relaunch without `--seed` | All records and aggregates persist | 9 contacts, ₹3,85,000.75 won, 75% win rate |

### Screenshots

Captured after the restart with `frontend/scripts/capture-screenshots.mjs` (Chromium, full page):

| View | Desktop (1440 × 900) | Mobile (390 × 844) |
|---|---|---|
| Overview | [desktop-overview](evidence/phase-1-local/desktop-overview.png) | [mobile-overview](evidence/phase-1-local/mobile-overview.png) |
| Contacts | [desktop-contacts](evidence/phase-1-local/desktop-contacts.png) | [mobile-contacts](evidence/phase-1-local/mobile-contacts.png) |
| Pipeline | [desktop-pipeline](evidence/phase-1-local/desktop-pipeline.png) | [mobile-pipeline](evidence/phase-1-local/mobile-pipeline.png) |
| Activity | [desktop-activity](evidence/phase-1-local/desktop-activity.png) | [mobile-activity](evidence/phase-1-local/mobile-activity.png) |
| Navigation drawer | — | [mobile-navigation](evidence/phase-1-local/mobile-navigation.png) |

The desktop sidebar is `position: sticky`, so full-page captures show it only for the first viewport height; in the browser it stays pinned while scrolling.

### Known notes

- Pytest emits a Starlette deprecation warning about its HTTPX test-client shim. It affects only the test client, not the runtime.

## Phase 2 — Containers and Docker Compose

Validated on 16 October 2026 with Docker Desktop 29.6 (linux/arm64) and Trivy 0.75.

| Check | Result |
|---|---|
| Backend image | `python:3.12.15-alpine3.24`, dependencies from `uv.lock`, pip removed, runs as `uid=10001(crm)`, 185 MB |
| Frontend image | `node:24.22-alpine3.24` build → `nginx-unprivileged:1.30-alpine3.24`, runs as `uid=101(nginx)`, 91 MB |
| Trivy, HIGH/CRITICAL (fixed **and** unfixed) | Backend 0 · Frontend 0. The first backend build on `python:3.12-slim` (Debian 13) had 44 unfixed HIGH OS findings, so the base moved to Alpine instead of weakening the gate with `--ignore-unfixed` |
| `docker compose up --build` | `db` healthy → `migrate` exited 0 (`Migrations applied; schema is at head.`) → `backend` healthy (`/ready`) → `frontend` healthy |
| Nginx routes | `/` 200 HTML · `/api/dashboard` 200 JSON · `/api/docs` 200 · `/healthz` 200; `nosniff`, `X-Frame-Options: DENY`, no server version |
| UI through Nginx (Chrome) | Created contact *Arjun Nair* and a ₹1,80,000 Proposal deal; dashboard showed 1 contact, 1 active deal, ₹1,80,000 pipeline |
| Container recreation | `docker compose down` removed all containers and the network; after `docker compose up -d` the contact, deal, and activity were intact; migrate reported `Schema is already at head.` |
| Concurrent migrations | Three `migrate` containers started at once against an empty database: one applied `0001`, two waited on the advisory lock and reported the schema already at head |
| Fresh checkout | Clean `git clone` of this branch, `docker compose -p crm-fresh up --build` on port 8081 → all services healthy (see below) |

Evidence: [compose-status.txt](evidence/phase-2-compose/compose-status.txt) · [desktop overview](evidence/phase-2-compose/desktop-overview.png) · [desktop pipeline](evidence/phase-2-compose/desktop-pipeline.png) · [desktop contacts](evidence/phase-2-compose/desktop-contacts.png) · [mobile overview](evidence/phase-2-compose/mobile-overview.png) · [mobile navigation](evidence/phase-2-compose/mobile-navigation.png)

## Phase 3 — Continuous integration

| Check | Result |
|---|---|
| Pull request [#3](https://github.com/AkshatKushwaha-exe/Devops-CRM/pull/3), run `38878734745` | All 7 jobs green; `Publish to GHCR` skipped as designed on a PR |
| Push to `main` (`014afef`), run `38881495132` | Tests → build → Trivy (0 HIGH/CRITICAL for both images) → **published** |
| Published images | `ghcr.io/akshatkushwaha-exe/devops-crm-backend:014afefde003c3cd149d1d37676d0b0c4ef2c2ea` (`sha256:dd54123d…`) and `…/devops-crm-frontend:014afef…` (`sha256:ac2a0cb0…`), public, linked to the repository, each with a provenance attestation |
| Gate negative test (local) | The earlier Debian-slim backend image yields 44 HIGH findings, so the gate's `jq` count fails the job |

Screenshots of the workflow run, Trivy summaries, and GHCR tags: [`evidence/phase-3-ci/`](evidence/phase-3-ci/).

## Phase 4 — Helm on a local Kubernetes cluster

Validated on minikube v1.39 (Kubernetes 1.37, two arm64 nodes, containerd) with the `ingress`, `metrics-server`, and `storage-provisioner-rancher` addons, using the CI-published images for commit `014afef`.

| Check | Result |
|---|---|
| `helm lint --strict`, kubeconform (strict, 1.34 schemas) | Pass for `values-local.yaml` and `values-eks.yaml` (14 resources each) |
| Install from local images, then `helm upgrade` to GHCR images | Revision 1 → 2: Job `crm-migrate-r2` ran (`Schema is already at head.`); rolling update with no downtime |
| Workloads | 2 × backend, 2 × frontend spread across both nodes; `crm-postgres-0` on a bound `local-path` PVC; HPA 2–6; PDBs `minAvailable: 1` |
| Ingress (`nginx` class) | `/` 200 HTML, `/api/dashboard` 200 JSON, `/api/docs` 200 |
| `helm test crm` | Succeeded: API `/ready`, frontend `/healthz`, and the frontend's `/api` proxy, all checked in-cluster |
| UI through Ingress (Chrome) | Created *Kavya Menon* and a ₹95,000.50 Qualified deal; dashboard matched |
| Pod replacement under traffic | 1 backend + 1 frontend pod deleted during 45 s of continuous requests through the Ingress: **366/366 succeeded**. The first attempt lost 1/302 requests; a `preStop` sleep (5 s) fixed endpoint-removal races. [log](evidence/phase-4-kubernetes/pod-replacement.txt) |
| PostgreSQL pod replacement | `crm-postgres-0` deleted → recreated on the same PVC → data intact. [log](evidence/phase-4-kubernetes/persistence.txt) |
| `helm uninstall` + reinstall | PVC and the kept `crm-database` Secret survived; reinstall reused the password and showed the same records |
| HPA under controlled load | `k8s/load-test.yaml` (fortio, 16 connections, 120 s): 249% CPU → 4 → 6 replicas within ~45 s; 32,801 requests, 100% HTTP 200; then 6 → 2 one pod per minute after a 120 s stabilization window. [log](evidence/phase-4-kubernetes/hpa-scaling.txt) |
| Load-test pitfall found | With keep-alive connections, kube-proxy pins each connection to a pod, so new replicas sat idle while the first two hit their 500m limit ([log](evidence/phase-4-kubernetes/hpa-keepalive-skew.txt)). The load test now opens a connection per request, like independent clients; Ingress and ALB balance per request anyway |

Screenshots through the Ingress: [desktop overview](evidence/phase-4-kubernetes/desktop-overview.png) · [desktop pipeline](evidence/phase-4-kubernetes/desktop-pipeline.png) · [mobile overview](evidence/phase-4-kubernetes/mobile-overview.png)

## Phase 5 — AWS infrastructure with Terraform

Applied on 16 October 2026 to the capstone account (AWS free account plan, ap-south-1) as the `devops-crm-admin` role, which is reached from a key-only IAM user. The root user was used only once, to create that role.

| Check | Result |
|---|---|
| Account activation | Regional services failed with `OptInRequired`/`SubscriptionRequired` until India customer verification passed. The address check had failed against the college address; after correcting the contact address and re-verifying Aadhaar through DigiLocker, EC2/EKS/S3 activated within minutes |
| First `terraform apply` | 65 resources: VPC, subnets, NAT, EKS 1.36 control plane (9m48s), KMS, IAM, OIDC, pod-identity roles. The **node group never launched**: `InvalidParameterCombination - The specified instance type is not eligible for Free Tier` (free-plan accounts may only run Free Tier eligible types) |
| Fix | Interrupted the apply, deleted the stuck node group, and switched to `m7i-flex.large` (largest Free Tier type: 2 vCPU, 8 GiB, x86_64) on AL2023 x86. CI now publishes multi-arch images ([#9](https://github.com/AkshatKushwaha-exe/Devops-CRM/pull/9)) |
| Second `terraform apply` | 10 resources: node group (Ready in 1m18s, two AZs), coredns, kube-proxy, aws-ebs-csi-driver, metrics-server, AWS Load Balancer Controller (Helm), default gp3 StorageClass, `crm` namespace + deployer RBAC. [terraform-apply.txt](evidence/phase-5-aws/terraform-apply.txt) |
| Cluster | 2 × `m7i-flex.large` Ready (v1.36.4-eks), all system pods Running, `gp3 (default)` and `alb` IngressClass present. [cluster-state.txt](evidence/phase-5-aws/cluster-state.txt) |
| Cost controls | Control-plane logging limited to `authenticator` (7-day retention); node group capped at 2 by the 5 vCPU quota; `devops-crm-monthly` budget ($30) emails at 50%/100%/forecast |

## Phase 6 — Continuous deployment to EKS

| Check | Result |
|---|---|
| First Deploy run | Failed at OIDC: `Not authorized to perform sts:AssumeRoleWithWebIdentity`. The repository sends GitHub's **immutable** subject `repo:AkshatKushwaha-exe@177707032/Devops-CRM@1420946191:environment:production`; the trust policy now accepts it alongside the legacy form |
| Initial install (Deploy dispatched for `abfe21f`) | OIDC → namespace-scoped role → `helm upgrade --install` → migration Job → rollout → `helm test` → ALB serving `abfe21f`. Contact *Riya Kapoor* and a ₹1,20,000 Won deal created through the live UI. [before screenshot](evidence/phase-5-aws/chrome-live-overview-before.jpg) · [app-on-eks-before.txt](evidence/phase-5-aws/app-on-eks-before.txt) |
| **Visible change pushed** | Merging [#10](https://github.com/AkshatKushwaha-exe/Devops-CRM/pull/10) (workspace label shows the environment) triggered CI on `main`: tests → 4 native image builds → 4 Trivy gates → publish → **Deploy to EKS**, all green in 5m33s with no manual step. [pipeline](evidence/phase-6-cd/actions-ci-cd-run-0dc37db.jpg) · [deploy summary](evidence/phase-6-cd/deploy-summary-0dc37db.jpg) · [deploy log](evidence/phase-6-cd/deploy-job-log-0dc37db.txt) |
| Live result | Header changed from "Local workspace" to **"Production workspace"**; footer `build 0dc37db`; `/api/version` → `{"version":"0dc37db…","environment":"Production"}`; earlier records intact. [after screenshot](evidence/phase-6-cd/chrome-live-overview-after.jpg) |
| Zero-downtime rollout | Polling `/api/version` and `/` through the ALB every 3 s during the deploy: **98/98 successful**; old and new builds overlapped for ~40 s, then only `0dc37db` answered. [live-rollout-poll.txt](evidence/phase-6-cd/live-rollout-poll.txt) |
| Rollback procedure exercised | Deploy workflow dispatched with the previous SHA `abfe21f`: revision 3 deployed, `crm-migrate-r3` (older image) reported `Schema is already at head.`, data intact. Then rolled forward to `0dc37db` (revision 4) the same way. [rollback.txt](evidence/phase-6-cd/rollback.txt) |

## Phase 7 — Monitoring and troubleshooting

| Check | Result |
|---|---|
| `scripts/install-monitoring.sh` | kube-prometheus-stack 92.9.0 (Prometheus v3.15, Grafana, kube-state-metrics, node-exporter) in `monitoring` |
| Prometheus targets | 17/17 up, including `serviceMonitor/crm/crm-backend` (2 → 4 targets as the HPA scaled). [screenshot](evidence/phase-7-monitoring/prometheus-targets.jpg) |
| Alert rules | `devops-crm` group loaded: CrmHighErrorRate, CrmHighLatency, CrmApiUnavailable, CrmPodsWaiting. [screenshot](evidence/phase-7-monitoring/prometheus-alert-rules.jpg) |
| Grafana dashboard under load | 147 req/s, 0.00% 5xx, p95 379 ms, HPA 2 → 4 → 6, CPU per pod, memory, and `crm-lab · ImagePullBackOff` in the waiting-containers panel. [top](evidence/phase-7-monitoring/grafana-dashboard-top.jpg) · [bottom](evidence/phase-7-monitoring/grafana-dashboard-bottom.jpg) |
| Exercise 1, invalid image tag | `ErrImagePull`/`ImagePullBackOff`; Events show `…:b74afac…bcda: not found`; compared with the GHCR tags (39 vs 40 characters); fixed with `kubectl set image`. [log](evidence/phase-7-monitoring/exercise-1-invalid-image-tag.txt) |
| Exercise 2, wrong Service selector | Pods Ready but `Connection refused`; EndpointSlice empty; selector `app=api-gateway,tier=frontend` vs labels `app=lab-api-gateway,tier=edge`; patched, and endpoints and `/api/version` worked. [log](evidence/phase-7-monitoring/exercise-2-wrong-service-selector.txt) |
| Exercise 3, HPA | 16,096 requests, 100% HTTP 200; `SuccessfulRescale` to 4 and 6 |

**Unplanned incident, also diagnosed:** after Prometheus was added, Grafana showed no data. Its datasource check failed with `lookup kps-prometheus.monitoring: i/o timeout`, and Prometheus restarted repeatedly on liveness timeouts. Pods on `minikube-m02` received `connection refused` from the DNS Service, while direct pod-IP traffic worked. `docker stats` showed the control-plane node container at **2.08/2.15 GiB**: minikube's Docker driver caps each node at about 2 GiB, while Kubernetes sees the host's 8 GiB, so the scheduler overpacked the node (API server 903 Mi). Raising both node containers to 3 GiB (`docker update --memory 3g`) restored DNS, Prometheus readiness, and the Grafana datasource. Grafana's own 256 Mi limit also caused an `OOMKilled` restart, so it was raised to 512 Mi. EKS `t4g.large` nodes report their real 8 GiB, so the scheduler sees the true capacity there.

### On EKS

`scripts/install-monitoring.sh` against the EKS context: 19/19 targets up, including `serviceMonitor/crm/crm-backend`, which reached **6/6** as the HPA scaled under the load test. Grafana showed 143 req/s, 0.00% 5xx, p95 243 ms, HPA 2 → 6, and `PodInitializing` for new API pods waiting on the schema check. [eks-grafana-dashboard-top](evidence/phase-7-monitoring/eks-grafana-dashboard-top.jpg) · [eks-grafana-dashboard-bottom](evidence/phase-7-monitoring/eks-grafana-dashboard-bottom.jpg) · [eks-prometheus-targets](evidence/phase-7-monitoring/eks-prometheus-targets.jpg)
