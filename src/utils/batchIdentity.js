/**
 * Pure batch-identity helpers shared by auth hydration, the profile UI and the
 * Batch Drive. A batch is "Quanta 52" (name + number), never the number alone.
 */

/** Full batch label for a user / member / account record. */
export function getBatchLabel(entity) {
  if (!entity) return '';
  const name = String(entity.batchName || '').trim();
  const no = String(entity.batchNo || '').trim();
  const raw = String(entity.batch || '').trim();

  if (name && no && name !== no) return `${name} ${no}`.replace(/\s+/g, ' ').trim();
  if (name) return name;
  // Legacy full label already stored in `batch` ("Quanta 52").
  if (/^[A-Za-z][A-Za-z\s]*\s+\d+$/.test(raw)) return raw.replace(/\s+/g, ' ').trim();
  if (no) return no;
  // Ignore dept-suffixed legacy labels such as "2026-CSE".
  return /^\d+-[A-Z]+$/.test(raw) ? '' : raw;
}

/** Identity role for a batch, e.g. `batch.Quanta 52`. */
export function getBatchRole(entity) {
  const label = getBatchLabel(entity);
  return label ? `batch.${label}` : '';
}

/**
 * Display batch text for chips / pills / info rows — the single format used
 * everywhere (navbar profile, member popover, member profile page):
 * full label when the batch name exists ("Quanta 52"), "Batch 52" when only
 * the number exists. Bare "52" is never shown on its own.
 */
export function getDisplayBatchText(entity) {
  const label = getBatchLabel(entity);
  if (!label) return '';
  if (/^\d+$/.test(label)) return `Batch ${label}`;
  return label;
}

/** Semester display text: "Semester 5" or the stored year-semester string. */
export function getSemesterText(entity) {
  if (!entity) return '';
  return entity.semester ? `Semester ${entity.semester}` : (entity.yearSemester || '');
}

/**
 * Canonical academic labels in display order —
 * Department, Batch, Semester, Section, Lab —
 * e.g. ["CSE", "Quanta 52", "Semester 5", "Section A", "Lab A2"].
 * Phone-number-style metadata is never included; empty fields are skipped.
 */
export function getAcademicLabels(entity, { hideSemester = false } = {}) {
  if (!entity) return [];
  const labels = [];
  if (entity.department) labels.push(entity.department);
  const batch = getDisplayBatchText(entity);
  if (batch) labels.push(batch);
  if (!hideSemester) {
    const semester = getSemesterText(entity);
    if (semester) labels.push(semester);
  }
  if (entity.section) labels.push(`Section ${entity.section}`);
  if (entity.labSection) labels.push(`Lab ${entity.labSection}`);
  return labels;
}
