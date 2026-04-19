#!/usr/bin/env python3
"""
BlostemIQ ML Service
Explainable churn scoring from live health dimensions.
"""

import logging
import math
from typing import Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="BlostemIQ ML Service",
    description="Explainable churn scoring from partner health dimensions",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FEATURE_KEYS = ["recency", "frequency", "depth", "trend", "error_score", "health"]
FEATURE_LABELS = {
    "recency": "API usage recency",
    "frequency": "Call frequency",
    "depth": "Feature adoption depth",
    "trend": "Usage trend",
    "error_score": "Operational reliability",
    "health": "Composite health",
}
FEATURE_WEIGHTS: Dict[str, float] = {
    "recency": 0.18,
    "frequency": 0.18,
    "depth": 0.16,
    "trend": 0.16,
    "error_score": 0.12,
    "health": 0.20,
}
BASELINE_NORMS: Dict[str, float] = {
    "recency": 0.72,
    "frequency": 0.70,
    "depth": 0.68,
    "trend": 0.68,
    "error_score": 0.75,
    "health": 0.72,
}


class HealthDimensions(BaseModel):
    partner_id: str
    recency_score: float = Field(..., ge=0, le=25)
    frequency_score: float = Field(..., ge=0, le=25)
    depth_score: float = Field(..., ge=0, le=20)
    trend_score: float = Field(..., ge=0, le=20)
    error_score: float = Field(..., ge=0, le=10)
    health_score: float = Field(..., ge=0, le=100)


class ChurnPrediction(BaseModel):
    partner_id: str
    churn_probability: float
    churn_tier: str
    confidence: float
    top_risk_factor: str
    shap_explanation_text: str | None = None
    shap_features: List[str] | None = None
    shap_values: List[float] | None = None


class BatchRequest(BaseModel):
    partners: List[HealthDimensions]


def _normalize(dims: HealthDimensions) -> Dict[str, float]:
    return {
        "recency": dims.recency_score / 25,
        "frequency": dims.frequency_score / 25,
        "depth": dims.depth_score / 20,
        "trend": dims.trend_score / 20,
        "error_score": dims.error_score / 10,
        "health": dims.health_score / 100,
    }


def _calculate_impacts(normalized: Dict[str, float]) -> List[tuple[str, float]]:
    impacts: List[tuple[str, float]] = []
    for feature in FEATURE_KEYS:
        baseline = BASELINE_NORMS[feature]
        deviation = baseline - normalized[feature]
        impact = round(deviation * FEATURE_WEIGHTS[feature] * 3, 4)
        impacts.append((feature, impact))
    return sorted(impacts, key=lambda item: abs(item[1]), reverse=True)


def _tier_from_probability(prob: float) -> str:
    if prob >= 0.85:
        return "critical"
    if prob >= 0.70:
        return "high"
    if prob >= 0.50:
        return "medium"
    return "low"


def _predict_one(dims: HealthDimensions) -> ChurnPrediction:
    normalized = _normalize(dims)
    health_index = sum(normalized[feature] * FEATURE_WEIGHTS[feature] for feature in FEATURE_KEYS)
    risk_signal = 1 - health_index
    probability = 1 / (1 + math.exp(-8 * (risk_signal - 0.45)))
    probability = round(max(0.001, min(0.999, probability)), 4)

    impacts = _calculate_impacts(normalized)
    top_positive_impacts = [feature for feature, impact in impacts if impact > 0][:2]

    if top_positive_impacts:
        explanation = "High churn risk driven primarily by " + " and ".join(
            FEATURE_LABELS[feature].lower() for feature in top_positive_impacts
        ) + "."
        top_risk_factor = FEATURE_LABELS[top_positive_impacts[0]]
    else:
        explanation = "Partner looks stable across the primary health dimensions."
        top_risk_factor = "No material risk driver"

    confidence = round(min(abs(probability - 0.5) * 2, 1.0), 3)
    tier = _tier_from_probability(probability)

    return ChurnPrediction(
        partner_id=dims.partner_id,
        churn_probability=probability,
        churn_tier=tier,
        confidence=confidence,
        top_risk_factor=top_risk_factor,
        shap_explanation_text=explanation,
        shap_features=[feature for feature, _ in impacts],
        shap_values=[impact for _, impact in impacts],
    )


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "ml-service",
        "mode": "deterministic-explainable-scoring",
    }


@app.post("/predict", response_model=ChurnPrediction)
async def predict(dims: HealthDimensions):
    return _predict_one(dims)


@app.post("/batch", response_model=List[ChurnPrediction])
async def batch_predict(req: BatchRequest):
    if len(req.partners) > 500:
        raise HTTPException(400, "Max 500 partners per batch")
    return [_predict_one(partner) for partner in req.partners]


@app.get("/feature_importance")
async def feature_importance():
    return {
        feature: round(weight, 4)
        for feature, weight in sorted(FEATURE_WEIGHTS.items(), key=lambda item: -item[1])
    }


@app.post("/shap")
async def get_shap_values(dims: HealthDimensions):
    prediction = _predict_one(dims)
    return {
        "partner_id": dims.partner_id,
        "base_value": 0.5,
        "features": prediction.shap_features,
        "shap_values": prediction.shap_values,
    }
