# AUSTWise → All Bangladesh (multi-university) — Plan

## Context
AUSTWise is currently built only for AUST. "aust" appears about 950 times in `src/` and about 200 times in `server/`, and **there is no "university" concept at all**: the user profile, routines, notices, directories and marketplace all assume one shared AUST population. The goal is to open it to every Bangladeshi university (around 55 public and 115+ private). Each university has a different system, so the work splits into:
- **General:** same for everyone. Build it once.
- **Per-university config:** the editable or changeable parts. Each university gets its own profile.
- **Campus-only features:** these work only where someone has entered that campus's data. Elsewhere they stay hidden.

**Verdict:** **Medium–Hard, but NOT a rewrite.** Around 70% of the features (chat, marketplace, buzz, money tracker, password vault, productivity, gaming, study room) are already generic. The hard parts are identity and auth, the academic structure (about 20 copies of the department list), the course catalog and campus geography.
**Time:** about **10–14 weeks of focused solo work** (with Claude) to finish the platform and pilot 3–5 universities. Adding each new university afterwards is mainly **data entry (1–3 days each)**. Collecting data, not writing code, is the long pole.

---

## 1. What's general vs. per-university

### A. Already general (only the text/labels need changing)
Messages/ConnectBox, Shadow chat, Buzz (AUSTeddit), Marketplace, ToLet, Lost & Found, TakaGeloKoi, Mess Meal, Life Planner, Passwords, Footprint, Productivity, Study Room, Code Pulse, Workspace (Google Classroom), Chill Zone, Gaming, Orbits, Themes, Pro plans, Notice Board, Exam Tracker, Bus Tracker (admin-entered).

### B. Per-university CONFIG (one editable profile per university)
| Item | AUST today (hardcoded where) | Varies by university |
|---|---|---|
| Email domain(s) | `@aust.edu`: about 25 checks (`server/userStore.mjs:848`, `server/auth.mjs:309-349`, `src/features/auth/AuthPage.jsx:14`, `src/utils/authStorage.js:169`) | `@du.ac.bd`, `@northsouth.edu`, `@bracu.ac.bd`, `@diu.edu.bd`… some have no student email |
| Student ID rule | parsed from the email prefix (`authStorage.js:493`, `AdminPanelPage.jsx:84`, `SettingsPage.jsx:913`, `memberPreview.js:10`) | separate `studentId` field + a regex for each university |
| Departments | `['CSE','EEE','CE','ME','IPE','TE','ARCH','BBA']`, copied about 20× (`server/userStore.mjs:86`, `ResultTable.jsx:32`…) | list in config |
| Term system | 8 semesters ("1.1…4.2"), 10 for ARCH (`src/utils/semester.js`) | Year-semester (2 terms) / Trimester (Spring-Summer-Fall, NSU/EWU/UIU) / Annual (National Univ.) |
| Section / lab group | A–D, A1–D2 (`userStore.mjs:114`, `getUserBatchGroup.js` `(n-52)%8`) | free list or none |
| Batch format | "Name 52" (`authStorage.js:549`) | number / intake year / "Spring 2024" |
| Grading scale | UGC scale A+=4.00 at 80% (`ResultTable.jsx:14`, `SemesterTracker.jsx:113`) | most use UGC; some private universities use different cut-offs, A at 4.0 with no A+ |
| Marks split | Att 10 / Quiz 20 (best 2 of 3) / Mid 20 / Final 50 (`SemesterTracker.jsx:79`) | different everywhere |
| Total credits / program length | 160 credits, 4.2 (`mockData.js:18`, `userStore.mjs`) | 120–170 |
| Period grid | 12 × 50-min periods from 08:00, plus a Ramadan grid (`WeeklyPlanner.jsx:175`, `RoutineTemplatesPanel.jsx:31`, `EmptyClassroomPage.jsx:14`) | 75/90-min slots (NSU, BRAC) etc. |
| Week days | Sun–Thu, week runs Fri–Thu (`mockData.js:21`, `WeekSchedule.jsx:122`) | Sat–Wed, Sun–Thu, some on Saturdays |
| Semester calendar shape | 14 weeks, wk8 break, wk9 mid (`src/utils/semesterDates.js`) | different length and mid-term week |
| Semester start date | one global `aust-semester-start` | one per university (or per term) |
| Cover page | AUST logo + name (`CoverPageGeneratorPage.jsx:10,1030`) | logo, name, field labels |
| Branding text | "Inside AUST", "AUST Edition", 'AUST User' fallbacks, Terms page | `{uni.shortName}` |

### C. Campus-only data (feature visible only when that university has data)
- InsideAUST/Campus: floor map, rooms, Free Rooms, Library geofence, Canteen.
- Bhara Koto: destination is AUST Tejgaon; 141 KB `dhakaRouteCosts.json`. Needs a destination for each campus, or "fare to any point".
- Course catalog: `src/data/courses.js` and `server/courses.json` (732 courses), `transcriptTemplateData.js`. **These 3 copies already disagree on credits.**
- Prerequisite tree, syllabus progress (CSE-only), dept heatmap.
- Clubs seed data.

---

## 2. Architecture decision (recommended)
- **One app, one database, shared tables + a `universityId` column.** No separate deployment or database per university; that would cost too much and be too hard to maintain on a free Render/Supabase setup.
- **University registry:** a new `University` table (id, slug, name, shortName, logoUrl, emailDomains[], studentIdRegex, status: `active|pilot|request`), plus a `UniversityConfig` JSON (departments, termSystem, sections, grading, marksSplit, periods, workDays, calendarShape, totalCredits, campus{coords, libraryGeofence, floors…}, features{campus:true,bharaKoto:false…}).
- AUST = the first record. All current data gets `universityId='aust'`, so nothing breaks.
- **Client:** a `UniversityProvider` context (like ThemeContext) loads the user's university config. Every hardcoded constant reads from `useUniversity()`.
- **Server:** a `getUniversityConfig(id)` helper. Every query/store key is scoped by `universityId`.
- **Cross-university:** keep chat, gaming and Shadow global, with a filter. Directories, notices, routines, Buzz channels, marketplace and the CR system default to the user's own university.
- **Unverified/no-email universities:** allow Gmail signup + an `UNVERIFIED` badge. A university admin or CR approves (reuse the existing `PENDING_APPROVAL` flow).
- Keep the internal `aust-*` localStorage keys (renaming would orphan data). Prefix only new per-university shared keys.

---

## 3. Phased implementation

### Phase 0 — Foundation (≈1.5 weeks)
- Add `University` and `UniversityConfig` to `server/prisma/schema.prisma` and `server/prismaTables.sql` (boot DDL). Add `universityId` to `AuthUsers.data`, the Prisma `User` table, and the Routine, SharedRoutine, Notice, MarketplaceListing, Club, QuestionPaper, RoutineTemplate, Course, CampusLocation, CanteenMenuItem and LibraryCheckin tables.
- Write `universities/aust.json` holding today's exact AUST values (single source of truth). Seed it.
- Backfill script: all existing rows → `aust`. **Test against a DB copy first**, because the local `.env` points at the production DB.
- New files: `server/universities.mjs` (registry + config getter), `src/context/UniversityContext.jsx` + `useUniversity()`.
- `GET /api/universities` (public list) and `GET /api/universities/:slug/config`. Add both to `server/publicApi.mjs`.

### Phase 1 — Identity & signup (≈1.5 weeks)
- Signup step 1: pick your university (searchable). The email domain is validated against `uni.emailDomains`. Replace all `@aust.edu` checks with `isAllowedUniEmail(email, uni)` (server: `userStore.mjs`, `auth.mjs`, `dev.mjs` access flows, `wsServer.mjs:244`; client: `AuthPage.jsx`, `authStorage.js`).
- Add an explicit `studentId` field, validated by `uni.studentIdRegex`. Replace the email-parsing helpers with it, keeping the email parse only as a fallback for AUST.
- Google sign-in: map the domain to a university automatically.
- AWID: `STU-{UNI}-{DEPT}-AW…`; existing AUST AWIDs stay as they are.
- "My university isn't listed" leads to a request form, stored with `status=request` and shown in the admin panel.

### Phase 2 — Academic config (≈3 weeks; the biggest refactor)
- Delete the ~20 department-list copies → `uni.departments`.
- `src/utils/semester.js` becomes a term engine supporting `semester2`, `trimester` and `annual`. Labels come from config ("2.1" vs "Fall 2025").
- Sections and lab groups come from config. Remove the `(n-52)%8` rule and the 512-slot constant in `server/prisma.js:1140` (compute it from config instead).
- Grading: one `gradingScale` + `marksSplit` used by `ResultTable.jsx` and `SemesterTracker.jsx` (remove the duplicate scale).
- Period grid + Ramadan grid + workDays → one `timeSlots` config used by `WeeklyPlanner.jsx`, `RoutineTemplatesPanel.jsx`, `EmptyClassroomPage.jsx` and `CanteenMenu.jsx`.
- `semesterDates.js` / `WeekSchedule.jsx` / `RoutineAttendanceTracker.jsx`: weeks, break and mid-term week come from `calendarShape`; the semester start date is set per university.
- `server/routineExtractor.mjs`: the prompt gets the university name, days and slots from config.
- `academicEngine.mjs` semester transition is run per university.

### Phase 3 — Data scoping (≈2 weeks)
- Every list/read API filters by `req.user.universityId`: directories, notices, routines/templates, shared routines (slot key becomes `uni|dept|sem|sec|lab`), marketplace/ToLet/Lost&Found, clubs, question bank, vault/batch drive, Buzz channels, dept heatmap, course polls.
- SharedStore global keys get a per-university namespace (e.g. `{uni}:semester-start`).
- Presence/online members: filter by university by default, with an "All Bangladesh" toggle.

### Phase 4 — Courses & campus data (≈1.5 weeks code; data ongoing)
- Merge the three course copies into one DB `Course` table (universityId, dept, code, title, credits, semester, prereqs) and fix the credit mismatches. Admin/CR UI to add courses + a CSV import.
- Feature flags `uni.features.{campus, bharaKoto, library, canteen, prereqTree, syllabus}`. Hide a page or tab when the flag is off (reuse `server/roleAccess.json` / Page availability logic).
- Bhara Koto: the destination comes from the university's campus coordinates; route data stays Dhaka-wide.
- Cover page: logo, name and field labels from config; logo upload per university.

### Phase 5 — Roles & admin (≈1.5 weeks)
- New role `uni_admin` (scoped to one university): manages its config, courses, campus data, approvals and CR/SR. Global `admin` keeps everything.
- Admin panel: University switcher + Universities section (requests, config editor, feature flags).
- Moderator/Gali strikes stay global.

### Phase 6 — Branding & content (≈1 week)
- Replace every UI "AUST" with `{uni.shortName}` ("Inside AUST" → "Inside {uni}"). Keep the `/insideaust` route working with a redirect to `/campus`.
- Landing, About, Terms, Privacy, index.html meta, PWA manifest: national wording. **Decide the brand name** (keep "AUSTWise" or rename to something national). Renaming costs about 236 mentions.

### Phase 7 — Pilot & rollout (≈1.5 weeks + ongoing)
- Pilot with 3–5 universities that have friends/contacts (e.g. one each of: a trimester private university, a semester private university, a public university, National University). Collect each one's config through a Google Form → JSON.
- Recruit a campus ambassador/CR per university to keep the data up to date.

---

## 4. Time & effort summary
| Phase | Effort |
|---|---|
| 0 Foundation | 1.5 wk |
| 1 Identity/signup | 1.5 wk |
| 2 Academic config | 3 wk |
| 3 Data scoping | 2 wk |
| 4 Courses & campus | 1.5 wk |
| 5 Roles/admin | 1.5 wk |
| 6 Branding | 1 wk |
| 7 Pilot | 1.5 wk |
| **Total** | **≈13 weeks full-time** (part-time + studies: 4–5 months) |

Each new university after that: 1–3 days of data (departments, grading, slots, courses).

## 5. Risks
- **Production DB:** the local `.env` hits the live DB, so the migration/backfill must first run on a Supabase branch or copy.
- **Infra:** the Render free plan + one 7.6k-line `dev.mjs` will strain at national scale. Plan a paid Render/Fluid instance and split `dev.mjs` into route modules during Phase 3.
- **Data quality:** course catalogs for 150+ universities can't be entered by hand. Crowdsource them via CRs, with an admin approval step.
- **Verification:** universities without student email increase the risk of fake accounts, so verify through CR/uni_admin approval.
- **Legal:** the Terms/Privacy pages name AUST and must be rewritten.

## 6. Verification (each phase)
- AUST regression: after each phase, an existing AUST account must see exactly the same routine, CGPA, grid and departments (aust.json = old constants).
- Create a test university (e.g. a trimester config + different grading) on a non-production DB. Sign up → routine → CGPA → cover page → directory, and check that no AUST data leaks across.
- Run with `npm run dev -- --vite` on a DB copy. Check the browser preview for each role (student, CR, uni_admin, admin).
