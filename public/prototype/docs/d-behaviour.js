/* UML behaviour diagrams: Use Case, Sequence, Activity, State. */
(function () {
  /* ── Use case ── */
  const A = (id, x, y, title, tone, desc) => ({ id, type: 'actor', x, y, title, tone, desc });
  const U = (id, x, y, title) => ({ id, type: 'usecase', x, y, w: 270, title });
  const cols = [[540, 'Account', ['Sign up / sign in', 'Sign in with Google', 'Reset password', 'Accept invite', 'Edit profile & theme', 'Upgrade to Pro']],
    [880, 'Academics', ['View dashboard', 'Manage routine', 'Track attendance', 'Calculate CGPA', 'Browse Resource Vault', 'Analyze question papers']],
    [1220, 'Social & campus', ['Chat in ConnectBox', 'Browse community', 'Request a mentor', 'Post on marketplace', 'Write anonymous review', 'Check canteen / library / map']],
    [1560, 'Fun & tools', ['Join game room', 'Register for tournament', 'Use study timer', 'Make cover page', 'Track expenses', 'Store passwords']],
    [1900, 'Representative & admin', ['Share section routine', 'Post notice', 'Set drive links', 'Review applications', 'Manage roles & features', 'Moderate content']]];
  const ucNodes = []; const ucId = {};
  cols.forEach(([x, , list], c) => list.forEach((t, i) => { const id = `uc${c}_${i}`; ucId[t] = id; ucNodes.push(U(id, x, 120 + i * 140, t)); }));
  const link = (actor, list, extra = {}) => list.map((t) => ({ from: actor, to: ucId[t], head: 'none', ...extra }));
  DOCS.add('usecase', {
    title: 'UML Use Case Diagram', sub: 'Actors (left/right) and what each can do in AUSTWise (inside the system boundary)',
    groups: [{ title: 'AUSTWise', x: 500, y: -20, w: 1710, h: 1030, tone: 'amber', solid: true }],
    nodes: [
      A('guest', 100, 60, 'Guest', 'grey', 'Not signed in.'), A('student', 100, 330, 'Student', 'amber'), A('alumni', 100, 600, 'Alumni', 'amber'), A('faculty', 100, 850, 'Faculty', 'amber'),
      A('rep', 2400, 120, 'CR / SR', 'blue'), A('admin', 2400, 460, 'Admin / Mod', 'rose'), A('tg', 2400, 780, 'Telegram bot', 'cyan', 'Secondary actor: sends reminders and receives attendance.'),
      ...ucNodes, ...cols.map(([x, t], c) => ({ id: 'h' + c, type: 'text', x, y: 50, title: t })),
    ],
    edges: [
      ...link('guest', ['Sign up / sign in', 'Sign in with Google', 'Reset password', 'Accept invite']),
      ...link('student', ['Edit profile & theme', 'Upgrade to Pro', 'View dashboard', 'Manage routine', 'Track attendance', 'Calculate CGPA', 'Browse Resource Vault', 'Analyze question papers', 'Chat in ConnectBox', 'Browse community', 'Request a mentor', 'Post on marketplace', 'Write anonymous review', 'Check canteen / library / map', 'Join game room', 'Register for tournament', 'Use study timer', 'Make cover page', 'Track expenses', 'Store passwords']),
      ...link('alumni', ['Chat in ConnectBox', 'Browse community', 'Request a mentor', 'Post on marketplace']),
      ...link('faculty', ['Chat in ConnectBox', 'Browse community', 'Check canteen / library / map']),
      ...link('rep', ['Share section routine', 'Post notice', 'Set drive links']),
      ...link('admin', ['Review applications', 'Manage roles & features', 'Moderate content', 'Post notice']),
      ...link('tg', ['Track attendance', 'Post notice']),
      { from: ucId['Sign in with Google'], to: ucId['Sign up / sign in'], head: 'open', dash: true, label: '«extend»', tone: 'violet' },
      { from: ucId['Analyze question papers'], to: ucId['Upgrade to Pro'], head: 'open', dash: true, label: '«include» Pro check', tone: 'violet' },
      { from: ucId['Share section routine'], to: ucId['Manage routine'], head: 'open', dash: true, label: '«extend»', tone: 'violet' },
    ],
    legend: [['actor', 'Actor'], ['uc', 'Use case'], ['g', 'Association'], ['dash', '«include» / «extend»']],
    about: 'Student also does everything Guest can after signing in. CR/SR are students with extra cases; Admin and Moderator can do everything.',
  });

  /* ── Sequence diagrams ── */
  DOCS.add('sequence', {
    title: 'UML Sequence Diagrams', sub: 'Four key interactions: Google sign-in, sending a chat message, upgrading to Pro, posting a notice',
    seqs: [
      { id: 's1', title: '1 · Sign in with Google', x: 0, y: 0, actors: [['u', 'User', 'actor'], ['spa', 'React SPA'], ['srv', 'Node server'], ['g', 'Google OAuth', 'ext'], ['db', 'PostgreSQL', 'db']],
        msgs: [['u', 'spa', 'Click “Continue with Google”'], ['spa', 'srv', 'GET /api/auth/google'], ['srv', 'g', 'redirect to consent'], ['g', 'u', 'consent screen', 'reply'], ['u', 'g', 'Allow'], ['g', 'srv', 'callback ?code=…'], ['srv', 'g', 'exchange code → profile'], ['srv', 'db', 'find or create User'], ['db', 'srv', 'user row', 'reply'], ['srv', 'srv', 'sign JWT, set cookie', 'self'], ['srv', 'spa', '302 → /dashboard', 'reply'], ['spa', 'srv', 'GET /api/auth/me'], ['srv', 'spa', 'user + role', 'reply'], ['spa', 'u', 'Dashboard', 'reply']] },
      { id: 's2', title: '2 · Send a ConnectBox message', x: 1400, y: 0, actors: [['a', 'Sender', 'actor'], ['spa', 'React SPA'], ['ws', 'WebSocket server'], ['db', 'PostgreSQL', 'db'], ['b', 'Receiver', 'actor']],
        msgs: [['spa', 'ws', 'GET /api/ws-ticket → connect'], ['a', 'spa', 'type + Send'], ['spa', 'ws', 'POST /api/messages {to, text}'], ['ws', 'db', 'INSERT Message'], ['db', 'ws', 'message id', 'reply'], ['ws', 'b', 'push “message” event', 'async'], ['ws', 'spa', 'ack (sent ✓)', 'reply'], ['b', 'ws', 'mark read'], ['ws', 'db', 'UPDATE read = true'], ['ws', 'spa', '“read” event (✓✓)', 'async']] },
      { id: 's3', title: '3 · Upgrade to Pro', x: 0, y: 1000, actors: [['u', 'User', 'actor'], ['spa', 'See Plans page'], ['srv', 'Node server'], ['pay', 'Payment gateway', 'ext'], ['db', 'PostgreSQL', 'db']],
        msgs: [['u', 'spa', 'Choose Pro → Continue'], ['spa', 'srv', 'POST /api/payment/create'], ['srv', 'pay', 'create session'], ['pay', 'srv', 'checkout URL', 'reply'], ['srv', 'spa', 'redirect URL', 'reply'], ['u', 'pay', 'pay'], ['pay', 'srv', 'POST /api/payment/webhook', 'async'], ['srv', 'pay', 'verify transaction'], ['srv', 'db', 'set plan = Pro'], ['pay', 'spa', 'redirect /payment/success', 'reply'], ['spa', 'srv', 'POST /api/payment/verify'], ['srv', 'spa', 'Pro active', 'reply']] },
      { id: 's4', title: '4 · Post a notice (CR / Admin)', x: 1400, y: 1000, actors: [['cr', 'CR / Admin', 'actor'], ['spa', 'Notice Board'], ['srv', 'Node server'], ['db', 'PostgreSQL', 'db'], ['tg', 'Telegram', 'ext']],
        msgs: [['cr', 'spa', 'Post notice'], ['spa', 'srv', 'POST /api/notices'], ['srv', 'srv', 'role guard: CR/SR/Admin?', 'self'], ['srv', 'db', 'INSERT Notice'], ['srv', 'tg', 'send to section chats', 'async'], ['srv', 'spa', '201 Created', 'reply'], ['spa', 'cr', 'notice appears on dashboards', 'reply']] },
    ],
    nodes: [], edges: [],
    legend: [['u', 'Synchronous call'], ['dash', 'Reply'], ['d', 'Asynchronous message / event']],
  });

  /* ── Activity diagrams ── */
  const Act = (id, x, y, title, w = 280) => ({ id, type: 'state', x, y, w, title, tone: 'blue' });
  const D = (id, x, y, title) => ({ id, type: 'decision', x, y, title, tone: 'amber' });
  DOCS.add('activity', {
    title: 'UML Activity Diagrams', sub: 'Sign-up & onboarding · Upload and analyze a question paper',
    groups: [{ title: 'A · Sign-up & onboarding', x: 0, y: 0, w: 980, h: 1600, tone: 'blue' }, { title: 'B · Upload & analyze question paper', x: 1100, y: 0, w: 980, h: 1600, tone: 'amber' }],
    nodes: [
      { id: 'a0', type: 'start', x: 332, y: 90 }, Act('a1', 210, 170, 'Open landing page'), D('a2', 250, 280, 'Has account?'),
      Act('a3', 600, 300, 'Sign up (email / Google)'), Act('a4', 210, 450, 'Sign in'), D('a5', 250, 560, 'Valid?'), Act('a6', 600, 580, 'Show error / reset password'),
      Act('a7', 210, 730, 'Complete profile (dept, batch, section)'), Act('a8', 210, 850, 'Pick routine template'), D('a9', 250, 960, 'Is CR/SR?'),
      Act('a10', 600, 980, 'Apply for role → admin review'), Act('a11', 210, 1130, 'Dashboard ready'), { id: 'a12', type: 'end', x: 332, y: 1260 },
      { id: 'b0', type: 'start', x: 1432, y: 90 }, Act('b1', 1310, 170, 'Open Resource Vault'), Act('b2', 1310, 280, 'Upload paper (course, year, type)'),
      D('b3', 1350, 390, 'File valid?'), Act('b4', 1700, 410, 'Show size / type error'), Act('b5', 1310, 560, 'Save QuestionPaper'),
      Act('b6', 1310, 670, 'Open Question Bank Analyzer'), D('b7', 1350, 780, 'Pro user?'), Act('b8', 1700, 800, 'See Plans → upgrade'),
      Act('b9', 1310, 950, 'Extract topics from papers'), Act('b10', 1310, 1060, 'Rank repeated topics'), Act('b11', 1310, 1170, 'Show heatmap + study list'), { id: 'b12', type: 'end', x: 1432, y: 1290 },
    ],
    edges: [
      { from: 'a0', to: 'a1' }, { from: 'a1', to: 'a2' }, { from: 'a2', to: 'a3', label: 'no' }, { from: 'a2', to: 'a4', label: 'yes' }, { from: 'a3', to: 'a7', toSide: 'r' },
      { from: 'a4', to: 'a5' }, { from: 'a5', to: 'a6', label: 'no' }, { from: 'a6', to: 'a4', toSide: 'r', fromSide: 't' }, { from: 'a5', to: 'a7', label: 'yes' },
      { from: 'a7', to: 'a8' }, { from: 'a8', to: 'a9' }, { from: 'a9', to: 'a10', label: 'yes' }, { from: 'a9', to: 'a11', label: 'no' }, { from: 'a10', to: 'a11', toSide: 'r' }, { from: 'a11', to: 'a12' },
      { from: 'b0', to: 'b1' }, { from: 'b1', to: 'b2' }, { from: 'b2', to: 'b3' }, { from: 'b3', to: 'b4', label: 'no' }, { from: 'b4', to: 'b2', fromSide: 't', toSide: 'r' }, { from: 'b3', to: 'b5', label: 'yes' },
      { from: 'b5', to: 'b6' }, { from: 'b6', to: 'b7' }, { from: 'b7', to: 'b8', label: 'no' }, { from: 'b8', to: 'b7', fromSide: 't', toSide: 'r' }, { from: 'b7', to: 'b9', label: 'yes' }, { from: 'b9', to: 'b10' }, { from: 'b10', to: 'b11' }, { from: 'b11', to: 'b12' },
    ],
    legend: [['●', 'Start'], ['◉', 'End'], ['◇', 'Decision']],
  });

  /* ── State machines ── */
  const St = (id, x, y, title, tone = 'blue') => ({ id, type: 'state', x, y, w: 200, title, tone });
  const machine = (p, x, y, states, trans) => ({ nodes: [{ id: p + 'start', type: 'start', x, y: y + 12 }, ...states.map(([id, t, dx, dy, tone]) => St(p + id, x + dx, y + dy, t, tone))], edges: trans.map(([a, b, l, extra]) => ({ from: p + a, to: p + b, label: l, ...(extra || {}) })) });
  const m1 = machine('ra', 60, 120, [['pending', 'Pending', 120, 0, 'amber'], ['approved', 'Approved', 440, -80, 'green'], ['rejected', 'Rejected', 440, 80, 'rose'], ['withdrawn', 'Withdrawn', 120, 160, 'grey'], ['resigned', 'Resigned', 760, -80, 'grey']],
    [['start', 'pending', 'apply'], ['pending', 'approved', 'admin approves'], ['pending', 'rejected', 'admin rejects'], ['pending', 'withdrawn', 'user withdraws'], ['approved', 'resigned', 'user resigns']]);
  const m2 = machine('iv', 60, 560, [['pending', 'Pending', 120, 0, 'amber'], ['accepted', 'Accepted', 440, -80, 'green'], ['expired', 'Expired', 440, 80, 'grey']],
    [['start', 'pending', 'admin sends invite'], ['pending', 'accepted', 'open link + set password'], ['pending', 'expired', 'expiresAt passes']]);
  const m3 = machine('gr', 1200, 120, [['open', 'Open', 120, 0, 'green'], ['full', 'Full', 440, -80, 'amber'], ['playing', 'In game', 440, 80, 'blue'], ['closed', 'Closed', 760, 0, 'grey']],
    [['start', 'open', 'create room'], ['open', 'full', 'capacity reached'], ['full', 'open', 'member leaves', { fromSide: 'b', toSide: 't' }], ['open', 'playing', 'ready check ok'], ['playing', 'open', 'match ends', { fromSide: 'l', toSide: 'b' }], ['open', 'closed', 'owner closes / expires'], ['full', 'closed', 'owner closes']]);
  const m4 = machine('tm', 1200, 560, [['sched', 'Scheduled', 120, 0, 'amber'], ['reported', 'Reported', 440, 0, 'blue'], ['confirmed', 'Confirmed', 760, -80, 'green'], ['disputed', 'Disputed', 760, 80, 'rose'], ['resolved', 'Resolved', 1080, 80, 'green']],
    [['start', 'sched', 'bracket generated'], ['sched', 'reported', 'player reports score'], ['reported', 'confirmed', 'opponent confirms'], ['reported', 'disputed', 'opponent disputes'], ['disputed', 'resolved', 'moderator resolves']]);
  const m5 = machine('pm', 60, 960, [['free', 'Free plan', 120, 0, 'grey'], ['checkout', 'Checkout', 440, 0, 'amber'], ['pro', 'Pro', 760, -80, 'green'], ['cancel', 'Cancelled', 760, 80, 'rose']],
    [['start', 'free', 'sign up'], ['free', 'checkout', 'choose Pro'], ['checkout', 'pro', 'payment verified'], ['checkout', 'cancel', 'user cancels'], ['cancel', 'free', 'back to plans', { fromSide: 'b', toSide: 'b' }]]);
  const all = [m1, m2, m3, m4, m5];
  DOCS.add('state', {
    title: 'UML State Machine Diagrams', sub: 'Lifecycles stored in the status columns of RoleApplication, Invitation, GameRoom, TournamentMatch and the user plan',
    groups: [{ title: 'RoleApplication.status', x: 20, y: 0, w: 1060, h: 380 }, { title: 'Invitation.status', x: 20, y: 440, w: 1060, h: 360 }, { title: 'GameRoom.status', x: 1160, y: 0, w: 1060, h: 380 }, { title: 'TournamentMatch.status', x: 1160, y: 440, w: 1380, h: 360 }, { title: 'Plan', x: 20, y: 840, w: 1060, h: 380 }],
    nodes: all.flatMap((m) => m.nodes), edges: all.flatMap((m) => m.edges),
    legend: [['●', 'Initial state'], ['green', 'Success state'], ['rose', 'Failure state']],
  });
})();
