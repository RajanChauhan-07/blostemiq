'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCcw, Activity, Loader2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';
import { buildTenantHeaders } from '../../../lib/auth';
import { useAuthStore } from '../../../stores/authStore';

interface AnalyticsPartner {
  id: string;
  name: string;
  tier: string;
  tags: string[];
  health_score: number;
  api_calls: number;
  churn_risk: number;
  nps: number;
  status: 'active' | 'declining' | 'at_risk';
  last_seen: string | null;
}

interface PredictionInputs {
  recency_score: number;
  frequency_score: number;
  depth_score: number;
  trend_score: number;
  error_score: number;
  health_score: number;
}

interface PredictionResult {
  partner_id: string;
  churn_probability: number;
  churn_tier: string;
  confidence: number;
  top_risk_factor: string;
  shap_explanation_text: string | null;
  shap_features: string[] | null;
  shap_values: number[] | null;
}

interface ShapChartDatum {
  name: string;
  value: number;
  actualValue: number;
  fill: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function daysSince(isoDate: string | null) {
  if (!isoDate) return 30;
  const diffMs = Date.now() - new Date(isoDate).getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

function deriveInputsFromPartner(partner: AnalyticsPartner): PredictionInputs {
  const recencyDays = daysSince(partner.last_seen);
  const recencyScore = clamp(25 - recencyDays, 0, 25);
  const frequencyScore = clamp(Math.round(Math.log10(partner.api_calls + 1) * 8), 0, 25);
  const tierBase = partner.tier === 'enterprise' ? 14 : partner.tier === 'growth' ? 10 : 6;
  const depthScore = clamp(tierBase + Math.min(partner.tags.length, 6), 0, 20);
  const trendScore = clamp(Math.round((1 - partner.churn_risk) * 20), 0, 20);
  const errorScore = clamp(Math.round(partner.nps / 10), 0, 10);

  return {
    recency_score: recencyScore,
    frequency_score: frequencyScore,
    depth_score: depthScore,
    trend_score: trendScore,
    error_score: errorScore,
    health_score: clamp(Math.round(partner.health_score), 0, 100),
  };
}

export default function AIPlayground() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const org = useAuthStore((state) => state.org);
  const [partners, setPartners] = useState<AnalyticsPartner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [loadingPartners, setLoadingPartners] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<PredictionInputs>({
    recency_score: 0,
    frequency_score: 0,
    depth_score: 0,
    trend_score: 0,
    error_score: 0,
    health_score: 0,
  });
  const [result, setResult] = useState<PredictionResult | null>(null);

  useEffect(() => {
    const loadPartners = async () => {
      if (!accessToken || !org?.id) {
        return;
      }

      setLoadingPartners(true);
      setError(null);

      try {
        const response = await fetch('/api/analytics/partners', {
          headers: buildTenantHeaders(accessToken, org.id),
        });

        if (!response.ok) {
          throw new Error('Failed to load partners');
        }

        const payload = await response.json() as { partners: AnalyticsPartner[] };
        setPartners(payload.partners);

        if (payload.partners.length > 0) {
          setSelectedPartnerId(payload.partners[0].id);
          setInputs(deriveInputsFromPartner(payload.partners[0]));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load partners');
      } finally {
        setLoadingPartners(false);
      }
    };

    void loadPartners();
  }, [accessToken, org?.id]);

  const selectedPartner = useMemo(
    () => partners.find((partner) => partner.id === selectedPartnerId) ?? null,
    [partners, selectedPartnerId],
  );

  const shapData: ShapChartDatum[] = useMemo(() => {
    if (!result?.shap_features || !result.shap_values) {
      return [];
    }

    return result.shap_features.map((feature, index) => {
      const value = result.shap_values?.[index] ?? 0;
      return {
        name: feature.charAt(0).toUpperCase() + feature.slice(1),
        value: Math.abs(value),
        actualValue: value,
        fill: value > 0 ? '#ef4444' : '#10b981',
      };
    }).sort((left, right) => right.value - left.value);
  }, [result]);

  const probability = result?.churn_probability ? Math.round(result.churn_probability * 100) : 0;

  const testModel = async () => {
    if (!selectedPartner) {
      setError('Select a partner before running prediction.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ml/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_id: selectedPartner.id,
          ...inputs,
        }),
      });

      if (!response.ok) {
        throw new Error('Prediction request failed');
      }

      const payload = await response.json() as PredictionResult;
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prediction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-20">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="text-[var(--accent)]" /> Explainable AI (SHAP)
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Start from a real partner, adjust the dimensions, and inspect the live churn model output.
        </p>
      </div>

      {error && <div className="badge-red rounded-xl px-4 py-3 text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6 border border-white/[0.05] lg:col-span-1 space-y-4">
          <h2 className="font-semibold mb-4 border-b border-white/5 pb-2">Partner Inputs</h2>

          {loadingPartners ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <Loader2 size={14} className="animate-spin" />
              Loading partners...
            </div>
          ) : partners.length === 0 ? (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No partners available yet.
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  Partner
                </label>
                <select
                  value={selectedPartnerId}
                  onChange={(event) => {
                    const partner = partners.find((item) => item.id === event.target.value);
                    setSelectedPartnerId(event.target.value);
                    if (partner) {
                      setInputs(deriveInputsFromPartner(partner));
                      setResult(null);
                    }
                  }}
                  className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
                >
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPartner && (
                <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                  <div>{selectedPartner.tier} · {selectedPartner.status.replace('_', ' ')}</div>
                  <div>{selectedPartner.api_calls.toLocaleString()} API calls</div>
                  <div>Health {selectedPartner.health_score} · NPS {selectedPartner.nps}</div>
                </div>
              )}

              {Object.entries(inputs).map(([key, value]) => (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="capitalize">{key.replace('_', ' ')}</span>
                    <span className="font-mono text-[var(--accent)]">{value}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={key === 'health_score' ? 100 : key === 'error_score' ? 10 : key.includes('depth') || key.includes('trend') ? 20 : 25}
                    value={value}
                    onChange={(event) => setInputs((current) => ({ ...current, [key]: parseInt(event.target.value, 10) }))}
                    className="w-full accent-[var(--accent)] h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              ))}

              <button
                onClick={() => void testModel()}
                disabled={loading || !selectedPartner}
                className="w-full btn-primary py-3 rounded-xl mt-6 font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-60"
              >
                {loading ? <RefreshCcw className="animate-spin" size={16} /> : 'Run Prediction Engine'}
              </button>
            </>
          )}
        </div>

        {result ? (
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="glass rounded-xl p-5 border border-white/5 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-red-500/5" />
                <h3 className="text-xs text-[var(--text-secondary)] mb-2 uppercase tracking-wider">Churn Risk Gauge</h3>
                <div className="h-32 w-full flex justify-center items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={10} data={[{ name: 'risk', value: probability }]}>
                      <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                      <RadialBar
                        background
                        dataKey="value"
                        cornerRadius={10}
                        fill={probability > 70 ? '#ef4444' : probability > 40 ? '#f59e0b' : '#10b981'}
                      />
                      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-3xl font-bold fill-white">
                        {probability}%
                      </text>
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-xs font-mono px-2 py-1 bg-white/5 rounded text-center border border-white/5 inline-block">
                  Tier: <span className="text-[var(--accent)] capitalize">{result.churn_tier}</span>
                </div>
              </div>

              <div className="glass rounded-xl p-5 border border-white/5 flex flex-col justify-center">
                <h3 className="text-xs text-[var(--text-secondary)] mb-2 uppercase tracking-wider">AI Diagnosis</h3>
                <p className="text-sm font-medium leading-relaxed">
                  {result.shap_explanation_text || 'The model returned no textual explanation.'}
                </p>
                <div className="mt-auto pt-4 flex justify-between items-center border-t border-white/5">
                  <span className="text-xs text-[var(--text-muted)]">Confidence Score</span>
                  <span className="text-sm font-mono text-green-400">{(result.confidence * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-6 border border-white/5 h-64 flex flex-col">
              <h3 className="text-sm font-semibold mb-1">Feature Impacts (SHAP Values)</h3>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                Red features push toward churn. Green features push toward health.
              </p>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shapData} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                      width={90}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as ShapChartDatum;
                          return (
                            <div className="glass p-3 rounded-lg text-xs border border-white/10 shadow-2xl">
                              <p className="font-semibold text-white mb-1">{data.name}</p>
                              <p style={{ color: data.fill }}>Impact force: {data.actualValue.toFixed(4)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                      {shapData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 glass rounded-2xl border border-white/5 flex flex-col items-center justify-center min-h-[400px] text-[var(--text-muted)] space-y-3">
            <Activity size={32} className="opacity-20" />
            <p className="text-sm">Run the prediction engine to see AI explanations.</p>
          </div>
        )}
      </div>
    </div>
  );
}
