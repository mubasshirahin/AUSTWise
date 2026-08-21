// Validates the tracker's semester session generation against real
// getCalculatedAttendanceDates output. Run: node dev/attendance_dates_check.mjs
import { getCalculatedAttendanceDates } from '../src/utils/semesterDates.js';

const DAY_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } };

// A mid-semester-style start: first Saturday of Aug 2026 is the 1st.
const start = new Date('2026-08-01T00:00:00');
const days = ['Sunday', 'Tuesday', 'Thursday'];
const sessions = getCalculatedAttendanceDates(start, days, {});
const biweekly = getCalculatedAttendanceDates(start, days, { biWeekly: true });

// 1) Chronological order
for (let i = 1; i < sessions.length; i++) {
  assert(sessions[i].date >= sessions[i - 1].date, 'sessions sorted chronologically');
}

// 2) Every date lands on its scheduled weekday
sessions.forEach(s => {
  assert(s.date.getDay() === DAY_INDEX[s.dayName], `weekday matches dayName (${s.dayName})`);
});

// 3) Week numbers only in {1..7, 8..14} — mid break/exam excluded
sessions.forEach(s => {
  const ok = (s.weekNum >= 1 && s.weekNum <= 7) || (s.weekNum >= 8 && s.weekNum <= 14);
  assert(ok, `weekNum ${s.weekNum} in range`);
});

// 4) No session inside the mid-term gap: Semester View raw weeks 8-9
//    (the calendar weeks ending 2 and 3 Fridays after week1's Friday).
sessions.forEach(s => {
  const toFriday = (d) => { const f = new Date(d); f.setDate(d.getDate() - ((d.getDay() - 5 + 7) % 7)); f.setHours(0, 0, 0, 0); return f; };
  const raw = Math.floor((toFriday(s.date) - toFriday(new Date('2026-08-01T00:00:00'))) / (7 * 24 * 60 * 60 * 1000)) + 1;
  assert(!(raw === 8 || raw === 9), `no class in mid break/exam (raw ${raw}, ${s.id})`);
});

// 5) IDs unique and embed the date
const ids = new Set(sessions.map(s => s.id));
assert(ids.size === sessions.length, 'ids unique');
assert([...ids].every(id => /\d{4}-\d{2}-\d{2}$/.test(id)), 'ids end with ISO date');

// 6) biWeekly ≈ half
assert(Math.abs(biweekly.length - sessions.length / 2) <= days.length,
  `biweekly ~half (${biweekly.length} vs ${sessions.length})`);

console.log('dates OK:', {
  total: sessions.length,
  first: sessions[0].id,
  last: sessions[sessions.length - 1].id,
  biweekly: biweekly.length,
});
