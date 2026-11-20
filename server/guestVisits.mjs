// Guest visits ("Take a Visit" on the landing page).
//
// A visit is one browser tab browsing the app without an account. The client
// makes a random visit id and reports:
//   visit   → a new guest visit started          (counted once per id)
//   ping    → the tab is still open               (every ~30s, for "online now")
//   leave   → the tab ended the visit (logout / tab closed)
//   convert → the guest then logged in or signed up (once per visit)
//
// Totals live in the shared store (DB in production, JSON file locally) so
// they survive restarts. "Online now" is in memory only.
import { getSharedStoreValue, setSharedStoreValue } from './storeDB.mjs';

const STORE_KEY = 'system:guest-visits';
const ONLINE_WINDOW_MS = 90_000;      // seen within the last 90s = online
const MAX_TRACKED_IDS = 5000;         // ids remembered to stop double counting
const MAX_ONLINE = 10_000;            // hard cap on the in-memory online map
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** visitId -> last seen (ms) */
const online = new Map();

let state = null;                     // loaded lazily from the store
let lock = Promise.resolve();

function emptyState() {
  return { visits: 0, loggedIn: 0, signedUp: 0, ids: {}, order: [] };
}

async function load() {
  if (state) return state;
  const saved = await getSharedStoreValue(STORE_KEY, null);
  state = { ...emptyState(), ...(saved && typeof saved === 'object' ? saved : {}) };
  if (!state.ids || typeof state.ids !== 'object') state.ids = {};
  if (!Array.isArray(state.order)) state.order = [];
  return state;
}

/** Run a read-modify-write on the totals, one at a time. */
function withState(fn) {
  const task = async () => {
    const s = await load();
    const changed = fn(s);
    if (changed) await setSharedStoreValue(STORE_KEY, s, 'guest-visits');
  };
  lock = lock.then(task, task);
  return lock;
}

function rememberId(s, id, status) {
  if (!(id in s.ids)) {
    s.order.push(id);
    while (s.order.length > MAX_TRACKED_IDS) delete s.ids[s.order.shift()];
  }
  s.ids[id] = status;
}

function pruneOnline(now = Date.now()) {
  for (const [id, seen] of online) if (now - seen > ONLINE_WINDOW_MS) online.delete(id);
}

function markOnline(id) {
  if (online.size >= MAX_ONLINE && !online.has(id)) pruneOnline();
  if (online.size < MAX_ONLINE || online.has(id)) online.set(id, Date.now());
}

export function isValidVisitId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

export async function recordGuestVisit(id) {
  markOnline(id);
  await withState((s) => {
    if (id in s.ids) return false;
    s.visits += 1;
    rememberId(s, id, 'visit');
    return true;
  });
}

export function recordGuestPing(id) {
  markOnline(id);
}

export function recordGuestLeave(id) {
  online.delete(id);
}

/** kind: 'login' | 'signup'. Counts only once, and only for a recorded visit. */
export async function recordGuestConversion(id, kind) {
  online.delete(id);
  await withState((s) => {
    if (s.ids[id] !== 'visit') return false;
    if (kind === 'signup') s.signedUp += 1;
    else s.loggedIn += 1;
    s.ids[id] = kind;
    return true;
  });
}

export async function getGuestVisitStats() {
  pruneOnline();
  const s = await load();
  const onlineNow = online.size;
  return {
    onlineNow,
    visits: s.visits,
    loggedIn: s.loggedIn,
    signedUp: s.signedUp,
    // Finished visits that ended without logging in or signing up
    // (guests still browsing right now are not counted here yet).
    neither: Math.max(0, s.visits - s.loggedIn - s.signedUp - onlineNow),
  };
}
