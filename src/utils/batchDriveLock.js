// Batch Drive lock — client mirror of the server rules.
// Keep in sync with server/dev.mjs: locked viewers are semester 1–4
// (1.1–2.2) students and all CR/SR; semester 5+ (3.1+) students can
// share codes with juniors of their own department only. The server is the
// source of truth — see src/hooks/useBatchDriveLock.js.

import { getDisplayRoles } from './authStorage';
import { formatSemesterLabel } from './semester';

/** Semester number 1–10 from `semester` or `yearSemester`. Null when unknown. */
export function parseLockSemesterNum(user) {
  const rawSem = String(user?.semester ?? '').trim();
  const semAsYearTerm = /^(\d+)\.(\d)(?:\..*)?$/.exec(rawSem);
  if (semAsYearTerm) return (Number(semAsYearTerm[1]) - 1) * 2 + Number(semAsYearTerm[2]);
  const num = Number(user?.semester);
  if (Number.isFinite(num) && num >= 1) return Math.trunc(num);
  const ys = String(user?.yearSemester || user?.currentSemester || '').trim();
  const full = /Year\s*(\d+)\s*[-–]\s*Semester\s*(\d+)/i.exec(ys);
  if (full) return (Number(full[1]) - 1) * 2 + Number(full[2]);
  const short = /^(\d+)\.(\d)(?:\..*)?$/.exec(ys);
  if (short) return (Number(short[1]) - 1) * 2 + Number(short[2]);
  const plain = /^Semester\s*(\d{1,2})$/i.exec(ys);
  if (plain) return Number(plain[1]);
  const bare = /^(\d{1,2})$/.exec(ys);
  if (bare) return Number(bare[1]);
  return null;
}

export function isLockStudentLike(user) {
  if (!user) return false;
  const display = getDisplayRoles(user);
  return display.includes('student');
}

export function isLockCrSr(user) {
  const roles = new Set();
  const add = (value) => { const v = String(value || '').trim().toLowerCase(); if (v) roles.add(v); };
  add(user?.role);
  if (Array.isArray(user?.roles)) user.roles.forEach(add);
  return roles.has('cr') || roles.has('sr');
}

/** Client-side lock check (server rechecks on every redeem). */
export function needsBatchDriveUnlock(user) {
  if (!isLockStudentLike(user)) return false;
  if (isLockCrSr(user)) return true;
  const semesterNum = parseLockSemesterNum(user);
  if (semesterNum === null) return true;
  return semesterNum <= 4;
}

/** Semester 5+ (3.1+) students can generate share codes. */
export function canGenerateBatchDriveCode(user) {
  if (!isLockStudentLike(user)) return false;
  const semesterNum = parseLockSemesterNum(user);
  return semesterNum !== null && semesterNum >= 5;
}

/** Same-department check (server enforces this on redeem). */
export function sameLockDepartment(a, b) {
  const left = String(a || '').trim().toUpperCase();
  const right = String(b || '').trim().toUpperCase();
  return Boolean(left && right && left === right);
}

export function lockYearSemLabel(user) {
  const semesterNum = parseLockSemesterNum(user);
  return semesterNum ? formatSemesterLabel(semesterNum) : '';
}
