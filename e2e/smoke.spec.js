// Every page loads without crashes/console errors and has no sideways scroll.
// Runs on all three projects (desktop / tablet / mobile) and saves a full-page screenshot of each.
import { test, expect } from '@playwright/test';
import { PUBLIC_ROUTES, APP_ROUTES, authFile, hasRole, slug } from './routes.js';
import { watchErrors, expectNoHorizontalOverflow, settle } from './helpers.js';

test.describe('public pages', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`loads ${route}`, async ({ page }, info) => {
      const errors = watchErrors(page);
      await page.goto(route);
      await settle(page);
      await page.screenshot({ path: `qa-report/shots/${info.project.name}/public${slug(route)}.png`, fullPage: true });
      await expectNoHorizontalOverflow(page);
      expect(errors).toEqual([]);
    });
  }
});

test.describe('app pages (regular user)', () => {
  test.skip(!hasRole('regular'), 'QA_REGULAR_EMAIL not set');
  test.use({ storageState: authFile('regular') });
  for (const route of APP_ROUTES) {
    test(`loads ${route}`, async ({ page }, info) => {
      const errors = watchErrors(page);
      await page.goto(route);
      await settle(page);
      await page.screenshot({ path: `qa-report/shots/${info.project.name}/app${slug(route)}.png`, fullPage: true });
      await expect(page).not.toHaveURL(/\/login$/);
      await expectNoHorizontalOverflow(page);
      expect(errors).toEqual([]);
    });
  }
});
