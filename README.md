# BlostemIQ

BlostemIQ is a multi-tenant B2B SaaS platform for the Blostem team to track partner health, predict churn, score leads, generate outreach, export reports, manage organizations, and operate a real product on AWS.

Live website: `https://blostemiq.myddns.me`

## What This Product Does

BlostemIQ gives partnership, growth, and operations teams one place to:

- onboard and manage partners
- ingest partner activity and health signals
- monitor retention, health, and trend analytics
- score leads and predict churn risk
- generate compliance-aware outreach
- manage team members, roles, billing, and audit history
- export reports for internal and customer-facing use

In plain terms: it turns fragmented partner ops into a single SaaS control plane.

## Core SaaS Features

- Multi-tenant organization workspaces
- Sign up, sign in, session refresh, sign out
- Role-aware org membership and invite flows
- Partner CRUD
- CSV partner import
- Org API key creation and revocation
- Partner event ingestion
- Real analytics dashboards
- Cohorts, retention, health trends, and activity snapshots
- Lead scoring
- Churn prediction
- AI-assisted outreach drafting
- Outreach sequence saving and sending
- Voice briefing support
- PDF report export
- Billing and plan scaffolding
- Audit logging
- Rate limiting and tenant-aware authorization

## How This Helps The Blostem Team In Real Life

- Sales and partnerships get a live view of which partners need attention.
- Customer success gets early warning when partner health starts dropping.
- Leadership gets one dashboard instead of chasing updates across spreadsheets and chats.
- Ops can import partner data, search it, and act on it quickly.
- Outreach becomes faster and more consistent because teams can generate, save, and send sequences from the same workflow.
- Reporting is faster because the platform can generate tenant-specific exports and PDFs directly from live data.
- Billing, roles, audit, and workspace controls make it much closer to a real SaaS product than a demo app.

## Product Workflow

1. A user signs up and creates or joins an organization.
2. The org creates partners manually or imports them by CSV.
3. Partners send activity or event data through ingestion endpoints or API keys.
4. The platform stores and aggregates partner activity into operational metrics and snapshots.
5. Analytics surfaces health, trends, retention, and partner movement.
6. Lead scoring and prediction services turn raw partner signals into prioritized action.
7. Outreach workflows help the team generate and send contextual follow-up.
8. Reports, audit logs, and settings support ongoing team operations.

## Architecture

BlostemIQ uses a microservice-style architecture with a Next.js frontend, Node.js and Python backend services, PostgreSQL as the main system of record, Redis/Kafka for event and realtime flows, and AWS for deployment.

High-level request path:

1. User opens the web app in the browser.
2. Frontend talks to backend services through same-origin `/api` and `/ws` routes.
3. Auth validates identity, session, org, and role.
4. Domain services handle partners, analytics, billing, notifications, outreach, reporting, ML, and lead scoring.
5. PostgreSQL stores persistent tenant data.
6. Notification service pushes live alerts over WebSockets.
7. AWS EKS runs the deployed containers behind ingress/load balancers.

## Services Used

### Frontend

- `frontend` - Next.js 14 app router UI for auth, dashboard, partners, analytics, outreach, leads, predict, settings, and reporting

### Node.js services

- `auth-service` - authentication, org management, invites, membership, entitlements, audit-related flows
- `partner-service` - partner CRUD, CSV import, API keys, ingestion endpoints, partner metrics/event writes
- `notification-service` - realtime alerts and websocket delivery
- `billing-service` - billing plans, subscriptions, Stripe checkout/portal/webhook handling

### Python services

- `analytics-service` - health scoring, retention, trend, snapshot, and cohort analytics
- `ml-service` - churn prediction logic
- `lead-scoring-service` - lead qualification and scoring
- `outreach-service` - outreach classification, generation, sequence persistence, send path, sender settings
- `report-service` - PDF report generation from live tenant data

### Data and platform services

- PostgreSQL - primary relational data store
- Redis - caching/pubsub support
- Kafka - event streaming and async pipelines
- Docker Compose - full local stack orchestration
- Helm - Kubernetes release management
- ECR - image registry
- EKS - container runtime on AWS
- RDS - managed PostgreSQL on AWS
- NGINX Ingress - routing into the cluster

### External integrations

- Stripe - billing
- Groq - outreach generation
- ElevenLabs - voice briefing
- Google OAuth - social auth
- SMTP / SES-compatible delivery - outbound email

## Tech Stack

### Frontend

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Zustand
- TanStack Query
- Recharts
- D3
- Framer Motion
- Socket.IO client

### Backend

- Node.js
- Express
- TypeScript
- FastAPI
- Python 3.11
- Prisma
- asyncpg
- JWT auth

### Data / messaging / infra

- PostgreSQL
- Redis
- Kafka
- Docker
- Docker Compose
- Kubernetes
- Helm
- AWS EKS
- AWS ECR
- AWS RDS

### ML / AI / document generation

- NumPy
- scikit-learn
- XGBoost
- ReportLab
- Groq API
- ElevenLabs API

## Project Layout

```text
blostemiq/
├── frontend/                  # Next.js web app
├── backend/
│   ├── auth-service/          # Auth, orgs, members, entitlements
│   ├── partner-service/       # Partners, ingestion, API keys, CSV import
│   ├── notification-service/  # Websocket alerts
│   ├── billing-service/       # Billing and subscriptions
│   ├── analytics-service/     # Analytics and cohorts
│   ├── ml-service/            # Churn prediction
│   ├── lead-scoring-service/  # Lead scoring
│   ├── outreach-service/      # Outreach generation and delivery
│   └── report-service/        # PDF report generation
├── database/
│   ├── migrations/
│   ├── schemas/
│   └── seeds/
├── ml/
│   ├── data/
│   ├── models/
│   └── pipelines/
├── infra/
│   ├── scripts/
│   └── terraform/
├── k8s/
│   ├── base/
│   ├── helm/
│   └── ssl/
├── scripts/
├── docker-compose.yml
└── REAL_SAAS_IMPLEMENTATION_GUIDE.md
```

## Local Development

### Start the full stack

```bash
docker compose up --build
```

### Useful commands

```bash
npm run dev
npm run db:bootstrap
npm run db:retention
npm run smoke:local
npm run test
npm run lint
```

### Main local URLs

| Service | URL |
|---|---|
| Frontend | `http://localhost:3000` |
| Auth Service | `http://localhost:3001` |
| Partner Service | `http://localhost:3002` |
| Notification Service | `http://localhost:3004` |
| Analytics Service | `http://localhost:8004` |
| Outreach Service | `http://localhost:8003` |
| Report Service | `http://localhost:8005` |
| Billing Service | `http://localhost:3005` |

## Deployment Model

- Source code is stored in GitHub.
- Containers are built and pushed to AWS ECR.
- Helm charts deploy the services into AWS EKS.
- Ingress/load balancers expose the frontend and routed APIs.
- Secrets are injected into services at runtime.

## SaaS Operational Features

- tenant-aware auth and org isolation
- role-based access patterns
- plan and entitlement enforcement
- audit logging
- rate limiting
- realtime notifications
- export/delete workspace controls
- deployment and smoke-test workflows

## Current Product Notes

- Core app flows are liveable and tested across auth, dashboard, partners, analytics, search, leads, predict, settings, reporting, and outreach persistence.
- Some provider-backed capabilities still depend on live external credentials and production policy setup, especially billing completion, outbound email delivery, and some third-party auth paths.

## Cost Control

To reduce AWS compute cost when the team is not using the system:

```bash
./scripts/cost-control.sh down
./scripts/cost-control.sh up
./scripts/cost-control.sh spend
./scripts/cost-control.sh stop-ml
```

`down` scales the EKS node group to zero. `up` brings it back.

## Why This Matters

BlostemIQ is not just a dashboard. It is the operating layer that helps the Blostem team:

- protect partner revenue
- act before churn happens
- prioritize the right accounts
- move faster with fewer manual handoffs
- create a repeatable SaaS workflow around partner growth and retention
