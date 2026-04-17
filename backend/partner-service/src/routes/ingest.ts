import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getProducer, TOPICS } from '../lib/kafka';
import { dynamo, TABLES } from '../lib/dynamo';
import { cacheDel } from '../lib/redis';
import { logger } from '../lib/logger';
import { AppError } from '../middleware/errorHandler';

export const ingestRouter = Router();

// ─── Schema ───────────────────────────────────────────────
const EventSchema = z.object({
  partner_id:  z.string().uuid(),
  event_type:  z.enum(['api_call', 'login', 'feature_used', 'error', 'webhook', 'report_viewed', 'settings_changed']),
  feature:     z.string().max(100).optional(),
  status_code: z.number().int().min(100).max(599).optional(),
  payload_size:z.number().int().min(0).optional(),
  metadata:    z.record(z.unknown()).optional(),
});

const BatchSchema = z.object({
  events: z.array(EventSchema).min(1).max(500),
});

// ─── POST /ingest/event ───────────────────────────────────
// Single event — SDK/partner sends this on every API call
ingestRouter.post('/event', async (req: Request, res: Response) => {
  const orgId = req.headers['x-org-id'] as string;
  if (!orgId) throw new AppError('Missing x-org-id header', 400);

  const parsed = EventSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);

  const event = parsed.data;
  const timestamp = new Date().toISOString();
  const eventId = uuid();

  // Write to DynamoDB (time-series store)
  await dynamo.send(new PutCommand({
    TableName: TABLES.PARTNER_EVENTS,
    Item: {
      org_id:       `${orgId}#${event.partner_id}`,
      timestamp,
      event_id:     eventId,
      event_type:   event.event_type,
      feature:      event.feature,
      status_code:  event.status_code,
      payload_size: event.payload_size,
      metadata:     event.metadata,
      // TTL: 1 year
      expires_at:   Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
    },
  }));

  // Invalidate health score cache for this partner
  await cacheDel(`health:${orgId}:${event.partner_id}`);

  // Publish to Kafka
  try {
    const producer = await getProducer();
    await producer.send({
      topic: TOPICS.PARTNER_EVENTS,
      messages: [{
        key: `${orgId}#${event.partner_id}`,
        value: JSON.stringify({ orgId, ...event, timestamp, eventId }),
        headers: { source: 'partner-service', version: '1' },
      }],
    });
  } catch (err) {
    logger.warn({ err }, 'Kafka publish failed — event still stored in DynamoDB');
  }

  res.status(202).json({ eventId, timestamp });
});

// ─── POST /ingest/batch ───────────────────────────────────
// Batch ingestion — for SDK buffering (up to 500 events)
ingestRouter.post('/batch', async (req: Request, res: Response) => {
  const orgId = req.headers['x-org-id'] as string;
  if (!orgId) throw new AppError('Missing x-org-id header', 400);

  const parsed = BatchSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);

  const { events } = parsed.data;
  const timestamp = new Date().toISOString();
  const results: { eventId: string }[] = [];

  // Write all to DynamoDB in parallel (25-item batches respect DynamoDB limits)
  const chunks = Array.from({ length: Math.ceil(events.length / 25) }, (_, i) =>
    events.slice(i * 25, (i + 1) * 25)
  );

  await Promise.all(chunks.map(async chunk => {
    await Promise.all(chunk.map(async event => {
      const eventId = uuid();
      await dynamo.send(new PutCommand({
        TableName: TABLES.PARTNER_EVENTS,
        Item: {
          org_id:      `${orgId}#${event.partner_id}`,
          timestamp:   new Date().toISOString(),
          event_id:    eventId,
          event_type:  event.event_type,
          feature:     event.feature,
          status_code: event.status_code,
          metadata:    event.metadata,
          expires_at:  Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
        },
      }));
      results.push({ eventId });
    }));
  }));

  // Invalidate all affected partner caches
  const partnerIds = [...new Set(events.map(e => e.partner_id))];
  await Promise.all(partnerIds.map(pid => cacheDel(`health:${orgId}:${pid}`)));

  // Single bulk Kafka message
  try {
    const producer = await getProducer();
    await producer.send({
      topic: TOPICS.PARTNER_EVENTS,
      messages: events.map(event => ({
        key: `${orgId}#${event.partner_id}`,
        value: JSON.stringify({ orgId, ...event, timestamp }),
      })),
    });
  } catch (err) {
    logger.warn({ err }, 'Kafka batch publish failed');
  }

  res.status(202).json({ accepted: results.length, timestamp });
});

// ─── GET /ingest/events/:partnerId — recent events ────────
ingestRouter.get('/events/:partnerId', async (req: Request, res: Response) => {
  const orgId = req.headers['x-org-id'] as string;
  if (!orgId) throw new AppError('Missing x-org-id header', 400);

  const { partnerId } = req.params;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const since = req.query.since as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const result = await dynamo.send(new QueryCommand({
    TableName: TABLES.PARTNER_EVENTS,
    KeyConditionExpression: 'org_id = :oid AND #ts >= :since',
    ExpressionAttributeNames: { '#ts': 'timestamp' },
    ExpressionAttributeValues: { ':oid': `${orgId}#${partnerId}`, ':since': since },
    ScanIndexForward: false,
    Limit: limit,
  }));

  res.json({ events: result.Items || [], count: result.Count });
});
