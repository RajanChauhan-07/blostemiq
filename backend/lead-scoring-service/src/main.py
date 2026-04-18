from fastapi import FastAPI, HTTPException
import numpy as np
import xgboost as xgb
import logging
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Lead Scoring Service", version="1.0.0")

# Global model
_model = None

class LeadData(BaseModel):
    company_size: int
    funding_millions: float
    news_sentiment: float  # -1.0 to 1.0

def generate_leads(n=2000):
    np.random.seed(42)
    
    # 0 = not converting, 1 = converting
    n_conv = int(n * 0.1)  # 10% conversion rate
    n_fail = n - n_conv
    
    # Converting have bigger size, higher funding, better news sentiment on average
    X_conv = np.column_stack([
        np.random.normal(500, 100, n_conv).clip(10, 5000),      # size
        np.random.normal(50, 20, n_conv).clip(0, 500),          # funding
        np.random.normal(0.6, 0.2, n_conv).clip(-1, 1),         # sentiment
    ])
    
    X_fail = np.column_stack([
        np.random.normal(50, 50, n_fail).clip(10, 5000),
        np.random.normal(2, 5, n_fail).clip(0, 500),
        np.random.normal(0, 0.4, n_fail).clip(-1, 1),
    ])
    
    X = np.vstack([X_fail, X_conv])
    y = np.concatenate([np.zeros(n_fail), np.ones(n_conv)])
    
    # Shuffle
    idx = np.random.permutation(n)
    return X[idx], y[idx]

@app.on_event("startup")
async def train_and_export():
    global _model
    logger.info("Training Lead Scoring XGBoost Model...")
    
    X, y = generate_leads()
    dtrain = xgb.DMatrix(X, label=y, feature_names=["size", "funding", "sentiment"])
    
    params = {
        "objective": "binary:logistic",
        "eval_metric": "auc",
        "max_depth": 4,
        "seed": 42
    }
    
    _model = xgb.train(params, dtrain, num_boost_round=100)
    _model.save_model("lead_scorer.json")
    logger.info("Model trained and saved!")
    
@app.post("/score")
async def score_lead(lead: LeadData):
    if not _model:
        raise HTTPException(503, "Model not trained")
        
    features = np.array([[lead.company_size, lead.funding_millions, lead.news_sentiment]])
    dmat = xgb.DMatrix(features, feature_names=["size", "funding", "sentiment"])
    prob = float(_model.predict(dmat)[0])
    
    score = round(prob * 100)
    
    return {
        "lead_score": score,
        "probability": round(prob, 4),
        "status": "HOT" if score > 70 else "WARM" if score > 40 else "COLD"
    }

@app.get("/health")
def health():
    return {"status": "ok"}
