'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Volume2, Loader2 } from 'lucide-react';

const AT_RISK_PARTNERS = [
  { name: 'BharatPe', health: 12, churn: 91, reason: 'Zero API calls for 32 days' },
  { name: 'Razorpay', health: 38, churn: 67, reason: 'API usage dropped 67% MoM' },
  { name: 'Lendingkart', health: 44, churn: 55, reason: 'Support tickets up 400%' },
  { name: 'Groww', health: 51, churn: 42, reason: 'Feature adoption declined to 40%' },
  { name: 'CRED', health: 92, churn: 5, reason: 'Record 8900 API calls this week' },
];

export function VoiceBriefing() {
  const [playing, setPlaying] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasAudio, setHasAudio] = useState(false);
  const [transcript, setTranscript] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);

  // Generate briefing from real ElevenLabs
  const generateBriefing = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/outreach/briefing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partners: AT_RISK_PARTNERS,
          total_partners: 20,
          avg_health: 64.2,
          at_risk_count: 4,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTranscript(data.transcript);
        if (data.audio_url) {
          // Create audio element pointing to the audio endpoint
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
            console.warn('Audio load error, falling back to visual-only mode');
            setHasAudio(false);
          });
          audioRef.current = audio;
        }
      }
    } catch (err) {
      console.error('Briefing generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }, []);

  // Update progress bar from audio time
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
      // First click: generate the briefing
      await generateBriefing();
      return;
    }

    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        audioRef.current.play();
        setPlaying(true);
      }
    }
  };

  // Waveform bars
  const bars = 24;
  const getBarHeight = (i: number) => {
    if (!playing) return 3;
    const base = Math.sin((Date.now() / 200) + i * 0.7) * 8 + 10;
    return Math.max(3, Math.min(18, base));
  };

  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => forceUpdate(x => x + 1), 80);
    return () => clearInterval(id);
  }, [playing]);

  return (
    <div className="flex items-center gap-3">
      <div className="glass rounded-xl px-4 py-2 flex items-center gap-3 text-sm">
        {/* Waveform */}
        <div className="flex items-center gap-[2px] h-5">
          {Array.from({ length: bars }, (_, i) => (
            <div key={i} className="w-[2px] rounded-full transition-all"
              style={{
                height: getBarHeight(i),
                background: i / bars <= progress / 100 ? 'var(--accent)' : 'var(--text-muted)',
                opacity: playing ? 1 : 0.4,
              }} />
          ))}
        </div>

        {/* Play/Pause */}
        <button onClick={togglePlay} disabled={generating}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{ background: 'var(--accent)', color: '#080c14' }}>
          {generating ? (
            <Loader2 size={12} className="animate-spin" />
          ) : playing ? (
            <Pause size={12} />
          ) : (
            <Play size={12} style={{ marginLeft: 1 }} />
          )}
        </button>

        {/* Label */}
        <div className="hidden md:block">
          <div className="text-xs font-medium" style={{ color: playing ? 'var(--accent)' : 'var(--text-secondary)' }}>
            {generating ? 'Generating with ElevenLabs...' : playing ? 'Playing briefing...' : hasAudio ? 'Briefing ready' : "Generate today's briefing"}
          </div>
          {playing && duration > 0 && (
            <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {Math.floor((progress / 100) * duration)}s / {Math.floor(duration)}s
            </div>
          )}
        </div>

        <Volume2 size={12} style={{ color: 'var(--text-muted)' }} />
      </div>
    </div>
  );
}
