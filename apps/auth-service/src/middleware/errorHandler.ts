import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Unexpected error — don't leak internals
  logger.error({ err, url: req.url, method: req.method }, 'Unhandled error');
  return res.status(500).json({ error: 'Internal server error' });
}
