/**
 * Workspace "marks / result / grade" alerts.
 *
 * Classroom data never reaches our server: the Google token lives only in this
 * browser (workspace_accounts in localStorage). So the check runs here — on a
 * timer from the navbar and whenever a course stream is opened — and the
 * server is only asked to fan the alert out as Web Push to the user's devices.
 */
import { addNotification, showNativeNotification, getNotificationChannelEnabled } from '../../utils/inAppNotifications';

const ACCOUNTS_KEY = 'workspace_accounts';
const SEEN_KEY = 'workspace_result_alerts_v1';
const API_BASE = 'https://classroom.googleapis.com/v1';
const MATERIALS_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
];
// Only recent posts alert — the first run must not dump a semester of old results.
export const RESULT_ALERT_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_SEEN = 400;

// Whole words only, so "remark", "bookmark", "upgrade" and "resulted" don't match.
// A bare "mark" is too common ("mark your attendance"), so it only counts after
// an assessment word ("CT-2 mark", "quiz mark").
const RESULT_PATTERNS = [
  /\b(?:marks|marksheet|mark\s*sheet|results?|grades?|graded|grade\s*sheet|gradesheet)\b/i,
  /\b(?:ct|quiz|mid|midterm|final|lab|viva|assignment|class\s*test)\s*-?\s*\d*\s+mark\b/i,
  // No bare "মার্ক" — it is also the start of মার্কেট (market).
  /মার্কস|ফলাফল|রেজাল্ট|গ্রেড/,
];

function materialTitles(materials) {
  return (Array.isArray(materials) ? materials : []).map((m) =>
    m?.driveFile?.driveFile?.title || m?.link?.title || m?.youtubeVideo?.title || m?.form?.title || '');
}

/** Everything a student would read on the card: post text, title, description, attachment names. */
export function resultPostText(item) {
  if (!item) return '';
  return [item.text, item.title, item.description, ...materialTitles(item.materials)]
    .filter((s) => typeof s === 'string' && s.trim())
    .join('\n');
}

export function isResultPost(item) {
  const text = resultPostText(item);
  return Boolean(text) && RESULT_PATTERNS.some((re) => re.test(text));
}

function postTime(item) {
  const t = Date.parse(item?.updateTime || item?.creationTime || '');
  return Number.isFinite(t) ? t : 0;
}

export function resultAlertKey(item) {
  return `${item?.courseId || ''}:${item?.id || ''}`;
}

/**
 * Posts that should alert now: mention marks/result/grade, are recent, are
 * published, and haven't alerted before. Pure — `seen` is not modified.
 */
export function pickNewResultPosts(items, seen, now = Date.now()) {
  const out = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (!item?.id || !item?.courseId) continue;
    if (item.state && item.state !== 'PUBLISHED') continue;
    if (seen.has(resultAlertKey(item))) continue;
    const t = postTime(item);
    if (!t || now - t > RESULT_ALERT_MAX_AGE_MS) continue;
    if (!isResultPost(item)) continue;
    out.push(item);
  }
  return out;
}

function loadSeen() {
  try {
    const list = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

function saveSeen(seen) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-MAX_SEEN)));
  } catch { /* storage full — worst case an alert repeats */ }
}

function snippet(item) {
  const text = String(item.text || item.title || item.description || '').replace(/\s+/g, ' ').trim();
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

function toAlert(item, courseName) {
  const kind = item._itemType === 'material' ? 'material' : 'post';
  return {
    id: String(item.id),
    courseId: String(item.courseId),
    courseName: courseName || 'Classroom',
    kind,
    body: snippet(item) || `New ${kind} about marks or results`,
  };
}

async function pushToDevices(alerts) {
  try {
    await fetch('/api/web-push/workspace-results', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: alerts }),
    });
  } catch { /* offline — the bell entry still shows it */ }
}

/**
 * Alert about any new marks/result/grade posts in `items` (announcements and
 * course materials of one course). Safe to call repeatedly with the same list.
 */
export async function alertResultPosts(items, courseName, now = Date.now()) {
  if (!getNotificationChannelEnabled('browser', 'results') && !getNotificationChannelEnabled('bell', 'results')) return 0;
  const seen = loadSeen();
  const fresh = pickNewResultPosts(items, seen, now);
  if (!fresh.length) return 0;
  for (const item of fresh) seen.add(resultAlertKey(item));
  saveSeen(seen);

  const alerts = fresh.map((item) => toAlert(item, courseName));
  for (const a of alerts) {
    const notif = {
      id: `ws-result-${a.courseId}-${a.id}`,
      title: `${a.courseName}: marks / result posted`,
      body: a.body,
      type: 'info',
      category: 'results',
      icon: 'GraduationCap',
      path: '/workspace',
      timestamp: now,
      read: false,
      priority: 'high',
    };
    addNotification(notif);
    // Skipped automatically when this device already gets it as server push.
    showNativeNotification(notif);
  }
  await pushToDevices(alerts);
  return alerts.length;
}

function loadAccounts() {
  try {
    const list = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function fetchList(path, token, field) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data[field]) ? data[field] : [];
}

let scanning = false;

/**
 * Check the latest posts + materials of every selected course, using only
 * still-valid tokens (never opens a Google popup). Returns alerts sent.
 */
export async function scanWorkspaceForResults(now = Date.now()) {
  if (scanning) return 0;
  scanning = true;
  try {
    const jobs = [];
    for (const acc of loadAccounts()) {
      if (!acc?.accessToken || !acc.expiresAt || now >= acc.expiresAt - 60000) continue;
      if (Array.isArray(acc.grantedScopes) && !MATERIALS_SCOPES.every((s) => acc.grantedScopes.includes(s))) continue;
      const selected = new Set(acc.selectedCourseIds || []);
      for (const c of acc.courses || []) {
        if (selected.has(c.id)) jobs.push({ token: acc.accessToken, course: c });
      }
    }
    let total = 0;
    for (let i = 0; i < jobs.length; i += 4) {
      const batch = await Promise.all(jobs.slice(i, i + 4).map(async ({ token, course }) => {
        try {
          const id = encodeURIComponent(course.id);
          const [posts, materials] = await Promise.all([
            fetchList(`/courses/${id}/announcements?pageSize=10`, token, 'announcements'),
            fetchList(`/courses/${id}/courseWorkMaterials?pageSize=10`, token, 'courseWorkMaterial'),
          ]);
          const items = [
            ...posts.map((p) => ({ ...p, _itemType: 'announcement' })),
            ...materials.map((m) => ({ ...m, _itemType: 'material' })),
          ];
          return await alertResultPosts(items, course.name, now);
        } catch {
          return 0;
        }
      }));
      total += batch.reduce((sum, n) => sum + n, 0);
    }
    return total;
  } finally {
    scanning = false;
  }
}
