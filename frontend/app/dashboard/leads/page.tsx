'use client';

import { useMemo, useState } from 'react';
import {
  Zap,
  RefreshCcw,
  Flame,
  Thermometer,
  Snowflake,
  Building2,
  Landmark,
  Newspaper,
  Plus,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type LeadStage = 'New' | 'Outreach' | 'Qualified' | 'Meeting' | 'Negotiation';
type LeadStatus = 'HOT' | 'WARM' | 'COLD';

interface Lead {
  id: string;
  company: string;
  segment: string;
  stage: LeadStage;
  company_size: number;
  funding_millions: number;
  news_sentiment: number;
  score: number | null;
  probability: number | null;
  status: LeadStatus | null;
}

interface LeadFormState {
  company: string;
  segment: string;
  stage: LeadStage;
  company_size: string;
  funding_millions: string;
  news_sentiment: string;
}

const KANBAN_STAGES: LeadStage[] = ['New', 'Outreach', 'Qualified', 'Meeting', 'Negotiation'];
const STATUS_ICON = { HOT: Flame, WARM: Thermometer, COLD: Snowflake };
const STATUS_COLOR = { HOT: 'var(--red)', WARM: 'var(--yellow)', COLD: 'var(--accent)' };

function createLeadId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `lead-${Date.now()}`;
}

function emptyLeadForm(): LeadFormState {
  return {
    company: '',
    segment: '',
    stage: 'New',
    company_size: '',
    funding_millions: '',
    news_sentiment: '',
  };
}

export default function LeadsPage() {
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<LeadFormState>(emptyLeadForm);
  const [leads, setLeads] = useState<Lead[]>([]);

  const scoredLeads = leads.filter((lead) => lead.score !== null);
  const hotLeads = leads.filter((lead) => lead.status === 'HOT').length;
  const avgScore = scoredLeads.length > 0
    ? Math.round(scoredLeads.reduce((sum, lead) => sum + (lead.score ?? 0), 0) / scoredLeads.length)
    : 0;
  const totalFunding = leads.reduce((sum, lead) => sum + lead.funding_millions, 0);

  const pipelineData = useMemo(
    () => KANBAN_STAGES.map((stage) => ({
      stage,
      count: leads.filter((lead) => lead.stage === stage).length,
    })),
    [leads],
  );

  const handleAddLead = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const company = form.company.trim();
    const segment = form.segment.trim();
    const companySize = Number(form.company_size);
    const fundingMillions = Number(form.funding_millions);
    const newsSentiment = Number(form.news_sentiment);

    if (!company || !segment || Number.isNaN(companySize) || Number.isNaN(fundingMillions) || Number.isNaN(newsSentiment)) {
      setError('Fill all lead fields before adding a lead.');
      return;
    }

    if (companySize <= 0 || fundingMillions < 0 || newsSentiment < -1 || newsSentiment > 1) {
      setError('Use valid values for company size, funding, and sentiment.');
      return;
    }

    setLeads((current) => [
      {
        id: createLeadId(),
        company,
        segment,
        stage: form.stage,
        company_size: companySize,
        funding_millions: fundingMillions,
        news_sentiment: newsSentiment,
        score: null,
        probability: null,
        status: null,
      },
      ...current,
    ]);
    setForm(emptyLeadForm());
  };

  const runBatchScore = async () => {
    if (leads.length === 0) {
      setError('Add at least one lead before scoring.');
      return;
    }

    setScoring(true);
    setError(null);

    try {
      const results = await Promise.all(
        leads.map(async (lead) => {
          const response = await fetch('/api/leads/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              company_size: lead.company_size,
              funding_millions: lead.funding_millions,
              news_sentiment: lead.news_sentiment,
            }),
          });

          if (!response.ok) {
            throw new Error(`Lead scoring failed for ${lead.company}`);
          }

          const payload = await response.json() as {
            lead_score: number;
            probability: number;
            status: LeadStatus;
          };

          return {
            id: lead.id,
            score: payload.lead_score,
            probability: payload.probability,
            status: payload.status,
          };
        }),
      );

      setLeads((current) => current.map((lead) => {
        const match = results.find((result) => result.id === lead.id);
        return match
          ? {
              ...lead,
              score: match.score,
              probability: match.probability,
              status: match.status,
            }
          : lead;
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lead scoring failed.');
    } finally {
      setScoring(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="text-[var(--accent)]" /> Lead Scoring Pipeline
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Add real leads and score them live through the lead-scoring service.
          </p>
        </div>

        <div className="flex gap-2">
          <div className="flex gap-1 glass rounded-lg p-0.5">
            {(['table', 'kanban'] as const).map((currentView) => (
              <button
                key={currentView}
                onClick={() => setView(currentView)}
                className={`text-xs px-3 py-1.5 rounded-md transition-all capitalize ${view === currentView ? 'badge-cyan' : ''}`}
              >
                {currentView}
              </button>
            ))}
          </div>
          <button
            onClick={() => void runBatchScore()}
            disabled={scoring}
            className="btn-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-60"
          >
            {scoring ? <RefreshCcw className="animate-spin" size={14} /> : <Zap size={14} />}
            {scoring ? 'Scoring...' : 'Score All Leads'}
          </button>
        </div>
      </div>

      <form onSubmit={handleAddLead} className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Plus size={16} className="text-[var(--accent)]" />
          <h2 className="text-sm font-semibold">Add Lead</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Company</label>
            <input
              value={form.company}
              onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}
              className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
              placeholder="Acme Payments"
            />
          </div>
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Segment</label>
            <input
              value={form.segment}
              onChange={(event) => setForm((current) => ({ ...current, segment: event.target.value }))}
              className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
              placeholder="Payments"
            />
          </div>
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Stage</label>
            <select
              value={form.stage}
              onChange={(event) => setForm((current) => ({ ...current, stage: event.target.value as LeadStage }))}
              className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
            >
              {KANBAN_STAGES.map((stage) => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Company size</label>
            <input
              type="number"
              min="1"
              value={form.company_size}
              onChange={(event) => setForm((current) => ({ ...current, company_size: event.target.value }))}
              className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
              placeholder="500"
            />
          </div>
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Funding (USD millions)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={form.funding_millions}
              onChange={(event) => setForm((current) => ({ ...current, funding_millions: event.target.value }))}
              className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
              placeholder="25"
            />
          </div>
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>News sentiment (-1 to 1)</label>
            <input
              type="number"
              min="-1"
              max="1"
              step="0.01"
              value={form.news_sentiment}
              onChange={(event) => setForm((current) => ({ ...current, news_sentiment: event.target.value }))}
              className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
              placeholder="0.35"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          {error ? <div className="badge-red rounded-xl px-3 py-2 text-xs">{error}</div> : <div />}
          <button type="submit" className="btn-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <Plus size={14} />
            Add Lead
          </button>
        </div>
      </form>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: String(leads.length), icon: Building2, color: 'var(--accent)' },
          { label: 'Hot Leads', value: String(hotLeads), icon: Flame, color: 'var(--red)' },
          { label: 'Funding Tracked', value: `$${totalFunding.toFixed(1)}M`, icon: Landmark, color: 'var(--green)' },
          { label: 'Avg Score', value: String(avgScore), icon: Newspaper, color: 'var(--yellow)' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass rounded-xl p-4 glass-hover">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
              <Icon size={14} style={{ color }} />
            </div>
            <div className="text-xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="text-sm font-semibold mb-4">Pipeline Stages</h3>
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pipelineData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis
                dataKey="stage"
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                width={90}
              />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20} fill="var(--accent)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {view === 'table' ? (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                {['Company', 'Segment', 'Size', 'Funding', 'Sentiment', 'Score', 'Status', 'Stage'].map((heading) => (
                  <th key={heading} className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.length > 0 ? leads.map((lead) => {
                const StatusIcon = lead.status ? STATUS_ICON[lead.status] : null;

                return (
                  <tr
                    key={lead.id}
                    className="border-b transition-all"
                    style={{ borderColor: 'var(--border)' }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = 'var(--bg-elevated)';
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td className="px-4 py-3 font-medium">{lead.company}</td>
                    <td className="px-4 py-3"><span className="text-xs badge-cyan px-2 py-0.5 rounded">{lead.segment}</span></td>
                    <td className="px-4 py-3 font-mono text-xs">{lead.company_size}</td>
                    <td className="px-4 py-3 font-mono text-xs">${lead.funding_millions.toFixed(1)}M</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <div className="w-12 h-1.5 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(0, ((lead.news_sentiment + 1) / 2) * 100)}%`,
                              background: lead.news_sentiment > 0.5 ? 'var(--green)' : lead.news_sentiment > 0 ? 'var(--yellow)' : 'var(--red)',
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                          {lead.news_sentiment.toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold" style={{ color: lead.score !== null ? (lead.score > 70 ? 'var(--red)' : lead.score > 40 ? 'var(--yellow)' : 'var(--accent)') : 'var(--text-muted)' }}>
                        {lead.score ?? '--'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {lead.status && StatusIcon ? (
                        <span className="flex items-center gap-1 text-xs" style={{ color: STATUS_COLOR[lead.status] }}>
                          <StatusIcon size={12} /> {lead.status}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Unscored</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{lead.stage}</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    Add leads above to start scoring.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_STAGES.map((stage) => {
            const stageLeads = leads.filter((lead) => lead.stage === stage);

            return (
              <div key={stage} className="min-w-[260px] flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">{stage}</h3>
                  <span className="text-xs badge-cyan px-2 py-0.5 rounded-full">{stageLeads.length}</span>
                </div>
                <div className="space-y-3">
                  {stageLeads.length > 0 ? stageLeads.map((lead) => {
                    const StatusIcon = lead.status ? STATUS_ICON[lead.status] : null;

                    return (
                      <div key={lead.id} className="glass rounded-xl p-4 glass-hover">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{lead.company}</span>
                          {lead.status && StatusIcon ? (
                            <span className="flex items-center gap-1 text-xs" style={{ color: STATUS_COLOR[lead.status] }}>
                              <StatusIcon size={12} /> {lead.score ?? '--'}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Unscored</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <span>{lead.segment}</span>
                          <span>·</span>
                          <span>{lead.company_size} employees</span>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="glass rounded-xl p-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                      No leads
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
