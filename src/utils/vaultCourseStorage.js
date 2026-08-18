import { inferCourseTypeFromCode } from '../features/vault/vaultExamTypes';
import { liveLoad, liveSave } from './liveStorage';

const storageKey = 'aust-vault-courses-v1';
const userStorageKey = 'aust-user-profile';

function loadUserProfile() {
  try {
    const savedUser = localStorage.getItem(userStorageKey);
    return savedUser ? JSON.parse(savedUser) : null;
  } catch {
    return null;
  }
}

function loadCourses() {
  return liveLoad('user', storageKey, [], ['aust-vault-courses']);
}

function saveCourses(items) {
  liveSave('user', storageKey, items);
}

export function getVaultCourses(department, yearSem) {
  return loadCourses().filter(
    (item) => item.department === department && item.yearSem === yearSem,
  );
}

export function getVaultCourse(department, yearSem, course) {
  const code = String(course || '').trim().toUpperCase();
  return loadCourses().find(
    (item) =>
      item.department === department &&
      item.yearSem === yearSem &&
      item.course.toUpperCase() === code,
  );
}

export function getCourseType(department, yearSem, course) {
  const match = getVaultCourse(department, yearSem, course);
  return inferCourseTypeFromCode(match?.course || course);
}

export function addVaultCourse(payload) {
  const department = String(payload.department || '').trim();
  const yearSem = String(payload.yearSem || '').trim();
  const course = String(payload.course || '').trim().toUpperCase();
  const name = String(payload.name || '').trim();
  const courseType = inferCourseTypeFromCode(course);

  if (!department || !yearSem) {
    throw new Error('Select a department and semester first.');
  }
  if (!course) {
    throw new Error('Enter a course code.');
  }
  if (!name) {
    throw new Error('Enter a course name.');
  }

  const existing = loadCourses();
  const duplicate = existing.find(
    (item) =>
      item.department === department &&
      item.yearSem === yearSem &&
      item.course.toUpperCase() === course,
  );
  if (duplicate) {
    throw new Error('This course is already added for this semester.');
  }

  const profile = loadUserProfile();
  const entry = {
    id: `course-${crypto.randomUUID()}`,
    department,
    yearSem,
    course,
    name,
    courseType,
    contributorId: profile?.id || 'guest',
    addedAt: new Date().toISOString(),
  };

  saveCourses([entry, ...existing]);
  return entry;
}
