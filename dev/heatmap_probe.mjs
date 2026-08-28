// Crash diagnosis v8 — check crash state + capture with longer wait.
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { default: puppeteer } = require('C:/Users/PEPSi/AppData/Roaming/npm/node_modules/retool-cli/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js');

const BASE = 'http://localhost:5174';
const KEY = 'aust-helper-dept-heatmap-submissions-v1';

function makeSubmissions() {
  const subs = [];
  for (let i = 1; i <= 12; i++) {
    subs.push({
      contributorId: `contrib-${i}`,
      department: 'CSE',
      batchNo: '2026',
      semesters: { '1': 3.2 + (i % 5) * 0.1, '2': 3.0 + (i % 4) * 0.15 },
      updatedAt: new Date().toISOString(),
    });
  }
  return subs;
}

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

await page.evaluateOnNewDocument(() => {
  window.__crashLog = [];
  const origErr = console.error.bind(console);
  console.error = (...args) => {
    try {
      const serialized = args.map((a) => {
        if (a instanceof Error) return `${a.message}\n${(a.stack || '').slice(0, 900)}`;
        if (typeof a === 'string') return a.slice(0, 400);
        try { return JSON.stringify(a).slice(0, 300); } catch { return String(a).slice(0, 200); }
      }).join(' | ');
      window.__crashLog.push(serialized);
    } catch { /* ignore */ }
    origErr(...args);
  };
});

await page.setViewport({ width: 1280, height: 900 });
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
await page.evaluate(async () => {
  await fetch('/api/dev/switch-user', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'DEV-CSE-S1-BB2-02' }),
  });
});
await page.evaluate((key, subs) => {
  localStorage.setItem(key, JSON.stringify(subs));
}, KEY, makeSubmissions());

try {
  await page.goto(`${BASE}/analytics?tab=heatmap`, { waitUntil: 'networkidle2', timeout: 30000 });
} catch { /* ignore */ }

// poll up to 10s for either widget or crash
let crashed = false;
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const s = await page.evaluate(() => ({
    hasWidget: !!document.querySelector('.heatmap-widget'),
    crashShown: document.body.innerText.includes('Something went wrong'),
    logLen: window.__crashLog?.length || 0,
  })).catch(() => ({ gone: true }));
  if (s.gone) continue;
  if (s.crashShown || s.hasWidget) {
    console.log(`t+${(i + 1) * 500}ms: ${JSON.stringify(s)}`);
    crashed = s.crashShown;
    break;
  }
}

const crashLog = await page.evaluate(() => window.__crashLog || []).catch(() => []);
console.log('=== INTERCEPTED console.error ===');
crashLog.forEach((e) => console.log(e));
await browser.close().catch(() => {});
console.log(`DONE crashed=${crashed}`);
