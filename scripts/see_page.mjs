export default async function run(page, ui) {
  const fakeUser = {
    id: 'u_repro_1', name: 'Repro User', email: 'repro@aust.edu',
    role: 'student', roles: ['student'], department: 'CSE', initials: 'RU',
  };
  await page.addInitScript((u) => {
    localStorage.setItem('aust-user-profile', JSON.stringify(u));
  }, fakeUser);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:5173/pro', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pro-benefit-swap', { timeout: 15000 });

  // Pause auto-cycle so screenshots are stable
  await page.evaluate(() => {
    document.querySelectorAll('.pro-swap-deck').forEach((d) => {
      d.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    });
  });

  const shots = [];
  // Scroll through: header(topbar) -> hero -> pricing -> why upgrade header -> why upgrade cards -> comparison
  const scrollTargets = [
    { name: 'top', y: 0 },
    { name: 'whyupgrade_header', y: null }, // section header
    { name: 'whyupgrade_cards', y: null },
  ];

  // Find the section header and cards positions
  const positions = await page.evaluate(() => {
    const header = document.querySelector('.pro-benefits-section .pro-section-header');
    const swap = document.querySelector('.pro-benefit-swap');
    return {
      headerTop: header ? header.getBoundingClientRect().top + window.scrollY : null,
      swapTop: swap ? swap.getBoundingClientRect().top + window.scrollY : null,
      docH: document.documentElement.scrollHeight,
    };
  });

  for (const t of scrollTargets) {
    let y = t.y;
    if (t.name === 'whyupgrade_header') y = Math.max(0, positions.headerTop - 80);
    if (t.name === 'whyupgrade_cards') y = Math.max(0, positions.swapTop - 80);
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `scripts/shot_${t.name}.png` });
    shots.push({ name: t.name, y });
  }

  return { positions, shots };
}
