################################################################################
# In-cluster integrations: ALB ingress controller, gp3 storage, app namespace + RBAC
################################################################################

module "aws_lb_controller_pod_identity" {
  source  = "terraform-aws-modules/eks-pod-identity/aws"
  version = "~> 2.9"

  name                            = "${var.name}-aws-lbc"
  attach_aws_lb_controller_policy = true

  associations = {
    controller = {
      cluster_name    = module.eks.cluster_name
      namespace       = "kube-system"
      service_account = "aws-load-balancer-controller"
    }
  }
}

# Ingress controller: turns the chart's Ingress (class "alb") into an internet-facing ALB.
resource "helm_release" "aws_load_balancer_controller" {
  name       = "aws-load-balancer-controller"
  namespace  = "kube-system"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  version    = var.aws_load_balancer_controller_chart_version

  values = [yamlencode({
    clusterName  = module.eks.cluster_name
    region       = var.region
    vpcId        = module.vpc.vpc_id
    replicaCount = 2
    serviceAccount = {
      create = true
      name   = "aws-load-balancer-controller"
    }
  })]

  depends_on = [module.eks, module.aws_lb_controller_pod_identity]
}

# Encrypted gp3 volumes, created in the AZ where the PostgreSQL pod is scheduled.
resource "kubernetes_storage_class_v1" "gp3" {
  metadata {
    name = "gp3"
    annotations = {
      "storageclass.kubernetes.io/is-default-class" = "true"
    }
  }
  storage_provisioner    = "ebs.csi.aws.com"
  volume_binding_mode    = "WaitForFirstConsumer"
  allow_volume_expansion = true
  reclaim_policy         = "Delete"
  parameters = {
    type      = "gp3"
    encrypted = "true"
  }

  depends_on = [module.eks]
}

resource "kubernetes_namespace_v1" "app" {
  metadata {
    name = var.app_namespace
    labels = {
      "app.kubernetes.io/part-of" = "devops-crm"
      # Pods become Ready only once their ALB target is healthy: no gaps during rollouts.
      "elbv2.k8s.aws/pod-readiness-gate-inject" = "enabled"
    }
  }

  depends_on = [module.eks]
}

# AmazonEKSAdminPolicy covers built-in namespaced resources only; the deploy role also manages
# the chart's Prometheus Operator ServiceMonitor in the app namespace.
resource "kubernetes_role_v1" "deployer_monitoring" {
  metadata {
    name      = "crm-deployer-monitoring"
    namespace = kubernetes_namespace_v1.app.metadata[0].name
  }
  rule {
    api_groups = ["monitoring.coreos.com"]
    resources  = ["servicemonitors", "podmonitors", "prometheusrules"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }
}

resource "kubernetes_role_binding_v1" "deployer_monitoring" {
  metadata {
    name      = "crm-deployer-monitoring"
    namespace = kubernetes_namespace_v1.app.metadata[0].name
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role_v1.deployer_monitoring.metadata[0].name
  }
  subject {
    kind      = "Group"
    name      = "crm-deployers"
    api_group = "rbac.authorization.k8s.io"
  }
}
