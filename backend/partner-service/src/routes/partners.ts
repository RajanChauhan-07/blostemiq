import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { prisma } from '../lib/prisma';
import { cacheGet, cacheSet, cacheDel } from '../lib/redis';
import { logger } from '../lib/logger';
import { AppError } from '../middleware/errorHandler';

export const partnersRouter = Router();

// ─── Schemas ──────────────────────────────────────────────
const CreatePartnerSchema = z.object({
  name:          z.string().min(2).max(100),
  domain:        z.string().url().optional(),
  tier:          z.enum(['basic', 'growth', 'enterprise']).default('basic'),
  contact_email: z.string().email().optional(),
  contact_name:  z.string().max(100).optional(),
  tags:          z.array(z.string()).max(10).optional(),
  metadata:      z.record(z.unknown()).optional(),
});

const UpdatePartnerSchema = CreatePartnerSchema.partial();

// ─── GET /partners ────────────────────────────────────────
partnersRouter.get('/', async (req: Request, res: Response) => {
  const orgId = req.headers['x-org-id'] as string;
  if (!orgId) throw new AppError('Missing x-org-id header', 400);

  const cacheKey = `partners:list:${orgId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json(cached);

  const partners = await prisma.partners.findMany({
    where: { org_id: orgId, deleted_at: null },
    orderBy: [{ tier: 'desc' }, { name: 'asc' }],
    select: {
      id: true, name: true, domain: true, tier: true,
      contact_email: true, contact_name: true,
      tags: true, created_at: true, metadata: true,
    },
  });

  const response = { partners, total: partners.length };
  await cacheSet(cacheKey, response, 60); // 1 min cache
  return res.json(response);
});

// ─── POST /partners ───────────────────────────────────────
partnersRouter.post('/', async (req: Request, res: Response) => {
  const orgId = req.headers['x-org-id'] as string;
  if (!orgId) throw new AppError('Missing x-org-id header', 400);

  const parsed = CreatePartnerSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);

  const partner = await prisma.partners.create({
    data: {
      id:            uuid(),
      org_id:        orgId,
      name:          parsed.data.name,
      domain:        parsed.data.domain,
      tier:          parsed.data.tier as string,
      contact_email: parsed.data.contact_email,
      contact_name:  parsed.data.contact_name,
      tags:          parsed.data.tags ? JSON.stringify(parsed.data.tags) : '[]',
      metadata:      parsed.data.metadata ? JSON.stringify(parsed.data.metadata) : '{}',
    },
  });

  await cacheDel(`partners:list:${orgId}`);
  logger.info({ partnerId: partner.id }, 'Partner created');
  return res.status(201).json({ partner });
});

// ─── GET /partners/:id ────────────────────────────────────
partnersRouter.get('/:id', async (req: Request, res: Response) => {
  const orgId = req.headers['x-org-id'] as string;
  if (!orgId) throw new AppError('Missing x-org-id header', 400);

  const cacheKey = `partner:${orgId}:${req.params.id}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json(cached);

  const partner = await prisma.partners.findFirst({
    where: { id: req.params.id, org_id: orgId, deleted_at: null },
  });
  if (!partner) throw new AppError('Partner not found', 404);

  await cacheSet(cacheKey, { partner }, 120);
  return res.json({ partner });
});

// ─── PATCH /partners/:id ──────────────────────────────────
partnersRouter.patch('/:id', async (req: Request, res: Response) => {
  const orgId = req.headers['x-org-id'] as string;
  if (!orgId) throw new AppError('Missing x-org-id header', 400);

  const parsed = UpdatePartnerSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);

  const existing = await prisma.partners.findFirst({
    where: { id: req.params.id, org_id: orgId, deleted_at: null },
  });
  if (!existing) throw new AppError('Partner not found', 404);

  const updated = await prisma.partners.update({
    where: { id: req.params.id },
    data: { ...parsed.data, updated_at: new Date() },
  });

  await Promise.all([
    cacheDel(`partner:${orgId}:${req.params.id}`),
    cacheDel(`partners:list:${orgId}`),
  ]);

  return res.json({ partner: updated });
});

// ─── DELETE /partners/:id (soft delete) ──────────────────
partnersRouter.delete('/:id', async (req: Request, res: Response) => {
  const orgId = req.headers['x-org-id'] as string;
  if (!orgId) throw new AppError('Missing x-org-id header', 400);

  const existing = await prisma.partners.findFirst({
    where: { id: req.params.id, org_id: orgId, deleted_at: null },
  });
  if (!existing) throw new AppError('Partner not found', 404);

  await prisma.partners.update({
    where: { id: req.params.id },
    data: { deleted_at: new Date() },
  });

  await Promise.all([
    cacheDel(`partner:${orgId}:${req.params.id}`),
    cacheDel(`partners:list:${orgId}`),
  ]);

  return res.status(204).send();
});
