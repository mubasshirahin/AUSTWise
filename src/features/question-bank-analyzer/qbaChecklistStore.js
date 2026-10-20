/**
 * QBA checklist — server-synced store.
 *
 * One key per course in the existing per-user store:
 *   /api/store/user/aust-qba-checklist-v1:<course-slug>
 *
 * Shape stored on the server:
 *   {
 *     version: 1,
 *     updatedAt: ISO string,
 *     items: { [questionId]: { solved: boolean, updatedAt: ISO string } }
 *   }
 *
 * A small localStorage copy is kept as an offline fallback. It only holds
 * ids and timestamps (a few bytes per question), never pictures or Markdown.
 */

import { pruneChecklistItems } from './qbaChecklist';

export const CHECKLIST_STORE_PREFIX = 'aust-qba-checklist-v1';

const CACHE_PREFIX = 'aust-qba-checklist-cache-v1:';
const MAX_ITEMS = 5000;

function serverKey(courseKey) {
  return `${CHECKLIST_STORE_PREFIX}:${courseKey || 'default'}`;
}

function sanitizeItems(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const items = {};
  let count = 0;
  Object.entries(value).forEach(([id, item]) => {
    if (count >= MAX_ITEMS) return;
    if (!item || typeof item !== 'object') return;
    items[id] = {
      solved: Boolean(item.solved),
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : '',
    };
    count += 1;
  });
  return items;
}

/* ── server ──────────────────────────────────────────────────────────────── */

/**
 * Load this course's checklist from the server.
 * @returns {Promise<Record<string, { solved: boolean, updatedAt: string }>>}
 */
export async function getChecklistFromServer(courseKey) {
  const res = await fetch(`/api/store/user/${encodeURIComponent(serverKey(courseKey))}`, {
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error(`Checklist could not be loaded (HTTP ${res.status}).`);
  const json = await res.json();
  const value = json?.value;
  // Accept both the versioned wrapper and a bare id map.
  const raw = value && typeof value === 'object' && value.items ? value.items : value;
  return pruneChecklistItems(sanitizeItems(raw));
}

/**
 * Replace this course's checklist on the server.
 * @returns {Promise<boolean>} true when the server accepted it.
 */
export async function saveChecklistToServer(courseKey, items) {
  const clean = pruneChecklistItems(sanitizeItems(items));
  const res = await fetch(`/api/store/user/${encodeURIComponent(serverKey(courseKey))}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      value: {
        version: 1,
        updatedAt: new Date().toISOString(),
        items: clean,
      },
    }),
  });
  return res.ok;
}

/* ── offline cache ───────────────────────────────────────────────────────── */

export function readChecklistCache(courseKey) {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${courseKey || 'default'}`);
    if (!raw) return {};
    return pruneChecklistItems(sanitizeItems(JSON.parse(raw)));
  } catch {
    return {};
  }
}

export function writeChecklistCache(courseKey, items) {
  try {
    const clean = pruneChecklistItems(sanitizeItems(items));
    localStorage.setItem(`${CACHE_PREFIX}${courseKey || 'default'}`, JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}

export function clearChecklistCache(courseKey) {
  try {
    localStorage.removeItem(`${CACHE_PREFIX}${courseKey || 'default'}`);
  } catch {
    /* storage may be disabled */
  }
}
