/**
 * In-process Telegram notification scheduler.
 *
 * Replaces the never-wired cron script (telegramScheduler.mjs): the running
 * server itself fires all scheduled Telegram jobs at the right times, using
 * Asia/Dhaka local time regardless of the host machine's timezone.
 *
 * Per-user message schedule (all times Asia/Dhaka, 12-hour format):
 *   1. 12:00 AM (midnight) — digest of TOMORROW's classes (smart-alarm brief)
 *   2. 30 min before the day's FIRST class — one reminder for the whole day
 *   3. At each class's end time — attendance prompt with Yes/No buttons
 *   4. 9:00 PM — single reminder with one button row per unanswered class;
 *      anything still unanswered at midnight is auto-marked missed
 *   5. Deadline alerts — when a high-priority task enters the urgent zone
 *      (< 48h left) and again 12 hours before it's due (high/medium only)
 *
 * Anti-duplicate design: every send is keyed in a persistent JSON log
 * (server/.tg_schedule_log.json) so a restart mid-day never double-sends.
 */

import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from './jsonDB.mjs';
import {
  getAllUsers,
  saveAttendanceRecordForDate,
  getUserAttendanceRecords,
} from './telegramDB.mjs';
import { sendTelegramMessage, sendTelegramMessageWithKeyboard } from './telegramNotifier.mjs';
import {
  TELEGRAM_TEST_TYPES, getSortedClasses, buildDigest, buildFirstClassReminder,
  buildAfterClassAttendance, buildEveningAttendance, buildMissedAttendance,
  buildDeadlineMessage as buildFormattedDeadlineMessage, buildNoticeMessage, buildWelcomeMessage,
} from './telegramMessageTemplates.mjs';
import { getAllUsersSafe } from './userStore.mjs';
import { getUserStoreValue } from './storeDB.mjs';
import { getPool } from './db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Timezone handling (Asia/Dhaka) ───────────────────────────────────────────
const APP_TZ = 'Asia/Dhaka';

function dhakaParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TZ,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const map = {};
  for (const p of fmt.formatToParts(date)) map[p.type] = p.value;
  const weekdayIndex = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[map.weekday];
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    weekdayIndex: Number.isInteger(weekdayIndex) ? weekdayIndex : new Date(date).getDay(),
    hour: map.hour === '24' ? 0 : Number(map.hour),
    minute: Number(map.minute),
    key: `${map.year}-${map.month}-${map.day}`,
  };
}

// Current Dhaka wall-clock snapshot: { y, m, d, weekdayIndex, hour, minute, minutes, key }
function dhakaNow() {
  const p = dhakaParts(new Date());
  return { ...p, minutes: p.hour * 60 + p.minute };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Persistent send log (idempotency across restarts) ────────────────────────
const LOG_FILE = path.join(__dirname, '.tg_schedule_log.json');

async function loadLog() {
  const log = await readJson(LOG_FILE, {});
  return log && typeof log === 'object' ? log : {};
}

async function saveLog(log) {
  // Keep the file tiny: retain only the newest 4000 entries.
  const keys = Object.keys(log).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 4000))) delete log[k];
  await writeJson(LOG_FILE, log);
}

let firedLog = {};
function hasFired(key) { return !!firedLog[key]; }
async function markFired(key) {
  firedLog[key] = { at: new Date().toISOString() };
  await saveLog(firedLog);
}

// ── Routine parsing helpers ──────────────────────────────────────────────────

function parseRoutine(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
}

/** Parse "9:00 - 9:50", "09:00 AM - 09:50 AM", "13:00-13:50" → minutes. */
function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const m = String(timeStr).match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const period = (m[3] || '').toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 24h minutes → "7:30 AM" / "12:05 PM" — 12-hour format per user request. */
export function format12Hour(totalMinutes) {
  if (!Number.isFinite(totalMinutes)) return '';
  const h24 = Math.floor(totalMinutes / 60) % 24;
  const m = Math.floor(totalMinutes % 60);
  const period = h24 >= 12 ? 'PM' : 'AM';
  let h = h24 % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

function classesForDay(routine, dayName) {
  const list = routine[dayName];
  return Array.isArray(list) ? list : [];
}

function classStartMinutes(cls) {
  return timeToMinutes(String(cls.time || '').split('-')[0]);
}

function classEndMinutes(cls) {
  const parts = String(cls.time || '').split('-');
  if (parts.length < 2) return null;
  return timeToMinutes(parts[1]);
}

// ── Message builders ─────────────────────────────────────────────────────────

const BN_DAY = {
  Sunday: 'রবিবার', Monday: 'সোমবার', Tuesday: 'মঙ্গলবার',
  Wednesday: 'বুধবার', Thursday: 'বৃহস্পতিবার', Friday: 'শুক্রবার', Saturday: 'শনিবার',
};

function dhakaDateLabel(offsetDays = 0) {
  const now = dhakaNow();
  const d = new Date(Date.UTC(now.y, now.m - 1, now.d + offsetDays, 6, 0, 0)); // noon Dhaka
  return d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', timeZone: APP_TZ });
}

function classLines(classes) {
  return classes.map((cls, i) => {
    const start = classStartMinutes(cls);
    const room = cls.room || 'TBA';
    const type = cls.type === 'Lab' ? '🧪' : '📚';
    const num = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'][i] || `${i + 1}.`;
    return `${num} ${type} ${cls.course} – ${cls.name || ''}\n   ⏰ ${format12Hour(start)} | 📍 Room ${room}`;
  }).join('\n\n');
}

/** 1) Midnight digest — tomorrow's classes (the "smart alarm" briefing). */
export function buildMidnightDigest(routine) {
  const tomorrowName = DAY_NAMES[(dhakaNow().weekdayIndex + 1) % 7];
  const classes = classesForDay(routine, tomorrowName).slice()
    .sort((a, b) => (classStartMinutes(a) ?? 0) - (classStartMinutes(b) ?? 0));
  const label = dhakaDateLabel(1);

  let msg = `🌙 রাত ১২টা — কালকের ক্লাস ব্রিফিং (${BN_DAY[tomorrowName]}, ${label})\n\n`;
  if (classes.length === 0) {
    msg += `🎉 কাল কোনো ক্লাস নেই! দেরি করে ঘুমাতে পারবে।\n`;
  } else {
    msg += `কাল ${classes.length}টি ক্লাস আছে। প্রথম ক্লাস ${format12Hour(classStartMinutes(classes[0]))} এ।\n\n`;
    msg += classLines(classes);
    msg += `\n\n⏰ প্রথম ক্লাসের ৩০ মিনিট আগে আবার রিমাইন্ডার পাবে।`;
  }
  msg += `\n\n📖 AUSTWise`;
  return { text: msg, count: classes.length };
}

/** 3) Class-end attendance prompt for one class (Yes/No buttons). */
export function buildClassEndAttendanceMessage(cls, index, total) {
  const start = classStartMinutes(cls);
  const end = classEndMinutes(cls);
  const type = cls.type === 'Lab' ? '🧪' : '📚';
  const text =
    `📝 ক্লাস শেষ (${index + 1}/${total})\n\n` +
    `${type} ${cls.course} – ${cls.name || ''}\n` +
    `⏰ ${format12Hour(start)} - ${format12Hour(end)}\n\n` +
    `আজকের ক্লাসে উপস্থিত ছিলে? নিচের বাটনে জানাও —\n` +
    `রাত ৯টার আগে উত্তর না দিলে Auto-Missed হয়ে যাবে।\n\n📖 AUSTWise`;

  const courseKey = String(cls.course || '').replace(/\s/g, '_');
  const keyboard = [[
    { text: '✅ Present', callback_data: `attend_yes_${index}_${courseKey}` },
    { text: '❌ Absent', callback_data: `attend_no_${index}_${courseKey}` },
  ]];
  return { text, keyboard };
}

/** 4) 9 PM reminder — one message, one button row per unanswered class. */
export function buildNinePmReminder(classes, answeredMap) {
  const lines = classes.map((cls, i) => {
    const status = answeredMap[i] ? '✅' : '❓';
    return `${status} ${cls.course} – ${cls.name || ''} (${format12Hour(classStartMinutes(cls))})`;
  });
  const text =
    `🌙 রাত ৯টা — আজকের অ্যাটেন্ডেন্স নিশ্চিত করুন\n\n` +
    `${lines.join('\n')}\n\n` +
    `❓ চিহ্নিত ক্লাসগুলোর উত্তর দাও — রাত ১২টার মধ্যে উত্তর না দিলে Auto-Missed হবে।\n\n📖 AUSTWise`;
  const keyboard = classes
    .map((cls, i) => ({ cls, i }))
    .filter(({ i }) => !answeredMap[i])
    .map(({ cls, i }) => {
      const courseKey = String(cls.course || '').replace(/\s/g, '_');
      return [
        { text: `✅ ${cls.course} Present`, callback_data: `attend_yes_${i}_${courseKey}` },
        { text: `❌ ${cls.course} Absent`, callback_data: `attend_no_${i}_${courseKey}` },
      ];
    });
  return { text, keyboard, unansweredCount: keyboard.length };
}

/** 5) Deadline alert message. phase: 'urgent' | '12h' */
export function buildDeadlineMessage(dl, phase) {
  const title = String(dl.title || 'Untitled task');
  const course = String(dl.course || 'General');
  const dueTs = new Date(dl.dueDate).getTime();
  const dueLabel = new Date(dueTs).toLocaleString('en-GB', {
    timeZone: APP_TZ,
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const hrsLeft = Math.max(0, Math.round((dueTs - Date.now()) / 3600000));
  const head = phase === 'urgent'
    ? `🚨 জরুরি ডেডলাইন! ৪৮ ঘণ্টার কম বাকি`
    : `⏳ ডেডলাইনের ১২ ঘণ্টা বাকি`;
  const text =
    `${head}\n\n` +
    `📌 ${title}\n` +
    `📚 ${course}${dl.priority ? ` • Priority: ${dl.priority}` : ''}\n` +
    `🗓 Due: ${dueLabel} (আনুমানিক ${hrsLeft} ঘণ্টা বাকি)\n\n` +
    `এখনই শুরু করো — শেষ মুহূর্তের চাপ এড়াও!\n\n📖 AUSTWise`;
  return { text };
}

// ── Deadline source (per-user store, mirrors the dashboard's live values) ────

async function loadUserDeadlines(awid) {
  if (!awid) return [];
  try {
    const [manual, weekTasks] = await Promise.all([
      getUserStoreValue(awid, 'aust-deadlines', []),
      getUserStoreValue(awid, 'aust-week-tasks', []),
    ]);
    const now = Date.now();
    const items = [];
    const push = (id, title, course, priority, dueDate) => {
      const dueTs = new Date(dueDate).getTime();
      if (!Number.isFinite(dueTs) || dueTs <= now) return;
      items.push({
        id: String(id || title || 'dl'),
        title: String(title || 'Untitled task'),
        course: String(course || 'General'),
        priority: String(priority || 'medium').toLowerCase(),
        dueDate: dueTs,
      });
    };
    for (const dl of (Array.isArray(manual) ? manual : [])) {
      if (!dl) continue;
      push(dl.id, dl.title, dl.course || dl.courseCode, dl.priority, dl.dueDate);
    }
    for (const t of (Array.isArray(weekTasks) ? weekTasks : [])) {
      if (!t || !t.date) continue;
      // TZ-safe: parse YYYY-MM-DD as local midnight, like DeadlineTicker does.
      const base = new Date(`${t.date}T00:00:00`);
      if (Number.isNaN(base.getTime())) continue;
      if (t.time) {
        const [h, m] = String(t.time).split(':').map(Number);
        if (Number.isFinite(h) && Number.isFinite(m)) base.setHours(h, m, 0, 0);
        else base.setHours(23, 59, 59, 0);
      } else {
        base.setHours(23, 59, 59, 0);
      }
      push(`task-${t.id}`, t.title, t.courseCode || t.courseName, t.priority || 'medium', base.toISOString());
    }
    return items;
  } catch {
    return [];
  }
}

// ── Account settings lookup (cached 60s) ────────────────────────────────────
let awidAccountCache = { map: null, at: 0 };

async function getAccountByAwid(awid) {
  if (!awid) return null;
  if (!awidAccountCache.map || Date.now() - awidAccountCache.at > 60_000) {
    try {
      const all = await getAllUsersSafe();
      const map = {};
      for (const u of all) if (u?.awid) map[String(u.awid)] = u;
      awidAccountCache = { map, at: Date.now() };
    } catch { awidAccountCache = { map: {}, at: Date.now() }; }
  }
  return awidAccountCache.map[String(awid)] || null;
}

// ── Per-user tick ────────────────────────────────────────────────────────────

const TEST_CLASS = {
  course: 'CSE 101', name: 'Introduction to Computing', type: 'Theory',
  time: '08:00 - 08:50', room: '7A-01',
};

function withPreviewClass(routine, day) {
  const current = parseRoutine(routine);
  return getSortedClasses(current, day).length ? current : { ...current, [day]: [TEST_CLASS] };
}

export async function sendTelegramTestMessage(chatId, type, routine = {}) {
  if (!TELEGRAM_TEST_TYPES.some((item) => item.id === type)) {
    return { success: false, error: 'Unknown Telegram message type.' };
  }
  const now = dhakaNow();
  const todayName = DAY_NAMES[now.weekdayIndex];
  const tomorrowName = DAY_NAMES[(now.weekdayIndex + 1) % 7];
  let payload;
  switch (type) {
    case 'welcome': payload = buildWelcomeMessage(chatId, { test: true }); break;
    case 'midnight_digest': payload = buildDigest(withPreviewClass(routine, tomorrowName), new Date(), tomorrowName, { test: true }); break;
    case 'first_class_reminder':
      payload = buildFirstClassReminder(getSortedClasses(withPreviewClass(routine, todayName), todayName), new Date(), { test: true });
      break;
    case 'after_class_attendance': {
      const classes = getSortedClasses(withPreviewClass(routine, todayName), todayName);
      payload = buildAfterClassAttendance(classes[0] || TEST_CLASS, 0, classes.length || 1, { test: true });
      break;
    }
    case 'evening_attendance': {
      const classes = getSortedClasses(withPreviewClass(routine, todayName), todayName);
      payload = buildEveningAttendance(classes.length ? classes : [TEST_CLASS], {}, { test: true });
      break;
    }
    case 'missed_attendance': {
      const yesterdayName = DAY_NAMES[(now.weekdayIndex + 6) % 7];
      payload = buildMissedAttendance(getSortedClasses(routine, yesterdayName).length || 2, new Date(), { test: true });
      break;
    }
    case 'deadline_urgent':
      payload = buildFormattedDeadlineMessage({ title: 'Design project submission', course: 'CSE 220', priority: 'High', dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }, 'urgent', { test: true });
      break;
    case 'deadline_12h':
      payload = buildFormattedDeadlineMessage({ title: 'Lab report submission', course: 'CSE 220', priority: 'Medium', dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() }, '12h', { test: true });
      break;
    case 'notice':
      payload = buildNoticeMessage({ title: 'Academic notice preview', content: 'This is a sample notice message. Official notice details will appear here.', postedByName: 'AUSTWise Admin', postedByRole: 'Admin', pinned: true }, { test: true });
      break;
    default: return { success: false, error: 'Unknown Telegram message type.' };
  }
  return payload.keyboard
    ? sendTelegramMessageWithKeyboard(process.env.TELEGRAM_BOT_TOKEN, chatId, payload.text, payload.keyboard, 'HTML')
    : sendTelegramMessage(process.env.TELEGRAM_BOT_TOKEN, chatId, payload.text, 'HTML');
}

async function processUser(user, now) {
  const chatId = user.chatId ?? user.ChatId;
  if (!chatId) return;
  const awid = user.awid ?? user.Awid ?? null;
  const routine = parseRoutine(user.routine ?? user.Routine);
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  // Per-channel prefs (default all ON — Telegram registration is the consent).
  let notifyClass = true;
  let notifyDigest = true;
  let notifyAttendance = true;
  let notifyDeadline = true;
  if (awid) {
    try {
      const acct = await getAccountByAwid(String(awid));
      const n = acct?.settings?.notifications || {};
      const telegram = n.channels?.telegram || {};
      notifyClass = telegram.classReminders ?? (n.notifyClass !== false);
      notifyDigest = telegram.classSchedule ?? (n.notifyDigest !== false);
      notifyAttendance = telegram.attendance ?? (n.notifyAttendance !== false);
      notifyDeadline = telegram.deadlines ?? (n.notifyDeadline !== false);
    } catch { /* store unavailable → keep defaults */ }
  }

  const todayKey = now.key;
  const todayName = DAY_NAMES[now.weekdayIndex];
  const todayClasses = classesForDay(routine, todayName).slice()
    .sort((a, b) => (classStartMinutes(a) ?? 0) - (classStartMinutes(b) ?? 0));

  // ── 1) Midnight digest (12:00–12:05 AM) — tomorrow's classes ──
  if (notifyDigest && now.hour === 0 && now.minute < 5 && !hasFired(`mid-${chatId}-${todayKey}`)) {
    await markFired(`mid-${chatId}-${todayKey}`);
    const tomorrowName = DAY_NAMES[(now.weekdayIndex + 1) % 7];
    const { text } = buildDigest(routine, new Date(), tomorrowName);
    await sendTelegramMessage(botToken, chatId, text, 'HTML');
  }

  // ── 2) 30 min before the FIRST class of the day (single daily alert) ──
  if (notifyClass && todayClasses.length > 0) {
    const firstStart = classStartMinutes(todayClasses[0]);
    if (Number.isFinite(firstStart)) {
      const key = `pre-${chatId}-${todayKey}`;
      const due = now.minutes >= firstStart - 30 && now.minutes < firstStart - 27;
      if (due && !hasFired(key)) {
        await markFired(key);
        const { text } = buildFirstClassReminder(todayClasses);
        await sendTelegramMessage(botToken, chatId, text, 'HTML');
      }
    }
  }

  // ── 3) Attendance prompt at each class's end time ──
  if (notifyAttendance && todayClasses.length > 0) {
    let recordsCache = null;
    for (let i = 0; i < todayClasses.length; i++) {
      const cls = todayClasses[i];
      const end = classEndMinutes(cls);
      if (!Number.isFinite(end)) continue;
      const key = `end-${chatId}-${todayKey}-${i}`;
      const due = now.minutes >= end && now.minutes < end + 3;
      if (!due || hasFired(key)) continue;
      await markFired(key);
      // Skip if the user already answered this class earlier today.
      try {
        if (!recordsCache) {
          const all = await getUserAttendanceRecords(chatId);
          recordsCache = new Set((all || []).map(r => `${String(r.courseCode || '').toUpperCase()}|${dhakaParts(new Date(r.recordDate)).key}`));
        }
        if (recordsCache.has(`${String(cls.course).toUpperCase()}|${todayKey}`)) continue;
      } catch { /* fall through and send */ }
      const { text, keyboard } = buildAfterClassAttendance(cls, i, todayClasses.length);
      await sendTelegramMessageWithKeyboard(botToken, chatId, text, keyboard, 'HTML');
      await new Promise(r => setTimeout(r, 400));
    }
  }

  // ── 4) 9 PM reminder — one message with buttons for unanswered classes ──
  if (notifyAttendance && now.hour === 21 && now.minute < 5 && todayClasses.length > 0) {
    const key = `pm9-${chatId}-${todayKey}`;
    if (!hasFired(key)) {
      await markFired(key);
      const answeredMap = {};
      try {
        const all = await getUserAttendanceRecords(chatId);
        const todaySet = new Set(
          (all || [])
            .filter(r => dhakaParts(new Date(r.recordDate)).key === todayKey)
            .map(r => String(r.courseCode || '').toUpperCase())
        );
        todayClasses.forEach((cls, i) => { answeredMap[i] = todaySet.has(String(cls.course).toUpperCase()); });
      } catch { /* default: treat all as unanswered */ }
      const { text, keyboard } = buildEveningAttendance(todayClasses, answeredMap);
      const unansweredCount = keyboard.length;
      if (unansweredCount > 0) {
        await sendTelegramMessageWithKeyboard(botToken, chatId, text, keyboard, 'HTML');
      }
    }
  }

  // ── Auto-missed sweep (12:00–12:06 AM, marks YESTERDAY's unanswered) ──
  if (now.hour === 0 && now.minute < 6) {
    const key = `sweep-${chatId}-${todayKey}`;
    if (!hasFired(key)) {
      await markFired(key);
      const yName = DAY_NAMES[(now.weekdayIndex + 6) % 7];
      const yDate = new Date(Date.UTC(now.y, now.m - 1, now.d - 1, 6, 0, 0)); // noon Dhaka yesterday
      const yKey = dhakaParts(yDate).key;
      const yClasses = classesForDay(routine, yName);
      if (yClasses.length > 0) {
        try {
          const all = await getUserAttendanceRecords(chatId);
          const answered = new Set(
            (all || [])
              .filter(r => dhakaParts(new Date(r.recordDate)).key === yKey)
              .map(r => String(r.courseCode || '').toUpperCase())
          );
          let marked = 0;
          for (const cls of yClasses) {
            if (answered.has(String(cls.course || '').toUpperCase())) continue;
            await saveAttendanceRecordForDate(chatId, cls.course, false, yKey);
            marked++;
          }
          if (marked > 0 && notifyAttendance) {
            const missedMessage = buildMissedAttendance(marked, new Date());
            await sendTelegramMessage(botToken, chatId, missedMessage.text, 'HTML');
          }
        } catch { /* best-effort sweep */ }
      }
    }
  }

  // ── 5) Deadline alerts (urgent entry + 12h before) ──
  if (notifyDeadline && awid) {
    const deadlines = await loadUserDeadlines(awid);
    for (const dl of deadlines) {
      const minsLeft = (dl.dueDate - Date.now()) / 60000;
      // Urgent entry: high-priority task crossing into the < 48h zone.
      if (dl.priority === 'high' && minsLeft <= 48 * 60 && !hasFired(`dl-u-${awid}-${dl.id}`)) {
        await markFired(`dl-u-${awid}-${dl.id}`);
        const { text } = buildFormattedDeadlineMessage(dl, 'urgent');
        await sendTelegramMessage(botToken, chatId, text, 'HTML');
      }
      // 12h before: high/medium priority tasks only (not everything — spam).
      if ((dl.priority === 'high' || dl.priority === 'medium') && minsLeft <= 12 * 60 && !hasFired(`dl-12-${awid}-${dl.id}`)) {
        await markFired(`dl-12-${awid}-${dl.id}`);
        const { text } = buildFormattedDeadlineMessage(dl, '12h');
        await sendTelegramMessage(botToken, chatId, text, 'HTML');
      }
    }
  }
}

// ── Tick loop ────────────────────────────────────────────────────────────────

let tickTimer = null;
let ticking = false;
let schedulerLockClient = null;

// A JSON send log only protects one filesystem. On a multi-instance host each
// server can have its own copy and send the same reminders. Hold a PostgreSQL
// advisory lock on a dedicated connection so only one instance runs the jobs.
const SCHEDULER_LOCK_ID = 731904281;

async function isSchedulerLeader() {
  if (schedulerLockClient) {
    const currentClient = schedulerLockClient;
    try {
      await currentClient.query('SELECT 1');
      return true;
    } catch {
      if (schedulerLockClient === currentClient) schedulerLockClient = null;
      try { currentClient.release(true); } catch { /* already released */ }
    }
  }

  // Local development without a configured database still supports one server
  // process. In deployed environments, fail closed if the shared DB is down.
  const hasDatabase = Boolean(
    process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_SERVER ||
    process.env.PGUSER || process.env.DB_USER
  );
  if (!hasDatabase) return true;

  let client;
  try {
    const pool = await getPool();
    client = await pool.connect();
    const result = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [SCHEDULER_LOCK_ID]);
    if (!result.rows[0]?.locked) {
      client.release();
      return false;
    }
    schedulerLockClient = client;
    client.on('error', () => {
      if (schedulerLockClient === client) {
        schedulerLockClient = null;
        try { client.release(true); } catch { /* already released */ }
      }
    });
    return true;
  } catch (error) {
    if (client) client.release();
    console.warn('Telegram scheduler waiting for the shared database lock:', error?.message || error);
    return false;
  }
}

export async function runSchedulerTick() {
  if (ticking) return;
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  ticking = true;
  try {
    if (!(await isSchedulerLeader())) return;
    firedLog = await loadLog();
    const now = dhakaNow();
    const users = await getAllUsers();
    for (const user of users) {
      try { await processUser(user, now); } catch (e) {
        console.warn('⚠️ Telegram scheduler: user tick failed:', e?.message || e);
      }
      await new Promise(r => setTimeout(r, 150)); // gentle pacing between users
    }
  } catch (e) {
    console.warn('⚠️ Telegram scheduler tick failed:', e?.message || e);
  } finally {
    ticking = false;
  }
}

export function startTelegramScheduler() {
  if (tickTimer) return;
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log('ℹ️  Telegram scheduler: TELEGRAM_BOT_TOKEN not set — scheduler idle.');
    return;
  }
  tickTimer = setInterval(() => { runSchedulerTick(); }, 60 * 1000);
  setTimeout(() => { runSchedulerTick(); }, 5_000); // catch-up tick after boot
  console.log('✅ Telegram scheduler started (1-min tick, Asia/Dhaka).');
}

export function stopTelegramScheduler() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
}
