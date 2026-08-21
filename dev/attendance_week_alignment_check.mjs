// Verifies the tracker's week numbering matches Semester View (WeekSchedule):
// weeks end on Friday, Week 1 = calendar week containing semesterStart.
// Cross-checks against WeekSchedule's own getCurrentWeekNum formula.
import { getCalculatedAttendanceDates } from '../src/utils/semesterDates.js';
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } };

// WeekSchedule's exact anchor math (toFriday + diff/7 + 1), then its
// getWeekLabel mapping: raw 1-7 = W1-7, raw 8 = Mid Break, raw 9 = Mid Exam,
// raw 10-16 = W8-14, raw 17 = PL.
function weekLabelPerWeekSchedule(dateStr, semStartStr) {
  const toFriday = (d) => { const f = new Date(d); f.setDate(d.getDate() - ((d.getDay() - 5 + 7) % 7)); return f; };
  const startDate = new Date(semStartStr);
  const d = new Date(dateStr);
  const diff = toFriday(d).getTime() - toFriday(startDate).getTime();
  const raw = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
  if (raw <= 7) return `Week ${raw}`;
  if (raw === 8) return 'Mid Break';
  if (raw === 9) return 'Mid Exam';
  if (raw <= 16) return `Week ${raw - 2}`;
  return 'PL';
}

const cases = [
  { start: '2026-06-27', days: ['Saturday', 'Sunday'] },   // Saturday start
  { start: '2026-06-28', days: ['Sunday', 'Tuesday'] },    // Sunday start
  { start: '2026-07-01', days: ['Wednesday', 'Friday'] },  // Wednesday start
];

for (const { start, days } of cases) {
  const sessions = getCalculatedAttendanceDates(new Date(start + 'T00:00:00'), days, {});
  // Every session's week must equal WeekSchedule's computed week number.
  sessions.forEach(s => {
    const iso = s.date.toISOString().split('T')[0];
    assert(s.label === weekLabelPerWeekSchedule(iso, start),
      `${start} ${s.id}: generator=${s.label} semesterView=${weekLabelPerWeekSchedule(iso, start)}`);
  });
  const weeks = [...new Set(sessions.map(x => x.weekNum))];
  assert(weeks[0] === 1 && weeks.length === 14, `weeks run 1..14 (${weeks.join(',')})`);
  // Mid gap: no session may carry the Mid Break / Mid Exam raw weeks (8-9).
  assert(!sessions.some(x => weekLabelPerWeekSchedule(x.date.toISOString().split('T')[0], start) === 'Mid Break'
    || weekLabelPerWeekSchedule(x.date.toISOString().split('T')[0], start) === 'Mid Exam'),
    'no classes in mid break/exam weeks');
  console.log(`${start} (${days.join('/')}): OK — ${sessions.length} sessions, weeks 1..7 + 10..17 mapped as W1..W14`);

  // Only need the full assertion set on the first case; others covered above.
}

console.log('friday-week convention consistent with Semester View');
