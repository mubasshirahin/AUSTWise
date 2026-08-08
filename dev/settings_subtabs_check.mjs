// Inspect mastheads across all Settings subtabs.
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
  await page.goto('http://localhost:5173/settings');
  await page.waitForSelector('.glider-tabs-track', { timeout: 15000 });
  await page.waitForTimeout(500);

  const labels = ['Identity', 'UI', 'Notify Me', 'Credentials', 'Apply for CR/SR', 'Invite Member'];
  const report = {};

  for (const label of labels) {
    const clicked = await page.evaluate((lbl) => {
      const tab = Array.from(document.querySelectorAll('.glider-tab'))
        .find((t) => t.querySelector('.glider-tab-label')?.textContent === lbl);
      if (tab) { tab.click(); return true; }
      return false;
    }, label);
    if (!clicked) { report[label] = { error: 'tab not found' }; continue; }
    await page.waitForTimeout(500);

    report[label] = await page.evaluate(() => {
      const m = document.querySelector('.profile-panel-header.schedule-masthead .schedule-title-block');
      return {
        masthead: !!m,
        overline: m?.querySelector('.schedule-overline')?.textContent,
        title: m?.querySelector('.schedule-title')?.textContent,
        divider: !!document.querySelector('.schedule-dotted-divider'),
      };
    });
  }

  return report;
}