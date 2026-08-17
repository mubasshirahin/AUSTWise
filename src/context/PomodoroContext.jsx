import { createContext, useContext } from 'react';

export const PomodoroContext = createContext(null);

/* ─── Constants (exported so consumers can import directly) ─── */
export const FOCUS = 25 * 60;
export const BREAK = 5 * 60;

/* ─── Shared formatter ─── */
export function formatPomTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function usePomodoro() {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error('usePomodoro must be used within PomodoroProvider');
  return ctx;
}
