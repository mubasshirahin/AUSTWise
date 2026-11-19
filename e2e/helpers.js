import { expect } from '@playwright/test';

// Console errors that are expected for a logged-out visitor and not bugs:
// - the session probe answers 401 when there is no cookie (the client relies
//   on that 401 to drop a stale cached login), and the browser logs every 4xx;
// - Google Sign-In refuses to draw its button when the QA origin (e.g.
//   localhost:5174) isn't an authorised JavaScript origin on the OAuth client.
const GUEST_EXPECTED = [
  (text, url) => /\/api\/auth\/me(\?|$)/.test(url) && text.includes('status of 401'),
  (text, url) => url.startsWith('https://accounts.google.com/gsi/') && text.includes('status of 403'),
  (text) => text.startsWith('[GSI_LOGGER]: The given origin is not allowed'),
];

// Collects crashes, console errors and 5xx responses while a page is open.
// Pass { guest: true } on logged-out pages to skip the expected noise above.
export function watchErrors(page, { guest = false } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    const url = m.location()?.url || '';
    if (guest && GUEST_EXPECTED.some((match) => match(text, url))) return;
    errors.push(`console: ${text}${url ? ` (${url})` : ''}`);
  });
  page.on('response', (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
  return errors;
}

export async function expectNoHorizontalOverflow(page) {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  expect(scroll, 'page scrolls sideways').toBeLessThanOrEqual(width + 1);
}

export async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
}
