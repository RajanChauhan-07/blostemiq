#!/usr/bin/env python3
"""
BlostemIQ Seed Data Generator
══════════════════════════════
Generates 12 months of realistic fintech partner data:
  - 30 partners across 3 tiers (Basic / Growth / Enterprise)
  - Each partner has a unique trajectory (healthy / declining / recovering / churned)
  - ~500-5000 API events per partner per month depending on tier + trajectory
  - Outputs: PostgreSQL SQL + DynamoDB JSON batches

Run: python3 database/seeds/generate.py
"""

import json, uuid, random, math
from datetime import datetime, timedelta, timezone
from pathlib import Path

random.seed(42)  # Reproducible

# ─── Realistic fintech company pool ──────────────────────
PARTNERS = [
    # Enterprise — large volume
    {"name": "Razorpay",      "domain": "razorpay.com",      "tier": "enterprise", "trajectory": "declining",  "hq": "Bangalore"},
    {"name": "PhonePe",       "domain": "phonepe.com",       "tier": "enterprise", "trajectory": "healthy",    "hq": "Bangalore"},
    {"name": "Paytm",         "domain": "paytm.com",         "tier": "enterprise", "trajectory": "recovering", "hq": "Noida"},
    {"name": "BharatPe",      "domain": "bharatpe.com",      "tier": "enterprise", "trajectory": "churned",    "hq": "Delhi"},
    {"name": "CRED",          "domain": "cred.club",         "tier": "enterprise", "trajectory": "healthy",    "hq": "Bangalore"},
    {"name": "Groww",         "domain": "groww.in",          "tier": "enterprise", "trajectory": "healthy",    "hq": "Bangalore"},
    {"name": "Zerodha",       "domain": "zerodha.com",       "tier": "enterprise", "trajectory": "healthy",    "hq": "Bangalore"},
    {"name": "Upstox",        "domain": "upstox.com",        "tier": "enterprise", "trajectory": "declining",  "hq": "Mumbai"},

    # Growth — medium volume
    {"name": "Cashfree",      "domain": "cashfree.com",      "tier": "growth",     "trajectory": "declining",  "hq": "Bangalore"},
    {"name": "Juspay",        "domain": "juspay.in",         "tier": "growth",     "trajectory": "healthy",    "hq": "Bangalore"},
    {"name": "Open Money",    "domain": "open.money",        "tier": "growth",     "trajectory": "recovering", "hq": "Bangalore"},
    {"name": "Signzy",        "domain": "signzy.com",        "tier": "growth",     "trajectory": "healthy",    "hq": "Bangalore"},
    {"name": "Setu",          "domain": "setu.co",           "tier": "growth",     "trajectory": "healthy",    "hq": "Bangalore"},
    {"name": "Vauld",         "domain": "vauld.com",         "tier": "growth",     "trajectory": "churned",    "hq": "Bangalore"},
    {"name": "Fi Money",      "domain": "fi.money",          "tier": "growth",     "trajectory": "declining",  "hq": "Bangalore"},
    {"name": "Jupiter",       "domain": "jupiter.money",     "tier": "growth",     "trajectory": "healthy",    "hq": "Bangalore"},
    {"name": "Slice",         "domain": "sliceit.com",       "tier": "growth",     "trajectory": "recovering", "hq": "Bangalore"},
    {"name": "Smallcase",     "domain": "smallcase.com",     "tier": "growth",     "trajectory": "healthy",    "hq": "Bangalore"},
    {"name": "INDmoney",      "domain": "indmoney.com",      "tier": "growth",     "trajectory": "healthy",    "hq": "Delhi"},
    {"name": "Niyo",          "domain": "goniyo.com",        "tier": "growth",     "trajectory": "declining",  "hq": "Bangalore"},

    # Basic — lower volume
    {"name": "Freo",          "domain": "freo.money",        "tier": "basic",      "trajectory": "recovering", "hq": "Bangalore"},
    {"name": "Stashfin",      "domain": "stashfin.com",      "tier": "basic",      "trajectory": "churned",    "hq": "Delhi"},
    {"name": "MoneyTap",      "domain": "moneytap.com",      "tier": "basic",      "trajectory": "declining",  "hq": "Bangalore"},
    {"name": "KreditBee",     "domain": "kreditbee.in",      "tier": "basic",      "trajectory": "healthy",    "hq": "Bangalore"},
    {"name": "PaySense",      "domain": "gopaysense.com",    "tier": "basic",      "trajectory": "healthy",    "hq": "Mumbai"},
    {"name": "Navi",          "domain": "navi.com",          "tier": "basic",      "trajectory": "recovering", "hq": "Bangalore"},
    {"name": "Perfios",       "domain": "perfios.com",       "tier": "basic",      "trajectory": "healthy",    "hq": "Bangalore"},
    {"name": "Finarkein",     "domain": "finarkein.com",     "tier": "basic",      "trajectory": "declining",  "hq": "Noida"},
    {"name": "Zaggle",        "domain": "zaggle.in",         "tier": "basic",      "trajectory": "healthy",    "hq": "Mumbai"},
    {"name": "Razorpay X",    "domain": "x.razorpay.com",   "tier": "basic",      "trajectory": "recovering", "hq": "Bangalore"},
]

FEATURES = ["payments", "settlements", "refunds", "analytics", "webhooks", "reports", "notifications", "ledger"]
EVENT_TYPES = ["api_call", "login", "feature_used", "error", "webhook", "report_viewed"]

# ─── Base call volumes by tier ────────────────────────────
DAILY_BASE = {"enterprise": 2000, "growth": 400, "basic": 60}

# ─── Trajectory multipliers over 12 months ───────────────
def trajectory_multiplier(trajectory: str, month: int) -> float:
    """month = 1 (oldest) to 12 (most recent)"""
    t = month / 12.0  # 0 → 1
    if trajectory == "healthy":
        return 0.8 + 0.4 * t + random.uniform(-0.05, 0.05)
    elif trajectory == "declining":
        return 1.2 - 0.9 * t + random.uniform(-0.05, 0.05)
    elif trajectory == "churned":
        # Active early, drops to near 0 after month 8
        return max(0, 1.0 - 1.15 * max(0, t - 0.5)) + random.uniform(-0.02, 0.02)
    elif trajectory == "recovering":
        # Dips in middle, then rebounds
        dip = math.sin(t * math.pi)
        return 0.5 + 0.4 * dip + random.uniform(-0.05, 0.05)
    return 1.0

def error_rate(trajectory: str, month: int) -> float:
    t = month / 12.0
    if trajectory in ("declining", "churned"):
        return min(0.3, 0.05 + 0.2 * t)
    elif trajectory == "recovering":
        return max(0.02, 0.2 - 0.15 * t)
    return 0.03 + random.uniform(-0.01, 0.01)

def contacts(name: str) -> tuple[str, str]:
    first = ["Arjun", "Priya", "Rahul", "Sneha", "Vikram", "Anjali", "Rohan", "Kavya"]
    last  = ["Sharma", "Gupta", "Patel", "Singh", "Kumar", "Mehta", "Joshi", "Rao"]
    fn, ln = random.choice(first), random.choice(last)
    return f"{fn} {ln}", f"{fn.lower()}.{ln.lower()}@{name.lower().replace(' ', '')}.com"

def main():
    out = Path("database/seeds")
    out.mkdir(parents=True, exist_ok=True)

    now = datetime.now(timezone.utc)
    start = now - timedelta(days=365)

    org_id    = "11111111-1111-1111-1111-111111111111"
    owner_id  = "22222222-2222-2222-2222-222222222222"

    sql_lines  = []
    ddb_events = []  # DynamoDB partner event records
    stats      = []

    # ─── Org + User ──────────────────────────────────────
    sql_lines.append(f"""
-- ═══ SEED DATA — Generated {now.strftime('%Y-%m-%d %H:%M')} UTC ═══
-- Organization
INSERT INTO organizations (id, name, slug, plan, created_at)
VALUES ('{org_id}', 'Demo Corp', 'demo-corp', 'enterprise', NOW() - INTERVAL '400 days')
ON CONFLICT (id) DO NOTHING;

-- Owner user
INSERT INTO users (id, email, full_name, password_hash, email_verified)
VALUES ('{owner_id}', 'demo@blostemiq.com', 'Demo User', '$2b$12$placeholder_hash', true)
ON CONFLICT (id) DO NOTHING;

-- Membership
INSERT INTO memberships (user_id, org_id, role)
VALUES ('{owner_id}', '{org_id}', 'owner')
ON CONFLICT (user_id, org_id) DO NOTHING;

-- Partners
""")

    for partner_def in PARTNERS:
        pid = str(uuid.uuid4())
        name_clean = partner_def["name"].replace(" ", "")
        cname, cemail = contacts(name_clean)

        created_days_ago = random.randint(180, 400)
        tags = json.dumps([partner_def["hq"].lower(), partner_def["tier"], "fintech"])

        pname  = partner_def["name"]
        domain = partner_def["domain"]
        ptier  = partner_def["tier"]
        sql_lines.append(
            f"INSERT INTO partners (id, org_id, name, domain, tier, contact_name, contact_email, tags, created_at) "
            f"VALUES ('{pid}', '{org_id}', '{pname}', '{domain}', "
            f"'{ptier}', '{cname}', '{cemail}', '{tags}', "
            f"NOW() - INTERVAL '{created_days_ago} days') ON CONFLICT (id) DO NOTHING;"
        )



        # ─── Generate events for each month ──────────────
        event_count = 0
        for month in range(1, 13):
            # Start of this month
            month_start = start + timedelta(days=(month - 1) * 30)
            base_daily  = DAILY_BASE[partner_def["tier"]]
            mult        = trajectory_multiplier(partner_def["trajectory"], month)
            err_rate    = error_rate(partner_def["trajectory"], month)
            daily_calls = max(0, int(base_daily * mult))

            if daily_calls == 0:
                continue

            for day in range(30):
                day_dt = month_start + timedelta(days=day)
                if day_dt > now:
                    break

                # Daily call count with noise
                calls_today = max(0, int(daily_calls * random.uniform(0.6, 1.4)))
                # Weekends quieter
                if day_dt.weekday() >= 5:
                    calls_today = int(calls_today * 0.35)

                # Sample events throughout the day
                for _ in range(min(calls_today, 500)):  # cap per-day DB writes
                    hour = random.choices(
                        range(24),
                        weights=[1,1,1,1,1,2,4,8,10,12,12,12,10,12,12,12,10,8,6,4,3,2,2,1],
                        k=1
                    )[0]
                    minute  = random.randint(0, 59)
                    second  = random.randint(0, 59)
                    ts      = day_dt.replace(hour=hour, minute=minute, second=second, tzinfo=timezone.utc)
                    is_error = random.random() < err_rate
                    feature  = random.choice(FEATURES) if random.random() > 0.3 else None
                    event_type = "error" if is_error else random.choice(EVENT_TYPES)
                    status_code = random.choice([400, 429, 500, 503]) if is_error else 200

                    expires_ts = int((ts + timedelta(days=365)).timestamp())

                    ddb_events.append({
                        "org_id":      {"S": f"{org_id}#{pid}"},
                        "timestamp":   {"S": ts.isoformat()},
                        "event_id":    {"S": str(uuid.uuid4())},
                        "event_type":  {"S": event_type},
                        "feature":     {"S": feature} if feature else {"NULL": True},
                        "status_code": {"N": str(status_code)},
                        "expires_at":  {"N": str(expires_ts)},
                    })
                    event_count += 1

        stats.append({
            "name": partner_def["name"],
            "tier": partner_def["tier"],
            "trajectory": partner_def["trajectory"],
            "events": event_count,
        })

    # ─── Write SQL ────────────────────────────────────────
    sql_path = out / "seed.sql"
    sql_path.write_text("\n".join(sql_lines))
    print(f"✅ SQL seed written: {sql_path} ({len(sql_lines)} statements)")

    # ─── Write DynamoDB batches (25/batch = DDB limit) ────
    ddb_path = out / "dynamo_events"
    ddb_path.mkdir(exist_ok=True)

    batch_size = 25
    total_batches = 0
    for i in range(0, len(ddb_events), batch_size):
        batch = ddb_events[i:i + batch_size]
        batch_file = ddb_path / f"batch_{i // batch_size:04d}.json"
        batch_file.write_text(json.dumps({"events": batch}, indent=2))
        total_batches += 1

    print(f"✅ DynamoDB batches: {total_batches} files in {ddb_path}/")

    # ─── Summary table ────────────────────────────────────
    print(f"\n{'Partner':<20} {'Tier':<12} {'Trajectory':<12} {'Events':>8}")
    print("─" * 56)
    total_events = 0
    for s in sorted(stats, key=lambda x: -x["events"]):
        print(f"{s['name']:<20} {s['tier']:<12} {s['trajectory']:<12} {s['events']:>8,}")
        total_events += s["events"]
    print("─" * 56)
    print(f"{'TOTAL':<20} {'30 partners':<12} {'──────':<12} {total_events:>8,}")
    print(f"\n🎉 Done! {total_events:,} events across 30 partners, 12 months.")

if __name__ == "__main__":
    main()
