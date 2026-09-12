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
 * }
 */

import { useLiveValue } from '../../utils/liveStore';

export const STORE_KEY = 'aust-life-planner-v1';

export const GOAL_TYPES = ['goal', 'milestone'];

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

/** Display number for a milestone — order-based 1,2,3 across all milestones. */
export function milestoneDisplayNumber(doc, milestone) {
  if (!milestone) return '?';
  const ms = doc.goals
    .filter((g) => (g.types || []).includes('milestone'))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const idx = ms.findIndex((x) => x.id === milestone.id);
  return idx >= 0 ? idx + 1 : (milestone.number || '?');
}

/** Display number for a goal/milestone — per-milestone 1,2,3 (not global). Fixes "Goal 7" showing as first goal. */
export function goalDisplayNumber(doc, goal) {
  if (!goal) return '?';
  const isMilestone = (goal.types || []).includes('milestone');
  if (isMilestone) {
    const ms = [...doc.goals].filter((g) => (g.types || []).includes('milestone')).sort((a, b) => (a.order || 0) - (b.order || 0));
    const idx = ms.findIndex((x) => x.id === goal.id);
    return idx >= 0 ? idx + 1 : goal.number;
  }
  if (goal.milestoneId) {
    const sibs = goalsOfMilestone(doc, goal.milestoneId);
    const idx = sibs.findIndex((x) => x.id === goal.id);
    return idx >= 0 ? idx + 1 : goal.number;
  }
  if (goal.phaseId) {
    const ph = doc.phases.find((p) => p.id === goal.phaseId);
    if (ph?.milestoneId) {
      const sibs = goalsOfMilestone(doc, ph.milestoneId);
      const idx = sibs.findIndex((x) => x.id === goal.id);
      return idx >= 0 ? idx + 1 : goal.number;
    }
  }
  const unassigned = doc.goals.filter((g) => !(g.types || []).includes('milestone') && !g.milestoneId && !g.phaseId).sort((a, b) => (a.order || 0) - (b.order || 0));
  const idx2 = unassigned.findIndex((x) => x.id === goal.id);
  return idx2 >= 0 ? idx2 + 1 : goal.number;
}

// ── auto deadline for goals: latest end date among its tasks (dynamic) ─────────
export function goalAutoDeadline(doc, goalId) {
  const tasks = tasksOfGoal(doc, goalId);
  if (tasks.length === 0) return null;
  let latest = null;
  for (const t of tasks) {
    const end = t.isRecurring ? (t.recurringEndDate || t.recurringUntil || null) : (t.dueDate || t.startDate || null);
    if (!end) continue;
    if (!latest || end > latest) latest = end;
  }
  return latest; // YYYY-MM-DD or null
}

// ── derived: progress & status ───────────────────────────────────────────────

export function goalHasSteps(doc, goalId) {
  return stepsOfGoal(doc, goalId).length > 0;
}

export function toggleGoalDone(doc, goalId) {
  return {
    ...doc,
    goals: doc.goals.map((g) => g.id === goalId ? { ...g, manualDone: !g.manualDone, status: !g.manualDone ? 'done' : 'not_started', doneAt: !g.manualDone ? new Date().toISOString() : null } : g),
  };
}

export function toggleTaskDone(doc, taskId) {
  return {
    ...doc,
    tasks: doc.tasks.map((t) => t.id === taskId ? { ...t, manualDone: !t.manualDone, doneAt: !t.manualDone ? new Date().toISOString() : null } : t),
  };
}

export function taskProgress(doc, taskId) {
  const steps = stepsOfTask(doc, taskId);
  if (steps.length === 0) {
    const t = byId(doc.tasks, taskId);
    return t?.manualDone ? 100 : 0;
  }
  const done = steps.filter((s) => s.isDone).length;
  return Math.round((done / steps.length) * 100);
}

export function goalProgress(doc, goalId) {
  const tasks = tasksOfGoal(doc, goalId);
  if (tasks.length > 0) {
    const sum = tasks.reduce((s, t) => s + taskProgress(doc, t.id), 0);
    return Math.round(sum / tasks.length);
  }
  const steps = stepsOfGoal(doc, goalId);
  if (steps.length === 0) {
    const g = byId(doc.goals, goalId);
    return g?.manualDone ? 100 : 0;
  }
  const done = steps.filter((s) => s.isDone).length;
  return Math.round((done / steps.length) * 100);
}

export function phaseProgress(doc, phaseId) {
  const goals = goalsOfPhase(doc, phaseId);
  if (goals.length === 0) return 0;
  return Math.round(goals.reduce((sum, g) => sum + goalProgress(doc, g.id), 0) / goals.length);
}

export function overallProgress(doc) {
  // Milestones are containers, not goals — exclude them from the overall average.
  const realGoals = doc.goals.filter((g) => !(g.types || []).includes('milestone'));
  if (realGoals.length === 0) return 0;
  return Math.round(realGoals.reduce((sum, g) => sum + goalProgress(doc, g.id), 0) / realGoals.length);
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
  if (steps.length === 0) {
    g.status = g.manualDone ? 'done' : 'not_started';
    return;
  }
  g.status = steps.every((s) => s.isDone) ? 'done'
    : steps.some((s) => s.isDone) ? 'in_progress' : 'not_started';
}

/** Recompute every goal's status after a step toggle. Mutates a draft copy. */
export function withStatuses(docDraft) {
  for (const g of docDraft.goals) recomputeGoalStatus(docDraft, g.id);
  return docDraft;
}

// ── derived: timeline ────────────────────────────────────────────────────────

/** Build entries between fromKey..toKey inclusive (YYYY-MM-DD). Used for 10-year view. */
export function buildTimelineRange(doc, fromKey, toKey) {
  const from = fromKey ? new Date(`${fromKey}T00:00:00`) : null;
  const to = toKey ? new Date(`${toKey}T00:00:00`) : null;
  const inRange = (k) => {
    if (!k) return false;
    if (fromKey && k < fromKey) return false;
    if (toKey && k > toKey) return false;
    return true;
  };
  const entries = [];
  // Only tasks & steps from Goals page — no milestone/goal deadline entries
  const dayToKey = Object.fromEntries(WEEKDAYS.map((w) => [w.day, w.key]));
  const getMilestone = (goal) => {
    if (!goal) return null;
    if (goal.milestoneId) return byId(doc.goals, goal.milestoneId);
    if (goal.phaseId) {
      const ph = doc.phases.find((p) => p.id === goal.phaseId);
      if (ph?.milestoneId) return byId(doc.goals, ph.milestoneId);
    }
    return null;
  };
  // Helper: determine per-task recurring window [start .. end]
  const taskWindow = (task) => {
    // start = recurringStartDate / startDate / createdAt
    let startKey = task.recurringStartDate || task.startDate || null;
    if (!startKey && task.createdAt) {
      try { startKey = todayKey(new Date(task.createdAt)); } catch {}
    }
    if (!startKey && task.createdAtKey) startKey = task.createdAtKey;
    if (!startKey) startKey = fromKey;
    let endKey = task.recurringEndDate || task.recurringUntil || task.recurringEnd || task.dueDate || null;
    if (!endKey) endKey = toKey;
    return { startKey, endKey };
  };
  for (const task of doc.tasks) {
    // Skip orphaned tasks left by legacy deleteGoal bug (goal already deleted)
    if (!byId(doc.goals, task.goalId)) continue;
    // Tasks belong to goals, not milestones — never timeline milestone-attached tasks
    const parentGoal = byId(doc.goals, task.goalId);
    if ((parentGoal.types || []).includes('milestone')) continue;
    if (task.isRecurring && Array.isArray(task.recurringWeekdays) && task.recurringWeekdays.length) {
      const goal = byId(doc.goals, task.goalId);
      const selectedDays = new Set(task.recurringWeekdays);
      const { startKey, endKey } = taskWindow(task);
      const effFrom = startKey && fromKey ? (startKey > fromKey ? startKey : fromKey) : (startKey || fromKey);
      const effTo = endKey && toKey ? (endKey < toKey ? endKey : toKey) : (endKey || toKey);
      if (effFrom && effTo && effFrom > effTo) continue;
      const sD = effFrom ? new Date(`${effFrom}T00:00:00`) : (from ? new Date(from) : new Date());
      const eD = effTo ? new Date(`${effTo}T00:00:00`) : (to ? new Date(to) : addDays(sD, 365));
      const maxDays = 11 * 366;
      const totalDays = Math.min(maxDays, Math.max(0, Math.round((eD - sD) / 86400000) + 1));
      if (totalDays <= 0 || totalDays > maxDays) continue;
      for (let i = 0; i < totalDays; i++) {
        const d = addDays(sD, i);
        const key = dayToKey[d.getDay()];
        if (key && selectedDays.has(key)) {
          const dateKey = todayKey(d);
          if (!inRange(dateKey)) continue;
          const milestone = getMilestone(goal);
          entries.push({ date: dateKey, kind: 'task', label: `${task.name} (Recurring)`, goal, milestone, recurring: true, weekdays: task.recurringWeekdays, task });
        }
      }
    } else {
      // Non-recurring: supports startDate .. dueDate range (daily entries) or single date
      const s = task.startDate || null;
      const e = task.dueDate || null;
      if (s && e) {
        if (s > e) { // swap if inverted
          if (inRange(s)) { const goal = byId(doc.goals, task.goalId); entries.push({ date: s, kind: 'task', label: task.name, goal, milestone: getMilestone(goal), task, range: `${s} → ${e}` }); }
          continue;
        }
        const effFrom = s && fromKey ? (s > fromKey ? s : fromKey) : (s || fromKey);
        const effTo = e && toKey ? (e < toKey ? e : toKey) : (e || toKey);
        if (effFrom && effTo && effFrom > effTo) continue;
        const sD = effFrom ? new Date(`${effFrom}T00:00:00`) : (from ? new Date(from) : new Date(`${s}T00:00:00`));
        const eD = effTo ? new Date(`${effTo}T00:00:00`) : (to ? new Date(to) : new Date(`${e}T00:00:00`));
        const totalDays = Math.min(11*366, Math.max(0, Math.round((eD - sD)/86400000)+1));
        if (totalDays <=0 || totalDays > 11*366) continue;
        // If range is 1 day, single entry; if longer, daily entries so timeline shows duration
        for (let i=0;i<totalDays;i++) {
          const d = addDays(sD, i);
          const dateKey = todayKey(d);
          if (!inRange(dateKey)) continue;
          const g = byId(doc.goals, task.goalId);
          entries.push({ date: dateKey, kind: 'task', label: i===0 ? task.name : `${task.name} (→ ${fmtDate(e)})`, goal: g, milestone: getMilestone(g), task, range: `${s} → ${e}` });
        }
      } else if (e && inRange(e)) {
        const goal = byId(doc.goals, task.goalId);
        entries.push({ date: e, kind: 'task', label: task.name, goal, milestone: getMilestone(goal), task });
      } else if (s && inRange(s)) {
        const goal = byId(doc.goals, task.goalId);
        entries.push({ date: s, kind: 'task', label: task.name, goal, milestone: getMilestone(goal), task });
      }
    }
  }
  for (const step of doc.steps) {
    const task = byId(doc.tasks, step.taskId);
    if (!task) continue;
    // Skip steps whose task is orphaned (legacy deleteGoal left DF ghosts)
    if (!byId(doc.goals, task.goalId)) continue;
    if (step.dueDate && inRange(step.dueDate)) {
      const goal = task ? byId(doc.goals, task.goalId) : null;
      const milestone = getMilestone(goal);
      entries.push({ date: step.dueDate, kind: 'step', label: step.text, step, goal, milestone, task, done: !!step.isDone });
    }
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

/** Union of Goal.timingDate + Task.dueDate + Step.dueDate + recurring weekly expansion, sorted ascending. */
export function buildTimeline(doc) {
  // Use 30-day window but respect per-task [createdAt .. recurringEndDate] bounds
  const fromKey = todayKey();
  const toKey = todayKey(addDays(new Date(), 30));
  return buildTimelineRange(doc, fromKey, toKey);
}

export function fmtMoney(n) {
  const sign = n < 0 ? '−' : '';
  return `${sign}${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}

// ── mutations (pure transforms, applied via update()) ────────────────────────

/** Next stored number — counted per parent (per milestone), not globally. */
export function nextGoalNumber(doc, milestoneId = null, phaseId = null) {
  const siblings = milestoneId
    ? doc.goals.filter((g) => g.milestoneId === milestoneId && !(g.types || []).includes('milestone'))
    : phaseId
      ? doc.goals.filter((g) => g.phaseId === phaseId)
      : doc.goals.filter((g) => !(g.types || []).includes('milestone') && !g.milestoneId && !g.phaseId);
  return siblings.reduce((max, g) => Math.max(max, g.number || 0), 0) + 1;
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
  // Milestones are containers — never attach tasks to them (they'd be invisible ghosts).
  const isMilestone = (types || []).includes('milestone');
  const goalTasksIn = isMilestone ? [] : tasks;
  const siblings = resolvedMilestoneId
    ? goals.filter((g) => g.milestoneId === resolvedMilestoneId)
    : resolvedPhaseId
      ? goals.filter((g) => g.phaseId === resolvedPhaseId)
      : goals.filter((g) => !g.milestoneId && !g.phaseId);
  const goal = {
    id: uid(),
    phaseId: resolvedPhaseId,
    milestoneId: resolvedMilestoneId,
    number: nextGoalNumber(doc, resolvedMilestoneId, resolvedPhaseId),
    title: title.trim(),
    types: types.length ? types : ['goal'],
    costLabel: costLabel?.trim() || null,
    timingLabel: timingLabel?.trim() || null,
    timingDate: timingDate || null,
    definitionOfDone: definitionOfDone?.trim() || null,
    status: 'not_started',
    manualDone: false,
    doneAt: null,
    order: nextOrder(siblings),
    createdAt: new Date().toISOString(),
  };
  goals.push(goal);

  const tasksOut = [...doc.tasks];
  const stepsOut = [...doc.steps];
  goalTasksIn.forEach((t, ti) => {
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

/** Deletes a goal and everything hanging off it (tasks, steps, deps).
 *  Deleting a milestone cascades to delete its child goals (unassigned = bad, auto-delete). */
export function deleteGoal(doc, goalId) {
  const goal = byId(doc.goals, goalId);
  const wasMilestone = goal && (goal.types || []).includes('milestone');
  const cascadeGoalIds = new Set([goalId]);
  if (wasMilestone) {
    for (const g of doc.goals) if (g.milestoneId === goalId) cascadeGoalIds.add(g.id);
  }
  const taskIds = new Set(doc.tasks.filter((t) => cascadeGoalIds.has(t.goalId)).map((t) => t.id));
  return {
    ...doc,
    goals: doc.goals.filter((g) => !cascadeGoalIds.has(g.id)),
    tasks: doc.tasks.filter((t) => !taskIds.has(t.id)),
    steps: doc.steps.filter((s) => !taskIds.has(s.taskId)),
    deps: doc.deps.filter((d) => !cascadeGoalIds.has(d.goalId) && !cascadeGoalIds.has(d.dependsOnGoalId)),
  };
}

/** Purge orphaned tasks/steps whose parent no longer exists (fixes legacy DF ghosts). */
export function purgeOrphans(doc) {
  const goalIds = new Set(doc.goals.map((g) => g.id));
  const taskIds = new Set(doc.tasks.filter((t) => goalIds.has(t.goalId)).map((t) => t.id));
  const prunedTasks = doc.tasks.filter((t) => goalIds.has(t.goalId));
  const prunedSteps = doc.steps.filter((s) => taskIds.has(s.taskId));
  if (prunedTasks.length === doc.tasks.length && prunedSteps.length === doc.steps.length) return doc;
  return { ...doc, tasks: prunedTasks, steps: prunedSteps };
}

/**
 * One-time normalization (legacy-data cleanup):
 * 1. Deletes tasks attached directly to a milestone — milestones are containers,
 *    tasks live on goals; such tasks were invisible on the Goals page but leaked
 *    into the Timeline (the "DF (Recurring)" ghosts).
 * 2. Deletes goals whose milestone was already deleted (dangling) or truly
 *    unassigned (no milestoneId/phaseId) — unassigned = bad, auto-delete.
 */
export function normalizePlanner(doc) {
  // 0. Purge ledger & habits — features removed from Life Planner
  if ('ledger' in doc) {
    const { ledger: _omit, ...rest } = doc;
    doc = rest;
  }
  if ('habits' in doc || 'habitLogs' in doc) {
    const { habits: _h, habitLogs: _hl, ...rest } = doc;
    doc = rest;
  }
  const milestoneIds = new Set(
    doc.goals.filter((g) => (g.types || []).includes('milestone')).map((g) => g.id)
  );
  const goalIds = new Set(doc.goals.map((g) => g.id));

  // 1. Tasks on milestones (and their steps) are removed entirely.
  let tasks = doc.tasks.filter((t) => !milestoneIds.has(t.goalId));
  let taskIds = new Set(tasks.map((t) => t.id));
  let steps = doc.steps.filter((s) => taskIds.has(s.taskId));

  // 2. Delete dangling or truly unassigned goals (and their tasks/steps).
  const badGoalIds = new Set();
  for (const g of doc.goals) {
    const isMilestone = (g.types || []).includes('milestone');
    if (isMilestone) continue;
    if (g.milestoneId && !goalIds.has(g.milestoneId)) badGoalIds.add(g.id); // dangling
    else if (!g.milestoneId && !g.phaseId) badGoalIds.add(g.id); // truly unassigned
  }
  if (badGoalIds.size === 0) {
    if (tasks.length === doc.tasks.length && steps.length === doc.steps.length) return doc;
    return { ...doc, tasks, steps };
  }
  const goals = doc.goals.filter((g) => !badGoalIds.has(g.id));
  tasks = tasks.filter((t) => !badGoalIds.has(t.goalId));
  taskIds = new Set(tasks.map((t) => t.id));
  steps = steps.filter((s) => taskIds.has(s.taskId));
  const deps = doc.deps.filter((d) => !badGoalIds.has(d.goalId) && !badGoalIds.has(d.dependsOnGoalId));
  return { ...doc, goals, tasks, steps, deps };
}

export function isTaskRecurring(task) { return !!task?.isRecurring; }
export function isStepRecurring(doc, step) {
  const task = byId(doc.tasks, step.taskId);
  return !!task?.isRecurring;
}

export function addTask(doc, goalId, { name, costLabel, dueLabel, dueDate, startDate = null, isRecurring = false, recurringDaysPerWeek = null, recurringWeekdays = [], recurringEndDate = null, recurringStartDate = null, createdAt = null }) {
  const goalTasks = tasksOfGoal(doc, goalId);
  const today = todayKey();
  const endDate = isRecurring ? (recurringEndDate || null) : null;
  const startForRecurring = isRecurring ? (recurringStartDate || startDate || null) : null;
  const taskStart = !isRecurring ? (startDate || null) : startForRecurring;
  // Build dueLabel with range if both dates present
  let label = dueLabel?.trim() || null;
  if (!label) {
    if (isRecurring && taskStart && endDate) label = `${fmtDate(taskStart)} → ${fmtDate(endDate)} • ${recurringWeekdays?.length || 0}/week`;
    else if (isRecurring && endDate) label = `Recurring ${recurringWeekdays?.length || 0}/week → ${fmtDate(endDate)}`;
    else if (!isRecurring && taskStart && dueDate) label = taskStart === dueDate ? fmtDate(dueDate) : `${fmtDate(taskStart)} → ${fmtDate(dueDate)}`;
    else if (!isRecurring && dueDate) label = fmtDate(dueDate);
    else if (!isRecurring && taskStart) label = fmtDate(taskStart);
  }
  return {
    ...doc,
    tasks: [...doc.tasks, {
      id: uid(), goalId, name: name.trim(),
      costLabel: costLabel?.trim() || null,
      dueLabel: label,
      dueDate: isRecurring ? null : (dueDate || null),
      startDate: taskStart,
      order: nextOrder(goalTasks),
      isRecurring: !!isRecurring,
      recurringDaysPerWeek: isRecurring ? (Number(recurringDaysPerWeek) || recurringWeekdays.length || null) : null,
      recurringWeekdays: isRecurring ? [...(recurringWeekdays || [])] : [],
      recurringEndDate: endDate,
      recurringUntil: endDate, // alias for backward compat
      recurringStartDate: startForRecurring,
      manualDone: false,
      doneAt: null,
      createdAt: createdAt || new Date().toISOString(),
      createdAtKey: today,
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

// ── legacy example-data cleanup (the example seed was removed; purge leftovers) ─

const EXAMPLE_GOAL_TITLES = new Set([
  'Foundation — First Steps', 'Growth — Build & Apply',
  'Learn a new skill', 'Set a study routine', 'Complete a personal project',
]);
const EXAMPLE_TASK_NAMES = new Set(['Pick a course', 'Finish the basics module']);
const EXAMPLE_STEP_TEXTS = new Set([
  'List 3 candidate courses', 'Compare syllabi and pick one',
  'Complete lessons 1–5', 'Build the practice exercise',
]);
/** One-time purge of content created by the removed "Load example plan" seed.
 *  Only exact example titles are matched — user-created tasks/steps are kept. */
export function stripExampleContent(doc) {
  const exampleGoals = doc.goals.filter((g) => EXAMPLE_GOAL_TITLES.has(g.title));
  const exampleTasks = doc.tasks.filter((t) => EXAMPLE_TASK_NAMES.has(t.name));
  const exampleSteps = doc.steps.filter((s) => EXAMPLE_STEP_TEXTS.has(s.text));
  if (exampleGoals.length === 0 && exampleTasks.length === 0 && exampleSteps.length === 0) return doc;
  const goalIds = new Set(exampleGoals.map((g) => g.id));
  const tasks = doc.tasks.filter((t) => !goalIds.has(t.goalId) && !EXAMPLE_TASK_NAMES.has(t.name));
  const taskIds = new Set(tasks.map((t) => t.id));
  const steps = doc.steps.filter((s) => !taskIds.has(s.taskId) && !EXAMPLE_STEP_TEXTS.has(s.text));
  const deps = doc.deps.filter((d) => !goalIds.has(d.goalId) && !goalIds.has(d.dependsOnGoalId));
  return {
    ...doc,
    goals: doc.goals.filter((g) => !goalIds.has(g.id)),
    tasks, steps, deps,
  };
}
