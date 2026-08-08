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
  return 'shadow page loaded';
}