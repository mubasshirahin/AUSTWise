import { useState, useMemo } from 'react';
import { CalendarClock, ArrowRight } from 'lucide-react';
import { LpEmpty } from './LifePlannerUI';
import { buildTimeline, fmtDate, todayKey } from './lifePlannerStorage';

/**
 * Timeline (Section 5.5): merges Task.dueDate + Step.dueDate chronologically,
 * inserts a "Today" divider, flags overdue items in red (with the word
 * "Overdue", not just color), supports a simple range filter.
 */
export default function TimelineView({ doc, onOpenGoal }) {
  const [range, setRange] = useState('all'); // 'all' | 'upcoming' | 'past' | '30d'
  const [jumped, setJumped] = useState(false);

  const today = todayKey();
  const timeline = useMemo(() => buildTimeline(doc), [doc]);
  const openItems = timeline.filter((e) => !(e.kind === 'step' && e.done));

  const filtered = useMemo(() => {
    if (range === 'upcoming') return openItems.filter((e) => e.date >= today);
    if (range === 'past') return openItems.filter((e) => e.date < today);
    if (range === '30d') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + 30);
      const cutoffKey = todayKey(cutoff);
      return openItems.filter((e) => e.date >= today && e.date <= cutoffKey);
    }
    return openItems;
  }, [openItems, range, today]);

  // Group by date, inserting the Today divider in chronological position.
  const groups = useMemo(() => {
    const map = new Map();
    let todayInserted = false;
    for (const entry of filtered) {
      if (!todayInserted && entry.date > today) {
        map.set('__today__', []);
        todayInserted = true;
      }
      if (!map.has(entry.date)) map.set(entry.date, []);
      map.get(entry.date).push(entry);
    }
    if (!todayInserted && (range === 'all' || range === 'upcoming')) map.set('__today__', []);
    return map;
  }, [filtered, today, range]);

  const jumpToToday = () => {
    setRange('upcoming');
    setJumped(true);
    setTimeout(() => setJumped(false), 600);
  };

  if (timeline.length === 0) {
    return (
      <LpEmpty
        icon={CalendarClock}
        title="Nothing on the timeline yet"
        hint="Give any task or step a due date and it will appear here automatically."
      />
    );
  }

  return (
    <div>
      <div className="lp-toolbar">
        <select className="input" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Timeline range" style={{ maxWidth: 170 }}>
          <option value="all">All</option>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past &amp; overdue</option>
          <option value="30d">Next 30 days</option>
        </select>
        <span className="lp-spacer" />
        <button type="button" className="btn btn-secondary btn-sm" onClick={jumpToToday}>
          <ArrowRight size={12} /> Jump to today
        </button>
      </div>

      {filtered.length === 0 ? (
        <LpEmpty
          icon={CalendarClock}
          title="No items in this range"
          hint="Try another range, or add due dates to tasks and steps."
        />
      ) : (
        <div className="lp-timeline" style={jumped ? { outline: '2px dashed var(--accent-amber)', outlineOffset: 8, borderRadius: 8, transition: 'outline 0.3s' } : undefined}>
          {[...groups.entries()].map(([key, entries]) => (
            key === '__today__' ? (
              <div key="today-divider" className="lp-tl-item" style={{ padding: '10px 0' }}>
                <span className="lp-badge lp-badge-amber" style={{ fontSize: 11 }}>Today · {fmtDate(today)}</span>
              </div>
            ) : (
              <div key={key}>
                <div className="lp-tl-item">
                  <div className="lp-tl-date">{fmtDate(key)}</div>
                  {entries.map((e, i) => {
                    const overdue = e.date < today;
                    return (
                      <div
                        key={`${e.date}-${e.kind}-${i}`}
                        className={`lp-tl-item${overdue ? ' overdue' : e.date === today ? '' : ' past'}`}
                        style={{ paddingLeft: 0 }}
                      >
                        <div className="lp-tl-label" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {overdue && <span className="lp-badge lp-badge-rose">Overdue</span>}
                          <span
                            role="button"
                            tabIndex={0}
                            style={{ cursor: e.goal ? 'pointer' : 'default', textDecoration: e.goal ? 'underline dotted' : 'none', textUnderlineOffset: 3 }}
                            onClick={() => e.goal && onOpenGoal(e.goal.id)}
                            onKeyDown={(ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && e.goal) { ev.preventDefault(); onOpenGoal(e.goal.id); } }}
                          >
                            {e.kind === 'task' ? <strong>{e.label}</strong> : e.label}
                          </span>
                          {e.goal && (
                            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                              — Goal {e.goal.number}: {e.goal.title}
                            </span>
                          )}
                          {e.kind === 'step' && e.done && (
                            <span className="lp-badge lp-badge-emerald">Done</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
