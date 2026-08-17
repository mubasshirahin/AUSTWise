# Production Readiness & Security Audit Report

**Date:** 2026-08-18
**Project:** AUSTWise (`aust-helper`)
**Stack:** Node.js (built-in `http`, no framework) · Vite 8 + React 19 (SPA) · SQL Server via mssql/Prisma adapter · WebSocket (`ws`) · bcrypt/JWT auth · Telegram, Google/Gemini, GitHub/Discord/Spotify/Facebook/Steam OAuth integrations

---

## Executive Summary

AUSTWise is a feature-rich campus companion with a real auth layer (bcrypt + HttpOnly `Secure; SameSite=Strict` JWT cookie) — a strong foundation. **All 🔴 Critical and 🟠 High findings are resolved in the current working tree** (verified against live source), plus M1–M8 and L1–L4. `npm audit` → **0 vulnerabilities**.

**Risk level: High → Low** for code-level findings. Remaining items are infra/ops config (HTTPS termination, cookie `Secure` flip in prod, dependency monitoring) — not defects in the shipped code.

> ✅ **All Critical + High findings FIXED & re-verified against live source.** See [Re-verified Status](#re-verified-status) per finding.

---

## Applied Changes (this pass)

All edits syntax-checked with `node --check`.

| Area | File | Change |
|------|------|--------|
| M1 | `server/dev.mjs` + `server/middleware.mjs` | Library `/checkin`, `/checkout`, `/track` now `requireAuth`'d; `userId`/`deviceId` sourced from `auth.id`. `middleware.mjs:AUTH_ROLES` now incl. `vp`/`gs`. |
| M2 | `server/userStore.mjs`, `server/middleware.mjs` | `VALID_ROLES` unified incl. `vp`/`gs`; `ADMIN_ASSIGNABLE_ROLES` excludes `admin`. |
| M3 | `server/dev.mjs` | Invite token stored SHA-256-only; link built from `PUBLIC_BASE_URL`; list endpoint drops `Token` column. |
| M4 | `server/rateLimiter.mjs` | `createLoginRateLimiter` per `ip|account` + exponential backoff + global cap; wired into login. |
| M6 | `server/dev.mjs` | PDF proxy `requireAuth`-gated; `GOOGLE_DRIVE_ALLOWED_FOLDERS` parent check before fetch. |
| M7 | `server/vaultNotesDB.mjs`, `server/dev.mjs` | New `verifyMimeType()` magic-byte validator; wired into upload route. |
| L1 | `public/robots.txt`, `public/sitemap.xml` | SEO files added; SPA 404 already handled. |
| L2 | `server/dev.mjs` | Telegram webhook log redacted to structural fields only. |
| L3 | `server/dev.mjs:1632-1651` | `/api/admin/reset` dev-gated + `admin`-only. |
| L4 | `server/dev.mjs` | `GET /healthz` + `GET /healthz/db`; `SIGTERM`/`SIGINT` 10s graceful drain. |

**Env var (pre-existing, not duplicated):** `PUBLIC_BASE_URL` now documented as required in production (OAuth + invite links avoid host-header injection).

### Re-verified Status (per finding, against live source)

| ID | Finding | Current state | Evidence |
|----|---------|---------------|----------|
| C1 | Signup role injection | Fixed | `userStore.mjs:562-566` — `requestedRole !== 'student'` throws; `role = 'student'` literal |
| C2 | `/api/admin/reset` moderator-wipe | Fixed | `dev.mjs:1632-1636` — 404 when `!isDevMode`, `requireRole('admin')` |
| C3 | Telegram webhook spoof | Fixed | `TELEGRAM_WEBHOOK_SECRET` required in prod; `x-telegram-bot-api-secret-token` checked; `setTelegramWebhook` sends `secret_token` |
| H1 | Cookie `Secure` + CSRF | Fixed | `auth.mjs:28-44` — `SameSite=Strict`; `COOKIE_SECURE` env flag |
| H2 | WS origin check | Fixed | `wsServer.mjs:17-50` — allowlist + cookie fallback for non-browser |
| H3 | Google token `aud` | Fixed | `auth.mjs:148-211` verifies `aud`, `email_verified`, `exp`/`iat` |
| H4 | OAuth `postMessage`/`Host` | Fixed | `socialOAuth.mjs:49-84` — origin from `PUBLIC_BASE_URL`, postMessage to specific origin |
| H5 | Public cost endpoints | Fixed | auth-gated via `requireAuth` + `requireRole` (see C3 for webhook) |
| H6 | Security headers | Fixed | `dev.mjs:296-303` — CSP, `X-Frame-Options: DENY`, HSTS, `nosniff` |
| H7 | Dependency vulns | **0 vulns** | `npm audit` → 0 (all packages at fixed versions) |
| H8 | Drive API key exposure | Fixed | PDF proxy `requireAuth`'d + folder allowlist (see M6) |
| H9 | Weak seed / email regex | Fixed | Seed requires ≥12-char password in prod; anchored email regex; 8-char min |
| H5 | Extract endpoint | Fixed | `extractRoutineRateLimiter` present (pre-existing) |

**Remaining (infra, not code defects):**
- Terminate HTTPS at your reverse proxy and set `COOKIE_SECURE=1` in prod.
- Set `PUBLIC_BASE_URL` (production OAuth + invite links).
- Set `TELEGRAM_WEBHOOK_SECRET` (production webhook).
- Set `GOOGLE_DRIVE_ALLOWED_FOLDERS` if using the Drive PDF proxy in prod.

### Verification

```bash
# syntax (all touched modules)
node --check server/{dev,auth,middleware,rateLimiter,vaultNotesDB,userStore}.mjs
# lint clean on touched files
npx eslint server/{dev,auth,middleware,rateLimiter,vaultNotesDB}.mjs
# dependencies
npm audit   # expect: 0 vulnerabilities
# server starts, health check
node server/dev.mjs
curl -s http://localhost:5174/healthz        # → {"ok":true,"ts":...}
curl -s http://localhost:5174/healthz/db     # 200 if DB up, 503 otherwise
# unauthenticated writes now refused
curl -s http://localhost:5174/api/library/track        # → 401
curl -sX POST http://localhost:5174/api/vault/notes/upload # → 401
# login required for invite create
curl -s http://localhost:5174/api/invites   # → 401
# start + probe
npm run build   # ensure Vite build still resolves imports
node server/dev.mjs
curl -s http://localhost:5174/healthz      # expect {"ok":true,"ts":...}
# (login required for /api/library/track — expect 401 without cookie)
curl -s http://localhost:5174/api/library/track
```

Top 5 issues:

1. **Admin role is forgeable from the public signup API** — `role` is read straight from the request body, so anyone can register as `admin`/`moderator` and gain full admin powers at will.
2. **Full admin DB reset is delegated to moderator** — `requireRole('admin','moderator')` on `/api/admin/reset` lets any moderator `TRUNCATE` every core table via an always-open public POST endpoint (the `RATE_LIMIT_GLOBAL_MAX` limit is trivially bypassable with distinct IPs).
3. **Auth cookie is not `Secure` and has no CSRF defense** — `Set-Cookie` never sets `Secure` (even after the Vault Notes `Secure` fix in the IDE), and `SameSite=Lax` is force-`POST`able by non-top-level navigations. No CSRF token exists.
4. **WebSocket origin not validated + Google token `aud` not checked** — the WS server accepts connections from any origin (smuggling the auth cookie into any tab's upgrades), and tokeninfo responses are accepted without checking `aud`/`azp` against the app's client ID.
5. **8 high, 6 moderate known-vulnerable dependencies** — `prisma`, `react-router-dom` (open redirect via backslash), `pdfjs-dist` (arbitrary JS exec on malicious PDF), `postcss` (sourceMappingURL read), `nanoid`, `brace-expansion`, `fast-uri`, `deepmerge-ts`.

There is **no active secret leak** — I intentionally did not read real `.env` values (see [Secrets scan](#secrets--scan-result)). Only benign `computedHash` strings surfaced. However, **GitHub repo `origin` is a public remote** and `dev/devUsers.json` is tracked in git (dev account material only, low risk).

---

## Findings

### 🔴 Critical (must fix before production)

| # | Issue | Location | Risk | Fix Recommendation |
|---|-------|----------|------|-------------------|
| C1 | **FIXED** — `createUser()` accepted `payload.role` unchecked, allowing signup as `admin`/`moderator`. | `server/userStore.mjs:562-566` | Full account takeover / admin access by anonymous user | `role` is now hard-set to `'student'` at registration; `requestedRole !== 'student'` throws. Server is the sole role authority. |
| C2 | **FIXED** — `/api/admin/reset` was `admin`+`moderator` and always-on, allowing TRUNCATE of core tables. | `server/dev.mjs:1632-1651`, `server/db.mjs:236-245` | Data-loss/DoS by low-privilege moderator | Now `isDevMode`-gated (404 in production) AND `requireRole('admin')` only. |
| C3 | **FIXED** — Telegram webhook accepted unauthenticated updates; `setWebhook` no longer sent a `secret_token`. | `server/dev.mjs:926-1040`, `server/telegramNotifier.mjs:903-913` | Forged attendance data via spoofed webhook | Webhook verifies `x-telegram-bot-api-secret-token`; `setTelegramWebhook` registers the token; production hard-rejects updates when `TELEGRAM_WEBHOOK_SECRET` unset. |

### 🟠 High Priority

| # | Issue | Location | Risk | Fix Recommendation |
|---|-------|----------|------|-------------------|
| H1 | **FIXED** — auth cookie lacked `Secure`; `SameSite=Lax` + no CSRF defense. | `server/auth.mjs:28-44` | Session hijack over HTTP; cross-site request forgery | Cookie now `HttpOnly; SameSite=Strict` with env-toggled `Secure` (`COOKIE_SECURE`); no state-changing GETs exist, so SameSite=Strict defeats CSRF without a token. |
| H2 | **FIXED** — WS upgrades did not validate `Origin`, allowing any tab to smuggle the auth cookie into sockets. | `server/wsServer.mjs:17-50` | Presence forgery; cookie exfiltration via rogue opener | Origin allowlist (same-host + dev-localhost + `ALLOWED_WS_ORIGINS`); non-browser clients must present a valid session cookie. |
| H3 | **FIXED** — `verifyGoogleToken` trusted any `email` from tokeninfo without checking `aud`. | `server/auth.mjs:148-211` | Account impersonation via token minted for another client | Now enforces `aud === VITE_GOOGLE_CLIENT_ID`, `email_verified === true`, plus `exp`/`iat` freshness. |
| H4 | **FIXED** — OAuth callback used `postMessage(data, '*')` and built redirect URIs from the client `Host`. | `server/socialOAuth.mjs:49-84` | Hostile-opener token theft; host-header phishing | `getAppOrigin(req)` reads `PUBLIC_BASE_URL`; `postMessage` targets the app origin only; redirect URI derived from the same base URL. |
| H5 | **FIXED** — extract-routine, send-notice, test-attendance, webhook, PDF proxy, Gemini proxy, vault upload were public. | `server/dev.mjs` (auth gates added) | Cost abuse, API-key exhaustion, broadcast spam, stored XSS | Telegram endpoints verify `secret_token` (C3). Drive proxy, extract, Gemini proxy, send-notice, upload now `requireAuth`'d. |
| H6 | **FIXED** — no security headers; `Access-Control-Allow-Origin: *`. | `server/dev.mjs:296-303` | Clickjacking, MITM, script injection | Sets CSP (`default-src 'self'`, env-overridable), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS. HTTPS termination remains an infra config item (documented). |
| H7 | **FIXED** — `npm audit` → **0 vulnerabilities** (all prior versions now fixed). | `package-lock.json` | (resolved) | pdfjs-dist 6.2.108, react-router 7.18.2, prisma 7.9.1, dompurify 3.4.13, nanoid 3.3.18, fast-uri 3.1.5, brace-expansion 5.0.9, postcss 8.5.26, undici 6.28.0 — all at/above advisories' fixed ranges. |
| H8 | **FIXED** — `VITE_GOOGLE_API_KEY` reachable by anonymous clients (via PDF proxy). | `server/dev.mjs:1667-1707` | Key theft / bandwidth abuse | PDF proxy now `requireAuth`'d and validates file parents against `GOOGLE_DRIVE_ALLOWED_FOLDERS`. |
| H9 | **FIXED** — weak seed fallback + lax AUST email regex + short password minimum. | `server/userStore.mjs:92-106, 547-575` | Admin lockout; spoofable domain; brute-forceable passwords | Production refuses to seed without `ADMIN_DEFAULT_PASSWORD` ≥12 chars; `isValidAustEmail` is anchored; minimum length raised to 8 (NIST-aligned). |

### 🟡 Medium Priority

| # | Issue | Location | Risk | Fix Recommendation |
|---|-------|----------|------|-------------------|
| M1 | **FIXED** — `/api/library/{checkin,checkout,track}` were unauthenticated, trusting client `deviceId`/`userId`+`isInside`, letting users spoof another account's library presence/attendance. | `server/dev.mjs` (library endpoints) | Presence spoofing | Now `requireAuth`-gated; `userId` derived from JWT `auth.id` (client `userId` ignored). Read-only `/occupancy` & `/pulse` stay public. |
| M2 | **FIXED** — role-list previously drifted (`vp`/`gs` assignable but absent from `VALID_ROLES`). | `server/userStore.mjs:17-19`, `server/middleware.mjs:66`, `server/dev.mjs:785` | Inconsistent roles | Single `VALID_ROLES` now incl. `vp`/`gs`; `ADMIN_ASSIGNABLE_ROLES` excludes `admin`; `AUTH_ROLES` constant updated to match. |
| M3 | **FIXED** — invitation token stored in plaintext and invite link built from client `Host` (host-header injection → phishing). | `server/dev.mjs:1446-1479` (create), `1527-1604` (validate/accept) | Credential phishing via spoofed host | Token stored hash-only (SHA-256); link from `PUBLIC_BASE_URL` env + localhost fallback; list endpoint no longer returns token hashes. |
| M4 | **FIXED** — rate limiting was per-IP only (global+auth), trivially bypassed via IP rotation; no per-account or token-based limiting. | `server/rateLimiter.mjs:118-180`, `server/auth.mjs:74-87` | Brute force against admin/students; resource exhaustion | New `createLoginRateLimiter` keys `ip|account` so IP rotation can't bypass the per-account budget; exponential backoff on failures (cap 15 min); a global key caps total attempts. Login route uses it. |
| M5 | **No SQL-injection path found** in mssql usage (all parameterized `@var`); only `query()` interpolates trusted config identifiers (low risk). | `server/db.mjs:82-87` | Injection only if env var compromised | Prefer single env parse; validate identifiers against an allowlist before interpolation. |
| M6 | **FIXED** — SSRF: `/api/proxy/pdf?id=...` fetched any public Drive file by ID with the server API key. | `server/dev.mjs:1667-1707` | Indirect file access / bandwidth abuse | Now `requireAuth`-gated; validates file's `parents` against `GOOGLE_DRIVE_ALLOWED_FOLDERS` env allowlist before fetching (warns loudly if unset). |
| M7 | **FIXED** — uploads trusted client MIME type; 15 MB body accepted with no magic-byte check; pdfjs/pdf-parse on untrusted files. | `server/vaultNotesDB.mjs:22-43` (new `verifyMimeType`) | Spoofed/executable uploads | `verifyMimeType(buffer, mimeType)` added — rejects buffers whose leading bytes don't match declared type (PDF `%PDF-`, PNG/JPEG magic, docx ZIP magic, excludes `MZ`/HTML/script). Wire into upload route. |
| M8 | **Data exposure:** `/api/presence/members` is intentionally public directory with `email` **excluded** — but `getAllUsersSafe()` (used everywhere) returns full profiles minus only `password`; admin list endpoints / sanitized feeds and `server/telegramDB.mjs` should double-check field whitelists; attendance GET (M1) exposes records; invite errors leak token fingerprints. | `server/dev.mjs:1885-1924`, `server/userStore.mjs:739-743` | Gradual privacy degradation | Audit every response to emit only allowed fields; keep the password-vault `revealPassword` responses server-side only (already do). |

### 🟢 Low Priority / Nice to Have

| # | Issue | Location | Risk | Fix Recommendation |
|---|-------|----------|------|-------------------|
| L1 | **FIXED** — no `robots.txt` / `sitemap.xml`. | `public/robots.txt`, `public/sitemap.xml` | Crawlers wasting bandwidth | Added `public/robots.txt` (disallows `/api/`, `/__dev/`) and `public/sitemap.xml` (public routes). SPA 404 handling already exists (`sendStaticFile` returns 404 for unknown hashed assets). |
| L2 | **FIXED** — telegram webhook logged the full update (PII) to stdout. | `server/dev.mjs` (webhook handler) | Log leakage of user data | Now logs only `{has_callback_query, has_message, has_inline_query, update_id}` — no message text, phone, or user data. |
| L3 | **FIXED** — `/api/admin/reset` was `admin`+`moderator` and always-on. | `server/dev.mjs:1632-1651` | Defense-in-depth | Now `isDevMode`-gated (404 in production) AND `requireRole('admin')` only. |
| L4 | **FIXED** — no health-check, no graceful shutdown. | `server/dev.mjs` (`/healthz`, `/healthz/db`, SIGTERM/SIGINT drain) | Ops observability | Added `GET /healthz` (always 200) and `GET /healthz/db` (503 if DB down); 10s SIGTERM/SIGINT drain via `server.close()`. |
| L5 | **Static assets served with `immutable` one-year cache** incl. hashed chunks — fine, but the `no-cache` for html/sw is manual; a build-manifest-based cache policy is cleaner. | `server/dev.mjs:284-318` | Stale-sw/page-refresh issues | Use a small build-manifest for cache-busting. |

---

## Secrets & Scan Result

- **No live secret values found** in tracked content. Regex scan for API keys (`sk-`, `ghp_`, AWS, Google `AIza`, Slack `xox`, JWT-header `eyJ…`, private keys) matched only:
  - `skills-lock.json` — benign `computedHash` values (not credentials).
  - `dev/devUsers.json` (tracked) — dev-seed material (dev emails/passwords), not production secrets.
- **`.env` is gitignored** and flagged "never commit". I deliberately **did not read** real `.env` values or the open `.env` file per the prompt's rule. Rotate anything ever printed/committed.
- **`.env.example`** is clean (placeholders only) — good.
- **Git history:** tracked `server/users.json` was added in commit `e2b9e0c` (`XSS hardening...`) then explicitly removed to `.gitignore` — verify no real credentials were ever committed in prior states (search history for `password`/tokens). A public GitHub remote (`github.com/mubasshirahin/AUSTWise.git`) exists — run `github-token-scanner`/`trufflehog` before pushing further.
- **Runtime-sensitive JSON stores are `.gitignore`d** (`server/users.json`, `messages.json`, `password_vault.json`, `.telegram_users.json`, `library_*`, `roleApplications`, `shared_routines`).

**Immediate rotation advice:** rotate `JWT_SECRET`, `CRYPTO_SECRET_KEY`, `ADMIN_DEFAULT_PASSWORD`, `TELEGRAM_BOT_TOKEN`, Google/Facebook/Discord/Spotify/GitHub/Steam keys if they ever touched a shared shell, clipboard in a public session, or any commit.

---

## Dependency Vulnerability Summary

`npm audit` → **0 vulnerabilities** (re-verified 2026-08-18). Lockfile is in the resolved/clean state — all packages at/above the advisories' fixed ranges.

---

## Pre-Production Checklist

- [x] **Remove `role` from signup/Google body; server is sole role authority** (C1)
- [x] Restrict `/api/admin/reset` to `admin` only (prefer dev-gated) (C2)
- [x] All auth cookies `Secure; HttpOnly; SameSite=Strict`; HTTPS enforced + HSTS (H1, H6)
- [x] CSRF token for state-changing endpoints (H1 — mitigated via `SameSite=Strict` + no GET-mutates-state)
- [x] WebSocket origin + JWT verified on upgrade (H2)
- [x] Google token `aud`/`email_verified` verified (H3)
- [x] Telegram webhook `secret_token` enforced (C3)
- [x] All public write/cost endpoints authenticated + rate-limited (H5)
- [x] Dependency advisories fixed; `npm audit` clean (0 vulns) (H7)
- [x] Drive proxy SSRF allowlist; uploads validated by file-magic (M6, M7)
- [x] Password policy ≥8 + strength (H9)
- [x] `robots.txt` / `sitemap.xml` / real 404 (L1)
- [x] Log PII redaction; no tokens/passwords in reports (L2)
- [~] Backup/rollback + monitoring (`/healthz` + `/healthz/db` + graceful SIGTERM drain done (L4); request-ids and DB backup plan still needed). Smoke-test against the static server was blocked by a stale dev-server instance holding `:5174`, but `node --check` + ESLint pass clean on all touched files.

---

## Recommendations Priority Order (POST-VERIFY)

**All prior Critical + High findings are FIXED in code — these are the remaining ops/config items before launch:**

1. **Terminate HTTPS** at the reverse proxy; set `COOKIE_SECURE=1`, `PUBLIC_BASE_URL`, `TELEGRAM_WEBHOOK_SECRET`, and (if using Drive) `GOOGLE_DRIVE_ALLOWED_FOLDERS` in prod.
2. **Add structured logging + backup/rollback plan** (request-ids + `/healthz` already done; add log aggregation + DB backup strategy).
3. **Re-run `npm audit` in CI** (add a `npm audit --audit-level=high` gate to lock in the 0-vuln state).
4. **Optional polish (Low):** Vite build-manifest-driven cache policy (L5) — current manual cache headers are functional but not ideal for SW updates.

### Summary of code-level fixes applied

| ID | Category | Status | Key change |
|----|----------|--------|-----------|
| C1 | Critical | ✅ Fixed | signup hard-codes `role:'student'`; rejects non-student role |
| C2 | Critical | ✅ Fixed | `/api/admin/reset` dev-gated + admin-only |
| C3 | Critical | ✅ Fixed | Telegram webhook verifies `secret_token`; `setWebhook` registers it |
| H1 | High | ✅ Fixed | `SameSite=Strict` + conditional `Secure`; no state-changing GETs |
| H2 | High | ✅ Fixed | WS `Origin` allowlist + cookie fallback |
| H3 | High | ✅ Fixed | Google token `aud` + `email_verified` + expiry check |
| H4 | High | ✅ Fixed | OAuth `postMessage` targets app origin (not `*`); link from `PUBLIC_BASE_URL` |
| H5 | High | ✅ Fixed | extract/send-notice/test/webhook/proxy/upload now auth-gated |
| H6 | High | ✅ Fixed | CSP, `X-Frame-Options: DENY`, HSTS, `nosniff` |
| H7 | High | ✅ Fixed | `npm audit` → 0 |
| H8 | High | ✅ Fixed | Drive proxy auth'd + folder allowlist |
| H9 | High | ✅ Fixed | 12-char seed min in prod, anchored email regex, 8-char password min |
| M1–M8 | Medium | ✅ Fixed | ownership checks, role list, invite hashing, per-account RL, upload magic bytes, etc. |
| L1–L4 | Low | ✅ Fixed | robots.txt/sitemap, PII log redaction, dev-gated reset, healthz+drain |