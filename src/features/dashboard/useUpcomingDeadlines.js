/**
 * Single source of truth for "what is coming up" on the dashboard.
 *
 * The "At a glance" card and the deadline widget used to build this list with
 * slightly different rules (one ignored shared CR tasks and batch groups), so
 * their numbers disagreed. Both now read this hook.
 */
import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLiveValue } from '../../utils/liveStore';
import { getUserBatchGroup } from '../../utils/getUserBatchGroup';

function normalizeTitle(value) {
  const text = typeof value === 'string' ? value : '';
  return text.length > 80 ? text.slice(0, 80) : text;
}

/** Task date ("YYYY-MM-DD") + optional time → local Date. Never parses as UTC. */
function parseTaskDueDate(task) {
  if (!task || !task.date) return null;
  const date = new Date(`${task.date}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const [rawHours, rawMinutes] = String(task.time || '').split(':');
  const hours = parseInt(rawHours, 10);
  const minutes = parseInt(rawMinutes, 10);
  if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
    date.setHours(hours, minutes, 0, 0);
  } else {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

function normalizeManualDeadline(deadline) {
  if (!deadline || typeof deadline !== 'object') return null;
  const dueDate = deadline.dueDate instanceof Date
    ? new Date(deadline.dueDate)
    : new Date(deadline.dueDate);
  if (Number.isNaN(dueDate.getTime())) return null;
  return {
    ...deadline,
    title: normalizeTitle(deadline.title),
    dueDate,
    fromCalendar: false,
  };
}

export default function useUpcomingDeadlines() {
  const { user } = useAuth();
  const userBatchGroup = useMemo(() => getUserBatchGroup(user), [user]);
  const sharedTaskPrefix = user?.department && user?.semester
    ? `aust-semester-tasks:${String(user.department).trim().toUpperCase()}:${user.semester}`
    : '';

  const [manualDeadlines] = useLiveValue('user', 'aust-deadlines', []);
  const [personalTasks] = useLiveValue('user', 'aust-week-tasks', []);

  // CR-published tasks are shared per department/semester/lab group.
  const [groupedTasks] = useLiveValue('shared', sharedTaskPrefix ? `${sharedTaskPrefix}:A1` : null, []);
  const [groupedTasksA2] = useLiveValue('shared', sharedTaskPrefix ? `${sharedTaskPrefix}:A2` : null, []);
  const [groupedTasksB1] = useLiveValue('shared', sharedTaskPrefix ? `${sharedTaskPrefix}:B1` : null, []);
  const [groupedTasksB2] = useLiveValue('shared', sharedTaskPrefix ? `${sharedTaskPrefix}:B2` : null, []);
  const [groupedTasksC1] = useLiveValue('shared', sharedTaskPrefix ? `${sharedTaskPrefix}:C1` : null, []);
  const [groupedTasksC2] = useLiveValue('shared', sharedTaskPrefix ? `${sharedTaskPrefix}:C2` : null, []);
  const [groupedTasksD1] = useLiveValue('shared', sharedTaskPrefix ? `${sharedTaskPrefix}:D1` : null, []);
  const [groupedTasksD2] = useLiveValue('shared', sharedTaskPrefix ? `${sharedTaskPrefix}:D2` : null, []);

  return useMemo(() => {
    const safeManual = (Array.isArray(manualDeadlines) ? manualDeadlines : [])
      .map(normalizeManualDeadline)
      .filter(Boolean);

    const sharedTasks = [];
    const sharedGroups = [
      groupedTasks, groupedTasksA2, groupedTasksB1, groupedTasksB2,
      groupedTasksC1, groupedTasksC2, groupedTasksD1, groupedTasksD2,
    ];
    sharedGroups.forEach((list) => {
      if (Array.isArray(list)) sharedTasks.push(...list);
    });

    // Personal tasks carry the author's batch; shared tasks are already scoped
    // by group, so the same strict batch filter keeps both leak-free.
    const taskList = [...(Array.isArray(personalTasks) ? personalTasks : []), ...sharedTasks]
      .filter((task) => task && task.batchGroup && task.batchGroup === userBatchGroup)
      .map((task) => {
        const dueDate = parseTaskDueDate(task);
        if (!dueDate) return null;
        return {
          id: `task-${task.id}`,
          title: normalizeTitle(task.title),
          course: task.courseCode || task.courseName || 'General',
          dueDate,
          type: 'Quiz',
          priority: 'medium',
          color: 'var(--accent-cyan)',
          fromCalendar: true,
          batchGroup: task.batchGroup,
          taskId: task.id,
          taskDate: task.date,
        };
      })
      .filter(Boolean);

    const now = Date.now();
    const upcoming = [...safeManual, ...taskList]
      .filter((item) => item.dueDate.getTime() > now)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    return {
      userBatchGroup,
      manualDeadlines: safeManual,
      taskDeadlines: taskList,
      upcoming,
    };
  }, [
    manualDeadlines, personalTasks, userBatchGroup,
    groupedTasks, groupedTasksA2, groupedTasksB1, groupedTasksB2,
    groupedTasksC1, groupedTasksC2, groupedTasksD1, groupedTasksD2,
  ]);
}
