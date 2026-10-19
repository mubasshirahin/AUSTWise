import fs from 'node:fs';

export default async function run(page, ui) {
  const out = 'C:\\Users\\PEPSi\\AppData\\Local\\Temp\\opencode';
  const fakeUser = { id: 'u_qa_1', name: 'QA', email: 'qa@aust.edu', role: 'student', roles: ['student'], department: 'CSE', initials: 'QA' };
  await page.addInitScript((u) => { localStorage.setItem('aust-user-profile', JSON.stringify(u)); }, fakeUser);
  await page.setViewportSize({ width: 1280, height: 900 });

  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

  await page.goto('http://localhost:5173/question-bank-analyzer?mockRole=admin', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Load sample' }).waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'Load sample' }).click();
  await page.locator('.qba-capture-host').waitFor({ state: 'attached', timeout: 20000 });
  await page.waitForTimeout(500);

  const captureInfo = await page.evaluate(() => {
    const host = document.querySelector('.qba-capture-host');
    const report = host ? host.querySelector('.qba-report') : null;
    return {
      hostFound: !!host,
      hostRect: host ? { w: Math.round(host.getBoundingClientRect().width), h: Math.round(host.getBoundingClientRect().height) } : null,
      scroll: report ? { w: report.scrollWidth, h: report.scrollHeight } : null,
      offset: report ? { w: report.offsetWidth, h: report.offsetHeight } : null,
    };
  });

  const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
  await page.getByRole('button', { name: /Quick Download/ }).click();

  let download = null;
  let downloadErr = null;
  try {
    download = await downloadPromise;
  } catch (err) {
    downloadErr = err.message;
  }

  const result = { captureInfo, consoleErrors, downloadErr };

  if (download) {
    const suggested = download.suggestedFilename();
    const path = `${out}\\qba-quick.pdf`;
    await download.saveAs(path);
    const buf = fs.readFileSync(path);
    const head = buf.subarray(0, 16).toString('latin1');
    const tail = buf.subarray(Math.max(0, buf.length - 32)).toString('latin1');
    result.download = {
      suggested,
      bytes: buf.length,
      head,
      tail,
      eofCount: (buf.toString('latin1').match(/%%EOF/g) || []).length,
      startxrefCount: (buf.toString('latin1').match(/startxref/g) || []).length,
      objCount: (buf.toString('latin1').match(/\d+ 0 obj/g) || []).length,
      isPdfHeader: head.startsWith('%PDF-'),
    };
  }

  const notice = await page.locator('.qba-notice').textContent().catch(() => null);
  result.notice = notice ? notice.trim() : null;
  return result;
}
