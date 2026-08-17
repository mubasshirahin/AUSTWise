import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Timer, Play, Pause, RotateCcw, Coffee, Brain,
  Music, Wind, Waves, Volume2, VolumeX,
  Minimize2,
} from 'lucide-react';
import './ZenStudyRoom.css';

/* ─── Constants ─── */
const FOCUS_DURATION = 25 * 60;  // 25 min
const BREAK_DURATION = 5 * 60;   // 5 min

const SOUNDS = [
  { id: 'lofi', label: 'Lo‑Fi Beats', icon: Music, emoji: '🎵' },
  { id: 'rain', label: 'Rain Sounds', icon: Waves, emoji: '🌧️' },
  { id: 'whitenoise', label: 'White Noise', icon: Wind, emoji: '📡' },
];

function fmt(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ZenStudyRoom({ onExit }) {
  const navigate = useNavigate();

  /* ─── Timer ─── */
  const [mode, setMode] = useState('focus');         // focus | break
  const [timeLeft, setTimeLeft] = useState(FOCUS_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const timerRef = useRef(null);
  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;

  const totalSeconds = mode === 'focus' ? FOCUS_DURATION : BREAK_DURATION;
  const progress = ((totalSeconds - timeLeft) / totalSeconds) * 100;
  const circumference = 2 * Math.PI * 200;

  /* ─── Sound ─── */
  const [activeSound, setActiveSound] = useState(null);
  const [volume, setVolume] = useState(0.6);
  const [soundEnabled, setSoundEnabled] = useState(false);

  /* ─── Live Counter ─── */
  const [liveCount, setLiveCount] = useState(() => Math.floor(Math.random() * 8) + 5);
  const [fadeKey, setFadeKey] = useState(0);

  /* ─── Fullscreen ─── */
  const containerRef = useRef(null);

  /* ═══════════════════════════════════════════════
     TIMER LOGIC — single interval, resilient
     ═══════════════════════════════════════════════ */
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Timer finished
            const nextMode = mode === 'focus' ? 'break' : 'focus';
            setMode(nextMode);
            if (mode === 'focus') {
              setCompletedSessions((s) => s + 1);
            }
            return nextMode === 'focus' ? FOCUS_DURATION : BREAK_DURATION;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, mode]);  // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Live counter refresh every 30–90s ─── */
  useEffect(() => {
    const tick = () => {
      const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
      setLiveCount((prev) => Math.max(1, prev + delta));
      setFadeKey((k) => k + 1);
    };
    const interval = setInterval(tick, 30000 + Math.random() * 40000);
    return () => clearInterval(interval);
  }, []);

  /* ─── Fullscreen API ─── */
  const enterFullscreen = useCallback(() => {
    const el = containerRef.current || document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }
  }, []);

  useEffect(() => {
    // Enter fullscreen on mount
    const t = setTimeout(enterFullscreen, 400);
    return () => clearTimeout(t);
  }, [enterFullscreen]);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    onExit?.();
    navigate('/study-room');
  }, [onExit, navigate]);

  /* ─── Keyboard shortcuts ─── */
  useEffect(() => {
    const handler = (e) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        setIsRunning((r) => !r);
      }
      if (e.code === 'Escape') {
        // Let browser handle Esc for fullscreen exit, then our handler fires
        setTimeout(() => {
          if (!document.fullscreenElement) {
            onExit?.();
            navigate('/study-room');
          }
        }, 100);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onExit]);

  /* ─── Toggle sound ─── */
  const toggleSound = useCallback((id) => {
    setActiveSound((prev) => {
      if (prev === id) {
        setSoundEnabled(false);
        return null;
      }
      setSoundEnabled(true);
      return id;
    });
  }, []);

  /* ─── Switch mode ─── */
  const switchMode = useCallback((newMode) => {
    clearInterval(timerRef.current);
    setMode(newMode);
    setIsRunning(false);
    setTimeLeft(newMode === 'focus' ? FOCUS_DURATION : BREAK_DURATION);
  }, []);

  /* ─── Reset ─── */
  const resetTimer = useCallback(() => {
    clearInterval(timerRef.current);
    setIsRunning(false);
    setTimeLeft(mode === 'focus' ? FOCUS_DURATION : BREAK_DURATION);
  }, [mode]);

  /* ─── Cleanup on unmount ─── */
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
    };
  }, []);

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <div className="zen-overlay" ref={containerRef}>
      {/* ── Subtle grid background layer ── */}
      <div className="zen-bg" aria-hidden="true">
        <div className="zen-bg-grid" />
        <div className="zen-bg-vignette" />
      </div>

      {/* ── Top bar: Exit button + mode label ── */}
      <div className="zen-topbar">
        <button className="zen-exit-btn" onClick={exitFullscreen} title="Exit Focus Mode (Esc)">
          <Minimize2 size={14} />
          <span>Exit Focus Mode</span>
        </button>
        <span className="zen-mode-label">
          {mode === 'focus' ? '🔴 Deep Focus' : '🟢 Rest & Recharge'}
        </span>
        <span className="zen-session-counter">
          {completedSessions} session{completedSessions !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Center: Timer ── */}
      <div className="zen-center">
        {/* Mode switch pill */}
        <div className="zen-mode-switch">
          <button
            className={`zen-mode-btn ${mode === 'focus' ? 'zen-mode-btn-active' : ''}`}
            onClick={() => switchMode('focus')}
          >
            <Brain size={14} /> Focus
          </button>
          <button
            className={`zen-mode-btn ${mode === 'break' ? 'zen-mode-btn-active' : ''}`}
            onClick={() => switchMode('break')}
          >
            <Coffee size={14} /> Break
          </button>
        </div>

        {/* Timer ring */}
        <div className="zen-timer-ring-wrapper">
          <svg className="zen-timer-svg" viewBox="0 0 440 440">
            {/* Background track */}
            <circle
              cx="220" cy="220" r="200"
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="4"
            />
            {/* Glow trail (subtle, behind main arc) */}
            <circle
              cx="220" cy="220" r="200"
              fill="none"
              stroke={mode === 'focus' ? 'color-mix(in srgb, var(--accent-amber) 18%, transparent)' : 'color-mix(in srgb, var(--text-tertiary) 18%, transparent)'}
              strokeWidth="6"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={circumference * (1 - progress / 100)}
              strokeLinecap="round"
              style={{ filter: 'blur(8px)', transition: 'stroke-dashoffset 0.6s ease' }}
            />
            {/* Main progress arc */}
            <circle
              cx="220" cy="220" r="200"
              fill="none"
              stroke={mode === 'focus' ? 'var(--accent-amber)' : 'var(--text-tertiary)'}
              strokeWidth="3"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={circumference * (1 - progress / 100)}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dashoffset 0.6s ease',
                filter: `drop-shadow(0 0 8px ${mode === 'focus' ? 'color-mix(in srgb, var(--accent-amber) 50%, transparent)' : 'color-mix(in srgb, var(--text-tertiary) 50%, transparent)'})`,
              }}
            />
          </svg>
          {/* Center text */}
          <div className="zen-timer-center">
            <span className="zen-timer-time" key={`${mode}-${timeLeft}`}>
              {fmt(timeLeft)}
            </span>
            <span className="zen-timer-mode-label">
              {mode === 'focus' ? 'FOCUS' : 'BREAK'}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="zen-controls">
          <button className="zen-ctrl-btn zen-ctrl-btn-icon" onClick={resetTimer} title="Reset">
            <RotateCcw size={18} />
          </button>
          <button
            className={`zen-ctrl-btn zen-ctrl-btn-play ${isRunning ? 'zen-ctrl-btn-pause' : ''}`}
            onClick={() => setIsRunning((r) => !r)}
          >
            {isRunning ? <Pause size={24} /> : <Play size={24} />}
          </button>
          <button className="zen-ctrl-btn zen-ctrl-btn-icon" disabled>
            <Timer size={18} />
          </button>
        </div>

        {/* Hint */}
        <span className="zen-hint">Press <kbd>Space</kbd> to toggle</span>
      </div>

      {/* ── Bottom: Sound board ── */}
      <div className="zen-bottom">
        <div className="zen-sound-board">
          <div className="zen-sound-header">
            <span className="zen-sound-label-text">
              {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
              Ambient Sound
            </span>
            {soundEnabled && (
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="zen-volume-slider"
                title={`Volume: ${Math.round(volume * 100)}%`}
              />
            )}
          </div>
          <div className="zen-sound-btns">
            {SOUNDS.map((s) => {
              const Icon = s.icon;
              const isActive = activeSound === s.id;
              return (
                <button
                  key={s.id}
                  className={`zen-sound-btn ${isActive ? 'zen-sound-btn-active' : ''}`}
                  onClick={() => toggleSound(s.id)}
                >
                  <span className="zen-sound-btn-emoji">{s.emoji}</span>
                  <span className="zen-sound-btn-label">{s.label}</span>
                  {isActive && <span className="zen-sound-btn-dot" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live counter */}
        <div className="zen-live-counter" key={fadeKey}>
          <span className="zen-live-dot" />
          <span className="zen-live-text">{liveCount} other{liveCount !== 1 ? 's' : ''} studying with you</span>
        </div>
      </div>
    </div>
  );
}
