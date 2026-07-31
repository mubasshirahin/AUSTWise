# AUSTWise — Campus Companion App

## Overview
A full-stack React + Vite SPA for AUST (Ahsanullah University of Science & Technology) students. Features dashboard, grade tracking, resource vault, campus map, community, marketplace, cheatsheets, and more.

---

## Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 8, React Router 7, Chart.js, Lucide React |
| Backend | Node.js (vanilla HTTP server, no framework) |
| Storage | Frontend: localStorage / Backend: JSON files (`.telegram_users.json`, `.library_presence.json`) |
| Database | ❌ **None yet** — currently JSON file-based |
| Auth | localStorage-based (no real auth) |
| AI | OpenAI API for routine image extraction |

---

## How to Run
```bash
npm run dev        # Vite + backend together
npm run build      # Production build
```

---

## Features (Complete ✅ / Partial ⚠️ / Missing ❌)

### 1. Dashboard `/`
| Feature | Status | Notes |
|---------|--------|-------|
| Quick Stats (CGPA, Credits) | ✅ | Reads from localStorage |
| Routine Card | ⚠️ | UI works, `routineData` empty in mockData |
| Attendance Tracker | ⚠️ | Connects to Telegram backend, no mock data |
| Deadline Ticker | ⚠️ | `deadlines` empty, shows "No deadlines" |
| Notice Board | ⚠️ | `notices` empty |
| Weekly Planner | ✅ | localStorage-based tasks |
| Exam Tracker | ✅ | |
| Pomodoro Timer | ✅ | |

### 2. Grade Lab `/analytics`
| Feature | Status | Notes |
|---------|--------|-------|
| CGPA Graph | ✅ | Chart.js, semester results CRUD |
| Semester Tracker | ✅ | Quiz/lab config, term schedule, PDF export |
| Department Heatmap | ✅ | Aggregated CGPA heatmap |
| Course Review | ✅ | localStorage-based reviews |
| Course Poll | ✅ | Best/worst course voting |
| Syllabus Progress | ❌ | Component exists but **never imported/used** |

### 3. Resource Vault `/vault`
| Feature | Status | Notes |
|---------|--------|-------|
| Course Selection Wizard | ✅ | Dept → semester → course |
| Question Bank | ✅ | IndexedDB-backed, add/view/delete papers |
| Topic Analysis (Heatmap) | ❌ | `topicFrequency` is empty, no way to populate |
| Lecture Notes | ❌ | Skeleton — upload is `alert()` only |
| YouTube Playlists | ❌ | Skeleton — play is `alert()` only |

### 4. Cheatsheets `/cheatsheets`
| Feature | Status | Notes |
|---------|--------|-------|
| Browse by Department | ✅ | 40+ cheatsheets across 8 depts + common subjects |
| Category Filter | ✅ | Filters by topic within selected dept |
| Search | ✅ | Searches title, category, formulas |
| Copy to Clipboard | ✅ | Each formula has copy button |

### 5. Campus `/campus`
| Feature | Status | Notes |
|---------|--------|-------|
| Interactive Map | ✅ | Floor-wise SVG with hotspots (Ground-8th) |
| Faculty Directory | ⚠️ | UI works, `facultyData` empty |
| Library Pulse | ✅ | Occupancy chart, GPS check-in |
| Canteen Menu | ✅ | Day-wise menu, feedback |
| Prerequisite Tree | ✅ | Interactive course dependency graph |

### 6. Community `/community`
| Feature | Status | Notes |
|---------|--------|-------|
| Senior Secrets | ✅ | Role-gated tips (SR only) |
| Alumni Directory | ⚠️ | Empty until alumni register |
| Club Portal | ✅ | 14 clubs, join/leave |
| Student Directory | ✅ | Shows registered users |

### 7. Messages `/messages`
| Feature | Status | Notes |
|---------|--------|-------|
| Inbox / Chat | ✅ | localStorage-based, 2s polling |

### 8. Marketplace `/marketplace`
| Feature | Status | Notes |
|---------|--------|-------|
| Exchange Kits | ✅ | Books, equipment listing |
| To-Let Listings | ✅ | Room/flat rental with images |
| Lost & Found | ✅ | Lost/found items with claim |
| Mentor Requests | ✅ | Request mentors, send messages |

### 9. Other Pages
| Feature | Status | Notes |
|---------|--------|-------|
| Career Roadmaps `/career-roadmaps` | ❌ | Skeleton — `skillRoadmaps` empty |
| Routine Templates `/templates` | ⚠️ | localStorage, empty by default |
| Admin Panel `/admin` | ✅ | Users, notices, canteen, library CRUD |
| Settings `/settings` | ✅ | Profile, themes, Telegram config |

---

## Backend APIs (Node.js server)
All at `http://localhost:5174/api/`:

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `/api/extract-routine` | Extract timetable from image (OpenAI) | ✅ |
| `/api/telegram/*` | Telegram notification CRUD | ✅ |
| `/api/library/*` | Library GPS check-in/occupancy | ✅ |

---

## Data Storage Summary
| Data | Where | Persistence |
|------|-------|-------------|
| Auth / Profile | `localStorage` | Browser-only |
| Grades / CGPA | `localStorage` | Browser-only |
| Question Bank | IndexedDB | Browser-only |
| Marketplace / Messages | `localStorage` | Browser-only |
| Telegram Users | `.telegram_users.json` | Server file |
| Library Check-ins | `.library_presence.json` | Server file |
| Cheatsheets / Campus Map | `mockData.js` (hardcoded) | Code-level |

---

## What Needs Work (Priority Order)

### High Priority
1. **Database integration** — Replace JSON files with SQL Server / MongoDB so data persists across restarts and is manageable via SSMS
2. **Topic Heatmap** — No data and no way to input data
3. **Lecture Notes** — Upload is just `alert()` simulation
4. **YouTube Playlists** — Play button is just `alert()` simulation
5. **Career Roadmaps** — Empty, no data

### Medium Priority
6. **Faculty Directory** — `facultyData` is empty
7. **Syllabus Progress** — Component written but never shown anywhere
8. **Dashboard mock data** — Routine, attendance, deadlines, notices all empty

### Low Priority
9. **SeniorSecrets upvote** — No duplicate-vote check (unlimited clicks)
10. **Alumni Directory** — Empty until users register as alumni

---

## Project Structure
```
aust-student-helper/
├── server/              # Node.js backend
│   ├── dev.mjs          # HTTP server + Vite middleware
│   ├── telegramDB.mjs   # JSON file DB for Telegram
│   ├── telegramNotifier.mjs
│   ├── telegramScheduler.mjs
│   ├── libraryDB.mjs    # JSON file DB for library
│   └── routineExtractor.mjs  # OpenAI integration
├── src/
│   ├── App.jsx          # Routes + auth guard
│   ├── main.jsx         # Entry point
│   ├── context/         # ThemeContext
│   ├── data/            # mockData, courses, syllabus
│   ├── features/        # All page components
│   │   ├── admin/
│   │   ├── analytics/
│   │   ├── auth/
│   │   ├── campus/
│   │   ├── community/
│   │   ├── dashboard/
│   │   ├── marketplace/
│   │   ├── messages/
│   │   ├── settings/
│   │   └── vault/
│   ├── layout/          # Sidebar, TopNavbar, MobileNav
│   └── utils/           # localStorage helpers
├── .env                 # OPENAI_API_KEY, TELEGRAM_BOT_TOKEN
├── package.json
└── vite.config.js
```
