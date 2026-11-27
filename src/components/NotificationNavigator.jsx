import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const PENDING_CACHE = 'austwise-pending-nav';
const PENDING_URL = '/__pending-nav__';
const MAX_AGE_MS = 60 * 1000;

function toAppPath(url) {
  try {
    const u = new URL(url, window.location.origin);
    if (u.origin !== window.location.origin) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

/**
 * Opens the page a tapped push notification points at (chat, notice board…).
 * The service worker either messages a running window, or — when the app was
 * closed and Android launched it at its home page — leaves the target in a
 * small cache entry that is picked up here on start.
 */
export default function NotificationNavigator() {
  const navigate = useNavigate();

  useEffect(() => {
    const go = (url) => {
      const path = toAppPath(url);
      if (!path) return;
      const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (path !== here) navigate(path);
    };

    const onMessage = (event) => {
      if (event.data?.type === 'austwise-navigate' && event.data.url) {
        go(event.data.url);
        clearPending();
      }
    };

    const clearPending = () => {
      if (typeof caches === 'undefined') return;
      caches.open(PENDING_CACHE).then((c) => c.delete(PENDING_URL)).catch(() => {});
    };

    const consumePending = async () => {
      if (typeof caches === 'undefined') return;
      try {
        const cache = await caches.open(PENDING_CACHE);
        const res = await cache.match(PENDING_URL);
        if (!res) return;
        await cache.delete(PENDING_URL);
        const { url, at } = await res.json();
        if (url && Date.now() - Number(at) < MAX_AGE_MS) go(url);
      } catch { /* nothing pending */ }
    };

    navigator.serviceWorker?.addEventListener('message', onMessage);
    consumePending();
    const onVisible = () => { if (document.visibilityState === 'visible') consumePending(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', onMessage);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [navigate]);

  return null;
}
