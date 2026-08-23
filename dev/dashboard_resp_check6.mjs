// Phase 6 — dark-theme + wide-viewport smoke.
// Theme is applied via <html data-theme="...">; we set it before load.
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { default: puppeteer } = require('C:/Users/PEPSi/AppData/Roaming/npm/node_modules/retool-cli/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js');

const BASE = 'http://localhost:5174';
const STUDENT_ID = 'DEV-CSE-S1-BB2-02';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

async function login(userId) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.evaluate(async (id) => {
    await fetch('/api/dev/switch-user', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    });
  }, userId);
}

async function probe(label, width, height) {
  await page.setViewport({ width, height });
  await page.goto(`${BASE}/?tab=stats`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await page.waitForSelector('.dashboard-page', { timeout: 15000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1200));
  const res = await page.evaluate(() => ({
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    theme: document.documentElement.getAttribute('data-theme'),
  }));
  console.log(`${label} @${width}x${height}: over=${res.over}px theme=${res.theme}`);
  if (res.over > 1) console.log('  ^ OVERFLOW!');
}

await login(STUDENT_ID);

// discover current theme, test representative themes
await page.goto(`${BASE}/?tab=stats`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
const themes = await page.evaluate(() => {
  const t = document.documentElement.getAttribute('data-theme');
  return [t, 'dark', 'midnight', 'sketchbook'].filter(Boolean);
});
console.log(`themes to test: ${[...new Set(themes)].join(', ')}`);

for (const theme of [...new Set(themes)]) {
  // set theme then reload
  await page.evaluate((t) => {
    localStorage.setItem('aust-theme', t);
    localStorage.setItem('theme', t);
  }, theme);
  await probe(`dark/${theme}`, 320, 800);
  await page.screenshot({ path: `dev/dashv6_${theme}-320.png` });
}

// wide viewport
await page.evaluate((t) => { localStorage.removeItem('aust-theme'); localStorage.removeItem('theme'); }, null);
for (const [w] of [[1920], [2560]]) {
  await probe('wide-default', w, 1000);
}

if (errors.length) console.log('pageerrors:', [...new Set(errors)].slice(0, 5));
await browser.close();
console.log('DONE');
