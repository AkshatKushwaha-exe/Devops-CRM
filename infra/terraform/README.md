# AWS infrastructure (Terraform)

Provisions everything the CRM needs on AWS in **ap-south-1**:

| Layer | Resources |
|---|---|
| Network | VPC `10.20.0.0/16` across 2 AZs; public subnets (`/24`, tagged for internet-facing ALBs) and private subnets (`/20`, nodes); internet gateway; one NAT gateway |
| Cluster | EKS 1.36 with the API authentication mode (access entries); public endpoint (CIDR-restrictable); KMS-encrypted secrets |
| Compute | Managed node group: 2 × `t4g.large` (Graviton, arm64, AL2023) in private subnets, scalable to 3; encrypted 30 GiB gp3 root volumes |
| Add-ons | `vpc-cni`, `kube-proxy`, `coredns`, `eks-pod-identity-agent`, `metrics-server` (HPA), `aws-ebs-csi-driver` (Pod Identity) |
| Ingress | AWS Load Balancer Controller (Helm, Pod Identity) → the chart's `alb` Ingress becomes an internet-facing ALB with IP targets |
| Storage | Default `gp3` StorageClass (encrypted EBS, `WaitForFirstConsumer`, expandable) for the PostgreSQL volume |
| CD access | GitHub OIDC provider + `devops-crm-github-deploy` role, assumable only by this repo's `production` environment; EKS access entry with `AmazonEKSAdminPolicy` **scoped to namespace `crm`**, plus a Role for ServiceMonitors |

PostgreSQL runs **inside the cluster** as the chart's StatefulSet on an EBS gp3 volume. See [managed database alternative](#managed-database-alternative) below.

## Prerequisites

- Terraform ≥ 1.10, AWS CLI v2, kubectl, Helm 4
- An AWS profile for **your own account** with permission to create VPC, EKS, EC2, IAM, and ELB resources

```bash
export AWS_PROFILE=<your-profile>
export AWS_REGION=ap-south-1
aws sts get-caller-identity          # confirm the account before creating anything
```

## Create

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # optional; defaults match the example
terraform init
terraform plan -out tfplan
terraform apply tfplan                          # ~15–20 minutes
$(terraform output -raw kubeconfig_command)     # aws eks update-kubeconfig …
kubectl get nodes -o wide
```

Then connect CD (see the repository README, "Continuous deployment"):

```bash
gh variable set AWS_DEPLOY_ROLE_ARN --env production --body "$(terraform output -raw github_deploy_role_arn)"
gh variable set EKS_CLUSTER_NAME    --env production --body "$(terraform output -raw cluster_name)"
gh variable set AWS_REGION          --env production --body "$(terraform output -raw region)"
```

If your account already has the `token.actions.githubusercontent.com` OIDC provider, set `create_github_oidc_provider = false`.

## Cost

Approximate on-demand prices in ap-south-1 while the stack exists (about $0.33/hour, $8/day):

| Item | ≈ USD/hour |
|---|---|
| EKS control plane | 0.10 |
| 2 × t4g.large | 0.13 |
| NAT gateway (+ data) | 0.06 |
| ALB (created by the app's Ingress) | 0.025 + LCUs |
| Public IPv4 addresses, EBS volumes | ~0.02 |

**Tear down after evaluation.**

## Destroy

Delete the app first so the controller removes the ALB and the EBS CSI driver deletes the volume. Otherwise Terraform cannot delete the VPC.

```bash
helm uninstall crm -n crm --wait
helm uninstall kube-prometheus-stack -n monitoring --wait 2>/dev/null || true
kubectl delete pvc --all -n crm
kubectl -n crm delete secret crm-database   # kept by Helm policy
# wait until no ALB or "kubernetes.io/created-for/pvc" EBS volume remains:
aws elbv2 describe-load-balancers --query 'LoadBalancers[?contains(LoadBalancerName, `devops-crm`)].LoadBalancerName'
aws ec2 describe-volumes --filters Name=tag-key,Values=kubernetes.io/created-for/pvc/name --query 'Volumes[].VolumeId'

terraform destroy
```

## Design notes

- **Graviton nodes** match the arm64 images CI builds on native ARM runners, and cost about 25% less than t3.large.
- **Pod Identity** instead of IRSA for the EBS CSI driver and the load balancer controller: no OIDC trust policy to manage per service account.
- **Least privilege for CD:** IAM grants only `eks:DescribeCluster`; Kubernetes permissions are namespace-scoped through the access entry.
- **Accepted scanner finding:** `trivy config` flags the EKS module's node security group rule that allows egress to `0.0.0.0/0` (AWS-0104). Nodes need outbound HTTPS through the NAT gateway to pull images from GHCR and reach AWS APIs. Restricting this would require VPC endpoints plus an ECR mirror, which is out of scope here.
- **State:** local by default (git-ignored). `versions.tf` contains a ready-to-use S3 backend with native locking.

## Managed database alternative

For production, move PostgreSQL to **Amazon RDS for PostgreSQL (Multi-AZ)** instead of the in-cluster StatefulSet:

1. Add a `terraform-aws-modules/rds/aws` instance in the private subnets with a security group that admits only the EKS node/cluster security group on 5432, `manage_master_user_password = true` (Secrets Manager), automated backups, and deletion protection.
2. Put the connection string in a Kubernetes Secret, `crm-database-url` with key `DATABASE_URL`, ideally synced from Secrets Manager by the External Secrets Operator.
3. Install the chart with `--set postgresql.enabled=false --set externalDatabase.existingSecret=crm-database-url`. The migration Job and readiness checks work unchanged.

This trades roughly $0.04–0.10/hour (db.t4g.micro–small) for automated backups, point-in-time recovery, patching, and failover. The capstone keeps PostgreSQL in-cluster to stay within one Helm release and budget.
