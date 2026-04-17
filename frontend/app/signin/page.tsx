'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function SignInPage() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500)); // Simulated
    window.location.href = '/dashboard';
  };

  return (
    <main className="min-h-screen grid-bg flex items-center justify-center px-4" style={{ background: 'var(--bg-base)' }}>
      {/* Background glow */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'var(--accent)' }} />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
            style={{ background: 'var(--accent)', color: '#080c14' }}>
            <span className="text-xl font-bold">B</span>
          </div>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Sign in to your BlostemIQ workspace
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-6 space-y-4">
          {/* Google OAuth */}
          <button className="btn-ghost w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Email</label>
              <input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={show ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="input-dark w-full px-3 py-2.5 pr-10 rounded-xl text-sm"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}>
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button id="signin-btn" type="submit" disabled={loading}
              className="btn-primary w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={14} className="animate-spin" /> Signing in...</> : 'Sign in →'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-5" style={{ color: 'var(--text-muted)' }}>
          No account?{' '}
          <Link href="/signup" style={{ color: 'var(--accent)' }} className="hover:underline">Get access</Link>
        </p>
      </div>
    </main>
  );
}
