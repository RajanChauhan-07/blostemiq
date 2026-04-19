import { Router, Response } from 'express';
import { computeHealthScore } from '../lib/healthScore';
import { AppError } from '../middleware/errorHandler';
import { getProducer, TOPICS } from '../lib/kafka';
import { logger } from '../lib/logger';
import type { AuthenticatedRequest } from '../middleware/auth';

export const healthRouter = Router();

const CHURN_ALERT_THRESHOLD = 0.75; // 75% churn probability → fire alert

// ─── GET /health-scores/:partnerId ───────────────────────
healthRouter.get('/:partnerId', async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.auth?.orgId;
  if (!orgId) throw new AppError('Unauthorized', 401);

  const score = await computeHealthScore(orgId, req.params.partnerId);
  return res.json({ ...score, partner_id: req.params.partnerId, org_id: orgId });
});

// ─── POST /health-scores/batch ────────────────────────────
// Recompute health for all partners in org (called by cron)
healthRouter.post('/batch', async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.auth?.orgId;
  if (!orgId) throw new AppError('Unauthorized', 401);

  const { partner_ids } = req.body as { partner_ids: string[] };
  if (!Array.isArray(partner_ids) || partner_ids.length === 0)
    throw new AppError('partner_ids array required', 400);

  const results = await Promise.allSettled(
    partner_ids.map(pid => computeHealthScore(orgId, pid))
  );

  const scores: Record<string, unknown> = {};
  const alerts: string[] = [];

  results.forEach((result, i) => {
    const pid = partner_ids[i];
    if (result.status === 'fulfilled') {
      scores[pid] = result.value;

      // Auto-publish churn alert if above threshold
      if (result.value.churn_probability >= CHURN_ALERT_THRESHOLD) {
        alerts.push(pid);
        publishChurnAlert(orgId, pid, result.value.churn_probability, result.value.score);
      }
    } else {
      logger.error({ err: result.reason, partnerId: pid }, 'Failed to compute health score');
    }
  });

  res.json({
    computed: Object.keys(scores).length,
    churn_alerts_fired: alerts.length,
    alert_partner_ids: alerts,
    scores,
  });
});

// ─── Publish churn alert to Kafka ─────────────────────────
async function publishChurnAlert(orgId: string, partnerId: string, probability: number, score: number) {
  try {
    const producer = await getProducer();
    await producer.send({
      topic: TOPICS.CHURN_ALERTS,
      messages: [{
        key: `${orgId}#${partnerId}`,
        value: JSON.stringify({
          org_id: orgId,
          partner_id: partnerId,
          churn_probability: probability,
          health_score: score,
          alert_at: new Date().toISOString(),
          severity: probability >= 0.9 ? 'critical' : 'high',
        }),
      }],
    });
    logger.info({ orgId, partnerId, probability }, '🚨 Churn alert published');
  } catch (err) {
    logger.error({ err }, 'Failed to publish churn alert');
  }
}
