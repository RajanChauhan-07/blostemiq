import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

interface AuditEntry {
  orgId: string;
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordAuditLog(entry: AuditEntry) {
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO audit_logs (
        id,
        org_id,
        user_id,
        action,
        resource,
        resource_id,
        ip_address,
        user_agent,
        metadata,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        ${entry.orgId}::uuid,
        ${entry.userId ?? null}::uuid,
        ${entry.action},
        ${entry.resource},
        ${entry.resourceId ?? null}::uuid,
        ${entry.ipAddress ?? null}::inet,
        ${entry.userAgent ?? null},
        CAST(${JSON.stringify(entry.metadata ?? {})} AS jsonb),
        NOW()
      )
    `,
  );
}
