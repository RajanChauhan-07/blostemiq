#!/bin/bash
# ─── BlostemIQ AWS Cost Control Scripts ──────────────────
# Run these from your terminal to save money

AWS_REGION="us-east-1"
CLUSTER="blostemiq-dev"

echo_green() { echo -e "\033[0;32m$1\033[0m"; }
echo_yellow() { echo -e "\033[0;33m$1\033[0m"; }
echo_red() { echo -e "\033[0;31m$1\033[0m"; }

# ─── Scale EKS to 0 (Stop working for the night) ──────────
scale_down() {
  echo_yellow "⬇️  Scaling EKS node group to 0..."
  NODE_GROUP=$(aws eks list-nodegroups --cluster-name $CLUSTER --region $AWS_REGION --query 'nodegroups[0]' --output text)
  aws eks update-nodegroup-config \
    --cluster-name $CLUSTER \
    --nodegroup-name $NODE_GROUP \
    --scaling-config minSize=0,maxSize=3,desiredSize=0 \
    --region $AWS_REGION
  echo_green "✅ EKS scaled to 0. No compute charges while you sleep."
}

# ─── Scale EKS back up (Start working) ────────────────────
scale_up() {
  echo_yellow "⬆️  Scaling EKS node group to 1..."
  NODE_GROUP=$(aws eks list-nodegroups --cluster-name $CLUSTER --region $AWS_REGION --query 'nodegroups[0]' --output text)
  aws eks update-nodegroup-config \
    --cluster-name $CLUSTER \
    --nodegroup-name $NODE_GROUP \
    --scaling-config minSize=1,maxSize=3,desiredSize=1 \
    --region $AWS_REGION
  echo_green "✅ EKS scaling up. Takes ~3 minutes for node to be ready."
}

# ─── Check current AWS spend ──────────────────────────────
check_spend() {
  echo_yellow "💰 Checking AWS spend this month..."
  START=$(date -v-1m +%Y-%m-01 2>/dev/null || date -d "1 month ago" +%Y-%m-01)
  END=$(date +%Y-%m-%d)
  aws ce get-cost-and-usage \
    --time-period Start=$START,End=$END \
    --granularity MONTHLY \
    --metrics UnblendedCost \
    --region us-east-1 \
    --query 'ResultsByTime[0].Total.UnblendedCost.{Amount:Amount,Unit:Unit}' \
    --output table
}

# ─── Stop SageMaker endpoint (save ~$1.56/day) ────────────
stop_sagemaker() {
  echo_yellow "🧠 Deleting SageMaker endpoint (you'll redeploy when needed)..."
  aws sagemaker delete-endpoint --endpoint-name blostemiq-churn-dev --region $AWS_REGION 2>/dev/null || true
  aws sagemaker delete-endpoint --endpoint-name blostemiq-lead-scorer-dev --region $AWS_REGION 2>/dev/null || true
  echo_green "✅ SageMaker endpoints deleted."
}

# ─── Usage ────────────────────────────────────────────────
case "$1" in
  down)   scale_down ;;
  up)     scale_up ;;
  spend)  check_spend ;;
  stop-ml) stop_sagemaker ;;
  *)
    echo "Usage: $0 {down|up|spend|stop-ml}"
    echo "  down     — Scale EKS to 0 (save money at night)"
    echo "  up       — Scale EKS back to 1 node"
    echo "  spend    — Check current AWS spend this month"
    echo "  stop-ml  — Delete SageMaker endpoints (redeploy when testing)"
    ;;
esac
