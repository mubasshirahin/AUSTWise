/* AUSTWise Design Docs — generic SVG diagram engine.
 * DOCS.add(id, spec) registers a diagram; DOCS.render(svg, spec) draws it.
 * spec: { title, sub, nodes[], edges[], groups[], seqs[], legend[] }
 * node: { id, type: entity|class|box|db|actor|usecase|state|start|end|decision|note|text, x, y, w?, h?, title, sub?, rows?, attrs?, methods?, lines?, stereo?, tone?, desc? }
 * edge: { from, to, fromRow?, toRow?, label?, detail?, head?, tail?, dash?, tone?, fromSide?, toSide?, fromLabel?, toLabel? }
 */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const C = {
    bg: '#1e1e1e', card: '#2a2a2a', head: '#333333', line: '#4a4a4a', text: '#e8e8e8', muted: '#9a9a9a', faint: '#6a6a6a',
    amber: '#F5A623', blue: '#0d99ff', green: '#2fbf71', rose: '#ef5b6b', violet: '#a78bfa', cyan: '#22c3d6', grey: '#8a8f98',
  };
  const TONE = { amber: C.amber, blue: C.blue, green: C.green, rose: C.rose, violet: C.violet, cyan: C.cyan, grey: C.grey };
  const ROW = 22, HEAD = 40, CH = 7.6; // char width estimate at 13px
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const wrap = (t, max) => { const out = []; let line = ''; for (const w of String(t).split(' ')) { if ((line + ' ' + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); } if (line) out.push(line); return out; };
  const KEYC = { PK: '#F5A623', FK: '#0d99ff', UQ: '#a78bfa', GET: '#2fbf71', POST: '#0d99ff', PUT: '#F5A623', PATCH: '#F5A623', DELETE: '#ef5b6b', ANY: '#8a8f98', '✓': '#2fbf71', '—': '#5a5a5a', ON: '#2fbf71', OFF: '#ef5b6b' };
  const tone = (n) => TONE[n.tone] || C.amber;

  /* ── sizes ── */
  function size(n) {
    if (n.type === 'entity') { n.w = n.w || 320; n.h = HEAD + (n.rows || []).length * ROW + 14; }
    else if (n.type === 'class') { n.w = n.w || Math.max(240, ...[n.title, ...(n.attrs || []), ...(n.methods || [])].map((s) => s.length * CH + 30)); n.h = HEAD + (n.stereo ? 14 : 0) + Math.max(1, (n.attrs || []).length) * ROW + Math.max(1, (n.methods || []).length) * ROW + 24; }
    else if (n.type === 'actor') { n.w = n.w || 90; n.h = 150; }
    else if (n.type === 'usecase') { n.w = n.w || 250; n._l = wrap(n.title, Math.floor(n.w / 8.5)); n.h = n.h || Math.max(70, 30 + n._l.length * 18); }
    else if (n.type === 'start' || n.type === 'end') { n.w = n.h = 36; }
    else if (n.type === 'decision') { n.w = n.w || 200; n.h = n.h || 110; n._l = wrap(n.title, 18); }
    else if (n.type === 'text') { n.w = n.w || n.title.length * 11; n.h = 30; }
    else { n.w = n.w || 260; n._l = (n.lines || []).flatMap((l) => wrap(l, Math.floor((n.w - 28) / CH))); n.h = n.h || HEAD + (n.sub ? 18 : 0) + n._l.length * 19 + (n._l.length ? 14 : 4) + (n.type === 'db' ? 26 : 0); }
    return n;
  }

  /* ── node drawing ── */
  function nodeSvg(n) {
    const { x, y, w, h } = n; const t = tone(n); let s = `<g class="dn" data-id="${esc(n.id)}">`;
    const title = (ty, cls = '') => `<text x="${x + w / 2}" y="${ty}" text-anchor="middle" class="t-title ${cls}">${esc(n.title)}</text>`;
    if (n.type === 'entity') {
      s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="box"/><path d="M${x} ${y + 8}a8 8 0 0 1 8-8h${w - 16}a8 8 0 0 1 8 8v${HEAD - 8}h-${w}z" fill="${C.head}"/><rect x="${x}" y="${y}" width="${w}" height="3" fill="${t}"/>`;
      s += `<text x="${x + 14}" y="${y + 25}" class="t-title">${esc(n.title)}</text>${n.sub ? `<text x="${x + w - 12}" y="${y + 25}" text-anchor="end" class="t-mono t-faint">${esc(n.sub)}</text>` : ''}`;
      (n.rows || []).forEach(([k, name, type], i) => {
        const ry = y + HEAD + 8 + i * ROW + 15;
        const kw = n.keyW || 26; if (k) s += `<rect x="${x + 10}" y="${ry - 12}" width="${kw}" height="16" rx="3" fill="${KEYC[k] || C.grey}" opacity=".9"/><text x="${x + 10 + kw / 2}" y="${ry}" text-anchor="middle" class="t-key">${esc(k)}</text>`;
        s += `<text x="${x + 18 + (n.keyW || 26)}" y="${ry}" class="t-mono ${k === 'PK' ? 't-strong' : ''}">${esc(name)}</text><text x="${x + w - 12}" y="${ry}" text-anchor="end" class="t-mono t-muted">${esc(type)}</text>`;
      });
    } else if (n.type === 'class') {
      const sy = n.stereo ? 14 : 0; const a = n.attrs || []; const m = n.methods || []; const ay = y + HEAD + sy; const my = ay + Math.max(1, a.length) * ROW + 12;
      s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" class="box"/><rect x="${x}" y="${y}" width="${w}" height="${HEAD + sy}" fill="${C.head}"/><rect x="${x}" y="${y}" width="${w}" height="3" fill="${t}"/>`;
      if (n.stereo) s += `<text x="${x + w / 2}" y="${y + 18}" text-anchor="middle" class="t-small t-muted">«${esc(n.stereo)}»</text>`;
      s += title(y + 27 + sy, n.abstract ? 't-italic' : '');
      s += `<line x1="${x}" y1="${ay}" x2="${x + w}" y2="${ay}" class="ln"/><line x1="${x}" y1="${my}" x2="${x + w}" y2="${my}" class="ln"/>`;
      a.forEach((r, i) => { s += `<text x="${x + 12}" y="${ay + 18 + i * ROW}" class="t-mono">${esc(r)}</text>`; });
      m.forEach((r, i) => { s += `<text x="${x + 12}" y="${my + 18 + i * ROW}" class="t-mono t-method">${esc(r)}</text>`; });
    } else if (n.type === 'actor') {
      const cx = x + w / 2;
      s += `<g stroke="${t}" stroke-width="3" fill="none" stroke-linecap="round"><circle cx="${cx}" cy="${y + 18}" r="16"/><line x1="${cx}" y1="${y + 34}" x2="${cx}" y2="${y + 82}"/><line x1="${cx - 28}" y1="${y + 50}" x2="${cx + 28}" y2="${y + 50}"/><line x1="${cx}" y1="${y + 82}" x2="${cx - 22}" y2="${y + 114}"/><line x1="${cx}" y1="${y + 82}" x2="${cx + 22}" y2="${y + 114}"/></g>`;
      s += `<text x="${cx}" y="${y + 140}" text-anchor="middle" class="t-title">${esc(n.title)}</text>`;
      s += `<rect x="${x - 20}" y="${y}" width="${w + 40}" height="${h}" fill="transparent"/>`;
    } else if (n.type === 'usecase') {
      s += `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" class="box" ${n.tone ? `stroke="${t}"` : ''}/>`;
      n._l.forEach((l, i) => { s += `<text x="${x + w / 2}" y="${y + h / 2 + 5 + (i - (n._l.length - 1) / 2) * 18}" text-anchor="middle" class="t-body">${esc(l)}</text>`; });
    } else if (n.type === 'start') {
      s += `<circle cx="${x + 18}" cy="${y + 18}" r="16" fill="${C.text}"/>`;
    } else if (n.type === 'end') {
      s += `<circle cx="${x + 18}" cy="${y + 18}" r="17" fill="none" stroke="${C.text}" stroke-width="2.5"/><circle cx="${x + 18}" cy="${y + 18}" r="10" fill="${C.text}"/>`;
    } else if (n.type === 'decision') {
      s += `<path d="M${x + w / 2} ${y}L${x + w} ${y + h / 2}L${x + w / 2} ${y + h}L${x} ${y + h / 2}Z" class="box" stroke="${t}"/>`;
      n._l.forEach((l, i) => { s += `<text x="${x + w / 2}" y="${y + h / 2 + 5 + (i - (n._l.length - 1) / 2) * 17}" text-anchor="middle" class="t-body">${esc(l)}</text>`; });
    } else if (n.type === 'text') {
      s += `<text x="${x}" y="${y + 22}" class="t-h">${esc(n.title)}</text>`;
    } else {
      const r = n.type === 'state' ? 22 : n.type === 'note' ? 2 : 8;
      if (n.type === 'db') {
        s += `<path d="M${x} ${y + 14}a${w / 2} 14 0 0 1 ${w} 0v${h - 28}a${w / 2} 14 0 0 1 -${w} 0z" class="box" stroke="${t}"/><path d="M${x} ${y + 14}a${w / 2} 14 0 0 0 ${w} 0" fill="none" stroke="${t}" stroke-width="2"/>`;
      } else {
        s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" class="box ${n.type === 'note' ? 'note' : ''}"/>`;
        if (n.type !== 'note' && n.type !== 'state') s += `<rect x="${x}" y="${y}" width="${w}" height="3" fill="${t}"/>`;
      }
      const ty = y + (n.type === 'db' ? 50 : 27);
      if (n.stereo) s += `<text x="${x + w / 2}" y="${ty - 14}" text-anchor="middle" class="t-small t-muted">«${esc(n.stereo)}»</text>`;
      s += `<text x="${x + w / 2}" y="${ty + (n.stereo ? 4 : 0)}" text-anchor="middle" class="t-title" ${n.type === 'state' ? `fill="${t}"` : ''}>${esc(n.title)}</text>`;
      if (n.sub) s += `<text x="${x + w / 2}" y="${ty + 19}" text-anchor="middle" class="t-small t-muted">${esc(n.sub)}</text>`;
      const ly = ty + (n.sub ? 42 : 24);
      (n._l || []).forEach((l, i) => { s += `<text x="${x + 14}" y="${ly + i * 19}" class="t-body t-muted">${esc(l)}</text>`; });
    }
    return s + '</g>';
  }

  /* ── edges ── */
  function anchor(n, other, row, side) {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2, ox = other.x + other.w / 2, oy = other.y + other.h / 2;
    if (row != null && n.rows) {
      const i = n.rows.findIndex((r) => r[1] === row); const ry = i < 0 ? n.y + HEAD / 2 : n.y + HEAD + 8 + i * ROW + 11;
      const right = side ? side === 'r' : ox > cx; return { x: right ? n.x + n.w : n.x, y: ry, nx: right ? 1 : -1, ny: 0 };
    }
    const dx = ox - cx, dy = oy - cy;
    const s = side || (Math.abs(dx) / (n.w + other.w) > Math.abs(dy) / (n.h + other.h) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'b' : 't'));
    if (n.type === 'usecase' || n.type === 'start' || n.type === 'end') {
      const a = Math.atan2(s === 't' ? -1 : s === 'b' ? 1 : 0, s === 'l' ? -1 : s === 'r' ? 1 : 0);
      return { x: cx + Math.cos(a) * n.w / 2, y: cy + Math.sin(a) * n.h / 2, nx: Math.round(Math.cos(a)), ny: Math.round(Math.sin(a)) };
    }
    if (s === 'r') return { x: n.x + n.w, y: cy, nx: 1, ny: 0 }; if (s === 'l') return { x: n.x, y: cy, nx: -1, ny: 0 };
    if (s === 'b') return { x: cx, y: n.y + n.h, nx: 0, ny: 1 }; return { x: cx, y: n.y, nx: 0, ny: -1 };
  }
  function headSvg(kind, p, dx, dy, col) {
    if (!kind || kind === 'none') return '';
    const L = Math.hypot(dx, dy) || 1; const ux = dx / L, uy = dy / L; const px = -uy, py = ux;
    const pt = (a, b) => `${p.x - ux * a + px * b},${p.y - uy * a + py * b}`;
    if (kind === 'arrow') return `<path d="M${pt(0, 0)} L${pt(16, 8)} L${pt(16, -8)} Z" fill="${col}"/>`;
    if (kind === 'open') return `<path d="M${pt(16, 9)} L${pt(0, 0)} L${pt(16, -9)}" fill="none" stroke="${col}" stroke-width="2.5"/>`;
    if (kind === 'triangle') return `<path d="M${pt(0, 0)} L${pt(20, 12)} L${pt(20, -12)} Z" fill="${C.bg}" stroke="${col}" stroke-width="2.5"/>`;
    if (kind === 'diamond' || kind === 'odiamond') return `<path d="M${pt(0, 0)} L${pt(13, 9)} L${pt(26, 0)} L${pt(13, -9)} Z" fill="${kind === 'diamond' ? col : C.bg}" stroke="${col}" stroke-width="2.5"/>`;
    if (kind === 'one') return `<path d="M${pt(12, 10)} L${pt(12, -10)} M${pt(20, 10)} L${pt(20, -10)}" stroke="${col}" stroke-width="2.5"/>`;
    if (kind === 'many') return `<path d="M${pt(0, 11)} L${pt(18, 0)} L${pt(0, -11)} M${pt(24, 10)} L${pt(24, -10)}" fill="none" stroke="${col}" stroke-width="2.5"/>`;
    if (kind === 'zmany') return `<path d="M${pt(0, 11)} L${pt(18, 0)} L${pt(0, -11)}" fill="none" stroke="${col}" stroke-width="2.5"/><circle cx="${p.x - ux * 30}" cy="${p.y - uy * 30}" r="6" fill="${C.bg}" stroke="${col}" stroke-width="2.5"/>`;
    return '';
  }
  function edgeSvg(e, byId, i) {
    const a = byId[e.from], b = byId[e.to]; if (!a || !b) { console.warn('edge: unknown node', e); return { svg: '', lab: '' }; }
    const col = TONE[e.tone] || (e.tone === 'u' ? C.blue : e.tone === 'd' ? C.amber : C.grey);
    let p1, p2;
    if (e.from === e.to) { // self loop
      p1 = { x: a.x + a.w, y: a.y + a.h * 0.3, nx: 1, ny: 0 }; p2 = { x: a.x + a.w, y: a.y + a.h * 0.7, nx: 1, ny: 0 };
    } else { p1 = anchor(a, b, e.fromRow, e.fromSide); p2 = anchor(b, a, e.toRow, e.toSide); }
    const d = e.from === e.to ? 90 : Math.max(50, Math.min(320, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.4));
    const c1 = { x: p1.x + p1.nx * d, y: p1.y + p1.ny * d }, c2 = { x: p2.x + p2.nx * d, y: p2.y + p2.ny * d };
    const path = e.straight ? `M${p1.x},${p1.y} L${p2.x},${p2.y}` : `M${p1.x},${p1.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
    const tA = e.straight ? p2 : c2, tB = e.straight ? p1 : c1;
    const mx = e.straight ? (p1.x + p2.x) / 2 : 0.125 * p1.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * p2.x;
    const my = e.straight ? (p1.y + p2.y) / 2 : 0.125 * p1.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * p2.y;
    let s = `<g class="de" data-e="${i}" data-a="${esc(e.from)}" data-b="${esc(e.to)}"><path d="${path}" fill="none" stroke="${col}" stroke-width="2.5" ${e.dash ? 'stroke-dasharray="10 7"' : ''}/>`;
    s += headSvg(e.head ?? 'arrow', p2, p2.x - tA.x, p2.y - tA.y, col) + headSvg(e.tail, p1, p1.x - tB.x, p1.y - tB.y, col);
    s += `<path d="${path}" fill="none" stroke="transparent" stroke-width="22" class="hit"/>`;
    const near = (p, c, k) => ({ x: p.x + (c.x - p.x) * k + (p.ny ? 14 : 0), y: p.y + (c.y - p.y) * k + (p.nx ? -12 : 0) });
    if (e.fromLabel) { const q = near(p1, c1, 0.18); s += `<text x="${q.x}" y="${q.y}" text-anchor="middle" class="t-mult">${esc(e.fromLabel)}</text>`; }
    if (e.toLabel) { const q = near(p2, c2, 0.18); s += `<text x="${q.x}" y="${q.y}" text-anchor="middle" class="t-mult">${esc(e.toLabel)}</text>`; }
    s += '</g>';
    let lab = '';
    if (e.label && !e.noLabel) { const tw = e.label.length * 6.9 + 18; lab = `<g class="dl" data-e="${i}"><rect x="${mx - tw / 2}" y="${my - 11}" width="${tw}" height="22" rx="11" fill="${C.bg}" stroke="${col}" stroke-width="1.5"/><text x="${mx}" y="${my + 4}" text-anchor="middle" class="t-label" fill="${col}">${esc(e.label)}</text></g>`; }
    return { svg: s, lab };
  }

  /* ── sequence diagrams ── */
  function seqSvg(q, nodes) {
    const GAP = q.gap || 250, top = q.y + 50, step = 54; let s = `<text x="${q.x}" y="${q.y + 20}" class="t-h">${esc(q.title)}</text>`;
    const xs = {}; q.actors.forEach(([id], i) => { xs[id] = q.x + i * GAP + 90; });
    const bottom = top + 80 + q.msgs.length * step + 40;
    q.actors.forEach(([id, label, kind], i) => {
      const x = xs[id]; const w = 170;
      s += `<line x1="${x}" y1="${top + 56}" x2="${x}" y2="${bottom}" stroke="${C.line}" stroke-width="2" stroke-dasharray="8 6"/>`;
      if (kind === 'actor') s += `<g stroke="${C.amber}" stroke-width="2.5" fill="none"><circle cx="${x}" cy="${top + 8}" r="9"/><line x1="${x}" y1="${top + 17}" x2="${x}" y2="${top + 34}"/><line x1="${x - 13}" y1="${top + 23}" x2="${x + 13}" y2="${top + 23}"/><line x1="${x}" y1="${top + 34}" x2="${x - 10}" y2="${top + 48}"/><line x1="${x}" y1="${top + 34}" x2="${x + 10}" y2="${top + 48}"/></g><text x="${x}" y="${top + 66}" text-anchor="middle" class="t-title">${esc(label)}</text>`;
      else s += `<rect x="${x - w / 2}" y="${top}" width="${w}" height="46" rx="6" class="box"/><rect x="${x - w / 2}" y="${top}" width="${w}" height="3" fill="${kind === 'db' ? C.violet : kind === 'ext' ? C.cyan : C.blue}"/><text x="${x}" y="${top + 28}" text-anchor="middle" class="t-title">${esc(label)}</text>`;
      nodes.push({ id: q.id + ':' + id, x: x - w / 2, y: top, w, h: bottom - top, title: label, desc: '' });
    });
    q.msgs.forEach(([f, t, label, kind], i) => {
      const y = top + 100 + i * step; const x1 = xs[f], x2 = xs[t]; const col = kind === 'reply' ? C.muted : kind === 'async' ? C.amber : C.blue;
      s += `<text x="${q.x - 10}" y="${y + 4}" text-anchor="end" class="t-small t-faint">${i + 1}</text>`;
      if (f === t) { s += `<path d="M${x1},${y - 8} h46 v26 h-40" fill="none" stroke="${col}" stroke-width="2"/>${headSvg('arrow', { x: x1 + 4, y: y + 18 }, -1, 0, col)}<text x="${x1 + 56}" y="${y + 9}" class="t-body">${esc(label)}</text>`; return; }
      s += `<line x1="${x1}" y1="${y}" x2="${x2 - Math.sign(x2 - x1) * 2}" y2="${y}" stroke="${col}" stroke-width="2" ${kind === 'reply' ? 'stroke-dasharray="8 5"' : ''}/>${headSvg(kind === 'reply' || kind === 'async' ? 'open' : 'arrow', { x: x2, y }, x2 - x1, 0, col)}`;
      s += `<text x="${(x1 + x2) / 2}" y="${y - 8}" text-anchor="middle" class="t-body">${esc(label)}</text>`;
    });
    return s;
  }

  /* ── render ── */
  function render(svg, spec) {
    const nodes = (spec.nodes || []).map((n) => size({ ...n }));
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    let gs = '', es = '', ls = '', ns = '', qs = '';
    for (const g of spec.groups || []) gs += `<g class="dg"><rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="16" fill="none" stroke="${TONE[g.tone] || C.line}" stroke-width="2" stroke-dasharray="${g.solid ? '' : '12 8'}"/><text x="${g.x + 20}" y="${g.y + 34}" class="t-h">${esc(g.title)}</text>${g.sub ? `<text x="${g.x + 20}" y="${g.y + 56}" class="t-small t-muted">${esc(g.sub)}</text>` : ''}</g>`;
    const extraNodes = []; for (const q of spec.seqs || []) qs += seqSvg(q, extraNodes);
    (spec.edges || []).forEach((e, i) => { const r = edgeSvg(e, byId, i); es += r.svg; ls += r.lab; });
    for (const n of nodes) ns += nodeSvg(n);
    svg.innerHTML = `<style>${CSS}</style><g id="world">${gs}${qs}${es}${ns}${ls}</g>`;
    const all = [...nodes, ...extraNodes, ...(spec.groups || [])];
    const b = all.reduce((a, n) => ({ x0: Math.min(a.x0, n.x), y0: Math.min(a.y0, n.y), x1: Math.max(a.x1, n.x + (n.w || 0)), y1: Math.max(a.y1, n.y + (n.h || 0)) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
    return { nodes: byId, bounds: { x: b.x0 - 60, y: b.y0 - 60, w: b.x1 - b.x0 + 120, h: b.y1 - b.y0 + 120 } };
  }
  const CSS = `
    text { font-family: Inter, system-ui, sans-serif; fill: ${C.text}; }
    .box { fill: ${C.card}; stroke: ${C.line}; stroke-width: 2; } .box.note { fill: #2f2a1e; stroke: ${C.amber}; stroke-dasharray: 6 5; }
    .ln { stroke: ${C.line}; stroke-width: 1.5; }
    .t-title { font-size: 15px; font-weight: 700; } .t-italic { font-style: italic; }
    .t-h { font-size: 26px; font-weight: 800; fill: ${C.text}; }
    .t-body { font-size: 13px; } .t-small { font-size: 11px; }
    .t-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12.5px; } .t-method { fill: #b9d7ff; }
    .t-muted { fill: ${C.muted}; } .t-faint { fill: ${C.faint}; } .t-strong { font-weight: 700; fill: #fff; }
    .t-key { font-size: 9.5px; font-weight: 800; fill: #111; font-family: Inter, sans-serif; }
    .t-label { font-size: 11.5px; font-weight: 600; } .t-mult { font-size: 13px; font-weight: 700; fill: ${C.text}; }
    .dim { opacity: .12; } .hit { cursor: pointer; } .dn { cursor: pointer; }
  `;
  window.DOCS = { list: [], specs: {}, add(id, spec) { this.specs[id] = spec; }, render, C, esc };
})();
