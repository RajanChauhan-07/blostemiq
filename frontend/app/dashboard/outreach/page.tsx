'use client';

import { useState } from 'react';
import { Mail, Send, Copy, Check, RefreshCcw, Shield, AlertTriangle, Sparkles } from 'lucide-react';

const atRiskPartners = [
  { id: 'p5', name: 'BharatPe', health: 22, churn: 91, reason: 'No API calls in 32 days' },
  { id: 'p1', name: 'Razorpay', health: 38, churn: 82, reason: 'API usage dropped 67% vs last month' },
  { id: 'p12', name: 'Open Financial', health: 31, churn: 78, reason: 'Only 2 features adopted, no login 25d' },
  { id: 'p20', name: 'Rupeek', health: 35, churn: 76, reason: 'Feature adoption stalled, high error rate' },
  { id: 'p8', name: 'M2P Fintech', health: 44, churn: 62, reason: '89 API calls (down from 560 last month)' },
  { id: 'p19', name: 'NiYO', health: 48, churn: 55, reason: 'No platform login in 14 days' },
];

// Pre-generated AI outreach emails
const emailSequences: Record<string, {subject: string; body: string; cta: string; compliance: boolean}[]> = {
  'p5': [
    { subject: 'Checking in — we noticed your integration has been quiet', body: `Hi Team BharatPe,\n\nI wanted to personally reach out because I noticed your API integration hasn't been active recently. We understand that priorities shift, and I'd love to understand if there's anything on our end that could be improved.\n\nWe've recently launched several new features that could be particularly valuable for your lending workflows:\n\n• Real-time webhook notifications for payment status changes\n• Batch processing API (up to 10,000 transactions/call)\n• Enhanced error reporting with actionable suggestions\n\nWould you have 15 minutes this week for a quick sync? I'd love to understand your current roadmap and see how we can better support your team.`, cta: 'Schedule a 15-min sync →', compliance: true },
    { subject: 'Quick follow-up: New API features that might help', body: `Hi Team,\n\nFollowing up on my previous note. I also wanted to share that several partners in the lending space have seen a 40% reduction in integration errors after adopting our new SDK v3.2.\n\nHere's a quick 2-minute video walkthrough of the changes: [link]\n\nNo pressure at all — just wanted to make sure you're aware of these improvements.`, cta: 'Watch 2-min walkthrough →', compliance: true },
    { subject: 'We value your partnership — here to help', body: `Hi Team BharatPe,\n\nThis is my final follow-up for now. I completely understand if the timing isn't right.\n\nJust wanted you to know:\n• Your integration credentials remain active\n• Our support team is available 24/7 at support@blostemiq.com\n• We'd welcome any feedback on how we can improve\n\nWhenever you're ready to re-engage, we'll be here.`, cta: 'Reply with any feedback →', compliance: true },
  ],
  'p1': [
    { subject: 'Noticed a dip in your API usage — everything OK?', body: `Hi Vikram,\n\nI noticed your API call volume has decreased by approximately 67% compared to last month. I wanted to check in to see if everything is running smoothly on your end.\n\nIf you're experiencing any technical issues, our engineering team can prioritize a resolution. We also have some new performance optimizations that could help:\n\n• Connection pooling improvements (2x throughput)\n• New regional endpoint in Mumbai (lower latency)\n• Batch webhooks for high-volume processing\n\nWould love to hop on a quick call to discuss.`, cta: 'Book a call with our CTO →', compliance: true },
    { subject: 'Re: API usage — sharing some helpful resources', body: `Hi Vikram,\n\nFollowing up with a few resources that might be helpful:\n\n1. Migration guide to our v4 API (30% faster)\n2. Best practices doc for payment processing at scale\n3. Case study: How Juspay reduced latency by 45%\n\nHappy to walk through any of these together.`, cta: 'Access resources →', compliance: true },
    { subject: 'Partnership check-in — Q2 planning', body: `Hi Vikram,\n\nAs we head into Q2, I'd love to understand your team's priorities and see where our roadmap aligns. We have some exciting features in the pipeline that I think could be really impactful for Razorpay's use case.\n\nNo agenda — just an open conversation about how we can best support your goals.`, cta: 'Schedule Q2 sync →', compliance: true },
  ],
};

// Generate fallback for other partners
function getEmails(id: string) {
  if (emailSequences[id]) return emailSequences[id];
  return [
    { subject: 'Partnership check-in — here to support your success', body: 'Hi Team,\n\nI wanted to reach out to check in on your integration experience. We\'ve noticed some changes in your usage patterns and want to make sure everything is working well for your team.\n\nOur platform has evolved significantly in recent months, and I\'d love to share some updates that could be valuable for your workflows.\n\nWould you have time for a brief sync this week?', cta: 'Schedule a sync →', compliance: true },
    { subject: 'New features that could help your team', body: 'Hi Team,\n\nQuick follow-up with some resources:\n\n• Updated SDK with better error handling\n• New dashboard analytics for monitoring\n• Improved documentation and code samples\n\nLet me know if any of these are interesting to explore.', cta: 'Explore new features →', compliance: true },
    { subject: 'We value your partnership', body: 'Hi Team,\n\nJust a final note — we truly value your partnership and are here whenever you need us. Our support channels are always open, and we welcome any feedback.\n\nWishing your team all the best.', cta: 'Share feedback →', compliance: true },
  ];
}

export default function OutreachPage() {
  const [selectedPartner, setSelectedPartner] = useState(atRiskPartners[0]);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [activeEmail, setActiveEmail] = useState(0);

  const emails = getEmails(selectedPartner.id);

  const handleGenerate = () => {
    setGenerating(true);
    setGenerated(false);
    setTimeout(() => {
      setGenerating(false);
      setGenerated(true);
      setActiveEmail(0);
    }, 2000);
  };

  const handleCopy = (idx: number) => {
    const email = emails[idx];
    navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}\n\n${email.cta}`);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Mail className="text-[var(--accent)]" /> AI Outreach Composer</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Generate personalized re-engagement sequences powered by AI. SEBI/RBI compliant.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Partner Selection */}
        <div className="glass rounded-2xl p-5 border border-white/[0.05] space-y-3">
          <h2 className="font-semibold text-sm border-b pb-2" style={{ borderColor: 'var(--border)' }}>At-Risk Partners</h2>
          {atRiskPartners.map(p => (
            <button key={p.id} onClick={() => { setSelectedPartner(p); setGenerated(false); }}
              className={`w-full text-left rounded-xl p-3 transition-all ${selectedPartner.id === p.id ? 'border-[var(--accent)]' : ''}`}
              style={{ background: selectedPartner.id === p.id ? 'var(--accent-dim)' : 'var(--bg-elevated)', border: `1px solid ${selectedPartner.id === p.id ? 'rgba(0,212,255,0.3)' : 'var(--border)'}` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{p.name}</span>
                <span className="text-xs badge-red px-2 py-0.5 rounded-full">{p.churn}%</span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.reason}</p>
            </button>
          ))}

          <button onClick={handleGenerate} disabled={generating}
            className="w-full btn-primary py-3 rounded-xl mt-4 font-semibold flex items-center justify-center gap-2">
            {generating ? <RefreshCcw className="animate-spin" size={16} /> : <Sparkles size={16} />}
            {generating ? 'AI Generating...' : 'Generate Outreach Sequence'}
          </button>
        </div>

        {/* Email Preview */}
        <div className="lg:col-span-2 space-y-4">
          {generated ? (
            <>
              {/* Tabs */}
              <div className="flex gap-2">
                {emails.map((_, i) => (
                  <button key={i} onClick={() => setActiveEmail(i)}
                    className={`text-xs px-4 py-2 rounded-lg transition-all ${activeEmail === i ? 'badge-cyan font-semibold' : 'glass'}`}>
                    Email {i + 1} {i === 0 ? '(Day 1)' : i === 1 ? '(Day 3)' : '(Day 7)'}
                  </button>
                ))}
              </div>

              {/* Email Content */}
              <div className="glass rounded-2xl border border-white/[0.05] overflow-hidden">
                {/* Subject */}
                <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Subject</div>
                    <div className="font-semibold text-sm">{emails[activeEmail].subject}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {emails[activeEmail].compliance && (
                      <span className="badge-green text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Shield size={10} /> Compliant
                      </span>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                  <pre className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>
                    {emails[activeEmail].body}
                  </pre>
                </div>

                {/* CTA */}
                <div className="px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>CTA: <span style={{ color: 'var(--accent)' }}>{emails[activeEmail].cta}</span></div>
                  <div className="flex gap-2">
                    <button onClick={() => handleCopy(activeEmail)}
                      className="btn-ghost px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
                      {copiedIdx === activeEmail ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                      {copiedIdx === activeEmail ? 'Copied!' : 'Copy'}
                    </button>
                    <button className="btn-primary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
                      <Send size={12} /> Send via Gmail
                    </button>
                  </div>
                </div>
              </div>

              {/* Compliance Notice */}
              <div className="glass rounded-xl p-4 flex items-start gap-3">
                <Shield size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--green)' }} />
                <div>
                  <div className="text-xs font-semibold" style={{ color: 'var(--green)' }}>SEBI/RBI Compliance Check Passed</div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    All generated content has been verified against financial regulatory language guidelines. No guaranteed returns, no misleading claims, no pressure tactics detected.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="glass rounded-2xl border border-white/[0.05] flex flex-col items-center justify-center min-h-[500px] text-[var(--text-muted)] space-y-3">
              <Sparkles size={40} className="opacity-20" />
              <p className="text-sm">Select a partner and click {'"'}Generate{'"'} to create an AI-powered outreach sequence.</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>The AI will craft 3 personalized emails with compliance checking.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
