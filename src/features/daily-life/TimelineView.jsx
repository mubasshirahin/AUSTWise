import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Crosshair, Flag, Target, ListChecks } from 'lucide-react';
import { buildTimelineRange, fmtDate, todayKey, goalDisplayNumber, byId } from './lifePlannerStorage';

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

  // Keep selectedYear inside decade window when decade shifts via arrows
  useEffect(() => {
    if (selectedYear < decadeStart || selectedYear > decadeStart + 9) {
      // snap to middle of new decade if outside
      setSelectedYear(decadeStart + 5);
    }
  }, [decadeStart, selectedYear]);

  const decadeYears = useMemo(() => Array.from({ length: 10 }, (_, i) => decadeStart + i), [decadeStart]);
  const decadeFrom = `${decadeStart}-01-01`;
  const decadeTo = `${decadeStart + 9}-12-31`;

  const allEntries = useMemo(() => buildTimelineRange(doc, decadeFrom, decadeTo), [doc, decadeFrom, decadeTo]);

  // Counts per year for badge
  const countByYear = useMemo(() => {
    const m = {};
    for (const e of allEntries) {
      const y = Number(e.date.slice(0,4));
      m[y] = (m[y]||0)+1;
    }
    return m;
  }, [allEntries]);

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

  // ── Scrollable timeline — only inner scrolls, today centered ──
  const timelineRef = useRef(null);
  const [showTodayFab, setShowTodayFab] = useState(false);

  const scrollToToday = useCallback((behavior = 'smooth') => {
    const el = timelineRef.current?.querySelector(`[data-date="${today}"]`);
    if (el) el.scrollIntoView({ behavior, block: 'center', inline: 'nearest' });
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

  const shiftDecade = (dir) => {
    setDecadeStart(s => s + dir * 10);
  };
  const shiftYear = (dir) => {
    const ny = selectedYear + dir;
    // auto-shift decade if year exits window
    if (ny < decadeStart) setDecadeStart(d => d - 10);
    else if (ny > decadeStart + 9) setDecadeStart(d => d + 10);
    setSelectedYear(ny);
  };
  const shiftMonth = (dir) => {
    let ny = selectedYear;
    let nm = selectedMonth + dir;
    if (nm < 0) { nm = 11; ny -= 1; }
    if (nm > 11) { nm = 0; ny += 1; }
    if (ny < decadeStart) setDecadeStart(d => d - 10);
    else if (ny > decadeStart + 9) setDecadeStart(d => d + 10);
    setSelectedYear(ny);
    setSelectedMonth(nm);
  };

  return (
    <div>
      <DecadeControls
        mode={mode} setMode={setMode}
        decadeStart={decadeStart} decadeYears={decadeYears}
        selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
        countByYear={countByYear} countByMonth={countByMonth}
        currentYear={currentYear} currentMonth={currentMonth}
        onShiftDecade={shiftDecade} onShiftYear={shiftYear} onShiftMonth={shiftMonth}
        onJumpToday={jumpToToday}
      />

      {/* Filter summary bar */}
      <div className="lp-tl-summary">
        <span className="lp-badge lp-badge-cyan" style={{fontSize:11}}>
          {mode === 'year' ? `${selectedYear} • ${filtered.length} items` : `${MONTHS_FULL[selectedMonth]} ${selectedYear} • ${filtered.length} items`}
        </span>
        {selectedYear===currentYear && mode==='month' && selectedMonth===currentMonth && (
          <span style={{fontSize:11, color:'var(--text-tertiary)'}}>• Today in view</span>
        )}
        {filtered.some(e=>e.date < today) && <span className="lp-badge lp-badge-rose" style={{fontSize:10}}>Has overdue</span>}
      </div>

      {/* Entries — separate scrollable section, only inner scrolls; today centered + Today FAB */}
      <div style={{ position: 'relative' }}>
        <div ref={timelineRef} className="lp-timeline-scroll">
          <div className="lp-timeline">
            {allDateKeys.map((dateKey) => {
              const entries = groups.get(dateKey) || [];
              const isToday = dateKey === today;
              const isOverdue = dateKey < today;
              const isEmpty = entries.length === 0;
              const msList = doc.goals.filter((g) => (g.types || []).includes('milestone')).sort((a,b)=>(a.order||0)-(b.order||0));
              return (
                <div key={dateKey} data-date={dateKey}>
                  <div className={`lp-tl-item ${isToday ? '' : isOverdue ? 'overdue' : 'past'}${isEmpty ? ' lp-tl-item--empty' : ''}`}>
                    <div className="lp-tl-date" style={isToday ? {color:'var(--accent-amber)', fontWeight:800} : undefined}>
                      {fmtDate(dateKey)} {isToday && <span className="lp-badge lp-badge-amber" style={{marginLeft:6, fontSize:9, verticalAlign:'middle'}}>Today</span>} {isOverdue && !isEmpty && <span className="lp-badge lp-badge-rose" style={{marginLeft:6, fontSize:9}}>Overdue</span>}
                    </div>
                    {isEmpty ? (
                      <div className="lp-tl-row">
                        <div className="lp-tl-label" style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', opacity:0.55 }}>
                          <span style={{fontSize:12, color:'var(--text-tertiary)', fontStyle:'italic'}}>No tasks/steps — empty</span>
                        </div>
                      </div>
                    ) : entries.map((e, i) => {
                      const milestone = e.milestone || null;
                      const goal = e.goal || null;
                      const task = e.task || null;
                      const msIdx = milestone ? msList.findIndex((x)=>x.id===milestone.id) : -1;
                      return (
                      <div key={`${e.date}-${e.kind}-${i}`} className="lp-tl-row" style={{ flexDirection:'column', alignItems:'stretch', gap:0 }}>
                        <div className="lp-tl-label" style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                          {e.recurring && <span className="lp-badge lp-badge-amber" style={{fontSize:9}}>Recurring</span>}
                          {e.kind==='goal' && <span className="lp-badge lp-badge-purple" style={{fontSize:9}}>Goal deadline</span>}
                          {e.kind==='milestone' && <span className="lp-badge lp-badge-purple" style={{fontSize:9}}>Milestone deadline</span>}
                          {e.kind==='task' && !e.recurring && <span className="lp-badge lp-badge-amber" style={{fontSize:9}}>Task</span>}
                          {e.kind==='step' && !e.recurring && <span className="lp-badge lp-badge-emerald" style={{fontSize:9}}>Step</span>}
                          <span
                            role={goal ? 'button' : undefined}
                            tabIndex={goal ? 0 : undefined}
                            style={{ cursor: goal ? 'pointer' : 'default', textDecoration: goal ? 'underline dotted' : 'none', textUnderlineOffset:3, fontSize:13 }}
                            onClick={() => goal && onOpenGoal(goal.id)}
                            onKeyDown={(ev)=>{ if((ev.key==='Enter'||ev.key===' ')&&goal){ ev.preventDefault(); onOpenGoal(goal.id);} }}
                          >
                            {e.kind==='task' ? <strong>{e.label}</strong> : e.label}
                          </span>
                          {e.done && <span className="lp-badge lp-badge-emerald" style={{fontSize:9}}>Done</span>}
                        </div>
                        <div className="lp-tl-entry-footer">
                          {milestone && (
                            <span style={{ display:'inline-flex', alignItems:'center', gap:4, color:'var(--accent-purple)', fontWeight:600 }}>
                              <Flag size={10} /> Milestone {msIdx>=0?msIdx+1:'?'}: {milestone.title}
                            </span>
                          )}
                          {goal && (
                            <>
                              {milestone && <span style={{opacity:0.4}}>›</span>}
                              <span style={{ display:'inline-flex', alignItems:'center', gap:4, color:'var(--accent-amber)', fontWeight:600 }}>
                                <Target size={10} /> Goal G{goalDisplayNumber(doc, goal)}: {goal.title}
                              </span>
                            </>
                          )}
                          {e.kind==='step' && task && (
                            <>
                              <span style={{opacity:0.4}}>›</span>
                              <span style={{ display:'inline-flex', alignItems:'center', gap:4, color:'var(--accent-cyan)', fontWeight:600 }}>
                                <ListChecks size={10} /> {task.name}
                              </span>
                            </>
                          )}
                          {e.kind==='step' && <span style={{color:'var(--accent-emerald)', fontWeight:600, fontSize:10}}>› Step</span>}
                        </div>
                      </div>
                    );})}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Floating Today — works from any year/month, jumps to today if needed */}
        {showTodayFab && (
          <button type="button" className="lp-tl-today-fab" onClick={() => {
            const el = timelineRef.current?.querySelector(`[data-date="${today}"]`);
            if (el) scrollToToday('smooth');
            else jumpToToday();
          }} aria-label="Scroll to today">
            <Crosshair size={14} /> Today
          </button>
        )}
      </div>
    </div>
  );
}

function DecadeControls({
  mode, setMode,
  decadeStart, decadeYears,
  selectedYear, setSelectedYear,
  selectedMonth, setSelectedMonth,
  countByYear, countByMonth,
  currentYear, currentMonth,
  onShiftDecade, onShiftYear, onShiftMonth, onJumpToday
}) {
  return (
    <div className="lp-tl-decade-wrap">
      {/* Month strip */}
      <div className="lp-tl-month-strip">
          <button type="button" className="lp-tl-arrow sm" onClick={()=>onShiftYear(-1)} aria-label="Previous year">
            <ChevronLeft size={14}/>
          </button>
          <span className="lp-tl-month-year-label">{selectedYear}</span>
          <div className="lp-tl-months">
            {MONTHS.map((m, idx) => {
              const isSel = idx===selectedMonth;
              const isNow = selectedYear===currentYear && idx===currentMonth;
              const cnt = countByMonth[idx]||0;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={()=>setSelectedMonth(idx)}
                  className={`lp-tl-month-pill ${isSel ? 'selected' : ''} ${isNow ? 'today' : ''}`}
                  title={`${MONTHS_FULL[idx]} ${selectedYear} — ${cnt} items`}
                >
                  {m}
                  {cnt>0 && <i className="dot" />}
                </button>
              );
            })}
          </div>
          <button type="button" className="lp-tl-arrow sm" onClick={()=>onShiftYear(1)} aria-label="Next year">
            <ChevronRight size={14}/>
          </button>
        </div>
    </div>
  );
}
