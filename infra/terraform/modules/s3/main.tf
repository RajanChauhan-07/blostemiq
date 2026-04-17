variable "environment" { type = string }
variable "account_id"  { type = string }

locals {
  buckets = {
    raw_events   = "blostemiq-${var.environment}-raw-events-${var.account_id}"
    ml_artifacts = "blostemiq-${var.environment}-ml-artifacts-${var.account_id}"
    reports      = "blostemiq-${var.environment}-reports-${var.account_id}"
    data_lake    = "blostemiq-${var.environment}-data-lake-${var.account_id}"
  }
}

# ─── S3 Buckets ───────────────────────────────────────────
resource "aws_s3_bucket" "buckets" {
  for_each = local.buckets
  bucket   = each.value
  tags     = { Name = each.value, Purpose = each.key }
}

# Block all public access on every bucket
resource "aws_s3_bucket_public_access_block" "buckets" {
  for_each = local.buckets
  bucket   = aws_s3_bucket.buckets[each.key].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Versioning on ML artifacts (so you can roll back models)
resource "aws_s3_bucket_versioning" "ml_artifacts" {
  bucket = aws_s3_bucket.buckets["ml_artifacts"].id
  versioning_configuration { status = "Enabled" }
}

# Lifecycle: Move raw events to Glacier after 30 days
resource "aws_s3_bucket_lifecycle_configuration" "raw_events" {
  bucket = aws_s3_bucket.buckets["raw_events"].id
  rule {
    id     = "archive-old-events"
    status = "Enabled"
    transition {
      days          = 30
      storage_class = "GLACIER_IR"
    }
    expiration { days = 365 }
    filter { prefix = "" }
  }
}

# SSE-S3 encryption on all buckets
resource "aws_s3_bucket_server_side_encryption_configuration" "buckets" {
  for_each = local.buckets
  bucket   = aws_s3_bucket.buckets[each.key].id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
