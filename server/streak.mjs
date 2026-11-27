// Daily login streak, kept by the server.
//
// A "day" runs from 12:00 AM to 11:59 PM Bangladesh time. Logging in (or
// using the app) at least once in a day keeps the streak going: the next day
// adds +1, a missed day resets the current streak to 1. maxCount keeps the
// best run ever, and the leaderboard ranks by it.
import { getUserStoreValue, setUserStoreValue } from './storeDB.mjs';

export const STREAK_KEY = 'aust-study-streak';
const TZ = 'Asia/Dhaka';
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

// "YYYY-MM-DD" for the given moment, in Bangladesh time.
export function dayKey(date = new Date()) { return dayFmt.format(date); }

// Whole days between two "YYYY-MM-DD" keys.
function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

// Older records stored lastActive as Date#toDateString() ("Fri Nov 28 2026").
function normalizeDay(value) {
  if (typeof value !== 'string' || !value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Users already counted today, so heartbeats don't hit the store every time.
const touchedToday = new Map(); // userId -> dayKey
const inFlight = new Map();

async function doTouch(userId, today) {
  const prev = await getUserStoreValue(userId, STREAK_KEY, null);
  const last = normalizeDay(prev?.lastActive);
  const count = Number(prev?.count) || 0;
  const best = Math.max(Number(prev?.maxCount ?? prev?.best) || 0, count);
  if (last === today && count >= 1) return prev;
  let next;
  if (last && daysBetween(last, today) === 1) next = count + 1;
  else if (last && daysBetween(last, today) <= 0 && count >= 1) return prev; // clock skew: keep as is
  else next = 1;
  const value = { count: next, maxCount: Math.max(best, next), lastActive: today };
  await setUserStoreValue(userId, STREAK_KEY, value);
  return value;
}

// Count today for this user. Safe to call on every request.
export async function touchStreak(userId) {
  const id = String(userId ?? '');
  if (!id || id === 'guest') return null;
  const today = dayKey();
  if (touchedToday.get(id) === today) return null;
  if (!inFlight.has(id)) {
    inFlight.set(id, doTouch(id, today)
      .then((v) => { touchedToday.set(id, today); return v; })
      .finally(() => inFlight.delete(id)));
  }
  return inFlight.get(id);
}

// What the widget shows: a streak whose last day is before yesterday is broken.
export function currentStreak(value, today = dayKey()) {
  const last = normalizeDay(value?.lastActive);
  if (!last) return 0;
  return daysBetween(last, today) <= 1 ? (Number(value?.count) || 0) : 0;
}
