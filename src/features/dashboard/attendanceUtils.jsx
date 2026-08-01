// Shared render helpers for the attendance widgets.
// Both AttendanceWidget and RoutineAttendanceTracker use these so every
// cell looks identical regardless of which view renders it.

// Small round count badge (top-right of a cell). Uses the theme accent
// color so it matches the rest of the schedule design language.
export function AttendanceBadge({ count, title }) {
  if (!count || count <= 0) return null;
  return (
    <span className="schedule-day-count" title={title}>
      {count}
    </span>
  );
}
