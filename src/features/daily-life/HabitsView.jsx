import { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Flame, Archive, ArchiveRestore, Trash2, CalendarDays,
} from 'lucide-react';
import { LpEmpty, LpModal, LpConfirm, useConfirmState } from './LifePlannerUI';
import {
  habitDone, habitStreak, habitBestStreak, habitWeekCount, toggleHabitDay,
  addHabit, updateHabit, startOfWeek, addDays, todayKey, fmtDate,
} from './lifePlannerStorage';

/**
 * Habit Tracker (Section 5.4): weekly grid with toggles, streak + best
 * streak, per-habit GitHub-style monthly heatmap, archive instead of delete.
 */
export default function HabitsView({ doc, update, onConfirm }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [showAdd, setShowAdd] = useState(false);
  const [heatHabitId, setHeatHabitId] = useState(null);
  const [newHabit, setNewHabit] = useState({ name: '', frequency: 'daily', targetDaysPerWeek: '', startDate: '' });
  const [confirmState, setConfirmState] = useConfirmState();

  const active = doc.habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order);
  const archived = doc.habits.filter((h) => h.archived);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = todayKey();
  const isThisWeek = startOfWeek(new Date()).getTime() === weekStart.getTime();

  const heatHabit = doc.habits.find((h) => h.id === heatHabitId) || active[0] || null;

  const shiftWeek = (n) => setWeekStart((ws) => addDays(ws, n * 7));

  const handleToggle = (habitId, dateKey) => {
    // Optimistic toggle; future dates are not loggable.
    update((d) => toggleHabitDay(d, habitId, dateKey));
  };

  const handleAddHabit = (e) => {
    e.preventDefault();
    if (!newHabit.name.trim()) return;
    update((d) => addHabit(d, {
      name: newHabit.name,
      frequency: newHabit.frequency,
      targetDaysPerWeek: newHabit.targetDaysPerWeek ? Number(newHabit.targetDaysPerWeek) : null,
      startDate: newHabit.startDate || todayKey(),
    }));
    setNewHabit({ name: '', frequency: 'daily', targetDaysPerWeek: '', startDate: '' });
    setShowAdd(false);
  };

  const askDeleteHabit = (habit) => {
    setConfirmState({
      title: 'Delete habit?',
      message: `"${habit.name}" and its entire log history will be removed permanently. Archive instead if you want to keep history.`,
      confirmLabel: 'Delete forever',
      onConfirm: () => {
        update((d) => {
          const habitLogs = { ...(d.habitLogs || {}) };
          delete habitLogs[habit.id];
          return { ...d, habits: d.habits.filter((h) => h.id !== habit.id), habitLogs };
        });
        if (heatHabitId === habit.id) setHeatHabitId(null);
        setConfirmState(null);
      },
    });
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="lp-toolbar">
        <div className="lp-week-nav">
          <button type="button" className="schedule-nav-btn" onClick={() => shiftWeek(-1)} aria-label="Previous week">
            <ChevronLeft size={16} />
          </button>
          <span className="lp-week-pill">
            {fmtDate(todayKey(weekDays[0]))} → {fmtDate(todayKey(weekDays[6]))}
          </span>
          <button type="button" className="schedule-nav-btn" onClick={() => shiftWeek(1)} aria-label="Next week">
            <ChevronRight size={16} />
          </button>
          {!isThisWeek && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              This week
            </button>
          )}
        </div>
        <span className="lp-spacer" />
        <button type="button" className="lp-add-btn" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> New Habit
        </button>
      </div>

      {/* Weekly grid */}
      {active.length === 0 ? (
        <LpEmpty
          icon={Flame}
          title="No habits yet"
          hint="Track the small daily wins — reading, workouts, revision — and watch the streaks grow."
        />
      ) : (
        <div className="lp-panel" style={{ overflowX: 'auto' }}>
          <table className="lp-habit-grid">
            <thead>
              <tr>
                <th style={{ minWidth: 190 }}>Habit</th>
                {weekDays.map((d) => {
                  const key = todayKey(d);
                  return (
                    <th key={key} style={{ minWidth: 36 }}>
                      {d.toLocaleDateString('en-US', { weekday: 'short' })}
                      <span style={{ display: 'block', fontWeight: 'normal', opacity: 0.7 }}>{d.getDate()}</span>
                    </th>
                  );
                })}
                <th style={{ minWidth: 70 }}>Best</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {active.map((habit) => {
                const streak = habitStreak(doc, habit);
                const best = habitBestStreak(doc, habit);
                const weekCount = habitWeekCount(doc, habit, weekStart);
                return (
                  <tr key={habit.id}>
                    <td>
                      <div className="lp-habit-name">
                        <span className="name-text" title={habit.name}>{habit.name}</span>
                        <span className="lp-streak-pill" title="Current streak"><Flame size={10} /> {streak}</span>
                        {habit.targetDaysPerWeek && (
                          <span className="lp-badge lp-badge-muted">{weekCount}/{habit.targetDaysPerWeek}</span>
                        )}
                      </div>
                    </td>
                    {weekDays.map((d) => {
                      const key = todayKey(d);
                      const isFuture = key > today;
                      const isDone = habitDone(doc, habit.id, key);
                      return (
                        <td key={key}>
                          <button
                            type="button"
                            className={`lp-day-cell${isDone ? ' on' : ''}${key === today ? ' today-cell' : ''}${isFuture ? ' future' : ''}`}
                            disabled={isFuture}
                            onClick={() => handleToggle(habit.id, key)}
                            aria-label={`${habit.name} on ${fmtDate(key)}: ${isDone ? 'done' : 'not done'}`}
                            aria-pressed={isDone}
                          >
                            {isDone ? '✓' : ''}
                          </button>
                        </td>
                      );
                    })}
                    <td style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>🏅 {best}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button type="button" className="lp-icon-btn" onClick={() => update((d) => updateHabit(d, habit.id, { archived: true }))} aria-label={`Archive ${habit.name}`} title="Archive">
                          <Archive size={12} />
                        </button>
                        <button type="button" className="lp-icon-btn" onClick={() => askDeleteHabit(habit)} aria-label={`Delete ${habit.name}`} title="Delete">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Heatmap */}
      {heatHabit && (
        <HeatmapPanel
          doc={doc}
          habits={active}
          habit={heatHabit}
          onSelect={setHeatHabitId}
        />
      )}

      {/* Archived */}
      {archived.length > 0 && (
        <div className="lp-panel">
          <h4 className="lp-panel-title"><Archive size={14} /> Archived</h4>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {archived.map((h) => (
              <span key={h.id} className="lp-dep-chip">
                {h.name}
                <button
                  type="button"
                  onClick={() => update((d) => updateHabit(d, h.id, { archived: false }))}
                  aria-label={`Restore ${h.name}`}
                  title="Restore"
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                >
                  <ArchiveRestore size={11} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Add habit modal */}
      {showAdd && (
        <LpModal title="New Habit" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAddHabit} className="lp-form-grid">
            <div>
              <label className="lp-form-label" htmlFor="lp-habit-name">Name</label>
              <input id="lp-habit-name" className="input" value={newHabit.name} onChange={(e) => setNewHabit((h) => ({ ...h, name: e.target.value }))} placeholder="e.g. Read 20 minutes" autoFocus />
            </div>
            <div className="lp-form-row">
              <div>
                <label className="lp-form-label" htmlFor="lp-habit-freq">Frequency</label>
                <select id="lp-habit-freq" className="input" value={newHabit.frequency} onChange={(e) => setNewHabit((h) => ({ ...h, frequency: e.target.value }))}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="lp-form-label" htmlFor="lp-habit-target">Target days / week</label>
                <input id="lp-habit-target" type="number" min="1" max="7" className="input" value={newHabit.targetDaysPerWeek} onChange={(e) => setNewHabit((h) => ({ ...h, targetDaysPerWeek: e.target.value }))} placeholder="e.g. 5" />
              </div>
            </div>
            <div>
              <label className="lp-form-label" htmlFor="lp-habit-start">Start date</label>
              <input id="lp-habit-start" type="date" className="input" value={newHabit.startDate} onChange={(e) => setNewHabit((h) => ({ ...h, startDate: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1 }}>Add habit</button>
            </div>
          </form>
        </LpModal>
      )}

      {confirmState && (
        <LpConfirm
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}

// ── Monthly heatmap (last ~4 months, GitHub style) ───────────────────────────

function HeatmapPanel({ doc, habits, habit, onSelect }) {
  const cells = useMemo(() => {
    const out = [];
    const start = startOfWeek(addDays(new Date(), -120));
    for (let d = new Date(start); d <= new Date(); d = addDays(d, 1)) {
      const key = todayKey(d);
      let done = false;
      if (habit) done = habitDone(doc, habit.id, key);
      out.push({ key, done, future: key > todayKey() });
    }
    return out;
  }, [doc, habit]);

  return (
    <div className="lp-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <h4 className="lp-panel-title" style={{ margin: 0, flex: 1 }}>
          <CalendarDays size={14} /> Consistency — last 4 months
        </h4>
        {habits.length > 1 && (
          <select className="input" style={{ maxWidth: 190 }} value={habit?.id || ''} onChange={(e) => onSelect(e.target.value)} aria-label="Choose habit for heatmap">
            {habits.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        )}
      </div>
      <div className="lp-heatmap">
        {cells.map((c) => (
          <div
            key={c.key}
            className={`lp-heat-cell${c.done ? ' l3' : ''}`}
            title={`${fmtDate(c.key)}: ${c.done ? 'done' : '—'}`}
          />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>
        Less
        <span className="lp-heat-cell" />
        <span className="lp-heat-cell l1" />
        <span className="lp-heat-cell l2" />
        <span className="lp-heat-cell l3" />
        More
      </div>
    </div>
  );
}
