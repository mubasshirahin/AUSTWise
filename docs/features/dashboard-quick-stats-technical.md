# Dashboard → Quick Stats ("At a glance") — Technical Version

> **Ei file ta developer er jonno.** Code, file path, line number, API — sob ekhane.
> **Simple version (non-CSE reader er jonno):** `docs/features/dashboard-quick-stats.md`
>
> **Feature owner:** Dashboard
> **Route:** `/` (Dashboard, default tab = `stats`)
> **Last updated:** 2026-10-21
> **Primary file:** `src/features/dashboard/DashboardPage.jsx`

---

## 1. Overview

Quick Stats holo dashboard er prothom tab ("At a glance") er ekta single card, jekhane 4 ta metric cell thake:

| Cell | Value | Kothay theke ashe |
|------|-------|-------------------|
| **Current CGPA** | Last completed semester er cumulative CGPA | CGPA Calculator (Analytics) |
| **Avg. Attendance** | Semester-wide attendance % | Attendance Tracker (Dashboard) |
| **Pending Deadlines** | Future deadlines + future calendar tasks er count | Semester View + (legacy) Deadline store |
| **Credits Completed** | Grade point ache emon course gulor total credit | CGPA Calculator (Analytics) |

Protita cell clickable — click korle jei page oi data manage kore, shei page/tab e navigate kore. Card ta **read-only**: ei widget nijey kono data create/update/delete kore na (exception: Study Streak widget, jeta hero te alada).

Card tar 2 ta state ache:

- **Data ache** → animated count-up value + risk-trend arrow (CGPA only).
- **Data nai** → `0.00` / `—` placeholder + CTA ("Open CGPA Calculator" ba guest er jonno "Sign in").

---

## 2. Entry points

| Layer | File | Detail |
|-------|------|--------|
| Route | `src/App.jsx:219` | `<Route path="/" element={<AdminRoute />} />` → `AdminRoute` returns `<DashboardPage />` (`App.jsx:77`) |
| Auth gate | `src/App.jsx:303-408` | Not authenticated hole `/` e **LandingPage** render hoy. Authenticated (ba guest-login) hole full app + dashboard |
| Page guard | `src/App.jsx:164-187` | `PageGuard` dashboard ke skip kore (`skipPaths` e `'/'` ache) — page shell always visible, content nijey gate kore |
| Feature component | `src/features/dashboard/DashboardPage.jsx:375` | `function QuickStats()` |
| Render | `src/features/dashboard/DashboardPage.jsx:737-745` | `isVisible('stats')` hole render hoy |
| Tab bar | `src/features/dashboard/DashboardPage.jsx:727-734` | `GliderTabs` — 5 ta focus tab |
| Styles | `DashboardPage.css`, `dashboard-premium.css`, `dashboard-tokens.css` | `quick-stats-widget`, `quick-stat-cell` classes |

**Focus tabs** (`FOCUS_SECTIONS`, `DashboardPage.jsx:35-41`):

```
stats      → ['stats', 'routine_day', 'deadlines', 'notices', 'notif']
routine    → ['routine']
calendar   → ['calendar']
exams      → ['exams']
attendance → ['attendance']
```

Tab selection priority:

1. URL `?tab=<id>` (e.g. `/?tab=attendance`)
2. `localStorage['aust-dashboard-focus']`
3. Default `'stats'`

---

## 3. UI flow (step by step)

```
Login / Guest login
   └─ AuthContext → initLiveStore(user.id)  → WS connect (/api/ws)
        └─ DashboardPage mount
             ├─ useRoleAccess('/')              → parent page access
             ├─ useRoleAccess('feature:dashboard:at-a-glance')  × 9 feature configs
             ├─ focus tab determine (?tab → localStorage → 'stats')
             ├─ greeting + StudyStreak (hero, non-admin only)
             └─ stats tab visible?
                  └─ MastheadAccessControl (pageKey '/')
                       └─ FeatureAccessGate (feature:dashboard:at-a-glance)
                            └─ QuickStats()
                                 ├─ useLiveValue × 4  (semester results, deadlines, tasks, attendance avg)
                                 ├─ getCurrentUserId() → isGuest?
                                 ├─ useMemo(stats)  → CGPA / attendance / count / credits
                                 ├─ useAnimatedValue × 3 → count-up animation
                                 └─ 4 cells render
```

**Cell click behaviour** (`DashboardPage.jsx:453-505`):

| Cell | Navigate to | Keno |
|------|-------------|------|
| CGPA | `/analytics?tab=cgpagraph` | Grades edit kora hoy CGPA Calculator e |
| Attendance | `/?tab=attendance` | Session mark kora hoy Attendance Tracker e |
| Deadlines | `/?tab=calendar` | Task add kora hoy Semester View e |
| Credits | `/analytics?tab=cgpagraph` | Credits derive hoy semester results theke |

**Empty states** (`DashboardPage.jsx:574-589`):

- `!hasCgpa && !isGuest` → "No semester data yet…" + **Open CGPA Calculator** button
- `isGuest` → "Sign in to track CGPA, attendance & deadlines" + **Sign in** button

**Trend / risk tier logic:**

| Metric | Threshold | Effect |
|--------|-----------|--------|
| CGPA | `>= 3.5` great, `>= 3.0` good, `>= 2.5` okay, else poor | `↗ / → / ↘` arrow (`trend` field) |
| Attendance | `>= 75` fine, `>= 70` slipping, `>= 65` risky, else critical | `count` field compute hoy, but render e use hoy na (dead value — see §10) |

---

## 4. Data model

Quick Stats nijer kono store nai — 4 ta live key + 1 ta identity source read kore.

| Data | Store scope | Key | Type | Default | Written by |
|------|-------------|-----|------|---------|------------|
| Semester results | `user` | `aust-user-semester-results` | `Array<Semester>` | `null` | `ResultTable.jsx` (CGPA Calculator) |
| Avg. attendance | `user` | `aust-attendance-overall-average` | `string` (number as string) | `null` | `RoutineAttendanceTracker.jsx:302` |
| Deadlines | `user` | `aust-deadlines` | `Array<Deadline>` | `[]` | `NextWeekSchedule.jsx:74` ** (mounted nowhere — see gaps) |
| Calendar tasks | `user` | `aust-week-tasks` | `Array<Task>` | `[]` | `WeekSchedule.jsx:196` (Semester View) |
| Study streak | `user` | `aust-study-streak` | `{ count, lastActive }` | `null` | `StudyStreak` effect (`DashboardPage.jsx:54-91`) |
| Identity / guest flag | — | session + `aust-user-profile` | — | guest | `authStorage.getCurrentUserId()` |

### Semester object shape

```js
{
  semester: 1,          // 1..8 (ARCH up to 10)
  year: '2023',
  sgpa: 3.72,           // computed
  cgpa: 3.65,           // computed (cumulative) — NULL hole "completed" dhora hoy na
  courses: [
    { code: 'CSE1101', name: '...', credit: 3, grade: 'A+', point: 4.00 }
    // point === null  →  grade deya hoy nai, credit count e dhora hoy na
  ]
}
```

### Task / Deadline object shape (relevant fields)

```js
// aust-week-tasks (Semester View)
{ id, courseCode, courseName, title, syllabus, date: 'YYYY-MM-DD',
  time: 'HH:mm' | '', batchGroup: 'A1'..'D2', crGroup?, createdAt }

// aust-deadlines (legacy)
{ id, title, course, dueDate: ISO, type, priority, batchGroup?, crGroup?, color }
```

### localStorage cache

`liveStore` localStorage ke **cache only** hisebe use kore (`liveStore.js:92-102, 136, 168`). Server value pele cache overwrite hoy; offline hole cache/local value diye kaj chole.

---

## 5. Data lineage — Quick Stats e data kothay theke ashe, kothay jay

```
┌──────────────────────────────────────────────────────────────────┐
│  Analytics → CGPA Calculator (ResultTable.jsx)                    │
│  writes user:aust-user-semester-results                          │
└───────────────────────────────┬──────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│  Dashboard → Attendance Tracker (RoutineAttendanceTracker.jsx)   │
│  reads  user:aust-user-routine-attendance-sessions               │
│  reads  shared:semester-start-date                               │
│  reads  user:aust-user-routine (RoutineContext)                  │
│  writes user:aust-attendance-overall-average                     │
│  posts  /api/presence/attendance                                 │
└───────────────────────────────┬──────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│  Dashboard → Semester View (WeekSchedule.jsx)                    │
│  writes user:aust-week-tasks                                    │
│  writes shared:aust-semester-tasks:<DEPT>:<SEM>:<A1..D2>  (CR)   │
└───────────────────────────────┬──────────────────────────────────┘
                                │
                     ┌──────────▼──────────┐
                     │     Quick Stats     │
                     │  DashboardPage.jsx  │
                     └──────────┬──────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
  Analytics Page          Admin Panel             Auth + liveStore
  (CGPA tab)             (RoleAccess panels)     (identity, WS sync)
```

### Dependency table

| Quick Stats e ki dekhay | Direct dependency | Indirect dependency |
|--------------------------|-------------------|---------------------|
| CGPA | `aust-user-semester-results` | Analytics page, `calculateSemesterStats()`, department semester count (`utils/semester.js`) |
| Credits | `aust-user-semester-results` (course `credit` + `point`) | Same as above |
| Attendance | `aust-attendance-overall-average` | Routine (`RoutineContext`), semester start date (Semester View), Telegram attendance auto-marks (`/api/telegram/attendance`), `utils/semesterDates.js` |
| Pending Deadlines | `aust-deadlines` + `aust-week-tasks` | Semester View (task add/delete), batch group (`utils/getUserBatchGroup.js`), (legacy deadline form) |
| Guest state | `getCurrentUserId()` | AuthContext session / cached profile |
| Visibility | 10 ta `useRoleAccess` config | Admin Panel → `DashboardAccessPanel`, `FeatureAccessPanel`, `RoleAccessControlCard` |
| Live updates | `useLiveValue` | `liveStore` WS (`/api/ws`), `store-change` event |

**Note:** Attendance value ta **derived** — `RoutineAttendanceTracker` mount holei recompute hoy (`RoutineAttendanceTracker.jsx:299-304`). Quick Stats tab e tracker mount hoy na, tai value server e persist thake, recompute hoy na.

---

### 5.1 Read pipeline — writer page theke Quick Stats porjonto (step by step)

Quick Stats e kono data direct database theke ashe na. Sob data **liveStore** naam er ekta layer diye ashe. Pipeline ta ei rokom:

```
[1] Writer page (Analytics / Attendance Tracker / Semester View)
      └─ setLiveValue('user', '<key>', value)    // ba useLiveValue er setter
[2] liveStore.setLiveValue                        liveStore.js:164-174
      ├─ cache.set(key, value)                    // memory cache
      ├─ localStorage.setItem(key, JSON)          // instant-paint cache
      ├─ emit(key, isLocal=true)                  // ei tab er subscribers
      └─ userStore.set(key, value)
            └─ PUT /api/store/user/<key>           storageService.js:66-68
[3] Server: PUT handler                            dev.mjs:3513-3569
      ├─ requireRole(...)                          // login check
      ├─ rate limit + batchGroup + title cap       // tasks & deadlines only
      ├─ setUserStoreValue(userId, key, value)     // storeDB.mjs
      │     ├─ SQL: "UserStore" (userId + key unique)
      │     └─ fallback: server/userStore.json
      └─ broadcastToUser(userId, store-change)     // onno device ke janay
[4] Onno device: WS message                       liveStore.js:408-429
      └─ fetchKey() → GET /api/store/user/<key>
[5] Quick Stats: useLiveValue                     DashboardPage.jsx:379-382
      └─ memory cache theke value (na thakle localStorage seed)
[6] Calculation                                   DashboardPage.jsx:391-444
[7] Cell render + animation                       DashboardPage.jsx:508-552
```

**Fallback behaviour:**

| Situation | Ki hoy | Result |
|-----------|--------|--------|
| Server reachable | `GET` success → cache + localStorage overwrite | Fresh data |
| Server slow / offline | cache/localStorage seed agei deya | Purono data diye paint |
| Cache o nai | `useLiveValue` er fallback (`[]` ba `null`) | Empty/placeholder |
| Guest user | `GET` → `401` | Fallback + "Sign in" CTA |

> Ei pipeline tai Quick Stats er 4 ta cell er **common read path**. Nicher 5.2–5.4 e protita metric er alada source ar destination deya ache.

---

### 5.2 Metric A — Current CGPA + Credits Completed

**Data ashtese (source → Quick Stats):**

| Step | Ki hoy | File:line |
|------|--------|-----------|
| 1 | User Analytics page er **CGPA Calculator** tab khole | `src/features/analytics/AnalyticsPage.jsx` → `CGPAGraph.jsx` |
| 2 | Course/grade add/edit kore | `ResultTable.jsx` (form + `calculateSemesterStats`) |
| 3 | SGPA + cumulative CGPA calculate hoy | `ResultTable.jsx:93-115` |
| 4 | Save hole `persistResults(value)` | `ResultTable.jsx:163-166` |
| 5 | `setLiveValue('user','aust-user-semester-results')` | `liveStore.js:164-174` |
| 6 | Server e `PUT /api/store/user/aust-user-semester-results` | `storageService.js:66-68` → `dev.mjs:3513` |
| 7 | SQL `UserStore` table e `{userId, key, value}` row (fallback `server/userStore.json`) | `storeDB.mjs:39-49` |
| 8 | Quick Stats `useLiveValue` diye pore | `DashboardPage.jsx:382` |
| 9 | `useMemo` e CGPA/credits calculate | `DashboardPage.jsx:430-443` |

**Quick Stats e ki calculation hoy (`DashboardPage.jsx:430-443`):**

```js
completedSems   = userResults.filter(r => r.cgpa !== null);   // je sem e result deya
currentCgpa     = completedSems.at(-1)?.cgpa ?? null;          // last completed sem er cumulative
creditsCompleted = Σ (course.credit)  // only completedSems, only jekhane course.point !== null
semestersCompleted = completedSems.length                      // Credits card er badge
```

> **Important:** Quick Stats nijey SGPA/CGPA recalculate kore na — `ResultTable` jei value save kore, shetai display kore. Tai `aust-user-semester-results` er bhitore `cgpa` field ta already computed thakte hoy.

**Data jacche kothay (Quick Stats theke / same key er onno consumer):**

| Destination | Ki kore | File:line |
|-------------|---------|-----------|
| Quick Stats CGPA cell | Value + `↗ / → / ↘` trend arrow | `DashboardPage.jsx:453-467` |
| Quick Stats Credits cell | Value + completed semester count | `DashboardPage.jsx:493-504` |
| **Click → Analytics CGPA tab** | `/analytics?tab=cgpagraph` | `DashboardPage.jsx:466, 503` |
| Analytics → CGPA Graph | Chart er data | `CGPAGraph.jsx:41` |
| Analytics → Semester Wise | Semester breakdown | `SemesterTracker.jsx:163` |
| Analytics → Dept Heatmap | Nijoswo semesters | `DeptHeatmap.jsx:49` |
| Dept Heatmap shared submission | SGPA gulo shared store e jay | `deptHeatmapStorage.js:55-74` |
| ResultTable reset/delete | `delLiveResults()` → Quick Stats `0.00` + CTA | `ResultTable.jsx:342` |

---

### 5.3 Metric B — Avg. Attendance

**Data ashtese (chain), 3 ta input lagе:**

```
Routine (RoutineContext)          ← user:aust-user-routine  (server-synced)
Semester start date               ← shared:semester-start-date  (Semester View set kore)
Session marks (P/A)               ← user:aust-user-routine-attendance-sessions
        │
        ▼
RoutineAttendanceTracker: courseStats → overallStats
        │  average = attended / held * 100  (1 decimal)
        ▼
user:aust-attendance-overall-average   (string, e.g. "78.3")
        │
        ▼
Quick Stats "Avg. Attendance" cell
```

| Step | Ki hoy | File:line |
|------|--------|-----------|
| 1 | User dashboard er **Attendance** tab khole | `DashboardPage.jsx:795-803` |
| 2 | Routine load hoy context theke | `RoutineContext` → `RoutineProvider.jsx` |
| 3 | Semester start date shared store theke | `WeekSchedule.jsx` (`semester-start-date`) |
| 4 | User Present/Absent mark kore | `RoutineAttendanceTracker.jsx:325-333` (`setSessionStatus`) |
| 5 | Telegram theke auto-marks ashe (registered hole) | `GET /api/telegram/attendance?chatId=` |
| 6 | Course-wise + overall average calculate | `RoutineAttendanceTracker.jsx:280-297` |
| 7 | Effect diye average publish | `RoutineAttendanceTracker.jsx:299-304` |
| 8 | Server e save | `PUT /api/store/user/aust-attendance-overall-average` |
| 9 | Quick Stats pore + `parseFloat` | `DashboardPage.jsx:412-418` |

**Data jacche kothay:**

| Destination | Ki kore | File:line |
|-------------|---------|-----------|
| Quick Stats Attendance cell | `78.3%` display | `DashboardPage.jsx:468-480` |
| **Click → Attendance tab** | `/?tab=attendance` | `DashboardPage.jsx:479` |
| Server user profile (`attendancePct`) | Presence popup er jonno sync | `POST /api/presence/attendance` (`dev.mjs:3871-3893`) |
| SQL `AuthUsers` / `users.json` | `attendancePct` field update | `userStore.mjs:1056` |
| WS `profile-update` broadcast | Profile change event | `dev.mjs:3887` |

> **⚠️ Data source limitation:** average ta shudhu **Attendance tab mount hole** recompute hoy. Stats tab e tracker mount hoy na — tai notun device e login kore stats dekhle `—` dekhbe, jotokkhon Attendance tab na kholo. R routine empty/load fail hole `marked === 0` → average `null` write hoy, meaning purono valid average o wipe hote pare.

---

### 5.4 Metric C — Pending Deadlines

Ei cell **dui ta alada key** er count jog kore — ekta "deadline", ekta "calendar task".

**Data ashtese:**

| Data | Source page | Ki kore | File:line |
|------|-------------|---------|-----------|
| `user:aust-week-tasks` | Dashboard → **Semester View** | Task add/delete | `WeekSchedule.jsx:293-343` |
| `shared:aust-semester-tasks:<DEPT>:<SEM>:<batch>` | Semester View (CR) | CR er task puro batch e share | `WeekSchedule.jsx:174-194, 310-319` |
| `user:aust-deadlines` | Legacy **NextWeekSchedule** | Deadline add | `NextWeekSchedule.jsx:72-109` — **component kothao mount hoy na** |

**Write path (task add er example):**

```
WeekSchedule.handleAddTask                     WeekSchedule.jsx:293-332
   ├─ user.role === 'cr'  → shared:<prefix>:<userBatchGroup>  (cohort-wide)
   └─ else                → user:aust-week-tasks              (personal)
        │
        ▼
PUT /api/store/...                             dev.mjs:3513-3569
   ├─ 5s rate limit (payload > 5 items)
   ├─ batchGroup validate (A1..D2), empty hole auto-correct
   ├─ title max 80 chars, dueDate max 100 chars
   └─ broadcast store-change
```

**Quick Stats e count logic (`DashboardPage.jsx:395-410`):**

```js
pendingDeadlines = aust-deadlines.filter(d => new Date(d.dueDate) > now).length
pendingTasks     = aust-week-tasks.filter(t => {
                     date + (time || 23:59) > now
                   }).length
upcomingDeadlines = pendingDeadlines + pendingTasks
```

> **Note:** ekhane **batch filter nai** ar **shared CR task count hoy na**. DeadlineTicker widget batch filter + shared task add kore (`DeadlineTicker.jsx:36-75`), tai dui jaygay number alada hote pare.

**Data jacche kothay:**

| Destination | Ki kore | File:line |
|-------------|---------|-----------|
| Quick Stats Deadlines cell | Count display | `DashboardPage.jsx:481-492` |
| **Click → Semester View** | `/?tab=calendar` | `DashboardPage.jsx:491` |
| DeadlineTicker (dashboard) | Same keys, batch-filtered list + countdown | `DeadlineTicker.jsx:31-75` |
| Notification bell / native popup | Deadline/task seed kore notification banay | `useInAppNotifications.js:100-126` → `inAppNotifications.js:218-286` |
| NextWeekSchedule (unmounted) | Deadline edit UI | `NextWeekSchedule.jsx` |

---

### 5.5 Visibility data — Admin Panel theke Quick Stats porjonto

Ei ta "data jacche" er onno dik — **access config** data:

```
Admin Panel → DashboardAccessPanel / FeatureAccessPanel
      │  useRoleAccess.save()
      ▼
POST /api/admin/role-access              dev.mjs:1816-1838
      │  requireRole('admin','moderator')
      ▼
server/roleAccess.json  (feature:dashboard:at-a-glance)
      │  broadcastToAll({ type:'role-access' })
      ▼
useRoleAccess config cache + localStorage        useRoleAccess.js:77-87
      │
      ├─→ MastheadAccessControl ('/' parent)
      ├─→ FeatureAccessGate ('feature:dashboard:at-a-glance')
      ├─→ availableFocusModes filter (tab dekhay/na)
      └─→ Sidebar nav link hide/show (useRoleAccessMap)
```

| Direction | Detail |
|-----------|--------|
| Admin → Quick Stats | On/Off + `featureHidden` role list |
| Quick Stats → Admin | Kono data pathay na (read-only) |
| Persist | `server/roleAccess.json` (SQL nai) |
| Live update | WS `role-access` event, same-tab CustomEvent, cross-tab `storage` event |

---

### 5.6 Study Streak (hero widget — Quick Stats er baire, but same page)

| Direction | Detail | File:line |
|-----------|--------|-----------|
| Read | `user:aust-study-streak` (`{count, lastActive}`) | `DashboardPage.jsx:52` |
| Write | Mount hole din change check → count update | `DashboardPage.jsx:54-91` |
| Input | `user.name`, `user.department`, `user.createdAt` | `DashboardPage.jsx:122-140` |
| Output | Streak widget + leaderboard modal | `DashboardPage.jsx:144-241` |
| Server | `PUT /api/store/user/aust-study-streak` | `liveStore.js:164-174` |
| Leaderboard | `leaderboardData` (mock, empty) + nijer entry | `mockData.js:784` |

---

### 5.7 Writer ↔ Reader full matrix

| Data (key) | Ke write kore | Ke read kore | Cross-page effect |
|------------|---------------|--------------|-------------------|
| `aust-user-semester-results` | CGPA Calculator (`ResultTable`) | Quick Stats, CGPA Graph, Semester Wise, Dept Heatmap, `deptHeatmapStorage` | Heatmap er avg SGPA change hoy |
| `aust-attendance-overall-average` | Attendance Tracker | Quick Stats | Server profile `attendancePct` update |
| `aust-week-tasks` | Semester View (personal) | Quick Stats, DeadlineTicker, Notification seed | Bell notification + deadline list |
| `aust-semester-tasks:*` (shared) | Semester View (CR) | Semester View, DeadlineTicker | CR task puro batch e jay |
| `aust-deadlines` | Legacy NextWeekSchedule (unmounted) | Quick Stats, DeadlineTicker, Notification seed | Count + bell |
| `aust-study-streak` | Dashboard mount | Dashboard streak + leaderboard | Kono onno page e jay na |
| `roleAccess.json` config | Admin Panel | Quick Stats gate, Dashboard tabs, Sidebar | Card/nav hide-show |
| Session/profile | Auth flow / Settings | Guest check, greeting, streak, leaderboard | Guest CTA |

---

### 5.8 Server e data actually kothay boshe

| Data type | Primary storage | Fallback (DB chara) | File / table |
|-----------|-----------------|---------------------|--------------|
| Per-user Quick Stats data | SQL Server `"UserStore"` (`userId`,`key`,`value`,`updatedAt`) | `server/userStore.json` | `storeDB.mjs:16-49` |
| Deleted key tombstones | SQL `"UserStoreDeleted"` | `server/userStoreDeleted.json` | `storeDB.mjs:60-69` |
| Shared cohort tasks | SQL `"SharedStore"` | `server/sharedStore.json` | `storeDB.mjs:51-58` |
| User profile (`attendancePct`) | SQL `"AuthUsers"` | `server/users.json` | `userStore.mjs:1056` |
| Role/feature access | File only: `server/roleAccess.json` | — | `dev.mjs:1721-1732` |
| Browser cache | `localStorage` (bare key) | — | `liveStore.js:96-98` |

---

### 5.9 Ekta real scenario (data kothay kothay jay)

```
Dhora holo Rahim (student, batch A1) ar Karim (CR, same batch).

1) Rahim Analytics → CGPA Calculator e grade dilo
      → user:aust-user-semester-results save (device A)
      → server UserStore + store-change broadcast
      → Rahim er onno device (B) auto update
      → Quick Stats CGPA + Credits change

2) Karim Semester View e "Quiz 2" task add korlo
      → shared:aust-semester-tasks:CSE:3:A1 (CR shared key)
      → batch A1 er sob student er WeekSchedule + DeadlineTicker update
      → Quick Stats "Pending Deadlines" +1  (kintu shared task Quick Stats count kore na — gap)
      → Notification seed → bell e "Task: Quiz 2"

3) Rahim Attendance tab e Present/Absent mark korlo
      → session marks save
      → average recompute → user:aust-attendance-overall-average
      → Quick Stats "Avg. Attendance" update
      → POST /api/presence/attendance → profile.attendancePct

4) Admin "At a glance" Off korlo
      → POST /api/admin/role-access → roleAccess.json
      → broadcast role-access
      → sob student er dashboard theke Quick Stats card gone (refresh chara)
```

---

### 5.10 Data dead-ends (jay kintu keu use kore na)

| Data | Kothay jay | Problem |
|------|------------|---------|
| `profile.attendancePct` | SQL `AuthUsers` + `profile-update` WS | Current UI te kono consumer nai; Settings bole "attendance is always private" (`SettingsPage.jsx:431`) |
| `aust-deadlines` | Server + Quick Stats + DeadlineTicker | Writer UI unmounted, tai legacy data edit/delete kora jay na |
| `semesterResults` legacy localStorage | `setUserStorageItem('semesterResults')` | `userStoragePrefixes` e key nai → write/read silent no-op |
| Streak leaderboard | Modal UI | `leaderboardData` empty → Top 100 e shudhu nijer naam |

---

## 6. CRUD matrix

Quick Stats **read-only** widget. Write operations onno page e hoy:

| Op | Entity | Kothay (file / function) | Storage / API | Quick Stats e effect |
|----|--------|--------------------------|---------------|----------------------|
| **Create** | Semester result | `ResultTable.jsx` → `persistResults()` (line 163), `applyTemplates()` | `setLiveValue('user','aust-user-semester-results')` → `PUT /api/store/user/:key` | CGPA + credits recompute |
| **Read** | Semester results | `DashboardPage.jsx:382, 387-389` | `useLiveValue` + legacy fallback | CGPA / credits |
| **Update** | Semester result / grade | `ResultTable.jsx` (edit semester, `calculateSemesterStats`) | Same key overwrite | Same |
| **Delete** | Semester result | `ResultTable.jsx` (`delLiveResults`, reset confirm) | `DELETE /api/store/user/:key` | CGPA → `0.00`, credits → `0` |
| **Create** | Calendar task | `WeekSchedule.jsx:293-332` `handleAddTask` (role: `admin` / `cr`) | `aust-week-tasks` (personal) ba shared CR store | Deadline count +1 (jodi future hoy) |
| **Read** | Calendar tasks | `DashboardPage.jsx:380` | `useLiveValue` | Deadline count |
| **Update** | Calendar task | `WeekSchedule.jsx` (same add flow rewrites array) | Full array overwrite | Count recompute |
| **Delete** | Calendar task | `WeekSchedule.jsx:334-343` `handleDeleteTask` (CR: creator/admin only) | Array filter | Count -1 |
| **Create / Update** | Deadline | `NextWeekSchedule.jsx:72-109` (currently unmounted) | `aust-deadlines` | Count |
| **Delete** | Deadline | Kono active UI nai | — | — |
| **Create / Update** | Attendance average | `RoutineAttendanceTracker.jsx:301-304` | `setOverallAverage()` | Attendance % |
| **Create / Update** | Session marks | `RoutineAttendanceTracker.jsx` `setSessionStatus` | `aust-user-routine-attendance-sessions` | Attendance % via recompute |
| **Create / Update** | Study streak | `DashboardPage.jsx:54-91` (auto, on mount) | `aust-study-streak` | Hero widget (not Quick Stats) |

**Access control inside CRUD:**

- Task add: client check `user.role === 'admin' || user.role === 'cr'` (`WeekSchedule.jsx:57`)
- CR task → shared cohort key; non-CR → personal key (`WeekSchedule.jsx:310-322`)
- Shared task delete: creator ba admin only (`WeekSchedule.jsx:337`)
- Server-side: shared store API role-gated; user store API role-gated (see §8)

---

## 7. Role access

Quick Stats 3 layer e gated:

```
Layer 1  PageGuard (App.jsx)          → '/' skipPaths e ache, tai page shell always open
Layer 2  MastheadAccessControl        → pageKey = '/'  (dashboard parent)
Layer 3  FeatureAccessGate            → 'feature:dashboard:at-a-glance'
Layer 4  Admin mode                   → admin hole QuickStats render e hoy na (panels render hoy)
```

### Effective role resolution

`getAccessRole(user)` (`src/utils/accessRole.js`):

1. `role === 'admin' | 'moderator'` → shei role
2. `roles` array te `'readd'` ache → `'readd'` (access policy er jonno override)
3. otherwise → `user.role` (default `'guest'`)

### Current server config (`server/roleAccess.json`)

```json
"feature:dashboard:at-a-glance": {
  "featureHidden": ["faculty"],
  "statsAllowed": ["admin", "moderator"],
  "enabled": true
}
```

| Viewer | Quick Stats dekhbe? | Ki dekhbe |
|--------|---------------------|-----------|
| `student` (default) | ✅ | Full card, data thakle values |
| `cr` / `sr` / `senior` / `vp` / `gs` / `readd` / `alumni` etc. | ✅ (jodi `featureHidden` e na thake) | Full card |
| `faculty` | ❌ | `FeatureAccessGate` `null` return kore |
| `guest` (guest login) | ✅ card, but data nai | Placeholder + "Sign in" CTA |
| `moderator` | ⚠️ Mixed | `isFeatureAvailable` moderator ke admin hisebe treat kore, but `FeatureAccessGate` shudhu `role === 'admin'` bypass kore → gate apply hote pare |
| `admin` | ❌ Quick Stats nai | `DashboardParentAccessPanel` + `DashboardChildAccessPanel` dekhay |

**Admin panel theke control:**

| Control | File | Key |
|---------|------|-----|
| Parent on/off + parent roles | `DashboardAccessPanel.jsx:50-82` | `/` |
| Child on/off + child roles | `DashboardAccessPanel.jsx:21-48, 84-99` | `feature:dashboard:at-a-glance` |
| Global feature list | `FeatureAccessPanel.jsx:7` | Same key |

**Gate logic (`FeatureAccessGate.jsx:11-14`):**

```js
if (loading && !isAdmin) return null;
if (!isAdmin && config.enabled === false) return null;
if (!isAdmin && config.featureHidden?.includes(accessRole)) return null;
```

**Tab-level visibility (`DashboardPage.jsx:624-636`):** `stats` tab dekhay jodi `at-a-glance`, `daily-flow`, `notices`, `deadlines`, `notifications` — je kono ekta available hoy. Parent `/` off hole kono tab e dekhay na.

---

## 8. API endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/api/store/user/:key` | Logged-in role (student/faculty/alumni/admin/moderator/cr/sr/senior) | Read per-user value (`liveStore.fetchKey`) |
| `PUT` | `/api/store/user/:key` | Same | Write per-user value + WS broadcast |
| `DELETE` | `/api/store/user/:key` | Same | Delete key + `deleted: true` broadcast |
| `GET` | `/api/store/user` | Same | List all keys |
| `GET` | `/api/store/shared/:key` | Same | Read shared value (semester tasks) |
| `PUT` | `/api/store/shared/:key` | CR/SR/admin rules | Write shared value |
| `DELETE` | `/api/store/shared/:key` | Same | Delete shared value |
| `PUT` | `/api/store/migrate` | Logged-in | Bulk localStorage → server migrate (login e auto) |
| `GET` | `/api/role-access?key=<pageKey>` | Public | Ek page/feature er access config |
| `GET` | `/api/role-access/map` | Public | Sob page config ek shot e (sidebar) |
| `POST` | `/api/admin/role-access` | `admin` / `moderator` | Save `{ pageKey, featureHidden, statsAllowed, enabled }` |
| `POST` | `/api/presence/attendance` | Logged-in | Attendance % presence popup e share |
| `GET` | `/api/telegram/attendance?chatId=` | — | Telegram auto-marks (Attendance Tracker) |
| `WS` | `/api/ws` | — | `subscribe`, `store-change`, `role-access` events |

### Server-side safeguards (relevant to Quick Stats data)

`server/dev.mjs:3513-3569` — `PUT /api/store/user/:key`:

- **Rate limit:** `aust-week-tasks` / `aust-deadlines` e 5 second er moddhe abar write + payload e `5` er beshi item → `429` → "slow down edits"
- **Title cap:** 80 characters
- **dueDate length cap:** 100 characters
- **batchGroup integrity:** valid `A1..D2` na hole `400`; empty `batchGroup` auto-correct user er expected group e set hoy
- **Broadcast:** successful write e `store-change` pathano hoy user er onno device gulote

### WebSocket payload

```json
// server → client
{ "type": "store-change",
  "payload": { "scope": "user", "key": "aust-user-semester-results" } }

{ "type": "store-change",
  "payload": { "scope": "user", "key": "aust-week-tasks", "deleted": true } }

{ "type": "role-access",
  "payload": { "pageKey": "feature:dashboard:at-a-glance",
               "featureHidden": ["faculty"], "statsAllowed": ["admin","moderator"],
               "enabled": true } }
```

Client-side own-write echo skip kore (`localWrites`, TTL 15s) — infinite reload loop theke bachay (`liveStore.js:46-65, 423-427`).

---

## 9. Side effects

| Side effect | Trigger | Where |
|-------------|---------|-------|
| localStorage cache write | Every live read/write | `liveStore.js:136, 168` |
| Server sync on login | `initLiveStore(user.id)` | `AuthContext.jsx:130, 221, 262` |
| localStorage → server migration | First load after login | `runMigrationOnLogin` (`storageService.js:294`) |
| Cross-device realtime refresh | `store-change` WS event | `liveStore.js:408-429` |
| Cross-tab sync | `storage` event / `role-access-updated` CustomEvent | `useRoleAccess.js:124-142` |
| Attendance presence share | Attendance average change | `RoutineAttendanceTracker.jsx:310-322` |
| Study streak write | Dashboard mount (per day) | `DashboardPage.jsx:54-91` |
| Page/tab URL state | Tab change | `useTabUrlState` + `aust-dashboard-focus` |
| Notification banner | Independent widget | `feature:dashboard:notifications` (Quick Stats er baire) |

---

## 10. Gaps & risks

> Severity: 🔴 high · 🟠 medium · 🟡 low

| # | Severity | Issue | Detail / impact |
|---|----------|-------|-----------------|
| 1 | 🔴 | **Cross-user localStorage cache leak** | `ensureFetched()` bare `localStorage` key theke seed kore (`liveStore.js:96-98`), but `destroyLiveStore()` localStorage clear kore na (`liveStore.js:328-338`). Logout er por guest/onno user same browser e `aust-user-semester-results` cache theke purono CGPA dekhte pare (server fetch guest er jonno fail kore). Shared device e privacy risk. |
| 2 | 🟠 | **`semesterResults` fallback dead code** | `getUserStorageItemWithGuestFallback('semesterResults')` call hoy (`DashboardPage.jsx:387`, `ResultTable.jsx:121`), kintu `userStoragePrefixes` e `'semesterResults'` key nai (`authStorage.js:14-36`) → function always `null` return kore. Guest/local fallback silently broken. |
| 3 | 🟠 | **Attendance average stale** | Value shudhu `RoutineAttendanceTracker` mount hole recompute hoy. Quick Stats tab e tracker mount hoy na → new device e login kore stats dekhle `—` dekhay, jotokkhon user Attendance tab na khole. Routine/semester start change korleo same issue. |
| 4 | 🟠 | **Deadline count mismatch** | Quick Stats: `aust-deadlines` (no batch filter) + `aust-week-tasks` (no batch filter, no shared tasks) (`DashboardPage.jsx:395-410`). DeadlineTicker: batch-filtered tasks + shared CR tasks (`DeadlineTicker.jsx:36-75`). Tai card er number ar widget er list mile na. |
| 5 | 🟠 | **Deadline creator unmounted** | `aust-deadlines` er ekmatro writer `NextWeekSchedule.jsx`, jeta kothao import kora nai. Result: "Pending Deadlines" practically shudhu calendar tasks count kore; legacy deadline data edit/delete er UI nai. |
| 6 | 🟠 | **Moderator inconsistency** | `FeatureAccessGate` bypass kore shudhu `role === 'admin'`; `isFeatureAvailable` (`DashboardPage.jsx:618`) moderator ke admin dhore. Moderator er khetre tab dekhay kintu card hidden hote pare. Dashboard er inline access panel (`DashboardPage.jsx:725, 736`) shudhu `role === 'admin'` hole render hoy — moderator ke Admin Panel → Features theke configure korte hoy. |
| 7 | 🟡 | **`stats` tab false-positive visibility** | `statsAvailable` 5 ta feature er **je kono ekta** available holei true (`DashboardPage.jsx:624-628`). `at-a-glance` off kintu `deadlines` on → Quick Stats tab dekhay, content blank. |
| 8 | 🟡 | **CGPA "completed" definition** | `completedSems = results.filter(r => r.cgpa !== null)` (`DashboardPage.jsx:430`). Grades deya thakleo `cgpa === null` hole card "No semester data" dekhay. Partial/manual data e confusing. |
| 9 | 🟡 | **Credits card placeholder logic** | `placeholder: !hasCgpa` — CGPA null hole credits 0 dekhay, jodi credits data thake o. |
| 10 | 🟡 | **Study streak guest + write loop risk** | Guest user o streak write kore (server 401 → local only). Effect dependency `[streakData, setStreakData]` + write → extra render/write; day boundary e multiple tabs open thakle race possible. |
| 11 | 🟡 | **Leaderboard fake/empty** | `leaderboardData = []` (`mockData.js:784`) → "Top 100 students" modal e shudhu nijer entry. Podium 1 entry. Misleading UI copy. |
| 12 | 🟡 | **Hard-coded thresholds** | Attendance 75/70/65 and CGPA 3.5/3.0/2.5 constants; institution policy change hole code edit lage. |
| 13 | 🟡 | **Guest CTA links `/login`** | Guest-login session active thakle `/login` e navigate kore; `App.jsx:270` e `/login` → `/` redirect (authenticated shell), tai actual sign-in page e na giye dashboard e ferot ashte pare. |
| 14 | 🟡 | **No schema validation** | `aust-user-semester-results` server theke je kono JSON ashte pare; `completedSems.at(-1)?.cgpa` safe, but `courses.reduce` non-array hole guarded (`Array.isArray`), credit `Number()` coercion. Malicious/corrupt data e weird value possible. |
| 15 | 🟡 | **`count` field dead code** | 4 ta cell er `count` (risk tier) compute hoy but `renderStatCell` e use hoy na. CGPA/attendance risk color-coding UI te implement kora nai. |
| 16 | 🟡 | **`aust-deadlines` default from mock** | `useLiveValue('user','aust-deadlines',[...deadlines])` — mock empty, but pattern e mock data live store e mix howar risk. |
| 17 | 🟠 | **Attendance average wipe** | Attendance tab e routine empty/load fail hole `overallStats.marked === 0`, ar effect `setOverallAverage(null)` chalaay (`RoutineAttendanceTracker.jsx:301-304`). Mane purono valid average o `null` hoye jay → Quick Stats `—` dekhay. |

---

## 11. QA checklist (feature verify)

- [ ] Fresh student login → `/` → `stats` tab default, 4 cells visible
- [ ] CGPA Calculator e 1 semester grade din → dashboard e CGPA + credits update (refresh chara, same device)
- [ ] 2nd device/browser e login → same values (server sync)
- [ ] Attendance tab e present/absent mark din → `stats` tab e Avg. Attendance update
- [ ] Semester View e future task add (CR/admin) → "Pending Deadlines" +1; past task → count change na
- [ ] Task delete → count -1
- [ ] Guest login → 4 cells placeholder + "Sign in" CTA
- [ ] `faculty` role → Quick Stats card hidden
- [ ] Admin panel → Dashboard → At a glance toggle Off → student dashboard e card hidden (live, refresh chara)
- [ ] Admin panel → role access e `student` ke featureHidden → student card hidden, admin panel unaffected
- [ ] URL `/?tab=calendar` → calendar tab open, back button e previous tab restore
- [ ] Logout → guest login → purono user er CGPA leak hoy kina check (§10 #1)
- [ ] Network offline → reload → localStorage cached values render hoy
- [ ] `PUT /api/store/user/aust-week-tasks` 5s e 6+ items → `429` handle hoy (UI error/retry)

---

## Appendix — File map

| File | Role |
|------|------|
| `src/features/dashboard/DashboardPage.jsx` | Page shell, tabs, `QuickStats`, `StudyStreak` |
| `src/features/dashboard/DashboardPage.css` | Layout + card styles |
| `src/features/dashboard/dashboard-tokens.css` | Design tokens |
| `src/features/dashboard/dashboard-premium.css` | Premium overrides |
| `src/hooks/useRoleAccess.js` | Access config fetch/cache/live sync |
| `src/hooks/useAdminMode.js` | Admin/moderator mode flag |
| `src/hooks/useTabUrlState.js` | Tab ↔ URL ↔ localStorage sync |
| `src/components/MastheadAccessControl.jsx` | Page-level content gate |
| `src/features/admin/FeatureAccessGate.jsx` | Feature-box level gate |
| `src/features/admin/DashboardAccessPanel.jsx` | Admin parent/child access UI |
| `src/features/admin/FeatureAccessPanel.jsx` | All feature toggles |
| `src/features/admin/RoleAccessControlCard.jsx` | Drag-drop role matrix |
| `src/utils/liveStore.js` | Realtime KV store + WS |
| `src/utils/storageService.js` | REST store client + migration keys |
| `src/utils/authStorage.js` | Per-user localStorage helpers, guest fallback |
| `src/utils/accessRole.js` | Effective access role resolution |
| `src/utils/getUserBatchGroup.js` | Batch group derivation |
| `src/features/analytics/ResultTable.jsx` | Semester results writer (CGPA Calculator) |
| `src/features/dashboard/RoutineAttendanceTracker.jsx` | Attendance average writer |
| `src/features/dashboard/WeekSchedule.jsx` | Calendar task writer |
| `src/features/dashboard/DeadlineTicker.jsx` | Deadlines widget (different count logic) |
| `src/features/dashboard/NextWeekSchedule.jsx` | Legacy deadline writer (unmounted) |
| `server/dev.mjs` | Store + role-access APIs, WS broadcast, safeguards |
| `server/roleAccess.json` | Persisted role/feature access config |
