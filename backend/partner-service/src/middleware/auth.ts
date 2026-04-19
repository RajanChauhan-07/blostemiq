import { createHmac, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { AppError } from './errorHandler';
import { verifyApiKey } from '../lib/apiKeys';

interface AccessTokenPayload {
  sub: string;
  orgId: string;
  role: 'admin' | 'analyst' | 'viewer';
  type: 'access';
  authMethod?: 'bearer' | 'api_key';
  apiKeyId?: string;
  exp?: number;
  iat?: number;
  iss?: string;
}

export interface AuthenticatedRequest extends Request {
  auth?: AccessTokenPayload;
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function verifyAccessToken(token: string): AccessTokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new AppError('JWT_SECRET environment variable is required', 500);

  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new AppError('Invalid access token', 401);
  }

  const header = JSON.parse(base64UrlDecode(encodedHeader)) as { alg?: string; typ?: string };
  if (header.alg !== 'HS256') throw new AppError('Invalid access token', 401);

  const expected = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  const actual = Buffer.from(encodedSignature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new AppError('Invalid access token', 401);
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AccessTokenPayload;
  if (payload.type !== 'access' || !payload.sub || !payload.orgId || !payload.role) {
    throw new AppError('Invalid access token', 401);
  }
  if (payload.iss !== 'blostemiq-auth') throw new AppError('Invalid access token', 401);
  if (payload.exp && payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new AppError('Access token expired', 401);
  }

  return payload;
}

function ensureRequestedOrgMatches(req: AuthenticatedRequest, payload: AccessTokenPayload) {
  const requestedOrgId = req.headers['x-org-id'];
  if (typeof requestedOrgId === 'string' && requestedOrgId !== payload.orgId) {
    throw new AppError('Forbidden', 403);
  }
}

async function resolveAuth(req: AuthenticatedRequest) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const payload = verifyAccessToken(authHeader.slice('Bearer '.length));
    ensureRequestedOrgMatches(req, payload);
    return { ...payload, authMethod: 'bearer' as const };
  }

  const apiKeyHeader = req.headers['x-api-key'];
  if (typeof apiKeyHeader === 'string' && apiKeyHeader.trim()) {
    const apiKey = await verifyApiKey(apiKeyHeader.trim());
    if (!apiKey) throw new AppError('Invalid API key', 401);

    const payload: AccessTokenPayload = {
      sub: apiKey.created_by,
      orgId: apiKey.org_id,
      role: 'admin',
      type: 'access',
      iss: 'blostemiq-api-key',
      authMethod: 'api_key',
      apiKeyId: apiKey.id,
    };
    ensureRequestedOrgMatches(req, payload);
    return payload;
  }

  throw new AppError('Unauthorized', 401);
}

export async function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    const payload = await resolveAuth(req);
    req.auth = payload;
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function requireIngestAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  return requireAuth(req, res, next);
}
