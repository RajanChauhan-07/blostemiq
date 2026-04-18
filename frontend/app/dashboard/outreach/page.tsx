'use client';

import { useState, useRef } from 'react';
import { Mail, Send, Copy, CheckCircle2, Loader2, AlertTriangle, Shield, ShieldCheck, Bot, Sparkles } from 'lucide-react';

const AT_RISK_PARTNERS = [
  { id: 1, name: 'BharatPe', health: 12, churn: 91, reason: 'Zero API calls for 32 days', segment: 'Payments' },
  { id: 2, name: 'Razorpay', health: 38, churn: 67, reason: 'API usage dropped 67% MoM', segment: 'Payments' },
  { id: 3, name: 'Lendingkart', health: 44, churn: 55, reason: 'Support tickets up 400%', segment: 'Lending' },
  { id: 4, name: 'Groww', health: 51, churn: 42, reason: 'Feature adoption declined to 40%', segment: 'WealthTech' },
  { id: 5, name: 'Slice', health: 55, churn: 38, reason: 'No login in 12 days', segment: 'Neobanking' },
];

interface EmailItem {
  subject: string;
  body: string;
  cta: string;
  compliance: boolean;
  violations: string[];
}

interface GenerateResult {
  partner_name: string;
  category: string;
  emails: EmailItem[];
  model_used: string;
}

export default function OutreachPage() {
  const [selected, setSelected] = useState(AT_RISK_PARTNERS[0]);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [activeEmail, setActiveEmail] = useState(0);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/outreach/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_name: selected.name,
          health_score: selected.health,
          churn_risk: selected.churn / 100,
          reason: selected.reason,
          segment: selected.segment,
        }),
      });

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const data: GenerateResult = await res.json();
      setResult(data);
      setActiveEmail(0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Mail size={24} style={{ color: 'var(--accent)' }} />
          AI Outreach Composer
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Real AI-generated re-engagement sequences • Powered by Qwen 2.5 via Bytez
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Partner Selection */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>At-Risk Partners</h3>
          {AT_RISK_PARTNERS.map(p => (
            <button key={p.id} onClick={() => { setSelected(p); setResult(null); }}
              className={`w-full glass rounded-xl p-4 text-left transition-all ${selected.id === p.id ? 'ring-1' : 'glass-hover'}`}
              style={selected.id === p.id ? { borderColor: 'var(--accent)', boxShadow: '0 0 15px rgba(0,212,255,0.1)' } : {}}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{p.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${p.churn > 70 ? 'badge-red' : p.churn > 50 ? 'badge-amber' : 'badge-cyan'}`}>
                  {p.churn}% churn
                </span>
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.reason}</div>
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                <div className="h-full rounded-full transition-all" style={{
                  width: `${p.health}%`,
                  background: p.health > 70 ? 'var(--green)' : p.health > 40 ? 'var(--amber)' : 'var(--red)',
                }} />
              </div>
            </button>
          ))}

          {/* Generate Button */}
          <button onClick={handleGenerate} disabled={loading}
            className="btn-primary w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-4"
            style={{ boxShadow: '0 0 20px rgba(0,212,255,0.2)' }}>
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> AI is writing emails...</>
            ) : (
              <><Sparkles size={16} /> Generate Real AI Sequence</>
            )}
          </button>
        </div>

        {/* Right: Generated Emails */}
        <div className="lg:col-span-2 space-y-4">
          {error && (
            <div className="glass rounded-xl p-4 flex items-center gap-3 border border-red-500/20">
              <AlertTriangle size={16} style={{ color: 'var(--red)' }} />
              <span className="text-sm" style={{ color: 'var(--red)' }}>{error}</span>
            </div>
          )}

          {!result && !loading && (
            <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center" style={{ minHeight: 400 }}>
              <Bot size={48} style={{ color: 'var(--text-muted)', opacity: 0.3 }} className="mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select a partner & hit Generate</h3>
              <p className="text-sm max-w-md" style={{ color: 'var(--text-muted)' }}>
                Our AI will analyze the partner's health metrics and generate a personalized 3-email 
                re-engagement sequence with SEBI/RBI compliance checking — all in real-time.
              </p>
            </div>
          )}

          {loading && (
            <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center" style={{ minHeight: 400 }}>
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full animate-spin" style={{ border: '3px solid var(--bg-elevated)', borderTopColor: 'var(--accent)' }} />
                <Bot size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ color: 'var(--accent)' }} />
              </div>
              <h3 className="text-lg font-semibold mb-2">AI is composing emails...</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Qwen 2.5 is analyzing {selected.name}'s data and writing a personalized sequence
              </p>
              <div className="mt-4 flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full animate-bounce" 
                    style={{ background: 'var(--accent)', animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Model info badge */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="badge-cyan text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Bot size={12} /> Model: {result.model_used}
                </span>
                <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                  Category: {result.category.toUpperCase()}
                </span>
              </div>

              {/* Email Tabs */}
              <div className="flex gap-2">
                {result.emails.map((_, i) => (
                  <button key={i} onClick={() => setActiveEmail(i)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeEmail === i ? 'btn-primary' : 'glass glass-hover'}`}>
                    Day {[1, 3, 7][i]} Email
                  </button>
                ))}
              </div>

              {/* Active Email */}
              {result.emails[activeEmail] && (
                <div className="glass rounded-2xl p-6 space-y-4 border border-white/5">
                  {/* Compliance Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {result.emails[activeEmail].compliance ? (
                        <span className="badge-green text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                          <ShieldCheck size={12} /> SEBI/RBI Compliant
                        </span>
                      ) : (
                        <span className="badge-red text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                          <Shield size={12} /> Compliance Issue
                        </span>
                      )}
                    </div>
                    <button onClick={() => handleCopy(`Subject: ${result.emails[activeEmail].subject}\n\n${result.emails[activeEmail].body}\n\n${result.emails[activeEmail].cta}`, activeEmail)}
                      className="glass glass-hover rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5">
                      {copied === activeEmail ? <><CheckCircle2 size={12} style={{ color: 'var(--green)' }} /> Copied!</> : <><Copy size={12} /> Copy</>}
                    </button>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Subject</label>
                    <div className="text-sm font-medium">{result.emails[activeEmail].subject}</div>
                  </div>

                  {/* Body */}
                  <div>
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Body</label>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {result.emails[activeEmail].body}
                    </div>
                  </div>

                  {/* CTA */}
                  <div>
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Call to Action</label>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--accent)', color: '#080c14' }}>
                      <Send size={14} />
                      {result.emails[activeEmail].cta}
                    </div>
                  </div>

                  {/* Violations */}
                  {result.emails[activeEmail].violations.length > 0 && (
                    <div className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.1)' }}>
                      <div className="text-xs font-medium mb-1" style={{ color: 'var(--red)' }}>Compliance violations detected:</div>
                      {result.emails[activeEmail].violations.map((v, i) => (
                        <div key={i} className="text-xs" style={{ color: 'var(--text-muted)' }}>• {v}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
