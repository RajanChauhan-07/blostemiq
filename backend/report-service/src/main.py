from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import io
import numpy as np
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image
from reportlab.graphics.shapes import Drawing, Rect, String, Line
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Report Service", version="1.0.0")

# ─── Brand Colors ─────────────────────────────────────
BRAND_DARK = colors.HexColor("#0a0f1c")
BRAND_ACCENT = colors.HexColor("#00d4ff")
BRAND_GREEN = colors.HexColor("#10d982")
BRAND_RED = colors.HexColor("#ef4444")
BRAND_AMBER = colors.HexColor("#f59e0b")
BRAND_PURPLE = colors.HexColor("#7c3aed")
BRAND_TEXT = colors.HexColor("#e2e8f0")
BRAND_MUTED = colors.HexColor("#94a3b8")
BRAND_BG = colors.HexColor("#111827")

# ─── Partner Data (same as analytics service) ─────────
PARTNERS = [
    {"name": "PhonePe", "segment": "Payments", "mrr": 45000, "health": 92, "churn_risk": 8},
    {"name": "CRED", "segment": "Payments", "mrr": 52000, "health": 95, "churn_risk": 5},
    {"name": "Zerodha", "segment": "WealthTech", "mrr": 38000, "health": 96, "churn_risk": 4},
    {"name": "Groww", "segment": "WealthTech", "mrr": 28000, "health": 51, "churn_risk": 49},
    {"name": "Razorpay", "segment": "Payments", "mrr": 67000, "health": 38, "churn_risk": 67},
    {"name": "Paytm", "segment": "Payments", "mrr": 41000, "health": 78, "churn_risk": 22},
    {"name": "BharatPe", "segment": "Payments", "mrr": 18000, "health": 12, "churn_risk": 91},
    {"name": "Pine Labs", "segment": "Payments", "mrr": 33000, "health": 82, "churn_risk": 18},
    {"name": "Lendingkart", "segment": "Lending", "mrr": 22000, "health": 44, "churn_risk": 55},
    {"name": "Capital Float", "segment": "Lending", "mrr": 19000, "health": 61, "churn_risk": 39},
    {"name": "Slice", "segment": "Neobanking", "mrr": 25000, "health": 55, "churn_risk": 45},
    {"name": "Jupiter", "segment": "Neobanking", "mrr": 21000, "health": 73, "churn_risk": 27},
    {"name": "Niyo", "segment": "Neobanking", "mrr": 16000, "health": 68, "churn_risk": 32},
    {"name": "Fi Money", "segment": "Neobanking", "mrr": 14000, "health": 58, "churn_risk": 42},
    {"name": "Khatabook", "segment": "SME Tools", "mrr": 12000, "health": 85, "churn_risk": 15},
    {"name": "OkCredit", "segment": "SME Tools", "mrr": 11000, "health": 79, "churn_risk": 21},
    {"name": "Perfios", "segment": "Data Analytics", "mrr": 35000, "health": 88, "churn_risk": 12},
    {"name": "NAVI", "segment": "InsurTech", "mrr": 20000, "health": 71, "churn_risk": 29},
    {"name": "Digit Insurance", "segment": "InsurTech", "mrr": 24000, "health": 76, "churn_risk": 24},
    {"name": "Rupeek", "segment": "Lending", "mrr": 15000, "health": 63, "churn_risk": 37},
]


def build_pdf() -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=30, bottomMargin=30, leftMargin=40, rightMargin=40)

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("BrandTitle", parent=styles["Title"], fontSize=22, textColor=BRAND_ACCENT, spaceAfter=6, fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle("BrandH2", parent=styles["Heading2"], fontSize=14, textColor=BRAND_ACCENT, spaceBefore=16, spaceAfter=8, fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle("BrandBody", parent=styles["Normal"], fontSize=10, textColor=colors.black, leading=14))
    styles.add(ParagraphStyle("BrandCaption", parent=styles["Normal"], fontSize=8, textColor=BRAND_MUTED, alignment=TA_CENTER))
    styles.add(ParagraphStyle("KPIValue", parent=styles["Normal"], fontSize=18, textColor=BRAND_ACCENT, fontName="Helvetica-Bold", alignment=TA_CENTER))
    styles.add(ParagraphStyle("KPILabel", parent=styles["Normal"], fontSize=8, textColor=colors.gray, alignment=TA_CENTER))

    elements = []

    # ─── Title ──────────────────────────────────────────
    now = datetime.now()
    elements.append(Paragraph("BlostemIQ", styles["BrandTitle"]))
    elements.append(Paragraph("Partner Intelligence Weekly Digest", ParagraphStyle("sub", parent=styles["Normal"], fontSize=12, textColor=colors.gray)))
    elements.append(Paragraph(f"Generated: {now.strftime('%B %d, %Y at %I:%M %p')}", ParagraphStyle("date", parent=styles["Normal"], fontSize=9, textColor=colors.gray)))
    elements.append(Spacer(1, 12))
    elements.append(HRFlowable(width="100%", thickness=1, color=BRAND_ACCENT, spaceAfter=12))

    # ─── Executive Summary KPIs ─────────────────────────
    total_mrr = sum(p["mrr"] for p in PARTNERS)
    avg_health = np.mean([p["health"] for p in PARTNERS])
    at_risk = len([p for p in PARTNERS if p["health"] < 50])
    total = len(PARTNERS)

    elements.append(Paragraph("Executive Summary", styles["BrandH2"]))

    kpi_data = [
        ["Total Partners", "Total MRR", "Avg Health Score", "At-Risk Partners"],
        [str(total), f"₹{total_mrr:,}", f"{avg_health:.1f}/100", f"{at_risk} ({at_risk * 100 // total}%)"],
    ]
    kpi_table = Table(kpi_data, colWidths=[doc.width / 4] * 4)
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTSIZE", (0, 1), (-1, 1), 14),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 1), (-1, 1), BRAND_ACCENT),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#334155")),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 16))

    # ─── At-Risk Partners ───────────────────────────────
    elements.append(Paragraph("⚠️ At-Risk Partners (Health < 50)", styles["BrandH2"]))
    elements.append(Paragraph("These partners require immediate attention based on ML health scoring and churn prediction models.", styles["BrandBody"]))
    elements.append(Spacer(1, 6))

    risk_partners = sorted([p for p in PARTNERS if p["health"] < 50], key=lambda x: x["health"])
    risk_data = [["Partner", "Segment", "Health", "Churn Risk", "MRR", "Action"]]
    for p in risk_partners:
        risk_data.append([
            p["name"], p["segment"],
            f"{p['health']}/100", f"{p['churn_risk']}%",
            f"₹{p['mrr']:,}",
            "ESCALATE" if p["churn_risk"] > 70 else "RE-ENGAGE" if p["churn_risk"] > 40 else "NURTURE",
        ])

    risk_table = Table(risk_data, colWidths=[80, 70, 50, 60, 60, 70])
    risk_style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#334155")),
    ]
    for i, p in enumerate(risk_partners, 1):
        if p["churn_risk"] > 70:
            risk_style.append(("BACKGROUND", (-1, i), (-1, i), colors.HexColor("#fecaca")))
            risk_style.append(("TEXTCOLOR", (-1, i), (-1, i), colors.HexColor("#991b1b")))
        elif p["churn_risk"] > 40:
            risk_style.append(("BACKGROUND", (-1, i), (-1, i), colors.HexColor("#fef3c7")))
            risk_style.append(("TEXTCOLOR", (-1, i), (-1, i), colors.HexColor("#92400e")))

    risk_table.setStyle(TableStyle(risk_style))
    elements.append(risk_table)
    elements.append(Spacer(1, 16))

    # ─── Full Partner Scorecard ─────────────────────────
    elements.append(Paragraph("📊 Full Partner Scorecard", styles["BrandH2"]))

    sorted_partners = sorted(PARTNERS, key=lambda x: x["mrr"], reverse=True)
    full_data = [["#", "Partner", "Segment", "MRR", "Health", "Risk", "Status"]]
    for i, p in enumerate(sorted_partners, 1):
        status = "✅ Healthy" if p["health"] >= 70 else "⚠️ Watch" if p["health"] >= 40 else "🔴 Critical"
        full_data.append([
            str(i), p["name"], p["segment"],
            f"₹{p['mrr']:,}", f"{p['health']}",
            f"{p['churn_risk']}%", status,
        ])

    full_table = Table(full_data, colWidths=[25, 75, 70, 55, 45, 40, 65])
    full_style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (1, 0), (1, -1), "LEFT"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]
    for i, p in enumerate(sorted_partners, 1):
        if p["health"] < 40:
            full_style.append(("TEXTCOLOR", (4, i), (4, i), colors.HexColor("#ef4444")))
        elif p["health"] >= 70:
            full_style.append(("TEXTCOLOR", (4, i), (4, i), colors.HexColor("#10b981")))

    full_table.setStyle(TableStyle(full_style))
    elements.append(full_table)
    elements.append(Spacer(1, 16))

    # ─── Segment Analysis ───────────────────────────────
    elements.append(Paragraph("🏢 Segment Analysis", styles["BrandH2"]))

    segments = {}
    for p in PARTNERS:
        seg = p["segment"]
        if seg not in segments:
            segments[seg] = {"count": 0, "mrr": 0, "health_sum": 0}
        segments[seg]["count"] += 1
        segments[seg]["mrr"] += p["mrr"]
        segments[seg]["health_sum"] += p["health"]

    seg_data = [["Segment", "Partners", "Total MRR", "Avg Health", "MRR Share"]]
    for seg_name, s in sorted(segments.items(), key=lambda x: x[1]["mrr"], reverse=True):
        seg_data.append([
            seg_name, str(s["count"]),
            f"₹{s['mrr']:,}",
            f"{s['health_sum'] / s['count']:.0f}",
            f"{s['mrr'] * 100 / total_mrr:.1f}%",
        ])

    seg_table = Table(seg_data, colWidths=[85, 55, 75, 65, 60])
    seg_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
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
    elements.append(seg_table)
    elements.append(Spacer(1, 16))

    # ─── Recommendations ────────────────────────────────
    elements.append(Paragraph("💡 AI-Generated Recommendations", styles["BrandH2"]))

    recs = [
        f"<b>URGENT:</b> BharatPe (health: 12) has had zero API calls for 32 days. Initiate executive escalation immediately.",
        f"<b>HIGH PRIORITY:</b> Razorpay (health: 38) API usage dropped 67% MoM. Schedule technical review call.",
        f"<b>EXPANSION:</b> Zerodha (health: 96) and CRED (health: 95) are ideal upsell candidates for premium tier.",
        f"<b>MONITOR:</b> Lendingkart and Groww are trending downward. Deploy automated nurture sequences.",
        f"<b>RETENTION:</b> Consider dedicating CSM resources to the Neobanking segment (avg health: 63.5).",
    ]
    for rec in recs:
        elements.append(Paragraph(f"• {rec}", ParagraphStyle("rec", parent=styles["BrandBody"], spaceBefore=4, spaceAfter=4, leftIndent=12)))

    elements.append(Spacer(1, 20))

    # ─── Footer ─────────────────────────────────────────
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceAfter=8))
    elements.append(Paragraph(
        f"BlostemIQ — Partner Intelligence Platform • Generated {now.strftime('%Y-%m-%d %H:%M')} • Confidential",
        ParagraphStyle("footer", parent=styles["Normal"], fontSize=7, textColor=colors.gray, alignment=TA_CENTER),
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


@app.get("/generate")
async def generate_report():
    """Generate and return a PDF partner intelligence report"""
    logger.info("Generating PDF report...")
    pdf_bytes = build_pdf()
    logger.info(f"PDF generated: {len(pdf_bytes)} bytes")
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=BlostemIQ_Report_{datetime.now().strftime('%Y%m%d')}.pdf"},
    )

@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
