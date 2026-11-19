# AUSTWise Prototype & Flow Canvas

A clickable, static copy of the whole AUSTWise site with sample data, plus an infinite canvas that shows every screen with its **user flow** (what you click to get where) and **data flow** (which page's data appears on which other page).

No backend, no database, no build step. Plain HTML/CSS/JS.

## Open it

| What | URL (app running) | Local only |
| --- | --- | --- |
| Flow Canvas | `/prototype/canvas.html` (also **Admin Panel → Flow Canvas** in the sidebar) | `node public/prototype/tools/serve.mjs 5230`, then `http://localhost:5230` |
| Clickable prototype | `/prototype/index.html` | `http://localhost:5230/index.html` |
| One bare screen | `/prototype/app.html#/dashboard/stats` | same |

## Flow Canvas layout

- **Each column is one sidebar section**, in sidebar order: Public & Auth, Admin Panel, Dashboard, Daily Life, GradeLab, InsideAUST, Resource Vault, Question Bank, Community, ConnectBox, Productivity, Marketplace, DownTime, Shadow, Settings, See Plans.
- **Each row in a column is one glider tab** of that page (for example Dashboard → Quick Stats, Routine, Semester View, Zero Hour, Attendance). Sub-pages and standalone routes of that section come after the tabs (Routine Templates, `/notebook`, game rooms, `/payment/cancel` …).
- **Blue solid line**: a user flow, meaning a click takes you there.
- **Amber dashed line**: a data flow, meaning data from one page shows up on another.

There are 117 screens and about 170 flows.

### Controls

| Action | How |
| --- | --- |
| Pan | Drag, or use trackpad scroll |
| Zoom | Mouse wheel, Ctrl+wheel, `+` / `-` |
| Fit everything | **Fit** or `Shift+1` |
| Jump to a section | **Jump to…** menu |
| Inspect a screen | Click it. The side panel lists users from/to and data in/out; click a row to fly there |
| Open a screen | Double-click it, or **Open in prototype ↗** |
| Main journey | **▶ Play journey**: Landing → Login → Dashboard → … → Payment |
| Layers | Toggle User flow, Data flow and Labels |

Screens load only when they are on screen and zoomed in (7% or more), so the canvas stays fast.

## Files

```
public/prototype/
├── canvas.html / canvas.css / canvas.js   Flow Canvas (camera, edges, inspector, minimap)
├── canvas-data.js                         ← every column, row (tab) and edge lives here
├── index.html / viewer.css / viewer.js    Figma-style viewer (device sizes, theme, prev/next)
├── app.html                               The app shell that renders one route
├── tokens.css                             Theme tokens copied from src/index.css
├── app.css / screens.css                  Shell + per-screen styles
├── ui.js                                  Hash router, primitives, modals, menus, mini card
├── data.js                                Sample data (members, notices, courses, chats …)
├── icons.js                               Lucide icons (built by tools/build-icons.mjs)
├── screens/*.js                           One file per area (core, life, learning, social, tools, public)
└── tools/                                 serve.mjs (static server), build-icons.mjs
```

## Adding a page or flow

1. **Screen.** In `screens/<area>.js`, call `register({ path, title, group, icon, render(sub) })`. A tab is just a `sub` value: add it to that page's tab array and give it a branch in `render`.
2. **Canvas row.** In `canvas-data.js`, add `[id, path, title, what, realRoute]` to the right column. The row order is the tab order.
3. **Flows.** Add `[fromId, toId, 'u' | 'd', label, detail]` to `EDGES`. A wrong id shows a warning in the console.

The viewer's page list comes from `canvas-data.js` too, so both stay in sync.

## Notes

- All data is fake. Buttons show toasts or open modals; nothing is saved.
- Prototype routes match the real routes. Where the real app has aliases (`/money-tracker`, `/zen`, `/cp-hub` …), the inspector lists them under the frame's path.

## Design Docs (`docs.html`)
One page with a side list. Every diagram is its own pan/zoom canvas: hover for details, click to highlight, Find, and Download SVG.

- **Overview:** Tech Stack, System Architecture, Sitemap, User & Data Flow (the Flow Canvas)
- **UML Structure:** Class, Component, Deployment
- **UML Behaviour:** Use Case, Sequence (4), Activity, State Machines
- **Data:** ER Diagram, DFD Level 0, DFD Level 1
- **Reference:** API Reference, Roles & Permissions

These run automatically before `npm run dev` and `npm run build` (`npm run docs:gen`). To run them by hand:

```
node public/prototype/tools/build-erd.mjs   # prisma schema -> docs/d-erd.js
node public/prototype/tools/build-api.mjs   # server routes + roleAccess -> docs/d-api-data.js
```

In the app, Admin Panel → Flow Canvas opens this hub.
