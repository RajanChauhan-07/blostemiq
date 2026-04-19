'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Mail,
  Send,
  Copy,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Shield,
  ShieldCheck,
  Bot,
  Sparkles,
} from 'lucide-react';
import { buildTenantHeaders } from '../../../lib/auth';
import { useAuthStore } from '../../../stores/authStore';

interface AnalyticsPartner {
  id: string;
  name: string;
  contact_email: string | null;
  health_score: number;
  churn_pct: number;
  churn_risk: number;
  tier: string;
  status: 'active' | 'declining' | 'at_risk';
}

interface AnalyticsAlert {
  partner_id: string;
  message: string;
}

interface OutreachTarget {
  id: string;
  name: string;
  contactEmail: string;
  health: number;
  churn: number;
  reason: string;
  segment: string;
}

interface EmailItem {
  subject: string;
  body: string;
  cta: string;
  compliance: boolean;
  violations: string[];
}

interface GenerateResult {
  partner_name: string;
  category: string;
  emails: EmailItem[];
  model_used: string;
}

interface SavedSequence {
  id: string;
  name: string;
  status: string;
  config: {
    recipient_email?: string;
    partner_name?: string;
  };
  sent_count: number;
  message_count: number;
}

function healthColor(health: number) {
  if (health > 70) return 'var(--green)';
  if (health > 40) return 'var(--yellow)';
  return 'var(--red)';
}

export default function OutreachPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const org = useAuthStore((state) => state.org);
  const [targets, setTargets] = useState<OutreachTarget[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [activeEmail, setActiveEmail] = useState(0);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [sequences, setSequences] = useState<SavedSequence[]>([]);

  useEffect(() => {
    const loadTargets = async () => {
      if (!accessToken || !org?.id) {
        return;
      }

      setLoadingTargets(true);
      setError(null);

      try {
        const headers = buildTenantHeaders(accessToken, org.id);
        const [partnersRes, alertsRes, sequencesRes] = await Promise.all([
          fetch('/api/analytics/partners', { headers }),
          fetch('/api/analytics/alerts', { headers }),
          fetch('/api/outreach/sequences', { headers }),
        ]);

        if (!partnersRes.ok || !alertsRes.ok || !sequencesRes.ok) {
          throw new Error('Failed to load outreach targets');
        }

        const [partnersPayload, alertsPayload, sequencesPayload] = await Promise.all([
          partnersRes.json() as Promise<{ partners: AnalyticsPartner[] }>,
          alertsRes.json() as Promise<{ alerts: AnalyticsAlert[] }>,
          sequencesRes.json() as Promise<{ sequences: SavedSequence[] }>,
        ]);

        const latestAlertByPartner = new Map<string, AnalyticsAlert>();
        alertsPayload.alerts.forEach((alert) => {
          if (!latestAlertByPartner.has(alert.partner_id)) {
            latestAlertByPartner.set(alert.partner_id, alert);
          }
        });

        const nextTargets = [...partnersPayload.partners]
          .filter((partner) => partner.status !== 'active' || partner.churn_risk >= 0.3)
          .sort((left, right) => right.churn_risk - left.churn_risk)
          .slice(0, 8)
          .map((partner) => ({
            id: partner.id,
            name: partner.name,
            contactEmail: partner.contact_email || '',
            health: partner.health_score,
            churn: Math.round(partner.churn_pct),
            reason: latestAlertByPartner.get(partner.id)?.message
              || (partner.status === 'at_risk'
                ? 'Partner is currently flagged as at risk'
                : 'Partner health signals are declining'),
            segment: partner.tier,
          }));

        setTargets(nextTargets);
        setSequences(sequencesPayload.sequences);
        setSelectedId((current) => current && nextTargets.some((target) => target.id === current) ? current : nextTargets[0]?.id ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load outreach targets');
      } finally {
        setLoadingTargets(false);
      }
    };

    void loadTargets();
  }, [accessToken, org?.id]);

  const selected = useMemo(
    () => targets.find((target) => target.id === selectedId) ?? null,
    [selectedId, targets],
  );

  useEffect(() => {
    setRecipientEmail(selected?.contactEmail || '');
    setSaveMessage(null);
  }, [selected]);

  const handleGenerate = async () => {
    if (!selected) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/outreach/generate', {
        method: 'POST',
        headers: buildTenantHeaders(accessToken, org?.id, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          partner_name: selected.name,
          health_score: selected.health,
          churn_risk: selected.churn / 100,
          reason: selected.reason,
          segment: selected.segment,
        }),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const payload = await response.json() as GenerateResult;
      setResult(payload);
      setActiveEmail(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSaveSequence = async (sendNow: boolean) => {
    if (!selected || !result || !accessToken || !org?.id || !recipientEmail) {
      return;
    }

    setSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      const headers = buildTenantHeaders(accessToken, org.id, { 'Content-Type': 'application/json' });
      const createResponse = await fetch('/api/outreach/sequences', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          partner_id: selected.id,
          partner_name: selected.name,
          recipient_email: recipientEmail,
          name: `${selected.name} ${result.category} sequence`,
          emails: result.emails,
        }),
      });
      const createPayload = await createResponse.json().catch(() => null);
      if (!createResponse.ok) {
        throw new Error(createPayload?.detail || createPayload?.error || createPayload?.message || 'Failed to save sequence');
      }

      if (sendNow) {
        const sendResponse = await fetch(`/api/outreach/sequences/${createPayload.sequence_id}/send`, {
          method: 'POST',
          headers,
          body: JSON.stringify({}),
        });
        const sendPayload = await sendResponse.json().catch(() => null);
        if (!sendResponse.ok) {
          throw new Error(sendPayload?.detail || sendPayload?.error || sendPayload?.message || 'Failed to send sequence');
        }
        setSaveMessage(`Saved and sent ${sendPayload.sent} emails.`);
      } else {
        setSaveMessage('Sequence saved as draft.');
      }

      const sequencesResponse = await fetch('/api/outreach/sequences', { headers: buildTenantHeaders(accessToken, org.id) });
      if (sequencesResponse.ok) {
        const payload = await sequencesResponse.json() as { sequences: SavedSequence[] };
        setSequences(payload.sequences);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sequence');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Mail size={24} style={{ color: 'var(--accent)' }} />
          AI Outreach Composer
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Generate re-engagement sequences from live partner health signals.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Outreach targets
          </h3>

          {loadingTargets ? (
            <div className="glass rounded-xl p-5 flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <Loader2 size={14} className="animate-spin" />
              Loading targets...
            </div>
          ) : targets.length === 0 ? (
            <div className="glass rounded-xl p-5 text-sm" style={{ color: 'var(--text-muted)' }}>
              No partners currently need outreach.
            </div>
          ) : (
            targets.map((target) => (
              <button
                key={target.id}
                onClick={() => {
                  setSelectedId(target.id);
                  setResult(null);
                }}
                className={`w-full glass rounded-xl p-4 text-left transition-all ${selectedId === target.id ? 'ring-1' : 'glass-hover'}`}
                style={selectedId === target.id ? { borderColor: 'var(--accent)', boxShadow: '0 0 15px rgba(0,212,255,0.1)' } : {}}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{target.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                      target.churn > 70 ? 'badge-red' : target.churn > 50 ? 'badge-yellow' : 'badge-cyan'
                    }`}
                  >
                    {target.churn}% churn
                  </span>
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {target.reason}
                </div>
                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${target.health}%`,
                      background: healthColor(target.health),
                    }}
                  />
                </div>
              </button>
            ))
          )}

          <button
            onClick={() => void handleGenerate()}
            disabled={loading || !selected || loadingTargets}
            className="btn-primary w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-4 disabled:opacity-60"
            style={{ boxShadow: '0 0 20px rgba(0,212,255,0.2)' }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> AI is writing emails...
              </>
            ) : (
              <>
                <Sparkles size={16} /> Generate Real AI Sequence
              </>
            )}
          </button>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {error && (
            <div className="glass rounded-xl p-4 flex items-center gap-3 border border-red-500/20">
              <AlertTriangle size={16} style={{ color: 'var(--red)' }} />
              <span className="text-sm" style={{ color: 'var(--red)' }}>{error}</span>
            </div>
          )}

          {!result && !loading && (
            <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center" style={{ minHeight: 400 }}>
              <Bot size={48} style={{ color: 'var(--text-muted)', opacity: 0.3 }} className="mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select a partner and generate</h3>
              <p className="text-sm max-w-md" style={{ color: 'var(--text-muted)' }}>
                The outreach sequence uses live analytics data and the real outreach service, including compliance checks.
              </p>
            </div>
          )}

          {loading && selected && (
            <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center" style={{ minHeight: 400 }}>
              <div className="relative mb-6">
                <div
                  className="w-16 h-16 rounded-full animate-spin"
                  style={{ border: '3px solid var(--bg-elevated)', borderTopColor: 'var(--accent)' }}
                />
                <Bot
                  size={24}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ color: 'var(--accent)' }}
                />
              </div>
              <h3 className="text-lg font-semibold mb-2">AI is composing emails...</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Writing a live sequence for {selected.name}.
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="badge-cyan text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Bot size={12} /> Model: {result.model_used}
                </span>
                <span
                  className="text-xs px-3 py-1 rounded-full"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                >
                  Category: {result.category.toUpperCase()}
                </span>
              </div>

              <div className="glass rounded-xl p-4 space-y-3">
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Recipient email</label>
                  <input
                    value={recipientEmail}
                    onChange={(event) => setRecipientEmail(event.target.value)}
                    className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
                    placeholder="partner@example.com"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleSaveSequence(false)}
                    disabled={saving || !recipientEmail}
                    className="btn-ghost rounded-xl px-4 py-2.5 text-sm font-semibold"
                  >
                    {saving ? 'Saving...' : 'Save Draft'}
                  </button>
                  <button
                    onClick={() => void handleSaveSequence(true)}
                    disabled={saving || !recipientEmail}
                    className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold"
                  >
                    {saving ? 'Sending...' : 'Save & Send'}
                  </button>
                </div>
                {saveMessage && (
                  <div className="badge-green rounded-xl px-3 py-2 text-xs">
                    {saveMessage}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {result.emails.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveEmail(index)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeEmail === index ? 'btn-primary' : 'glass glass-hover'}`}
                  >
                    Day {[1, 3, 7][index]} Email
                  </button>
                ))}
              </div>

              {result.emails[activeEmail] && (
                <div className="glass rounded-2xl p-6 space-y-4 border border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {result.emails[activeEmail].compliance ? (
                        <span className="badge-green text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                          <ShieldCheck size={12} /> SEBI/RBI Compliant
                        </span>
                      ) : (
                        <span className="badge-red text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                          <Shield size={12} /> Compliance Issue
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => void handleCopy(
                        `Subject: ${result.emails[activeEmail].subject}\n\n${result.emails[activeEmail].body}\n\n${result.emails[activeEmail].cta}`,
                        activeEmail,
                      )}
                      className="glass glass-hover rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5"
                    >
                      {copied === activeEmail ? (
                        <>
                          <CheckCircle2 size={12} style={{ color: 'var(--green)' }} /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={12} /> Copy
                        </>
                      )}
                    </button>
                  </div>

                  <div>
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Subject</label>
                    <div className="text-sm font-medium">{result.emails[activeEmail].subject}</div>
                  </div>

                  <div>
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Body</label>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {result.emails[activeEmail].body}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Call to Action</label>
                    <div
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                      style={{ background: 'var(--accent)', color: '#080c14' }}
                    >
                      <Send size={14} />
                      {result.emails[activeEmail].cta}
                    </div>
                  </div>

                  {result.emails[activeEmail].violations.length > 0 && (
                    <div className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.1)' }}>
                      <div className="text-xs font-medium mb-1" style={{ color: 'var(--red)' }}>
                        Compliance violations detected:
                      </div>
                      {result.emails[activeEmail].violations.map((violation, index) => (
                        <div key={index} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          • {violation}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {sequences.length > 0 && (
            <div className="glass rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold">Recent Sequences</h3>
              <div className="space-y-2">
                {sequences.slice(0, 5).map((sequence) => (
                  <div key={sequence.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{sequence.name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {sequence.config?.recipient_email || 'No recipient'} · {sequence.sent_count}/{sequence.message_count} sent
                      </div>
                    </div>
                    <span className="badge-cyan rounded-full px-2 py-0.5 text-xs">
                      {sequence.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
