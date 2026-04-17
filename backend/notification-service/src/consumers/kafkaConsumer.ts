import { Kafka, logLevel } from 'kafkajs';
import { Server } from 'socket.io';
import { broadcastToOrg, broadcastToPartner } from '../gateway/socketGateway';
import { logger } from '../lib/logger';

/**
 * Kafka Consumer (fallback + lead scoring events)
 * ───────────────────────────────────────────────
 * Topics consumed:
 *  churn.alerts    — churn alerts (backup to Redis pub/sub)
 *  lead.scored     — new lead scored → notify analyst
 *  outreach.sent   — outreach email sent → confirm to user
 *  audit.log       — high-severity audit events (display as toast)
 */

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  logLevel: logLevel.WARN,
  retry: { initialRetryTime: 500, retries: 5 },
});

const TOPICS = {
  CHURN_ALERTS:  'churn.alerts',
  LEAD_SCORED:   'lead.scored',
  OUTREACH_SENT: 'outreach.sent',
  AUDIT_LOG:     'audit.log',
};

export async function startKafkaConsumer(_io: Server) {
  const consumer = kafka.consumer({
    groupId: 'notification-service-consumer',
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });

  try {
    await consumer.connect();

    await consumer.subscribe({
      topics: Object.values(TOPICS),
      fromBeginning: false,
    });

    await consumer.run({
      partitionsConsumedConcurrently: 3,
      eachMessage: async ({ topic, message }) => {
        try {
          const payload = JSON.parse(message.value?.toString() || '{}');
          routeKafkaEvent(topic, payload);
        } catch (err) {
          logger.warn({ err, topic }, 'Failed to parse Kafka message');
        }
      },
    });

    logger.info('✅ Kafka consumer started (churn.alerts, lead.scored, outreach.sent, audit.log)');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      await consumer.disconnect();
    });

  } catch (err) {
    logger.warn({ err }, '⚠️  Kafka consumer failed to start — notifications will only use Redis path');
  }
}

// ─── Route Kafka events to WebSocket rooms ────────────────
function routeKafkaEvent(topic: string, payload: Record<string, unknown>) {
  const orgId = payload.org_id as string;
  if (!orgId) return;

  switch (topic) {
    case TOPICS.CHURN_ALERTS: {
      // Dedup: Redis pub/sub fires first; Kafka is the durable backup
      // Frontend deduplicates by alert_id
      broadcastToOrg(orgId, 'CHURN_ALERT', {
        ...payload,
        source: 'kafka',
        receivedAt: new Date().toISOString(),
      });
      logger.info({ orgId, partnerId: payload.partner_id }, '🚨 Churn alert via Kafka');
      break;
    }

    case TOPICS.LEAD_SCORED: {
      // "New lead scored — 87/100 🔥" toast notification
      broadcastToOrg(orgId, 'LEAD_SCORED', {
        lead_id:     payload.lead_id,
        company:     payload.company,
        score:       payload.score,
        tier:        payload.score as number >= 80 ? 'hot' : payload.score as number >= 60 ? 'warm' : 'cold',
        scored_at:   payload.scored_at ?? new Date().toISOString(),
      });
      logger.info({ orgId, leadId: payload.lead_id, score: payload.score }, '🎯 Lead scored');
      break;
    }

    case TOPICS.OUTREACH_SENT: {
      // "Outreach sent to Razorpay" confirmation
      broadcastToOrg(orgId, 'OUTREACH_SENT', {
        partner_id:  payload.partner_id,
        partner_name: payload.partner_name,
        email_type:  payload.email_type,   // 'churn_prevention' | 're_engagement'
        sent_at:     payload.sent_at ?? new Date().toISOString(),
      });
      if (payload.partner_id) {
        broadcastToPartner(orgId, payload.partner_id as string, 'OUTREACH_SENT', payload);
      }
      break;
    }

    case TOPICS.AUDIT_LOG: {
      // Only surface HIGH severity audit events to the dashboard
      if ((payload.severity as string) === 'HIGH') {
        broadcastToOrg(orgId, 'AUDIT_ALERT', {
          action:    payload.action,
          actor:     payload.actor_email,
          resource:  payload.resource,
          severity:  payload.severity,
          timestamp: payload.timestamp ?? new Date().toISOString(),
        });
      }
      break;
    }

    default:
      logger.debug({ topic }, 'Unhandled Kafka topic');
  }
}
