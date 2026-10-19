import fs from 'node:fs';

export default async function run(page) {
  const out = 'C:\\Users\\PEPSi\\AppData\\Local\\Temp\\opencode';
  const copies = new URL(page.url()).searchParams.get('copies') || '1';
  await page.goto(`http://localhost:5173/qba-pdf-test.html?copies=${copies}`, { waitUntil: 'load' });
  await page.waitForSelector('.qba-report', { timeout: 60000 });
  await page.waitForTimeout(1500);

  const measure = await page.evaluate(() => {
    const el = document.querySelector('.qba-report');
    const host = document.querySelector('.qba-capture-host');
    return {
      scrollWidth: el.scrollWidth,
      scrollHeight: el.scrollHeight,
      hostWidth: Math.round(host.getBoundingClientRect().width),
      canvasMaxSide: 32767,
      projectedCanvas: { w: el.scrollWidth * 2, h: el.scrollHeight * 2 },
    };
  });

  const downloadPromise = page.waitForEvent('download', { timeout: 240000 });
  await page.click('#qba-generate');
  let download = null;
  let downloadErr = null;
  try {
    download = await downloadPromise;
  } catch (err) {
    downloadErr = err.message;
  }

  const result = { measure, downloadErr, status: await page.locator('#qba-status').textContent() };

  if (download) {
    const path = `${out}\\qba-harness-${copies}.pdf`;
    await download.saveAs(path);
    const buf = fs.readFileSync(path);
    const str = buf.toString('latin1');
    result.download = {
      suggested: download.suggestedFilename(),
      bytes: buf.length,
      head: str.slice(0, 12),
      tail: str.slice(-24).replace(/\n/g, '\\n'),
      eofCount: (str.match(/%%EOF/g) || []).length,
      objCount: (str.match(/\d+ 0 obj/g) || []).length,
      pageCount: (str.match(/\/Type\s*\/Page[^s]/g) || []).length,
      imageCount: (str.match(/\/Subtype\s*\/Image/g) || []).length,
    };
  }
  return result;
}
