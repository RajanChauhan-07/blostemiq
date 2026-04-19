import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { getEntitlement } from '../lib/entitlements';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';

export const orgRouter = Router();
orgRouter.use(requireAuth);

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'analyst', 'viewer']),
});

const DeleteOrgSchema = z.object({
  confirmation: z.literal('DELETE'),
  slug: z.string().min(1),
});

async function requireAdmin(orgId: string, userId: string) {
  const membership = await prisma.memberships.findUnique({
    where: { user_id_org_id: { user_id: userId, org_id: orgId } }
  });

  if (!membership || membership.role !== 'admin') {
    throw new AppError('Forbidden', 403);
  }

  return membership;
}

// ─── GET /org/:orgId ─────────────────────────────────────
orgRouter.get('/:orgId', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.auth) throw new AppError('Unauthorized', 401);
  const { orgId } = req.params;
  if (orgId !== req.auth.orgId) throw new AppError('Forbidden', 403);

  const org = await prisma.organizations.findUnique({
    where: { id: orgId },
    include: {
      memberships: {
        include: { users: { select: { id: true, email: true, full_name: true, avatar_url: true } } }
      }
    }
  });
  if (!org) throw new AppError('Organization not found', 404);

  const membership = await prisma.memberships.findUnique({
    where: { user_id_org_id: { user_id: req.auth.sub, org_id: orgId } }
  });
  if (!membership) throw new AppError('Forbidden', 403);
  res.json({ org });
});

// ─── POST /org/:orgId/invite ──────────────────────────────
orgRouter.post('/:orgId/invite', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.auth) throw new AppError('Unauthorized', 401);
  const parsed = InviteSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);

  const { email, role } = parsed.data;
  const { orgId } = req.params;
  if (orgId !== req.auth.orgId) throw new AppError('Forbidden', 403);

  // Check org exists
  const org = await prisma.organizations.findUnique({ where: { id: orgId } });
  if (!org) throw new AppError('Organization not found', 404);

  const actorMembership = await prisma.memberships.findUnique({
    where: { user_id_org_id: { user_id: req.auth.sub, org_id: orgId } }
  });
  if (!actorMembership || actorMembership.role !== 'admin') throw new AppError('Forbidden', 403);

  const seatEntitlement = await getEntitlement(prisma, orgId, 'seats');
  if (seatEntitlement.isEnabled && seatEntitlement.quotaLimit !== null) {
    const memberCount = await prisma.memberships.count({ where: { org_id: orgId } });
    if (memberCount >= seatEntitlement.quotaLimit) {
      throw new AppError(`Seat limit reached for this plan (${seatEntitlement.quotaLimit})`, 409);
    }
  }

  // Check invitee user exists (must have signed up first)
  const invitee = await prisma.users.findUnique({ where: { email } });
  if (!invitee) throw new AppError('User with that email has not signed up yet', 404);

  // Check if already a member
  const existing = await prisma.memberships.findUnique({
    where: { user_id_org_id: { user_id: invitee.id, org_id: orgId } }
  });
  if (existing) throw new AppError('User is already a member of this org', 409);

  await prisma.memberships.create({
    data: { user_id: invitee.id, org_id: orgId, role }
  });

  await prisma.audit_logs.create({
    data: {
      org_id: orgId,
      user_id: req.auth.sub,
      action: 'ORG_MEMBER_INVITED',
      resource: 'membership',
      resource_id: invitee.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    }
  });

  res.status(201).json({ message: `${email} added to org as ${role}` });
});

// ─── PATCH /org/:orgId/members/:userId/role ───────────────
orgRouter.patch('/:orgId/members/:userId/role', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.auth) throw new AppError('Unauthorized', 401);
  const { orgId, userId } = req.params;
  const { role } = z.object({ role: z.enum(['admin', 'analyst', 'viewer']) }).parse(req.body);
  if (orgId !== req.auth.orgId) throw new AppError('Forbidden', 403);

  await requireAdmin(orgId, req.auth.sub);

  await prisma.memberships.update({
    where: { user_id_org_id: { user_id: userId, org_id: orgId } },
    data: { role }
  });

  await prisma.audit_logs.create({
    data: {
      org_id: orgId,
      user_id: req.auth.sub,
      action: 'ORG_MEMBER_ROLE_UPDATED',
      resource: 'membership',
      resource_id: userId,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    }
  });

  res.json({ message: 'Role updated' });
});

orgRouter.get('/:orgId/audit-logs', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.auth) throw new AppError('Unauthorized', 401);
  const { orgId } = req.params;
  if (orgId !== req.auth.orgId) throw new AppError('Forbidden', 403);

  const membership = await prisma.memberships.findUnique({
    where: { user_id_org_id: { user_id: req.auth.sub, org_id: orgId } }
  });
  if (!membership || !['admin', 'analyst'].includes(membership.role)) {
    throw new AppError('Forbidden', 403);
  }

  const entries = await prisma.audit_logs.findMany({
    where: { org_id: orgId },
    orderBy: { created_at: 'desc' },
    take: 100,
    include: {
      users: {
        select: {
          id: true,
          email: true,
          full_name: true,
        },
      },
    },
  });

  res.json({ audit_logs: entries });
});

orgRouter.get('/:orgId/export', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.auth) throw new AppError('Unauthorized', 401);
  const { orgId } = req.params;
  if (orgId !== req.auth.orgId) throw new AppError('Forbidden', 403);

  const membership = await prisma.memberships.findUnique({
    where: { user_id_org_id: { user_id: req.auth.sub, org_id: orgId } }
  });
  if (!membership || !['admin', 'analyst'].includes(membership.role)) {
    throw new AppError('Forbidden', 403);
  }

  const [orgRowsResult, members, partnersResult, apiKeysResult, subscriptionsResult, entitlementsResult, auditLogs, outreachSequencesResult, outreachMessagesResult] = await Promise.all([
    prisma.$queryRawUnsafe(
      `
        SELECT
          id::text,
          name,
          slug,
          plan,
          settings,
          created_at,
          updated_at
        FROM organizations
        WHERE id = $1::uuid
        LIMIT 1
      `,
      orgId,
    ),
    prisma.memberships.findMany({
      where: { org_id: orgId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            full_name: true,
            avatar_url: true,
            created_at: true,
            last_login_at: true,
          },
        },
      },
      orderBy: { joined_at: 'asc' },
    }),
    prisma.$queryRawUnsafe(
      `
        SELECT
          id::text,
          name,
          domain,
          tier,
          contact_email,
          contact_name,
          tags,
          metadata,
          created_at,
          updated_at
        FROM partners
        WHERE org_id = $1::uuid
        ORDER BY created_at ASC
      `,
      orgId,
    ),
    prisma.$queryRawUnsafe(
      `
        SELECT
          id::text,
          name,
          key_prefix,
          permissions,
          is_active,
          last_used_at,
          expires_at,
          created_at
        FROM api_keys
        WHERE org_id = $1::uuid
        ORDER BY created_at DESC
      `,
      orgId,
    ),
    prisma.$queryRawUnsafe(
      `
        SELECT
          id::text,
          provider,
          provider_customer_id,
          provider_subscription_id,
          plan,
          status,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          created_at,
          updated_at
        FROM subscriptions
        WHERE org_id = $1::uuid
        ORDER BY updated_at DESC
      `,
      orgId,
    ),
    prisma.$queryRawUnsafe(
      `
        SELECT
          id::text,
          feature_key,
          is_enabled,
          quota_limit,
          quota_period,
          created_at,
          updated_at
        FROM feature_entitlements
        WHERE org_id = $1::uuid
        ORDER BY feature_key ASC
      `,
      orgId,
    ),
    prisma.audit_logs.findMany({
      where: { org_id: orgId },
      include: {
        users: {
          select: { id: true, email: true, full_name: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 1000,
      }),
    prisma.$queryRawUnsafe(
      `
        SELECT
          id::text,
          partner_id::text,
          name,
          status,
          channel,
          config,
          created_at,
          updated_at
        FROM outreach_sequences
        WHERE org_id = $1::uuid
        ORDER BY created_at DESC
      `,
      orgId,
    ),
    prisma.$queryRawUnsafe(
      `
        SELECT
          id::text,
          sequence_id::text,
          partner_id::text,
          subject,
          status,
          provider_message_id,
          scheduled_at,
          sent_at,
          created_at
        FROM outreach_messages
        WHERE org_id = $1::uuid
        ORDER BY created_at DESC
      `,
      orgId,
    ),
  ]);

  const orgRows = orgRowsResult as Array<{
    id: string;
    name: string;
    slug: string;
    plan: string;
    settings: Record<string, unknown> | null;
    created_at: Date;
    updated_at: Date;
  }>;
  const partners = partnersResult as Array<Record<string, unknown>>;
  const apiKeys = apiKeysResult as Array<Record<string, unknown>>;
  const subscriptions = subscriptionsResult as Array<Record<string, unknown>>;
  const entitlements = entitlementsResult as Array<Record<string, unknown>>;
  const outreachSequences = outreachSequencesResult as Array<Record<string, unknown>>;
  const outreachMessages = outreachMessagesResult as Array<Record<string, unknown>>;

  const org = orgRows[0];
  if (!org) throw new AppError('Organization not found', 404);

  await prisma.audit_logs.create({
    data: {
      org_id: orgId,
      user_id: req.auth.sub,
      action: 'ORG_DATA_EXPORTED',
      resource: 'organization',
      resource_id: orgId,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      metadata: { exported_by_role: membership.role },
    }
  });

  res.json({
    generated_at: new Date().toISOString(),
    org,
    members,
    partners,
    api_keys: apiKeys,
    subscriptions,
    entitlements,
    audit_logs: auditLogs,
    outreach_sequences: outreachSequences,
    outreach_messages: outreachMessages,
  });
});

orgRouter.delete('/:orgId', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.auth) throw new AppError('Unauthorized', 401);
  const { orgId } = req.params;
  if (orgId !== req.auth.orgId) throw new AppError('Forbidden', 403);

  const parsed = DeleteOrgSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);

  await requireAdmin(orgId, req.auth.sub);

  const organization = await prisma.organizations.findUnique({
    where: { id: orgId },
    select: { id: true, slug: true },
  });
  if (!organization) throw new AppError('Organization not found', 404);
  if (parsed.data.slug !== organization.slug) throw new AppError('Confirmation slug does not match', 400);

  await prisma.organizations.delete({
    where: { id: orgId },
  });

  res.json({ message: 'Organization deleted permanently' });
});
