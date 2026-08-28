// Shadow chat stress probe — tests connection resilience:
// 1) initial connect  2) after HMR-style WS kill  3) two-browser match flow
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { default: puppeteer } = require('C:/Users/PEPSi/AppData/Roaming/npm/node_modules/retool-cli/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js');

const BASE = 'http://localhost:5174';

const browser = await puppeteer.launch({ headless: true });
const pageA = await browser.newPage();
const pageB = await browser.newPage();

async function setup(page) {
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
}

async function openChat(page, label) {
  await page.goto(`${BASE}/shadow?tab=chat`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await page.waitForSelector('.shadow-page', { timeout: 15000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));
  const state = await page.evaluate(() => ({
    badge: document.querySelector('.shadow-chat-status-badge')?.textContent?.trim() || null,
    joinDisabled: document.querySelector('.shadow-join-btn')?.disabled ?? null,
    hasError: !!document.querySelector('.shadow-chat-error'),
  }));
  console.log(`${label}: ${JSON.stringify(state)}`);
}

await setup(pageA);

// ── Test 1: initial ──
await openChat(pageA, 'T1 initial');

// ── Test 2: server-side socket close simulation (navigate away and back) ──
// Real-world disconnect trigger: laptop sleep / network blip. Client has NO
// reconnect logic, so badge should stay "Disconnected" forever after.
await pageA.evaluate(() => {
  // force-close the app WS by navigating within SPA (component unmount)
  window.history.pushState({}, '', '/analytics');
  window.dispatchEvent(new PopStateEvent('popstate'));
});
await new Promise((r) => setTimeout(r, 1000));
await pageA.evaluate(() => {
  window.history.pushState({}, '', '/shadow?tab=chat');
  window.dispatchEvent(new PopStateEvent('popstate'));
});
await new Promise((r) => setTimeout(r, 2500));
const t2 = await pageA.evaluate(() => ({
  badge: document.querySelector('.shadow-chat-status-badge')?.textContent?.trim() || null,
}));
console.log(`T2 remount: ${JSON.stringify(t2)}`);

// ── Test 3: full match flow with two pages ──
await setup(pageB);
await openChat(pageB, 'T3 B initial');

// A joins queue
await pageA.evaluate(() => {
  const btn = document.querySelector('.shadow-join-btn');
  if (btn && !btn.disabled) btn.click();
});
await new Promise((r) => setTimeout(r, 800));
const aQueued = await pageA.evaluate(() => document.body.innerText.includes('Finding a stranger'));
console.log(`T3 A queued: ${aQueued}`);

// B joins queue -> should match
await pageB.evaluate(() => {
  const btn = document.querySelector('.shadow-join-btn');
  if (btn && !btn.disabled) btn.click();
});
await new Promise((r) => setTimeout(r, 1500));
for (const [label, pg] of [['A', pageA], ['B', pageB]]) {
  const s = await pg.evaluate(() => ({
    matched: !!document.querySelector('.shadow-input-area'),
    timer: document.querySelector('.shadow-timer-text')?.textContent || null,
  }));
  console.log(`T3 ${label} matched: ${JSON.stringify(s)}`);
}

// message exchange
await pageA.evaluate(() => {
  const input = document.querySelector('.shadow-input');
  if (!input) return;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'hello stranger');
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
await pageA.evaluate(() => {
  [...document.querySelectorAll('.shadow-send-btn')].find((b) => !b.disabled)?.click();
});
await new Promise((r) => setTimeout(r, 800));
const bMsg = await pageB.evaluate(() =>
  [...document.querySelectorAll('.shadow-msg-bubble')].map((m) => m.textContent).slice(0, 3)
);
console.log(`T3 B received: ${JSON.stringify(bMsg)}`);

await browser.close();
console.log('DONE');
