import { Play, Pause, RotateCcw, Timer, Brain, Coffee } from 'lucide-react';
import { usePomodoro, formatPomTime, FOCUS, BREAK } from '../../context/PomodoroContext';
import './PomodoroTimer.css';

export default function PomodoroTimer() {
  const { mode, timeLeft, isRunning, sessions, toggle, reset, switchMode } = usePomodoro();
  const total = mode === 'focus' ? FOCUS : BREAK;
  const pct = ((total - timeLeft) / total) * 100;
  const dash = 2 * Math.PI * 34;
  const offset = dash * (1 - pct / 100);

  return (
    <div className="pom-widget glass-card-static">
      <div className="pom-header">
        <div className="pom-header-left">
          <div className="pom-header-icon">
            <Timer size={12} />
          </div>
          <span className="pom-header-title">Pomodoro</span>
        </div>
        <span className="pom-sessions">{sessions} done</span>
      </div>

      <div className="pom-mode-row">
        <button className={`pom-mode-btn ${mode === 'focus' ? 'pom-mode-active' : ''}`} onClick={() => switchMode('focus')}>
          <Brain size={12} /><span>Focus</span>
        </button>
        <button className={`pom-mode-btn ${mode === 'break' ? 'pom-mode-active' : ''}`} onClick={() => switchMode('break')}>
          <Coffee size={12} /><span>Break</span>
        </button>
      </div>

      <div className="pom-ring-wrap">
        <svg className="pom-ring-svg" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border-primary)" strokeWidth="4" />
          <circle cx="40" cy="40" r="34" fill="none"
            stroke={mode === 'focus' ? 'var(--accent-rose)' : 'var(--accent-emerald)'}
            strokeWidth="4" strokeLinecap="round"
            strokeDasharray={dash} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.4s ease', transform: 'rotate(-90deg)', transformOrigin: 'center' }}
          />
        </svg>
        <div className="pom-time">{formatPomTime(timeLeft)}</div>
      </div>

      <div className="pom-ctrls">
        <button className="pom-ctrl pom-ctrl-sm" onClick={reset} title="Reset" data-guest-allow>
          <RotateCcw size={14} />
        </button>
        <button className={`pom-ctrl pom-ctrl-play ${isRunning ? 'pom-ctrl-pause' : ''}`} onClick={toggle}>
          {isRunning ? <Pause size={16} /> : <Play size={16} />}
        </button>
      </div>
    </div>
  );
}
