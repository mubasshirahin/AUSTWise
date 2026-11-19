/* Design Docs hub: side list of every diagram, one infinite canvas each. */
(function () {
  const CATALOG = [
    ['Overview', [
      ['stack', 'Tech Stack', 'Languages, frameworks, services'],
      ['arch', 'System Architecture', 'Client, server, DB, external APIs'],
      ['sitemap', 'Sitemap', 'Every page and tab as a tree'],
      ['flow', 'User & Data Flow', 'Every screen, clicks and data', 'canvas.html'],
    ]],
    ['UML · Structure', [
      ['class', 'Class Diagram', 'Domain classes, attributes, methods'],
      ['component', 'Component Diagram', 'Frontend and backend modules'],
      ['deploy', 'Deployment Diagram', 'Where everything runs'],
    ]],
    ['UML · Behaviour', [
      ['usecase', 'Use Case Diagram', 'Actors and what they can do'],
      ['sequence', 'Sequence Diagrams', 'Login, chat, payment, notice'],
      ['activity', 'Activity Diagrams', 'Sign-up, routine, paper upload'],
      ['state', 'State Machines', 'Applications, invites, rooms, matches'],
    ]],
    ['Data', [
      ['erd', 'ER Diagram', 'All tables and relations (Prisma)'],
      ['dfd0', 'DFD Level 0', 'Context diagram'],
      ['dfd1', 'DFD Level 1', 'Main processes and data stores'],
    ]],
    ['Reference', [
      ['api', 'API Reference', 'Every /api endpoint by area'],
      ['roles', 'Roles & Permissions', 'Who can see and do what'],
    ]],
  ];
  const $ = (id) => document.getElementById(id);
  const stage = $('stage'), svg = $('svg'), frame = $('frame'), tip = $('tip');
  const cam = { x: 0, y: 0, z: 1 }; let cur = null, bounds = null, nodesById = {};

  $('nav').innerHTML = CATALOG.map(([g, items]) => `<div class="ngroup">${g}</div>` + items.map(([id, t, s]) => `<button class="nitem" data-id="${id}"><b>${t}</b><span>${s}</span></button>`).join('')).join('');
  $('nav').onclick = (e) => { const b = e.target.closest('.nitem'); if (b) { location.hash = b.dataset.id; document.body.classList.remove('nav-open'); } };
  $('menu').onclick = () => document.body.classList.toggle('nav-open');
  const find = (id) => CATALOG.flatMap((g) => g[1]).find((x) => x[0] === id);

  function apply() { const w = svg.querySelector('#world'); if (w) w.setAttribute('transform', `translate(${cam.x} ${cam.y}) scale(${cam.z})`); $('zv').textContent = Math.round(cam.z * 100) + '%'; stage.style.backgroundSize = `${24 * cam.z}px ${24 * cam.z}px`; stage.style.backgroundPosition = `${cam.x}px ${cam.y}px`; }
  function fitTo(b, pad = 40, anim) {
    const W = stage.clientWidth, H = stage.clientHeight; const z = Math.min(1.4, Math.min((W - pad * 2) / b.w, (H - pad * 2) / b.h));
    const t = { z, x: (W - b.w * z) / 2 - b.x * z, y: (H - b.h * z) / 2 - b.y * z };
    if (!anim) { Object.assign(cam, t); return apply(); }
    const s = { ...cam }, t0 = performance.now();
    const tick = (n) => { const k = Math.min(1, (n - t0) / 500), e = 1 - Math.pow(1 - k, 3); cam.x = s.x + (t.x - s.x) * e; cam.y = s.y + (t.y - s.y) * e; cam.z = s.z + (t.z - s.z) * e; apply(); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  function zoomAt(f, cx, cy) { const nz = Math.min(4, Math.max(0.03, cam.z * f)); cam.x = cx - (cx - cam.x) * (nz / cam.z); cam.y = cy - (cy - cam.y) * (nz / cam.z); cam.z = nz; apply(); }

  function open(id) {
    const item = find(id) || find('arch'); id = item[0]; cur = id;
    document.querySelectorAll('.nitem').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
    if (item[3]) { // embedded page (Flow Canvas)
      svg.style.display = 'none'; frame.hidden = false; if (!frame.src.endsWith(item[3])) frame.src = item[3];
      $('tools').style.visibility = 'hidden'; $('legend').innerHTML = ''; $('about').innerHTML = '';
      $('title').textContent = item[1]; $('sub').textContent = 'Each column is a sidebar section, each row a glider tab. Hover or click a line to read it.'; return;
    }
    frame.hidden = true; svg.style.display = ''; $('tools').style.visibility = '';
    const spec = DOCS.specs[id]; if (!spec) { svg.innerHTML = ''; $('title').textContent = item[1]; $('sub').textContent = 'Missing diagram data'; return; }
    $('title').textContent = spec.title || item[1]; $('sub').textContent = spec.sub || item[2];
    const r = DOCS.render(svg, spec); bounds = r.bounds; nodesById = r.nodes; cur = id;
    $('legend').innerHTML = (spec.legend || []).map(([k, v]) => `<div><i>${legendIcon(k)}</i>${DOCS.esc(v)}</div>`).join('');
    $('about').innerHTML = spec.about ? `<b>How to read</b><br>${spec.about}` : '';
    $('findlist').innerHTML = Object.values(nodesById).map((n) => `<option value="${DOCS.esc(n.title)}">`).join('');
    $('find').value = '';
    fitTo(bounds); document.title = `${item[1]} — AUSTWise Design Docs`;
  }
  const legendIcon = (k) => ({ PK: '<span style="color:#F5A623">PK</span>', FK: '<span style="color:#0d99ff">FK</span>', UQ: '<span style="color:#a78bfa">UQ</span>', crow: '>|', bar: '||', u: '<span style="color:#0d99ff">━</span>', d: '<span style="color:#F5A623">┅</span>', g: '<span style="color:#8a8f98">━</span>', tri: '◁', dia: '◆', odia: '◇', dash: '┄', actor: '웃', uc: '◯', db: '⛁', ext: '<span style="color:#22c3d6">■</span>', svc: '<span style="color:#0d99ff">■</span>', amber: '<span style="color:#F5A623">■</span>', green: '<span style="color:#2fbf71">■</span>', rose: '<span style="color:#ef5b6b">■</span>', violet: '<span style="color:#a78bfa">■</span>' }[k] || DOCS.esc(k));

  /* ── pan / zoom ── */
  let drag = null, moved = false;
  stage.addEventListener('pointerdown', (e) => { if (e.target === frame) return; drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; moved = false; stage.classList.add('pan'); tip.style.display = 'none'; });
  window.addEventListener('pointermove', (e) => {
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; cam.x = drag.cx + dx; cam.y = drag.cy + dy; apply(); return; }
    hover(e);
  });
  window.addEventListener('pointerup', (e) => { if (!drag) return; stage.classList.remove('pan'); drag = null; if (!moved) click(e); });
  stage.addEventListener('wheel', (e) => { if (!frame.hidden) return; e.preventDefault(); const r = stage.getBoundingClientRect(); if (e.ctrlKey || !e.shiftKey && Math.abs(e.deltaX) < 1) zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX - r.left, e.clientY - r.top); else { cam.x -= e.deltaX; cam.y -= e.deltaY; apply(); } }, { passive: false });
  $('zin').onclick = () => zoomAt(1.25, stage.clientWidth / 2, stage.clientHeight / 2);
  $('zout').onclick = () => zoomAt(0.8, stage.clientWidth / 2, stage.clientHeight / 2);
  $('fit').onclick = () => { select(null); bounds && fitTo(bounds, 40, true); };
  window.addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT') return; if (e.key === '+' || e.key === '=') $('zin').click(); if (e.key === '-') $('zout').click(); if (e.key === '!' || (e.shiftKey && e.key === '1')) $('fit').click(); if (e.key === 'Escape') select(null); });
  window.addEventListener('resize', () => bounds && fitTo(bounds));

  /* ── hover & select ── */
  const spec = () => DOCS.specs[cur] || {};
  function hover(e) {
    if (!frame.hidden) return;
    const el = e.target.closest && e.target.closest('.de, .dl, .dn');
    if (!el || !stage.contains(el)) { tip.style.display = 'none'; return; }
    let html = '';
    if (el.classList.contains('dn')) { const n = (spec().nodes || []).find((x) => x.id === el.dataset.id); if (!n) return; html = `<b>${DOCS.esc(n.title)}</b>${n.desc ? `<p>${DOCS.esc(n.desc)}</p>` : ''}${n.rows ? `<p>${n.rows.length} columns · click to highlight its relations</p>` : '<p>Click to highlight its links</p>'}`; }
    else { const ed = spec().edges[+el.dataset.e]; if (!ed) return; const A = nodesById[ed.from], B = nodesById[ed.to]; html = `<b>${DOCS.esc(A?.title)} → ${DOCS.esc(B?.title)}</b>${ed.label ? `<p>${DOCS.esc(ed.label)}</p>` : ''}${ed.detail ? `<p>${DOCS.esc(ed.detail)}</p>` : ''}`; }
    tip.innerHTML = html; tip.style.display = 'block';
    tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = Math.min(e.clientY + 14, innerHeight - tip.offsetHeight - 8) + 'px';
  }
  function click(e) { const el = e.target.closest && e.target.closest('.dn, .de, .dl'); if (!el) return select(null); if (el.classList.contains('dn')) select(el.dataset.id); else selectEdge(+el.dataset.e); }
  function select(id) {
    const es = svg.querySelectorAll('.de'), ls = svg.querySelectorAll('.dl'), ns = svg.querySelectorAll('.dn');
    if (!id) { [...es, ...ls, ...ns].forEach((x) => x.classList.remove('dim')); return; }
    const near = new Set([id]); const on = new Set();
    es.forEach((x) => { if (x.dataset.a === id || x.dataset.b === id) { on.add(x.dataset.e); near.add(x.dataset.a); near.add(x.dataset.b); } });
    es.forEach((x) => x.classList.toggle('dim', !on.has(x.dataset.e))); ls.forEach((x) => x.classList.toggle('dim', !on.has(x.dataset.e)));
    ns.forEach((x) => x.classList.toggle('dim', !near.has(x.dataset.id)));
  }
  function selectEdge(i) {
    const ed = spec().edges[i]; svg.querySelectorAll('.de, .dl').forEach((x) => x.classList.toggle('dim', +x.dataset.e !== i));
    svg.querySelectorAll('.dn').forEach((x) => x.classList.toggle('dim', x.dataset.id !== ed.from && x.dataset.id !== ed.to));
  }
  $('find').addEventListener('change', (e) => { const q = e.target.value.trim().toLowerCase(); const n = Object.values(nodesById).find((x) => String(x.title).toLowerCase() === q) || Object.values(nodesById).find((x) => String(x.title).toLowerCase().includes(q)); if (!n) return; select(n.id); fitTo({ x: n.x - 300, y: n.y - 200, w: n.w + 600, h: n.h + 400 }, 30, true); });

  /* ── export ── */
  $('dl').onclick = () => {
    if (!bounds) return; const c = svg.cloneNode(true); c.querySelector('#world').removeAttribute('transform'); c.querySelectorAll('.dim').forEach((x) => x.classList.remove('dim'));
    c.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`); c.setAttribute('width', bounds.w); c.setAttribute('height', bounds.h); c.removeAttribute('id'); c.removeAttribute('style');
    c.insertAdjacentHTML('afterbegin', `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}" fill="#1e1e1e"/>`);
    const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(c)], { type: 'image/svg+xml' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `austwise-${cur}.svg`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  window.addEventListener('hashchange', () => open(location.hash.slice(1)));
  open(location.hash.slice(1) || 'arch');
  window.DOCS_HUB = { open, CATALOG };
})();
