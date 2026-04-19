#!/usr/bin/env bash

set -euo pipefail

check_json_status() {
  local label="$1"
  local url="$2"
  local body

  body="$(curl -fsS "$url")"
  if [[ "$body" != *'"status"'* ]] || [[ "$body" != *'"ok"'* ]]; then
    echo "Smoke check failed for $label at $url" >&2
    echo "$body" >&2
    exit 1
  fi

  echo "ok  - $label"
}

check_json_contains() {
  local label="$1"
  local url="$2"
  local needle="$3"
  local body

  body="$(curl -fsS "$url")"
  if [[ "$body" != *"$needle"* ]]; then
    echo "Smoke check failed for $label at $url" >&2
    echo "$body" >&2
    exit 1
  fi

  echo "ok  - $label"
}

check_html() {
  local label="$1"
  local url="$2"
  local body

  body="$(curl -fsS "$url")"
  if [[ "$body" != *"<html"* ]]; then
    echo "Smoke check failed for $label at $url" >&2
    exit 1
  fi

  echo "ok  - $label"
}

echo "Running local smoke checks..."

check_json_status "auth-service" "http://localhost:3001/health"
check_json_status "partner-service" "http://localhost:3002/health"
check_json_status "notification-service" "http://localhost:3004/health"
check_json_status "analytics-service" "http://localhost:8004/health"
check_json_status "report-service" "http://localhost:8005/health"
check_json_status "outreach-service" "http://localhost:8003/health"
check_json_status "billing-service" "http://localhost:3005/health"
check_json_contains "notification metrics" "http://localhost:3004/metrics" "connectedClients"
check_json_contains "billing plans" "http://localhost:3005/plans" "\"growth\""
check_html "frontend signin" "http://localhost:3000/signin"

echo "Local smoke checks passed."
