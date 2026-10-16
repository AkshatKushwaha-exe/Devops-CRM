#!/usr/bin/env bash
# Install Prometheus + Grafana (kube-prometheus-stack) into the current kubectl context,
# then redeploy the CRM chart's ServiceMonitor/alerts/dashboard if the release exists.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

CHART_VERSION="${KPS_CHART_VERSION:-92.9.0}"
NAMESPACE=monitoring

kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
if ! kubectl -n "$NAMESPACE" get secret grafana-admin >/dev/null 2>&1; then
  kubectl -n "$NAMESPACE" create secret generic grafana-admin \
    --from-literal=admin-user=admin \
    --from-literal=admin-password="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)"
fi

helm upgrade --install kube-prometheus-stack kube-prometheus-stack \
  --repo https://prometheus-community.github.io/helm-charts --version "$CHART_VERSION" \
  --namespace "$NAMESPACE" -f monitoring/kube-prometheus-stack.values.yaml \
  --wait --timeout 10m

# The app chart renders its ServiceMonitor only once the CRDs exist: re-apply it.
if helm -n crm status crm >/dev/null 2>&1; then
  helm -n crm upgrade crm charts/devops-crm --reset-then-reuse-values --wait --timeout 10m
fi

cat <<MSG
Grafana:    kubectl -n $NAMESPACE port-forward svc/kps-grafana 3001:80   → http://localhost:3001
            user admin, password: kubectl -n $NAMESPACE get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d
Prometheus: kubectl -n $NAMESPACE port-forward svc/kps-prometheus 9090:9090 → http://localhost:9090/targets
MSG
