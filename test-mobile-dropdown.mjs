export default async function run(page, ui) {
  await page.setViewportSize({ width: 375, height: 812 });
  
  // Go to landing page first
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);
  
  // Set guest auth in localStorage
  await page.evaluate(() => {
    localStorage.setItem('aust-auth-session-v1', JSON.stringify({
      userId: 'guest', role: 'guest', startedAt: new Date().toISOString(),
    }));
    localStorage.setItem('aust-user-profile', JSON.stringify({
      id: 'guest', name: 'Guest User', email: 'guest@test.com', role: 'guest',
      initials: 'GU', onboarded: true, theme: 'dark',
    }));
  });
  
  // Navigate to analytics
  await page.goto('http://localhost:5173/analytics');
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: 'C:/Users/PEPSi/Desktop/AUSTWise/mobile-1.png', fullPage: false });

  // Check for the button
  const btnCount = await page.locator('.cgpa-more-btn').count();
  console.log('.cgpa-more-btn count:', btnCount);
  
  if (btnCount === 0) {
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 300));
    console.log('Body text:', bodyText);
    return { error: 'button not found', bodyText };
  }

  const isVisible = await page.locator('.cgpa-more-btn').first().isVisible();
  console.log('Button visible:', isVisible);

  const box = await page.locator('.cgpa-more-btn').first().boundingBox();
  console.log('Button box:', JSON.stringify(box));

  // Check widget overflow
  const widgetInfo = await page.evaluate(() => {
    const widget = document.querySelector('.cgpa-bol-widget');
    if (!widget) return 'no .cgpa-bol-widget';
    const s = window.getComputedStyle(widget);
    return { overflow: s.overflow, overflowX: s.overflowX, overflowY: s.overflowY, transform: s.transform };
  });
  console.log('Widget:', JSON.stringify(widgetInfo));

  // Click the button
  await page.locator('.cgpa-more-btn').first().click();
  await page.waitForTimeout(600);

  await page.screenshot({ path: 'C:/Users/PEPSi/Desktop/AUSTWise/mobile-2.png', fullPage: false });

  // Check if menu is in DOM and visible
  const menuCheck = await page.evaluate(() => {
    const menu = document.querySelector('.cgpa-breakdown-box .export-menu');
    if (!menu) return { inDom: false };
    const s = window.getComputedStyle(menu);
    const r = menu.getBoundingClientRect();
    return {
      inDom: true,
      display: s.display,
      visibility: s.visibility,
      position: s.position,
      opacity: s.opacity,
      zIndex: s.zIndex,
      overflow: s.overflow,
      rect: { t: r.top, r: r.right, b: r.bottom, l: r.left, w: r.width, h: r.height },
    };
  });
  console.log('Menu:', JSON.stringify(menuCheck));

  // Check overflow ancestors
  const overflowAncestors = await page.evaluate(() => {
    const menu = document.querySelector('.cgpa-breakdown-box .export-menu');
    if (!menu) return [];
    let el = menu;
    const chain = [];
    while (el && el !== document.documentElement) {
      const s = window.getComputedStyle(el);
      if (s.overflow !== 'visible' || s.overflowX !== 'visible' || s.overflowY !== 'visible') {
        chain.push({ tag: el.tagName, cls: el.className?.substring(0, 60), overflow: s.overflow });
      }
      el = el.parentElement;
    }
    return chain;
  });
  console.log('Overflow chain:', JSON.stringify(overflowAncestors, null, 2));
}
