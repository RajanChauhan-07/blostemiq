import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from './prisma';
import { createHash } from 'crypto';
import { AppError } from './errors';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 30;

interface TokenPayload {
  sub: string;
  orgId: string;
  role: string;
  type: 'access' | 'refresh';
  family?: string;
}

export interface AccessTokenPayload {
  sub: string;
  orgId: string;
  role: 'admin' | 'analyst' | 'viewer';
  type: 'access';
  iat?: number;
  exp?: number;
  iss?: string;
}

export async function generateTokens(
  userId: string,
  orgId: string,
  role: string,
  deviceFp: string,
  ipAddress: string,
  family: string = uuidv4()
) {
  // Access token — HS256 signed, 15 minutes
  const accessToken = jwt.sign(
    { sub: userId, orgId, role, type: 'access' },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL, issuer: 'blostemiq-auth' }
  );

  // Refresh token — opaque random token stored hashed in DB
  const rawRefreshToken = uuidv4() + uuidv4();
  const tokenHash = createHash('sha256').update(rawRefreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refresh_tokens.create({
    data: {
      user_id: userId,
      token_hash: tokenHash,
      family,
      device_fp: deviceFp,
      ip_address: ipAddress,
      expires_at: expiresAt,
    }
  });

  return { accessToken, refreshToken: rawRefreshToken };
}

export async function verifyRefreshToken(rawToken: string): Promise<{ userId: string; orgId: string; role: string; family: string }> {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  const stored = await prisma.refresh_tokens.findUnique({
    where: { token_hash: tokenHash },
    include: {
      users: {
        include: {
          memberships: {
            include: { organizations: true },
            take: 1,
            orderBy: { joined_at: 'asc' }
          }
        }
      }
    }
  });

  if (!stored) throw new AppError('Invalid refresh token', 401);
  if (stored.revoked_at) {
    // Token reuse detected — revoke entire family
    await prisma.refresh_tokens.updateMany({
      where: { family: stored.family },
      data: { revoked_at: new Date() }
    });
    throw new AppError('Refresh token reuse detected — please sign in again', 401);
  }
  if (stored.expires_at < new Date()) throw new AppError('Refresh token expired', 401);

  // Revoke the used token (rotation)
  await prisma.refresh_tokens.update({
    where: { id: stored.id },
    data: { revoked_at: new Date() }
  });

  const membership = stored.users.memberships[0];
  return {
    userId: stored.user_id,
    orgId: membership.org_id,
    role: membership.role,
    family: stored.family,
  };
}

export async function revokeRefreshToken(rawToken: string) {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  await prisma.refresh_tokens.updateMany({
    where: { token_hash: tokenHash },
    data: { revoked_at: new Date() }
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: 'blostemiq-auth',
  }) as jwt.JwtPayload;

  if (payload.type !== 'access' || !payload.sub || !payload.orgId || !payload.role) {
    throw new AppError('Invalid access token', 401);
  }

  return {
    sub: payload.sub,
    orgId: payload.orgId,
    role: payload.role as AccessTokenPayload['role'],
    type: 'access',
    iat: payload.iat,
    exp: payload.exp,
    iss: payload.iss,
  };
}
