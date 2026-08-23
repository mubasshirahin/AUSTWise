// Phase 3c — final modal verification at settled state, all widths,
// with add-form fallback via empty cell click.
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { default: puppeteer } = require('C:/Users/PEPSi/AppData/Roaming/npm/node_modules/retool-cli/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js');

const BASE = 'http://localhost:5174';
const STUDENT_ID = 'DEV-CSE-S1-BB2-02';
const CR_ID = 'DEV-CSE-S1-AA1-01';

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

async function gotoRoutine(width, height) {
  await page.setViewport({ width, height });
  await page.goto(`${BASE}/?tab=routine`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await page.waitForSelector('.dashboard-page', { timeout: 15000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1200));
}

async function measureOpenModal(label) {
  const res = await page.evaluate(() => {
    const docEl = document.documentElement;
    const pageOver = docEl.scrollWidth - docEl.clientWidth;
    const modal = [...document.querySelectorAll('.modal, .routine-edit-modal')]
      .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
    if (!modal) return { pageOver, noModal: true };
    const mr = modal.getBoundingClientRect();
    // settled-state check: scroll vs client width catches real clipping
    const hClip = modal.scrollWidth - modal.clientWidth;
    return { pageOver, modalW: Math.round(mr.width), hClip, vScrollable: modal.scrollHeight > modal.clientHeight + 2 };
  });
  console.log(`${label}: ${JSON.stringify(res)}`);
  return res;
}

async function openLoadRoutine() {
  return page.evaluate(() => {
    const b = document.querySelector('.load-routine-btn');
    if (!b) return false;
    b.click();
    return true;
  });
}

async function openAddForm() {
  const clicked = await page.evaluate(() => {
    // class block opens edit; empty-cell placeholder opens add — same modal shell
    const block = document.querySelector('.weekly-class-block');
    const empty = document.querySelector('.weekly-empty-cell > div');
    const target = block || empty;
    if (!target) return false;
    target.click();
    return true;
  });
  if (!clicked) return false;
  await new Promise((r) => setTimeout(r, 400));
  return page.evaluate(() =>
    !!document.querySelector('.routine-edit-modal') ||
    !!document.querySelector('.modal')
  );
}

// ── Load Routine modal ──
await login(STUDENT_ID);
for (const [w, h] of [[320, 800], [768, 1024], [1280, 900]]) {
  await gotoRoutine(w, h);
  if (await openLoadRoutine()) {
    await new Promise((r) => setTimeout(r, 800)); // let entrance animation settle
    await measureOpenModal(`load @${w}`);
    if (w === 320) await page.screenshot({ path: 'dev/dashv3_load-320.png' });
  } else {
    console.log(`load @${w}: OPEN-FAILED`);
  }
}

// ── Edit / Add class modal ──
for (const [w, h] of [[320, 800], [768, 1024]]) {
  await gotoRoutine(w, h);
  if (await openAddForm()) {
    await new Promise((r) => setTimeout(r, 600));
    await measureOpenModal(`addedit @${w}`);
    if (w === 320) await page.screenshot({ path: 'dev/dashv3_addedit-320.png' });
  } else {
    console.log(`addedit @${w}: NO-CELL`);
  }
}

// CR variant
await login(CR_ID);
await gotoRoutine(320, 800);
if (await openAddForm()) {
  await new Promise((r) => setTimeout(r, 600));
  await measureOpenModal('addedit @320 cr');
} else {
  console.log('addedit @320 cr: NO-CELL');
}

if (errors.length) console.log('pageerrors:', [...new Set(errors)].slice(0, 5));
await browser.close();
console.log('DONE');
