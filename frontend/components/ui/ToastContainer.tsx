'use client';

import { useEffect, useState } from 'react';
import { useNotificationStore, Notification } from '../../stores/notificationStore';
import { X, AlertTriangle, Zap, Mail, ShieldAlert } from 'lucide-react';

const ICONS = {
  CHURN_ALERT:  AlertTriangle,
  LEAD_SCORED:  Zap,
  OUTREACH_SENT: Mail,
  AUDIT_ALERT:  ShieldAlert,
  SYSTEM:       AlertTriangle,
};

const SEVERITY_STYLES = {
  critical: { border: 'rgba(239,68,68,0.5)',  bg: 'rgba(239,68,68,0.08)',  icon: '#ef4444' },
  high:     { border: 'rgba(245,158,11,0.5)', bg: 'rgba(245,158,11,0.08)', icon: '#f59e0b' },
  medium:   { border: 'rgba(0,212,255,0.3)',  bg: 'rgba(0,212,255,0.06)',  icon: '#00d4ff' },
  info:     { border: 'rgba(99,179,237,0.2)', bg: 'rgba(13,21,38,0.8)',    icon: '#7a8ba8' },
};

function ToastItem({ notification, onDismiss }: { notification: Notification; onDismiss: () => void }) {
  const Icon = ICONS[notification.type];
  const styles = SEVERITY_STYLES[notification.severity];
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // Slide in
    requestAnimationFrame(() => setVisible(true));

    // Auto dismiss after 6s (critical: 10s)
    const ttl = notification.severity === 'critical' ? 10000 : 6000;
    const timer = setTimeout(() => dismiss(), ttl);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    setLeaving(true);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      role="alert"
      style={{
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        backdropFilter: 'blur(12px)',
        transform: visible && !leaving ? 'translateX(0)' : 'translateX(110%)',
        opacity: leaving ? 0 : 1,
        transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease',
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: 320,
        maxWidth: '100%',
        boxShadow: notification.severity === 'critical'
          ? '0 0 20px rgba(239,68,68,0.25), 0 4px 24px rgba(0,0,0,0.4)'
          : '0 4px 24px rgba(0,0,0,0.3)',
      }}
    >
      {/* Pulsing icon for critical */}
      <div style={{ position: 'relative', flexShrink: 0, marginTop: 2 }}>
        <Icon size={16} style={{ color: styles.icon }} />
        {notification.severity === 'critical' && (
          <div style={{
            position: 'absolute', inset: -4,
            borderRadius: '50%',
            background: styles.icon,
            opacity: 0.3,
            animation: 'pulse 1.5s ease infinite',
          }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
          {notification.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          {notification.message}
        </div>
        {notification.meta && (
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {Object.entries(notification.meta).map(([key, val]) => (
              <span key={key} style={{
                fontSize: 10, fontFamily: 'monospace',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4, padding: '1px 6px',
                color: 'var(--text-secondary)',
              }}>
                {key}: {String(val)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Dismiss */}
      <button onClick={dismiss} style={{ color: 'var(--text-muted)', flexShrink: 0, lineHeight: 1 }}>
        <X size={12} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { notifications, markRead } = useNotificationStore();
  // Show max 4 toasts at once, newest first
  const visible = notifications.filter(n => !n.read).slice(0, 4);

  return (
    <div style={{
      position: 'fixed', right: 20, top: 76, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none',
    }}>
      {visible.map(n => (
        <div key={n.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem
            notification={n}
            onDismiss={() => markRead(n.id)}
          />
        </div>
      ))}
    </div>
  );
}
