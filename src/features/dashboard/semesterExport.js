/**
 * Semester View (14-Weeks View) export — same approach and house style as the
 * Routine Grid export (routineExport.js): drawn straight onto a <canvas> from
 * data, in the current theme's colours, flat surfaces only.
 *
 *  • JPG → portrait phone wallpaper (1170×2532), clock / shortcut areas kept
 *          clear. Week & Day: one row per day. Month: 7-column calendar.
 *  • PDF → A4 landscape poster (300 dpi). Week: 7 columns. Month: calendar.
 *          Day: that day's tasks as a list.
 *
 * opts = {
 *   viewMode: 'daily' | 'weekly' | 'monthly',
 *   cells: [{ date, tasks, today, before } | null],  // Fri-start, null = pad
 *   periodLabel, filterLabel, meta: { dept, sem }, logoUrl,
 * }
 */
import {
  readPalette, loadLogo, setFont, ellipsize, wrap, roundRect, tracked,
  drawBrand, formatSemester, toBlob, saveBlob,
} from './routineExport';

const WEEKDAYS = ['FRI', 'SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU'];

const subOf = (t) => [t.batchGroup, t.time].filter(Boolean).join(' · ');

// Measure one task block: code line (code + batch/time) then wrapped title.
function measureTask(ctx, P, t, maxW, S) {
  const code = t.courseCode || '';
  setFont(ctx, P, S.title, 500);
  const titleRows = S.titleLines > 0 ? wrap(ctx, t.title || 'Task', maxW, S.titleLines) : [];
  const hasHead = !!code || (S.titleLines === 0);
  const h = (hasHead ? S.code * 1.25 : 0) + titleRows.length * S.title * 1.25;
  return { t, code, titleRows, hasHead, h };
}

function drawTask(ctx, P, m, x, y, maxW, S) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let cy = y;
  if (m.hasHead) {
    const head = m.code || m.t.title || 'Task';
    setFont(ctx, P, S.code, 800);
    ctx.fillStyle = P.accent;
    const shown = ellipsize(ctx, head, maxW);
    ctx.fillText(shown, x, cy);
    const used = ctx.measureText(shown).width;
    const sub = S.showSub ? subOf(m.t) : '';
    if (sub && used + S.code < maxW) {
      setFont(ctx, P, S.sub, 600);
      ctx.fillStyle = P.text3;
      ctx.fillText(ellipsize(ctx, sub, maxW - used - S.code * 0.5), x + used + S.code * 0.5, cy + (S.code - S.sub) * 0.55);
    }
    cy += S.code * 1.25;
  }
  setFont(ctx, P, S.title, 500);
  ctx.fillStyle = P.text;
  m.titleRows.forEach((row) => { ctx.fillText(row, x, cy); cy += S.title * 1.25; });
}

/**
 * Calendar matrix: weekday header row, bordered cells, each cell with its
 * date number and as many tasks as fit ("+n more" for the rest).
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

  // Header: weekday names (+ date for a one-row week sheet)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let c = 0; c < cols; c++) {
    const cell = rows === 1 ? cells[c] : null;
    const isToday = cell?.today;
    const main = cell ? cell.date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() : WEEKDAYS[c];
    setFont(ctx, P, S.head, 800);
    tracked(ctx, S.head * 0.08);
    ctx.fillStyle = isToday ? P.accent : P.text;
    if (cell) {
      ctx.fillText(main, cx(c) + cellW / 2, y + headH / 2 - S.headSub * 0.62);
      tracked(ctx, 0);
      setFont(ctx, P, S.headSub, 600);
      ctx.fillStyle = isToday ? P.accent : P.text3;
      ctx.fillText(cell.date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }), cx(c) + cellW / 2, y + headH / 2 + S.head * 0.62);
    } else {
      ctx.fillText(main, cx(c) + cellW / 2, y + headH / 2);
      tracked(ctx, 0);
    }
  }

  // Cells
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
      const need = m.h + (left > 0 ? S.gap + moreH : 0);
      if (ty + need > bottom && k > 0) break;
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

/**
 * Day list: one row per day — date block on the left, that day's tasks as
 * flat cards on the right ("Clear" when none). Returns its height.
 */
function layoutDayList(ctx, P, rows, w, S) {
  const bodyW = w - S.dateW - S.pad * 3;
  return rows.map((r) => {
    const tasks = r.before ? [] : r.tasks.map((t) => measureTask(ctx, P, t, bodyW - S.cardPad * 2, S));
    const tasksH = tasks.reduce((s, m) => s + m.h + S.cardPad * 2, 0) + Math.max(0, tasks.length - 1) * S.gap;
    const h = Math.max(S.minRow, (tasks.length ? tasksH : S.title * 1.25) + S.pad * 2);
    return { ...r, measured: tasks, h };
  });
}

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
    const dim = r.before;
    const col = r.today ? P.accent : dim ? P.text3 : P.text;
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
    ctx.fillStyle = col;
    ctx.fillText(String(r.date.getDate()), dx, mid + S.dow * 0.55);

    const bx = x + S.dateW + S.pad;
    const bw = w - S.dateW - S.pad * 2;
    if (!r.measured.length) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      setFont(ctx, P, S.title, 500);
      ctx.fillStyle = P.text3;
      ctx.fillText(dim ? 'Before semester' : 'Clear', bx, mid);
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

const metaLine = (o) => [o.meta.dept, formatSemester(o.meta.sem), o.filterLabel].filter(Boolean).join(' · ');

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

  let draw;
  let contentH;
  if (o.viewMode === 'monthly') {
    const rows = Math.ceil(o.cells.length / 7);
    const headH = 72;
    const cellH = Math.max(110, Math.min(230, (avail - headH) / rows));
    contentH = headH + cellH * rows;
    const S = { head: 24, headSub: 18, num: 30, code: 21, title: 18, titleLines: 0, sub: 17, showSub: false, pad: 12, gap: 6 };
    draw = (top) => drawCalendar(ctx, P, { x: mx, y: top, w: contentW, h: contentH, cols: 7, cells: o.cells, headH, lw: 2, radius: 22, S });
  } else {
    const rows = o.cells.filter(Boolean);
    const S = {
      dateW: 132, pad: 18, cardPad: 14, cardRadius: 14, gap: 10, minRow: 108, lw: 2, radius: 22,
      dow: 20, dayNum: 40, code: 26, title: 28, titleLines: 2, sub: 21, showSub: true,
    };
    let laid = layoutDayList(ctx, P, rows, contentW, S);
    let natural = laid.reduce((s, r) => s + r.h, 0);
    let scale = 1;
    if (natural > avail) {
      // Too many tasks for the screen: shrink the whole list to fit.
      scale = Math.max(0.45, avail / natural);
      laid = layoutDayList(ctx, P, rows, contentW / scale, S);
      natural = laid.reduce((s, r) => s + r.h, 0);
    }
    contentH = natural * scale;
    draw = (top) => {
      ctx.save();
      ctx.translate(mx, top);
      ctx.scale(scale, scale);
      drawDayList(ctx, P, 0, 0, contentW / scale, laid, S);
      ctx.restore();
    };
  }

  const blockH = headerH + contentH + footerH;
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

  draw(top + headerH);
  drawBrand(ctx, P, logo, W / 2, top + headerH + contentH + 32, 40, 'center');
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
  if (o.viewMode === 'daily') {
    const S = {
      dateW: 90, pad: 12, cardPad: 9, cardRadius: 8, gap: 6, minRow: 64, lw: 1, radius: 10,
      dow: 10, dayNum: 24, code: 12, title: 12.5, titleLines: 3, sub: 10, showSub: true,
    };
    const laid = layoutDayList(ctx, P, o.cells.filter(Boolean), w, S);
    const natural = laid.reduce((s, r) => s + r.h, 0);
    const scale = Math.min(1, (bottom - top) / natural);
    ctx.save();
    ctx.translate(mx, top);
    ctx.scale(scale, scale);
    drawDayList(ctx, P, 0, 0, w / scale, laid, S);
    ctx.restore();
  } else if (o.viewMode === 'monthly') {
    const S = { head: 10, headSub: 8, num: 11, code: 8.5, title: 8, titleLines: 1, sub: 7.5, showSub: true, pad: 5, gap: 3 };
    drawCalendar(ctx, P, { x: mx, y: top, w, h: bottom - top, cols: 7, cells: o.cells, headH: 30, lw: 1, radius: 10, S });
  } else {
    const S = { head: 10, headSub: 8.5, num: 12, code: 10, title: 9.5, titleLines: 3, sub: 8, showSub: true, pad: 8, gap: 7 };
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
  return { ...opts, cells, P, logo };
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
