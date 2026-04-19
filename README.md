# BlostemIQ

> **B2B SaaS Intelligence Platform for Fintech Infrastructure**
> Real-time partner health · AI churn prediction · Compliance-aware outreach · ElevenLabs voice briefings

---

## 📁 Project Structure

```
blostemiq/
│
├── 🖥️  frontend/                     # Next.js 14 — The web app judges see
│   ├── app/                          # App Router pages
│   │   ├── (auth)/                   # Login, signup, org creation
│   │   ├── dashboard/                # Main partner health dashboard
│   │   ├── partners/                 # Partner list + detail pages
│   │   ├── outreach/                 # AI email composer
│   │   ├── analytics/                # Cohort heatmaps, funnels
│   │   └── settings/                 # Org settings, team, billing
│   ├── components/                   # Reusable UI components
│   ├── lib/                          # API clients, hooks, utilities
│   └── styles/                       # Global CSS + design tokens
│
├── 🔧  backend/                      # All backend microservices
│   ├── auth-service/                 # Node.js — JWT, OAuth, org provisioning
│   ├── partner-service/              # Node.js — Partner CRUD, event ingestion
│   ├── notification-service/         # Node.js — WebSocket, real-time alerts
│   ├── billing-service/              # Node.js — Stripe subscriptions
│   ├── search-service/               # Node.js — OpenSearch full-text + vector
│   └── python/
│       ├── analytics-service/        # FastAPI — Metrics, cohorts, funnels
│       ├── ml-serving/               # FastAPI — SageMaker inference + SHAP
│       ├── outreach-service/         # FastAPI — Claude AI email generation
│       ├── lead-scoring-service/     # FastAPI — XGBoost lead scoring
│       └── report-engine/            # Python — PDF reports, SES delivery
│
├── 🗄️  database/                     # Everything data-related
│   ├── schemas/
│   │   └── init-db.sql               # PostgreSQL schema (all 6 tables)
│   ├── migrations/                   # Prisma migration files
│   └── seeds/                        # Demo data (30 partners, 12mo history)
│
├── 🤖  ml/                           # Machine learning
│   ├── models/
│   │   ├── churn/                    # XGBoost churn predictor
│   │   ├── lead-scoring/             # XGBoost lead scorer
│   │   └── outreach-classifier/      # Template type classifier
│   ├── pipelines/                    # Feature refresh + retrain DAGs
│   └── data/                         # Synthetic datasets (DVC versioned)
│
├── ☁️  infra/
│   └── terraform/
│       ├── modules/
│       │   ├── vpc/                  # Network foundation
│       │   ├── eks/                  # Kubernetes cluster
│       │   ├── rds/                  # PostgreSQL on AWS
│       │   ├── elasticache/          # Redis on AWS
│       │   ├── s3/                   # 4 storage buckets
│       │   ├── ecr/                  # Container image registries
│       │   ├── dynamodb/             # 3 event tables
│       │   └── iam/                  # Roles, IRSA, GitHub OIDC
│       └── environments/
│           └── dev/                  # Dev environment (terraform apply here)
│
├── ⚙️  k8s/
│   └── helm/                         # Helm charts for EKS deployments
│
├── 🔄  .github/
│   └── workflows/
│       └── ci.yml                    # CI/CD: test → build → push ECR → deploy EKS
│
├── 🛠️  scripts/
│   ├── init-db.sql                   # Run once to setup Postgres schema
│   ├── localstack-init.sh            # Boots fake AWS locally
│   └── cost-control.sh               # Scale EKS up/down, check AWS spend
│
└── docker-compose.yml                # Starts EVERYTHING locally (1 command)
```

---

## 🚀 Start Local Dev (1 Command)

```bash
# Fresh local DBs auto-run database/schemas/init-db.sql on first boot.
# For an existing database, you can also run:
# DATABASE_URL=postgresql://... npm run db:bootstrap
docker compose up --build
```

**What starts:**

| Service | URL | What it is |
|---|---|---|
| Frontend (Next.js) | http://localhost:3000 | The web app |
| Kong API Gateway | http://localhost:8000 | All API calls go through here |
| Auth Service | http://localhost:3001 | Login / signup |
| Partner Service | http://localhost:3002 | Partner data |
| Notification WS | ws://localhost:3004 | Real-time alerts |
| Kafka UI | http://localhost:8080 | View event streams |
| OpenSearch | http://localhost:9200 | Search + vector index |
| MLflow | http://localhost:5001 | ML experiment tracking |
| LocalStack | http://localhost:4566 | Fake AWS (S3, DynamoDB, etc.) |

---

## ☁️ Deploy to AWS

```bash
cd infra/terraform/environments/dev
terraform init
terraform plan   # FREE — just shows what will be created
terraform apply  # Creates real AWS resources (~$1.50/day)
```

---

## 💰 AWS Cost Control

```bash
./scripts/cost-control.sh down    # Scale EKS to 0 (save money at night)
./scripts/cost-control.sh up      # Scale EKS back to 1 node
./scripts/cost-control.sh spend   # Check how much you've spent this month
./scripts/cost-control.sh stop-ml # Delete SageMaker endpoints
```

---

## 🏆 Blostem AI Builder Hackathon — Demo: May 9 @ Noida HQ

**Judging criteria:** Relevance (25%) · Technical Execution (25%) · Innovation (20%) · Demo (20%) · Scale (10%)
