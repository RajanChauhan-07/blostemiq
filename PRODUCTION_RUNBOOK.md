# BlostemIQ Production Runbook

## Core Checks

1. Verify service health:
   - `/health` on auth, partner, analytics, report, outreach, billing, notification
2. Verify app login works
3. Verify dashboard loads KPIs, partners, alerts, and settings
4. Verify billing settings page loads
5. Verify PDF report download works

## Deploy

1. Apply database migration/bootstrap step before traffic cutover
2. Deploy backend services
3. Deploy frontend
4. Run smoke checks:
   - sign in
   - create partner
   - import CSV
   - generate outreach draft
   - open billing settings

## Rollback

1. Roll frontend back first if the issue is UI-only
2. Roll backend deployment to the last healthy image
3. Do not roll back a destructive schema change without a restore plan
4. Re-run smoke checks after rollback

## Backups

1. Keep automated RDS backups enabled
2. Export critical org data with `/org/:orgId/export` before destructive org actions
3. Run retention cleanup on a schedule:
   - `DATABASE_URL=... npm run db:retention`

## Incident Response

1. Check service health endpoints
2. Check DB connectivity and connection saturation
3. Check Redis availability for notifications/cache
4. Check outbound provider credentials:
   - Groq
   - ElevenLabs
   - SMTP / SES
   - Stripe
5. If billing webhooks fail, pause plan-enforcement changes until sync is healthy

## Required Secrets

- `DATABASE_URL`
- `JWT_SECRET`
- `GROQ_API_KEY`
- `ELEVENLABS_API_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_ENTERPRISE`

## Observability Minimum

1. Central log collection for all services
2. Error alerting for 5xx spikes
3. DB CPU / storage / connection alarms
4. Stripe webhook failure alarm
5. SMTP delivery failure alarm
