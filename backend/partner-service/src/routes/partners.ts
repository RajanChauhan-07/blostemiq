import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { prisma } from '../lib/prisma';
import { cacheGet, cacheSet, cacheDel } from '../lib/redis';
import { logger } from '../lib/logger';
import { AppError } from '../middleware/errorHandler';
import type { AuthenticatedRequest } from '../middleware/auth';
import { recordAuditLog } from '../lib/audit';
import { createApiKey, listApiKeys, revokeApiKey } from '../lib/apiKeys';
import { parseCsvRows } from '../lib/csv';
import { assertApiKeysEnabled, assertPartnerCapacity } from '../lib/entitlements';

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
const ImportPartnersSchema = z.object({
  csv: z.string().min(1),
});
const ApiKeyCreateSchema = z.object({
  name: z.string().min(3).max(100),
  permissions: z.array(z.string().min(1)).min(1).max(10).default(['ingest:write']),
  expires_at: z.string().datetime().optional(),
});

function requireAdmin(req: AuthenticatedRequest) {
  if (req.auth?.role !== 'admin') {
    throw new AppError('Forbidden', 403);
  }
}

partnersRouter.get('/api-keys', async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.auth?.orgId;
  if (!orgId) throw new AppError('Unauthorized', 401);
  requireAdmin(req);

  const keys = await listApiKeys(orgId);
  res.json({
    api_keys: keys.map((key) => ({
      id: key.id,
      name: key.name,
      key_prefix: key.key_prefix,
      permissions: key.permissions,
      is_active: key.is_active,
      expires_at: key.expires_at,
      last_used_at: key.last_used_at,
      created_at: key.created_at,
    })),
  });
});

partnersRouter.post('/api-keys', async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.auth?.orgId;
  if (!orgId || !req.auth?.sub) throw new AppError('Unauthorized', 401);
  requireAdmin(req);
  await assertApiKeysEnabled(orgId);

  const parsed = ApiKeyCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);

  const { rawKey, storedKey } = await createApiKey({
    orgId,
    createdBy: req.auth.sub,
    name: parsed.data.name,
    permissions: parsed.data.permissions,
    expiresAt: parsed.data.expires_at,
  });

  await recordAuditLog({
    orgId,
    userId: req.auth.sub,
    action: 'API_KEY_CREATED',
    resource: 'api_key',
    resourceId: storedKey.id,
    ipAddress: req.ip || null,
    userAgent: req.headers['user-agent'] || null,
    metadata: { name: storedKey.name, permissions: storedKey.permissions },
  });

  res.status(201).json({
    api_key: {
      id: storedKey.id,
      name: storedKey.name,
      key_prefix: storedKey.key_prefix,
      permissions: storedKey.permissions,
      expires_at: storedKey.expires_at,
      created_at: storedKey.created_at,
    },
    raw_key: rawKey,
  });
});

partnersRouter.delete('/api-keys/:id', async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.auth?.orgId;
  if (!orgId || !req.auth?.sub) throw new AppError('Unauthorized', 401);
  requireAdmin(req);

  const revoked = await revokeApiKey(orgId, req.params.id);
  if (!revoked) throw new AppError('API key not found', 404);

  await recordAuditLog({
    orgId,
    userId: req.auth.sub,
    action: 'API_KEY_REVOKED',
    resource: 'api_key',
    resourceId: req.params.id,
    ipAddress: req.ip || null,
    userAgent: req.headers['user-agent'] || null,
  });

  res.status(204).send();
});

partnersRouter.post('/import', async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.auth?.orgId;
  if (!orgId || !req.auth?.sub) throw new AppError('Unauthorized', 401);
  if (!req.auth || !['admin', 'analyst'].includes(req.auth.role)) {
    throw new AppError('Forbidden', 403);
  }

  const parsed = ImportPartnersSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);

  const rows = parseCsvRows(parsed.data.csv);
  if (rows.length === 0) throw new AppError('CSV file is empty', 400);
  const importableRows = rows.filter((row) => row.name?.trim()).length;
  await assertPartnerCapacity(orgId, importableRows);

  const results: Array<{ row: number; partner_id?: string; error?: string }> = [];

  for (const [index, row] of rows.entries()) {
    const name = row.name?.trim();
    if (!name) {
      results.push({ row: index + 2, error: 'Missing partner name' });
      continue;
    }

    const tags = (row.tags || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const partner = await prisma.partners.create({
      data: {
        id: uuid(),
        org_id: orgId,
        name,
        domain: row.domain?.trim() || undefined,
        tier: (row.tier || 'basic').trim(),
        contact_email: row.contact_email?.trim() || undefined,
        contact_name: row.contact_name?.trim() || undefined,
        tags: JSON.stringify(tags),
        metadata: JSON.stringify({ import_source: 'csv' }),
      },
    }).catch((error: unknown) => {
      results.push({
        row: index + 2,
        error: error instanceof Error ? error.message : 'Failed to create partner',
      });
      return null;
    });

    if (partner) {
      results.push({ row: index + 2, partner_id: partner.id });
    }
  }

  await cacheDel(`partners:list:${orgId}`);
  await recordAuditLog({
    orgId,
    userId: req.auth.sub,
    action: 'PARTNERS_IMPORTED',
    resource: 'partner',
    ipAddress: req.ip || null,
    userAgent: req.headers['user-agent'] || null,
    metadata: {
      total_rows: rows.length,
      created_count: results.filter((result) => result.partner_id).length,
      error_count: results.filter((result) => result.error).length,
    },
  });

  res.status(201).json({
    imported: results.filter((result) => result.partner_id).length,
    failed: results.filter((result) => result.error).length,
    results,
  });
});

// ─── GET /partners ────────────────────────────────────────
partnersRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.auth?.orgId;
  if (!orgId) throw new AppError('Unauthorized', 401);

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
partnersRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.auth?.orgId;
  if (!orgId || !req.auth?.sub) throw new AppError('Unauthorized', 401);

  const parsed = CreatePartnerSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);
  await assertPartnerCapacity(orgId, 1);

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
  await recordAuditLog({
    orgId,
    userId: req.auth.sub,
    action: 'PARTNER_CREATED',
    resource: 'partner',
    resourceId: partner.id,
    ipAddress: req.ip || null,
    userAgent: req.headers['user-agent'] || null,
    metadata: { name: partner.name, tier: partner.tier },
  });
  logger.info({ partnerId: partner.id }, 'Partner created');
  return res.status(201).json({ partner });
});

// ─── GET /partners/:id ────────────────────────────────────
partnersRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.auth?.orgId;
  if (!orgId) throw new AppError('Unauthorized', 401);

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
partnersRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.auth?.orgId;
  if (!orgId || !req.auth?.sub) throw new AppError('Unauthorized', 401);

  const parsed = UpdatePartnerSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);

  const existing = await prisma.partners.findFirst({
    where: { id: req.params.id, org_id: orgId, deleted_at: null },
  });
  if (!existing) throw new AppError('Partner not found', 404);

  const updated = await prisma.partners.update({
    where: { id: req.params.id },
    data: {
      ...parsed.data,
      tags: parsed.data.tags ? JSON.stringify(parsed.data.tags) : undefined,
      metadata: parsed.data.metadata ? JSON.stringify(parsed.data.metadata) : undefined,
      updated_at: new Date(),
    },
  });

  await Promise.all([
    cacheDel(`partner:${orgId}:${req.params.id}`),
    cacheDel(`partners:list:${orgId}`),
  ]);

  await recordAuditLog({
    orgId,
    userId: req.auth.sub,
    action: 'PARTNER_UPDATED',
    resource: 'partner',
    resourceId: req.params.id,
    ipAddress: req.ip || null,
    userAgent: req.headers['user-agent'] || null,
    metadata: parsed.data,
  });

  return res.json({ partner: updated });
});

// ─── DELETE /partners/:id (soft delete) ──────────────────
partnersRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.auth?.orgId;
  if (!orgId || !req.auth?.sub) throw new AppError('Unauthorized', 401);

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

  await recordAuditLog({
    orgId,
    userId: req.auth.sub,
    action: 'PARTNER_DELETED',
    resource: 'partner',
    resourceId: req.params.id,
    ipAddress: req.ip || null,
    userAgent: req.headers['user-agent'] || null,
    metadata: { name: existing.name },
  });

  return res.status(204).send();
});
