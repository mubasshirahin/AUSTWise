# AUSTWise pricing plan (draft for approval)

Status: **plan only, nothing implemented.** Written 2026-11-26 from an audit of `src/` and `server/`.

Rule used: a feature is listed only if it exists in the code today and works (in production, where it depends on API keys). Anything marked `comingSoon` in `src/data/features.js` (which feeds the landing page), anything that is a stub page, and anything that runs on mock data is left out.

---

## 0. Headline findings

1. **Nothing is gated today.** The payment flow works up to "charge created", but no page or API ever reads the user's plan. Pro is a label, not an entitlement.
2. **Most of the current Pro copy is not true.** `ProPage.jsx`, `PricingPage.jsx`, `DocsPage.jsx`, `BlogPage.jsx` and `TermsPage.jsx` promise things that don't exist:

| Promised | Reality in code |
|---|---|
| "No ads on any page" | There are **no ads anywhere** (no AdSense, no ad slots). Free users see none either. |
| Vault storage 500MB / 5GB / Unlimited | No per-user storage or quota exists. Vault material lives in **Google Drive folders** (`MaterialFolders.jsx`); the only size limit is 8MB per question-paper upload (`questionBankStorage.js:14`). |
| "Export to PDF and **Excel**" | PDF/JPG exports exist; **no Excel/CSV export** anywhere. |
| "AI study assistant" (Apex) | No such product. See the Gemini note in section 4. |
| "Advanced analytics: predictive CGPA" | Grade Lab exists (5 tabs), but there's no prediction feature. |
| Cloud sync | Per-user server store (`/api/store/user/*`) syncs some data for **everyone**; not a paid feature. |
| Priority email / 24/7 support, direct mentorship, early/beta features, exclusive badges | None of these exist as features. "Mentor Request" is a free Community feature. |

3. **The payment flow has holes** (must be fixed before selling, see section 3.2): the server trusts the amount and plan sent by the browser, no expiry is stored on the server, and the success page marks the plan active in `localStorage` even when verification fails.

---

## 1. Features that really exist

Legend for "Paid?": **Yes** = good paid candidate, **Maybe** = possible with limits, **No** = keep free.

| Feature | Where in code | Works? | Paid? | Why |
|---|---|---|---|---|
| **Premium themes + layouts** (21 of 25 themes, 21 of 23 layouts) | `src/context/themeConstants.js` (`PRO_LAYOUTS`, `THEME_LAYOUT`), `src/themes/`, layout menu `src/layout/TopNavbar.jsx:369`, preview `ProPage.jsx` `ThemeStudio` | Yes, all usable by everyone today | **Yes** | Already shown with a PRO tag, purely cosmetic, zero server cost, visible "status" perk. Free keeps Dark (classic), Blueprint, Notebook, Night Owl (studio layout). |
| **Telegram notifications** (daily class digest, first-class reminder, after-class and evening attendance check, deadline reminders, notice alerts) | `server/telegramScheduler.mjs`, `telegramSchedulerJob.mjs`, `telegramMessageTemplates.mjs`, `telegramNotifier.mjs`; toggle in `SettingsPage.jsx` | Yes in prod (bot token not set locally) | **Yes** | Clear daily value, real running cost (scheduler + bot). Browser web push stays free so Free users still get basic alerts. |
| **Routine export** (PDF and JPG) | `src/features/dashboard/routineExport.js` (`exportRoutinePDF`, `exportRoutineJPG`) | Yes | **Maybe** | Suggest JPG free (people share routines, good for growth), PDF Pro. |
| **Semester plan export** (PDF and JPG) | `src/features/dashboard/semesterExport.js` | Yes | **Maybe** | Same split as routine export. |
| **Transcript PDF** (Grade Lab result table) | `src/features/analytics/ResultTable.jsx:415` | Yes | **Yes** | Polished output, low demand from casual users, good "export" perk. |
| **Semester Tracker PDF** | `src/features/analytics/SemesterTracker.jsx:507` | Yes | **Yes** | Same as above. |
| **Notebook PDF export** | `src/features/vault/Notebook.jsx:1199` | Yes | **Maybe** | Notebook itself must stay free; export could be Pro. |
| **Question Bank Analyzer** (prompt → user's own AI → parsed report, topic heatmap, checklist, saved analyses, history, image crops, PDF report) | `src/features/question-bank-analyzer/` (30 files), saved via `/api/store/user/*` | Yes, no API key needed (user runs the prompt in their own ChatGPT/Gemini) | **Maybe** | Strong exam-time value. Suggest: analyzing is free, **saved analyses beyond 3 courses + PDF report** Pro. Needs a server-side count limit. |
| **Grade Lab: Dept Heatmap, Best & Worst, Prerequisites** | `src/features/analytics/` (`DeptHeatmap.jsx`, `CoursePoll.jsx`, `PrerequisiteTree.jsx`); tabs already have access keys `feature:analytics:*` | Yes | **Maybe** | Could be the honest version of "advanced analytics". But Best & Worst is a poll — gating it shrinks votes. Suggest only **Dept Heatmap** Pro, or none. |
| **Workspace (Google Classroom) + result-post alerts** | `src/features/workspace/WorkspacePage.jsx`, `resultPostAlerts.js`, `server/workspaceResultPush.mjs` | Yes in prod (Google OAuth not set locally) | **Maybe** | Useful, but needs the user's Google sign-in; alerts are Web Push fan-out (small server cost). Candidate: the **result alerts** are Pro, Workspace view free. |
| CGPA Calculator, Semester Wise tracker | `src/features/analytics/` | Yes | No | Core promise on landing page ("Dashboard & CGPA tracking"). |
| Dashboard: At a Glance, Daily Flow, Notice Board, Deadlines, Routine Grid, 14-week view, Zero Hour, Attendance tracker, Pomodoro, Exam tracker, Routine templates | `src/features/dashboard/` | Yes | No | Core daily-use; this is why people sign up. |
| Web push notifications | `server/webPush.mjs`, `src/utils/webPush.js` | Yes | No | Keep as the free alert channel. |
| Resource Vault (Batch Vault, Drive folders, question papers, playlists, skill roadmap, topic heatmap) | `src/features/vault/` | Yes | No | Content is community-contributed; gating it hurts contributors. |
| Notebook, Cheat Sheets | `src/features/vault/Notebook*.jsx`, `Cheatsheets*.jsx` | Yes | No | Core study tools. |
| Cover Page Generator (PDF/PNG) | `src/features/cover-page-generator/` | Yes | No | Most-used utility (has its own usage stats); best acquisition hook. |
| Life Planner (goals, timeline, mindmap, courses view), Dhaka Routes | `src/features/daily-life/` | Yes | No | Free; mindmap export could later be Pro but not worth it now. |
| InsideAUST: Canteen Menu, Free Rooms | `src/features/campus/`, `src/features/empty-classroom/` | Yes | No | Campus info should be public. |
| Community: Student / Alumni directory, Mentor Request, member profiles | `src/features/community/`, `src/features/active-members/` | Yes | No | Network effect — must stay free. |
| ConnectBox (real-time chat) | `src/features/messages/`, `server/wsServer.mjs` | Yes | No | Network effect. |
| Marketplace: AW Market, To-Let Mama, Lost & Found | `src/features/marketplace/` | Yes | No | Network effect. (Later idea: paid "featured listing" — not built.) |
| DownTime: Gaming Zone (rooms, events, game hub, mod tools) | `src/features/gaming/`, `server/gaming/` | Yes | No | Engagement; free. |
| Shadow: Course Reviews, Shadow Chat, Buzz (AUSTeddit) | `src/features/shadow/`, `src/features/buzz/`, `src/features/analytics/CourseReview.jsx` | Yes | No | Anonymous community content. |
| Study Zone / Zen Study Room | `src/features/study-room/` | Yes | No | Free (could add Pro ambient packs later — not built). |
| Settings: profile, linked accounts, Orbits, theme picker | `src/features/settings/`, `src/features/orbits/` | Yes | No (except premium themes above) | — |

### Left out on purpose

- Marked **Coming soon** (`src/data/features.js`): Bhara Koto, Taka Gelo Koi, Mass Meal Manager, Digital Footprint Cleaner, Password Manager, Floor Map, Library Pulse, Bus Tracker, Atlas Vault, Carbon Vault, Faculty Directory, Clubs Hub, Code Pulse, Media Tracker, Rumour or Real, Trivia, Roast CV. (Some, like Password Manager and Taka Gelo Koi, have real code, but the site calls them Coming Soon, so they're not sold.)
- **Stubs**: `/wakemeup` (auto-alarm, 39 lines), `/certificate` (39), `/roast-cv` (38), `/code-pulse` (77), `aust-bhara` page.
- **Stalk Road** overlay: runs on `mockStalkData.js` / `devFakeStops.js`.
- **AI routine-from-image** (`/api/extract-routine`, OpenAI): the server endpoint exists, but no page in `src/` calls it, so there's nothing to sell yet.

---

## 2. Proposed Free vs Pro split

Keep the existing names and prices — they're already on 5 pages and the payment modal:
**Node** (free), **Helix** ৳50 / 30 days, **Apex** ৳500 / 365 days (shown as "normally ৳600"). One-time payments, nothing auto-renews (matches PipraPay one-shot charges and the current copy).

### Recommendation: Helix and Apex unlock the same features

Every extra that Apex claims today is fake. Instead of building new things just to make Apex different, make **Apex = Helix for a year, cheaper** (৳500/yr ≈ ৳42/mo vs ৳50/mo, about 2 months free). That's honest and easy to explain.

| | Node (Free) | Helix ৳50 / month | Apex ৳500 / year |
|---|---|---|---|
| Dashboard, routine, attendance, deadlines, notices, Zero Hour | ✓ | ✓ | ✓ |
| CGPA Calculator, Semester Wise | ✓ | ✓ | ✓ |
| Resource Vault, Notebook, Cheat Sheets | ✓ | ✓ | ✓ |
| Cover Page Generator, Life Planner, Canteen, Free Rooms | ✓ | ✓ | ✓ |
| Community, ConnectBox, Marketplace, Gaming, Shadow, Study Zone | ✓ | ✓ | ✓ |
| Browser (web push) notifications | ✓ | ✓ | ✓ |
| Routine & semester export as **JPG** | ✓ | ✓ | ✓ |
| Question Bank Analyzer — analyze & view | ✓ | ✓ | ✓ |
| Themes | 4 (Dark, Blueprint, Notebook, Night Owl) | **All 25 themes + 23 layouts** | All |
| **Telegram reminders** (digest, first class, attendance, deadlines, notices) | — | ✓ | ✓ |
| **PDF exports** (routine, semester plan, transcript, semester tracker, notebook, QBA report) | — | ✓ | ✓ |
| **QBA saved analyses** | 3 courses | Unlimited | Unlimited |
| **Classroom result alerts** (Workspace) | — | ✓ | ✓ |
| Pro badge on profile/member card *(needs building, small)* | — | ✓ | ✓ (gold variant) |
| Duration | forever | 30 days | 365 days |

Optional (your call): **Dept Heatmap** as Pro. I'd leave it free.

### Open questions for you

1. **Light theme**: `light` uses the `zen` layout, so it becomes Pro under this split. Free users would have no light theme. Suggest: move Light to Free (or give it the `classic` layout).
2. **Gemini chat**: a small Gemini chat tab exists in the Vault material viewer side panel (`MaterialFolders.jsx:571`, `/api/gemini/chat`). Each message costs API money and it's open to everyone. Keep it free, make it Pro-only, or hide it? It is **not** sold as an "AI assistant" in this plan.
3. Existing buyers: does anyone in production already have `plan: 'pro'` / `'premium'` from a webhook? If so they need a `planExpiresAt` backfill.

### Copy to fix (once you approve)

Remove from `ProPage.jsx`, `PricingPage.jsx`, `DocsPage.jsx`, `BlogPage.jsx`, `TermsPage.jsx`, landing "Free & Premium Plans" card: no-ads, Vault GB storage, Excel, AI study assistant, predictive analytics, cloud sync, priority/24-7 support, mentorship, beta features, exclusive badges (unless we build the badge).

---

## 3. What gates Pro today, and what to build

### 3.1 Today

| Piece | State |
|---|---|
| `ProPage.jsx` → `POST /api/payment/create` with `{amount, purpose: 'pro-pro' \| 'pro-premium'}` | Works (needs `PIPRAPAY_API_KEY`). |
| `POST /api/payment/webhook` (`server/dev.mjs:7023`) | On "completed" sets `user.plan = 'pro' \| 'premium'` in the user's JSON `data` blob. **No expiry stored.** |
| `POST /api/payment/verify` | Returns PipraPay status. Doesn't check the payment belongs to the caller. |
| `PaymentSuccessPage.jsx` | Writes `austwise_plan` to `localStorage`; shows "success" even when verification fails. |
| `ProPage.jsx` `checkPlanExpiry` | Client-only 30-day expiry for Helix; Apex never expires. |
| `PRO_LAYOUTS` | Only shows a PRO tag in the layout menu. Not enforced. |
| Role access system (`server/roleAccess.json`, `useRoleAccess`, `PageGuard` in `App.jsx`) | Per-role hide/enable for pages and `feature:*` keys. No notion of plan. |
| SSLCommerz | Not integrated (only appears as a name in `googleCleaner.mjs`). |

### 3.2 Server (do first — this is what actually protects money)

1. **Price table on the server** — `server/plans.mjs`: `{ helix: {amount: 50, days: 30}, apex: {amount: 500, days: 365} }`. `/api/payment/create` takes only `planId`, ignores any client `amount`.
2. **Webhook hardening**: re-verify with PipraPay (already done), then check paid amount ≥ plan amount and `metadata.user_id` exists; record `pp_id` in a `payments` store so a replayed webhook can't extend twice.
3. **Store entitlement**: `user.plan` + `user.planExpiresAt`. New purchase: `planExpiresAt = max(now, current) + days` (so buying Apex during Helix stacks instead of wasting days — or keep "not credited" as the FAQ says; your call).
4. **One helper**: `isPro(user) => planExpiresAt > now` in `server/roleGuards.mjs`. Return `{ plan, planExpiresAt, isPro }` from `/api/auth/me`.
5. **Server gates** (client checks alone are bypassable):
   - Telegram: scheduler skips non-Pro users; subscribe/connect endpoint returns 402 for Free.
   - Workspace result push endpoint: 402 for Free.
   - QBA saved store: reject a 4th course key for Free in `PUT /api/store/user/*` for the QBA key prefix.
   - (Gemini, if made Pro) `/api/gemini/chat`: 402 for Free + daily cap.
6. `/api/payment/verify`: only answer if `metadata.user_id === auth.id`.
7. Optional admin: show plan + expiry in Admin → Users, and a manual "grant Pro" for refunds/support.

### 3.3 Client

1. `usePlan()` hook reading `isPro` from the auth context (`/api/auth/me`), **drop `localStorage` `austwise_plan`** entirely.
2. `<ProGate feature="pdf-export">` component + a small upgrade sheet linking to `/see-plans`.
3. Theme: in `ThemeProvider` / theme picker / layout menu, Free users picking a Pro theme get a live preview and the upgrade sheet; when Pro expires, fall back to `dark`.
4. Wrap the PDF buttons (routine, semester, transcript, semester tracker, notebook, QBA report) in `ProGate`; JPG stays open.
5. Settings → Notifications: Telegram toggle shows a Pro lock for Free.
6. `PaymentSuccessPage`: poll `/api/auth/me` until `isPro` is true (webhook may land a few seconds later); show "pending" honestly instead of always "success".
7. ProPage: "Current plan" + expiry date from the server; rewrite benefits, comparison table and FAQ to match section 2.
8. Pro badge on member card / profile (if approved).

### 3.4 Order of work

1. Server price table + entitlement + payment fixes (3.2.1–3.2.4, 3.2.6)
2. `usePlan` + success page (3.3.1, 3.3.6)
3. Gates: themes → PDF exports → Telegram → QBA → Workspace alerts
4. Copy cleanup on all pricing pages
5. Test with PipraPay sandbox end-to-end on localhost
