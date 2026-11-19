/* System-level diagrams: Tech Stack, Architecture, DFD Level 0 and Level 1. */
(function () {
  /* ── Tech stack ── */
  const L = (id, x, y, title, sub, lines, tone, w = 300) => ({ id, type: 'box', x, y, w, title, sub, lines, tone });
  DOCS.add('stack', {
    title: 'Tech Stack', sub: 'What AUSTWise is built with, layer by layer',
    groups: [{ title: 'Frontend', x: 0, y: 0, w: 1380, h: 330, tone: 'blue' }, { title: 'Backend', x: 0, y: 380, w: 1380, h: 330, tone: 'amber' }, { title: 'Data & hosting', x: 0, y: 760, w: 1380, h: 300, tone: 'violet' }, { title: 'Integrations', x: 1440, y: 0, w: 360, h: 1060, tone: 'cyan' }],
    nodes: [
      L('react', 30, 80, 'React 19', 'UI library', ['Function components and hooks', 'Lazy routes (React.lazy + Suspense)'], 'blue'),
      L('router', 360, 80, 'React Router 7', 'Routing', ['Hash-free SPA routes', 'Protected and admin routes'], 'blue'),
      L('vite', 690, 80, 'Vite 8', 'Build tool', ['Dev server with HMR', 'Production bundle in dist/'], 'blue'),
      L('ui', 1020, 80, 'UI libraries', 'Visuals', ['lucide-react icons', 'framer-motion, GSAP', 'Chart.js, D3, Mermaid, Markmap', 'Three.js / R3F, Leaflet'], 'blue', 330),
      L('css', 30, 220, 'CSS + theme tokens', 'Styling', ['23 themes via CSS variables'], 'blue'),
      L('pdf', 360, 220, 'jsPDF · html2canvas · pdf.js', 'Documents', ['Cover pages, certificates, PDF preview'], 'blue', 600),
      L('node', 30, 460, 'Node.js 20+', 'Runtime', ['Single HTTP server: server/dev.mjs', 'Serves SPA, /api and WebSocket'], 'amber'),
      L('ws', 360, 460, 'ws (WebSocket)', 'Realtime', ['Chat, presence, gaming rooms', 'Ticket auth via /api/ws-ticket'], 'amber'),
      L('auth', 690, 460, 'Auth', 'Security', ['JWT session (jsonwebtoken)', 'bcryptjs password hashes', 'Google / social OAuth'], 'amber'),
      L('jobs', 1020, 460, 'Schedulers', 'Background jobs', ['Telegram class reminders', 'Web Push reminders', 'Gaming room expiry'], 'amber', 330),
      L('mail', 30, 600, 'Nodemailer', 'Email', ['Invites and password reset'], 'amber'),
      L('rate', 360, 600, 'Rate limiter & guards', 'Protection', ['Per-route limits, role guards, strikes'], 'amber', 600),
      L('pg', 30, 840, 'PostgreSQL', 'Database', ['37 tables (see ER Diagram)'], 'violet'),
      L('prisma', 360, 840, 'Prisma 7', 'ORM', ['schema.prisma + adapter-pg'], 'violet'),
      L('render', 690, 840, 'Render', 'Hosting', ['Web service + free Postgres', 'Singapore region'], 'violet'),
      L('vercel', 1020, 840, 'Vercel', 'Frontend CDN', ['Static SPA, rewrites /api → Render'], 'violet', 330),
      L('tg', 1470, 80, 'Telegram Bot API', '', ['Notices, routine, attendance'], 'cyan'),
      L('google', 1470, 230, 'Google APIs', '', ['OAuth sign-in, YouTube search'], 'cyan'),
      L('gemini', 1470, 380, 'Gemini API', '', ['AI chat, routine extraction'], 'cyan'),
      L('cf', 1470, 530, 'Codeforces API', '', ['Ratings for Code Pulse'], 'cyan'),
      L('push', 1470, 680, 'Web Push (VAPID)', '', ['Browser notifications'], 'cyan'),
      L('pay', 1470, 830, 'Payment gateway', '', ['Create, verify, webhook (/api/payment)'], 'cyan'),
    ],
    edges: [],
    legend: [['svc', 'Frontend'], ['amber', 'Backend'], ['violet', 'Data & hosting'], ['ext', 'Third-party service']],
  });

  /* ── Architecture ── */
  DOCS.add('arch', {
    title: 'System Architecture', sub: 'How a request travels: browser → CDN → Node server → Postgres and third-party APIs',
    groups: [{ title: 'Client', x: 0, y: 0, w: 420, h: 760, tone: 'blue' }, { title: 'Render web service (Node.js)', sub: 'server/dev.mjs — one process', x: 760, y: 0, w: 980, h: 760, tone: 'amber' }, { title: 'Third-party', x: 2080, y: 0, w: 400, h: 1000, tone: 'cyan' }],
    nodes: [
      { id: 'user', type: 'actor', x: 165, y: 60, title: 'User', desc: 'Student, CR/SR, alumni, faculty, moderator or admin.' },
      { id: 'spa', type: 'box', x: 50, y: 260, w: 320, title: 'React SPA', sub: 'Vite build · React Router', lines: ['Pages in src/features/*', 'Contexts: Auth, Theme, Routine, Pomodoro', 'Hooks: useWebSocket, useRoleAccess …'], tone: 'blue' },
      { id: 'sw', type: 'box', x: 50, y: 520, w: 320, title: 'Browser storage', sub: 'localStorage · Service worker', lines: ['Offline cache, theme, drafts', 'Push subscription'], tone: 'blue' },
      { id: 'vercel', type: 'box', x: 470, y: 300, w: 240, title: 'Vercel CDN', sub: 'static hosting', lines: ['Serves index.html + assets', 'Rewrites /api/* → Render'], tone: 'violet' },
      { id: 'http', type: 'box', x: 800, y: 90, w: 300, title: 'HTTP router', sub: '/api/* handlers', lines: ['222 endpoints (see API Reference)', 'Security headers, CORS'], tone: 'amber' },
      { id: 'mw', type: 'box', x: 800, y: 330, w: 300, title: 'Middleware', sub: 'auth.mjs · roleGuards · rateLimiter', lines: ['JWT cookie → user', 'Role and feature access checks'], tone: 'amber' },
      { id: 'wss', type: 'box', x: 800, y: 560, w: 300, title: 'WebSocket server', sub: 'wsServer.mjs', lines: ['Chat, presence, live counters', 'Gaming realtime bus'], tone: 'amber' },
      { id: 'svc', type: 'box', x: 1180, y: 90, w: 300, title: 'Domain services', sub: 'gaming/, academicEngine, payment …', lines: ['Business rules per feature'], tone: 'amber' },
      { id: 'dal', type: 'box', x: 1180, y: 330, w: 300, title: 'Data access', sub: 'db.mjs · prisma.js · *DB.mjs', lines: ['Prisma client + SQL helpers', 'JSON fallback stores'], tone: 'amber' },
      { id: 'jobs', type: 'box', x: 1180, y: 560, w: 300, title: 'Schedulers', sub: 'telegramScheduler · webPushSchedulerJob · gamingJobs', lines: ['Class reminders, room expiry'], tone: 'amber' },
      { id: 'pg', type: 'db', x: 1300, y: 860, w: 280, h: 150, title: 'PostgreSQL', sub: 'Render Postgres', tone: 'violet', desc: '37 tables. See the ER Diagram.' },
      { id: 'tg', type: 'box', x: 2120, y: 80, w: 320, title: 'Telegram Bot API', lines: ['Webhook in, messages out'], tone: 'cyan' },
      { id: 'google', type: 'box', x: 2120, y: 250, w: 320, title: 'Google OAuth / YouTube', tone: 'cyan' },
      { id: 'gemini', type: 'box', x: 2120, y: 400, w: 320, title: 'Gemini API', tone: 'cyan' },
      { id: 'pay', type: 'box', x: 2120, y: 550, w: 320, title: 'Payment gateway', tone: 'cyan' },
      { id: 'push', type: 'box', x: 2120, y: 700, w: 320, title: 'Web Push service', tone: 'cyan' },
      { id: 'smtp', type: 'box', x: 2120, y: 850, w: 320, title: 'SMTP (Nodemailer)', tone: 'cyan' },
    ],
    edges: [
      { from: 'user', to: 'spa', label: 'uses', tone: 'u' },
      { from: 'spa', to: 'vercel', label: 'HTTPS GET pages', tone: 'u' },
      { from: 'vercel', to: 'http', label: 'rewrite /api/*', tone: 'u', detail: 'vercel.json forwards /api and /socket.io to austwise.onrender.com' },
      { from: 'spa', to: 'wss', label: 'WebSocket (wss)', tone: 'd', detail: 'Ticket from /api/ws-ticket, then live chat, presence and gaming events' },
      { from: 'spa', to: 'sw', label: 'cache · drafts', tone: 'd' },
      { from: 'http', to: 'mw', label: 'every request', tone: 'g' },
      { from: 'mw', to: 'svc', label: 'authorised call' },
      { from: 'svc', to: 'dal', label: 'read / write' },
      { from: 'wss', to: 'dal', label: 'persist messages' },
      { from: 'jobs', to: 'dal', label: 'due items' },
      { from: 'dal', to: 'pg', label: 'Prisma / SQL', tone: 'd' },
      { from: 'svc', to: 'tg', label: 'send notice', tone: 'd' },
      { from: 'tg', to: 'http', label: 'webhook', tone: 'd', detail: '/api/telegram/webhook' },
      { from: 'mw', to: 'google', label: 'OAuth', tone: 'u' },
      { from: 'svc', to: 'gemini', label: 'AI chat / extract', tone: 'd' },
      { from: 'svc', to: 'pay', label: 'create / verify', tone: 'd' },
      { from: 'pay', to: 'http', label: 'webhook', tone: 'd', detail: '/api/payment/webhook' },
      { from: 'jobs', to: 'push', label: 'reminders', tone: 'd' },
      { from: 'jobs', to: 'tg', label: 'class reminders', tone: 'd' },
      { from: 'svc', to: 'smtp', label: 'invite / reset email', tone: 'd' },
    ],
    legend: [['u', 'Request / user action'], ['d', 'Data or realtime traffic'], ['g', 'Internal call'], ['db', 'Database']],
    about: 'One Node process serves the SPA, the REST API and the WebSocket. In production the SPA is also on Vercel, which forwards API calls to Render.',
  });

  /* ── DFD level 0 (context) ── */
  const E = (id, x, y, title, desc) => ({ id, type: 'box', x, y, w: 230, title, stereo: 'external entity', tone: 'cyan', desc });
  DOCS.add('dfd0', {
    title: 'DFD Level 0 — Context Diagram', sub: 'AUSTWise as one process and everything that sends it data or gets data back',
    nodes: [
      { id: 'sys', type: 'usecase', x: 700, y: 430, w: 380, h: 200, title: '0. AUSTWise Campus Platform', tone: 'amber', desc: 'The whole system seen as one process.' },
      E('stu', 120, 80, 'Student / Alumni / Faculty'), E('cr', 120, 470, 'CR / SR'), E('adm', 120, 860, 'Admin / Moderator'),
      E('tg', 1500, 80, 'Telegram'), E('goog', 1500, 330, 'Google'), E('ai', 1500, 580, 'Gemini AI'), E('pay', 1500, 830, 'Payment gateway'),
    ],
    edges: [
      { from: 'stu', to: 'sys', label: 'sign-in, grades, posts, messages, uploads', tone: 'd' },
      { from: 'sys', to: 'stu', label: 'dashboard, routine, notices, chats, results', tone: 'u', fromSide: 'l', toSide: 'r' },
      { from: 'cr', to: 'sys', label: 'section routine, notices, drive links', tone: 'd' },
      { from: 'sys', to: 'cr', label: 'application status, section stats', tone: 'u', fromSide: 'l', toSide: 'r' },
      { from: 'adm', to: 'sys', label: 'users, roles, menus, rooms, papers', tone: 'd' },
      { from: 'sys', to: 'adm', label: 'usage, reports, applications', tone: 'u', fromSide: 'l', toSide: 'r' },
      { from: 'sys', to: 'tg', label: 'notices, reminders', tone: 'u' },
      { from: 'tg', to: 'sys', label: 'bot commands, attendance', tone: 'd', fromSide: 'l', toSide: 'r' },
      { from: 'goog', to: 'sys', label: 'OAuth profile', tone: 'd', fromSide: 'l' },
      { from: 'sys', to: 'ai', label: 'prompts, routine images', tone: 'u' },
      { from: 'ai', to: 'sys', label: 'answers, parsed routine', tone: 'd', fromSide: 'l', toSide: 'r' },
      { from: 'sys', to: 'pay', label: 'payment request', tone: 'u' },
      { from: 'pay', to: 'sys', label: 'payment result', tone: 'd', fromSide: 'l', toSide: 'r' },
    ],
    legend: [['uc', 'Process'], ['ext', 'External entity'], ['d', 'Data into the system'], ['u', 'Data out of the system']],
  });

  /* ── DFD level 1 ── */
  const P = (id, x, y, title, desc) => ({ id, type: 'usecase', x, y, w: 250, h: 110, title, tone: 'amber', desc });
  const S = (id, x, y, title, tables) => ({ id, type: 'box', x, y, w: 250, title, stereo: 'data store', lines: [tables], tone: 'violet' });
  DOCS.add('dfd1', {
    title: 'DFD Level 1', sub: 'Main processes, the data stores (tables) they use, and the external entities',
    nodes: [
      E('user', 0, 560, 'User'), E('admin', 0, 1100, 'Admin'), E('tg', 2050, 300, 'Telegram'), E('goog', 2050, 40, 'Google'), E('pay', 2050, 1100, 'Payment gateway'),
      P('p1', 420, 40, '1.0 Authenticate & manage account'), P('p2', 420, 300, '2.0 Manage routine & attendance'), P('p3', 420, 560, '3.0 Track grades'),
      P('p4', 420, 820, '4.0 Share resources & papers'), P('p5', 420, 1080, '5.0 Message & community'), P('p6', 1100, 1080, '6.0 Campus info (canteen, library, map)'),
      P('p7', 1100, 300, '7.0 Notify (notices, Telegram, push)'), P('p8', 1100, 820, '8.0 Administer roles & content'), P('p9', 1100, 1340, '9.0 Upgrade plan'), P('p10', 420, 1340, '10.0 Gaming rooms & events'),
      S('d1', 800, 0, 'D1 Users', 'User, StudentDetails, Invitation, RoleApplication'), S('d2', 800, 220, 'D2 Routines', 'Routine, SharedRoutine, RoutineTemplate, TelegramAttendance'),
      S('d3', 800, 520, 'D3 Results', 'SemesterResult, Course, TranscriptTemplate'), S('d4', 800, 760, 'D4 Resources', 'QuestionPaper, Cheatsheet, vault notes'),
      S('d5', 800, 1000, 'D5 Social', 'Message, Notice, Club, MarketplaceListing, MentorRequest'), S('d6', 1500, 1060, 'D6 Campus', 'CanteenMenuItem, LibraryCheckin, CampusLocation'),
      S('d7', 800, 1500, 'D7 Gaming', 'Game, GameRoom, GameEvent, TournamentMatch'), S('d8', 1500, 560, 'D8 Settings store', 'UserStore, SharedStore'),
    ],
    edges: [
      { from: 'user', to: 'p1', label: 'credentials', tone: 'd' }, { from: 'goog', to: 'p1', label: 'OAuth profile', tone: 'd' }, { from: 'p1', to: 'd1', label: 'user record', tone: 'd' },
      { from: 'user', to: 'p2', label: 'section, classes', tone: 'd' }, { from: 'p2', to: 'd2', label: 'routine', tone: 'd' }, { from: 'd2', to: 'p7', label: 'today’s classes', tone: 'd' },
      { from: 'user', to: 'p3', label: 'grades', tone: 'd' }, { from: 'p3', to: 'd3', label: 'results', tone: 'd' }, { from: 'd3', to: 'user', label: 'CGPA, trends', tone: 'u', toSide: 'r' },
      { from: 'user', to: 'p4', label: 'uploads', tone: 'd' }, { from: 'p4', to: 'd4', label: 'papers, notes', tone: 'd' },
      { from: 'user', to: 'p5', label: 'messages, posts', tone: 'd' }, { from: 'p5', to: 'd5', label: 'messages', tone: 'd' },
      { from: 'admin', to: 'p6', label: 'menu, seats, map', tone: 'd' }, { from: 'p6', to: 'd6', label: 'campus data', tone: 'd' },
      { from: 'd5', to: 'p7', label: 'new notices', tone: 'd' }, { from: 'p7', to: 'tg', label: 'messages', tone: 'u' }, { from: 'tg', to: 'p2', label: 'attendance replies', tone: 'd' },
      { from: 'admin', to: 'p8', label: 'roles, approvals', tone: 'd' }, { from: 'p8', to: 'd1', label: 'roles', tone: 'd' }, { from: 'p8', to: 'd8', label: 'feature flags', tone: 'd' },
      { from: 'user', to: 'p9', label: 'plan choice', tone: 'd' }, { from: 'p9', to: 'pay', label: 'payment', tone: 'u' }, { from: 'pay', to: 'p9', label: 'result', tone: 'd' }, { from: 'p9', to: 'd1', label: 'Pro flag', tone: 'd' },
      { from: 'user', to: 'p10', label: 'rooms, chat', tone: 'd' }, { from: 'p10', to: 'd7', label: 'rooms, matches', tone: 'd' },
      { from: 'user', to: 'd8', label: 'settings, theme', tone: 'd' },
    ],
    legend: [['uc', 'Process'], ['violet', 'Data store (tables)'], ['ext', 'External entity'], ['d', 'Data flow']],
  });
})();
