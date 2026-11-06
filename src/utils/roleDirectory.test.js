import { describe, expect, it } from 'vitest';
import { buildRoleDirectory, getAccountRoleEntries, matchesRoleSearch } from './roleDirectory';

const accounts = [
  {
    id: 'u1', name: 'Ayaan', email: 'a@aust.edu', role: 'student', roles: ['student'],
    department: 'CSE', batchName: 'Quanta', batchNo: '52', batch: 'Quanta 52',
    semester: 5, yearSemester: 'Year 3 - Semester 1', section: 'A', labSection: 'A2',
  },
  {
    id: 'u2', name: 'Nabila', email: 'n@aust.edu', role: 'cr', roles: ['cr'],
    department: 'cse', batchName: 'QUANTA', batchNo: '52', batch: 'QUANTA 52',
    semester: 5, yearSemester: 'year 3 - semester 1', section: 'a', labSection: 'a2',
  },
  {
    id: 'u3', name: 'Rafi', email: 'r@aust.edu', role: 'student', roles: ['student'],
    department: 'CSE', batchName: 'Quantaa', batchNo: '52', batch: 'Quantaa 52',
    semester: 5, yearSemester: 'Year 3 - Semester 1', section: 'A', labSection: 'A2',
  },
  {
    id: 'u4', name: 'Prof', email: 'p@aust.edu', role: 'faculty', roles: ['faculty', 'faculty_cse'],
    department: 'CSE', batchName: '', batchNo: '', batch: '',
    semester: 1, yearSemester: 'Year 1 - Semester 1', section: '', labSection: '',
  },
];

const findRow = (rows, key) => rows.find((r) => r.key === key);

describe('roleDirectory', () => {
  it('groups batch roles case-insensitively (QUANTA 52 == Quanta 52)', () => {
    const { rows } = buildRoleDirectory(accounts);
    const quanta = findRow(rows, 'batch:quanta 52');
    expect(quanta?.label).toBe('Quanta 52');
    expect(quanta?.count).toBe(2);
  });

  it('keeps differently spelled batch names as separate roles', () => {
    const { rows } = buildRoleDirectory(accounts);
    expect(findRow(rows, 'batch:quantaa 52')?.count).toBe(1);
    expect(rows.filter((r) => r.kind === 'Batch').map((r) => r.label).sort()).toEqual(['Quanta 52', 'Quantaa 52']);
  });

  it('search is case-insensitive', () => {
    const { rows } = buildRoleDirectory(accounts);
    expect(rows.filter((r) => matchesRoleSearch(r, 'quanta 52')).map((r) => r.label)).toEqual(['Quanta 52']);
    expect(rows.filter((r) => matchesRoleSearch(r, 'QUANTA')).map((r) => r.label).sort()).toEqual(['Quanta 52', 'Quantaa 52']);
    expect(rows.filter((r) => matchesRoleSearch(r, 'Quantaa')).map((r) => r.label)).toEqual(['Quantaa 52']);
  });

  it('includes system, department, semester, section and lab roles', () => {
    const { rows } = buildRoleDirectory(accounts);
    const kinds = new Set(rows.map((r) => r.kind));
    expect(kinds.has('System')).toBe(true);
    expect(kinds.has('Batch')).toBe(true);
    expect(kinds.has('Department')).toBe(true);
    expect(kinds.has('Semester')).toBe(true);
    expect(kinds.has('Section')).toBe(true);
    expect(kinds.has('Lab')).toBe(true);
    expect(findRow(rows, 'dept:cse')?.count).toBe(4);
    const u2Keys = new Set(getAccountRoleEntries(accounts[1]).map((e) => e.key));
    expect(u2Keys.has('system:student')).toBe(true);
    expect(u2Keys.has('system:cr')).toBe(true);
    const profKeys = new Set(getAccountRoleEntries(accounts[3]).map((e) => e.key));
    expect(profKeys.has('semester:1')).toBe(false);
    expect(profKeys.has('system:faculty')).toBe(true);
  });
});
