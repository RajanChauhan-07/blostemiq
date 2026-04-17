'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// ─── Animated counter ────────────────────────────────────
function Counter({ end, suffix = '' }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      let start = 0;
      const step = end / 60;
      const timer = setInterval(() => {
        start += step;
        if (start >= end) { setCount(end); clearInterval(timer); return; }
        setCount(Math.floor(start));
      }, 16);
      observer.disconnect();
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ─── Floating particle ────────────────────────────────────
function Particle({ style }: { style: React.CSSProperties }) {
  return (
    <div
      className="absolute rounded-full opacity-20 animate-pulse"
      style={{ background: 'var(--accent)', ...style }}
    />
  );
}

// ─── Feature card ─────────────────────────────────────────
function FeatureCard({ icon, title, desc, tag }: { icon: string; title: string; desc: string; tag: string }) {
  return (
    <div className="glass glass-hover rounded-2xl p-6 group cursor-default transition-all duration-300 hover:-translate-y-1">
      <div className="text-3xl mb-4">{icon}</div>
      <span className="text-xs font-mono badge-cyan px-2 py-0.5 rounded-full">{tag}</span>
      <h3 className="text-lg font-semibold mt-3 mb-2" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────
function StatCard({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-4xl font-bold gradient-text mb-1">
        <Counter end={value} suffix={suffix} />
      </div>
      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <main className="min-h-screen grid-bg" style={{ background: 'var(--bg-base)' }}>

      {/* ─── Navbar ─────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass border-b' : ''
      }`} style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{ background: 'var(--accent)', color: '#080c14' }}>B</div>
            <span className="font-bold text-lg tracking-tight">BlostemIQ</span>
            <span className="text-xs badge-cyan px-2 py-0.5 rounded-full font-mono ml-1">BETA</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/signin" className="btn-ghost text-sm px-4 py-2 rounded-lg">Sign in</Link>
            <Link href="/signup" className="btn-primary text-sm px-4 py-2 rounded-lg">Get access →</Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ───────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        {/* Background glows */}
        <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: 'var(--accent)' }} />
        <div className="absolute top-40 right-1/4 w-64 h-64 rounded-full opacity-8 blur-3xl"
          style={{ background: '#7c3aed' }} />

        {/* Particles */}
        <Particle style={{ top: '15%', left: '10%', width: 4, height: 4, animationDelay: '0s' }} />
        <Particle style={{ top: '25%', right: '15%', width: 3, height: 3, animationDelay: '1s' }} />
        <Particle style={{ top: '60%', left: '20%', width: 5, height: 5, animationDelay: '2s' }} />
        <Particle style={{ top: '45%', right: '8%', width: 4, height: 4, animationDelay: '0.5s' }} />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full text-sm mb-8">
            <span className="pulse-dot" />
            <span style={{ color: 'var(--text-secondary)' }}>Blostem AI Builder Hackathon — May 2026</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6 tracking-tight">
            The Intelligence Layer<br />
            <span className="gradient-text">Fintech Partners Need</span>
          </h1>

          <p className="text-xl max-w-2xl mx-auto mb-10" style={{ color: 'var(--text-secondary)' }}>
            Real-time partner health monitoring, explainable ML churn prediction,
            and AI-powered outreach — built for Groww-level scale from day one.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/signup" className="btn-primary px-8 py-4 rounded-xl text-base font-semibold glow-cyan">
              Start monitoring partners →
            </Link>
            <Link href="/dashboard" className="btn-ghost px-8 py-4 rounded-xl text-base">
              View live demo
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 glass rounded-2xl p-8 max-w-3xl mx-auto">
            <StatCard value={30} suffix="+" label="Partners tracked" />
            <StatCard value={94} suffix="%" label="Churn accuracy" />
            <StatCard value={1} suffix="s" label="Alert latency" />
            <StatCard value={3} suffix="" label="AI models live" />
          </div>
        </div>
      </section>

      {/* ─── Features ───────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Three things that take years to build</h2>
            <p style={{ color: 'var(--text-secondary)' }}>We did it in weeks. Here&apos;s what you get.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              icon="🧠"
              title="Explainable Churn Prediction"
              desc="XGBoost model trained on 10,000 partner records. SHAP values tell you exactly why each partner is at risk — not just a score."
              tag="ML · SageMaker"
            />
            <FeatureCard
              icon="📡"
              title="Real-Time Health Monitoring"
              desc="Partner activity streams through Kafka. Health scores update in milliseconds. WebSocket alerts hit your dashboard before you even check email."
              tag="Real-time · Kafka"
            />
            <FeatureCard
              icon="✍️"
              title="AI Outreach That Complies"
              desc="Claude generates personalized 3-email sequences with built-in SEBI/RBI compliance filter. ElevenLabs briefs you every morning — by voice."
              tag="Claude · ElevenLabs"
            />
            <FeatureCard
              icon="🎯"
              title="B2B Lead Scoring"
              desc="Score prospects 0–100 using LinkedIn signals, funding data, tech stack detection, and news sentiment. XGBoost runs in your browser via ONNX."
              tag="ONNX · XGBoost"
            />
            <FeatureCard
              icon="📊"
              title="Cohort Analytics"
              desc="D3.js heatmaps showing week-of-acquisition vs churn week. Funnel drop-off, ARR attribution, NPS cohorts — CEO-ready in one click."
              tag="D3 · Recharts"
            />
            <FeatureCard
              icon="🔒"
              title="SOC2-Ready by Design"
              desc="RBAC at the API gateway, immutable audit logs, all secrets in AWS Secrets Manager, HTTPS everywhere, WAF with SQL injection protection."
              tag="Security · AWS"
            />
          </div>
        </div>
      </section>

      {/* ─── How it works ───────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6" style={{ background: 'var(--bg-surface)' }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">From raw events to action in seconds</h2>
          <p className="mb-16" style={{ color: 'var(--text-secondary)' }}>
            Every partner interaction flows through the intelligence pipeline automatically.
          </p>

          <div className="space-y-4">
            {[
              { step: '01', title: 'Partner events ingested', desc: 'API calls, logins, feature usage → Kafka stream → DynamoDB time-series' },
              { step: '02', title: 'Features computed', desc: '7-day / 30-day aggregates, trend slopes, adoption rates → SageMaker Feature Store' },
              { step: '03', title: 'Churn score predicted', desc: 'XGBoost endpoint returns probability + SHAP explanation in <100ms (Redis cached)' },
              { step: '04', title: 'You get alerted', desc: 'WebSocket push to dashboard + ElevenLabs morning briefing + Claude-written outreach ready' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="glass rounded-xl p-5 flex items-start gap-5 text-left glass-hover">
                <span className="font-mono text-sm shrink-0 mt-0.5" style={{ color: 'var(--accent)' }}>{step}</span>
                <div>
                  <div className="font-semibold mb-1">{title}</div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Simple, transparent pricing</h2>
          <p className="mb-16" style={{ color: 'var(--text-secondary)' }}>Pay per seat. No hidden costs.</p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { plan: 'Basic', price: '₹2,999', period: '/mo', features: ['Up to 10 partners', 'Churn predictions', 'Email alerts', 'Basic analytics'], cta: 'Get started', highlight: false },
              { plan: 'Growth', price: '₹9,999', period: '/mo', features: ['Unlimited partners', 'AI outreach sequences', 'ElevenLabs briefings', 'Cohort heatmaps', 'Lead scoring'], cta: 'Most popular →', highlight: true },
              { plan: 'Enterprise', price: 'Custom', period: '', features: ['White-label', 'SSO + SCIM', 'Dedicated SageMaker endpoint', 'SLA 99.9%', 'Compliance reports'], cta: 'Contact us', highlight: false },
            ].map(({ plan, price, period, features, cta, highlight }) => (
              <div key={plan} className={`rounded-2xl p-6 text-left ${highlight ? 'glow-cyan' : 'glass'}`}
                style={{ background: highlight ? 'var(--bg-elevated)' : undefined, border: highlight ? '1px solid rgba(0,212,255,0.3)' : undefined }}>
                {highlight && <div className="badge-cyan text-xs px-2 py-0.5 rounded-full inline-block mb-3">Recommended</div>}
                <div className="text-lg font-semibold mb-2">{plan}</div>
                <div className="mb-6">
                  <span className="text-3xl font-bold">{price}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{period}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {features.map(f => (
                    <li key={f} className="text-sm flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--green)' }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className={`block text-center py-2.5 rounded-lg text-sm font-medium transition-all ${
                  highlight ? 'btn-primary' : 'btn-ghost'
                }`}>{cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ──────────────────────────────────── */}
      <section className="py-20 px-6 text-center" style={{ background: 'var(--bg-surface)' }}>
        <h2 className="text-4xl font-bold mb-4">Your partners are sending signals.<br />Are you listening?</h2>
        <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>
          Join fintech companies using BlostemIQ to predict and prevent churn before it happens.
        </p>
        <Link href="/signup" className="btn-primary px-10 py-4 rounded-xl text-base font-semibold inline-block glow-cyan">
          Start free trial →
        </Link>
      </section>

      {/* ─── Footer ─────────────────────────────────────── */}
      <footer className="border-t py-10 px-6" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
              style={{ background: 'var(--accent)', color: '#080c14' }}>B</div>
            <span>BlostemIQ © 2026</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="https://github.com/RajanChauhan-07/blostemiq" className="hover:text-white transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
