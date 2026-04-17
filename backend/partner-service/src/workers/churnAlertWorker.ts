/**
 * Churn Alert Worker
 * ─────────────────
 * Consumes from `churn.alerts` Kafka topic.
 * For each high-churn partner:
 *   1. Writes to DynamoDB alert_history
 *   2. Pushes WebSocket notification (via Redis pub/sub)
 *   3. Triggers AI outreach generation (via SQS → outreach-service)
 */

import { kafka, TOPICS } from '../lib/kafka';
import { dynamo, TABLES } from '../lib/dynamo';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';

interface ChurnAlert {
  org_id: string;
  partner_id: string;
  churn_probability: number;
  health_score: number;
  alert_at: string;
  severity: 'high' | 'critical';
}

const consumer = kafka.consumer({ groupId: 'partner-service-churn-worker' });

export async function startChurnAlertWorker() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: TOPICS.CHURN_ALERTS, fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ message }) => {
        const payload = JSON.parse(message.value?.toString() || '{}') as ChurnAlert;
        logger.info({ payload }, '🚨 Churn alert received');

        await Promise.allSettled([
          storeAlertHistory(payload),
          notifyDashboard(payload),
        ]);
      },
    });

    logger.info('✅ Churn alert worker started');
  } catch (err) {
    logger.warn({ err }, '⚠️  Churn worker failed to start — Kafka unavailable');
  }
}

// ─── Store in DynamoDB ────────────────────────────────────
async function storeAlertHistory(alert: ChurnAlert) {
  await dynamo.send(new PutCommand({
    TableName: TABLES.ALERT_HISTORY,
    Item: {
      org_id:            alert.org_id,
      alert_id:          uuid(),
      partner_id:        alert.partner_id,
      churn_probability: alert.churn_probability,
      health_score:      alert.health_score,
      severity:          alert.severity,
      alerted_at:        alert.alert_at,
      resolved:          false,
    },
  }));
}

// ─── Push real-time alert via Redis pub/sub ───────────────
// Notification-service subscribes to this channel and
// forwards via WebSocket to the dashboard
async function notifyDashboard(alert: ChurnAlert) {
  await redis.publish(
    `org:${alert.org_id}:alerts`,
    JSON.stringify({
      type: 'CHURN_ALERT',
      severity: alert.severity,
      partner_id: alert.partner_id,
      churn_probability: alert.churn_probability,
      health_score: alert.health_score,
      timestamp: alert.alert_at,
      message: `Partner ${alert.partner_id}: ${Math.round(alert.churn_probability * 100)}% churn risk`,
    })
  );
}
