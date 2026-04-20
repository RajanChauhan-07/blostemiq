import base64
from datetime import datetime
import hashlib
import hmac
import json
import logging
from email.message import EmailMessage
from email.utils import make_msgid
import os
import re
import smtplib
import time
from typing import Any, Optional

import asyncpg
import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Outreach Service", version="4.0.0")

DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET = os.getenv("JWT_SECRET")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
GROQ_MODEL = "llama-3.1-8b-instant"
ELEVENLABS_VOICE_ID = "pNInz6obpgDQGcFmaJgB"

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() != "false"
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "BlostemIQ")

_pool: Optional[asyncpg.Pool] = None

DEFAULT_PLAN_LIMITS: dict[str, dict[str, Optional[int]]] = {
    "basic": {"outreach_monthly": 200},
    "growth": {"outreach_monthly": 3000},
    "enterprise": {"outreach_monthly": 25000},
}

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


class SequenceEmailInput(BaseModel):
    subject: str
    body: str
    cta: str
    compliance: bool = True
    violations: list[str] = Field(default_factory=list)


class SaveSequenceRequest(BaseModel):
    partner_id: Optional[str] = None
    partner_name: str
    recipient_email: str
    name: Optional[str] = None
    emails: list[SequenceEmailInput]


class SenderSettingsRequest(BaseModel):
    sender_name: str
    sender_email: str
    reply_to: Optional[str] = None


class SequenceSendRequest(BaseModel):
    sender_name: Optional[str] = None
    sender_email: Optional[str] = None
    reply_to: Optional[str] = None


class WebhookEventRequest(BaseModel):
    message_id: Optional[str] = None
    provider_message_id: Optional[str] = None
    event_type: str
    recipient_email: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)


def check_compliance(text: str) -> tuple[bool, list[str]]:
    violations = []
    for pattern in BANNED_PHRASES:
        if re.search(pattern, text, re.IGNORECASE):
            violations.append(pattern.replace("\\s+", " ").replace("\\s", " "))
    return len(violations) == 0, violations


def classify_category(notes: str, recent_events: list[str], health_score: float) -> tuple[str, float]:
    haystack = f"{notes} {' '.join(recent_events)}".lower()

    escalation_terms = ["critical", "urgent", "downtime", "broken", "error", "failure", "halt"]
    reengagement_terms = ["no activity", "inactive", "declining", "churn", "no login", "ghosted", "abandoned"]
    nurture_terms = ["expanding", "roadmap", "adoption", "upsell", "demo", "planning", "active"]

    escalation_hits = sum(term in haystack for term in escalation_terms)
    reengagement_hits = sum(term in haystack for term in reengagement_terms)
    nurture_hits = sum(term in haystack for term in nurture_terms)

    if health_score < 40 or escalation_hits >= 2:
        return "escalation", round(min(0.99, 0.65 + escalation_hits * 0.1), 3)
    if reengagement_hits >= nurture_hits:
        return "re-engagement", round(min(0.95, 0.55 + reengagement_hits * 0.08), 3)
    return "nurture", round(min(0.9, 0.55 + nurture_hits * 0.06), 3)


async def get_db():
    global _pool
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL environment variable is required")
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5)
    return _pool


def _base64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _verify_access_token(token: str) -> dict[str, Any]:
    if not JWT_SECRET:
        raise HTTPException(status_code=500, detail="JWT_SECRET environment variable is required")

    try:
        encoded_header, encoded_payload, encoded_signature = token.split(".")
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid access token") from exc

    try:
        header = json.loads(_base64url_decode(encoded_header))
        payload = json.loads(_base64url_decode(encoded_payload))
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=401, detail="Invalid access token") from exc

    if header.get("alg") != "HS256":
        raise HTTPException(status_code=401, detail="Invalid access token")

    expected_signature = hmac.new(
        JWT_SECRET.encode("utf-8"),
        f"{encoded_header}.{encoded_payload}".encode("utf-8"),
        hashlib.sha256,
    ).digest()

    try:
        actual_signature = _base64url_decode(encoded_signature)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid access token") from exc

    if not hmac.compare_digest(expected_signature, actual_signature):
        raise HTTPException(status_code=401, detail="Invalid access token")

    if payload.get("type") != "access" or payload.get("iss") != "blostemiq-auth":
        raise HTTPException(status_code=401, detail="Invalid access token")

    if not payload.get("sub") or not payload.get("orgId") or not payload.get("role"):
        raise HTTPException(status_code=401, detail="Invalid access token")

    if payload.get("exp") and int(payload["exp"]) <= int(time.time()):
        raise HTTPException(status_code=401, detail="Access token expired")

    return payload


async def get_auth_context(
    authorization: Optional[str] = Header(None),
    x_org_id: Optional[str] = Header(None),
) -> dict[str, str]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    payload = _verify_access_token(authorization.removeprefix("Bearer ").strip())
    org_id = str(payload["orgId"])
    if x_org_id and x_org_id != org_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return {
        "org_id": org_id,
        "user_id": str(payload["sub"]),
        "role": str(payload["role"]),
    }


@app.on_event("startup")
async def startup():
    return None


async def record_audit_log(org_id: str, user_id: str, action: str, resource: str, resource_id: Optional[str], metadata: dict[str, Any]):
    pool = await get_db()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO audit_logs (
                id, org_id, user_id, action, resource, resource_id, metadata, created_at
            ) VALUES (
                gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5::uuid, $6::jsonb, NOW()
            )
            """,
            org_id,
            user_id,
            action,
            resource,
            resource_id,
            json.dumps(metadata),
        )


async def get_org_settings(org_id: str) -> dict[str, Any]:
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT settings FROM organizations WHERE id = $1", org_id)
    settings = row["settings"] if row else {}
    return dict(settings) if settings else {}


async def update_org_settings(org_id: str, settings: dict[str, Any]):
    pool = await get_db()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE organizations SET settings = $2::jsonb, updated_at = NOW() WHERE id = $1",
            org_id,
            json.dumps(settings),
        )


async def get_org_plan(org_id: str) -> str:
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT plan FROM organizations WHERE id = $1::uuid", org_id)
    plan = str(row["plan"]) if row and row["plan"] else "basic"
    return plan if plan in DEFAULT_PLAN_LIMITS else "basic"


async def get_numeric_entitlement(org_id: str, feature_key: str) -> Optional[int]:
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT is_enabled, quota_limit
            FROM feature_entitlements
            WHERE org_id = $1::uuid AND feature_key = $2
            LIMIT 1
            """,
            org_id,
            feature_key,
        )

    if row:
        if not row["is_enabled"]:
            return 0
        return int(row["quota_limit"]) if row["quota_limit"] is not None else None

    plan = await get_org_plan(org_id)
    return DEFAULT_PLAN_LIMITS.get(plan, DEFAULT_PLAN_LIMITS["basic"]).get(feature_key)


async def enforce_outreach_monthly_limit(org_id: str, messages_to_send: int):
    if messages_to_send <= 0:
        return

    limit = await get_numeric_entitlement(org_id, "outreach_monthly")
    if limit is None:
        return
    if limit <= 0:
        raise HTTPException(status_code=403, detail="Outreach is not included in your current plan")

    pool = await get_db()
    async with pool.acquire() as conn:
        current_count = await conn.fetchval(
            """
            SELECT COUNT(*)
            FROM outreach_messages
            WHERE org_id = $1::uuid
              AND sent_at IS NOT NULL
              AND sent_at >= date_trunc('month', NOW())
            """,
            org_id,
        )

    if int(current_count or 0) + messages_to_send > limit:
        raise HTTPException(
            status_code=409,
            detail=f"Monthly outreach limit reached for this plan ({limit})",
        )


def get_sender_settings(settings: dict[str, Any]) -> dict[str, Optional[str]]:
    outreach_settings = dict(settings.get("outreach", {}))
    return {
        "sender_name": outreach_settings.get("sender_name") or SMTP_FROM_NAME,
        "sender_email": outreach_settings.get("sender_email") or SMTP_FROM_EMAIL or None,
        "reply_to": outreach_settings.get("reply_to") or None,
    }


def get_unsubscribes(settings: dict[str, Any]) -> list[str]:
    outreach_settings = dict(settings.get("outreach", {}))
    return [str(email).lower() for email in outreach_settings.get("unsubscribes", [])]


def send_email_via_smtp(*, recipient_email: str, subject: str, body: str, sender_name: str, sender_email: str, reply_to: Optional[str]) -> str:
    if not SMTP_HOST or not sender_email:
        raise HTTPException(status_code=503, detail="SMTP delivery is not configured")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{sender_name} <{sender_email}>"
    message["To"] = recipient_email
    if reply_to:
        message["Reply-To"] = reply_to

    provider_message_id = make_msgid(domain=sender_email.split("@")[-1])
    message["Message-ID"] = provider_message_id
    message.set_content(body)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
        if SMTP_USE_TLS:
            server.starttls()
        if SMTP_USERNAME and SMTP_PASSWORD:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(message)

    return provider_message_id


@app.post("/classify")
async def classify_outreach(req: ClassifyRequest, _auth: dict[str, str] = Depends(get_auth_context)):
    category, confidence = classify_category(req.notes, req.recent_events, req.health_score)
    return {"category": category, "confidence": confidence}


@app.post("/generate")
async def generate_outreach(req: GenerateRequest, _auth: dict[str, str] = Depends(get_auth_context)):
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

    if not GROQ_API_KEY:
        raise HTTPException(503, "GROQ_API_KEY is required for outreach generation")

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
    except Exception as exc:
        logger.error("Groq error: %s", exc)
        raise HTTPException(502, "Groq outreach generation failed")


@app.get("/settings/sender")
async def get_sender(auth: dict[str, str] = Depends(get_auth_context)):
    settings = await get_org_settings(auth["org_id"])
    sender_settings = get_sender_settings(settings)
    return {
        "sender_name": sender_settings["sender_name"],
        "sender_email": sender_settings["sender_email"],
        "reply_to": sender_settings["reply_to"],
        "unsubscribes": get_unsubscribes(settings),
    }


@app.put("/settings/sender")
async def put_sender(req: SenderSettingsRequest, auth: dict[str, str] = Depends(get_auth_context)):
    settings = await get_org_settings(auth["org_id"])
    outreach_settings = dict(settings.get("outreach", {}))
    outreach_settings.update({
        "sender_name": req.sender_name,
        "sender_email": req.sender_email,
        "reply_to": req.reply_to,
    })
    settings["outreach"] = outreach_settings
    await update_org_settings(auth["org_id"], settings)
    await record_audit_log(auth["org_id"], auth["user_id"], "OUTREACH_SENDER_UPDATED", "outreach", None, {
        "sender_name": req.sender_name,
        "sender_email": req.sender_email,
    })
    return {"ok": True}


@app.get("/sequences")
async def list_sequences(auth: dict[str, str] = Depends(get_auth_context)):
    pool = await get_db()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                os.id,
                os.partner_id,
                os.name,
                os.status,
                os.channel,
                os.created_at,
                os.updated_at,
                os.config,
                COUNT(om.id) AS message_count,
                COUNT(*) FILTER (WHERE om.status = 'sent') AS sent_count
            FROM outreach_sequences os
            LEFT JOIN outreach_messages om ON om.sequence_id = os.id
            WHERE os.org_id = $1::uuid
            GROUP BY os.id
            ORDER BY os.created_at DESC
            LIMIT 50
            """,
            auth["org_id"],
        )
    return {
        "sequences": [
            {
                "id": str(row["id"]),
                "partner_id": str(row["partner_id"]) if row["partner_id"] else None,
                "name": row["name"],
                "status": row["status"],
                "channel": row["channel"],
                "created_at": row["created_at"].isoformat(),
                "updated_at": row["updated_at"].isoformat(),
                "config": dict(row["config"]) if row["config"] else {},
                "message_count": int(row["message_count"] or 0),
                "sent_count": int(row["sent_count"] or 0),
            }
            for row in rows
        ]
    }


@app.post("/sequences")
async def create_sequence(req: SaveSequenceRequest, auth: dict[str, str] = Depends(get_auth_context)):
    if not req.emails:
        raise HTTPException(status_code=400, detail="At least one email is required")

    pool = await get_db()
    async with pool.acquire() as conn:
        async with conn.transaction():
            sequence_row = await conn.fetchrow(
                """
                INSERT INTO outreach_sequences (
                    id, org_id, partner_id, created_by, name, status, channel, config, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4, 'draft', 'email', $5::jsonb, NOW(), NOW()
                )
                RETURNING id
                """,
                auth["org_id"],
                req.partner_id,
                auth["user_id"],
                req.name or f"{req.partner_name} Re-engagement",
                json.dumps({
                    "partner_name": req.partner_name,
                    "recipient_email": req.recipient_email,
                }),
            )
            sequence_id = str(sequence_row["id"])

            for email in req.emails:
                await conn.execute(
                    """
                    INSERT INTO outreach_messages (
                        id, sequence_id, org_id, partner_id, subject, body, status, created_at
                    ) VALUES (
                        gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4, $5, 'draft', NOW()
                    )
                    """,
                    sequence_id,
                    auth["org_id"],
                    req.partner_id,
                    email.subject,
                    email.body,
                )

    await record_audit_log(auth["org_id"], auth["user_id"], "OUTREACH_SEQUENCE_CREATED", "outreach_sequence", sequence_id, {
        "recipient_email": req.recipient_email,
        "message_count": len(req.emails),
    })
    return {"sequence_id": sequence_id}


@app.post("/sequences/{sequence_id}/send")
async def send_sequence(sequence_id: str, req: SequenceSendRequest, auth: dict[str, str] = Depends(get_auth_context)):
    pool = await get_db()
    async with pool.acquire() as conn:
        sequence = await conn.fetchrow(
            """
            SELECT id, name, config
            FROM outreach_sequences
            WHERE id = $1::uuid AND org_id = $2::uuid
            """,
            sequence_id,
            auth["org_id"],
        )
        if not sequence:
            raise HTTPException(status_code=404, detail="Sequence not found")

        messages = await conn.fetch(
            """
            SELECT id, subject, body, status
            FROM outreach_messages
            WHERE sequence_id = $1::uuid
            ORDER BY created_at ASC
            """,
            sequence_id,
        )

    settings = await get_org_settings(auth["org_id"])
    sender = get_sender_settings(settings)
    sender_name = req.sender_name or sender["sender_name"] or SMTP_FROM_NAME
    sender_email = req.sender_email or sender["sender_email"]
    reply_to = req.reply_to or sender["reply_to"]
    if not sender_email:
        raise HTTPException(status_code=400, detail="Sender email is not configured")

    config = dict(sequence["config"]) if sequence["config"] else {}
    recipient_email = str(config.get("recipient_email", "")).strip()
    if not recipient_email:
        raise HTTPException(status_code=400, detail="Sequence recipient email is missing")

    if recipient_email.lower() in get_unsubscribes(settings):
        raise HTTPException(status_code=409, detail="Recipient has unsubscribed")

    pending_messages = sum(1 for message in messages if message["status"] != "sent")
    await enforce_outreach_monthly_limit(auth["org_id"], pending_messages)

    sent = 0
    failed: list[dict[str, str]] = []
    pool = await get_db()
    async with pool.acquire() as conn:
        for message in messages:
            if message["status"] == "sent":
                continue
            try:
                provider_message_id = send_email_via_smtp(
                    recipient_email=recipient_email,
                    subject=message["subject"],
                    body=message["body"],
                    sender_name=sender_name,
                    sender_email=sender_email,
                    reply_to=reply_to,
                )
                await conn.execute(
                    """
                    UPDATE outreach_messages
                    SET status = 'sent', provider_message_id = $2, sent_at = NOW()
                    WHERE id = $1::uuid
                    """,
                    str(message["id"]),
                    provider_message_id,
                )
                await conn.execute(
                    """
                    INSERT INTO outreach_delivery_events (
                        id, message_id, org_id, provider_event_id, event_type, payload, created_at
                    ) VALUES (
                        gen_random_uuid(), $1::uuid, $2::uuid, $3, 'accepted', $4::jsonb, NOW()
                    )
                    """,
                    str(message["id"]),
                    auth["org_id"],
                    provider_message_id,
                    json.dumps({"recipient_email": recipient_email}),
                )
                sent += 1
            except Exception as exc:
                await conn.execute(
                    """
                    UPDATE outreach_messages
                    SET status = 'failed'
                    WHERE id = $1::uuid
                    """,
                    str(message["id"]),
                )
                await conn.execute(
                    """
                    INSERT INTO outreach_delivery_events (
                        id, message_id, org_id, provider_event_id, event_type, payload, created_at
                    ) VALUES (
                        gen_random_uuid(), $1::uuid, $2::uuid, NULL, 'failed', $3::jsonb, NOW()
                    )
                    """,
                    str(message["id"]),
                    auth["org_id"],
                    json.dumps({"error": str(exc), "recipient_email": recipient_email}),
                )
                failed.append({"message_id": str(message["id"]), "error": str(exc)})

        await conn.execute(
            """
            UPDATE outreach_sequences
            SET status = CASE WHEN $2::int > 0 THEN 'sent' ELSE status END, updated_at = NOW()
            WHERE id = $1::uuid
            """,
            sequence_id,
            sent,
        )

    await record_audit_log(auth["org_id"], auth["user_id"], "OUTREACH_SEQUENCE_SENT", "outreach_sequence", sequence_id, {
        "recipient_email": recipient_email,
        "sent_count": sent,
        "failed_count": len(failed),
    })
    return {"sequence_id": sequence_id, "sent": sent, "failed": failed}


@app.post("/webhooks/provider")
async def receive_provider_event(req: WebhookEventRequest):
    pool = await get_db()
    async with pool.acquire() as conn:
        message_row = None
        if req.message_id:
            message_row = await conn.fetchrow(
                """
                SELECT id, org_id, sequence_id
                FROM outreach_messages
                WHERE id = $1::uuid
                """,
                req.message_id,
            )
        elif req.provider_message_id:
            message_row = await conn.fetchrow(
                """
                SELECT id, org_id, sequence_id
                FROM outreach_messages
                WHERE provider_message_id = $1
                """,
                req.provider_message_id,
            )

        if not message_row:
            raise HTTPException(status_code=404, detail="Message not found")

        await conn.execute(
            """
            INSERT INTO outreach_delivery_events (
                id, message_id, org_id, provider_event_id, event_type, payload, created_at
            ) VALUES (
                gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5::jsonb, NOW()
            )
            """,
            str(message_row["id"]),
            str(message_row["org_id"]),
            req.provider_message_id,
            req.event_type,
            json.dumps(req.payload),
        )

        if req.event_type in {"delivered", "opened", "clicked", "bounced", "complained", "unsubscribed"}:
            await conn.execute(
                """
                UPDATE outreach_messages
                SET status = $2
                WHERE id = $1::uuid
                """,
                str(message_row["id"]),
                req.event_type,
            )

    if req.event_type == "unsubscribed" and req.recipient_email:
        settings = await get_org_settings(str(message_row["org_id"]))
        outreach_settings = dict(settings.get("outreach", {}))
        unsubscribes = set(get_unsubscribes(settings))
        unsubscribes.add(req.recipient_email.lower())
        outreach_settings["unsubscribes"] = sorted(unsubscribes)
        settings["outreach"] = outreach_settings
        await update_org_settings(str(message_row["org_id"]), settings)

    return {"ok": True}


@app.post("/briefing/generate")
async def generate_briefing(req: BriefingRequest, _auth: dict[str, str] = Depends(get_auth_context)):
    top = req.partners[:5]
    lines = "\n".join([f"- {p['name']}: health {p['health']}, churn risk {p['churn']}%. {p.get('reason','')}" for p in top])

    script = f"""Good morning. Here's your daily partner intelligence briefing from BlostemIQ.

You're monitoring {req.total_partners} partners with an average health score of {req.avg_health:.0f}. {req.at_risk_count} partners are flagged as at-risk.

{lines}

I recommend prioritizing {top[0]['name'] if top else 'your highest-risk partner'} for immediate outreach today.

Your weekly PDF digest will be ready by noon. Have a productive day."""

    audio_url = None
    duration = None

    if not ELEVENLABS_API_KEY:
        return {"transcript": script, "audio_url": None, "duration_seconds": None}

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
            with open("/tmp/briefing.mp3", "wb") as file_handle:
                file_handle.write(resp.content)
            audio_url = "/briefing/audio"
            duration = len(resp.content) / 16000
    except Exception as exc:
        logger.error("ElevenLabs error: %s", exc)

    return {"transcript": script, "audio_url": audio_url, "duration_seconds": duration}


@app.get("/briefing/audio")
async def get_audio():
    if not os.path.exists("/tmp/briefing.mp3"):
        raise HTTPException(404, "No audio")
    return FileResponse("/tmp/briefing.mp3", media_type="audio/mpeg")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "4.0.0",
        "database_configured": bool(DATABASE_URL),
        "jwt_configured": bool(JWT_SECRET),
        "groq_configured": bool(GROQ_API_KEY),
        "elevenlabs_configured": bool(ELEVENLABS_API_KEY),
        "smtp_configured": bool(SMTP_HOST and (SMTP_FROM_EMAIL or os.getenv("SMTP_FROM_EMAIL"))),
    }
