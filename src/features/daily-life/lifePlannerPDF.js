/**
 * Life Planner — PDF export (Section 7, adapted to this app's conventions).
 *
 * The app's established export pattern (WeekSchedule) renders an offscreen
 * DOM node with html2canvas-pro and embeds it into jsPDF. For a multi-section
 * document we render one sheet per section, paginate each into A4 slices, and
 * append them — so the PDF reuses the app's real CSS tokens and stays visually
 * consistent with the in-app planner.
 */

// ── small helpers ────────────────────────────────────────────────────────────

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function fmtDate(key) {
  if (!key) return '';
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(key);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtMoney(n) {
  const sign = n < 0 ? '−' : '';
  return `${sign}${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}

// ── section builders (return HTML strings) ───────────────────────────────────

function sectionCover(doc, stats) {
  return `
    <div style="text-align:center; padding:60px 0 30px;">
      <div style="font-size:11px; letter-spacing:.2em; text-transform:uppercase; color:var(--text-tertiary);">AUSTWise · Life Planner</div>
      <h1 style="margin:10px 0 6px;">My Life Plan</h1>
      <div style="font-size:12px; color:var(--text-secondary);">Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      <div style="display:flex; justify-content:center; gap:26px; margin-top:34px;">
        ${[
          ['Goals', stats.goalCount],
          ['Done', stats.doneCount],
          ['Phases', stats.phaseCount],
          ['Habits', stats.habitCount],
        ].map(([label, val]) => `
          <div style="min-width:90px; border:1px solid var(--border-primary); border-radius:8px; padding:12px 10px;">
            <div style="font-size:22px; font-weight:800; color:var(--accent-amber);">${val}</div>
            <div style="font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:var(--text-tertiary);">${label}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function sectionDependencyMap(doc) {
  const withDeps = doc.goals.filter((g) =>
    doc.deps.some((d) => d.goalId === g.id || d.dependsOnGoalId === g.id));
  if (withDeps.length === 0) return `<h2>Dependency Map</h2><p style="color:var(--text-tertiary); font-size:12px;">No dependencies defined.</p>`;
  return `
    <h2>Dependency Map</h2>
    ${withDeps.map((g) => {
      const needs = doc.deps.filter((d) => d.goalId === g.id)
        .map((d) => `G${doc.goals.find((x) => x.id === d.dependsOnGoalId)?.number ?? '?'} ${esc(doc.goals.find((x) => x.id === d.dependsOnGoalId)?.title ?? '')}`);
      const unlocks = doc.deps.filter((d) => d.dependsOnGoalId === g.id)
        .map((d) => `G${doc.goals.find((x) => x.id === d.goalId)?.number ?? '?'} ${esc(doc.goals.find((x) => x.id === d.goalId)?.title ?? '')}`);
      return `
        <div class="lp-pdf-card">
          <strong>G${g.number} ${esc(g.title)}</strong>
          ${needs.length ? `<div style="font-size:11px; margin-top:4px;">← depends on: ${needs.join(', ')}</div>` : ''}
          ${unlocks.length ? `<div style="font-size:11px; margin-top:2px;">→ unlocks: ${unlocks.join(', ')}</div>` : ''}
        </div>`;
    }).join('')}`;
}

function sectionTimeline(doc, todayKeyStr) {
  const entries = [];
  for (const t of doc.tasks) {
    if (t.dueDate) {
      const g = doc.goals.find((x) => x.id === t.goalId);
      entries.push({ date: t.dueDate, label: t.name, goal: g, done: false });
    }
  }
  for (const s of doc.steps) {
    if (s.dueDate) {
      const t = doc.tasks.find((x) => x.id === s.taskId);
      const g = t ? doc.goals.find((x) => x.id === t.goalId) : null;
      entries.push({ date: s.dueDate, label: s.text, goal: g, done: s.isDone });
    }
  }
  entries.sort((a, b) => a.date.localeCompare(b.date));
  if (entries.length === 0) return `<h2>Timeline</h2><p style="color:var(--text-tertiary); font-size:12px;">No dated items.</p>`;
  return `
    <h2>Timeline</h2>
    <table>
      <thead><tr><th>Date</th><th>Item</th><th>Goal</th><th>Status</th></tr></thead>
      <tbody>
        ${entries.map((e) => {
          const overdue = !e.done && e.date < todayKeyStr;
          const highlight = e.date === todayKeyStr ? 'background:var(--accent-amber-glow);' : '';
          return `<tr style="${highlight}">
            <td style="white-space:nowrap;">${fmtDate(e.date)}</td>
            <td>${esc(e.label)}</td>
            <td>${e.goal ? `G${e.goal.number} ${esc(e.goal.title)}` : '—'}</td>
            <td>${e.done ? '✓ Done' : overdue ? '<span style="color:var(--accent-rose); font-weight:700;">Overdue</span>' : '—'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function sectionLedger(doc) {
  let bal = 0;
  const rows = [...doc.ledger].sort((a, b) => a.date.localeCompare(b.date) || (a.order || 0) - (b.order || 0))
    .map((r) => { bal += Number(r.amount) || 0; return { ...r, balance: bal }; });
  const inflow = doc.ledger.reduce((s, r) => s + (Number(r.amount) > 0 ? Number(r.amount) : 0), 0);
  const outflow = doc.ledger.reduce((s, r) => s + (Number(r.amount) < 0 ? -Number(r.amount) : 0), 0);
  return `
    <h2>Ledger</h2>
    ${rows.length === 0 ? `<p style="color:var(--text-tertiary); font-size:12px;">No transactions.</p>` : `
    <table>
      <thead><tr><th>Date</th><th>Item</th><th>Category</th><th style="text-align:right;">Amount</th><th style="text-align:right;">Balance</th></tr></thead>
      <tbody>
        ${rows.map((r) => `<tr>
          <td style="white-space:nowrap;">${fmtDate(r.date)}</td>
          <td>${esc(r.item)}</td>
          <td>${esc(r.category || '—')}</td>
          <td style="text-align:right; color:${r.amount >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'}; font-weight:700;">${r.amount >= 0 ? '+' : '−'}${fmtMoney(Math.abs(r.amount))}</td>
          <td style="text-align:right;">${fmtMoney(r.balance)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div style="display:flex; gap:18px; margin-top:10px; font-size:11px;">
      <span>Inflow: <strong style="color:var(--accent-emerald);">+${fmtMoney(inflow)}</strong></span>
      <span>Outflow: <strong style="color:var(--accent-rose);">−${fmtMoney(outflow)}</strong></span>
      <span>Balance: <strong>${fmtMoney(bal)}</strong></span>
    </div>`}`;
}

function sectionPhases(doc) {
  const phases = [...doc.phases].sort((a, b) => a.order - b.order);
  const renderGoal = (g) => {
    const tasks = doc.tasks.filter((t) => t.goalId === g.id).sort((a, b) => a.order - b.order);
    const deps = doc.deps.filter((d) => d.goalId === g.id);
    return `
      <div class="lp-pdf-card" style="border-left:4px solid ${esc(g._phaseColor || 'var(--accent-amber)')};">
        <div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;">
          <strong>G${g.number} ${esc(g.title)}</strong>
          <span style="font-size:10px; color:var(--text-tertiary);">${esc((g.types || []).join(' · '))}${g.costLabel ? ` · ${esc(g.costLabel)}` : ''}${(g.timingLabel || g.timingDate) ? ` · ${esc(g.timingLabel || fmtDate(g.timingDate))}` : ''}</span>
        </div>
        ${deps.length ? `<div style="font-size:10px; color:var(--text-tertiary); margin-top:2px;">Depends on: ${deps.map((d) => `G${doc.goals.find((x) => x.id === d.dependsOnGoalId)?.number ?? '?'}`).join(', ')}</div>` : ''}
        ${g.definitionOfDone ? `<div style="font-size:11px; margin-top:5px;"><em>DoD:</em> ${esc(g.definitionOfDone)}</div>` : ''}
        ${tasks.length === 0 ? '' : tasks.map((t) => {
          const steps = doc.steps.filter((s) => s.taskId === t.id).sort((a, b) => a.order - b.order);
          return `
            <div style="margin-top:7px;">
              <div style="font-size:11px; font-weight:700;">☐ ${esc(t.name)}${t.dueDate ? ` <span style="color:var(--text-tertiary); font-weight:400;">· ${fmtDate(t.dueDate)}</span>` : ''}</div>
              ${steps.map((s) => `
                <div style="font-size:11px; padding-left:16px;">${s.isDone ? '☑' : '☐'} ${esc(s.text)}${s.dueDate ? ` <span style="color:var(--text-tertiary);">· ${fmtDate(s.dueDate)}</span>` : ''}</div>`).join('')}
            </div>`;
        }).join('')}
      </div>`;
  };

  let html = '<h2>Goals by Phase</h2>';
  for (const p of phases) {
    const goals = doc.goals.filter((g) => g.phaseId === p.id).sort((a, b) => a.order - b.order);
    html += `<div style="font-size:13px; font-weight:800; margin:14px 0 6px; color:${esc(p.color)};">■ ${esc(p.title)}${p.subtitle ? ` <span style="font-weight:400; color:var(--text-tertiary);">— ${esc(p.subtitle)}</span>` : ''}</div>`;
    html += goals.length ? goals.map((g) => renderGoal({ ...g, _phaseColor: p.color })).join('')
      : `<p style="font-size:11px; color:var(--text-tertiary);">No goals in this phase.</p>`;
  }
  const unphased = doc.goals.filter((g) => !g.phaseId);
  if (unphased.length) {
    html += `<div style="font-size:13px; font-weight:800; margin:14px 0 6px;">■ No phase</div>`;
    html += unphased.map(renderGoal).join('');
  }
  return html;
}

function sectionHabitTracker(doc, { blank }) {
  const habits = doc.habits.filter((h) => !h.archived);
  if (habits.length === 0) return `<h2>Habit Tracker</h2><p style="color:var(--text-tertiary); font-size:12px;">No habits defined.</p>`;
  const dayNames = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
  const today = new Date();
  const mondayLike = new Date(today);
  mondayLike.setDate(today.getDate() - ((today.getDay() - 5 + 7) % 7));

  return `
    <h2>Habit Tracker — ${blank ? 'Blank weekly template' : 'This week'}</h2>
    <table>
      <thead><tr><th>Habit</th>${dayNames.map((d) => `<th style="text-align:center;">${d}</th>`).join('')}</tr></thead>
      <tbody>
        ${habits.map((h) => `<tr>
          <td style="white-space:nowrap;">${esc(h.name)}</td>
          ${dayNames.map((_, i) => {
            if (blank) return `<td style="text-align:center;">☐</td>`;
            const d = new Date(mondayLike); d.setDate(mondayLike.getDate() + i);
            const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
            const key = `${y}-${m}-${dd}`;
            const done = !!doc.habitLogs?.[h.id]?.[key];
            return `<td style="text-align:center;">${done ? '☑' : '☐'}</td>`;
          }).join('')}
        </tr>`).join('')}
      </tbody>
    </table>`;
}

function sectionChecklist(doc) {
  const phases = [...doc.phases].sort((a, b) => a.order - b.order);
  let rows = '';
  const emitGoal = (g) => {
    const tasks = doc.tasks.filter((t) => t.goalId === g.id);
    const steps = doc.steps.filter((s) => tasks.some((t) => t.id === s.taskId));
    const allDone = steps.length > 0 && steps.every((s) => s.isDone);
    rows += `<tr><td>${allDone ? '☑' : '☐'}</td><td><strong>G${g.number}</strong></td><td>${esc(g.title)}</td><td>${steps.filter((s) => s.isDone).length}/${steps.length} steps</td></tr>`;
  };
  for (const p of phases) {
    const goals = doc.goals.filter((g) => g.phaseId === p.id).sort((a, b) => a.order - b.order);
    if (goals.length) rows += `<tr><td colspan="4" style="background:var(--bg-tertiary); font-weight:800;">${esc(p.title)}</td></tr>`;
    goals.forEach(emitGoal);
  }
  doc.goals.filter((g) => !g.phaseId).forEach(emitGoal);
  return `
    <h2>Master Checklist</h2>
    <table><thead><tr><th style="width:24px;"></th><th style="width:44px;">#</th><th>Goal</th><th>Progress</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function sectionReview() {
  const questions = [
    'What went well this month?',
    'What slowed me down, and why?',
    'Which goal moved the most — and which one needs attention?',
    'What will I change about my habits next month?',
    'Money check: did I stay within plan? Where did the leaks happen?',
    'The single most important thing for next month is…',
  ];
  return `
    <h2>Monthly Review</h2>
    ${questions.map((q) => `
      <div style="margin-bottom:16px;">
        <div style="font-size:12px; font-weight:700;">${esc(q)}</div>
        <div style="border-bottom:1px dashed var(--border-primary); height:26px;"></div>
        <div style="border-bottom:1px dashed var(--border-primary); height:26px;"></div>
      </div>`).join('')}`;
}

// ── main export ──────────────────────────────────────────────────────────────

export async function exportLifePlannerPDF(doc) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ]);

  const todayKeyStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const doneCount = doc.goals.filter((g) => {
    const tasks = doc.tasks.filter((t) => t.goalId === g.id);
    const steps = doc.steps.filter((s) => tasks.some((t) => t.id === s.taskId));
    return steps.length > 0 && steps.every((s) => s.isDone);
  }).length;

  const stats = {
    goalCount: doc.goals.length,
    doneCount,
    phaseCount: doc.phases.length,
    habitCount: doc.habits.filter((h) => !h.archived).length,
  };

  const sections = [
    sectionCover(doc, stats),
    sectionDependencyMap(doc),
    sectionTimeline(doc, todayKeyStr),
    sectionLedger(doc),
    sectionPhases(doc),
    sectionHabitTracker(doc, { blank: true }),
    sectionChecklist(doc),
    sectionReview(),
  ];

  // Render each section into an offscreen sheet and paginate to A4.
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = 210, pageH = 297, margin = 8;
  const imgW = pageW - margin * 2;
  let firstPage = true;

  const container = document.createElement('div');
  container.className = 'lp-pdf-sheet';
  container.innerHTML = sections.join('<div style="break-inside:avoid; height:14px;"></div><hr style="border:none; border-top:1px dashed var(--border-primary); margin:18px 0;" />');
  document.body.appendChild(container);

  try {
    // Capture the whole sheet once, then slice it into A4 pages.
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#ffffff',
      logging: false,
      width: container.scrollWidth,
      height: container.scrollHeight,
    });

    const pxPerMm = canvas.width / imgW;
    const sliceHeightPx = Math.floor((pageH - margin * 2) * pxPerMm);
    const totalSlices = Math.ceil(canvas.height / sliceHeightPx);

    for (let i = 0; i < totalSlices; i++) {
      if (!firstPage) pdf.addPage();
      firstPage = false;
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = Math.min(sliceHeightPx, canvas.height - i * sliceHeightPx);
      const ctx = slice.getContext('2d');
      ctx.drawImage(canvas, 0, i * sliceHeightPx, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
      const imgH = slice.height / pxPerMm;
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, margin, imgW, imgH);
    }

    pdf.save('AUSTWise-Life-Planner.pdf');
  } finally {
    document.body.removeChild(container);
  }
}
