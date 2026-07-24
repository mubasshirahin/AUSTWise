import { Play, Pause, RotateCcw, Brain, Coffee } from 'lucide-react';
import { usePomodoro, formatPomTime } from '../context/PomodoroContext';

export default function NavPomodoro() {
  const { mode: pomMode, timeLeft: pomTime, isRunning: pomRunning, toggle: pomToggle, reset: pomReset, switchMode: pomSwitch } = usePomodoro();

  return (
    <div className="nav-pom">
      <button
        className={`nav-pom-mode ${pomMode === 'focus' ? 'nav-pom-mode-active' : ''}`}
        onClick={() => pomSwitch('focus')}
        title="Focus (25 min)"
      >
        <Brain size={15} />
      </button>
      <span className="nav-pom-time">{formatPomTime(pomTime)}</span>
      <button className="nav-pom-ctrl" onClick={pomToggle} title={pomRunning ? 'Pause' : 'Start'}>
        {pomRunning ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <button className="nav-pom-ctrl" onClick={pomReset} title="Reset">
        <RotateCcw size={14} />
      </button>
      <button
        className={`nav-pom-mode ${pomMode === 'break' ? 'nav-pom-mode-active' : ''}`}
        onClick={() => pomSwitch('break')}
        title="Break (5 min)"
      >
        <Coffee size={15} />
      </button>
    </div>
  );
}
