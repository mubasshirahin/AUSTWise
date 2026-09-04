import { getUserStorageItem } from './authStorage';
import { liveLoad, liveSave } from './liveStorage';
import { getLiveValue } from './liveStore';

const submissionsKey = 'aust-helper-dept-heatmap-submissions-v1';
const contributorKey = 'aust-helper-dept-heatmap-contributor-id';
const userStorageKey = 'aust-user-profile';

export const MIN_BATCH_CONTRIBUTORS = 1;
export const MIN_CELL_CONTRIBUTORS = 1;
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

function stripUpdatedAt(list) {
  return (list || []).map(({ updatedAt, ...rest }) => rest);
}
function saveSubmissions(submissions) {
  // Skip identical writes — ignore updatedAt so same data doesn't trigger loop/rate-limit
  const prev = loadSubmissions();
  if (JSON.stringify(stripUpdatedAt(prev)) === JSON.stringify(stripUpdatedAt(submissions))) return;
  liveSave('shared', submissionsKey, submissions);
}

/** Per-semester SGPA values from CGPA Calculator storage (for heatmap avg SGPA). */
export function getSemesterSgpasFromTracker() {
  try {
    const live = getLiveValue('user', 'aust-user-semester-results', null);
    const results = (live && live.length ? live : null) || getUserStorageItem('semesterResults');
    if (!results) return {};
    const semesterSgpas = {};

    for (const sem of results) {
      if (sem.sgpa !== null && sem.sgpa !== undefined) {
        semesterSgpas[String(sem.semester)] = roundTwo(Number(sem.sgpa));
      }
    }

    return semesterSgpas;
  } catch {
    return {};
  }
}
// Back-compat alias (old code used cgpa)
export const getSemesterCgpasFromTracker = getSemesterSgpasFromTracker;

function upsertSubmission({ department, batchNo, batchLabel, semesters }) {
  const user = loadUserProfile();
  const contributorId = user?.id ? `user-${user.id}` : getContributorId();
  const normalizedBatchNo = String(batchNo || '').trim();
  const normalizedDepartment = String(department || '').trim();
  const normalizedBatchLabel = String(batchLabel || '').trim() || `Quanta ${normalizedBatchNo}`;

  const cleanedSemesters = Object.fromEntries(
    Object.entries(semesters || {})
      .map(([semester, gpa]) => [semester, roundTwo(Number(gpa))])
      .filter(([, gpa]) => Number.isFinite(gpa) && gpa >= 0 && gpa <= 4),
  );

  if (!normalizedDepartment || !normalizedBatchNo || Object.keys(cleanedSemesters).length === 0) {
    return null;
  }

  const submissions = loadSubmissions();
  const existing = submissions.find(
    (e) => e.contributorId === contributorId && e.department === normalizedDepartment,
  );
  if (
    existing &&
    String(existing.batchNo) === normalizedBatchNo &&
    String(existing.batchLabel) === normalizedBatchLabel &&
    JSON.stringify(existing.semesters) === JSON.stringify(cleanedSemesters)
  ) {
    return existing; // no change — skip write to avoid 429
  }

  const nextSubmission = {
    contributorId,
    department: normalizedDepartment,
    batchNo: normalizedBatchNo,
    batchLabel: normalizedBatchLabel,
    semesters: cleanedSemesters,
    updatedAt: new Date().toISOString(),
  };

  const filtered = submissions.filter(
    (entry) => !(entry.contributorId === contributorId && entry.department === normalizedDepartment),
  );

  filtered.push(nextSubmission);
  saveSubmissions(filtered);

  return nextSubmission;
}

function removeCurrentContribution(department) {
  const user = loadUserProfile();
  const contributorId = user?.id ? `user-${user.id}` : getContributorId();
  const submissions = loadSubmissions().filter(
    (entry) => !(entry.contributorId === contributorId && entry.department === department),
  );
  saveSubmissions(submissions);
}

/** Push this device's CGPA Calculator data into the anonymous heatmap pool. */
export function syncHeatmapFromTracker(overrideSemesters = null) {
  const user = loadUserProfile();
  const department = String(user?.department || '').trim() || 'CSE';
  const rawBatchNo = getBatchNoFromUser(user);
  const batchNo = String(rawBatchNo || '').trim() || '52';
  const fullBatch = String(user?.batch || '').trim();
  const batchLabel = fullBatch || (String(user?.batchName || '').trim() ? `${String(user.batchName).trim()} ${batchNo}` : `Quanta ${batchNo}`);
  const semesters = overrideSemesters || getSemesterCgpasFromTracker();

  if (!batchNo || Object.keys(semesters).length === 0) {
    return null;
  }

  return upsertSubmission({ department, batchNo, batchLabel, semesters });
}

function average(values) {
  if (!values.length) return null;
  return roundTwo(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function buildHeatmapView(department, submissionsSource = null) {
  const raw = submissionsSource || loadSubmissions();
  const isYearBatch = (b) => /^20\d{2}$/.test(String(b).trim());
  // One-time fix: bare name "Quanta" → "Quanta 52"
  if (!submissionsSource) {
    let migrated = false;
    raw.forEach((e) => {
      const lbl = String(e.batchLabel || '').trim();
      const no = String(e.batchNo || '').trim();
      if (lbl && no && !lbl.includes(no) && !isYearBatch(no)) {
        e.batchLabel = `${lbl} ${no}`;
        migrated = true;
      }
    });
    if (migrated) saveSubmissions(raw);
  }
  // Hide dev year batches and seeded dummy (50/51/52 with 6+ sems) from view — real 1.1 stays
  const isDummyBatch = (e) => ['50', '51', '52'].includes(String(e.batchNo)) && Object.keys(e.semesters || {}).length >= 6;
  const submissions = raw.filter(
    (entry) => entry.department === department && !isYearBatch(entry.batchNo) && !isDummyBatch(entry),
  );
  const batchMap = new Map();

  for (const submission of submissions) {
    const batchNo = String(submission.batchNo);
    let batchLabel = String(submission.batchLabel || '').trim() || `Quanta ${batchNo}`;
    // Fix bare name without number (e.g. "Quanta" → "Quanta 52")
    if (batchLabel && !batchLabel.includes(batchNo)) batchLabel = `${batchLabel} ${batchNo}`;
    // Migrate old Quanta-year labels (Quanta 2028) → 2028 Batch
    if (/^Quanta 20\d{2}$/.test(batchLabel)) batchLabel = `${batchNo} Batch`;
    // Group by label — so Quanta 52 and Encrypt 52 stay separate (user asked)
    const mapKey = batchLabel;
    if (!batchMap.has(mapKey)) {
      batchMap.set(mapKey, {
        batchNo,
        batchLabel,
        contributors: new Set(),
        semesterValues: Array.from({ length: HEATMAP_SEMESTER_COUNT }, () => []),
      });
    }

    const batchEntry = batchMap.get(mapKey);
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
      label: batchEntry.batchLabel || `Quanta ${batchEntry.batchNo}`,
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
