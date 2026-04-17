#!/bin/bash
# ─── BlostemIQ — Full Seed Script ────────────────────────
# Seeds both PostgreSQL and DynamoDB (LocalStack or AWS)
# Usage:
#   ./database/seeds/seed.sh local     # LocalStack (default)
#   ./database/seeds/seed.sh aws       # Real AWS

set -e
MODE="${1:-local}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo_green()  { echo -e "\033[0;32m$1\033[0m"; }
echo_yellow() { echo -e "\033[0;33m$1\033[0m"; }
echo_cyan()   { echo -e "\033[0;36m$1\033[0m"; }

echo_cyan "
╔══════════════════════════════════╗
║  BlostemIQ Seed Runner v1.0       ║
║  Mode: $MODE
╚══════════════════════════════════╝
"

# ─── Step 1: Generate data ────────────────────────────────
echo_yellow "📊 Generating seed data..."
cd "$ROOT"
python3 database/seeds/generate.py
echo_green "✅ Seed data generated"

# ─── Step 2: PostgreSQL ───────────────────────────────────
echo_yellow "\n🗄️  Loading PostgreSQL..."

if [ "$MODE" = "local" ]; then
  PG_HOST="localhost"
  PG_PORT="5432"
  PG_USER="blostemiq"
  PG_PASS="blostemiq_dev"
  PG_DB="blostemiq"
else
  # Real AWS RDS — read from terraform output
  echo_yellow "Reading RDS endpoint from Terraform..."
  RDS_ENDPOINT=$(cd infra/terraform/environments/dev && terraform output -raw rds_endpoint 2>/dev/null || echo "")
  if [ -z "$RDS_ENDPOINT" ]; then
    echo "⚠️  Could not get RDS endpoint — skipping PostgreSQL seed"
  else
    PG_HOST=$(echo $RDS_ENDPOINT | cut -d: -f1)
    PG_PORT=$(echo $RDS_ENDPOINT | cut -d: -f2)
    PG_USER="blostemiq"
    PG_DB="blostemiq"
    PG_PASS=$(aws secretsmanager get-secret-value \
      --secret-id "blostemiq/dev/rds/password" \
      --query SecretString --output text 2>/dev/null || echo "")
  fi
fi

if [ -n "$PG_HOST" ]; then
  PGPASSWORD="$PG_PASS" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" \
    -f database/seeds/seed.sql 2>&1 | tail -5
  echo_green "✅ PostgreSQL seeded"
fi

# ─── Step 3: DynamoDB ─────────────────────────────────────
echo_yellow "\n⚡ Loading DynamoDB..."

if [ "$MODE" = "local" ]; then
  python3 database/seeds/load_dynamo.py \
    --endpoint http://localhost:4566 \
    --env dev \
    --workers 8
else
  python3 database/seeds/load_dynamo.py \
    --env dev \
    --workers 4
fi

echo_green "\n🎉 All seed data loaded! Open http://localhost:3000/dashboard to see it."
