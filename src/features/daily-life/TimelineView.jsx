import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Crosshair, CalendarDays, List, Check, Repeat } from 'lucide-react';
import { buildTimelineRange, fmtDate, todayKey, goalDisplayNumber } from './lifePlannerStorage';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function pad2(n) { return String(n).padStart(2, '0'); }
function monthDateKeys(year, monthIdx) {
  const days = new Date(year, monthIdx + 1, 0).getDate();
  const out = [];
  for (let d = 1; d <= days; d++) out.push(`${year}-${pad2(monthIdx + 1)}-${pad2(d)}`);
  return out;
}
function yearDateKeys(year) {
  const out = [];
  for (let m = 0; m < 12; m++) out.push(...monthDateKeys(year, m));
  return out;
}

export default function TimelineView({ doc, onOpenGoal }) {
  const today = todayKey();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11

  // 10-year window: currentYear -5 .. currentYear +4 (10 slots, current centered at index 5)
  const initialDecadeStart = currentYear - 5;
  const [decadeStart, setDecadeStart] = useState(initialDecadeStart);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [mode, setMode] = useState('month'); // 'year' | 'month'
  const [calView, setCalView] = useState('list'); // 'list' | 'calendar'
  const [selectedDate, setSelectedDate] = useState(today);

  // Keep selectedYear inside decade window when decade shifts via arrows
  useEffect(() => {
    if (selectedYear < decadeStart || selectedYear > decadeStart + 9) {
      // snap to middle of new decade if outside
      setSelectedYear(decadeStart + 5);
    }
  }, [decadeStart, selectedYear]);

  const decadeFrom = `${decadeStart}-01-01`;
  const decadeTo = `${decadeStart + 9}-12-31`;

  const allEntries = useMemo(() => buildTimelineRange(doc, decadeFrom, decadeTo), [doc, decadeFrom, decadeTo]);

  const countByMonth = useMemo(() => {
    const m = {};
    for (const e of allEntries) {
      if (Number(e.date.slice(0,4)) !== selectedYear) continue;
      const mo = Number(e.date.slice(5,7)) -1;
      m[mo] = (m[mo]||0)+1;
    }
    return m;
  }, [allEntries, selectedYear]);

  const filtered = useMemo(() => {
    if (mode === 'year') {
      return allEntries.filter(e => Number(e.date.slice(0,4)) === selectedYear);
    }
    // month mode
    return allEntries.filter(e => {
      const y = Number(e.date.slice(0,4));
      const mo = Number(e.date.slice(5,7)) -1;
      return y === selectedYear && mo === selectedMonth;
    });
  }, [allEntries, mode, selectedYear, selectedMonth]);

  // Group by date for rendering
  const groups = useMemo(() => {
    const map = new Map();
    for (const e of filtered) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    }
    return map;
  }, [filtered]);

  // Always show every date for the selected period, even when empty (user: empty state eo shob date dekhabe)
  const allDateKeys = useMemo(() => {
    if (mode === 'year') return yearDateKeys(selectedYear);
    return monthDateKeys(selectedYear, selectedMonth);
  }, [mode, selectedYear, selectedMonth]);

  // Entries by date (whole decade) — for calendar grid dots/counts
  const byDate = useMemo(() => {
    const map = new Map();
    for (const e of allEntries) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    }
    return map;
  }, [allEntries]);

  const msList = useMemo(
    () => doc.goals.filter((g) => (g.types || []).includes('milestone')).sort((a, b) => (a.order || 0) - (b.order || 0)),
    [doc.goals]
  );

  // Keep selectedDate inside the visible period (calendar day panel)
  useEffect(() => {
    const y = Number(selectedDate.slice(0, 4));
    const mo = Number(selectedDate.slice(5, 7)) - 1;
    if (mode === 'month' && (y !== selectedYear || mo !== selectedMonth)) {
      const inMonth = today.startsWith(`${selectedYear}-${pad2(selectedMonth + 1)}`);
      setSelectedDate(inMonth ? today : `${selectedYear}-${pad2(selectedMonth + 1)}-01`);
    } else if (mode === 'year' && y !== selectedYear) {
      setSelectedDate(today.startsWith(`${selectedYear}-`) ? today : `${selectedYear}-01-01`);
    }
  }, [mode, selectedYear, selectedMonth, selectedDate, today]);

  // ── Calendar grid cells (week starts Friday, matching the app schedule) ──
  const calCells = useMemo(() => {
    const firstDow = new Date(selectedYear, selectedMonth, 1).getDay(); // 0=Sun..6=Sat
    const offset = (firstDow - 5 + 7) % 7; // Friday=5 first
    const days = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const cells = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= days; d++) cells.push(`${selectedYear}-${pad2(selectedMonth + 1)}-${pad2(d)}`);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [selectedYear, selectedMonth]);
  const selectedEntries = byDate.get(selectedDate) || [];

  // ── Scrollable timeline — only inner scrolls, today centered ──
  const timelineRef = useRef(null);
  const [showTodayFab, setShowTodayFab] = useState(false);

  const scrollToToday = useCallback((behavior = 'smooth') => {
    // Scroll only the inner agenda box — never the page.
    const sc = timelineRef.current;
    const el = sc?.querySelector(`[data-date="${today}"]`);
    if (el) sc.scrollTo({ top: Math.max(0, el.offsetTop - sc.clientHeight / 2 + el.offsetHeight / 2), behavior });
  }, [today]);

  const jumpToToday = useCallback(() => {
    setDecadeStart(currentYear - 5);
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);
    setMode('month');
    // after state flush, center today
    requestAnimationFrame(() => setTimeout(() => scrollToToday('smooth'), 80));
  }, [currentYear, currentMonth, scrollToToday]);

  // Auto-center today on mount + refresh and whenever period changes
  useEffect(() => {
    const t = setTimeout(() => scrollToToday('auto'), 120);
    return () => clearTimeout(t);
  }, [allDateKeys, scrollToToday]);

  // Show floating Today button when today row is off-screen inside the scroll box
  useEffect(() => {
    const sc = timelineRef.current;
    if (!sc) return undefined;
    const check = () => {
      const el = sc.querySelector(`[data-date="${today}"]`);
      if (!el) { setShowTodayFab(true); return; }
      const r = el.getBoundingClientRect();
      const cr = sc.getBoundingClientRect();
      const visible = r.top >= cr.top - 8 && r.bottom <= cr.bottom + 8;
      setShowTodayFab(!visible);
    };
    sc.addEventListener('scroll', check, { passive: true });
    // also re-check on resize / content change
    const ro = new ResizeObserver(check);
    ro.observe(sc);
    check();
    const id = setInterval(check, 600);
    return () => { sc.removeEventListener('scroll', check); ro.disconnect(); clearInterval(id); };
  }, [allDateKeys, today]);

  // ── Shared entry row (list view + calendar day panel) ──
  const KIND_LABEL = { task: 'Task', step: 'Step', goal: 'Goal deadline', milestone: 'Milestone deadline' };
  const renderEntry = (e, i) => {
    const milestone = e.milestone || null;
    const goal = e.goal || null;
    const task = e.task || null;
    const msIdx = milestone ? msList.findIndex((x) => x.id === milestone.id) : -1;
    const open = () => goal && onOpenGoal(goal.id, { taskId: task?.id || null, stepId: e.step?.id || null, milestoneId: milestone?.id || null });
    const late = e.date < today && !e.done;
    return (
      <button
        key={`${e.date}-${e.kind}-${i}`}
        type="button"
        className={`pb-entry kind-${e.kind}${e.recurring ? ' is-recurring' : ''}${e.done ? ' is-done' : ''}${late ? ' is-late' : ''}`}
        onClick={open}
        disabled={!goal}
        title={goal ? 'Open in Milestones' : undefined}
      >
        <span className="pb-entry-mark" aria-hidden="true">{e.done ? <Check size={11} /> : e.recurring ? <Repeat size={11} /> : null}</span>
        <span className="pb-entry-body">
          <span className="pb-entry-top">
            <span className="pb-entry-kind">{e.recurring ? 'Recurring task' : KIND_LABEL[e.kind] || e.kind}</span>
            {e.done && <span className="pb-entry-flag is-done">Done</span>}
            {late && <span className="pb-entry-flag is-late">Overdue</span>}
          </span>
          <span className="pb-entry-title">{e.label}</span>
          {(milestone || goal) && (
            <span className="pb-entry-path">
              {milestone && <span>M{msIdx >= 0 ? msIdx + 1 : '?'} · {milestone.title}</span>}
              {goal && <><ChevronRight size={10} aria-hidden="true" /><span>G{goalDisplayNumber(doc, goal)} · {goal.title}</span></>}
              {e.kind === 'step' && task && <><ChevronRight size={10} aria-hidden="true" /><span>{task.name}</span></>}
            </span>
          )}
        </span>
        {goal && <ChevronRight size={14} className="pb-chev" aria-hidden="true" />}
      </button>
    );
  };

  const shiftYear = (dir) => {
    const ny = selectedYear + dir;
    if (ny < decadeStart) setDecadeStart((d) => d - 10);
    else if (ny > decadeStart + 9) setDecadeStart((d) => d + 10);
    setSelectedYear(ny);
  };

  const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth;
  const overdueCount = filtered.filter((e) => e.date < today && !e.done).length;
  const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="pb-stack">
      {/* ── Controls ── */}
      <section className="pb-card pb-tl-controls">
        <div className="pb-tl-bar">
          <div className="pb-stepper" role="group" aria-label="Year">
            <button type="button" className="pb-icon" onClick={() => shiftYear(-1)} aria-label="Previous year"><ChevronLeft size={16} /></button>
            <span className="pb-stepper-value">{selectedYear}</span>
            <button type="button" className="pb-icon" onClick={() => shiftYear(1)} aria-label="Next year"><ChevronRight size={16} /></button>
          </div>

          <div className="pb-seg" role="tablist" aria-label="Timeline view">
            <button type="button" role="tab" aria-selected={calView === 'list'} className={calView === 'list' ? 'is-on' : ''} onClick={() => setCalView('list')}>
              <List size={13} /> List
            </button>
            <button type="button" role="tab" aria-selected={calView === 'calendar'} className={calView === 'calendar' ? 'is-on' : ''} onClick={() => { setMode('month'); setCalView('calendar'); }}>
              <CalendarDays size={13} /> Calendar
            </button>
          </div>

          <button type="button" className="pb-btn-soft" onClick={jumpToToday} disabled={isCurrentMonth && calView === 'calendar'}>
            <Crosshair size={13} /> Today
          </button>
        </div>

        <div className="pb-months" role="tablist" aria-label={`Months of ${selectedYear}`}>
          {MONTHS.map((m, idx) => {
            const isSel = idx === selectedMonth;
            const isNow = selectedYear === currentYear && idx === currentMonth;
            const cnt = countByMonth[idx] || 0;
            return (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={isSel}
                onClick={() => setSelectedMonth(idx)}
                className={`pb-month${isSel ? ' is-on' : ''}${isNow ? ' is-now' : ''}`}
                title={`${MONTHS_FULL[idx]} ${selectedYear} — ${cnt} item${cnt === 1 ? '' : 's'}`}
              >
                <span>{m}</span>
                <i className={cnt > 0 ? 'has' : ''} aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <p className="pb-tl-summary">
          <strong>{mode === 'year' ? selectedYear : `${MONTHS_FULL[selectedMonth]} ${selectedYear}`}</strong>
          <span className="pb-dot" aria-hidden="true" />
          {filtered.length} item{filtered.length === 1 ? '' : 's'}
          {overdueCount > 0 && <><span className="pb-dot" aria-hidden="true" /><span className="is-alert">{overdueCount} overdue</span></>}
        </p>
      </section>

      {/* ── Calendar grid ── */}
      {calView === 'calendar' && (
        <section className="pb-card pb-cal">
          <div className="pb-cal-head" aria-hidden="true">
            {['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="pb-cal-grid" role="grid" aria-label={`${MONTHS_FULL[selectedMonth]} ${selectedYear} calendar`}>
            {calCells.map((dateKey, i) => {
              if (!dateKey) return <div key={`empty-${i}`} className="pb-cal-cell is-blank" />;
              const dayEntries = byDate.get(dateKey) || [];
              const isToday = dateKey === today;
              const isSel = dateKey === selectedDate;
              const isOverdue = dateKey < today && dayEntries.some((e) => !e.done);
              return (
                <button
                  key={dateKey}
                  type="button"
                  role="gridcell"
                  aria-selected={isSel}
                  aria-label={`${fmtDate(dateKey)} — ${dayEntries.length} item${dayEntries.length === 1 ? '' : 's'}`}
                  className={`pb-cal-cell${isToday ? ' is-today' : ''}${isSel ? ' is-sel' : ''}${isOverdue ? ' is-late' : ''}${dayEntries.length ? ' has-items' : ''}`}
                  onClick={() => setSelectedDate(dateKey)}
                >
                  <span className="pb-cal-day">{Number(dateKey.slice(8, 10))}</span>
                  {dayEntries.length > 0 && (
                    <span className="pb-cal-dots">
                      {dayEntries.slice(0, 3).map((e, di) => (e.recurring
                        ? <Repeat key={di} size={9} className={`pb-cal-recur${e.done ? ' is-done' : ''}`} aria-hidden="true" />
                        : <i key={di} className={`kind-${e.kind}${e.done ? ' is-done' : ''}`} />))}
                      {dayEntries.length > 3 && <em>+{dayEntries.length - 3}</em>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="pb-cal-legend" aria-hidden="true">
            <span><i className="kind-task" /> Task</span>
            <span><Repeat size={9} className="pb-cal-recur" /> Recurring</span>
            <span><i className="kind-step" /> Step</span>
            <span><i className="kind-goal" /> Deadline</span>
            <span><i className="kind-task is-done" /> Done</span>
          </div>

          <div className="pb-cal-day-panel">
            <header className="pb-head">
              <h3 className="pb-title">{fmtDate(selectedDate)}</h3>
              {selectedDate === today && <span className="pb-chip is-accent">Today</span>}
              <span className="pb-meta pb-head-end">{selectedEntries.length} item{selectedEntries.length === 1 ? '' : 's'}</span>
            </header>
            {selectedEntries.length === 0 ? (
              <p className="pb-empty-line">Nothing scheduled for this day.</p>
            ) : (
              <div className="pb-entries">{selectedEntries.map((e, i) => renderEntry(e, i))}</div>
            )}
          </div>
        </section>
      )}

      {/* ── Agenda list — inner scroll, today centred, floating Today ── */}
      {calView === 'list' && (
        <section className="pb-card pb-agenda-wrap">
          <div ref={timelineRef} className="pb-agenda">
            {allDateKeys.map((dateKey) => {
              const entries = groups.get(dateKey) || [];
              const d = new Date(`${dateKey}T00:00:00`);
              const isToday = dateKey === today;
              const isPast = dateKey < today;
              const isEmpty = entries.length === 0;
              return (
                <div
                  key={dateKey}
                  data-date={dateKey}
                  className={`pb-day-row${isToday ? ' is-today' : ''}${isPast ? ' is-past' : ''}${isEmpty ? ' is-empty' : ''}`}
                >
                  <div className="pb-day-gutter">
                    <span className="pb-day-num">{d.getDate()}</span>
                    <span className="pb-day-wd">{isToday ? 'Today' : WEEKDAY_SHORT[d.getDay()]}</span>
                  </div>
                  <div className="pb-day-body">
                    {isEmpty ? <span className="pb-day-empty">—</span> : (
                      <div className="pb-entries">{entries.map((e, i) => renderEntry(e, i))}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {showTodayFab && (
            <button
              type="button"
              className="pb-fab"
              onClick={() => {
                const el = timelineRef.current?.querySelector(`[data-date="${today}"]`);
                if (el) scrollToToday('smooth');
                else jumpToToday();
              }}
              aria-label="Scroll to today"
            >
              <Crosshair size={14} /> Today
            </button>
          )}
        </section>
      )}
    </div>
  );
}
