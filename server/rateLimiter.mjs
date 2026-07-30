/**
 * Lightweight in-memory rate limiter — single file, zero dependencies.
 *
 * Each rateLimit() call creates an isolated store so different endpoints get
 * independent counters.  Old entries are pruned every 5 minutes to bound memory.
 *
 * Environment variables (all optional, fall back to sensible defaults):
 *   RATE_LIMIT_AUTH_WINDOW_MS   – window for /api/auth/*   (default 60_000 = 1 min)
 *   RATE_LIMIT_AUTH_MAX         – max requests per window  (default 5)
 *   RATE_LIMIT_EXTRACT_WINDOW_MS – window for /api/extract-routine (default 3_600_000 = 1 hr)
 *   RATE_LIMIT_EXTRACT_MAX      – max requests per window  (default 10)
 *
 * ── curl example (429 response) ──
 * # Hit login 6 times in under a minute:
 * #   for i in $(seq 1 6); do
 * #     curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:5174/api/auth/login \
 * #       -H "Content-Type: application/json" \
 * #       -d '{"email":"x@aust.edu","password":"wrong"}'
 * #   done
 * # → 401 … 401 … 429
 * #   curl -s -X POST http://localhost:5174/api/auth/login \
 * #     -H "Content-Type: application/json" -d '{"email":"x@aust.edu","password":"wrong"}'
 * # → {"success":false,"error":"Too many requests. Please try again in 42 seconds.","retryAfter":42}
 */

/**
 * Extract the client IP, respecting reverse-proxy headers.
 */
function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || '127.0.0.1';
}

/** Shared cleanup timer — each store registers itself once. */
const stores = new Set();
let cleanupTimer = null;

function scheduleCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const store of stores) {
      for (const [key, entry] of store) {
        if (entry.resetTime <= now) store.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  cleanupTimer.unref(); // don't keep the process alive
}

/**
 * Create a rate-limiter middleware.
 *
 * @param {object}   opts
 * @param {number}   opts.windowMs   – sliding window duration in ms
 * @param {number}   opts.max        – max requests allowed in that window
 * @param {(req) => string} [opts.keyFn] – custom key derivation (default: client IP)
 * @returns {(req, res) => boolean}  – returns false + sends 429 if limit exceeded
 */
export function rateLimit({ windowMs, max, keyFn }) {
  const store = new Map();
  stores.add(store);
  scheduleCleanup();

  return (req, res) => {
    const key = keyFn ? keyFn(req) : getClientIp(req);
    const now = Date.now();
    const entry = store.get(key);

    // No entry or window expired → first request in this window
    if (!entry || entry.resetTime <= now) {
      store.set(key, { count: 1, resetTime: now + windowMs });
      // Set rate-limit headers on successful requests too (informational)
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(max - 1));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));
      return true;
    }

    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetTime / 1000)));
      res.writeHead(429, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Retry-After': String(retryAfter),
      });
      res.end(JSON.stringify({
        success: false,
        error: `Too many requests. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      }));
      return false;
    }

    entry.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(max - entry.count));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetTime / 1000)));
    return true;
  };
}

// ── Pre-configured limiters (env-tunable) ──────────────────────────────────

/** Shared limiter for /api/auth/login + /api/auth/signup */
export const authRateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 60_000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 5,
});

/** Limiter for /api/extract-routine (OpenAI-backed image extraction) */
export const extractRoutineRateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_EXTRACT_WINDOW_MS) || 3_600_000,
  max: Number(process.env.RATE_LIMIT_EXTRACT_MAX) || 10,
});
