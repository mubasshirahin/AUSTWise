import { describe, it, expect } from 'vitest';
import { getMemberPreviewStats, resolveNoticePoster, extractStudentId, mergeWithDirectory } from './memberPreview';

describe('resolveNoticePoster', () => {
  const notice = { postedBy: 'u7', postedByName: 'Rafi', postedByRole: 'cr', postedBySection: 'A', postedByLabSection: 'A1' };

  it('merges the directory member over the notice fields', () => {
    const poster = resolveNoticePoster(notice, [{ id: 'u7', name: 'Rafiul Islam', department: 'CSE' }]);
    expect(poster.department).toBe('CSE');
    expect(poster.name).toBe('Rafiul Islam');
    expect(poster.labSection).toBe('A1');
  });

  it('falls back to the notice fields when the poster is not in the directory', () => {
    const poster = resolveNoticePoster(notice, []);
    expect(poster).toMatchObject({ id: 'u7', name: 'Rafi', role: 'cr', section: 'A', labSection: 'A1' });
  });

  it('returns null for notices without a poster name (admin notices)', () => {
    expect(resolveNoticePoster({ title: 'x' }, [])).toBeNull();
  });

  it('tolerates a missing members list', () => {
    expect(resolveNoticePoster(notice, undefined).name).toBe('Rafi');
  });
});

describe('getMemberPreviewStats', () => {
  it('builds the directory rows', () => {
    const rows = getMemberPreviewStats({ department: 'CSE', semester: 3, labSection: 'A1' });
    expect(rows).toContainEqual(['Lab', 'A1']);
    expect(rows).toContainEqual(['Semester', 'Year 2.1 (Semester 3)']);
    expect(rows.map(([l]) => l)).toEqual(['Department', 'AUST ID', 'AWID', 'Semester', 'Lab', 'Batch', 'Blood']);
  });

  it('does not throw or invent a department when it is missing', () => {
    const rows = getMemberPreviewStats({ name: 'Rafi', section: 'A' });
    expect(rows.find(([l]) => l === 'Department')[1]).toBe('');
    expect(rows.find(([l]) => l === 'AWID')[1]).toBe('');
    expect(rows).toContainEqual(['Lab', 'A']);
  });
});

describe('mergeWithDirectory', () => {
  it('fills missing fields from the directory, keeping the given ones when the directory is blank', () => {
    const merged = mergeWithDirectory({ id: 'u7', name: 'Rafi', avatar: 'a.png' }, [{ id: 'u7', department: 'CSE', avatar: '' }]);
    expect(merged).toMatchObject({ id: 'u7', name: 'Rafi', department: 'CSE', avatar: 'a.png' });
  });
  it('matches by studentId and returns the input when nothing matches', () => {
    expect(mergeWithDirectory({ id: '2021', name: 'X' }, [{ id: 'u1', studentId: '2021', batch: '49' }]).batch).toBe('49');
    expect(mergeWithDirectory({ id: 'zz', name: 'X' }, [])).toEqual({ id: 'zz', name: 'X' });
  });
});

describe('extractStudentId', () => {
  it('reads the id from an aust.edu email', () => {
    expect(extractStudentId({ email: 'rafi.20210104001@aust.edu', id: 'x' })).toBe('20210104001');
  });
});
