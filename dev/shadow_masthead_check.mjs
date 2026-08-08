// Inspect mastheads across all Shadow page tabs.
export default async function run(page, ui) {
  await page.goto('http://localhost:5174/');
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    localStorage.setItem('aust-auth-session-v1', JSON.stringify({
      userId: 'ADM-001', role: 'admin', startedAt: new Date().toISOString(),
    }));
    localStorage.setItem('aust-user-profile', JSON.stringify({
      id: 'ADM-001', name: 'System Administrator', email: 'admin@aust.edu',
      role: 'admin', roles: ['admin'], department: 'CSE',
    }));
  });
  await page.goto('http://localhost:5174/shadow');
  await page.waitForSelector('.glider-tabs-track', { timeout: 20000 });
  await page.waitForTimeout(600);

  const report = {};
  const labels = ['Shadow Chat', 'Course Reviews', 'Buzz'];

  report.tabs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.glider-tab-label')).map((e) => e.textContent.trim()),
  );
  report.feedGone = await page.evaluate(() =>
    !Array.from(document.querySelectorAll('.glider-tab-label'))
      .some((e) => e.textContent.includes('Confessions')),
  );

  for (const lbl of labels) {
    const clicked = await page.evaluate((name) => {
      const tab = Array.from(document.querySelectorAll('.glider-tab'))
        .find((t) => t.querySelector('.glider-tab-label')?.textContent?.trim() === name);
      if (tab) { tab.click(); return true; }
      return false;
    }, lbl);
    await page.waitForTimeout(600);

    report[lbl] = await page.evaluate(() => {
      const area = document.querySelector('.shadow-content-area');
      const m = area?.querySelector(':scope > .schedule-masthead');
      return {
        tab: !!area,
        masthead: !!m,
        mastSibling: area ? [...area.children].some((c) => c.classList.contains('schedule-masthead')) : false,
        boxSibling: area ? [...area.children].some((c) => c.classList.contains('course-reviews-container')) : false,
        mastInsideBox: !!document.querySelector('.course-reviews-container .schedule-masthead'),
        overline: m?.querySelector('.schedule-overline')?.textContent?.trim(),
        title: m?.querySelector('.schedule-title')?.textContent?.trim(),
        subtitle: m?.querySelector('.schedule-subtitle')?.textContent?.trim()?.slice(0, 40),
        divider: !!area?.querySelector(':scope > .schedule-dotted-divider'),
        iconTile: !!m?.querySelector('.schedule-icon-tile svg'),
        actions: !!m?.querySelector('.schedule-actions'),
      };
    });
  }

  return report;
}