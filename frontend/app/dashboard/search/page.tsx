'use client';

import { useState } from 'react';
import { Search as SearchIcon, ExternalLink, Users, Activity, TrendingDown, Clock } from 'lucide-react';

// ─── Search index data ────────────────────────────────
const searchIndex = [
  { id: 'p1', type: 'partner', name: 'Razorpay', health: 38, segment: 'Payments', tier: 'Growth', desc: 'Payment gateway integration. API usage dropped 67%.' },
  { id: 'p2', type: 'partner', name: 'PhonePe', health: 91, segment: 'Payments', tier: 'Enterprise', desc: 'Top performing partner. Full feature adoption.' },
  { id: 'p3', type: 'partner', name: 'Cashfree', health: 55, segment: 'Payments', tier: 'Growth', desc: 'Feature adoption declining. Elevated churn risk.' },
  { id: 'p4', type: 'partner', name: 'Paytm', health: 78, segment: 'Payments', tier: 'Enterprise', desc: 'Active integration. Using 9/12 features.' },
  { id: 'p5', type: 'partner', name: 'BharatPe', health: 22, segment: 'Lending', tier: 'Basic', desc: 'Critical: No API calls in 32 days.' },
  { id: 'p6', type: 'partner', name: 'Pine Labs', health: 85, segment: 'POS', tier: 'Enterprise', desc: 'POS terminal integration. Very active.' },
  { id: 'p7', type: 'partner', name: 'Zeta', health: 72, segment: 'Banking', tier: 'Growth', desc: 'Banking-as-a-service integration. Growing.' },
  { id: 'p8', type: 'partner', name: 'M2P Fintech', health: 44, segment: 'BaaS', tier: 'Growth', desc: 'API usage dropped significantly.' },
  { id: 'p9', type: 'partner', name: 'Juspay', health: 88, segment: 'Payments', tier: 'Enterprise', desc: 'Highest API throughput. Near full adoption.' },
  { id: 'p10', type: 'partner', name: 'Setu', health: 67, segment: 'APIs', tier: 'Growth', desc: 'API-first fintech. Moderate adoption.' },
  { id: 'p14', type: 'partner', name: 'CRED', health: 94, segment: 'Payments', tier: 'Enterprise', desc: 'Flagship partner. 100% feature adoption.' },
  { id: 'p18', type: 'partner', name: 'Zerodha', health: 96, segment: 'WealthTech', tier: 'Enterprise', desc: 'Highest volume partner. Full platform utilization.' },
  { id: 'a1', type: 'alert', name: 'BharatPe — Critical Churn Alert', health: 0, segment: 'Alert', tier: '', desc: 'No API calls in 32 days. Churn probability 91%.' },
  { id: 'a2', type: 'alert', name: 'Razorpay — Usage Drop Alert', health: 0, segment: 'Alert', tier: '', desc: 'API usage dropped 67% vs last month.' },
  { id: 'a3', type: 'alert', name: 'Cashfree — Feature Adoption Alert', health: 0, segment: 'Alert', tier: '', desc: 'Feature adoption dropped below threshold.' },
  { id: 'e1', type: 'event', name: 'Paytm — Integration Updated', health: 0, segment: 'Event', tier: '', desc: 'Paytm upgraded to SDK v4.2. All tests passing.' },
  { id: 'e2', type: 'event', name: 'CRED — New Webhook Registered', health: 0, segment: 'Event', tier: '', desc: 'Production webhook endpoint registered for payment.completed events.' },
];

const recentSearches = ['BharatPe churn risk', 'payment errors', 'enterprise partners', 'API usage trends'];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<typeof searchIndex>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setHasSearched(true);
    const lower = q.toLowerCase();
    const filtered = searchIndex.filter(item =>
      item.name.toLowerCase().includes(lower) ||
      item.desc.toLowerCase().includes(lower) ||
      item.segment.toLowerCase().includes(lower)
    );
    setResults(filtered);
  };

  const typeIcon = { partner: Users, alert: TrendingDown, event: Activity };
  const typeColor = { partner: 'var(--accent)', alert: 'var(--red)', event: 'var(--green)' };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">
          <span className="gradient-text">Intelligent Search</span>
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Search partners, alerts, events, and insights across your entire platform.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <SearchIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search partners, alerts, events..."
          className="w-full input-dark rounded-2xl pl-12 pr-4 py-4 text-base"
          autoFocus
        />
      </div>

      {/* Recent Searches */}
      {!hasSearched && (
        <div className="space-y-3">
          <h3 className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Recent Searches</h3>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map(rs => (
              <button key={rs} onClick={() => handleSearch(rs)}
                className="glass rounded-lg px-3 py-1.5 text-xs glass-hover flex items-center gap-1.5">
                <Clock size={10} style={{ color: 'var(--text-muted)' }} />
                {rs}
              </button>
            ))}
          </div>

          {/* Suggested */}
          <h3 className="text-xs font-medium mt-6" style={{ color: 'var(--text-muted)' }}>Suggested</h3>
          <div className="grid grid-cols-2 gap-3">
            {searchIndex.filter(s => s.type === 'partner' && s.health < 50).slice(0, 4).map(item => (
              <div key={item.id} className="glass rounded-xl p-4 glass-hover cursor-pointer" onClick={() => handleSearch(item.name)}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>{item.name[0]}</div>
                  <span className="font-medium text-sm">{item.name}</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {hasSearched && (
        <div className="space-y-2">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {results.length} result{results.length !== 1 ? 's' : ''} for &quot;{query}&quot;
          </div>
          {results.length > 0 ? (
            <div className="space-y-2">
              {results.map(item => {
                const Icon = typeIcon[item.type as keyof typeof typeIcon] || Activity;
                const color = typeColor[item.type as keyof typeof typeColor] || 'var(--text-muted)';
                return (
                  <div key={item.id} className="glass rounded-xl p-4 glass-hover cursor-pointer flex items-start gap-4 transition-all">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: `${color}20` }}>
                      <Icon size={16} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{item.name}</span>
                        {item.tier && <span className="text-xs badge-cyan px-2 py-0.5 rounded">{item.tier}</span>}
                        <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: `${color}20`, color }}>{item.type}</span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.desc}</p>
                      {item.type === 'partner' && (
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                              <div className="h-full rounded-full" style={{ width: `${item.health}%`, background: item.health < 40 ? 'var(--red)' : item.health < 60 ? 'var(--yellow)' : 'var(--green)' }} />
                            </div>
                            <span className="text-xs font-mono" style={{ color: item.health < 40 ? 'var(--red)' : 'var(--green)' }}>{item.health}</span>
                          </div>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.segment}</span>
                        </div>
                      )}
                    </div>
                    <ExternalLink size={14} className="shrink-0 mt-1" style={{ color: 'var(--text-muted)' }} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass rounded-2xl p-12 text-center">
              <SearchIcon size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No results found for &quot;{query}&quot;</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Try searching for a partner name, segment, or event type.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
