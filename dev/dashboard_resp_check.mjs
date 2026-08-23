// Dashboard tab responsive probe — visits every dashboard focus tab at target
// widths, reports horizontal overflow + widest offenders, saves screenshots.
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { default: puppeteer } = require('C:/Users/PEPSi/AppData/Roaming/npm/node_modules/retool-cli/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js');

const BASE = 'http://localhost:5174';
const WIDTHS = [320, 375, 768, 1024, 1280];
const TABS = ['', 'stats', 'routine', 'calendar', 'exams', 'attendance'];

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 100)); });
page.on('pageerror', (e) => errors.push(String(e).slice(0, 100)));

await page.setViewport({ width: 1280, height: 900 });
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
await page.evaluate(() => {
  localStorage.setItem('aust-auth-session-v1', JSON.stringify({
    userId: 'STU-001', role: 'student', startedAt: new Date().toISOString(),
  }));
  localStorage.setItem('aust-user-profile', JSON.stringify({
    id: 'STU-001', name: 'Test Student', email: 'stu@aust.edu',
    role: 'student', roles: ['student'], department: 'CSE',
    batch: '55', section: 'B2', yearSemester: 'Year 2 - Semester 1',
    labSection: 'B2',
  }));
});

for (const tab of TABS) {
  const url = `${BASE}/${tab ? `?tab=${tab}` : ''}`;
  for (const w of WIDTHS) {
    await page.setViewport({ width: w, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await page.waitForSelector('.dashboard-page', { timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 800));

    const res = await page.evaluate(() => {
      const docEl = document.documentElement;
      const over = docEl.scrollWidth - docEl.clientWidth;
      // Find widest offenders inside the page wrapper
      const bad = [];
      if (over > 1) {
        const cw = docEl.clientWidth;
        document.querySelectorAll('.dashboard-page *').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.right > cw + 1 && r.width > 8) {
            bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} w=${Math.round(r.width)} right=${Math.round(r.right)}`);
          }
        });
      }
      return { over, offenders: [...new Set(bad)].slice(0, 5) };
    });

    const flag = res.over > 1 ? ` OVER+${res.over}px` : '';
    console.log(`tab=${tab || 'default'} @${w}px:${flag}${res.offenders.length ? ` | ${res.offenders.join(' ; ')}` : ''}`);

    if ([320, 768, 1280].includes(w)) {
      const tag = `dash_${tab || 'stats'}-${w}`;
      await page.screenshot({ path: `dev/${tag}.png` });
    }
  }
}
if (errors.length) console.log('console errors:', [...new Set(errors)].slice(0, 5));
await browser.close();
console.log('DONE');
