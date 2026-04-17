module "vpc" {
  source      = "../../modules/vpc"
  environment = var.environment
  vpc_cidr    = var.vpc_cidr
  azs         = var.availability_zones
}

module "iam" {
  source      = "../../modules/iam"
  environment = var.environment
  account_id  = data.aws_caller_identity.current.account_id
  oidc_url    = module.eks.oidc_provider_url
  oidc_arn    = module.eks.oidc_provider_arn
  depends_on  = [module.eks]
}

module "ecr" {
  source      = "../../modules/ecr"
  environment = var.environment
  services    = var.ecr_services
}

module "s3" {
  source      = "../../modules/s3"
  environment = var.environment
  account_id  = data.aws_caller_identity.current.account_id
}

module "eks" {
  source              = "../../modules/eks"
  environment         = var.environment
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  cluster_version     = var.eks_cluster_version
  node_instance_type  = var.eks_node_instance_type
  node_min_size       = var.eks_node_min_size
  node_max_size       = var.eks_node_max_size
  node_desired_size   = var.eks_node_desired_size
  depends_on          = [module.vpc]
}

module "rds" {
  source             = "../../modules/rds"
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  db_subnet_ids      = module.vpc.database_subnet_ids
  eks_sg_id          = module.eks.node_security_group_id
  instance_class     = var.rds_instance_class
  db_name            = "blostemiq"
  db_username        = "blostemiq"
  depends_on         = [module.vpc, module.eks]
}

module "elasticache" {
  source         = "../../modules/elasticache"
  environment    = var.environment
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids
  eks_sg_id      = module.eks.node_security_group_id
  node_type      = var.redis_node_type
  depends_on     = [module.vpc, module.eks]
}

module "dynamodb" {
  source      = "../../modules/dynamodb"
  environment = var.environment
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
