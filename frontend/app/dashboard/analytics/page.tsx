'use client';

import { useState } from 'react';
import { BarChart2, TrendingUp, TrendingDown, DollarSign, Users, Activity } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, FunnelChart, Funnel, LabelList
} from 'recharts';

// ─── Cohort Heatmap Data ────────────────────────────────
const cohortWeeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];
const cohorts = [
  { name: 'Jan 24', values: [100, 92, 85, 78, 72, 68, 65, 63] },
  { name: 'Feb 24', values: [100, 88, 76, 70, 64, 60, 57, 55] },
  { name: 'Mar 24', values: [100, 95, 91, 88, 85, 83, 81, 80] },
  { name: 'Apr 24', values: [100, 80, 68, 58, 50, 44, 40, 38] },
  { name: 'May 24', values: [100, 90, 84, 79, 75, 72, 70, 68] },
  { name: 'Jun 24', values: [100, 86, 74, 66, 60, 55, 52, 50] },
  { name: 'Jul 24', values: [100, 93, 88, 84, 80, 78, 76, 75] },
  { name: 'Aug 24', values: [100, 91, 85, 80, 76, 73, null, null] },
];

// ─── Revenue Data ────────────────────────────────────
const revenueData = [
  { month: 'Sep', arr: 4.2, new: 0.8 }, { month: 'Oct', arr: 4.8, new: 1.1 },
  { month: 'Nov', arr: 5.5, new: 0.9 }, { month: 'Dec', arr: 6.1, new: 1.3 },
  { month: 'Jan', arr: 6.8, new: 1.0 }, { month: 'Feb', arr: 7.4, new: 1.2 },
  { month: 'Mar', arr: 8.2, new: 1.5 }, { month: 'Apr', arr: 8.9, new: 1.1 },
];

// ─── Onboarding Funnel ────────────────────────────────────
const funnelData = [
  { name: 'Signed Up', value: 120, fill: '#00d4ff' },
  { name: 'API Key Created', value: 98, fill: '#0099cc' },
  { name: 'First API Call', value: 72, fill: '#7c3aed' },
  { name: 'Integration Live', value: 55, fill: '#10d982' },
  { name: 'Production Traffic', value: 38, fill: '#f59e0b' },
];

// ─── Segment Breakdown ────────────────────────────────────
const segments = [
  { name: 'Payments', value: 8, color: '#00d4ff' },
  { name: 'Lending', value: 4, color: '#7c3aed' },
  { name: 'Neobank', value: 3, color: '#10d982' },
  { name: 'WealthTech', value: 3, color: '#f59e0b' },
  { name: 'BaaS/APIs', value: 4, color: '#ef4444' },
  { name: 'Other', value: 2, color: '#6b7280' },
];

// ─── Health Distribution ────────────────────────────────────
const healthDist = [
  { range: '0-20', count: 1, fill: '#ef4444' },
  { range: '21-40', count: 4, fill: '#f59e0b' },
  { range: '41-60', count: 5, fill: '#f59e0b' },
  { range: '61-80', count: 6, fill: '#10d982' },
  { range: '81-100', count: 8, fill: '#00d4ff' },
];

function getHeatColor(val: number | null) {
  if (val === null) return 'var(--bg-surface)';
  if (val >= 80) return 'rgba(0, 212, 255, 0.6)';
  if (val >= 60) return 'rgba(16, 217, 130, 0.5)';
  if (val >= 40) return 'rgba(245, 158, 11, 0.5)';
  return 'rgba(239, 68, 68, 0.5)';
}

export default function AnalyticsPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart2 className="text-[var(--accent)]" /> Analytics & Insights</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Portfolio performance, cohort retention, and revenue attribution.</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: DollarSign, label: 'Total ARR', value: '₹1.07Cr', delta: '+18% QoQ', color: 'var(--green)' },
          { icon: Users, label: 'Active Partners', value: '24', delta: '+6 this quarter', color: 'var(--accent)' },
          { icon: TrendingDown, label: 'Churn Rate', value: '8.3%', delta: '↓ 2.1% vs Q3', color: 'var(--green)' },
          { icon: Activity, label: 'Avg Health', value: '64.2', delta: '↑ 3pts this month', color: 'var(--yellow)' },
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
              <AreaChart data={revenueData}>
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
              <BarChart data={healthDist}>
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={32}>
                  {healthDist.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
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
                    <th key={w} className="text-center px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>{w}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohorts.map(c => (
                  <tr key={c.name}>
                    <td className="px-3 py-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>{c.name}</td>
                    {c.values.map((v, i) => (
                      <td key={i} className="text-center px-1 py-1">
                        <div className="rounded-md py-1.5 font-mono text-xs transition-all"
                          style={{ background: getHeatColor(v), color: v !== null ? 'white' : 'transparent' }}>
                          {v !== null ? `${v}%` : ''}
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
            {funnelData.map((step, i) => (
              <div key={step.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: 'var(--text-secondary)' }}>{step.name}</span>
                  <span className="font-mono" style={{ color: step.fill }}>{step.value}</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${(step.value / 120) * 100}%`, background: step.fill }} />
                </div>
                {i < funnelData.length - 1 && (
                  <div className="text-xs text-right mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {Math.round((funnelData[i + 1].value / step.value) * 100)}% conversion
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Segment Breakdown */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold mb-4">Partner Segments</h3>
          <div className="flex items-center justify-center" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={segments} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3} stroke="none">
                  {segments.map((s, i) => (
                    <Cell key={i} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {segments.map(s => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span style={{ color: 'var(--text-secondary)' }}>{s.name} ({s.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
