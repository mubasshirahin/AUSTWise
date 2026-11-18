/* AUSTWise prototype — core: icons, components, router, shell, interactions. */
(function () {
  const D = window.DATA;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ── Icons ── */
  function I(name, size = 18, sw = 2) {
    const node = window.ICONS[name] || window.ICONS['dot'];
    const inner = node.map(([t, a]) => `<${t} ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('');
    return `<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  }

  /* ── Members ── */
  const member = (id) => (id === 'me' ? { ...D.me, st: '' } : D.members.find((m) => m.id === id));
  const initials = (n) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const hue = (n) => { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  function av(id, size = 34, status = true) {
    const m = member(id);
    const bg = id === 'me' ? 'var(--accent-amber)' : `hsl(${hue(m.name)} 32% 46%)`;
    return `<span class="av" data-member="${id}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.36)}px;background:${bg};color:#fff">${initials(m.name)}${status ? `<i class="st ${m.st || ''}"></i>` : ''}</span>`;
  }

  /* ── Components ── */
  const hero = ({ icon, eyebrow, a, b, sub, side = '' }) => `
    <header class="hero"><div><div class="hero-eyebrow"><span class="hero-ic">${I(icon, 16)}</span><span class="label">${esc(eyebrow)}</span></div>
    <h1>${esc(a)}<em>${esc(b)}</em></h1><p>${esc(sub)}</p></div>${side ? `<div class="hero-side">${side}</div>` : ''}</header>`;

  const tabs = (base, list, active) => `<div class="tabs-card"><div class="tabs">${list.map((t) =>
    `<a class="tab ${t.id === active ? 'active' : ''}" data-go="${base}/${t.id}"><span class="tic">${I(t.icon, 15)}</span>${esc(t.label)}</a>`).join('')}</div></div>`;

  const sectionHead = (icon, over, title, sub, act = '') => `<div class="section-head"><span class="tile">${I(icon, 20)}</span><div><span class="label">${esc(over)}</span><h2>${esc(title)}</h2><div class="sub">${esc(sub)}</div></div>${act ? `<div class="act">${act}</div>` : ''}</div>`;

  const masthead = ({ icon, over, title, sub, stats = [], menu = '', nav = '' }) => `
    <section class="dl-head"><div class="dl-head-title"><span class="dl-head-tile">${I(icon, 22)}</span><div style="min-width:0"><span class="label">${esc(over)}</span><h1 class="dl-head-name">${esc(title)}</h1><span class="dl-head-sub">${esc(sub)}</span></div></div>
    <dl class="dl-head-stats">${stats.map(([l, v, al]) => `<div class="dl-head-stat ${al ? 'alert' : ''}"><dt>${esc(l)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <div class="dl-head-actions">${nav}${menu ? `<button class="icon-btn" data-menu="${menu}" aria-label="More">${I('ellipsis-vertical', 17)}</button>` : ''}</div></section>`;

  const card = (title, icon, body, right = '', cls = '') => `<section class="card ${cls}"><div class="card-h"><h3>${I(icon, 16)}${esc(title)}</h3>${right ? `<div class="r">${right}</div>` : ''}</div>${body}</section>`;
  const empty = (icon, title, hint, action = '') => `<div class="empty"><span class="ic-tile">${I(icon, 24)}</span><h4>${esc(title)}</h4><p>${esc(hint)}</p>${action}</div>`;
  const seg = (group, items, on) => `<div class="seg" data-seg="${group}">${items.map((x) => `<button class="${x === on ? 'on' : ''}" data-segv="${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
  const bar = (pct, cls = '') => `<div class="bar ${cls}"><i style="width:${pct}%"></i></div>`;
  const statCard = (label, value, delta, icon, tone = '') => `<section class="card"><div class="row between" style="margin-bottom:12px"><span class="label">${esc(label)}</span><span class="ic-tile ${tone}">${I(icon, 17)}</span></div><div class="stat"><div class="v">${value}</div><div class="d">${delta}</div></div></section>`;

  /* ── Overlays ── */
  const root = () => document.getElementById('overlays');
  function closeAll() { root().innerHTML = ''; }
  function modal({ title, sub = '', icon = 'sparkles', body, foot, wide }) {
    root().innerHTML = `<div class="overlay" data-close-back><div class="modal ${wide ? 'wide' : ''}" role="dialog">
      <div class="modal-h"><span class="ic-tile">${I(icon, 17)}</span><div><h3>${esc(title)}</h3>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div><button class="icon-btn" data-close>${I('x', 18)}</button></div>
      <div class="modal-b">${body}</div>${foot !== false ? `<div class="modal-f">${foot || `<button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-save>Save</button>`}</div>` : ''}</div></div>`;
    const first = root().querySelector('input,textarea'); if (first) setTimeout(() => first.focus(), 60);
  }
  function toast(text, icon = 'circle-check') {
    const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = I(icon, 16) + esc(text);
    document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
  }
  function popAt(el, html, cls) {
    closeAll();
    const r = el.getBoundingClientRect();
    const p = document.createElement('div'); p.className = cls; p.innerHTML = html; root().appendChild(p);
    const w = p.offsetWidth, h = p.offsetHeight;
    let left = Math.min(r.right - w, window.innerWidth - w - 8); if (cls === 'mini-card') left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    let top = r.bottom + 6; if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    p.style.left = Math.max(8, left) + 'px'; p.style.top = top + 'px';
  }
  const MENUS = {};
  function menu(el) {
    const items = MENUS[el.dataset.menu] || [['pencil', 'Edit'], ['share-2', 'Share'], ['trash-2', 'Delete', 'danger']];
    popAt(el, items.map(([ic, l, c, act]) => `<button class="${c || ''}" data-act="${act || 'toast'}" data-msg="${esc(l)}">${I(ic, 15)}${esc(l)}</button>`).join(''), 'menu-pop');
  }
  function miniCard(el) {
    const m = member(el.dataset.member);
    popAt(el, `<div class="top">${av(m.id, 52)}<div style="min-width:0"><div style="font-weight:700;font-size:15px">${esc(m.name)}</div><div class="faint" style="font-size:12px">${esc(m.dept)} · Batch ${esc(m.batch)}</div><span class="chip amber" style="margin-top:6px">${esc(m.role)}</span></div></div>
      <div class="bd"><div class="muted" style="font-size:12.5px">${esc(m.bio || 'AUSTian')}</div>
      <div class="row" style="gap:18px"><div><div class="num">${m.streak || 20}</div><div class="label">Day streak</div></div><div><div class="num">${(m.streak || 20) * 7}</div><div class="label">Points</div></div></div>
      <div class="row"><button class="btn primary sm" data-go="/connectbox">${I('message-square', 14)}Message</button><button class="btn sm" data-go="/members/${m.id}">View profile</button></div></div>`, 'mini-card');
  }

  /* ── Search (Ctrl+K) ── */
  function search() {
    root().innerHTML = `<div class="overlay" data-close-back><div class="modal search-modal"><div class="search-in">${I('search', 18)}<input id="sq" placeholder="Search pages, people, courses…"><kbd class="chip">Esc</kbd></div><div class="search-res" id="sres"></div></div></div>`;
    const q = document.getElementById('sq'); const res = document.getElementById('sres');
    const draw = () => {
      const v = q.value.toLowerCase();
      const pages = APP.screens.filter((s) => !s.hidden && s.title.toLowerCase().includes(v)).slice(0, 8);
      const ppl = D.members.filter((m) => m.name.toLowerCase().includes(v)).slice(0, 4);
      res.innerHTML = `<div class="label" style="padding:6px 10px">Pages</div>` + pages.map((s) => `<div class="it" data-go="${s.path}"><span class="ic-tile">${I(s.icon, 16)}</span><div><div style="font-weight:600">${esc(s.title)}</div><div class="faint" style="font-size:11px">${esc(s.group)}</div></div></div>`).join('') +
        (ppl.length ? `<div class="label" style="padding:10px 10px 6px">People</div>` + ppl.map((m) => `<div class="it" data-go="/members/${m.id}">${av(m.id, 32)}<div><div style="font-weight:600">${esc(m.name)}</div><div class="faint" style="font-size:11px">${m.dept} · ${m.batch}</div></div></div>`).join('') : '');
    };
    q.addEventListener('input', draw); draw(); setTimeout(() => q.focus(), 30);
  }

  /* ── Router ── */
  const APP = { screens: [], route: '/', collapsed: false, membersOpen: true };
  function register(s) { APP.screens.push(s); }
  function find(path) {
    let best = null;
    for (const s of APP.screens) {
      if (path === s.path || path.startsWith(s.path + '/')) if (!best || s.path.length > best.path.length) best = s;
    }
    return best || APP.screens.find((s) => s.path === '/dashboard');
  }
  function go(path) { if (location.hash !== '#' + path) location.hash = path; else render(); }
  function render() {
    const path = (location.hash.slice(1) || '/dashboard').split('?')[0];
    APP.route = path; closeAll();
    const s = find(path); const sub = path.slice(s.path.length + 1) || '';
    document.title = s.title + ' — AUSTWise';
    const html = s.render(sub, path);
    const host = document.getElementById('root');
    if (s.bare) host.innerHTML = `<div class="bare">${html}</div>`;
    else {
      if (!host.querySelector('.shell')) host.innerHTML = shell();
      const main = host.querySelector('.main');
      main.innerHTML = `<div class="page">${html}</div>`; main.scrollTop = 0;
      host.querySelector('.shell').classList.remove('drawer');
      host.querySelectorAll('.nav-item[data-go], .mobile-nav a').forEach((a) => {
        const p = a.dataset.go; a.classList.toggle('active', !!(path === p || path.startsWith(p + '/') || (s.nav && s.nav === p)));
      });
    }
    s.mount && s.mount(document.getElementById('root'), sub);
    try { parent.postMessage({ type: 'proto-route', path, title: s.title }, '*'); } catch (e) {}
  }

  /* ── Shell ── */
  const NAV = [
    ['/dashboard', 'Dashboard', 'layout-dashboard'], ['/daily-life', 'Daily Life', 'house'], ['/gradelab', 'GradeLab', 'chart-column'],
    ['/insideaust', 'InsideAUST', 'map-pin'], ['/resource-vault', 'Resource Vault', 'book-open'], ['/question-bank', 'Question Bank', 'file-search'],
    ['/community', 'Community', 'users'], ['/connectbox', 'ConnectBox', 'message-square', 3], ['/productivity', 'Productivity', 'zap'],
    ['/marketplace', 'Marketplace', 'shopping-bag'], ['/downtime', 'DownTime', 'coffee'], ['/shadow', 'Shadow', 'moon'],
  ];
  const BOTTOM = [['/settings', 'Settings', 'settings'], ['/see-plans', 'See Plans', 'crown', 0, 'pro'], ['/admin-panel', 'Admin Panel', 'shield']];
  const navItem = ([p, l, ic, badge, cls]) => `<a class="nav-item ${cls || ''}" data-go="${p}" title="${l}">${I(ic, 20)}<span>${l}</span>${badge ? `<b class="badge">${badge}</b>` : ''}</a>`;
  function shell() {
    return `<div class="shell ${APP.collapsed ? 'collapsed' : ''}">
      <header class="topbar">
        <button class="icon-btn burger" data-act="drawer" aria-label="Menu">${I('menu', 20)}</button>
        <div class="brand" data-go="/dashboard">aust<b>wise</b></div>
        <div class="top-center">
          <div class="pomo"><span class="pomo-ic">${I('brain', 15)}</span><span class="pomo-time" id="pomo">25:00</span><button class="icon-btn" data-act="pomo" style="width:26px;height:26px">${I('play', 15)}</button><button class="icon-btn" data-act="pomo-reset" style="width:26px;height:26px">${I('rotate-ccw', 15)}</button><button class="icon-btn" style="width:26px;height:26px" data-go="/productivity/study-room">${I('coffee', 15)}</button></div>
          <div class="searchbar" data-act="search">${I('search', 15)}Search anything…<kbd>Ctrl K</kbd></div>
          <button class="icon-btn" data-act="theme" aria-label="Theme">${I('sun', 18)}</button>
        </div>
        <div class="top-right">
          <button class="icon-btn" data-act="notifs" aria-label="Notifications">${I('bell', 19)}<i class="dotb"></i></button>
          <button class="icon-btn" data-act="members" aria-label="Members" title="Active members">${I('users', 19)}</button>
          <div class="user-chip" data-menu="user">${av('me', 34, false)}<div class="txt"><div class="nm">${D.me.name}</div><div class="rl">${D.me.dept} · ${D.me.role}</div></div></div>
        </div>
      </header>
      <aside class="sidebar"><nav class="nav">${NAV.map(navItem).join('')}<div class="nav-div"></div>${BOTTOM.map(navItem).join('')}</nav>
        <div class="sidebar-foot"><button class="collapse-btn" data-act="collapse" aria-label="Collapse">${I('chevron-left', 16)}</button></div></aside>
      <main class="main"></main>
      <aside class="members ${APP.membersOpen ? 'open' : ''}"><div class="members-in"><div class="row between" style="padding:0 6px 8px"><span class="label">Active now · ${D.members.filter((m) => !m.st).length}</span><button class="icon-btn" data-act="members" style="width:28px;height:28px">${I('x', 15)}</button></div>
        ${D.members.map((m) => `<div class="mem-row" data-member="${m.id}">${av(m.id, 34)}<div style="min-width:0"><div class="nm">${m.name}</div><div class="sub">${m.dept} · ${m.role}</div></div></div>`).join('')}</div></aside>
      <nav class="mobile-nav">${[['/dashboard', 'Home', 'layout-dashboard'], ['/daily-life', 'Daily', 'house'], ['/connectbox', 'Chat', 'message-square'], ['/gradelab', 'Grades', 'chart-column']].map(([p, l, ic]) => `<a data-go="${p}">${I(ic, 20)}${l}</a>`).join('')}<a data-act="drawer">${I('menu', 20)}More</a></nav>
    </div>`;
  }
  MENUS.user = [['user', 'My profile', '', 'go:/members/me'], ['settings', 'Settings', '', 'go:/settings'], ['crown', 'See Plans', '', 'go:/see-plans'], ['log-out', 'Log out', 'danger', 'go:/login']];

  /* ── Pomodoro ── */
  let pomoT = null, pomoS = 1500;
  function pomo(reset) {
    const el = () => document.getElementById('pomo');
    if (reset) { clearInterval(pomoT); pomoT = null; pomoS = 1500; if (el()) el().textContent = '25:00'; return; }
    if (pomoT) { clearInterval(pomoT); pomoT = null; return; }
    pomoT = setInterval(() => { pomoS--; if (el()) el().textContent = `${String(Math.floor(pomoS / 60)).padStart(2, '0')}:${String(pomoS % 60).padStart(2, '0')}`; }, 1000);
  }

  /* ── Global events ── */
  const ACTS = {};
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('[data-close]') || t.matches('[data-close-back]')) { closeAll(); return; }
    const save = t.closest('[data-save]'); if (save) { closeAll(); toast(save.dataset.msg || 'Saved'); return; }
    const mem = t.closest('[data-member]'); if (mem && !t.closest('.mini-card')) { e.stopPropagation(); miniCard(mem); return; }
    const mn = t.closest('[data-menu]'); if (mn) { e.stopPropagation(); menu(mn); return; }
    const sg = t.closest('[data-segv]'); if (sg) { sg.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === sg)); const h = ACTS['seg:' + sg.parentElement.dataset.seg]; h && h(sg.dataset.segv, sg); return; }
    const a = t.closest('[data-act]');
    if (a) {
      const k = a.dataset.act;
      if (k.startsWith('go:')) { go(k.slice(3)); return; }
      if (k === 'toast') { closeAll(); toast(a.dataset.msg || 'Done'); return; }
      if (k === 'search') return search();
      if (k === 'theme') { const th = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = th; try { parent.postMessage({ type: 'proto-theme', theme: th }, '*'); } catch (er) {} return; }
      if (k === 'collapse') { APP.collapsed = !APP.collapsed; document.querySelector('.shell').classList.toggle('collapsed', APP.collapsed); return; }
      if (k === 'members') { APP.membersOpen = !APP.membersOpen; document.querySelector('.members').classList.toggle('open', APP.membersOpen); return; }
      if (k === 'drawer') { const sh = document.querySelector('.shell'); sh.classList.toggle('drawer'); if (sh.classList.contains('drawer')) { const b = document.createElement('div'); b.className = 'drawer-back'; b.dataset.act = 'drawer-close'; sh.appendChild(b); } else sh.querySelector('.drawer-back')?.remove(); return; }
      if (k === 'drawer-close') { const sh = document.querySelector('.shell'); sh.classList.remove('drawer'); a.remove(); return; }
      if (k === 'pomo') return pomo(false);
      if (k === 'pomo-reset') return pomo(true);
      if (k === 'notifs') return popAt(a, `<div style="padding:8px 10px" class="label">Notifications</div>${D.notices.slice(0, 3).map((n) => `<button data-go="/dashboard/notices">${I('megaphone', 15)}<span style="white-space:normal;line-height:1.3">${esc(n.title)}</span></button>`).join('')}`, 'menu-pop');
      if (ACTS[k]) return ACTS[k](a, e);
    }
    const g = t.closest('[data-go]'); if (g) { e.preventDefault(); go(g.dataset.go); return; }
    if (!t.closest('.menu-pop, .mini-card, .modal')) {
      if (root().querySelector('.menu-pop, .mini-card')) { closeAll(); return; }
      if (!t.closest('input,textarea,select,label')) { document.body.classList.add('hs-flash'); setTimeout(() => document.body.classList.remove('hs-flash'), 450); }
    }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); search(); }
    if (e.key === 'Escape') closeAll();
    if (e.key === 'Enter' && e.target.dataset.enter) { const h = ACTS[e.target.dataset.enter]; h && h(e.target, e); }
  });

  /* ── Swipe rows (Notice Board pattern) ── */
  document.addEventListener('pointerdown', (e) => {
    const fg = e.target.closest('.swipe-fg'); if (!fg || e.target.closest('[data-member],button')) return;
    const x0 = e.clientX; let dx = 0; fg.classList.add('drag'); fg.setPointerCapture(e.pointerId);
    const mv = (ev) => { dx = Math.max(-120, Math.min(120, ev.clientX - x0)); fg.style.transform = `translateX(${dx}px)`; };
    const up = () => {
      fg.classList.remove('drag'); fg.removeEventListener('pointermove', mv); fg.removeEventListener('pointerup', up);
      if (dx < -80) { fg.style.transform = 'translateX(0)'; ACTS['swipe-edit'] && ACTS['swipe-edit'](fg); }
      else if (dx > 80) { fg.style.transform = 'translateX(110%)'; setTimeout(() => { fg.parentElement.style.transition = 'height .25s, opacity .25s'; fg.parentElement.style.opacity = 0; setTimeout(() => fg.parentElement.remove(), 250); toast('Notice deleted', 'trash-2'); }, 200); }
      else fg.style.transform = 'translateX(0)';
      if (Math.abs(dx) > 6) fg.dataset.dragged = '1'; setTimeout(() => delete fg.dataset.dragged, 50);
    };
    fg.addEventListener('pointermove', mv); fg.addEventListener('pointerup', up);
  });

  window.addEventListener('hashchange', render);
  window.addEventListener('message', (e) => { if (e.data?.type === 'proto-theme-set') document.documentElement.dataset.theme = e.data.theme; if (e.data?.type === 'proto-go') go(e.data.path); });

  window.P = { I, esc, av, member, hero, tabs, sectionHead, masthead, card, empty, seg, bar, statCard, modal, toast, closeAll, register, go, render, APP, ACTS, MENUS, D, NAV };
})();
