"""
Analytics Service — v2 (Real PostgreSQL backend)
Reads from the partner-service Postgres DB for all analytics.
"""
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
import asyncpg
import os
import logging
from typing import Optional
import json
import base64
import hashlib
import hmac
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Analytics Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET = os.getenv("JWT_SECRET")
_pool: asyncpg.Pool = None

async def get_db():
    global _pool
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL environment variable is required")
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    return _pool

@app.on_event("startup")
async def startup():
    try:
        pool = await get_db()
        async with pool.acquire() as conn:
            required_tables = {"partners", "partner_metrics", "partner_events"}
            rows = await conn.fetch(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = ANY($1::text[])
                """,
                list(required_tables),
            )
            existing_tables = {row["table_name"] for row in rows}
            missing_tables = sorted(required_tables - existing_tables)
            if missing_tables:
                raise RuntimeError(
                    "Missing required tables for analytics-service startup: "
                    + ", ".join(missing_tables)
                )
        logger.info("Analytics DB ready")
    except Exception as e:
        logger.error(f"DB startup error: {e}")

def _base64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _verify_access_token(token: str) -> dict:
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


async def get_org_id(
    authorization: Optional[str] = Header(None),
    x_org_id: Optional[str] = Header(None),
) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    payload = _verify_access_token(authorization.removeprefix("Bearer ").strip())
    org_id = str(payload["orgId"])

    if x_org_id and x_org_id != org_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    return org_id

@app.get("/health")
async def health():
    return {"status": "ok", "service": "analytics-service", "version": "2.0.0"}

@app.get("/kpis")
async def get_kpis(org_id: str = Depends(get_org_id)):
    pool = await get_db()
    async with pool.acquire() as conn:
        # Partner counts
        stats = await conn.fetchrow("""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE deleted_at IS NULL) as active,
                AVG(CASE WHEN pm.health_score IS NOT NULL THEN pm.health_score ELSE 70 END) as avg_health
            FROM partners p
            LEFT JOIN LATERAL (
                SELECT health_score FROM partner_metrics
                WHERE partner_id = p.id ORDER BY recorded_at DESC LIMIT 1
            ) pm ON true
            WHERE p.org_id = $1 AND p.deleted_at IS NULL
        """, org_id)

        at_risk = await conn.fetchval("""
            SELECT COUNT(DISTINCT p.id)
            FROM partners p
            LEFT JOIN LATERAL (
                SELECT health_score, churn_risk FROM partner_metrics
                WHERE partner_id = p.id ORDER BY recorded_at DESC LIMIT 1
            ) pm ON true
            WHERE p.org_id = $1 AND p.deleted_at IS NULL
            AND (pm.health_score < 50 OR pm.churn_risk > 0.6)
        """, org_id)

        total_api_calls = await conn.fetchval("""
            SELECT COALESCE(SUM(api_calls), 0)
            FROM partner_metrics pm
            JOIN partners p ON p.id = pm.partner_id
            WHERE p.org_id = $1
            AND pm.recorded_at >= NOW() - INTERVAL '24 hours'
        """, org_id)

        avg_nps = await conn.fetchval("""
            SELECT COALESCE(AVG(pm.nps), 70)
            FROM partner_metrics pm
            JOIN partners p ON p.id = pm.partner_id
            WHERE p.org_id = $1
        """, org_id)

        alerts = await conn.fetchval("""
            SELECT COUNT(*) FROM partner_events
            WHERE org_id = $1
            AND event_type IN ('HEALTH_DROP', 'CHURN_RISK', 'API_DROP', 'INACTIVITY')
            AND created_at >= NOW() - INTERVAL '24 hours'
        """, org_id)

    total = stats['total'] or 0
    avg_health = round(float(stats['avg_health'] or 70.0), 1)

    return {
        "active_partners":   int(total),
        "at_risk":           int(at_risk or 0),
        "avg_health_score":  avg_health,
        "api_calls_today":   int(total_api_calls or 0),
        "alerts_today":      int(alerts or 0),
        "nps":               round(float(avg_nps or 70), 0),
    }

@app.get("/partners")
async def get_partners_analytics(org_id: str = Depends(get_org_id)):
    pool = await get_db()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT
                p.id, p.name, p.domain, p.tier, p.contact_email, p.contact_name,
                p.tags, p.created_at,
                COALESCE(pm.health_score, 70) as health_score,
                COALESCE(pm.mrr, 0) as mrr,
                COALESCE(pm.api_calls, 0) as api_calls,
                COALESCE(pm.churn_risk, 0.1) as churn_risk,
                COALESCE(pm.nps, 70) as nps,
                pm.recorded_at
            FROM partners p
            LEFT JOIN LATERAL (
                SELECT health_score, mrr, api_calls, churn_risk, nps, recorded_at
                FROM partner_metrics
                WHERE partner_id = p.id
                ORDER BY recorded_at DESC LIMIT 1
            ) pm ON true
            WHERE p.org_id = $1 AND p.deleted_at IS NULL
            ORDER BY pm.health_score ASC NULLS LAST
        """, org_id)

    partners = []
    for r in rows:
        tags = json.loads(r['tags']) if r['tags'] else []
        health = float(r['health_score'])
        churn = float(r['churn_risk'])
        status = "active"
        if health < 40 or churn > 0.7:
            status = "at_risk"
        elif health < 65:
            status = "declining"

        partners.append({
            "id":            str(r['id']),
            "name":          r['name'],
            "domain":        r['domain'],
            "tier":          r['tier'],
            "contact_email": r['contact_email'],
            "contact_name":  r['contact_name'],
            "tags":          tags,
            "health_score":  round(health, 1),
            "mrr":           float(r['mrr']),
            "api_calls":     int(r['api_calls']),
            "churn_risk":    round(churn, 3),
            "churn_pct":     round(churn * 100, 1),
            "nps":           int(r['nps']),
            "status":        status,
            "last_seen":     r['recorded_at'].isoformat() if r['recorded_at'] else None,
            "created_at":    r['created_at'].isoformat(),
        })

    return {"partners": partners, "total": len(partners)}

@app.get("/cohorts")
async def get_cohorts(org_id: str = Depends(get_org_id)):
    pool = await get_db()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            WITH cohort_partners AS (
                SELECT
                    p.id,
                    p.created_at,
                    TO_CHAR(DATE_TRUNC('month', p.created_at), 'YYYY-MM') AS cohort_month
                FROM partners p
                WHERE p.org_id = $1 AND p.deleted_at IS NULL
            ),
            cohort_totals AS (
                SELECT cohort_month, COUNT(*) AS total
                FROM cohort_partners
                GROUP BY cohort_month
            ),
            weekly_activity AS (
                SELECT
                    cp.cohort_month,
                    FLOOR(EXTRACT(EPOCH FROM (DATE_TRUNC('week', pe.created_at) - DATE_TRUNC('week', cp.created_at))) / 604800)::int AS cohort_week,
                    COUNT(DISTINCT cp.id) AS active_count
                FROM cohort_partners cp
                JOIN partner_events pe ON pe.partner_id = cp.id
                WHERE pe.created_at >= cp.created_at
                  AND pe.created_at < cp.created_at + INTERVAL '12 weeks'
                GROUP BY cp.cohort_month, cohort_week
            )
            SELECT
                ct.cohort_month,
                ct.total,
                wa.cohort_week,
                COALESCE(wa.active_count, 0) AS active_count
            FROM cohort_totals ct
            LEFT JOIN weekly_activity wa ON wa.cohort_month = ct.cohort_month
            ORDER BY ct.cohort_month, wa.cohort_week
        """, org_id)

    cohorts = {}
    for r in rows:
        month = r['cohort_month']
        total = int(r['total'] or 0)

        if month not in cohorts:
            cohorts[month] = {
                "total": total,
                "retention": [
                    {"week": week, "rate": 0.0, "count": 0}
                    for week in range(12)
                ],
            }

        if r['cohort_week'] is None:
            continue

        week = int(r['cohort_week'])
        if 0 <= week < 12:
            active_count = int(r['active_count'] or 0)
            cohorts[month]["retention"][week] = {
                "week": week,
                "rate": round(active_count / total, 3) if total else 0.0,
                "count": active_count,
            }

    return {"cohorts": cohorts}

@app.get("/health-trend")
async def get_health_trend(org_id: str = Depends(get_org_id)):
    pool = await get_db()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT
                pms.snapshot_date as day,
                AVG(pms.health_score) as avg_health,
                COUNT(DISTINCT pms.partner_id) as partner_count
            FROM partner_metric_snapshots pms
            JOIN partners p ON p.id = pms.partner_id
            WHERE p.org_id = $1
            AND pms.snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY day ORDER BY day
        """, org_id)

    if not rows:
        return {"trend": []}

    return {"trend": [
        {"date": r['day'].strftime("%Y-%m-%d"), "avg_health": round(float(r['avg_health']), 1)}
        for r in rows
    ]}

@app.get("/revenue-trend")
async def get_revenue_trend(org_id: str = Depends(get_org_id)):
    pool = await get_db()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT
                DATE_TRUNC('month', pm.recorded_at) as month,
                SUM(pm.mrr) as total_mrr,
                COUNT(DISTINCT pm.partner_id) as partners
            FROM partner_metrics pm
            JOIN partners p ON p.id = pm.partner_id
            WHERE p.org_id = $1
            GROUP BY month ORDER BY month DESC LIMIT 6
        """, org_id)

        total_mrr = await conn.fetchval("""
            SELECT COALESCE(SUM(pm.mrr), 0)
            FROM partner_metrics pm
            JOIN partners p ON p.id = pm.partner_id
            WHERE p.org_id = $1
        """, org_id)

    months = [{"month": r['month'].strftime("%Y-%m"), "mrr": float(r['total_mrr'] or 0), "partners": int(r['partners'])} for r in rows]
    return {"months": months[::-1], "total_mrr": float(total_mrr or 0)}

@app.get("/alerts")
async def get_alerts(org_id: str = Depends(get_org_id)):
    pool = await get_db()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT
                pe.id, pe.event_type, pe.payload, pe.created_at,
                p.name as partner_name, p.id as partner_id
            FROM partner_events pe
            JOIN partners p ON p.id = pe.partner_id
            WHERE pe.org_id = $1
            ORDER BY pe.created_at DESC LIMIT 20
        """, org_id)

    alerts = []
    for r in rows:
        payload = dict(r['payload']) if r['payload'] else {}
        alerts.append({
            "id":           str(r['id']),
            "type":         r['event_type'],
            "partner_name": r['partner_name'],
            "partner_id":   str(r['partner_id']),
            "message":      payload.get('message', r['event_type']),
            "severity":     payload.get('severity', 'medium'),
            "created_at":   r['created_at'].isoformat(),
        })

    return {"alerts": alerts}

@app.get("/segment-breakdown")
async def get_segment_breakdown(org_id: str = Depends(get_org_id)):
    pool = await get_db()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT
                p.tier as segment,
                COUNT(p.id) as count,
                AVG(COALESCE(pm.health_score, 70)) as avg_health,
                SUM(COALESCE(pm.mrr, 0)) as total_mrr
            FROM partners p
            LEFT JOIN LATERAL (
                SELECT health_score, mrr FROM partner_metrics
                WHERE partner_id = p.id ORDER BY recorded_at DESC LIMIT 1
            ) pm ON true
            WHERE p.org_id = $1 AND p.deleted_at IS NULL
            GROUP BY p.tier
        """, org_id)

    return {"segments": [
        {
            "segment":    r['segment'],
            "count":      int(r['count']),
            "avg_health": round(float(r['avg_health'] or 70), 1),
            "total_mrr":  float(r['total_mrr'] or 0),
        }
        for r in rows
    ]}
