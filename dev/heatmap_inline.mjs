import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/PEPSi/AppData/Roaming/npm/node_modules/retool-cli/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js').default;

const b = await puppeteer.launch({ headless: true });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 500)));
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 300)); });
await p.setViewport({ width: 1280, height: 900 });
await p.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
await p.evaluate(async () => {
  await fetch('/api/dev/switch-user', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'DEV-CSE-S1-BB2-02' }) });
});
const subs = [];
for (let i = 1; i <= 12; i++) subs.push({ contributorId: 'c' + i, department: 'CSE', batchNo: '2026', semesters: { '1': 3.3, '2': 3.1 }, updatedAt: new Date().toISOString() });
await p.evaluate((k, s) => localStorage.setItem(k, JSON.stringify(s)), 'aust-helper-dept-heatmap-submissions-v1', subs);
try { await p.goto('http://localhost:5174/analytics?tab=heatmap', { waitUntil: 'networkidle2', timeout: 30000 }); } catch {}
await new Promise((r) => setTimeout(r, 4000));
console.log('state:', JSON.stringify(await p.evaluate(() => ({ w: !!document.querySelector('.heatmap-widget'), crash: document.body.innerText.includes('Something went wrong') })).catch(() => ({ gone: true }))));
await b.close();
console.log('DONE');
