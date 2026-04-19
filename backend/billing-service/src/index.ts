import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import jwt from 'jsonwebtoken';

const app = express();
const prisma = new PrismaClient({ log: ['error'] });

const PORT = process.env.PORT || '3005';
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const BILLING_SUCCESS_URL = process.env.BILLING_SUCCESS_URL || 'http://localhost:3000/dashboard/settings';
const BILLING_CANCEL_URL = process.env.BILLING_CANCEL_URL || 'http://localhost:3000/dashboard/settings';

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY)
  : null;

type PlanKey = 'basic' | 'growth' | 'enterprise';

type AuthPayload = {
  sub: string;
  orgId: string;
  role: 'admin' | 'analyst' | 'viewer';
};

const PLAN_CONFIG: Record<PlanKey, {
  label: string;
  priceId?: string;
  limits: Record<string, number | boolean>;
}> = {
  basic: {
    label: 'Basic',
    limits: {
      partners: 25,
      seats: 3,
      outreach_monthly: 200,
      api_rate_limit: 600,
      reports: true,
    },
  },
  growth: {
    label: 'Growth',
    priceId: process.env.STRIPE_PRICE_GROWTH,
    limits: {
      partners: 250,
      seats: 15,
      outreach_monthly: 3000,
      api_rate_limit: 3000,
      reports: true,
      api_keys: true,
      priority_support: true,
    },
  },
  enterprise: {
    label: 'Enterprise',
    priceId: process.env.STRIPE_PRICE_ENTERPRISE,
    limits: {
      partners: 5000,
      seats: 100,
      outreach_monthly: 25000,
      api_rate_limit: 10000,
      reports: true,
      api_keys: true,
      priority_support: true,
      sso: true,
    },
  },
};

const PRICE_TO_PLAN = Object.entries(PLAN_CONFIG).reduce<Record<string, PlanKey>>((accumulator, [plan, config]) => {
  if (config.priceId) accumulator[config.priceId] = plan as PlanKey;
  return accumulator;
}, {});

class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

interface AuthenticatedRequest extends Request {
  auth?: AuthPayload;
}

app.post('/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

function requireEnv(value: string | undefined, label: string) {
  if (!value) {
    throw new AppError(500, `${label} environment variable is required`);
  }
  return value;
}

function verifyToken(token: string): AuthPayload {
  const payload = jwt.verify(token, requireEnv(JWT_SECRET, 'JWT_SECRET'), {
    algorithms: ['HS256'],
    issuer: 'blostemiq-auth',
  }) as jwt.JwtPayload;

  if (payload.type !== 'access' || !payload.sub || !payload.orgId || !payload.role) {
    throw new AppError(401, 'Invalid access token');
  }

  return {
    sub: payload.sub,
    orgId: payload.orgId,
    role: payload.role as AuthPayload['role'],
  };
}

function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) throw new AppError(401, 'Unauthorized');
    const auth = verifyToken(authHeader.slice('Bearer '.length));
    const requestedOrgId = req.headers['x-org-id'];
    if (typeof requestedOrgId === 'string' && requestedOrgId !== auth.orgId) {
      throw new AppError(403, 'Forbidden');
    }
    req.auth = auth;
    next();
  } catch (error) {
    next(error);
  }
}

function requireAdmin(req: AuthenticatedRequest) {
  if (!req.auth || req.auth.role !== 'admin') {
    throw new AppError(403, 'Forbidden');
  }
}

async function querySubscription(orgId: string) {
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT
        id::text,
        plan,
        status,
        provider_customer_id,
        provider_subscription_id,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        created_at,
        updated_at
      FROM subscriptions
      WHERE org_id = $1::uuid
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    orgId,
  ) as Array<{
    id: string;
    plan: string;
    status: string;
    provider_customer_id: string | null;
    provider_subscription_id: string | null;
    current_period_start: Date | null;
    current_period_end: Date | null;
    cancel_at_period_end: boolean;
    created_at: Date;
    updated_at: Date;
  }>;

  const entitlements = await prisma.$queryRawUnsafe(
    `
      SELECT feature_key, is_enabled, quota_limit, quota_period
      FROM feature_entitlements
      WHERE org_id = $1::uuid
      ORDER BY feature_key ASC
    `,
    orgId,
  ) as Array<{
    feature_key: string;
    is_enabled: boolean;
    quota_limit: number | null;
    quota_period: string | null;
  }>;

  return { subscription: rows[0] ?? null, entitlements };
}

async function ensureStripeCustomer(orgId: string) {
  const organizationRows = await prisma.$queryRawUnsafe(
    `
      SELECT
        id::text,
        name,
        slug,
        plan,
        stripe_customer_id
      FROM organizations
      WHERE id = $1::uuid
      LIMIT 1
    `,
    orgId,
  ) as Array<{
    id: string;
    name: string;
    slug: string;
    plan: string;
    stripe_customer_id: string | null;
  }>;

  const organization = organizationRows[0];
  if (!organization) throw new AppError(404, 'Organization not found');
  if (organization.stripe_customer_id) return organization.stripe_customer_id;
  if (!stripe) throw new AppError(503, 'Stripe is not configured');

  const customer = await stripe.customers.create({
    name: organization.name,
    metadata: {
      org_id: organization.id,
      org_slug: organization.slug,
    },
  });

  await prisma.$executeRawUnsafe(
    `
      UPDATE organizations
      SET stripe_customer_id = $1, updated_at = NOW()
      WHERE id = $2::uuid
    `,
    customer.id,
    orgId,
  );

  return customer.id;
}

async function recordBillingEvent(orgId: string | null, subscriptionId: string | null, eventType: string, payload: unknown, providerEventId?: string | null) {
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO billing_events (
        id,
        org_id,
        subscription_id,
        provider,
        provider_event_id,
        event_type,
        payload,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        $1::uuid,
        $2::uuid,
        'stripe',
        $3,
        $4,
        CAST($5 AS jsonb),
        NOW()
      )
    `,
    orgId,
    subscriptionId,
    providerEventId ?? null,
    eventType,
    JSON.stringify(payload),
  );
}

async function recordAuditLog(input: {
  orgId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await prisma.$executeRawUnsafe(
    `
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
        $1::uuid,
        $2::uuid,
        $3,
        $4,
        $5::uuid,
        $6,
        $7,
        CAST($8 AS jsonb),
        NOW()
      )
    `,
    input.orgId,
    input.userId,
    input.action,
    input.resource,
    input.resourceId ?? null,
    input.ipAddress ?? null,
    input.userAgent ?? null,
    JSON.stringify(input.metadata ?? {}),
  );
}

async function syncEntitlements(orgId: string, plan: PlanKey) {
  const limits = PLAN_CONFIG[plan].limits;
  await prisma.$executeRawUnsafe(
    `
      DELETE FROM feature_entitlements
      WHERE org_id = $1::uuid
    `,
    orgId,
  );

  for (const [featureKey, value] of Object.entries(limits)) {
    await prisma.$executeRawUnsafe(
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
      typeof value === 'boolean' ? value : true,
      typeof value === 'number' ? value : null,
      typeof value === 'number' ? 'monthly' : null,
    );
  }
}

async function syncSubscriptionRecord(input: {
  orgId: string;
  plan: PlanKey;
  status: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}) {
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT id::text
      FROM subscriptions
      WHERE org_id = $1::uuid
        AND provider = 'stripe'
      LIMIT 1
    `,
    input.orgId,
  ) as Array<{ id: string }>;

  const existingId = rows[0]?.id ?? null;
  if (existingId) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE subscriptions
        SET
          provider_customer_id = $1,
          provider_subscription_id = $2,
          plan = $3,
          status = $4,
          current_period_start = $5,
          current_period_end = $6,
          cancel_at_period_end = $7,
          updated_at = NOW()
        WHERE id = $8::uuid
      `,
      input.customerId ?? null,
      input.subscriptionId ?? null,
      input.plan,
      input.status,
      input.currentPeriodStart ?? null,
      input.currentPeriodEnd ?? null,
      input.cancelAtPeriodEnd ?? false,
      existingId,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO subscriptions (
          id,
          org_id,
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
        )
        VALUES (
          gen_random_uuid(),
          $1::uuid,
          'stripe',
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          NOW(),
          NOW()
        )
      `,
      input.orgId,
      input.customerId ?? null,
      input.subscriptionId ?? null,
      input.plan,
      input.status,
      input.currentPeriodStart ?? null,
      input.currentPeriodEnd ?? null,
      input.cancelAtPeriodEnd ?? false,
    );
  }

  await prisma.$executeRawUnsafe(
    `
      UPDATE organizations
      SET plan = $1, updated_at = NOW()
      WHERE id = $2::uuid
    `,
    input.plan,
    input.orgId,
  );

  await syncEntitlements(input.orgId, input.plan);
}

function subscriptionFromStripe(subscription: any): { orgId: string; plan: PlanKey } {
  const orgId = subscription.metadata.org_id;
  const priceId = subscription.items.data[0]?.price?.id;
  const plan = (priceId && PRICE_TO_PLAN[priceId]) || (subscription.metadata.plan as PlanKey) || 'growth';
  if (!orgId) throw new AppError(400, 'Missing org_id metadata on subscription');
  return { orgId, plan };
}

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'billing-service',
    databaseConfigured: Boolean(DATABASE_URL),
    stripeConfigured: Boolean(STRIPE_SECRET_KEY),
    webhookConfigured: Boolean(STRIPE_WEBHOOK_SECRET),
  });
});

app.get('/plans', (_req, res) => {
  res.json({ plans: PLAN_CONFIG });
});

app.get('/subscription', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const auth = req.auth!;
  const data = await querySubscription(auth.orgId);
  res.json(data);
});

app.post('/checkout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  requireAdmin(req);
  if (!stripe) throw new AppError(503, 'Stripe is not configured');

  const plan = (req.body?.plan || 'growth') as PlanKey;
  if (!PLAN_CONFIG[plan]) throw new AppError(400, 'Unknown plan');
  if (!PLAN_CONFIG[plan].priceId) throw new AppError(400, 'Selected plan is not billable');

  const customerId = await ensureStripeCustomer(req.auth!.orgId);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        price: PLAN_CONFIG[plan].priceId,
        quantity: 1,
      },
    ],
    success_url: req.body?.success_url || BILLING_SUCCESS_URL,
    cancel_url: req.body?.cancel_url || BILLING_CANCEL_URL,
    metadata: {
      org_id: req.auth!.orgId,
      plan,
      actor_user_id: req.auth!.sub,
    },
    subscription_data: {
      metadata: {
        org_id: req.auth!.orgId,
        plan,
      },
    },
  });

  await recordBillingEvent(req.auth!.orgId, null, 'checkout_session_created', {
    checkout_session_id: session.id,
    plan,
  });
  await recordAuditLog({
    orgId: req.auth!.orgId,
    userId: req.auth!.sub,
    action: 'BILLING_CHECKOUT_STARTED',
    resource: 'billing',
    metadata: {
      checkout_session_id: session.id,
      plan,
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.status(201).json({
    sessionId: session.id,
    url: session.url,
  });
});

app.post('/portal', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  requireAdmin(req);
  if (!stripe) throw new AppError(503, 'Stripe is not configured');

  const customerId = await ensureStripeCustomer(req.auth!.orgId);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: req.body?.return_url || BILLING_SUCCESS_URL,
  });

  await recordAuditLog({
    orgId: req.auth!.orgId,
    userId: req.auth!.sub,
    action: 'BILLING_PORTAL_OPENED',
    resource: 'billing',
    metadata: {
      portal_session_url: session.url,
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({ url: session.url });
});

app.post('/webhooks/stripe', async (req: Request, res: Response) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) throw new AppError(503, 'Stripe webhook is not configured');
  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string') throw new AppError(400, 'Missing stripe signature');

  const event = stripe.webhooks.constructEvent(req.body as Buffer, signature, STRIPE_WEBHOOK_SECRET);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any;
      await recordBillingEvent(
        (session.metadata?.org_id as string | undefined) || null,
        null,
        event.type,
        session,
        event.id,
      );
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as any;
      const { orgId, plan } = subscriptionFromStripe(subscription);
      await syncSubscriptionRecord({
        orgId,
        plan,
        status: subscription.status,
        customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
        subscriptionId: subscription.id,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });
      await recordBillingEvent(orgId, null, event.type, subscription, event.id);
      break;
    }
    default:
      await recordBillingEvent(null, null, event.type, event.data.object, event.id);
  }

  res.json({ received: true });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  if (error instanceof Stripe.errors.StripeError) {
    return res.status(error.statusCode || 400).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: 'Internal server error' });
});

app.listen(Number(PORT), () => {
  console.log(`Billing Service running on port ${PORT}`);
});
