'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  Loader2,
  X,
  Globe,
  Mail,
  BadgeIndianRupee,
  Activity,
  Plus,
  Pencil,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { buildTenantHeaders } from '../../../lib/auth';
import { useAuthStore } from '../../../stores/authStore';

interface AnalyticsPartner {
  id: string;
  name: string;
  domain: string | null;
  tier: string;
  contact_email: string | null;
  contact_name: string | null;
  tags: string[];
  health_score: number;
  mrr: number;
  api_calls: number;
  churn_risk: number;
  churn_pct: number;
  nps: number;
  status: 'active' | 'declining' | 'at_risk';
  last_seen: string | null;
  created_at: string;
}

interface CreatePartnerForm {
  name: string;
  domain: string;
  tier: 'basic' | 'growth' | 'enterprise';
  contactName: string;
  contactEmail: string;
  tags: string;
}

type EditPartnerForm = CreatePartnerForm;

function formatTimestamp(value: string | null) {
  if (!value) return 'No activity yet';
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

function normalizeDomain(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function toPartnerForm(partner: AnalyticsPartner): EditPartnerForm {
  return {
    name: partner.name,
    domain: partner.domain ?? '',
    tier: partner.tier as EditPartnerForm['tier'],
    contactName: partner.contact_name ?? '',
    contactEmail: partner.contact_email ?? '',
    tags: partner.tags.join(', '),
  };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function healthColor(score: number) {
  if (score < 40) return 'var(--red)';
  if (score < 65) return 'var(--yellow)';
  return 'var(--green)';
}

function churnBadgeClass(churnRisk: number) {
  if (churnRisk > 0.7) return 'badge-red';
  if (churnRisk > 0.4) return 'badge-yellow';
  return 'badge-green';
}

function PartnerDrawer({
  partner,
  form,
  editing,
  saving,
  deleting,
  error,
  onChange,
  onEditToggle,
  onSave,
  onDelete,
  onClose,
}: {
  partner: AnalyticsPartner;
  form: EditPartnerForm;
  editing: boolean;
  saving: boolean;
  deleting: boolean;
  error: string | null;
  onChange: (field: keyof EditPartnerForm, value: string) => void;
  onEditToggle: () => void;
  onSave: (event: React.FormEvent) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full overflow-y-auto" style={{ background: 'var(--bg-surface)' }}>
        <div
          className="sticky top-0 z-10 flex items-center gap-4 px-6 py-5 border-b"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            {partner.name[0]}
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-lg">{partner.name}</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {partner.tier} · Created {formatDistanceToNow(new Date(partner.created_at), { addSuffix: true })}
            </p>
          </div>
          <button
            onClick={onEditToggle}
            className="px-3 py-2 rounded-lg glass glass-hover text-xs font-medium inline-flex items-center gap-2"
          >
            <Pencil size={14} />
            {editing ? 'View' : 'Edit'}
          </button>
          <button onClick={onClose} className="p-2 rounded-lg glass glass-hover" aria-label="Close details">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {editing ? (
            <form onSubmit={onSave} className="space-y-4">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Partner name</label>
                <input
                  required
                  value={form.name}
                  onChange={(event) => onChange('name', event.target.value)}
                  className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Domain</label>
                  <input
                    value={form.domain}
                    onChange={(event) => onChange('domain', event.target.value)}
                    className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Tier</label>
                  <select
                    value={form.tier}
                    onChange={(event) => onChange('tier', event.target.value)}
                    className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
                  >
                    <option value="basic">Basic</option>
                    <option value="growth">Growth</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Contact name</label>
                  <input
                    value={form.contactName}
                    onChange={(event) => onChange('contactName', event.target.value)}
                    className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Contact email</label>
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(event) => onChange('contactEmail', event.target.value)}
                    className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Tags</label>
                <input
                  value={form.tags}
                  onChange={(event) => onChange('tags', event.target.value)}
                  className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
                />
              </div>

              {error && <div className="badge-red rounded-xl px-3 py-2 text-xs">{error}</div>}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={deleting || saving}
                  className="btn-ghost flex-1 py-2.5 rounded-xl text-sm inline-flex items-center justify-center gap-2"
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Delete
                </button>
                <button
                  type="submit"
                  disabled={saving || deleting}
                  className="btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save changes
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="glass rounded-xl p-4">
                  <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Health score</div>
                  <div className="text-2xl font-bold" style={{ color: healthColor(partner.health_score) }}>
                    {partner.health_score}
                  </div>
                </div>
                <div className="glass rounded-xl p-4">
                  <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Churn risk</div>
                  <div className="text-2xl font-bold">{partner.churn_pct}%</div>
                </div>
                <div className="glass rounded-xl p-4">
                  <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Monthly revenue</div>
                  <div className="text-2xl font-bold">{formatMoney(partner.mrr)}</div>
                </div>
                <div className="glass rounded-xl p-4">
                  <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>API calls</div>
                  <div className="text-2xl font-bold">{partner.api_calls.toLocaleString()}</div>
                </div>
              </div>

              <div className="glass rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold">Partner details</h3>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Globe size={14} />
                  <span>{partner.domain || 'No domain provided'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Mail size={14} />
                  <span>{partner.contact_email || 'No contact email provided'}</span>
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Contact: {partner.contact_name || 'Unassigned'}
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Last activity: {formatTimestamp(partner.last_seen)}
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  NPS: {partner.nps}
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Status: <span className={`${partner.status === 'at_risk' ? 'badge-red' : partner.status === 'declining' ? 'badge-yellow' : 'badge-green'} rounded-full px-2 py-0.5 text-xs ml-1`}>{partner.status.replace('_', ' ')}</span>
                </div>
              </div>

              <div className="glass rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {partner.tags.length > 0 ? (
                    partner.tags.map((tag) => (
                      <span key={tag} className="badge-cyan rounded-full px-2 py-0.5 text-xs">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>No tags added</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CreatePartnerModal({
  loading,
  error,
  form,
  onClose,
  onChange,
  onSubmit,
}: {
  loading: boolean;
  error: string | null;
  form: CreatePartnerForm;
  onClose: () => void;
  onChange: (field: keyof CreatePartnerForm, value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Add partner</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              This creates a real partner record in the partner service.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg glass glass-hover" aria-label="Close add partner form">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Partner name</label>
            <input
              required
              value={form.name}
              onChange={(event) => onChange('name', event.target.value)}
              className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
              placeholder="Acme Payments"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Domain</label>
              <input
                value={form.domain}
                onChange={(event) => onChange('domain', event.target.value)}
                className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
                placeholder="partner.com"
              />
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Tier</label>
              <select
                value={form.tier}
                onChange={(event) => onChange('tier', event.target.value)}
                className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
              >
                <option value="basic">Basic</option>
                <option value="growth">Growth</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Contact name</label>
              <input
                value={form.contactName}
                onChange={(event) => onChange('contactName', event.target.value)}
                className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
                placeholder="Priya Sharma"
              />
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Contact email</label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(event) => onChange('contactEmail', event.target.value)}
                className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
                placeholder="priya@partner.com"
              />
            </div>
          </div>

          <div>
            <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Tags</label>
            <input
              value={form.tags}
              onChange={(event) => onChange('tags', event.target.value)}
              className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
              placeholder="payments, enterprise, launch"
            />
          </div>

          {error && <div className="badge-red rounded-xl px-3 py-2 text-xs">{error}</div>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 py-2.5 rounded-xl text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <Plus size={14} /> Create partner
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImportPartnersModal({
  csv,
  loading,
  error,
  onClose,
  onChange,
  onSubmit,
}: {
  csv: string;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Import partners from CSV</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Expected headers: `name,domain,tier,contact_email,contact_name,tags`
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg glass glass-hover" aria-label="Close import form">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <textarea
            value={csv}
            onChange={(event) => onChange(event.target.value)}
            className="input-dark w-full min-h-[260px] px-3 py-3 rounded-xl text-sm font-mono"
            placeholder={'name,domain,tier,contact_email,contact_name,tags\nAcme Payments,acme.com,growth,ops@acme.com,Priya,payments,launch'}
          />

          {error && <div className="badge-red rounded-xl px-3 py-2 text-xs">{error}</div>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 py-2.5 rounded-xl text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={14} className="animate-spin" /> Importing...</> : <><Upload size={14} /> Import CSV</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PartnersPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const org = useAuthStore((state) => state.org);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'at_risk' | 'healthy'>('all');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [partners, setPartners] = useState<AnalyticsPartner[]>([]);
  const [selected, setSelected] = useState<AnalyticsPartner | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState(false);
  const [savingPartner, setSavingPartner] = useState(false);
  const [deletingPartner, setDeletingPartner] = useState(false);
  const [mutateError, setMutateError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [csv, setCsv] = useState('');
  const [form, setForm] = useState<CreatePartnerForm>({
    name: '',
    domain: '',
    tier: 'basic',
    contactName: '',
    contactEmail: '',
    tags: '',
  });
  const [editForm, setEditForm] = useState<EditPartnerForm>({
    name: '',
    domain: '',
    tier: 'basic',
    contactName: '',
    contactEmail: '',
    tags: '',
  });

  const loadPartners = useCallback(async () => {
    if (!accessToken || !org?.id) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analytics/partners', {
        headers: buildTenantHeaders(accessToken, org.id),
      });

      if (!response.ok) {
        throw new Error('Failed to load partners');
      }

      const payload = await response.json() as { partners: AnalyticsPartner[] };
      setPartners(payload.partners);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load partners');
    } finally {
      setLoading(false);
    }
  }, [accessToken, org?.id]);

  useEffect(() => {
    void loadPartners();
  }, [loadPartners]);

  useEffect(() => {
    if (!selected) {
      setEditingPartner(false);
      setMutateError(null);
      return;
    }

    setEditForm(toPartnerForm(selected));
    setEditingPartner(false);
    setMutateError(null);
  }, [selected]);

  const filtered = useMemo(
    () => partners
      .filter((partner) => {
        const query = search.toLowerCase();
        return (
          partner.name.toLowerCase().includes(query) ||
          (partner.domain || '').toLowerCase().includes(query) ||
          (partner.contact_email || '').toLowerCase().includes(query)
        );
      })
      .filter((partner) => {
        if (filter === 'at_risk') return partner.status === 'at_risk';
        if (filter === 'healthy') return partner.status === 'active';
        return true;
      })
      .sort((left, right) => right.churn_risk - left.churn_risk),
    [filter, partners, search],
  );

  const atRiskCount = partners.filter((partner) => partner.status === 'at_risk').length;
  const healthyCount = partners.filter((partner) => partner.status === 'active').length;
  const totalMRR = partners.reduce((sum, partner) => sum + partner.mrr, 0);

  const resetForm = () => {
    setForm({
      name: '',
      domain: '',
      tier: 'basic',
      contactName: '',
      contactEmail: '',
      tags: '',
    });
    setCreateError(null);
  };

  const handleCreatePartner = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!accessToken || !org?.id) {
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch('/api/partners', {
        method: 'POST',
        headers: buildTenantHeaders(accessToken, org.id, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name: form.name.trim(),
          domain: normalizeDomain(form.domain),
          tier: form.tier,
          contact_name: form.contactName.trim() || undefined,
          contact_email: form.contactEmail.trim() || undefined,
          tags: form.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || payload?.message || 'Failed to create partner');
      }

      setShowCreateModal(false);
      resetForm();
      await loadPartners();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create partner');
    } finally {
      setCreating(false);
    }
  };

  const handleSavePartner = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!accessToken || !org?.id || !selected) {
      return;
    }

    setSavingPartner(true);
    setMutateError(null);

    try {
      const response = await fetch(`/api/partners/${selected.id}`, {
        method: 'PATCH',
        headers: buildTenantHeaders(accessToken, org.id, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name: editForm.name.trim(),
          domain: normalizeDomain(editForm.domain),
          tier: editForm.tier,
          contact_name: editForm.contactName.trim() || undefined,
          contact_email: editForm.contactEmail.trim() || undefined,
          tags: editForm.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || payload?.message || 'Failed to update partner');
      }

      await loadPartners();
      setSelected((current) => current ? ({
        ...current,
        name: editForm.name.trim(),
        domain: normalizeDomain(editForm.domain) ?? null,
        tier: editForm.tier,
        contact_name: editForm.contactName.trim() || null,
        contact_email: editForm.contactEmail.trim() || null,
        tags: editForm.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      }) : current);
      setEditingPartner(false);
    } catch (err) {
      setMutateError(err instanceof Error ? err.message : 'Failed to update partner');
    } finally {
      setSavingPartner(false);
    }
  };

  const handleDeletePartner = async () => {
    if (!accessToken || !org?.id || !selected) {
      return;
    }

    if (!window.confirm(`Delete ${selected.name}? This removes the partner from the active portfolio.`)) {
      return;
    }

    setDeletingPartner(true);
    setMutateError(null);

    try {
      const response = await fetch(`/api/partners/${selected.id}`, {
        method: 'DELETE',
        headers: buildTenantHeaders(accessToken, org.id),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || payload?.message || 'Failed to delete partner');
      }

      setSelected(null);
      setEditingPartner(false);
      await loadPartners();
    } catch (err) {
      setMutateError(err instanceof Error ? err.message : 'Failed to delete partner');
    } finally {
      setDeletingPartner(false);
    }
  };

  const handleImportPartners = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!accessToken || !org?.id || !csv.trim()) {
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      const response = await fetch('/api/partners/import', {
        method: 'POST',
        headers: buildTenantHeaders(accessToken, org.id, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ csv }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to import partners');
      }

      setShowImportModal(false);
      setCsv('');
      await loadPartners();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import partners');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {selected && (
        <PartnerDrawer
          partner={selected}
          form={editForm}
          editing={editingPartner}
          saving={savingPartner}
          deleting={deletingPartner}
          error={mutateError}
          onChange={(field, value) => setEditForm((current) => ({ ...current, [field]: value }))}
          onEditToggle={() => {
            setEditForm(toPartnerForm(selected));
            setMutateError(null);
            setEditingPartner((current) => !current);
          }}
          onSave={handleSavePartner}
          onDelete={handleDeletePartner}
          onClose={() => setSelected(null)}
        />
      )}
      {showCreateModal && (
        <CreatePartnerModal
          loading={creating}
          error={createError}
          form={form}
          onClose={() => {
            setShowCreateModal(false);
            resetForm();
          }}
          onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
          onSubmit={handleCreatePartner}
        />
      )}
      {showImportModal && (
        <ImportPartnersModal
          csv={csv}
          loading={importing}
          error={importError}
          onClose={() => {
            setShowImportModal(false);
            setImportError(null);
          }}
          onChange={setCsv}
          onSubmit={handleImportPartners}
        />
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="text-[var(--accent)]" /> Partner Portfolio
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {partners.length} partners · {formatMoney(totalMRR)} MRR · {atRiskCount} at risk
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setImportError(null);
              setShowImportModal(true);
            }}
            className="btn-ghost px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <Upload size={14} />
            Import CSV
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="btn-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <Plus size={14} />
            Add partner
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          placeholder="Search partners..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="input-dark rounded-lg px-4 py-2 text-sm flex-1 min-w-[220px] max-w-xs"
        />
        {(['all', 'at_risk', 'healthy'] as const).map((currentFilter) => (
          <button
            key={currentFilter}
            onClick={() => setFilter(currentFilter)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-all ${filter === currentFilter ? 'badge-cyan' : 'glass'}`}
          >
            {currentFilter === 'at_risk'
              ? `At Risk (${atRiskCount})`
              : currentFilter === 'healthy'
                ? `Healthy (${healthyCount})`
                : `All (${partners.length})`}
          </button>
        ))}
      </div>

      {error && <div className="badge-red rounded-xl px-4 py-3 text-sm">{error}</div>}

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                {['Partner', 'Health', 'Churn Risk', 'API Calls', 'NPS', 'MRR', 'Last Seen'].map((heading) => (
                  <th
                    key={heading}
                    className="text-left px-4 py-3 text-xs font-medium"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    <div className="inline-flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      Loading partners...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    No partners match this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((partner) => (
                  <tr
                    key={partner.id}
                    onClick={() => setSelected(partner)}
                    className="border-b cursor-pointer transition-all"
                    style={{ borderColor: 'var(--border)' }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = 'var(--bg-elevated)';
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                        >
                          {partner.name[0]}
                        </div>
                        <div>
                          <div className="font-medium">{partner.name}</div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {partner.domain || partner.tier}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${partner.health_score}%`, background: healthColor(partner.health_score) }}
                          />
                        </div>
                        <span className="text-xs font-mono" style={{ color: healthColor(partner.health_score) }}>
                          {partner.health_score}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`${churnBadgeClass(partner.churn_risk)} text-xs px-2 py-0.5 rounded-full`}>
                        {partner.churn_pct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <div className="inline-flex items-center gap-1.5">
                        <Activity size={12} />
                        {partner.api_calls.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">{partner.nps}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <div className="inline-flex items-center gap-1.5">
                        <BadgeIndianRupee size={12} />
                        {formatMoney(partner.mrr)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {formatTimestamp(partner.last_seen)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
