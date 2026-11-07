import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const HEARTBEAT_MS = 20_000;

/**
 * Sends a usage heartbeat for the signed-in user: current page every ~20s
 * and immediately on every route change. Fire-and-forget — failures are
 * ignored so tracking never breaks navigation.
 */
export default function useUsageTracking() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const page = `${location.pathname}${location.search || ''}`;
    let cancelled = false;

    const beat = () => {
      if (cancelled) return;
      fetch('/api/presence/heartbeat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page }),
      }).catch(() => { /* tracking must never break the app */ });
    };

    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') beat(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthenticated, location.pathname, location.search]);
}
