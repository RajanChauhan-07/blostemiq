variable "environment" { type = string }
variable "vpc_cidr"    { type = string }
variable "azs"         { type = list(string) }

locals {
  public_subnets   = [for i, az in var.azs : cidrsubnet(var.vpc_cidr, 8, i)]
  private_subnets  = [for i, az in var.azs : cidrsubnet(var.vpc_cidr, 8, i + 10)]
  database_subnets = [for i, az in var.azs : cidrsubnet(var.vpc_cidr, 8, i + 20)]
}

# ─── VPC ─────────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "blostemiq-${var.environment}-vpc" }
}

# ─── Internet Gateway ─────────────────────────────────────
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "blostemiq-${var.environment}-igw" }
}

# ─── Public Subnets ───────────────────────────────────────
resource "aws_subnet" "public" {
  count             = length(var.azs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = local.public_subnets[count.index]
  availability_zone = var.azs[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name                     = "blostemiq-${var.environment}-public-${var.azs[count.index]}"
    "kubernetes.io/role/elb" = "1"
  }
}

# ─── Private Subnets (EKS nodes, services) ────────────────
resource "aws_subnet" "private" {
  count             = length(var.azs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = local.private_subnets[count.index]
  availability_zone = var.azs[count.index]

  tags = {
    Name                              = "blostemiq-${var.environment}-private-${var.azs[count.index]}"
    "kubernetes.io/role/internal-elb" = "1"
    "karpenter.sh/discovery"          = "blostemiq-${var.environment}"
  }
}

# ─── Database Subnets ─────────────────────────────────────
resource "aws_subnet" "database" {
  count             = length(var.azs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = local.database_subnets[count.index]
  availability_zone = var.azs[count.index]

  tags = { Name = "blostemiq-${var.environment}-db-${var.azs[count.index]}" }
}

# ─── NAT Gateway (single AZ in dev to save $) ─────────────
resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = { Name = "blostemiq-${var.environment}-nat-eip" }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id   # Only 1 NAT GW in dev

  tags       = { Name = "blostemiq-${var.environment}-nat" }
  depends_on = [aws_internet_gateway.main]
}

# ─── Route Tables ─────────────────────────────────────────
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "blostemiq-${var.environment}-public-rt" }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }
  tags = { Name = "blostemiq-${var.environment}-private-rt" }
}

resource "aws_route_table_association" "public" {
  count          = length(var.azs)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = length(var.azs)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "database" {
  count          = length(var.azs)
  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.private.id
}

# ─── VPC Endpoints (traffic stays in AWS, no NAT charges) ─
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]
  tags              = { Name = "blostemiq-${var.environment}-s3-endpoint" }
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]
  tags              = { Name = "blostemiq-${var.environment}-dynamodb-endpoint" }
}

data "aws_region" "current" {}
