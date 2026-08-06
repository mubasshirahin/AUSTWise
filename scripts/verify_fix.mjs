export default async function run(page, ui) {
  const fakeUser = { id: 'u_repro_1', name: 'Repro', email: 'r@aust.edu', role: 'student', roles: ['student'], department: 'CSE', initials: 'RU' };
  await page.addInitScript((u) => { localStorage.setItem('aust-user-profile', JSON.stringify(u)); }, fakeUser);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:5173/pro', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pro-benefit-swap', { timeout: 15000 });
  await page.locator('.pro-benefits-section').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.evaluate(() => { document.querySelectorAll('.pro-swap-deck').forEach(d => d.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))); });
  await page.waitForTimeout(300);

  const m = await page.evaluate(() => {
    const h = document.querySelector('.pro-benefits-section .pro-section-header').getBoundingClientRect();
    const layer = document.querySelector('.pro-swap-layer');
    const cards = [...document.querySelectorAll('.pro-swap-card')].map(c => { const r = c.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
    return {
      headerBottom: Math.round(h.bottom),
      minCardTop: Math.min(...cards.map(c => c.top)),
      maxCardBottom: Math.max(...cards.map(c => c.bottom)),
      layerTransform: layer ? getComputedStyle(layer).transform : null,
      pointerEvents: getComputedStyle(document.querySelector('.pro-swap-card')).pointerEvents,
      touchAction: getComputedStyle(document.querySelector('.pro-swap-deck')).touchAction,
    };
  });

  await page.screenshot({ path: 'scripts/final_check.png' });
  return m;
}
