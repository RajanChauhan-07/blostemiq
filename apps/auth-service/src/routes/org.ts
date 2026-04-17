import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

export const orgRouter = Router();

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'analyst', 'viewer']),
});

// ─── GET /org/:orgId ─────────────────────────────────────
orgRouter.get('/:orgId', async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const org = await prisma.organizations.findUnique({
    where: { id: orgId },
    include: {
      memberships: {
        include: { users: { select: { id: true, email: true, full_name: true, avatar_url: true } } }
      }
    }
  });
  if (!org) throw new AppError('Organization not found', 404);
  res.json({ org });
});

// ─── POST /org/:orgId/invite ──────────────────────────────
orgRouter.post('/:orgId/invite', async (req: Request, res: Response) => {
  const parsed = InviteSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);

  const { email, role } = parsed.data;
  const { orgId } = req.params;

  // Check org exists
  const org = await prisma.organizations.findUnique({ where: { id: orgId } });
  if (!org) throw new AppError('Organization not found', 404);

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

  res.status(201).json({ message: `${email} added to org as ${role}` });
});

// ─── PATCH /org/:orgId/members/:userId/role ───────────────
orgRouter.patch('/:orgId/members/:userId/role', async (req: Request, res: Response) => {
  const { orgId, userId } = req.params;
  const { role } = z.object({ role: z.enum(['admin', 'analyst', 'viewer']) }).parse(req.body);

  await prisma.memberships.update({
    where: { user_id_org_id: { user_id: userId, org_id: orgId } },
    data: { role }
  });

  res.json({ message: 'Role updated' });
});
