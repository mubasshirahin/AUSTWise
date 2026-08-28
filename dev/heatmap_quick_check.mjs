// Full check: seed data + auth, then verify heatmap.
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

await page.goto(`${BASE}/analytics?tab=heatmap`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 4000));
const s = await page.evaluate(() => ({
  hasWidget: !!document.querySelector('.heatmap-widget'),
  crashText: document.body.innerText.includes('Something went wrong'),
  rows: document.querySelectorAll('.hm-batch').length,
  activeTab: document.querySelector('.glider-tab.active .glider-tab-label')?.textContent || null,
  subtitle: document.querySelector('.schedule-subtitle')?.textContent || null,
})).catch((e) => ({ err: String(e).slice(0, 150) }));
console.log(JSON.stringify(s));
await page.screenshot({ path: 'dev/heatmap_state.png' }).catch(() => {});
await browser.close().catch(() => {});
console.log('DONE');
