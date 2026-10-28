/**
 * One-time rescue for the legacy `aust-deadlines` store.
 *
 * That store has no writer any more (the component that created it is no
 * longer mounted), so old entries could only ever be counted — never edited or
 * deleted. On the first dashboard load we convert them into normal personal
 * calendar tasks (which Semester View can delete) and drop the legacy key.
 */
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLiveValue, setLiveValue, delLiveValue } from '../../utils/liveStore';
import { getUserBatchGroup } from '../../utils/getUserBatchGroup';

function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function localTimeKey(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  if (hours === 0 && minutes === 0) return '';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function toTask(deadline, batchGroup) {
  if (!deadline || typeof deadline !== 'object') return null;
  const dueDate = deadline.dueDate instanceof Date
    ? new Date(deadline.dueDate)
    : new Date(deadline.dueDate);
  if (Number.isNaN(dueDate.getTime())) return null;

  const rawId = deadline.id != null ? String(deadline.id) : `${deadline.title}-${dueDate.getTime()}`;
  return {
    id: `legacy-deadline-${rawId}`,
    courseCode: typeof deadline.course === 'string' && deadline.course !== 'General'
      ? deadline.course
      : '',
    courseName: '',
    title: String(deadline.title || 'Deadline').slice(0, 160),
    syllabus: '',
    date: localDateKey(dueDate),
    time: localTimeKey(dueDate),
    batchGroup: deadline.batchGroup || batchGroup || '',
    crGroup: deadline.crGroup || undefined,
    createdAt: deadline.createdAt || new Date().toISOString(),
    migratedFrom: 'aust-deadlines',
  };
}

export default function useLegacyDeadlineMigration() {
  const { user } = useAuth();
  const [legacyDeadlines] = useLiveValue('user', 'aust-deadlines', null);
  const [tasks] = useLiveValue('user', 'aust-week-tasks', []);

  useEffect(() => {
    if (!Array.isArray(legacyDeadlines) || legacyDeadlines.length === 0) return;

    const batchGroup = getUserBatchGroup(user);
    const currentTasks = Array.isArray(tasks) ? tasks : [];
    const existingIds = new Set(currentTasks.map((task) => String(task?.id)));

    const migrated = legacyDeadlines.flatMap((deadline) => {
      const task = toTask(deadline, batchGroup);
      if (!task || existingIds.has(task.id)) return [];
      return [task];
    });

    if (migrated.length > 0) {
      void setLiveValue('user', 'aust-week-tasks', [...currentTasks, ...migrated]);
    }
    // Legacy entries are now normal tasks, so keeping them would double-count.
    void delLiveValue('user', 'aust-deadlines');
  }, [legacyDeadlines, tasks, user]);
}
