// Verify: heatmap page stable, no infinite sync→save→render loop, no crash.
// Seeds 12 submissions via the real shared-store API (as a logged-in user),
// then loads /analytics?tab=heatmap and watches console + network for 8s.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { default: puppeteer } = require('C:/Users/PEPSi/AppData/Roaming/npm/node_modules/retool-cli/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js');

const BASE = 'http://localhost:5174';
const KEY = 'aust-helper-dept-heatmap-submissions-v1';

function makeSubmissions() {
  const subs = [];
  const batches = ['2026', '2027', '2028'];
  for (let i = 1; i <= 12; i++) {
    subs.push({
      contributorId: `contrib-${i}`,
      department: 'CSE',
      batchNo: batches[i % 3],
      semesters: { '1': 3.2 + (i % 5) * 0.1, '2': 3.0 + (i % 4) * 0.15 },
      updatedAt: new Date().toISOString(),
    });
  }
  return subs;
}

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

await page.evaluateOnNewDocument(() => {
  window.__log = { errors: [], putCount: 0, getCount: 0 };
  const origErr = console.error.bind(console);
  console.error = (...args) => {
    window.__log.errors.push(args.map((a) => String(a?.message || a).slice(0, 200)).join(' | '));
    origErr(...args);
  };
  const of = window.fetch;
  window.fetch = (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    if (url.includes('/api/store/shared/')) {
      const m = String(args[1]?.method || 'GET').toUpperCase();
      if (m === 'PUT') window.__log.putCount += 1;
      if (m === 'GET') window.__log.getCount += 1;
    }
    return of(...args);
  };
});

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
await page.evaluate(async () => {
  await fetch('/api/dev/switch-user', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'DEV-CSE-S1-BB2-02' }),
  });
});
// Seed via the REAL api path so server state matches what a browser would do.
await page.evaluate(async (key, subs) => {
  await fetch(`/api/store/shared/${key}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: subs }),
  });
}, KEY, makeSubmissions());

try {
  await page.goto(`${BASE}/analytics?tab=heatmap`, { waitUntil: 'networkidle2', timeout: 30000 });
} catch { /* keep going */ }

await new Promise((r) => setTimeout(r, 8000));
const s = await page.evaluate(() => ({
  hasWidget: !!document.querySelector('.heatmap-widget'),
  crashShown: document.body.innerText.includes('Something went wrong'),
  rows: document.querySelectorAll('.hm-batch').length,
  subtitle: document.querySelector('.schedule-subtitle')?.textContent || null,
  errors: (window.__log?.errors || []).slice(0, 5),
  errorCount: window.__log?.errors.length || 0,
  sharedPuts: window.__log?.putCount ?? -1,
  sharedGets: window.__log?.getCount ?? -1,
})).catch((e) => ({ err: String(e).slice(0, 200) }));
console.log(JSON.stringify(s, null, 2));
await page.screenshot({ path: 'dev/heatmap_state.png' }).catch(() => {});
await browser.close().catch(() => {});

if (!s.hasWidget || s.crashShown || s.errorCount > 0 || s.sharedPuts > 3) {
  console.log('FAIL');
  process.exit(1);
}
console.log('PASS');
