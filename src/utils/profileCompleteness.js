/**
 * Single source of truth for Zero Hour / Routine profile completeness.
 * ExamTracker, Dashboard banner, and Settings % all reuse this so they never diverge.
 */

export const ZERO_HOUR_FIELDS = ['department', 'yearSemester', 'section', 'labSection'];

export function isZeroHourReady(user) {
  return Boolean(user?.department && user?.yearSemester && user?.section && user?.labSection);
}

export function missingZeroHourFields(user) {
  return ZERO_HOUR_FIELDS.filter((f) => !user?.[f]);
}

// Dashboard banner historically used batch instead of labSection — keep a
// separate helper if you need that legacy check, but prefer isZeroHourReady.
export function isDashboardProfileComplete(user) {
  return Boolean(user?.department && user?.yearSemester && user?.section && user?.batch);
}
