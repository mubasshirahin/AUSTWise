// Week-1 regression check for getCalculatedAttendanceDates.
import { getCalculatedAttendanceDates } from '../src/utils/semesterDates.js';
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } };
const weeksOf = (s) => [...new Set(s.map(x => x.weekNum))];

// Case 1: Sunday start — Week 1 must be that single Sunday, not empty.
const a = getCalculatedAttendanceDates(new Date('2026-06-28T00:00:00'), ['Sunday', 'Tuesday']);
const wa = weeksOf(a);
assert(wa.includes(1), `Sunday start includes week 1 (got ${wa.join(',')})`);
assert(a.some(x => x.weekNum === 1 && x.dayName === 'Sunday'), 'week 1 has the start Sunday');
assert(wa.join(',') === '1,2,3,4,5,6,7,8,9,10,11,12,13,14', `all weeks present (${wa.join(',')})`);

// Case 2: Saturday start — partial week 1 keeps the Saturday.
const b = getCalculatedAttendanceDates(new Date('2026-06-27T00:00:00'), ['Saturday', 'Sunday']);
const wb = weeksOf(b);
assert(b[0].id === 'Saturday-w1-2026-06-27', `first session is week 1 Saturday (got ${b[0].id})`);
assert(wb.join(',') === '1,2,3,4,5,6,7,8,9,10,11,12,13,14', `all weeks present (${wb.join(',')})`);

// Case 3: Wednesday start — Wed+Fri land in partial week 1.
const c = getCalculatedAttendanceDates(new Date('2026-07-01T00:00:00'), ['Wednesday', 'Friday']);
const wc = weeksOf(c);
assert(c.filter(x => x.weekNum === 1).length === 2, `partial week 1 has Wed+Fri (got ${c.filter(x => x.weekNum === 1).length})`);
assert(wc.join(',') === '1,2,3,4,5,6,7,8,9,10,11,12,13,14', `all weeks present (${wc.join(',')})`);

console.log('week1 OK:', {
  sundayStart: `${a.length} sessions`,
  saturdayStart: `${b.length} sessions`,
  wednesdayStart: `${c.length} sessions`,
});
