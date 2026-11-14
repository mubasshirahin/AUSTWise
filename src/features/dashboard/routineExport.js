/**
 * Routine Grid export — draws the routine straight onto a <canvas> from data
 * (no DOM cloning / html2canvas), so the output never depends on the live
 * grid's zoom, scroll, highlight or scoped CSS.
 *
 *  • JPG  → portrait phone wallpaper (1170×2532). The top ~third is left clear
 *           for the lock-screen clock; the bottom keeps clear of the
 *           flashlight / camera buttons.
 *  • PDF  → A4 landscape poster (300 dpi), days as rows like the app grid.
 *
 * House style (CLAUDE.md / skill-style): flat theme surfaces only — no
 * gradients, glows, tints or accent rails. Accent colour is used for text.
 */

const FALLBACK = {
  bg: '#0E0E10', card: '#1B1B1F', input: '#222227', border: '#2A2A2E',
  text: '#F2F2F3', text2: '#9A9AA0', text3: '#6E6E75', accent: '#F5A623',
};

// Resolve a theme token to an opaque rgb() the canvas can use. Painting the
// value onto a 1×1 canvas handles var() chains, color-mix(), oklch(), rgba…
function readPalette() {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  const pctx = probe.getContext('2d', { willReadFrequently: true });

  const resolve = (token, fallback, under) => {
    const raw = cs.getPropertyValue(token).trim();
    pctx.globalCompositeOperation = 'copy';
    pctx.fillStyle = under || '#000';
    pctx.fillRect(0, 0, 1, 1);
    pctx.globalCompositeOperation = 'source-over';
    pctx.fillStyle = fallback;
    if (raw) pctx.fillStyle = raw; // ignored by canvas if unparseable
    pctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = pctx.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  };

  const bg = resolve('--bg-primary', FALLBACK.bg);
  return {
    bg,
    card: resolve('--bg-card', FALLBACK.card, bg),
    input: resolve('--bg-input', FALLBACK.input, bg),
    border: resolve('--border-primary', FALLBACK.border, bg),
    text: resolve('--text-primary', FALLBACK.text, bg),
    text2: resolve('--text-secondary', FALLBACK.text2, bg),
    text3: resolve('--text-tertiary', FALLBACK.text3, bg),
    accent: resolve('--accent-amber', FALLBACK.accent, bg),
    font: (cs.getPropertyValue('--font-primary').trim()
      || getComputedStyle(document.body).fontFamily
      || 'system-ui, sans-serif'),
  };
}

async function loadLogo(url) {
  try {
    // The SVG only has a viewBox; give it a size so every browser rasterises it.
    const svg = await (await fetch(url)).text();
    const sized = svg.replace(/<svg\b/, '<svg width="400" height="400"');
    const blobUrl = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = blobUrl; });
    return img;
  } catch {
    return null;
  }
}

// ─── text helpers ───
const setFont = (ctx, P, size, weight = 400) => { ctx.font = `${weight} ${size}px ${P.font}`; };

function ellipsize(ctx, text, maxW) {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function wrap(ctx, text, maxW, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= maxW || !cur) { cur = next; continue; }
    lines.push(cur);
    cur = words[i];
    if (lines.length === maxLines - 1) { cur = words.slice(i).join(' '); break; }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines).map((l, i, a) => (i === a.length - 1 ? ellipsize(ctx, l, maxW) : l));
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

const tracked = (ctx, px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`; };

// ─── data ───
// Group each day's classes by start slot → [{ startIdx, colSpan, classes[] }]
function buildGroups(routine, weekDays, getSlotDetails, slotCount) {
  const byDay = {};
  let minIdx = Infinity;
  weekDays.forEach((day) => {
    const map = new Map();
    (routine[day] || []).forEach((cls) => {
      if (!cls?.time) return;
      const { startIdx, colSpan } = getSlotDetails(cls.time);
      if (startIdx >= slotCount) return;
      const g = map.get(startIdx) || { startIdx, colSpan: 0, classes: [] };
      g.colSpan = Math.max(g.colSpan, colSpan);
      g.classes.push(cls);
      map.set(startIdx, g);
      minIdx = Math.min(minIdx, startIdx);
    });
    byDay[day] = [...map.values()].map((g) => {
      // Bi-weekly pairs: Week 1 first, then Week 2.
      if (g.classes.some((c) => c.biWeekly)) {
        g.classes.sort((a, b) => (a.weekGroup === 'second') - (b.weekGroup === 'second'));
      }
      return g;
    });
  });
  // Always export the full day (08:00 → last slot), even empty periods.
  return {
    byDay,
    empty: !Number.isFinite(minIdx),
    from: 0,
    to: slotCount,
  };
}

const courseName = (cls) => String(cls?.name || '').split('(')[0].trim();

function tagFor(cls) {
  const bits = [];
  if (cls.biWeekly) bits.push(cls.weekGroup === 'second' ? 'Week 2' : 'Week 1');
  if (cls.part) bits.push(`Part ${cls.part}`);
  if (!bits.length && /lab/i.test(cls.type || '')) bits.push('Lab');
  return bits.join(' · ');
}

/**
 * Draw one class (or a slice of a shared block) inside a box. Lines are
 * dropped by priority until what remains fits the height:
 * code → room → teacher → tag → name.
 */
function drawClass(ctx, P, cls, box, S) {
  const padX = S.pad;
  const maxW = box.w - padX * 2;
  if (maxW <= 4) return;

  const candidates = [
    { key: 'tag', pri: cls.biWeekly ? 3.5 : 4, size: S.tag, weight: 700, color: P.accent, text: tagFor(cls).toUpperCase(), track: S.tag * 0.08 },
    { key: 'code', pri: 1, size: S.code, weight: 800, color: P.accent, text: cls.course || courseName(cls) || 'Class' },
    { key: 'name', pri: 5, size: S.name, weight: 500, color: P.text, text: S.showName ? courseName(cls) : '', lines: 2 },
    { key: 'room', pri: 2, size: S.room, weight: 600, color: P.text2, text: cls.room || '' },
    { key: 'teacher', pri: 3, size: S.teacher, weight: 600, color: P.text3, text: S.showTeacher && cls.teacher && cls.teacher !== 'TBA' ? cls.teacher : '' },
  ].filter((l) => l.text);

  // Measure (wrap names), then drop low-priority lines until it fits.
  const measured = candidates.map((l) => {
    setFont(ctx, P, l.size, l.weight);
    tracked(ctx, l.track || 0);
    const rows = l.lines ? wrap(ctx, l.text, maxW, l.lines) : [ellipsize(ctx, l.text, maxW)];
    tracked(ctx, 0);
    return { ...l, rows, h: rows.length * l.size * 1.22 };
  });
  const gap = S.lineGap;
  const total = (ls) => ls.reduce((s, l) => s + l.h, 0) + Math.max(0, ls.length - 1) * gap;
  let lines = measured;
  while (lines.length > 1 && total(lines) > box.h - S.padY * 2) {
    const worst = lines.reduce((a, b) => (b.pri > a.pri ? b : a));
    lines = lines.filter((l) => l !== worst);
  }

  let y = box.y + (box.h - total(lines)) / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const cx = box.x + box.w / 2;
  lines.forEach((l) => {
    setFont(ctx, P, l.size, l.weight);
    tracked(ctx, l.track || 0);
    ctx.fillStyle = l.color;
    l.rows.forEach((row, i) => ctx.fillText(row, cx, y + i * l.size * 1.22 + l.size * 0.06));
    tracked(ctx, 0);
    y += l.h + gap;
  });
}

/**
 * Draw the routine as a bordered matrix (table): a header row, a header
 * column, a line around every cell, and classes filling their (merged) cells.
 *
 * M = { x, y, headW, headH, cellW, cellH, nCols, nRows,
 *       colLabels: [{ main, sub }], rowLabels: [{ main, sub }],
 *       items: [{ col, row, colSpan, rowSpan, group }],
 *       lw, radius, labelMain, labelSub, labelTrack }
 */
function drawMatrix(ctx, P, M, S) {
  const W = M.headW + M.cellW * M.nCols;
  const H = M.headH + M.cellH * M.nRows;
  const cx = (c) => M.x + M.headW + M.cellW * c;
  const cy = (r) => M.y + M.headH + M.cellH * r;
  const half = M.lw / 2;

  ctx.save();
  roundRect(ctx, M.x, M.y, W, H, M.radius);
  ctx.clip();

  // Header row + header column surfaces
  ctx.fillStyle = P.card;
  ctx.fillRect(M.x, M.y, W, M.headH);
  ctx.fillRect(M.x, M.y, M.headW, H);

  // Every cell line
  ctx.strokeStyle = P.border;
  ctx.lineWidth = M.lw;
  ctx.beginPath();
  for (let c = 0; c <= M.nCols; c++) {
    const x = c === 0 ? M.x + M.headW : cx(c);
    ctx.moveTo(x, M.y); ctx.lineTo(x, M.y + H);
  }
  for (let r = 0; r <= M.nRows; r++) {
    const y = r === 0 ? M.y + M.headH : cy(r);
    ctx.moveTo(M.x, y); ctx.lineTo(M.x + W, y);
  }
  ctx.stroke();

  // Class cells: fill the merged area (covers the inner lines of the span)
  M.items.forEach(({ col, row, colSpan, rowSpan, group }) => {
    const box = {
      x: cx(col) + half, y: cy(row) + half,
      w: M.cellW * colSpan - M.lw, h: M.cellH * rowSpan - M.lw,
    };
    ctx.fillStyle = P.input;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    const n = group.classes.length;
    group.classes.forEach((cls, i) => {
      const slice = { x: box.x, y: box.y + (box.h / n) * i, w: box.w, h: box.h / n };
      if (i > 0) {
        ctx.beginPath();
        ctx.strokeStyle = P.border;
        ctx.lineWidth = M.lw;
        ctx.setLineDash([M.lw * 3, M.lw * 3]);
        ctx.moveTo(box.x, slice.y); ctx.lineTo(box.x + box.w, slice.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      drawClass(ctx, P, cls, slice, S);
    });
  });
  ctx.restore();

  // Outer border
  roundRect(ctx, M.x + half, M.y + half, W - M.lw, H - M.lw, M.radius);
  ctx.strokeStyle = P.border;
  ctx.lineWidth = M.lw;
  ctx.stroke();

  // Header labels
  const label = (lab, x, y, w, h) => {
    if (!lab) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const twoLine = !!lab.sub;
    setFont(ctx, P, M.labelMain, 800);
    tracked(ctx, M.labelTrack || 0);
    ctx.fillStyle = P.text;
    ctx.fillText(ellipsize(ctx, lab.main, w - 6), x + w / 2, y + h / 2 - (twoLine ? M.labelSub * 0.62 : 0));
    tracked(ctx, 0);
    if (twoLine) {
      setFont(ctx, P, M.labelSub, 600);
      ctx.fillStyle = P.text3;
      ctx.fillText(ellipsize(ctx, lab.sub, w - 6), x + w / 2, y + h / 2 + M.labelMain * 0.62);
    }
  };
  if (M.corner) label({ main: M.corner }, M.x, M.y, M.headW, M.headH);
  M.colLabels.forEach((lab, c) => label(lab, cx(c), M.y, M.cellW, M.headH));
  M.rowLabels.forEach((lab, r) => label(lab, M.x, cy(r), M.headW, M.cellH));

  return { w: W, h: H };
}

// "08:00-08:50" → { main: '08:00', sub: '08:50' }
const timeLabel = (s) => {
  const [a, b] = String(s || '').split('-');
  return { main: (a || '').trim(), sub: (b || '').trim() };
};

function drawBrand(ctx, P, logo, x, y, size, align = 'left', subtitle = '') {
  setFont(ctx, P, size * 0.62, 800);
  const nameW = ctx.measureText('AUSTWise').width;
  const totalW = size + size * 0.32 + nameW;
  const left = align === 'center' ? x - totalW / 2 : x;
  if (logo) ctx.drawImage(logo, left, y, size, size);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = P.text;
  const tx = left + size + size * 0.32;
  if (subtitle) {
    ctx.fillText('AUSTWise', tx, y + size * 0.36);
    setFont(ctx, P, size * 0.24, 600);
    tracked(ctx, size * 0.03);
    ctx.fillStyle = P.text3;
    ctx.fillText(subtitle.toUpperCase(), tx, y + size * 0.8);
    tracked(ctx, 0);
  } else {
    ctx.fillText('AUSTWise', tx, y + size / 2);
  }
}

function formatSemester(s) {
  const m = String(s || '').match(/Year\s*(\d+)\s*-\s*Semester\s*(\d+)/i);
  if (!m) return s || '';
  const ord = (n) => n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n] || 'th');
  return `${ord(+m[1])} Year · ${ord(+m[2])} Sem`;
}

// ─── JPG: lock-screen wallpaper ───
function renderWallpaper({ P, logo, groups, weekDays, slotLabels, meta }) {
  const W = 1170;
  const H = 2532;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, H);

  const mx = 56;
  const safeTop = 820;        // below the lock-screen clock + widgets
  const safeBottom = H - 280; // above flashlight / camera shortcuts
  const headerH = 140;
  const footerH = 84;
  const headW = 120;
  const headH = 72;
  const nDays = Math.max(1, weekDays.length);
  const rows = Math.max(1, groups.to - groups.from);
  const cellW = (W - mx * 2 - headW) / nDays;
  const avail = safeBottom - safeTop - headerH - footerH - headH;
  const cellH = Math.max(76, Math.min(160, avail / rows));
  const tableH = headH + cellH * rows;
  const blockH = headerH + tableH + footerH;
  const top = safeTop + Math.max(0, (safeBottom - safeTop - blockH) / 2);

  // Title
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  setFont(ctx, P, 26, 700);
  tracked(ctx, 4);
  ctx.fillStyle = P.accent;
  ctx.fillText('WEEKLY ROUTINE', mx, top + 34);
  tracked(ctx, 0);
  const title = [meta.dept, formatSemester(meta.sem)].filter(Boolean).join(' · ') || 'My Classes';
  setFont(ctx, P, 54, 800);
  ctx.fillStyle = P.text;
  ctx.fillText(ellipsize(ctx, title, W - mx * 2), mx, top + 100);

  // Matrix: days across, time slots down
  const items = [];
  weekDays.forEach((day, col) => {
    (groups.byDay[day] || []).forEach((g) => {
      const row = g.startIdx - groups.from;
      if (row < 0 || row >= rows) return;
      items.push({ col, row, colSpan: 1, rowSpan: Math.min(g.colSpan, rows - row), group: g });
    });
  });
  const S = {
    pad: 8, padY: 3, lineGap: 1,
    code: Math.min(28, cellW * 0.16), tag: 15, name: 18, room: 20, teacher: 17,
    showName: cellW > 200, showTeacher: true,
  };
  drawMatrix(ctx, P, {
    x: mx, y: top + headerH, headW, headH, cellW, cellH, nCols: nDays, nRows: rows,
    colLabels: weekDays.map((d) => ({ main: d.slice(0, 3).toUpperCase() })),
    rowLabels: Array.from({ length: rows }, (_, r) => timeLabel(slotLabels[groups.from + r])),
    corner: 'TIME',
    items, lw: 2, radius: 22, labelMain: 26, labelSub: 19, labelTrack: 1,
  }, S);

  if (groups.empty) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    setFont(ctx, P, 30, 600);
    ctx.fillStyle = P.text3;
    ctx.fillText('No classes yet', mx + headW + (cellW * nDays) / 2, top + headerH + headH + (cellH * rows) / 2);
  }

  drawBrand(ctx, P, logo, W / 2, top + headerH + tableH + 32, 40, 'center');
  return canvas;
}

// ─── PDF: A4 landscape poster ───
function renderSheet({ P, logo, groups, weekDays, slotLabels, meta }) {
  const W = 1123; // A4 @ 96dpi, drawn at ×3.125 → 300dpi
  const H = 794;
  const k = 3508 / W;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * k);
  canvas.height = Math.round(H * k);
  const ctx = canvas.getContext('2d');
  ctx.scale(k, k);
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, H);

  const mx = 40;
  // Header: brand · dept/sem · generated
  drawBrand(ctx, P, logo, mx, 34, 40, 'left', 'Weekly Routine');
  ctx.textBaseline = 'alphabetic';
  const centre = [meta.dept, formatSemester(meta.sem)].filter(Boolean).join(' · ');
  if (centre) {
    ctx.textAlign = 'center';
    setFont(ctx, P, 16, 700);
    ctx.fillStyle = P.text;
    ctx.fillText(centre, W / 2, 60);
  }
  ctx.textAlign = 'right';
  setFont(ctx, P, 9, 700);
  tracked(ctx, 1.2);
  ctx.fillStyle = P.text3;
  ctx.fillText('GENERATED', W - mx, 50);
  tracked(ctx, 0);
  setFont(ctx, P, 13, 700);
  ctx.fillStyle = P.text;
  ctx.fillText(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }), W - mx, 68);

  ctx.strokeStyle = P.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(mx, 96.5);
  ctx.lineTo(W - mx, 96.5);
  ctx.stroke();

  // Matrix: time slots across, days down
  const top = 116;
  const bottom = H - 50;
  const headW = 76;
  const headH = 40;
  const cols = Math.max(1, groups.to - groups.from);
  const nDays = Math.max(1, weekDays.length);
  const cellW = (W - mx * 2 - headW) / cols;
  const cellH = Math.min(118, (bottom - top - headH) / nDays);
  const items = [];
  weekDays.forEach((day, row) => {
    (groups.byDay[day] || []).forEach((g) => {
      const col = g.startIdx - groups.from;
      if (col < 0 || col >= cols) return;
      items.push({ col, row, colSpan: Math.min(g.colSpan, cols - col), rowSpan: 1, group: g });
    });
  });
  const S = {
    pad: 4, padY: 3, lineGap: 2,
    code: Math.min(12, cellW * 0.15), tag: 7, name: 8.5, room: 9, teacher: 8,
    showName: true, showTeacher: true,
  };
  drawMatrix(ctx, P, {
    x: mx, y: top, headW, headH, cellW, cellH, nCols: cols, nRows: nDays,
    colLabels: Array.from({ length: cols }, (_, c) => timeLabel(slotLabels[groups.from + c])),
    rowLabels: weekDays.map((d) => ({ main: d.slice(0, 3).toUpperCase() })),
    corner: 'DAY',
    items, lw: 1, radius: 10, labelMain: 10, labelSub: 8, labelTrack: 0.6,
  }, S);

  if (groups.empty) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    setFont(ctx, P, 14, 600);
    ctx.fillStyle = P.text3;
    ctx.fillText('No classes yet', mx + headW + (cellW * cols) / 2, top + headH + (cellH * nDays) / 2);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  setFont(ctx, P, 9, 600);
  tracked(ctx, 1);
  ctx.fillStyle = P.text3;
  ctx.fillText('MADE WITH AUSTWISE', W / 2, H - 24);
  tracked(ctx, 0);
  return canvas;
}

async function prepare(opts) {
  if (document.fonts?.ready) { try { await document.fonts.ready; } catch { /* ignore */ } }
  const P = readPalette();
  const logo = await loadLogo(opts.logoUrl);
  const groups = buildGroups(opts.routine, opts.weekDays, opts.getSlotDetails, opts.slotLabels.length);
  return { ...opts, P, logo, groups };
}

const toBlob = (canvas, type, quality) =>
  new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Render failed'))), type, quality));

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Phone-wallpaper JPG. On phones, opens the share sheet ("Save Image"). */
export async function exportRoutineJPG(opts) {
  const ctx = await prepare(opts);
  const canvas = renderWallpaper(ctx);
  const blob = await toBlob(canvas, 'image/jpeg', 0.95);
  const filename = 'AUSTWise-Routine-Wallpaper.jpg';
  const file = typeof File === 'function' ? new File([blob], filename, { type: 'image/jpeg' }) : null;
  const isTouch = window.matchMedia?.('(pointer: coarse)').matches;
  if (isTouch && file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'My routine' });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return; // user closed the sheet
      // NotAllowedError etc. → fall back to a normal download
    }
  }
  saveBlob(blob, filename);
}

/** A4 landscape PDF poster. */
export async function exportRoutinePDF(opts) {
  const [{ default: jsPDF }, ctx] = await Promise.all([import('jspdf'), prepare(opts)]);
  const canvas = renderSheet(ctx);
  const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 297, 210);
  pdf.save('AUSTWise-Routine.pdf');
}

// Shared drawing helpers (used by the Semester View export too).
export { readPalette, loadLogo, setFont, ellipsize, wrap, roundRect, tracked, drawBrand, formatSemester, toBlob, saveBlob };
