/**
 * Browser-side Web Push helpers.
 *
 * Push only works through a service worker, so this module makes sure one is
 * registered before calling pushManager.subscribe(). In production the
 * Workbox worker from vite-plugin-pwa is used; in dev we register the
 * lightweight push handler directly so the flow can be tested locally.
 */

// Set while this device is subscribed. The server-side scheduler then owns
// class/deadline reminders, so the page must stop firing its own copies.
const REMINDERS_HANDED_OFF_KEY = 'aust-push-reminders-handoff';

export function isServerRemindersEnabled() {
  try { return localStorage.getItem(REMINDERS_HANDED_OFF_KEY) === '1'; } catch { return false; }
}

export function isPushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function getRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  let registration = await navigator.serviceWorker.getRegistration().catch(() => null);
  if (registration) return registration;
  if (import.meta.env.DEV) {
    // Dev deliberately unregisters workers on boot (see main.jsx), so register
    // just the push handler for local testing.
    registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' }).catch(() => null);
    return registration;
  }
  // Prod: main.jsx registers the PWA worker at startup. `ready` resolves once
  // it is active; if that never happens, surfacing an error is better than
  // silently falling back to a different worker at the same scope.
  return navigator.serviceWorker.ready.catch(() => null);
}

/** Show a diagnostic alert through the service worker (works on mobile). */
export async function showTestPushNotification() {
  const registration = await getRegistration();
  if (!registration?.showNotification) {
    throw new Error('Service worker notifications are unavailable.');
  }
  await registration.showNotification('AUSTWise notification check', {
    body: 'Browser notifications are ready.',
    silent: true,
    tag: 'austwise-notification-check',
    icon: '/austwise_icon_final.svg',
  });
}

export async function getExistingPushSubscription() {
  if (!isPushSupported()) return null;
  const registration = await getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription().catch(() => null);
}

async function fetchPublicKey() {
  const res = await fetch('/api/web-push/public-key', { credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.publicKey) {
    throw new Error(data.error || 'Web push is not configured on this server.');
  }
  return data.publicKey;
}

/** Subscribe this browser and register the subscription with the account. */
export async function subscribeToPush() {
  if (!isPushSupported()) throw new Error('This browser does not support push notifications.');
  if (Notification.permission === 'denied') {
    throw new Error('Notifications are blocked. Allow them in your browser site settings first.');
  }
  const publicKey = await fetchPublicKey();
  const registration = await getRegistration();
  if (!registration) throw new Error('Could not start the background service worker.');

  let subscription;
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  } catch (err) {
    if (Notification.permission !== 'granted') {
      throw new Error('Notification permission was not granted.', { cause: err });
    }
    throw new Error(err?.message || 'Could not subscribe this device to push.', { cause: err });
  }

  const payload = subscription.toJSON ? subscription.toJSON() : {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.getKey ? btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))) : undefined,
      auth: subscription.getKey ? btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')))) : undefined,
    },
  };

  const res = await fetch('/api/web-push/subscribe', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: {
        endpoint: payload.endpoint,
        keys: payload.keys,
        addedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Undo the local subscription so the UI doesn't claim we're subscribed.
    await subscription.unsubscribe().catch(() => {});
    throw new Error(data.error || 'Could not save this device on the server.');
  }
  try { localStorage.setItem(REMINDERS_HANDED_OFF_KEY, '1'); } catch { /* best effort */ }
  return subscription;
}

/** Unsubscribe this browser and remove its record from the account. */
export async function unsubscribeFromPush() {
  const subscription = await getExistingPushSubscription();
  if (!subscription) return { removed: false };
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => {});
  try { localStorage.removeItem(REMINDERS_HANDED_OFF_KEY); } catch { /* best effort */ }
  await fetch('/api/web-push/subscribe', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
  return { removed: true };
}

export async function fetchPushStatus() {
  const res = await fetch('/api/web-push/status', { credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  return res.ok ? data : { success: false, configured: false, subscribed: false, devices: 0 };
}
