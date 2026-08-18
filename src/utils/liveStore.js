/**
 * liveStore — real-time, cross-device key-value store for user data.
 *
 * Replaces direct localStorage reads/writes for user-generated data so that
 * the same account sees its data on every device without a manual refresh:
 *
 *   - Values are persisted server-side (userStore for per-user data,
 *     sharedStore for global data) via the existing /api/store/* endpoints.
 *   - A single shared WebSocket listens for `store-change` events and
 *     re-fetches any key that another device changed, updating this device
 *     instantly.
 *   - localStorage is kept as a cache only: reads are seeded from it for
 *     instant paint, then reconciled with the server.
 *
 * Usage:
 *   import { useLiveValue } from '../utils/liveStore';
 *
 *   const [tasks, setTasks, delTasks] = useLiveValue('user', 'aust-week-tasks', []);
 *   // setTasks(next)      → writes to localStorage + server, notifies all devices
 *   // delTasks()          → removes the key everywhere
 *
 * Call initLiveStore(user.id) once after login (see AuthContext).
 */

import { useEffect, useState, useRef } from 'react';
import { userStore, sharedStore } from './storageService';

const WS_RECONNECT_DELAY = 2000;
const WS_MAX_RECONNECT_DELAY = 15000;
const PING_INTERVAL = 30000;

// ── Module-level singleton state ────────────────────────────────────────────

const cache = new Map(); // `${scope}:${key}` -> value (already parsed)
const inFlight = new Set(); // `${scope}:${key}` currently being fetched
const subscribers = new Set(); // callbacks invoked on any cache change

let ws = null;
let wsUserId = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let pingTimer = null;
let stopped = false;

// Composite keys written by THIS device in the last few seconds. The server
// broadcasts our own writes back to us via store-change; skipping those echoes
// avoids reload loops and lets subscribers tell "local write" apart from
// "another device changed this key".
const localWrites = new Map(); // `${scope}:${key}` -> timestamp
const LOCAL_WRITE_TTL = 15000;

function markLocalWrite(k) {
  localWrites.set(k, Date.now());
}

function isLocalWrite(k) {
  const t = localWrites.get(k);
  if (t === undefined) return false;
  if (Date.now() - t > LOCAL_WRITE_TTL) {
    localWrites.delete(k);
    return false;
  }
  return true;
}

function emit(key, isLocal = false) {
  for (const cb of subscribers) {
    try { cb(key, isLocal); } catch { /* never let one subscriber break others */ }
  }
}

/**
 * Subscribe to any live-store change. The callback receives the composite
 * key ("user:aust-week-tasks" / "shared:aust-marketplace-v1") and an isLocal
 * flag (true when this device made the change). Returns an unsubscribe fn.
 */
export function onLiveChange(cb) {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}

function cacheKey(scope, key) {
  return `${scope}:${key}`;
}

function storeFor(scope) {
  return scope === 'shared' ? sharedStore : userStore;
}

/** Seed the cache from localStorage (instant paint) + fetch fresh from server. */
export function ensureFetched(scope, key) {
  const k = cacheKey(scope, key);
  if (cache.has(k) || inFlight.has(k)) return;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) cache.set(k, JSON.parse(raw));
  } catch { /* ignore */ }
  inFlight.add(k);
  fetchKey(scope, key);
}

/**
 * React hook — refresh derived state whenever a remote device changes one of
 * the given keys. Local writes are ignored (the caller refreshes its own state
 * after writing). `keys` may contain raw keys ("aust-week-tasks") or composite
 * keys ("user:aust-week-tasks").
 *
 *   useLiveRefresh(['aust-course-reviews-v2'], () => setReviews(buildCourseReviewList()));
 */
export function useLiveRefresh(keys, refreshFn) {
  const refreshRef = useRef(refreshFn);
  refreshRef.current = refreshFn;
  const keysRef = useRef(keys);
  keysRef.current = keys;

  useEffect(() => {
    return onLiveChange((composite, isLocal) => {
      if (isLocal) return;
      const list = Array.isArray(keysRef.current) ? keysRef.current : [keysRef.current];
      const match = list.some((k) => k === composite || k === `${String(composite).split(':')[1]}`);
      if (!match) return;
      try { refreshRef.current(); } catch { /* ignore */ }
    });
  }, []);
}

/** Fetch a key from the server and publish it locally (cache + localStorage). */
async function fetchKey(scope, key) {
  const k = cacheKey(scope, key);
  try {
    const value = await storeFor(scope).get(key);
    if (value !== null) {
      cache.set(k, value);
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
    }
  } catch { /* keep whatever we have */ }
  inFlight.delete(k);
  emit(k, false);
}

/** Write a value optimistically, then persist to the server (which broadcasts). */
export async function setLiveValue(scope, key, value) {
  const k = cacheKey(scope, key);
  markLocalWrite(k);
  cache.set(k, value);
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  emit(k, true);
  try {
    await storeFor(scope).set(key, value);
  } catch { /* offline-safe: cache + localStorage keep the value */ }
  return value;
}

/** Delete a value everywhere (server + local cache). */
export async function delLiveValue(scope, key) {
  const k = cacheKey(scope, key);
  markLocalWrite(k);
  cache.delete(k);
  try { localStorage.removeItem(key); } catch { /* ignore */ }
  emit(k, true);
  try {
    await storeFor(scope).del(key);
  } catch { /* ignore */ }
}

/** Subscribe to live changes for a key. Returns the current cached value. */
export function getLiveValue(scope, key, fallback = null) {
  const k = cacheKey(scope, key);
  return cache.has(k) ? cache.get(k) : fallback;
}

/**
 * React hook — subscribe to a live-synced key.
 * Returns [value, setValue, delValue]. The cache is seeded synchronously from
 * localStorage on first render so the UI paints instantly, then reconciled
 * with the server in the background.
 */
export function useLiveValue(scope, key, fallback = null) {
  const [, force] = useState(0);

  // Seed cache from localStorage during render (idempotent, no setState) so
  // the very first frame already shows the local value.
  if (scope && key) ensureFetched(scope, key);

  useEffect(() => {
    if (!scope || !key) return undefined;
    const onChange = () => force((n) => n + 1);
    subscribers.add(onChange);
    return () => { subscribers.delete(onChange); };
  }, [scope, key]);

  return [
    getLiveValue(scope, key, fallback),
    (valueOrFn) => {
      const next = typeof valueOrFn === 'function'
        ? valueOrFn(getLiveValue(scope, key, fallback))
        : valueOrFn;
      return setLiveValue(scope, key, next);
    },
    () => delLiveValue(scope, key),
  ];
}

// ── WebSocket connection (one shared connection for the whole app) ───────────

/** Open (or reuse) the real-time channel for a user. Idempotent per user id. */
export function initLiveStore(userId) {
  if (!userId || stopped) return;
  if (wsUserId === userId && ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  wsUserId = userId;
  connect();
}

/** Close the channel and clear cached values (call on logout). */
export function destroyLiveStore() {
  stopped = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (pingTimer) clearInterval(pingTimer);
  if (ws) { ws.onclose = null; ws.close(); ws = null; }
  wsUserId = null;
  cache.clear();
}

function connect() {
  if (stopped) return;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Production: connect directly to the backend origin (VITE_WS_URL).
  // Dev: same-origin /api/ws hits the local server.
  const wsUrl = (import.meta.env.VITE_WS_URL || `${protocol}//${window.location.host}/api/ws`);

  try {
    ws = new WebSocket(wsUrl);
  } catch {
    return;
  }

  ws.onopen = () => {
    reconnectAttempt = 0;
    ws.send(JSON.stringify({ type: 'subscribe', payload: { userId: wsUserId } }));
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', payload: {} }));
      }
    }, PING_INTERVAL);
  };

  ws.onmessage = (event) => {
    try {
      const { type, payload } = JSON.parse(event.data);
      if (type === 'store-change' && payload && (payload.scope === 'user' || payload.scope === 'shared') && payload.key) {
        // A key changed. If it was our own write (echo), skip the re-fetch —
        // the cache already has the value and subscribers were already notified
        // with isLocal=true. Otherwise a different device changed it, so pull
        // the fresh value so every device converges.
        const k = cacheKey(payload.scope, payload.key);
        if (isLocalWrite(k)) return;
        fetchKey(payload.scope, payload.key);
      }
    } catch { /* ignore malformed messages */ }
  };

  ws.onclose = () => {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    if (stopped) return;
    const delay = Math.min(WS_RECONNECT_DELAY * Math.pow(1.5, reconnectAttempt), WS_MAX_RECONNECT_DELAY);
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(connect, delay);
  };

  ws.onerror = () => { /* onclose handles reconnection */ };
}