import { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors';
import { verifyAccessToken, type AccessTokenPayload } from '../lib/jwt';

export interface AuthenticatedRequest extends Request {
  auth?: AccessTokenPayload;
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized', 401));
  }

  try {
    const token = authHeader.slice('Bearer '.length);
    req.auth = verifyAccessToken(token);
    return next();
  } catch (error) {
    return next(error);
  }
}
