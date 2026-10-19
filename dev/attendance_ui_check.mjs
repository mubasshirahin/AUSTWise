// Attendance tracker UI probe — captures the redesigned widget at several
// widths, expands a course row, and reports horizontal overflow.
import { createRequire } from 'module';
import { loginAs, primeOrigin } from './_session.mjs';

const require = createRequire(import.meta.url);
const { default: puppeteer } = require('C:/Users/PEPSi/AppData/Roaming/npm/node_modules/retool-cli/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js');

const BASE = 'http://localhost:5174';
const STUDENT_ID = 'DEV-CSE-S1-BB2-02';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setCacheEnabled(false);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)); });

await primeOrigin(page, BASE);
await loginAs(page, BASE, STUDENT_ID);

// The dev server's Prisma pool saturates under probe load — wait for it.
for (let i = 0; i < 30; i++) {
  const ok = await fetch(`${BASE}/api/courses`).then((r) => r.ok).catch(() => false);
  if (ok) break;
  await new Promise((r) => setTimeout(r, 1000));
}

// Warm-up: the first app boot after login can take a while to settle.
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`${BASE}/?tab=attendance`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
await page.waitForSelector('.att-row-head', { timeout: 25000 }).catch(() => {});

for (const [label, w, h] of [['1280', 1280, 900], ['768', 768, 1024], ['375', 375, 800], ['320', 320, 800]]) {
  await page.setViewport({ width: w, height: h });
  await page.goto(`${BASE}/?tab=attendance`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await page.waitForSelector('.attendance-tracker-widget', { timeout: 20000 }).catch(() => {});
  if (!(await page.$('.att-row-head'))) {
    // First paint after login can lag — reload once and wait again.
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await page.waitForSelector('.att-row-head', { timeout: 20000 }).catch(() => {});
  }
  await new Promise((r) => setTimeout(r, 1200));

  // Expand the first course row, switch to Edit mode and mark one session
  // present + one absent so the active states are captured too.
  await page.evaluate(() => {
    const head = document.querySelector('.att-row-head');
    if (head) head.click();
    const edit = document.querySelector('.att-mode-btn[aria-label="Edit attendance"]');
    if (edit) edit.click();
  });
  await new Promise((r) => setTimeout(r, 350));
  await page.evaluate(() => {
    const btns = document.querySelectorAll('.att-session .att-mark-btn.is-present');
    if (btns[0]) btns[0].click();
    const abs = document.querySelectorAll('.att-session .att-mark-btn.is-absent');
    if (abs[1]) abs[1].click();
    const el = document.querySelector('.attendance-tracker-widget');
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 76;
      window.scrollTo(0, y);
    }
  });
  await new Promise((r) => setTimeout(r, 700));

  const res = await page.evaluate(() => {
    const docEl = document.documentElement;
    const over = docEl.scrollWidth - docEl.clientWidth;
    const bad = [];
    if (over > 1) {
      const cw = docEl.clientWidth;
      document.querySelectorAll('.attendance-tracker-widget *').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right > cw + 1 && r.width > 8) {
          bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} w=${Math.round(r.width)} right=${Math.round(r.right)}`);
        }
      });
    }
    const w = document.querySelector('.attendance-tracker-widget');
    const rows = document.querySelectorAll('.att-row').length;
    const sessions = document.querySelectorAll('.att-session').length;
    // Any child wider than its parent (local overflow inside the widget)?
    let local = [];
    w?.querySelectorAll('*').forEach((el) => {
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === 'visible') {
        local.push(`${String(el.className).split(' ')[0]} sw=${el.scrollWidth} cw=${el.clientWidth}`);
      }
    });
    return {
      over, offenders: [...new Set(bad)].slice(0, 6),
      rows, sessions, local: [...new Set(local)].slice(0, 6),
      widgetW: w ? Math.round(w.getBoundingClientRect().width) : null,
      headText: document.querySelector('.att-sessions-head')?.textContent?.trim() || null,
      listMaxH: (() => {
        const l = document.querySelector('.att-session-list');
        return l ? getComputedStyle(l).maxHeight : null;
      })(),
      mast: (() => {
        const g = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().width) : null; };
        const t = document.querySelector('.schedule-title');
        return {
          masthead: g('.attendance-tracker-widget .schedule-masthead'),
          block: g('.att-masthead-title'),
          text: g('.att-masthead-text'),
          switch: g('.att-mode-switch'),
          titleScroll: t ? t.scrollWidth : null,
          titleClient: t ? t.clientWidth : null,
        };
      })(),
    };
  });

  console.log(`${label}: ${JSON.stringify(res)}`);
  await page.screenshot({ path: `dev/att_vp-${label}.png` });
  const el = await page.$('.attendance-tracker-widget');
  if (el) await el.screenshot({ path: `dev/att_ui-${label}.png` });
}

// ── Theme pass: the widget must re-skin with every theme ──
await page.setViewport({ width: 1280, height: 900 });
for (const theme of ['light', 'swiss', 'terminal']) {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('aust-theme', t);
  }, theme);
  await new Promise((r) => setTimeout(r, 600));
  const el = await page.$('.attendance-tracker-widget');
  if (el) await el.screenshot({ path: `dev/att_theme-${theme}.png` });
  console.log(`theme ${theme}: captured`);
}
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark');
  localStorage.setItem('aust-theme', 'dark');
});

if (errors.length) console.log('errors:', [...new Set(errors)].slice(0, 6));
await browser.close();
console.log('DONE');
