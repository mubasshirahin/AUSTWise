// normalizeAccentColor collapses any input to the single primary accent so
// course/accent borders stay monochrome on-brand instead of a rotating palette.
export function normalizeAccentColor() {
  return 'var(--accent-amber)';
}

// All courses share the one primary accent — no per-course color rotation.
const tableColors = [
  'var(--accent-amber)', 'var(--accent-amber)', 'var(--accent-amber)', 'var(--accent-amber)',
  'var(--accent-amber)', 'var(--accent-amber)', 'var(--accent-amber)', 'var(--accent-amber)',
  'var(--accent-amber)', 'var(--accent-amber)', 'var(--accent-amber)', 'var(--accent-amber)',
  'var(--accent-amber)', 'var(--accent-amber)', 'var(--accent-amber)', 'var(--accent-amber)',
];

function hashStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function getCourseColor(courseCode) {
  if (!courseCode) return tableColors[0];
  const idx = hashStr(courseCode) % tableColors.length;
  return tableColors[idx];
}
