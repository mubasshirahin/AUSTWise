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

/**
 * Per-account + per-IP login limiter with exponential backoff (M4).
 *
 * Keys are `ip|account`, so rotating IPs can't bypass the per-account budget,
 * and a process-wide `__global__` key bounds total attempts even across IP
 * rotation. A failed login locks the account+IP for windowMs × 2^failures
 * (capped at 15 min); a successful login clears the lock.
 *
 * Returns a middleware function with two attached helpers:
 *   check.fail(req, account)    — record a failed login (starts/extends backoff)
 *   check.success(req, account) — clear the lock after a successful login
 */
export function createLoginRateLimiter({ windowMs, max, globalMax }) {
  const store = new Map();
  stores.add(store);
  scheduleCleanup();
  const MAX_BACKOFF = 15 * 60 * 1000;
  const GLOBAL_KEY = '__global__';

  const keyOf = (req, account) => {
    const acct = String(account || '').toLowerCase().trim();
    return acct ? `${getClientIp(req)}|${acct}` : getClientIp(req);
  };
  const entryMax = (k) => (k === GLOBAL_KEY ? (globalMax || max * 10) : max);

  const check = (req, res, account) => {
    const now = Date.now();
    const keys = account ? [keyOf(req, account), GLOBAL_KEY] : [keyOf(req, account)];

    for (const k of keys) {
      const e = store.get(k);
      if (e && e.resetTime > now && e.count >= entryMax(k)) {
        const retryAfter = Math.ceil((e.resetTime - now) / 1000);
        res.writeHead(429, {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
        });
        res.end(JSON.stringify({
          success: false,
          error: `Too many attempts. Please try again in ${retryAfter} seconds.`,
          retryAfter,
        }));
        return false;
      }
    }

    for (const k of keys) {
      const e = store.get(k);
      if (!e || e.resetTime <= now) {
        store.set(k, { count: 1, failures: 0, resetTime: now + windowMs });
      } else {
        e.count += 1;
      }
    }
    return true;
  };

  check.fail = (req, account) => {
    const now = Date.now();
    const key = keyOf(req, account);
    const prev = store.get(key);
    const failures = (prev?.failures || 0) + 1;
    const backoffMs = Math.min(windowMs * Math.pow(2, failures), MAX_BACKOFF);
    store.set(key, { count: max, failures, resetTime: now + backoffMs });
    const g = store.get(GLOBAL_KEY);
    if (g && g.resetTime > now) g.count += 1;
    else store.set(GLOBAL_KEY, { count: 1, failures: 0, resetTime: now + windowMs });
  };

  check.success = (req, account) => {
    store.delete(keyOf(req, account));
  };

  return check;
}

// ── Pre-configured limiters (env-tunable) ──────────────────────────────────

/** Shared per-IP limiter for /api/auth/login + /api/auth/signup */
export const authRateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 60_000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 5,
});

/** Per-account + per-IP limiter with exponential backoff on failed logins. */
export const loginRateLimiter = createLoginRateLimiter({
  windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 60_000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 5,
  globalMax: Number(process.env.RATE_LIMIT_AUTH_GLOBAL_MAX) || 100,
});

/** Limiter for /api/extract-routine (OpenAI-backed image extraction) */
export const extractRoutineRateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_EXTRACT_WINDOW_MS) || 3_600_000,
  max: Number(process.env.RATE_LIMIT_EXTRACT_MAX) || 10,
});
