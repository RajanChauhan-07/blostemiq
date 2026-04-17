import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { partnersRouter } from './routes/partners';
import { ingestRouter } from './routes/ingest';
import { healthRouter } from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { kafka } from './lib/kafka';
import { logger } from './lib/logger';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'], credentials: true }));
app.use(express.json({ limit: '1mb' }));

// ─── Routes ──────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'partner-service' }));
app.use('/partners', partnersRouter);
app.use('/ingest', ingestRouter);
app.use('/health-scores', healthRouter);

app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────
async function start() {
  // Connect to Kafka
  try {
    await kafka.producer().connect();
    logger.info('✅ Kafka producer connected');
  } catch (err) {
    logger.warn({ err }, '⚠️  Kafka not available — running in degraded mode');
  }

  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => logger.info(`🤝 Partner Service running on port ${PORT}`));
}

start();
export default app;
