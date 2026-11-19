/**
 * Gali strike ladder. Strikes live in the protected shared key
 * `system:moderation-strikes` ({ [userId]: record }) and are mirrored in
 * memory so requireRole can check bans synchronously.
 *
 *   strike 1 → warning, 2 → 2-day ban, 3+ → 10-day ban.
 *   30 days after a cycle's first strike, the count resets to 0.
 */

import { getSharedStoreValue, setSharedStoreValue } from './storeDB.mjs';

export const STRIKES_KEY = 'system:moderation-strikes';
const DAY = 86400000;
export const CYCLE_MS = 30 * DAY;
export const BAN_MS = { 2: 2 * DAY, 3: 10 * DAY };

let cache = null; // { [userId]: record }
let loading = null;

export async function loadStrikes() {
  if (cache) return cache;
  if (!loading) {
    loading = getSharedStoreValue(STRIKES_KEY, {})
      .then((v) => { cache = v && typeof v === 'object' ? v : {}; })
      .catch(() => { cache = {}; })
      .finally(() => { loading = null; });
  }
  await loading;
  return cache;
}

/** Pure strike step — exported for tests. */
export function nextStrike(record, now) {
  const r = record && now - (record.cycleStartedAt || 0) <= CYCLE_MS
    ? { ...record }
    : { count: 0, cycleStartedAt: now, banUntil: 0 };
  r.count += 1;
  r.lastOffenceAt = now;
  const banMs = BAN_MS[Math.min(r.count, 3)];
  r.banUntil = banMs ? now + banMs : 0;
  return r;
}

export async function recordStrike(userId, text = '', now = Date.now()) {
  const all = await loadStrikes();
  const r = nextStrike(all[userId], now);
  r.lastSnippet = String(text).slice(0, 120);
  all[userId] = r;
  try { await setSharedStoreValue(STRIKES_KEY, all, 'moderation'); } catch (err) {
    console.warn('⚠️  strikes: could not persist', err.message);
  }
  return { level: r.count >= 3 ? 'ban10' : r.count === 2 ? 'ban2' : 'warning', count: r.count, banUntil: r.banUntil };
}

/** Sync check (uses the in-memory mirror). Returns banUntil ms or 0. */
export function activeBanUntil(userId, now = Date.now()) {
  const r = cache?.[userId];
  return r && r.banUntil > now ? r.banUntil : 0;
}

export async function resetStrikes(userId) {
  const all = await loadStrikes();
  delete all[userId];
  await setSharedStoreValue(STRIKES_KEY, all, 'moderation');
}

export function tempBanBody(banUntil) {
  return { success: false, tempBanned: true, banUntil, error: `Gali deyar jonno tumi ${new Date(banUntil).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })} porjonto banned.` };
}
