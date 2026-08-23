// Responsive smoke check — drives the built-in puppeteer from retool-cli's
// global install. Seeds an admin session, visits pages at each target width,
// reports horizontal overflow + console errors, saves screenshots.
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { default: puppeteer } = require('C:/Users/PEPSi/AppData/Roaming/npm/node_modules/retool-cli/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js');

const BASE = 'http://localhost:5174';
const WIDTHS = [320, 375, 414, 768, 1024, 1280];
const PAGES = [
  ['/', '.page-wrapper'],
  ['/analytics', '.page-wrapper'],
  ['/campus', '.page-wrapper'],
  ['/vault', '.page-wrapper'],
];

const browser = await puppeteer.launch({ headless: true });

for (const [path, sel] of PAGES) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));

  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await page.evaluate(() => {
    localStorage.setItem('aust-auth-session-v1', JSON.stringify({
      userId: 'ADM-001', role: 'admin', startedAt: new Date().toISOString(),
    }));
    localStorage.setItem('aust-user-profile', JSON.stringify({
      id: 'ADM-001', name: 'System Administrator', email: 'admin@aust.edu',
      role: 'admin', roles: ['admin'], department: 'CSE',
    }));
  });

  for (const w of WIDTHS) {
    await page.setViewport({ width: w, height: 800 });
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await page.waitForSelector(sel, { timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 700));

    const res = await page.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sidebarVisible: (() => {
        const s = document.querySelector('.sidebar');
        return s ? getComputedStyle(s).display !== 'none' : false;
      })(),
      mobileNavVisible: (() => {
        const n = document.querySelector('.mobile-nav');
        return n ? getComputedStyle(n).display !== 'none' : false;
      })(),
      topbarLogoW: (() => {
        const l = document.querySelector('.topbar-logo-icon');
        return l ? Math.round(l.getBoundingClientRect().width) : null;
      })(),
    }));

    const flag = res.overflowX > 1 ? ` OVERFLOW+${res.overflowX}px` : '';
    console.log(`${path} @${w}px:${flag} sidebar=${res.sidebarVisible} mnav=${res.mobileNavVisible} logo=${res.topbarLogoW}px${errors.length ? ` ERRORS:${errors.length}` : ''}`);

    if ([320, 768, 1280].includes(w)) {
      const tag = `${path.replace(/\//g, '_') || '_home'}-${w}`;
      await page.screenshot({ path: `dev/resp_${tag}.png` });
    }
  }
  if (errors.length) console.log(`  ${path} console errors:`, [...new Set(errors)].slice(0, 3));
  await page.close();
}

await browser.close();
console.log('DONE');
