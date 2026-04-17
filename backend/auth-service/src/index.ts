import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth';
import { orgRouter } from './routes/org';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './lib/logger';

const app = express();

// ─── Security Middleware ─────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));

// ─── Routes ──────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth-service' }));
app.use('/auth', authRouter);
app.use('/org', orgRouter);

// ─── Error Handler ───────────────────────────────────────
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`🔐 Auth Service running on port ${PORT}`);
});

export default app;
