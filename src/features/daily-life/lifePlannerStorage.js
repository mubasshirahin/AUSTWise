/**
 * Life Planner — data layer.
 *
 * Persists the whole planner as one JSON document under the user-store key
 * 'aust-life-planner-v1' (cross-device synced + WebSocket live updates via
 * liveStore, the same pattern as 'aust-week-tasks').
 *
 * Document shape:
 * {
 *   phases:   [{ id, title, subtitle, color, order }],
 *   goals:    [{ id, phaseId, number, title, types[], costLabel, timingLabel,
 *                timingDate, definitionOfDone, status, order, createdAt }],
 *   deps:     [{ id, goalId, dependsOnGoalId, note }],
 *   tasks:    [{ id, goalId, name, costLabel, dueLabel, dueDate, order }],
 *   steps:    [{ id, taskId, text, dueLabel, dueDate, isDone, doneAt, note, order }],
 *   habits:   [{ id, name, frequency, targetDaysPerWeek, startDate, archived, order }],
 *   habitLogs:{ [habitId]: { [YYYY-MM-DD]: true } },
 *   ledger:   [{ id, date, item, amount, category, relatedGoalId, order }],
 * }
 */

import { useLiveValue } from '../../utils/liveStore';

export const STORE_KEY = 'aust-life-planner-v1';

export const GOAL_TYPES = ['goal', 'milestone', 'habit'];

export const TYPE_META = {
  goal:      { label: 'Goal',      color: 'var(--accent-amber)',   badge: 'lp-badge-amber' },
  milestone: { label: 'Milestone', color: 'var(--accent-purple)',  badge: 'lp-badge-purple' },
  habit:     { label: 'Habit',     color: 'var(--accent-emerald)', badge: 'lp-badge-emerald' },
};

export const PHASE_COLORS = [
  '#F5A623', '#3ECF8E', '#3AC1D9', '#8b7e74', '#F0554A',
  '#b58cf5', '#5d9bf5', '#f5d15d',
];

export const WEEKDAYS = [
  { key: 'Sat', label: 'Sat', day: 6 },
  { key: 'Sun', label: 'Sun', day: 0 },
  { key: 'Mon', label: 'Mon', day: 1 },
  { key: 'Tue', label: 'Tue', day: 2 },
  { key: 'Wed', label: 'Wed', day: 3 },
  { key: 'Thu', label: 'Thu', day: 4 },
  { key: 'Fri', label: 'Fri', day: 5 },
];

export const EMPTY_DOC = {
  phases: [], goals: [], deps: [], tasks: [], steps: [],
  habits: [], habitLogs: {}, ledger: [],
};

// ── id helper ────────────────────────────────────────────────────────────────

export function uid() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ── date helpers ─────────────────────────────────────────────────────────────

export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d, n) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** Start of the week containing `d` (weeks start Friday, matching the app's schedule). */
export function startOfWeek(d = new Date()) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - ((out.getDay() - 5 + 7) % 7));
  return out;
}

export function daysBetween(a, b) {
  const ms = new Date(b).setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

export function fmtDate(key) {
  if (!key) return '';
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── live-synced document hook ────────────────────────────────────────────────

/**
 * useLifePlanner() → [doc, update]
 *   doc     — the planner document (falls back to EMPTY_DOC)
 *   update  — update(fn | partial): pure transform of the doc, persisted
 *             optimistically and synced to other devices via the user store.
 */
export function useLifePlanner() {
  const [raw, setRaw, delRaw] = useLiveValue('user', STORE_KEY, null);
  const doc = raw && typeof raw === 'object' ? { ...EMPTY_DOC, ...raw } : EMPTY_DOC;
  const update = (fn) =>
    setRaw((prev) => {
      const base = prev && typeof prev === 'object' ? { ...EMPTY_DOC, ...prev } : { ...EMPTY_DOC };
      const next = typeof fn === 'function' ? fn(base) : { ...base, ...fn };
      return next;
    });
  return [doc, update, delRaw];
}

// ── lookups ──────────────────────────────────────────────────────────────────

export const byId = (list, id) => list.find((x) => x.id === id) || null;

export function tasksOfGoal(doc, goalId) {
  return doc.tasks.filter((t) => t.goalId === goalId).sort((a, b) => a.order - b.order);
}

export function stepsOfTask(doc, taskId) {
  return doc.steps.filter((s) => s.taskId === taskId).sort((a, b) => a.order - b.order);
}

export function stepsOfGoal(doc, goalId) {
  const taskIds = new Set(tasksOfGoal(doc, goalId).map((t) => t.id));
  return doc.steps.filter((s) => taskIds.has(s.taskId));
}

export function depsOfGoal(doc, goalId) {
  return doc.deps.filter((d) => d.goalId === goalId);
}

export function unlocksWithGoal(doc, goalId) {
  return doc.deps.filter((d) => d.dependsOnGoalId === goalId);
}

export function goalsOfPhase(doc, phaseId) {
  return doc.goals.filter((g) => g.phaseId === phaseId).sort((a, b) => a.order - b.order);
}

export function goalsOfMilestone(doc, milestoneId) {
  return doc.goals
    .filter((g) => {
      if ((g.types || []).includes('milestone')) return false;
      if (g.milestoneId) return g.milestoneId === milestoneId;
      if (g.phaseId) {
        const ph = doc.phases.find((p) => p.id === g.phaseId);
        return ph?.milestoneId === milestoneId;
      }
      return false;
    })
    .sort((a, b) => a.order - b.order);
}

export function milestoneProgress(doc, milestoneId) {
  const goals = goalsOfMilestone(doc, milestoneId);
  if (goals.length === 0) return 0;
  return Math.round(goals.reduce((sum, g) => sum + goalProgress(doc, g.id), 0) / goals.length);
}

// ── derived: progress & status ───────────────────────────────────────────────

export function goalProgress(doc, goalId) {
  const steps = stepsOfGoal(doc, goalId);
  if (steps.length === 0) return 0;
  const done = steps.filter((s) => s.isDone).length;
  return Math.round((done / steps.length) * 100);
}

export function phaseProgress(doc, phaseId) {
  const goals = goalsOfPhase(doc, phaseId);
  if (goals.length === 0) return 0;
  return Math.round(goals.reduce((sum, g) => sum + goalProgress(doc, g.id), 0) / goals.length);
}

export function overallProgress(doc) {
  if (doc.goals.length === 0) return 0;
  return Math.round(doc.goals.reduce((sum, g) => sum + goalProgress(doc, g.id), 0) / doc.goals.length);
}

/** A goal is "locked" while any prerequisite goal isn't 100% done. */
export function goalLocked(doc, goalId) {
  return depsOfGoal(doc, goalId).some((d) => {
    const dep = byId(doc.goals, d.dependsOnGoalId);
    return dep && goalProgress(doc, dep.id) < 100;
  });
}

export function recomputeGoalStatus(doc, goalId) {
  const g = byId(doc.goals, goalId);
  if (!g) return;
  const steps = stepsOfGoal(doc, goalId);
  g.status = steps.length > 0 && steps.every((s) => s.isDone) ? 'done'
    : steps.some((s) => s.isDone) ? 'in_progress' : 'not_started';
}

/** Recompute every goal's status after a step toggle. Mutates a draft copy. */
export function withStatuses(docDraft) {
  for (const g of docDraft.goals) recomputeGoalStatus(docDraft, g.id);
  return docDraft;
}

// ── derived: timeline ────────────────────────────────────────────────────────

/** Union of Goal.timingDate + Task.dueDate + Step.dueDate + recurring weekly expansion, sorted ascending. */
export function buildTimeline(doc) {
  const entries = [];
  for (const goal of doc.goals) {
    if (goal.timingDate) {
      entries.push({ date: goal.timingDate, kind: 'goal', label: `Deadline: ${goal.title}`, goal, done: goalProgress(doc, goal.id) === 100 });
    }
  }
  for (const task of doc.tasks) {
    if (task.isRecurring && Array.isArray(task.recurringWeekdays) && task.recurringWeekdays.length) {
      const goal = byId(doc.goals, task.goalId);
      const selectedDays = new Set(task.recurringWeekdays);
      // map weekday key -> day number using WEEKDAYS
      const keyToDay = Object.fromEntries(WEEKDAYS.map((w) => [w.key, w.day]));
      for (let i = 0; i < 30; i++) {
        const d = addDays(new Date(), i);
        const dayNum = d.getDay();
        const key = WEEKDAYS.find((w) => w.day === dayNum)?.key;
        if (key && selectedDays.has(key)) {
          const dateKey = todayKey(d);
          entries.push({ date: dateKey, kind: 'task', label: `${task.name} (Recurring)`, goal, recurring: true, weekdays: task.recurringWeekdays });
        }
      }
    } else if (task.dueDate) {
      const goal = byId(doc.goals, task.goalId);
      entries.push({ date: task.dueDate, kind: 'task', label: task.name, goal });
    }
  }
  for (const step of doc.steps) {
    const task = byId(doc.tasks, step.taskId);
    const parentRecurring = !!task?.isRecurring;
    if (parentRecurring && Array.isArray(task.recurringWeekdays) && task.recurringWeekdays.length) {
      // auto recurring step — same weekdays as parent task
      const goal = task ? byId(doc.goals, task.goalId) : null;
      const selectedDays = new Set(task.recurringWeekdays);
      for (let i = 0; i < 30; i++) {
        const d = addDays(new Date(), i);
        const dayNum = d.getDay();
        const key = WEEKDAYS.find((w) => w.day === dayNum)?.key;
        if (key && selectedDays.has(key)) {
          const dateKey = todayKey(d);
          entries.push({ date: dateKey, kind: 'step', label: `${step.text} (Recurring)`, step, goal, done: !!step.isDone, recurring: true });
        }
      }
    } else if (step.dueDate) {
      const goal = task ? byId(doc.goals, task.goalId) : null;
      entries.push({
        date: step.dueDate, kind: 'step', label: step.text, step, goal,
        done: !!step.isDone,
      });
    }
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

// ── derived: habits ──────────────────────────────────────────────────────────

export function habitDone(doc, habitId, dateKey) {
  return !!doc.habitLogs?.[habitId]?.[dateKey];
}

export function toggleHabitDay(doc, habitId, dateKey) {
  const logs = { ...(doc.habitLogs || {}) };
  const forHabit = { ...(logs[habitId] || {}) };
  if (forHabit[dateKey]) delete forHabit[dateKey];
  else forHabit[dateKey] = true;
  logs[habitId] = forHabit;
  return { ...doc, habitLogs: logs };
}

/** Consecutive done days counted back from today (or yesterday if today is not done yet). */
export function habitStreak(doc, habit) {
  const logs = doc.habitLogs?.[habit.id] || {};
  let streak = 0;
  let cursor = new Date();
  if (!logs[todayKey(cursor)]) cursor = addDays(cursor, -1); // today not logged yet — don't break the streak
  while (logs[todayKey(cursor)]) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function habitBestStreak(doc, habit) {
  const logs = doc.habitLogs?.[habit.id] || {};
  const keys = Object.keys(logs).filter((k) => logs[k]).sort();
  let best = 0, run = 0, prev = null;
  for (const k of keys) {
    run = prev && daysBetween(prev, k) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

/** Done-count for a habit inside the week starting at `weekStart`. */
export function habitWeekCount(doc, habit, weekStart) {
  let count = 0;
  for (let i = 0; i < 7; i++) {
    if (habitDone(doc, habit.id, todayKey(addDays(weekStart, i)))) count += 1;
  }
  return count;
}

// ── derived: ledger ──────────────────────────────────────────────────────────

/** Ledger rows ordered by date (then manual order), each with a running balance. */
export function ledgerWithBalance(doc) {
  const rows = [...doc.ledger].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.order || 0) - (b.order || 0)
  );
  let bal = 0;
  return rows.map((r) => {
    bal += Number(r.amount) || 0;
    return { ...r, balance: bal };
  });
}

export function ledgerTotals(doc) {
  let inflow = 0, outflow = 0;
  for (const r of doc.ledger) {
    const amt = Number(r.amount) || 0;
    if (amt >= 0) inflow += amt; else outflow += -amt;
  }
  return { inflow, outflow, balance: inflow - outflow };
}

export function fmtMoney(n) {
  const sign = n < 0 ? '−' : '';
  return `${sign}${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}

// ── mutations (pure transforms, applied via update()) ────────────────────────

export function nextGoalNumber(doc) {
  return doc.goals.reduce((max, g) => Math.max(max, g.number || 0), 0) + 1;
}

export function nextOrder(list) {
  return list.reduce((max, x) => Math.max(max, x.order || 0), -1) + 1;
}

/** Creates a goal (with optional nested tasks/steps) and returns the new doc. */
export function createGoal(doc, { phaseId = null, milestoneId = null, title, types, costLabel, timingLabel, timingDate, definitionOfDone, dependsOn = [], tasks = [] }) {
  const goals = [...doc.goals];
  // Phase layer removed: milestoneId is the direct parent. Keep phaseId for backward-compat.
  const resolvedMilestoneId = milestoneId || null;
  const resolvedPhaseId = phaseId || null;
  const siblings = resolvedMilestoneId
    ? goals.filter((g) => g.milestoneId === resolvedMilestoneId)
    : resolvedPhaseId
      ? goals.filter((g) => g.phaseId === resolvedPhaseId)
      : goals.filter((g) => !g.milestoneId && !g.phaseId);
  const goal = {
    id: uid(),
    phaseId: resolvedPhaseId,
    milestoneId: resolvedMilestoneId,
    number: nextGoalNumber(doc),
    title: title.trim(),
    types: types.length ? types : ['goal'],
    costLabel: costLabel?.trim() || null,
    timingLabel: timingLabel?.trim() || null,
    timingDate: timingDate || null,
    definitionOfDone: definitionOfDone?.trim() || null,
    status: 'not_started',
    order: nextOrder(siblings),
    createdAt: new Date().toISOString(),
  };
  goals.push(goal);

  const tasksOut = [...doc.tasks];
  const stepsOut = [...doc.steps];
  tasks.forEach((t, ti) => {
    if (!t.name?.trim()) return;
    const taskId = uid();
    tasksOut.push({
      id: taskId, goalId: goal.id, name: t.name.trim(),
      costLabel: t.costLabel?.trim() || null,
      dueLabel: t.dueLabel?.trim() || null,
      dueDate: t.dueDate || null,
      order: ti,
    });
    (t.steps || []).forEach((s, si) => {
      if (!s.text?.trim()) return;
      stepsOut.push({
        id: uid(), taskId, text: s.text.trim(),
        dueLabel: s.dueLabel?.trim() || null,
        dueDate: s.dueDate || null,
        isDone: false, doneAt: null,
        note: s.note?.trim() || null,
        order: si,
      });
    });
  });

  const deps = [...doc.deps];
  for (const depId of dependsOn) {
    if (depId !== goal.id && !deps.some((d) => d.goalId === goal.id && d.dependsOnGoalId === depId)) {
      deps.push({ id: uid(), goalId: goal.id, dependsOnGoalId: depId, note: null });
    }
  }

  return { ...doc, goals, tasks: tasksOut, steps: stepsOut, deps };
}

/** Updates a goal's own fields; replaces deps with the given list. */
export function updateGoal(doc, goalId, { phaseId, milestoneId, title, types, costLabel, timingLabel, timingDate, definitionOfDone, dependsOn = [] }) {
  const goals = doc.goals.map((g) => (g.id === goalId ? {
    ...g,
    phaseId: phaseId !== undefined ? (phaseId || null) : g.phaseId,
    milestoneId: milestoneId !== undefined ? (milestoneId || null) : g.milestoneId,
    title: title?.trim() || g.title,
    types: types?.length ? types : g.types,
    costLabel: costLabel !== undefined ? (costLabel?.trim() || null) : g.costLabel,
    timingLabel: timingLabel !== undefined ? (timingLabel?.trim() || null) : g.timingLabel,
    timingDate: timingDate !== undefined ? (timingDate || null) : g.timingDate,
    definitionOfDone: definitionOfDone !== undefined ? (definitionOfDone?.trim() || null) : g.definitionOfDone,
  } : g));
  const deps = [
    ...doc.deps.filter((d) => d.goalId !== goalId),
    ...dependsOn
      .filter((depId) => depId !== goalId)
      .map((depId) => ({ id: uid(), goalId, dependsOnGoalId: depId, note: null })),
  ];
  return { ...doc, goals, deps };
}

/** Deletes a goal and everything hanging off it (tasks, steps, deps). */
export function deleteGoal(doc, goalId) {
  const taskIds = new Set(tasksOfGoal(doc, goalId).map((t) => t.id));
  return {
    ...doc,
    goals: doc.goals.filter((g) => g.id !== goalId),
    tasks: doc.tasks.filter((t) => !taskIds.has(t.goalId)),
    steps: doc.steps.filter((s) => !taskIds.has(s.taskId)),
    deps: doc.deps.filter((d) => d.goalId !== goalId && d.dependsOnGoalId !== goalId),
    ledger: doc.ledger.map((r) => (r.relatedGoalId === goalId ? { ...r, relatedGoalId: null } : r)),
  };
}

export function isTaskRecurring(task) { return !!task?.isRecurring; }
export function isStepRecurring(doc, step) {
  const task = byId(doc.tasks, step.taskId);
  return !!task?.isRecurring;
}

export function addTask(doc, goalId, { name, costLabel, dueLabel, dueDate, isRecurring = false, recurringDaysPerWeek = null, recurringWeekdays = [] }) {
  const goalTasks = tasksOfGoal(doc, goalId);
  return {
    ...doc,
    tasks: [...doc.tasks, {
      id: uid(), goalId, name: name.trim(),
      costLabel: costLabel?.trim() || null,
      dueLabel: dueLabel?.trim() || null,
      dueDate: isRecurring ? null : (dueDate || null),
      order: nextOrder(goalTasks),
      isRecurring: !!isRecurring,
      recurringDaysPerWeek: isRecurring ? (Number(recurringDaysPerWeek) || recurringWeekdays.length || null) : null,
      recurringWeekdays: isRecurring ? [...(recurringWeekdays || [])] : [],
    }],
  };
}

export function updateTask(doc, taskId, patch) {
  return { ...doc, tasks: doc.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) };
}

export function deleteTask(doc, taskId) {
  return {
    ...doc,
    tasks: doc.tasks.filter((t) => t.id !== taskId),
    steps: doc.steps.filter((s) => s.taskId !== taskId),
  };
}

export function addStep(doc, taskId, { text, dueLabel, dueDate, note }) {
  const taskSteps = stepsOfTask(doc, taskId);
  return {
    ...doc,
    steps: [...doc.steps, {
      id: uid(), taskId, text: text.trim(),
      dueLabel: dueLabel?.trim() || null,
      dueDate: dueDate || null,
      isDone: false, doneAt: null,
      note: note?.trim() || null,
      order: nextOrder(taskSteps),
    }],
  };
}

export function toggleStep(doc, stepId) {
  return withStatuses({
    ...doc,
    steps: doc.steps.map((s) => (s.id === stepId
      ? { ...s, isDone: !s.isDone, doneAt: !s.isDone ? new Date().toISOString() : null }
      : s)),
  });
}

export function updateStep(doc, stepId, patch) {
  return { ...doc, steps: doc.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) };
}

export function deleteStep(doc, stepId) {
  return withStatuses({ ...doc, steps: doc.steps.filter((s) => s.id !== stepId) });
}

export function addPhase(doc, { title, subtitle, color, milestoneId = null }) {
  return {
    ...doc,
    phases: [...doc.phases, {
      id: uid(), title: title.trim(), subtitle: subtitle?.trim() || null,
      color: color || PHASE_COLORS[doc.phases.length % PHASE_COLORS.length],
      order: nextOrder(doc.phases.filter((p) => p.milestoneId === milestoneId)),
      milestoneId: milestoneId || null,
    }],
  };
}

export function updatePhase(doc, phaseId, patch) {
  return { ...doc, phases: doc.phases.map((p) => (p.id === phaseId ? { ...p, ...patch } : p)) };
}

export function deletePhase(doc, phaseId) {
  // Goals move to "no phase" (null phaseId) rather than being destroyed.
  return {
    ...doc,
    phases: doc.phases.filter((p) => p.id !== phaseId),
    goals: doc.goals.map((g) => (g.phaseId === phaseId ? { ...g, phaseId: null } : g)),
  };
}

export function addHabit(doc, { name, frequency, targetDaysPerWeek, startDate }) {
  return {
    ...doc,
    habits: [...doc.habits, {
      id: uid(), name: name.trim(),
      frequency: frequency || 'daily',
      targetDaysPerWeek: targetDaysPerWeek || null,
      startDate: startDate || todayKey(),
      archived: false, order: nextOrder(doc.habits),
    }],
  };
}

export function updateHabit(doc, habitId, patch) {
  return { ...doc, habits: doc.habits.map((h) => (h.id === habitId ? { ...h, ...patch } : h)) };
}

export function addTransaction(doc, { date, item, amount, category, relatedGoalId }) {
  return {
    ...doc,
    ledger: [...doc.ledger, {
      id: uid(), date, item: item.trim(),
      amount: Number(amount) || 0,
      category: category?.trim() || null,
      relatedGoalId: relatedGoalId || null,
      order: nextOrder(doc.ledger),
    }],
  };
}

export function updateTransaction(doc, txId, patch) {
  return { ...doc, ledger: doc.ledger.map((r) => (r.id === txId ? { ...r, ...patch } : r)) };
}

export function deleteTransaction(doc, txId) {
  return { ...doc, ledger: doc.ledger.filter((r) => r.id !== txId) };
}

// ── example seed (generic placeholder content — no personal data) ────────────

export function examplePlan() {
  let doc = { ...EMPTY_DOC, habitLogs: {} };
  doc.phases = [];
  const ms1 = { id: uid(), phaseId: null, milestoneId: null, number: 1, title: 'Foundation — First Steps', types: ['milestone'], costLabel: null, timingLabel: 'This month', timingDate: null, definitionOfDone: null, status: 'not_started', order: 0, createdAt: new Date().toISOString() };
  const ms2 = { id: uid(), phaseId: null, milestoneId: null, number: 2, title: 'Growth — Build & Apply', types: ['milestone'], costLabel: null, timingLabel: 'Next 2 months', timingDate: null, definitionOfDone: null, status: 'not_started', order: 1, createdAt: new Date().toISOString() };

  const g1 = { id: uid(), phaseId: null, milestoneId: ms1.id, number: 3, title: 'Learn a new skill', types: ['goal'], costLabel: 'Cost: 0', timingLabel: 'This month', timingDate: null, definitionOfDone: 'Finish the tutorial and build one small project.', status: 'not_started', order: 0, createdAt: new Date().toISOString() };
  const g2 = { id: uid(), phaseId: null, milestoneId: ms1.id, number: 4, title: 'Set a study routine', types: ['goal', 'habit'], costLabel: null, timingLabel: null, timingDate: null, definitionOfDone: null, status: 'not_started', order: 1, createdAt: new Date().toISOString() };
  const g3 = { id: uid(), phaseId: null, milestoneId: ms2.id, number: 5, title: 'Complete a personal project', types: ['goal', 'milestone'], costLabel: 'Cost: 0', timingLabel: 'Next 2 months', timingDate: null, definitionOfDone: null, status: 'not_started', order: 0, createdAt: new Date().toISOString() };
  doc.goals = [ms1, ms2, g1, g2, g3];
  doc.deps = [{ id: uid(), goalId: g3.id, dependsOnGoalId: g1.id, note: null }];

  const t1 = { id: uid(), goalId: g1.id, name: 'Pick a course', costLabel: null, dueLabel: null, dueDate: todayKey(addDays(new Date(), 3)), order: 0 };
  const t2 = { id: uid(), goalId: g1.id, name: 'Finish the basics module', costLabel: null, dueLabel: null, dueDate: todayKey(addDays(new Date(), 14)), order: 1 };
  doc.tasks = [t1, t2];
  doc.steps = [
    { id: uid(), taskId: t1.id, text: 'List 3 candidate courses', dueLabel: null, dueDate: todayKey(addDays(new Date(), 1)), isDone: true, doneAt: new Date().toISOString(), note: null, order: 0 },
    { id: uid(), taskId: t1.id, text: 'Compare syllabi and pick one', dueLabel: null, dueDate: todayKey(addDays(new Date(), 3)), isDone: false, doneAt: null, note: null, order: 1 },
    { id: uid(), taskId: t2.id, text: 'Complete lessons 1–5', dueLabel: null, dueDate: todayKey(addDays(new Date(), 10)), isDone: false, doneAt: null, note: null, order: 0 },
    { id: uid(), taskId: t2.id, text: 'Build the practice exercise', dueLabel: null, dueDate: todayKey(addDays(new Date(), 14)), isDone: false, doneAt: null, note: null, order: 1 },
  ];

  const h1 = { id: uid(), name: 'Read 20 minutes', frequency: 'daily', targetDaysPerWeek: 5, startDate: todayKey(addDays(new Date(), -20)), archived: false, order: 0 };
  const h2 = { id: uid(), name: 'Morning walk', frequency: 'daily', targetDaysPerWeek: null, startDate: todayKey(addDays(new Date(), -20)), archived: false, order: 1 };
  doc.habits = [h1, h2];
  const logs = {};
  for (let i = 1; i <= 6; i++) logs[h1.id] = { ...(logs[h1.id] || {}), [todayKey(addDays(new Date(), -i))]: true };
  for (let i = 1; i <= 3; i++) logs[h2.id] = { ...(logs[h2.id] || {}), [todayKey(addDays(new Date(), -i))]: true };
  doc.habitLogs = logs;

  doc.ledger = [
    { id: uid(), date: todayKey(addDays(new Date(), -7)), item: 'Monthly allowance', amount: 5000, category: 'Income', relatedGoalId: null, order: 0 },
    { id: uid(), date: todayKey(addDays(new Date(), -5)), item: 'Course materials', amount: -800, category: 'Learning', relatedGoalId: g1.id, order: 1 },
    { id: uid(), date: todayKey(addDays(new Date(), -2)), item: 'Snacks', amount: -250, category: 'Food', relatedGoalId: null, order: 2 },
  ];

  return withStatuses(doc);
}
