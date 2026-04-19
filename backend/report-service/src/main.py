from datetime import datetime
import base64
import hashlib
import hmac
import io
import json
import logging
import os
import time
from typing import Any, Optional

import asyncpg
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Report Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Type", "Content-Length"],
)

DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET = os.getenv("JWT_SECRET")
_pool: Optional[asyncpg.Pool] = None

BRAND_ACCENT = colors.HexColor("#00d4ff")
BRAND_MUTED = colors.HexColor("#64748b")
BRAND_RED = colors.HexColor("#ef4444")
BRAND_YELLOW = colors.HexColor("#f59e0b")
BRAND_GREEN = colors.HexColor("#10d982")
TABLE_HEADER = colors.HexColor("#1e293b")


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


@app.on_event("startup")
async def startup():
    if not DATABASE_URL:
        logger.warning("DATABASE_URL is not configured for report-service")
        return

    try:
        await get_db()
        logger.info("Report service DB pool ready")
    except Exception as exc:
        logger.error("Report service startup error: %s", exc)


def _status_from_partner(partner: dict[str, Any]) -> str:
    if partner["health"] < 40 or partner["churn_risk"] > 0.7:
        return "Critical"
    if partner["health"] < 65 or partner["churn_risk"] > 0.4:
        return "Watch"
    return "Healthy"


async def fetch_report_data(org_id: str) -> dict[str, Any]:
    pool = await get_db()
    async with pool.acquire() as conn:
        org_name = await conn.fetchval(
            "SELECT name FROM organizations WHERE id = $1",
            org_id,
        )

        partner_rows = await conn.fetch(
            """
            SELECT
                p.id,
                p.name,
                p.tier,
                p.contact_email,
                COALESCE(pm.health_score, 70) AS health_score,
                COALESCE(pm.mrr, 0) AS mrr,
                COALESCE(pm.api_calls, 0) AS api_calls,
                COALESCE(pm.churn_risk, 0.1) AS churn_risk,
                COALESCE(pm.nps, 70) AS nps
            FROM partners p
            LEFT JOIN LATERAL (
                SELECT health_score, mrr, api_calls, churn_risk, nps
                FROM partner_metrics
                WHERE partner_id = p.id
                ORDER BY recorded_at DESC
                LIMIT 1
            ) pm ON true
            WHERE p.org_id = $1 AND p.deleted_at IS NULL
            ORDER BY COALESCE(pm.mrr, 0) DESC, p.name ASC
            """,
            org_id,
        )

        alert_rows = await conn.fetch(
            """
            SELECT
                pe.id,
                p.name AS partner_name,
                COALESCE(pe.payload->>'message', pe.event_type) AS message,
                COALESCE(pe.payload->>'severity', 'medium') AS severity,
                pe.created_at
            FROM partner_events pe
            JOIN partners p ON p.id = pe.partner_id
            WHERE pe.org_id = $1
            ORDER BY pe.created_at DESC
            LIMIT 5
            """,
            org_id,
        )

    partners = [
        {
            "name": row["name"],
            "tier": row["tier"],
            "contact_email": row["contact_email"],
            "health": round(float(row["health_score"]), 1),
            "mrr": float(row["mrr"]),
            "api_calls": int(row["api_calls"]),
            "churn_risk": round(float(row["churn_risk"]), 3),
            "nps": int(row["nps"]),
        }
        for row in partner_rows
    ]

    total_mrr = sum(partner["mrr"] for partner in partners)
    avg_health = round(sum(partner["health"] for partner in partners) / len(partners), 1) if partners else 0.0
    at_risk = [
        partner for partner in partners
        if partner["health"] < 50 or partner["churn_risk"] > 0.6
    ]

    segments: dict[str, dict[str, Any]] = {}
    for partner in partners:
      tier = partner["tier"] or "unknown"
      if tier not in segments:
          segments[tier] = {"count": 0, "mrr": 0.0, "health_sum": 0.0}
      segments[tier]["count"] += 1
      segments[tier]["mrr"] += partner["mrr"]
      segments[tier]["health_sum"] += partner["health"]

    segment_rows = [
        {
            "segment": segment,
            "count": values["count"],
            "mrr": values["mrr"],
            "avg_health": round(values["health_sum"] / values["count"], 1),
        }
        for segment, values in sorted(segments.items(), key=lambda item: item[1]["mrr"], reverse=True)
    ]

    alerts = [
        {
            "partner_name": row["partner_name"],
            "message": row["message"],
            "severity": row["severity"],
            "created_at": row["created_at"],
        }
        for row in alert_rows
    ]

    return {
        "org_name": org_name or org_id,
        "generated_at": datetime.now(),
        "partners": partners,
        "total_mrr": total_mrr,
        "avg_health": avg_health,
        "at_risk": at_risk,
        "segments": segment_rows,
        "alerts": alerts,
    }


def build_pdf(data: dict[str, Any]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=30, bottomMargin=30, leftMargin=40, rightMargin=40)

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("BrandTitle", parent=styles["Title"], fontSize=22, textColor=BRAND_ACCENT, spaceAfter=6, fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle("BrandH2", parent=styles["Heading2"], fontSize=14, textColor=BRAND_ACCENT, spaceBefore=16, spaceAfter=8, fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle("BrandBody", parent=styles["Normal"], fontSize=10, textColor=colors.black, leading=14))

    elements = [
        Paragraph("BlostemIQ", styles["BrandTitle"]),
        Paragraph(f"Partner Intelligence Report — {data['org_name']}", ParagraphStyle("sub", parent=styles["Normal"], fontSize=12, textColor=colors.gray)),
        Paragraph(f"Generated: {data['generated_at'].strftime('%B %d, %Y at %I:%M %p')}", ParagraphStyle("date", parent=styles["Normal"], fontSize=9, textColor=colors.gray)),
        Spacer(1, 12),
        HRFlowable(width="100%", thickness=1, color=BRAND_ACCENT, spaceAfter=12),
        Paragraph("Executive Summary", styles["BrandH2"]),
    ]

    total = len(data["partners"])
    at_risk = len(data["at_risk"])
    total_mrr = data["total_mrr"]
    avg_health = data["avg_health"]

    kpi_table = Table(
        [
            ["Total Partners", "Total MRR", "Avg Health Score", "At-Risk Partners"],
            [str(total), f"₹{total_mrr:,.0f}", f"{avg_health:.1f}/100", f"{at_risk}"],
        ],
        colWidths=[doc.width / 4] * 4,
    )
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, 1), 14),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 1), (-1, 1), BRAND_ACCENT),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#334155")),
    ]))
    elements.extend([kpi_table, Spacer(1, 16)])

    elements.append(Paragraph("Top Risk Partners", styles["BrandH2"]))
    if data["at_risk"]:
        risk_rows = [["Partner", "Tier", "Health", "Churn Risk", "MRR", "Contact"]]
        for partner in sorted(data["at_risk"], key=lambda item: (item["health"], -item["churn_risk"])):
            risk_rows.append([
                partner["name"],
                partner["tier"],
                f"{partner['health']}",
                f"{partner['churn_risk'] * 100:.1f}%",
                f"₹{partner['mrr']:,.0f}",
                partner["contact_email"] or "—",
            ])

        risk_table = Table(risk_rows, colWidths=[90, 60, 45, 65, 65, 120])
        risk_style = [
            ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("ALIGN", (0, 0), (0, -1), "LEFT"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dbe3ea")),
        ]

        for row_index, partner in enumerate(sorted(data["at_risk"], key=lambda item: (item["health"], -item["churn_risk"])), start=1):
            color = BRAND_RED if partner["churn_risk"] > 0.7 else BRAND_YELLOW
            risk_style.append(("TEXTCOLOR", (3, row_index), (3, row_index), color))
            risk_style.append(("TEXTCOLOR", (2, row_index), (2, row_index), BRAND_RED if partner["health"] < 40 else BRAND_YELLOW))

        risk_table.setStyle(TableStyle(risk_style))
        elements.extend([risk_table, Spacer(1, 16)])
    else:
        elements.extend([
            Paragraph("No at-risk partners were found for this organization.", styles["BrandBody"]),
            Spacer(1, 16),
        ])

    elements.append(Paragraph("Portfolio Scorecard", styles["BrandH2"]))
    scorecard_rows = [["Partner", "Tier", "MRR", "Health", "Risk", "NPS", "Status"]]
    for partner in data["partners"]:
        scorecard_rows.append([
            partner["name"],
            partner["tier"],
            f"₹{partner['mrr']:,.0f}",
            f"{partner['health']}",
            f"{partner['churn_risk'] * 100:.1f}%",
            str(partner["nps"]),
            _status_from_partner(partner),
        ])

    scorecard_table = Table(scorecard_rows, colWidths=[90, 55, 60, 45, 50, 35, 55])
    scorecard_style = [
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]
    for row_index, partner in enumerate(data["partners"], start=1):
        status_color = BRAND_GREEN if _status_from_partner(partner) == "Healthy" else BRAND_YELLOW if _status_from_partner(partner) == "Watch" else BRAND_RED
        scorecard_style.append(("TEXTCOLOR", (6, row_index), (6, row_index), status_color))
    scorecard_table.setStyle(TableStyle(scorecard_style))
    elements.extend([scorecard_table, Spacer(1, 16)])

    elements.append(Paragraph("Tier Summary", styles["BrandH2"]))
    segment_rows = [["Tier", "Partners", "Total MRR", "Avg Health"]]
    for segment in data["segments"]:
        segment_rows.append([
            segment["segment"],
            str(segment["count"]),
            f"₹{segment['mrr']:,.0f}",
            f"{segment['avg_health']:.1f}",
        ])
    segment_table = Table(segment_rows, colWidths=[100, 70, 90, 80])
    segment_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    elements.extend([segment_table, Spacer(1, 16)])

    elements.append(Paragraph("Recent Alerts", styles["BrandH2"]))
    if data["alerts"]:
        for alert in data["alerts"]:
            severity_color = BRAND_RED if alert["severity"] in ("critical", "high") else BRAND_YELLOW
            created_at = alert["created_at"].strftime("%Y-%m-%d %H:%M")
            elements.append(
                Paragraph(
                    f"<b>{alert['partner_name']}</b> <font color='{severity_color.hexval()}'>{alert['severity'].upper()}</font> — {alert['message']} <font color='{BRAND_MUTED.hexval()}'>({created_at})</font>",
                    styles["BrandBody"],
                )
            )
            elements.append(Spacer(1, 4))
    else:
        elements.append(Paragraph("No recent alerts were found.", styles["BrandBody"]))

    elements.extend([
        Spacer(1, 20),
        HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceAfter=8),
        Paragraph(
            f"BlostemIQ • Generated {data['generated_at'].strftime('%Y-%m-%d %H:%M')} • Confidential",
            ParagraphStyle("footer", parent=styles["Normal"], fontSize=7, textColor=colors.gray, alignment=TA_CENTER),
        ),
    ])

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


@app.get("/generate")
async def generate_report(org_id: str = Depends(get_org_id)):
    logger.info("Generating live PDF report for org %s", org_id)
    data = await fetch_report_data(org_id)
    pdf_bytes = build_pdf(data)
    filename = f"BlostemIQ_Partner_Report_{data['generated_at'].strftime('%B_%Y')}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "application/pdf",
            "Content-Length": str(len(pdf_bytes)),
            "X-Filename": filename,
        },
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "2.0.0",
        "database_configured": bool(DATABASE_URL),
    }
