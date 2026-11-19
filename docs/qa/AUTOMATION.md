# AUSTWise – QA procedure & automation

## Ki automate hoy, ki manual
| Area | Automated (Playwright) | Manual (`QA-CHECKLIST.md`) |
|---|---|---|
| Page load / crash / console error | `e2e/smoke.spec.js` – shob route | – |
| Responsive | Same smoke test 3 device e (desktop 1440, tablet iPad, mobile iPhone 13): sideways scroll check + full screenshot | Screenshot gula chokhe dekha, real phone e keyboard/touch |
| Role management | `e2e/roles.spec.js` – logged-out + protita role er admin access | Fine-grained permission (notice, delete, mod) – checklist §4 |
| Themes | `e2e/themes.spec.js` – 27 theme × 4 page screenshot + axe contrast | Screenshot dekha, gradient/glow ache kina |
| User flows | (pore add korbe: `e2e/flows/*.spec.js`) | Checklist §1–3 |
| Security | `npm audit` | Checklist §7, `/security-review` |

## Step-by-step procedure
1. **Test DB banao** (Neon/Supabase free branch or local Postgres). `.env` er copy banaye `DATABASE_URL` test DB te dao. **Production DB te kokhono test chalabe na.**
2. Test DB te protita role er ekta account banao (owner, admin, moderator, cr, regular).
3. `.env.test.example` → `.env.test` copy kore email/password bosao.
4. Test DB wala server chalu koro (`npm run dev`), tarpor:
   ```
   npm run test:e2e                      # sob
   npx playwright test smoke --project=mobile   # shudhu mobile smoke
   npx playwright test themes            # shudhu theme
   npm run qa:report                     # HTML report khulbe
   ```
5. Output:
   - `qa-report/html` – pass/fail, failure er screenshot + trace
   - `qa-report/shots/<device>/` – protita page er screenshot (responsive review)
   - `qa-report/themes/` – protita theme er screenshot
6. Fail gula `QA-CHECKLIST.md` er Bug log e tolo → fix → abar run.
7. Shob green hole manual checklist complete koro (UX feel, real device).

## Order (recommended)
1. Smoke (shob page cholche?) → 2. Roles → 3. User flows (manual) → 4. Responsive → 5. Themes → 6. Security → 7. Lighthouse/others.
Age crash/permission thik koro, tarpor look & feel.

## Security status (2026-11-19)
`npm audit`: **24 vulnerabilities (9 high, 9 moderate, 6 low)** – e.g. vite, nodemailer, undici, mysql2, serialize-javascript, zod. Fix: `npm audit fix` (non-breaking first), then major bumps one by one with tests.
Next: Claude Code e `/security-review` chalao server code er upor (auth, IDOR, XSS, upload, JWT).

## Pore jog korte paro
- `e2e/flows/*.spec.js` – login, notice post, marketplace item, money tracker entry (test DB te write OK).
- Visual regression: `expect(page).toHaveScreenshot()` – ekbar baseline nile pore design bhanglei test fail korbe.
- GitHub Action: PR e auto run.
- Lighthouse CI: `npx @lhci/cli autorun`.
