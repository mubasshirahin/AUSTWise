import { showDeviceNotification, isServerPushedOnThisDevice } from './deviceNotification';

const NOTIFS_KEY = 'aust-inapp-notifs-v1';
const NATIVE_SHOWN_KEY = 'aust-inapp-notifs-native-v1';
// Ids the user deleted / already read. The seeders (notices, deadlines, tasks,
// role applications) run every few seconds and would otherwise re-create a
// deleted item, or bring back a trimmed one as unread.
const DISMISSED_KEY = 'aust-inapp-notifs-dismissed-v1';
const READ_IDS_KEY = 'aust-inapp-notifs-read-v1';
const MAX_ITEMS = 200;
const MAX_TOMBSTONES = 2000;
const DEFAULT_CHANNELS = {
  telegram: { notices: true, classSchedule: true, classReminders: true, attendance: true, deadlines: true },
  browser: { notices: true, classReminders: true, deadlines: true, tasks: true, messages: true, applications: true, gaming: true, results: true },
  bell: { notices: true, deadlines: true, tasks: true, messages: true, applications: true, gaming: true, results: true },
};

export function getNotificationChannelEnabled(channel, category) {
  try {
    const settings = JSON.parse(localStorage.getItem('aust-notifications-v1') || '{}');
    const value = settings.channels?.[channel]?.[category];
    if (typeof value === 'boolean') return value;
    const legacy = channel === 'telegram'
      ? { classSchedule: settings.notifyDigest, classReminders: settings.notifyClass, attendance: settings.notifyAttendance, deadlines: settings.notifyDeadline }
      : channel === 'browser'
        ? { classReminders: settings.notifyClass, deadlines: settings.notifyDeadline }
        : {};
    if (typeof legacy[category] === 'boolean') return legacy[category];
  } catch { /* use defaults when storage is unavailable */ }
  return DEFAULT_CHANNELS[channel]?.[category] !== false;
}

function categoryForNotification(item) {
  if (item.category) return item.category;
  if (item.type === 'notice') return 'notices';
  if (item.type === 'deadline') return 'deadlines';
  if (item.type === 'task') return 'tasks';
  return 'messages';
}

function getUserScopedKey(baseKey) {
  try {
    const profile = JSON.parse(localStorage.getItem('aust-user-profile') || 'null');
    const userId = profile?.id && profile.id !== 'guest' ? profile.id : 'guest';
    return `${baseKey}:${userId}`;
  } catch {
    return `${baseKey}:guest`;
  }
}

function normalizeScopeValue(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function noticeScopeMatchesUser(scope, user) {
  if (!scope || typeof scope !== 'object') return true;
  if (scope.department && normalizeScopeValue(scope.department) !== normalizeScopeValue(user?.department)) return false;
  if (scope.semester && normalizeScopeValue(scope.semester) !== normalizeScopeValue(user?.semester)) return false;
  if (scope.section && normalizeScopeValue(scope.section) !== normalizeScopeValue(user?.section)) return false;
  if (scope.labSection && normalizeScopeValue(scope.labSection) !== normalizeScopeValue(user?.labSection)) return false;
  return true;
}

/**
 * @typedef {Object} AppNotification
 * @property {string} id - unique id
 * @property {string} title - notification title
 * @property {string} body - notification body/content
 * @property {string} type - 'deadline' | 'notice' | 'class' | 'task' | 'info'
 * @property {string} icon - lucide icon name
 * @property {string} path - route to navigate to on click
 * @property {number} timestamp - epoch ms
 * @property {boolean} read - whether user has seen it
 * @property {'low'|'medium'|'high'} [priority]
 */

// ─── Storage helpers ───

function loadIdSet(baseKey) {
  try {
    const raw = JSON.parse(localStorage.getItem(getUserScopedKey(baseKey)) || '[]');
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

function saveIdSet(baseKey, set) {
  try {
    const list = [...set];
    localStorage.setItem(getUserScopedKey(baseKey), JSON.stringify(list.slice(-MAX_TOMBSTONES)));
  } catch { /* storage full – silently fail */ }
}

function addToIdSet(baseKey, ids) {
  const set = loadIdSet(baseKey);
  let changed = false;
  for (const id of ids) {
    if (id && !set.has(id)) { set.add(id); changed = true; }
  }
  if (changed) saveIdSet(baseKey, set);
}

function readStored() {
  try {
    const raw = localStorage.getItem(getUserScopedKey(NOTIFS_KEY));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Stored items minus anything the user deleted, with remembered read state. */
export function loadNotifications() {
  const dismissed = loadIdSet(DISMISSED_KEY);
  const readIds = loadIdSet(READ_IDS_KEY);
  return readStored()
    .filter((n) => n && !dismissed.has(n.id))
    .map((n) => (!n.read && readIds.has(n.id) ? { ...n, read: true } : n));
}

export function saveNotifications(items) {
  try {
    const dismissed = loadIdSet(DISMISSED_KEY);
    const readIds = loadIdSet(READ_IDS_KEY);
    const seen = new Set();
    const clean = [];
    for (const n of items) {
      if (!n || dismissed.has(n.id) || seen.has(n.id)) continue;
      seen.add(n.id);
      clean.push(!n.read && readIds.has(n.id) ? { ...n, read: true } : n);
    }
    // Keep the newest MAX_ITEMS. Anything trimmed is tombstoned so a seeder
    // can't bring it straight back as a fresh unread item.
    clean.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
    const dropped = clean.length > MAX_ITEMS ? clean.slice(0, clean.length - MAX_ITEMS) : [];
    if (dropped.length) addToIdSet(DISMISSED_KEY, dropped.map((n) => n.id));
    localStorage.setItem(getUserScopedKey(NOTIFS_KEY), JSON.stringify(clean.slice(-MAX_ITEMS)));
  } catch {
    // storage full – silently fail
  }
}

// ─── Read / Mutate ───

export function getUnreadCount() {
  return loadNotifications().filter((n) => !n.read).length;
}

export function getUnreadNotifications() {
  return loadNotifications().filter((n) => !n.read);
}

export function markAsRead(id) {
  if (!id) return;
  addToIdSet(READ_IDS_KEY, [id]);
  const items = readStored();
  const idx = items.findIndex((n) => n.id === id);
  if (idx !== -1 && !items[idx].read) {
    items[idx].read = true;
    saveNotifications(items);
  }
}

export function markAllAsRead() {
  const items = readStored();
  addToIdSet(READ_IDS_KEY, items.map((n) => n.id));
  saveNotifications(items.map((n) => (n.read ? n : { ...n, read: true })));
}

export function addNotification(item) {
  if (!item?.id) return;
  if (!getNotificationChannelEnabled('bell', categoryForNotification(item))) return;
  if (loadIdSet(DISMISSED_KEY).has(item.id)) return;
  const items = readStored();
  // Avoid duplicates by checking id
  if (items.some((n) => n.id === item.id)) return;
  items.push(item);
  saveNotifications(items);
}

/** Delete one item from the bell for good (seeders won't re-add it). */
export function dismissNotification(id) {
  if (!id) return;
  addToIdSet(DISMISSED_KEY, [id]);
  saveNotifications(readStored());
}

export function removeNotificationById(id) {
  if (!id) return;
  const items = readStored();
  const filtered = items.filter((n) => n.id !== id);
  if (filtered.length !== items.length) saveNotifications(filtered);
}

export function removeNotificationsByTitle(title) {
  if (!title) return;
  const items = readStored();
  const filtered = items.filter((n) => !(n.type === 'notice' && n.body === title));
  if (filtered.length !== items.length) saveNotifications(filtered);
}

// ─── Native device (browser/OS) notifications ───

function getNativeShownIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(getUserScopedKey(NATIVE_SHOWN_KEY)) || '[]'));
  } catch {
    return new Set();
  }
}

function saveNativeShownIds(ids) {
  try {
    localStorage.setItem(getUserScopedKey(NATIVE_SHOWN_KEY), JSON.stringify([...ids]));
  } catch {
    // storage full – silently fail
  }
}

/**
 * Show a native OS/browser notification for an in-app notification.
 * Each notification id is shown only once. Requests permission if not yet decided.
 * @param {Object} item - AppNotification shape ({ id, title, body })
 */
export function showNativeNotification(item) {
  const category = categoryForNotification(item);
  if (!getNotificationChannelEnabled('browser', category)) return;
  // The server already pushed this one to this device (works with the app closed).
  if (isServerPushedOnThisDevice(category)) return;
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  // A chat message while the app is on screen is already visible in the app.
  if (category === 'messages' && document.visibilityState === 'visible') return;
  const shown = getNativeShownIds();
  if (shown.has(item.id)) return;

  const fire = () => {
    // Mark first so the 5s poll can't fire the same item twice while the
    // service worker is still resolving.
    const next = getNativeShownIds();
    next.add(item.id);
    saveNativeShownIds(next);
    showDeviceNotification(item.title || 'AUSTWise', {
      body: item.body || '',
      tag: item.id,
      url: item.path || '/',
    }).catch(() => { /* native notifications unavailable */ });
  };

  if (Notification.permission === 'granted') {
    fire();
  } else if (Notification.permission !== 'denied') {
    try {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') fire();
      });
    } catch {
      // older browsers may throw – ignore
    }
  }
}

/** Clear the bell. Everything currently in it is tombstoned so the periodic
 *  seeders don't immediately put it back. */
export function clearAllNotifications() {
  const items = readStored();
  addToIdSet(DISMISSED_KEY, items.map((n) => n.id));
  try { localStorage.setItem(getUserScopedKey(NOTIFS_KEY), '[]'); } catch { /* ignore */ }
  try { localStorage.removeItem(NOTIFS_KEY); } catch { /* legacy unscoped key */ }
}

// ─── ID generator ───

let _counter = Date.now();

export function makeNotifId(prefix = 'n') {
  _counter += 1;
  return `${prefix}-${_counter}`;
}

// ─── Seed from data sources (call on mount) ───

/**
 * Best post time for a notice: exact `createdAt`, else the ms timestamp
 * baked into CR/SR ids (`cr-<ms>-xxxx`), else the date at *local* midnight.
 * A bare 'YYYY-MM-DD' must not go through Date() — it parses as UTC.
 */
function noticeTimestamp(notice) {
  const created = notice.createdAt ? new Date(notice.createdAt).getTime() : NaN;
  if (Number.isFinite(created)) return created;
  const fromId = /^cr-(\d{12,14})-/.exec(String(notice.id || ''));
  if (fromId) return Number(fromId[1]);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(notice.date || ''));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  const parsed = notice.date ? new Date(notice.date).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function seedFromNotices(notices, user) {
  if (!notices || !notices.length) return;
  const sourceIds = new Set(notices.map((notice) => `notice-${notice.id}`));
  const visibleNotices = notices.filter((notice) => noticeScopeMatchesUser(notice.scope, user));
  const visibleIds = new Set(visibleNotices.map((notice) => `notice-${notice.id}`));
  const existing = loadNotifications().filter((item) =>
    !(item.type === 'notice' && sourceIds.has(item.id) && !visibleIds.has(item.id))
  );
  const existingIds = new Set(existing.map((n) => n.id));

  visibleNotices.forEach((notice) => {
    if (!getNotificationChannelEnabled('bell', 'notices')) return;
    const id = `notice-${notice.id}`;
    const timestamp = noticeTimestamp(notice);
    const actor = {
      actorName: notice.postedByName || '',
      avatar: notice.postedByAvatar || null,
    };
    if (existingIds.has(id)) {
      // Repair items saved before exact times / poster photos existed.
      const item = existing.find((n) => n.id === id);
      if (item) {
        item.timestamp = timestamp;
        if (actor.actorName) item.actorName = actor.actorName;
        if (actor.avatar) item.avatar = actor.avatar;
      }
      return;
    }
    existing.push({
      id,
      title: notice.title || 'New Notice',
      body: notice.content?.slice(0, 120) || '',
      type: 'notice',
      icon: 'BellRing',
      path: '/',
      timestamp,
      read: false,
      priority: notice.pinned ? 'high' : 'medium',
      ...actor,
    });
  });

  saveNotifications(existing);
}

export function seedFromDeadlines(deadlines) {
  if (!deadlines || !deadlines.length) return;
  const existing = loadNotifications();
  const existingIds = new Set(existing.map((n) => n.id));

  deadlines.forEach((dl) => {
    if (!getNotificationChannelEnabled('bell', 'deadlines')) return;
    const due = dl.dueDate ? new Date(dl.dueDate).getTime() : Date.now();
    const now = Date.now();
    const diff = due - now;
    // Only generate for upcoming deadlines within 48h or passed within 1h
    if (diff < -3600000) return; // passed more than 1h ago

    const id = `deadline-${dl.id}`;
    if (existingIds.has(id)) return;
    existing.push({
      id,
      title: dl.course ? `${dl.course} Deadline` : 'Deadline Approaching',
      body: dl.title || 'Assignment due',
      type: 'deadline',
      icon: diff < 0 ? 'AlertTriangle' : 'Hourglass',
      path: '/',
      timestamp: due,
      read: false,
      priority: diff < 7200000 ? 'high' : diff < 86400000 ? 'medium' : 'low',
    });
  });

  saveNotifications(existing);
}

export function seedFromTasks(tasks) {
  if (!tasks || !tasks.length) return;
  const existing = loadNotifications();
  const existingIds = new Set(existing.map((n) => n.id));

  tasks.forEach((task) => {
    if (!getNotificationChannelEnabled('bell', 'tasks')) return;
    const taskDate = new Date(task.date);
    if (task.time) {
      const [h, m] = task.time.split(':');
      taskDate.setHours(parseInt(h, 10), parseInt(m, 10), 0);
    } else {
      taskDate.setHours(23, 59);
    }
    const now = Date.now();
    const diff = taskDate.getTime() - now;
    if (diff < -3600000) return; // passed more than 1h ago

    const id = `task-${task.id}`;
    if (existingIds.has(id)) return;
    existing.push({
      id,
      title: `Task: ${task.title}`,
      body: task.courseCode || task.courseName || 'General',
      type: 'task',
      icon: 'CalendarCheck',
      path: '/',
      timestamp: taskDate.getTime(),
      read: false,
      priority: diff < 7200000 ? 'high' : 'medium',
    });
  });

  saveNotifications(existing);
}

export function seedFromRoleApplications(applications) {
  if (!applications || !applications.length) return;
  const existing = loadNotifications();
  const existingIds = new Set(existing.map((n) => n.id));

  applications.forEach((app) => {
    if (!getNotificationChannelEnabled('bell', 'applications')) return;
    if (app.status !== 'pending') return;
    const id = `roleapp-${app.id}`;
    if (existingIds.has(id)) return;
    const isCr = app.appliedRole === 'cr';
    existing.push({
      id,
      title: `New ${isCr ? 'CR' : 'SR'} application`,
      body: `${app.userName} applied for ${isCr ? 'Class Representative' : 'Student Representative'} (${app.userDepartment} · Sem ${app.userSemester}).`,
      type: 'info',
      category: 'applications',
      icon: 'Users',
      path: '/admin/applications',
      timestamp: new Date(app.createdAt).getTime() || Date.now(),
      read: false,
      priority: 'high',
    });
  });

  saveNotifications(existing);
}

