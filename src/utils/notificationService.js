const STORAGE_KEY = 'aust-notifications-v1';
const FIRED_KEY = 'aust-notifications-fired-v1';
const WAKE_UP_KEY = 'aust-wake-me-up-v1';

const defaultSettings = {
  enabled: false,
  classReminderMins: 10,
  deadlineReminderHours: 24,
  notifyClass: true,
  notifyDeadline: true,
  notifyNotices: false,
  wakeMeUp: false,
  wakeUpOffsetMins: 30,
};

export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getPermissionStatus() {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : { ...defaultSettings };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadSettings(), ...settings }));
}

function loadFiredSet() {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveFiredSet(set) {
  const arr = [...set].slice(-200);
  localStorage.setItem(FIRED_KEY, JSON.stringify(arr));
}

function markFired(key) {
  const set = loadFiredSet();
  set.add(key);
  saveFiredSet(set);
}

function hasFired(key) {
  return loadFiredSet().has(key);
}

export function sendNotification(title, body, opts = {}) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return null;
  try {
    const n = new Notification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: opts.tag || title,
      requireInteraction: opts.requireInteraction || false,
      ...opts,
    });
    n.onclick = () => { window.focus(); n.close(); };
    return n;
  } catch {
    return null;
  }
}

function parseTime(timeStr) {
  if (!timeStr) return null;
  const match = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return { h: parseInt(match[1], 10), m: parseInt(match[2], 10) };
}

function getTodayDayName() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
}

function getDayName(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

function loadWakeUpSchedule() {
  try {
    const raw = localStorage.getItem(WAKE_UP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveWakeUpSchedule(schedule) {
  try {
    if (schedule) localStorage.setItem(WAKE_UP_KEY, JSON.stringify(schedule));
    else localStorage.removeItem(WAKE_UP_KEY);
  } catch {
    // Ignore storage errors; notification settings still remain usable.
  }
}

function firstClassForDay(routine, dayName) {
  const classes = Array.isArray(routine?.[dayName]) ? routine[dayName] : [];
  return classes
    .map((cls) => ({ cls, parsed: parseTime(cls.time?.split(' - ')[0] || cls.time || '') }))
    .filter(({ parsed }) => parsed)
    .sort((a, b) => (a.parsed.h * 60 + a.parsed.m) - (b.parsed.h * 60 + b.parsed.m))[0] || null;
}

export function findNextWakeUpClass(routine, weekDays, fromDate = new Date()) {
  const enabledDays = Array.isArray(weekDays) ? weekDays : [];
  for (let offset = 1; offset <= 7; offset += 1) {
    const date = new Date(fromDate);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    const dayName = getDayName(date);
    if (!enabledDays.includes(dayName)) continue;

    const first = firstClassForDay(routine, dayName);
    if (!first) continue;

    const dateKey = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    return {
      date: dateKey,
      day: dayName,
      time: `${String(first.parsed.h).padStart(2, '0')}:${String(first.parsed.m).padStart(2, '0')}`,
      course: first.cls.course || first.cls.name || 'your first class',
      name: first.cls.name || first.cls.course || 'Class',
      room: first.cls.room || '',
    };
  }
  return null;
}

export function scheduleWakeUp(routine, weekDays, fromDate = new Date()) {
  const schedule = findNextWakeUpClass(routine, weekDays, fromDate);
  saveWakeUpSchedule(schedule);
  return schedule;
}

export function getWakeUpSchedule() {
  return loadWakeUpSchedule();
}

export function clearWakeUpSchedule() {
  saveWakeUpSchedule(null);
}

export function getWakeUpTriggerAtMillis(schedule, offsetMins = 30) {
  if (!schedule?.date || !schedule?.time) return null;
  const [year, month, day] = String(schedule.date).split('-').map(Number);
  const [hour, minute] = String(schedule.time).split(':').map(Number);
  const classTime = new Date(year, month - 1, day, hour, minute, 0, 0);
  return classTime.getTime() - Math.max(0, Number(offsetMins) || 0) * 60 * 1000;
}

export function checkWakeMeUp(routine, weekDays, offsetMins = 30) {
  let schedule = loadWakeUpSchedule();
  if (!schedule) schedule = scheduleWakeUp(routine, weekDays);
  if (!schedule) return;

  const [year, month, day] = String(schedule.date).split('-').map(Number);
  const [hour, minute] = String(schedule.time).split(':').map(Number);
  const classTime = new Date(year, month - 1, day, hour, minute, 0, 0);
  const triggerAtMillis = getWakeUpTriggerAtMillis(schedule, offsetMins);
  const diff = triggerAtMillis - Date.now();

  // The runner polls every minute; allow a small late-start window.
  if (diff < -90 * 1000) {
    schedule = scheduleWakeUp(routine, weekDays, new Date());
    return;
  }
  if (diff > 90 * 1000) return;

  const key = `wake-${schedule.date}-${schedule.time}-${schedule.course}`;
  if (hasFired(key)) return;
  markFired(key);
  sendNotification(
    '⏰ WakeMeUp — class soon',
    `${schedule.course}${schedule.room ? ` • Room ${schedule.room}` : ''}\nYour first class starts at ${schedule.time}.`,
    { tag: key, requireInteraction: true }
  );
  // Search after the class time, not the earlier alert time, so a large offset
  // cannot cause the same class to be selected again.
  scheduleWakeUp(routine, weekDays, classTime);
}

export function checkClassReminders(routine, weekDays, minutesBefore = 10) {
  const today = getTodayDayName();
  if (!weekDays.includes(today)) return;
  const classes = routine[today] || [];
  if (!classes.length) return;

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  classes.forEach((cls) => {
    const timeStr = cls.time?.split(' - ')[0] || cls.time || '';
    const parsed = parseTime(timeStr);
    if (!parsed) return;

    const classMins = parsed.h * 60 + parsed.m;
    const diff = classMins - nowMins;

    if (diff > 0 && diff <= minutesBefore) {
      const dateStr = now.toDateString();
      const key = `class-${dateStr}-${cls.id || cls.course}-${timeStr}`;
      if (!hasFired(key)) {
        markFired(key);
        sendNotification(
          `🔔 Class in ${diff} minute${diff === 1 ? '' : 's'}`,
          `${cls.course} — ${cls.name}\n📍 Room ${cls.room} at ${timeStr}`,
          { tag: key, requireInteraction: true }
        );
      }
    }
  });
}

export function checkDeadlineReminders(deadlines, hoursBefore = 24) {
  const now = Date.now();
  const thresholdMs = hoursBefore * 60 * 60 * 1000;

  deadlines.forEach((dl) => {
    const due = dl.dueDate instanceof Date ? dl.dueDate.getTime() : new Date(dl.dueDate).getTime();
    const diff = due - now;
    const diffHrs = Math.round(diff / 3600000);

    if (diff > 0 && diff <= thresholdMs) {
      const key = `deadline-${dl.id}-${hoursBefore}h`;
      if (!hasFired(key)) {
        markFired(key);
        const timeLabel = diffHrs <= 1 ? 'less than 1 hour' : `${diffHrs} hour${diffHrs === 1 ? '' : 's'}`;
        sendNotification(
          `⏰ Deadline Alert — ${dl.course}`,
          `"${dl.title}" is due in ${timeLabel}!\nType: ${dl.type} • Priority: ${dl.priority}`,
          { tag: key, requireInteraction: true }
        );
      }
    }
  });
}
