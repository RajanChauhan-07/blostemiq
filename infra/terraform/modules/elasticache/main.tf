variable "environment" { type = string }
variable "vpc_id"      { type = string }
variable "subnet_ids"  { type = list(string) }
variable "eks_sg_id"   { type = string }
variable "node_type"   { type = string }

# ─── Security Group ───────────────────────────────────────
resource "aws_security_group" "redis" {
  name        = "blostemiq-${var.environment}-redis-sg"
  description = "Allow Redis from EKS nodes only"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.eks_sg_id]
    description     = "Redis from EKS nodes"
  }

  tags = { Name = "blostemiq-${var.environment}-redis-sg" }
}

# ─── Subnet Group ─────────────────────────────────────────
resource "aws_elasticache_subnet_group" "main" {
  name       = "blostemiq-${var.environment}-redis-subnet"
  subnet_ids = var.subnet_ids
}

# ─── ElastiCache Redis Cluster ────────────────────────────
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "blostemiq-${var.environment}-redis"
  engine               = "redis"
  node_type            = var.node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  engine_version       = "7.1"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # Snapshot for recovery (1-day retention in dev)
  snapshot_retention_limit = 1
  snapshot_window          = "05:00-06:00"

  tags = { Name = "blostemiq-${var.environment}-redis" }
}
