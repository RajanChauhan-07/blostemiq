from fastapi import FastAPI
from pydantic import BaseModel
import logging
import math

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Lead Scoring Service", version="2.0.0")


class LeadData(BaseModel):
    company_size: int
    funding_millions: float
    news_sentiment: float  # -1.0 to 1.0


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def _score_lead(lead: LeadData) -> tuple[int, float, str]:
    size_signal = _clamp(math.log1p(max(lead.company_size, 0)) / math.log1p(5000), 0.0, 1.0)
    funding_signal = _clamp(lead.funding_millions / 200, 0.0, 1.0)
    sentiment_signal = _clamp((lead.news_sentiment + 1) / 2, 0.0, 1.0)

    weighted_score = (
        size_signal * 0.45
        + funding_signal * 0.35
        + sentiment_signal * 0.20
    )

    probability = round(weighted_score, 4)
    score = round(probability * 100)
    status = "HOT" if score > 70 else "WARM" if score > 40 else "COLD"
    return score, probability, status


@app.post("/score")
async def score_lead(lead: LeadData):
    score, probability, status = _score_lead(lead)
    return {
        "lead_score": score,
        "probability": probability,
        "status": status,
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "mode": "deterministic-live-scoring",
    }
