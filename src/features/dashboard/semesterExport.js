/**
 * Semester View (14-Weeks View) export — same approach and house style as the
 * Routine Grid export (routineExport.js): drawn straight onto a <canvas> from
 * data, in the current theme's colours, flat surfaces only.
 *
 * The export follows the layout chosen in the widget:
 *  • Box  → Week: 7-column sheet · Month: calendar
 *  • List → one row per day (a month list splits into two columns)
 *  • Day view is always a list.
 *
 *  • JPG → portrait phone wallpaper (1170×2532), clock / shortcut areas kept clear.
 *  • PDF → A4 landscape poster (300 dpi).
 *
 * Each task reads "CODE  title" on its first line (e.g. "CSE3101 quiz 1"),
 * then syllabus · batch · time in small text when there is room.
 *
 * opts = {
 *   viewMode: 'daily' | 'weekly' | 'monthly', layout: 'box' | 'list',
 *   cells: [{ date, tasks, today, before } | null],  // Fri-start, null = pad
 *   periodLabel, filterLabel, meta: { dept, sem }, logoUrl,
 * }
 */
import {
  readPalette, loadLogo, setFont, ellipsize, wrap, roundRect, tracked,
  drawBrand, formatSemester, toBlob, saveBlob,
} from './routineExport';

const WEEKDAYS = ['FRI', 'SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU'];

// Words of `text` that fit in `w` on the current font → [first, rest].
function splitFirstLine(ctx, text, w) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  let first = '';
  let i = 0;
  for (; i < words.length; i++) {
    const next = first ? `${first} ${words[i]}` : words[i];
    if (ctx.measureText(next).width > w) break;
    first = next;
  }
  return [first, words.slice(i).join(' ')];
}

/**
 * Measure one task: "CODE title" on line 1 (title continues on up to
 * S.titleLines - 1 more lines), then a small meta line
 * (syllabus · batch · time) when S.showSub.
 */
function measureTask(ctx, P, t, maxW, S) {
  const code = t.courseCode || '';
  const title = t.title || (code ? '' : 'Task');
  setFont(ctx, P, S.code, 800);
  const codeW = code ? ctx.measureText(code).width + S.code * 0.45 : 0;
  setFont(ctx, P, S.code, 600);
  const room = maxW - codeW;
  const maxLines = Math.max(1, S.titleLines);
  let first = '';
  let extra = [];
  if (title) {
    if (maxLines === 1) {
      first = room > S.code * 2 ? ellipsize(ctx, title, room) : '';
    } else {
      // Narrow cell: if the whole title doesn't fit beside the code, start it
      // on its own line instead of splitting it ("quiz" / "1").
      const beside = ctx.measureText(title).width <= room || room >= maxW * 0.5;
      const [f, rest] = beside && room > S.code * 2 ? splitFirstLine(ctx, title, room) : ['', title];
      first = f;
      if (rest) extra = wrap(ctx, rest, maxW, maxLines - 1);
    }
  }
  const meta = S.showSub ? [t.syllabus, t.batchGroup, t.time].filter(Boolean).join(' · ') : '';
  const lineH = S.code * 1.28;
  const h = lineH * (1 + extra.length) + (meta ? S.sub * 1.35 : 0);
  return { code, codeW, first, extra, meta, h, lineH };
}

function drawTask(ctx, P, m, x, y, maxW, S) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  if (m.code) {
    setFont(ctx, P, S.code, 800);
    ctx.fillStyle = P.accent;
    ctx.fillText(ellipsize(ctx, m.code, maxW), x, y);
  }
  setFont(ctx, P, S.code, 600);
  ctx.fillStyle = P.text;
  if (m.first) ctx.fillText(m.first, x + m.codeW, y);
  let cy = y + m.lineH;
  m.extra.forEach((row) => { ctx.fillText(row, x, cy); cy += m.lineH; });
  if (m.meta) {
    setFont(ctx, P, S.sub, 600);
    ctx.fillStyle = P.text3;
    ctx.fillText(ellipsize(ctx, m.meta, maxW), x, cy + S.sub * 0.1);
  }
}

/**
 * Calendar matrix (Box layout): weekday header row, bordered cells, each
 * cell with its date and as many tasks as fit ("+n more" for the rest).
 * A one-row sheet (a week) puts the date in the header instead.
 */
function drawCalendar(ctx, P, C) {
  const { x, y, w, h, cols, cells, headH, lw, radius, S } = C;
  const rows = Math.max(1, Math.ceil(cells.length / cols));
  const cellW = w / cols;
  const cellH = (h - headH) / rows;
  const half = lw / 2;
  const cx = (c) => x + cellW * c;
  const cy = (r) => y + headH + cellH * r;

  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  ctx.fillStyle = P.card;
  ctx.fillRect(x, y, w, headH);
  cells.forEach((cell, i) => {
    if (cell && cell.tasks.length && !cell.before) {
      ctx.fillStyle = P.input;
      ctx.fillRect(cx(i % cols), cy(Math.floor(i / cols)), cellW, cellH);
    }
  });
  ctx.strokeStyle = P.border;
  ctx.lineWidth = lw;
  ctx.beginPath();
  for (let c = 1; c < cols; c++) { ctx.moveTo(cx(c), y); ctx.lineTo(cx(c), y + h); }
  for (let r = 0; r < rows; r++) { ctx.moveTo(x, cy(r)); ctx.lineTo(x + w, cy(r)); }
  ctx.stroke();
  ctx.restore();

  roundRect(ctx, x + half, y + half, w - lw, h - lw, radius);
  ctx.strokeStyle = P.border;
  ctx.lineWidth = lw;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let c = 0; c < cols; c++) {
    const cell = rows === 1 ? cells[c] : null;
    const main = cell ? cell.date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() : WEEKDAYS[c];
    setFont(ctx, P, S.head, 800);
    tracked(ctx, S.head * 0.08);
    ctx.fillStyle = cell?.today ? P.accent : P.text;
    if (cell) {
      ctx.fillText(main, cx(c) + cellW / 2, y + headH / 2 - S.headSub * 0.62);
      tracked(ctx, 0);
      setFont(ctx, P, S.headSub, 600);
      ctx.fillStyle = cell.today ? P.accent : P.text3;
      ctx.fillText(cell.date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }), cx(c) + cellW / 2, y + headH / 2 + S.head * 0.62);
    } else {
      ctx.fillText(main, cx(c) + cellW / 2, y + headH / 2);
      tracked(ctx, 0);
    }
  }

  cells.forEach((cell, i) => {
    if (!cell) return;
    const bx = cx(i % cols);
    const by = cy(Math.floor(i / cols));
    const pad = S.pad;
    const maxW = cellW - pad * 2;
    let ty = by + pad;

    if (rows > 1) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      setFont(ctx, P, S.num, 800);
      ctx.fillStyle = cell.before ? P.text3 : cell.today ? P.accent : P.text;
      ctx.fillText(String(cell.date.getDate()), bx + pad, ty);
      ty += S.num * 1.25 + S.gap;
    }
    if (cell.today) {
      roundRect(ctx, bx + lw * 1.5, by + lw * 1.5, cellW - lw * 3, cellH - lw * 3, Math.max(2, radius * 0.35));
      ctx.strokeStyle = P.accent;
      ctx.lineWidth = lw * 1.5;
      ctx.stroke();
    }
    if (cell.before || !cell.tasks.length) {
      if (rows === 1 && !cell.before) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        setFont(ctx, P, S.title, 500);
        ctx.fillStyle = P.text3;
        ctx.fillText('Clear', bx + cellW / 2, by + cellH / 2);
      }
      return;
    }

    const bottom = by + cellH - pad;
    const measured = cell.tasks.map((t) => measureTask(ctx, P, t, maxW, S));
    const moreH = S.sub * 1.3;
    let drawn = 0;
    for (let k = 0; k < measured.length; k++) {
      const m = measured[k];
      const left = measured.length - k - 1;
      if (ty + m.h + (left > 0 ? S.gap + moreH : 0) > bottom && k > 0) break;
      if (ty + m.h > bottom) break;
      drawTask(ctx, P, m, bx + pad, ty, maxW, S);
      ty += m.h + S.gap;
      drawn++;
    }
    const rest = cell.tasks.length - drawn;
    if (rest > 0) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      setFont(ctx, P, S.sub, 700);
      ctx.fillStyle = P.text3;
      ctx.fillText(drawn ? `+${rest} more` : `${rest} task${rest > 1 ? 's' : ''}`, bx + pad, Math.min(ty, bottom - S.sub * 1.2));
    }
  });
}

/** Day list (List layout): measure every row at width `w`. */
function layoutDayList(ctx, P, rows, w, S) {
  const bodyW = w - S.dateW - S.pad * 2;
  return rows.map((r) => {
    const tasks = r.before ? [] : r.tasks.map((t) => measureTask(ctx, P, t, bodyW - S.cardPad * 2, S));
    const tasksH = tasks.reduce((s, m) => s + m.h + S.cardPad * 2, 0) + Math.max(0, tasks.length - 1) * S.gap;
    const h = Math.max(S.minRow, (tasks.length ? tasksH : S.title * 1.25) + S.pad * 2);
    return { ...r, measured: tasks, h };
  });
}

/** One row per day — date block · task cards ("Clear" when none). */
function drawDayList(ctx, P, x, y, w, laid, S) {
  const total = laid.reduce((s, r) => s + r.h, 0);
  const half = S.lw / 2;
  ctx.save();
  roundRect(ctx, x, y, w, total, S.radius);
  ctx.clip();
  ctx.fillStyle = P.card;
  ctx.fillRect(x, y, S.dateW, total);
  let ry = y;
  ctx.strokeStyle = P.border;
  ctx.lineWidth = S.lw;
  ctx.beginPath();
  ctx.moveTo(x + S.dateW, y); ctx.lineTo(x + S.dateW, y + total);
  laid.forEach((r, i) => { if (i) { ctx.moveTo(x, ry); ctx.lineTo(x + w, ry); } ry += r.h; });
  ctx.stroke();
  ctx.restore();
  roundRect(ctx, x + half, y + half, w - S.lw, total - S.lw, S.radius);
  ctx.strokeStyle = P.border;
  ctx.lineWidth = S.lw;
  ctx.stroke();

  ry = y;
  laid.forEach((r) => {
    const mid = ry + r.h / 2;
    const dx = x + S.dateW / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    setFont(ctx, P, S.dow, 700);
    tracked(ctx, S.dow * 0.1);
    ctx.fillStyle = r.today ? P.accent : P.text3;
    ctx.fillText(r.date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(), dx, mid - S.dayNum * 0.62);
    tracked(ctx, 0);
    setFont(ctx, P, S.dayNum, 800);
    ctx.fillStyle = r.today ? P.accent : r.before ? P.text3 : P.text;
    ctx.fillText(String(r.date.getDate()), dx, mid + S.dow * 0.55);

    const bx = x + S.dateW + S.pad;
    const bw = w - S.dateW - S.pad * 2;
    if (!r.measured.length) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      setFont(ctx, P, S.title, 500);
      ctx.fillStyle = P.text3;
      ctx.fillText(r.before ? 'Before semester' : 'Clear', bx, mid);
    } else {
      let ty = ry + S.pad;
      r.measured.forEach((m) => {
        const ch = m.h + S.cardPad * 2;
        roundRect(ctx, bx, ty, bw, ch, S.cardRadius);
        ctx.fillStyle = P.input;
        ctx.fill();
        ctx.strokeStyle = P.border;
        ctx.lineWidth = S.lw;
        ctx.stroke();
        drawTask(ctx, P, m, bx + S.cardPad, ty + S.cardPad, bw - S.cardPad * 2, S);
        ty += ch + S.gap;
      });
    }
    ry += r.h;
  });
  return total;
}

/**
 * Lay a day list into 1 column (≤10 days) or 2 (a month), scaled down
 * together if needed so it fits `maxH`. Returns { h, draw(top) }.
 */
function planList(ctx, P, rows, x, w, maxH, S, colGap) {
  const nCols = rows.length > 10 ? 2 : 1;
  const per = Math.ceil(rows.length / nCols);
  const chunks = Array.from({ length: nCols }, (_, i) => rows.slice(i * per, (i + 1) * per));
  const colW = (w - colGap * (nCols - 1)) / nCols;
  const lay = (cw) => chunks.map((c) => layoutDayList(ctx, P, c, cw, S));
  const heightOf = (laids) => Math.max(...laids.map((l) => l.reduce((s, r) => s + r.h, 0)));
  let laids = lay(colW);
  let natural = heightOf(laids);
  const scale = natural > maxH ? Math.max(0.4, maxH / natural) : 1;
  if (scale < 1) { laids = lay(colW / scale); natural = heightOf(laids); }
  return {
    h: natural * scale,
    draw: (top) => laids.forEach((laid, i) => {
      ctx.save();
      ctx.translate(x + i * (colW + colGap), top);
      ctx.scale(scale, scale);
      drawDayList(ctx, P, 0, 0, colW / scale, laid, S);
      ctx.restore();
    }),
  };
}

const metaLine = (o) => [o.meta.dept, formatSemester(o.meta.sem), o.filterLabel].filter(Boolean).join(' · ');
const asList = (o) => o.viewMode === 'daily' || o.layout === 'list';

// ─── JPG: lock-screen wallpaper ───
function renderWallpaper(o) {
  const { P, logo } = o;
  const W = 1170;
  const H = 2532;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, H);

  const mx = 56;
  const safeTop = 820;
  const safeBottom = H - 280;
  const headerH = 190;
  const footerH = 84;
  const contentW = W - mx * 2;
  const avail = safeBottom - safeTop - headerH - footerH;

  let plan;
  if (asList(o)) {
    const twoCol = o.cells.filter(Boolean).length > 10;
    const S = twoCol
      ? { dateW: 74, pad: 10, cardPad: 9, cardRadius: 10, gap: 6, minRow: 62, lw: 2, radius: 18,
        dow: 14, dayNum: 26, code: 19, title: 19, titleLines: 2, sub: 15, showSub: true }
      : { dateW: 132, pad: 18, cardPad: 14, cardRadius: 14, gap: 10, minRow: 108, lw: 2, radius: 22,
        dow: 20, dayNum: 40, code: 27, title: 27, titleLines: 2, sub: 21, showSub: true };
    plan = planList(ctx, P, o.cells.filter(Boolean), mx, contentW, avail, S, 18);
  } else if (o.viewMode === 'monthly') {
    const rows = Math.ceil(o.cells.length / 7);
    const headH = 72;
    const cellH = Math.max(110, Math.min(230, (avail - headH) / rows));
    const h = headH + cellH * rows;
    const S = { head: 24, headSub: 18, num: 30, code: 17, title: 17, titleLines: 3, sub: 14, showSub: false, pad: 10, gap: 6 };
    plan = { h, draw: (top) => drawCalendar(ctx, P, { x: mx, y: top, w: contentW, h, cols: 7, cells: o.cells, headH, lw: 2, radius: 22, S }) };
  } else {
    const h = Math.min(avail, 980);
    const S = { head: 24, headSub: 18, num: 30, code: 19, title: 19, titleLines: 6, sub: 15, showSub: true, pad: 10, gap: 12 };
    plan = { h, draw: (top) => drawCalendar(ctx, P, { x: mx, y: top, w: contentW, h, cols: 7, cells: o.cells, headH: 84, lw: 2, radius: 22, S }) };
  }

  const blockH = headerH + plan.h + footerH;
  const top = safeTop + Math.max(0, (safeBottom - safeTop - blockH) / 2);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  setFont(ctx, P, 26, 700);
  tracked(ctx, 4);
  ctx.fillStyle = P.accent;
  ctx.fillText('14-WEEKS VIEW', mx, top + 34);
  tracked(ctx, 0);
  setFont(ctx, P, 54, 800);
  ctx.fillStyle = P.text;
  ctx.fillText(ellipsize(ctx, o.periodLabel, contentW), mx, top + 100);
  const sub = metaLine(o);
  if (sub) {
    setFont(ctx, P, 26, 600);
    ctx.fillStyle = P.text3;
    ctx.fillText(ellipsize(ctx, sub, contentW), mx, top + 146);
  }

  plan.draw(top + headerH);
  drawBrand(ctx, P, logo, W / 2, top + headerH + plan.h + 32, 40, 'center');
  return canvas;
}

// ─── PDF: A4 landscape poster ───
function renderSheet(o) {
  const { P, logo } = o;
  const W = 1123;
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
  drawBrand(ctx, P, logo, mx, 34, 40, 'left', '14-Weeks View');
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  setFont(ctx, P, 16, 700);
  ctx.fillStyle = P.text;
  ctx.fillText(ellipsize(ctx, o.periodLabel, 460), W / 2, 56);
  const sub = metaLine(o);
  if (sub) {
    setFont(ctx, P, 10.5, 600);
    ctx.fillStyle = P.text3;
    ctx.fillText(ellipsize(ctx, sub, 460), W / 2, 73);
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

  const top = 116;
  const bottom = H - 50;
  const w = W - mx * 2;
  if (asList(o)) {
    const twoCol = o.cells.filter(Boolean).length > 10;
    const S = twoCol
      ? { dateW: 46, pad: 5, cardPad: 4, cardRadius: 5, gap: 3, minRow: 26, lw: 1, radius: 8,
        dow: 6.5, dayNum: 11, code: 8.5, title: 8.5, titleLines: 1, sub: 7, showSub: true }
      : { dateW: 80, pad: 10, cardPad: 7, cardRadius: 7, gap: 5, minRow: 52, lw: 1, radius: 10,
        dow: 9, dayNum: 20, code: 11.5, title: 11.5, titleLines: 2, sub: 9, showSub: true };
    planList(ctx, P, o.cells.filter(Boolean), mx, w, bottom - top, S, 14).draw(top);
  } else if (o.viewMode === 'monthly') {
    const S = { head: 10, headSub: 8, num: 11, code: 8, title: 8, titleLines: 2, sub: 7, showSub: true, pad: 5, gap: 3 };
    drawCalendar(ctx, P, { x: mx, y: top, w, h: bottom - top, cols: 7, cells: o.cells, headH: 30, lw: 1, radius: 10, S });
  } else {
    const S = { head: 10, headSub: 8.5, num: 12, code: 9.5, title: 9.5, titleLines: 4, sub: 8, showSub: true, pad: 8, gap: 8 };
    drawCalendar(ctx, P, { x: mx, y: top, w, h: bottom - top, cols: 7, cells: o.cells, headH: 40, lw: 1, radius: 10, S });
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
  const cells = [...opts.cells];
  if (opts.viewMode === 'monthly') while (cells.length % 7) cells.push(null);
  return { layout: 'box', ...opts, cells, P, logo };
}

/** Phone-wallpaper JPG. On phones, opens the share sheet ("Save Image"). */
export async function exportSemesterJPG(opts) {
  const o = await prepare(opts);
  const blob = await toBlob(renderWallpaper(o), 'image/jpeg', 0.95);
  const filename = 'AUSTWise-Semester-View.jpg';
  const file = typeof File === 'function' ? new File([blob], filename, { type: 'image/jpeg' }) : null;
  const isTouch = window.matchMedia?.('(pointer: coarse)').matches;
  if (isTouch && file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Semester View' });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  saveBlob(blob, filename);
}

/** A4 landscape PDF poster. */
export async function exportSemesterPDF(opts) {
  const [{ default: jsPDF }, o] = await Promise.all([import('jspdf'), prepare(opts)]);
  const canvas = renderSheet(o);
  const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 297, 210);
  pdf.save('AUSTWise-Semester-View.pdf');
}
