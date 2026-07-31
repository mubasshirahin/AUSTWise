/**
 * Shared Routines Storage System
 * CRs (Class Reps) contribute their personal routines to a shared pool.
 * The Free Rooms page aggregates all shared routines to compute room availability.
 *
 * Architecture: 7 dept × 8 sem × 3 sec × 2 lab + 1 dept × 10 sem × 3 sec × 2 lab = 396 routines
 * Each lab group has 1 CR who contributes their routine.
 */

import { apiFetch } from './api';

const SHARED_ROUTINES_KEY = 'aust-shared-routines-v1';

/**
 * Load all shared routines from storage.
 * Returns array of { id, studentId, studentName, department, semester, section, labSection, routine, weekDays, sharedAt }
 */
export function loadSharedRoutines() {
  try {
    const stored = localStorage.getItem(SHARED_ROUTINES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save the full shared routines array to storage.
 */
export function saveSharedRoutines(routines) {
  try {
    localStorage.setItem(SHARED_ROUTINES_KEY, JSON.stringify(routines));
  } catch {
    // Storage full or unavailable
  }
}

/**
 * Share (contribute) a user's personal routine to the shared pool.
 * If the same student already shared, it updates their entry.
 *
 * @param {Object} userData - { id, name, department, semester, section, labSection }
 * @param {Object} routineData - { routine: { Sunday: [], ... }, weekDays: [...] }
 * @returns {Object} The shared entry
 */
export function shareRoutine(userData, routineData) {
  const all = loadSharedRoutines();
  const studentId = userData.id || userData.email || 'unknown';

  const existingIdx = all.findIndex(r => r.studentId === studentId);

  const entry = {
    id: existingIdx >= 0 ? all[existingIdx].id : `shared-${Date.now()}`,
    studentId,
    studentName: userData.name || 'Unknown',
    department: userData.department || '',
    semester: userData.semester || '',
    section: userData.section || '',
    labSection: userData.labSection || '',
    routine: routineData.routine || {},
    weekDays: routineData.weekDays || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    sharedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    all[existingIdx] = entry;
  } else {
    all.push(entry);
  }

  saveSharedRoutines(all);
  return entry;
}

/**
 * Remove a shared routine by student ID.
 */
export function unshareRoutine(studentId) {
  const all = loadSharedRoutines();
  const filtered = all.filter(r => r.studentId !== studentId);
  if (filtered.length !== all.length) {
    saveSharedRoutines(filtered);
    return true;
  }
  return false;
}

/**
 * Check if a given student has already shared their routine.
 */
export function hasSharedRoutine(studentId) {
  const all = loadSharedRoutines();
  return all.some(r => r.studentId === studentId);
}

/**
 * Get shared routines grouped by department.
 */
export function getSharedByDepartment(department) {
  const all = loadSharedRoutines();
  return all.filter(r => r.department === department);
}

/**
 * Get coverage stats: how many of the 396 total routines have been shared.
 * Returns { total, byDept: { CSE: 12, EEE: 8, ... } }
 */
export function getSharedCoverageStats() {
  const all = loadSharedRoutines();
  const byDept = {};
  for (const r of all) {
    const dept = r.department || 'Unknown';
    if (!byDept[dept]) byDept[dept] = { count: 0, semesters: new Set() };
    byDept[dept].count++;
    if (r.semester) byDept[dept].semesters.add(r.semester);
  }
  return {
    total: all.length,
    byDept,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Server API (async) — source of truth, with localStorage as cache / fallback
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Load shared routines from the server.
 * Falls back to localStorage if the server is unreachable.
 */
export async function loadSharedRoutinesFromServer() {
  try {
    const res = await apiFetch('/api/shared-routines');
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await res.json();
    if (data.success && Array.isArray(data.routines)) {
      // Cache in localStorage for offline/sync access
      saveSharedRoutines(data.routines);
      return data.routines;
    }
    throw new Error('Invalid server response');
  } catch {
    // Server unreachable — return empty, no fallback
    return [];
  }
}

/**
 * Share a routine to the server (upsert).
 * Always also saves to localStorage for offline resilience.
 */
export async function shareRoutineToServer(userData, routineData) {
  // Always save locally first (sync, immediate)
  const localEntry = shareRoutine(userData, routineData);

  // Fire-and-forget to server (best-effort, async)
  try {
    const res = await apiFetch('/api/shared-routines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: userData.id || userData.email,
        studentName: userData.name || '',
        department: userData.department || '',
        semester: userData.semester || '',
        section: userData.section || '',
        labSection: userData.labSection || '',
        routine: routineData.routine || {},
        weekDays: routineData.weekDays || [],
      }),
    });
    if (res.ok) {
      // Update local cache with server response to stay in sync
      const data = await res.json();
      if (data.success && data.routine) {
        const all = loadSharedRoutines();
        const idx = all.findIndex(r => r.studentId === (userData.id || userData.email));
        if (idx >= 0) {
          all[idx] = { ...data.routine, sharedAt: data.routine.sharedAt || all[idx].sharedAt };
          saveSharedRoutines(all);
        }
      }
    }
  } catch {
    // Server unreachable — localStorage already saved, nothing more to do
  }

  return localEntry;
}
