/* Daily Life hub: Cover Page, Bhara Koto, TakaGeloKoi, Mess Meal, Life Planner, Footprint, Passwords */
(function () {
  const { I, esc, av, hero, tabs, masthead, card, empty, seg, bar, modal, toast, register, ACTS, MENUS, D } = P;
  const LT = [
    { id: 'cover-page-generator', label: 'Cover Page', icon: 'file-text' }, { id: 'bhara-koto', label: 'Bhara Koto', icon: 'bus' },
    { id: 'money-tracker', label: 'TakaGeloKoi', icon: 'wallet' }, { id: 'mess-meal', label: 'Mess Meal', icon: 'utensils' },
    { id: 'life-planner', label: 'Life Planner', icon: 'target' }, { id: 'digital-footprint', label: 'Footprint', icon: 'footprints' },
    { id: 'password-manager', label: 'Passwords', icon: 'key-round' },
  ];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  let ym = [2026, 10];
  const dayAmt = (d) => { const v = ((d * 7919) % 13) * 45; return d > 19 && ym[1] === 10 ? 0 : v; };

  function calendar() {
    const [y, m] = ym; const first = new Date(y, m, 1).getDay(); const lead = (first - 5 + 7) % 7; const days = new Date(y, m + 1, 0).getDate();
    const cells = []; for (let i = 0; i < lead; i++) cells.push(`<div class="d out"></div>`);
    for (let d = 1; d <= days; d++) { const a = dayAmt(d); cells.push(`<div class="d ${y === 2026 && m === 10 && d === 19 ? 'today' : ''}" data-act="tgk-day" data-d="${d}"><span>${d}</span>${a ? `<span class="amt ${a > 450 ? 'over' : ''}">৳${a}</span>` : ''}</div>`); }
    return `<div class="cal">${['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'].map((x) => `<div class="dh">${x}</div>`).join('')}${cells.join('')}</div>`;
  }
  ACTS['tgk-prev'] = () => { ym = ym[1] ? [ym[0], ym[1] - 1] : [ym[0] - 1, 11]; P.render(); };
  ACTS['tgk-next'] = () => { ym = ym[1] < 11 ? [ym[0], ym[1] + 1] : [ym[0] + 1, 0]; P.render(); };
  ACTS['tgk-day'] = (el) => { const d = el.dataset.d; modal({ title: `${d} ${MONTHS[ym[1]]} ${ym[0]}`, sub: `Spent ৳${dayAmt(+d)}`, icon: 'calendar-days', body: `<div class="list">${D.expenses.slice(0, 3).map((e) => `<div class="list-row"><span class="ic-tile">${I(e.ic, 15)}</span><div class="grow"><div class="t">${e.t}</div><div class="s">${e.c}</div></div><b class="num">৳${e.a}</b></div>`).join('')}</div><div class="dashed" style="margin:0"></div><div class="form-grid"><div class="field"><span class="label">Amount</span><input class="input" placeholder="৳ 0"></div><div class="field"><span class="label">Category</span><select class="input"><option>Food</option><option>Transport</option><option>Study</option><option>Fun</option><option>Bills</option></select></div></div>`, foot: `<button class="btn ghost" data-close>Close</button><button class="btn primary" data-save data-msg="Expense added">${I('plus', 14)}Add expense</button>` }); };
  ACTS['tgk-add'] = () => ACTS['tgk-day']({ dataset: { d: 19 } });
  MENUS.tgk = [['plus', 'Add expense', '', 'tgk-add'], ['wallet', 'Set monthly budget', '', 'tgk-budget'], ['download', 'Export CSV'], ['refresh-cw', 'Reset month', 'danger']];
  ACTS['tgk-budget'] = () => modal({ title: 'Monthly budget', icon: 'wallet', body: `<div class="field"><span class="label">Budget</span><input class="input" value="৳ 8,000"></div>${P.toggles([['Warn me at 80%', true], ['Roll over unspent', false]])}` });

  function takageloKoi() {
    const total = D.expenses.reduce((s, e) => s + e.a, 0) * 6; const budget = 8000; const pct = Math.round((total / budget) * 100);
    const nav = `<div class="dl-head-nav"><button class="icon-btn" data-act="tgk-prev" style="width:26px;height:26px">${I('chevron-left', 16)}</button><span>${MONTHS[ym[1]].slice(0, 3)} ${ym[0]}</span><button class="icon-btn" data-act="tgk-next" style="width:26px;height:26px">${I('chevron-right', 16)}</button></div>`;
    const cats = [['Food', 'utensils', 2450], ['Transport', 'bus', 1180], ['Study', 'book-open', 860], ['Fun', 'gamepad-2', 900], ['Bills', 'phone', 300]];
    return masthead({ icon: 'wallet', over: 'Daily Life', title: 'TakaGeloKoi', sub: 'Where did the money go?', stats: [['Spent', `৳${total.toLocaleString()}`], ['Budget', '৳8,000'], ['Left', `৳${(budget - total).toLocaleString()}`, total > budget]], menu: 'tgk', nav }) +
      `<div class="tgk-strip"><div><span class="label">This month</span><div class="num" style="font-size:1.6rem">${pct}% <span class="faint" style="font-size:13px;font-weight:600">of budget</span></div></div><div style="flex:1;max-width:520px">${bar(Math.min(pct, 100), pct > 100 ? 'rose' : '')}</div><button class="btn primary" data-act="tgk-add">${I('plus', 15)}Add expense</button></div>
      <div class="main-grid">${card(`${MONTHS[ym[1]]} ${ym[0]}`, 'calendar-days', calendar(), seg('tgkv', ['Month', 'Week'], 'Month'))}
      <div class="stack">${card('By category', 'chart-pie', `<div class="list">${cats.map(([c, ic, a]) => `<div class="list-row"><span class="ic-tile">${I(ic, 15)}</span><div class="grow"><div class="row between"><span class="t">${c}</span><b class="num">৳${a.toLocaleString()}</b></div><div style="margin-top:6px">${bar(Math.round((a / 2450) * 100))}</div></div></div>`).join('')}</div>`)}
      ${card('Recent', 'receipt', `<div class="list">${D.expenses.map((e) => `<div class="list-row"><span class="ic-tile">${I(e.ic, 15)}</span><div class="grow"><div class="t">${e.t}</div><div class="s">${e.c} · Today</div></div><b class="num">৳${e.a}</b><button class="icon-btn" data-menu="exp">${I('ellipsis-vertical', 15)}</button></div>`).join('')}</div>`)}</div></div>`;
  }

  function bharaKoto() {
    const routes = [['Farmgate → AUST', 'Bus 8 / Rickshaw', 25, 15], ['Mirpur 10 → AUST', 'BRTC + Rickshaw', 60, 40], ['Uttara → AUST', 'Metro + Rickshaw', 90, 35], ['Mohammadpur → AUST', 'Bus 7', 35, 45]];
    return masthead({ icon: 'bus', over: 'Daily Life', title: 'Bhara Koto', sub: 'Fair fares to and from campus', stats: [['Routes', '42'], ['Avg fare', '৳48']] }) +
      `<section class="card"><div class="form-grid" style="grid-template-columns:1fr 1fr auto;align-items:end"><div class="field"><span class="label">From</span><input class="input" value="Farmgate"></div><div class="field"><span class="label">To</span><input class="input" value="AUST, Tejgaon"></div><button class="btn primary" data-act="toast" data-msg="3 routes found">${I('search', 15)}Find fare</button></div></section>
      <div class="grid g2">${routes.map(([r, m, f, t]) => `<section class="card hoverable" data-act="toast" data-msg="${r} saved"><div class="row between"><b>${r}</b><span class="num ok" style="font-size:1.3rem">৳${f}</span></div><div class="faint" style="font-size:12px;margin:6px 0 10px">${m}</div><div class="row"><span class="chip">${I('clock', 12)}${t} min</span><span class="chip green">Fair</span></div></section>`).join('')}</div>`;
  }

  function lifePlanner() {
    const goals = [['Finish OS syllabus', 70, 'Academic'], ['Solve 300 CF problems', 46, 'Skill'], ['Gym 3x / week', 58, 'Health'], ['Read 12 books', 25, 'Personal']];
    return masthead({ icon: 'target', over: 'Daily Life', title: 'Life Planner', sub: 'Goals, habits & semester plan', stats: [['Goals', '4'], ['On track', '3'], ['Streak', '12d']], menu: 'lp' }) +
      `<div class="main-grid"><div class="stack">${card('Goals', 'target', `<div class="list">${goals.map(([g, p, c]) => `<div class="list-row"><div class="grow"><div class="row between"><span class="t">${g}</span><span class="chip">${c}</span></div><div class="row" style="margin-top:8px"><div style="flex:1">${bar(p)}</div><b class="num" style="width:40px;text-align:right">${p}%</b></div></div></div>`).join('')}</div>`, `<button class="btn sm primary" data-act="add-goal">${I('plus', 13)}Goal</button>`)}
      ${card('Course heatmap', 'grid-3x3', `<div class="heat">${Array.from({ length: 7 * 18 }, (_, i) => `<i style="opacity:${[0.08, 0.25, 0.45, 0.7, 1][(i * 37) % 5]}"></i>`).join('')}</div>`)}</div>
      <div class="stack">${card("Today's habits", 'list-checks', `<div class="list">${[['Read 20 pages', true], ['1 hour DSA', true], ['Drink 3L water', false], ['Sleep before 1am', false]].map(([h, d]) => `<label class="list-row" style="cursor:pointer"><input type="checkbox" ${d ? 'checked' : ''} style="accent-color:var(--accent-amber);width:16px;height:16px"><span class="t" style="font-weight:500">${h}</span></label>`).join('')}</div>`)}</div></div>`;
  }
  ACTS['add-goal'] = () => modal({ title: 'New goal', icon: 'target', body: `<div class="field"><span class="label">Goal</span><input class="input" placeholder="e.g. Finish DBMS project"></div><div class="form-grid"><div class="field"><span class="label">Category</span><select class="input"><option>Academic</option><option>Skill</option><option>Health</option></select></div><div class="field"><span class="label">Deadline</span><input type="date" class="input"></div></div>` });
  MENUS.lp = [['plus', 'New goal', '', 'add-goal'], ['calendar', 'Semester plan'], ['download', 'Export']];

  function coverPage() {
    return masthead({ icon: 'file-text', over: 'Daily Life', title: 'Cover Page', sub: 'Assignment & lab cover pages in seconds', stats: [['Made', '27'], ['Templates', '6']] }) +
      `<div class="grid g2"><section class="card"><div class="card-h"><h3>${I('pencil', 16)}Details</h3></div><div class="form-grid">${[['Course code', 'CSE 3207'], ['Course title', 'Software Engineering'], ['Type', 'Assignment'], ['No.', '03'], ['Teacher', 'Dr. A. K. M. Rahman'], ['Submission', '20 Nov 2026']].map(([l, v]) => `<div class="field"><span class="label">${l}</span><input class="input" value="${v}" data-cp="${l}"></div>`).join('')}</div><div class="row" style="justify-content:flex-end;margin-top:14px;gap:8px"><button class="btn" data-act="toast" data-msg="Sent to printer">${I('printer', 14)}Print</button><button class="btn primary" data-act="toast" data-msg="cover-page.pdf downloaded">${I('download', 14)}Download PDF</button></div></section>
      <section class="card cover-preview"><div class="paper"><div class="label" style="color:#555">Ahsanullah University of Science and Technology</div><div style="font-weight:800;font-size:15px;margin:10px 0 2px">Department of Computer Science & Engineering</div><div class="paper-line"></div><div style="font-size:12px;color:#444">Course: <b>CSE 3207 — Software Engineering</b></div><div style="font-size:22px;font-weight:800;margin:14px 0">Assignment 03</div><div class="paper-grid"><div><span>Submitted to</span><b>Dr. A. K. M. Rahman</b></div><div><span>Submitted by</span><b>${D.me.name}</b><br>${D.me.sid}<br>Year 3 · Semester 2 · B</div></div><div style="font-size:11px;color:#666;margin-top:16px">Date of submission: 20 Nov 2026</div></div></section></div>`;
  }
  function messMeal() {
    return masthead({ icon: 'utensils', over: 'Daily Life', title: 'Mess Meal', sub: 'Meals, bazar & monthly split', stats: [['Meals', '46'], ['Rate', '৳62'], ['Due', '৳380', true]] }) +
      `<div class="main-grid">${card('Members', 'users', `<div class="tscroll"><table class="table"><thead><tr><th>Member</th><th>Meals</th><th>Bazar</th><th>Balance</th></tr></thead><tbody>${D.members.slice(0, 5).map((m, i) => `<tr><td><div class="row">${P.av(m.id, 28)}${m.name}</div></td><td>${40 + i * 3}</td><td>৳${(1200 + i * 350).toLocaleString()}</td><td class="${i % 2 ? 'bad' : 'good'}">${i % 2 ? '-' : '+'}৳${120 + i * 40}</td></tr>`).join('')}</tbody></table></div>`)}
      ${card('Add today', 'plus', `<div class="field"><span class="label">Meals</span>${seg('meal', ['0', '1', '2', '3'], '2')}</div><div class="field" style="margin-top:12px"><span class="label">Bazar (optional)</span><input class="input" placeholder="৳ 0"></div><button class="btn primary" style="width:100%;margin-top:14px" data-act="toast" data-msg="Meal logged">Save</button>`)}</div>`;
  }
  function footprint() {
    return masthead({ icon: 'footprints', over: 'Daily Life', title: 'Digital Footprint', sub: 'Your screen time & focus balance', stats: [['Today', '5h 12m'], ['Focus', '2h 40m'], ['Pickups', '64', true]] }) +
      `<div class="grid g2">${card('This week', 'chart-column', `<div class="bars">${[62, 80, 45, 90, 70, 55, 40].map((v) => `<i style="height:${v}%"></i>`).join('')}</div><div class="row between faint" style="font-size:11px;margin-top:6px">${['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'].map((x) => `<span>${x}</span>`).join('')}</div>`)}${card('Top apps', 'smartphone', `<div class="list">${[['YouTube', '1h 48m', 80], ['AUSTWise', '1h 05m', 50], ['Messenger', '52m', 40], ['VS Code', '41m', 32]].map(([a, t, p]) => `<div class="list-row"><div class="grow"><div class="row between"><span class="t">${a}</span><span class="faint">${t}</span></div><div style="margin-top:6px">${bar(p)}</div></div></div>`).join('')}</div>`)}</div>`;
  }
  function passwords() {
    return masthead({ icon: 'key-round', over: 'Daily Life', title: 'Password Manager', sub: 'Encrypted on your device', stats: [['Saved', '4'], ['Weak', '1', true]], menu: 'pw' }) +
      `<section class="card"><div class="row between wrap" style="margin-bottom:10px"><input class="input" placeholder="Search vault…" style="max-width:300px"><button class="btn primary" data-act="add-pw">${I('plus', 14)}Add password</button></div><div class="list">${D.passwords.map((p) => `<div class="list-row"><span class="ic-tile">${I(p.ic, 16)}</span><div class="grow"><div class="t">${p.s}</div><div class="s">${p.u}</div></div><span class="pw-dots" data-act="pw-eye">••••••••••</span><span class="chip ${p.str === 'Weak' ? 'rose' : p.str === 'Medium' ? 'amber' : 'green'}">${p.str}</span><button class="icon-btn" data-act="toast" data-msg="Copied to clipboard">${I('copy', 15)}</button></div>`).join('')}</div></section>`;
  }
  ACTS['pw-eye'] = (el) => { el.textContent = el.textContent.startsWith('•') ? 'demo-Pass#42' : '••••••••••'; };
  ACTS['add-pw'] = () => modal({ title: 'Add password', icon: 'key-round', body: `<div class="field"><span class="label">Site</span><input class="input" placeholder="e.g. Facebook"></div><div class="field"><span class="label">Username</span><input class="input"></div><div class="field"><span class="label">Password</span><div class="row"><input class="input" type="password" value="xxxxxxxxxxxx"><button class="btn" data-act="toast" data-msg="Strong password generated">${I('wand-sparkles', 14)}</button></div></div>` });
  MENUS.pw = [['plus', 'Add password', '', 'add-pw'], ['download', 'Export (encrypted)'], ['lock', 'Lock vault']];

  const VIEWS = { 'cover-page-generator': coverPage, 'bhara-koto': bharaKoto, 'money-tracker': takageloKoi, 'mess-meal': messMeal, 'life-planner': lifePlanner, 'digital-footprint': footprint, 'password-manager': passwords };
  register({ path: '/daily-life', title: 'Daily Life', group: 'Daily Life', icon: 'house', render: (sub) => {
    sub = VIEWS[sub] ? sub : 'money-tracker';
    return hero({ icon: 'house', eyebrow: 'Everyday tools', a: 'Daily ', b: 'Life', sub: 'Fares, money, meals, plans and passwords — the boring stuff, sorted.' }) + tabs('/daily-life', LT, sub) + VIEWS[sub]();
  } });
  register({ path: '/takagelokoi', title: 'TakaGeloKoi', group: 'Daily Life', icon: 'wallet', nav: '/daily-life', render: takageloKoi });
  register({ path: '/cover-page-generator', title: 'Cover Page Generator', group: 'Daily Life', icon: 'file-text', nav: '/daily-life', render: coverPage, hidden: true });
})();
