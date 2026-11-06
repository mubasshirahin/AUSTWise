import { describe, expect, it } from 'vitest';
import {
  canGenerateBatchDriveCode,
  isLockCrSr,
  needsBatchDriveUnlock,
  parseLockSemesterNum,
} from './batchDriveLock';

describe('batchDriveLock', () => {
  it('parses semester numbers and year-sem strings', () => {
    expect(parseLockSemesterNum({ semester: 5 })).toBe(5);
    expect(parseLockSemesterNum({ yearSemester: 'Year 3 - Semester 1' })).toBe(5);
    expect(parseLockSemesterNum({ yearSemester: '3.1' })).toBe(5);
    expect(parseLockSemesterNum({ yearSemester: 'Year 2 - Semester 2' })).toBe(4);
    expect(parseLockSemesterNum({})).toBe(null);
  });

  it('locks semester 1-4 students', () => {
    expect(needsBatchDriveUnlock({ role: 'student', roles: ['student'], semester: 4 })).toBe(true);
    expect(needsBatchDriveUnlock({ role: 'student', roles: ['student'], semester: 5 })).toBe(false);
  });

  it('locks all CR/SR even when semester is 5+', () => {
    expect(needsBatchDriveUnlock({ role: 'cr', roles: ['cr'], semester: 7 })).toBe(true);
    expect(needsBatchDriveUnlock({ role: 'sr', roles: ['sr'], semester: 8 })).toBe(true);
    expect(isLockCrSr({ role: 'cr', roles: ['cr'] })).toBe(true);
  });

  it('does not lock faculty, alumni or admin', () => {
    expect(needsBatchDriveUnlock({ role: 'faculty', roles: ['faculty'], semester: 1 })).toBe(false);
    expect(needsBatchDriveUnlock({ role: 'alumni', roles: ['alumni'], semester: 1 })).toBe(false);
    expect(needsBatchDriveUnlock({ role: 'admin', roles: ['admin'], semester: 1 })).toBe(false);
  });

  it('lets semester 3.1+ generate codes (semester only, no role needed)', () => {
    expect(canGenerateBatchDriveCode({ role: 'student', roles: ['student'], semester: 5 })).toBe(true);
    expect(canGenerateBatchDriveCode({ role: 'student', roles: ['student'], semester: 7 })).toBe(true);
    expect(canGenerateBatchDriveCode({ role: 'student', roles: ['student'], semester: 4 })).toBe(false);
    expect(canGenerateBatchDriveCode({ role: 'faculty', roles: ['faculty'], semester: 7 })).toBe(false);
  });
});
