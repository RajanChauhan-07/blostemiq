variable "environment" { type = string }
variable "account_id"  { type = string }
variable "oidc_url"    { type = string }
variable "oidc_arn"    { type = string }

locals {
  oidc_sub = replace(var.oidc_url, "https://", "")
}

# ─── GitHub Actions OIDC Role (no stored AWS keys ever) ───
resource "aws_iam_role" "github_actions" {
  name = "blostemiq-github-actions"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Federated = "arn:aws:iam::${var.account_id}:oidc-provider/token.actions.githubusercontent.com" }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:RajanChauhan-07/blostemiq:*"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_actions" {
  name = "blostemiq-github-actions-policy"
  role = aws_iam_role.github_actions.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage"
        ]
        Resource = "arn:aws:ecr:*:${var.account_id}:repository/blostemiq-*"
      },
      {
        Effect   = "Allow"
        Action   = ["eks:DescribeCluster"]
        Resource = "arn:aws:eks:*:${var.account_id}:cluster/blostemiq-*"
      }
    ]
  })
}

# ─── IRSA: Auth Service ───────────────────────────────────
resource "aws_iam_role" "auth_service" {
  name = "blostemiq-${var.environment}-auth-service-irsa"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = var.oidc_arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${local.oidc_sub}:aud" = "sts.amazonaws.com"
          "${local.oidc_sub}:sub" = "system:serviceaccount:blostemiq:auth-service"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "auth_service" {
  name = "auth-service-policy"
  role = aws_iam_role.auth_service.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = "arn:aws:secretsmanager:*:${var.account_id}:secret:blostemiq/${var.environment}/*"
    }]
  })
}

# ─── IRSA: Partner Service ────────────────────────────────
resource "aws_iam_role" "partner_service" {
  name = "blostemiq-${var.environment}-partner-service-irsa"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = var.oidc_arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${local.oidc_sub}:aud" = "sts.amazonaws.com"
          "${local.oidc_sub}:sub" = "system:serviceaccount:blostemiq:partner-service"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "partner_service" {
  name = "partner-service-policy"
  role = aws_iam_role.partner_service.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:Query", "dynamodb:UpdateItem"]
        Resource = "arn:aws:dynamodb:*:${var.account_id}:table/blostemiq-${var.environment}-*"
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = "arn:aws:secretsmanager:*:${var.account_id}:secret:blostemiq/${var.environment}/*"
      }
    ]
  })
}

# ─── IRSA: ML Serving ─────────────────────────────────────
resource "aws_iam_role" "ml_serving" {
  name = "blostemiq-${var.environment}-ml-serving-irsa"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = var.oidc_arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${local.oidc_sub}:aud" = "sts.amazonaws.com"
          "${local.oidc_sub}:sub" = "system:serviceaccount:blostemiq:ml-serving"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "ml_serving" {
  name = "ml-serving-policy"
  role = aws_iam_role.ml_serving.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["sagemaker:InvokeEndpoint"]
        Resource = "arn:aws:sagemaker:*:${var.account_id}:endpoint/blostemiq-*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = "arn:aws:s3:::blostemiq-${var.environment}-ml-artifacts-${var.account_id}/*"
      }
    ]
  })
}

# ─── GitHub Actions OIDC Provider ─────────────────────────
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}
