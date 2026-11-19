/**
 * Content-Security-Policy for the AUSTWise SPA.
 *
 * One source of truth for both hosts: the Render server (applySecurityHeaders
 * in dev.mjs) and the Vercel frontend (vercel.json "headers"). vercel.json
 * can't import this, so `server/csp.test.mjs` fails if the two drift apart.
 *
 * The main protection is script-src: only our own bundle, Google Identity
 * Services and the pdf.js worker on cdnjs may run. No inline scripts — the
 * boot code lives in public/boot.js. Images/media/connect stay broad (https:)
 * because avatars, posters, Drive files and third-party APIs come from many
 * hosts; locking those would break features for little extra safety.
 */

const DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", 'https://accounts.google.com/gsi/client', 'https://cdnjs.cloudflare.com'],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com/gsi/style'],
  'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'media-src': ["'self'", 'data:', 'blob:', 'https:'],
  'connect-src': ["'self'", 'https:', 'wss:'],
  'frame-src': [
    "'self'", 'data:', 'blob:',
    'https://www.youtube.com', 'https://www.youtube-nocookie.com',
    'https://docs.google.com', 'https://drive.google.com', 'https://accounts.google.com',
  ],
  'worker-src': ["'self'", 'blob:', 'https://cdnjs.cloudflare.com'],
  'manifest-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'", 'https:'],
  // Same-origin framing is used by the admin Flow Canvas (/prototype/) and the
  // dev role matrix; other sites still can't frame the app.
  'frame-ancestors': ["'self'"],
};

// Vite dev server: the react-refresh preamble is an inline script, HMR uses a
// ws:// socket on localhost, and dev tooling evaluates code.
const DEV_EXTRA = {
  'script-src': ["'unsafe-inline'", "'unsafe-eval'"],
  'connect-src': ['ws:', 'http://localhost:*'],
};

export function buildCsp({ dev = false } = {}) {
  return Object.entries(DIRECTIVES)
    .map(([name, values]) => {
      const all = dev && DEV_EXTRA[name] ? [...values, ...DEV_EXTRA[name]] : values;
      return `${name} ${all.join(' ')}`;
    })
    .join('; ');
}
