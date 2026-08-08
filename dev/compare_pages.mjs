// Screenshot DownTime vs Settings heroes and mastheads.
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
  await page.waitForSelector('.cz-hero', { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'dev/compare_downtime.png' });

  await page.goto('http://localhost:5173/settings');
  await page.waitForSelector('.st-hero', { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'dev/compare_settings.png' });
  return { done: true };
}