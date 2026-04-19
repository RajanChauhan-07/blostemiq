import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { prisma } from './prisma';

export interface StoredApiKey {
  id: string;
  org_id: string;
  created_by: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  is_active: boolean;
  expires_at: Date | null;
  last_used_at: Date | null;
  created_at: Date;
}

export function hashApiKey(rawKey: string) {
  return createHash('sha256').update(rawKey).digest('hex');
}

export function generateApiKeySecret() {
  const token = randomBytes(24).toString('hex');
  return `bliq_${token}`;
}

export async function listApiKeys(orgId: string): Promise<StoredApiKey[]> {
  return prisma.$queryRaw<StoredApiKey[]>(
    Prisma.sql`
      SELECT
        id::text,
        org_id::text,
        created_by::text,
        name,
        key_prefix,
        permissions,
        is_active,
        expires_at,
        last_used_at,
        created_at
      FROM api_keys
      WHERE org_id = ${orgId}::uuid
      ORDER BY created_at DESC
    `,
  );
}

export async function createApiKey(input: {
  orgId: string;
  createdBy: string;
  name: string;
  permissions: string[];
  expiresAt?: string | null;
}) {
  const rawKey = generateApiKeySecret();
  const keyPrefix = rawKey.slice(0, 12);
  const hashedKey = hashApiKey(rawKey);

  const [storedKey] = await prisma.$queryRaw<StoredApiKey[]>(
    Prisma.sql`
      INSERT INTO api_keys (
        id,
        org_id,
        created_by,
        name,
        hashed_key,
        key_prefix,
        permissions,
        expires_at,
        is_active,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        ${input.orgId}::uuid,
        ${input.createdBy}::uuid,
        ${input.name},
        ${hashedKey},
        ${keyPrefix},
        ${input.permissions}::text[],
        ${input.expiresAt ?? null}::timestamptz,
        true,
        NOW()
      )
      RETURNING
        id::text,
        org_id::text,
        created_by::text,
        name,
        key_prefix,
        permissions,
        is_active,
        expires_at,
        last_used_at,
        created_at
    `,
  );

  return { rawKey, storedKey };
}

export async function revokeApiKey(orgId: string, apiKeyId: string) {
  const [row] = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      UPDATE api_keys
      SET is_active = false
      WHERE id = ${apiKeyId}::uuid
        AND org_id = ${orgId}::uuid
      RETURNING id::text
    `,
  );

  return row ?? null;
}

export async function verifyApiKey(rawKey: string) {
  const hashedKey = hashApiKey(rawKey);
  const rows = await prisma.$queryRaw<Array<StoredApiKey>>(
    Prisma.sql`
      SELECT
        id::text,
        org_id::text,
        created_by::text,
        name,
        key_prefix,
        permissions,
        is_active,
        expires_at,
        last_used_at,
        created_at
      FROM api_keys
      WHERE hashed_key = ${hashedKey}
        AND is_active = true
      LIMIT 1
    `,
  );

  const apiKey = rows[0];
  if (!apiKey) return null;
  if (apiKey.expires_at && new Date(apiKey.expires_at).getTime() <= Date.now()) {
    return null;
  }

  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE api_keys
      SET last_used_at = NOW()
      WHERE id = ${apiKey.id}::uuid
    `,
  );

  return apiKey;
}
