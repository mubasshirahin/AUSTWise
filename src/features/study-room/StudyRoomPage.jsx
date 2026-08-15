import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  School, Timer, Play, Pause, RotateCcw, Coffee, Brain,
  Music, Wind, Waves, Bird, Volume2, VolumeX, Lightbulb,
  Clock, CheckCircle, Plus, Minus, Maximize2
} from 'lucide-react';
import './StudyRoomPage.css';
import '../../components/PageHero.css';

// All timer modes share the brand accent — mode is communicated by label, not color.
const TIMER_MODES = [
  { id: 'pomodoro', label: 'Focus', duration: 25 * 60, icon: Brain, color: 'var(--accent-amber)' },
  { id: 'shortBreak', label: 'Short Break', duration: 5 * 60, icon: Coffee, color: 'var(--accent-amber)' },
  { id: 'longBreak', label: 'Long Break', duration: 15 * 60, icon: Coffee, color: 'var(--accent-amber)' },
];

const AMBIENT_SOUNDS = [
  { id: 'rain', label: 'Rain', icon: Waves, emoji: '🌧️' },
  { id: 'forest', label: 'Forest', icon: Bird, emoji: '🌲' },
  { id: 'cafe', label: 'Café', icon: Music, emoji: '☕' },
  { id: 'whitenoise', label: 'White Noise', icon: Wind, emoji: '📡' },
];

const STUDY_TIPS = [
  'Break large tasks into 25-minute chunks for better focus.',
  'The Pomodoro Technique: 25 min work, 5 min break, repeat.',
  'Study in a well-lit space to reduce eye strain and fatigue.',
  'Take handwritten notes — it improves memory retention.',
  'Teach someone else what you just learned to solidify it.',
  'Stay hydrated! Your brain is 75% water.',
  'Use active recall: test yourself instead of re-reading.',
  'Sleep is when your brain consolidates memories. Get 7-9 hours.',
];

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function StudyRoomPage() {
  /* ─── Timer State ─── */
  const [activeMode, setActiveMode] = useState('pomodoro');
  const [timeLeft, setTimeLeft] = useState(TIMER_MODES[0].duration);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(25);

  /* ─── Ambient Sound State ─── */
  const [activeSound, setActiveSound] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  /* ─── Study Tip ─── */
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * STUDY_TIPS.length));

  const timerRef = useRef(null);

  /* ─── Timer logic ─── */
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            if (activeMode === 'pomodoro') {
              setSessionsCompleted((s) => s + 1);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, timeLeft, activeMode]);

  /* ─── Switch mode ─── */
  const switchMode = useCallback((modeId) => {
    clearInterval(timerRef.current);
    setIsRunning(false);
    setActiveMode(modeId);
    const mode = TIMER_MODES.find((m) => m.id === modeId);
    if (mode) setTimeLeft(mode.duration);
  }, []);

  /* ─── Toggle timer ─── */
  const toggleTimer = useCallback(() => {
    if (timeLeft === 0) {
      const mode = TIMER_MODES.find((m) => m.id === activeMode);
      setTimeLeft(mode?.duration || 25 * 60);
    }
    setIsRunning((prev) => !prev);
  }, [timeLeft, activeMode]);

  /* ─── Reset timer ─── */
  const resetTimer = useCallback(() => {
    clearInterval(timerRef.current);
    setIsRunning(false);
    const mode = TIMER_MODES.find((m) => m.id === activeMode);
    setTimeLeft(mode?.duration || 25 * 60);
  }, [activeMode]);

  /* ─── Custom timer ─── */
  const applyCustomTimer = useCallback(() => {
    const mins = Math.max(1, Math.min(120, customMinutes));
    setTimeLeft(mins * 60);
    setActiveMode('pomodoro');
    setIsRunning(false);
    clearInterval(timerRef.current);
  }, [customMinutes]);

  /* ─── Toggle sound ─── */
  const toggleSound = useCallback((soundId) => {
    if (activeSound === soundId) {
      setActiveSound(null);
      setSoundEnabled(false);
    } else {
      setActiveSound(soundId);
      setSoundEnabled(true);
    }
  }, [activeSound]);

  /* ─── Cycle tip ─── */
  const nextTip = useCallback(() => {
    setTipIndex((prev) => (prev + 1) % STUDY_TIPS.length);
  }, []);

  /* ─── Keyboard shortcut: Space to toggle timer ─── */
  useEffect(() => {
    const handler = (e) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        toggleTimer();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleTimer]);

  const currentMode = TIMER_MODES.find((m) => m.id === activeMode);
  const progress = currentMode ? ((currentMode.duration - timeLeft) / currentMode.duration) * 100 : 0;
  const navigate = useNavigate();

  return (
    <div className="study-room-page animate-fadeIn">
      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <School size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Productivity</span>
            <div className="schedule-title">Study Time</div>
            <span className="schedule-subtitle">Your focused study sanctuary — timer, ambient sounds, and tips to boost productivity.</span>
          </div>
        </div>
        <div className="schedule-masthead-center" />
        <div className="schedule-actions">
          <button
            className="sr-zen-btn"
            onClick={() => navigate('/zen')}
          >
            <Maximize2 size={16} />
            <span>Enter Zen Mode</span>
          </button>
        </div>
      </div>

      <div className="schedule-dotted-divider" style={{ marginTop: 0 }} />

      <div className="sr-layout">
        {/* ── Left Column: Timer ── */}
        <div className="sr-main">
          {/* Mode Selector */}
          <div className="sr-mode-tabs">
            {TIMER_MODES.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  className={`sr-mode-tab ${activeMode === mode.id ? 'sr-mode-tab-active' : ''}`}
                  onClick={() => switchMode(mode.id)}
                  style={{
                    '--tab-color': mode.color,
                  }}
                >
                  <Icon size={14} />
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>

          {/* Timer Circle */}
          <div className="sr-timer-container">
            <svg className="sr-timer-ring" viewBox="0 0 200 200">
              <circle
                className="sr-timer-ring-bg"
                cx="100" cy="100" r="88"
                fill="none"
                strokeWidth="6"
              />
              <circle
                className="sr-timer-ring-fill"
                cx="100" cy="100" r="88"
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                stroke={currentMode?.color || 'var(--accent-amber)'}
                style={{
                  strokeDasharray: `${2 * Math.PI * 88}`,
                  strokeDashoffset: `${2 * Math.PI * 88 * (1 - progress / 100)}`,
                  transition: 'stroke-dashoffset 0.5s ease',
                }}
              />
            </svg>
            <div className="sr-timer-center">
              <span className="sr-timer-time">{formatTimer(timeLeft)}</span>
              <span className="sr-timer-label">
                {isRunning ? 'Focusing...' : timeLeft === 0 ? 'Done!' : 'Ready'}
              </span>
            </div>
          </div>

          {/* Timer Controls */}
          <div className="sr-timer-controls">
            <button className="sr-btn sr-btn-icon" onClick={resetTimer} title="Reset">
              <RotateCcw size={18} />
            </button>
            <button
              className="sr-btn sr-btn-primary"
              onClick={toggleTimer}
              style={{ background: currentMode?.color || 'var(--accent-amber)' }}
            >
              {isRunning ? <Pause size={20} /> : <Play size={20} />}
              <span>{isRunning ? 'Pause' : timeLeft === 0 ? 'Restart' : 'Start'}</span>
            </button>
            <button className="sr-btn sr-btn-icon" disabled>
              <Clock size={18} />
            </button>
          </div>

          {/* Custom Timer */}
          <div className="sr-custom-timer">
            <span className="sr-custom-label">Custom focus (min):</span>
            <div className="sr-custom-input-group">
              <button
                className="sr-custom-btn"
                onClick={() => setCustomMinutes((m) => Math.max(1, m - 5))}
              >
                <Minus size={14} />
              </button>
              <input
                type="number"
                className="sr-custom-input"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(Number(e.target.value) || 1)}
                min={1}
                max={120}
              />
              <button
                className="sr-custom-btn"
                onClick={() => setCustomMinutes((m) => Math.min(120, m + 5))}
              >
                <Plus size={14} />
              </button>
              <button className="sr-btn sr-btn-secondary" onClick={applyCustomTimer}>
                Apply
              </button>
            </div>
          </div>

          {/* Sessions counter */}
          <div className="sr-sessions">
            <CheckCircle size={14} style={{ color: 'var(--accent-emerald)' }} />
            <span>{sessionsCompleted} session{sessionsCompleted !== 1 ? 's' : ''} completed today</span>
          </div>
        </div>

        {/* ── Right Column: Ambient & Tips ── */}
        <div className="sr-side">
          {/* Ambient Sounds */}
          <div className="sr-card">
            <div className="sr-card-header">
              <div className="sr-card-header-icon" style={{ background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </div>
              <div>
                <h3 className="sr-card-title">Ambient Sounds</h3>
                <p className="sr-card-subtitle">Background noise to help you focus</p>
              </div>
            </div>
            <div className="sr-sound-grid">
              {AMBIENT_SOUNDS.map((sound) => {
                const Icon = sound.icon;
                const isActive = activeSound === sound.id;
                return (
                  <button
                    key={sound.id}
                    className={`sr-sound-btn ${isActive ? 'sr-sound-btn-active' : ''}`}
                    onClick={() => toggleSound(sound.id)}
                  >
                    <span className="sr-sound-emoji">{sound.emoji}</span>
                    <span className="sr-sound-label">{sound.label}</span>
                    {isActive && <span className="sr-sound-playing" />}
                  </button>
                );
              })}
            </div>
            {soundEnabled && (
              <p className="sr-sound-note">
                <Volume2 size={12} />
                Ambient sounds simulated — connect speakers for best experience.
              </p>
            )}
          </div>

          {/* Study Tip Card */}
          <div className="sr-card">
            <div className="sr-card-header">
              <div className="sr-card-header-icon" style={{ background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>
                <Lightbulb size={16} />
              </div>
              <div>
                <h3 className="sr-card-title">Study Tip</h3>
                <p className="sr-card-subtitle">Evidence-based learning advice</p>
              </div>
            </div>
            <div className="sr-tip-container">
              <p className="sr-tip-text">{STUDY_TIPS[tipIndex]}</p>
              <button className="sr-tip-next" onClick={nextTip}>
                <RotateCcw size={14} /> Next Tip
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="sr-card">
            <div className="sr-card-header">
              <div className="sr-card-header-icon" style={{ background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>
                <Timer size={16} />
              </div>
              <div>
                <h3 className="sr-card-title">Quick Stats</h3>
                <p className="sr-card-subtitle">Your study rhythm</p>
              </div>
            </div>
            <div className="sr-stats-grid">
              <div className="sr-stat">
                <span className="sr-stat-value">{sessionsCompleted}</span>
                <span className="sr-stat-label">Sessions</span>
              </div>
              <div className="sr-stat">
                <span className="sr-stat-value">{Math.floor((sessionsCompleted * 25) / 60)}h {((sessionsCompleted * 25) % 60)}m</span>
                <span className="sr-stat-label">Focused</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
