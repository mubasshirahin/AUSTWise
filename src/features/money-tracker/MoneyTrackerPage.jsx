import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  DollarSign, Plus, Trash2, Home, Wallet,
  CalendarDays, Calendar, CalendarRange,
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  AlertTriangle, X, PencilLine, BarChart2,
  Target, Layers, History,
} from 'lucide-react';
import './MoneyTrackerPage.css';
import {
  useTakaGeloKoi, sumFixed, sumDaily, remaining,
  dailyLimit, dailySpent, todayKey30,
  fmtMoney, addFixed, removeFixed, updateBudget,
  addDaily, removeDaily,
  TGK_CATEGORIES, catMeta, catTotals, recentDaily,
} from './takaGeloKoiStorage';

function fmtDateShort(d) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function dateFromKey(key) {
  const [y, m, dd] = key.split('-').map(Number);
  return new Date(y, m - 1, dd);
}

function CatDot({ id, size = 8 }) {
  return <span className="tgk-cat-dot" style={{ background: catMeta(id).color, width: size, height: size }} />;
}

function CatSelect({ value, onChange, className = '' }) {
  return (
    <select
      className={`tgk-select ${className}`.trim()}
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label="Category"
    >
      {TGK_CATEGORIES.map(c => (
        <option key={c.id} value={c.id}>{c.label}</option>
      ))}
    </select>
  );
}

export default function MoneyTrackerPage() {
  const [doc, update] = useTakaGeloKoi();

  /* ── View mode — Daily / Weekly / Monthly ── */
  const [viewMode, setViewMode] = useState(() => {
    try {
      const v = new URLSearchParams(window.location.search).get('tgkView');
      if (v && ['daily', 'weekly', 'monthly'].includes(v)) return v;
      const s = localStorage.getItem('aust-tgk-view');
      if (s && ['daily', 'weekly', 'monthly'].includes(s)) return s;
    } catch { /* ignore */ }
    return 'monthly';
  });

  useEffect(() => {
    try { localStorage.setItem('aust-tgk-view', viewMode); } catch { /* ignore */ }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tgkView', viewMode);
      window.history.replaceState({}, '', url);
    } catch { /* ignore */ }
  }, [viewMode]);

  /* ── Calendar navigation ── */
  const [calDate, setCalDate] = useState(() => new Date());

  const getWeekDates = useCallback((ref) => {
    const s = new Date(ref);
    s.setDate(ref.getDate() - ((ref.getDay() - 5 + 7) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s);
      d.setDate(s.getDate() + i);
      return d;
    });
  }, []);

  const weekDates = useMemo(() => getWeekDates(calDate), [calDate, getWeekDates]);

  const monthGrid = useMemo(() => {
    const y = calDate.getFullYear(), m = calDate.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const pad = (first.getDay() - 5 + 7) % 7; // Fri-start week
    const arr = [];
    for (let i = 0; i < pad; i++) arr.push(null);
    for (let d = 1; d <= last.getDate(); d++) arr.push(new Date(y, m, d));
    return arr;
  }, [calDate]);

  /* ── Computed stats ── */
  const now = new Date();
  const todayKey = todayKey30(now);
  const totalFixed = sumFixed(doc);
  const totalDaily = sumDaily(doc);
  const totalSpent = totalFixed + totalDaily;
  const rem = remaining(doc);
  const baseDaily = dailyLimit(doc, 30);
  const todayIdx = now.getDate() - 1;
  const daysLeft = Math.max(1, 30 - todayIdx);
  const dynamicDaily = Math.max(0, Math.floor(rem / daysLeft));
  const isOverBudget = rem < 0;
  const limitToday = isOverBudget ? dynamicDaily : baseDaily;
  const todaySpent = dailySpent(doc, todayKey);
  const todayPct = Math.min(100, Math.round((todaySpent / Math.max(1, limitToday)) * 100));
  const todayExceeds = todaySpent > limitToday;
  const safeToday = Math.max(0, limitToday - todaySpent);
  const daysElapsed = Math.max(1, todayIdx + 1);
  const avgPerDay = Math.round(totalSpent / daysElapsed);

  const budgetUsed = doc.budget > 0 ? Math.min(100, Math.round((totalSpent / doc.budget) * 100)) : 0;
  const ringColor = doc.budget <= 0
    ? 'var(--border-primary)'
    : isOverBudget
      ? 'var(--accent-rose)'
      : budgetUsed >= 80
        ? 'var(--accent-amber)'
        : 'var(--accent-emerald)';

  const cats = useMemo(() => catTotals(doc), [doc]);
  const recent = useMemo(() => recentDaily(doc, 6), [doc]);

  /* ── Budget inline edit ── */
  const [budgetEditing, setBudgetEditing] = useState(false);
  const [budgetInput, setBudgetInput] = useState(String(doc.budget || ''));

  const startBudgetEdit = () => {
    setBudgetInput(String(doc.budget || ''));
    setBudgetEditing(true);
  };

  const commitBudget = () => {
    const v = Number(budgetInput) || 0;
    update(d => updateBudget(d, v));
    setBudgetEditing(false);
  };

  /* ── Fixed expenses form state ── */
  const [fixedName, setFixedName] = useState('');
  const [fixedAmt, setFixedAmt] = useState('');
  const [fixedNote, setFixedNote] = useState('');
  const [fixedCat, setFixedCat] = useState('bills');

  /* ── Day modal ── */
  const [dayModal, setDayModal] = useState(null);
  const [dayTitle, setDayTitle] = useState('');
  const [dayAmt, setDayAmt] = useState('');
  const [dayNote, setDayNote] = useState('');
  const [dayCat, setDayCat] = useState('food');

  const handleAddFixed = () => {
    if (!fixedName.trim() || !fixedAmt) return;
    update(d => addFixed(d, { title: fixedName, amount: fixedAmt, note: fixedNote, cat: fixedCat }));
    setFixedName(''); setFixedAmt(''); setFixedNote(''); setFixedCat('bills');
  };

  const openDay = (key) => {
    setDayModal(key);
    setDayTitle(''); setDayAmt(''); setDayNote(''); setDayCat('food');
  };

  const handleAddDay = () => {
    if (!dayModal || !dayTitle.trim() || !dayAmt) return;
    update(d => addDaily(d, dayModal, { title: dayTitle, amount: dayAmt, note: dayNote, cat: dayCat }));
    setDayModal(null);
  };

  const navigate = (dir) => {
    const d = new Date(calDate);
    if (viewMode === 'daily') d.setDate(d.getDate() + dir);
    else if (viewMode === 'weekly') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCalDate(d);
  };

  const renderDayCell = (d) => {
    const key = todayKey30(d);
    const spent = dailySpent(doc, key);
    const count = (doc.daily?.[key] || []).length;
    const isToday = key === todayKey;
    const limitForDay = isOverBudget ? dynamicDaily : baseDaily;
    const isExceed = spent > limitForDay;
    const pct = spent > 0 ? Math.min(100, Math.round((spent / Math.max(1, limitForDay)) * 100)) : 0;
    return (
      <button
        key={key}
        type="button"
        className={`tgk-day${isToday ? ' is-today' : ''}${isExceed ? ' is-exceed' : ''}${spent > 0 ? ' has-spend' : ''}`}
        onClick={() => openDay(key)}
        title={`Limit ${fmtMoney(limitForDay)}`}
      >
        <span className="tgk-day-top">
          <span className="tgk-day-num">{String(d.getDate()).padStart(2, '0')}</span>
          {count > 0 && <span className="tgk-day-count">{count}</span>}
        </span>
        <span className="tgk-day-date">{fmtDateShort(d)}</span>
        <span className={`tgk-day-spent${isExceed ? ' is-over' : ''}`}>
          {spent ? fmtMoney(spent) : '—'}
        </span>
        <span className="tgk-day-track">
          <i
            style={{
              width: `${pct}%`,
              background: isExceed ? 'var(--accent-rose)' : 'var(--accent-emerald)',
            }}
          />
        </span>
      </button>
    );
  };

  return (
    <div className="tgk-widget glass-card-static animate-fadeInUp" style={{ padding: 'var(--sp-5)' }}>

      {/* ════════════════════════════════════════
          MASTHEAD
          ════════════════════════════════════════ */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile tgk-icon-tile">
            <DollarSign size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Daily Life</span>
            <p className="schedule-title">TakaGeloKoi</p>
            <span className="schedule-subtitle">Monthly budget &amp; daily spending tracker</span>
          </div>
        </div>
        <div className="schedule-actions">
          {budgetEditing ? (
            <div className="tgk-budget-inline">
              <input
                className="input tgk-budget-input-top"
                type="number"
                value={budgetInput}
                onChange={e => setBudgetInput(e.target.value)}
                onBlur={commitBudget}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitBudget();
                  if (e.key === 'Escape') setBudgetEditing(false);
                }}
                autoFocus
                placeholder="e.g. 20000"
              />
              <button type="button" className="btn btn-primary btn-sm tgk-save-btn" onClick={commitBudget}>Save</button>
            </div>
          ) : (
            <button type="button" className="tgk-budget-badge" onClick={startBudgetEdit} title="Click to edit budget">
              <Wallet size={11} />
              {doc.budget ? fmtMoney(doc.budget) : 'Set budget'}
              <PencilLine size={10} className="tgk-budget-badge-edit" />
            </button>
          )}
          <span className={`lp-badge ${isOverBudget ? 'lp-badge-rose' : 'lp-badge-amber'}`}>
            {isOverBudget ? <AlertTriangle size={10} /> : <TrendingUp size={10} />}
            {fmtMoney(rem)} remaining
          </span>
        </div>
      </div>
      <div className="schedule-dotted-divider" />

      {/* ════════════════════════════════════════
          HERO — budget ring + safe-to-spend + quick add
          ════════════════════════════════════════ */}
      <div className="tgk-hero">

        {/* Budget ring card */}
        <div className="tgk-card tgk-hero-budget">
          <div className="tgk-hero-ring-wrap">
            <div className="tgk-ring" style={{ '--pct': budgetUsed, '--ring': ringColor }}>
              <div className="tgk-ring-hole">
                <span className="tgk-ring-pct">{doc.budget > 0 ? `${budgetUsed}%` : '—'}</span>
                <span className="tgk-ring-cap">used</span>
              </div>
            </div>
            <div className="tgk-hero-copy">
              <span className="tgk-hero-overline">Monthly budget</span>
              <span className="tgk-hero-num">{doc.budget > 0 ? fmtMoney(doc.budget) : 'Not set yet'}</span>
              <div className="tgk-hero-split">
                <div className="tgk-hero-split-item">
                  <span className="tgk-hero-split-label"><TrendingDown size={11} /> Spent</span>
                  <span className="tgk-hero-split-value">{fmtMoney(totalSpent)}</span>
                </div>
                <div className="tgk-hero-split-item">
                  <span className="tgk-hero-split-label"><TrendingUp size={11} /> Left</span>
                  <span className={`tgk-hero-split-value ${isOverBudget ? 'is-over' : 'is-ok'}`}>{fmtMoney(rem)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="tgk-hero-bar">
            <span
              className="tgk-hero-bar-fill"
              style={{
                width: `${budgetUsed}%`,
                background: isOverBudget
                  ? 'var(--accent-rose)'
                  : budgetUsed >= 80
                    ? 'linear-gradient(90deg, var(--accent-amber), var(--accent-rose))'
                    : 'linear-gradient(90deg, var(--accent-emerald), var(--accent-amber))',
              }}
            />
          </div>
          {doc.budget <= 0 && (
            <button type="button" className="tgk-hero-cta" onClick={startBudgetEdit}>
              <Wallet size={12} /> Set your monthly budget to unlock insights
            </button>
          )}
        </div>

        {/* Side column */}
        <div className="tgk-hero-side">

          {/* Safe to spend */}
          <div className="tgk-card tgk-safespend">
            <div className="tgk-safespend-head"><Target size={13} /> Safe to spend today</div>
            <div className={`tgk-safespend-value${safeToday <= 0 ? ' is-over' : ''}`}>{fmtMoney(safeToday)}</div>
            <div className="tgk-safespend-meta">
              <span>{daysLeft} day{daysLeft > 1 ? 's' : ''} left</span>
              <span className="tgk-dot-sep" />
              <span>today {fmtMoney(todaySpent)} / {fmtMoney(limitToday)}</span>
            </div>
            <div className="tgk-safespend-bar">
              <span
                style={{
                  width: `${todayPct}%`,
                  background: todayExceeds ? 'var(--accent-rose)' : 'var(--accent-emerald)',
                }}
              />
            </div>
          </div>

        </div>
      </div>

      {/* ════════════════════════════════════════
          KPI STRIP
          ════════════════════════════════════════ */}
      <div className="tgk-kpis">
        <div className="tgk-kpi">
          <div className={`tgk-kpi-icon ${isOverBudget ? 'rose' : 'green'}`}><Wallet size={15} /></div>
          <div className="tgk-kpi-body">
            <span className={`tgk-kpi-value${isOverBudget ? ' is-over' : ' is-ok'}`}>{fmtMoney(rem)}</span>
            <span className="tgk-kpi-label">Remaining</span>
          </div>
        </div>
        <div className="tgk-kpi">
          <div className="tgk-kpi-icon rose"><Home size={15} /></div>
          <div className="tgk-kpi-body">
            <span className="tgk-kpi-value">{fmtMoney(totalFixed)}</span>
            <span className="tgk-kpi-label">Fixed</span>
          </div>
        </div>
        <div className="tgk-kpi">
          <div className="tgk-kpi-icon cyan"><CalendarDays size={15} /></div>
          <div className="tgk-kpi-body">
            <span className="tgk-kpi-value">{fmtMoney(totalDaily)}</span>
            <span className="tgk-kpi-label">Daily spent</span>
          </div>
        </div>
        <div className="tgk-kpi">
          <div className="tgk-kpi-icon amber"><DollarSign size={15} /></div>
          <div className="tgk-kpi-body">
            <span className="tgk-kpi-value">{fmtMoney(todaySpent)}</span>
            <span className="tgk-kpi-label">Today</span>
          </div>
        </div>
        <div className="tgk-kpi">
          <div className={`tgk-kpi-icon ${isOverBudget ? 'rose' : 'green'}`}><BarChart2 size={15} /></div>
          <div className="tgk-kpi-body">
            <span className="tgk-kpi-value">{fmtMoney(avgPerDay)}</span>
            <span className="tgk-kpi-label">Avg / day</span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          MAIN GRID — calendar + side rail
          ════════════════════════════════════════ */}
      <div className="tgk-main-grid">

        {/* ── Calendar ── */}
        <div className="tgk-card tgk-cal-panel">
          <div className="tgk-cal-header">
            <h4 className="tgk-card-title" style={{ margin: 0 }}>
              <CalendarDays size={14} /> Daily spending
            </h4>
            <div className="tgk-view-pills">
              <button
                type="button"
                className={`tgk-view-pill${viewMode === 'daily' ? ' is-active' : ''}`}
                onClick={() => setViewMode('daily')}
              >
                <Calendar size={11} /> Daily
              </button>
              <button
                type="button"
                className={`tgk-view-pill${viewMode === 'weekly' ? ' is-active' : ''}`}
                onClick={() => setViewMode('weekly')}
              >
                <CalendarRange size={11} /> Weekly
              </button>
              <button
                type="button"
                className={`tgk-view-pill${viewMode === 'monthly' ? ' is-active' : ''}`}
                onClick={() => setViewMode('monthly')}
              >
                <CalendarDays size={11} /> Monthly
              </button>
            </div>
          </div>

          {/* Navigation row */}
          <div className="tgk-cal-nav">
            <button type="button" className="schedule-nav-btn" onClick={() => navigate(-1)}>
              <ChevronLeft size={16} />
            </button>
            <span className="tgk-cal-period">
              {viewMode === 'daily'
                ? calDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
                : viewMode === 'weekly'
                  ? `${fmtDateShort(weekDates[0])} – ${fmtDateShort(weekDates[6])}`
                  : calDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </span>
            <button type="button" className="schedule-nav-btn" onClick={() => navigate(1)}>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day labels (Fri-start) */}
          {viewMode !== 'daily' && (
            <div className={`tgk-day-labels ${viewMode === 'weekly' ? 'tgk-day-labels-7' : ''}`}>
              {['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'].map(d => (
                <span key={d} className="tgk-day-label">{d}</span>
              ))}
            </div>
          )}

          {/* Daily view */}
          {viewMode === 'daily' && (() => {
            const key = todayKey30(calDate);
            const spent = dailySpent(doc, key);
            const entries = doc.daily?.[key] || [];
            const limitForDay = isOverBudget ? dynamicDaily : baseDaily;
            const isExceed = spent > limitForDay;
            const isToday = key === todayKey;
            return (
              <button
                type="button"
                className={`tgk-day tgk-day-large${isToday ? ' is-today' : ''}${isExceed ? ' is-exceed' : ''}`}
                onClick={() => openDay(key)}
              >
                <div className="tgk-day-top">
                  <span className="tgk-day-num">{String(calDate.getDate()).padStart(2, '0')}</span>
                  <span className="tgk-day-date">
                    {calDate.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <div className="tgk-day-body">
                  <span className="tgk-day-spent-big">
                    {spent ? fmtMoney(spent) : '— No expense'}
                  </span>
                  <span className="tgk-day-limit-label">
                    Spent {fmtMoney(spent)} of {fmtMoney(limitForDay)} limit
                  </span>
                </div>
                {spent > 0 && (
                  <span className="tgk-day-track tgk-day-track-lg">
                    <i style={{
                      width: `${Math.min(100, Math.round((spent / Math.max(1, limitForDay)) * 100))}%`,
                      background: isExceed ? 'var(--accent-rose)' : 'var(--accent-emerald)',
                    }} />
                  </span>
                )}
                {entries.length > 0 && (
                  <span className="tgk-day-cats">
                    {entries.slice(0, 6).map(e => <CatDot key={e.id} id={e.cat} size={9} />)}
                    <span className="tgk-day-cats-label">{entries.length} entr{entries.length > 1 ? 'ies' : 'y'}</span>
                  </span>
                )}
                <span className="tgk-day-add"><Plus size={10} /> Click to add / view expenses</span>
              </button>
            );
          })()}

          {/* Weekly view */}
          {viewMode === 'weekly' && (
            <div className="tgk-cal tgk-cal-7">
              {weekDates.map(d => renderDayCell(d))}
            </div>
          )}

          {/* Monthly view */}
          {viewMode === 'monthly' && (
            <div className="tgk-cal">
              {monthGrid.map((d, idx) => (
                d ? renderDayCell(d) : <div key={`pad-${idx}`} className="tgk-day-pad" />
              ))}
            </div>
          )}

          <p className="tgk-cal-hint">
            Box e click kore expense add karo — exceed hole red highlight, Today amber border.
          </p>
        </div>

        {/* ── Side rail ── */}
        <div className="tgk-rail">

          {/* Category breakdown */}
          <div className="tgk-card">
            <h4 className="tgk-card-title"><Layers size={14} /> Category breakdown</h4>
            {cats.length === 0 ? (
              <p className="tgk-empty-hint">No expenses yet — categories will show up here.</p>
            ) : (
              <div className="tgk-cat-list">
                {cats.map(c => (
                  <div key={c.id} className="tgk-cat-row">
                    <div className="tgk-cat-row-top">
                      <span className="tgk-cat-name"><CatDot id={c.id} /> {c.label}</span>
                      <span className="tgk-cat-amt">
                        {fmtMoney(c.total)}
                        <em className="tgk-cat-pct">{c.pct}%</em>
                      </span>
                    </div>
                    <div className="tgk-cat-track">
                      <span style={{ width: `${c.pct}%`, background: c.color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="tgk-card">
            <h4 className="tgk-card-title"><History size={14} /> Recent activity</h4>
            {recent.length === 0 ? (
              <p className="tgk-empty-hint">No daily expenses recorded yet.</p>
            ) : (
              <div className="tgk-recent-list">
                {recent.map(r => {
                  const d = dateFromKey(r.dateKey);
                  return (
                    <div key={`${r.dateKey}-${r.id}`} className="tgk-recent-row">
                      <span className="tgk-recent-date">
                        <strong>{String(d.getDate()).padStart(2, '0')}</strong>
                        {d.toLocaleDateString('en-GB', { month: 'short' })}
                      </span>
                      <div className="tgk-recent-info">
                        <span className="tgk-recent-title">{r.title || 'Expense'}</span>
                        <span className="tgk-recent-cat"><CatDot id={r.cat} /> {catMeta(r.cat).label}</span>
                      </div>
                      <span className="tgk-recent-amt">{fmtMoney(r.amount)}</span>
                      <button
                        type="button"
                        className="lp-icon-btn"
                        onClick={() => update(dd => removeDaily(dd, r.dateKey, r.id))}
                        aria-label="Remove"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fixed expenses */}
          <div className="tgk-card tgk-form-panel">
            <h4 className="tgk-card-title"><Home size={14} /> Fixed expenses</h4>

            <div className="tgk-form-row">
              <input
                className="input"
                value={fixedName}
                onChange={e => setFixedName(e.target.value)}
                placeholder="Title — e.g. Home Rent"
                style={{ flex: '2 1 140px' }}
              />
              <input
                className="input tgk-amt"
                type="number"
                value={fixedAmt}
                onChange={e => setFixedAmt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddFixed()}
                placeholder="Amount"
                style={{ flex: '1 1 90px' }}
              />
            </div>
            <div className="tgk-form-row">
              <CatSelect value={fixedCat} onChange={setFixedCat} className="tgk-select-grow" />
              <input
                className="input"
                value={fixedNote}
                onChange={e => setFixedNote(e.target.value)}
                placeholder="Note (optional)"
                style={{ flex: '2 1 130px' }}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm tgk-add-btn"
              onClick={handleAddFixed}
              disabled={!fixedName.trim() || !fixedAmt}
            >
              <Plus size={13} /> Add fixed expense
            </button>
            <div className="tgk-form-spacer" />

            {doc.fixed.length === 0 ? (
              <p className="tgk-empty-hint">No fixed expenses yet — add rent, wifi, subscriptions…</p>
            ) : (
              <div className="tgk-expense-list">
                {doc.fixed.map(f => (
                  <div key={f.id} className="tgk-expense-row">
                    <CatDot id={f.cat} />
                    <div className="tgk-expense-info">
                      <span className="tgk-expense-title">{f.title || f.name}</span>
                      <span className="tgk-expense-note">
                        {catMeta(f.cat).label}{f.note ? ` · ${f.note}` : ''}
                      </span>
                    </div>
                    <span className="tgk-expense-amt">{fmtMoney(f.amount)}</span>
                    <button
                      type="button"
                      className="lp-icon-btn"
                      onClick={() => update(d => removeFixed(d, f.id))}
                      aria-label="Remove"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                <div className="tgk-fixed-total">
                  <span className="tgk-fixed-total-label">Total fixed</span>
                  <span className="tgk-expense-amt is-rose">{fmtMoney(totalFixed)}</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ════════════════════════════════════════
          DAY EXPENSE MODAL
          ════════════════════════════════════════ */}
      {dayModal && (
        <div className="modal-overlay" onClick={() => setDayModal(null)}>
          <div className="modal tgk-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Expenses on ${dayModal}`}>

            {/* Header */}
            <div className="tgk-modal-head">
              <span className="tgk-modal-title">
                <PencilLine size={13} /> {dateFromKey(dayModal).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <button
                type="button"
                className="tgk-modal-close"
                onClick={() => setDayModal(null)}
                aria-label="Close"
              >
                <X size={12} />
              </button>
            </div>

            {/* Summary */}
            <div className="tgk-modal-summary">
              <span className="lp-badge lp-badge-muted">
                Spent: <strong style={{ color: 'var(--text-primary)' }}>{fmtMoney(dailySpent(doc, dayModal))}</strong>
              </span>
              <span className="lp-badge lp-badge-amber">
                Limit: {fmtMoney(baseDaily)}
              </span>
              {dailySpent(doc, dayModal) > baseDaily && (
                <span className="lp-badge lp-badge-rose"><AlertTriangle size={10} /> Exceeded</span>
              )}
            </div>

            {/* Add expense form */}
            <div className="tgk-form-row">
              <input
                className="input"
                value={dayTitle}
                onChange={e => setDayTitle(e.target.value)}
                placeholder="Title — e.g. Lunch"
                style={{ flex: '2 1 130px' }}
                autoFocus
              />
              <input
                className="input tgk-amt"
                type="number"
                value={dayAmt}
                onChange={e => setDayAmt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddDay()}
                placeholder="Amount"
                style={{ flex: '1 1 90px' }}
              />
            </div>
            <div className="tgk-form-row">
              <CatSelect value={dayCat} onChange={setDayCat} className="tgk-select-grow" />
              <input
                className="input"
                value={dayNote}
                onChange={e => setDayNote(e.target.value)}
                placeholder="Note (optional)"
                style={{ flex: '2 1 130px' }}
              />
            </div>
            <div className="tgk-form-row">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleAddDay}
                disabled={!dayTitle.trim() || !dayAmt}
                style={{ flex: 1 }}
              >
                <Plus size={13} /> Add
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setDayModal(null)}
                style={{ flex: 1 }}
              >
                Close
              </button>
            </div>

            {/* Existing expenses */}
            {(doc.daily[dayModal] || []).length > 0 && (
              <div className="tgk-modal-entries">
                <span className="tgk-modal-entries-label">Expenses on this day</span>
                {(doc.daily[dayModal] || []).map(e => (
                  <div key={e.id} className="tgk-expense-row">
                    <CatDot id={e.cat} />
                    <div className="tgk-expense-info">
                      <span className="tgk-expense-title">{e.title || 'Expense'}</span>
                      {(e.note || e.cat) && (
                        <span className="tgk-expense-note">
                          {catMeta(e.cat).label}{e.note && e.note !== e.title ? ` · ${e.note}` : ''}
                        </span>
                      )}
                    </div>
                    <span className="tgk-expense-amt">{fmtMoney(e.amount)}</span>
                    <button
                      type="button"
                      className="lp-icon-btn"
                      onClick={() => update(d => removeDaily(d, dayModal, e.id))}
                      aria-label="Remove"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
