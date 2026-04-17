#!/usr/bin/env python3
"""
BlostemIQ ML Service — XGBoost Churn Predictor
═══════════════════════════════════════════════
FastAPI service that:
  1. Trains XGBoost on synthetic partner feature data (on startup)
  2. Serves /predict endpoint — takes 5 health dimensions → churn probability
  3. /batch endpoint — up to 500 partners scored in <100ms

Features fed to model:
  recency_score  (0-25)  — days since last API call
  frequency_score (0-25) — 7d vs 30d call trend
  depth_score    (0-20)  — features used / total features
  trend_score    (0-20)  — linear regression slope on call volume
  error_score    (0-10)  — error rate (inverted)
  health_score   (0-100) — composite

Target: churn_probability (0-1)
"""

import numpy as np
import xgboost as xgb
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="BlostemIQ ML Service",
    description="XGBoost churn prediction & lead scoring",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Global model ──────────────────────────────────────────
_model: xgb.Booster | None = None


def _generate_training_data(n: int = 50_000):
    """
    Synthetic training data with realistic correlations.
    We encode domain knowledge:
      - Low recency + low frequency + high errors = high churn
      - High depth + positive trend = low churn
    """
    np.random.seed(42)

    # Feature distributions by churn class
    # class 0 = healthy, class 1 = churned
    n_healthy  = int(n * 0.65)
    n_churned  = n - n_healthy

    def healthy_features(size):
        return np.column_stack([
            np.random.normal(20, 3, size).clip(0, 25),   # recency
            np.random.normal(19, 3, size).clip(0, 25),   # frequency
            np.random.normal(16, 2, size).clip(0, 20),   # depth
            np.random.normal(16, 2, size).clip(0, 20),   # trend
            np.random.normal(8,  1, size).clip(0, 10),   # error_score
        ])

    def churned_features(size):
        return np.column_stack([
            np.random.normal(8,  4, size).clip(0, 25),   # recency low
            np.random.normal(7,  4, size).clip(0, 25),   # frequency low
            np.random.normal(7,  3, size).clip(0, 20),   # depth low
            np.random.normal(5,  3, size).clip(0, 20),   # trend low
            np.random.normal(3,  2, size).clip(0, 10),   # error low (high errors)
        ])

    X = np.vstack([healthy_features(n_healthy), churned_features(n_churned)])
    # Add composite health_score as 6th feature
    health_scores = X.sum(axis=1)  # max = 100
    X = np.column_stack([X, health_scores])

    y = np.concatenate([np.zeros(n_healthy), np.ones(n_churned)])

    # Shuffle
    idx = np.random.permutation(n)
    return X[idx], y[idx]


@app.on_event("startup")
async def train_model():
    global _model
    logger.info("🤖 Training XGBoost churn model...")

    X, y = _generate_training_data(50_000)
    split = int(len(X) * 0.85)
    X_train, X_val, y_train, y_val = X[:split], X[split:], y[:split], y[split:]

    dtrain = xgb.DMatrix(X_train, label=y_train,
                         feature_names=["recency","frequency","depth","trend","error_score","health"])
    dval   = xgb.DMatrix(X_val,   label=y_val,
                         feature_names=["recency","frequency","depth","trend","error_score","health"])

    params = {
        "objective":       "binary:logistic",
        "eval_metric":     ["logloss", "auc"],
        "max_depth":       6,
        "learning_rate":   0.1,
        "n_estimators":    200,
        "subsample":       0.8,
        "colsample_bytree": 0.8,
        "min_child_weight": 3,
        "gamma":           0.1,
        "reg_lambda":      1.0,
        "tree_method":     "hist",
        "seed":            42,
    }

    _model = xgb.train(
        params,
        dtrain,
        num_boost_round=200,
        evals=[(dtrain, "train"), (dval, "val")],
        early_stopping_rounds=20,
        verbose_eval=50,
    )

    # Quick validation
    preds = _model.predict(dval)
    from sklearn.metrics import roc_auc_score
    auc = roc_auc_score(y_val, preds)
    logger.info(f"✅ Model trained! Val AUC: {auc:.4f}")


# ─── API Models ───────────────────────────────────────────
class HealthDimensions(BaseModel):
    partner_id:      str
    recency_score:   float = Field(..., ge=0, le=25)
    frequency_score: float = Field(..., ge=0, le=25)
    depth_score:     float = Field(..., ge=0, le=20)
    trend_score:     float = Field(..., ge=0, le=20)
    error_score:     float = Field(..., ge=0, le=10)
    health_score:    float = Field(..., ge=0, le=100)


class ChurnPrediction(BaseModel):
    partner_id:        str
    churn_probability: float
    churn_tier:        str   # "critical" | "high" | "medium" | "low"
    confidence:        float
    top_risk_factor:   str


class BatchRequest(BaseModel):
    partners: list[HealthDimensions]


# ─── Helpers ──────────────────────────────────────────────
def _predict_one(dims: HealthDimensions) -> ChurnPrediction:
    features = np.array([[
        dims.recency_score, dims.frequency_score, dims.depth_score,
        dims.trend_score, dims.error_score, dims.health_score,
    ]])
    dmat = xgb.DMatrix(features,
                       feature_names=["recency","frequency","depth","trend","error_score","health"])
    prob = float(_model.predict(dmat)[0])

    # Tier
    if   prob >= 0.85:  tier = "critical"
    elif prob >= 0.70:  tier = "high"
    elif prob >= 0.50:  tier = "medium"
    else:               tier = "low"

    # Top risk factor (lowest scoring dimension)
    dim_map = {
        "Low recency (infrequent API calls)":      dims.recency_score / 25,
        "Declining call frequency":                dims.frequency_score / 25,
        "Low feature adoption":                    dims.depth_score / 20,
        "Negative usage trend":                    dims.trend_score / 20,
        "High error rate":                         dims.error_score / 10,
    }
    top_risk = min(dim_map, key=dim_map.get)

    # Confidence: distance from 0.5 boundary
    confidence = min(abs(prob - 0.5) * 2, 1.0)

    return ChurnPrediction(
        partner_id=dims.partner_id,
        churn_probability=round(prob, 4),
        churn_tier=tier,
        confidence=round(confidence, 3),
        top_risk_factor=top_risk,
    )


# ─── Endpoints ────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": _model is not None, "service": "ml-service"}


@app.post("/predict", response_model=ChurnPrediction)
async def predict(dims: HealthDimensions):
    if _model is None:
        raise HTTPException(503, "Model not loaded yet")
    return _predict_one(dims)


@app.post("/batch", response_model=list[ChurnPrediction])
async def batch_predict(req: BatchRequest):
    if _model is None:
        raise HTTPException(503, "Model not loaded yet")
    if len(req.partners) > 500:
        raise HTTPException(400, "Max 500 partners per batch")

    features = np.array([[
        p.recency_score, p.frequency_score, p.depth_score,
        p.trend_score, p.error_score, p.health_score,
    ] for p in req.partners])

    dmat  = xgb.DMatrix(features,
                        feature_names=["recency","frequency","depth","trend","error_score","health"])
    probs = _model.predict(dmat)

    results = []
    for i, p in enumerate(req.partners):
        prob = float(probs[i])
        p.recency_score   = p.recency_score
        results.append(_predict_one(p))
    return results


@app.get("/feature_importance")
async def feature_importance():
    if _model is None:
        raise HTTPException(503, "Model not loaded")
    scores = _model.get_fscore()
    total = sum(scores.values())
    return {k: round(v / total, 4) for k, v in sorted(scores.items(), key=lambda x: -x[1])}
