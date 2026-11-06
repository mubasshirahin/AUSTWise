import { useCallback, useEffect, useRef, useState } from 'react';

const LOCK_CACHE_KEY = 'aust-batch-drive-lock-cache-v1';
const LOCK_CACHE_TTL = 60_000;

let memoryCache = null;
let memoryCacheAt = 0;

function readCache() {
  if (memoryCache && Date.now() - memoryCacheAt < LOCK_CACHE_TTL) return memoryCache;
  try {
    const raw = sessionStorage.getItem(LOCK_CACHE_KEY);
    if (!raw) return memoryCache;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !('canShare' in parsed)) return memoryCache;
    return parsed;
  } catch {
    return memoryCache;
  }
}

function writeCache(data) {
  if (!data || typeof data !== 'object') return;
  memoryCache = data;
  memoryCacheAt = Date.now();
  try {
    sessionStorage.setItem(LOCK_CACHE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

async function lockApi(path, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      throw new Error(data?.error || 'Request failed.');
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Batch Drive lock status for the signed-in user.
 * Guests (no session) get an open state — the vault is already gated by
 * login/features, so the lock only applies to authenticated students.
 */
export function useBatchDriveLock({ enabled = true } = {}) {
  const cached = enabled ? readCache() : null;
  const [status, setStatus] = useState(cached);
  const [loading, setLoading] = useState(Boolean(enabled) && !cached);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!enabled) {
      if (mountedRef.current) {
        setStatus(null);
        setLoading(false);
      }
      return null;
    }
    if (!silent && mountedRef.current) {
      setLoading(true);
      setError('');
    }
    try {
      const data = await lockApi('/api/batch-drive/lock/me');
      if (mountedRef.current) {
        setStatus(data);
        setLoading(false);
        writeCache(data);
      }
      return data;
    } catch (err) {
      if (mountedRef.current) {
        // Keep last good status on silent refresh; only fall back to open
        // when we have nothing cached yet.
        if (!silent || !status) {
          setStatus((current) => current || { locked: false, needsUnlock: false, unlocked: false, canShare: false, share: null, unlock: null, offline: true });
        }
        setError(err?.message || '');
        setLoading(false);
      }
      return null;
    }
  }, [enabled, status]);

  useEffect(() => {
    // Instant paint from cache, revalidate in background.
    if (cached) {
      refresh({ silent: true });
    } else {
      refresh();
    }
    // refresh identity is stable except for status fallback; run once on mount / enabled change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, refresh]);

  const mutate = useCallback(async (path, options) => {
    setError('');
    const data = await lockApi(path, options);
    // Apply server response directly — no second round-trip.
    if (data?.share && mountedRef.current) {
      setStatus((current) => {
        const next = current ? { ...current, share: { ...data.share, hasGenerated: true } } : current;
        if (next) writeCache(next);
        return next;
      });
    }
    if (data?.unlock && mountedRef.current) {
      setStatus((current) => {
        const next = current ? { ...current, unlock: data.unlock, locked: false, unlocked: true } : current;
        if (next) writeCache(next);
        return next;
      });
    }
    return data;
  }, []);

  const generateCode = useCallback(async () => mutate('/api/batch-drive/lock/generate', { method: 'POST', body: JSON.stringify({}) }), [mutate]);

  const toggleShare = useCallback(
    async (nextEnabled) => mutate('/api/batch-drive/lock/toggle', { method: 'POST', body: JSON.stringify({ enabled: Boolean(nextEnabled) }) }),
    [mutate],
  );

  const redeemCode = useCallback(async (code) => mutate('/api/batch-drive/lock/redeem', { method: 'POST', body: JSON.stringify({ code: String(code || '').trim() }) }), [mutate]);

  return { status, loading, error, refresh, generateCode, toggleShare, redeemCode };
}
