/* Reference diagrams built from live project data: Sitemap (canvas-data.js), API (server routes), Roles (roleAccess.json). */
(function () {
  /* ── Sitemap: root → one card per sidebar section, each card lists its tabs/pages ── */
  {
    const cols = window.FLOW.COLUMNS; const W = 440, GX = 70; const nodes = [], edges = [];
    const total = cols.reduce((a, c) => a + c[2].length, 0);
    const rootX = (cols.length * (W + GX)) / 2 - 160;
    nodes.push({ id: 'root', type: 'box', x: rootX, y: 0, w: 320, title: 'AUSTWise', sub: `${cols.length} sections · ${total} pages & tabs`, tone: 'amber', desc: 'Root of the site. Visitors start at Public & Auth; signed-in users land on the Dashboard.' });
    cols.forEach(([name, sub, rows], i) => {
      const id = 'sec' + i;
      nodes.push({ id, type: 'entity', x: i * (W + GX), y: 260, w: W, title: name, sub, keyW: 24, rows: rows.map(([, path, title, , real], j) => [String(j + 1), title, real ? real.split(',')[0] : path]), desc: `${rows.length} pages/tabs. Row order = glider tab order.` });
      edges.push({ from: 'root', to: id, head: 'arrow', toSide: 't', fromSide: 'b', label: '', detail: `${name}: ${sub}` });
    });
    DOCS.add('sitemap', { title: 'Sitemap', sub: `${cols.length} sections · ${total} pages and glider tabs · same source as the Flow Canvas`, nodes, edges,
      about: 'Each card is a sidebar section in sidebar order. Rows are its glider tabs in tab order, then its sub-pages. The right column shows the real route.' });
  }

  /* ── API reference: one card per /api area ── */
  {
    const groups = Object.entries(window.API_ROUTES || {}); const COLS = 4, W = 720, GX = 60, GY = 60; const colH = Array(COLS).fill(0); const nodes = [];
    const NAMES = { auth: 'Authentication', admin: 'Admin', store: 'Key-value store', telegram: 'Telegram bot', gaming: 'Gaming', messages: 'ConnectBox messages', 'role-applications': 'CR/SR applications', 'batch-drive': 'Batch Drive locks', library: 'Library', presence: 'Presence & members', payment: 'Payments', passwords: 'Password Manager', 'web-push': 'Web Push' };
    const sorted = groups.sort((a, b) => b[1].length - a[1].length);
    for (const [g, rows] of sorted) {
      const c = colH.indexOf(Math.min(...colH)); const h = 40 + rows.length * 22 + 14;
      nodes.push({ id: g, type: 'entity', x: c * (W + GX), y: colH[c], w: W, keyW: 52, title: NAMES[g] || g.replace(/-/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase()), sub: `/api/${g} · ${rows.length}`, rows: rows.map(([m, p, d]) => [m, p.replace('/api/' + g, '') || '/', d]), tone: 'blue', desc: `${rows.length} endpoints under /api/${g}` });
      colH[c] += h + GY;
    }
    const n = groups.reduce((a, g) => a + g[1].length, 0);
    DOCS.add('api', { title: 'API Reference', sub: `${n} endpoints in ${groups.length} areas · scanned from server/*.mjs by tools/build-api.mjs`, nodes, edges: [],
      legend: [['GET', 'Read'], ['POST', 'Create / action'], ['PUT', 'Replace / update'], ['DELETE', 'Delete']],
      about: 'Paths are relative to the card’s base (shown top-right). All endpoints need a signed-in session cookie except auth, invite validate, payment webhook and public stats.' });
  }

  /* ── Roles & permissions ── */
  {
    const ROLES = [['guest', 'Guest', 'Not signed in. Public pages only.'], ['student', 'Student', 'Default role after sign-up.'], ['cr', 'CR', 'Class Representative: routine, notices and drive links for a section.'], ['sr', 'SR', 'Student Representative: same rights as CR for a lab section.'], ['alumni', 'Alumni', 'Graduated. Community, mentoring, marketplace.'], ['faculty', 'Faculty', 'Teachers. Student-only dashboard widgets are hidden.'], ['moderator', 'Moderator', 'Moderates content and gaming, sees usage stats.'], ['admin', 'Admin', 'Full Admin Panel access.']];
    const nodes = [], edges = [];
    ROLES.forEach(([id, t, d], i) => nodes.push({ id: 'r-' + id, type: 'actor', x: 40 + i * 190, y: 40, title: t, desc: d, tone: i >= 6 ? 'rose' : i >= 2 && i <= 3 ? 'blue' : 'amber' }));
    nodes.push({ id: 'r-pro', type: 'box', x: 40 + 8 * 190, y: 50, w: 220, title: 'Pro plan', stereo: 'add-on', lines: ['Any signed-in role can upgrade.', 'Unlocks Question Bank Analyzer, all themes, more storage.'], tone: 'green' });
    [['student', 'guest', 'signs up'], ['cr', 'student', 'approved application'], ['sr', 'student', 'approved application'], ['alumni', 'student', 'graduates'], ['moderator', 'student', 'promoted by admin'], ['admin', 'moderator', 'promoted by admin']].forEach(([a, b, l]) => edges.push({ from: 'r-' + a, to: 'r-' + b, head: 'triangle', label: l, detail: `${a} inherits everything ${b} can do` }));
    const rows = (window.ROLE_ACCESS || []);
    const cols = ['student', 'cr', 'sr', 'alumni', 'faculty', 'moderator', 'admin'];
    const mark = (hidden, r) => (hidden.includes(r) ? ' ✗ ' : ' ✓ ');
    const half = Math.ceil(rows.length / 2);
    [rows.slice(0, half), rows.slice(half)].forEach((part, k) => nodes.push({ id: 'matrix' + k, type: 'entity', x: 40 + k * 900, y: 330, w: 860, keyW: 34, title: `Feature access ${k + 1}/2`, sub: 'stu  cr  sr  alu  fac  mod  adm',
      rows: part.map(([key, on, hidden]) => [on ? 'ON' : 'OFF', key.replace(/^feature:/, ''), cols.map((r) => mark(hidden, r)).join('')]), desc: 'From server/roleAccess.json. ✗ = hidden for that role. OFF = turned off site-wide.' }));
    DOCS.add('roles', { title: 'Roles & Permissions', sub: `${ROLES.length} roles · ${rows.length} access keys · from server/roleAccess.json`, nodes, edges,
      legend: [['tri', 'Inherits from (generalisation)'], ['ON', 'Feature enabled'], ['OFF', 'Feature disabled site-wide'], ['✓', 'Visible to role'], ['✗', 'Hidden for role']],
      about: 'Admins change this in Admin Panel → Roles / Features. Access requests from users land in Admin Panel → Access Requests.' });
  }
})();
