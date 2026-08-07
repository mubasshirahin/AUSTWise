// Inspect the InsideAUST glider tab bar area.
export default async function run(page, ui) {
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1200);

  // Seed a session in localStorage so the app believes we're authenticated.
  await page.evaluate(() => {
    localStorage.setItem('aust-auth-session-v1', JSON.stringify({
      userId: 'ADM-001', role: 'admin', startedAt: new Date().toISOString(),
    }));
    localStorage.setItem('aust-user-profile', JSON.stringify({
      id: 'ADM-001', name: 'System Administrator', email: 'admin@aust.edu',
      role: 'admin', roles: ['admin'], department: 'CSE',
    }));
  });

  await page.goto('http://localhost:5173/campus');
  await page.waitForSelector('.glider-tabs-track', { timeout: 15000 });
  await page.waitForTimeout(800);

  const info = await page.evaluate(() => {
    const track = document.querySelector('.glider-tabs-track');
    const wrap = document.querySelector('.glider-tabs-wrap');
    const tabsCard = document.querySelector('.cp-tabs-card');
    const glider = document.querySelector('.glider-tabs-glider');
    const tab = document.querySelector('.glider-tab.active');
    const contentCard = document.querySelector('.cp-content-card');

    const rectOf = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        x: Math.round(r.x), y: Math.round(r.y),
        w: Math.round(r.width), h: Math.round(r.height),
        bottom: Math.round(r.bottom),
        bg: cs.backgroundImage.includes('gradient') ? 'gradient' : cs.backgroundColor,
        borderBottom: cs.borderBottom,
        borderTop: cs.borderTop,
        boxShadow: cs.boxShadow.slice(0, 90),
      };
    };

    const underLines = [];
    const trackBottom = track ? track.getBoundingClientRect().bottom : 0;
    const cardBottom = tabsCard ? tabsCard.getBoundingClientRect().bottom : 0;
    const all = document.querySelectorAll('*');
    for (const el of all) {
      if (el === track || el === wrap || el === tabsCard || el === glider) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 100 || r.height < 1 || r.height > 6) continue;
      const cs = getComputedStyle(el);
      const isUnder = (r.top > trackBottom - 4 && r.top < trackBottom + 40) || (r.top > cardBottom - 4 && r.top < cardBottom + 40);
      if (isUnder) {
        underLines.push({
          tag: el.tagName,
          cls: (el.className || '').toString().slice(0, 70),
          top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width),
          bg: cs.backgroundColor, borderTop: cs.borderTop, borderBottom: cs.borderBottom,
        });
      }
    }

    return {
      track: rectOf(track),
      wrap: rectOf(wrap),
      tabsCard: rectOf(tabsCard),
      glider: rectOf(glider),
      activeTab: rectOf(tab),
      contentCard: rectOf(contentCard),
      underLines: underLines.slice(0, 8),
      bodyBg: getComputedStyle(document.body).backgroundColor,
    };
  });

  await page.screenshot({ path: 'dev/campus_tabs.png' });
  return info;
}
