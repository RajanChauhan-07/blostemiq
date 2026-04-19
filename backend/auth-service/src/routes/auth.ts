import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { generateTokens, verifyRefreshToken, revokeRefreshToken } from '../lib/jwt';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';
import { AppError } from '../lib/errors';
import { rateLimit } from 'express-rate-limit';
import { getDeviceFingerprint } from '../lib/fingerprint';
import { syncDefaultEntitlements } from '../lib/entitlements';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';

export const authRouter = Router();

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many auth attempts. Try again in 15 minutes.' }
});

// ─── Validation Schemas ──────────────────────────────────
const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  fullName: z.string().min(2).max(100),
  orgName: z.string().min(2).max(100),
});

const SigninSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// ─── POST /auth/signup ────────────────────────────────────
authRouter.post('/signup', authLimiter, async (req: Request, res: Response) => {
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0].message, 400);
  }

  const { email, password, fullName, orgName } = parsed.data;

  // Check if user exists
  const existing = await prisma.users.findUnique({ where: { email } });
  if (existing) throw new AppError('Email already in use', 409);

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create org slug
  const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 50)
    + '-' + Math.random().toString(36).slice(2, 6);

  // Create user + org + membership in transaction
  const { user, org } = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const newUser = await tx.users.create({
      data: { email, hashed_password: hashedPassword, full_name: fullName }
    });
    const newOrg = await tx.organizations.create({
      data: { name: orgName, slug }
    });
    await syncDefaultEntitlements(tx, newOrg.id, newOrg.plan);
    await tx.memberships.create({
      data: { user_id: newUser.id, org_id: newOrg.id, role: 'admin' }
    });
    await tx.audit_logs.create({
      data: {
        org_id: newOrg.id,
        user_id: newUser.id,
        action: 'USER_SIGNUP',
        resource: 'user',
        resource_id: newUser.id,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      }
    });
    return { user: newUser, org: newOrg };
  });

  logger.info({ userId: user.id, orgId: org.id }, 'New user + org created');

  const deviceFp = getDeviceFingerprint(req);
  const { accessToken, refreshToken } = await generateTokens(user.id, org.id, 'admin', deviceFp, req.ip || '');

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  res.status(201).json({
    accessToken,
    user: { id: user.id, email: user.email, fullName: user.full_name },
    org: { id: org.id, name: org.name, slug: org.slug, plan: org.plan }
  });
});

// ─── POST /auth/signin ────────────────────────────────────
authRouter.post('/signin', authLimiter, async (req: Request, res: Response) => {
  const parsed = SigninSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError('Invalid credentials', 401);

  const { email, password } = parsed.data;

  const user = await prisma.users.findUnique({
    where: { email },
    include: {
      memberships: {
        include: { organizations: true },
        take: 1,
        orderBy: { joined_at: 'asc' }
      }
    }
  });

  if (!user || !user.hashed_password) throw new AppError('Invalid credentials', 401);

  const valid = await bcrypt.compare(password, user.hashed_password);
  if (!valid) throw new AppError('Invalid credentials', 401);

  const membership = user.memberships[0];
  if (!membership) throw new AppError('No organization found', 403);

  const deviceFp = getDeviceFingerprint(req);
  const { accessToken, refreshToken } = await generateTokens(
    user.id, membership.org_id, membership.role, deviceFp, req.ip || ''
  );

  // Update last login
  await prisma.users.update({ where: { id: user.id }, data: { last_login_at: new Date() } });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.json({
    accessToken,
    user: { id: user.id, email: user.email, fullName: user.full_name },
    org: {
      id: membership.org_id,
      name: membership.organizations.name,
      slug: membership.organizations.slug,
      plan: membership.organizations.plan,
    },
    role: membership.role
  });
});

// ─── POST /auth/refresh ───────────────────────────────────
authRouter.post('/refresh', async (req: Request, res: Response) => {
  const token = req.cookies.refresh_token;
  if (!token) throw new AppError('No refresh token', 401);

  const payload = await verifyRefreshToken(token);
  const { accessToken, refreshToken } = await generateTokens(
    payload.userId, payload.orgId, payload.role,
    getDeviceFingerprint(req), req.ip || '',
    payload.family // maintain token family for rotation detection
  );

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.json({ accessToken });
});

// ─── POST /auth/signout ───────────────────────────────────
authRouter.post('/signout', async (req: Request, res: Response) => {
  const token = req.cookies.refresh_token;
  if (token) {
    await revokeRefreshToken(token).catch(() => {}); // silently revoke
  }
  res.clearCookie('refresh_token');
  res.json({ message: 'Signed out successfully' });
});

// ─── GET /auth/me ─────────────────────────────────────────
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const payload = req.auth;
  if (!payload) throw new AppError('Unauthorized', 401);
  const user = await prisma.users.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, full_name: true, avatar_url: true, created_at: true }
  });

  if (!user) throw new AppError('User not found', 404);
  res.json({ user });
});
