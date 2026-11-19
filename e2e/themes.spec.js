// Every theme on a few key pages: screenshot for review + axe colour-contrast scan. Desktop only.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { THEMES, authFile, hasRole, slug } from './routes.js';
import { settle } from './helpers.js';

const PAGES = ['/dashboard/quickstats', '/takagelokoi', '/marketplace', '/settings'];

test.describe('themes', () => {
  test.skip(!hasRole('regular'), 'QA_REGULAR_EMAIL not set');
  test.use({ storageState: authFile('regular') });

  for (const theme of THEMES) {
    test(`theme ${theme}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'desktop only');
      await page.addInitScript((t) => localStorage.setItem('aust-theme', t), theme);
      const issues = [];
      for (const route of PAGES) {
        await page.goto(route);
        await settle(page);
        await page.screenshot({ path: `qa-report/themes/${theme}${slug(route)}.png`, fullPage: true });
        const r = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
        for (const v of r.violations) issues.push(`${route}: ${v.nodes.length} low-contrast element(s)`);
      }
      expect.soft(issues, `contrast problems in ${theme}`).toEqual([]);
    });
  }
});
