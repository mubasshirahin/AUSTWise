import { useState } from 'react';
import {
  ArrowLeft, ChevronDown, ChevronUp, Plus, Trash2, Lock, Unlock,
  ChevronRight, StickyNote,
} from 'lucide-react';
import { LpBar, LpEmpty, LpConfirm, useConfirmState } from './LifePlannerUI';
import {
  tasksOfGoal, stepsOfTask, depsOfGoal, unlocksWithGoal, byId, goalProgress,
  goalLocked, TYPE_META, toggleStep, addTask, addStep, deleteTask, deleteStep,
  updateStep, fmtDate, todayKey,
} from './lifePlannerStorage';

/**
 * Goal Detail (Section 5.3): header band colored by the parent phase,
 * depends-on / unlocks chips, locked banner, Definition of Done, tasks
 * with steps. Step toggles are optimistic (state updates immediately via
 * the live store, which persists in the background).
 */
export default function GoalDetail({
  doc, update, goalId, onBack, onOpenGoal, onEditGoal, onDeleteGoal, onConfirm,
}) {
  const goal = byId(doc.goals, goalId);
  // Phase removed — accent now from milestone (purple) or amber fallback
  const accent = (() => {
    if (!goal) return 'var(--accent-amber)';
    if (goal.milestoneId) return 'var(--accent-purple)';
    if (goal.phaseId) {
      const ph = doc.phases.find((p) => p.id === goal.phaseId);
      return ph?.color || 'var(--accent-amber)';
    }
    return (goal.types || []).includes('milestone') ? 'var(--accent-purple)' : 'var(--accent-amber)';
  })();
  const [expanded, setExpanded] = useState({});
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ name: '', costLabel: '', dueLabel: '', dueDate: '' });
  const [stepDrafts, setStepDrafts] = useState({});
  const [noteFor, setNoteFor] = useState(null);

  if (!goal) {
    return (
      <div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}><ArrowLeft size={13} /> Back</button>
        <LpEmpty title="Goal not found" hint="It may have been deleted on another device." />
      </div>
    );
  }

  const pct = goalProgress(doc, goal.id);
  const locked = goalLocked(doc, goal.id);
  const deps = depsOfGoal(doc, goal.id);
  const unlocks = unlocksWithGoal(doc, goal.id);
  const tasks = tasksOfGoal(doc, goal.id);

  const blocking = deps
    .map((d) => ({ dep: d, goalDep: byId(doc.goals, d.dependsOnGoalId) }))
    .filter((x) => x.goalDep && goalProgress(doc, x.goalDep.id) < 100);

  const toggleTask = (taskId) => setExpanded((prev) => ({ ...prev, [taskId]: !prev[taskId] }));

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTask.name.trim()) return;
    update((d) => addTask(d, goal.id, newTask));
    setNewTask({ name: '', costLabel: '', dueLabel: '', dueDate: '' });
    setShowAddTask(false);
  };

  const handleAddStep = (taskId) => {
    const draft = stepDrafts[taskId];
    if (!draft?.text?.trim()) return;
    update((d) => addStep(d, taskId, draft));
    setStepDrafts((prev) => ({ ...prev, [taskId]: { text: '', dueDate: '', note: '' } }));
  };

  const askDeleteTask = (task) => {
    onConfirm({
      title: 'Delete task?',
      message: `"${task.name}" and its steps will be removed.`,
      onConfirm: () => { update((d) => deleteTask(d, task.id)); onConfirm(null); },
    });
  };

  const askDeleteGoal = () => {
    onDeleteGoal(goal);
  };

  const handleToggleStep = (stepId) => {
    // Optimistic: the live store updates local state immediately and
    // persists to the server in the background.
    update((d) => toggleStep(d, stepId));
  };

  return (
    <div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 10 }}>
        <ArrowLeft size={13} /> All goals
      </button>

      {/* Header band */}
      <div className="lp-detail-band" style={{ '--lp-accent': accent }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div className="lp-detail-title">
            <span className="lp-detail-number">Goal {goal.number}</span>
            <span className="lp-detail-name">{goal.title}</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEditGoal(goal)}>Edit</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={askDeleteGoal}>Delete</button>
          </div>
        </div>

        <div className="lp-goal-meta">
          {goal.types.map((t) => (
            <span key={t} className={`lp-badge ${TYPE_META[t].badge}`}>{TYPE_META[t].label}</span>
          ))}
          {goal.costLabel && <span className="lp-badge lp-badge-muted">{goal.costLabel}</span>}
          {(goal.timingLabel || goal.timingDate) && (
            <span className="lp-badge lp-badge-cyan">{goal.timingLabel || goal.timingDate}</span>
          )}
          <span className="lp-badge lp-badge-muted">{pct}% done</span>
        </div>

        <div style={{ marginTop: 10 }}>
          <LpBar pct={pct} color={accent} />
        </div>

        {locked && (
          <div className="lp-lock-banner" role="status">
            <Lock size={14} />
            <span>
              Waiting on: {blocking.map((b) => `Goal ${b.goalDep.number} — ${b.goalDep.title}`).join('; ')}
            </span>
          </div>
        )}

        {/* Depends on / Unlocks */}
        {(deps.length > 0 || unlocks.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
            {deps.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', minWidth: 70 }}>
                  <Unlock size={11} style={{ verticalAlign: '-1px' }} /> Depends on
                </span>
                {deps.map((d) => {
                  const g = byId(doc.goals, d.dependsOnGoalId);
                  if (!g) return null;
                  const donePct = goalProgress(doc, g.id);
                  return (
                    <button key={d.id} type="button" className={`lp-dep-chip${donePct === 100 ? ' done' : donePct < 100 ? ' blocked' : ''}`} onClick={() => onOpenGoal(g.id)}>
                      {donePct === 100 ? '✓' : <Lock size={10} />} G{g.number} {g.title}
                    </button>
                  );
                })}
              </div>
            )}
            {unlocks.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', minWidth: 70 }}>
                  <ChevronRight size={11} style={{ verticalAlign: '-1px' }} /> Unlocks
                </span>
                {unlocks.map((d) => {
                  const g = byId(doc.goals, d.goalId);
                  if (!g) return null;
                  return (
                    <button key={d.id} type="button" className="lp-dep-chip" onClick={() => onOpenGoal(g.id)}>
                      G{g.number} {g.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Definition of Done */}
      {goal.definitionOfDone && (
        <div className="lp-panel">
          <h4 className="lp-panel-title">✅ Definition of Done</h4>
          <div className="lp-detail-block">{goal.definitionOfDone}</div>
        </div>
      )}

      {/* Tasks */}
      <div className="lp-panel">
        <h4 className="lp-panel-title">Tasks ({tasks.length})</h4>
        {tasks.length === 0 && (
          <LpEmpty title="No tasks yet" hint="Break the goal into tasks, then steps under each task." />
        )}

        {tasks.map((task) => {
          const steps = stepsOfTask(doc, task.id);
          const isOpen = expanded[task.id] !== false; // default open
          const doneCount = steps.filter((s) => s.isDone).length;
          return (
            <div key={task.id} className="lp-task">
              <button type="button" className="lp-task-header" onClick={() => toggleTask(task.id)} aria-expanded={isOpen}>
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span className="lp-task-name">{task.name}</span>
                {steps.length > 0 && (
                  <span className="lp-badge lp-badge-muted">{doneCount}/{steps.length}</span>
                )}
                {task.costLabel && <span className="lp-badge lp-badge-amber">{task.costLabel}</span>}
                {(task.dueLabel || task.dueDate) && (
                  <span className={`lp-step-due${task.dueDate && task.dueDate < todayKey() ? ' overdue' : ''}`}>
                    {task.dueLabel || fmtDate(task.dueDate)}
                  </span>
                )}
                <span
                  role="button"
                  tabIndex={0}
                  className="lp-icon-btn"
                  aria-label={`Delete task ${task.name}`}
                  onClick={(e) => { e.stopPropagation(); askDeleteTask(task); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); askDeleteTask(task); } }}
                >
                  <Trash2 size={12} />
                </span>
              </button>

              {isOpen && (
                <div className="lp-task-body">
                  {steps.length === 0 && (
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>No steps yet.</span>
                  )}
                  {steps.map((step) => {
                    const overdue = step.dueDate && !step.isDone && step.dueDate < todayKey();
                    return (
                      <div key={step.id} className="lp-step-row">
                        <input
                          type="checkbox"
                          className="lp-step-check"
                          checked={step.isDone}
                          onChange={() => handleToggleStep(step.id)}
                          aria-label={`Mark "${step.text}" ${step.isDone ? 'not done' : 'done'}`}
                        />
                        <span className={`lp-step-text${step.isDone ? ' done' : ''}`}>
                          {step.text}
                          {step.note && (
                            <span style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                              <StickyNote size={10} style={{ verticalAlign: '-1px' }} /> {step.note}
                            </span>
                          )}
                        </span>
                        {step.dueDate && (
                          <span className={`lp-step-due${overdue ? ' overdue' : ''}`}>
                            {overdue ? 'Overdue · ' : ''}{fmtDate(step.dueDate)}
                          </span>
                        )}
                        <button
                          type="button"
                          className="lp-icon-btn"
                          onClick={() => setNoteFor(noteFor === step.id ? null : step.id)}
                          aria-label={`Edit note for ${step.text}`}
                        >
                          <StickyNote size={12} />
                        </button>
                        <button
                          type="button"
                          className="lp-icon-btn"
                          onClick={() => update((d) => deleteStep(d, step.id))}
                          aria-label={`Delete step ${step.text}`}
                        >
                          <Trash2 size={12} />
                        </button>

                        {noteFor === step.id && (
                          <div style={{ flexBasis: '100%' }}>
                            <textarea
                              className="input"
                              rows={2}
                              value={step.note || ''}
                              placeholder="Add a note…"
                              onChange={(e) => update((d) => updateStep(d, step.id, { note: e.target.value || null }))}
                              style={{ fontSize: 'var(--fs-xs)', resize: 'vertical' }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add step */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <input
                      className="input"
                      value={stepDrafts[task.id]?.text || ''}
                      onChange={(e) => setStepDrafts((prev) => ({ ...prev, [task.id]: { ...(prev[task.id] || { dueDate: '', note: '' }), text: e.target.value } }))}
                      placeholder="Add a step…"
                      style={{ flex: 1, minWidth: 140 }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddStep(task.id); } }}
                    />
                    <input
                      type="date"
                      className="input"
                      value={stepDrafts[task.id]?.dueDate || ''}
                      onChange={(e) => setStepDrafts((prev) => ({ ...prev, [task.id]: { ...(prev[task.id] || { text: '', note: '' }), dueDate: e.target.value } }))}
                      style={{ maxWidth: 135 }}
                      aria-label="Step due date"
                    />
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleAddStep(task.id)}>
                      <Plus size={12} /> Step
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add task form */}
        {showAddTask ? (
          <form onSubmit={handleAddTask} className="lp-form-block" style={{ marginTop: 10 }}>
            <div className="lp-form-row">
              <input className="input" value={newTask.name} onChange={(e) => setNewTask((t) => ({ ...t, name: e.target.value }))} placeholder="Task name" autoFocus />
            </div>
            <div className="lp-form-row">
              <input className="input" value={newTask.costLabel} onChange={(e) => setNewTask((t) => ({ ...t, costLabel: e.target.value }))} placeholder="Cost (optional)" />
              <input className="input" value={newTask.dueLabel} onChange={(e) => setNewTask((t) => ({ ...t, dueLabel: e.target.value }))} placeholder="Due label (optional)" />
              <input type="date" className="input" value={newTask.dueDate} onChange={(e) => setNewTask((t) => ({ ...t, dueDate: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary btn-sm">Add task</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddTask(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <button type="button" className="lp-add-btn" style={{ marginTop: 10 }} onClick={() => setShowAddTask(true)}>
            <Plus size={14} /> Add Task
          </button>
        )}
      </div>
    </div>
  );
}
