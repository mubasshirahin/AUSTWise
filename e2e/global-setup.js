// Logs in once per role and saves the session cookies to e2e/.auth/<role>.json.
import { request } from '@playwright/test';
import fs from 'node:fs';
import { ROLES, authFile, hasRole } from './routes.js';

export default async function globalSetup(config) {
  const baseURL = config.projects[0].use.baseURL;
  fs.mkdirSync('e2e/.auth', { recursive: true });
  for (const role of ROLES) {
    if (!hasRole(role)) continue;
    const key = role.toUpperCase();
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.post('/api/auth/login', {
      data: { email: process.env[`QA_${key}_EMAIL`], password: process.env[`QA_${key}_PASSWORD`] },
    });
    if (!res.ok()) throw new Error(`Login failed for role "${role}": HTTP ${res.status()}`);
    await ctx.storageState({ path: authFile(role) });
    await ctx.dispose();
  }
}
