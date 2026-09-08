# MASTER PROMPT — Implement "Life Planner" inside AUSTWise → DailyLife

Copy everything below this line into your coding AI (Claude Code, Cursor, etc.) as one message.

---

## 0. Read This First (agent instructions)

You are implementing a full feature inside an **existing production app called AUSTWise**. Before writing any code:

1. **Explore the repo first.** Identify the framework (Next.js / React / Vue / etc.), the styling system (Tailwind / CSS Modules / styled-components), the database/ORM in use, the auth system, and the routing convention. Do **not** assume a stack — detect it from `package.json`, config files, and existing folder structure.
2. **Find the `DailyLife` hub page** — it currently renders a tab strip with: `TakaGeloKoi`, `Mess Meal`, `Life Planner`, `Footprint`, `Passwords`. The `Life Planner` tab currently shows a static "Coming Soon" placeholder card (icon + "Plan weeks, track habits, and keep campus life on one board."). **Replace that placeholder with the full feature described below.**
3. **Match the existing design system exactly.** Do not invent new colors, spacing, or component patterns. Reuse whatever primitives the `TakaGeloKoi` / `Mess Meal` tabs already use (cards, buttons, pills, icons, modals). Reference visual details in Section 1 only as a description of what already exists — pull the real tokens (hex values, radius, shadow, font) from the codebase's theme/config file or existing component CSS, not from your own guess.
4. **Reuse existing infrastructure.** Reuse the existing auth/session (all data below is scoped per logged-in student), existing DB connection, existing API layer conventions (REST vs RPC vs Server Actions — match what's already there), existing icon library, existing toast/notification system, existing modal/dialog component.
5. Work incrementally: (a) data layer → (b) API/server layer → (c) Dashboard view → (d) Goals list + detail → (e) Habit tracker → (f) Timeline → (g) Ledger → (h) Add/Edit Goal form → (i) PDF export. After each part, make sure it builds and is navigable before moving to the next.
6. Ask clarifying questions only if something is genuinely blocking (e.g., no auth system exists at all). Otherwise make the most sensible choice consistent with the existing codebase and proceed.

---

## 1. Where This Lives (visual context)

- App shell: left icon sidebar (Dashboard, Home, Analytics, Location/Map, Library, Notes, People/Community, Chat, Bolt/Quick actions, Shop, Coffee/Break, Dark-mode toggle, Settings, a "Pro/crown" badge at the bottom).
- Top bar: a pomodoro-style timer pill, play/reset/coffee icons, search, theme toggle, people icon, notification bell, profile chip (avatar, name "Mubasshir Mehedi", role "Student").
- Page background: warm off-white/cream. Cards: white, rounded-2xl, soft shadow, generous padding.
- Page header block: small icon chip + eyebrow label "DAILY ESSENTIALS · TOOLS HUB", big title **DailyLife** (with the second word in a warm gold/olive accent color), one-line subtitle "Exam prep, budgets & meals — all in one place."
- Below the header: a horizontal, scrollable **pill tab bar**: `$ TakaGeloKoi` · `🍴 Mess Meal` · `📅 Life Planner` (active) · `🛡 Footprint` · `🔑 Passwords`. Active pill = white bg, bold text, colored icon chip, subtle border. Inactive pills = muted gray icon chip, gray text.
- Below the tabs: a white rounded panel. Inside it, the **selected tool's own card** sits at the top with an icon, eyebrow "DAILY LIFE", title "Life Planner", subtitle "Goals, habits & week plan", and a "⋮" overflow menu — this is the tool's own mini nav/header, olive-accent border when active. **Below that divider is the actual tool content area** — currently a "Coming Soon" placeholder. That content area is what you are replacing with the whole feature below.

Build the feature so it renders **inside that content area**, using the app's existing routing (e.g. `/dailylife/life-planner` or a client-side tab state — match whatever `Mess Meal`/`TakaGeloKoi` already do) and its own internal sub-navigation (tabs or a small sidebar) for: **Dashboard, Goals, Habits, Timeline, Ledger**.

---

## 2. Feature Summary

"Life Planner" is a personal goal/task/habit/budget tracker for a graduating student. Content model (Phase → Goal → Task → Step, plus Habits and a Budget Ledger) is based on a real personal plan already drafted by the user — but the **feature itself must be fully generic and user-editable**, not hardcoded to any one person's data. Every student using AUSTWise gets their own empty planner they populate themselves (with sensible empty states).

Core capabilities:
- Organize life goals into **Phases** (custom, user-defined groups/timeframes)
- Each **Goal** has a type (`Goal` / `Milestone` / `Habit`, multi-select), cost, timing/deadline, dependencies on other goals, a "Definition of Done", and a list of **Tasks**
- Each **Task** has its own cost/due date and a list of **Steps** (checkbox + optional due date + optional note)
- A separate **Habit Tracker** (weekly grid + streaks + monthly heatmap)
- An auto-generated **Timeline** from all due dates across tasks/steps
- A **Budget Ledger** (transactions with running balance)
- **Export to PDF** — generates a polished, print-ready document in the same visual style as the in-app data (cover, dependency map, timeline, ledger, phase-grouped goal cards, habit tracker template, checklist, monthly review page)

---

## 3. Data Model

Use the existing DB/ORM. Below is the logical schema — translate field types to whatever the project already uses (Prisma/Drizzle/Mongoose/raw SQL etc.). Everything is scoped by `user_id` (reuse the existing user/auth table — do not create a new one).

```
Phase
  id            uuid/pk
  user_id       fk -> users.id
  title         string
  subtitle      string, nullable
  color         string (hex, user-pickable, default from a preset palette)
  order         int                 -- for manual drag-reorder

Goal
  id            uuid/pk
  user_id       fk -> users.id
  phase_id      fk -> Phase.id
  number        int                 -- auto-increment per user, for display ("Goal 3")
  title         string
  types         string[]            -- subset of ['goal','milestone','habit']
  cost_label    string, nullable    -- free text, e.g. "≈130,000–134,000৳ total" or "Cost: 0"
  timing_label  string, nullable    -- free text, e.g. "Before Jan 27, 2027"
  definition_of_done  text, nullable
  status        enum('not_started','in_progress','done')  -- derived from tasks but cacheable
  order         int
  created_at / updated_at

GoalDependency                       -- many-to-many self-relation on Goal
  id            uuid/pk
  goal_id       fk -> Goal.id        -- the goal that depends
  depends_on_goal_id  fk -> Goal.id  -- the prerequisite
  note          string, nullable     -- optional extra context shown next to the link

Task
  id            uuid/pk
  goal_id       fk -> Goal.id
  name          string
  cost_label    string, nullable
  due_label     string, nullable     -- free text due description ("Before 2027")
  due_date      date, nullable       -- structured date, used to populate Timeline; nullable because many items are relative ("Hold", "By 4.2")
  order         int

Step
  id            uuid/pk
  task_id       fk -> Task.id
  text          string
  due_label     string, nullable
  due_date      date, nullable
  is_done       boolean default false
  done_at       timestamp, nullable
  note          text, nullable
  order         int

Habit
  id            uuid/pk
  user_id       fk -> users.id
  name          string
  frequency     enum('daily','weekly','custom') default 'daily'
  target_days_per_week  int, nullable
  start_date    date
  archived      boolean default false
  order         int

HabitLog
  id            uuid/pk
  habit_id      fk -> Habit.id
  date          date
  done          boolean default true
  unique(habit_id, date)

Transaction
  id            uuid/pk
  user_id       fk -> users.id
  date          date
  item          string
  amount        decimal           -- positive = inflow, negative = outflow
  category      string, nullable  -- e.g. "Bike", "IELTS", "Furniture"
  related_goal_id  fk -> Goal.id, nullable
  order         int               -- for manual ordering when dates tie
```

Derived/computed (do not persist redundantly beyond simple caching):
- Goal progress % = done steps / total steps across its tasks
- Phase progress % = average of its goals' progress
- Overall progress % = average of all goals' progress
- Goal "locked" state = true if any `GoalDependency.depends_on_goal_id` goal is not 100% done
- Running ledger balance = cumulative sum of `amount` ordered by `date`, `order`
- Habit streak = consecutive days back from today with a `HabitLog.done = true` (respecting the habit's frequency)
- Timeline = union of all `Task.due_date` and `Step.due_date` (skip nulls), sorted ascending, each entry linked back to its Goal

---

## 4. API / Server Layer

Match the existing project's convention (REST routes, tRPC, or framework server actions). Endpoints needed, all scoped to the authenticated user:

```
GET    /api/life-planner/summary            -- dashboard aggregates (see Section 5.1)

GET    /api/life-planner/phases
POST   /api/life-planner/phases
PATCH  /api/life-planner/phases/:id
DELETE /api/life-planner/phases/:id
PATCH  /api/life-planner/phases/reorder      -- body: [{id, order}]

GET    /api/life-planner/goals               -- supports ?phase_id=&type=&q=&sort=
POST   /api/life-planner/goals
GET    /api/life-planner/goals/:id           -- full detail incl. tasks/steps/deps
PATCH  /api/life-planner/goals/:id
DELETE /api/life-planner/goals/:id

POST   /api/life-planner/goals/:id/tasks
PATCH  /api/life-planner/tasks/:id
DELETE /api/life-planner/tasks/:id

POST   /api/life-planner/tasks/:id/steps
PATCH  /api/life-planner/steps/:id            -- toggling is_done goes through here
DELETE /api/life-planner/steps/:id

GET    /api/life-planner/habits
POST   /api/life-planner/habits
PATCH  /api/life-planner/habits/:id
DELETE /api/life-planner/habits/:id
POST   /api/life-planner/habits/:id/log       -- body: {date, done}  (upsert)
GET    /api/life-planner/habits/:id/heatmap    -- body: {from, to}

GET    /api/life-planner/timeline             -- ?from=&to=
GET    /api/life-planner/ledger
POST   /api/life-planner/ledger
PATCH  /api/life-planner/ledger/:id
DELETE /api/life-planner/ledger/:id

POST   /api/life-planner/export/pdf           -- body: {sections?: string[]} -- see Section 7
```

All mutating endpoints must validate that the record belongs to the requesting user before returning/modifying it.

---

## 5. Screens (build in this order)

### 5.1 Dashboard (default view when opening Life Planner)
- Overall progress ring/donut (%), computed from all goals.
- 5 (or however many the user has) phase progress bars, each clickable → jumps to Goals view filtered to that phase.
- "Today" panel: next 2–3 upcoming timeline items (closest future due_date, plus anything overdue flagged in red).
- Next deadline countdown (days remaining to the nearest upcoming due_date).
- Quick stats row: Goals done/total, Habits active, current ledger balance.
- Buttons: **+ New Goal** (opens Add/Edit Goal modal), **Export PDF**, **View Timeline**, **View Ledger**.
- Empty state (brand-new user, zero goals): friendly illustration/icon + "Start your plan" CTA that opens the Add Goal modal, plus an optional "Load example plan" secondary action that seeds a small starter set of phases/goals so the UI isn't empty (do NOT hardcode someone else's personal data — use generic examples like "Phase 1 — Setup", "Goal 1 — Example goal").

### 5.2 Goals view (Phase/Goal list)
- Phases render as collapsible sections, in `order`.
- Each Goal is a card: title, `types` badges (Goal/Milestone/Habit, color-coded), cost pill, timing label, a thin progress bar (done steps / total steps), and a small lock icon + tooltip if it has an incomplete dependency.
- Controls: search box (matches title/notes), type filter (multi-select chips), sort dropdown (by phase order / by due date / alphabetical), a "+ Add Phase" and "+ Add Goal" button.
- Tapping a card opens Goal Detail.
- Support drag-to-reorder within a phase and drag-between-phases (nice-to-have if the project already has a drag library available; otherwise expose explicit "Move to phase" + up/down controls).

### 5.3 Goal Detail
- Header: colored/gradient band (color comes from the parent Phase, or a per-type default), Goal number + title, type badges, cost pill, timing.
- "Depends on: …" / "Unlocks: …" rows — each dependency is a clickable chip that navigates to that Goal's detail. If a dependency isn't done, show a locked banner ("Waiting on Goal X").
- Definition of Done block (editable inline or via Edit button).
- Task list: each task is expandable/collapsible, shows its cost/due, and its Steps.
- Each Step row: checkbox (toggling calls `PATCH /steps/:id` immediately — optimistic UI, then persists `done_at`), step text, optional due date shown as a small pill, optional note (click to expand a small textarea).
- Buttons: **Edit Goal**, **Add Task**, and per-task **Add Step**; delete affordances behind the task/step's own overflow menu (with confirm).
- Due-date editing uses the app's existing date picker component.

### 5.4 Habit Tracker
- Weekly grid: rows = habits, columns = the 7 days of the currently viewed week, with prev/next week navigation and a "This week" jump.
- Tapping a cell toggles that day's `HabitLog`.
- Per-habit streak counter (current streak + best streak) next to the row label.
- Monthly heatmap (GitHub-contribution style) below the grid, per habit or as a combined view — toggle between habits via a small selector.
- **+ New Habit** button → name, frequency (daily/weekly + target days/week), start date.
- Archive (not hard-delete) a habit from its row menu.

### 5.5 Timeline
- Chronological list built from the `/timeline` endpoint (Task and Step due_dates merged), grouped by date, each row shows the description and links back to its Goal.
- A "Today" divider/marker inserted in the correct chronological position; anything before today with an incomplete step is visually flagged (red "Overdue" tag).
- Controls: date-range filter, "Jump to today" button.

### 5.6 Ledger
- Table: date, item, amount (colored red/green for outflow/inflow), running balance (computed client- or server-side, ordered by date then manual `order`).
- Summary row/card: total planned inflow, total planned outflow, current balance.
- **+ Add transaction** opens a small form: item, amount (with a +/- toggle or signed input), date, category (free-text or dropdown of previously used categories), optional link to a Goal.
- Inline edit/delete per row.

### 5.7 Add/Edit Goal modal (used from Dashboard and Goals view)
Fields: Title (text), Phase (dropdown, with a "+ new phase" inline option), Type (multi-select: Goal/Milestone/Habit), Cost label (text), Timing/deadline label (text) + optional structured date, Depends on (multi-select searchable list of the user's other goals, excluding itself and anything that would create a circular dependency — validate this), Definition of Done (textarea), Tasks (repeatable group: name, cost, due — each with its own repeatable Steps sub-list: text + due + note). Support saving a goal with zero tasks (can add tasks later from Goal Detail).

---

## 6. Cross-cutting requirements

- **Responsive**: must work on the existing app's mobile breakpoint the same way the other DailyLife tools do (check how `Mess Meal`/`TakaGeloKoi` behave on small screens and mirror it — likely a stacked/scrollable layout).
- **Optimistic UI** for checkbox toggles (steps, habit log) with rollback on request failure + a toast/error indicator using the app's existing notification system.
- **Empty states** for every screen (no phases yet, no habits yet, no transactions yet, no timeline items yet) — short friendly copy + a relevant CTA button, styled consistently with any existing empty states elsewhere in the app.
- **Loading states** using the app's existing skeleton/spinner pattern, not a new one.
- **Accessibility**: checkboxes and buttons must be real interactive elements (not divs with onClick only), forms must have labels, color is never the only signal (e.g. pair the red "overdue" tag with the word "Overdue", not just color).
- **No hardcoded personal data** anywhere in the shipped code — all seed/example content must be generic placeholder text.

---

## 7. PDF Export

- Endpoint `POST /api/life-planner/export/pdf`, optional body `{ sections: ["cover","dependency_map","timeline","ledger","phases","habit_tracker","checklist","review"] }` (default = all).
- Server pulls the current user's live data (phases → goals → tasks → steps, habits + logs, ledger) and renders an HTML template with the following sections, styled to match the in-app color/typography as closely as practical:
  1. **Cover** — plan title, generated date, quick stats (goal count, done count, phase count).
  2. **Dependency map** — for each goal that has dependencies/unlocks, a simple text/flow rendering of the chain.
  3. **Timeline** — chronological table of all dated tasks/steps, "today" row highlighted, overdue rows flagged.
  4. **Ledger** — transaction table with running balance + summary totals.
  5. **Phase-grouped goal cards** — one card per goal: header (title, type badges, cost, timing), depends-on/unlocks, Definition of Done, tasks with their steps as a checklist (render current `is_done` state as a checked/unchecked box, not always empty).
  6. **Weekly habit tracker template** — blank grid (habit names pre-filled from the user's actual habits, days blank for printing) OR, as a toggle, the current week's actual data.
  7. **Master checklist** — condensed one-page view of every goal/task, checkbox reflects real `is_done` aggregate.
  8. **Monthly review** — blank template page (questions + blank lines), unchanged/static.
- Rendering: use a headless-Chromium HTML-to-PDF approach (Playwright or Puppeteer, whichever fits the existing backend runtime) rather than a manual PDF-drawing library, so the layout can reuse real CSS.
- Return the PDF as a downloadable file response (`Content-Type: application/pdf`, `Content-Disposition: attachment`), and on the frontend trigger a normal file download from the Export PDF button, with a loading state on the button while the server renders.
- Keep the generated PDF visually consistent with the in-app styling (same accent colors per phase/type, similar card/table look) so it feels like an extension of the product, not a generic export.

---

## 8. Definition of Done for this feature

- [ ] A brand-new user opens the Life Planner tab and sees a working empty-state Dashboard, not a crash or blank screen.
- [ ] User can create a Phase, a Goal (with types, dependencies, cost, timing), Tasks, and Steps entirely through the UI — no direct DB access needed.
- [ ] Checking a Step checkbox persists immediately and updates the Goal's progress bar and the Dashboard's overall progress without a full page reload.
- [ ] A Goal with an unmet dependency visibly shows as locked, and clicking the dependency chip navigates to the blocking Goal.
- [ ] Habit Tracker supports adding a habit, toggling daily logs, and shows a correct streak count.
- [ ] Timeline correctly aggregates and sorts every dated Task/Step and highlights "today" + overdue items.
- [ ] Ledger supports adding/editing/deleting transactions and always shows a correct running balance.
- [ ] Export PDF produces a downloadable, correctly formatted PDF reflecting the user's real current data.
- [ ] All new UI visually matches the existing AUSTWise / DailyLife design language (verified by placing a new Life Planner screenshot next to an existing Mess Meal/TakaGeloKoi screenshot).
- [ ] No feature in this spec leaks another user's data (verify all queries are scoped by the authenticated user).

---

## 9. Suggested build order (if you want a literal checklist to work through)

1. Schema + migrations for all tables in Section 3.
2. API routes in Section 4 with auth scoping + basic validation.
3. Dashboard screen (Section 5.1) wired to real (initially empty) data.
4. Goals list + Goal Detail (5.2, 5.3) with Add/Edit Goal modal (5.7).
5. Habit Tracker (5.4).
6. Timeline (5.5).
7. Ledger (5.6).
8. Wire up the "Export PDF" button end-to-end (Section 7).
9. Pass through the Definition of Done checklist (Section 8).
