output "vpc_id" {
  value = module.vpc.vpc_id
}

output "eks_cluster_name" {
  value = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  value     = module.eks.cluster_endpoint
  sensitive = true
}

output "rds_endpoint" {
  value     = module.rds.endpoint
  sensitive = true
}

output "redis_endpoint" {
  value     = module.elasticache.endpoint
  sensitive = true
}

output "ecr_urls" {
  value = module.ecr.repository_urls
}

output "s3_bucket_names" {
  value = module.s3.bucket_names
}

output "aws_account_id" {
  value = data.aws_caller_identity.current.account_id
}
