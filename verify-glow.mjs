import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default async function run(page) {
  const steps = [];
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.join(__dirname, '.env');
  const secret = fs.readFileSync(envPath, 'utf8').match(/^JWT_SECRET=(.+)$/m)?.[1]?.trim();
  const token = jwt.sign(
    { id: 'ADM-MSOP6VG6BVL4', role: 'admin', email: 'austwise59@gmail.com' },
    secret,
    { expiresIn: '1h' }
  );
  await page.context().addCookies([{ name: 'aust_token', value: token, url: 'http://localhost:5174' }]);

  await page.goto('http://localhost:5174/settings', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.click('.glider-tab-emerald');
  await page.waitForTimeout(3500);

  const results = await page.evaluate(() => {
    const found = [];
    const all = document.querySelectorAll('.cred-root *');
    for (const el of all) {
      const cs = getComputedStyle(el);
      const bg = cs.backgroundImage || '';
      const sh = cs.boxShadow || '';
      if (bg.includes('radial-gradient') || (sh && sh !== 'none' && sh.includes('rgba(255, 255, 255') && sh.includes('blur'))) {
        found.push({
          cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className)?.toString().slice(0, 70) || el.tagName,
          bg: bg.includes('radial-gradient') ? bg.slice(0, 100) : '',
          shadow: sh.slice(0, 120),
          radius: cs.borderRadius,
          display: cs.display,
          visibility: cs.visibility,
          rect: (() => { const r = el.getBoundingClientRect(); return `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`; })(),
        });
      }
    }
    return { radialOrGlow: found, auroraDisplay: getComputedStyle(document.querySelector('.cred-aurora--violet')).display, scanlines: getComputedStyle(document.querySelector('.cred-scanlines')).display, grain: getComputedStyle(document.querySelector('.cred-grain')).display };
  });
  steps.push({ status: 'ok', message: JSON.stringify(results, null, 1) });
  return { steps };
}