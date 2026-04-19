'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Building2 } from 'lucide-react';
import { signUpWithPassword } from '../../lib/auth';
import { useRedirectAuthenticated } from '../../lib/hooks/useAuthSession';
import { useAuthStore } from '../../stores/authStore';

export default function SignUpPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    orgName: '',
  });

  useRedirectAuthenticated();

  const handleStep1 = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStep(2);
  };

  const handleStep2 = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const session = await signUpWithPassword({
        fullName: form.name,
        email: form.email,
        password: form.password,
        orgName: form.orgName,
      });

      setSession(session);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen grid-bg flex items-center justify-center px-4"
      style={{ background: 'var(--bg-base)' }}
    >
      <div
        className="fixed top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'var(--accent)' }}
      />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
            style={{ background: 'var(--accent)', color: '#080c14' }}
          >
            <span className="text-xl font-bold">B</span>
          </div>
          <h1 className="text-2xl font-bold">{step === 1 ? 'Create your account' : 'Create your workspace'}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {step === 1 ? 'Start with your user account' : 'Connect your first organization'}
          </p>
        </div>

        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map((currentStep) => (
            <div
              key={currentStep}
              className="flex-1 h-1 rounded-full transition-all"
              style={{ background: currentStep <= step ? 'var(--accent)' : 'var(--bg-elevated)' }}
            />
          ))}
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          {step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-3">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  Full name
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
                  placeholder="Rajan Chauhan"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  Work email
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    className="input-dark w-full px-3 py-2.5 pr-10 rounded-xl text-sm"
                    placeholder="Min 8 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }}
                    aria-label={show ? 'Hide password' : 'Show password'}
                  >
                    {show ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-primary w-full py-2.5 rounded-xl text-sm font-semibold">
                Continue
              </button>
            </form>
          ) : (
            <form onSubmit={handleStep2} className="space-y-4">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  Organization name
                </label>
                <div className="relative">
                  <Building2
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    required
                    value={form.orgName}
                    onChange={(event) => setForm((current) => ({ ...current, orgName: event.target.value }))}
                    className="input-dark w-full pl-9 pr-3 py-2.5 rounded-xl text-sm"
                    placeholder="Acme Fintech Pvt. Ltd."
                    autoComplete="organization"
                  />
                </div>
              </div>

              {error && (
                <div className="badge-red rounded-xl px-3 py-2 text-xs">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-ghost flex-1 py-2.5 rounded-xl text-sm"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Creating...
                    </>
                  ) : (
                    'Launch workspace'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-sm mt-5" style={{ color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link href="/signin" style={{ color: 'var(--accent)' }} className="hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
