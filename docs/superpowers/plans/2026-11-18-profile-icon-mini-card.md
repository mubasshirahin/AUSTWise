# Profile Icon → Mini Stats Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every profile icon opens the Student Directory mini stats card first; the profile opens only from its "View profile" button.

**Architecture:** Reuse `MemberAvatarPreview` (`src/features/community/DirectoryShared.jsx`). Move its CSS out of `CommunityPage.css` into its own file so other pages get it, and add an opt-in `floating` mode (portal + fixed position) for icons inside clipping/scrolling containers. Shared stat-row building and notice-poster lookup live in a small pure util with vitest tests.

**Tech Stack:** React 19, Vite, vitest (node env — no DOM test library; UI is verified in the browser).

**Spec:** `docs/superpowers/specs/2026-11-18-profile-icon-mini-card-design.md`

## Global Constraints

- No gradients, glows, tinted overlays or accent stripes (CLAUDE.md / skill-style). Flat theme tokens only.
- Active Members' own `MemberPopover` stays unchanged.
- No commits containing AI names / Co-Authored-By lines (user memory).
- Local `.env` hits production: verify UI in a mocked harness, never by writing data through the dev server.
- Directory pages must look and behave exactly as today (default, non-floating mode).

## Review Focus

- Avatar inside `.notice-list` (`overflow-y: auto`) or a card with `overflow: hidden` → card must not be clipped (floating mode; check in Tasks 3–4).
- Icon near the right/bottom viewport edge, 375px phone → card stays fully on-screen (clamp in Task 2).
- Click on the notice avatar → must not expand/collapse the notice or start a swipe (stopPropagation, Task 3).
- Poster not in member directory (old/admin notices, cache empty) → card still opens with notice fields (test in Task 1).
- Page scrolls while card open → card follows the icon or closes; never floats detached (Task 2).

---

### Task 1: Shared preview-data util

**Files:**
- Create: `src/utils/memberPreview.js`
- Test: `src/utils/memberPreview.test.js`
- Modify: `src/features/community/StudentDirectory.jsx:73-86` (use the util instead of its local `getStudentPreviewStats`)

**Interfaces:**
- Produces: `getMemberPreviewStats(member: object) => Array<[label: string, value: string]>` — rows Department, AUST ID, AWID, Semester, Lab, Batch, Blood (same labels/order as today's `getStudentPreviewStats`; AWID falls back to `createAwid(department)` only when `member.department` exists).
- Produces: `resolveNoticePoster(notice: object, members: object[]) => object | null` — returns the directory member whose `id === notice.postedBy` merged over `{ id: notice.postedBy, name: notice.postedByName, role: notice.postedByRole, avatar: notice.postedByAvatar, section: notice.postedBySection, labSection: notice.postedByLabSection }`; returns that fallback object when no match; returns `null` when `notice.postedByName` is empty.

- [ ] **Step 1: Write failing tests** — `resolveNoticePoster` returns directory member fields (e.g. `department: 'CSE'`) when `postedBy` matches; returns fallback with `name`/`role` from the notice when `members` is `[]`; returns `null` for `{ title: 'x' }`. `getMemberPreviewStats({ department: 'CSE', semester: 3, labSection: 'A1' })` contains `['Lab', 'A1']` and `['Semester', 'Year 2.1 (Semester 3)']` (match `formatSemesterLabel` output).
- [ ] **Step 2: Run** `npx vitest run src/utils/memberPreview.test.js` → FAIL (module not found).
- [ ] **Step 3: Implement** both functions; move `extractStudentId` into the util if `getMemberPreviewStats` needs it and import it back in StudentDirectory.
- [ ] **Step 4: Run** the test → PASS; `npx vite build` → succeeds.
- [ ] **Step 5: Commit** `feat: shared member preview util`.

### Task 2: MemberAvatarPreview — own CSS + floating mode

**Files:**
- Create: `src/features/community/MemberAvatarPreview.css` (move lines `CommunityPage.css:845-~900`, the `.alumni-avatar-preview` / `.alumni-profile-preview*` base rules; leave the `.student-dir …` overrides where they are)
- Modify: `src/features/community/DirectoryShared.jsx:94-180` (import the CSS; add props)

**Interfaces:**
- Produces: `MemberAvatarPreview({ member, roleLabel, previewStats, onOpenProfile, avatarClassName, avatarStyle, className, floating = false, avatarContent })`.
  - `floating`: render the card via `createPortal(document.body)`, `position: fixed`, `z-index: var(--z-modal)`, placed under the icon, clamped 8px inside the viewport (flip above when no room below); opens on mouse `pointerenter` with 140ms close delay on `pointerleave` of icon/card (native listeners — React synthetic leave is unreliable across portals), toggles on tap, keyboard focus opens only when `:focus-visible`; closes on outside pointerdown, Escape; repositions on scroll/resize.
  - `avatarContent`: optional node rendered inside the icon button instead of photo/initials (lets call sites keep their existing avatar markup, e.g. Messages' `<img onError>`).
  - Icon button `onClick` calls `e.stopPropagation()`.

- [ ] **Step 1:** Move CSS, import it in `DirectoryShared.jsx`; Student/Alumni/Faculty directories unchanged (default `floating=false`).
- [ ] **Step 2:** Add `floating` + `avatarContent` + stopPropagation.
- [ ] **Step 3: Verify** `npx vite build` passes; in a mocked harness (pattern: `.cb-harness/`, delete after) render one non-floating and one floating preview inside an `overflow:hidden` box at a 375px viewport: floating card fully visible and on-screen; hover opens/closes on desktop; tap toggles; outside tap closes.
- [ ] **Step 4: Commit** `feat: floating mode for member mini card`.

### Task 3: Notice Board poster avatar + remove bell popover

**Files:**
- Modify: `src/features/dashboard/NoticeBoard.jsx` (bell-tile popover state/effects/JSX added earlier today: remove; restore plain `<div className="schedule-icon-tile"><BellRing size={20} /></div>`; poster avatar ~line 468)
- Modify: `src/features/dashboard/DashboardPage.css` (delete `.notice-stats-trigger` and `.notice-stats-pop*` rules)

**Interfaces:**
- Consumes: `resolveNoticePoster`, `getMemberPreviewStats` (Task 1); `MemberAvatarPreview` with `floating` (Task 2); `getCachedMembers()` from `src/utils/memberDirectory.js`.

- [ ] **Step 1:** Remove the bell popover (JSX, hooks, CSS).
- [ ] **Step 2:** When `resolveNoticePoster(notice, getCachedMembers())` is non-null, render `<MemberAvatarPreview floating member={poster} roleLabel={poster.role?.toUpperCase()} previewStats={getMemberPreviewStats(poster)} onOpenProfile={() => navigate(`/members/${encodeURIComponent(poster.studentId || poster.id)}`)} avatarClassName="notice-author-avatar" avatarStyle={{}} />`; keep the `UserRound` fallback for null.
- [ ] **Step 3: Verify** build; harness (mock auth/store as before): avatar click opens card, notice does not expand, card not clipped by `.notice-list`, "View profile" calls navigate; mobile 375px.
- [ ] **Step 4: Commit** `feat: notice poster mini card, drop bell stats`.

### Task 4: Remaining direct-to-profile icons

**Files (each: replace the `onClick={() => navigate(...)}` icon button with `MemberAvatarPreview floating`, keeping the existing className via `avatarClassName` and existing markup via `avatarContent`, moving the navigate into `onOpenProfile`):**
- `src/features/messages/MessagesPage.jsx:553-561` (member = `peer`, id `peerId`)
- `src/features/community/MentorRequests.jsx:295-302` (member = `{ id: req.contributorId, name: req.requesterName, avatar: req.avatar }`)
- `src/features/admin/AdminPanelPage.jsx:1988-1996` (`sharer`) and `:2025-2033` (`entry`)
- `src/features/vault/BatchDriveCodeGenerate.jsx:361-370` (`entry`; use `navigate` from react-router instead of `window.location.href`)

Stats for each: `getMemberPreviewStats(member)` merged over the matching `getCachedMembers()` entry when one exists (same id lookup as `resolveNoticePoster`).

- [ ] **Step 1:** Convert all five sites.
- [ ] **Step 2: Verify** `npx vite build` and `npx vitest run` pass; `grep -rn "navigate(\`/members" src` shows only `onOpenProfile` handlers and non-icon links (MemberProfilePage redirect, Settings "open profile" button, Active Members).
- [ ] **Step 3:** Spot-check Messages header and Mentor Requests in the harness (avatar opens card; layout unchanged).
- [ ] **Step 4: Commit** `feat: mini card on every profile icon`.
