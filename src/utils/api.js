// Backend API base URL.
// Dev/same-origin: '' → relative /api/... (Vite proxies to local server).
// Split-host prod (Vercel FE + Render BE): set VITE_API_URL=https://....onrender.com
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

// Fire a cheap GET to wake the free-tier Render instance before user pays/verifies.
// Free Render sleeps after ~15 min idle; this keeps it warm on first page load.
export function wakeBackend() {
  try {
    fetch(`${API_URL}/healthz`, { method: 'GET', mode: 'no-cors' }).catch(() => {});
  } catch { /* ignore */ }
}
