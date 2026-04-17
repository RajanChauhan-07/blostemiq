variable "environment"    { type = string }
variable "vpc_id"         { type = string }
variable "db_subnet_ids"  { type = list(string) }
variable "eks_sg_id"      { type = string }
variable "instance_class" { type = string }
variable "db_name"        { type = string }
variable "db_username"    { type = string }

# ─── DB Subnet Group ──────────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name       = "blostemiq-${var.environment}-db-subnet-group"
  subnet_ids = var.db_subnet_ids
  tags       = { Name = "blostemiq-${var.environment}-db-subnet-group" }
}

# ─── Security Group ───────────────────────────────────────
resource "aws_security_group" "rds" {
  name        = "blostemiq-${var.environment}-rds-sg"
  description = "Allow Postgres from EKS nodes only"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.eks_sg_id]
    description     = "Postgres from EKS nodes"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "blostemiq-${var.environment}-rds-sg" }
}

# ─── Random password stored in Secrets Manager ────────────
resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "blostemiq/${var.environment}/rds/password"
  recovery_window_in_days = 0   # Immediate deletion in dev
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db.result
}

# ─── RDS Postgres ─────────────────────────────────────────
resource "aws_db_instance" "main" {
  identifier        = "blostemiq-${var.environment}"
  engine            = "postgres"
  engine_version    = "16.2"
  instance_class    = var.instance_class
  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  # Dev settings — no multi-AZ, no read replicas to save cost
  multi_az               = false
  publicly_accessible    = false
  skip_final_snapshot    = true   # Change to false in prod!
  deletion_protection    = false  # Change to true in prod!

  backup_retention_period = 3
  backup_window           = "03:00-04:00"
  maintenance_window      = "Sun:04:00-Sun:05:00"

  # Enable Performance Insights (free for t3/t2 instances)
  performance_insights_enabled = false

  tags = { Name = "blostemiq-${var.environment}-postgres" }
}

resource "random_password" "db" {}
