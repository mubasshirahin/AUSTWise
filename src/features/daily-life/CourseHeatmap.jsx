import { useEffect, useMemo, useRef } from 'react';

/* GitHub-style activity heatmap for one course: each cell is a day, each
 * column a week (Sun → Sat). Colour = how many lessons were ticked done that
 * day, read from each lesson's `doneAt`. Unticking a lesson clears its
 * `doneAt`, so only lessons that are still done are counted.
 *
 * One hue (theme accent), 4 steps light → dark; empty days use the neutral well.
 */

const WEEKS = 53;
const DAY_MS = 86400000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDay = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const levelOf = (n) => (n <= 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4);

export default function CourseHeatmap({ lessons }) {
  const scrollRef = useRef(null);

  const data = useMemo(() => {
    const counts = new Map();
    for (const l of lessons) {
      if (!l.isDone || !l.doneAt) continue;
      const d = new Date(l.doneAt);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      counts.set(k, (counts.get(k) || 0) + 1);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Grid starts on the Sunday WEEKS-1 weeks before this week's Sunday
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() - (WEEKS - 1) * 7);

    const weeks = [];
    const monthLabels = [];
    let total = 0;
    let activeDays = 0;
    for (let w = 0; w < WEEKS; w += 1) {
      const col = [];
      for (let dow = 0; dow < 7; dow += 1) {
        const d = new Date(start.getTime() + (w * 7 + dow) * DAY_MS);
        d.setHours(0, 0, 0, 0);
        const future = d > today;
        const n = future ? 0 : counts.get(dayKey(d)) || 0;
        if (n) { total += n; activeDays += 1; }
        col.push({ key: dayKey(d), date: d, n, future });
      }
      const first = col[0].date;
      // Label a month on the first week that contains its 1st day
      const firstOfMonth = col.find((c) => c.date.getDate() === 1);
      if (w === 0) monthLabels.push({ w, label: MONTHS[first.getMonth()] });
      else if (firstOfMonth) monthLabels.push({ w, label: MONTHS[firstOfMonth.date.getMonth()] });
      weeks.push(col);
    }
    // Drop a first-column label that would collide with the next one
    if (monthLabels.length > 1 && monthLabels[1].w - monthLabels[0].w < 3) monthLabels.shift();

    // Current streak: consecutive days with activity ending today (or yesterday)
    let streak = 0;
    const cursor = new Date(today);
    if (!counts.get(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (counts.get(dayKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }

    return { weeks, monthLabels, total, activeDays, streak };
  }, [lessons]);

  // Start scrolled to today on narrow screens
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [data]);

  const summary = `${data.total} lesson${data.total === 1 ? '' : 's'} done in the last year on ${data.activeDays} day${data.activeDays === 1 ? '' : 's'}`;

  return (
    <section className="pb-card cs-heat">
      <header className="pb-head">
        <h3 className="pb-title">Activity</h3>
        <span className="pb-meta cs-heat-sub">{summary}{data.streak > 0 ? ` · ${data.streak}-day streak` : ''}</span>
      </header>

      <div className="cs-heat-scroll" ref={scrollRef}>
        <div className="cs-heat-grid" role="img" aria-label={`Lesson activity heatmap: ${summary}`} style={{ '--weeks': WEEKS }}>
          <div className="cs-heat-months" aria-hidden="true">
            {data.monthLabels.map((m) => (
              <span key={`${m.w}-${m.label}`} style={{ gridColumn: `${m.w + 1} / span 3` }}>{m.label}</span>
            ))}
          </div>
          <div className="cs-heat-days" aria-hidden="true">
            <span /><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span />
          </div>
          <div className="cs-heat-cells">
            {data.weeks.map((col, w) => (
              <div className="cs-heat-week" key={w}>
                {col.map((c) => (
                  <span
                    key={c.key}
                    className={`cs-heat-cell lv-${levelOf(c.n)}${c.future ? ' is-future' : ''}`}
                    title={c.future ? undefined : `${c.n ? `${c.n} lesson${c.n === 1 ? '' : 's'}` : 'No lessons'} · ${fmtDay(c.date)}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="cs-heat-legend" aria-hidden="true">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((lv) => <span key={lv} className={`cs-heat-cell lv-${lv}`} />)}
        <span>More</span>
      </div>
    </section>
  );
}
