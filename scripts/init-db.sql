CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS organizations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 VARCHAR(255) NOT NULL,
  slug                 VARCHAR(100) UNIQUE NOT NULL,
  plan                 VARCHAR(50) NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic', 'growth', 'enterprise')),
  stripe_customer_id   VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  settings             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  hashed_password VARCHAR(255),
  google_id       VARCHAR(255) UNIQUE,
  full_name       VARCHAR(255),
  avatar_url      TEXT,
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role        VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'analyst', 'viewer')),
  invited_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, org_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) UNIQUE NOT NULL,
  family      VARCHAR(255) NOT NULL,
  device_fp   VARCHAR(255),
  ip_address  INET,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  hashed_key    VARCHAR(255) UNIQUE NOT NULL,
  key_prefix    VARCHAR(20) NOT NULL,
  permissions   TEXT[] NOT NULL DEFAULT ARRAY['read']::TEXT[],
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partners (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  domain        TEXT,
  tier          VARCHAR(50) NOT NULL DEFAULT 'basic',
  contact_email VARCHAR(255),
  contact_name  VARCHAR(255),
  tags          TEXT NOT NULL DEFAULT '[]',
  metadata      TEXT NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS partner_metrics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id    UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  health_score  DOUBLE PRECISION NOT NULL DEFAULT 100.0,
  mrr           DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  api_calls     INTEGER NOT NULL DEFAULT 0,
  churn_risk    DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  nps           INTEGER NOT NULL DEFAULT 70,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_metric_snapshots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id     UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  snapshot_date  DATE NOT NULL,
  health_score   DOUBLE PRECISION NOT NULL DEFAULT 100.0,
  mrr            DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  api_calls      INTEGER NOT NULL DEFAULT 0,
  churn_risk     DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  nps            INTEGER NOT NULL DEFAULT 70,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (partner_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS partner_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type  VARCHAR(100) NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider                VARCHAR(50) NOT NULL DEFAULT 'stripe',
  provider_customer_id    VARCHAR(255),
  provider_subscription_id VARCHAR(255),
  plan                    VARCHAR(50) NOT NULL DEFAULT 'basic',
  status                  VARCHAR(50) NOT NULL DEFAULT 'inactive',
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, provider)
);

CREATE TABLE IF NOT EXISTS billing_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id  UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  provider         VARCHAR(50) NOT NULL DEFAULT 'stripe',
  provider_event_id VARCHAR(255) UNIQUE,
  event_type       VARCHAR(100) NOT NULL,
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outreach_sequences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  partner_id   UUID REFERENCES partners(id) ON DELETE SET NULL,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  name         VARCHAR(255) NOT NULL,
  status       VARCHAR(50) NOT NULL DEFAULT 'draft',
  channel      VARCHAR(50) NOT NULL DEFAULT 'email',
  config       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outreach_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id         UUID REFERENCES outreach_sequences(id) ON DELETE CASCADE,
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  partner_id          UUID REFERENCES partners(id) ON DELETE SET NULL,
  subject             TEXT,
  body                TEXT NOT NULL,
  provider_message_id VARCHAR(255),
  status              VARCHAR(50) NOT NULL DEFAULT 'draft',
  scheduled_at        TIMESTAMPTZ,
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outreach_delivery_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id        UUID NOT NULL REFERENCES outreach_messages(id) ON DELETE CASCADE,
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_event_id VARCHAR(255),
  event_type        VARCHAR(100) NOT NULL,
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(255) NOT NULL,
  resource    VARCHAR(100),
  resource_id UUID,
  ip_address  INET,
  user_agent  TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  partner_id  UUID REFERENCES partners(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_entitlements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature_key   VARCHAR(100) NOT NULL,
  is_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  quota_limit   INTEGER,
  quota_period  VARCHAR(50),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_id ON memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_partners_org_id ON partners(org_id);
CREATE INDEX IF NOT EXISTS idx_partners_deleted_at ON partners(org_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_partner_metrics_org_id ON partner_metrics(org_id);
CREATE INDEX IF NOT EXISTS idx_partner_metrics_partner_id ON partner_metrics(partner_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_metric_snapshots_org_date ON partner_metric_snapshots(org_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_partner_events_org_id ON partner_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_org_id ON billing_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_sequences_org_id ON outreach_sequences(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_org_id ON outreach_messages(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_delivery_events_org_id ON outreach_delivery_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON audit_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_org_id ON comments(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_entitlements_org_id ON feature_entitlements(org_id);

DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_partners_updated_at ON partners;
CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON partners FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_outreach_sequences_updated_at ON outreach_sequences;
CREATE TRIGGER update_outreach_sequences_updated_at BEFORE UPDATE ON outreach_sequences FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_feature_entitlements_updated_at ON feature_entitlements;
CREATE TRIGGER update_feature_entitlements_updated_at BEFORE UPDATE ON feature_entitlements FOR EACH ROW EXECUTE FUNCTION update_updated_at();
