import Redis from 'ioredis';
import { logger } from './logger';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times) => Math.min(times * 100, 3000),
  lazyConnect: true,
});

redis.on('connect', () => logger.info('✅ Redis connected (partner-service)'));
redis.on('error', (err) => logger.warn({ err }, '⚠️  Redis error — continuing without cache'));

// ─── Cache helpers ────────────────────────────────────────
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const val = await redis.get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch { return null; }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300) {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch { /* non-critical */ }
}

export async function cacheDel(key: string) {
  try { await redis.del(key); } catch { /* non-critical */ }
}
