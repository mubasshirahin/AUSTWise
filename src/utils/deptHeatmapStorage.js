import { getUserStorageItem } from './authStorage';
import { liveLoad, liveSave } from './liveStorage';
import { getLiveValue } from './liveStore';

const submissionsKey = 'aust-helper-dept-heatmap-submissions-v1';
const contributorKey = 'aust-helper-dept-heatmap-contributor-id';
const userStorageKey = 'aust-user-profile';

export const MIN_BATCH_CONTRIBUTORS = 10;
export const MIN_CELL_CONTRIBUTORS = 10;
export const HEATMAP_SEMESTER_COUNT = 8;

const departments = ['CSE', 'EEE', 'CE', 'ME', 'IPE', 'TE', 'ARCH', 'BBA'];

export const heatmapDepartments = departments;

const roundTwo = (value) => Number(value.toFixed(2));

function loadUserProfile() {
  try {
    const savedUser = localStorage.getItem(userStorageKey);
    return savedUser ? JSON.parse(savedUser) : null;
  } catch {
    return null;
  }
}

export function getContributorId() {
  try {
    const existing = localStorage.getItem(contributorKey);
    if (existing) return existing;
    const nextId = crypto.randomUUID();
    localStorage.setItem(contributorKey, nextId);
    return nextId;
  } catch {
    return `local-${Date.now()}`;
  }
}

export function loadSubmissions() {
  return liveLoad('shared', submissionsKey, []);
}

function saveSubmissions(submissions) {
  liveSave('shared', submissionsKey, submissions);
}

/** Completed semester CGPA values from CGPA Calculator storage. */
export function getSemesterCgpasFromTracker() {
  try {
    const live = getLiveValue('user', 'aust-user-semester-results', null);
    const results = (live && live.length ? live : null) || getUserStorageItem('semesterResults');
    if (!results) return {};
    const semesterCgpas = {};

    for (const sem of results) {
      if (sem.cgpa !== null && sem.cgpa !== undefined) {
        semesterCgpas[String(sem.semester)] = roundTwo(Number(sem.cgpa));
      }
    }

    return semesterCgpas;
  } catch {
    return {};
  }
}

function upsertSubmission({ department, batchNo, semesters }) {
  const contributorId = getContributorId();
  const normalizedBatchNo = String(batchNo || '').trim();
  const normalizedDepartment = String(department || '').trim();

  const cleanedSemesters = Object.fromEntries(
    Object.entries(semesters || {})
      .map(([semester, gpa]) => [semester, roundTwo(Number(gpa))])
      .filter(([, gpa]) => Number.isFinite(gpa) && gpa >= 0 && gpa <= 4),
  );

  if (!normalizedDepartment || !normalizedBatchNo || Object.keys(cleanedSemesters).length === 0) {
    return null;
  }

  const nextSubmission = {
    contributorId,
    department: normalizedDepartment,
    batchNo: normalizedBatchNo,
    semesters: cleanedSemesters,
    updatedAt: new Date().toISOString(),
  };

  const submissions = loadSubmissions().filter(
    (entry) => !(entry.contributorId === contributorId && entry.department === normalizedDepartment),
  );

  submissions.push(nextSubmission);
  saveSubmissions(submissions);

  return nextSubmission;
}

function removeCurrentContribution(department) {
  const contributorId = getContributorId();
  const submissions = loadSubmissions().filter(
    (entry) => !(entry.contributorId === contributorId && entry.department === department),
  );
  saveSubmissions(submissions);
}

/** Push this device's CGPA Calculator data into the anonymous heatmap pool. */
export function syncHeatmapFromTracker() {
  const user = loadUserProfile();
  const department = user?.department;
  if (!department) return null;

  const batchNo = getBatchNoFromUser(user);
  const semesters = getSemesterCgpasFromTracker();

  if (!batchNo || Object.keys(semesters).length === 0) {
    removeCurrentContribution(department);
    return null;
  }

  return upsertSubmission({ department, batchNo, semesters });
}

function average(values) {
  if (!values.length) return null;
  return roundTwo(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function buildHeatmapView(department, submissionsSource = null) {
  syncHeatmapFromTracker();

  const submissions = (submissionsSource || loadSubmissions()).filter((entry) => entry.department === department);
  const batchMap = new Map();

  for (const submission of submissions) {
    const batchNo = String(submission.batchNo);
    if (!batchMap.has(batchNo)) {
      batchMap.set(batchNo, {
        batchNo,
        contributors: new Set(),
        semesterValues: Array.from({ length: HEATMAP_SEMESTER_COUNT }, () => []),
      });
    }

    const batchEntry = batchMap.get(batchNo);
    batchEntry.contributors.add(submission.contributorId);

    for (const [semester, gpa] of Object.entries(submission.semesters || {})) {
      const semIndex = Number(semester) - 1;
      if (semIndex < 0 || semIndex >= HEATMAP_SEMESTER_COUNT) continue;
      if (!Number.isFinite(gpa)) continue;
      batchEntry.semesterValues[semIndex].push(gpa);
    }
  }

  const visibleBatches = [];
  const pendingBatches = [];

  for (const batchEntry of batchMap.values()) {
    const contributorCount = batchEntry.contributors.size;
    const cells = batchEntry.semesterValues.map((values) => (
      values.length >= MIN_CELL_CONTRIBUTORS ? average(values) : null
    ));

    const summary = {
      batchNo: batchEntry.batchNo,
      label: `${batchEntry.batchNo}`,
      contributorCount,
      cells,
    };

    if (contributorCount >= MIN_BATCH_CONTRIBUTORS) {
      visibleBatches.push(summary);
    } else {
      pendingBatches.push(summary);
    }
  }

  const sortByBatchNo = (left, right) => Number(right.batchNo) - Number(left.batchNo);

  return {
    visibleBatches: visibleBatches.sort(sortByBatchNo),
    pendingBatches: pendingBatches.sort(sortByBatchNo),
    totalSubmissions: submissions.length,
  };
}

export function getBatchNoFromUser(user) {
  if (user?.batchNo) return String(user.batchNo);
  const batchDigits = String(user?.batch || '').match(/\d+/)?.[0];
  return batchDigits || '';
}
