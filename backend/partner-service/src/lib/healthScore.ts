import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo, TABLES } from './dynamo';
import { cacheGet, cacheSet } from './redis';

/**
 * Health Score Algorithm
 * ─────────────────────
 * Composite score 0-100 across 5 dimensions:
 *
 *  1. Recency       (25pts) — Days since last API call
 *  2. Frequency     (25pts) — API calls / day (7d avg vs 30d avg)
 *  3. Feature Depth (20pts) — Distinct features used / total available
 *  4. Trend         (20pts) — Week-over-week API call slope
 *  5. Error Rate    (10pts) — % of API calls that returned errors
 */

interface RawEvent {
  event_type: string;
  timestamp: string;
  feature?: string;
  status_code?: number;
  payload_size?: number;
}

interface HealthScore {
  score: number;           // 0-100
  churn_probability: number; // 0-1 (heuristic, placeholder until ML model)
  dimensions: {
    recency: number;
    frequency: number;
    feature_depth: number;
    trend: number;
    error_rate: number;
  };
  computed_at: string;
  events_analyzed: number;
}

export async function computeHealthScore(
  orgId: string,
  partnerId: string,
): Promise<HealthScore> {
  const cacheKey = `health:${orgId}:${partnerId}`;
  const cached = await cacheGet<HealthScore>(cacheKey);
  if (cached) return cached;

  // Fetch last 30 days of events from DynamoDB
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const result = await dynamo.send(new QueryCommand({
    TableName: TABLES.PARTNER_EVENTS,
    KeyConditionExpression: 'org_id = :oid AND #ts >= :since',
    ExpressionAttributeNames: { '#ts': 'timestamp' },
    ExpressionAttributeValues: {
      ':oid': `${orgId}#${partnerId}`,
      ':since': thirtyDaysAgo,
    },
    ScanIndexForward: false,
    Limit: 1000,
  }));

  const events = (result.Items || []) as RawEvent[];
  const score = calculate(events);

  // Cache for 5 minutes
  await cacheSet(cacheKey, score, 300);
  return score;
}

function calculate(events: RawEvent[]): HealthScore {
  if (events.length === 0) {
    return {
      score: 0, churn_probability: 0.95,
      dimensions: { recency: 0, frequency: 0, feature_depth: 0, trend: 0, error_rate: 0 },
      computed_at: new Date().toISOString(), events_analyzed: 0,
    };
  }

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

  // ─── 1. Recency (25pts) ─────────────────────────────────
  const latestTs = Math.max(...events.map(e => new Date(e.timestamp).getTime()));
  const daysSinceLast = (now - latestTs) / (1000 * 60 * 60 * 24);
  const recency = Math.max(0, 25 - (daysSinceLast / 30) * 25);

  // ─── 2. Frequency (25pts) ───────────────────────────────
  const last7  = events.filter(e => new Date(e.timestamp).getTime() >= sevenDaysAgo).length;
  const prev7  = events.filter(e => {
    const t = new Date(e.timestamp).getTime();
    return t >= fourteenDaysAgo && t < sevenDaysAgo;
  }).length;
  const dailyRate7 = last7 / 7;
  const baselineFreq = Math.max(prev7 / 7, 1);
  const freqRatio = Math.min(dailyRate7 / baselineFreq, 2);
  const frequency = Math.round((freqRatio / 2) * 25);

  // ─── 3. Feature Depth (20pts) ───────────────────────────
  const KNOWN_FEATURES = ['payments', 'settlements', 'refunds', 'analytics', 'webhooks', 'reports', 'notifications', 'ledger'];
  const usedFeatures = new Set(events.map(e => e.feature).filter(Boolean));
  const feature_depth = Math.round((usedFeatures.size / KNOWN_FEATURES.length) * 20);

  // ─── 4. Trend (20pts) ───────────────────────────────────
  // Linear regression slope on daily counts (last 14 days)
  const dailyCounts: number[] = Array(14).fill(0);
  events.forEach(e => {
    const age = Math.floor((now - new Date(e.timestamp).getTime()) / (1000 * 60 * 60 * 24));
    if (age < 14) dailyCounts[13 - age]++;
  });
  const n = 14;
  const xMean = 6.5;
  const yMean = dailyCounts.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  dailyCounts.forEach((y, x) => { num += (x - xMean) * (y - yMean); den += (x - xMean) ** 2; });
  const slope = den > 0 ? num / den : 0;
  // Normalize slope: +0.5/day → 20pts, -0.5/day → 0pts
  const trend = Math.max(0, Math.min(20, Math.round((slope / 0.5 + 1) * 10)));

  // ─── 5. Error rate (10pts) ──────────────────────────────
  const withStatus = events.filter(e => e.status_code !== undefined);
  const errorRate = withStatus.length > 0
    ? withStatus.filter(e => (e.status_code ?? 200) >= 400).length / withStatus.length
    : 0;
  const error_rate = Math.round((1 - errorRate) * 10);

  // ─── Composite ──────────────────────────────────────────
  const score = Math.min(100, Math.round(recency + frequency + feature_depth + trend + error_rate));

  // ─── Heuristic churn probability (until ML model is deployed) ─
  // Logistic-like curve: score 30 → 0.85, score 70 → 0.15
  const churn_probability = parseFloat((1 / (1 + Math.exp((score - 50) / 12))).toFixed(3));

  return {
    score, churn_probability,
    dimensions: {
      recency: Math.round(recency),
      frequency: Math.round(frequency),
      feature_depth,
      trend,
      error_rate,
    },
    computed_at: new Date().toISOString(),
    events_analyzed: events.length,
  };
}
