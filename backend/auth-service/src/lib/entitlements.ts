type PlanKey = 'basic' | 'growth' | 'enterprise';

type RawSqlExecutor = {
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown>;
  $queryRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown>;
};

const DEFAULT_ENTITLEMENTS: Record<PlanKey, Record<string, { isEnabled: boolean; quotaLimit: number | null }>> = {
  basic: {
    partners: { isEnabled: true, quotaLimit: 25 },
    seats: { isEnabled: true, quotaLimit: 3 },
    outreach_monthly: { isEnabled: true, quotaLimit: 200 },
    api_rate_limit: { isEnabled: true, quotaLimit: 600 },
    reports: { isEnabled: true, quotaLimit: null },
    api_keys: { isEnabled: false, quotaLimit: null },
    priority_support: { isEnabled: false, quotaLimit: null },
    sso: { isEnabled: false, quotaLimit: null },
  },
  growth: {
    partners: { isEnabled: true, quotaLimit: 250 },
    seats: { isEnabled: true, quotaLimit: 15 },
    outreach_monthly: { isEnabled: true, quotaLimit: 3000 },
    api_rate_limit: { isEnabled: true, quotaLimit: 3000 },
    reports: { isEnabled: true, quotaLimit: null },
    api_keys: { isEnabled: true, quotaLimit: null },
    priority_support: { isEnabled: true, quotaLimit: null },
    sso: { isEnabled: false, quotaLimit: null },
  },
  enterprise: {
    partners: { isEnabled: true, quotaLimit: 5000 },
    seats: { isEnabled: true, quotaLimit: 100 },
    outreach_monthly: { isEnabled: true, quotaLimit: 25000 },
    api_rate_limit: { isEnabled: true, quotaLimit: 10000 },
    reports: { isEnabled: true, quotaLimit: null },
    api_keys: { isEnabled: true, quotaLimit: null },
    priority_support: { isEnabled: true, quotaLimit: null },
    sso: { isEnabled: true, quotaLimit: null },
  },
};

function coercePlan(plan: string | null | undefined): PlanKey {
  if (plan === 'growth' || plan === 'enterprise') {
    return plan;
  }
  return 'basic';
}

export async function getEntitlement(executor: RawSqlExecutor, orgId: string, featureKey: string) {
  const rows = await executor.$queryRawUnsafe(
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

  const orgRows = await executor.$queryRawUnsafe(
    `
      SELECT plan
      FROM organizations
      WHERE id = $1::uuid
      LIMIT 1
    `,
    orgId,
  ) as Array<{ plan: string | null }>;

  const plan = coercePlan(orgRows[0]?.plan);
  return DEFAULT_ENTITLEMENTS[plan][featureKey] ?? { isEnabled: false, quotaLimit: null };
}

export async function syncDefaultEntitlements(executor: Pick<RawSqlExecutor, '$executeRawUnsafe'>, orgId: string, planInput: string) {
  const plan = coercePlan(planInput);
  const entitlements = DEFAULT_ENTITLEMENTS[plan];

  await executor.$executeRawUnsafe(
    `
      DELETE FROM feature_entitlements
      WHERE org_id = $1::uuid
    `,
    orgId,
  );

  for (const [featureKey, config] of Object.entries(entitlements)) {
    await executor.$executeRawUnsafe(
      `
        INSERT INTO feature_entitlements (
          id,
          org_id,
          feature_key,
          is_enabled,
          quota_limit,
          quota_period,
          created_at,
          updated_at
        )
        VALUES (
          gen_random_uuid(),
          $1::uuid,
          $2,
          $3,
          $4,
          $5,
          NOW(),
          NOW()
        )
      `,
      orgId,
      featureKey,
      config.isEnabled,
      config.quotaLimit,
      config.quotaLimit !== null ? 'monthly' : null,
    );
  }
}
