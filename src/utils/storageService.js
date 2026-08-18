/**
 * Cross-device storage service — replaces localStorage with server-side KV store.
 *
 * Usage:
 *   import { userStore, sharedStore } from './storageService';
 *
 *   // Per-user (like localStorage but synced across devices)
 *   const data = await userStore.get('aust-course-reviews');
 *   await userStore.set('aust-course-reviews', reviews);
 *   await userStore.del('aust-course-reviews');
 *
 *   // Shared (visible to all users, synced in real-time)
 *   const notices = await sharedStore.get('aust-notices');
 *   await sharedStore.set('aust-notices', notices);
 */

const USER_PREFIX = '/api/store/user/';
const SHARED_PREFIX = '/api/store/shared/';
const MIGRATE_URL = '/api/store/migrate';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function apiGet(url) {
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.success ? data.value : null;
  } catch {
    return null;
  }
}

async function apiPut(url, value) {
  try {
    const res = await fetch(url, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function apiDelete(url) {
  try {
    const res = await fetch(url, { method: 'DELETE', credentials: 'same-origin' });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Per-user store ───────────────────────────────────────────────────────────

export const userStore = {
  /** Get a value by key. Returns parsed JSON or null. */
  async get(key) {
    return apiGet(USER_PREFIX + encodeURIComponent(key));
  },

  /** Set a value by key. Accepts any JSON-serializable value. */
  async set(key, value) {
    return apiPut(USER_PREFIX + encodeURIComponent(key), value);
  },

  /** Delete a value by key. */
  async del(key) {
    return apiDelete(USER_PREFIX + encodeURIComponent(key));
  },

  /** List all keys for the current user. */
  async keys() {
    try {
      const res = await fetch(USER_PREFIX.slice(0, -1), { credentials: 'same-origin' });
      if (!res.ok) return [];
      const data = await res.json();
      return data?.success ? data.keys : [];
    } catch {
      return [];
    }
  },
};

// ── Shared (global) store ────────────────────────────────────────────────────

export const sharedStore = {
  /** Get a shared value by key. Returns parsed JSON or null. */
  async get(key) {
    return apiGet(SHARED_PREFIX + encodeURIComponent(key));
  },

  /** Set a shared value by key. Triggers broadcast to all devices. */
  async set(key, value) {
    return apiPut(SHARED_PREFIX + encodeURIComponent(key), value);
  },

  /** Delete a shared value by key. */
  async del(key) {
    return apiDelete(SHARED_PREFIX + encodeURIComponent(key));
  },
};

// ── Migration helper ─────────────────────────────────────────────────────────

/**
 * Migrate all localStorage keys to the server.
 * Call once on login. Skips keys that are already synced.
 *
 * @param {string} userId - Current user's ID
 * @param {string[]} userKeys - localStorage keys that belong to the user
 * @param {string[]} sharedKeys - localStorage keys that are shared across users
 */
export async function migrateLocalStorageToServer(userId, userKeys = [], sharedEntries = {}) {
  if (!userId) return;

  const userEntries = {};
  for (const key of userKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        userEntries[key] = JSON.parse(raw);
      }
    } catch {
      // skip non-JSON values
    }
  }

  if (Object.keys(userEntries).length === 0 && Object.keys(sharedEntries).length === 0) {
    return;
  }

  try {
    await fetch(MIGRATE_URL, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEntries, sharedEntries }),
    });
  } catch {
    // best-effort — localStorage stays as fallback
  }
}

// ── localStorage ↔ server sync (for items still using localStorage) ──────────

/**
 * Read from localStorage, falling back to server if key is missing locally.
 * Useful during migration — keeps localStorage as cache.
 */
export async function readWithFallback(key, isShared = false) {
  // Try localStorage first (fast)
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw);
  } catch { /* fall through */ }

  // Fall back to server
  const serverValue = isShared
    ? await sharedStore.get(key)
    : await userStore.get(key);
  if (serverValue !== null) {
    // Cache locally for next read
    try { localStorage.setItem(key, JSON.stringify(serverValue)); } catch { /* ignore */ }
  }
  return serverValue;
}

/**
 * Write to both localStorage and server (dual-write during migration).
 */
export async function writeDual(key, value, isShared = false) {
  // Always write to localStorage (instant, offline-safe)
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }

  // Also push to server (async, best-effort)
  if (isShared) {
    await sharedStore.set(key, value);
  } else {
    await userStore.set(key, value);
  }
}

// ── React-compatible async storage ───────────────────────────────────────────

/**
 * Read a shared store value with localStorage-first caching.
 * Returns { data, loading } — call from useState initializer + useEffect.
 *
 * Usage:
 *   const [canteenData, setCanteenData] = useState(() => loadSharedSync('aust-canteen-data', fallback));
 *   useEffect(() => { loadSharedAsync('aust-canteen-data', fallback).then(setCanteenData); }, []);
 */
/** Read a per-user store value with localStorage-first caching (synchronous, for useState initializers). */
export function loadUserSync(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw);
  } catch { /* ignore */ }
  return fallback;
}

export function loadSharedSync(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw);
  } catch { /* ignore */ }
  return fallback;
}

export async function loadSharedAsync(key, fallback = null) {
  const serverValue = await sharedStore.get(key);
  if (serverValue !== null) {
    try { localStorage.setItem(key, JSON.stringify(serverValue)); } catch { /* ignore */ }
    return serverValue;
  }
  return fallback;
}

export async function saveShared(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  await sharedStore.set(key, value);
}

// ── Auto-migration: localStorage → server on login ──────────────────────────

/**
 * Keys that should be synced to the server.
 * userKeys: per-user data (each user has their own copy)
 * sharedKeys: global data (same for all users)
 */
const MIGRATION_KEYS = {
  userKeys: [
    'aust-syllabus-progress',
    'aust-tracker-sem-' , // prefix — skip, handled per-user
    'aust-course-reviews',
    'aust-course-polls',
    'aust-cheatsheets',
    'aust-question-bank',
    'aust-vault-courses',
    'aust-vault-batches',
    'aust-media-tracker',
    'aust-transcript-templates',
    'aust-routine-templates',
    'aust-cover-page-form',
    'aust-user-routine',
    'aust-user-weekdays',
  ],
  sharedKeys: [
    'aust-marketplace-v1',
    'aust-canteen-data',
    'aust-notices',
    'aust-library-data',
  ],
};

let _migrationDone = false;

/**
 * Sync localStorage data to the server on login.
 * For each key: if server has no data, push localStorage copy.
 * If server has data, pull it down (server wins).
 * Runs once per page load.
 */
export async function runMigrationOnLogin(userId) {
  if (_migrationDone || !userId) return;
  _migrationDone = true;

  // Migrate per-user keys. Most are written under the bare key (server-first
  // cache). Some older features wrote a `${key}-${userId}` variant (localStorage
  // user-scoped keys) — pick that up too and push it to the server under the
  // bare key so reads from any device agree on one canonical name.
  const userEntries = {};
  for (const key of MIGRATION_KEYS.userKeys) {
    try {
      let raw = localStorage.getItem(key);
      if (raw === null) raw = localStorage.getItem(`${key}-${userId}`);
      if (raw !== null) {
        userEntries[key] = JSON.parse(raw);
      }
    } catch { /* skip non-JSON */ }
  }

  // Migrate shared keys
  const sharedEntries = {};
  for (const key of MIGRATION_KEYS.sharedKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        sharedEntries[key] = JSON.parse(raw);
      }
    } catch { /* skip non-JSON */ }
  }

  if (Object.keys(userEntries).length === 0 && Object.keys(sharedEntries).length === 0) {
    return; // nothing to migrate
  }

  try {
    await fetch(MIGRATE_URL, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEntries, sharedEntries }),
    });
  } catch {
    // best-effort — localStorage stays as fallback
  }
}
