import { Prisma } from '@prisma/client';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { computeHealthScore } from './healthScore';
import { dynamo, TABLES } from './dynamo';
import { prisma } from './prisma';

interface StoredEvent {
  event_type: string;
  timestamp: string;
}

export async function ensurePartnerAccess(orgId: string, partnerId: string) {
  const partner = await prisma.partners.findFirst({
    where: {
      id: partnerId,
      org_id: orgId,
      deleted_at: null,
    },
  });

  return partner;
}

export async function appendPartnerEvent(orgId: string, partnerId: string, eventType: string, payload: Record<string, unknown>) {
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO partner_events (
        id,
        partner_id,
        org_id,
        event_type,
        payload,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        ${partnerId}::uuid,
        ${orgId}::uuid,
        ${eventType},
        CAST(${JSON.stringify(payload)} AS jsonb),
        NOW()
      )
    `,
  );
}

async function loadRecentEvents(orgId: string, partnerId: string) {
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

  return (result.Items || []) as StoredEvent[];
}

export async function syncPartnerMetrics(orgId: string, partnerId: string) {
  const [partner, healthScore, events] = await Promise.all([
    prisma.partners.findFirst({
      where: { id: partnerId, org_id: orgId, deleted_at: null },
      select: { metadata: true },
    }),
    computeHealthScore(orgId, partnerId),
    loadRecentEvents(orgId, partnerId),
  ]);

  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  const apiCallsLast24Hours = events.filter((event) =>
    event.event_type === 'api_call' && new Date(event.timestamp).getTime() >= twentyFourHoursAgo
  ).length;

  let mrr = 0;
  try {
    const metadata = partner?.metadata ? JSON.parse(partner.metadata) as Record<string, unknown> : {};
    const rawMrr = metadata.mrr;
    if (typeof rawMrr === 'number') {
      mrr = rawMrr;
    } else if (typeof rawMrr === 'string') {
      const parsed = Number(rawMrr);
      if (Number.isFinite(parsed)) mrr = parsed;
    }
  } catch {
    mrr = 0;
  }

  await prisma.$executeRaw(
    Prisma.sql`
      DELETE FROM partner_metrics
      WHERE org_id = ${orgId}::uuid
        AND partner_id = ${partnerId}::uuid
    `,
  );

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO partner_metrics (
        id,
        partner_id,
        org_id,
        health_score,
        mrr,
        api_calls,
        churn_risk,
        nps,
        recorded_at
      )
      VALUES (
        gen_random_uuid(),
        ${partnerId}::uuid,
        ${orgId}::uuid,
        ${healthScore.score},
        ${mrr},
        ${apiCallsLast24Hours},
        ${healthScore.churn_probability},
        70,
        NOW()
      )
    `,
  );

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO partner_metric_snapshots (
        id,
        partner_id,
        org_id,
        snapshot_date,
        health_score,
        mrr,
        api_calls,
        churn_risk,
        nps,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        ${partnerId}::uuid,
        ${orgId}::uuid,
        CURRENT_DATE,
        ${healthScore.score},
        ${mrr},
        ${apiCallsLast24Hours},
        ${healthScore.churn_probability},
        70,
        NOW()
      )
      ON CONFLICT (partner_id, snapshot_date)
      DO UPDATE SET
        health_score = EXCLUDED.health_score,
        mrr = EXCLUDED.mrr,
        api_calls = EXCLUDED.api_calls,
        churn_risk = EXCLUDED.churn_risk,
        nps = EXCLUDED.nps,
        created_at = NOW()
    `,
  );

  return {
    healthScore: healthScore.score,
    churnRisk: healthScore.churn_probability,
    apiCallsLast24Hours,
    eventsAnalyzed: healthScore.events_analyzed,
  };
}
