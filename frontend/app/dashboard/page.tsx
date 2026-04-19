'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  TrendingDown,
  AlertTriangle,
  Users,
  Zap,
  BarChart2,
  FileDown,
  Loader2,
  RefreshCcw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import { buildTenantHeaders } from '../../lib/auth';
import { useAuthStore } from '../../stores/authStore';

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
  name: string;
  domain: string | null;
  tier: string;
  contact_email: string | null;
  contact_name: string | null;
  tags: string[];
  health_score: number;
  mrr: number;
  api_calls: number;
  churn_risk: number;
  churn_pct: number;
  nps: number;
  status: 'active' | 'declining' | 'at_risk';
  last_seen: string | null;
  created_at: string;
}

interface AnalyticsAlert {
  id: string;
  type: string;
  partner_name: string;
  partner_id: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'info';
  created_at: string;
}

interface HealthTrendPoint {
  date: string;
  avg_health: number;
}

function formatTimestamp(value: string | null) {
  if (!value) return 'No activity yet';
  return `${formatDistanceToNow(new Date(value), { addSuffix: true })}`;
}

function healthColor(score: number) {
  if (score < 40) return 'var(--red)';
  if (score < 65) return 'var(--yellow)';
  return 'var(--green)';
}

function churnColor(churnRisk: number) {
  if (churnRisk > 0.7) return '#ef4444';
  if (churnRisk > 0.4) return '#f59e0b';
  return '#10d982';
}

function ChurnGauge({ value }: { value: number }) {
  const data = [{ value: Math.round(value * 100), fill: churnColor(value) }];

  return (
    <div style={{ width: 64, height: 64 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="60%"
          outerRadius="100%"
          startAngle={90}
          endAngle={-270}
          data={data}
          barSize={6}
        >
          <RadialBar dataKey="value" cornerRadius={4} background={{ fill: 'rgba(255,255,255,0.05)' }} />
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  );
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
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {delta}
      </div>
    </div>
  );
}

function AlertRow({ alert }: { alert: AnalyticsAlert }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg glass-hover cursor-pointer group transition-all">
      <AlertTriangle
        size={14}
        className="mt-0.5 shrink-0"
        style={{ color: alert.severity === 'critical' || alert.severity === 'high' ? 'var(--red)' : 'var(--yellow)' }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{alert.partner_name}</div>
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {alert.message}
        </div>
      </div>
      <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
        {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const org = useAuthStore((state) => state.org);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<AnalyticsKpis | null>(null);
  const [partners, setPartners] = useState<AnalyticsPartner[]>([]);
  const [alerts, setAlerts] = useState<AnalyticsAlert[]>([]);
  const [trend, setTrend] = useState<HealthTrendPoint[]>([]);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [downloadingReport, setDownloadingReport] = useState(false);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (!accessToken || !org?.id) {
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const headers = buildTenantHeaders(accessToken, org.id);
      const [kpisRes, partnersRes, alertsRes, trendRes] = await Promise.all([
        fetch('/api/analytics/kpis', { headers }),
        fetch('/api/analytics/partners', { headers }),
        fetch('/api/analytics/alerts', { headers }),
        fetch('/api/analytics/health-trend', { headers }),
      ]);

      if (!kpisRes.ok || !partnersRes.ok || !alertsRes.ok || !trendRes.ok) {
        throw new Error('Failed to load dashboard data');
      }

      const [kpisPayload, partnersPayload, alertsPayload, trendPayload] = await Promise.all([
        kpisRes.json() as Promise<AnalyticsKpis>,
        partnersRes.json() as Promise<{ partners: AnalyticsPartner[] }>,
        alertsRes.json() as Promise<{ alerts: AnalyticsAlert[] }>,
        trendRes.json() as Promise<{ trend: HealthTrendPoint[] }>,
      ]);

      setKpis(kpisPayload);
      setPartners(partnersPayload.partners);
      setAlerts(alertsPayload.alerts);
      setTrend(trendPayload.trend);
      setRefreshedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, org?.id]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const topPartners = useMemo(
    () => [...partners].sort((left, right) => right.churn_risk - left.churn_risk).slice(0, 5),
    [partners],
  );

  const criticalAlerts = alerts.filter((alert) => alert.severity === 'critical' || alert.severity === 'high').length;

  const handleDownloadReport = useCallback(async () => {
    if (!accessToken || !org?.id) {
      return;
    }

    setDownloadingReport(true);

    try {
      const response = await fetch('/api/reports/generate', {
        headers: buildTenantHeaders(accessToken, org.id),
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = response.headers.get('X-Filename') || 'BlostemIQ_Partner_Report.pdf';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setDownloadingReport(false);
    }
  }, [accessToken, org?.id]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Partner Intelligence</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {refreshedAt ? (
              <>
                Last updated <span style={{ color: 'var(--accent)' }}>{formatDistanceToNow(refreshedAt, { addSuffix: true })}</span>
                {' '}· {kpis?.active_partners ?? 0} partners monitored
              </>
            ) : (
              'Loading live partner telemetry'
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void handleDownloadReport()}
            disabled={downloadingReport || loading}
            className="glass glass-hover px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            {downloadingReport ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            {downloadingReport ? 'Generating...' : 'Download PDF'}
          </button>
          <button
            onClick={() => void loadDashboard(true)}
            disabled={refreshing || loading}
            className="glass glass-hover px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
            Refresh
          </button>
          <Link href="/dashboard/partners" className="btn-primary px-4 py-2 rounded-lg text-sm font-medium">
            Manage partners
          </Link>
        </div>
      </div>

      {error && (
        <div className="badge-red rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Active partners"
          value={String(kpis?.active_partners ?? 0)}
          delta={`${kpis?.at_risk ?? 0} at risk`}
          color="var(--accent)"
        />
        <StatCard
          icon={AlertTriangle}
          label="At risk"
          value={String(kpis?.at_risk ?? 0)}
          delta="Based on live health + churn signals"
          color="var(--red)"
        />
        <StatCard
          icon={TrendingDown}
          label="Avg health score"
          value={String(kpis?.avg_health_score ?? 0)}
          delta={`${(kpis?.api_calls_today ?? 0).toLocaleString()} API calls today`}
          color="var(--yellow)"
        />
        <StatCard
          icon={Zap}
          label="Alerts today"
          value={String(kpis?.alerts_today ?? 0)}
          delta={`NPS: ${kpis?.nps ?? 0}`}
          color="var(--yellow)"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold text-sm">Highest churn risk</h2>
            <Link href="/dashboard/partners" className="text-xs hover:underline" style={{ color: 'var(--accent)' }}>
              View all
            </Link>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {loading ? (
              <div className="px-5 py-10 flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                <Loader2 size={14} className="animate-spin" />
                Loading partners...
              </div>
            ) : topPartners.length === 0 ? (
              <div className="px-5 py-10 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                No partners available yet.
              </div>
            ) : (
              topPartners.map((partner) => (
                <div
                  key={partner.id}
                  className="flex flex-wrap items-center gap-4 px-5 py-3.5 transition-all"
                  style={{ background: 'transparent' }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                  >
                    {partner.name[0]}
                  </div>

                  <div className="flex-1 min-w-[180px]">
                    <div className="text-sm font-medium">{partner.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {partner.tier} · {formatTimestamp(partner.last_seen)}
                    </div>
                  </div>

                  <div className="w-24">
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: 'var(--text-muted)' }}>Health</span>
                      <span style={{ color: healthColor(partner.health_score) }}>
                        {partner.health_score}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${partner.health_score}%`,
                          background: healthColor(partner.health_score),
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col items-center text-xs" style={{ color: 'var(--text-muted)' }}>
                    <ChurnGauge value={partner.churn_risk} />
                    <span style={{ color: churnColor(partner.churn_risk) }}>{partner.churn_pct}%</span>
                  </div>

                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      partner.status === 'at_risk'
                        ? 'badge-red'
                        : partner.status === 'declining'
                          ? 'badge-yellow'
                          : 'badge-green'
                    }`}
                  >
                    {partner.status.replace('_', ' ')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Portfolio health</h3>
              <BarChart2 size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div style={{ height: 120 }}>
              {trend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={trend.map((point) => ({
                      day: format(new Date(point.date), 'MMM d'),
                      score: point.avg_health,
                    }))}
                  >
                    <defs>
                      <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis hide domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Area type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2} fill="url(#healthGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
                  No historical health data yet.
                </div>
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Live alerts</h3>
              <span className={`${criticalAlerts > 0 ? 'badge-red' : 'badge-green'} px-2 py-0.5 rounded-full text-xs`}>
                {criticalAlerts} critical
              </span>
            </div>
            <div className="space-y-1">
              {alerts.length === 0 ? (
                <div className="text-xs px-1 py-3" style={{ color: 'var(--text-muted)' }}>
                  No alerts emitted yet.
                </div>
              ) : (
                alerts.slice(0, 5).map((alert) => <AlertRow key={alert.id} alert={alert} />)
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold mb-3">Quick actions</h3>
            <div className="space-y-2">
              <Link
                href="/dashboard/partners"
                className="block w-full text-left text-xs px-3 py-2.5 rounded-lg transition-all"
                style={{ background: 'var(--accent-dim)', border: '1px solid rgba(0,212,255,0.3)', color: 'var(--text-primary)' }}
              >
                Open partner portfolio
              </Link>
              <Link
                href="/dashboard/outreach"
                className="block w-full text-left text-xs px-3 py-2.5 rounded-lg transition-all"
                style={{ background: 'var(--yellow-dim)', border: '1px solid rgba(245,158,11,0.3)', color: 'var(--text-primary)' }}
              >
                Open outreach workspace
              </Link>
              <button
                onClick={() => void loadDashboard(true)}
                className="w-full text-left text-xs px-3 py-2.5 rounded-lg transition-all"
                style={{ background: 'var(--green-dim)', border: '1px solid rgba(16,217,130,0.3)', color: 'var(--text-primary)' }}
              >
                Refresh live telemetry
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
