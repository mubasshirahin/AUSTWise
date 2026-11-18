/* AUSTWise Flow Canvas: infinite canvas with every screen, user-flow and data-flow arrows. */
const FW = 1440, FH = 900, COLW = 2700, ROWH = 1500, TOP = 500;

const SECTIONS = [
  ['Public', 'Visitors arrive here'], ['Main', 'Home after sign-in'], ['Daily Life', 'Everyday tools'], ['Academics', 'Grades & study material'],
  ['Campus & Chat', 'Rooms, people, messages'], ['Social & Fun', 'Market, forum, games'], ['Productivity', 'Focus & tools'], ['Account', 'Profile, plans, admin'],
];
// [id, path, title, col, row, what it does]
const FRAMES = [
  ['landing', '/welcome', 'Landing', 0, 0, 'First page a visitor sees. Explains AUSTWise and sends people to sign in.'],
  ['login', '/login', 'Login', 0, 1, 'Sign in with email/ID, Google, or as a guest.'],
  ['features', '/p/features', 'Features', 0, 2, 'List of every feature. Each card opens that feature.'],
  ['dash', '/dashboard/quickstats', 'Dashboard', 1, 0, 'Home screen. Pulls together CGPA, attendance, deadlines, today’s classes and notices.'],
  ['routine', '/dashboard/routine', 'Routine', 1, 1, 'Weekly class timetable. Source for today’s classes, attendance, alarms and free rooms.'],
  ['notices', '/dashboard/notices', 'Notice Board', 1, 2, 'Section notices. Swipe to edit/delete. Feeds the Dashboard and the bell.'],
  ['attendance', '/dashboard/attendance', 'Attendance', 1, 3, 'Per-course attendance, built from the routine’s course list.'],
  ['templates', '/routine-templates', 'Routine Templates', 1, 4, 'Pick your section; it fills your routine.'],
  ['tgk', '/daily-life/money-tracker', 'TakaGeloKoi', 2, 0, 'Expense calendar and monthly budget.'],
  ['cover', '/daily-life/cover-page-generator', 'Cover Page', 2, 1, 'Makes assignment cover pages using your profile and courses.'],
  ['planner', '/daily-life/life-planner', 'Life Planner', 2, 2, 'Goals, habits and course heatmap.'],
  ['pw', '/daily-life/password-manager', 'Password Manager', 2, 3, 'Encrypted password vault on your device.'],
  ['grade', '/gradelab/cgpagraph', 'GradeLab', 3, 0, 'CGPA calculator. Change a grade and the GPA updates.'],
  ['semester', '/gradelab/semestertracker', 'Semester Wise', 3, 1, 'GPA for each past semester.'],
  ['vault', '/resource-vault/materials', 'Resource Vault', 3, 2, 'Slides, notes and previous papers shared by students.'],
  ['notebook', '/resource-vault/notebook', 'Notebook', 3, 3, 'Your own course notes.'],
  ['qbank', '/question-bank', 'Question Bank', 3, 4, 'Analyzes previous papers to find repeated topics.'],
  ['map', '/insideaust/map', 'Floor Map', 4, 0, 'Live room status per floor.'],
  ['rooms', '/insideaust/classroom', 'Free Rooms', 4, 1, 'Finds empty rooms for a day and time.'],
  ['chat', '/connectbox', 'ConnectBox', 4, 2, 'Direct messages and groups.'],
  ['people', '/community/students', 'Community', 4, 3, 'Student, faculty and alumni directories, clubs.'],
  ['profile', '/members/m1', 'Member Profile', 4, 4, 'A member’s public profile and activity.'],
  ['market', '/marketplace', 'Marketplace', 5, 0, 'Buy/sell kits, to-let and lost & found.'],
  ['forum', '/austeddit', 'Austeddit', 5, 1, 'Forum with communities, votes and comments.'],
  ['shadow', '/shadow/reviews', 'Shadow', 5, 2, 'Anonymous course reviews and chat.'],
  ['downtime', '/downtime/organizing', 'DownTime', 5, 3, 'Pinboard, media, rumours, trivia and games.'],
  ['room', '/gaming/room/ludo-king', 'Game Room', 5, 4, 'A live game room with players and chat.'],
  ['study', '/productivity/study-room', 'Study Time', 6, 0, 'Focus timer and shared study room.'],
  ['cp', '/productivity/cp-hub', 'Code Pulse', 6, 1, 'Contests, ratings and leaderboard.'],
  ['alarm', '/wakemeup', 'WakeMeUp', 6, 2, 'Alarms that follow your first class each day.'],
  ['cert', '/certificate', 'Certificate', 6, 3, 'Event certificates, one or in bulk.'],
  ['settings', '/settings/profile', 'Settings · Profile', 7, 0, 'Your name, photo, department, semester and privacy.'],
  ['theme', '/settings/appearance', 'Settings · Appearance', 7, 1, 'Theme picker. Changes the look of every page.'],
  ['plans', '/see-plans', 'See Plans', 7, 2, 'Free, Pro and Batch plans.'],
  ['paid', '/payment/success', 'Payment Success', 7, 3, 'Shown after upgrading.'],
  ['admin', '/admin-panel/users', 'Admin · Users', 7, 4, 'Admins manage users, notices and access.'],
];
// [from, to, kind u|d, label, detail]
const EDGES = [
  ['landing', 'login', 'u', 'Start for Free', 'Header button and "Jump Right In".'],
  ['landing', 'features', 'u', 'Explore Features', 'Scrolls to the feature list.'],
  ['features', 'dash', 'u', 'Open a feature', 'Each feature card opens its page.'],
  ['login', 'dash', 'u', 'Sign in', 'Any sign-in method lands on the Dashboard.'],
  ['dash', 'routine', 'u', 'Full routine', 'From "Today’s classes".'],
  ['dash', 'notices', 'u', 'See all notices', 'From the Notice Board card or the bell.'],
  ['dash', 'tgk', 'u', 'Sidebar · Daily Life', ''],
  ['dash', 'grade', 'u', 'Sidebar · GradeLab', ''],
  ['dash', 'chat', 'u', 'Sidebar · ConnectBox', ''],
  ['dash', 'study', 'u', 'Navbar timer ☕', 'Coffee icon next to the Pomodoro.'],
  ['dash', 'settings', 'u', 'User chip → Settings', ''],
  ['routine', 'templates', 'u', 'Templates', ''],
  ['people', 'profile', 'u', 'Open profile', 'Click a student card or avatar mini card.'],
  ['profile', 'chat', 'u', 'Message', 'Profile and mini card both open a chat.'],
  ['market', 'chat', 'u', 'Message seller', 'From the listing modal.'],
  ['downtime', 'room', 'u', 'Join game', 'Gaming Zone tab → a game card.'],
  ['shadow', 'forum', 'u', 'Buzz tab', ''],
  ['plans', 'paid', 'u', 'Upgrade → Continue', 'Prototype payment, no real money.'],
  ['qbank', 'plans', 'u', 'Pro feature', 'Question Bank is a Pro feature.'],
  ['templates', 'routine', 'd', 'Section routine', 'Chosen template fills your weekly routine.'],
  ['routine', 'dash', 'd', 'Today’s classes', 'Today’s row of the routine appears on the Dashboard.'],
  ['routine', 'attendance', 'd', 'Course list', 'Each course in the routine gets an attendance row.'],
  ['routine', 'alarm', 'd', 'First class time', 'WakeMeUp sets alarms before your first class.'],
  ['routine', 'rooms', 'd', 'Room bookings', 'Rooms used in routines are marked busy.'],
  ['rooms', 'map', 'd', 'Room status', 'Free / busy colours on the floor map.'],
  ['notices', 'dash', 'd', 'Latest 3 notices + bell', 'Newest notices show on the Dashboard and in notifications.'],
  ['admin', 'notices', 'd', 'Admin notices', 'Admins can post to every section.'],
  ['attendance', 'dash', 'd', 'Avg. attendance 86%', ''],
  ['grade', 'dash', 'd', 'CGPA 3.62 · credits', 'Quick Stats and the CGPA trend use GradeLab results.'],
  ['semester', 'grade', 'd', 'Past semester GPAs', 'Feed the projected CGPA and trend line.'],
  ['grade', 'profile', 'd', 'CGPA (if public)', 'Only if "Show CGPA on profile" is on.'],
  ['settings', 'profile', 'd', 'Name, photo, bio', 'Your profile card and avatar mini card.'],
  ['settings', 'dash', 'd', 'Name in greeting & chip', ''],
  ['settings', 'cover', 'd', 'Name, ID, semester', 'Pre-filled on every cover page.'],
  ['settings', 'cert', 'd', 'Recipient name', ''],
  ['theme', 'dash', 'd', 'Theme → every page', 'One setting changes all pages.'],
  ['chat', 'dash', 'd', 'Unread badge (3)', 'Sidebar ConnectBox badge.'],
  ['vault', 'qbank', 'd', 'Previous papers', 'Uploaded question papers are what the analyzer reads.'],
  ['vault', 'profile', 'd', 'Contributions', 'Uploads count on your profile.'],
  ['forum', 'profile', 'd', 'Posts & upvotes', 'Recent activity on the profile.'],
  ['cp', 'profile', 'd', 'CF rating & rank', ''],
  ['admin', 'people', 'd', 'User directory', 'Users and roles power the Community directory.'],
  ['paid', 'qbank', 'd', 'Pro unlocked', 'Upgrading unlocks Pro features.'],
  ['notebook', 'vault', 'd', 'Shared notes', 'Notes you publish appear in the Vault.'],
  ['tgk', 'planner', 'd', 'Monthly spend', 'Budget goal progress.'],
];
const JOURNEY = ['landing', 'login', 'dash', 'routine', 'attendance', 'grade', 'people', 'profile', 'chat', 'plans', 'paid'];

const $ = (id) => document.getElementById(id);
const stage = $('stage'), world = $('world'), svg = $('edges');
const byId = Object.fromEntries(FRAMES.map((f) => [f[0], { id: f[0], path: f[1], title: f[2], col: f[3], row: f[4], what: f[5], x: f[3] * COLW, y: TOP + f[4] * ROWH }]));
const sectionOf = (f) => SECTIONS[f.col][0];
const cam = { x: 0, y: 0, z: 0.1 };

/* ── Build frames ── */
SECTIONS.forEach(([n, s], i) => world.insertAdjacentHTML('beforeend', `<div class="section" style="left:${i * COLW}px;top:${TOP - 420}px">${n}<span>${s}</span></div>`));
world.insertAdjacentHTML('beforeend', `<div class="start" style="left:-640px;top:${TOP + FH / 2 - 35}px"><i>▶</i>Start</div>`);
for (const f of Object.values(byId)) {
  world.insertAdjacentHTML('beforeend', `<div class="frame" id="f-${f.id}" data-id="${f.id}" style="left:${f.x}px;top:${f.y}px"><div class="frame-name"><b>${sectionOf(f)} /</b>${f.title}</div><div class="frame-box"><iframe loading="lazy" tabindex="-1" src="app.html#${f.path}"></iframe></div></div>`);
}

/* ── Edges ── */
const ports = {}; // count edges per frame side to spread them
function side(a, b) {
  if (a.col !== b.col) return a.col < b.col ? ['r', 'l'] : ['l', 'r'];
  return b.row > a.row ? ['b', 't'] : ['rr', 'rr'];
}
const edges = EDGES.map(([from, to, kind, label, detail], i) => {
  const a = byId[from], b = byId[to]; const [sa, sb] = side(a, b);
  const ka = from + sa, kb = to + sb; ports[ka] = (ports[ka] || 0) + 1; ports[kb] = (ports[kb] || 0) + 1;
  return { i, from, to, kind, label, detail, a, b, sa, sb, ka, kb, na: ports[ka], nb: ports[kb] };
});
function pt(f, s, n, total) {
  const t = n / (total + 1);
  if (s === 'r') return [f.x + FW, f.y + FH * t]; if (s === 'l') return [f.x, f.y + FH * t];
  if (s === 'b') return [f.x + FW * t, f.y + FH]; if (s === 't') return [f.x + FW * t, f.y];
  return [f.x + FW, f.y + FH * t]; // rr
}
function bez(e) {
  const [x1, y1] = pt(e.a, e.sa, e.na, ports[e.ka]); const [x2, y2] = pt(e.b, e.sb, e.nb, ports[e.kb]);
  let c1, c2;
  if (e.sa === 'r' || e.sa === 'l') { const d = Math.max(380, Math.abs(x2 - x1) * 0.45) * (e.sa === 'r' ? 1 : -1); c1 = [x1 + d, y1]; c2 = [x2 - d, y2]; }
  else if (e.sa === 'b') { const d = Math.max(200, (y2 - y1) * 0.5); c1 = [x1, y1 + d]; c2 = [x2, y2 - d]; }
  else { const d = 520 + Math.abs(y2 - y1) * 0.12; c1 = [x1 + d, y1]; c2 = [x2 + d, y2]; }
  const p = [[x1, y1], c1, c2, [x2, y2]];
  const m = (t) => { const u = 1 - t; return [0, 1].map((k) => u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k]); };
  return { d: `M${x1},${y1} C${c1} ${c2} ${x2},${y2}`, mid: m(0.5), end: [x2, y2], c2 };
}
svg.setAttribute('width', 8 * COLW); svg.setAttribute('height', TOP + 6 * ROWH);
svg.innerHTML = `<defs>${['u', 'd'].map((k) => `<marker id="ar-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${k === 'u' ? '#0d99ff' : '#F5A623'}"/></marker>`).join('')}</defs>` +
  `<path class="edge u" d="M-560,${TOP + FH / 2} C-300,${TOP + FH / 2} -200,${TOP + FH / 2} 0,${TOP + FH / 2}" marker-end="url(#ar-u)"/>` +
  edges.map((e) => { const b = bez(e); e.mid = b.mid; return `<path class="edge ${e.kind}" id="e-${e.i}" d="${b.d}" marker-end="url(#ar-${e.kind})"/>`; }).join('');
edges.forEach((e) => world.insertAdjacentHTML('beforeend', `<div class="elabel ${e.kind}" id="l-${e.i}" style="left:${e.mid[0]}px;top:${e.mid[1]}px">${e.label}</div>`));

/* ── Camera ── */
function apply() { world.style.transform = `translate(${cam.x}px,${cam.y}px) scale(${cam.z})`; $('zv').textContent = Math.round(cam.z * 100) + '%'; stage.style.backgroundSize = `${24 * Math.max(0.5, cam.z * 4)}px ${24 * Math.max(0.5, cam.z * 4)}px`; stage.style.backgroundPosition = `${cam.x}px ${cam.y}px`; drawMini(); }
function zoomAt(f, cx, cy) { const nz = Math.min(2, Math.max(0.02, cam.z * f)); cam.x = cx - (cx - cam.x) * (nz / cam.z); cam.y = cy - (cy - cam.y) * (nz / cam.z); cam.z = nz; apply(); }
function bounds() { return { x: -700, y: 0, w: 8 * COLW - (COLW - FW) + 800, h: TOP + 5 * ROWH }; }
function fitTo(b, pad = 60, anim) {
  const W = stage.clientWidth, H = stage.clientHeight; const z = Math.min((W - pad * 2) / b.w, (H - pad * 2) / b.h);
  const tgt = { z, x: (W - b.w * z) / 2 - b.x * z, y: (H - b.h * z) / 2 - b.y * z };
  if (!anim) { Object.assign(cam, tgt); return apply(); }
  const s = { ...cam }; const t0 = performance.now();
  const tick = (t) => { const k = Math.min(1, (t - t0) / 650); const e = 1 - Math.pow(1 - k, 3); cam.x = s.x + (tgt.x - s.x) * e; cam.y = s.y + (tgt.y - s.y) * e; cam.z = s.z + (tgt.z - s.z) * e; apply(); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
const focusFrame = (id) => { const f = byId[id]; fitTo({ x: f.x - 500, y: f.y - 260, w: FW + 1000, h: FH + 520 }, 40, true); };

let drag = null, moved = false;
stage.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; moved = false; stage.classList.add('pan'); stage.setPointerCapture(e.pointerId); });
stage.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; cam.x = drag.cx + dx; cam.y = drag.cy + dy; apply(); });
stage.addEventListener('pointerup', (e) => {
  stage.classList.remove('pan'); const wasDrag = moved; drag = null; if (wasDrag) return;
  stage.releasePointerCapture(e.pointerId);
  const el = document.elementsFromPoint(e.clientX, e.clientY).find((x) => x.classList?.contains('frame'));
  if (el) select(el.dataset.id); else select(null);
});
stage.addEventListener('dblclick', (e) => { const el = document.elementsFromPoint(e.clientX, e.clientY).find((x) => x.classList?.contains('frame')); if (el) window.open(`index.html#${byId[el.dataset.id].path}`, '_blank'); });
stage.addEventListener('wheel', (e) => { e.preventDefault(); const r = stage.getBoundingClientRect(); if (e.ctrlKey || Math.abs(e.deltaY) > 0 && !e.shiftKey && Math.abs(e.deltaX) < 1) zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX - r.left, e.clientY - r.top); else { cam.x -= e.deltaX; cam.y -= e.deltaY; apply(); } }, { passive: false });
$('zin').onclick = () => zoomAt(1.25, stage.clientWidth / 2, stage.clientHeight / 2);
$('zout').onclick = () => zoomAt(0.8, stage.clientWidth / 2, stage.clientHeight / 2);
$('fit').onclick = () => fitTo(bounds(), 60, true);
window.addEventListener('keydown', (e) => {
  if (e.key === '+' || e.key === '=') $('zin').click(); if (e.key === '-') $('zout').click();
  if (e.key === '!' || (e.shiftKey && e.key === '1')) $('fit').click(); if (e.key === 'Escape') select(null);
});
window.addEventListener('resize', apply);

/* ── Layers ── */
const toggle = (id, cls) => $(id).addEventListener('change', (e) => world.classList.toggle(cls, !e.target.checked));
toggle('lu', 'hide-u'); toggle('ld', 'hide-d'); toggle('ll', 'hide-l');

/* ── Selection & inspector ── */
const insp = $('insp'); const emptyInsp = insp.innerHTML;
function select(id) {
  document.querySelectorAll('.frame').forEach((f) => f.classList.toggle('sel', f.dataset.id === id));
  const rel = id ? edges.filter((e) => e.from === id || e.to === id) : [];
  const near = new Set([id, ...rel.flatMap((e) => [e.from, e.to])]);
  document.querySelectorAll('.frame').forEach((f) => f.classList.toggle('dim', !!id && !near.has(f.dataset.id)));
  edges.forEach((e) => { const on = !id || rel.includes(e); $('e-' + e.i).classList.toggle('dim', !on); $('l-' + e.i).classList.toggle('dim', !on); $('e-' + e.i).classList.toggle('hi', !!id && on); $('e-' + e.i).classList.toggle('flow', !!id && on); });
  if (!id) { insp.innerHTML = emptyInsp; return; }
  const f = byId[id];
  const list = (arr, dir) => arr.length ? arr.map((e) => { const o = byId[dir === 'in' ? e.from : e.to]; return `<div class="row" data-go="${o.id}"><i class="${e.kind}-dot"></i><div><div class="t">${dir === 'in' ? '← ' : '→ '}${o.title}</div><div class="s">${e.label}${e.detail ? ' · ' + e.detail : ''}</div></div></div>`; }).join('') : `<p class="hint">None</p>`;
  insp.innerHTML = `<h2>${f.title}</h2><div class="path">${f.path}</div><p class="what">${f.what}</p>
    <h4>Users come from</h4>${list(rel.filter((e) => e.to === id && e.kind === 'u'), 'in')}
    <h4>Users go to</h4>${list(rel.filter((e) => e.from === id && e.kind === 'u'), 'out')}
    <h4>Data coming in</h4>${list(rel.filter((e) => e.to === id && e.kind === 'd'), 'in')}
    <h4>Data going out</h4>${list(rel.filter((e) => e.from === id && e.kind === 'd'), 'out')}
    <a class="cbtn primary open" href="index.html#${f.path}" target="_blank">Open in prototype ↗</a>`;
}
insp.addEventListener('click', (e) => { const r = e.target.closest('[data-go]'); if (r) { select(r.dataset.go); focusFrame(r.dataset.go); } });

/* ── Journey tour ── */
let tourT = null;
$('tour').onclick = () => {
  if (tourT) { clearTimeout(tourT); tourT = null; $('tour').textContent = '▶ Play journey'; select(null); return fitTo(bounds(), 60, true); }
  $('tour').textContent = '■ Stop'; let i = 0;
  const next = () => { if (i >= JOURNEY.length) { $('tour').click(); return; } select(JOURNEY[i]); focusFrame(JOURNEY[i]); i++; tourT = setTimeout(next, 2600); };
  next();
};

/* ── Minimap ── */
const mc = $('minic'), mx = mc.getContext('2d');
function drawMini() {
  const b = bounds(); const s = Math.min(mc.width / b.w, mc.height / b.h); mx.clearRect(0, 0, mc.width, mc.height);
  mx.fillStyle = '#4a4a4a'; for (const f of Object.values(byId)) mx.fillRect((f.x - b.x) * s, (f.y - b.y) * s, FW * s, FH * s);
  mx.strokeStyle = '#0d99ff'; mx.lineWidth = 1.5; mx.strokeRect((-cam.x / cam.z - b.x) * s, (-cam.y / cam.z - b.y) * s, (stage.clientWidth / cam.z) * s, (stage.clientHeight / cam.z) * s);
}
mc.addEventListener('click', (e) => { const b = bounds(); const s = Math.min(mc.width / b.w, mc.height / b.h); const r = mc.getBoundingClientRect(); const wx = (e.clientX - r.left) / s + b.x, wy = (e.clientY - r.top) / s + b.y; cam.x = stage.clientWidth / 2 - wx * cam.z; cam.y = stage.clientHeight / 2 - wy * cam.z; apply(); });

fitTo(bounds());
