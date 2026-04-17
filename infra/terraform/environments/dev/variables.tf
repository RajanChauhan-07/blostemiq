variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "AZs to use (use 2 in dev to save NAT Gateway costs)"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "eks_cluster_version" {
  description = "Kubernetes version for EKS"
  type        = string
  default     = "1.30"

}

variable "eks_node_instance_type" {
  description = "EC2 instance type for EKS worker nodes"
  type        = string
  default     = "t3.medium"
}

variable "eks_node_min_size" {
  type    = number
  default = 0   # Scale to 0 at night!
}

variable "eks_node_max_size" {
  type    = number
  default = 3
}

variable "eks_node_desired_size" {
  type    = number
  default = 1
}

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "ecr_services" {
  description = "List of services to create ECR repos for"
  type        = list(string)
  default = [
    "frontend",
    "auth-service",
    "partner-service",
    "analytics-service",
    "ml-serving",
    "outreach-service",
    "notification-service",
    "lead-scoring-service",
    "search-service",
    "report-engine",
    "billing-service"
  ]
}
