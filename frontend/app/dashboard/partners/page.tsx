'use client';

import { useState } from 'react';
import { Users, TrendingDown, TrendingUp, AlertTriangle, ExternalLink, Activity, ChevronRight, ArrowUpRight, X } from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, RadialBarChart, RadialBar, BarChart, Bar, Cell
} from 'recharts';

// ─── Synthetic partner data (30 partners, realistic Indian fintech) ──────
const allPartners = [
  { id: 'p1', name: 'Razorpay', health: 38, churn: 0.82, trend: 'down', tier: 'Growth', lastSeen: '18d ago', apiCalls7d: 120, apiCalls30d: 890, features: 4, totalFeatures: 12, segment: 'Payments', revenue: 24999, since: 'Jan 2024', contacts: ['vikram@razorpay.com'] },
  { id: 'p2', name: 'PhonePe', health: 91, churn: 0.04, trend: 'up', tier: 'Enterprise', lastSeen: '2h ago', apiCalls7d: 4500, apiCalls30d: 18200, features: 11, totalFeatures: 12, segment: 'Payments', revenue: 89999, since: 'Mar 2023', contacts: ['ops@phonepe.com'] },
  { id: 'p3', name: 'Cashfree', health: 55, churn: 0.41, trend: 'down', tier: 'Growth', lastSeen: '5d ago', apiCalls7d: 680, apiCalls30d: 2100, features: 6, totalFeatures: 12, segment: 'Payments', revenue: 14999, since: 'Jul 2024', contacts: ['devrel@cashfree.com'] },
  { id: 'p4', name: 'Paytm', health: 78, churn: 0.17, trend: 'up', tier: 'Enterprise', lastSeen: '1h ago', apiCalls7d: 3200, apiCalls30d: 13500, features: 9, totalFeatures: 12, segment: 'Payments', revenue: 59999, since: 'Feb 2024', contacts: ['integration@paytm.com'] },
  { id: 'p5', name: 'BharatPe', health: 22, churn: 0.91, trend: 'down', tier: 'Basic', lastSeen: '32d ago', apiCalls7d: 0, apiCalls30d: 45, features: 2, totalFeatures: 12, segment: 'Lending', revenue: 2999, since: 'Oct 2024', contacts: ['tech@bharatpe.com'] },
  { id: 'p6', name: 'Pine Labs', health: 85, churn: 0.08, trend: 'up', tier: 'Enterprise', lastSeen: '4h ago', apiCalls7d: 2800, apiCalls30d: 11200, features: 10, totalFeatures: 12, segment: 'POS', revenue: 49999, since: 'May 2023', contacts: ['api@pinelabs.com'] },
  { id: 'p7', name: 'Zeta', health: 72, churn: 0.22, trend: 'up', tier: 'Growth', lastSeen: '1d ago', apiCalls7d: 1200, apiCalls30d: 5100, features: 7, totalFeatures: 12, segment: 'Banking', revenue: 19999, since: 'Aug 2024', contacts: ['platform@zeta.tech'] },
  { id: 'p8', name: 'M2P Fintech', health: 44, churn: 0.62, trend: 'down', tier: 'Growth', lastSeen: '12d ago', apiCalls7d: 89, apiCalls30d: 560, features: 3, totalFeatures: 12, segment: 'BaaS', revenue: 9999, since: 'Nov 2024', contacts: ['support@m2pfintech.com'] },
  { id: 'p9', name: 'Juspay', health: 88, churn: 0.06, trend: 'up', tier: 'Enterprise', lastSeen: '30m ago', apiCalls7d: 5200, apiCalls30d: 21000, features: 11, totalFeatures: 12, segment: 'Payments', revenue: 79999, since: 'Jan 2023', contacts: ['eng@juspay.in'] },
  { id: 'p10', name: 'Setu', health: 67, churn: 0.29, trend: 'down', tier: 'Growth', lastSeen: '3d ago', apiCalls7d: 450, apiCalls30d: 2800, features: 5, totalFeatures: 12, segment: 'APIs', revenue: 14999, since: 'Jun 2024', contacts: ['hello@setu.co'] },
  { id: 'p11', name: 'Decentro', health: 73, churn: 0.21, trend: 'up', tier: 'Growth', lastSeen: '6h ago', apiCalls7d: 1100, apiCalls30d: 4300, features: 7, totalFeatures: 12, segment: 'APIs', revenue: 14999, since: 'Sep 2024', contacts: ['api@decentro.tech'] },
  { id: 'p12', name: 'Open Financial', health: 31, churn: 0.78, trend: 'down', tier: 'Basic', lastSeen: '25d ago', apiCalls7d: 12, apiCalls30d: 130, features: 2, totalFeatures: 12, segment: 'Banking', revenue: 4999, since: 'Dec 2024', contacts: ['dev@open.money'] },
  { id: 'p13', name: 'Lendingkart', health: 62, churn: 0.34, trend: 'up', tier: 'Growth', lastSeen: '2d ago', apiCalls7d: 780, apiCalls30d: 3200, features: 6, totalFeatures: 12, segment: 'Lending', revenue: 19999, since: 'Apr 2024', contacts: ['tech@lendingkart.com'] },
  { id: 'p14', name: 'CRED', health: 94, churn: 0.02, trend: 'up', tier: 'Enterprise', lastSeen: '10m ago', apiCalls7d: 8900, apiCalls30d: 35000, features: 12, totalFeatures: 12, segment: 'Payments', revenue: 99999, since: 'Feb 2023', contacts: ['infra@cred.club'] },
  { id: 'p15', name: 'Slice', health: 58, churn: 0.38, trend: 'down', tier: 'Growth', lastSeen: '7d ago', apiCalls7d: 340, apiCalls30d: 1800, features: 5, totalFeatures: 12, segment: 'Cards', revenue: 9999, since: 'Oct 2024', contacts: ['eng@sliceit.com'] },
  { id: 'p16', name: 'Jupiter', health: 80, churn: 0.14, trend: 'up', tier: 'Growth', lastSeen: '3h ago', apiCalls7d: 2100, apiCalls30d: 8400, features: 8, totalFeatures: 12, segment: 'Neobank', revenue: 29999, since: 'May 2024', contacts: ['platform@jupiter.money'] },
  { id: 'p17', name: 'Groww', health: 87, churn: 0.07, trend: 'up', tier: 'Enterprise', lastSeen: '1h ago', apiCalls7d: 3800, apiCalls30d: 15200, features: 10, totalFeatures: 12, segment: 'WealthTech', revenue: 69999, since: 'Mar 2024', contacts: ['api@groww.in'] },
  { id: 'p18', name: 'Zerodha', health: 96, churn: 0.01, trend: 'up', tier: 'Enterprise', lastSeen: '5m ago', apiCalls7d: 12000, apiCalls30d: 48000, features: 12, totalFeatures: 12, segment: 'WealthTech', revenue: 149999, since: 'Jan 2023', contacts: ['kite@zerodha.com'] },
  { id: 'p19', name: 'NiYO', health: 48, churn: 0.55, trend: 'down', tier: 'Growth', lastSeen: '14d ago', apiCalls7d: 120, apiCalls30d: 780, features: 4, totalFeatures: 12, segment: 'Neobank', revenue: 9999, since: 'Aug 2024', contacts: ['tech@goniyo.com'] },
  { id: 'p20', name: 'Rupeek', health: 35, churn: 0.76, trend: 'down', tier: 'Basic', lastSeen: '20d ago', apiCalls7d: 28, apiCalls30d: 210, features: 3, totalFeatures: 12, segment: 'Lending', revenue: 4999, since: 'Nov 2024', contacts: ['dev@rupeek.com'] },
];

function genSparkline(health: number) {
  const base = health;
  return Array.from({ length: 12 }, (_, i) => ({
    w: `W${i + 1}`,
    v: Math.max(0, Math.min(100, base + (Math.random() - 0.5) * 30 - (health < 50 ? i * 2 : -i * 0.5)))
  }));
}

// ─── Partner Detail Drawer ────────────────────────────────
function PartnerDrawer({ partner, onClose }: { partner: typeof allPartners[0]; onClose: () => void }) {
  const sparkline = genSparkline(partner.health);
  const adoptionPct = Math.round((partner.features / partner.totalFeatures) * 100);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full overflow-y-auto" style={{ background: 'var(--bg-surface)' }}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-4 px-6 py-5 border-b" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>{partner.name[0]}</div>
          <div className="flex-1">
            <h2 className="font-bold text-lg">{partner.name}</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{partner.segment} · {partner.tier} · Since {partner.since}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg glass glass-hover"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass rounded-xl p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: partner.health < 40 ? 'var(--red)' : partner.health < 60 ? 'var(--yellow)' : 'var(--green)' }}>{partner.health}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Health Score</div>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: partner.churn > 0.7 ? 'var(--red)' : 'var(--yellow)' }}>{Math.round(partner.churn * 100)}%</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Churn Risk</div>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>₹{(partner.revenue / 1000).toFixed(0)}K</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>MRR</div>
            </div>
          </div>

          {/* Health Sparkline */}
          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3">Health Trend (12 weeks)</h3>
            <div style={{ height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkline}>
                  <defs>
                    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="w" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={[0, 100]} />
                  <Area type="monotone" dataKey="v" stroke="var(--accent)" strokeWidth={2} fill="url(#sparkGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Feature Adoption */}
          <div className="glass rounded-xl p-5">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold">Feature Adoption</h3>
              <span className="text-xs font-mono" style={{ color: 'var(--accent)' }}>{partner.features}/{partner.totalFeatures}</span>
            </div>
            <div className="h-2 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${adoptionPct}%`, background: adoptionPct > 70 ? 'var(--green)' : adoptionPct > 40 ? 'var(--yellow)' : 'var(--red)' }} />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {['Auth API', 'KYC', 'Payments', 'Webhooks', 'Reports', 'Search', 'Analytics', 'Batch', 'Streaming', 'SDK', 'Dashboard', 'Custom'].slice(0, partner.totalFeatures).map((f, i) => (
                <div key={f} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full" style={{ background: i < partner.features ? 'var(--green)' : 'var(--bg-elevated)' }} />
                  <span style={{ color: i < partner.features ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* API Activity */}
          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3">API Activity</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xl font-bold">{partner.apiCalls7d.toLocaleString()}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Last 7 days</div>
              </div>
              <div>
                <div className="text-xl font-bold">{partner.apiCalls30d.toLocaleString()}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Last 30 days</div>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3">Primary Contact</h3>
            {partner.contacts.map(c => (
              <div key={c} className="flex items-center gap-2 text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>{c}</span>
                <ExternalLink size={12} style={{ color: 'var(--text-muted)' }} />
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button className="flex-1 btn-primary py-2.5 rounded-xl text-sm">Generate AI Outreach</button>
            <button className="flex-1 btn-ghost py-2.5 rounded-xl text-sm">Run SHAP Analysis</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Partners Page ────────────────────────────────────
export default function PartnersPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'at_risk' | 'healthy'>('all');
  const [selected, setSelected] = useState<typeof allPartners[0] | null>(null);

  const filtered = allPartners
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .filter(p => {
      if (filter === 'at_risk') return p.churn > 0.5;
      if (filter === 'healthy') return p.churn <= 0.3;
      return true;
    })
    .sort((a, b) => b.churn - a.churn);

  const atRiskCount = allPartners.filter(p => p.churn > 0.5).length;
  const healthyCount = allPartners.filter(p => p.churn <= 0.3).length;
  const totalMRR = allPartners.reduce((s, p) => s + p.revenue, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {selected && <PartnerDrawer partner={selected} onClose={() => setSelected(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="text-[var(--accent)]" /> Partner Portfolio</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{allPartners.length} partners · ₹{(totalMRR / 100000).toFixed(1)}L MRR · {atRiskCount} at risk</p>
        </div>
        <button className="btn-primary px-4 py-2 rounded-lg text-sm font-medium">+ Add Partner</button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <input placeholder="Search partners..." value={search} onChange={e => setSearch(e.target.value)}
          className="input-dark rounded-lg px-4 py-2 text-sm flex-1 max-w-xs" />
        {(['all', 'at_risk', 'healthy'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-all ${filter === f ? 'badge-cyan' : 'glass'}`}>
            {f === 'at_risk' ? `At Risk (${atRiskCount})` : f === 'healthy' ? `Healthy (${healthyCount})` : `All (${allPartners.length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                {['Partner', 'Segment', 'Health', 'Churn Risk', 'API 7d', 'Features', 'MRR', 'Trend', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} onClick={() => setSelected(p)}
                  className="border-b cursor-pointer transition-all"
                  style={{ borderColor: 'var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>{p.name[0]}</div>
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.tier} · {p.lastSeen}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="text-xs badge-cyan px-2 py-0.5 rounded">{p.segment}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                        <div className="h-full rounded-full" style={{ width: `${p.health}%`, background: p.health < 40 ? 'var(--red)' : p.health < 60 ? 'var(--yellow)' : 'var(--green)' }} />
                      </div>
                      <span className="text-xs font-mono" style={{ color: p.health < 40 ? 'var(--red)' : p.health < 60 ? 'var(--yellow)' : 'var(--green)' }}>{p.health}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.churn > 0.7 ? 'badge-red' : p.churn > 0.4 ? 'badge-yellow' : 'badge-green'}`}>
                      {Math.round(p.churn * 100)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{p.apiCalls7d.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs">{p.features}/{p.totalFeatures}</td>
                  <td className="px-4 py-3 font-mono text-xs">₹{(p.revenue / 1000).toFixed(0)}K</td>
                  <td className="px-4 py-3">
                    {p.trend === 'down' ? <TrendingDown size={14} style={{ color: 'var(--red)' }} /> : <TrendingUp size={14} style={{ color: 'var(--green)' }} />}
                  </td>
                  <td className="px-4 py-3"><ChevronRight size={14} style={{ color: 'var(--text-muted)' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
