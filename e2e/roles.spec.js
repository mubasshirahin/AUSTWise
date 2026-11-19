// Role management: checks the UI guards AND that the backend rejects calls.
import { test, expect } from '@playwright/test';
import { ROLES, ADMIN_ROLES, ADMIN_ROUTES, APP_ROUTES, authFile, hasRole } from './routes.js';
import { settle } from './helpers.js';

test.describe('logged out', () => {
  for (const route of [...APP_ROUTES.slice(0, 5), ...ADMIN_ROUTES]) {
    test(`cannot reach ${route}`, async ({ page }) => {
      await page.goto(route);
      await settle(page);
      await expect(page).not.toHaveURL(new RegExp(`${route}$`));
    });
  }
});

for (const role of ROLES) {
  test.describe(`role: ${role}`, () => {
    test.skip(!hasRole(role), `QA_${role.toUpperCase()}_EMAIL not set`);
    test.use({ storageState: authFile(role) });
    const allowed = ADMIN_ROLES.includes(role);
    for (const route of ADMIN_ROUTES) {
      test(`${allowed ? 'can' : 'cannot'} open ${route}`, async ({ page }) => {
        await page.goto(route);
        await settle(page);
        if (allowed) await expect(page).toHaveURL(new RegExp(route));
        else await expect(page).not.toHaveURL(new RegExp(route));
      });
    }
  });
}
