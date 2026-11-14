# Migration Plan: localStorage → SQL Server 2022 (Prisma ORM)

## Overview

Replace all localStorage-based data persistence with SQL Server 2022
accessed through Prisma ORM.  The React UI remains untouched — only backend storage
and a thin API client layer are added so the frontend can be migrated incrementally.

## Phase 1 — Schema Design (this PR)

### Tables (mapped from existing localStorage shapes)

| Table | localStorage source | Key fields |
|---|---|---|
| `User` | `authStorage.js` / `userStore.mjs` | id, email, passwordHash, role, department, batchNo, section, labSection, yearSemester, cgpa, creditsCompleted, totalCredits |
| `Routine` | `aust-user-routine` key | userId, weekDay, timeSlot, courseCode, room, isActive |
| `SemesterResult` | `aust-helper-semester-results-v2` | userId, semester, courses[] as JSONB |
| `QuestionPaper` | `aust-question-bank-user-v2` / IndexedDB | contributorId, course, type, year, semester, paperNo, fileName, fileData (BYTEA) |
| `MarketplaceListing` | `aust-marketplace-v1` (exchange, tolet, lostFound) | type enum (EXCHANGE/LET/LOST_FOUND), contributorId, title, price/rent, category, status |
| `MentorRequest` | marketplace mentors/mentorRequests | requesterId, topic, description, contact, responses[] as JSONB |
| `Message` | `aust-messages-v1` | conversationId, fromId, toId, text, read, deleted, edited, editedAt |
| `MessageReaction` | inline in messages | messageId, userId, emoji |
| `Notice` | `NoticeBoard.jsx` (local state) | title, body, postedBy, postedAt, expiresAt, pinned |
| `CanteenMenuItem` | `CanteenMenu.jsx` (local state) | day, mealType (breakfast/lunch/snacks), name, price, available |
| `CanteenFeedback` | `canteenFeedbackStorage.js` | userId, menuItemId, rating, comment |
| `LibraryCheckin` | `libraryDB.mjs` (was SQL Server) | deviceId / userId, lat, lng, checkedInAt |
| `Club` | `ClubPortal.jsx` (local state) | name, description, category |
| `ClubMembership` | — | clubId, userId, role (member/lead/admin) |
| `Invitation` | `dev.mjs` Invitations table (was SQL Server) | email, role, token, status, invitedBy, expiresAt |
| `RoleApplication` | `aust-role-applications-v1` | userId, appliedRole, department, semester, status |
| `TranscriptTemplate` | `transcriptTemplates.js` | userId, name, data JSONB |
| `RoutineTemplate` | `routineTemplates.js` | userId, name, schedule JSONB |

### Key design decisions

1. **Images & large files** — Marketplace listing images stay as base64 data URLs
   in a TEXT column (≤ 100 KB each).  Question paper PDFs go into `BYTEA`.
   A future phase can move these to S3/Cloudflare R2.

2. **Reactions & responses** — Stored as JSONB arrays on the parent row
   until they grow large enough to warrant separate tables.  This matches the
   existing localStorage nesting and avoids complex joins for simple reads.

3. **Auth** — The existing `server/userStore.mjs` (file-based users.json) is
   replaced by the User table.  The `server/auth.mjs` JWT logic stays identical;
   only `createUser`, `validateLogin`, `getUserById` change their data source.

4. **Telegram users** — `server/telegramDB.mjs` (was SQL Server) → TelegramUser
   table in PostgreSQL.

5. **Library presence** — `server/libraryDB.mjs` (was SQL Server) → LibraryCheckin
   table in PostgreSQL.

6. **Semester results** — Each user has an array of semester objects stored as
   JSONB in `SemesterResult`.  The structure matches exactly what the frontend
   `SemesterTracker.jsx` expects, so no frontend changes needed.

## Phase 2 — Backend REST Endpoints (this PR)

New endpoints in `server/dev.mjs` that mirror the localStorage functions:

| Endpoint | Replaces | Auth |
|---|---|---|
| `GET /api/grades` | `getSemesterResults()` | JWT (owner) |
| `POST /api/grades` | `saveSemesterResult()` | JWT (owner) |
| `GET /api/marketplace` | `listExchangeItems()` etc. | Public read, JWT write |
| `POST /api/marketplace` | `addExchangeItem()` etc. | JWT |
| `DELETE /api/marketplace/:id` | `deleteExchangeItem()` | JWT (owner/admin) |
| `GET /api/messages` | `getConversations()` | JWT (owner) |
| `POST /api/messages` | `sendMessage()` | JWT |
| `GET /api/notices` | NoticeBoard state | Public |
| `POST /api/notices` | — (admin-only) | JWT (admin/mod) |
| `GET /api/canteen` | CanteenMenu state | Public |
| `POST /api/canteen` | — (admin-only) | JWT (admin/mod) |
| `POST /api/library/checkin` | `recordCheckIn()` | JWT |
| `GET /api/library/occupancy` | `getOccupancy()` | Public |
| `GET /api/clubs` | ClubPortal state | Public |
| `POST /api/clubs/:id/join` | — | JWT |

## Phase 3 — Frontend Migration (future PRs)

Once the REST API is stable, each `src/utils/*.js` file gets a thin API client:

```js
// src/utils/marketplaceStorage.js
// TODO: Swap localStorage calls for fetch('/api/marketplace')
// Keep the exported function signatures identical so UI components
// don't need to change at all.
```

The migration is done util-by-util so each can be tested independently.
The localStorage code is kept as a fallback during the transition.

## Environment Variables

```bash
DATABASE_URL="sqlserver://localhost:1433;database=austwise;integratedSecurity=true;encrypt=true;trustServerCertificate=true"
```
