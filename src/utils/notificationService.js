const STORAGE_KEY = 'aust-notifications-v1';
const LAST_WRITE_KEY = 'aust-notifications-lastwrite-v1';
const FIRED_KEY = 'aust-notifications-fired-v1';
const SERVER_SETTINGS_URL = '/api/user/settings';

// Exposed so other modules can react to localStorage writes in other tabs.
export const SETTINGS_STORAGE_KEY = STORAGE_KEY;

const defaultSettings = {
  enabled: false,
  classReminderMins: 10,
  deadlineReminderHours: 24,
  notifyClass: true,
  notifyDeadline: true,
  notifyNotices: false,
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
  try { localStorage.setItem(LAST_WRITE_KEY, String(Date.now())); } catch { /* best-effort */ }
}

/** How long ago (ms) this device last changed settings locally, or null if
 *  it never has. Used to avoid clobbering a fresh local edit with a poll. */
export function getLocalWriteAge() {
  try {
    const t = Number(localStorage.getItem(LAST_WRITE_KEY));
    return Number.isFinite(t) ? Date.now() - t : null;
  } catch {
    return null;
  }
}

/** Fetch this account's cross-device settings from the server (or null). */
export async function fetchServerSettings() {
  try {
    const res = await fetch(SERVER_SETTINGS_URL);
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.success ? data.settings : null;
  } catch {
    return null;
  }
}

/** Best-effort push of the notification prefs to the server so other
 *  devices on this account see the same settings. */
export async function saveSettingsToServer(settings) {
  try {
    await fetch(SERVER_SETTINGS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifications: settings }),
    });
  } catch {
    // Best-effort — localStorage stays as the local cache.
  }
}

/** Pull the account's notification prefs from the server and merge them into
 *  localStorage so every device on this account sees the same settings.
 *  Returns the merged settings, or null when the server had nothing (e.g.
 *  not logged in / offline). */
export async function hydrateSettingsFromServer() {
  const server = await fetchServerSettings();
  if (!server || !server.notifications) return null;
  // If this device changed settings in the last few seconds, that change is
  // about to be pushed to the server — don't let a poll clobber it.
  const localAge = getLocalWriteAge();
  if (localAge !== null && localAge < 5000) return null;
  const merged = { ...loadSettings(), ...server.notifications };
  saveSettings(merged);
  return merged;
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
