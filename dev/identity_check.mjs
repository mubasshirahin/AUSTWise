export default async function run(page) {
  await page.goto('http://localhost:5174/');
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    localStorage.setItem('aust-auth-session-v1', JSON.stringify({
      userId: 'ADM-001', role: 'admin', startedAt: new Date().toISOString(),
    }));
    localStorage.setItem('aust-user-profile', JSON.stringify({
      id: 'ADM-001', name: 'System Administrator', email: 'admin@aust.edu',
      role: 'admin', roles: ['admin'], department: 'CSE',
    }));
  });
  await page.goto('http://localhost:5174/settings');
  await page.waitForSelector('.glider-tabs-track', { timeout: 20000 });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const tab = Array.from(document.querySelectorAll('.glider-tab'))
      .find((t) => t.querySelector('.glider-tab-label')?.textContent?.trim() === 'Identity');
    tab?.click();
  });
  await page.waitForTimeout(700);
  const info = await page.evaluate(() => {
    const mast = document.querySelector('.profile-panel-header.schedule-masthead');
    const editor = document.querySelector('.profile-editor');
    const master = mast ? getComputedStyle(mast) : null;
    const editorCs = editor ? getComputedStyle(editor) : null;
    return {
      mastBg: master?.backgroundImage?.slice(0, 80),
      mastShadow: master?.boxShadow,
      mastAfterGlow: mast ? getComputedStyle(mast, '::after').backgroundImage.slice(0, 60) : 'n/a',
      editorBg: editorCs?.backgroundImage?.slice(0, 80),
      editorShadow: editorCs?.boxShadow,
      boxRects: {
        editorBox: editor ? { x: editor.getBoundingClientRect().x, w: editor.getBoundingClientRect().width } : null,
      },
    };
  });
  return info;
}