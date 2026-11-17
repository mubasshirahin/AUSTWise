/**
 * Server-side Smart Reminders over Web Push.
 *
 * The browser-only checks in notificationService.js only run while a tab is
 * open. This job runs inside the server (1-minute tick, Asia/Dhaka) and sends
 * the same two reminders through the service worker so they arrive on mobile
 * even with the app closed:
 *   - 30 minutes before each class of the day
 *   - 12 hours before a deadline
 *
 * It reuses the Telegram scheduler's timezone/routine/deadline helpers so both
 * channels agree on what "today" and "12h before" mean. Delivery is keyed in
 * its own log (.wp_schedule_log.json) so a restart never double-sends, and a
 * Postgres advisory lock keeps a single instance in charge on multi-host deploys.
 */

import 'dotenv/config';
import { readJson, writeJson } from './jsonDB.mjs';
import { getUserStoreValue } from './storeDB.mjs';
import { getUserById } from './userStore.mjs';
import { createDedicatedClient } from './db.mjs';
import {
  dhakaNow, DAY_NAMES, parseRoutine, classStartMinutes, loadUserDeadlines,
} from './telegramSchedulerJob.mjs';
import { isWebPushConfigured, getAllSubscriberIds, sendPushToUser } from './webPush.mjs';

const LOG_FILE = '.wp_schedule_log.json';
const CLASS_LEAD_MINUTES = 30;
const DEADLINE_LEAD_MINUTES = 12 * 60;

// ── Idempotency log ──────────────────────────────────────────────────────────
let firedLog = {};

async function loadLog() {
  const log = await readJson(LOG_FILE, {});
  return log && typeof log === 'object' && !Array.isArray(log) ? log : {};
}

async function saveLog(log) {
  const keys = Object.keys(log).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 4000))) delete log[k];
  await writeJson(LOG_FILE, log);
}

const hasFired = (key) => Boolean(firedLog[key]);
async function markFired(key) {
  firedLog[key] = { at: new Date().toISOString() };
  await saveLog(firedLog);
}

// ── Per-subscriber work ──────────────────────────────────────────────────────
async function processSubscriber(userId, now) {
  let account;
  try { account = await getUserById(userId); } catch { return; }
  if (!account) return;

  const notifications = account.settings?.notifications || {};
  // The "Enable smart reminders" switch stays authoritative — subscribing to
  // push alone must not silently start sending class/deadline alerts.
  if (notifications.enabled !== true) return;
  const browser = notifications.channels?.browser || {};
  const notifyClass = browser.classReminders !== false;
  const notifyDeadline = browser.deadlines !== false;
  if (!notifyClass && !notifyDeadline) return;

  // ── Class reminders — 30 min before each class of today ──
  if (notifyClass) {
    const weekDays = await getUserStoreValue(userId, 'aust-user-weekdays', []);
    const todayName = DAY_NAMES[now.weekdayIndex];
    if (Array.isArray(weekDays) && weekDays.includes(todayName)) {
      const routine = parseRoutine(await getUserStoreValue(userId, 'aust-user-routine', {}));
      const classes = Array.isArray(routine?.[todayName]) ? routine[todayName] : [];
      for (let i = 0; i < classes.length; i += 1) {
        const cls = classes[i];
        const start = classStartMinutes(cls);
        if (!Number.isFinite(start)) continue;
        const diff = start - now.minutes;
        if (diff <= 0 || diff > CLASS_LEAD_MINUTES) continue;
        const key = `wp-class-${userId}-${now.key}-${i}`;
        if (hasFired(key)) continue;
        await markFired(key);
        const time = String(cls.time || '').split('-')[0].trim();
        await sendPushToUser(userId, {
          title: `🔔 Class in ${diff} minute${diff === 1 ? '' : 's'}`,
          body: `${cls.course || 'Class'}${cls.name ? ` — ${cls.name}` : ''}\n📍 Room ${cls.room || 'TBA'}${time ? ` at ${time}` : ''}`,
          tag: `class-${now.key}-${i}`,
          url: '/dashboard/routine',
          category: 'classReminders',
        });
      }
    }
  }

  // ── Deadline reminders — 12 h before ──
  if (notifyDeadline) {
    const deadlines = await loadUserDeadlines(userId);
    for (const dl of deadlines) {
      const minsLeft = (dl.dueDate - Date.now()) / 60000;
      if (!Number.isFinite(minsLeft) || minsLeft <= 0 || minsLeft > DEADLINE_LEAD_MINUTES) continue;
      const key = `wp-deadline-${userId}-${dl.id}-12h`;
      if (hasFired(key)) continue;
      await markFired(key);
      const hrs = Math.max(0, Math.round(minsLeft / 60));
      await sendPushToUser(userId, {
        title: `⏰ Deadline Alert — ${dl.course}`,
        body: `"${dl.title}" is due in ${hrs <= 1 ? 'less than 1 hour' : `${hrs} hour${hrs === 1 ? '' : 's'}`}!`,
        tag: `deadline-${dl.id}-12h`,
        url: '/dashboard/quickstats',
        category: 'deadlines',
      });
    }
  }
}

// ── Single-instance guard ────────────────────────────────────────────────────
const SCHEDULER_LOCK_ID = 731904282; // distinct from the Telegram job's lock
let lockClient = null;

async function isLeader() {
  if (lockClient) {
    const current = lockClient;
    try { await current.query('SELECT 1'); return true; } catch {
      if (lockClient === current) lockClient = null;
      current.end().catch(() => {});
    }
  }
  const hasDatabase = Boolean(
    process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_SERVER ||
    process.env.PGUSER || process.env.DB_USER
  );
  if (!hasDatabase) return true;
  let client;
  try {
    client = createDedicatedClient();
    client.on('error', () => {
      if (lockClient === client) lockClient = null;
      client.end().catch(() => {});
    });
    await client.connect();
    const res = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [SCHEDULER_LOCK_ID]);
    if (!res.rows[0]?.locked) { await client.end().catch(() => {}); return false; }
    lockClient = client;
    return true;
  } catch (error) {
    if (client) client.end().catch(() => {});
    console.warn('[web-push scheduler] waiting for the shared database lock:', error?.message || error);
    return false;
  }
}

// ── Tick loop ────────────────────────────────────────────────────────────────
let tickTimer = null;
let ticking = false;

export async function runWebPushSchedulerTick() {
  if (ticking || !isWebPushConfigured) return;
  ticking = true;
  try {
    if (!(await isLeader())) return;
    firedLog = await loadLog();
    const now = dhakaNow();
    const subscribers = await getAllSubscriberIds();
    for (const userId of subscribers) {
      try { await processSubscriber(userId, now); } catch (e) {
        console.warn('[web-push scheduler] subscriber tick failed:', e?.message || e);
      }
    }
  } catch (e) {
    console.warn('[web-push scheduler] tick failed:', e?.message || e);
  } finally {
    ticking = false;
  }
}

export function startWebPushScheduler() {
  if (tickTimer) return;
  if (!isWebPushConfigured) {
    console.log('ℹ️  Web Push scheduler: VAPID keys not set — scheduler idle.');
    return;
  }
  tickTimer = setInterval(() => { runWebPushSchedulerTick(); }, 60 * 1000);
  setTimeout(() => { runWebPushSchedulerTick(); }, 10_000); // catch-up after boot
  console.log('✅ Web Push scheduler started (1-min tick, Asia/Dhaka).');
}

export function stopWebPushScheduler() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  if (lockClient) {
    const client = lockClient;
    lockClient = null;
    client.end().catch(() => {});
  }
}
