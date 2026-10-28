import { useState, useEffect, useCallback } from 'react';
import { onRealtimeMessage } from '../utils/liveStore';

export const ROLE_ACCESS_STORAGE_BASE = 'aust-role-access-v2';

// Default config for a page that has never been configured:
//   - featureHidden: nobody is blocked (admin opts-in explicitly)
//   - statsAllowed: admins + moderators see the admin/stats view
export const DEFAULT_ROLE_ACCESS = {
  featureHidden: [],
  statsAllowed: ['admin', 'moderator'],
  enabled: true,
};

/**
 * One stable key per page. Route paths only — query string and hash are
 * ignored so a `?tab=` change never creates a separate access entry. This is
 * the SAME key used by the gate (MastheadAccessControl) and by the admin card,
 * which is what keeps them in sync.
 */
export function pageAccessKey(pageKey) {
  let p = String(
    pageKey || (typeof window !== 'undefined' ? window.location.pathname : '/') || '/',
  );
  p = p.split('?')[0].split('#')[0];
  const canonicalAliases = {
    '/gradelab': '/analytics', '/insideaust': '/campus', '/resource-vault': '/vault',
    '/connectbox': '/messages', '/question-bank': '/question-bank-analyzer',
    '/downtime': '/chill-zone', '/see-plans': '/pro', '/code-pulse': '/cp-hub',
    '/takagelokoi': '/money-tracker', '/study-time': '/study-room', '/wakemeup': '/auto-alarm',
    '/cheat-sheets': '/cheatsheets',
  };
  p = canonicalAliases[p] || p;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}

// Module-level cache so navigating between pages does not fire a fresh
// /api/role-access request on every click. Seeded synchronously from
// localStorage for instant paint, then revalidated in the background if stale.
const configCache = new Map(); // storageKey -> cfg
const fetchedAt = new Map(); // storageKey -> timestamp
const FRESH_MS = 5 * 60 * 1000;

function readStorage(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.featureHidden) && Array.isArray(parsed?.statsAllowed)) return parsed;
  } catch { /* corrupt cache — ignore */ }
  return null;
}

function isConfig(cfg) {
  return !!cfg && Array.isArray(cfg.featureHidden) && Array.isArray(cfg.statsAllowed);
}

/**
 * useRoleAccess — single source of truth for a page's role access.
 *
 * Reads the server config, mirrors it to localStorage, and stays live:
 *   - the shared WebSocket (utils/liveStore) delivers `role-access` broadcasts
 *     from the server in real time, so a change made by an admin reaches every
 *     connected device instantly,
 *   - `storage` events keep other tabs of the same browser in sync,
 *   - a same-tab CustomEvent keeps multiple hook instances in one page in sync.
 *
 * `save(next)` writes the change optimistically, POSTs it to the server
 * (admin-only) and broadcasts it to everyone.
 */
export function useRoleAccess(pageKey) {
  const key = pageAccessKey(pageKey);
  const storageKey = `${ROLE_ACCESS_STORAGE_BASE}:${key}`;

  const [config, setConfig] = useState(() => {
    const cached = configCache.get(storageKey);
    if (cached) return cached;
    const stored = typeof window !== 'undefined' ? readStorage(storageKey) : null;
    if (stored) { configCache.set(storageKey, stored); return stored; }
    return DEFAULT_ROLE_ACCESS;
  });
  const [loading, setLoading] = useState(() => !configCache.has(storageKey));

  const applyConfig = useCallback((cfg, { persistLocal = true } = {}) => {
    if (!isConfig(cfg)) return;
    const next = { featureHidden: cfg.featureHidden, statsAllowed: cfg.statsAllowed, enabled: cfg.enabled !== false };
    configCache.set(storageKey, next);
    fetchedAt.set(storageKey, Date.now());
    setConfig(next);
    setLoading(false);
    if (persistLocal) {
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
    }
  }, [storageKey]);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/role-access?key=${encodeURIComponent(key)}`, { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (data?.success && isConfig(data)) {
        const cfg = { featureHidden: data.featureHidden, statsAllowed: data.statsAllowed, enabled: data.enabled !== false };
        applyConfig(cfg);
        return cfg;
      }
    } catch { /* offline — fall through to local cache */ }
    const stored = readStorage(storageKey);
    if (stored) { applyConfig(stored, { persistLocal: false }); return stored; }
    return DEFAULT_ROLE_ACCESS;
  }, [key, storageKey, applyConfig]);

  useEffect(() => {
    let cancelled = false;

    const age = Date.now() - (fetchedAt.get(storageKey) || 0);
    const fresh = configCache.has(storageKey) && age < FRESH_MS;
    if (!fresh) {
      (async () => {
        const cfg = await fetchConfig();
        if (!cancelled) { setConfig(cfg); setLoading(false); }
      })();
    }

    // Cross-device realtime: the server broadcasts `role-access` over the one
    // shared socket (utils/liveStore). No per-card socket needed.
    const offRealtime = onRealtimeMessage('role-access', (payload) => {
      if (!payload || payload.pageKey !== key) return;
      applyConfig({ featureHidden: payload.featureHidden || [], statsAllowed: payload.statsAllowed || [], enabled: payload.enabled !== false });
    });

    // Same browser, another tab.
    const onStorage = (e) => {
      if (e.key !== storageKey || !e.newValue) return;
      try { applyConfig(JSON.parse(e.newValue), { persistLocal: false }); } catch { /* ignore */ }
    };
    // Same tab, in-process (save() dispatches this so sibling hooks update).
    const onLocal = (e) => {
      const d = e.detail;
      if (!d || (d.key !== storageKey && d.pageKey !== key)) return;
      applyConfig({ featureHidden: d.featureHidden || [], statsAllowed: d.statsAllowed || [], enabled: d.enabled !== false }, { persistLocal: false });
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('role-access-updated', onLocal);
    return () => {
      cancelled = true;
      offRealtime?.();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('role-access-updated', onLocal);
    };
  }, [key, storageKey, fetchConfig, applyConfig]);

  const save = useCallback(async (newCfg) => {
    if (!isConfig(newCfg)) return false;
    const previous = config;
    const next = { featureHidden: newCfg.featureHidden, statsAllowed: newCfg.statsAllowed, enabled: newCfg.enabled ?? config.enabled ?? true };
    applyConfig(next);
    try {
      window.dispatchEvent(new CustomEvent('role-access-updated', { detail: { ...next, key: storageKey, pageKey: key } }));
    } catch { /* ignore */ }
    try {
      const res = await fetch('/api/admin/role-access', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageKey: key, featureHidden: next.featureHidden, statsAllowed: next.statsAllowed, enabled: next.enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn('[role-access] save failed:', data?.error || res.status);
        applyConfig(previous);
        window.dispatchEvent(new CustomEvent('role-access-updated', { detail: { ...previous, key: storageKey, pageKey: key } }));
        return false;
      }
      return true;
    } catch (e) {
      console.warn('[role-access] save failed:', e?.message);
      applyConfig(previous);
      try { window.dispatchEvent(new CustomEvent('role-access-updated', { detail: { ...previous, key: storageKey, pageKey: key } })); } catch { /* ignore */ }
      return false;
    }
  }, [applyConfig, storageKey, key, config]);

  return { config, loading, save, key, storageKey };
}

// ── Whole-map view (for navigation, which needs EVERY page at once) ─────────
// The sidebar must know the access rules of ~14 pages before it can paint, so
// fetching each one with its own hook would fire a burst of requests. This
// single fetch returns the whole map; the same realtime/storage/local events
// keep it live, so a link disappears the moment an admin blocks that role.

export const ROLE_ACCESS_MAP_STORAGE_KEY = `${ROLE_ACCESS_STORAGE_BASE}:map`;

function normalizeEntry(cfg) {
  return { featureHidden: cfg.featureHidden, statsAllowed: cfg.statsAllowed, enabled: cfg.enabled !== false };
}

function readMapStorage() {
  try {
    const raw = localStorage.getItem(ROLE_ACCESS_MAP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch { /* corrupt cache — ignore */ }
  return null;
}

function writeMapStorage(map) {
  try { localStorage.setItem(ROLE_ACCESS_MAP_STORAGE_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

function storageKeyToPageKey(storageKey) {
  const prefix = `${ROLE_ACCESS_STORAGE_BASE}:`;
  return typeof storageKey === 'string' && storageKey.startsWith(prefix) ? storageKey.slice(prefix.length) : '';
}

/**
 * useRoleAccessMap — returns `{ [pageKey]: { featureHidden, statsAllowed, enabled } }`
 * for every page, seeded from a local cache for instant paint and reconciled with
 * the server in a single request. Stays live via the shared WebSocket, `storage`
 * events and the same-tab `role-access-updated` event, so it never goes stale.
 */
export function useRoleAccessMap() {
  const [map, setMap] = useState(() => (typeof window !== 'undefined' ? readMapStorage() : null));

  const mergeEntry = useCallback((rawKey, cfg) => {
    if (!rawKey || !isConfig(cfg)) return;
    const key = pageAccessKey(rawKey);
    setMap((cur) => {
      const next = { ...(cur || {}), [key]: normalizeEntry(cfg) };
      writeMapStorage(next);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/role-access/map', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.success || !data.configs) return;
        setMap((cur) => {
          const next = { ...(cur || {}) };
          for (const [k, cfg] of Object.entries(data.configs)) {
            if (isConfig(cfg)) next[pageAccessKey(k)] = normalizeEntry(cfg);
          }
          writeMapStorage(next);
          return next;
        });
      })
      .catch(() => { /* offline — keep the local cache */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const offRealtime = onRealtimeMessage('role-access', (payload) => {
      if (payload) mergeEntry(payload.pageKey, payload);
    });
    const onLocal = (e) => {
      const d = e.detail;
      if (d) mergeEntry(d.pageKey || storageKeyToPageKey(d.key), d);
    };
    const onStorage = (e) => {
      if (e.key !== ROLE_ACCESS_MAP_STORAGE_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed && typeof parsed === 'object') setMap(parsed);
      } catch { /* ignore */ }
    };
    window.addEventListener('role-access-updated', onLocal);
    window.addEventListener('storage', onStorage);
    return () => {
      offRealtime?.();
      window.removeEventListener('role-access-updated', onLocal);
      window.removeEventListener('storage', onStorage);
    };
  }, [mergeEntry]);

  return map;
}
