/**
 * Dynamic CORS middleware — no wildcard origins.
 *
 * The browser frontend (e.g. Vercel) and this API (e.g. Render) live on
 * different origins, and auth relies on an HttpOnly cookie, so every response
 * the browser reads must carry an explicit `Access-Control-Allow-Origin`
 * (never `*`) together with `Access-Control-Allow-Credentials: true`.
 *
 * Allowed origins come from environment variables:
 *   FRONTEND_URL     – the main frontend origin (comma-separated list allowed)
 *   ALLOWED_ORIGINS  – extra origins, comma-separated (dev / preview domains)
 *
 * Localhost dev origins are always allowed, and a request whose Origin matches
 * the server's own host is treated as same-origin (no CORS headers needed),
 * so single-domain deployments keep working without any configuration.
 */

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

export const IS_PRODUCTION =
  process.env.NODE_ENV === 'production' ||
  process.env.RENDER === 'true' ||
  process.env.VERCEL === '1';

function buildAllowedOrigins() {
  const fromEnv = [
    ...(process.env.FRONTEND_URL || '').split(','),
    ...(process.env.ALLOWED_ORIGINS || '').split(','),
  ]
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  // Localhost origins only in dev — production strictly uses FRONTEND_URL /
  // ALLOWED_ORIGINS so no unexpected origins are ever allowed.
  if (IS_PRODUCTION && fromEnv.length === 0) {
    console.warn('⚠️  FRONTEND_URL / ALLOWED_ORIGINS not set — CORS will fail for all cross-origin browser requests.');
  }
  return new Set([...fromEnv, ...(IS_PRODUCTION ? [] : DEV_ORIGINS)]);
}

const ALLOWED_ORIGINS = buildAllowedOrigins();

/** True when the Origin points at the same host this server answers for. */
function isSameOrigin(req, origin) {
  try {
    const host = req.headers.host;
    if (!host) return false;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Return the exact Origin value we may reflect back, or null when the request
 * is not from a browser (no Origin header) or the origin isn't allowed.
 * When null, no CORS headers are attached — server-to-server callers
 * (curl, Telegram webhooks) don't need them.
 */
export function getAllowedOrigin(req) {
  const origin = (req.headers.origin || '').trim().replace(/\/+$/, '');
  if (!origin) return null;
  if (ALLOWED_ORIGINS.has(origin) || isSameOrigin(req, origin)) return origin;
  return null;
}

/** Attach dynamic CORS headers to a normal response. Call before writeHead/end. */
export function applyCorsHeaders(req, res) {
  const origin = getAllowedOrigin(req);
  if (!origin) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
}

/** Handle an OPTIONS preflight request. */
export function handleCorsPreflight(req, res) {
  const origin = getAllowedOrigin(req);
  if (!origin) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Origin not allowed.' }));
    return;
  }
  res.writeHead(204, {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers':
      req.headers['access-control-request-headers']
      || 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  });
  res.end();
}
