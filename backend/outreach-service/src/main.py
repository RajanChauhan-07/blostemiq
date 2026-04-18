from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
import httpx
import json
import os
import re
import logging
from pydantic import BaseModel
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Outreach Service", version="3.0.0")

_model = None
_vectorizer = None

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
GROQ_MODEL = "llama-3.1-8b-instant"
ELEVENLABS_VOICE_ID = "pNInz6obpgDQGcFmaJgB"

BANNED_PHRASES = [
    r"guaranteed\s+returns", r"risk[\s-]*free", r"100%\s+safe",
    r"assured\s+profit", r"no\s+risk", r"double\s+your\s+money",
    r"get\s+rich", r"zero\s+loss", r"unlimited\s+returns",
]

class ClassifyRequest(BaseModel):
    notes: str
    recent_events: list[str]
    health_score: float

class GenerateRequest(BaseModel):
    partner_name: str
    health_score: float
    churn_risk: float
    reason: str
    segment: Optional[str] = "Fintech"

class BriefingRequest(BaseModel):
    partners: list[dict]
    total_partners: int
    avg_health: float
    at_risk_count: int

def generate_training_data():
    X_str = [
        "payment failure billing error urgently critical",
        "api tokens rotated successfully integrations ok",
        "checking in on q3 roadmap planning feature adoption",
        "multiple 500 errors downtime severe system halt",
        "no activity 30 days ghosted abandoned",
        "upsell opportunity raised limits active",
        "integration broken urgent help needed immediately",
        "exploring new features scheduled demo next week",
        "no login 14 days usage declining churn likely",
        "great feedback expanding usage adding team members",
    ]
    y = [0, 1, 1, 0, 2, 1, 0, 1, 2, 1]
    return X_str, np.array(y)

@app.on_event("startup")
async def train_classifier():
    global _model, _vectorizer
    logger.info("Training Outreach Classifier v3 (Groq + ElevenLabs)...")
    X_str, y = generate_training_data()
    _vectorizer = TfidfVectorizer()
    X = _vectorizer.fit_transform(X_str)
    _model = RandomForestClassifier(n_estimators=50, random_state=42)
    _model.fit(X, y)
    logger.info("Classifier trained! Groq LLM + ElevenLabs TTS ready.")

def check_compliance(text: str) -> tuple[bool, list[str]]:
    violations = []
    for pattern in BANNED_PHRASES:
        if re.search(pattern, text, re.IGNORECASE):
            violations.append(pattern.replace("\\s+", " ").replace("\\s", " "))
    return len(violations) == 0, violations

@app.post("/classify")
async def classify_outreach(req: ClassifyRequest):
    if not _model or not _vectorizer:
        raise HTTPException(503, "Model not trained")
    text = f"{req.notes} {' '.join(req.recent_events)}"
    vec = _vectorizer.transform([text])
    probs = _model.predict_proba(vec)[0]
    pred_idx = int(np.argmax(probs))
    categories = {0: "escalation", 1: "nurture", 2: "re-engagement"}
    if req.health_score < 40 and pred_idx == 1:
        pred_idx = 0
    return {"category": categories[pred_idx], "confidence": round(float(probs[pred_idx]), 3)}

@app.post("/generate")
async def generate_outreach(req: GenerateRequest):
    category = "escalation" if req.churn_risk > 0.7 else "nurture" if req.churn_risk < 0.3 else "re-engagement"

    system_prompt = """You are a senior partnerships manager at BlostemIQ, an Indian fintech infrastructure company.
You write professional, empathetic re-engagement emails to at-risk B2B partners.

STRICT RULES:
- Never promise guaranteed returns or risk-free outcomes
- Never use pressure tactics or artificial urgency
- Always be respectful of the partner's autonomy
- Keep language SEBI/RBI compliant (no financial guarantees)
- Use a warm, consultative tone
- Each email should be 80-150 words

Return EXACTLY a JSON array of 3 email objects with keys: subject, body, cta
- Email 1: Day 1 — Initial check-in
- Email 2: Day 3 — Share helpful resources
- Email 3: Day 7 — Final gentle follow-up

Return ONLY valid JSON array. No markdown, no explanation, no code blocks."""

    user_prompt = f"""Generate a 3-email re-engagement sequence for:
Partner: {req.partner_name}
Segment: {req.segment}
Health Score: {req.health_score}/100
Churn Risk: {req.churn_risk * 100:.0f}%
Issue: {req.reason}
Category: {category}

Return ONLY a JSON array of 3 objects: [{{"subject":"...","body":"...","cta":"..."}}]"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "max_tokens": 2000,
                    "temperature": 0.7,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            raw = data["choices"][0]["message"]["content"]
            logger.info(f"Groq response: {raw[:200]}...")

            json_match = re.search(r'\[.*\]', raw, re.DOTALL)
            if json_match:
                emails_raw = json.loads(json_match.group())
            else:
                emails_raw = json.loads(raw)

            emails = []
            for email in emails_raw[:3]:
                full_text = f"{email.get('subject', '')} {email.get('body', '')} {email.get('cta', '')}"
                compliant, violations = check_compliance(full_text)
                emails.append({
                    "subject": email.get("subject", "Partnership check-in"),
                    "body": email.get("body", ""),
                    "cta": email.get("cta", "Schedule a call"),
                    "compliance": compliant,
                    "violations": violations,
                })

            return {
                "partner_name": req.partner_name,
                "category": category,
                "emails": emails,
                "model_used": GROQ_MODEL,
            }

    except Exception as e:
        logger.error(f"Groq error: {e}")
        return {
            "partner_name": req.partner_name,
            "category": category,
            "emails": [
                {"subject": f"Checking in — {req.partner_name}", "body": f"Hi Team,\n\nI noticed {req.reason.lower()}. I'd love to help — would you have 15 minutes this week for a quick sync?", "cta": "Schedule a sync", "compliance": True, "violations": []},
                {"subject": "New features you might find valuable", "body": "Hi Team,\n\nWe recently shipped improvements for your workflow. No pressure — just sharing in case it's helpful.", "cta": "Explore features", "compliance": True, "violations": []},
                {"subject": "We value your partnership", "body": f"Hi Team {req.partner_name},\n\nJust wanted you to know our support channels are always open. Whenever you're ready to re-engage, we're here.", "cta": "Share feedback", "compliance": True, "violations": []},
            ],
            "model_used": "fallback",
        }

@app.post("/briefing/generate")
async def generate_briefing(req: BriefingRequest):
    top = req.partners[:5]
    lines = "\n".join([f"- {p['name']}: health {p['health']}, churn risk {p['churn']}%. {p.get('reason','')}" for p in top])
    
    script = f"""Good morning. Here's your daily partner intelligence briefing from BlostemIQ.

You're monitoring {req.total_partners} partners with an average health score of {req.avg_health:.0f}. {req.at_risk_count} partners are flagged as at-risk.

{lines}

I recommend prioritizing {top[0]['name'] if top else 'your highest-risk partner'} for immediate outreach today.

Your weekly PDF digest will be ready by noon. Have a productive day."""

    logger.info(f"Briefing script: {len(script)} chars")

    audio_url = None
    duration = None

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}",
                headers={
                    "xi-api-key": ELEVENLABS_API_KEY,
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg",
                },
                json={
                    "text": script,
                    "model_id": "eleven_turbo_v2",
                    "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
                },
            )
            resp.raise_for_status()
            with open("/tmp/briefing.mp3", "wb") as f:
                f.write(resp.content)
            audio_url = "/briefing/audio"
            duration = len(resp.content) / 16000
            logger.info(f"ElevenLabs audio: {len(resp.content)} bytes")
    except Exception as e:
        logger.error(f"ElevenLabs error: {e}")

    return {"transcript": script, "audio_url": audio_url, "duration_seconds": duration}

@app.get("/briefing/audio")
async def get_audio():
    if not os.path.exists("/tmp/briefing.mp3"):
        raise HTTPException(404, "No audio")
    return FileResponse("/tmp/briefing.mp3", media_type="audio/mpeg")

@app.get("/health")
def health():
    return {"status": "ok", "version": "3.0.0", "llm": "groq/" + GROQ_MODEL, "tts": "elevenlabs"}
