// ─── Faculty Status & Routine Storage ──────────────────────────────────────
// Manages faculty availability, routines, and auto-detection of busy/free status.
// Faculty profiles are derived from actual registered accounts (role === 'faculty').

import { getAllAccounts } from './authStorage';

const FACULTY_EXTENDED_KEY = 'aust-faculty-extended-v1';
const FACULTY_STATUS_KEY = 'aust-faculty-status-v1';
const FACULTY_ROUTINES_KEY = 'aust-faculty-routines-v1';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Helpers ─────────────────────────────────────────────────────────────

function getStore(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStore(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage full
  }
}

// ─── Faculty Profiles (from real registered accounts) ─────────────────┐

/**
 * Get all faculty profiles — derived from real registered accounts
 * with role === 'faculty', merged with any extended info they've saved.
 */
export function getFacultyProfiles() {
  const accounts = getAllAccounts().filter(a => a.role === 'faculty');
  const extendedMap = getFacultyExtendedMap();

  return accounts.map(acc => ({
    id: acc.id,
    name: acc.name,
    designation: acc.designation || 'Faculty',
    department: acc.department || 'Undeclared',
    email: acc.email,
    // Extended info: fall back to defaults if not yet set
    room: extendedMap[acc.id]?.room || '',
    officeHours: extendedMap[acc.id]?.officeHours || '',
    phone: extendedMap[acc.id]?.phone || '',
    expertise: extendedMap[acc.id]?.expertise || [],
    avatar: acc.avatar || null,
  }));
}

/** Get a single faculty profile by ID */
export function getFacultyProfile(facultyId) {
  return getFacultyProfiles().find(f => f.id === facultyId) || null;
}

// ─── Extended Info (room, office hours, expertise — set by faculty themselves) ─

function getFacultyExtendedMap() {
  return getStore(FACULTY_EXTENDED_KEY) || {};
}

function saveFacultyExtendedMap(map) {
  setStore(FACULTY_EXTENDED_KEY, map);
}

/** Save extended info for a faculty member */
export function saveFacultyExtendedInfo(facultyId, info) {
  const map = getFacultyExtendedMap();
  map[facultyId] = {
    ...(map[facultyId] || {}),
    ...info,
  };
  saveFacultyExtendedMap(map);
}

/** Get extended info for a single faculty */
export function getFacultyExtendedInfo(facultyId) {
  const map = getFacultyExtendedMap();
  return map[facultyId] || {};
}

// ─── Faculty Status (Availability + Mode) ──────────────────────────────

/**
 * Get the runtime status for all faculty.
 * Returns a map: { facultyId: { statusMode, manualStatus } }
 */
export function getFacultyStatusMap() {
  return getStore(FACULTY_STATUS_KEY) || {};
}

function saveFacultyStatusMap(map) {
  setStore(FACULTY_STATUS_KEY, map);
}

/** Get runtime status for a single faculty */
export function getFacultyStatus(facultyId) {
  const map = getFacultyStatusMap();
  return map[facultyId] || { statusMode: 'auto' };
}

/**
 * Set a faculty's status mode and optionally manual status.
 */
export function setFacultyStatus(facultyId, opts) {
  const map = getFacultyStatusMap();
  map[facultyId] = {
    ...(map[facultyId] || {}),
    statusMode: opts.statusMode || 'auto',
    ...(opts.statusMode === 'manual' && opts.manualStatus
      ? { manualStatus: opts.manualStatus }
      : { manualStatus: undefined }),
  };
  saveFacultyStatusMap(map);
}

// ─── Faculty Routines (only from real user input) ──────────────────────

/** Get all faculty routines */
export function getFacultyRoutines() {
  return getStore(FACULTY_ROUTINES_KEY) || {};
}

/** Get a single faculty's routine */
export function getFacultyRoutine(facultyId) {
  const routines = getFacultyRoutines();
  return routines[facultyId] || null;
}

/** Save a faculty's routine (full week object) */
export function saveFacultyRoutine(facultyId, weekRoutine) {
  const routines = getFacultyRoutines();
  routines[facultyId] = weekRoutine;
  setStore(FACULTY_ROUTINES_KEY, routines);
}

// ─── Auto-Determine Current Status ────────────────────────────────────

function getCurrentTimeMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function getBangladeshDayIndex() {
  return new Date().getDay(); // 0=Sunday ... 6=Saturday
}

/**
 * Given a time string like "08:00 - 09:40", return [startMinutes, endMinutes]
 */
function parseTimeRange(timeStr) {
  const parts = timeStr.split('-').map(s => s.trim());
  if (parts.length !== 2) return null;
  const parse = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  return [parse(parts[0]), parse(parts[1])];
}

function getNextFreeInfo(routine, dayName, afterMinutes) {
  const todayClasses = routine?.[dayName] || [];
  for (const cls of todayClasses) {
    const range = parseTimeRange(cls.time);
    if (range && range[0] >= afterMinutes) {
      return `Next: ${cls.time} - ${cls.course} (${cls.room})`;
    }
  }
  if (todayClasses.length > 0) {
    return 'Free for the rest of the day';
  }
  return 'No classes today';
}

/**
 * Determine if a faculty is currently busy based on their routine.
 */
export function computeAutoStatus(facultyId) {
  const routine = getFacultyRoutine(facultyId);
  const dayIndex = getBangladeshDayIndex();
  const dayName = DAY_NAMES[dayIndex];

  // Weekends (Friday/Saturday)
  if (dayIndex === 5 || dayIndex === 6) {
    return { isBusy: false, currentClass: null, nextFree: null, status: 'away' };
  }

  const now = getCurrentTimeMinutes();
  const todayClasses = routine?.[dayName] || [];

  for (const cls of todayClasses) {
    const range = parseTimeRange(cls.time);
    if (range && now >= range[0] && now < range[1]) {
      return { isBusy: true, currentClass: cls, nextFree: getNextFreeInfo(routine, dayName, range[1]), status: 'busy' };
    }
  }

  const nextFree = getNextFreeInfo(routine, dayName, now);
  // If they have a routine with classes, they're available (not in class right now)
  // If no routine at all, show as offline (they haven't set up their schedule)
  const hasAnyRoutine = routine && Object.values(routine).some(d => d.length > 0);
  if (!hasAnyRoutine) {
    return { isBusy: false, currentClass: null, nextFree: null, status: 'offline' };
  }
  return { isBusy: false, currentClass: null, nextFree, status: 'available' };
}

/**
 * Get the computed status for a faculty member, considering their mode.
 */
export function getComputedFacultyStatus(facultyId) {
  const statusConfig = getFacultyStatus(facultyId);
  const autoResult = computeAutoStatus(facultyId);

  let status;
  if (statusConfig.statusMode === 'manual' && statusConfig.manualStatus) {
    status = statusConfig.manualStatus;
  } else {
    status = autoResult.status;
  }

  return {
    status,
    statusMode: statusConfig.statusMode || 'auto',
    currentClass: autoResult.currentClass || null,
    nextFree: autoResult.nextFree || null,
    label: getStatusLabel(status),
  };
}

export function getStatusLabel(status) {
  switch (status) {
    case 'available': return 'Available';
    case 'busy': return 'Busy';
    case 'away': return 'Away';
    case 'offline': return 'Offline';
    default: return 'Unknown';
  }
}

/**
 * Get all faculty with computed statuses for the list view.
 */
export function getAllFacultyWithStatus() {
  const profiles = getFacultyProfiles();
  return profiles.map(f => ({
    ...f,
    ...getComputedFacultyStatus(f.id),
  }));
}

/**
 * Get departments that have faculty.
 */
export function getFacultyDepartments() {
  const profiles = getFacultyProfiles();
  const depts = [...new Set(profiles.map(f => f.department))];
  return depts.sort();
}
