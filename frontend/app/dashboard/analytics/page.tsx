'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart2,
  TrendingDown,
  IndianRupee,
  Users,
  Activity,
  Loader2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { buildTenantHeaders } from '../../../lib/auth';
import { useAuthStore } from '../../../stores/authStore';

interface AnalyticsKpis {
  active_partners: number;
  at_risk: number;
  avg_health_score: number;
  api_calls_today: number;
  alerts_today: number;
  nps: number;
}

interface AnalyticsPartner {
  id: string;
  health_score: number;
  mrr: number;
  status: 'active' | 'declining' | 'at_risk';
}

interface RevenueTrendResponse {
  months: Array<{
    month: string;
    mrr: number;
    partners: number;
  }>;
  total_mrr: number;
}

interface SegmentBreakdownResponse {
  segments: Array<{
    segment: string;
    count: number;
    avg_health: number;
    total_mrr: number;
  }>;
}

interface CohortRetentionPoint {
  week: number;
  rate: number;
  count: number;
}

interface CohortsResponse {
  cohorts: Record<string, {
    total: number;
    retention: CohortRetentionPoint[];
  }>;
}

const SEGMENT_COLORS = ['#00d4ff', '#7c3aed', '#10d982', '#f59e0b', '#ef4444', '#6b7280'];
const HEALTH_BUCKET_COLORS = ['#ef4444', '#f59e0b', '#facc15', '#10d982', '#00d4ff'];

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  delta: string;
  color: string;
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

export default function AnalyticsPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const org = useAuthStore((state) => state.org);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<AnalyticsKpis | null>(null);
  const [partners, setPartners] = useState<AnalyticsPartner[]>([]);
  const [revenue, setRevenue] = useState<RevenueTrendResponse | null>(null);
  const [segments, setSegments] = useState<SegmentBreakdownResponse | null>(null);
  const [cohorts, setCohorts] = useState<CohortsResponse | null>(null);

  useEffect(() => {
    const loadAnalytics = async () => {
      if (!accessToken || !org?.id) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const headers = buildTenantHeaders(accessToken, org.id);
        const [kpisRes, partnersRes, revenueRes, segmentsRes, cohortsRes] = await Promise.all([
          fetch('/api/analytics/kpis', { headers }),
          fetch('/api/analytics/partners', { headers }),
          fetch('/api/analytics/revenue-trend', { headers }),
          fetch('/api/analytics/segment-breakdown', { headers }),
          fetch('/api/analytics/cohorts', { headers }),
        ]);

        if (!kpisRes.ok || !partnersRes.ok || !revenueRes.ok || !segmentsRes.ok || !cohortsRes.ok) {
          throw new Error('Failed to load analytics');
        }

        const [kpisPayload, partnersPayload, revenuePayload, segmentsPayload, cohortsPayload] = await Promise.all([
          kpisRes.json() as Promise<AnalyticsKpis>,
          partnersRes.json() as Promise<{ partners: AnalyticsPartner[] }>,
          revenueRes.json() as Promise<RevenueTrendResponse>,
          segmentsRes.json() as Promise<SegmentBreakdownResponse>,
          cohortsRes.json() as Promise<CohortsResponse>,
        ]);

        setKpis(kpisPayload);
        setPartners(partnersPayload.partners);
        setRevenue(revenuePayload);
        setSegments(segmentsPayload);
        setCohorts(cohortsPayload);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    void loadAnalytics();
  }, [accessToken, org?.id]);

  const healthBuckets = useMemo(() => {
    const buckets = [
      { range: '0-20', count: 0 },
      { range: '21-40', count: 0 },
      { range: '41-60', count: 0 },
      { range: '61-80', count: 0 },
      { range: '81-100', count: 0 },
    ];

    partners.forEach((partner) => {
      if (partner.health_score <= 20) buckets[0].count += 1;
      else if (partner.health_score <= 40) buckets[1].count += 1;
      else if (partner.health_score <= 60) buckets[2].count += 1;
      else if (partner.health_score <= 80) buckets[3].count += 1;
      else buckets[4].count += 1;
    });

    return buckets;
  }, [partners]);

  const atRiskRevenue = partners
    .filter((partner) => partner.status === 'at_risk')
    .reduce((sum, partner) => sum + partner.mrr, 0);

  const cohortEntries = useMemo(
    () => Object.entries(cohorts?.cohorts || {}),
    [cohorts],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading analytics...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart2 className="text-[var(--accent)]" /> Analytics & Insights
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Revenue, health distribution, and segment performance from the live analytics service.
        </p>
      </div>

      {error && <div className="badge-red rounded-xl px-4 py-3 text-sm">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={IndianRupee}
          label="Portfolio MRR"
          value={formatMoney(revenue?.total_mrr || 0)}
          delta={`${kpis?.active_partners ?? 0} active partners`}
          color="var(--green)"
        />
        <StatCard
          icon={Users}
          label="At-risk partners"
          value={String(kpis?.at_risk ?? 0)}
          delta={`${formatMoney(atRiskRevenue)} exposed revenue`}
          color="var(--red)"
        />
        <StatCard
          icon={TrendingDown}
          label="Avg health"
          value={String(kpis?.avg_health_score ?? 0)}
          delta={`NPS ${kpis?.nps ?? 0}`}
          color="var(--yellow)"
        />
        <StatCard
          icon={Activity}
          label="API calls today"
          value={(kpis?.api_calls_today ?? 0).toLocaleString()}
          delta={`${kpis?.alerts_today ?? 0} alerts today`}
          color="var(--accent)"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold mb-4">Revenue Trend</h3>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={(revenue?.months || []).map((month) => ({
                  month: month.month.slice(5),
                  mrr: month.mrr,
                }))}
              >
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value ?? 0))}
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="mrr" stroke="var(--accent)" strokeWidth={2} fill="url(#revenueGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold mb-4">Health Distribution</h3>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={healthBuckets}>
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={28}>
                  {healthBuckets.map((_, index) => (
                    <Cell key={index} fill={HEALTH_BUCKET_COLORS[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold mb-4">Partner Segments</h3>
          <div className="flex items-center justify-center" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={segments?.segments || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={84}
                  dataKey="count"
                  paddingAngle={3}
                  stroke="none"
                  nameKey="segment"
                >
                  {(segments?.segments || []).map((_, index) => (
                    <Cell key={index} fill={SEGMENT_COLORS[index % SEGMENT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {(segments?.segments || []).map((segment, index) => (
              <div key={segment.segment} className="flex items-center gap-1.5 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ background: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }} />
                <span style={{ color: 'var(--text-secondary)' }}>
                  {segment.segment} ({segment.count})
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold mb-4">Segment Breakdown</h3>
          <div className="space-y-3">
            {(segments?.segments || []).length > 0 ? (
              (segments?.segments || []).map((segment) => (
                <div key={segment.segment} className="glass rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{segment.segment}</span>
                    <span className="text-xs badge-cyan px-2 py-0.5 rounded-full">{segment.count} partners</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span>Avg health: {segment.avg_health}</span>
                    <span>MRR: {formatMoney(segment.total_mrr)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No segment data available yet.
              </div>
            )}
          </div>
        </div>

        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4">Cohort Retention</h3>
          {cohortEntries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Cohort</th>
                    {Array.from({ length: 12 }, (_, index) => (
                      <th
                        key={index}
                        className="text-center px-2 py-2 font-medium"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        W{index + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohortEntries.map(([month, cohort]) => (
                    <tr key={month}>
                      <td className="px-3 py-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {month} ({cohort.total})
                      </td>
                      {cohort.retention.map((point) => {
                        const percent = Math.round(point.rate * 100);
                        const background = percent >= 80
                          ? 'rgba(0, 212, 255, 0.6)'
                          : percent >= 60
                            ? 'rgba(16, 217, 130, 0.5)'
                            : percent >= 40
                              ? 'rgba(245, 158, 11, 0.5)'
                              : percent > 0
                                ? 'rgba(239, 68, 68, 0.5)'
                                : 'var(--bg-elevated)';

                        return (
                          <td key={point.week} className="text-center px-1 py-1">
                            <div
                              className="rounded-md py-1.5 font-mono text-xs"
                              style={{ background, color: percent > 0 ? 'white' : 'var(--text-muted)' }}
                              title={`${point.count} active partners`}
                            >
                              {percent > 0 ? `${percent}%` : '—'}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No cohort activity data available yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
