terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.69"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 3.3"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 3.3"
    }
  }

  # State is local by default (terraform.tfstate is git-ignored). For a shared setup, create
  # a versioned S3 bucket and uncomment; S3-native locking needs no DynamoDB table.
  # backend "s3" {
  #   bucket       = "<your-state-bucket>"
  #   key          = "devops-crm/terraform.tfstate"
  #   region       = "ap-south-1"
  #   use_lockfile = true
  #   encrypt      = true
  # }
}
