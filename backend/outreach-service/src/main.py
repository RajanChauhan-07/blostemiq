from fastapi import FastAPI, HTTPException
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

app = FastAPI(title="Outreach Service", version="2.0.0")

# ─── Globals ──────────────────────────────────────────────
_model = None
_vectorizer = None

BYTEZ_API_KEY = os.getenv("BYTEZ_API_KEY", "4223562ed8284713d1316842ddc111bf")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "sk_ef4afa21a9456161cb3d79ad112b21ec2a3cc38c99da4b1f")
BYTEZ_MODEL = "Qwen/Qwen2.5-7B-Instruct"  # Fast, free, high quality open-source
ELEVENLABS_VOICE_ID = "pNInz6obpgDQGcFmaJgB"  # "Adam" voice

# ─── SEBI/RBI compliance banned phrases ──────────────────
BANNED_PHRASES = [
    r"guaranteed\s+returns", r"risk[\s-]*free", r"100%\s+safe",
    r"assured\s+profit", r"no\s+risk", r"double\s+your\s+money",
    r"get\s+rich", r"zero\s+loss", r"unlimited\s+returns",
    r"SEBI\s+approved", r"RBI\s+approved", r"government\s+backed",
]

# ─── Pydantic Models ─────────────────────────────────────
class ClassifyRequest(BaseModel):
    notes: str
    recent_events: list[str]
    health_score: float

class OutreachType(BaseModel):
    category: str
    confidence: float

class GenerateRequest(BaseModel):
    partner_name: str
    health_score: float
    churn_risk: float
    reason: str
    segment: Optional[str] = "Fintech"

class EmailItem(BaseModel):
    subject: str
    body: str
    cta: str
    compliance: bool
    violations: list[str]

class GenerateResponse(BaseModel):
    partner_name: str
    category: str
    emails: list[EmailItem]
    model_used: str

class BriefingRequest(BaseModel):
    partners: list[dict]  # [{name, health, churn, reason}]
    total_partners: int
    avg_health: float
    at_risk_count: int

class BriefingResponse(BaseModel):
    transcript: str
    audio_url: Optional[str] = None
    duration_seconds: Optional[float] = None

# ─── Classifier Training ─────────────────────────────────
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
    logger.info("Training Outreach Classifier...")
    X_str, y = generate_training_data()
    _vectorizer = TfidfVectorizer()
    X = _vectorizer.fit_transform(X_str)
    _model = RandomForestClassifier(n_estimators=50, random_state=42)
    _model.fit(X, y)
    logger.info("Outreach Classifier trained!")

# ─── Compliance Checker ──────────────────────────────────
def check_compliance(text: str) -> tuple[bool, list[str]]:
    violations = []
    for pattern in BANNED_PHRASES:
        if re.search(pattern, text, re.IGNORECASE):
            violations.append(re.sub(r'\\s[\+\*]', ' ', pattern))
    return len(violations) == 0, violations

# ─── Classify Endpoint (existing) ────────────────────────
@app.post("/classify", response_model=OutreachType)
async def classify_outreach(req: ClassifyRequest):
    if not _model or not _vectorizer:
        raise HTTPException(503, "Model not trained")
    text = f"{req.notes} {' '.join(req.recent_events)}"
    vec = _vectorizer.transform([text])
    probs = _model.predict_proba(vec)[0]
    pred_idx = np.argmax(probs)
    categories = {0: "escalation", 1: "nurture", 2: "re-engagement"}
    if req.health_score < 40 and pred_idx == 1:
        pred_idx = 0
    return OutreachType(category=categories[pred_idx], confidence=round(float(probs[pred_idx]), 3))

# ─── Generate Outreach (REAL LLM) ────────────────────────
@app.post("/generate", response_model=GenerateResponse)
async def generate_outreach(req: GenerateRequest):
    """Generate a real 3-email outreach sequence using Bytez LLM API"""
    
    # 1. Classify the outreach type
    category = "escalation" if req.churn_risk > 0.7 else "nurture" if req.churn_risk < 0.3 else "re-engagement"
    
    # 2. Build the LLM prompt
    system_prompt = """You are a senior partnerships manager at BlostemIQ, an Indian fintech infrastructure company. 
You write professional, empathetic re-engagement emails to at-risk B2B partners.

STRICT RULES:
- Never promise guaranteed returns or risk-free outcomes
- Never use pressure tactics or artificial urgency
- Always be respectful of the partner's autonomy
- Keep language SEBI/RBI compliant (no financial guarantees)
- Use a warm, consultative tone
- Each email should be 80-150 words

You must return EXACTLY a JSON array of 3 email objects with keys: subject, body, cta
- Email 1: Day 1 — Initial check-in, show you noticed the issue
- Email 2: Day 3 — Share helpful resources or new features
- Email 3: Day 7 — Final gentle follow-up, leave door open

Return ONLY valid JSON. No markdown, no explanation."""

    user_prompt = f"""Generate a 3-email re-engagement sequence for:

Partner: {req.partner_name}
Segment: {req.segment}
Health Score: {req.health_score}/100
Churn Risk: {req.churn_risk * 100:.0f}%
Issue: {req.reason}
Category: {category}

Return ONLY a JSON array of 3 objects with keys: subject, body, cta"""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.bytez.com/models/v2/chat/completions",
                headers={
                    "Authorization": BYTEZ_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "model": BYTEZ_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "max_tokens": 2000,
                    "temperature": 0.7,
                },
            )
            response.raise_for_status()
            data = response.json()
            
            # Extract the generated text
            raw_text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            logger.info(f"LLM raw response length: {len(raw_text)}")
            
            # Parse JSON from LLM response
            # Try to find JSON array in the response
            json_match = re.search(r'\[.*\]', raw_text, re.DOTALL)
            if json_match:
                emails_raw = json.loads(json_match.group())
            else:
                # Try parsing the whole thing
                emails_raw = json.loads(raw_text)
            
            # Build response with compliance checking
            emails = []
            for email in emails_raw[:3]:
                full_text = f"{email.get('subject', '')} {email.get('body', '')} {email.get('cta', '')}"
                compliant, violations = check_compliance(full_text)
                emails.append(EmailItem(
                    subject=email.get("subject", "Partnership check-in"),
                    body=email.get("body", ""),
                    cta=email.get("cta", "Schedule a call →"),
                    compliance=compliant,
                    violations=violations,
                ))
            
            return GenerateResponse(
                partner_name=req.partner_name,
                category=category,
                emails=emails,
                model_used=BYTEZ_MODEL,
            )
    
    except httpx.HTTPStatusError as e:
        logger.error(f"Bytez API error: {e.response.status_code} - {e.response.text}")
        raise HTTPException(502, f"LLM API error: {e.response.status_code}")
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM JSON: {e}")
        # Return fallback emails if JSON parsing fails
        return GenerateResponse(
            partner_name=req.partner_name,
            category=category,
            emails=[
                EmailItem(subject=f"Checking in — we noticed some changes, {req.partner_name}", body=f"Hi Team {req.partner_name},\n\nI wanted to personally reach out because we noticed {req.reason.lower()}. We understand that priorities shift, and I'd love to understand if there's anything on our end that could be improved.\n\nWould you have 15 minutes this week for a quick sync?", cta="Schedule a 15-min sync →", compliance=True, violations=[]),
                EmailItem(subject="Quick follow-up: New features that might help", body=f"Hi Team,\n\nFollowing up on my previous note. We've recently shipped several improvements that could be valuable for your {req.segment} workflows. I'd love to walk you through them.\n\nNo pressure at all — just wanted to make sure you're aware.", cta="Explore new features →", compliance=True, violations=[]),
                EmailItem(subject="We value your partnership", body=f"Hi Team {req.partner_name},\n\nThis is my final follow-up. I completely understand if the timing isn't right. Our support channels are always open, and we welcome any feedback on how we can improve.\n\nWhenever you're ready to re-engage, we'll be here.", cta="Share feedback →", compliance=True, violations=[]),
            ],
            model_used="fallback",
        )
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(500, f"Generation failed: {str(e)}")

# ─── Voice Briefing (REAL ElevenLabs TTS) ─────────────────
@app.post("/briefing/generate", response_model=BriefingResponse)
async def generate_briefing(req: BriefingRequest):
    """Generate a real voice briefing using ElevenLabs TTS"""
    
    # 1. Build the briefing script
    top_alerts = req.partners[:5]
    alert_lines = []
    for p in top_alerts:
        alert_lines.append(f"{p['name']} has a health score of {p['health']} with {p['churn']}% churn risk. {p.get('reason', '')}")
    
    script = f"""Good morning. Here's your daily partner intelligence briefing from BlostemIQ.

You're monitoring {req.total_partners} partners with an average health score of {req.avg_health:.0f}. {req.at_risk_count} partners are flagged as at-risk.

{"".join(f"  {line}  " for line in alert_lines)}

I recommend prioritizing {top_alerts[0]['name'] if top_alerts else 'your highest-risk partner'} for immediate outreach today.

Your weekly PDF digest will be ready by noon. Have a productive day."""

    logger.info(f"Briefing script length: {len(script)} chars")

    # 2. Call ElevenLabs TTS API
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}",
                headers={
                    "xi-api-key": ELEVENLABS_API_KEY,
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg",
                },
                json={
                    "text": script,
                    "model_id": "eleven_turbo_v2",
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                        "style": 0.0,
                        "use_speaker_boost": True,
                    },
                },
            )
            response.raise_for_status()
            
            # Save audio to local file (in production, push to S3)
            audio_path = "/tmp/briefing_latest.mp3"
            with open(audio_path, "wb") as f:
                f.write(response.content)
            
            audio_size = len(response.content)
            duration_estimate = audio_size / 16000  # rough estimate: ~16KB/sec for MP3
            
            logger.info(f"ElevenLabs audio generated: {audio_size} bytes, ~{duration_estimate:.0f}s")
            
            return BriefingResponse(
                transcript=script,
                audio_url="/briefing/audio",
                duration_seconds=round(duration_estimate, 1),
            )
    
    except httpx.HTTPStatusError as e:
        logger.error(f"ElevenLabs API error: {e.response.status_code} - {e.response.text}")
        # Return transcript without audio
        return BriefingResponse(
            transcript=script,
            audio_url=None,
            duration_seconds=None,
        )
    except Exception as e:
        logger.error(f"ElevenLabs error: {e}")
        return BriefingResponse(
            transcript=script,
            audio_url=None,
            duration_seconds=None,
        )

# ─── Serve Audio File ─────────────────────────────────────
from fastapi.responses import FileResponse

@app.get("/briefing/audio")
async def get_briefing_audio():
    """Serve the latest generated briefing audio"""
    audio_path = "/tmp/briefing_latest.mp3"
    if not os.path.exists(audio_path):
        raise HTTPException(404, "No briefing audio available. Generate one first.")
    return FileResponse(audio_path, media_type="audio/mpeg", filename="briefing.mp3")

@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0", "llm": BYTEZ_MODEL, "tts": "elevenlabs"}
