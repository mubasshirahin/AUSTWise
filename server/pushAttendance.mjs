// Attendance from a Web Push notification.
//
// When a class ends, the user gets a push with Present / Absent buttons. It
// works without Telegram: answers are kept per account in the user store key
// PUSH_ATTENDANCE_KEY ({ "COURSE|YYYY-MM-DD": { attended, at, via } }), which
// only the server writes and the attendance tracker reads.
//
// If the account also has Telegram linked, the push and the Telegram prompt
// are one question: the first answer (from either) wins and the other one is
// refused as already marked. Push answers are then also written to Telegram's
// AttendanceRecords so its 9 PM summary and stats stay right.
import jwt from 'jsonwebtoken';
import { getTodayAttendanceRecord, saveAttendanceRecord, getUserByAwid } from './telegramDB.mjs';
import { getUserStoreValue, setUserStoreValue } from './storeDB.mjs';
import { getUserById } from './userStore.mjs';

export const PUSH_ATTENDANCE_KEY = 'aust-push-attendance';
const SECRET = process.env.JWT_SECRET || 'austwise-dev-push-attendance';
const TOKEN_TTL = '20h'; // the push is only useful the same day

const markKey = (course, day) => `${course}|${day}`;
const toBool = (v) => v === true || v === 1 || v === '1';

// The Telegram chat linked to a website account, or null.
export async function linkedChatId(account) {
  const awid = account?.awid;
  if (!awid) return null;
  try {
    const tg = await getUserByAwid(awid);
    const chatId = tg?.ChatId ?? tg?.chatId;
    return chatId ? String(chatId) : null;
  } catch { return null; }
}

// Signed so the service worker can answer without a session cookie.
export function attendanceToken({ userId, course, day }) {
  return jwt.sign({ t: 'push-att', u: String(userId), k: course, d: day }, SECRET, { expiresIn: TOKEN_TTL });
}

// The push-side mark for this account, course and day, or null.
export async function getPushMark(userId, course, day) {
  try {
    const marks = await getUserStoreValue(String(userId), PUSH_ATTENDANCE_KEY, null);
    return marks && typeof marks === 'object' ? marks[markKey(course, day)] || null : null;
  } catch { return null; }
}

async function savePushMark(userId, course, day, attended, via) {
  const marks = (await getUserStoreValue(String(userId), PUSH_ATTENDANCE_KEY, null)) || {};
  marks[markKey(course, day)] = { attended: Boolean(attended), at: new Date().toISOString(), via };
  await setUserStoreValue(String(userId), PUSH_ATTENDANCE_KEY, marks);
}

// Has this class been answered today, by push or by Telegram?
// Returns { attended } or null.
export async function findAnswer({ userId, chatId, course, day }) {
  const mark = userId ? await getPushMark(userId, course, day) : null;
  if (mark) return { attended: toBool(mark.attended) };
  if (chatId) {
    try {
      const rec = await getTodayAttendanceRecord(chatId, course);
      if (rec) return { attended: toBool(rec.Attended ?? rec.attended) };
    } catch { /* treat as unanswered */ }
  }
  return null;
}

/**
 * Record a Present / Absent tap from a push.
 * Returns { status: 'saved' | 'already' | 'expired' | 'invalid', ... }.
 */
export async function recordPushAttendance(token, attended, today) {
  let p;
  try { p = jwt.verify(String(token || ''), SECRET); } catch { return { status: 'invalid' }; }
  if (p?.t !== 'push-att' || !p.u || !p.k) return { status: 'invalid' };
  if (p.d !== today) return { status: 'expired', course: p.k };
  const account = await getUserById(p.u).catch(() => null);
  if (!account) return { status: 'invalid' };
  const chatId = await linkedChatId(account);
  const prior = await findAnswer({ userId: p.u, chatId, course: p.k, day: today });
  if (prior) return { status: 'already', course: p.k, attended: prior.attended, userId: p.u };
  await savePushMark(p.u, p.k, today, attended, 'push');
  if (chatId) {
    try { await saveAttendanceRecord(chatId, p.k, Boolean(attended)); } catch { /* push mark is kept */ }
  }
  return { status: 'saved', course: p.k, attended: Boolean(attended), userId: p.u };
}
