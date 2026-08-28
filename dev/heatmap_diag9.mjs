// Crash diagnosis v9 — get the REAL error via evaluateOnNewDocument hook
// that survives navigation, storing to sessionStorage.
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
  window.__errs = [];
  window.addEventListener('error', (e) => {
    window.__errs.push(`${e.message}\n${(e.error?.stack || '').slice(0, 600)}`);
  });
  const orig = console.error.bind(console);
  console.error = (...a) => {
    try { window.__errs.push(a.map((x) => (x instanceof Error ? `${x.message}\n${(x.stack || '').slice(0, 600)}` : typeof x === 'object' ? JSON.stringify(x)?.slice(0, 300) : String(x).slice(0, 300))).join(' | ')); } catch {}
    orig(...a);
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
await page.evaluate((key, subs) => localStorage.setItem(key, JSON.stringify(subs)), KEY, makeSubmissions());

await page.goto(`${BASE}/analytics?tab=heatmap`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 4000));

const errs = await page.evaluate(() => window.__errs || []).catch(() => ['CONTEXT-GONE']);
console.log('=== ERRORS ===');
errs.slice(0, 8).forEach((e) => console.log(e + '\n---'));
await browser.close().catch(() => {});
console.log('DONE');
