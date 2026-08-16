export default async function run(page, ui) {
  const out = {};

  await page.evaluate(() => {
    localStorage.setItem('aust-user-profile', JSON.stringify({ id: 'u-x', name: 'Sadia' }));
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#orbit', { timeout: 15000 });

  const sample = () => page.evaluate(() => {
    const canvas = document.querySelector('.sr-car-3d canvas');
    if (!canvas) return 'no-canvas';
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(canvas, 0, 0);
    const w = canvas.width, h = canvas.height;
    const pts = [[0.5, 0.5], [0.5, 0.42], [0.5, 0.58], [0.42, 0.5], [0.58, 0.5]];
    const cols = pts.map(([fx, fy]) => {
      const d = ctx.getImageData(Math.floor(w * fx), Math.floor(h * fy), 1, 1).data;
      return [d[0], d[1], d[2]].join(',');
    });
    return { w, h, cols };
  });

  await page.locator('#orbit').click();
  await page.waitForSelector('.sr-car-3d canvas', { timeout: 15000 });
  await page.waitForTimeout(300);
  out.green = await sample();
  await page.screenshot({ path: 'car-green.png' });
  await page.locator('.sr-close').click();

  await page.locator('#orbitNone').click();
  await page.waitForSelector('.sr-car-3d canvas', { timeout: 15000 });
  await page.waitForTimeout(300);
  out.noColor = await sample();
  await page.screenshot({ path: 'car-nocolor.png' });

  return out;
}