'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useNotificationStore } from '../stores/notificationStore';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3004';

let socket: Socket | null = null;

export function useRealtimeAlerts(orgId: string) {
  const addNotification = useNotificationStore(s => s.add);
  const setConnected    = useNotificationStore(s => s.setConnected);
  const socketRef       = useRef<Socket | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    socket = io(WS_URL, {
      query: { orgId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    // ─── Connection events ───────────────────────────────
    socket.on('connect', () => {
      setConnected(true);
      console.debug('[WS] Connected:', socket!.id);
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      console.debug('[WS] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[WS] Connection error:', err.message);
    });

    // ─── CHURN_ALERT ─────────────────────────────────────
    socket.on('CHURN_ALERT', (payload: {
      type: string; severity: 'high' | 'critical';
      partner_id: string; churn_probability: number;
      health_score: number; message: string; timestamp: string;
    }) => {
      addNotification({
        id:        `churn-${payload.partner_id}-${Date.now()}`,
        type:      'CHURN_ALERT',
        severity:  payload.severity,
        title:     payload.severity === 'critical' ? '🚨 Critical churn risk' : '⚠️ High churn risk',
        message:   payload.message,
        partnerId: payload.partner_id,
        meta: {
          churn: `${Math.round(payload.churn_probability * 100)}%`,
          health: payload.health_score,
        },
        timestamp: payload.timestamp,
        read:      false,
      });
    });

    // ─── LEAD_SCORED ─────────────────────────────────────
    socket.on('LEAD_SCORED', (payload: {
      lead_id: string; company: string;
      score: number; tier: 'hot' | 'warm' | 'cold';
    }) => {
      addNotification({
        id:       `lead-${payload.lead_id}`,
        type:     'LEAD_SCORED',
        severity: payload.tier === 'hot' ? 'high' : 'medium',
        title:    `🎯 New lead: ${payload.company}`,
        message:  `Score: ${payload.score}/100 — ${payload.tier.toUpperCase()} lead`,
        timestamp: new Date().toISOString(),
        read:     false,
      });
    });

    // ─── OUTREACH_SENT ───────────────────────────────────
    socket.on('OUTREACH_SENT', (payload: {
      partner_name: string; email_type: string; sent_at: string;
    }) => {
      addNotification({
        id:       `outreach-${Date.now()}`,
        type:     'OUTREACH_SENT',
        severity: 'info',
        title:    `✉️ Outreach sent`,
        message:  `${payload.email_type} email sent to ${payload.partner_name}`,
        timestamp: payload.sent_at,
        read:     false,
      });
    });

    // ─── HEALTH_SCORE_UPDATE ──────────────────────────────
    socket.on('HEALTH_SCORE_UPDATE', (payload: {
      health_score: number; churn_probability: number;
      severity: string; updatedAt: string;
    }) => {
      // Silently update health score in store (no toast)
      useNotificationStore.getState().updateHealthScore(payload);
    });

  }, [orgId, addNotification, setConnected]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [connect]);

  return { socket: socketRef.current };
}
