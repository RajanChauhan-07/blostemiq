import Redis from 'ioredis';
import { Server } from 'socket.io';
import { broadcastToOrg, broadcastToPartner } from '../gateway/socketGateway';
import { logger } from '../lib/logger';

/**
 * Redis Subscriber
 * ────────────────
 * Listens on Redis pub/sub channels published by partner-service.
 * Channels:
 *  org:{orgId}:alerts          — churn alerts, health score changes
 *  org:{orgId}:partner:{pid}   — per-partner activity feed updates
 *
 * This is the PRIMARY real-time path (sub-10ms latency).
 * Kafka consumer is the FALLBACK for missed events.
 */

const CHANNELS = [
  'org:*:alerts',       // All org alert channels
  'org:*:activity',     // Activity feed updates
  'system:broadcast',   // Platform-wide announcements
];

export async function startRedisSubscriber(io: Server) {
  const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });

  try {
    await subscriber.connect();

    // Subscribe to all org channels using pattern
    await subscriber.psubscribe('org:*', (err, count) => {
      if (err) return logger.error({ err }, 'Redis psubscribe failed');
      logger.info(`✅ Redis subscriber: listening on ${count} pattern(s)`);
    });

    await subscriber.subscribe('system:broadcast', (err) => {
      if (err) logger.error({ err }, 'Redis system:broadcast subscribe failed');
    });

    // ─── Handle incoming messages ──────────────────────────
    subscriber.on('pmessage', (_pattern, channel, message) => {
      try {
        const payload = JSON.parse(message);
        handleChannelMessage(channel, payload);
      } catch (err) {
        logger.warn({ err, channel }, 'Failed to parse Redis message');
      }
    });

    subscriber.on('message', (channel, message) => {
      try {
        const payload = JSON.parse(message);
        if (channel === 'system:broadcast') {
          io.emit('SYSTEM_BROADCAST', payload);
        }
      } catch { /* ignore */ }
    });

    subscriber.on('error', (err) => logger.warn({ err }, 'Redis subscriber error'));

  } catch (err) {
    logger.warn({ err }, '⚠️  Redis subscriber unavailable — real-time alerts degraded');
  }
}

// ─── Route channel message to the right Socket.io room ───
function handleChannelMessage(channel: string, payload: unknown) {
  // channel format: org:{orgId}:alerts or org:{orgId}:partner:{partnerId}
  const parts = channel.split(':');
  // parts[0] = 'org', parts[1] = orgId, parts[2] = resource type

  if (parts[0] !== 'org' || parts.length < 3) return;

  const orgId = parts[1];
  const resource = parts[2];

  switch (resource) {
    case 'alerts': {
      const alert = payload as { type: string; severity: string; partner_id: string; churn_probability: number; health_score: number; timestamp: string; message: string };

      // Broadcast to ALL members of this org
      broadcastToOrg(orgId, 'CHURN_ALERT', {
        ...alert,
        receivedAt: new Date().toISOString(),
      });

      // Also broadcast to the specific partner room for detail views
      if (alert.partner_id) {
        broadcastToPartner(orgId, alert.partner_id, 'HEALTH_SCORE_UPDATE', {
          churn_probability: alert.churn_probability,
          health_score:      alert.health_score,
          severity:          alert.severity,
          updatedAt:         alert.timestamp,
        });
      }

      logger.info({ orgId, partnerId: alert.partner_id, severity: alert.severity }, '🚨 Alert relayed via WebSocket');
      break;
    }

    case 'activity': {
      broadcastToOrg(orgId, 'ACTIVITY_UPDATE', payload);
      break;
    }

    case 'partner': {
      // channel: org:{orgId}:partner:{partnerId}
      const partnerId = parts[3];
      if (partnerId) {
        broadcastToPartner(orgId, partnerId, 'PARTNER_EVENT', payload);
      }
      break;
    }

    default:
      logger.debug({ channel }, 'Unhandled Redis channel');
  }
}
