variable "environment" { type = string }

# ─── partner_events table ─────────────────────────────────
resource "aws_dynamodb_table" "partner_events" {
  name           = "blostemiq-${var.environment}-partner-events"
  billing_mode   = "PAY_PER_REQUEST"   # Only pay for what you use
  hash_key       = "org_id"
  range_key      = "timestamp"

  attribute {
    name = "org_id"
    type = "S"
  }
  attribute {
    name = "timestamp"
    type = "S"
  }
  attribute {
    name = "event_type"
    type = "S"
  }

  global_secondary_index {
    name            = "event_type-index"
    hash_key        = "org_id"
    range_key       = "event_type"
    projection_type = "ALL"
  }

  # TTL — auto-delete events older than 1 year
  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  point_in_time_recovery { enabled = true }
  tags = { Name = "blostemiq-${var.environment}-partner-events" }
}

# ─── activity_feed table ──────────────────────────────────
resource "aws_dynamodb_table" "activity_feed" {
  name         = "blostemiq-${var.environment}-activity-feed"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "partner_id"
  range_key    = "timestamp"

  attribute {
    name = "partner_id"
    type = "S"
  }
  attribute {
    name = "timestamp"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  tags = { Name = "blostemiq-${var.environment}-activity-feed" }
}

# ─── alert_history table ──────────────────────────────────
resource "aws_dynamodb_table" "alert_history" {
  name         = "blostemiq-${var.environment}-alert-history"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "org_id"
  range_key    = "alert_id"

  attribute {
    name = "org_id"
    type = "S"
  }
  attribute {
    name = "alert_id"
    type = "S"
  }

  tags = { Name = "blostemiq-${var.environment}-alert-history" }
}
