'use client';

import { useState } from 'react';
import { TrendingDown, TrendingUp, AlertTriangle, Users, Zap, BarChart2 } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar } from 'recharts';

// ─── Mock data ────────────────────────────────────────────
const healthTrend = [
  { day: 'Mon', score: 72 }, { day: 'Tue', score: 68 }, { day: 'Wed', score: 71 },
  { day: 'Thu', score: 65 }, { day: 'Fri', score: 58 }, { day: 'Sat', score: 62 }, { day: 'Sun', score: 60 },
];

const partners = [
  { id: 1, name: 'Razorpay', health: 38, churn: 0.82, trend: 'down', status: 'at_risk', lastSeen: '18d ago', tier: 'Growth' },
  { id: 2, name: 'PhonePe', health: 91, churn: 0.04, trend: 'up', status: 'active', lastSeen: '2h ago', tier: 'Enterprise' },
  { id: 3, name: 'Cashfree', health: 55, churn: 0.41, trend: 'down', status: 'at_risk', lastSeen: '5d ago', tier: 'Growth' },
  { id: 4, name: 'Paytm', health: 78, churn: 0.17, trend: 'up', status: 'active', lastSeen: '1h ago', tier: 'Enterprise' },
  { id: 5, name: 'BharatPe', health: 22, churn: 0.91, trend: 'down', status: 'at_risk', lastSeen: '32d ago', tier: 'Basic' },
];

const alerts = [
  { id: 1, partner: 'BharatPe', msg: 'No API calls in 32 days. Churn risk: 91%', severity: 'high', time: '2m ago' },
  { id: 2, partner: 'Razorpay', msg: 'API usage dropped 67% vs last month', severity: 'high', time: '18m ago' },
  { id: 3, partner: 'Cashfree', msg: 'Feature adoption dropped below threshold', severity: 'medium', time: '1h ago' },
];

// ─── Churn Gauge ──────────────────────────────────────────
function ChurnGauge({ value, name }: { value: number; name: string }) {
  const color = value > 0.7 ? '#ef4444' : value > 0.4 ? '#f59e0b' : '#10d982';
  const data = [{ value: Math.round(value * 100), fill: color }];

  return (
    <div className="flex flex-col items-center">
      <div style={{ width: 64, height: 64 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="100%"
            startAngle={90} endAngle={-270} data={data} barSize={6}>
            <RadialBar dataKey="value" cornerRadius={4} background={{ fill: 'rgba(255,255,255,0.05)' }} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <span className="text-xs mt-1 font-mono" style={{ color }}>{Math.round(value * 100)}%</span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{name}</span>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, delta, color }: {
  icon: React.ElementType; label: string; value: string; delta: string; color: string;
}) {
  return (
    <div className="glass rounded-xl p-5 glass-hover">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{delta}</div>
    </div>
  );
}

// ─── Alert row ────────────────────────────────────────────
function AlertRow({ alert }: { alert: typeof alerts[0] }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg glass-hover cursor-pointer group transition-all">
      <AlertTriangle size={14} className="mt-0.5 shrink-0"
        style={{ color: alert.severity === 'high' ? 'var(--red)' : 'var(--yellow)' }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{alert.partner}</div>
        <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{alert.msg}</div>
      </div>
      <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{alert.time}</span>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────
export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'at_risk'>('all');
  const filtered = activeTab === 'at_risk' ? partners.filter(p => p.status === 'at_risk') : partners;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Partner Intelligence</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Last updated <span style={{ color: 'var(--accent)' }}>just now</span> · 30 partners monitored
          </p>
        </div>
        <button className="btn-primary px-4 py-2 rounded-lg text-sm font-medium">
          + Add partner
        </button>
      </div>

      {/* ─── Stats row ─────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Active partners" value="26" delta="4 onboarding" color="var(--accent)" />
        <StatCard icon={AlertTriangle} label="At risk" value="3" delta="↑ 2 this week" color="var(--red)" />
        <StatCard icon={TrendingDown} label="Avg health score" value="68" delta="↓ 4pts vs last week" color="var(--yellow)" />
        <StatCard icon={Zap} label="Alerts today" value="7" delta="3 critical" color="var(--yellow)" />
      </div>

      {/* ─── Main grid ─────────────────────────────── */}
      <div className="grid grid-cols-3 gap-6">

        {/* Partner list — 2/3 width */}
        <div className="col-span-2 glass rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold text-sm">Partner Health</h2>
            <div className="flex gap-1">
              {(['all', 'at_risk'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`text-xs px-3 py-1 rounded-lg transition-all ${activeTab === tab ? 'badge-cyan' : ''}`}
                  style={{ color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {tab === 'at_risk' ? 'At risk' : 'All'}
                </button>
              ))}
            </div>
          </div>

          {/* Partner rows */}
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {filtered.map(partner => (
              <div key={partner.id}
                className="flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-all group"
                style={{ background: 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                {/* Avatar */}
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                  {partner.name[0]}
                </div>

                {/* Name + tier */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{partner.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {partner.tier} · Last seen {partner.lastSeen}
                  </div>
                </div>

                {/* Health bar */}
                <div className="w-24">
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: 'var(--text-muted)' }}>Health</span>
                    <span style={{ color: partner.health < 40 ? 'var(--red)' : partner.health < 60 ? 'var(--yellow)' : 'var(--green)' }}>
                      {partner.health}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${partner.health}%`,
                        background: partner.health < 40 ? 'var(--red)' : partner.health < 60 ? 'var(--yellow)' : 'var(--green)'
                      }} />
                  </div>
                </div>

                {/* Churn gauge */}
                <ChurnGauge value={partner.churn} name="Churn" />

                {/* Status badge */}
                <span className={`text-xs px-2 py-0.5 rounded-full ${partner.status === 'at_risk' ? 'badge-red' : 'badge-green'}`}>
                  {partner.status === 'at_risk' ? '⚠ At risk' : '✓ Active'}
                </span>

                {/* Trend */}
                {partner.trend === 'down'
                  ? <TrendingDown size={14} style={{ color: 'var(--red)' }} />
                  : <TrendingUp size={14} style={{ color: 'var(--green)' }} />
                }
              </div>
            ))}
          </div>
        </div>

        {/* Right column — 1/3 width */}
        <div className="space-y-4">
          {/* Health trend chart */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Portfolio Health</h3>
              <BarChart2 size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div style={{ height: 100 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={healthTrend}>
                  <defs>
                    <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text-secondary)' }}
                    itemStyle={{ color: 'var(--accent)' }}
                  />
                  <Area type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2} fill="url(#healthGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
              Avg score ↓ 8pts this week
            </div>
          </div>

          {/* Live alerts */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Live Alerts</h3>
              <span className="text-xs badge-red px-2 py-0.5 rounded-full">3 critical</span>
            </div>
            <div className="space-y-1">
              {alerts.map(alert => <AlertRow key={alert.id} alert={alert} />)}
            </div>
          </div>

          {/* Quick actions */}
          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold mb-3">Quick actions</h3>
            <div className="space-y-2">
              {[
                { label: 'Generate outreach for BharatPe', color: 'var(--red-dim)', border: 'rgba(239,68,68,0.3)' },
                { label: 'Score new leads batch', color: 'var(--accent-dim)', border: 'rgba(0,212,255,0.3)' },
                { label: 'Export weekly PDF report', color: 'var(--green-dim)', border: 'rgba(16,217,130,0.3)' },
              ].map(({ label, color, border }) => (
                <button key={label}
                  className="w-full text-left text-xs px-3 py-2.5 rounded-lg transition-all"
                  style={{ background: color, border: `1px solid ${border}`, color: 'var(--text-primary)' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
