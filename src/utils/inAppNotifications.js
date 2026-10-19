const NOTIFS_KEY = 'aust-inapp-notifs-v1';
const NATIVE_SHOWN_KEY = 'aust-inapp-notifs-native-v1';

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

export function loadNotifications() {
  try {
    const raw = localStorage.getItem(getUserScopedKey(NOTIFS_KEY));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveNotifications(items) {
  try {
    // Keep max 200 notifications
    const sorted = items.slice(-200);
    localStorage.setItem(getUserScopedKey(NOTIFS_KEY), JSON.stringify(sorted));
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
  const items = loadNotifications();
  const idx = items.findIndex((n) => n.id === id);
  if (idx !== -1) {
    items[idx].read = true;
    saveNotifications(items);
  }
}

export function markAllAsRead() {
  const items = loadNotifications();
  let changed = false;
  items.forEach((n) => {
    if (!n.read) {
      n.read = true;
      changed = true;
    }
  });
  if (changed) saveNotifications(items);
}

export function addNotification(item) {
  const items = loadNotifications();
  // Avoid duplicates by checking id
  if (items.some((n) => n.id === item.id)) return;
  items.push(item);
  saveNotifications(items);
}

export function removeNotificationById(id) {
  if (!id) return;
  const items = loadNotifications();
  const filtered = items.filter((n) => n.id !== id);
  if (filtered.length !== items.length) saveNotifications(filtered);
}

export function removeNotificationsByTitle(title) {
  if (!title) return;
  const items = loadNotifications();
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
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  const shown = getNativeShownIds();
  if (shown.has(item.id)) return;

  const title = item.title || 'AUSTWise';
  const body = item.body || '';
  const options = {
    body,
    tag: item.id,
    icon: '/icon-192x192.png',
  };

  const fire = () => {
    try {
      new Notification(title, options);
      const next = getNativeShownIds();
      next.add(item.id);
      saveNativeShownIds(next);
    } catch {
      // ignore – native notifications unavailable
    }
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

export function clearAllNotifications() {
  localStorage.removeItem(NOTIFS_KEY);
}

// ─── ID generator ───

let _counter = Date.now();

export function makeNotifId(prefix = 'n') {
  _counter += 1;
  return `${prefix}-${_counter}`;
}

// ─── Seed from data sources (call on mount) ───

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
    const id = `notice-${notice.id}`;
    if (existingIds.has(id)) return;
    existing.push({
      id,
      title: notice.title || 'New Notice',
      body: notice.content?.slice(0, 120) || '',
      type: 'notice',
      icon: 'BellRing',
      path: '/',
      timestamp: new Date(notice.date || notice.createdAt || Date.now()).getTime(),
      read: false,
      priority: notice.pinned ? 'high' : 'medium',
    });
  });

  saveNotifications(existing);
}

export function seedFromDeadlines(deadlines) {
  if (!deadlines || !deadlines.length) return;
  const existing = loadNotifications();
  const existingIds = new Set(existing.map((n) => n.id));

  deadlines.forEach((dl) => {
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
    if (app.status !== 'pending') return;
    const id = `roleapp-${app.id}`;
    if (existingIds.has(id)) return;
    const isCr = app.appliedRole === 'cr';
    existing.push({
      id,
      title: `New ${isCr ? 'CR' : 'SR'} application`,
      body: `${app.userName} applied for ${isCr ? 'Class Representative' : 'Student Representative'} (${app.userDepartment} · Sem ${app.userSemester}).`,
      type: 'info',
      icon: 'Users',
      path: '/admin/applications',
      timestamp: new Date(app.createdAt).getTime() || Date.now(),
      read: false,
      priority: 'high',
    });
  });

  saveNotifications(existing);
}

