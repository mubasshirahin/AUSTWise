// Role directory for the admin panel — every role present in the whole
// website, with member counts, grouped case-insensitively.
//
// A "role" here has two kinds:
//   - System roles (Student / Faculty / CR / ... via getDisplayRoles)
//   - Academic metadata roles derived from the profile fields
//     (Batch `Quanta 52`, Department `CSE`, Semester `Semester 5`,
//     Year Semester `Year 3 - Semester 1`, Section `Section A`, Lab `Lab A1`)
// plus any unknown stored role strings (kind `Other`).
//
// Grouping is case-insensitive: `QUANTA 52`, `quanta 52` and `Quanta 52`
// are ONE role (`batch:quanta 52`). Spelling differences stay distinct:
// `Quantaa 52` is a different role (`batch:quantaa 52`).

import { AUTH_ROLES, getDisplayRoles, getRoleDisplayName } from './authStorage';
import { getDisplayBatchText } from './batchIdentity';

export const ROLE_KIND_ORDER = [
  'System',
  'Batch',
  'Department',
  'Semester',
  'Year Semester',
  'Section',
  'Lab',
  'Other',
];

const KNOWN_DEPARTMENTS = new Set(['CSE', 'EEE', 'CE', 'ME', 'IPE', 'TE', 'ARCH', 'BBA']);

function collapseSpaces(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function normalizeRoleSearchText(value) {
  return collapseSpaces(value).toLowerCase();
}

function titleCaseWords(value) {
  return collapseSpaces(value).replace(/[A-Za-z]+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function canonicalBatchLabel(batchText) {
  return titleCaseWords(batchText);
}

function canonicalYearSemester(value) {
  return titleCaseWords(value);
}

function canonicalDepartment(value) {
  const trimmed = collapseSpaces(value);
  if (!trimmed) return '';
  const upper = trimmed.toUpperCase();
  if (!trimmed.includes(' ') && KNOWN_DEPARTMENTS.has(upper)) return upper;
  if (!trimmed.includes(' ') && trimmed.length <= 4 && /^[A-Za-z]+$/.test(trimmed)) return upper;
  return titleCaseWords(trimmed);
}

function batchLabelFromStoredRole(storedRole) {
  // Stored metadata roles look like `batch.Quanta 52` / `batch.52`.
  if (!storedRole.startsWith('batch.')) return '';
  const raw = collapseSpaces(storedRole.slice('batch.'.length));
  if (!raw) return '';
  if (/^\d+$/.test(raw)) return `Batch ${raw}`;
  return canonicalBatchLabel(raw);
}

function codeFromStoredRole(storedRole, prefix, format) {
  if (!storedRole.startsWith(prefix)) return '';
  const raw = collapseSpaces(storedRole.slice(prefix.length));
  if (!raw) return '';
  return format(raw.toUpperCase());
}

/**
 * All role entries for one account: [{ key, label, kind }].
 * Keys are namespaced (`system:cr`, `batch:quanta 52`, `dept:cse`,
 * `semester:5`, `yearsemester:...`, `sec:a`, `lab:a1`, `other:...`)
 * and lowercased so selection state survives casing differences.
 */
export function getAccountRoleEntries(account) {
  if (!account) return [];
  const entries = [];
  const seen = new Set();
  const add = (key, label, kind) => {
    if (!key || !label || seen.has(key)) return;
    seen.add(key);
    entries.push({ key, label, kind });
  };

  // 1) System display roles (Student is expanded for CR/SR/...).
  const systemRoles = getDisplayRoles(account);
  systemRoles.forEach((role) => {
    add(`system:${role}`, getRoleDisplayName(role), 'System');
  });
  const isStudentLike = systemRoles.includes('student');

  // 2) Unknown / stored roles that getDisplayRoles filtered out.
  const rawRoles = [account.role, ...(Array.isArray(account.roles) ? account.roles : [])]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);

  const deptNorm = normalizeRoleSearchText(account.department || '');
  const yearSemNorm = normalizeRoleSearchText(account.yearSemester || '');
  const sectionNorm = normalizeRoleSearchText(account.section || '');
  const labNorm = normalizeRoleSearchText(account.labSection || '');

  rawRoles.forEach((raw) => {
    const lower = raw.toLowerCase();
    if (AUTH_ROLES.includes(lower)) return; // covered by system roles above
    if (lower.startsWith('batch.')) {
      const batchLabel = batchLabelFromStoredRole(lower);
      if (batchLabel) add(`batch:${normalizeRoleSearchText(batchLabel)}`, batchLabel, 'Batch');
      return;
    }
    if (lower.startsWith('lab.')) {
      const label = codeFromStoredRole(lower, 'lab.', (code) => `Lab ${code}`);
      if (label) add(`lab:${normalizeRoleSearchText(label.replace(/^Lab\s+/i, ''))}`, label, 'Lab');
      return;
    }
    if (lower.startsWith('sec.')) {
      const label = codeFromStoredRole(lower, 'sec.', (code) => `Section ${code}`);
      if (label) add(`sec:${normalizeRoleSearchText(label.replace(/^Section\s+/i, ''))}`, label, 'Section');
      return;
    }
    const norm = normalizeRoleSearchText(raw);
    if (!norm) return;
    if (deptNorm && norm === deptNorm) return; // department entry below covers it
    if (yearSemNorm && norm === yearSemNorm) return;
    if (sectionNorm && norm === sectionNorm) return;
    if (labNorm && norm === labNorm) return;
    if (account.batchNo && norm === normalizeRoleSearchText(account.batchNo)) return;
    add(`other:${norm}`, getRoleDisplayName(lower), 'Other');
  });

  // 3) Batch role — canonical full label, case-insensitive grouping.
  // `QUANTA 52` and `Quanta 52` collapse to one `batch:quanta 52` entry.
  const batchText = getDisplayBatchText(account);
  if (batchText) {
    const label = canonicalBatchLabel(batchText);
    add(`batch:${normalizeRoleSearchText(label)}`, label, 'Batch');
  }

  // 4) Department role.
  if (account.department && String(account.department).trim()) {
    const label = canonicalDepartment(account.department);
    add(`dept:${normalizeRoleSearchText(label)}`, label, 'Department');
  }

  // 5) Semester / Year Semester / Section / Lab — students only, matching
  // the member-list grouping (faculty/alumni/admin have no live semester).
  if (isStudentLike) {
    const semesterNum = account.semester === null || account.semester === undefined
      ? ''
      : String(account.semester).trim();
    if (semesterNum) add(`semester:${semesterNum}`, `Semester ${semesterNum}`, 'Semester');
    if (account.yearSemester && String(account.yearSemester).trim()) {
      const label = canonicalYearSemester(account.yearSemester);
      add(`yearsemester:${normalizeRoleSearchText(label)}`, label, 'Year Semester');
    }
    if (account.section && String(account.section).trim()) {
      const code = collapseSpaces(account.section).toUpperCase();
      add(`sec:${normalizeRoleSearchText(code)}`, `Section ${code}`, 'Section');
    }
    if (account.labSection && String(account.labSection).trim()) {
      const code = collapseSpaces(account.labSection).toUpperCase();
      add(`lab:${normalizeRoleSearchText(code)}`, `Lab ${code}`, 'Lab');
    }
  }

  return entries;
}

/**
 * Build the full role directory from an accounts list.
 * @returns {{ rows: Array<{key,label,kind,count}>, totalMembers: number }}
 */
export function buildRoleDirectory(accounts) {
  const list = Array.isArray(accounts) ? accounts : [];
  const byKey = new Map();
  list.forEach((account) => {
    getAccountRoleEntries(account).forEach((entry) => {
      const existing = byKey.get(entry.key);
      if (existing) {
        existing.count += 1;
      } else {
        byKey.set(entry.key, { key: entry.key, label: entry.label, kind: entry.kind, count: 1 });
      }
    });
  });
  const kindIndex = (kind) => {
    const i = ROLE_KIND_ORDER.indexOf(kind);
    return i === -1 ? ROLE_KIND_ORDER.length : i;
  };
  const rows = [...byKey.values()].sort((a, b) => {
    const ka = kindIndex(a.kind);
    const kb = kindIndex(b.kind);
    if (ka !== kb) return ka - kb;
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
  });
  return { rows, totalMembers: list.length };
}

/** Case-insensitive substring match for the role search box. */
export function matchesRoleSearch(row, query) {
  const q = normalizeRoleSearchText(query);
  if (!q) return true;
  return normalizeRoleSearchText(row.label).includes(q)
    || normalizeRoleSearchText(row.key).includes(q)
    || normalizeRoleSearchText(row.kind).includes(q);
}

/** True when an account has EVERY selected role key (AND combination). */
export function accountMatchesSelectedRoles(account, selectedKeys, entriesByAccountId) {
  if (!Array.isArray(selectedKeys) || selectedKeys.length === 0) return true;
  const entrySet = entriesByAccountId?.get(account?.id);
  if (!entrySet) return false;
  return selectedKeys.every((key) => entrySet.has(key));
}
