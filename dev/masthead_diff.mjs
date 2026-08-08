// Compare DownTime masthead vs Settings Identity masthead computed styles.
export default async function run(page, ui) {
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    localStorage.setItem('aust-auth-session-v1', JSON.stringify({
      userId: 'ADM-001', role: 'admin', startedAt: new Date().toISOString(),
    }));
    localStorage.setItem('aust-user-profile', JSON.stringify({
      id: 'ADM-001', name: 'System Administrator', email: 'admin@aust.edu',
      role: 'admin', roles: ['admin'], department: 'CSE',
    }));
  });

  const props = ['backgroundImage', 'backgroundColor', 'border', 'borderTop', 'borderRadius', 'padding', 'margin', 'gridTemplateColumns', 'boxShadow'];

  const grab = () => window.__mastheads = window.__mastheads || {};

  // DownTime
  await page.goto('http://localhost:5173/chill-zone');
  await page.waitForSelector('.cz-mst .schedule-masthead', { timeout: 15000 });
  await page.waitForTimeout(300);
  const dt = await page.evaluate((ps) => {
    const m = document.querySelector('.cz-mst .schedule-masthead');
    const cs = getComputedStyle(m);
    const o = {};
    for (const p of ps) o[p] = cs[p];
    o.after = getComputedStyle(m, '::after').backgroundImage.slice(0, 80);
    o.tileW = m.querySelector('.schedule-icon-tile').getBoundingClientRect().width;
    return o;
  }, props);

  // Settings Identity
  await page.goto('http://localhost:5173/settings');
  await page.waitForSelector('.profile-panel-header', { timeout: 15000 });
  await page.waitForTimeout(300);
  const st = await page.evaluate((ps) => {
    const m = document.querySelector('.profile-panel-header');
    const cs = getComputedStyle(m);
    const o = {};
    for (const p of ps) o[p] = cs[p];
    o.after = getComputedStyle(m, '::after').backgroundImage.slice(0, 80);
    const tile = m.querySelector('.profile-identity-tile') || m.querySelector('.schedule-icon-tile');
    o.tileW = tile ? tile.getBoundingClientRect().width : 'no tile';
    return o;
  }, props);

  return { downtime: dt, settings: st };
}