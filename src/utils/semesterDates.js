/**
 * Day name → JS getDay() index map
 */
const DAY_INDEX = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

/**
 * Formats a Date as YYYY-MM-DD for use in session IDs.
 */
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Generates all valid class session dates for a course, handling
 * partial first weeks (mid-week semester starts) with Sunday-based weeks.
 *
 * Academic structure:
 *   Week  1 (partial)  — semesterStartDate → first Saturday
 *   Weeks 2–7          — regular classes (Sunday-based full weeks)
 *   Week 8             — Mid-Semester Break (no classes)
 *   Week 9             — Mid-Term Exams     (no classes)
 *   Weeks 8–14         — regular classes (Sunday-based full weeks, counted as 8–14)
 *   Week  P            — PL / overflow guard (no classes)
 *
 * @param {string|Date} startDate    - Semester start date.
 * @param {string[]}    scheduledDays - Active class days, e.g. ['Sunday','Tuesday'].
 *                                      Names must match JS getDay(): Sunday…Saturday.
 * @param {Object}      [options]
 * @param {boolean}     [options.biWeekly=false]  - Course meets every other week.
 * @returns {{ id: string, date: Date, dayName: string, weekNum: number, label: string }[]}
 */
export function getCalculatedAttendanceDates(startDate, scheduledDays, { biWeekly = false } = {}) {
  const semStart = new Date(startDate);
  semStart.setHours(0, 0, 0, 0);

  const startDow = semStart.getDay(); // 0=Sun … 6=Sat

  // Week numbering matches Semester View (WeekSchedule): weeks END on Friday.
  // Week 1 = the calendar week containing semesterStart (partial if the
  // semester starts mid-week). Week 2 opens the following Saturday.
  const week1Friday = new Date(semStart);
  week1Friday.setDate(semStart.getDate() + ((5 - startDow + 7) % 7));
  const week2Start = new Date(week1Friday);
  week2Start.setDate(week1Friday.getDate() + 1);

  // End boundary: Saturday after Week 14 ends (15 full weeks after Week 1).
  const semEnd = new Date(week2Start);
  semEnd.setDate(week2Start.getDate() + 15 * 7); // exclusive end

  // Calendar-week offset from week2Start → academic week mapping:
  //   date ≤ week1Friday   → Week 1 (partial)
  //   offset 0–5           → Week 2–7
  //   offset 6–7           → Mid Break / Mid Exam (skip)
  //   offset 8–14          → Week 8–14
  //   offset ≥ 15          → past semester end

  const sessions = [];

  scheduledDays.forEach(dayName => {
    const targetDay = DAY_INDEX[dayName];
    if (targetDay === undefined) return;

    // First occurrence of this weekday on or after semStart
    const daysUntilFirst = (targetDay - startDow + 7) % 7;
    const firstDate = new Date(semStart);
    firstDate.setDate(semStart.getDate() + daysUntilFirst);

    let classWeekCounter = 0;

    for (let offset = 0; ; offset++) {
      const date = new Date(firstDate);
      date.setDate(firstDate.getDate() + offset * 7);

      // Past semester end → stop for this class day
      if (date >= semEnd) break;

      // Safety: before sem start (should not happen but guard)
      if (date < semStart) continue;

      // Determine week number
      let weekNum;
      let label;

      if (date.getTime() <= week1Friday.getTime()) {
        // Partial Week 1
        weekNum = 1;
        label = 'Week 1';
      } else {
        const calOffset = Math.floor((date.getTime() - week2Start.getTime()) / (7 * 24 * 60 * 60 * 1000));

        // Skip mid-term gap: Semester View raw weeks 8-9
        // (= calOffset 6-7) are Mid Break and Mid-Term exams.
        if (calOffset === 6 || calOffset === 7) continue;
        if (calOffset >= 15) {
          // Beyond Week 14 → stop this class day.
          break;
        }

        if (calOffset <= 5) {
          // Weeks 2–7
          weekNum = calOffset + 2;
        } else {
          // Weeks 8–14: Semester View raw 10–16, offset = raw − 2
          // equals the academic week number here.
          weekNum = calOffset;
        }
        label = `Week ${weekNum}`;
      }

      // biWeekly: only include even class week occurrences (0, 2, 4, …)
      if (biWeekly && classWeekCounter % 2 !== 0) {
        classWeekCounter++;
        continue;
      }

      sessions.push({
        id: `${dayName}-w${weekNum}-${fmtDate(date)}`,
        date,
        dayName,
        weekNum,
        label,
      });

      classWeekCounter++;

      // Max 20 occurrences per class day safety limit
      if (offset > 20) break;
    }
  });

  // Sort chronologically
  sessions.sort((a, b) => a.date - b.date);
  return sessions;
}

/**
 * Kept for backward compatibility — delegates to getCalculatedAttendanceDates.
 * @deprecated Use getCalculatedAttendanceDates instead.
 */
export function generateSemesterDates(startDate, classDays, options) {
  return getCalculatedAttendanceDates(startDate, classDays, options);
}

/**
 * Returns the semester start date stored in localStorage ('aust-semester-start').
 * Falls back to today if not set.
 * @returns {Date}
 */
export function getSemesterStartDate() {
  const stored = localStorage.getItem('aust-semester-start');
  return stored ? new Date(stored + 'T00:00:00') : new Date();
}
