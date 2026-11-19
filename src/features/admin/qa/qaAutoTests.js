// In-browser QA checks for the admin QA Checklist page.
//
// Everything here only READS: GET requests and page visits. Nothing is
// created, edited or deleted, so the checks are safe to run on production.
// Page checks open the app in a small same-origin popup (production sends
// X-Frame-Options: DENY, so an iframe would be blocked) and move it between
// routes with history.pushState, which keeps the popup's error hooks alive.

import { THEMES } from '../../../context/ThemeContext';
import { THEME_STYLES } from '../../../context/themeConstants';

export const IS_DEV = import.meta.env.DEV;

export const DEVICES = {
  mobile: { label: 'Mobile', width: 390, height: 844 },
  tablet: { label: 'Tablet', width: 820, height: 1000 },
  desktop: { label: 'Desktop', width: 1366, height: 900 },
};

export const SMOKE_ROUTES = [
  '/dashboard/quickstats', '/dashboard/routine', '/dashboard/semester-view', '/dashboard/zero-hour', '/dashboard/attendance',
  '/routine-templates', '/gradelab', '/resource-vault', '/notebook', '/cheat-sheets', '/question-bank',
  '/insideaust', '/community', '/connectbox', '/marketplace', '/austeddit',
  '/productivity', '/study-time', '/code-pulse', '/workspace', '/cover-page-generator', '/roast-cv', '/certificate',
  '/daily-life', '/takagelokoi', '/downtime', '/downtime?tab=gaming', '/shadow', '/wakemeup',
  '/settings', '/see-plans',
  '/admin-panel/overview', '/admin-panel/accounts', '/admin-panel/roles', '/admin-panel/academic',
  '/admin-panel/applications', '/admin-panel/canteen', '/admin-panel/features', '/admin-panel/availability',
  '/admin-panel/access-requests', '/admin-panel/flow-canvas',
];

const REDIRECTS = [
  ['/dashboard', '/dashboard/quickstats'], ['/analytics', '/gradelab'], ['/vault', '/resource-vault'],
  ['/cheatsheets', '/cheat-sheets'], ['/campus', '/insideaust'], ['/messages', '/connectbox'],
  ['/study-room', '/study-time'], ['/cp-hub', '/code-pulse'], ['/money-tracker', '/takagelokoi'],
  ['/question-bank-analyzer', '/question-bank'], ['/chill-zone', '/downtime'], ['/auto-alarm', '/wakemeup'],
  ['/pro', '/see-plans'], ['/gaming', '/downtime'], ['/admin-panel', '/admin-panel/overview'],
  ['/admin/users', '/admin-panel/accounts'], ['/admin/cr-sr-directory', '/admin-panel/representatives'],
  ['/admin/canteen', '/admin-panel/canteen'], ['/admin/role-preview', '/admin-panel/role-preview'],
];

// Endpoints that must refuse a request without the auth cookie.
const GUARDED_API = [
  '/api/auth/admin', '/api/ws-ticket', '/api/admin/users', '/api/admin/access-requests', '/api/admin/usage',
  '/api/admin/attendance', '/api/admin/academic/accounts', '/api/admin/semester-tasks', '/api/admin/bhara-koto',
  '/api/admin/cover-stats', '/api/telegram/users', '/api/telegram/connection', '/api/invites',
  '/api/passwords/list', '/api/grades', '/api/messages', '/api/user/settings', '/api/store/user',
  '/api/batch-drive/lock/me', '/api/batch-drive/admin/summary', '/api/streak/leaderboard',
  '/api/routines/shared/mine', '/api/role-applications', '/api/role-applications/mine', '/api/web-push/status',
  '/api/zero-hour/cr',
];

const SECRET_PATTERNS = [
  ['Stripe live key', /sk_live_[0-9a-zA-Z]{10,}/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['DB URL with password', /postgres(?:ql)?:\/\/[^\s"'`/:]+:[^\s"'`@]+@/],
  ['GitHub token', /gh[pousr]_[0-9A-Za-z]{36}/],
  ['Slack token', /xox[baprs]-[0-9A-Za-z-]{10,}/],
  ['Telegram bot token', /\b\d{8,10}:AA[0-9A-Za-z_-]{33}\b/],
  ['OpenAI key', /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/],
];

// ── tiny helpers ──────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const item = (label, status, detail = '') => ({ label, status, detail });
const worst = (items) => {
  if (!items.length) return 'skip';
  if (items.some((i) => i.status === 'fail')) return 'fail';
  if (items.some((i) => i.status === 'warn')) return 'warn';
  if (items.every((i) => i.status === 'skip')) return 'skip';
  return 'pass';
};
const summary = (items) => {
  const c = { pass: 0, fail: 0, warn: 0, skip: 0 };
  items.forEach((i) => { c[i.status] = (c[i.status] || 0) + 1; });
  return [c.pass && `${c.pass} pass`, c.fail && `${c.fail} fail`, c.warn && `${c.warn} warn`, c.skip && `${c.skip} skip`].filter(Boolean).join(' · ');
};
const done = (items, extra = {}) => ({ status: worst(items), detail: summary(items), items, ...extra });

// Enforced CSP passes only if scripts are locked down. Dev sends Report-Only
// (enforcing would break Vite HMR), which counts there but not in production.
function cspItem(enforced, reportOnly, soft) {
  const scriptSrc = (p) => p.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src')) || '';
  if (enforced) {
    const loose = !IS_DEV && /unsafe-inline|unsafe-eval/.test(scriptSrc(enforced));
    return item('Content-Security-Policy', loose ? 'warn' : 'pass',
      loose ? `script-src e unsafe-inline/eval ache: ${scriptSrc(enforced).slice(0, 100)}` : enforced.slice(0, 120));
  }
  if (reportOnly) {
    return item('Content-Security-Policy', IS_DEV ? 'pass' : 'warn',
      `${IS_DEV ? 'Report-Only (dev; production enforce kore)' : 'Report-Only — block korche na'} · ${reportOnly.slice(0, 90)}`);
  }
  return item('Content-Security-Policy', soft, 'missing');
}

async function getStatus(url, init) {
  try {
    const res = await fetch(url, { cache: 'no-store', ...init });
    return { status: res.status, res };
  } catch (error) {
    return { status: 0, error: error.message };
  }
}

// ── colour maths for the theme test ───────────────────────────────────────

function parseRgb(value) {
  const m = String(value).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
}
const over = (top, under) => ({
  r: top.r * top.a + under.r * (1 - top.a),
  g: top.g * top.a + under.g * (1 - top.a),
  b: top.b * top.a + under.b * (1 - top.a),
  a: 1,
});
function luminance({ r, g, b }) {
  const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// ── probe popup ───────────────────────────────────────────────────────────

let probe = null;
let probeFrame = null;

// Dev: the probe is a hidden same-origin iframe sized like the device (the dev
// server sends X-Frame-Options SAMEORIGIN). Production sends DENY, so there it
// is a small popup window instead.
const USE_FRAME = IS_DEV;

// Dev only: carry this page's ?mockRole= into probe visits so a dev run without
// a real login still sees the app as that role.
const parentMock = () => (IS_DEV ? new URLSearchParams(window.location.search).get('mockRole') : null);
function carryMock(path) {
  const role = parentMock();
  if (!role || path.includes('mockRole=')) return path;
  return `${path}${path.includes('?') ? '&' : '?'}mockRole=${encodeURIComponent(role)}`;
}

function instrument(w) {
  if (w.__awQa) return;
  w.__awQa = { errors: [], warnings: [], failed: [], paths: [] };
  const log = w.__awQa;
  // Every URL the app moves through (redirect chains), not just where it ends.
  ['pushState', 'replaceState'].forEach((fn) => {
    const orig = w.history[fn].bind(w.history);
    w.history[fn] = (st, title, url) => {
      orig(st, title, url);
      try { log.paths.push(new w.URL(url ?? w.location.href, w.location.href).pathname); } catch { /* ignore */ }
    };
  });
  const origError = w.console.error.bind(w.console);
  w.console.error = (...args) => {
    log.warnings.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ').slice(0, 240));
    origError(...args);
  };
  w.addEventListener('error', (e) => { log.errors.push(String(e.message || 'Script error').slice(0, 240)); });
  w.addEventListener('unhandledrejection', (e) => { log.errors.push(`Unhandled promise: ${String(e.reason?.message || e.reason).slice(0, 200)}`); });
  const origFetch = w.fetch.bind(w);
  w.fetch = async (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    try {
      const res = await origFetch(...args);
      if (res.status >= 500) log.failed.push(`${res.status} ${url}`);
      return res;
    } catch (error) {
      if (error?.name !== 'AbortError') log.failed.push(`network ${url}`);
      throw error;
    }
  };
}

async function waitFor(check, timeout = 15000, step = 150) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if (check()) return true; } catch { /* popup mid-navigation */ }
    await sleep(step);
  }
  return false;
}

// Boot screen (auth check / logged-out Suspense) and page spinners. While the
// boot screen shows, no routes render, so the URL hasn't been guarded yet.
const LOADING_SELECTOR = '.app-boot-loading, .page-loading-spinner';
const appReady = (w) => w.document?.readyState === 'complete'
  && w.document.getElementById('root')?.children.length > 0
  && !w.document.querySelector(LOADING_SELECTOR);

export async function openProbe(device = 'desktop') {
  const d = DEVICES[device] || DEVICES.desktop;
  const features = `popup=yes,width=${d.width},height=${d.height},left=40,top=40`;
  if (USE_FRAME) {
    if (probeFrame?.isConnected && probe?.__awQa) {
      probeFrame.style.width = `${d.width}px`;
      probeFrame.style.height = `${d.height}px`;
      await sleep(250);
      return probe;
    }
    probeFrame = document.createElement('iframe');
    probeFrame.title = 'QA test window';
    probeFrame.setAttribute('aria-hidden', 'true');
    probeFrame.tabIndex = -1;
    Object.assign(probeFrame.style, {
      position: 'fixed', left: '-20000px', top: '0', width: `${d.width}px`, height: `${d.height}px`,
      border: '0', opacity: '0', pointerEvents: 'none',
    });
    probeFrame.src = carryMock('/dashboard/quickstats');
    document.body.appendChild(probeFrame);
    probe = probeFrame.contentWindow;
  } else {
    if (probe && !probe.closed) {
      try { probe.resizeTo(d.width, d.height); } catch { /* ignore */ }
      if (probe.__awQa) return probe;
    }
    probe = window.open('/dashboard/quickstats', 'aw-qa-probe', features);
    if (!probe) throw new Error('Popup block hoyeche — browser er address bar theke ei site er popup allow koro.');
  }
  const ok = await waitFor(() => appReady(USE_FRAME ? probeFrame.contentWindow : probe), 25000);
  if (USE_FRAME) probe = probeFrame.contentWindow;
  if (!ok) throw new Error('Test window load hoyni (25s).');
  instrument(probe);
  await settle(probe);
  return probe;
}

export function closeProbe() {
  if (probeFrame) { probeFrame.remove(); probeFrame = null; } else if (probe && !probe.closed) probe.close();
  probe = null;
}

async function settle(w, timeout = 9000) {
  let last = Date.now();
  const obs = new w.MutationObserver(() => { last = Date.now(); });
  obs.observe(w.document.body, { childList: true, subtree: true, attributes: true });
  const start = Date.now();
  await waitFor(() => {
    const loading = w.document.querySelector(LOADING_SELECTOR);
    return !loading && Date.now() - last > 700;
  }, timeout, 120);
  obs.disconnect();
  return Date.now() - start;
}

async function navigate(w, path) {
  const log = w.__awQa;
  log.errors = []; log.warnings = []; log.failed = []; log.paths = [];
  w.history.pushState({ idx: Date.now() }, '', path);
  w.dispatchEvent(new w.PopStateEvent('popstate', { state: w.history.state }));
  await sleep(60);
  return settle(w);
}

const crashed = (w) => /Something went wrong while loading this page/.test(w.document.body?.innerText || '');

async function recover(w) {
  w.__awQa = null;
  w.location.reload();
  await sleep(300);
  await waitFor(() => appReady(w), 25000);
  instrument(w);
  await settle(w);
}

function describe(el) {
  if (!el) return '';
  const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
  return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls ? `.${cls}` : ''}`;
}

function overflowCulprit(w) {
  const vw = w.document.documentElement.clientWidth;
  let culprit = null; let widest = vw;
  const all = w.document.body.querySelectorAll('*');
  for (let i = 0; i < all.length && i < 4000; i += 1) {
    const r = all[i].getBoundingClientRect();
    if (r.right > widest + 1 && r.width > 0) {
      const pos = w.getComputedStyle(all[i]).position;
      if (pos !== 'fixed') { widest = r.right; culprit = all[i]; }
    }
  }
  return culprit ? `${describe(culprit)} (${Math.round(widest)}px)` : '';
}

function gradientCount(w) {
  let count = 0; let sample = '';
  const all = w.document.body.querySelectorAll('*');
  for (let i = 0; i < all.length && i < 4000; i += 1) {
    const el = all[i];
    if (el.closest('.dl-head, .landing-page, .floating-bg, .floating-background, canvas')) continue;
    const bg = w.getComputedStyle(el).backgroundImage;
    if (bg && bg.includes('gradient')) { count += 1; if (!sample) sample = describe(el); }
  }
  return { count, sample };
}

function checkPage(w, path, ms) {
  const want = path.split('?')[0];
  const got = w.location.pathname;
  const notes = [];
  let status = 'pass';
  const bump = (s) => { if (s === 'fail' || (s === 'warn' && status === 'pass')) status = s; };

  if (crashed(w)) { bump('fail'); notes.push('Page crash (error boundary)'); }
  if (got !== want && !got.startsWith(`${want}/`)) {
    const hop = (w.__awQa?.paths || []).find((p) => p !== want && p.startsWith(`${want}/`));
    if (hop && parentMock()) {
      // The page moved to its own sub-route without the query, so the dev
      // ?mockRole= was lost and the logged-out probe got bounced.
      bump('warn');
      notes.push(`${hop} e gelo, tarpor ${got} (dev: mockRole hariye geche — real login e abar dekho)`);
    } else {
      bump(['/', '/dashboard/quickstats', '/login'].includes(got) ? 'fail' : 'warn');
      notes.push(`Redirect → ${got}`);
    }
  }
  const log = w.__awQa;
  if (log.errors.length) { bump('fail'); notes.push(`JS error: ${log.errors[0]}${log.errors.length > 1 ? ` (+${log.errors.length - 1})` : ''}`); }
  if (log.failed.length) { bump('fail'); notes.push(`Request fail: ${log.failed[0]}${log.failed.length > 1 ? ` (+${log.failed.length - 1})` : ''}`); }
  if (log.warnings.length) { bump('warn'); notes.push(`console.error: ${log.warnings[0]}${log.warnings.length > 1 ? ` (+${log.warnings.length - 1})` : ''}`); }
  const doc = w.document.documentElement;
  if (doc.scrollWidth > doc.clientWidth + 1) { bump('fail'); notes.push(`Sideways scroll ${doc.scrollWidth}px > ${doc.clientWidth}px: ${overflowCulprit(w)}`); }
  const g = gradientCount(w);
  if (g.count) { bump('warn'); notes.push(`${g.count} gradient (e.g. ${g.sample})`); }
  if (ms > 6000) { bump('warn'); notes.push(`Slow: ${(ms / 1000).toFixed(1)}s`); }
  return item(path, status, notes.join(' · ') || `${(ms / 1000).toFixed(1)}s`);
}

// ── tests ─────────────────────────────────────────────────────────────────

export const AUTO_TESTS = [
  {
    id: 'env',
    title: 'Environment & session',
    why: 'Kon build e acho, login thik ache, server admin bole mane kina.',
    async run() {
      const items = [];
      items.push(item('Build mode', IS_DEV ? 'warn' : 'pass', IS_DEV ? 'Development build — final run production e koro' : 'Production build'));
      items.push(item('HTTPS', location.protocol === 'https:' ? 'pass' : (IS_DEV ? 'skip' : 'fail'), location.origin));
      const me = await getStatus('/api/auth/me', { credentials: 'same-origin' });
      items.push(item('Session (/api/auth/me)', me.status === 200 ? 'pass' : 'fail', `HTTP ${me.status || me.error}`));
      const adm = await getStatus('/api/auth/admin', { credentials: 'same-origin' });
      items.push(item('Server admin verify (/api/auth/admin)', adm.status === 200 ? 'pass' : 'fail', `HTTP ${adm.status || adm.error}`));
      for (const url of ['/api/page-availability', '/api/role-access/map', '/api/notices']) {
        const r = await getStatus(url, { credentials: 'same-origin' });
        items.push(item(`Public data ${url}`, r.status === 200 ? 'pass' : 'fail', `HTTP ${r.status || r.error}`));
      }
      let bytes = 0;
      try { for (let i = 0; i < localStorage.length; i += 1) { const k = localStorage.key(i); bytes += (k.length + (localStorage.getItem(k) || '').length) * 2; } } catch { /* ignore */ }
      const mb = bytes / 1048576;
      items.push(item('localStorage size', mb > 4 ? 'fail' : mb > 2.5 ? 'warn' : 'pass', `${mb.toFixed(2)} MB (limit ~5 MB)`));
      return done(items);
    },
  },
  {
    id: 'api-guard',
    title: 'API auth guard',
    why: 'Login chara (cookie chara) protected API call korle 401/403 ashte hobe.',
    async run({ onProgress }) {
      const items = [];
      for (let i = 0; i < GUARDED_API.length; i += 1) {
        const url = GUARDED_API[i];
        onProgress?.(i + 1, GUARDED_API.length);
        const r = await getStatus(url, { credentials: 'omit' });
        let status = 'fail';
        if (r.status === 401 || r.status === 403) status = 'pass';
        else if (r.status === 404 || r.status === 405 || r.status >= 500 || r.status === 0) status = 'warn';
        items.push(item(url, status, r.status === 200 ? 'HTTP 200 — login chara data dicche!' : `HTTP ${r.status || r.error}`));
      }
      return done(items);
    },
  },
  {
    id: 'headers',
    title: 'Security headers',
    why: 'Clickjacking, MIME sniffing, HTTPS force — server header pathacche kina.',
    async run() {
      const r = await getStatus('/', { credentials: 'same-origin' });
      if (!r.res) return { status: 'fail', detail: `Request fail: ${r.error}`, items: [] };
      const h = (k) => r.res.headers.get(k);
      const soft = IS_DEV ? 'warn' : 'fail';
      const items = [
        item('X-Content-Type-Options', h('x-content-type-options') === 'nosniff' ? 'pass' : soft, h('x-content-type-options') || 'missing'),
        item('X-Frame-Options', h('x-frame-options') ? 'pass' : soft, h('x-frame-options') || 'missing'),
        cspItem(h('content-security-policy'), h('content-security-policy-report-only'), soft),
        item('Strict-Transport-Security', h('strict-transport-security') ? 'pass' : (location.protocol === 'https:' ? 'fail' : 'skip'), h('strict-transport-security') || (location.protocol === 'https:' ? 'missing' : 'HTTP e lage na')),
        item('Referrer-Policy', h('referrer-policy') ? 'pass' : 'warn', h('referrer-policy') || 'missing'),
      ];
      if (IS_DEV) items.unshift(item('Note', 'skip', 'Dev server er header production theke alada — production URL e abar chalao'));
      return done(items);
    },
  },
  {
    id: 'secrets',
    title: 'Bundle secret scan',
    why: 'Browser e jawa JS file e kono secret key / DB password leak hocche kina.',
    async run({ onProgress }) {
      const items = [];
      const envLeaks = Object.keys(import.meta.env).filter((k) => /SECRET|PRIVATE|PASSWORD|TOKEN|DATABASE/i.test(k));
      items.push(item('VITE_ env names', envLeaks.length ? 'fail' : 'pass', envLeaks.length ? `Secret-er moto nam: ${envLeaks.join(', ')}` : 'Kono secret-er moto env nai'));
      const urls = new Set();
      document.querySelectorAll('script[src]').forEach((s) => urls.add(s.src));
      performance.getEntriesByType('resource').forEach((e) => { if (/\.(m?js|jsx)(\?|$)/.test(e.name)) urls.add(e.name); });
      const list = [...urls].filter((u) => u.startsWith(location.origin) && !/node_modules|\/@vite\/|\/@react-refresh/.test(u)).slice(0, 150);
      let hits = 0;
      for (let i = 0; i < list.length; i += 1) {
        onProgress?.(i + 1, list.length);
        try {
          const text = await (await fetch(list[i], { cache: 'force-cache' })).text();
          for (const [name, re] of SECRET_PATTERNS) {
            const m = text.match(re);
            if (m) { hits += 1; items.push(item(new URL(list[i]).pathname, 'fail', `${name}: ${m[0].slice(0, 8)}…`)); }
          }
        } catch { /* ignore unreadable file */ }
      }
      items.push(item(`${list.length} JS file scan`, hits ? 'fail' : 'pass', hits ? `${hits} ta sondehojonok jinish` : 'Kichu pawa jayni'));
      return done(items);
    },
  },
  {
    id: 'themes',
    title: 'Theme contrast',
    why: 'Protita theme e lekha background er upor porte jay kina (WCAG contrast).',
    async run({ onProgress }) {
      await Promise.all(Object.values(THEME_STYLES).map((load) => load().catch(() => {})));
      const items = [];
      const host = document.createElement('div');
      host.setAttribute('aria-hidden', 'true');
      host.style.cssText = 'position:fixed;left:-9999px;top:0;width:10px;height:10px;visibility:hidden;';
      document.body.appendChild(host);
      try {
        THEMES.forEach((theme, i) => {
          onProgress?.(i + 1, THEMES.length);
          const box = document.createElement('div');
          box.setAttribute('data-theme', theme);
          const probeEl = document.createElement('span');
          box.appendChild(probeEl);
          host.appendChild(box);
          const read = (prop, varName) => {
            probeEl.style.cssText = `${prop}: var(${varName});`;
            const cs = getComputedStyle(probeEl);
            return parseRgb(prop === 'color' ? cs.color : cs.backgroundColor);
          };
          const declared = getComputedStyle(box).getPropertyValue('--bg-card').trim();
          const white = { r: 255, g: 255, b: 255, a: 1 };
          const page = read('background-color', '--bg-primary');
          const base = page ? over(page, white) : white;
          const cardRaw = read('background-color', '--bg-card');
          const card = cardRaw ? over(cardRaw, base) : base;
          const ratio = (varName, bg) => { const c = read('color', varName); return c ? contrast(over(c, bg), bg) : 0; };
          const primary = ratio('--text-primary', card);
          const secondary = ratio('--text-secondary', card);
          const tertiary = ratio('--text-tertiary', card);
          const accent = ratio('--accent-amber', card);
          const onPage = ratio('--text-primary', base);
          const notes = [`text ${primary.toFixed(1)}`, `muted ${secondary.toFixed(1)}`, `faint ${tertiary.toFixed(1)}`, `accent ${accent.toFixed(1)}`];
          let status = 'pass';
          if (!declared) { status = 'fail'; notes.unshift('theme CSS load hoyni'); }
          if (primary < 4.5 || onPage < 4.5) status = 'fail';
          else if (secondary < 3) status = 'fail';
          else if (secondary < 4.5 || tertiary < 2.5 || accent < 3) status = status === 'fail' ? status : 'warn';
          items.push(item(theme, status, notes.join(' · ')));
          box.remove();
        });
      } finally {
        host.remove();
      }
      return done(items, { note: 'Rule: main text ≥ 4.5, muted ≥ 4.5 (fail < 3), accent ≥ 3, faint ≥ 2.5' });
    },
  },
  {
    id: 'smoke',
    title: 'Page smoke test',
    why: 'Protita page khule: crash, JS error, 5xx request, sideways scroll, gradient, slow load.',
    usesProbe: true,
    async run({ device, onProgress, shouldStop }) {
      const w = await openProbe(device);
      const items = [];
      for (let i = 0; i < SMOKE_ROUTES.length; i += 1) {
        if (shouldStop?.()) { items.push(item('Stopped', 'skip', 'Tumi thamiye diyecho')); break; }
        if (w.closed) { items.push(item('Test window', 'fail', 'Window bondho hoye geche')); break; }
        const path = SMOKE_ROUTES[i];
        onProgress?.(i + 1, SMOKE_ROUTES.length, path);
        const ms = await navigate(w, carryMock(path));
        items.push(checkPage(w, path, ms));
        if (crashed(w)) await recover(w);
      }
      const width = w.closed ? '' : `${w.document.documentElement.clientWidth}px`;
      return done(items, { note: `${DEVICES[device]?.label || device} window ${width} wide. Touch (pointer: coarse) emulate hoy na — real phone eo dekho.` });
    },
  },
  {
    id: 'redirects',
    title: 'Old URL redirects',
    why: 'Purono link (bookmark, share) notun page e jay kina.',
    usesProbe: true,
    async run({ device, onProgress }) {
      const w = await openProbe(device);
      const items = [];
      for (let i = 0; i < REDIRECTS.length; i += 1) {
        const [from, to] = REDIRECTS[i];
        onProgress?.(i + 1, REDIRECTS.length, from);
        await navigate(w, carryMock(from));
        const got = w.location.pathname;
        const reached = got === to || w.__awQa.paths.includes(to);
        const detail = got === to ? 'OK' : reached ? `OK, tarpor ${got} (login/role guard)` : `Gelo ${got}`;
        items.push(item(`${from} → ${to}`, reached ? 'pass' : 'fail', detail));
      }
      return done(items);
    },
  },
  {
    id: 'roles',
    title: 'Role guard (admin pages)',
    why: IS_DEV
      ? 'Dev e ?mockRole= diye protita role er moto admin panel khule dekhe — admin/moderator chara keu dhukte parbe na.'
      : 'Production e ?mockRole= kaj kora uchit na — mock role diye admin panel lock hoye gele bujhbo mock role chalu ache.',
    usesProbe: true,
    async run({ device, onProgress }) {
      const w = await openProbe(device);
      const items = [];
      const target = '/admin-panel/overview';
      const cases = IS_DEV
        ? [['guest', false], ['student', false], ['cr', false], ['sr', false], ['faculty', false], ['alumni', false], ['alumni_with_carry', false], ['readd', false], ['gaming_mod', false], ['banned', false], ['moderator', true], ['admin', true]]
        : [['student', true], ['guest', true]];
      for (let i = 0; i < cases.length; i += 1) {
        const [role, shouldEnter] = cases[i];
        onProgress?.(i + 1, cases.length, role);
        await navigate(w, `${target}?mockRole=${role}`);
        const label = IS_DEV ? `${role} → admin panel` : `?mockRole=${role} ignored`;
        const onAdminPath = w.location.pathname.startsWith('/admin-panel');
        // URL alone isn't proof: while auth/guard is still loading the URL stays
        // on /admin-panel without the panel rendering. Count it only if it shows.
        const entered = onAdminPath && Boolean(w.document.querySelector('.admin-panel-container'));
        if (onAdminPath && !entered) {
          items.push(item(label, 'warn', 'Admin URL e roye geche kintu panel load hoyni (auth/guard slow) — abar chalao'));
          continue;
        }
        const ok = entered === shouldEnter;
        const detail = entered ? 'Dhukte parlo' : `Pathalo ${w.location.pathname}`;
        items.push(item(label, ok ? 'pass' : 'fail', detail));
      }
      await navigate(w, carryMock('/dashboard/quickstats'));
      if (!IS_DEV) {
        await navigate(w, '/admin-panel/role-preview');
        items.push(item('Role preview (admin)', w.location.pathname === '/admin-panel/role-preview' ? 'pass' : 'warn', w.location.pathname));
      }
      return done(items, { note: 'Logged-out + real account er role test: `npx playwright test roles`' });
    },
  },
];

export const CLI_COMMANDS = [
  { label: 'Shob Playwright test (logged-out + protita role)', cmd: 'npm run test:e2e' },
  { label: 'Shudhu mobile smoke', cmd: 'npx playwright test smoke --project=mobile' },
  { label: 'Theme screenshot + axe contrast', cmd: 'npx playwright test themes' },
  { label: 'HTML report khulo', cmd: 'npm run qa:report' },
  { label: 'Unit test', cmd: 'npm test' },
  { label: 'Dependency security', cmd: 'npm audit --omit=dev' },
];
