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

  // The first Sunday on or after semesterStart — this is the anchor for Week 2+
  const daysToFirstSun = (7 - startDow) % 7;
  const firstSunday = new Date(semStart);
  firstSunday.setDate(semStart.getDate() + daysToFirstSun);

  // End boundary: Sunday after Week 14 ends (allows full calOffset 14 week, Sep 27-Oct 3)
  const semEnd = new Date(firstSunday);
  semEnd.setDate(firstSunday.getDate() + 15 * 7); // exclusive end (the following Sunday)

// Week 1 spans semesterStart through the Saturday before firstSunday.
// A Sunday start makes Week 1 just that single Sunday itself.
const week1End = new Date(firstSunday);
if (startDow !== 0) week1End.setDate(week1End.getDate() - 1);

  // Calendar-week offset from firstSunday → academic week mapping:
  //   offset < 0           → Week 1 (partial, before firstSunday)
  //   offset 0–5           → Week 2–7  (offset + 2)
  //   offset 6–7           → Mid Break / Mid Exam (skip)
  //   offset 8–14          → Week 8–14 (offset)
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

      if (date < week1End || (startDow === 0 && date.getTime() === firstSunday.getTime())) {
        // Partial Week 1
        weekNum = 1;
        label = 'Week 1';
      } else {
        const calOffset = Math.floor((date.getTime() - firstSunday.getTime()) / (7 * 24 * 60 * 60 * 1000));

        // Skip mid-term gap (calOffset 6 = Mid Break, calOffset 7 = Mid Exam)
        if (calOffset === 6 || calOffset === 7) continue;

        if (calOffset <= 5) {
          // Weeks 2–7
          weekNum = calOffset + 2;
        } else if (calOffset >= 8 && calOffset <= 14) {
          // Weeks 8–14
          weekNum = calOffset;
        } else {
          // Beyond Week 14 → stop
          break;
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
