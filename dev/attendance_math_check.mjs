// Self-check for RoutineAttendanceTracker math (mirrors component logic).
// Run: node dev/attendance_math_check.mjs
const MIN_ATTENDANCE = 75;

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Instances: past held classes + future ones.
const today = new Date(); today.setHours(0, 0, 0, 0);
const mk = (offsetDays) => { const d = new Date(today); d.setDate(d.getDate() + offsetDays); return d; };
const instances = [
  { id: 'A::1', date: mk(-10) },
  { id: 'A::2', date: mk(-7) },
  { id: 'A::3', date: mk(-3) },
  { id: 'A::4', date: mk(0) },   // today counts as held
  { id: 'A::5', date: mk(+2) },  // future: not held
];

const sessionMarks = { 'A::1': 'present', 'A::2': 'absent', 'A::3': 'present' }; // manual
const telegramRecords = [
  // Bot marks today's class present; manual has no say yet → overlay applies.
  { CourseCode: 'A', RecordDate: toISODate(mk(0)) + 'T18:00:00.000Z', Attended: true },
  // Bot record on a non-class day → must be ignored.
  { CourseCode: 'A', RecordDate: toISODate(mk(-5)) + 'T18:00:00.000Z', Attended: false },
];

// Mirror of component's telegramMarks overlay
const idByDate = {};
instances.forEach(inst => { idByDate[`A|${toISODate(inst.date)}`] = inst.id; });
const telegramMarks = {};
telegramRecords.forEach(rec => {
  const courseKey = rec.CourseCode || rec.courseCode || rec.course;
  const dateStr = String(rec.RecordDate || rec.recordDate || '').split('T')[0];
  const attended = rec.Attended !== undefined ? rec.Attended : rec.attended;
  if (!courseKey || !dateStr) return;
  const id = idByDate[`${String(courseKey).toUpperCase()}|${dateStr}`];
  if (id) telegramMarks[id] = attended ? 'present' : 'absent';
});

const markFor = (inst) => sessionMarks[inst.id] ?? telegramMarks[inst.id] ?? null;

let attended = 0, absent = 0, held = 0;
instances.forEach(inst => {
  if (inst.date <= today) held++;
  const m = markFor(inst);
  if (m === 'present') attended++;
  else if (m === 'absent') absent++;
});
const totalSemesterClasses = instances.length;
const pct = held > 0 ? (attended / held) * 100 : 0;
const needed = Math.ceil(totalSemesterClasses * (MIN_ATTENDANCE / 100));
const canMiss = Math.max(0, totalSemesterClasses - needed - absent);

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } };

assert(held === 4, `held=4 (today counts), got ${held}`);
assert(attended === 3, `attended=3 (2 manual + bot today), got ${attended}`);
assert(absent === 1, `absent=1, got ${absent}`);
assert(pct === 75, `pct=75, got ${pct}`);
assert(canMiss === 0, `canMiss=0, got ${canMiss}`);

// Average across courses uses held denominator too.
const avg = totalSemesterClasses > 0 && held > 0 ? parseFloat(((attended / held) * 100).toFixed(1)) : 0;
assert(avg === 75, `avg=75, got ${avg}`);

// Edge: marks on future classes must not inflate the percentage (clamped).
const futureInstances = [
  { id: 'B::1', date: mk(-2) },
  { id: 'B::2', date: mk(-1) },
  { id: 'B::3', date: mk(+3) }, // future
  { id: 'B::4', date: mk(+5) }, // future
];
const futureMarks = { 'B::1': 'present', 'B::2': 'present', 'B::3': 'present', 'B::4': 'present' };
let fHeld = 0, fPresent = 0;
futureInstances.forEach(inst => {
  if (inst.date > today) return;
  fHeld++;
  if (futureMarks[inst.id] === 'present') fPresent++;
});
const fAttended = Math.min(fPresent, fHeld);
const fPct = fHeld > 0 ? (fAttended / fHeld) * 100 : 0;
assert(fAttended === 2 && fPct === 100, `future marks clamped (attended=${fAttended}, pct=${fPct})`);

console.log('attendance math OK:', { held, attended, absent, pct, canMiss, avg, futureClamp: fPct });
