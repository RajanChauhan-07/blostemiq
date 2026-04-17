#!/bin/bash
# LocalStack initialization script — runs after LocalStack is ready
# Creates all the AWS resources we need locally

echo "🚀 Initializing BlostemIQ LocalStack resources..."

AWS_OPTS="--endpoint-url=http://localhost:4566 --region us-east-1 --no-cli-pager"

# ─── S3 Buckets ─────────────────────────────────────────
echo "Creating S3 buckets..."
aws s3 mb s3://blostemiq-raw-events $AWS_OPTS
aws s3 mb s3://blostemiq-ml-artifacts $AWS_OPTS
aws s3 mb s3://blostemiq-reports $AWS_OPTS
aws s3 mb s3://blostemiq-data-lake $AWS_OPTS

# ─── DynamoDB Tables ────────────────────────────────────
echo "Creating DynamoDB tables..."

# Partner events table (time-series)
aws dynamodb create-table $AWS_OPTS \
  --table-name partner_events \
  --attribute-definitions \
    AttributeName=org_id,AttributeType=S \
    AttributeName=timestamp,AttributeType=S \
  --key-schema \
    AttributeName=org_id,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes '[
    {
      "IndexName": "event_type-index",
      "KeySchema": [{"AttributeName": "org_id", "KeyType": "HASH"}],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]' 2>/dev/null || echo "partner_events table already exists"

# Activity feed table
aws dynamodb create-table $AWS_OPTS \
  --table-name activity_feed \
  --attribute-definitions \
    AttributeName=partner_id,AttributeType=S \
    AttributeName=timestamp,AttributeType=S \
  --key-schema \
    AttributeName=partner_id,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST 2>/dev/null || echo "activity_feed table already exists"

# Alert history table
aws dynamodb create-table $AWS_OPTS \
  --table-name alert_history \
  --attribute-definitions \
    AttributeName=org_id,AttributeType=S \
    AttributeName=alert_id,AttributeType=S \
  --key-schema \
    AttributeName=org_id,KeyType=HASH \
    AttributeName=alert_id,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST 2>/dev/null || echo "alert_history table already exists"

# ─── Kinesis Streams ────────────────────────────────────
echo "Creating Kinesis streams..."
aws kinesis create-stream $AWS_OPTS --stream-name blostemiq-clickstream --shard-count 1 2>/dev/null || true

# ─── SQS Queues ─────────────────────────────────────────
echo "Creating SQS queues..."
aws sqs create-queue $AWS_OPTS --queue-name outreach-jobs 2>/dev/null || true
aws sqs create-queue $AWS_OPTS --queue-name report-generation 2>/dev/null || true
aws sqs create-queue $AWS_OPTS --queue-name lead-enrichment 2>/dev/null || true

# ─── SNS Topics ─────────────────────────────────────────
echo "Creating SNS topics..."
aws sns create-topic $AWS_OPTS --name churn-alerts 2>/dev/null || true
aws sns create-topic $AWS_OPTS --name ml-drift-alerts 2>/dev/null || true

# ─── Secrets Manager ────────────────────────────────────
echo "Creating secrets..."
aws secretsmanager create-secret $AWS_OPTS \
  --name blostemiq/dev/database \
  --secret-string '{"url":"postgresql://blostemiq:blostemiq_dev@postgres:5432/blostemiq"}' 2>/dev/null || true

echo "✅ LocalStack initialization complete!"
