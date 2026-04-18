'use client';

import { useState } from 'react';
import { Zap, ArrowUpRight, ArrowRight, RefreshCcw, Flame, Thermometer, Snowflake, Building2, DollarSign, Newspaper } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// ─── Synthetic leads ────────────────────────────────────
const leads = [
  { id: 'l1', company: 'Stripe India', size: 800, funding: 95, sentiment: 0.85, score: 94, status: 'HOT', segment: 'Payments', stage: 'Qualified' },
  { id: 'l2', company: 'Navi Technologies', size: 1200, funding: 120, sentiment: 0.72, score: 88, status: 'HOT', segment: 'Insurance', stage: 'Meeting' },
  { id: 'l3', company: 'Creditas', size: 200, funding: 15, sentiment: 0.6, score: 71, status: 'HOT', segment: 'Lending', stage: 'Qualified' },
  { id: 'l4', company: 'KreditBee', size: 500, funding: 40, sentiment: 0.55, score: 67, status: 'WARM', segment: 'Lending', stage: 'Outreach' },
  { id: 'l5', company: 'Uni Cards', size: 150, funding: 20, sentiment: 0.48, score: 58, status: 'WARM', segment: 'Cards', stage: 'Outreach' },
  { id: 'l6', company: 'Fi Money', size: 300, funding: 30, sentiment: 0.42, score: 53, status: 'WARM', segment: 'Neobank', stage: 'Qualified' },
  { id: 'l7', company: 'OneCard', size: 250, funding: 18, sentiment: 0.35, score: 45, status: 'WARM', segment: 'Cards', stage: 'Meeting' },
  { id: 'l8', company: 'EarlySalary', size: 80, funding: 5, sentiment: 0.2, score: 32, status: 'COLD', segment: 'Lending', stage: 'Outreach' },
  { id: 'l9', company: 'BankOpen', size: 60, funding: 2, sentiment: 0.1, score: 22, status: 'COLD', segment: 'Banking', stage: 'New' },
  { id: 'l10', company: 'FlexiLoans', size: 40, funding: 1, sentiment: -0.1, score: 15, status: 'COLD', segment: 'Lending', stage: 'New' },
];

const kanbanStages = ['New', 'Outreach', 'Qualified', 'Meeting', 'Negotiation'];

const statusIcon = { HOT: Flame, WARM: Thermometer, COLD: Snowflake };
const statusColor = { HOT: 'var(--red)', WARM: 'var(--yellow)', COLD: 'var(--accent)' };

const pipelineData = [
  { stage: 'New', count: 2, value: 3 },
  { stage: 'Outreach', count: 3, value: 19 },
  { stage: 'Qualified', count: 3, value: 31 },
  { stage: 'Meeting', count: 2, value: 38 },
];

export default function LeadsPage() {
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [scoring, setScoring] = useState(false);

  const runBatchScore = () => {
    setScoring(true);
    setTimeout(() => setScoring(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Zap className="text-[var(--accent)]" /> Lead Scoring Pipeline</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>XGBoost-powered prospect scoring with real-time signals.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 glass rounded-lg p-0.5">
            {(['table', 'kanban'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`text-xs px-3 py-1.5 rounded-md transition-all capitalize ${view === v ? 'badge-cyan' : ''}`}>
                {v}
              </button>
            ))}
          </div>
          <button onClick={runBatchScore} disabled={scoring}
            className="btn-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            {scoring ? <RefreshCcw className="animate-spin" size={14} /> : <Zap size={14} />}
            {scoring ? 'Scoring...' : 'Score All Leads'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: leads.length.toString(), icon: Building2, color: 'var(--accent)' },
          { label: 'Hot Leads', value: leads.filter(l => l.status === 'HOT').length.toString(), icon: Flame, color: 'var(--red)' },
          { label: 'Pipeline Value', value: '₹91L', icon: DollarSign, color: 'var(--green)' },
          { label: 'Avg Score', value: Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length).toString(), icon: Zap, color: 'var(--yellow)' },
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

      {/* Pipeline Chart */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-sm font-semibold mb-4">Pipeline Stages</h3>
        <div style={{ height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pipelineData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="stage" type="category" axisLine={false} tickLine={false}
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} width={80} />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20} fill="var(--accent)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {view === 'table' ? (
        /* Table View */
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                {['Company', 'Segment', 'Size', 'Funding', 'Sentiment', 'Score', 'Status', 'Stage'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map(l => {
                const SIcon = statusIcon[l.status as keyof typeof statusIcon];
                return (
                  <tr key={l.id} className="border-b transition-all cursor-pointer"
                    style={{ borderColor: 'var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-4 py-3 font-medium">{l.company}</td>
                    <td className="px-4 py-3"><span className="text-xs badge-cyan px-2 py-0.5 rounded">{l.segment}</span></td>
                    <td className="px-4 py-3 font-mono text-xs">{l.size}</td>
                    <td className="px-4 py-3 font-mono text-xs">${l.funding}M</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <div className="w-12 h-1.5 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.max(0, l.sentiment * 100)}%`, background: l.sentiment > 0.5 ? 'var(--green)' : l.sentiment > 0 ? 'var(--yellow)' : 'var(--red)' }} />
                        </div>
                        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{l.sentiment.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-bold ${l.score > 70 ? 'text-red-400' : l.score > 40 ? 'text-yellow-400' : 'text-blue-400'}`}>{l.score}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs" style={{ color: statusColor[l.status as keyof typeof statusColor] }}>
                        <SIcon size={12} /> {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{l.stage}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Kanban View */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {kanbanStages.map(stage => {
            const stageLeads = leads.filter(l => l.stage === stage);
            return (
              <div key={stage} className="min-w-[260px] flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">{stage}</h3>
                  <span className="text-xs badge-cyan px-2 py-0.5 rounded-full">{stageLeads.length}</span>
                </div>
                <div className="space-y-3">
                  {stageLeads.map(l => {
                    const SIcon = statusIcon[l.status as keyof typeof statusIcon];
                    return (
                      <div key={l.id} className="glass rounded-xl p-4 glass-hover cursor-pointer">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{l.company}</span>
                          <span className="flex items-center gap-1 text-xs" style={{ color: statusColor[l.status as keyof typeof statusColor] }}>
                            <SIcon size={12} /> {l.score}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <span>{l.segment}</span>
                          <span>·</span>
                          <span>{l.size} employees</span>
                        </div>
                      </div>
                    );
                  })}
                  {stageLeads.length === 0 && (
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
