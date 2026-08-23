// Phase 4d — exam detail modal (with injected theory courses) + CR add-task.
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { default: puppeteer } = require('C:/Users/PEPSi/AppData/Roaming/npm/node_modules/retool-cli/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js');

const BASE = 'http://localhost:5174';
const STUDENT_ID = 'DEV-CSE-S1-BB2-02';
const CR_ID = 'DEV-CSE-S1-AA1-01';

const ROUTINE = {
  Sunday: [
    { id: 't1', course: 'CSE-1201', name: 'Structured Programming', type: 'Theory', time: '08:00 - 08:50', room: 'R301', teacher: 'Dr. Rahman', color: '#3b82f6' },
    { id: 't2', course: 'MATH-1201', name: 'Differential Calculus', type: 'Theory', time: '09:40 - 10:30', room: 'M101', teacher: 'Prof. Akter', color: '#8b5cf6' },
  ],
  Monday: [
    { id: 't3', course: 'CSE-1202', name: 'Discrete Mathematics', type: 'Theory', time: '11:20 - 12:10', room: 'R305', teacher: 'Dr. Karim', color: '#10b981' },
  ],
  Tuesday: [],
  Wednesday: [],
  Thursday: [],
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

async function injectRoutine() {
  await page.evaluate((routine) => {
    localStorage.setItem('aust-user-routine-DEV-CSE-S1-BB2-02', JSON.stringify(routine));
  }, ROUTINE);
}

async function gotoTab(tab, width, height) {
  await page.setViewport({ width, height });
  await page.goto(`${BASE}/?tab=${tab}`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await page.waitForSelector('.dashboard-page', { timeout: 15000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1400));
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
    return { pageOver, modalW: Math.round(mr.width), hClip, vScrollable: modal.scrollHeight > modal.clientHeight + 2 };
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

// ── Exam detail modal (student with injected theory courses) ──
await login(STUDENT_ID);
await injectRoutine();
for (const [w, h] of [[320, 800], [768, 1024]]) {
  await gotoTab('exams', w, h);
  const ok = await page.evaluate(() => {
    const el = document.querySelector('.exam-slot-item');
    if (!el) return false;
    el.click();
    return true;
  });
  if (!ok) { console.log(`exam @${w}: NO-SLOT-ITEM (still empty?)`); continue; }
  await new Promise((r) => setTimeout(r, 500));
  const m = await measureModal(`exam @${w}`);
  if (!m.noModal && w === 320) await page.screenshot({ path: 'dev/dashv4_exam-320.png' });
  // also test edit mode (date input + textarea)
  const editOk = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.modal button')].find((x) => /edit/i.test(x.textContent || ''));
    if (!b) return false;
    b.click();
    return true;
  });
  if (editOk) {
    await new Promise((r) => setTimeout(r, 400));
    await measureModal(`exam-edit @${w}`);
  }
  await closeModal();
}

// ── Add Task modal (CR — canAddTask) ──
await login(CR_ID);
for (const [w, h] of [[320, 800], [768, 1024]]) {
  await gotoTab('calendar', w, h);
  const ok = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.schedule-add-btn')].find((b) => /add task/i.test(b.textContent || ''));
    if (!el) return false;
    el.click();
    return true;
  });
  if (!ok) { console.log(`addtask @${w}: NO-BTN`); continue; }
  await new Promise((r) => setTimeout(r, 500));
  const m = await measureModal(`addtask @${w}`);
  if (!m.noModal && w === 320) await page.screenshot({ path: 'dev/dashv4_addtask-320.png' });
  await closeModal();
}

if (errors.length) console.log('pageerrors:', [...new Set(errors)].slice(0, 5));
await browser.close();
console.log('DONE');
