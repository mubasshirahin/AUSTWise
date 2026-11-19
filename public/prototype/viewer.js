/* Prototype viewer: device frames, page list, flow map, keyboard nav. */
// Same page list as the Flow Canvas: one group per sidebar section, one entry per glider tab.
const FLOW = window.FLOW.COLUMNS.map(([g, , rows]) => [g, rows.map(([, p, t]) => [p, t])]);
const ALL = FLOW.flatMap(([g, list]) => list.map(([p, t]) => ({ p, t, g })));
const SIZES = { desktop: [1440, 900, 'Desktop 1440'], tablet: [768, 1024, 'Tablet 768'], mobile: [375, 812, 'Mobile 375'] };
const st = { device: 'desktop', theme: 'dark', path: '/welcome' };
const $ = (id) => document.getElementById(id);
const frame = $('frame'), device = $('device');

function readHash() {
  const [p, q] = (location.hash.slice(1) || '/welcome').split('?');
  const qs = new URLSearchParams(q || '');
  st.path = p; st.device = SIZES[qs.get('d')] ? qs.get('d') : st.device; st.theme = qs.get('t') === 'light' ? 'light' : st.theme;
}
function writeHash() { history.replaceState(null, '', `#${st.path}?d=${st.device}&t=${st.theme}`); }
function load(path) { st.path = path; frame.src = `app.html?theme=${st.theme}#${path}`; writeHash(); sync(); }
function fit() {
  const [w, h] = SIZES[st.device]; const border = st.device === 'desktop' ? 0 : 24;
  const avail = $('canvas').clientWidth - 52; const s = Math.min(1, avail / (w + border));
  device.style.transform = `scale(${s})`; device.style.marginBottom = `${-(h + border) * (1 - s)}px`;
}
function sync() {
  device.className = 'vdevice ' + st.device;
  document.querySelectorAll('#devices button').forEach((b) => b.classList.toggle('on', b.dataset.d === st.device));
  document.querySelectorAll('#themes button').forEach((b) => b.classList.toggle('on', b.dataset.t === st.theme));
  const i = idx(); const cur = ALL[i];
  $('flabel').textContent = `${cur ? cur.t : st.path} — ${SIZES[st.device][2]}`;
  $('count').textContent = `${i + 1} / ${ALL.length}`;
  document.querySelectorAll('.vpage').forEach((el) => el.classList.toggle('on', el.dataset.p === (cur && cur.p)));
  $('openFull').href = `app.html?theme=${st.theme}#${st.path}`;
  fit();
}
function idx() {
  let best = -1, len = -1;
  ALL.forEach((s, i) => { const base = s.p; if ((st.path === base || st.path.startsWith(base + '/') || base.startsWith(st.path + '/')) && base.length > len) { best = i; len = base.length; } });
  if (best < 0) best = ALL.findIndex((s) => st.path.split('/')[1] === s.p.split('/')[1]);
  return Math.max(0, best);
}
function step(d) { const i = (idx() + d + ALL.length) % ALL.length; load(ALL[i].p); }

$('pages').innerHTML = FLOW.map(([g, list]) => `<div class="vgroup">${g}</div>` + list.map(([p, t]) => `<div class="vpage" data-p="${p}">${t}</div>`).join('')).join('');
$('pages').addEventListener('click', (e) => { const el = e.target.closest('.vpage'); if (el) load(el.dataset.p); });
$('devices').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; st.device = b.dataset.d; writeHash(); sync(); });
$('themes').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; st.theme = b.dataset.t; frame.contentWindow.postMessage({ type: 'proto-theme-set', theme: st.theme }, '*'); writeHash(); sync(); });
$('prev').onclick = () => step(-1); $('next').onclick = () => step(1);
$('restart').onclick = () => load('/welcome');
$('togglePanel').onclick = () => { $('panel').classList.toggle('hide'); fit(); };
$('flowBtn').onclick = openFlow; $('flowClose').onclick = () => ($('flow').hidden = true);
function openFlow() {
  const g = $('flowGrid');
  if (!g.children.length) g.innerHTML = ALL.map((s) => `<div class="vthumb" data-p="${s.p}"><div class="vthumb-name">${s.g} / ${s.t}</div><div class="vthumb-box"><iframe loading="lazy" tabindex="-1" src="app.html?theme=${st.theme}#${s.p}"></iframe></div></div>`).join('');
  $('flow').hidden = false; scaleThumbs();
}
function scaleThumbs() { document.querySelectorAll('.vthumb-box').forEach((b) => { b.querySelector('iframe').style.transform = `scale(${b.clientWidth / 1440})`; }); }
$('flowGrid').addEventListener('click', (e) => { const t = e.target.closest('.vthumb'); if (t) { $('flow').hidden = true; load(t.dataset.p); } });
window.addEventListener('message', (e) => {
  if (e.data?.type === 'proto-route') { st.path = e.data.path; writeHash(); sync(); }
  if (e.data?.type === 'proto-theme') { st.theme = e.data.theme; writeHash(); sync(); }
});
window.addEventListener('keydown', (e) => {
  if (e.target.closest('input,textarea')) return;
  if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1);
  if (e.key.toLowerCase() === 'f') ($('flow').hidden ? openFlow() : ($('flow').hidden = true));
  if (e.key.toLowerCase() === 'r') load('/welcome');
});
window.addEventListener('resize', () => { fit(); if (!$('flow').hidden) scaleThumbs(); });
readHash(); load(st.path);
