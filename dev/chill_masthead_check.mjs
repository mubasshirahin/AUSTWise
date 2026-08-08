// Inspect mastheads across all ChillZone tabs.
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
  await page.goto('http://localhost:5173/chill-zone');
  await page.waitForSelector('.glider-tabs-track', { timeout: 15000 });
  await page.waitForTimeout(500);

  const report = {};

  const titles = ['Organizing Area', 'Media Tracker', 'Rumour or Real', 'Trivia', 'Gaming Zone'];

  for (const label of titles) {
    const clicked = await page.evaluate((lbl) => {
      const tab = Array.from(document.querySelectorAll('.glider-tab'))
        .find((t) => t.querySelector('.glider-tab-label')?.textContent === lbl);
      if (tab) { tab.click(); return true; }
      return false;
    }, label);
    if (!clicked) { report[label] = { error: 'tab not found' }; continue; }
    await page.waitForTimeout(500);

    report[label] = await page.evaluate(() => {
      const m = document.querySelector('.cz-mst .schedule-masthead');
      return {
        masthead: !!m,
        overline: m?.querySelector('.schedule-overline')?.textContent,
        title: m?.querySelector('.schedule-title')?.textContent,
        subtitle: m?.querySelector('.schedule-subtitle')?.textContent,
        divider: !!document.querySelector('.cz-mst .schedule-dotted-divider'),
        iconTile: !!m?.querySelector('.schedule-icon-tile svg'),
      };
    });
  }

  return report;
}