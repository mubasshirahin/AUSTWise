/** Academic transition rules for AUSTWise. Storage stays in the existing AuthUsers
 * records; semester marks are held in a small persistent JSON ledger until they
 * are imported from the university's source of truth. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readUsers, updateUserProfile } from './userStore.mjs';
import { sendAlumniTransferEmail } from './inviteEmail.mjs';

const DATA_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'academicResults.json');
async function readResults() {
  try { return JSON.parse(await readFile(DATA_FILE, 'utf8')); } catch { return []; }
}
async function writeResults(results) { await writeFile(DATA_FILE, JSON.stringify(results, null, 2)); }

export function evaluateStudent(result) {
  if (!result || result.status === 'PENDING' || result.resultsSubmitted === false) return 'RESULT_PENDING';
  if (Number(result.theoryFailsCount ?? result.theory_fails_count ?? 0) >= 3 || Number(result.labFailsCount ?? result.lab_fails_count ?? 0) >= 1) return 'DROPPED';
  return 'PASSED';
}

export function nextSemester(value) {
  const match = String(value || '').match(/^(\d+)\.(\d+)$/);
  if (!match) return '';
  const year = Number(match[1]); const term = Number(match[2]);
  if (term === 1) return `${year}.2`;
  if (term === 2) return `${year + 1}.1`;
  return '';
}

async function getAcademicUsers() {
  const users = await readUsers();
  return users.filter(user => (user.roles || [user.role]).includes('student') && user.status !== 'GRADUATED');
}

export async function previewSemesterMove(semester) {
  const [users, results] = await Promise.all([getAcademicUsers(), readResults()]);
  const candidates = users.filter(user => (user.currentSemester || user.yearSemester?.match(/Year\s*(\d+)\s*-\s*Semester\s*(\d+)/i)?.slice(1).join('.') || '') === semester);
  const evaluated = candidates.map(student => {
    const result = results.find(entry => [student.id, student.studentId, student.awid].includes(entry.studentId) && entry.semester === semester);
    return { id: student.id, name: student.name, studentId: student.studentId || student.awid, department: student.department, currentSemester: semester, outcome: evaluateStudent(result), personalEmail: student.personalEmail || '' };
  });
  return { semester, eligible: evaluated.filter(s => s.outcome === 'PASSED').length, dropped: evaluated.filter(s => s.outcome === 'DROPPED').length, pending: evaluated.filter(s => s.outcome === 'RESULT_PENDING').length, students: evaluated };
}

export async function saveAcademicResult(result) {
  const results = await readResults();
  const entry = { studentId: String(result.studentId || ''), semester: String(result.semester || ''), theoryFailsCount: Number(result.theoryFailsCount ?? result.theory_fails_count ?? 0), labFailsCount: Number(result.labFailsCount ?? result.lab_fails_count ?? 0), status: String(result.status || 'PENDING').toUpperCase(), resultsSubmitted: result.resultsSubmitted !== false, updatedAt: new Date().toISOString() };
  if (!entry.studentId || !/^\d+\.\d+$/.test(entry.semester)) throw new Error('Student and valid semester are required.');
  const index = results.findIndex(row => row.studentId === entry.studentId && row.semester === entry.semester);
  if (index < 0) results.push(entry); else results[index] = entry;
  await writeResults(results);
  return entry;
}

export async function moveToNextSemester(semester, { holdPending = true } = {}) {
  const preview = await previewSemesterMove(semester);
  const users = await readUsers(); const outcomes = [];
  for (const candidate of preview.students) {
    const user = users.find(row => row.id === candidate.id);
    if (!user) continue;
    if (candidate.outcome === 'RESULT_PENDING') {
      if (holdPending) await updateUserProfile(user.id, { status: 'ON_HOLD' });
      outcomes.push({ id: user.id, outcome: candidate.outcome }); continue;
    }
    if (candidate.outcome === 'DROPPED') {
      await updateUserProfile(user.id, { status: 'DROPPED', academicStatus: 'REPEAT', currentAcademicBatch: user.currentAcademicBatch || user.batchNo || user.batch || '' });
      outcomes.push({ id: user.id, outcome: candidate.outcome }); continue;
    }
    const max = String(user.maxSemester || (user.department === 'ARCH' ? '5.2' : '4.2'));
    if (semester === max) {
      if (!user.personalEmail) { outcomes.push({ id: user.id, outcome: 'GRADUATION_BLOCKED_NO_PERSONAL_EMAIL' }); continue; }
      if (users.some(other => other.id !== user.id && String(other.email || '').toLowerCase() === String(user.personalEmail).toLowerCase())) {
        outcomes.push({ id: user.id, outcome: 'GRADUATION_BLOCKED_EMAIL_IN_USE' }); continue;
      }
      const roles = [...new Set([...(user.roles || [user.role]).filter(role => role !== 'student'), 'alumni'])];
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await updateUserProfile(user.id, { roles, role: roles.includes('faculty') ? 'faculty' : 'alumni', email: user.personalEmail, status: 'GRADUATED', resetTokenHash: tokenHash, resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() }, { allowRole: true });
      let emailSent = false;
      try {
        const base = String(process.env.PUBLIC_BASE_URL || 'http://localhost:5174').replace(/\/$/, '');
        await sendAlumniTransferEmail({ to: user.personalEmail, name: user.name, resetLink: `${base}/reset-password?token=${token}` });
        emailSent = true;
      } catch (error) { console.warn('[Academic] Alumni transfer email could not be sent:', error.message); }
      outcomes.push({ id: user.id, outcome: 'GRADUATED', email: user.personalEmail, emailSent });
      continue;
    }
    const next = nextSemester(semester);
    if (next) await updateUserProfile(user.id, { currentSemester: next, status: 'ACTIVE', yearSemester: `Year ${next.split('.')[0]} - Semester ${next.split('.')[1]}`, semester: (Number(next.split('.')[0]) - 1) * 2 + Number(next.split('.')[1]) });
    outcomes.push({ id: user.id, outcome: 'PROMOTED', nextSemester: next });
  }
  return { ...preview, outcomes, graduated: outcomes.filter(row => row.outcome === 'GRADUATED').length, blockedGraduation: outcomes.filter(row => row.outcome === 'GRADUATION_BLOCKED_NO_PERSONAL_EMAIL').length };
}

/** One-click admin operation: advance every current student by one term. */
export async function advanceAllStudents() {
  const allUsers = await readUsers();
  const users = allUsers.filter(user => (user.roles || [user.role]).includes('student') && user.status !== 'GRADUATED');
  const outcomes = [];
  for (const user of users) {
    const semester = user.currentSemester || user.yearSemester?.match(/Year\s*(\d+)\s*-\s*Semester\s*(\d+)/i)?.slice(1).join('.') || '';
    const max = String(user.maxSemester || (user.department === 'ARCH' ? '5.2' : '4.2'));
    if (!semester) { outcomes.push({ id: user.id, outcome: 'SKIPPED_INVALID_SEMESTER' }); continue; }
    if (semester === max) {
      if (!user.personalEmail) { outcomes.push({ id: user.id, outcome: 'GRADUATION_BLOCKED_NO_PERSONAL_EMAIL' }); continue; }
      if (allUsers.some(other => other.id !== user.id && String(other.email || '').toLowerCase() === String(user.personalEmail).toLowerCase())) {
        outcomes.push({ id: user.id, outcome: 'GRADUATION_BLOCKED_EMAIL_IN_USE' }); continue;
      }
      const roles = [...new Set([...(user.roles || [user.role]).filter(role => role !== 'student'), 'alumni'])];
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await updateUserProfile(user.id, { roles, role: roles.includes('faculty') ? 'faculty' : 'alumni', email: user.personalEmail, status: 'GRADUATED', resetTokenHash: tokenHash, resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() }, { allowRole: true });
      let emailSent = false;
      try {
        const base = String(process.env.PUBLIC_BASE_URL || 'http://localhost:5174').replace(/\/$/, '');
        await sendAlumniTransferEmail({ to: user.personalEmail, name: user.name, resetLink: `${base}/reset-password?token=${token}` });
        emailSent = true;
      } catch (error) { console.warn('[Academic] Alumni transfer email could not be sent:', error.message); }
      outcomes.push({ id: user.id, outcome: 'GRADUATED', email: user.personalEmail, emailSent });
      continue;
    }
    const next = nextSemester(semester);
    if (!next) { outcomes.push({ id: user.id, outcome: 'SKIPPED_INVALID_SEMESTER' }); continue; }
    await updateUserProfile(user.id, { currentSemester: next, status: 'ACTIVE', academicStatus: 'ACTIVE', yearSemester: `Year ${next.split('.')[0]} - Semester ${next.split('.')[1]}`, semester: (Number(next.split('.')[0]) - 1) * 2 + Number(next.split('.')[1]) });
    outcomes.push({ id: user.id, outcome: 'PROMOTED', nextSemester: next });
  }
  return {
    advanced: outcomes.filter(row => row.outcome === 'PROMOTED').length,
    graduated: outcomes.filter(row => row.outcome === 'GRADUATED').length,
    blocked: outcomes.filter(row => row.outcome.startsWith('GRADUATION_BLOCKED')).length,
    skipped: outcomes.filter(row => row.outcome.startsWith('SKIPPED')).length,
    outcomes,
  };
}
