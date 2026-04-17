import { create } from 'zustand';

export type NotificationSeverity = 'critical' | 'high' | 'medium' | 'info';
export type NotificationType = 'CHURN_ALERT' | 'LEAD_SCORED' | 'OUTREACH_SENT' | 'AUDIT_ALERT' | 'SYSTEM';

export interface Notification {
  id:        string;
  type:      NotificationType;
  severity:  NotificationSeverity;
  title:     string;
  message:   string;
  partnerId?: string;
  meta?:     Record<string, unknown>;
  timestamp: string;
  read:      boolean;
}

interface NotificationStore {
  notifications:  Notification[];
  connected:      boolean;
  latestHealthScore: { health_score: number; churn_probability: number } | null;

  add:              (n: Notification) => void;
  markRead:         (id: string) => void;
  markAllRead:      () => void;
  clear:            () => void;
  setConnected:     (v: boolean) => void;
  updateHealthScore:(payload: { health_score: number; churn_probability: number }) => void;

  // Derived
  unreadCount:   () => number;
  criticalAlerts:() => Notification[];
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  connected: false,
  latestHealthScore: null,

  add: (n) => set(state => {
    // Dedup by ID
    if (state.notifications.find(x => x.id === n.id)) return state;
    // Keep max 100 notifications in memory
    const trimmed = [n, ...state.notifications].slice(0, 100);
    return { notifications: trimmed };
  }),

  markRead: (id) => set(state => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n),
  })),

  markAllRead: () => set(state => ({
    notifications: state.notifications.map(n => ({ ...n, read: true })),
  })),

  clear: () => set({ notifications: [] }),

  setConnected: (connected) => set({ connected }),

  updateHealthScore: (payload) => set({ latestHealthScore: payload }),

  unreadCount:    () => get().notifications.filter(n => !n.read).length,
  criticalAlerts: () => get().notifications.filter(n => n.severity === 'critical' && !n.read),
}));
