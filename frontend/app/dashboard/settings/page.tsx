'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Mail,
  Shield,
  UserPlus,
  CheckCircle2,
  Loader2,
  KeyRound,
  Copy,
  Trash2,
  Receipt,
  History,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { buildTenantHeaders } from '../../../lib/auth';
import { useSignOut } from '../../../lib/hooks/useAuthSession';
import { useAuthStore } from '../../../stores/authStore';

interface OrgMember {
  user_id: string;
  role: 'admin' | 'analyst' | 'viewer';
  joined_at: string;
  users: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface OrgResponse {
  org: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    memberships: OrgMember[];
  };
}

interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

interface SubscriptionData {
  subscription: {
    id: string;
    plan: string;
    status: string;
    provider_customer_id: string | null;
    provider_subscription_id: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
  entitlements: Array<{
    feature_key: string;
    is_enabled: boolean;
    quota_limit: number | null;
    quota_period: string | null;
  }>;
}

interface AuditEntry {
  id: string;
  action: string;
  resource: string | null;
  resource_id: string | null;
  created_at: string;
  users: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
}

interface SenderSettings {
  sender_name: string;
  sender_email: string;
  reply_to: string | null;
  unsubscribes: string[];
}

export default function SettingsTeamPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const org = useAuthStore((state) => state.org);
  const role = useAuthStore((state) => state.role);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'analyst' | 'viewer'>('viewer');
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [loadingApiKeys, setLoadingApiKeys] = useState(true);
  const [apiKeyName, setApiKeyName] = useState('');
  const [creatingApiKey, setCreatingApiKey] = useState(false);
  const [revealedApiKey, setRevealedApiKey] = useState<string | null>(null);

  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(true);
  const [billingBusy, setBillingBusy] = useState<'growth' | 'enterprise' | 'portal' | null>(null);
  const [senderSettings, setSenderSettings] = useState<SenderSettings>({
    sender_name: '',
    sender_email: '',
    reply_to: '',
    unsubscribes: [],
  });
  const [savingSender, setSavingSender] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [exportingData, setExportingData] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletingOrg, setDeletingOrg] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const isAdmin = role === 'admin';
  const signOut = useSignOut();

  const loadAll = useCallback(async () => {
    if (!accessToken || !org?.id) {
      return;
    }

    const headers = buildTenantHeaders(accessToken, org.id);
    setError(null);
    setSuccessMessage(null);
    setLoadingMembers(true);
    setLoadingApiKeys(true);
    setLoadingBilling(true);
    setLoadingAudit(true);

    await Promise.allSettled([
      (async () => {
        const response = await fetch(`/api/org/${org.id}`, { headers });
        if (!response.ok) throw new Error('Failed to load members');
        const payload = await response.json() as OrgResponse;
        setMembers(payload.org.memberships);
        setLoadingMembers(false);
      })(),
      (async () => {
        const response = await fetch('/api/partners/api-keys', { headers });
        if (response.status === 403) {
          setApiKeys([]);
          setLoadingApiKeys(false);
          return;
        }
        if (!response.ok) throw new Error('Failed to load API keys');
        const payload = await response.json() as { api_keys: ApiKeyItem[] };
        setApiKeys(payload.api_keys);
        setLoadingApiKeys(false);
      })(),
      (async () => {
        const [billingRes, senderRes] = await Promise.all([
          fetch('/api/billing/subscription', { headers }),
          fetch('/api/outreach/settings/sender', { headers }),
        ]);
        if (!billingRes.ok) throw new Error('Failed to load billing state');
        if (!senderRes.ok) throw new Error('Failed to load outreach sender settings');
        const [billingPayload, senderPayload] = await Promise.all([
          billingRes.json() as Promise<SubscriptionData>,
          senderRes.json() as Promise<SenderSettings>,
        ]);
        setSubscription(billingPayload);
        setSenderSettings(senderPayload);
        setLoadingBilling(false);
      })(),
      (async () => {
        const response = await fetch(`/api/org/${org.id}/audit-logs`, { headers });
        if (response.status === 403) {
          setAuditLogs([]);
          setLoadingAudit(false);
          return;
        }
        if (!response.ok) throw new Error('Failed to load audit logs');
        const payload = await response.json() as { audit_logs: AuditEntry[] };
        setAuditLogs(payload.audit_logs);
        setLoadingAudit(false);
      })(),
    ]).then((results) => {
      const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
      if (rejected) {
        setError(rejected.reason instanceof Error ? rejected.reason.message : 'Failed to load settings');
      }
    });

    setLoadingMembers(false);
    setLoadingApiKeys(false);
    setLoadingBilling(false);
    setLoadingAudit(false);
  }, [accessToken, org?.id]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteEmail || !accessToken || !org?.id) return;

    setSendingInvite(true);
    setInviteSent(false);
    setError(null);

    try {
      const response = await fetch(`/api/org/${org.id}/invite`, {
        method: 'POST',
        headers: buildTenantHeaders(accessToken, org.id, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || payload?.message || 'Failed to invite member');
      }

      setInviteEmail('');
      setInviteRole('viewer');
      setInviteSent(true);
      setTimeout(() => setInviteSent(false), 3000);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite member');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleCreateApiKey = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!apiKeyName || !accessToken || !org?.id) return;

    setCreatingApiKey(true);
    setError(null);

    try {
      const response = await fetch('/api/partners/api-keys', {
        method: 'POST',
        headers: buildTenantHeaders(accessToken, org.id, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name: apiKeyName,
          permissions: ['ingest:write'],
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || payload?.message || 'Failed to create API key');
      }

      const payload = await response.json() as { raw_key: string };
      setApiKeyName('');
      setRevealedApiKey(payload.raw_key);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setCreatingApiKey(false);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!accessToken || !org?.id) return;

    setError(null);
    try {
      const response = await fetch(`/api/partners/api-keys/${id}`, {
        method: 'DELETE',
        headers: buildTenantHeaders(accessToken, org.id),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || payload?.message || 'Failed to revoke API key');
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke API key');
    }
  };

  const handleCheckout = async (plan: 'growth' | 'enterprise') => {
    if (!accessToken || !org?.id) return;
    setBillingBusy(plan);
    setError(null);

    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: buildTenantHeaders(accessToken, org.id, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ plan }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to start checkout');
      }
      if (payload?.url) {
        window.location.href = payload.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
    } finally {
      setBillingBusy(null);
    }
  };

  const handlePortal = async () => {
    if (!accessToken || !org?.id) return;
    setBillingBusy('portal');
    setError(null);

    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: buildTenantHeaders(accessToken, org.id, { 'Content-Type': 'application/json' }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to open billing portal');
      }
      if (payload?.url) {
        window.location.href = payload.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal');
    } finally {
      setBillingBusy(null);
    }
  };

  const handleSaveSender = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accessToken || !org?.id) return;

    setSavingSender(true);
    setError(null);
    try {
      const response = await fetch('/api/outreach/settings/sender', {
        method: 'PUT',
        headers: buildTenantHeaders(accessToken, org.id, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          sender_name: senderSettings.sender_name,
          sender_email: senderSettings.sender_email,
          reply_to: senderSettings.reply_to || null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.detail || payload?.error || payload?.message || 'Failed to save sender settings');
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sender settings');
    } finally {
      setSavingSender(false);
    }
  };

  const handleExportData = async () => {
    if (!accessToken || !org?.id) return;

    setExportingData(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/org/${org.id}/export`, {
        headers: buildTenantHeaders(accessToken, org.id),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to export workspace data');
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${org.slug}-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setSuccessMessage('Workspace export downloaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export workspace data');
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteOrg = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accessToken || !org?.id || !org.slug) return;

    setDeletingOrg(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/org/${org.id}`, {
        method: 'DELETE',
        headers: buildTenantHeaders(accessToken, org.id, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          confirmation: 'DELETE',
          slug: deleteConfirmation,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to delete workspace');
      }

      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workspace');
    } finally {
      setDeletingOrg(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold mb-1">Workspace Settings</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Manage your team, API access, billing, and audit history from one place.
        </p>
      </div>

      {error && <div className="badge-red rounded-xl px-3 py-2 text-xs">{error}</div>}
      {successMessage && <div className="badge-cyan rounded-xl px-3 py-2 text-xs">{successMessage}</div>}

      <section className="glass rounded-2xl p-6 border border-white/[0.05]">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <UserPlus size={18} className="text-[var(--accent)]" />
          Team & Permissions
        </h2>

        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="email"
              required
              placeholder="Email address"
              className="input-dark w-full pl-10 pr-3 py-2.5 rounded-xl text-sm"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
            />
          </div>

          <div className="relative sm:w-48">
            <select
              className="input-dark w-full px-3 py-2.5 appearance-none rounded-xl text-sm"
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as 'admin' | 'analyst' | 'viewer')}
            >
              <option value="admin">Admin</option>
              <option value="analyst">Analyst</option>
              <option value="viewer">Viewer</option>
            </select>
            <Shield size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          </div>

          <button
            type="submit"
            disabled={sendingInvite || inviteSent}
            className={`btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${inviteSent ? 'bg-green-500/20 text-green-400' : ''}`}
          >
            {sendingInvite ? (
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Sending...
              </span>
            ) : inviteSent ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} /> Sent
              </span>
            ) : (
              'Send Invite'
            )}
          </button>
        </form>

        <div className="divide-y divide-white/[0.05]">
          {loadingMembers ? (
            <div className="py-4 text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
              <Loader2 size={14} className="animate-spin" />
              Loading members...
            </div>
          ) : (
            members.map((member) => (
              <div key={member.user_id} className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{ background: 'var(--surface)', color: 'var(--accent)' }}
                  >
                    {(member.users.full_name || member.users.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{member.users.full_name || member.users.email}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {member.users.email} · joined {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                <span className="text-xs capitalize badge-cyan px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Shield size={12} /> {member.role}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="glass rounded-2xl p-6 border border-white/[0.05]">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <KeyRound size={18} className="text-[var(--accent)]" />
          API Keys
        </h2>

        {isAdmin ? (
          <>
            <form onSubmit={handleCreateApiKey} className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                className="input-dark flex-1 px-3 py-2.5 rounded-xl text-sm"
                placeholder="Key name"
                value={apiKeyName}
                onChange={(event) => setApiKeyName(event.target.value)}
              />
              <button type="submit" disabled={creatingApiKey} className="btn-primary px-5 py-2.5 rounded-xl text-sm font-semibold">
                {creatingApiKey ? 'Creating...' : 'Create Ingest Key'}
              </button>
            </form>

            {revealedApiKey && (
              <div className="glass rounded-xl p-4 mb-4 space-y-2">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Copy this now. It will not be shown again.</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
                    {revealedApiKey}
                  </code>
                  <button
                    onClick={() => void navigator.clipboard.writeText(revealedApiKey)}
                    className="glass glass-hover rounded-lg p-2"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Only admins can create and revoke API keys.
          </div>
        )}

        <div className="divide-y divide-white/[0.05]">
          {loadingApiKeys ? (
            <div className="py-4 text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
              <Loader2 size={14} className="animate-spin" />
              Loading API keys...
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
              No API keys created yet.
            </div>
          ) : (
            apiKeys.map((key) => (
              <div key={key.id} className="py-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-sm">{key.name}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {key.key_prefix}... · {key.permissions.join(', ')} · last used {key.last_used_at ? formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true }) : 'never'}
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={() => void handleDeleteApiKey(key.id)} className="glass glass-hover rounded-lg p-2">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="glass rounded-2xl p-6 border border-white/[0.05]">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Receipt size={18} className="text-[var(--accent)]" />
          Billing
        </h2>

        {loadingBilling ? (
          <div className="text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <Loader2 size={14} className="animate-spin" />
            Loading billing state...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="glass rounded-xl p-4">
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Current subscription</div>
              <div className="text-lg font-semibold">
                {subscription?.subscription?.plan || org?.plan || 'basic'} · {subscription?.subscription?.status || 'inactive'}
              </div>
              {subscription?.subscription?.current_period_end && (
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Renews {formatDistanceToNow(new Date(subscription.subscription.current_period_end), { addSuffix: true })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(['growth', 'enterprise'] as const).map((plan) => (
                <button
                  key={plan}
                  onClick={() => void handleCheckout(plan)}
                  disabled={!isAdmin || billingBusy !== null}
                  className="btn-primary rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
                >
                  {billingBusy === plan ? 'Opening checkout...' : `Upgrade to ${plan}`}
                </button>
              ))}
            </div>

            <button
              onClick={() => void handlePortal()}
              disabled={!isAdmin || billingBusy !== null}
              className="btn-ghost rounded-xl px-4 py-3 text-sm font-semibold"
            >
              {billingBusy === 'portal' ? 'Opening portal...' : 'Manage Billing'}
            </button>

            {subscription?.entitlements?.length ? (
              <div className="flex flex-wrap gap-2">
                {subscription.entitlements.map((entitlement) => (
                  <span key={entitlement.feature_key} className="badge-cyan rounded-full px-2 py-0.5 text-xs">
                    {entitlement.feature_key}: {entitlement.quota_limit ?? (entitlement.is_enabled ? 'enabled' : 'disabled')}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="glass rounded-2xl p-6 border border-white/[0.05]">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Mail size={18} className="text-[var(--accent)]" />
          Outreach Sender
        </h2>

        <form onSubmit={handleSaveSender} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="input-dark px-3 py-2.5 rounded-xl text-sm"
            placeholder="Sender name"
            value={senderSettings.sender_name}
            onChange={(event) => setSenderSettings((current) => ({ ...current, sender_name: event.target.value }))}
          />
          <input
            className="input-dark px-3 py-2.5 rounded-xl text-sm"
            placeholder="Sender email"
            value={senderSettings.sender_email}
            onChange={(event) => setSenderSettings((current) => ({ ...current, sender_email: event.target.value }))}
          />
          <input
            className="input-dark px-3 py-2.5 rounded-xl text-sm"
            placeholder="Reply-to email"
            value={senderSettings.reply_to || ''}
            onChange={(event) => setSenderSettings((current) => ({ ...current, reply_to: event.target.value }))}
          />
          <div className="md:col-span-3 flex items-center justify-between gap-3">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Unsubscribed recipients: {senderSettings.unsubscribes.length}
            </div>
            <button type="submit" disabled={savingSender} className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold">
              {savingSender ? 'Saving...' : 'Save Sender Settings'}
            </button>
          </div>
        </form>
      </section>

      <section className="glass rounded-2xl p-6 border border-white/[0.05]">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <History size={18} className="text-[var(--accent)]" />
          Audit Trail
        </h2>

        {loadingAudit ? (
          <div className="text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <Loader2 size={14} className="animate-spin" />
            Loading audit history...
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No audit entries yet or you do not have permission to view them.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {auditLogs.map((entry) => (
              <div key={entry.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">{entry.action.replaceAll('_', ' ')}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {entry.resource || 'resource'} · {entry.users?.full_name || entry.users?.email || 'system'}
                  </div>
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass rounded-2xl p-6 border border-white/[0.05]">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Download size={18} className="text-[var(--accent)]" />
          Data Export
        </h2>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-medium">Export your workspace data</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Download organizations, members, partners, API keys, subscriptions, outreach data, and audit logs as JSON.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleExportData()}
            disabled={!org?.id || !accessToken || exportingData}
            className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold"
          >
            {exportingData ? 'Preparing export...' : 'Download Export'}
          </button>
        </div>
      </section>

      {isAdmin ? (
        <section className="rounded-2xl p-6 border border-red-500/20 bg-red-500/5 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-red-300">
            <AlertTriangle size={18} />
            Danger Zone
          </h2>

          <div>
            <div className="text-sm font-medium">Delete workspace permanently</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              This removes the organization and its dependent records. Type <span className="font-semibold">{org?.slug}</span> to confirm.
            </div>
          </div>

          <form onSubmit={handleDeleteOrg} className="flex flex-col md:flex-row gap-3">
            <input
              className="input-dark flex-1 px-3 py-2.5 rounded-xl text-sm"
              placeholder={org?.slug || 'workspace-slug'}
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
            />
            <button
              type="submit"
              disabled={!org?.slug || deleteConfirmation !== org.slug || deletingOrg}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold bg-red-500/20 text-red-200 disabled:opacity-60"
            >
              {deletingOrg ? 'Deleting workspace...' : 'Delete Workspace'}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
