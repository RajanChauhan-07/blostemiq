import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { errorHandler } from './middleware/errorHandler';
import { requireAuth, requireIngestAuth } from './middleware/auth';
import { logger } from './lib/logger';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'], credentials: true }));
app.use(express.json({ limit: '1mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Health (must work even before DB connects) ───────────
app.get('/health', (_req, res) => res.json({
  status: 'ok',
  service: 'partner-service',
  timestamp: new Date().toISOString(),
}));

// ─── Routes (lazy-loaded to avoid crash on missing deps) ──
async function mountRoutes() {
  try {
    const { partnersRouter } = await import('./routes/partners');
    const { ingestRouter }   = await import('./routes/ingest');
    const { healthRouter }   = await import('./routes/health');
    app.use('/partners', apiLimiter, requireAuth, partnersRouter);
    app.use('/ingest', ingestLimiter, requireIngestAuth, ingestRouter);
    app.use('/health-scores', apiLimiter, requireAuth, healthRouter);
    logger.info('✅ Routes mounted');
  } catch (err) {
    logger.warn({ err }, '⚠️  Some routes failed to mount — check DB/Kafka env vars');
  }
}

app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────
async function start() {
  // Mount routes (best-effort)
  await mountRoutes();

  // Connect to Kafka (best-effort)
  try {
    const { kafka } = await import('./lib/kafka');
    await kafka.producer().connect();
    logger.info('✅ Kafka producer connected');
  } catch (err) {
    logger.warn({ err }, '⚠️  Kafka not available — events will not be published');
  }

  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => logger.info(`🤝 Partner Service running on port ${PORT}`));
}

start().catch(err => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});

export default app;
