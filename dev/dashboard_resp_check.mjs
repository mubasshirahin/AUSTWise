// Dashboard responsive probe v2 — REAL sessions via dev switch-user endpoint
// (cookie auth; localStorage seeding never authenticates). Visits every tab,
// admin widgets, leaderboard modal, and landscape orientations.
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { default: puppeteer } = require('C:/Users/PEPSi/AppData/Roaming/npm/node_modules/retool-cli/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js');

const BASE = 'http://localhost:5174';
const STUDENT_ID = 'DEV-CSE-S1-BB2-02'; // plain student, section B lab B2
const CR_ID = 'DEV-CSE-S1-AA1-01';      // class representative

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

async function login(userId) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  const status = await page.evaluate(async (id) => {
    const r = await fetch('/api/dev/switch-user', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    });
    return r.status;
  }, userId);
  if (status !== 200) throw new Error(`switch-user failed: ${status} (${userId})`);
}

async function measure(label, url, width, height, extra, shot) {
  await page.setViewport({ width, height });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await page.waitForSelector('.dashboard-page', { timeout: 15000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 900));
  if (extra) await extra();
  const res = await page.evaluate(() => {
    const docEl = document.documentElement;
    const over = docEl.scrollWidth - docEl.clientWidth;
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
  console.log(`${label} @${width}x${height}:${flag}${res.offenders.length ? ` | ${res.offenders.join(' ; ')}` : ''}`);
  if (shot) await page.screenshot({ path: `dev/${shot}.png` });
}

// ── Student tabs ──
await login(STUDENT_ID);
for (const tab of ['', 'stats', 'routine', 'calendar', 'exams', 'attendance']) {
  for (const [w, h] of [[320, 800], [768, 1024], [1280, 900]]) {
    await measure(`${tab || 'default'}`, `${BASE}/${tab ? `?tab=${tab}` : ''}`, w, h);
  }
}
await measure('routine-320', `${BASE}/?tab=routine`, 320, 800, null, 'dashv2_routine-320');
await measure('attendance-320', `${BASE}/?tab=attendance`, 320, 800, null, 'dashv2_attendance-320');

// ── CR view of routine (publish/share buttons visible) ──
await login(CR_ID);
await measure('cr routine', `${BASE}/?tab=routine`, 320, 800);

// ── Leaderboard modal with real session ──
await login(STUDENT_ID);
for (const [w, h] of [[320, 800], [375, 800]]) {
  await page.setViewport({ width: w, height: h });
  await page.goto(`${BASE}/?tab=stats`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await page.waitForSelector('.study-streak-widget', { timeout: 10000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 600));
  const res = await page.evaluate(async () => {
    const el = document.querySelector('.study-streak-widget');
    if (!el) return { widget: false };
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 500));
    const modal = document.querySelector('.leaderboard-modal');
    if (!modal) return { widget: true, modal: false };
    const mr = modal.getBoundingClientRect();
    let innerOver = 0;
    modal.querySelectorAll('*').forEach((n) => {
      const r = n.getBoundingClientRect();
      innerOver = Math.max(innerOver, Math.round(r.right - mr.right), Math.round(mr.left - r.left));
    });
    return { widget: true, modal: true, modalW: Math.round(mr.width), innerOver };
  });
  console.log(`leaderboard @${w}x${h}: ${JSON.stringify(res)}`);
  if (res.modal) await page.screenshot({ path: `dev/dashv2_leaderboard-${w}.png` });
}

// ── Landscape orientations ──
for (const tab of ['', 'routine', 'calendar', 'exams', 'attendance']) {
  await measure(`landscape ${tab || 'default'}`, `${BASE}/${tab ? `?tab=${tab}` : ''}`, 800, 360);
}
await login(CR_ID);
await measure('landscape cr routine', `${BASE}/?tab=routine`, 800, 360);

if (errors.length) console.log('pageerrors:', [...new Set(errors)].slice(0, 5));
await browser.close();
console.log('DONE');
