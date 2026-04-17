#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  BlostemIQ — Full Deploy Script
#  Builds → Tags → Pushes to ECR → Helm install to EKS
# ═══════════════════════════════════════════════════════════
set -euo pipefail

# ─── Config ──────────────────────────────────────────────
AWS_REGION="us-east-1"
AWS_ACCOUNT="279867549867"
CLUSTER_NAME="blostemiq-dev"
NAMESPACE="blostemiq"
ECR_BASE="${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "local")
TAG="${1:-$GIT_SHA}"

# Color helpers
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $1"; }
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
die()  { echo -e "${RED}❌ $1${NC}"; exit 1; }

echo -e "${BOLD}${CYAN}
╔══════════════════════════════════════════════════════╗
║   BlostemIQ Full Deploy Pipeline                      ║
║   Tag: ${TAG}
╚══════════════════════════════════════════════════════╝${NC}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ─── Step 1: AWS ECR Login ────────────────────────────────
log "1/5 Logging into ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "${ECR_BASE}" || die "ECR login failed"
ok "ECR authenticated"

# ─── Step 2: Update kubeconfig ───────────────────────────
log "2/5 Updating kubeconfig for EKS..."
aws eks update-kubeconfig \
  --name "$CLUSTER_NAME" \
  --region "$AWS_REGION" || die "kubeconfig update failed"
ok "kubeconfig updated → ${CLUSTER_NAME}"

# ─── Step 3: Build + Push Images ─────────────────────────
log "3/5 Building and pushing Docker images..."

# Array: "service_name:source_dir:ecr_repo_name"
SERVICES=(
  "auth-service:backend/auth-service:blostemiq-auth-service"
  "partner-service:backend/partner-service:blostemiq-partner-service"
  "notification-service:backend/notification-service:blostemiq-notification-service"
  "ml-service:backend/ml-service:blostemiq-ml-serving"
  "frontend:frontend:blostemiq-frontend"
)

for entry in "${SERVICES[@]}"; do
  IFS=':' read -r svc_name src_dir ecr_repo <<< "$entry"
  IMAGE_URI="${ECR_BASE}/${ecr_repo}:${TAG}"
  IMAGE_LATEST="${ECR_BASE}/${ecr_repo}:latest"

  log "  Building ${svc_name}..."

  # Check if Dockerfile exists
  DOCKERFILE="${ROOT}/${src_dir}/Dockerfile.dev"
  if [[ ! -f "$DOCKERFILE" ]]; then
    warn "No Dockerfile for ${svc_name} — skipping"
    continue
  fi

  docker build \
    --platform linux/amd64 \
    --file "$DOCKERFILE" \
    --tag "$IMAGE_URI" \
    --tag "$IMAGE_LATEST" \
    --cache-from "$IMAGE_LATEST" \
    "${ROOT}/${src_dir}" || { warn "Build failed for ${svc_name}"; continue; }

  docker push "$IMAGE_URI"   || { warn "Push failed for ${svc_name}:${TAG}"; continue; }
  docker push "$IMAGE_LATEST" || warn "Push failed for ${svc_name}:latest"

  ok "  ${svc_name} → ${ecr_repo}:${TAG}"
done

# ─── Step 4: Create namespace + secrets ──────────────────
log "4/5 Ensuring namespace and base secrets..."
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# Fetch DB password from Secrets Manager if available
DB_PASS=$(aws secretsmanager get-secret-value \
  --secret-id "blostemiq/dev/rds/password" \
  --query SecretString --output text 2>/dev/null || echo "blostemiq_dev_placeholder")

# Create/update base secrets (one-liner — not recommended for prod, use External Secrets Operator)
kubectl create secret generic blostemiq-shared \
  --namespace "$NAMESPACE" \
  --from-literal=DATABASE_URL="postgresql://blostemiq:${DB_PASS}@postgresql.${NAMESPACE}.svc.cluster.local:5432/blostemiq" \
  --from-literal=REDIS_URL="redis://redis.${NAMESPACE}.svc.cluster.local:6379" \
  --from-literal=KAFKA_BROKERS="kafka.${NAMESPACE}.svc.cluster.local:9092" \
  --from-literal=JWT_SECRET="blostemiq_dev_secret_$(openssl rand -hex 8)" \
  --dry-run=client -o yaml | kubectl apply -f - || true

ok "Namespace + secrets ready"

# ─── Step 5: Helm Deploy ─────────────────────────────────
log "5/5 Deploying with Helm..."

helm_deploy() {
  local chart_name="$1"
  local release_name="$2"
  local extra_args="${3:-}"

  echo -e "  ${CYAN}→ helm upgrade ${release_name}${NC}"
  helm upgrade --install "$release_name" "k8s/helm/${chart_name}" \
    --namespace "$NAMESPACE" \
    --create-namespace \
    --set "image.tag=${TAG}" \
    $extra_args \
    --timeout 5m \
    --wait || warn "Helm deploy failed for ${release_name}"
  ok "  ${release_name} deployed"
}

helm_deploy "auth-service"          "auth-service"
helm_deploy "partner-service"       "partner-service"
helm_deploy "notification-service"  "notification-service"
helm_deploy "ml-service"            "ml-service"
helm_deploy "frontend"              "frontend"

# ─── Done! ───────────────────────────────────────────────
echo -e "${BOLD}${GREEN}
╔══════════════════════════════════════════════════════╗
║  🚀 BlostemIQ is LIVE on AWS EKS!                    ║
╚══════════════════════════════════════════════════════╝${NC}"

echo ""
echo "📊 Pod Status:"
kubectl get pods -n "$NAMESPACE" -o wide 2>/dev/null || true

echo ""
echo "🌐 Services:"
kubectl get svc -n "$NAMESPACE" 2>/dev/null || true

echo ""
echo "📈 HPAs:"
kubectl get hpa -n "$NAMESPACE" 2>/dev/null || true

echo ""
# Get frontend LoadBalancer URL
FRONTEND_URL=$(kubectl get svc frontend -n "$NAMESPACE" \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "pending...")

if [[ -n "$FRONTEND_URL" && "$FRONTEND_URL" != "pending..." ]]; then
  echo -e "${GREEN}🌍 Dashboard: http://${FRONTEND_URL}${NC}"
else
  echo -e "${YELLOW}🌍 Frontend LoadBalancer: pending (takes 2-3 min)${NC}"
  echo "   Run: kubectl get svc frontend -n blostemiq -w"
fi
