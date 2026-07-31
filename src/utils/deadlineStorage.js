/**
 * deadlineStorage.js — localStorage-backed deadline storage.
 *
 * Deadline shape:
 *   {
 *     id: number|string,
 *     course: string,
 *     title: string,
 *     dueDate: Date (serialized to ISO string),
 *     type: 'Assignment' | 'Quiz' | 'Exam' | string,
 *     priority: 'low' | 'medium' | 'high',
 *     color: string,
 *     batchGroup?: string,
 *     crGroup?: string,
 *     fromCalendar?: boolean,
 *   }
 *
 * Uses the same 'aust-deadlines' key that NextWeekSchedule & DashboardPage
 * already read, so data added here shows up across the dashboard.
 */

const STORAGE_KEY = 'aust-deadlines';

function readRaw() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function writeRaw(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/** Hydrate stored deadlines — parses dueDate ISO strings back into Date objects. */
export function getDeadlines() {
  const list = readRaw();
  if (!Array.isArray(list)) return [];
  return list
    .filter((dl) => dl && typeof dl === 'object' && dl.dueDate)
    .map((dl) => ({
      ...dl,
      dueDate: new Date(dl.dueDate),
    }));
}

/** Replace the full deadline list. */
export function saveDeadlines(list) {
  writeRaw(Array.isArray(list) ? list : []);
}

/**
 * Add a deadline.
 * @param {{ course?: string, title: string, dueDate: Date|string, type?: string, priority?: string, color?: string, batchGroup?: string, crGroup?: string }} data
 * @returns the created deadline object (with id).
 */
export function addDeadline(data) {
  const list = getDeadlines();
  const deadline = {
    id: data?.id ?? Date.now(),
    course: (data?.course || '').trim() || 'General',
    title: (data?.title || '').trim(),
    dueDate: data?.dueDate ? new Date(data.dueDate) : null,
    type: data?.type || 'Assignment',
    priority: data?.priority || 'medium',
    color: data?.color || '#3b82f6',
    ...(data?.batchGroup ? { batchGroup: data.batchGroup } : {}),
    ...(data?.crGroup ? { crGroup: data.crGroup } : {}),
  };
  list.push(deadline);
  writeRaw(list);
  return deadline;
}

/** Remove a deadline by id. */
export function deleteDeadline(id) {
  const list = getDeadlines().filter((dl) => dl.id !== id);
  writeRaw(list);
  return list;
}
