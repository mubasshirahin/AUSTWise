export default async function run(page, ui) {
  await page.addInitScript(() => {
    localStorage.setItem('aust-user-profile', JSON.stringify({
      id: 'qa-visual-check', name: 'QA Visual', role: 'student',
      email: 'qa-visual@aust.edu', isGuest: false,
    }));
  });
  await page.goto('http://localhost:5173/');
  await page.waitForSelector('.nav-item-premium', { timeout: 20000 });
  const snap = await ui.snapshot();
  const seePlans = snap.match(/@(e\d+) link "See Plans"/)?.[1];
  if (!seePlans) return { ok: false, reason: 'no See Plans nav', snap };
  await ui.click(seePlans);
  await page.waitForSelector('.pro-hero', { timeout: 20000 });
  await page.waitForTimeout(1500);

  const p = 'C:/Users/PEPSi/AppData/Local/Temp/hero_gold.png';
  await page.locator('.pro-hero').screenshot({ path: p });
  return {
    ok: true,
    url: page.url(),
    hasMetrics: await page.locator('.pro-hero-metrics').count(),
    metricCount: await page.locator('.pro-hero-metric').count(),
    hasZeroCounters: await page.locator('.pro-stat-item, .pro-stat-value').count(),
    hasBadge: (await page.locator('.pro-hero-badge').innerText()).includes('Premium from'),
    shot: p,
  };
}
