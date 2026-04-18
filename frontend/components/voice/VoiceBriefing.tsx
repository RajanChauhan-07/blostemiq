'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

const BRIEFING_TEXT = `Good morning. Here's your daily partner intelligence briefing. 

BharatPe remains critical — zero API calls for 32 days running. Churn probability is at 91%. I recommend generating an escalation outreach sequence immediately.

Razorpay's API usage dropped another 12% overnight, now down 67% month over month. Their health score is 38 and falling. 

On the positive side, CRED hit a new record — 8,900 API calls this week with 100% feature adoption. Zerodha continues strong at health score 96.

Three new alerts fired overnight. Two critical, one medium. Your portfolio average health is 64.2, down 3 points from last week. 

I'll have your weekly PDF digest ready by noon. Have a productive day.`;

export function VoiceBriefing() {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentWord, setCurrentWord] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const words = BRIEFING_TEXT.split(' ');
  const totalDuration = 45; // seconds

  useEffect(() => {
    if (playing) {
      const startTime = Date.now() - (progress * totalDuration * 10);
      intervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const pct = Math.min((elapsed / totalDuration) * 100, 100);
        setProgress(pct);
        setCurrentWord(Math.floor((pct / 100) * words.length));
        if (pct >= 100) {
          setPlaying(false);
          setProgress(0);
          setCurrentWord(0);
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }, 100);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing]);

  // Generate waveform bars
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
        <button onClick={() => setPlaying(p => !p)}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{ background: 'var(--accent)', color: '#080c14' }}>
          {playing ? <Pause size={12} /> : <Play size={12} style={{ marginLeft: 1 }} />}
        </button>

        {/* Label */}
        <div className="hidden md:block">
          <div className="text-xs font-medium" style={{ color: playing ? 'var(--accent)' : 'var(--text-secondary)' }}>
            {playing ? 'Playing briefing...' : "Today's briefing ready"}
          </div>
          {playing && (
            <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {Math.floor((progress / 100) * totalDuration)}s / {totalDuration}s
            </div>
          )}
        </div>

        <Volume2 size={12} style={{ color: 'var(--text-muted)' }} />
      </div>
    </div>
  );
}

export function BriefingTranscript() {
  return (
    <div className="glass rounded-2xl p-6 border border-white/5">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <Volume2 size={14} style={{ color: 'var(--accent)' }} />
        Morning Briefing Transcript
      </h3>
      <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
        {BRIEFING_TEXT}
      </div>
      <div className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        Generated at 8:00 AM IST · Voice: Adam (ElevenLabs) · Duration: 45s
      </div>
    </div>
  );
}
