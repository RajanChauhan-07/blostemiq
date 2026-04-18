'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, Building2, Check } from 'lucide-react';

export default function SignUpPage() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ name: '', email: '', password: '', orgName: '', role: 'admin' });

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    window.location.href = '/dashboard';
  };

  return (
    <main className="min-h-screen grid-bg flex items-center justify-center px-4" style={{ background: 'var(--bg-base)' }}>
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'var(--accent)' }} />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
            style={{ background: 'var(--accent)', color: '#080c14' }}>
            <span className="text-xl font-bold">B</span>
          </div>
          <h1 className="text-2xl font-bold">{step === 1 ? 'Create your account' : 'Setup your org'}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {step === 1 ? 'Start your 14-day free trial of BlostemIQ' : 'Tell us about your organization'}
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map(s => (
            <div key={s} className="flex-1 h-1 rounded-full transition-all" style={{ background: s <= step ? 'var(--accent)' : 'var(--bg-elevated)' }} />
          ))}
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          {step === 1 ? (
            <>
              {/* Google OAuth */}
              <button className="btn-ghost w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Sign up with Google
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>or</span>
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              </div>

              <form onSubmit={handleStep1} className="space-y-3">
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Full name</label>
                  <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="input-dark w-full px-3 py-2.5 rounded-xl text-sm" placeholder="Rajan Chauhan" />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Work email</label>
                  <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="input-dark w-full px-3 py-2.5 rounded-xl text-sm" placeholder="you@company.com" />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Password</label>
                  <div className="relative">
                    <input type={show ? 'text' : 'password'} required minLength={8} value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      className="input-dark w-full px-3 py-2.5 pr-10 rounded-xl text-sm" placeholder="Min 8 characters" />
                    <button type="button" onClick={() => setShow(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                      {show ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full py-2.5 rounded-xl text-sm font-semibold">Continue →</button>
              </form>
            </>
          ) : (
            <form onSubmit={handleStep2} className="space-y-4">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Organization name</label>
                <div className="relative">
                  <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input type="text" required value={form.orgName} onChange={e => setForm(f => ({ ...f, orgName: e.target.value }))}
                    className="input-dark w-full pl-9 pr-3 py-2.5 rounded-xl text-sm" placeholder="Acme Fintech Pvt. Ltd." />
                </div>
              </div>

              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Your role</label>
                <div className="grid grid-cols-3 gap-2">
                  {['admin', 'analyst', 'viewer'].map(role => (
                    <button key={role} type="button" onClick={() => setForm(f => ({ ...f, role }))}
                      className={`text-xs px-3 py-2 rounded-lg capitalize transition-all flex items-center justify-center gap-1 ${form.role === role ? 'badge-cyan font-semibold' : 'glass'}`}>
                      {form.role === role && <Check size={10} />}
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Plan</label>
                <div className="space-y-2">
                  {[
                    { name: 'Basic', price: '₹2,999/mo', features: '5 partners, 1 user' },
                    { name: 'Growth', price: '₹9,999/mo', features: '25 partners, 5 users, AI outreach' },
                    { name: 'Enterprise', price: 'Custom', features: 'Unlimited, SSO, SLA, dedicated support' },
                  ].map(plan => (
                    <div key={plan.name} className="glass rounded-lg p-3 flex items-center justify-between glass-hover cursor-pointer">
                      <div>
                        <div className="text-sm font-medium">{plan.name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{plan.features}</div>
                      </div>
                      <span className="text-xs font-mono" style={{ color: 'var(--accent)' }}>{plan.price}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(1)} className="btn-ghost flex-1 py-2.5 rounded-xl text-sm">← Back</button>
                <button type="submit" disabled={loading}
                  className="btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                  {loading ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : 'Launch workspace →'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-sm mt-5" style={{ color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link href="/signin" style={{ color: 'var(--accent)' }} className="hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
