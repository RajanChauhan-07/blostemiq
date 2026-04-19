'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Volume2, Loader2 } from 'lucide-react';
import { buildTenantHeaders } from '../../lib/auth';
import { useAuthStore } from '../../stores/authStore';

interface AnalyticsKpis {
  active_partners: number;
  at_risk: number;
  avg_health_score: number;
}

interface AnalyticsPartner {
  id: string;
  name: string;
  health_score: number;
  churn_pct: number;
  churn_risk: number;
  status: 'active' | 'declining' | 'at_risk';
}

interface AnalyticsAlert {
  partner_id: string;
  message: string;
  created_at: string;
}

export function VoiceBriefing() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const org = useAuthStore((state) => state.org);
  const [playing, setPlaying] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasAudio, setHasAudio] = useState(false);
  const [transcript, setTranscript] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);

  const generateBriefing = useCallback(async () => {
    if (!accessToken || !org?.id) {
      return;
    }

    setGenerating(true);

    try {
      const headers = buildTenantHeaders(accessToken, org.id);
      const [kpisRes, partnersRes, alertsRes] = await Promise.all([
        fetch('/api/analytics/kpis', { headers }),
        fetch('/api/analytics/partners', { headers }),
        fetch('/api/analytics/alerts', { headers }),
      ]);

      if (!kpisRes.ok || !partnersRes.ok || !alertsRes.ok) {
        throw new Error('Failed to load briefing inputs');
      }

      const [kpis, partnersPayload, alertsPayload] = await Promise.all([
        kpisRes.json() as Promise<AnalyticsKpis>,
        partnersRes.json() as Promise<{ partners: AnalyticsPartner[] }>,
        alertsRes.json() as Promise<{ alerts: AnalyticsAlert[] }>,
      ]);

      const latestAlertByPartner = new Map<string, AnalyticsAlert>();
      alertsPayload.alerts.forEach((alert) => {
        if (!latestAlertByPartner.has(alert.partner_id)) {
          latestAlertByPartner.set(alert.partner_id, alert);
        }
      });

      const topPartners = [...partnersPayload.partners]
        .sort((left, right) => right.churn_risk - left.churn_risk)
        .slice(0, 5)
        .map((partner) => ({
          name: partner.name,
          health: partner.health_score,
          churn: Math.round(partner.churn_pct),
          reason: latestAlertByPartner.get(partner.id)?.message
            || (partner.status === 'at_risk'
              ? 'Partner is currently flagged as at risk'
              : partner.status === 'declining'
                ? 'Partner health is trending down'
                : 'Partner remains stable'),
        }));

      const res = await fetch('/api/outreach/briefing/generate', {
        method: 'POST',
        headers: buildTenantHeaders(accessToken, org.id, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          partners: topPartners,
          total_partners: kpis.active_partners,
          avg_health: kpis.avg_health_score,
          at_risk_count: kpis.at_risk,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate briefing');
      }

      const data = await res.json() as { transcript: string; audio_url?: string | null };
      setTranscript(data.transcript);

      if (data.audio_url) {
        const audio = new Audio(`/api/outreach${data.audio_url}`);
        audio.addEventListener('loadedmetadata', () => {
          setDuration(audio.duration);
          setHasAudio(true);
        });
        audio.addEventListener('ended', () => {
          setPlaying(false);
          setProgress(0);
        });
        audio.addEventListener('error', () => {
          setHasAudio(false);
        });
        audioRef.current = audio;
      } else {
        setHasAudio(false);
      }
    } catch (err) {
      console.error('Briefing generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }, [accessToken, org?.id]);

  const updateProgress = useCallback(() => {
    if (audioRef.current && playing) {
      const pct = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(pct);
      animFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, [playing]);

  useEffect(() => {
    if (playing && hasAudio) {
      animFrameRef.current = requestAnimationFrame(updateProgress);
    }

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [playing, hasAudio, updateProgress]);

  const togglePlay = async () => {
    if (!hasAudio && !generating) {
      await generateBriefing();
      return;
    }

    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        await audioRef.current.play();
        setPlaying(true);
      }
    }
  };

  const bars = 24;
  const getBarHeight = (index: number) => {
    if (!playing) return 3;
    const base = Math.sin((Date.now() / 200) + index * 0.7) * 8 + 10;
    return Math.max(3, Math.min(18, base));
  };

  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => forceUpdate((value) => value + 1), 80);
    return () => clearInterval(id);
  }, [playing]);

  return (
    <div className="flex items-center gap-3">
      <div className="glass rounded-xl px-4 py-2 flex items-center gap-3 text-sm">
        <div className="flex items-center gap-[2px] h-5">
          {Array.from({ length: bars }, (_, index) => (
            <div
              key={index}
              className="w-[2px] rounded-full transition-all"
              style={{
                height: getBarHeight(index),
                background: index / bars <= progress / 100 ? 'var(--accent)' : 'var(--text-muted)',
                opacity: playing ? 1 : 0.4,
              }}
            />
          ))}
        </div>

        <button
          onClick={() => void togglePlay()}
          disabled={generating || !accessToken || !org?.id}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 disabled:opacity-60"
          style={{ background: 'var(--accent)', color: '#080c14' }}
          aria-label={playing ? 'Pause briefing' : 'Play briefing'}
        >
          {generating ? (
            <Loader2 size={12} className="animate-spin" />
          ) : playing ? (
            <Pause size={12} />
          ) : (
            <Play size={12} style={{ marginLeft: 1 }} />
          )}
        </button>

        <div className="hidden md:block">
          <div className="text-xs font-medium" style={{ color: playing ? 'var(--accent)' : 'var(--text-secondary)' }}>
            {generating
              ? 'Generating live briefing...'
              : playing
                ? 'Playing briefing...'
                : hasAudio
                  ? 'Briefing ready'
                  : 'Generate live briefing'}
          </div>
          {playing && duration > 0 && (
            <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {Math.floor((progress / 100) * duration)}s / {Math.floor(duration)}s
            </div>
          )}
          {!playing && transcript && (
            <div className="text-[10px] truncate max-w-[220px]" style={{ color: 'var(--text-muted)' }}>
              {transcript}
            </div>
          )}
        </div>

        <Volume2 size={12} style={{ color: 'var(--text-muted)' }} />
      </div>
    </div>
  );
}
