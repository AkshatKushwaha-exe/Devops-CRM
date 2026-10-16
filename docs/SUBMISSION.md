# Submission evidence index

Every grading requirement mapped to where it is implemented and the evidence that it works. Detailed results per phase are in [VALIDATION.md](VALIDATION.md); the live walkthrough is [DEMO.md](DEMO.md).

## Requirements → implementation → evidence

| # | Requirement | Implementation | Evidence |
|---|---|---|---|
| 1 | Application verified on PostgreSQL; desktop/mobile screenshots | `backend/`, `frontend/`, `scripts/dev.sh` | [tests/backend-pytest.txt](evidence/tests/backend-pytest.txt) (37 passed) · [tests/frontend-tests.txt](evidence/tests/frontend-tests.txt) (10 unit + 2 browser) · [phase-1-local/](evidence/phase-1-local/) (9 screenshots) · VALIDATION Phase 1 |
| 2 | Non-root images, multi-stage Nginx frontend, `/api` routing, Compose with health checks, persistent storage, explicit migrations | `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx/`, `compose.yaml`, `backend/app/migrate.py` | [phase-2-compose/compose-status.txt](evidence/phase-2-compose/compose-status.txt) · [phase-2-compose/](evidence/phase-2-compose/) screenshots · VALIDATION Phase 2 |
| 3 | CI: tests/lint → frontend build → images → Trivy (HIGH/CRITICAL fail) → GHCR, commit-SHA tags | `.github/workflows/ci.yml` | [actions-run-main.jpg](evidence/phase-3-ci/actions-run-main.jpg) · [trivy-backend-summary.jpg](evidence/phase-3-ci/trivy-backend-summary.jpg) · [trivy-frontend-and-published-images.jpg](evidence/phase-3-ci/trivy-frontend-and-published-images.jpg) · [trivy-backend/trivy.txt](evidence/phase-3-ci/trivy-backend/trivy.txt) · [ghcr-backend-package.jpg](evidence/phase-3-ci/ghcr-backend-package.jpg) |
| 4 | Helm chart: Deployments, ClusterIP Services, config, secrets, PostgreSQL PVC, probes, 2+2 replicas, Ingress, CPU requests, metrics-server, HPA; replacement, persistence, scaling validated | `charts/devops-crm/`, `k8s/load-test.yaml` | [pod-replacement.txt](evidence/phase-4-kubernetes/pod-replacement.txt) · [persistence.txt](evidence/phase-4-kubernetes/persistence.txt) · [hpa-scaling.txt](evidence/phase-4-kubernetes/hpa-scaling.txt) · [phase-4-kubernetes/](evidence/phase-4-kubernetes/) screenshots |
| 5 | Terraform: VPC, subnets, EKS, managed nodes, example variables, setup procedure; ingress controller and EBS storage on EKS | `infra/terraform/` (README, `terraform.tfvars.example`) | `phase-5-aws/` (pending account activation) |
| 6 | CD: deploy exact SHA via Helm, migrations, rollout wait, readiness, documented rollback, GitHub OIDC | `.github/workflows/deploy.yml`, `docs/OPERATIONS.md` | `phase-6-cd/` (pending) |
| 7 | Prometheus + Grafana on `/metrics` (traffic, latency, errors, resources); invalid-image and wrong-selector drills; HPA demo | `charts/devops-crm/templates/monitoring.yaml`, `dashboards/`, `scripts/install-monitoring.sh`, `k8s/exercises/` | [grafana-dashboard-top.jpg](evidence/phase-7-monitoring/grafana-dashboard-top.jpg) · [grafana-dashboard-bottom.jpg](evidence/phase-7-monitoring/grafana-dashboard-bottom.jpg) · [prometheus-targets.jpg](evidence/phase-7-monitoring/prometheus-targets.jpg) · [exercise-1](evidence/phase-7-monitoring/exercise-1-invalid-image-tag.txt) · [exercise-2](evidence/phase-7-monitoring/exercise-2-wrong-service-selector.txt) |
| 8 | Evidence collected, ≥ 10 commits, teardown evidence, rehearsed demo | this file, `docs/DEMO.md` | Commit history (below) · `phase-8-teardown/` (after evaluation) |

## Screenshot checklist

| Item | Local | AWS |
|---|---|---|
| Tests | ✅ `evidence/tests/` + CI test jobs | — |
| Docker Compose | ✅ `phase-2-compose/` | — |
| GitHub Actions run | ✅ `phase-3-ci/actions-run-main.jpg` | ⏳ deploy run |
| Trivy results | ✅ `phase-3-ci/trivy-*` | — |
| GHCR tags | ✅ `phase-3-ci/ghcr-backend-package.jpg` | — |
| Terraform | — | ⏳ plan/apply output, EKS console |
| Running pods / Services | ✅ `phase-4-kubernetes/*.txt` | ⏳ |
| Helm releases | ✅ `phase-4-kubernetes/persistence.txt` | ⏳ |
| Ingress | ✅ minikube nginx | ⏳ ALB |
| Prometheus targets | ✅ `phase-7-monitoring/prometheus-targets.jpg` | ⏳ |
| Grafana | ✅ `phase-7-monitoring/grafana-dashboard-*.jpg` | ⏳ |
| Teardown | — | ⏳ after evaluation |

## Commit history

Each phase was developed on its own branch and merged through a pull request whose CI had to pass ([#1](https://github.com/AkshatKushwaha-exe/Devops-CRM/pull/1)–[#7](https://github.com/AkshatKushwaha-exe/Devops-CRM/pull/7)). Merge commits keep each phase's individual commits. `git log --oneline --no-merges main` lists the feature commits; there are more than 10.
