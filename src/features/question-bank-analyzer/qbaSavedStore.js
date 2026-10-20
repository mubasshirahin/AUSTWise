/**
 * QBA Saved Analyses — server-synced store.
 *
 * Uses /api/store/user/aust-qba-saved-v1 (GET / PUT) so every saved analysis
 * lives in the database, is tied to the logged-in user, and survives deploys.
 *
 * Shape stored: Array<SavedEntry> (newest first, capped at MAX_ENTRIES).
 *
 * Each entry:
 *   id          – unique string (timestamp-random)
 *   savedAt     – ISO date string
 *   courseCode  – string
 *   courseTitle – string
 *   displayData – full analysed object (topics, summary, …)
 */

const STORE_KEY   = 'aust-qba-saved-v1';
const MAX_ENTRIES = 20;

/* ── API helpers ─────────────────────────────────────────────────────────── */

async function fetchEntries() {
  const res = await fetch(`/api/store/user/${encodeURIComponent(STORE_KEY)}`, {
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error(`Saved analyses could not be loaded (HTTP ${res.status}).`);
  const json = await res.json();
  return Array.isArray(json.value) ? json.value : [];
}

async function persistEntries(entries) {
  const res = await fetch(`/api/store/user/${encodeURIComponent(STORE_KEY)}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: entries }),
  });
  // fetch() does not reject on HTTP errors — without this check a 401/500
  // would be reported to the student as a successful save.
  if (!res.ok) throw new Error(`Saved analyses could not be stored (HTTP ${res.status}).`);
}

/* ── Public API ──────────────────────────────────────────────────────────── */

/**
 * Load all saved analyses for the current user (newest first).
 * @returns {Promise<Array>}
 */
export async function getSavedAnalyses() {
  return fetchEntries();
}

/**
 * Save a new analysis for the current user.
 * Returns the new entry on success, null on failure.
 *
 * @param {{ courseCode: string, courseTitle: string, displayData: object }} param
 * @returns {Promise<object|null>}
 */
export async function saveAnalysis({ courseCode, courseTitle, displayData }) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
    courseCode: String(courseCode || '').trim(),
    courseTitle: String(courseTitle || '').trim(),
    displayData,
  };
  try {
    const existing = await fetchEntries();
    const updated  = [entry, ...existing].slice(0, MAX_ENTRIES);
    await persistEntries(updated);
    return entry;
  } catch {
    return null;
  }
}

/**
 * Delete a saved entry by id.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteAnalysis(id) {
  try {
    const existing = await fetchEntries();
    const filtered  = existing.filter((e) => e.id !== id);
    if (filtered.length === existing.length) return false;
    await persistEntries(filtered);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete all saved analyses for the current user.
 * @returns {Promise<boolean>} true when the server accepted the change.
 */
export async function clearAllAnalyses() {
  try {
    await persistEntries([]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format a savedAt ISO string into a human-readable relative label.
 * @param {string} isoString
 * @returns {string}
 */
export function formatSavedAt(isoString) {
  try {
    const date    = new Date(isoString);
    const now     = new Date();
    const diffMs  = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr  = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60)   return 'just now';
    if (diffMin < 60)   return `${diffMin} min ago`;
    if (diffHr  < 24)   return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
    if (diffDay === 1)  return 'yesterday';
    if (diffDay < 7)    return `${diffDay} days ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}
