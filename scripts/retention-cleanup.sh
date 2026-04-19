#!/usr/bin/env bash

set -euo pipefail

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to run retention cleanup." >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

AUDIT_DAYS="${RETENTION_AUDIT_DAYS:-365}"
BILLING_DAYS="${RETENTION_BILLING_DAYS:-730}"
OUTREACH_DAYS="${RETENTION_OUTREACH_DAYS:-365}"
REFRESH_TOKEN_DAYS="${RETENTION_REFRESH_TOKEN_DAYS:-30}"
PARTNER_EVENT_DAYS="${RETENTION_PARTNER_EVENTS_DAYS:-730}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -v audit_days="$AUDIT_DAYS" \
  -v billing_days="$BILLING_DAYS" \
  -v outreach_days="$OUTREACH_DAYS" \
  -v refresh_days="$REFRESH_TOKEN_DAYS" \
  -v partner_event_days="$PARTNER_EVENT_DAYS" <<'SQL'
DELETE FROM audit_logs
WHERE created_at < NOW() - (:'audit_days' || ' days')::interval;

DELETE FROM billing_events
WHERE created_at < NOW() - (:'billing_days' || ' days')::interval;

DELETE FROM outreach_delivery_events
WHERE created_at < NOW() - (:'outreach_days' || ' days')::interval;

DELETE FROM refresh_tokens
WHERE (
  revoked_at IS NOT NULL
  AND revoked_at < NOW() - (:'refresh_days' || ' days')::interval
) OR (
  expires_at < NOW() - (:'refresh_days' || ' days')::interval
);

DELETE FROM partner_events
WHERE created_at < NOW() - (:'partner_event_days' || ' days')::interval;
SQL
