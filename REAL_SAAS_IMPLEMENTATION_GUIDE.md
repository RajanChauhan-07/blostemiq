# BlostemIQ Real SaaS Implementation Guide

## Current Real SaaS Status

This repo is **not** 95% complete as a real SaaS.
That number only makes sense for a demo.

By real SaaS standards, based on the current codebase:

- **Real SaaS completion:** **32%**
- **Work left:** **68%**

### Why 32%

What is already partially in place:

- Multi-service repo structure exists
- AWS and Kubernetes infrastructure exists
- PostgreSQL, Prisma, Redis, Helm, EKS, ECR are already present in the repo
- Auth service, partner service, analytics service, notification service, outreach service, and report service already exist
- Frontend dashboard and flows already exist visually

What is still missing or broken for a real SaaS:

- Frontend auth is fake
- Frontend dashboards still use hardcoded data
- Backend contracts are inconsistent
- Auth Prisma schema does not match auth code
- Public endpoints trust client-supplied `x-org-id`
- Billing is effectively not implemented
- CI/CD does not build and deploy all required services
- Local dev is not wired end to end
- Secrets are still hardcoded in repo-managed config
- Multiple flows still depend on fallback, synthetic, or mock behavior

## Definition Of Done

BlostemIQ is only considered a **real SaaS** when all of the following are true:

1. No hardcoded business data in frontend or backend runtime paths.
2. No fake redirects, fake auth waits, fake success states, or demo-only placeholders in real user flows.
3. All user, org, partner, billing, outreach, analytics, report, and notification data comes from real storage and real services.
4. All tenant scoping is enforced from authenticated identity, not from trusted client headers.
5. All secrets come from AWS-managed secret storage or Kubernetes secrets, not plaintext files committed to git.
6. CI/CD builds, tests, pushes, and deploys every production service.
7. Production deployment is observable, recoverable, and secure.
8. A new customer can sign up, create an org, add partners, ingest events, see analytics, receive alerts, send outreach, download reports, subscribe to a paid plan, and use the app without any manual data patching.

## Non-Negotiable Rules

- No mock data in live routes
- No hardcoded arrays for dashboard data
- No fake auth
- No fallback demo payloads in production paths
- No plaintext secrets in tracked config
- No tenant context accepted purely from client headers
- No "works only in Kubernetes" frontend rewrite setup

## Current Repo Reality

## What Is Real Enough To Reuse

- `backend/auth-service` has real Express structure, bcrypt usage, refresh token rotation logic, and Prisma wiring
- `backend/partner-service` has real CRUD route structure and Redis/Kafka/DynamoDB integration points
- `backend/analytics-service` has a real direction toward PostgreSQL-backed analytics
- `backend/notification-service` already has a WebSocket gateway
- `backend/outreach-service` already integrates with Groq and ElevenLabs patterns
- `infra/terraform` and `k8s/helm` give a usable AWS deployment base

## What Is Not Real Yet

- `frontend/app/signin/page.tsx` is simulated
- `frontend/app/signup/page.tsx` is simulated
- `frontend/app/dashboard/page.tsx` uses hardcoded partner and alert arrays
- `frontend/app/dashboard/partners/page.tsx` uses synthetic partner data
- `frontend/app/dashboard/analytics/page.tsx` still expects old analytics contracts and fallback demo data
- `backend/billing-service` is effectively empty
- root `package.json` workspaces do not match repo layout
- `docker-compose.yml` does not include all services the frontend expects
- `frontend/next.config.mjs` points at cluster DNS names instead of a consistent local and production strategy
- auth Prisma schema and auth code are out of sync
- secrets are committed in Helm values and must be rotated

## Required Architecture For The Real Build

## Core Data Plane

- **PostgreSQL on AWS RDS** as the source of truth for:
  - users
  - organizations
  - memberships
  - refresh tokens
  - api keys
  - partners
  - partner metrics
  - outreach sequences
  - outreach deliveries
  - subscriptions
  - invoices
  - audit logs
  - comments
  - integration records

- **Redis on ElastiCache** for:
  - cache
  - ephemeral rate limit state
  - WebSocket fanout
  - short-lived job coordination

- **DynamoDB** for:
  - high-volume raw partner events
  - optional alert history if we keep that split

## Event Model

For launch, use:

- PostgreSQL + Redis pub/sub + DynamoDB raw events

Do **not** make Kafka/MSK a hard launch dependency unless a clear throughput reason appears during implementation.
The repo has Kafka hooks, but the current system does not have a complete real Kafka production path.
We will keep Kafka optional or remove it from the launch-critical path.

## Auth Model

- JWT access token signed by auth-service
- refresh token rotation in DB
- httpOnly secure refresh cookie
- server-side auth middleware in every public backend service
- org and role derived from authenticated identity

## Tenant Model

- every user belongs to one or more orgs through memberships
- every partner, subscription, report, and audit record belongs to an org
- public client requests never choose tenancy by sending trusted `x-org-id`
- `orgId` must come from verified JWT claims plus membership checks

## Real End-State By Surface

## Frontend

Must become fully API-driven:

- sign in
- sign up
- org creation
- org switching
- dashboard
- partners
- analytics
- outreach
- reports
- notifications
- settings
- billing

No page is allowed to ship with demo arrays or synthetic fallback business data.

## Auth Service

Must own:

- signup
- signin
- signout
- refresh
- me
- email verification
- password reset
- Google OAuth
- org membership resolution
- role checks

## Partner Service

Must own:

- partner CRUD
- CSV import
- API key issuance and revocation
- event ingest endpoints
- event validation
- raw event persistence
- partner profile enrichment

## Analytics Service

Must own:

- KPIs
- partner health rollups
- trend endpoints
- cohorts
- revenue metrics
- alert summaries
- segment summaries

It must read real data only.

## Outreach Service

Must own:

- email generation
- compliance guardrails
- scheduled sequence creation
- actual delivery via SES or SendGrid
- provider webhook tracking for delivered, bounced, opened, clicked, unsubscribed

## Notification Service

Must own:

- authenticated socket connections
- per-org rooms
- unread event delivery
- live churn and health alerts
- delivery acknowledgements if needed

## Report Service

Must own:

- PDF generation from real analytics data
- downloadable reports
- scheduled report generation later if needed

## Billing Service

Must own:

- Stripe customer creation
- Stripe checkout session creation
- Stripe billing portal
- subscription status sync
- webhook processing
- plan entitlements
- usage metering if used

## Immediate Mandatory Security Action

Before we push the real build, we must assume secrets currently present in tracked config are compromised.

### Required immediately

1. Rotate any database credentials currently committed in Helm values.
2. Rotate any Redis credentials currently committed in Helm values.
3. Move all runtime secrets to AWS Secrets Manager or SSM Parameter Store.
4. Inject them into Kubernetes through secrets, not plaintext values files.
5. Remove committed secrets from tracked config and replace with placeholders.

This is not optional.

## Full Implementation Plan

## Phase 0 - Repository Hardening And Execution Base

### Goal

Make the repo executable, safe, and consistent before deeper feature work.

### Tasks

1. Fix root workspace definitions in `package.json` to match actual repo layout.
2. Standardize service build, dev, lint, and test commands.
3. Fix local dev architecture:
   - add `analytics-service`
   - add `report-service`
   - add any missing env wiring
4. Split frontend runtime routing into:
   - local compose targets
   - production public API targets
   - no hardcoded cluster DNS in browser-facing assumptions
5. Add missing backend dependencies, including analytics DB dependencies.
6. Add a real `.env.example` set for each service.
7. Remove committed secrets from Helm values and replace with secret references.
8. Normalize health endpoints and service startup expectations.

### Exit Criteria

- `docker compose up --build` can boot the full local stack
- frontend can reach every required backend locally
- no required service is missing from local dev
- secrets are no longer committed in plaintext

## Phase 1 - Database Truth And Schema Unification

### Goal

Create one real, coherent source of truth for all SaaS entities.

### Design Decision

Use **RDS PostgreSQL** as the primary store and standardize the data model.
Avoid duplicated ownership of core tables across services.

### Required Tables

- organizations
- users
- memberships
- refresh_tokens
- api_keys
- partners
- partner_metrics
- partner_metric_snapshots
- subscriptions
- billing_events
- outreach_sequences
- outreach_messages
- outreach_delivery_events
- audit_logs
- comments
- feature_entitlements

### Tasks

1. Reconcile auth Prisma schema with auth runtime code.
2. Reconcile partner Prisma schema with shared org ownership.
3. Decide shared schema strategy:
   - preferred: shared PostgreSQL schema for core SaaS entities
4. Create Prisma migrations instead of drift-only schema files.
5. Add idempotent bootstrap and migration flow for local and AWS environments.
6. Add seed data only for local developer convenience, clearly separated from production logic.

### Exit Criteria

- migrations run cleanly
- auth-service and partner-service point at a consistent real schema
- no runtime code depends on manually created tables outside the migration path

## Phase 2 - Real Authentication And Session Flow

### Goal

Replace all fake auth with real auth end to end.

### Tasks

1. Wire frontend signup form to real `auth-service` signup endpoint.
2. Wire frontend signin form to real `auth-service` signin endpoint.
3. Persist authenticated session correctly:
   - secure refresh cookie
   - access token refresh flow
4. Build frontend auth state management.
5. Protect dashboard routes.
6. Implement signout correctly.
7. Implement `me` bootstrap on app load.
8. Add password reset flow.
9. Add email verification flow.
10. Add Google OAuth flow.

### Exit Criteria

- a new user can sign up without manual DB edits
- user is logged in and reaches dashboard through real auth
- expired access token refreshes cleanly
- signout invalidates session

## Phase 3 - Real Multi-Tenancy And Authorization

### Goal

Enforce org isolation everywhere.

### Tasks

1. Add auth middleware to all public services.
2. Stop trusting raw `x-org-id` from the client.
3. Resolve tenant context from verified token claims.
4. Validate membership and role for each protected route.
5. Add org switching UX if a user belongs to multiple orgs.
6. Add member invite flow.
7. Add role management flow.

### Roles

- admin
- analyst
- viewer

### Exit Criteria

- user cannot read another org's data by changing a header
- every protected request is org-scoped through verified identity
- invites and role updates work from the real UI

## Phase 4 - Partner System And Real Ingestion

### Goal

Make partners and partner events fully real.

### Tasks

1. Build real Add Partner / Edit Partner / Delete Partner UI flows.
2. Build CSV import flow.
3. Build API key management per org.
4. Build authenticated ingest endpoints.
5. Persist raw events to DynamoDB.
6. Aggregate raw events into Postgres partner metrics.
7. Record partner health snapshots over time.
8. Remove all synthetic partner display data from frontend.

### Exit Criteria

- partners page is fully DB-backed
- ingest API accepts real partner events
- analytics and health data reflect ingested events

## Phase 5 - Analytics Conversion To Fully Real Data

### Goal

Make analytics-service and dashboard analytics consistent and real.

### Tasks

1. Finalize analytics API contract.
2. Update frontend dashboard and analytics pages to that contract.
3. Remove all analytics fallback business data.
4. Make health trend real from snapshots.
5. Make revenue trend real from subscriptions or MRR records.
6. Make alert summaries real from actual events.
7. Make cohort outputs deterministic and data-backed.
8. Stop auto-creating schema tables inside runtime startup where migrations should own structure.

### Exit Criteria

- dashboard KPIs are real
- analytics page is real
- partner portfolio stats are real
- no chart depends on frontend mock arrays

## Phase 6 - Reports From Real Data

### Goal

Generate reports from live data only.

### Tasks

1. Replace hardcoded report partner arrays with analytics queries.
2. Pull org-specific partner and KPI data into report-service.
3. Add authenticated report generation endpoint.
4. Store generated reports in S3 if scheduled reports are needed.
5. Support on-demand download from UI.

### Exit Criteria

- PDF reflects current org data
- report generation works for multiple orgs

## Phase 7 - Real-Time Notifications

### Goal

Make sockets and alerts production-real.

### Tasks

1. Require authenticated socket connection in non-dev paths.
2. Bind sockets to org rooms from verified auth.
3. Publish alert events from real health changes and outreach delivery events.
4. Use Redis pub/sub as the launch fanout mechanism.
5. Add notification persistence if unread history is required.
6. Remove any dev-only org assumptions from frontend layout and hooks.

### Exit Criteria

- live org alerts appear in the dashboard from real events
- no hardcoded `dev-org`

## Phase 8 - Real Outreach Delivery

### Goal

Make outreach generation and sending fully operational.

### Provider Decision

Use:

- **Groq** for content generation
- **SES** or **SendGrid** for actual delivery

Preferred on AWS-aligned path: **SES**

### Tasks

1. Store outreach sequences in DB.
2. Trigger actual email sends.
3. Add provider webhook ingestion.
4. Track delivery state in DB.
5. Track opens and clicks where supported.
6. Add unsubscribe management.
7. Add per-org sender settings and templates.

### Exit Criteria

- outreach created in UI can actually send
- sent state is visible in product
- email lifecycle events are stored

## Phase 9 - Real Billing

### Goal

Turn billing-service from placeholder into production billing.

### Stripe Scope

- products
- prices
- checkout
- portal
- webhooks
- subscription state sync
- entitlements

### Tasks

1. Create billing-service codebase properly.
2. Add DB models for subscriptions and billing events.
3. Create Stripe customer on org creation or first checkout.
4. Add pricing page and billing settings page.
5. Add checkout session creation.
6. Add webhook endpoint with signature verification.
7. Add billing portal session creation.
8. Map Stripe subscription state to org entitlements.
9. Enforce plan-based limits:
   - partner count
   - team seats
   - outreach volume
   - API rate limits if needed

### Exit Criteria

- org can start a paid subscription
- billing state is reflected in product permissions

## Phase 10 - Audit, Compliance, And Admin Safety

### Goal

Make the system accountable and supportable.

### Tasks

1. Log every significant write action into audit logs.
2. Add actor, org, resource, resource id, metadata, IP, and user agent.
3. Add admin-facing audit trail views.
4. Add retention and deletion policies.
5. Add GDPR export and deletion hooks if needed.
6. Add rate limiting across auth, ingest, and public APIs.

### Exit Criteria

- writes are auditable
- suspicious activity can be traced

## Phase 11 - CI/CD And AWS Deployment Completion

### Goal

Make GitHub to AWS deployment complete and correct.

### Tasks

1. Fix CI to build and test:
   - auth-service
   - partner-service
   - notification-service
   - analytics-service
   - report-service
   - billing-service
   - frontend
2. Add service-specific build jobs for Python and Node services.
3. Build and push all production images to ECR.
4. Deploy all services through Helm.
5. Inject secrets from AWS-managed storage.
6. Add migration step before rollout where required.
7. Add post-deploy smoke tests.

### Exit Criteria

- merge to main can deploy the full product
- no manual kubectl patching needed for ordinary deploys

## Phase 12 - Production Readiness

### Goal

Make it launchable.

### Tasks

1. Domain and DNS finalization.
2. TLS and ingress verification.
3. CORS cleanup.
4. S3 backups for exports and reports where needed.
5. RDS backup and restore policy.
6. Centralized logs.
7. Metrics and alerts.
8. Error tracking.
9. Runbook for deploy, rollback, and outage response.

### Exit Criteria

- production stack is operable
- failures are observable
- rollback path is defined

## What We Will Remove During The Build

The following must be removed or replaced as part of making the product real:

- hardcoded dashboard arrays
- synthetic partners page data
- fake signin and signup delays
- demo fallback analytics payloads in real runtime flows
- plaintext secrets in tracked config
- trust in client-supplied org headers
- placeholder billing service state
- local or production assumptions tied only to cluster DNS names

## Execution Order

This is the exact order we should implement in:

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6
8. Phase 7
9. Phase 8
10. Phase 9
11. Phase 10
12. Phase 11
13. Phase 12

## What We Begin With After Confirmation

When you confirm, we begin with the first real execution slice:

### Slice 1

- remove committed secrets from runtime config references
- fix repo workspace and local dev execution
- add missing services to compose
- fix frontend routing strategy
- fix auth Prisma schema drift
- fix analytics dependencies

### Slice 2

- wire real signin/signup
- add auth state and route protection
- remove fake auth flow

### Slice 3

- convert dashboard and partners to real data
- enforce tenant auth in backend requests

This is the right starting point because it removes the current blockers that would otherwise poison everything built after it.

## Real SaaS Progress Measurement

We will track progress using these weighted areas:

| Area | Weight | Current |
|---|---:|---:|
| Repo/dev/deploy foundation | 10% | 4% |
| Database truth and migrations | 12% | 5% |
| Authentication and sessions | 12% | 4% |
| Multi-tenancy and RBAC | 10% | 3% |
| Partner CRUD and ingestion | 10% | 5% |
| Analytics and dashboard truth | 10% | 3% |
| Reports | 6% | 2% |
| Notifications | 6% | 2% |
| Outreach delivery | 8% | 3% |
| Billing | 8% | 0% |
| Security and secrets | 4% | 1% |
| CI/CD and observability | 4% | 0% |
| **Total** | **100%** | **32%** |

## Final Position

BlostemIQ can be made into a real SaaS from this repo, but it is not there yet.

The correct next move is:

- approve this plan
- then start Phase 0 immediately

Once you confirm, we do the implementation for real and move the repo from **32% -> 100%**, with no mock data and no fake flows left in the product.
