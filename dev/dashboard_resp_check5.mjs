// Phase 5b — exam EDIT mode as CR (with injected routine) + notice form modal.
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { default: puppeteer } = require('C:/Users/PEPSi/AppData/Roaming/npm/node_modules/retool-cli/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js');

const BASE = 'http://localhost:5174';
const CR_ID = 'DEV-CSE-S1-AA1-01';

const ROUTINE = {
  Sunday: [
    { id: 't1', course: 'CSE-1201', name: 'Structured Programming', type: 'Theory', time: '08:00 - 08:50', room: 'R301', teacher: 'Dr. Rahman', color: '#3b82f6' },
    { id: 't2', course: 'MATH-1201', name: 'Differential Calculus', type: 'Theory', time: '09:40 - 10:30', room: 'M101', teacher: 'Prof. Akter', color: '#8b5cf6' },
  ],
  Monday: [
    { id: 't3', course: 'CSE-1202', name: 'Discrete Mathematics', type: 'Theory', time: '11:20 - 12:10', room: 'R305', teacher: 'Dr. Karim', color: '#10b981' },
  ],
  Tuesday: [], Wednesday: [], Thursday: [],
};

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

async function gotoTab(tab, width, height) {
  await page.setViewport({ width, height });
  await page.goto(`${BASE}/?tab=${tab}`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await page.waitForSelector('.dashboard-page', { timeout: 15000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));
}

async function measureModal(label) {
  const res = await page.evaluate(() => {
    const docEl = document.documentElement;
    const pageOver = docEl.scrollWidth - docEl.clientWidth;
    const modal = [...document.querySelectorAll('.modal, .routine-edit-modal')]
      .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
    if (!modal) return { pageOver, noModal: true };
    const mr = modal.getBoundingClientRect();
    const hClip = modal.scrollWidth - modal.clientWidth;
    const inputs = [...modal.querySelectorAll('input, textarea')].map((i) => `${i.tagName.toLowerCase()}:${Math.round(i.getBoundingClientRect().width)}px`);
    return { pageOver, modalW: Math.round(mr.width), hClip, inputs };
  });
  console.log(`${label}: ${JSON.stringify(res)}`);
  return res;
}

async function closeModal() {
  await page.evaluate(() => {
    const ov = document.querySelector('.modal-overlay');
    if (ov) ov.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 350));
}

await login(CR_ID);
await page.evaluate((routine) => {
  localStorage.setItem(`aust-user-routine-${'DEV-CSE-S1-AA1-01'}`, JSON.stringify(routine));
}, ROUTINE);

// ── Exam detail + EDIT mode as CR ──
for (const [w] of [[320], [768]]) {
  await gotoTab('exams', w, 800);
  const ok = await page.evaluate(() => {
    const el = document.querySelector('.exam-slot-item');
    if (!el) return false;
    el.click();
    return true;
  });
  if (!ok) { console.log(`exam @${w}: NO-SLOT-ITEM`); continue; }
  await new Promise((r) => setTimeout(r, 500));
  const editClicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.modal button')];
    const editBtn = btns.find((b) => (b.textContent || '').trim().toLowerCase() === 'edit');
    if (!editBtn) return false;
    editBtn.click();
    return true;
  });
  if (!editClicked) { console.log(`exam-edit @${w}: NO-EDIT-BTN`); continue; }
  await new Promise((r) => setTimeout(r, 500));
  const m = await measureModal(`exam-edit @${w}`);
  if (!m.noModal && w === 320) await page.screenshot({ path: 'dev/dashv5_exam_edit-320.png' });
  await closeModal();
}

// ── Notice form modal (CR: schedule-nav-btn inside notice widget) ──
await gotoTab('stats', 320, 800);
const clicked = await page.evaluate(() => {
  const area = document.querySelector('[class*="notice"]');
  if (!area) return false;
  const btn = area.querySelector('button.schedule-nav-btn');
  if (!btn) return false;
  btn.click();
  return true;
});
if (clicked) {
  await new Promise((r) => setTimeout(r, 600));
  const m = await measureModal('notice-form @320');
  if (!m.noModal) await page.screenshot({ path: 'dev/dashv5_notice-320.png' });
} else {
  console.log('notice-form @320: TRIGGER-NOT-FOUND');
}

if (errors.length) console.log('pageerrors:', [...new Set(errors)].slice(0, 5));
await browser.close();
console.log('DONE');
