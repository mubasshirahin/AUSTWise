/**
 * Show a system notification on this device — phone or desktop.
 *
 * Mobile browsers (Android Chrome, installed PWAs) throw "Illegal constructor"
 * for `new Notification()`; they only allow notifications shown through the
 * service worker. So this goes through `registration.showNotification()` and
 * only falls back to the constructor on desktop browsers without a worker.
 *
 * Vibration follows Settings → Notifications → "Sound & vibration".
 */

const SETTINGS_KEY = 'aust-notifications-v1';
const PUSH_HANDOFF_KEY = 'aust-push-reminders-handoff';
export const VIBRATE_PATTERN = [200, 100, 200];

// Categories the server already delivers as Web Push to subscribed devices.
// Showing them from the page too would pop (and vibrate) every alert twice.
const SERVER_PUSHED = new Set(['notices', 'messages', 'applications', 'gaming', 'results']);

export function isVibrationEnabled() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}').vibrate !== false;
  } catch {
    return true;
  }
}

/** True when this device gets `category` as Web Push from the server. */
export function isServerPushedOnThisDevice(category) {
  if (!SERVER_PUSHED.has(category)) return false;
  try { return localStorage.getItem(PUSH_HANDOFF_KEY) === '1'; } catch { return false; }
}

async function getRegistration() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration().catch(() => null);
  if (existing?.active) return existing;
  if (!existing && import.meta.env.DEV) {
    // Dev unregisters the PWA worker on boot (main.jsx); use the push-only one.
    await navigator.serviceWorker.register('/push-sw.js', { scope: '/' }).catch(() => null);
  }
  // A worker that is still installing becomes usable once `ready` resolves.
  const timeout = new Promise((resolve) => { setTimeout(() => resolve(null), 3000); });
  return Promise.race([navigator.serviceWorker.ready.catch(() => null), timeout]);
}

/**
 * @param {string} title
 * @param {{ body?: string, tag?: string, url?: string, requireInteraction?: boolean }} [opts]
 * @returns {Promise<boolean>} whether a notification was shown
 */
export async function showDeviceNotification(title, opts = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const vibrate = isVibrationEnabled();
  const options = {
    body: opts.body || '',
    tag: opts.tag || title,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    renotify: Boolean(opts.tag) && vibrate,
    silent: !vibrate,
    vibrate: vibrate ? VIBRATE_PATTERN : [],
    requireInteraction: Boolean(opts.requireInteraction),
    timestamp: Date.now(),
    data: { url: opts.url || '/' },
  };

  try {
    const registration = await getRegistration();
    if (registration?.showNotification) {
      await registration.showNotification(title || 'AUSTWise', options);
      return true;
    }
  } catch { /* fall through to the page constructor */ }

  try {
    // Desktop without a service worker. `vibrate`/`renotify` are SW-only.
    const { vibrate: _v, renotify: _r, data: _d, ...pageOptions } = options;
    const n = new Notification(title || 'AUSTWise', pageOptions);
    n.onclick = () => {
      window.focus();
      if (opts.url && opts.url !== window.location.pathname) window.location.assign(opts.url);
      n.close();
    };
    if (vibrate && typeof navigator.vibrate === 'function') navigator.vibrate(VIBRATE_PATTERN);
    return true;
  } catch {
    return false;
  }
}
