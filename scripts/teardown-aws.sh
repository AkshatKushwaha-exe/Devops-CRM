#!/usr/bin/env bash
# Remove every AWS resource of the capstone, in an order that lets Terraform delete the VPC,
# and record the evidence in docs/evidence/phase-8-teardown/.
#   AWS_PROFILE=devops-crm bash scripts/teardown-aws.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

: "${AWS_PROFILE:?Set AWS_PROFILE (e.g. devops-crm)}"
export AWS_REGION="${AWS_REGION:-ap-south-1}"
CLUSTER=devops-crm
EVIDENCE=docs/evidence/phase-8-teardown
mkdir -p "$EVIDENCE"
LOG="$EVIDENCE/teardown.log"
account=$(aws sts get-caller-identity --query Account --output text)
redact() { sed "s/$account/<account-id>/g"; }
log() { echo "$*" | redact | tee -a "$LOG"; }
run() { log "\$ $*"; "$@" 2>&1 | redact | tee -a "$LOG"; }

: > "$LOG"
log "# Teardown started $(date -u +%Y-%m-%dT%H:%M:%SZ) in $AWS_REGION"

if aws eks describe-cluster --name "$CLUSTER" >/dev/null 2>&1; then
  aws eks update-kubeconfig --name "$CLUSTER" --alias "$CLUSTER-eks" >/dev/null
  # 1. Application first: the Ingress owns the ALB and the PVC owns an EBS volume, both
  #    created outside Terraform. Deleting them lets their controllers clean up in AWS.
  run helm --kube-context "$CLUSTER-eks" -n crm uninstall crm --wait --timeout 10m || true
  run kubectl --context "$CLUSTER-eks" -n crm delete pvc --all --wait=true --timeout=5m || true
  run kubectl --context "$CLUSTER-eks" -n crm delete secret crm-database --ignore-not-found
  run helm --kube-context "$CLUSTER-eks" -n monitoring uninstall kube-prometheus-stack --wait --timeout 10m || true

  log "# Waiting for the load balancer and the PVC volume to disappear"
  for _ in $(seq 1 60); do
    albs=$(aws elbv2 describe-load-balancers --query "length(LoadBalancers[?contains(LoadBalancerName, 'devops-crm')])" --output text)
    vols=$(aws ec2 describe-volumes --filters Name=tag-key,Values=kubernetes.io/created-for/pvc/name --query 'length(Volumes)' --output text)
    [ "$albs" = "0" ] && [ "$vols" = "0" ] && break
    sleep 10
  done
  log "load balancers left: $albs, PVC volumes left: $vols"
fi

# 2. Everything Terraform created: node group, cluster, add-ons, IAM, VPC, NAT, KMS.
log "\$ terraform -chdir=terraform destroy -auto-approve"
terraform -chdir=terraform destroy -auto-approve -no-color 2>&1 | redact | grep -E 'Destroying|Destruction complete|Destroy complete|Error' | tee -a "$LOG"

# 3. Prove nothing billable is left.
log "# Remaining resources tagged Project=devops-crm or created for the cluster"
run aws eks list-clusters --output text
run aws ec2 describe-instances --filters Name=tag:eks:cluster-name,Values="$CLUSTER" Name=instance-state-name,Values=pending,running,stopping,stopped --query 'Reservations[].Instances[].InstanceId' --output text
run aws ec2 describe-nat-gateways --filter Name=state,Values=pending,available --query 'NatGateways[].NatGatewayId' --output text
run aws elbv2 describe-load-balancers --query 'LoadBalancers[].LoadBalancerName' --output text
run aws ec2 describe-volumes --filters Name=tag-key,Values=kubernetes.io/created-for/pvc/name --query 'Volumes[].VolumeId' --output text
run aws ec2 describe-addresses --query 'Addresses[].PublicIp' --output text
run aws ec2 describe-vpcs --filters Name=tag:Project,Values=devops-crm --query 'Vpcs[].VpcId' --output text
log "# Teardown finished $(date -u +%Y-%m-%dT%H:%M:%SZ). Empty outputs above mean nothing is left."
log "# Still to remove by hand when done with the account: IAM user devops-crm-cli, role devops-crm-admin, budget devops-crm-monthly."
