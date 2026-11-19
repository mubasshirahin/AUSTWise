// QA checklist content for the admin "QA Checklist" page.
// Every page lists what to look at (ui), what to do (flow), where the data
// must show up afterwards (data), who may/may not do it (role) and the odd
// cases (edge). Item ids are stable keys for saved progress — when you edit
// text keep the id; when you remove an item its saved tick is simply ignored.

export const ITEM_KINDS = {
  ui: { label: 'Dekhte hobe', hint: 'Page e ki ki thakbe' },
  flow: { label: 'User flow', hint: 'Step by step kore try koro' },
  data: { label: 'Data flow', hint: 'Save er por kothay kothay dekhabe' },
  role: { label: 'Role check', hint: 'Ke parbe, ke parbe na' },
  edge: { label: 'Edge case', hint: 'Bhul input, empty, slow net' },
};

// Shared checks repeated on every page — shown once per page as a compact row.
export const PER_PAGE_BASICS = [
  'Console e red error nai',
  'Loading state ache, blank flash nai',
  'Empty state sundor message dey',
  'Refresh dile same tab e thake',
  'Mobile 375px e horizontal scroll nai',
  'Dark + light duita theme e text pora jay',
];

const page = (id, route, title, group, items, extra = {}) => ({ id, route, title, group, items, ...extra });
const it = (id, kind, text) => ({ id, kind, text });

export const GROUPS = [
  { id: 'start', label: 'Shuru korar age' },
  { id: 'public', label: 'Public pages (logged-out)' },
  { id: 'core', label: 'Main app' },
  { id: 'study', label: 'Study & productivity' },
  { id: 'life', label: 'Daily life & fun' },
  { id: 'account', label: 'Account & plans' },
  { id: 'admin', label: 'Admin panel' },
  { id: 'cross', label: 'Cross-cutting' },
];

export const PAGES = [
  // ── Before you start ────────────────────────────────────────────────────
  page('prep', null, 'Test setup', 'start', [
    it('prep-db', 'flow', 'Test korar jonno **test DB** chalu ache (production DB te test data likhbo na)'),
    it('prep-accounts', 'flow', 'Protita role er ekta test account ready: student, CR, SR, faculty, alumni, alumni with carry, re-add, moderator, admin, banned'),
    it('prep-devices', 'flow', 'Device ready: ekta Android, ekta iPhone/Safari, ekta laptop (Chrome + Firefox + Edge)'),
    it('prep-two', 'flow', 'Duita browser/profile e duita account login kora (realtime chat, notice test er jonno)'),
    it('prep-auto', 'flow', '**Auto tests** tab theke shob test ekbar chalano hoyeche, fail gula bug log e tola'),
    it('prep-e2e', 'flow', 'Terminal e `npm run test:e2e` chalano hoyeche (Playwright report `qa-report/html`)'),
  ], { noBasics: true }),

  // ── Public ──────────────────────────────────────────────────────────────
  page('landing', '/', 'Landing', 'public', [
    it('landing-hero', 'ui', 'Hero, feature section, footer link gula thik dekhay'),
    it('landing-cta', 'flow', 'CTA "Login / Get started" → login form khule'),
    it('landing-loggedin', 'role', 'Logged-in user `/` e gele dashboard e chole jay'),
    it('landing-cinematic', 'flow', '`/cinematic` animation smooth, skip/scroll kaj kore'),
  ]),
  page('login', '/', 'Login & sign up', 'public', [
    it('login-ok', 'flow', 'Sothik email + password → login → `/dashboard/quickstats`'),
    it('login-wrong', 'edge', 'Bhul password → bujhar moto error, password field clear hoy'),
    it('login-signup', 'flow', 'Sign up → profile info (department, batch, section) → dashboard'),
    it('login-google', 'flow', 'Google login kaj kore, notun account hole profile complete korte bole'),
    it('login-forgot', 'flow', 'Forgot password → reset mail ashe → `/reset-password` link e new password → login hoy'),
    it('login-reset-expired', 'edge', 'Purono/used reset link → "expired" message, password bodlay na'),
    it('login-rate', 'edge', 'Onek bar bhul password dile rate limit message ashe'),
    it('login-banned', 'role', 'Banned account login korle suspended message dekhay, app e dhukte pare na'),
  ]),
  page('invite', '/accept-invite', 'Accept invite', 'public', [
    it('invite-ok', 'flow', 'Admin er pathano invite link → account create → sothik role (faculty/alumni) pay'),
    it('invite-bad', 'edge', 'Bhul ba expired token → error message, account hoy na'),
    it('invite-data', 'data', 'Notun faculty Community → Faculty Directory te dekhay'),
  ]),
  page('info', '/features', 'Info pages', 'public', [
    it('info-pages', 'ui', '`/features`, `/pricing`, `/about-us`, `/docs`, `/blog`, `/changelog` content dekhay, link kaj kore'),
    it('info-legal', 'ui', '`/terms`, `/privacy`, `/cookie-policy` pora jay, footer theke link ache'),
    it('info-feedback', 'flow', '`/feedback` form submit → success; khali submit → validation'),
    it('info-404', 'edge', 'Unknown URL → home e redirect, crash kore na'),
    it('info-admin-out', 'role', 'Logged-out obosthay `/admin-panel/overview` → login/home e pathay'),
  ]),

  // ── Core app ────────────────────────────────────────────────────────────
  page('dashboard', '/dashboard/quickstats', 'Dashboard', 'core', [
    it('dash-tabs', 'ui', 'Tab gula: Quick Stats, Routine, Semester View, Zero Hour, Attendance — URL bodlay, refresh e same tab'),
    it('dash-stats', 'ui', 'Quick Stats card gulay nijer data (CGPA, class, streak) load hoy'),
    it('dash-notice', 'flow', 'Notice board: notice porte jay; mobile e swipe left = edit, right = delete (nijer notice)'),
    it('dash-routine', 'flow', 'Routine: class add / edit / delete, ajker din highlight'),
    it('dash-template', 'flow', '`/routine-templates` theke template apply → Routine tab e class ashe'),
    it('dash-semester', 'ui', 'Semester View calendar e exam/holiday thik date e'),
    it('dash-zero', 'role', 'Zero Hour: CR/SR/admin/moderator edit korte pare; student shudhu dekhe'),
    it('dash-attendance', 'data', 'Attendance: Telegram e deya attendance ekhane dekhay'),
    it('dash-notice-data', 'data', 'CR er post kora notice oi batch er student er dashboard e ashe + bell notification'),
    it('dash-empty', 'edge', 'Notun account (kono routine nai) → empty state + "add" button'),
  ]),
  page('gradelab', '/gradelab', 'GradeLab', 'core', [
    it('gl-tabs', 'ui', 'Tab: CGPA Calculator, Semester Wise, Dept Heatmap, Best & Worst, Prerequisites'),
    it('gl-calc', 'flow', 'Course + grade add → CGPA hisab thik (hate ekta hisab kore milao)'),
    it('gl-edit', 'flow', 'Grade edit / delete korle CGPA sathe sathe update'),
    it('gl-data', 'data', 'Save kora grade Semester Wise, Best & Worst e dekhay; onno device e login korleo thake'),
    it('gl-heat', 'ui', 'Dept Heatmap load hoy, color legend bujha jay'),
    it('gl-prereq', 'ui', 'Prerequisites tree thik course dekhay'),
    it('gl-edge', 'edge', 'Credit 0 / onek boro number / khali grade dile crash kore na'),
    it('gl-review', 'flow', 'Course review likha → onnora dekhte pay'),
  ]),
  page('vault', '/resource-vault', 'Resource Vault', 'core', [
    it('vault-tabs', 'ui', 'Tab: Notebook, Batch Drive, Drive Links (CR/SR), Carbon Vault, Code Generate'),
    it('vault-drive', 'flow', 'Batch Drive: folder browse, file open/download, search'),
    it('vault-lock', 'flow', 'Batch drive lock: share code diye unlock → file dekha jay'),
    it('vault-code', 'flow', 'Code Generate (3.1+): code banano → onno student oi code diye unlock korte pare'),
    it('vault-links', 'role', 'Drive Links tab shudhu CR/SR/admin dekhe; student dekhe na'),
    it('vault-links-data', 'data', 'CR er deya semester link oi batch er Batch Drive e dekhay'),
    it('vault-upload', 'edge', 'Boro file / bhul file type upload → bujhar moto error'),
    it('vault-notebook', 'flow', '`/notebook`: note create → save → reopen → edit → delete'),
  ]),
  page('qbank', '/question-bank', 'Question Bank', 'core', [
    it('qb-search', 'flow', 'Course diye question paper search → open → download'),
    it('qb-analyze', 'flow', 'Analyzer: paper select → topic/frequency result dekhay'),
    it('qb-data', 'data', 'Admin panel → Question bank e add kora paper ekhane ashe'),
    it('qb-edge', 'edge', 'Result na pele empty state, PDF load fail hole message'),
  ]),
  page('campus', '/insideaust', 'InsideAUST', 'core', [
    it('campus-tabs', 'ui', 'Tab: Floor Map, Library Pulse, Canteen Menu, Bus Tracker, Free Rooms'),
    it('campus-map', 'flow', 'Floor Map: floor switch, room search, zoom/pan mobile e'),
    it('campus-library', 'data', 'Library Pulse: admin er deya capacity/occupancy dekhay'),
    it('campus-canteen', 'data', 'Canteen Menu: admin er update kora menu, dam, khola-bondho time dekhay'),
    it('campus-bus', 'ui', 'Bus Tracker route/time thik'),
    it('campus-rooms', 'flow', 'Free Rooms: din + somoy select → khali room list'),
    it('campus-bhara', 'flow', '`/aust-bhara` / `/empty-classroom` purono link thik jaygay niye jay'),
  ]),
  page('community', '/community', 'Community', 'core', [
    it('com-tabs', 'ui', 'Tab: Student, Faculty, Alumni Directory, Mentor Requests, Clubs Hub'),
    it('com-search', 'flow', 'Directory te name/department/batch diye search + filter'),
    it('com-profile', 'flow', 'Card e click → `/members/:id` profile; mini card info match kore'),
    it('com-mentor', 'flow', 'Mentor request pathano → onno user pay → accept/decline'),
    it('com-clubs', 'flow', 'Club join / leave, club details'),
    it('com-data', 'data', 'Settings e profile bodlale directory card + mini card e update'),
    it('com-privacy', 'role', 'Private info (phone/email) shudhu allowed role/user dekhe'),
  ]),
  page('connectbox', '/connectbox', 'ConnectBox (messages)', 'core', [
    it('cb-tabs', 'ui', 'All Chats / Unread filter kaj kore'),
    it('cb-send', 'flow', 'Notun conversation → message send → onno browser e realtime ashe'),
    it('cb-unread', 'data', 'Na pora message e sidebar badge + Unread tab count; porle kome'),
    it('cb-offline', 'edge', 'Net off kore pathale fail message, net ashle abar try'),
    it('cb-gali', 'edge', 'Gali dile message block hoy (422) + strike count barhe'),
    it('cb-banned', 'role', 'Banned user message pathate pare na'),
  ]),
  page('austeddit', '/austeddit', 'AUSTeddit (Buzz)', 'core', [
    it('buzz-tabs', 'ui', 'Category: General, Academic, Confession, Campus, Memes'),
    it('buzz-post', 'flow', 'Post create → feed e ashe → upvote → comment'),
    it('buzz-own', 'role', 'Nijer post edit/delete; onner post shudhu moderator/admin delete korte pare'),
    it('buzz-xss', 'edge', 'Post e `<b>hi</b>` / script dile text hishebe dekhay, execute hoy na'),
  ]),
  page('marketplace', '/marketplace', 'Marketplace', 'core', [
    it('mk-tabs', 'ui', 'Tab: AW Market, ToLet Mama, Lost & Found'),
    it('mk-post', 'flow', 'Item post (chobi shoho) → list e ashe → details open'),
    it('mk-filter', 'flow', 'Search, category filter, price sort'),
    it('mk-contact', 'flow', 'Contact seller → ConnectBox e chat khule'),
    it('mk-sold', 'flow', 'Mark as sold → badge; delete → list theke chole jay'),
    it('mk-data', 'data', 'Onno user er feed e notun item dekhay'),
    it('mk-edge', 'edge', 'Chobi chara / onek boro chobi / negative price → validation'),
  ]),
  page('members', '/members/:id', 'Member profile', 'core', [
    it('mem-open', 'flow', 'Directory ba active members theke profile open'),
    it('mem-info', 'ui', 'Name, role badge, batch, streak thik dekhay'),
    it('mem-bad', 'edge', 'Bhul id → "not found", crash kore na'),
  ], { openRoute: '/community' }),

  // ── Study & productivity ────────────────────────────────────────────────
  page('productivity', '/productivity', 'Productivity hub', 'study', [
    it('prod-tabs', 'ui', 'Tab: Study Time, Cheat Sheets, Code Pulse, Workspace — masthead thik'),
  ]),
  page('studytime', '/study-time', 'Study Time', 'study', [
    it('st-timer', 'flow', 'Focus timer start/pause/reset; tab bodlaleo timer chole'),
    it('st-sound', 'flow', 'Rain / Forest / Café / White Noise sound play-stop'),
    it('st-room', 'flow', 'Room join/leave, onno member dekhay'),
    it('st-zen', 'flow', '`/zen-study-room` fullscreen, Esc/exit kaj kore'),
    it('st-streak', 'data', 'Study session er por streak/leaderboard update'),
  ]),
  page('cheats', '/cheat-sheets', 'Cheat Sheets', 'study', [
    it('cs-list', 'flow', 'List, filter, open, download'),
    it('cs-data', 'data', 'Admin panel → Cheatsheets e add kora sheet ekhane ashe'),
  ]),
  page('codepulse', '/code-pulse', 'Code Pulse', 'study', [
    it('cp-link', 'flow', 'Codeforces/CP handle link → stats load'),
    it('cp-contest', 'ui', 'Upcoming contest list, time zone thik (Dhaka)'),
    it('cp-bad', 'edge', 'Bhul handle → error message'),
  ]),
  page('workspace', '/workspace', 'Workspace', 'study', [
    it('ws-filter', 'ui', 'Filter: Missing, Upcoming, No due date, Turned in'),
    it('ws-task', 'flow', 'Project/task create → move → complete → delete'),
    it('ws-due', 'edge', 'Due date par hole Missing e jay'),
  ]),
  page('cover', '/cover-page-generator', 'Cover Page', 'study', [
    it('cov-fill', 'flow', 'Form fill → live preview update'),
    it('cov-pdf', 'flow', 'PDF download → file e shob lekha thik, Bangla/long name bhange na'),
    it('cov-stats', 'data', 'Generate korle cover stats counter barhe'),
  ]),
  page('roast', '/roast-cv', 'Roast CV', 'study', [
    it('roast-up', 'flow', 'CV (PDF) upload → result ashe'),
    it('roast-bad', 'edge', 'Bhul file type / boro file → error'),
  ]),
  page('certificate', '/certificate', 'Certificate', 'study', [
    it('cert-gen', 'flow', 'Generate → preview → download'),
  ]),

  // ── Daily life & fun ────────────────────────────────────────────────────
  page('dailylife', '/daily-life', 'Daily Life', 'life', [
    it('dl-tabs', 'ui', 'Tab: Cover Page, Bhara Koto, TakaGeloKoi, Mess Meal, Life Planner, Footprint, Passwords — `?tab=` refresh e thake'),
    it('dl-bhara', 'flow', 'Bhara Koto: jayga select → bhara/route dekhay'),
    it('dl-bhara-data', 'data', 'Admin panel → Campus services e bodlano bhara ekhane dekhay'),
    it('dl-mess', 'flow', 'Mess Meal: meal add, mash shesh e hisab thik'),
    it('dl-planner', 'flow', 'Life Planner: goal/milestone/task add → complete → progress bar barhe'),
    it('dl-footprint', 'ui', 'Digital Footprint load hoy'),
    it('dl-pass', 'flow', 'Passwords: entry add → reload er por o thake → delete'),
    it('dl-pass-role', 'role', 'Onno user er password kokhono dekha jay na (logout kore abar check)'),
  ]),
  page('taka', '/takagelokoi', 'TakaGeloKoi', 'life', [
    it('tgk-add', 'flow', 'Income/expense add, category select'),
    it('tgk-switch', 'flow', 'Daily / Weekly / Monthly switch, ‹ › date nav'),
    it('tgk-budget', 'flow', 'Budget edit (masthead) → over hole rose color'),
    it('tgk-data', 'data', 'Total + masthead stats thik; onno device e login korleo data thake'),
    it('tgk-edge', 'edge', 'Negative / khali amount → validation'),
  ]),
  page('downtime', '/downtime', 'DownTime', 'life', [
    it('dt-tabs', 'ui', 'Tab: Organizing Area, Media Tracker, Rumour or Real, Trivia, Gaming Zone'),
    it('dt-media', 'flow', 'Media Tracker e movie/series add → status bodlano'),
    it('dt-trivia', 'flow', 'Trivia khela → score dekhay'),
    it('dt-gaming', 'flow', 'Gaming Zone (`?tab=gaming`): game hub → room create → onno user join'),
    it('dt-event', 'flow', 'Gaming event open → register'),
    it('dt-mod', 'role', '`/gaming/mod` shudhu gaming_mod/moderator/admin; student dhukte pare na'),
  ]),
  page('shadow', '/shadow', 'Shadow', 'life', [
    it('sh-tabs', 'ui', 'Tab: Course Reviews, Shadow Chat, Buzz, Roast CV'),
    it('sh-chat', 'flow', 'Shadow Chat e anonymous message → onno browser e ashe, nam dekhay na'),
    it('sh-review', 'flow', 'Course review likha + rating'),
  ]),
  page('wakemeup', '/wakemeup', 'WakeMeUp', 'life', [
    it('wk-set', 'flow', 'Alarm set → somoy hole bajje → stop / snooze'),
    it('wk-notif', 'edge', 'Notification permission deny korle bujhar moto message'),
  ]),

  // ── Account ─────────────────────────────────────────────────────────────
  page('settings', '/settings', 'Settings', 'account', [
    it('set-profile', 'flow', 'Profile edit (name, chobi, section) → save → refresh e thake'),
    it('set-theme', 'flow', 'Theme change → shob page e apply, refresh e thake (`aust-theme`)'),
    it('set-pass', 'flow', 'Password change → purono password diye login hoy na, notun diye hoy'),
    it('set-notif', 'flow', 'Push notification on/off, telegram connect'),
    it('set-logout', 'flow', 'Logout → home; back button dile protected page khule na'),
    it('set-data', 'data', 'Profile change directory, mini card, member profile e dekhay'),
  ]),
  page('plans', '/see-plans', 'See Plans & payment', 'account', [
    it('pl-view', 'ui', 'Plan card, dam, feature list thik'),
    it('pl-checkout', 'flow', 'Checkout (test mode) → `/payment/success` → Pro unlock'),
    it('pl-cancel', 'flow', 'Cancel korle `/payment/cancel` + back button'),
    it('pl-fake', 'role', '`/payment/success` direct open korle Pro pawa jay na (server verify kore)'),
  ]),

  // ── Admin ───────────────────────────────────────────────────────────────
  page('adm-overview', '/admin-panel/overview', 'Admin: control menu', 'admin', [
    it('ao-cards', 'ui', '4 ta card (Accounts, Academic, Campus operations, Platform) — protita button thik section e jay'),
    it('ao-role', 'role', 'Shudhu admin + moderator dhukte pare; baki shobai home e redirect'),
    it('ao-legacy', 'flow', 'Purono `/admin/...` link notun `/admin-panel/...` e jay'),
  ]),
  page('adm-people', '/admin-panel/accounts', 'Admin: People & Roles', 'admin', [
    it('ap-search', 'flow', 'Account search (name, email, batch, section)'),
    it('ap-edit', 'flow', 'User edit → save → user nije refresh dile notun info'),
    it('ap-role', 'flow', 'Role change → user er permission sathe sathe bodlay'),
    it('ap-guard-admin', 'role', 'Admin account ke API diye edit/delete kora jay na'),
    it('ap-guard-mod', 'role', 'Moderator onno moderator ke manage korte pare na; shudhu admin pare'),
    it('ap-guard-self', 'role', 'Nijer account nije re-role korte pare na'),
    it('ap-roles', 'ui', 'Roles tab e count + member list thik'),
    it('ap-usage', 'ui', 'Usage Analytics, Drive Coverage, Code Shares load hoy'),
  ]),
  page('adm-requests', '/admin-panel/access-requests', 'Admin: Invitations', 'admin', [
    it('ar-invite', 'flow', 'Faculty/alumni invite pathano → mail ashe'),
    it('ar-approve', 'flow', 'Request approve / reject → user er role update'),
  ]),
  page('adm-academic', '/admin-panel/academic', 'Admin: Academic', 'admin', [
    it('aa-preview', 'flow', 'Semester transition preview → kara upore uthbe thik list'),
    it('aa-apply', 'data', 'Apply korle student er semester bodlay (test DB te!)'),
    it('aa-apps', 'flow', 'Role applications: CR/SR application approve → user CR hoy'),
    it('aa-apps-data', 'data', 'Approve er por CR/SR directory te dekhay + oi user Drive Links tab pay'),
    it('aa-reps', 'flow', 'CR/SR directory theke representative remove'),
  ]),
  page('adm-campus', '/admin-panel/canteen', 'Admin: Campus operations', 'admin', [
    it('ac-canteen', 'data', 'Canteen menu/time bodlano → InsideAUST Canteen e dekhay'),
    it('ac-library', 'data', 'Library capacity bodlano → Library Pulse e dekhay'),
    it('ac-attendance', 'ui', 'Attendance record list + filter'),
    it('ac-telegram', 'ui', 'Telegram connections search, Chat ID dekhay'),
    it('ac-strikes', 'flow', 'Gali strikes: warning, temp ban, reset → user er upor apply'),
    it('ac-bhara', 'data', 'Campus services (Bhara Koto) edit → Daily Life e dekhay'),
    it('ac-audi', 'flow', 'Auditorium event edit'),
    it('ac-map', 'data', 'Campus map info edit → Floor Map e dekhay'),
  ]),
  page('adm-platform', '/admin-panel/features', 'Admin: Platform & content', 'admin', [
    it('apf-access', 'data', 'Access rules: kono role er jonno page hide → oi role er sidebar theke chole jay + page lock'),
    it('apf-avail', 'data', 'Page availability: page pause → user "paused" message dekhe'),
    it('apf-templates', 'data', 'Routine template add → `/routine-templates` e ashe'),
    it('apf-cheats', 'data', 'Cheatsheet add → Cheat Sheets page e ashe'),
    it('apf-qb', 'data', 'Question bank paper add → Question Bank e ashe'),
    it('apf-preview', 'role', 'Role preview: dev e kaj kore; production e mock role kaj kore na'),
    it('apf-docs', 'ui', 'Design Docs (flow canvas) load hoy, zoom/pan'),
  ]),

  // ── Cross-cutting ───────────────────────────────────────────────────────
  page('responsive', null, 'Responsive', 'cross', [
    it('rs-devices', 'flow', 'Mobile 375, choto phone 320, tablet 768, desktop 1440 + landscape e main page gula'),
    it('rs-scroll', 'ui', 'Kono page e horizontal scroll nai'),
    it('rs-text', 'ui', 'Lekha cut hoy na, lomba name ellipsis hoy'),
    it('rs-drawer', 'flow', 'Mobile e sidebar drawer khule-bondho hoy, bottom nav kaj kore'),
    it('rs-modal', 'ui', 'Modal screen e fit kore, bhitore scroll kore'),
    it('rs-tap', 'ui', 'Button/tap target ≥ 40px, swipe action kaj kore'),
    it('rs-keyboard', 'edge', 'Real phone e keyboard khulle input dhaka pore na'),
  ], { noBasics: true }),
  page('themes', null, 'Themes', 'cross', [
    it('th-auto', 'flow', '**Auto tests → Theme contrast** shob pass'),
    it('th-look', 'ui', 'Protita theme e dashboard, ekta form, ekta list, modal, admin dekha'),
    it('th-inputs', 'ui', 'Input, dropdown, date picker theme follow kore (dark theme e white box nai)'),
    it('th-charts', 'ui', 'Chart er color theme e pora jay'),
    it('th-flat', 'ui', '**Kono gradient/glow/tint nai** (masthead er 7% shade chara)'),
  ], { noBasics: true }),
  page('security', null, 'Security', 'cross', [
    it('sec-audit', 'flow', '`npm audit` e high/critical nai'),
    it('sec-api', 'role', '**Auto tests → API auth guard** shob pass (logged-out → 401/403)'),
    it('sec-idor', 'role', 'Onner id diye API call kore onner data dekha/edit jay na (IDOR)'),
    it('sec-promote', 'role', 'Keu nije nijeke admin/moderator banate pare na (DevTools theke request pathiye dekho)'),
    it('sec-xss', 'edge', '`<script>alert(1)</script>` post, comment, message, profile name e execute hoy na'),
    it('sec-upload', 'edge', 'Upload e file type + size limit, `.exe`/`.html` reject'),
    it('sec-cookie', 'ui', 'Auth cookie `HttpOnly; Secure; SameSite` (DevTools → Application → Cookies)'),
    it('sec-headers', 'ui', '**Auto tests → Security headers** pass (production URL e chalao)'),
    it('sec-secrets', 'ui', '**Auto tests → Bundle secret scan** pass'),
    it('sec-ws', 'role', 'WebSocket ticket chara connect hoy na'),
    it('sec-presence', 'role', '`/api/presence/members` logged-out e member list dey — eta intended kina decide koro'),
  ], { noBasics: true }),
  page('quality', null, 'Performance & others', 'cross', [
    it('q-lh', 'flow', 'Lighthouse (Performance, Accessibility, SEO, Best practices) main page e ≥ 80'),
    it('q-kbd', 'flow', 'Keyboard: Tab diye navigate, Enter, Esc modal bondho'),
    it('q-browsers', 'flow', 'Chrome, Firefox, Safari, Edge'),
    it('q-3g', 'edge', 'Slow 3G te app use kora jay, loading state dekhay'),
    it('q-meta', 'ui', 'Favicon, page title, OG tag (link share korle preview)'),
    it('q-bangla', 'edge', 'Bangla / onek lomba lekha te layout bhange na'),
    it('q-time', 'ui', 'Time zone + date format Dhaka onujayi'),
  ], { noBasics: true }),
];

// End-to-end journeys that touch several pages. Each step is a checkbox.
export const USER_FLOWS = [
  { id: 'uf-student', title: 'Notun student er prothom din', role: 'student', steps: [
    'Landing → Sign up → profile complete',
    'Dashboard e routine template apply',
    'GradeLab e aager semester er grade add → CGPA',
    'Resource Vault → Batch Drive theke note download',
    'Community te classmate khuje profile dekha',
    'ConnectBox e message pathano',
    'Settings e theme change → logout → login → theme thake',
  ] },
  { id: 'uf-cr', title: 'CR hoya theke notice deya', role: 'cr', steps: [
    'Student account theke CR application',
    'Admin → Role applications e approve',
    'Student refresh → CR badge + Drive Links tab',
    'CR notice post → batch er student dashboard e ashe + bell',
    'CR Zero Hour e exam add → student dekhte pay',
  ] },
  { id: 'uf-faculty', title: 'Faculty invite', role: 'faculty', steps: [
    'Admin → Invitations e faculty invite',
    'Mail er link → `/accept-invite` → account create',
    'Faculty directory te dekhay, faculty-only page access thik',
  ] },
  { id: 'uf-market', title: 'Marketplace e bikri', role: 'student', steps: [
    'User A item post (chobi shoho)',
    'User B search kore khuje contact seller',
    'ConnectBox e duijon chat',
    'User A mark sold → User B er list e sold dekhay',
  ] },
  { id: 'uf-mod', title: 'Moderation', role: 'moderator', steps: [
    'Student gali diye post/message → block + strike',
    'Admin → Gali strikes e strike dekhay',
    'Temp ban → student kichu post korte pare na, message dekhay',
    'Strike reset → abar normal',
  ] },
  { id: 'uf-admin-content', title: 'Admin content publish', role: 'admin', steps: [
    'Canteen menu update → student InsideAUST e dekhe',
    'Page pause → student paused message dekhe → resume',
    'Access rule e alumni er jonno page hide → alumni sidebar e nai',
  ] },
  { id: 'uf-pro', title: 'Pro kena', role: 'student', steps: [
    'See Plans → checkout (test mode)',
    'Success page → Pro feature unlock',
    'Logout/login er por o Pro thake',
  ] },
];

// Who can do what. `expect` per role (same order as MATRIX_ROLES):
// y = allowed, n = blocked, '' = not known from code — fill it from Role preview.
// Known values come from ProtectedAdminRoute, server/roleGuards.mjs,
// ExamFlowTracker EDITOR_ROLES and the /api/messages role list.
export const MATRIX_ROLES = [
  { id: 'guest', label: 'Guest' },
  { id: 'student', label: 'Student' },
  { id: 'cr', label: 'CR / SR' },
  { id: 'faculty', label: 'Faculty' },
  { id: 'alumni', label: 'Alumni' },
  { id: 'readd', label: 'Re-add' },
  { id: 'gaming_mod', label: 'Gaming mod' },
  { id: 'moderator', label: 'Moderator' },
  { id: 'admin', label: 'Admin' },
  { id: 'banned', label: 'Banned' },
];

const _ = '';
//                                                    guest stud  cr   fac  alum readd gmod mod  admin banned
export const MATRIX_ROWS = [
  { id: 'rm-admin', label: 'Admin panel e dhuka', expect: ['n', 'n', 'n', 'n', 'n', 'n', 'n', 'y', 'y', 'n'] },
  { id: 'rm-role', label: 'Onner role change', expect: ['n', 'n', 'n', 'n', 'n', 'n', 'n', 'y', 'y', 'n'] },
  { id: 'rm-mod', label: 'Moderator banano', expect: ['n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'y', 'n'] },
  { id: 'rm-zero', label: 'Zero Hour edit', expect: ['n', 'n', 'y', 'n', 'n', 'n', 'n', 'y', 'y', 'n'] },
  { id: 'rm-message', label: 'Message pathano', expect: ['n', 'y', 'y', 'y', 'y', 'y', 'y', 'y', 'y', 'n'] },
  { id: 'rm-notice', label: 'Notice post', expect: ['n', 'n', 'y', _, _, 'n', _, 'y', 'y', 'n'] },
  { id: 'rm-links', label: 'Drive Links tab', expect: ['n', 'n', 'y', _, _, _, _, 'y', 'y', 'n'] },
  { id: 'rm-gmod', label: '`/gaming/mod`', expect: ['n', 'n', 'n', _, _, 'n', 'y', _, _, 'n'] },
  { id: 'rm-delete', label: 'Onner post delete', expect: ['n', 'n', _, _, _, 'n', _, 'y', 'y', 'n'] },
  { id: 'rm-vault', label: 'Batch Drive', expect: ['n', 'y', 'y', _, _, _, _, 'y', 'y', 'n'] },
  { id: 'rm-faculty', label: 'Faculty Directory', expect: [_, _, _, _, _, _, _, 'y', 'y', 'n'] },
  { id: 'rm-pass', label: 'Passwords (Daily Life)', expect: ['n', _, _, _, _, _, _, _, _, 'n'] },
];

// Release gate — the last thing before production.
export const GO_LIVE = [
  { id: 'gl-green', text: 'Shob auto test green, manual tour 100%' },
  { id: 'gl-bugs', text: 'Bug log e kono "Open" critical/high bug nai' },
  { id: 'gl-build', text: '`npm run build` error chara shesh hoy, `npm run lint` clean' },
  { id: 'gl-env', text: 'Production env var set: `DATABASE_URL`, JWT secret, mail, payment live key, `CSP_HEADER`' },
  { id: 'gl-db', text: 'Production DB backup neya hoyeche, migration test DB te age chalano' },
  { id: 'gl-demo', text: 'Dev demo data / demo chat production e nai' },
  { id: 'gl-mock', text: 'Production e `?mockRole=` kaj kore na, role preview admin chara khule na' },
  { id: 'gl-pay', text: 'Payment live mode e ekta choto real transaction check' },
  { id: 'gl-monitor', text: 'Error log / server log dekhar jayga ready' },
  { id: 'gl-rollback', text: 'Kichu bhanle ager version e ferar plan ache' },
  { id: 'gl-smoke', text: 'Deploy er por production URL e login + 5 ta main page + Auto tests abar chalano' },
];
