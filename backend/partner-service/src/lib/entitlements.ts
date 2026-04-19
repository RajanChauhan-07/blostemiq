import { prisma } from './prisma';
import { AppError } from '../middleware/errorHandler';

type PlanKey = 'basic' | 'growth' | 'enterprise';

const DEFAULT_ENTITLEMENTS: Record<PlanKey, Record<string, { isEnabled: boolean; quotaLimit: number | null }>> = {
  basic: {
    partners: { isEnabled: true, quotaLimit: 25 },
    api_keys: { isEnabled: false, quotaLimit: null },
  },
  growth: {
    partners: { isEnabled: true, quotaLimit: 250 },
    api_keys: { isEnabled: true, quotaLimit: null },
  },
  enterprise: {
    partners: { isEnabled: true, quotaLimit: 5000 },
    api_keys: { isEnabled: true, quotaLimit: null },
  },
};

function coercePlan(plan: string | null | undefined): PlanKey {
  if (plan === 'growth' || plan === 'enterprise') {
    return plan;
  }
  return 'basic';
}

async function getEntitlement(orgId: string, featureKey: string) {
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT is_enabled, quota_limit
      FROM feature_entitlements
      WHERE org_id = $1::uuid
        AND feature_key = $2
      LIMIT 1
    `,
    orgId,
    featureKey,
  ) as Array<{ is_enabled: boolean; quota_limit: number | null }>;

  if (rows[0]) {
    return {
      isEnabled: rows[0].is_enabled,
      quotaLimit: rows[0].quota_limit,
    };
  }

  const org = await prisma.organizations.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });
  const plan = coercePlan(org?.plan);
  return DEFAULT_ENTITLEMENTS[plan][featureKey] ?? { isEnabled: false, quotaLimit: null };
}

export async function assertPartnerCapacity(orgId: string, partnersToAdd = 1) {
  if (partnersToAdd <= 0) {
    return;
  }

  const entitlement = await getEntitlement(orgId, 'partners');
  if (!entitlement.isEnabled) {
    throw new AppError('Your plan does not allow adding partners', 403);
  }
  if (entitlement.quotaLimit === null) {
    return;
  }

  const currentPartnerCount = await prisma.partners.count({
    where: { org_id: orgId, deleted_at: null },
  });

  if (currentPartnerCount + partnersToAdd > entitlement.quotaLimit) {
    throw new AppError(`Partner limit reached for this plan (${entitlement.quotaLimit})`, 409);
  }
}

export async function assertApiKeysEnabled(orgId: string) {
  const entitlement = await getEntitlement(orgId, 'api_keys');
  if (!entitlement.isEnabled) {
    throw new AppError('API keys are not included in your current plan', 403);
  }
}
