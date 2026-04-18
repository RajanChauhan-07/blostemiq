from fastapi import FastAPI
import numpy as np
import logging
from datetime import datetime, timedelta
import random

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Analytics Service", version="1.0.0")

# Seed for reproducible data
random.seed(42)
np.random.seed(42)

# ─── Realistic Partner Data ──────────────────────────────
PARTNERS = [
    {"id": 1, "name": "PhonePe", "segment": "Payments", "onboarded": "2024-01", "mrr": 45000, "health": 92},
    {"id": 2, "name": "CRED", "segment": "Payments", "onboarded": "2024-02", "mrr": 52000, "health": 95},
    {"id": 3, "name": "Zerodha", "segment": "WealthTech", "onboarded": "2024-01", "mrr": 38000, "health": 96},
    {"id": 4, "name": "Groww", "segment": "WealthTech", "onboarded": "2024-03", "mrr": 28000, "health": 51},
    {"id": 5, "name": "Razorpay", "segment": "Payments", "onboarded": "2024-01", "mrr": 67000, "health": 38},
    {"id": 6, "name": "Paytm", "segment": "Payments", "onboarded": "2024-02", "mrr": 41000, "health": 78},
    {"id": 7, "name": "BharatPe", "segment": "Payments", "onboarded": "2024-04", "mrr": 18000, "health": 12},
    {"id": 8, "name": "Pine Labs", "segment": "Payments", "onboarded": "2024-03", "mrr": 33000, "health": 82},
    {"id": 9, "name": "Lendingkart", "segment": "Lending", "onboarded": "2024-05", "mrr": 22000, "health": 44},
    {"id": 10, "name": "Capital Float", "segment": "Lending", "onboarded": "2024-04", "mrr": 19000, "health": 61},
    {"id": 11, "name": "Slice", "segment": "Neobanking", "onboarded": "2024-06", "mrr": 25000, "health": 55},
    {"id": 12, "name": "Jupiter", "segment": "Neobanking", "onboarded": "2024-05", "mrr": 21000, "health": 73},
    {"id": 13, "name": "Niyo", "segment": "Neobanking", "onboarded": "2024-07", "mrr": 16000, "health": 68},
    {"id": 14, "name": "Fi Money", "segment": "Neobanking", "onboarded": "2024-06", "mrr": 14000, "health": 58},
    {"id": 15, "name": "Khatabook", "segment": "SME Tools", "onboarded": "2024-03", "mrr": 12000, "health": 85},
    {"id": 16, "name": "OkCredit", "segment": "SME Tools", "onboarded": "2024-04", "mrr": 11000, "health": 79},
    {"id": 17, "name": "Perfios", "segment": "Data Analytics", "onboarded": "2024-02", "mrr": 35000, "health": 88},
    {"id": 18, "name": "NAVI", "segment": "InsurTech", "onboarded": "2024-08", "mrr": 20000, "health": 71},
    {"id": 19, "name": "Digit Insurance", "segment": "InsurTech", "onboarded": "2024-07", "mrr": 24000, "health": 76},
    {"id": 20, "name": "Rupeek", "segment": "Lending", "onboarded": "2024-09", "mrr": 15000, "health": 63},
]

# ─── Cohort Retention ────────────────────────────────────
@app.get("/cohorts")
async def get_cohorts():
    """Return cohort retention data — partners grouped by onboarding month"""
    cohorts = {}
    months = ["2024-01", "2024-02", "2024-03", "2024-04", "2024-05", "2024-06", "2024-07", "2024-08", "2024-09"]
    
    for month in months:
        cohort_partners = [p for p in PARTNERS if p["onboarded"] == month]
        total = len(cohort_partners)
        if total == 0:
            continue
        
        retention = []
        for week in range(12):
            # Simulate retention decay — healthier cohorts retain better
            avg_health = np.mean([p["health"] for p in cohort_partners])
            base_retention = (avg_health / 100) * 0.95
            decay = 0.97 ** week
            noise = np.random.normal(0, 0.02)
            rate = max(0.1, min(1.0, base_retention * decay + noise))
            retention.append(round(rate * 100))
        
        cohorts[month] = {
            "month": month,
            "total_partners": total,
            "retention_pct": retention,  # weekly retention %
        }
    
    return {"cohorts": cohorts}

# ─── Revenue Metrics ─────────────────────────────────────
@app.get("/revenue")
async def get_revenue():
    """Return monthly revenue growth data"""
    months = []
    base_mrr = 120000
    
    for i in range(12):
        dt = datetime(2024, 1, 1) + timedelta(days=30 * i)
        growth = 1 + (0.08 + np.random.normal(0, 0.015))  # ~8% monthly growth
        base_mrr = int(base_mrr * growth)
        
        churned_mrr = int(base_mrr * np.random.uniform(0.02, 0.06))
        expansion_mrr = int(base_mrr * np.random.uniform(0.03, 0.08))
        new_mrr = int(base_mrr * np.random.uniform(0.05, 0.12))
        
        months.append({
            "month": dt.strftime("%Y-%m"),
            "total_mrr": base_mrr,
            "new_mrr": new_mrr,
            "expansion_mrr": expansion_mrr,
            "churned_mrr": churned_mrr,
            "net_mrr": new_mrr + expansion_mrr - churned_mrr,
        })
    
    return {
        "monthly": months,
        "current_arr": base_mrr * 12,
        "growth_rate_pct": round(((base_mrr / 120000) ** (1/12) - 1) * 100, 1),
    }

# ─── Funnel Analytics ────────────────────────────────────
@app.get("/funnel")
async def get_funnel():
    """Return onboarding funnel completion rates"""
    return {
        "steps": [
            {"name": "Signed Up", "count": 142, "pct": 100},
            {"name": "Org Created", "count": 128, "pct": 90},
            {"name": "API Key Generated", "count": 98, "pct": 69},
            {"name": "First API Call", "count": 76, "pct": 54},
            {"name": "Integration Complete", "count": 52, "pct": 37},
            {"name": "First Week Active", "count": 41, "pct": 29},
            {"name": "Paying Customer", "count": 28, "pct": 20},
        ],
        "avg_time_to_first_call_hours": 4.2,
        "avg_time_to_paying_days": 18.5,
    }

# ─── Segment Breakdown ───────────────────────────────────
@app.get("/segments")
async def get_segments():
    """Return partner count and MRR by segment"""
    segments = {}
    for p in PARTNERS:
        seg = p["segment"]
        if seg not in segments:
            segments[seg] = {"name": seg, "count": 0, "total_mrr": 0, "avg_health": []}
        segments[seg]["count"] += 1
        segments[seg]["total_mrr"] += p["mrr"]
        segments[seg]["avg_health"].append(p["health"])
    
    result = []
    for seg in segments.values():
        result.append({
            "name": seg["name"],
            "count": seg["count"],
            "total_mrr": seg["total_mrr"],
            "avg_health": round(np.mean(seg["avg_health"]), 1),
        })
    
    return {"segments": sorted(result, key=lambda x: x["total_mrr"], reverse=True)}

# ─── Health Distribution ─────────────────────────────────
@app.get("/health-distribution")
async def get_health_distribution():
    """Return histogram of health scores"""
    scores = [p["health"] for p in PARTNERS]
    bins = [0, 20, 40, 60, 80, 100]
    hist, _ = np.histogram(scores, bins=bins)
    
    return {
        "distribution": [
            {"range": f"{bins[i]}-{bins[i+1]}", "count": int(hist[i]), "label": ["Critical", "Poor", "Fair", "Good", "Excellent"][i]}
            for i in range(len(hist))
        ],
        "mean": round(np.mean(scores), 1),
        "median": round(float(np.median(scores)), 1),
        "std": round(float(np.std(scores)), 1),
    }

# ─── KPI Summary ─────────────────────────────────────────
@app.get("/kpis")
async def get_kpis():
    """Return dashboard KPI data"""
    total = len(PARTNERS)
    at_risk = len([p for p in PARTNERS if p["health"] < 50])
    total_mrr = sum(p["mrr"] for p in PARTNERS)
    avg_health = np.mean([p["health"] for p in PARTNERS])
    
    return {
        "total_partners": total,
        "at_risk_partners": at_risk,
        "total_mrr": total_mrr,
        "avg_health": round(avg_health, 1),
        "churn_rate_pct": round((at_risk / total) * 100, 1),
        "nps_score": 72,
        "api_calls_today": 147892,
        "alerts_today": 7,
    }

# ─── Partner List ─────────────────────────────────────────
@app.get("/partners")
async def get_partners():
    """Return full partner list with computed metrics"""
    result = []
    for p in PARTNERS:
        churn_risk = max(0, min(100, 100 - p["health"] + np.random.randint(-5, 5)))
        trend = "up" if p["health"] > 70 else "down" if p["health"] < 50 else "flat"
        
        # Generate 12-week sparkline
        sparkline = []
        base = p["health"]
        for w in range(12):
            base += np.random.randint(-3, 4)
            sparkline.append(max(5, min(100, base)))
        
        result.append({
            **p,
            "churn_risk": churn_risk,
            "trend": trend,
            "sparkline": sparkline,
            "api_calls_7d": int(np.random.exponential(500) * (p["health"] / 50)),
            "last_active": (datetime.now() - timedelta(days=int(np.random.exponential(3) * (100 - p["health"]) / 20))).isoformat(),
        })
    
    return {"partners": result}

@app.get("/health")
def health():
    return {"status": "ok"}
