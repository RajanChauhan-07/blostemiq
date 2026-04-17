variable "environment" { type = string }
variable "vpc_id"      { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "cluster_version"    { type = string }
variable "node_instance_type" { type = string }
variable "node_min_size"      { type = number }
variable "node_max_size"      { type = number }
variable "node_desired_size"  { type = number }

locals {
  cluster_name = "blostemiq-${var.environment}"
}

# ─── IAM Role for EKS Control Plane ──────────────────────
resource "aws_iam_role" "eks_cluster" {
  name = "blostemiq-${var.environment}-eks-cluster-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "eks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

# ─── IAM Role for EKS Worker Nodes ───────────────────────
resource "aws_iam_role" "eks_nodes" {
  name = "blostemiq-${var.environment}-eks-node-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_worker_node" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_nodes.name
}
resource "aws_iam_role_policy_attachment" "eks_cni" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_nodes.name
}
resource "aws_iam_role_policy_attachment" "eks_ecr_readonly" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_nodes.name
}

# ─── Security Group for EKS Nodes ────────────────────────
resource "aws_security_group" "eks_nodes" {
  name        = "blostemiq-${var.environment}-eks-nodes"
  description = "Security group for EKS worker nodes"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "blostemiq-${var.environment}-eks-nodes-sg" }
}

# ─── EKS Cluster ─────────────────────────────────────────
resource "aws_eks_cluster" "main" {
  name     = local.cluster_name
  version  = var.cluster_version
  role_arn = aws_iam_role.eks_cluster.arn

  vpc_config {
    subnet_ids              = var.private_subnet_ids
    endpoint_private_access = true
    endpoint_public_access  = true   # Set to false in prod
    security_group_ids      = [aws_security_group.eks_nodes.id]
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator"]

  depends_on = [aws_iam_role_policy_attachment.eks_cluster_policy]
}

# ─── OIDC Provider (for IRSA — pod-level IAM roles) ──────
data "tls_certificate" "eks" {
  url = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "eks" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.eks.certificates[0].sha1_fingerprint]
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

# ─── Managed Node Group ───────────────────────────────────
resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "blostemiq-${var.environment}-ng-main"
  node_role_arn   = aws_iam_role.eks_nodes.arn
  subnet_ids      = var.private_subnet_ids
  instance_types  = [var.node_instance_type]
  disk_size       = 30

  scaling_config {
    desired_size = var.node_desired_size
    min_size     = var.node_min_size
    max_size     = var.node_max_size
  }

  update_config {
    max_unavailable = 1
  }

  # Auto-scale to 0 overnight via scheduled actions
  tags = {
    "karpenter.sh/discovery" = local.cluster_name
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node,
    aws_iam_role_policy_attachment.eks_cni,
    aws_iam_role_policy_attachment.eks_ecr_readonly,
  ]
}

# ─── Scheduled Scale-to-Zero (Save money at night) ───────
resource "aws_autoscaling_schedule" "scale_down_night" {
  scheduled_action_name  = "scale-down-night"
  min_size               = 0
  max_size               = 3
  desired_capacity       = 0
  recurrence             = "30 17 * * 1-5"  # 11pm IST = 5:30pm UTC, weekdays
  time_zone              = "UTC"
  autoscaling_group_name = aws_eks_node_group.main.resources[0].autoscaling_groups[0].name
}

resource "aws_autoscaling_schedule" "scale_up_morning" {
  scheduled_action_name  = "scale-up-morning"
  min_size               = 1
  max_size               = 3
  desired_capacity       = 1
  recurrence             = "0 3 * * 1-5"    # 8:30am IST = 3am UTC, weekdays
  time_zone              = "UTC"
  autoscaling_group_name = aws_eks_node_group.main.resources[0].autoscaling_groups[0].name
}
