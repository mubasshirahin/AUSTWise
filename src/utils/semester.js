/** Semester number (1–10, ARCH has 10) → year-term label, e.g. 1 → "1.1", 9 → "5.1". */
export function formatSemesterLabel(semester) {
  const sem = Number(semester);
  if (!Number.isFinite(sem) || sem < 1) return '';
  const year = Math.ceil(sem / 2);
  const term = sem % 2 === 0 ? 2 : 1;
  return `${year}.${term}`;
}

/** Total semester count by department (ARCH has 10, others 8). */
export function getSemesterCountForDepartment(department) {
  return department === 'ARCH' ? 10 : 8;
}

/** Year-sem labels for a department, e.g. ["1.1", "1.2", ...]. */
export function getYearSemOptions(department) {
  const count = getSemesterCountForDepartment(department);
  return Array.from({ length: count }, (_, index) => formatSemesterLabel(index + 1));
}
