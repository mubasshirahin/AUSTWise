// Signed-out callers (landing visitors, "Take a Visit" guests) may only reach
// the endpoints below. Every other /api route needs a session cookie, so no
// real AUST data (members, chats, routines, notices, papers...) ever leaves the
// server for someone who is not logged in. Guests browse a client-side demo
// sandbox instead (src/guest/guestSandbox.js).

const PUBLIC_EXACT = new Set([
  '/api/stats/count',           // landing page member counter
  '/api/stats/count/stream',
  '/api/testimonials',          // landing page
  '/api/feedback',              // public feedback form
  '/api/access-requests',       // "request access" form (POST)
  '/api/role-access/map',       // page config only, no user data
  '/api/telegram/webhook',      // Telegram -> server, verified inside
  '/api/payment/webhook',       // payment provider -> server, verified inside
  '/api/ws-ticket',             // answers 401 itself when signed out
]);

const PUBLIC_PREFIXES = [
  '/api/auth/',                 // login, signup, OAuth, me, logout, password reset
  '/api/guest/',                // guest visit counters (visit / ping / leave)
  '/api/invite/',               // accept-invite flow before an account exists
  '/api/page-availability',     // page on/off flags only
  '/api/role-access',           // per-page role config only (GET)
  '/api/dev/',                  // dev-only, hard-disabled in production
];

export function isPublicApiPath(url) {
  const path = String(url || '').split('?')[0].split('#')[0];
  if (PUBLIC_EXACT.has(path)) return true;
  return PUBLIC_PREFIXES.some((p) => path === p.replace(/\/$/, '') || path.startsWith(p));
}
