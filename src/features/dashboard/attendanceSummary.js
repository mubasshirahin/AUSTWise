/**
 * Lightweight attendance summary for the dashboard's "At a glance" card.
 *
 * The Attendance tab is the only place that recomputes the semester average
 * and publishes it. A fresh device (or a user who has never opened that tab)
 * therefore has no stored average to show. This helper mirrors the tracker's
 * core calculation — routine + semester start + session marks — and returns
 * just the overall percentage, without the Telegram overlay or per-course
 * breakdown the full widget needs.
 */
import { getCalculatedAttendanceDates, getSemesterStartDate } from '../../utils/semesterDates';

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * @param {Object}   input
 * @param {Object}   input.routine        Routine provider map: { Sunday: [classes], … }
 * @param {string[]} input.weekDays       Ordered day names used by the routine.
 * @param {string}   [input.semesterStart] Shared semester start date (YYYY-MM-DD).
 * @param {Object}   [input.sessionMarks] "<courseKey>::<sessionId>" → 'present' | 'absent'
 * @param {Date}     [input.now]
 * @returns {number|null} Average percentage (1 decimal), or null when nothing is held yet.
 */
export function computeAttendanceAverage({
  routine,
  weekDays,
  semesterStart,
  sessionMarks,
  now = new Date(),
}) {
  if (!routine || !Array.isArray(weekDays) || !sessionMarks || typeof sessionMarks !== 'object') {
    return null;
  }

  const today = startOfDay(now);
  const courses = new Map();

  weekDays.forEach((day) => {
    const classes = routine[day];
    if (!Array.isArray(classes)) return;
    classes.forEach((cls) => {
      if (!cls || !cls.course) return;
      const courseKey = cls.part ? `${cls.course}-${cls.part}` : cls.course;
      const entry = courses.get(courseKey) || {
        courseKey,
        classDays: [],
        biWeekly: Boolean(cls.biWeekly),
      };
      entry.classDays.push(day);
      courses.set(courseKey, entry);
    });
  });

  if (courses.size === 0) return null;

  const semStart = semesterStart ? new Date(`${semesterStart}T00:00:00`) : getSemesterStartDate();
  if (Number.isNaN(semStart.getTime())) return null;

  let held = 0;
  let attended = 0;
  let absent = 0;

  courses.forEach((entry) => {
    const sessions = getCalculatedAttendanceDates(semStart, entry.classDays, {
      biWeekly: entry.biWeekly,
    });
    sessions.forEach((session) => {
      if (session.date > today) return; // future classes do not count yet
      held += 1;
      const mark = sessionMarks[`${entry.courseKey}::${session.id}`];
      if (mark === 'present') attended += 1;
      else if (mark === 'absent') absent += 1;
    });
  });

  // No marks at all means "not tracked yet" — not 0%. The tracker behaves the
  // same way and leaves the stored value alone.
  if (held === 0 || attended + absent === 0) return null;
  return Math.round((attended / held) * 1000) / 10;
}
