# Submission evidence index

Every grading requirement mapped to where it is implemented and the evidence that it works. Detailed results per phase are in [VALIDATION.md](VALIDATION.md); the live walkthrough is [DEMO.md](DEMO.md).

## Presentation video

[devops-crm-presentation.mp4](devops-crm-presentation.mp4): a 7½-minute captioned walkthrough (1080p, no audio) of the running system: the live app on EKS, GitHub Actions, GHCR, the AWS console, Prometheus, and Grafana, with terminal output captured from the cluster. It follows the demo order: application → commit → pipeline → images → Trivy → GHCR → Terraform → EKS → Helm → ingress → autoscaling → monitoring → troubleshooting.

The live change shown is [PR #14](https://github.com/AkshatKushwaha-exe/Devops-CRM/pull/14) (brand accent green → indigo): CI run [38931035243](https://github.com/AkshatKushwaha-exe/Devops-CRM/actions/runs/38931035243) passed all four Trivy gates and deployed `104715a` to EKS (Helm revision 7 → 8). Evidence: [demo-trivy-gates-and-publish.jpg](evidence/phase-6-cd/demo-trivy-gates-and-publish.jpg) · [demo-deploy-summary.jpg](evidence/phase-6-cd/demo-deploy-summary.jpg).

## Requirements → implementation → evidence

| # | Requirement | Implementation | Evidence |
|---|---|---|---|
| 1 | Application verified on PostgreSQL; desktop/mobile screenshots | `backend/`, `frontend/`, `scripts/dev.sh` | [tests/backend-pytest.txt](evidence/tests/backend-pytest.txt) (37 passed) · [tests/frontend-tests.txt](evidence/tests/frontend-tests.txt) (10 unit + 2 browser) · [phase-1-local/](evidence/phase-1-local/) (9 screenshots) · VALIDATION Phase 1 |
| 2 | Non-root images, multi-stage Nginx frontend, `/api` routing, Compose with health checks, persistent storage, explicit migrations | `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx/`, `docker-compose.yml`, `backend/app/migrate.py` | [phase-2-compose/compose-status.txt](evidence/phase-2-compose/compose-status.txt) · [phase-2-compose/](evidence/phase-2-compose/) screenshots · VALIDATION Phase 2 |
| 3 | CI: tests/lint → frontend build → images → Trivy (HIGH/CRITICAL fail) → GHCR, commit-SHA tags | `.github/workflows/ci.yml` | [actions-run-main.jpg](evidence/phase-3-ci/actions-run-main.jpg) · [trivy-backend-summary.jpg](evidence/phase-3-ci/trivy-backend-summary.jpg) · [trivy-frontend-and-published-images.jpg](evidence/phase-3-ci/trivy-frontend-and-published-images.jpg) · [trivy-backend/trivy.txt](evidence/phase-3-ci/trivy-backend/trivy.txt) · [ghcr-backend-package.jpg](evidence/phase-3-ci/ghcr-backend-package.jpg) |
| 4 | Helm chart: Deployments, ClusterIP Services, config, secrets, PostgreSQL PVC, probes, 2+2 replicas, Ingress, CPU requests, metrics-server, HPA; replacement, persistence, scaling validated | `helm/devops-crm/`, `k8s/load-test.yaml` | [pod-replacement.txt](evidence/phase-4-kubernetes/pod-replacement.txt) · [persistence.txt](evidence/phase-4-kubernetes/persistence.txt) · [hpa-scaling.txt](evidence/phase-4-kubernetes/hpa-scaling.txt) · [phase-4-kubernetes/](evidence/phase-4-kubernetes/) screenshots |
| 5 | Terraform: VPC, subnets, EKS, managed nodes, example variables, setup procedure; ingress controller and EBS storage on EKS | `terraform/` (README, `terraform.tfvars.example`) | [terraform-apply.txt](evidence/phase-5-aws/terraform-apply.txt) · [cluster-state.txt](evidence/phase-5-aws/cluster-state.txt) · [app-on-eks-before.txt](evidence/phase-5-aws/app-on-eks-before.txt) · [live app](evidence/phase-5-aws/chrome-live-overview-before.jpg) |
| 6 | CD: deploy exact SHA via Helm, migrations, rollout wait, readiness, documented rollback, GitHub OIDC | `.github/workflows/deploy.yml`, `docs/OPERATIONS.md` | [actions-ci-cd-run-0dc37db.jpg](evidence/phase-6-cd/actions-ci-cd-run-0dc37db.jpg) · [deploy-summary](evidence/phase-6-cd/deploy-summary-0dc37db.jpg) · [deploy log](evidence/phase-6-cd/deploy-job-log-0dc37db.txt) · [live-rollout-poll.txt](evidence/phase-6-cd/live-rollout-poll.txt) (98/98) · [rollback.txt](evidence/phase-6-cd/rollback.txt) · [after](evidence/phase-6-cd/chrome-live-overview-after.jpg) |
| 7 | Prometheus + Grafana on `/metrics` (traffic, latency, errors, resources); invalid-image and wrong-selector drills; HPA demo | `helm/devops-crm/templates/monitoring.yaml`, `dashboards/`, `scripts/install-monitoring.sh`, `k8s/exercises/` | EKS: [eks-grafana-dashboard-top.jpg](evidence/phase-7-monitoring/eks-grafana-dashboard-top.jpg) · [eks-prometheus-targets.jpg](evidence/phase-7-monitoring/eks-prometheus-targets.jpg) · local: [grafana-dashboard-top.jpg](evidence/phase-7-monitoring/grafana-dashboard-top.jpg) · [grafana-dashboard-bottom.jpg](evidence/phase-7-monitoring/grafana-dashboard-bottom.jpg) · [prometheus-targets.jpg](evidence/phase-7-monitoring/prometheus-targets.jpg) · [exercise-1](evidence/phase-7-monitoring/exercise-1-invalid-image-tag.txt) · [exercise-2](evidence/phase-7-monitoring/exercise-2-wrong-service-selector.txt) |
| 8 | Evidence collected, ≥ 10 commits, teardown evidence, rehearsed demo | this file, `docs/DEMO.md` | Commit history (below) · `phase-8-teardown/` (after evaluation) |

## Screenshot checklist

| Item | Local | AWS |
|---|---|---|
| Tests | ✅ `evidence/tests/` + CI test jobs | — |
| Docker Compose | ✅ `phase-2-compose/` | — |
| GitHub Actions run | ✅ `phase-3-ci/actions-run-main.jpg` | ✅ `phase-6-cd/actions-ci-cd-run-0dc37db.jpg`, `phase-6-cd/demo-deploy-summary.jpg` |
| Trivy results | ✅ `phase-3-ci/trivy-*` | ✅ `phase-6-cd/demo-trivy-gates-and-publish.jpg` |
| GHCR tags | ✅ `phase-3-ci/ghcr-backend-package.jpg` | — |
| Terraform | — | ✅ `phase-5-aws/terraform-apply.txt` |
| Running pods / Services | ✅ `phase-4-kubernetes/*.txt` | ✅ `phase-5-aws/app-on-eks-before.txt`, `phase-6-cd/rollback.txt` |
| Helm releases | ✅ `phase-4-kubernetes/persistence.txt` | ✅ `phase-6-cd/rollback.txt` (revisions 1–4) |
| Ingress | ✅ minikube nginx | ✅ ALB (`phase-5-aws/app-on-eks-before.txt`) |
| Prometheus targets | ✅ `phase-7-monitoring/prometheus-targets.jpg` | ✅ `phase-7-monitoring/eks-prometheus-targets.jpg` |
| Grafana | ✅ `phase-7-monitoring/grafana-dashboard-*.jpg` | ✅ `phase-7-monitoring/eks-grafana-dashboard-*.jpg` |
| Teardown | — | ⏳ after evaluation |

## Commit history

Each phase was developed on its own branch and merged through a pull request whose CI had to pass ([#1](https://github.com/AkshatKushwaha-exe/Devops-CRM/pull/1)–[#14](https://github.com/AkshatKushwaha-exe/Devops-CRM/pull/14)), including the live change in the video (#14). Merge commits keep each phase's individual commits. `git log --oneline --no-merges main` lists the feature commits; there are more than 10.
