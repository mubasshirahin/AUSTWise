/* AUSTWise Flow Canvas: infinite canvas with every screen, user-flow and data-flow arrows. */
const FW = 1440, FH = 900, COLW = 2700, ROWH = 1500, TOP = 500;

const { COLUMNS, EDGES, JOURNEY } = window.FLOW;
const SECTIONS = COLUMNS.map(([n, s]) => [n, s]);
const FRAMES = COLUMNS.flatMap(([, , rows], col) => rows.map(([id, path, title, what, real], row) => [id, path, title, col, row, what, real]));
const MAXROWS = Math.max(...COLUMNS.map((c) => c[2].length));

const $ = (id) => document.getElementById(id);
const stage = $('stage'), world = $('world'), svg = $('edges');
const byId = Object.fromEntries(FRAMES.map((f) => [f[0], { id: f[0], path: f[1], title: f[2], col: f[3], row: f[4], what: f[5], real: f[6] || f[1], x: f[3] * COLW, y: TOP + f[4] * ROWH }]));
const sectionOf = (f) => SECTIONS[f.col][0];
const cam = { x: 0, y: 0, z: 0.1 };
const missing = EDGES.filter(([x, y]) => !byId[x] || !byId[y]); if (missing.length) console.warn('Unknown frame in edges', missing);

/* ── Build frames: one column per sidebar section, one row per glider tab ── */
COLUMNS.forEach(([n, s, rows], i) => world.insertAdjacentHTML('beforeend', `<div class="section" style="left:${i * COLW}px;top:${TOP - 420}px">${n}<span>${s} · ${rows.length} ${rows.length === 1 ? 'screen' : 'tabs & screens'}</span></div>`));
world.insertAdjacentHTML('beforeend', `<div class="start" style="left:-640px;top:${TOP + FH / 2 - 35}px"><i>▶</i>Start</div>`);
for (const f of Object.values(byId)) {
  world.insertAdjacentHTML('beforeend', `<div class="frame" id="f-${f.id}" data-id="${f.id}" style="left:${f.x}px;top:${f.y}px"><div class="frame-name"><b>${sectionOf(f)} /</b>${f.row + 1}. ${f.title}</div><div class="frame-box"><div class="frame-ph"><b>${f.title}</b><span>${f.real}</span></div></div></div>`);
}
/* Iframes load only when a frame is on screen and zoomed in enough, so 100+ screens stay light. */
let lazyT = null;
function loadVisible() {
  lazyT = null; if (cam.z < 0.07) return;
  const W = stage.clientWidth, H = stage.clientHeight;
  for (const f of Object.values(byId)) {
    if (f.loaded) continue;
    const sx = f.x * cam.z + cam.x, sy = f.y * cam.z + cam.y;
    if (sx + FW * cam.z < 0 || sy + FH * cam.z < 0 || sx > W || sy > H) continue;
    f.loaded = true; $('f-' + f.id).querySelector('.frame-box').insertAdjacentHTML('beforeend', `<iframe tabindex="-1" src="app.html#${f.path}"></iframe>`);
  }
}
const queueLoad = () => { if (!lazyT) lazyT = setTimeout(loadVisible, 180); };
$('jump').insertAdjacentHTML('beforeend', COLUMNS.map(([n], i) => `<option value="${i}">${n}</option>`).join(''));
$('jump').onchange = (e) => { const i = +e.target.value; if (e.target.value === '') return; const n = COLUMNS[i][2].length; fitTo({ x: i * COLW - 300, y: TOP - 500, w: FW + 600, h: Math.min(n, 4) * ROWH + 500 }, 40, true); e.target.value = ''; };

/* ── Edges ── */
const ports = {}; // count edges per frame side to spread them
function side(a, b) {
  if (a.col !== b.col) return a.col < b.col ? ['r', 'l'] : ['l', 'r'];
  return b.row === a.row + 1 ? ['b', 't'] : ['rr', 'rr'];
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
  else { const d = Math.min(1050, 380 + Math.abs(y2 - y1) * 0.06); c1 = [x1 + d, y1]; c2 = [x2 + d, y2]; }
  const p = [[x1, y1], c1, c2, [x2, y2]];
  const m = (t) => { const u = 1 - t; return [0, 1].map((k) => u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k]); };
  return { d: `M${x1},${y1} C${c1} ${c2} ${x2},${y2}`, mid: m(0.5), end: [x2, y2], c2 };
}
svg.setAttribute('width', SECTIONS.length * COLW); svg.setAttribute('height', TOP + (MAXROWS + 1) * ROWH);
svg.innerHTML = `<defs>${['u', 'd'].map((k) => `<marker id="ar-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${k === 'u' ? '#0d99ff' : '#F5A623'}"/></marker>`).join('')}</defs>` +
  `<path class="edge u" d="M-560,${TOP + FH / 2} C-300,${TOP + FH / 2} -200,${TOP + FH / 2} 0,${TOP + FH / 2}" marker-end="url(#ar-u)"/>` +
  edges.map((e) => { const b = bez(e); e.mid = b.mid; return `<path class="edge ${e.kind}" id="e-${e.i}" d="${b.d}" marker-end="url(#ar-${e.kind})"/><path class="ehit" data-e="${e.i}" d="${b.d}"/>`; }).join('');
edges.forEach((e) => world.insertAdjacentHTML('beforeend', `<div class="elabel ${e.kind}" data-e="${e.i}" id="l-${e.i}" style="left:${e.mid[0]}px;top:${e.mid[1]}px">${e.label}</div>`));

/* ── Camera ── */
function apply() { world.style.transform = `translate(${cam.x}px,${cam.y}px) scale(${cam.z})`; $('zv').textContent = Math.round(cam.z * 100) + '%'; stage.style.backgroundSize = `${24 * Math.max(0.5, cam.z * 4)}px ${24 * Math.max(0.5, cam.z * 4)}px`; stage.style.backgroundPosition = `${cam.x}px ${cam.y}px`; drawMini(); queueLoad(); }
function zoomAt(f, cx, cy) { const nz = Math.min(2, Math.max(0.02, cam.z * f)); cam.x = cx - (cx - cam.x) * (nz / cam.z); cam.y = cy - (cy - cam.y) * (nz / cam.z); cam.z = nz; apply(); }
function bounds() { return { x: -700, y: 0, w: SECTIONS.length * COLW - (COLW - FW) + 800, h: TOP + MAXROWS * ROWH }; }
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
  if (el) return select(el.dataset.id);
  const ed = edgeAt(e); if (ed) return selectEdge(ed); select(null);
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
  insp.innerHTML = `<h2>${f.title}</h2><div class="path">${sectionOf(f)} · row ${f.row + 1} · ${f.real}</div><p class="what">${f.what}</p>
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

/* ── Edge hover tooltip & click ── */
const tip = document.createElement('div'); tip.className = 'etip'; document.body.appendChild(tip);
function edgeAt(ev) { const el = document.elementsFromPoint(ev.clientX, ev.clientY).find((x) => x.dataset && x.dataset.e !== undefined && (x.classList.contains('ehit') || x.classList.contains('elabel'))); return el ? edges[+el.dataset.e] : null; }
const sent = (e) => e.kind === 'u'
  ? `On <b>${e.a.title}</b> (${sectionOf(e.a)}), the user clicks <b>${e.label}</b> and goes to <b>${e.b.title}</b> (${sectionOf(e.b)}).`
  : `<b>${e.label}</b> from <b>${e.a.title}</b> (${sectionOf(e.a)}) is shown or used on <b>${e.b.title}</b> (${sectionOf(e.b)}).`;
function tipHtml(e) { return `<div class="k ${e.kind}">${e.kind === 'u' ? 'User flow · click' : 'Data flow'}</div><div class="ft">${e.a.title} → ${e.b.title}</div><p>${sent(e)}</p>${e.detail ? `<p class="dt">${e.detail}</p>` : ''}`; }
let hoverE = null;
stage.addEventListener('pointermove', (ev) => {
  if (drag) { tip.style.display = 'none'; return; }
  const e = edgeAt(ev);
  if (hoverE && hoverE !== e) { $('e-' + hoverE.i).classList.remove('hov'); }
  hoverE = e;
  if (!e) { tip.style.display = 'none'; stage.style.cursor = ''; return; }
  $('e-' + e.i).classList.add('hov'); stage.style.cursor = 'pointer';
  tip.innerHTML = tipHtml(e); tip.style.display = 'block';
  const x = Math.min(ev.clientX + 16, innerWidth - tip.offsetWidth - 10), y = Math.min(ev.clientY + 16, innerHeight - tip.offsetHeight - 10);
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
});
stage.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
function selectEdge(e) {
  document.querySelectorAll('.frame').forEach((f) => { f.classList.toggle('sel', false); f.classList.toggle('dim', f.dataset.id !== e.from && f.dataset.id !== e.to); });
  edges.forEach((x) => { const on = x === e; $('e-' + x.i).classList.toggle('dim', !on); $('l-' + x.i).classList.toggle('dim', !on); $('e-' + x.i).classList.toggle('hi', on); $('e-' + x.i).classList.toggle('flow', on); });
  insp.innerHTML = `<h2>${e.label}</h2><div class="path">${e.kind === 'u' ? 'User flow · click' : 'Data flow'}</div><p class="what">${sent(e)}</p>${e.detail ? `<p class="what">${e.detail}</p>` : ''}
    <h4>From</h4><div class="row" data-go="${e.from}"><i class="${e.kind}-dot"></i><div><div class="t">${e.a.title}</div><div class="s">${sectionOf(e.a)} · ${e.a.real}</div></div></div>
    <h4>To</h4><div class="row" data-go="${e.to}"><i class="${e.kind}-dot"></i><div><div class="t">${e.b.title}</div><div class="s">${sectionOf(e.b)} · ${e.b.real}</div></div></div>`;
}
stage.addEventListener('pointerdown', () => { tip.style.display = 'none'; });
