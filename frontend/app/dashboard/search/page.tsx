'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search as SearchIcon, ExternalLink, Users, Activity, TrendingDown, Clock, Loader2 } from 'lucide-react';
import { buildTenantHeaders } from '../../../lib/auth';
import { useAuthStore } from '../../../stores/authStore';

interface AnalyticsPartner {
  id: string;
  name: string;
  domain: string | null;
  tier: string;
  health_score: number;
  status: 'active' | 'declining' | 'at_risk';
  api_calls: number;
  churn_pct: number;
}

interface AnalyticsAlert {
  id: string;
  partner_name: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'info';
  created_at: string;
}

type SearchItem =
  | {
      id: string;
      type: 'partner';
      name: string;
      health: number;
      segment: string;
      tier: string;
      desc: string;
    }
  | {
      id: string;
      type: 'alert';
      name: string;
      health: 0;
      segment: 'Alert';
      tier: '';
      desc: string;
    };

export default function SearchPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const org = useAuthStore((state) => state.org);
  const [query, setQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchIndex, setSearchIndex] = useState<SearchItem[]>([]);

  useEffect(() => {
    const loadSearchData = async () => {
      if (!accessToken || !org?.id) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const headers = buildTenantHeaders(accessToken, org.id);
        const [partnersRes, alertsRes] = await Promise.all([
          fetch('/api/analytics/partners', { headers }),
          fetch('/api/analytics/alerts', { headers }),
        ]);

        if (!partnersRes.ok || !alertsRes.ok) {
          throw new Error('Failed to build search index');
        }

        const [partnersPayload, alertsPayload] = await Promise.all([
          partnersRes.json() as Promise<{ partners: AnalyticsPartner[] }>,
          alertsRes.json() as Promise<{ alerts: AnalyticsAlert[] }>,
        ]);

        const partnerItems: SearchItem[] = partnersPayload.partners.map((partner) => ({
          id: partner.id,
          type: 'partner',
          name: partner.name,
          health: partner.health_score,
          segment: partner.status.replace('_', ' '),
          tier: partner.tier,
          desc: `${partner.churn_pct}% churn risk • ${partner.api_calls.toLocaleString()} API calls • ${partner.domain || 'No domain on file'}`,
        }));

        const alertItems: SearchItem[] = alertsPayload.alerts.map((alert) => ({
          id: alert.id,
          type: 'alert',
          name: `${alert.partner_name} alert`,
          health: 0,
          segment: 'Alert',
          tier: '',
          desc: alert.message,
        }));

        setSearchIndex([...partnerItems, ...alertItems]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to build search index');
      } finally {
        setLoading(false);
      }
    };

    void loadSearchData();
  }, [accessToken, org?.id]);

  const results = useMemo(() => {
    if (query.length < 2) {
      return [];
    }

    const lower = query.toLowerCase();
    return searchIndex.filter((item) =>
      item.name.toLowerCase().includes(lower)
      || item.desc.toLowerCase().includes(lower)
      || item.segment.toLowerCase().includes(lower),
    );
  }, [query, searchIndex]);

  const suggested = searchIndex
    .filter((item): item is Extract<SearchItem, { type: 'partner' }> => item.type === 'partner' && item.health < 50)
    .slice(0, 4);

  const recentSearches = suggested.map((item) => item.name);

  const typeIcon = { partner: Users, alert: TrendingDown };
  const typeColor = { partner: 'var(--accent)', alert: 'var(--red)' };

  const handleSearch = (value: string) => {
    setQuery(value);
    setHasSearched(value.length >= 2);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">
          <span className="gradient-text">Intelligent Search</span>
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Search live partners and alerts across your workspace.
        </p>
      </div>

      <div className="relative">
        <SearchIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={query}
          onChange={(event) => handleSearch(event.target.value)}
          placeholder="Search partners, alerts, status..."
          className="w-full input-dark rounded-2xl pl-12 pr-4 py-4 text-base"
          autoFocus
        />
      </div>

      {error && <div className="badge-red rounded-xl px-4 py-3 text-sm">{error}</div>}

      {loading ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Loader2 size={28} className="mx-auto mb-3 animate-spin" style={{ color: 'var(--accent)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Building live search index...</p>
        </div>
      ) : !hasSearched ? (
        <div className="space-y-3">
          <h3 className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Recent Searches</h3>
          <div className="flex flex-wrap gap-2">
            {recentSearches.length > 0 ? (
              recentSearches.map((recentSearch) => (
                <button
                  key={recentSearch}
                  onClick={() => handleSearch(recentSearch)}
                  className="glass rounded-lg px-3 py-1.5 text-xs glass-hover flex items-center gap-1.5"
                >
                  <Clock size={10} style={{ color: 'var(--text-muted)' }} />
                  {recentSearch}
                </button>
              ))
            ) : (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No recent suggestions yet.</span>
            )}
          </div>

          <h3 className="text-xs font-medium mt-6" style={{ color: 'var(--text-muted)' }}>Suggested</h3>
          <div className="grid grid-cols-2 gap-3">
            {suggested.length > 0 ? (
              suggested.map((item) => (
                <div
                  key={item.id}
                  className="glass rounded-xl p-4 glass-hover cursor-pointer"
                  onClick={() => handleSearch(item.name)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: 'var(--red-dim)', color: 'var(--red)' }}
                    >
                      {item.name[0]}
                    </div>
                    <span className="font-medium text-sm">{item.name}</span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
                </div>
              ))
            ) : (
              <div className="glass rounded-xl p-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                No at-risk partner suggestions available.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {results.length} result{results.length !== 1 ? 's' : ''} for &quot;{query}&quot;
          </div>

          {results.length > 0 ? (
            <div className="space-y-2">
              {results.map((item) => {
                const Icon = typeIcon[item.type] || Activity;
                const color = typeColor[item.type] || 'var(--text-muted)';

                return (
                  <div key={item.id} className="glass rounded-xl p-4 glass-hover cursor-pointer flex items-start gap-4 transition-all">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}20` }}>
                      <Icon size={16} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{item.name}</span>
                        {item.tier && <span className="text-xs badge-cyan px-2 py-0.5 rounded">{item.tier}</span>}
                        <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: `${color}20`, color }}>
                          {item.type}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.desc}</p>
                      {item.type === 'partner' && (
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${item.health}%`,
                                  background: item.health < 40 ? 'var(--red)' : item.health < 60 ? 'var(--yellow)' : 'var(--green)',
                                }}
                              />
                            </div>
                            <span className="text-xs font-mono" style={{ color: item.health < 40 ? 'var(--red)' : 'var(--green)' }}>
                              {item.health}
                            </span>
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
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Try searching for a partner name, alert text, or status.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
