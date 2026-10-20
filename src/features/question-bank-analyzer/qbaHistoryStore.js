/**
 * QBA Preview History — server-synced store.
 *
 * Every successful Preview is recorded here automatically (no "Save Preview"
 * needed). The list keeps the newest 20 entries and lives in the existing
 * per-user store:
 *   /api/store/user/aust-qba-history-v1
 *
 * Each entry stores enough to reopen the preview:
 *   id, createdAt, courseCode, courseTitle, displayData, sourceText,
 *   fingerprint, topicCount, questionCount
 *
 * `displayData` is what the preview/PDF render. `sourceText` is the Markdown
 * that produced it, so "Open" can put it back in Step 3 and rebuild it.
 */

import { hashText } from './qbaChecklist';

export const HISTORY_STORE_KEY = 'aust-qba-history-v1';
export const MAX_HISTORY_ENTRIES = 20;

/** Keep the whole payload comfortably below the server body limit. */
const MAX_SERIALIZED_BYTES = 4 * 1024 * 1024;
const MAX_SOURCE_CHARS = 2_000_000;

function storeUrl() {
  return `/api/store/user/${encodeURIComponent(HISTORY_STORE_KEY)}`;
}

function sanitizeEntries(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id : '',
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
      courseCode: typeof entry.courseCode === 'string' ? entry.courseCode : '',
      courseTitle: typeof entry.courseTitle === 'string' ? entry.courseTitle : '',
      displayData: entry.displayData && typeof entry.displayData === 'object'
        ? entry.displayData
        : { topics: [] },
      sourceText: typeof entry.sourceText === 'string' ? entry.sourceText : '',
      fingerprint: typeof entry.fingerprint === 'string' ? entry.fingerprint : '',
      topicCount: Number.isFinite(entry.topicCount) ? entry.topicCount : 0,
      questionCount: Number.isFinite(entry.questionCount) ? entry.questionCount : 0,
    }))
    .filter((entry) => entry.id)
    .slice(0, MAX_HISTORY_ENTRIES);
}

function buildFingerprint({ courseCode, courseTitle, displayData }) {
  const signature = JSON.stringify({
    courseCode: String(courseCode || '').trim(),
    courseTitle: String(courseTitle || '').trim(),
    topics: displayData?.topics || [],
    semesterPapers: displayData?.semesterPapers || [],
    studyPlan: displayData?.studyPlan || [],
  });
  return hashText(signature);
}

function trimBySize(entries) {
  const next = [...entries];
  while (next.length > 1 && JSON.stringify(next).length > MAX_SERIALIZED_BYTES) {
    next.pop();
  }
  return next;
}

async function fetchEntries() {
  const res = await fetch(storeUrl(), { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Preview history could not be loaded (HTTP ${res.status}).`);
  const json = await res.json();
  return sanitizeEntries(json?.value);
}

async function persistEntries(entries) {
  const res = await fetch(storeUrl(), {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: entries }),
  });
  return res.ok;
}

/**
 * Load the last 20 previews, newest first.
 * @returns {Promise<Array>}
 */
export async function getPreviewHistory() {
  return fetchEntries();
}

/**
 * Record a preview automatically. Repeating the same preview only refreshes
 * the timestamp instead of adding a duplicate.
 *
 * @returns {Promise<object|null>} the stored entry, or null on failure.
 */
export async function recordPreviewHistory({
  courseCode,
  courseTitle,
  displayData,
  sourceText = '',
}) {
  if (!displayData || !Array.isArray(displayData.topics) || !displayData.topics.length) {
    return null;
  }

  try {
    const existing = await fetchEntries();
    const fingerprint = buildFingerprint({ courseCode, courseTitle, displayData });
    const now = new Date().toISOString();
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      courseCode: String(courseCode || '').trim(),
      courseTitle: String(courseTitle || '').trim(),
      displayData,
      sourceText: String(sourceText || '').slice(0, MAX_SOURCE_CHARS),
      fingerprint,
      topicCount: displayData.topics.length,
      questionCount: Number(displayData.summary?.totalQuestions) || 0,
    };

    const sameAsLatest = existing.length
      && existing[0].fingerprint
      && existing[0].fingerprint === fingerprint;

    const updated = sameAsLatest
      ? [{ ...entry, id: existing[0].id }, ...existing.slice(1)]
      : [entry, ...existing];

    const capped = trimBySize(updated.slice(0, MAX_HISTORY_ENTRIES));
    const ok = await persistEntries(capped);
    return ok ? (sameAsLatest ? updated[0] : entry) : null;
  } catch {
    return null;
  }
}

/**
 * Remove one preview from the history.
 * @returns {Promise<boolean>}
 */
export async function deletePreviewHistoryEntry(id) {
  try {
    const existing = await fetchEntries();
    const filtered = existing.filter((entry) => entry.id !== id);
    if (filtered.length === existing.length) return false;
    return await persistEntries(filtered);
  } catch {
    return false;
  }
}

/**
 * Remove every preview from the history.
 * @returns {Promise<boolean>}
 */
export async function clearPreviewHistory() {
  try {
    return await persistEntries([]);
  } catch {
    return false;
  }
}
