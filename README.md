# BlostemIQ — Monorepo

> B2B SaaS Intelligence Platform for Fintech Infrastructure  
> Real-time partner health monitoring · AI churn prediction · Compliance-aware outreach

---

## 🏗️ Architecture

```
blostemiq/
├── apps/
│   ├── frontend/              # Next.js 14 (App Router, TypeScript)
│   ├── auth-service/          # Node.js + Express — JWT, OAuth, org provisioning
│   ├── partner-service/       # Node.js + REST — Partner CRUD, event ingestion
│   ├── analytics-service/     # Python + FastAPI — Metrics, cohorts, funnels
│   ├── ml-serving/            # Python + FastAPI — SageMaker inference, SHAP
│   ├── outreach-service/      # Python + FastAPI — Claude AI email generation
│   ├── notification-service/  # Node.js + WebSocket — Real-time alerts
│   ├── lead-scoring-service/  # Python + FastAPI — XGBoost lead scoring
│   ├── search-service/        # Node.js + OpenSearch — Full-text + vector search
│   ├── report-engine/         # Python + WeasyPrint — PDF reports, SES delivery
│   └── billing-service/       # Node.js + Stripe — Subscriptions, webhooks
├── infra/
│   └── terraform/             # All AWS infrastructure as code
├── ml/
│   ├── models/                # XGBoost churn + lead scorer + outreach classifier
│   ├── pipelines/             # Feature engineering, retrain DAGs
│   └── data/                  # Synthetic datasets (DVC versioned)
├── k8s/
│   └── helm/                  # Helm charts for EKS deployments
├── scripts/
│   ├── init-db.sql            # Postgres schema
│   └── localstack-init.sh     # Local AWS resource setup
└── .github/
    └── workflows/             # CI/CD pipelines
```

## 🚀 Local Development

### Prerequisites
- Docker Desktop
- Node.js 20+
- Python 3.11+

### Start Everything
```bash
# Clone and setup
git clone https://github.com/RajanChauhan-07/blostemiq.git
cd blostemiq

# Generate JWT keypair (one-time)
mkdir -p keys
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem

# Start all services
docker compose up --build

# Services will be available at:
# Frontend:           http://localhost:3000
# Kong API Gateway:   http://localhost:8000
# Kong Admin:         http://localhost:8001
# Auth Service:       http://localhost:3001
# Partner Service:    http://localhost:3002
# Notification WS:    ws://localhost:3004
# Kafka UI:           http://localhost:8080
# OpenSearch:         http://localhost:9200
# OpenSearch Dash:    http://localhost:5601
# MLflow:             http://localhost:5001
# LocalStack AWS:     http://localhost:4566
```

## 🌩️ AWS Deployment

```bash
# Initialize Terraform
cd infra/terraform/environments/dev
terraform init
terraform plan
terraform apply
```

## 🧠 ML Models

```bash
# Generate synthetic training data
cd ml/data
python generate_synthetic_data.py --records 10000

# Train churn model locally (sample)
cd ml/models/churn
python train.py --mode local --sample-size 1000

# Launch SageMaker training job (AWS)
python train.py --mode sagemaker
```

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS, Framer Motion, Recharts, D3.js |
| **API Gateway** | Kong on EKS |
| **Backend** | Node.js + Express, Python + FastAPI |
| **ML** | XGBoost, SHAP, ONNX, SageMaker |
| **AI** | Claude (Anthropic), ElevenLabs, OpenAI Embeddings |
| **Databases** | PostgreSQL RDS, DynamoDB, ElastiCache Redis |
| **Search** | OpenSearch (full-text + vector) |
| **Messaging** | MSK Kafka, Kinesis |
| **Infra** | EKS, Terraform, Helm, ArgoCD |
| **Observability** | Prometheus, Grafana, X-Ray, CloudWatch |

## 📊 Hackathon: Blostem AI Builder

**Demo: May 9, 2026 @ Noida HQ**
