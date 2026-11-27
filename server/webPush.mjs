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
import {
  SERVER_ONLY_USER_KEY_PREFIX,
  getUserStoreValue,
  setUserStoreValue,
  listUserStoreValuesForKey,
} from './storeDB.mjs';

// Subscriptions live in the DB-backed per-user store (Postgres, JSON fallback).
// They used to sit in a git-ignored file on the server's disk, which Railway
// wipes on every deploy/restart — so every device silently stopped getting
// notice pushes after the next deploy. The `__server:` prefix keeps the key
// off the client-facing /api/store/user endpoints.
const SUBSCRIPTIONS_KEY = `${SERVER_ONLY_USER_KEY_PREFIX}web-push-subscriptions`;
const LEGACY_SUBSCRIPTIONS_FILE = 'webPushSubscriptions.json';
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

// The server POSTs to whatever endpoint a client registers, so an arbitrary
// URL would let any signed-in user aim server requests at internal hosts or
// third parties. Accept only the browser push services (Chrome/Edge/Opera/
// Samsung -> FCM, Firefox -> Mozilla autopush, Safari -> Apple, legacy Edge -> WNS).
const PUSH_SERVICE_HOSTS = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'push.services.mozilla.com',
  'push.apple.com',
  'notify.windows.com',
];

function isPushServiceEndpoint(endpoint) {
  let url;
  try { url = new URL(endpoint); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_SERVICE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

function normalizeSubscription(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const endpoint = typeof raw.endpoint === 'string' ? raw.endpoint.slice(0, 1000) : '';
  const p256dh = typeof raw.keys?.p256dh === 'string' ? raw.keys.p256dh.slice(0, 500) : '';
  const auth = typeof raw.keys?.auth === 'string' ? raw.keys.auth.slice(0, 500) : '';
  if (!endpoint || !p256dh || !auth) return null;
  if (!isPushServiceEndpoint(endpoint)) return null;
  // Only persist what the push library needs — never trust client-supplied
  // expiry/UA fields as authority, but keep them for diagnostics.
  return {
    endpoint,
    keys: { p256dh, auth },
    addedAt: typeof raw.addedAt === 'string' ? raw.addedAt : new Date().toISOString(),
    userAgent: typeof raw.userAgent === 'string' ? raw.userAgent.slice(0, 200) : '',
  };
}

// Devices subscribed while the old file store was in use: fold them into the
// DB store once per process, then empty the file so they aren't re-imported.
let legacyMigration = null;
function migrateLegacyFile() {
  if (!legacyMigration) {
    legacyMigration = (async () => {
      try {
        const legacy = await readJson(LEGACY_SUBSCRIPTIONS_FILE, {});
        if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) return;
        const entries = Object.entries(legacy).filter(([, list]) => Array.isArray(list) && list.length);
        if (!entries.length) return;
        for (const [userId, list] of entries) {
          const current = await readUserList(userId);
          const merged = [...current];
          for (const raw of list) {
            const sub = normalizeSubscription(raw);
            if (sub && !merged.some((s) => s.endpoint === sub.endpoint)) merged.push(sub);
          }
          await setUserStoreValue(String(userId), SUBSCRIPTIONS_KEY, merged);
        }
        await writeJson(LEGACY_SUBSCRIPTIONS_FILE, {});
      } catch (err) {
        legacyMigration = null; // try again on the next call
        console.warn('[web-push] legacy subscription migration failed:', err?.message || err);
      }
    })();
  }
  return legacyMigration;
}

async function readUserList(userId) {
  const list = await getUserStoreValue(String(userId), SUBSCRIPTIONS_KEY, []);
  return Array.isArray(list) ? list : [];
}

/** { userId: [subscription, ...] } for every user with at least one device. */
async function readAll() {
  await migrateLegacyFile();
  const rows = await listUserStoreValuesForKey(SUBSCRIPTIONS_KEY);
  const all = {};
  for (const { userId, value } of rows) {
    if (Array.isArray(value) && value.length) all[String(userId)] = value;
  }
  return all;
}

/** All user ids with at least one live push subscription (for the scheduler). */
export async function getAllSubscriberIds() {
  return Object.keys(await readAll());
}

export async function getSubscriptions(userId) {
  await migrateLegacyFile();
  return readUserList(userId);
}

export async function saveSubscription(userId, raw) {
  const sub = normalizeSubscription(raw);
  if (!sub) return { success: false, error: 'Invalid push subscription.' };
  const list = await getSubscriptions(userId);
  const idx = list.findIndex((s) => s?.endpoint === sub.endpoint);
  if (idx >= 0) list[idx] = { ...list[idx], ...sub };
  else list.push(sub);
  await setUserStoreValue(String(userId), SUBSCRIPTIONS_KEY, list);
  return { success: true, count: list.length };
}

export async function removeSubscription(userId, endpoint) {
  const list = await getSubscriptions(userId);
  const next = endpoint ? list.filter((s) => s?.endpoint !== endpoint) : [];
  await setUserStoreValue(String(userId), SUBSCRIPTIONS_KEY, next);
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
    // `urgency: high` lets the phone wake and pop the alert right away
    // instead of batching it until the device is next awake.
    await sendNotification(sub, JSON.stringify(payload), {
      TTL: payload.category === 'messages' ? 120 : 6 * 60 * 60,
      urgency: payload.silent ? 'normal' : 'high',
    });
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

const VIBRATE_PATTERN = [200, 100, 200];

/** Small cache-busting hash so a changed profile photo isn't served stale. */
function shortHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 97) h = (h * 31 + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + str.length.toString(36);
}

/**
 * URL of a user's profile photo for a notification's large icon (avatars are
 * often data: URLs far bigger than a push payload, so we send a link to
 * /api/avatar/<id> instead). Null when the user has no photo — the
 * notification then shows only the app's own icon, once.
 */
export async function avatarIconFor(userId, known) {
  if (!userId) return null;
  let avatar = known;
  if (avatar === undefined) {
    try { avatar = (await getUserById(userId))?.avatar; } catch { avatar = null; }
  }
  if (typeof avatar !== 'string' || !avatar) return null;
  return `/api/avatar/${encodeURIComponent(String(userId))}?v=${shortHash(avatar)}`;
}

/**
 * Whether the user wants `category` as a push on their devices. The Settings
 * → Push column is authoritative; accounts that never touched it fall back to
 * the older Browser column (which used to double as the push switch).
 */
export function isPushCategoryEnabled(prefs, category) {
  if (!category) return true;
  const push = prefs?.channels?.push;
  if (push && typeof push[category] === 'boolean') return push[category];
  return prefs?.channels?.browser?.[category] !== false;
}

/**
 * Send one payload to every device of a user. Always resolves; never throws.
 * `payload.category` is matched against the user's Settings → Push column,
 * so a type switched off there never reaches their phone. The user's
 * "Sound & vibration" switch decides between a vibrating and a silent popup.
 */
export async function sendPushToUser(userId, payload) {
  const none = { sent: 0, failed: 0, removed: 0 };
  if (!isWebPushConfigured) return none;
  const subs = await getSubscriptions(userId);
  if (!subs.length) return none;
  let prefs = {};
  try { prefs = (await getUserById(userId))?.settings?.notifications || {}; } catch { /* use defaults */ }
  if (!isPushCategoryEnabled(prefs, payload?.category)) return none;
  const vibrate = prefs.vibrate !== false;
  const body = { ...payload, vibrate: vibrate ? VIBRATE_PATTERN : [], silent: !vibrate };
  const results = await Promise.all(subs.map((sub) => deliver(userId, sub, body)));
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
    if (!isPushCategoryEnabled(prefs, 'notices')) continue;
    if (scope?.department && String(scope.department) !== String(account.department || '')) continue;
    if (scope?.semester && String(scope.semester) !== String(account.semester || '')) continue;
    if (scope?.labSection && String(scope.labSection) !== String(account.labSection || '')) continue;
    if (scope?.section && String(scope.section) !== String(account.section || '')) continue;
    eligible.push(id);
  }

  const poster = notice?.postedByName || 'CR/SR';
  const payload = {
    title: notice?.title || 'New notice',
    body: `${poster}: ${String(notice?.content || 'posted a new notice')}`.slice(0, 160),
    icon: await avatarIconFor(notice?.postedById),
    tag: notice?.noticeId ? `notice-${notice.noticeId}` : `notice-${Date.now()}`,
    url: '/',
    category: 'notices',
  };

  const results = await Promise.all(eligible.map((id) => sendPushToUser(id, payload)));
  const sent = results.reduce((sum, r) => sum + r.sent, 0);
  const failed = results.reduce((sum, r) => sum + r.failed, 0);
  const removed = results.reduce((sum, r) => sum + r.removed, 0);
  return { success: true, recipients: eligible.length, sent, failed, removed };
}

/**
 * Mirror a realtime (WebSocket) event as a Web Push, so the same things that
 * land in the notification bell also reach a phone with the app closed.
 * Unknown event types are ignored. Fire-and-forget; never throws.
 */
const REALTIME_PUSH = {
  'role-application': (p) => ({
    title: p.title || 'New role application',
    body: p.body || '',
    actorId: p.userId,
    tag: `roleapp-${p.id || Date.now()}`,
    url: p.path || '/admin/applications',
    category: 'applications',
  }),
  'role-review': (p) => ({
    title: p.title || 'Application update',
    body: p.body || '',
    tag: `role-review-${p.applicationId || p.id || Date.now()}`,
    url: p.path || '/settings',
    category: 'applications',
  }),
  'gz-lfg-ping': (p) => p?.roomId && ({
    title: `${p.game?.name || 'A squad'} needs ${p.missing} more`,
    body: `${p.from?.name || 'Someone'}: "${p.title || ''}"`.slice(0, 160),
    actorId: p.from?.id,
    tag: `gz-ping-${p.roomId}`,
    url: `/gaming/room/${p.roomId}`,
    category: 'gaming',
  }),
  'gz-event-reminder': (p) => p?.eventId && ({
    title: `${p.title || 'Your event'} starts soon`,
    body: 'Check in and join the event chat.',
    tag: `gz-remind-${p.eventId}`,
    url: `/gaming/event/${p.eventId}`,
    category: 'gaming',
  }),
  'gz-event-update': (p) => p?.eventId && ({
    title: `${p.title || 'Event'} ${p.status === 'cancelled' ? 'was cancelled' : p.status === 'live' ? 'is live' : 'was updated'}`,
    body: 'Open the event for details.',
    tag: `gz-event-${p.eventId}`,
    url: `/gaming/event/${p.eventId}`,
    category: 'gaming',
  }),
  'gz-kicked': (p) => p?.roomId && ({
    title: p.banned ? 'Removed and blocked from a room' : 'Removed from a room',
    body: p.title || '',
    tag: `gz-kick-${p.roomId}`,
    url: '/gaming?view=rooms',
    category: 'gaming',
  }),
  'gz-sanction': (p) => p?.type && ({
    title: `${p.type === 'zone_ban' ? 'Gaming Zone suspension' : p.type === 'room_ban' ? 'Room ban' : 'Mute'} ${p.revoked ? 'lifted' : 'applied'}`,
    body: p.revoked ? 'You can take part again.' : (p.reason || ''),
    tag: `gz-sanction-${p.type}`,
    url: '/gaming',
    category: 'gaming',
  }),
};

export function pushRealtimeEvent(userIds, data) {
  if (!isWebPushConfigured || !data?.type) return;
  const build = REALTIME_PUSH[data.type];
  if (!build) return;
  let payload;
  try { payload = build(data.payload || {}); } catch { return; }
  if (!payload) return;
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean).map(String))];
  const { actorId, ...rest } = payload;
  void (async () => {
    const icon = actorId ? await avatarIconFor(actorId) : null;
    const body = icon ? { ...rest, icon } : rest;
    for (const id of ids) void sendPushToUser(id, body).catch(() => {});
  })().catch(() => {});
}

/** Push a new direct message to the recipient's devices. */
export async function sendMessageWebPush({ fromId, toId, text }) {
  if (!isWebPushConfigured || !fromId || !toId || !text) return;
  let sender = null;
  try { sender = await getUserById(fromId); } catch { /* name falls back */ }
  const preview = String(text);
  await sendPushToUser(toId, {
    title: sender?.name || 'New message',
    body: preview.length > 140 ? `${preview.slice(0, 137)}...` : preview,
    icon: await avatarIconFor(fromId, sender ? (sender.avatar || null) : undefined),
    tag: `msg-${fromId}`,
    url: `/messages?peer=${encodeURIComponent(fromId)}`,
    category: 'messages',
    // Don't pop a system alert over the chat the recipient is already reading.
    skipIfVisible: true,
  });
}
