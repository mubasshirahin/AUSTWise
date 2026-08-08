// Inspect the Settings Identity masthead header.
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
  await page.waitForSelector('.profile-panel-header', { timeout: 15000 });
  await page.waitForTimeout(500);

  const panel = await page.evaluate(() => {
    const h = document.querySelector('.profile-panel-header');
    return {
      masthead: !!h?.querySelector('.schedule-title-block'),
      overline: h?.querySelector('.schedule-overline')?.textContent,
      title: h?.querySelector('.schedule-title')?.textContent,
      subtitle: h?.querySelector('.schedule-subtitle')?.textContent,
      iconTile: !!h?.querySelector('.profile-identity-tile svg'),
      saveActions: !!h?.querySelector('.profile-save-actions'),
    };
  });

  await page.screenshot({ path: 'dev/settings_identity.png' });
  return panel;
}