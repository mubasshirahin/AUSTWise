export default async function run(page) {
  await page.goto('http://localhost:5174/');
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    localStorage.setItem('aust-auth-session-v1', JSON.stringify({
      userId: 'ADM-001', role: 'admin', startedAt: new Date().toISOString(),
    }));
    localStorage.setItem('aust-user-profile', JSON.stringify({
      id: 'ADM-001', name: 'System Administrator', email: 'admin@aust.edu',
      role: 'admin', roles: ['admin'], department: 'CSE',
    }));
  });
  await page.goto('http://localhost:5174/');
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    const nav = document.querySelector('.nav-item-premium');
    if (!nav) return { error: 'no .nav-item-premium' };
    const after = getComputedStyle(nav, '::after');
    return {
      labels: [...document.querySelectorAll('.nav-label')].map((e) => e.textContent.trim()),
      hasShine: after.content !== 'none' && after.backgroundImage !== 'none',
      shineBg: after.backgroundImage.slice(0, 60),
      beforeOpacity: getComputedStyle(nav, '::before').opacity,
    };
  });

  return info;
}