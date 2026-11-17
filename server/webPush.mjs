/**
 * Web Push (VAPID) delivery for AUSTWise.
 *
 * Why this exists: browser notifications used to be fired with `new Notification()`
 * from the page. Mobile browsers don't allow that — they require a push message
 * delivered to the service worker. This module owns the VAPID setup, per-user
 * subscription storage and the fan-out used when a CR/SR posts a notice.
 *
 * Configure VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (and optionally VAPID_SUBJECT)
 * in .env. Generate a pair with: npx web-push generate-vapid-keys
 */

import { setVapidDetails, sendNotification } from 'web-push';
import { readJson, writeJson } from './jsonDB.mjs';
import { getUserById } from './userStore.mjs';

const SUBSCRIPTIONS_FILE = 'webPushSubscriptions.json';
const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:austwise@aust.edu';

export const isWebPushConfigured = Boolean(PUBLIC_KEY && PRIVATE_KEY);
export const webPushReason = isWebPushConfigured ? null : 'not_configured';

if (isWebPushConfigured) {
  setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
}

/** The applicationServerKey pushManager.subscribe() needs. */
export function getVapidPublicKey() {
  return isWebPushConfigured ? PUBLIC_KEY : null;
}

function normalizeSubscription(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const endpoint = typeof raw.endpoint === 'string' ? raw.endpoint.slice(0, 1000) : '';
  const p256dh = typeof raw.keys?.p256dh === 'string' ? raw.keys.p256dh.slice(0, 500) : '';
  const auth = typeof raw.keys?.auth === 'string' ? raw.keys.auth.slice(0, 500) : '';
  if (!endpoint || !p256dh || !auth) return null;
  // Only persist what the push library needs — never trust client-supplied
  // expiry/UA fields as authority, but keep them for diagnostics.
  return {
    endpoint,
    keys: { p256dh, auth },
    addedAt: typeof raw.addedAt === 'string' ? raw.addedAt : new Date().toISOString(),
    userAgent: typeof raw.userAgent === 'string' ? raw.userAgent.slice(0, 200) : '',
  };
}

async function readAll() {
  const value = await readJson(SUBSCRIPTIONS_FILE, {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

async function writeAll(all) {
  await writeJson(SUBSCRIPTIONS_FILE, all);
}

/** All user ids with at least one live push subscription (for the scheduler). */
export async function getAllSubscriberIds() {
  const all = await readAll();
  return Object.keys(all).filter((id) => Array.isArray(all[id]) && all[id].length > 0);
}

export async function getSubscriptions(userId) {
  const all = await readAll();
  const list = all[String(userId)];
  return Array.isArray(list) ? list : [];
}

export async function saveSubscription(userId, raw) {
  const sub = normalizeSubscription(raw);
  if (!sub) return { success: false, error: 'Invalid push subscription.' };
  const all = await readAll();
  const key = String(userId);
  const list = Array.isArray(all[key]) ? all[key] : [];
  const idx = list.findIndex((s) => s?.endpoint === sub.endpoint);
  if (idx >= 0) list[idx] = { ...list[idx], ...sub };
  else list.push(sub);
  all[key] = list;
  await writeAll(all);
  return { success: true, count: list.length };
}

export async function removeSubscription(userId, endpoint) {
  const all = await readAll();
  const key = String(userId);
  const list = Array.isArray(all[key]) ? all[key] : [];
  const next = endpoint ? list.filter((s) => s?.endpoint !== endpoint) : [];
  if (next.length) all[key] = next;
  else delete all[key];
  await writeAll(all);
  return { success: true, count: next.length };
}

export async function getSubscriptionStatus(userId) {
  const subs = await getSubscriptions(userId);
  return {
    configured: isWebPushConfigured,
    subscribed: subs.length > 0,
    devices: subs.length,
  };
}

async function deliver(userId, sub, payload) {
  try {
    await sendNotification(sub, JSON.stringify(payload), { TTL: 120 });
    return 'sent';
  } catch (err) {
    const status = err?.statusCode;
    // Gone / not found means the browser unsubscribed — drop it so we stop
    // wasting a request on every future broadcast.
    if (status === 404 || status === 410) {
      await removeSubscription(userId, sub.endpoint);
      return 'removed';
    }
    console.warn('[web-push] delivery failed:', status || err?.message || err);
    return 'failed';
  }
}

/** Send one payload to every device of a user. Always resolves; never throws. */
export async function sendPushToUser(userId, payload) {
  if (!isWebPushConfigured) return { sent: 0, failed: 0, removed: 0 };
  const subs = await getSubscriptions(userId);
  if (!subs.length) return { sent: 0, failed: 0, removed: 0 };
  const results = await Promise.all(subs.map((sub) => deliver(userId, sub, payload)));
  return {
    sent: results.filter((r) => r === 'sent').length,
    failed: results.filter((r) => r === 'failed').length,
    removed: results.filter((r) => r === 'removed').length,
  };
}

/**
 * Fan a notice out to every subscribed device whose owner is allowed to see
 * that notice's scope and hasn't opted out of the browser "notices" channel.
 * Mirrors the filtering in telegramNotifier.sendNoticeToAllUsers().
 */
export async function sendNoticeWebPush(notice) {
  if (!isWebPushConfigured) return { success: false, reason: 'not_configured', sent: 0 };

  const all = await readAll();
  const userIds = Object.keys(all).filter((id) => Array.isArray(all[id]) && all[id].length > 0);
  if (!userIds.length) return { success: true, sent: 0, reason: 'no_subscribers' };

  const scope = notice?.scope;
  const eligible = [];
  for (const id of userIds) {
    // Nobody needs a push about the notice they just wrote.
    if (notice?.postedById && String(id) === String(notice.postedById)) continue;
    let account;
    try { account = await getUserById(id); } catch { continue; }
    if (!account) continue;
    const prefs = account.settings?.notifications || {};
    if ((prefs.channels?.browser?.notices ?? true) !== true) continue;
    if (scope?.department && String(scope.department) !== String(account.department || '')) continue;
    if (scope?.semester && String(scope.semester) !== String(account.semester || '')) continue;
    if (scope?.labSection && String(scope.labSection) !== String(account.labSection || '')) continue;
    if (scope?.section && String(scope.section) !== String(account.section || '')) continue;
    eligible.push(id);
  }

  const payload = {
    title: notice?.title || 'New notice',
    body: String(notice?.content || `Posted by ${notice?.postedByName || 'CR/SR'}`).slice(0, 160),
    tag: notice?.noticeId ? `notice-${notice.noticeId}` : `notice-${Date.now()}`,
    url: '/',
    category: 'notice',
    icon: '/austwise-icon-final.svg',
  };

  const results = await Promise.all(eligible.map((id) => sendPushToUser(id, payload)));
  const sent = results.reduce((sum, r) => sum + r.sent, 0);
  const failed = results.reduce((sum, r) => sum + r.failed, 0);
  const removed = results.reduce((sum, r) => sum + r.removed, 0);
  return { success: true, recipients: eligible.length, sent, failed, removed };
}
