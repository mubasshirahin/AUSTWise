import { useEffect, useRef } from 'react';
import {
  loadSettings,
  getPermissionStatus,
  checkClassReminders,
  checkDeadlineReminders,
} from '../utils/notificationService';
import { getLiveValue } from '../utils/liveStore';

const POLL_INTERVAL_MS = 60 * 1000;

// The user's real deadlines: their own deadlines plus dated week tasks,
// read the same way the server's Telegram / push reminders read them.
function loadMyDeadlines() {
  const manual = getLiveValue('user', 'aust-deadlines', []);
  const weekTasks = getLiveValue('user', 'aust-week-tasks', []);
  const items = [];
  for (const dl of (Array.isArray(manual) ? manual : [])) {
    if (!dl?.dueDate) continue;
    items.push({ id: String(dl.id || dl.title), title: dl.title || 'Untitled task', course: dl.course || dl.courseCode || 'General', type: dl.type, priority: dl.priority || 'medium', dueDate: dl.dueDate });
  }
  for (const t of (Array.isArray(weekTasks) ? weekTasks : [])) {
    if (!t?.date) continue;
    const due = new Date(`${t.date}T00:00:00`);
    if (Number.isNaN(due.getTime())) continue;
    const [h, m] = String(t.time || '').split(':').map(Number);
    if (t.time && Number.isFinite(h) && Number.isFinite(m)) due.setHours(h, m, 0, 0);
    else due.setHours(23, 59, 59, 0);
    items.push({ id: `task-${t.id}`, title: t.title || 'Untitled task', course: t.courseCode || t.courseName || 'General', type: 'Task', priority: t.priority || 'medium', dueDate: due });
  }
  return items;
}

// Browser class (30 min) and deadline (12 h) reminders, checked every minute
// on every page. Mounted once, in RoutineProvider. When Web Push is on the
// server sends these instead, and the check functions skip themselves.
export function useReminderChecks(routine, weekDays) {
  const latest = useRef({ routine, weekDays });
  useEffect(() => { latest.current = { routine, weekDays }; }, [routine, weekDays]);

  useEffect(() => {
    const run = () => {
      const settings = loadSettings();
      if (!settings.enabled || getPermissionStatus() !== 'granted') return;
      const { routine: r, weekDays: w } = latest.current;
      if (settings.notifyClass && r) checkClassReminders(r, w || [], 30);
      if (settings.notifyDeadline) checkDeadlineReminders(loadMyDeadlines(), 12);
    };
    run();
    const id = setInterval(run, POLL_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
}
