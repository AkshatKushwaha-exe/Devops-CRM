variable "region" {
  description = "AWS region for every resource."
  type        = string
  default     = "ap-south-1"
}

variable "name" {
  description = "Name prefix for the VPC, cluster, and IAM roles."
  type        = string
  default     = "devops-crm"
}

variable "kubernetes_version" {
  description = "EKS Kubernetes minor version (must be in standard support)."
  type        = string
  default     = "1.36"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC; split into public and private subnets across two AZs."
  type        = string
  default     = "10.20.0.0/16"
}

variable "node_instance_types" {
  description = "Graviton (arm64) instance types for the managed node group, matching the arm64 images."
  type        = list(string)
  default     = ["t4g.large"]
}

variable "node_count" {
  description = "Desired/minimum/maximum worker nodes. New accounts get a 5 vCPU on-demand quota, so the default stops at 2 × t4g.large (4 vCPU); raise max after a quota increase."
  type        = object({ desired = number, min = number, max = number })
  default     = { desired = 2, min = 2, max = 2 }
}

variable "cluster_endpoint_public_access_cidrs" {
  description = "CIDRs allowed to reach the public EKS API endpoint. Narrow to your IP for real use (GitHub-hosted runners need it open or a self-hosted runner)."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "github_repository" {
  description = "owner/repo allowed to assume the deploy role through GitHub Actions OIDC."
  type        = string
  default     = "AkshatKushwaha-exe/Devops-CRM"
}

variable "github_environment" {
  description = "GitHub Actions environment the deploy job runs in; only that environment can assume the role."
  type        = string
  default     = "production"
}

variable "create_github_oidc_provider" {
  description = "Create the account-wide GitHub OIDC provider. Set false if the account already has token.actions.githubusercontent.com."
  type        = bool
  default     = true
}

variable "app_namespace" {
  description = "Namespace the CRM is deployed into; the deploy role is scoped to it."
  type        = string
  default     = "crm"
}

variable "aws_load_balancer_controller_chart_version" {
  description = "eks-charts aws-load-balancer-controller chart version."
  type        = string
  default     = "3.6.0"
}
