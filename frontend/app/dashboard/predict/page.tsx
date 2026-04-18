'use client';

import { useState } from 'react';
import { RefreshCcw, Activity } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, 
  RadialBarChart, RadialBar, PolarAngleAxis 
} from 'recharts';

export default function AIPlayground() {
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    recency_score: 18,
    frequency_score: 15,
    depth_score: 12,
    trend_score: 10,
    error_score: 4,
    health_score: 59
  });
  
  const [result, setResult] = useState<any>(null);

  const testModel = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ml/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_id: "demo-test-123",
          ...inputs
        })
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getShapChartData = () => {
    if (!result || !result.shap_features) return [];
    // Zip features and values, create positive/negative categories for Recharts
    const data = result.shap_features.map((f: string, i: number) => {
      const val = result.shap_values[i];
      return {
        name: f.charAt(0).toUpperCase() + f.slice(1),
        value: Math.abs(val),
        actualValue: val,
        fill: val > 0 ? '#ef4444' : '#10b981' // Red for risk, Green for healthy
      };
    }).sort((a: any, b: any) => b.value - a.value);
    
    return data;
  };

  const shapData = getShapChartData();
  const probability = result?.churn_probability ? Math.round(result.churn_probability * 100) : 0;
  
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-20">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="text-[var(--accent)]" /> Explainable AI (SHAP)
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Test the XGBoost Churn Model in real-time and view mathematical feature importance.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Input Panel */}
        <div className="glass rounded-2xl p-6 border border-white/[0.05] lg:col-span-1 space-y-4">
          <h2 className="font-semibold mb-4 border-b border-white/5 pb-2">Simulate Health Data</h2>
          
          {Object.entries(inputs).map(([key, val]) => (
            <div key={key}>
              <div className="flex justify-between text-xs mb-1">
                <span className="capitalize">{key.replace('_', ' ')}</span>
                <span className="font-mono text-[var(--accent)]">{val}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max={key === 'health_score' ? 100 : key === 'error_score' ? 10 : key.includes('depth') || key.includes('trend') ? 20 : 25} 
                value={val}
                onChange={e => setInputs({...inputs, [key]: parseInt(e.target.value)})}
                className="w-full accent-[var(--accent)] h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          ))}
          
          <button 
            onClick={testModel}
            disabled={loading}
            className="w-full btn-primary py-3 rounded-xl mt-6 font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
          >
            {loading ? <RefreshCcw className="animate-spin" size={16} /> : 'Run Prediction Engine'}
          </button>
        </div>

        {/* Results Panel */}
        {result ? (
          <div className="lg:col-span-2 space-y-6">
            
            {/* Top Cards */}
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
                  {result.shap_explanation_text}
                </p>
                <div className="mt-auto pt-4 flex justify-between items-center border-t border-white/5">
                  <span className="text-xs text-[var(--text-muted)]">Confidence Score</span>
                  <span className="text-sm font-mono text-green-400">{(result.confidence * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* SHAP Chart */}
            <div className="glass rounded-2xl p-6 border border-white/5 h-64 flex flex-col">
              <h3 className="text-sm font-semibold mb-1">Feature Impacts (SHAP Values)</h3>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                Red features push towards churn. Green features push towards health.
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
                      width={80}
                    />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
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
