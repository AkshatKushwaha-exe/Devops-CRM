#!/usr/bin/env bash
# Run the real commands shown in the video's terminal scenes and save their output to
# presentation/captures/<name>.txt ("$ cmd" lines are typed on screen; the rest is output).
#   bash presentation/capture.sh database tests docker kubernetes hpa troubleshooting
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
export AWS_PROFILE="${AWS_PROFILE:-devops-crm}" AWS_REGION="${AWS_REGION:-ap-south-1}"
K="kubectl --context devops-crm-eks"
OUT=presentation/captures
mkdir -p "$OUT"
account=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo none)

# show "<command as displayed>" <command to run...>
show() { local label=$1; shift; echo "\$ $label"; "$@" 2>&1 | sed -e "s/$account/<account-id>/g" -e $'s/\x1b\\[[0-9;]*m//g'; echo; }

database() {
  local psql=($K -n crm exec crm-postgres-0 -- psql -U crm -d crm -P pager=off)
  show "kubectl -n crm exec crm-postgres-0 -- psql -U crm -d crm -c '\\dt'" "${psql[@]}" -c '\dt'
  show "kubectl -n crm exec crm-postgres-0 -- psql -U crm -d crm -c 'select version_num from alembic_version'" "${psql[@]}" -c 'select version_num from alembic_version'
  show "kubectl -n crm exec crm-postgres-0 -- psql -U crm -d crm -c 'select id, name, email, company, status from contacts'" "${psql[@]}" -c 'select id, name, email, company, status from contacts order by id'
}

tests() {
  show "cd backend && uv run pytest -v" bash -c 'cd backend && uv run pytest -v -p no:cacheprovider 2>&1 | grep -E "PASSED|FAILED|passed|failed" | sed -E "s/ +\[ *[0-9]+%\]//"'
  show "cd frontend && pnpm test" bash -c 'cd frontend && pnpm test 2>&1 | grep -E "✓|Test Files|Tests "'
  show "pnpm test:e2e" bash -c 'cd frontend && pnpm test:e2e --reporter=list 2>&1 | grep -E "✓|passed|failed"'
  show "uv run ruff check app alembic tests && pnpm format:check" bash -c 'cd backend && uv run ruff check app alembic tests; cd ../frontend && pnpm -s format:check'
}

docker_() {
  show "docker compose up --build -d" bash -c 'docker compose up --build -d 2>&1 | grep -E "Built|Healthy|Started|Exited|Running" | grep -v "^ *Image .* Built$" | awk "!seen[\$0]++"'
  show "docker compose ps -a" docker compose ps -a --format 'table {{.Service}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
  show "docker compose exec backend id && docker compose exec frontend id" bash -c 'docker compose exec backend id; docker compose exec frontend id'
  show "curl -s localhost:3000/api/version" curl -s localhost:3000/api/version
}

kubernetes() {
  show "kubectl get nodes" $K get nodes -o custom-columns='NAME:.metadata.name,STATUS:.status.conditions[-1].type,VERSION:.status.nodeInfo.kubeletVersion,INSTANCE:.metadata.labels.node\.kubernetes\.io/instance-type,ZONE:.metadata.labels.topology\.kubernetes\.io/zone'
  show "kubectl -n crm get pods" $K -n crm get pods -o custom-columns='NAME:.metadata.name,READY:.status.containerStatuses[0].ready,STATUS:.status.phase,NODE:.spec.nodeName' --sort-by=.metadata.name
  show "kubectl -n crm get svc,ingress" $K -n crm get svc,ingress
  show "kubectl -n crm get hpa,statefulset,pvc" $K -n crm get hpa,statefulset,pvc -o wide --no-headers
  show "helm list -n crm" helm --kube-context devops-crm-eks list -n crm
  show "helm history crm -n crm" helm --kube-context devops-crm-eks history crm -n crm --max 6
}

hpa() {
  $K -n crm delete job crm-load-test --ignore-not-found >/dev/null
  show "kubectl -n crm apply -f k8s/load-test.yaml" $K -n crm apply -f k8s/load-test.yaml
  echo "\$ kubectl -n crm get hpa crm-backend --watch"
  local last=""
  for _ in $(seq 1 26); do
    line=$($K -n crm get hpa crm-backend --no-headers | awk '{printf "%-12s %-24s %-14s min=%s max=%s replicas=%s\n", $1, $2, $3" "$4, $5, $6, $7}')
    [ "$line" != "$last" ] && echo "$(date +%H:%M:%S)  $line" && last=$line
    sleep 10
  done
  echo
  show "kubectl -n crm top pods -l app.kubernetes.io/component=backend" $K -n crm top pods -l app.kubernetes.io/component=backend
  show "kubectl -n crm describe hpa crm-backend | grep SuccessfulRescale" bash -c "$K -n crm describe hpa crm-backend | grep SuccessfulRescale | sed -E 's/ +/ /g' | tail -4"
}

troubleshooting() {
  local good=$(git rev-parse origin/main)
  $K delete namespace crm-lab --ignore-not-found --wait >/dev/null
  echo "# Exercise 1: a deployment with a mistyped image tag"
  show "kubectl apply -f k8s/exercises/00-namespace.yaml -f k8s/exercises/01-invalid-image-tag.yaml" $K apply -f k8s/exercises/00-namespace.yaml -f k8s/exercises/01-invalid-image-tag.yaml
  sleep 25
  show "kubectl -n crm-lab get pods" $K -n crm-lab get pods
  local pod=$($K -n crm-lab get pod -l app=lab-web -o name | head -1)
  show "kubectl -n crm-lab describe ${pod} | grep -A4 Events" bash -c "$K -n crm-lab describe $pod | sed -n '/Events:/,\$p' | grep -E 'Failed|BackOff' | sed -E 's/ +/ /g' | cut -c1-150 | head -3"
  show "kubectl -n crm-lab set image deploy/lab-web web=ghcr.io/akshatkushwaha-exe/devops-crm-frontend:${good:0:12}…" $K -n crm-lab set image deploy/lab-web web=ghcr.io/akshatkushwaha-exe/devops-crm-frontend:$good
  show "kubectl -n crm-lab rollout status deploy/lab-web" $K -n crm-lab rollout status deploy/lab-web --timeout=180s
  echo "# Exercise 2: a Service whose selector matches no pods"
  show "kubectl apply -f k8s/exercises/02-wrong-service-selector.yaml" $K apply -f k8s/exercises/02-wrong-service-selector.yaml
  $K -n crm-lab rollout status deploy/lab-api-gateway --timeout=180s >/dev/null
  show "kubectl -n crm-lab run probe --rm -i --image=busybox:1.37 -- wget -qO- -T 3 http://lab-api-gateway/healthz" bash -c "$K -n crm-lab run probe --rm -i --restart=Never --image=busybox:1.37 --overrides='{\"spec\":{\"securityContext\":{\"runAsNonRoot\":true,\"runAsUser\":65534}}}' -- wget -qO- -T 3 http://lab-api-gateway/healthz 2>&1 | grep -E 'wget|ok'"
  show "kubectl -n crm-lab get endpointslices -l kubernetes.io/service-name=lab-api-gateway" $K -n crm-lab get endpointslices -l kubernetes.io/service-name=lab-api-gateway
  show "kubectl -n crm-lab describe svc lab-api-gateway | grep Selector" bash -c "$K -n crm-lab describe svc lab-api-gateway | grep Selector"
  show "kubectl -n crm-lab get pods -l app=lab-api-gateway --show-labels" bash -c "$K -n crm-lab get pods -l app=lab-api-gateway --show-labels | awk '{print \$1, \$3, \$NF}'"
  show "kubectl -n crm-lab patch svc lab-api-gateway -p '{\"spec\":{\"selector\":{\"app\":\"lab-api-gateway\",\"tier\":\"edge\"}}}'" $K -n crm-lab patch svc lab-api-gateway --type merge -p '{"spec":{"selector":{"app":"lab-api-gateway","tier":"edge"}}}'
  sleep 3
  show "kubectl -n crm-lab get endpointslices -l kubernetes.io/service-name=lab-api-gateway" $K -n crm-lab get endpointslices -l kubernetes.io/service-name=lab-api-gateway
  show "kubectl delete namespace crm-lab" $K delete namespace crm-lab --wait=false
}

for name in "$@"; do
  fn=$name; [ "$name" = docker ] && fn=docker_
  "$fn" > "$OUT/$name.txt"
  echo "captured $OUT/$name.txt ($(wc -l < "$OUT/$name.txt") lines)"
done
