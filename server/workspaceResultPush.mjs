/**
 * Web Push for Workspace (Google Classroom) posts and materials that mention
 * marks / result / grade.
 *
 * The server can't read Classroom itself — the Google token only lives in the
 * user's browser — so the client detects the post and calls this. A user can
 * only ever push to their own devices, so the payload is just trimmed text and
 * a fixed in-app URL; it never carries a link the client chose.
 */
import { sendPushToUser } from './webPush.mjs';

const MAX_ITEMS = 10;
const DEDUPE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_REMEMBERED = 5000;

// Two open tabs/devices can spot the same post; push it once per user.
const recent = new Map(); // `${userId}|${courseId}|${id}` -> sentAt

function clip(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function remember(key, now) {
  for (const [k, at] of recent) {
    if (recent.size < MAX_REMEMBERED && now - at < DEDUPE_TTL_MS) break;
    recent.delete(k);
  }
  recent.set(key, now);
}

export function normalizeResultItems(raw) {
  const list = Array.isArray(raw) ? raw.slice(0, MAX_ITEMS) : [];
  const out = [];
  for (const item of list) {
    const id = clip(item?.id, 100);
    const courseId = clip(item?.courseId, 100);
    if (!id || !courseId) continue;
    out.push({
      id,
      courseId,
      courseName: clip(item.courseName, 80) || 'Classroom',
      kind: item.kind === 'material' ? 'material' : 'post',
      body: clip(item.body, 160),
    });
  }
  return out;
}

export async function sendWorkspaceResultPush(userId, rawItems, now = Date.now()) {
  const items = normalizeResultItems(rawItems);
  let sent = 0;
  let skipped = 0;
  for (const item of items) {
    const key = `${userId}|${item.courseId}|${item.id}`;
    const at = recent.get(key);
    if (at && now - at < DEDUPE_TTL_MS) { skipped += 1; continue; }
    remember(key, now);
    const result = await sendPushToUser(userId, {
      title: `📊 ${item.courseName}: marks / result posted`,
      body: item.body || `New ${item.kind} about marks or results`,
      tag: `ws-result-${item.courseId}-${item.id}`,
      url: '/workspace',
      category: 'results',
    });
    sent += result?.sent || 0;
  }
  return { success: true, items: items.length, skipped, sent };
}

/** Test hook. */
export function _resetWorkspaceResultDedupe() {
  recent.clear();
}
