// Inspect the Organizing Area header in the Chill Zone tab.
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
  await page.waitForSelector('.cz-mst .schedule-masthead', { timeout: 15000 });
  await page.waitForTimeout(500);

  const info = await page.evaluate(() => {
    const m = document.querySelector('.cz-mst .schedule-masthead');
    const title = document.querySelector('.cz-mst .schedule-title');
    const over = document.querySelector('.cz-mst .schedule-overline');
    const sub = document.querySelector('.cz-mst .schedule-subtitle');
    return {
      masthead: !!m,
      overline: over?.textContent,
      title: title?.textContent,
      subtitle: sub?.textContent,
      divider: !!document.querySelector('.cz-mst .schedule-dotted-divider'),
      comingCard: !!document.querySelector('.cz-mst .cz-coming-card'),
    };
  });

  await page.screenshot({ path: 'dev/organizing_area.png' });
  return info;
}