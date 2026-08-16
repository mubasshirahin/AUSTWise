import { chromium } from 'file:///C:/Users/PEPSi/.vscode/extensions/danielsanmedium.dscodegpt-3.24.48/standalone/node_modules/patchright/index.mjs';

const BASE = 'http://localhost:5198';
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  // Login via API — server sets an httpOnly cookie. The auth rate limiter
  // escalates its cooldown, so back off generously before each attempt.
  let login = { status: 0 };
  for (let i = 0; i < 4; i++) {
    if (i > 0) await page.waitForTimeout(32000);
    login = await page.evaluate(async () => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'mubasshir.cse.20230204026@aust.edu', password: '12345678' }),
      });
      return { status: res.status };
    });
    if (login.status === 200) break;
  }

  await page.goto(`${BASE}/daily-life?tab=bhara-koto`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const probe = await page.evaluate(() => ({
    url: location.pathname,
    hasDr: !!document.querySelector('.dr-widget'),
    hasMasthead: !!document.querySelector('.schedule-masthead'),
    bodyStart: document.body.innerText.slice(0, 80),
  }));
  let result = { login, probe };
  if (probe.hasDr && probe.hasMasthead) {
  result = await page.evaluate(() => {
    const m = document.querySelector('.dr-widget .schedule-masthead');
    const cs = getComputedStyle(m);
    const rules = [];
    for (const sheet of document.styleSheets) {
      let rs;
      try { rs = sheet.cssRules; } catch { continue; }
      if (!rs) continue;
      for (const r of rs) {
        if (r.selectorText && r.selectorText.includes('schedule-masthead') && (r.selectorText.includes('dr-widget') || r.selectorText.includes('sv-widget'))) {
          rules.push({ sel: r.selectorText, css: r.style.cssText.slice(0, 140) });
        }
      }
    }
    const stats = m.querySelector('.schedule-masthead-center');
    const actions = m.querySelector('.schedule-actions');
    const r = stats.getBoundingClientRect();
    const mr = m.getBoundingClientRect();
    return {
      gridCols: cs.gridTemplateColumns,
      padding: cs.padding,
      titleLeft: Math.round(m.querySelector('.schedule-title-block').getBoundingClientRect().left - mr.left),
      statsLeftGap: Math.round(r.left - mr.left),
      statsRightGap: Math.round(mr.right - r.right),
      statsCentered: Math.abs((r.left - mr.left) - (mr.right - r.right)) < 8,
      actionsRightGap: Math.round(mr.right - actions.getBoundingClientRect().right),
      border: cs.border,
      rules,
    };
  });

  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
