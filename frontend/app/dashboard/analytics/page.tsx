'use client';

import { useState, useEffect } from 'react';
import { BarChart2, TrendingDown, DollarSign, Users, Activity, Loader2, Wifi } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts';

// Fallback data if API is unreachable
const FALLBACK = {
  kpis: { total_partners: 20, at_risk_partners: 4, total_mrr: 566000, avg_health: 64.2, churn_rate_pct: 20, api_calls_today: 147892 },
  revenue: { monthly: [], current_arr: 6792000 },
  funnel: { steps: [] },
  segments: { segments: [] },
  healthDist: { distribution: [] },
  cohorts: { cohorts: {} },
};

function getHeatColor(val: number | null) {
  if (val === null) return 'var(--bg-surface)';
  if (val >= 80) return 'rgba(0, 212, 255, 0.6)';
  if (val >= 60) return 'rgba(16, 217, 130, 0.5)';
  if (val >= 40) return 'rgba(245, 158, 11, 0.5)';
  return 'rgba(239, 68, 68, 0.5)';
}

const FUNNEL_COLORS = ['#00d4ff', '#0099cc', '#7c3aed', '#10d982', '#f59e0b', '#ef4444', '#6b7280'];
const SEG_COLORS = ['#00d4ff', '#7c3aed', '#10d982', '#f59e0b', '#ef4444', '#6b7280'];
const HEALTH_COLORS: Record<string, string> = { Critical: '#ef4444', Poor: '#f59e0b', Fair: '#f59e0b', Good: '#10d982', Excellent: '#00d4ff' };

export default function AnalyticsPage() {
  const [kpis, setKpis] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [funnel, setFunnel] = useState<any>(null);
  const [segments, setSegments] = useState<any>(null);
  const [healthDist, setHealthDist] = useState<any>(null);
  const [cohorts, setCohorts] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [kR, rR, fR, sR, hR, cR] = await Promise.all([
          fetch('/api/analytics/kpis'),
          fetch('/api/analytics/revenue'),
          fetch('/api/analytics/funnel'),
          fetch('/api/analytics/segments'),
          fetch('/api/analytics/health-distribution'),
          fetch('/api/analytics/cohorts'),
        ]);
        if (kR.ok) { setKpis(await kR.json()); setLive(true); } else setKpis(FALLBACK.kpis);
        if (rR.ok) setRevenue(await rR.json()); else setRevenue(FALLBACK.revenue);
        if (fR.ok) setFunnel(await fR.json()); else setFunnel(FALLBACK.funnel);
        if (sR.ok) setSegments(await sR.json()); else setSegments(FALLBACK.segments);
        if (hR.ok) setHealthDist(await hR.json()); else setHealthDist(FALLBACK.healthDist);
        if (cR.ok) setCohorts(await cR.json()); else setCohorts(FALLBACK.cohorts);
      } catch {
        setKpis(FALLBACK.kpis);
        setRevenue(FALLBACK.revenue);
        setFunnel(FALLBACK.funnel);
        setSegments(FALLBACK.segments);
        setHealthDist(FALLBACK.healthDist);
        setCohorts(FALLBACK.cohorts);
      }
      setLoading(false);
    };
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading analytics from API...</span>
        </div>
      </div>
    );
  }

  const revChart = revenue?.monthly?.map((m: any) => ({
    month: m.month.split('-')[1],
    arr: Math.round(m.total_mrr / 100000 * 10) / 10,
    new: Math.round(m.new_mrr / 100000 * 10) / 10,
  })) || [];

  const cohortEntries = Object.values(cohorts?.cohorts || {}) as any[];
  const cohortWeeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart2 className="text-[var(--accent)]" /> Analytics & Insights</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Portfolio performance, cohort retention, and revenue attribution.</p>
        </div>
        {live && (
          <span className="badge-green text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
            <Wifi size={10} /> Live from analytics-service
          </span>
        )}
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: DollarSign, label: 'Total ARR', value: `₹${((kpis?.total_mrr || 0) * 12 / 100000).toFixed(1)}L`, delta: `${kpis?.total_partners} partners`, color: 'var(--green)' },
          { icon: Users, label: 'Active Partners', value: String(kpis?.total_partners || 0), delta: `${kpis?.at_risk_partners} at risk`, color: 'var(--accent)' },
          { icon: TrendingDown, label: 'Churn Rate', value: `${kpis?.churn_rate_pct || 0}%`, delta: `${kpis?.at_risk_partners} flagged`, color: kpis?.churn_rate_pct > 15 ? 'var(--red)' : 'var(--green)' },
          { icon: Activity, label: 'Avg Health', value: String(kpis?.avg_health || 0), delta: `${kpis?.api_calls_today?.toLocaleString()} API calls today`, color: 'var(--yellow)' },
        ].map(({ icon: Icon, label, value, delta, color }) => (
          <div key={label} className="glass rounded-xl p-5 glass-hover">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
              <Icon size={16} style={{ color }} />
            </div>
            <div className="text-2xl font-bold mb-1">{value}</div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{delta}</div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Revenue Trend */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold mb-4">Revenue Growth (₹ Lakhs)</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revChart}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="arr" stroke="var(--accent)" strokeWidth={2} fill="url(#revGrad)" name="ARR" />
                <Area type="monotone" dataKey="new" stroke="var(--green)" strokeWidth={1.5} fill="none" name="New Revenue" strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Health Distribution */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold mb-4">Health Score Distribution</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={healthDist?.distribution || []}>
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={32}>
                  {(healthDist?.distribution || []).map((entry: any, i: number) => (
                    <Cell key={i} fill={HEALTH_COLORS[entry.label] || '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {healthDist && (
            <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>Mean: {healthDist.mean}</span>
              <span>Median: {healthDist.median}</span>
              <span>Std: {healthDist.std}</span>
            </div>
          )}
        </div>

        {/* Cohort Retention Heatmap */}
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4">Cohort Retention Heatmap</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Cohort</th>
                  {cohortWeeks.map(w => (
                    <th key={w} className="text-center px-2 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>{w}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohortEntries.map((c: any) => (
                  <tr key={c.month}>
                    <td className="px-3 py-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>{c.month}</td>
                    {(c.retention_pct || []).map((v: number, i: number) => (
                      <td key={i} className="text-center px-1 py-1">
                        <div className="rounded-md py-1.5 font-mono text-xs"
                          style={{ background: getHeatColor(v), color: 'white' }}>
                          {v}%
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Retention:</span>
            {[
              { label: '>80%', color: 'rgba(0, 212, 255, 0.6)' },
              { label: '60-80%', color: 'rgba(16, 217, 130, 0.5)' },
              { label: '40-60%', color: 'rgba(245, 158, 11, 0.5)' },
              { label: '<40%', color: 'rgba(239, 68, 68, 0.5)' },
            ].map(l => (
              <span key={l.label} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        {/* Onboarding Funnel */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold mb-4">Onboarding Funnel (Last 90d)</h3>
          <div className="space-y-3">
            {(funnel?.steps || []).map((step: any, i: number) => (
              <div key={step.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: 'var(--text-secondary)' }}>{step.name}</span>
                  <span className="font-mono" style={{ color: FUNNEL_COLORS[i] }}>{step.count}</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${step.pct}%`, background: FUNNEL_COLORS[i] }} />
                </div>
                {i < (funnel?.steps?.length || 0) - 1 && (
                  <div className="text-xs text-right mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {Math.round((funnel.steps[i + 1].count / step.count) * 100)}% conversion
                  </div>
                )}
              </div>
            ))}
          </div>
          {funnel?.avg_time_to_first_call_hours && (
            <div className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              Avg time to first API call: {funnel.avg_time_to_first_call_hours}h • To paying: {funnel.avg_time_to_paying_days}d
            </div>
          )}
        </div>

        {/* Segment Breakdown */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold mb-4">Partner Segments</h3>
          <div className="flex items-center justify-center" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={segments?.segments || []} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="count" paddingAngle={3} stroke="none" nameKey="name">
                  {(segments?.segments || []).map((_: any, i: number) => (
                    <Cell key={i} fill={SEG_COLORS[i % SEG_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {(segments?.segments || []).map((s: any, i: number) => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ background: SEG_COLORS[i % SEG_COLORS.length] }} />
                <span style={{ color: 'var(--text-secondary)' }}>{s.name} ({s.count})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
