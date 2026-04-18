from fastapi import FastAPI, HTTPException
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
import logging
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Outreach Service", version="1.0.0")

_model = None
_vectorizer = None

class ClassifyRequest(BaseModel):
    notes: str
    recent_events: list[str]
    health_score: float

class OutreachType(BaseModel):
    category: str
    confidence: float

def generate_training_data():
    # Synthetic sentences
    X_str = [
        "payment failure billing error urgently critical",
        "api tokens rotated successfully integrations ok",
        "checking in on q3 roadmap planning feature adoption",
        "multiple 500 errors downtime severe system halt",
        "no activity 30 days ghosted abandoned",
        "upsell opportunity raised limits active"
    ]
    # 0 = Escalation, 1 = Nurture, 2 = Re-engagement
    y = [0, 1, 1, 0, 2, 1]
    return X_str, np.array(y)

@app.on_event("startup")
async def train_classifier():
    global _model, _vectorizer
    logger.info("Training Outreach Classifier...")
    
    X_str, y = generate_training_data()
    
    _vectorizer = TfidfVectorizer()
    X = _vectorizer.fit_transform(X_str)
    
    _model = RandomForestClassifier(n_estimators=50, random_state=42)
    _model.fit(X, y)
    logger.info("Outreach Classifier trained!")

@app.post("/classify", response_model=OutreachType)
async def classify_outreach(req: ClassifyRequest):
    if not _model or not _vectorizer:
        raise HTTPException(503, "Model not trained")
        
    text = f"{req.notes} {' '.join(req.recent_events)}"
    vec = _vectorizer.transform([text])
    
    probs = _model.predict_proba(vec)[0]
    pred_idx = np.argmax(probs)
    
    categories = {0: "escalation", 1: "nurture", 2: "re-engagement"}
    
    # Simple rule-based override for hackers
    if req.health_score < 40 and pred_idx == 1:
        pred_idx = 0 # force escalation if health is terrible
        
    return OutreachType(
        category=categories[pred_idx],
        confidence=round(float(probs[pred_idx]), 3)
    )

@app.get("/health")
def health():
    return {"status": "ok"}
