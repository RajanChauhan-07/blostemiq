import express from 'express';
import { createServer } from 'http';
import helmet from 'helmet';
import { initSocketGateway } from './gateway/socketGateway';
import { startKafkaConsumer } from './consumers/kafkaConsumer';
import { startRedisSubscriber } from './consumers/redisSubscriber';
import { logger } from './lib/logger';

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// Health endpoint (for K8s liveness probe)
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notification-service' }));
app.get('/metrics', (_req, res) => {
  const { getMetrics } = require('./gateway/socketGateway');
  res.json(getMetrics());
});

const httpServer = createServer(app);

async function start() {
  // 1. Init Socket.io gateway
  const io = initSocketGateway(httpServer);
  logger.info('✅ Socket.io gateway initialised');

  // 2. Subscribe to Redis pub/sub (receives alerts from partner-service)
  await startRedisSubscriber(io);

  // 3. Consume from Kafka (direct fallback + lead scoring events)
  await startKafkaConsumer(io);

  const PORT = process.env.PORT || 3004;
  httpServer.listen(PORT, () => {
    logger.info(`⚡ Notification Service running on port ${PORT}`);
  });
}

start().catch(err => {
  logger.error({ err }, 'Failed to start notification service');
  process.exit(1);
});
