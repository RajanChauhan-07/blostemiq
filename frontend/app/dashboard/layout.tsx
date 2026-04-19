'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Mail,
  BarChart2,
  Search,
  Settings,
  Bell,
  LogOut,
  ChevronRight,
  Zap,
  Brain,
  Loader2,
} from 'lucide-react';
import { ToastContainer } from '../../components/ui/ToastContainer';
import { VoiceBriefing } from '../../components/voice/VoiceBriefing';
import { useRealtimeAlerts } from '../../lib/hooks/useRealtimeAlerts';
import { useRequireAuth, useSignOut } from '../../lib/hooks/useAuthSession';
import { useNotificationStore } from '../../stores/notificationStore';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/partners', icon: Users, label: 'Partners' },
  { href: '/dashboard/predict', icon: Brain, label: 'AI Explainer' },
  { href: '/dashboard/outreach', icon: Mail, label: 'AI Outreach' },
  { href: '/dashboard/analytics', icon: BarChart2, label: 'Analytics' },
  { href: '/dashboard/leads', icon: Zap, label: 'Lead Scoring' },
  { href: '/dashboard/search', icon: Search, label: 'Search' },
];

function AuthLoadingShell() {
  return (
    <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="glass rounded-2xl px-6 py-5 flex items-center gap-3 text-sm">
        <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
        <span style={{ color: 'var(--text-secondary)' }}>Restoring workspace...</span>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, isAuthenticated, accessToken, user, org } = useRequireAuth();
  const signOut = useSignOut();
  const unreadCount = useNotificationStore((state) => state.unreadCount());
  const connected = useNotificationStore((state) => state.connected);

  useRealtimeAlerts(org?.id, accessToken);

  if (!ready || !isAuthenticated || !user || !org) {
    return (
      <>
        <ToastContainer />
        <AuthLoadingShell />
      </>
    );
  }

  const avatarLabel = (user.fullName || user.email || 'U').trim().charAt(0).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <ToastContainer />

      <aside
        className="w-60 shrink-0 flex flex-col border-r"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <div className="h-16 flex items-center px-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold mr-2.5"
            style={{ background: 'var(--accent)', color: '#080c14' }}
          >
            B
          </div>
          <span className="font-bold text-sm tracking-tight">BlostemIQ</span>
          <span className="ml-auto text-xs badge-cyan px-1.5 py-0.5 rounded font-mono">AI</span>
        </div>

        <div className="mx-3 mt-4 mb-2">
          <button className="w-full glass rounded-lg px-3 py-2 flex items-center gap-2 text-sm glass-hover">
            <div
              className="w-5 h-5 rounded-md"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed)' }}
            />
            <span className="flex-1 text-left truncate" style={{ color: 'var(--text-primary)' }}>
              {org.name}
            </span>
            <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`sidebar-item flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${active ? 'active' : ''}`}
              >
                <Icon
                  size={16}
                  className="sidebar-icon shrink-0"
                  style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
                />
                <span style={{ color: active ? 'var(--accent)' : 'var(--text-secondary)' }}>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t space-y-0.5" style={{ borderColor: 'var(--border)' }}>
          <Link
            href="/dashboard/settings"
            className="sidebar-item flex items-center gap-3 px-3 py-2 rounded-lg text-sm"
          >
            <Settings size={16} style={{ color: 'var(--text-muted)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Settings</span>
          </Link>
          <button
            onClick={() => void signOut()}
            className="sidebar-item w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm"
          >
            <LogOut size={16} style={{ color: 'var(--text-muted)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header
          className="h-16 shrink-0 flex items-center justify-between px-6 border-b"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
        >
          <VoiceBriefing />

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              <div
                className={`w-1.5 h-1.5 rounded-full ${connected ? 'animate-pulse' : ''}`}
                style={{ background: connected ? 'var(--green)' : 'var(--text-muted)' }}
              />
              {connected ? 'Live' : 'Offline'}
            </div>

            <button className="relative glass rounded-lg p-2.5 glass-hover" aria-label="Notifications">
              <Bell size={16} style={{ color: 'var(--text-secondary)' }} />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
                  style={{ background: 'var(--red)', color: 'white', fontSize: '10px' }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <div className="flex items-center gap-3">
              <div className="hidden md:block text-right">
                <div className="text-xs font-medium">{user.fullName}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {user.email}
                </div>
              </div>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed)', color: 'white' }}
              >
                {avatarLabel}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
