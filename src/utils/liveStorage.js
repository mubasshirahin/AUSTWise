/**
 * liveStorage — drop-in localStorage replacement for module-level storage
 * modules. Reads go through the liveStore cache (seeded from localStorage for
 * instant paint, then reconciled with the server); writes persist locally AND
 * to the server, which broadcasts the change to every other device.
 *
 * Usage:
 *   const list = liveLoad('user', 'aust-my-key', [], ['aust-my-key-legacy']);
 *   liveSave('user', 'aust-my-key', nextList);
 *
 * `legacyKeys` are older localStorage names to migrate from (on first load),
 * after which the value lives under the canonical `key` server-side.
 */

import { getLiveValue, setLiveValue, delLiveValue, ensureFetched } from './liveStore';

export function liveLoad(scope, key, fallback = null, legacyKeys = []) {
  const cached = getLiveValue(scope, key, null);
  if (cached !== null) return cached;

  // Kick off a server fetch so a fresh device (empty localStorage) still gets
  // the user's data once it arrives.
  ensureFetched(scope, key);

  for (const legacyKey of [key, ...legacyKeys]) {
    try {
      const raw = localStorage.getItem(legacyKey);
      if (raw === null) continue;
      const parsed = JSON.parse(raw);
      // Seed the server copy off the render path: setLiveValue emits to every
      // liveStore subscriber, and doing that synchronously during a render
      // would make React warn about updating components mid-render.
      queueMicrotask(() => setLiveValue(scope, key, parsed));
      return parsed;
    } catch { /* ignore malformed legacy values */ }
  }
  return fallback;
}

export function liveSave(scope, key, value) {
  setLiveValue(scope, key, value);
}

export function liveDelete(scope, key) {
  delLiveValue(scope, key);
}