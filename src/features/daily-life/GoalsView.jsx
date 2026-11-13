import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Lock, ArrowUp, ArrowDown, Flag, Target, Trash2, ChevronRight, ChevronDown, CalendarDays,
  Clock, X, Repeat, CheckCircle2, MoreHorizontal,
} from 'lucide-react';
import { LpEmpty, LpDateInput } from './LifePlannerUI';
import {
  goalsOfMilestone, goalProgress, goalLocked, depsOfGoal, byId, TYPE_META, milestoneProgress,
  tasksOfGoal, stepsOfTask, toggleStep, deleteStep, deleteTask, updateGoal, updateTask, fmtDate, todayKey, WEEKDAYS,
  goalDisplayNumber, goalAutoDeadline, taskProgress, toggleTaskDone, toggleGoalDone,
} from './lifePlannerStorage';

const pad2 = (n) => String(n).padStart(2, '0');

function fmtDoneAt(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return ''; }
}

function Bar({ pct }) {
  return <span className="pb-bar"><span style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></span>;
}

export default function GoalsView({
  doc, update, onEditGoal, onDeleteGoal, onConfirm,
  activeMilestoneId, setActiveMilestoneId,
  activeGoalId, setActiveGoalId, activeTaskId, setActiveTaskId,
}) {
  const milestones = useMemo(
    () => doc.goals.filter((g) => (g.types || []).includes('milestone')).sort((a, b) => (a.order || 0) - (b.order || 0)),
    [doc.goals],
  );
  const activeMilestone = milestones.find((m) => m.id === activeMilestoneId) || null;
  const mIndex = activeMilestone ? milestones.findIndex((m) => m.id === activeMilestone.id) + 1 : null;
  const activeGoal = activeGoalId ? byId(doc.goals, activeGoalId) : null;
  const activeTask = activeTaskId ? doc.tasks.find((t) => t.id === activeTaskId) : null;
  const today = todayKey();

  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskDraftDate, setTaskDraftDate] = useState('');
  const [taskDraftStartDate, setTaskDraftStartDate] = useState('');
  const [taskDraftWeekdays, setTaskDraftWeekdays] = useState([]);
  const [taskDraftEndDate, setTaskDraftEndDate] = useState('');
  const [activeGoalWarn, setActiveGoalWarn] = useState('');
  useEffect(() => { if (!activeGoalWarn) return undefined; const t = setTimeout(() => setActiveGoalWarn(''), 3200); return () => clearTimeout(t); }, [activeGoalWarn]);
  // Single-open ⋯ menu
  const [openGoalMenuId, setOpenGoalMenuId] = useState(null);
  useEffect(() => { setOpenGoalMenuId(null); }, [activeMilestoneId, activeGoalId]);

  const milestoneGoals = useMemo(() => (activeMilestoneId ? goalsOfMilestone(doc, activeMilestoneId) : []), [doc, activeMilestoneId]);

  // Goals without a milestone are invalid in this flow — purge them so they never linger.
  useEffect(() => {
    const badIds = doc.goals
      .filter((g) => !(g.types || []).includes('milestone') && !g.milestoneId && !g.phaseId)
      .map((g) => g.id);
    if (badIds.length === 0) return undefined;
    const t = setTimeout(() => {
      update((d) => {
        const badSet = new Set(badIds);
        const taskIds = new Set(d.tasks.filter((x) => badSet.has(x.goalId)).map((x) => x.id));
        return {
          ...d,
          goals: d.goals.filter((g) => !badSet.has(g.id)),
          tasks: d.tasks.filter((x) => !badSet.has(x.goalId)),
          steps: d.steps.filter((s) => !taskIds.has(s.taskId)),
          deps: d.deps.filter((e) => !badSet.has(e.goalId) && !badSet.has(e.dependsOnGoalId)),
        };
      });
    }, 0);
    return () => clearTimeout(t);
  }, [doc.goals, update]);

  const goHome = () => { setActiveMilestoneId(null); setActiveGoalId?.(null); setActiveTaskId?.(null); };
  const goMilestone = () => { setActiveGoalId?.(null); setActiveTaskId?.(null); };

  const lockedMessage = (prefix) => {
    const depNames = depsOfGoal(doc, activeGoal.id).map((d) => byId(doc.goals, d.dependsOnGoalId)?.title).filter(Boolean).join(', ');
    return depNames ? `${prefix} — prerequisite not done: ${depNames}` : `${prefix} — prerequisite goal not finished`;
  };

  return (
    <div className="pb-stack">
      {/* ── Breadcrumb ── */}
      {activeMilestone && (
        <nav className="pb-crumbs" aria-label="Planner path">
          <button type="button" className="pb-crumb" onClick={goHome}>Milestones</button>
          <ChevronRight size={13} className="pb-crumb-sep" aria-hidden="true" />
          <button type="button" className={`pb-crumb${!activeGoal ? ' is-current' : ''}`} onClick={goMilestone} title={activeMilestone.title}>
            Milestone {mIndex}
          </button>
          {activeGoal && (
            <>
              <ChevronRight size={13} className="pb-crumb-sep" aria-hidden="true" />
              <button type="button" className={`pb-crumb${!activeTask ? ' is-current' : ''}`} onClick={() => setActiveTaskId?.(null)} title={activeGoal.title}>
                Goal {goalDisplayNumber(doc, activeGoal)}
              </button>
            </>
          )}
          {activeTask && (
            <>
              <ChevronRight size={13} className="pb-crumb-sep" aria-hidden="true" />
              <span className="pb-crumb is-current is-static" title={activeTask.name}>{activeTask.name}</span>
            </>
          )}
        </nav>
      )}

      {/* ══════════ Level 0 — all milestones ══════════ */}
      {!activeMilestoneId && (
        <section className="pb-card">
          <header className="pb-head">
            <h3 className="pb-title">Milestones</h3>
            {milestones.length > 0 && <span className="pb-count">{milestones.length}</span>}
            <span className="pb-meta pb-head-hint">Tap a milestone to see its goals</span>
          </header>
          {milestones.length === 0 ? (
            <LpEmpty icon={Flag} title="No milestones yet" hint="Use Add Milestone above to create your first one." />
          ) : (
            <div className="pb-list">
              {milestones.map((m, idx) => (
                <MilestoneRow key={m.id} doc={doc} m={m} idx={idx} update={update} onOpen={() => setActiveMilestoneId(m.id)} onDeleteGoal={onDeleteGoal} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ══════════ Level 1 — goals of a milestone ══════════ */}
      {activeMilestone && !activeGoalId && (() => {
        const pct = milestoneProgress(doc, activeMilestone.id);
        const overdue = activeMilestone.timingDate && activeMilestone.timingDate < today && pct < 100;
        return (
          <>
            <section className="pb-card pb-context" data-milestone-id={activeMilestone.id}>
              <div className="pb-context-top">
                <span className="pb-label"><Flag size={11} /> Milestone {pad2(mIndex)}</span>
                {activeMilestone.timingDate && (
                  <span className={`pb-chip${overdue ? ' is-alert' : ''}`}><CalendarDays size={11} /> {overdue ? 'Overdue · ' : ''}{fmtDate(activeMilestone.timingDate)}</span>
                )}
              </div>
              <h2 className="pb-context-title">{activeMilestone.title}</h2>
              <div className="pb-context-progress">
                <Bar pct={pct} />
                <strong>{pct}%</strong>
                <span className="pb-meta">{milestoneGoals.length} goal{milestoneGoals.length === 1 ? '' : 's'}</span>
              </div>
            </section>

            <section className={`pb-card${openGoalMenuId ? ' is-menu-open' : ''}`}>
              <header className="pb-head">
                <h3 className="pb-title">Goals</h3>
                {milestoneGoals.length > 0 && <span className="pb-count">{milestoneGoals.length}</span>}
              </header>
              {milestoneGoals.length === 0 ? (
                <LpEmpty icon={Target} title="No goals yet" hint="Use Add Goal above to add a goal inside this milestone." />
              ) : (
                <div className="pb-list">
                  {milestoneGoals.map((g, idx) => (
                    <GoalRow
                      key={g.id}
                      doc={doc}
                      update={update}
                      goal={g}
                      onEditGoal={onEditGoal}
                      onDeleteGoal={onDeleteGoal}
                      onMove={(id, dir) => {
                        update((d) => {
                          const goal = byId(d.goals, id);
                          if (!goal) return d;
                          const siblings = goalsOfMilestone(d, goal.milestoneId).sort((a, b) => a.order - b.order);
                          const i = siblings.findIndex((x) => x.id === id);
                          const swap = dir === 'up' ? siblings[i - 1] : siblings[i + 1];
                          if (!swap) return d;
                          return { ...d, goals: d.goals.map((x) => (x.id === goal.id ? { ...x, order: swap.order } : x.id === swap.id ? { ...x, order: goal.order } : x)) };
                        });
                      }}
                      canMoveUp={idx > 0}
                      canMoveDown={idx < milestoneGoals.length - 1}
                      onOpen={() => { setActiveGoalId(g.id); setActiveTaskId?.(null); }}
                      isMenuOpen={openGoalMenuId === g.id}
                      onToggleMenu={() => setOpenGoalMenuId((prev) => (prev === g.id ? null : g.id))}
                      onCloseMenu={() => setOpenGoalMenuId(null)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        );
      })()}

      {/* ══════════ Level 2 — tasks of a goal ══════════ */}
      {activeGoal && (() => {
        const pct = goalProgress(doc, activeGoal.id);
        const autoDl = goalAutoDeadline(doc, activeGoal.id);
        const overdue = autoDl && autoDl < today && pct < 100;
        const locked = goalLocked(doc, activeGoal.id);
        const tasks = tasksOfGoal(doc, activeGoal.id);
        return (
          <>
            <section className="pb-card pb-context" data-goal-id={activeGoal.id}>
              <div className="pb-context-top">
                <span className="pb-label">
                  {mIndex ? <>Milestone {pad2(mIndex)} <span className="pb-label-sep">/</span> </> : null}
                  <Target size={11} /> Goal G{goalDisplayNumber(doc, activeGoal)}
                </span>
                {autoDl ? (
                  <span className={`pb-chip${overdue ? ' is-alert' : ''}`} title="Auto from tasks’ last end date"><Clock size={11} /> {fmtDate(autoDl)}</span>
                ) : (
                  <span className="pb-chip is-dashed"><CalendarDays size={11} /> No deadline</span>
                )}
              </div>
              <h2 className="pb-context-title">{activeGoal.title}</h2>
              <div className="pb-context-progress">
                <Bar pct={pct} />
                <strong>{pct}%</strong>
                <span className="pb-meta">{tasks.length} task{tasks.length === 1 ? '' : 's'}</span>
              </div>
              {locked && <div className="pb-note is-alert"><Lock size={12} /> Locked — complete the prerequisite goal first</div>}
            </section>

            <section className="pb-card">
              <header className="pb-head">
                <h3 className="pb-title">Tasks</h3>
                {tasks.length > 0 && <span className="pb-count">{tasks.length}</span>}
              </header>
              {activeGoalWarn && <div className="pb-note is-alert" role="alert"><Lock size={12} /> {activeGoalWarn}</div>}
              {tasks.length === 0 ? (
                <LpEmpty icon={Target} title="No tasks yet" hint="Use Add Task above to add the first task for this goal." />
              ) : (
                <div className="pb-list">
                  {tasks.map((task) => {
                    const steps = stepsOfTask(doc, task.id);
                    const done = steps.filter((s) => s.isDone).length;
                    const tPct = taskProgress(doc, task.id);
                    const isOpen = activeTaskId === task.id;
                    const taskOverdue = task.dueDate && task.dueDate < today && tPct < 100;
                    const isEditing = editingTaskId === task.id;
                    const recurring = !!task.isRecurring;
                    const openEditor = (e) => {
                      e.stopPropagation();
                      if (recurring) {
                        setTaskDraftWeekdays(task.recurringWeekdays || []);
                        setTaskDraftEndDate(task.recurringEndDate || task.recurringUntil || '');
                        setTaskDraftStartDate(task.recurringStartDate || task.startDate || '');
                      } else {
                        setTaskDraftDate(task.dueDate || '');
                        setTaskDraftStartDate(task.startDate || '');
                      }
                      setEditingTaskId(task.id);
                    };
                    return (
                      <div key={task.id} className={`pb-task${isOpen ? ' is-open' : ''}${tPct === 100 ? ' is-done' : ''}`} data-task-id={task.id}>
                        <div className="pb-task-row">
                          {steps.length === 0 ? (
                            <input
                              type="checkbox"
                              className="lp-check pb-check"
                              checked={!!task.manualDone}
                              onChange={() => {
                                if (!task.manualDone && locked) { setActiveGoalWarn(lockedMessage('Cannot complete')); return; }
                                update((d) => toggleTaskDone(d, task.id));
                              }}
                              aria-label={`Mark task ${task.name} ${task.manualDone ? 'not done' : 'done'}`}
                              title={locked && !task.manualDone ? 'Locked — complete prerequisite first' : task.manualDone && task.doneAt ? `Completed on ${fmtDoneAt(task.doneAt)} — click to undo` : task.manualDone ? 'Mark not done' : 'Mark done'}
                            />
                          ) : (
                            <span className="pb-ring" style={{ '--pct': tPct }} aria-hidden="true" />
                          )}

                          <button type="button" className="pb-task-main" onClick={() => setActiveTaskId(isOpen ? null : task.id)} aria-expanded={isOpen}>
                            <span className="pb-task-name">{task.name}</span>
                            <span className="pb-task-meta">
                              {steps.length > 0 ? `${done}/${steps.length} steps` : 'No steps'}
                              <span className="pb-dot" aria-hidden="true" />
                              {tPct}%
                            </span>
                          </button>

                          <div className="pb-task-side">
                            {!isEditing && (recurring ? (
                              <button type="button" className="pb-chip is-accent" onClick={openEditor} title="Edit recurrence">
                                <Repeat size={11} /> {(task.recurringWeekdays || []).join(', ') || 'Recurring'}
                                {task.recurringEndDate ? ` → ${fmtDate(task.recurringEndDate)}` : ''}
                              </button>
                            ) : (task.dueDate || task.startDate) ? (
                              <button type="button" className={`pb-chip${taskOverdue ? ' is-alert' : ''}`} onClick={openEditor} title="Edit date">
                                <CalendarDays size={11} />
                                {task.startDate && task.dueDate && task.startDate !== task.dueDate ? `${fmtDate(task.startDate)} → ${fmtDate(task.dueDate)}` : fmtDate(task.dueDate || task.startDate)}
                              </button>
                            ) : (
                              <button type="button" className="pb-chip is-dashed" onClick={openEditor}><CalendarDays size={11} /> Add date</button>
                            ))}
                            <button
                              type="button"
                              className="pb-icon is-danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                onConfirm({
                                  title: 'Delete task?',
                                  message: `"${task.name}" and its ${steps.length} step${steps.length === 1 ? '' : 's'} will be permanently removed.`,
                                  confirmLabel: 'Delete',
                                  onConfirm: () => {
                                    update((d) => deleteTask(d, task.id));
                                    if (activeTaskId === task.id) setActiveTaskId(null);
                                    onConfirm(null);
                                  },
                                });
                              }}
                              title={`Delete task ${task.name}`}
                              aria-label={`Delete task ${task.name}`}
                            >
                              <Trash2 size={14} />
                            </button>
                            <ChevronDown size={16} className="pb-task-caret" aria-hidden="true" />
                          </div>
                        </div>

                        {steps.length === 0 && task.manualDone && task.doneAt && (
                          <div className="pb-task-done"><CheckCircle2 size={12} /> Completed on {fmtDoneAt(task.doneAt)}</div>
                        )}

                        {isEditing && (recurring ? (
                          <div className="pb-task-panel">
                            <span className="pb-label"><Repeat size={11} /> Recurring — weekdays, start → end</span>
                            <div className="pb-days">
                              {WEEKDAYS.map((w) => {
                                const on = taskDraftWeekdays.includes(w.key);
                                return (
                                  <button key={w.key} type="button" className={`pb-day${on ? ' is-on' : ''}`} aria-pressed={on}
                                    onClick={() => setTaskDraftWeekdays((prev) => (on ? prev.filter((x) => x !== w.key) : [...prev, w.key]))}>
                                    {w.label}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="pb-panel-row">
                              <label className="pb-field"><span>Start *</span><LpDateInput value={taskDraftStartDate} onChange={setTaskDraftStartDate} title="Recurring start date (required)" required /></label>
                              <label className="pb-field"><span>End *</span><LpDateInput value={taskDraftEndDate} onChange={setTaskDraftEndDate} title="Recurring end date (required)" required /></label>
                            </div>
                            <div className="pb-panel-row is-end">
                              <span className="pb-meta">{taskDraftWeekdays.length} din • {taskDraftWeekdays.join(', ')} {taskDraftStartDate ? `${fmtDate(taskDraftStartDate)} → ` : ''}{taskDraftEndDate ? fmtDate(taskDraftEndDate) : 'start & end must'}</span>
                              <span className="pb-btns">
                                <button type="button" className="btn btn-primary btn-sm" disabled={taskDraftWeekdays.length === 0 || !taskDraftStartDate || !taskDraftEndDate}
                                  onClick={() => { update((d) => updateTask(d, task.id, { recurringWeekdays: taskDraftWeekdays, recurringDaysPerWeek: taskDraftWeekdays.length, recurringStartDate: taskDraftStartDate || null, startDate: taskDraftStartDate || null, recurringEndDate: taskDraftEndDate, recurringUntil: taskDraftEndDate, dueLabel: `${fmtDate(taskDraftStartDate)} → ${fmtDate(taskDraftEndDate)} • ${taskDraftWeekdays.length}/week` })); setEditingTaskId(null); }}>
                                  Save
                                </button>
                                <button type="button" className="btn btn-ghost btn-sm"
                                  onClick={() => { update((d) => updateTask(d, task.id, { isRecurring: false, recurringWeekdays: [], recurringDaysPerWeek: null, recurringEndDate: null, recurringUntil: null, recurringStartDate: null })); setEditingTaskId(null); }}>
                                  Remove recurring
                                </button>
                                <button type="button" className="pb-icon" onClick={() => setEditingTaskId(null)} aria-label="Close"><X size={14} /></button>
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="pb-task-panel is-inline">
                            <label className="pb-field is-row"><span>End date</span><LpDateInput value={taskDraftDate} onChange={setTaskDraftDate} required title="End date" /></label>
                            <span className="pb-btns">
                              <button type="button" className="btn btn-primary btn-sm" disabled={!taskDraftDate}
                                onClick={() => { update((d) => updateTask(d, task.id, { startDate: null, dueDate: taskDraftDate || null, dueLabel: fmtDate(taskDraftDate) })); setEditingTaskId(null); }}>
                                Save
                              </button>
                              <button type="button" className="btn btn-ghost btn-sm"
                                onClick={() => { update((d) => updateTask(d, task.id, { startDate: null, dueDate: null, dueLabel: '' })); setTaskDraftDate(''); setTaskDraftStartDate(''); setEditingTaskId(null); }}>
                                Clear
                              </button>
                              <button type="button" className="pb-icon" onClick={() => setEditingTaskId(null)} aria-label="Close"><X size={14} /></button>
                            </span>
                          </div>
                        ))}

                        {isOpen && (
                          <div className="pb-steps">
                            {steps.length === 0 ? (
                              <p className="pb-empty-line">No steps yet — use <strong>Add Step</strong> above.</p>
                            ) : steps.map((s) => (
                              <div key={s.id} className={`pb-step${s.isDone ? ' is-done' : ''}`} data-step-id={s.id}>
                                <input
                                  type="checkbox"
                                  className="lp-step-check pb-check"
                                  checked={s.isDone}
                                  onChange={() => {
                                    if (!s.isDone && locked) { setActiveGoalWarn(lockedMessage('Cannot complete step')); return; }
                                    update((d) => toggleStep(d, s.id));
                                  }}
                                  title={locked && !s.isDone ? 'Locked — complete prerequisite first' : s.isDone && s.doneAt ? `Completed on ${fmtDoneAt(s.doneAt)}` : s.isDone ? 'Completed' : 'Mark done'}
                                />
                                <span className="pb-step-body">
                                  <span className="pb-step-text">{s.text}</span>
                                  {(s.isDone && s.doneAt) || task.isRecurring || s.dueDate ? (
                                    <span className="pb-step-meta">
                                      {s.dueDate && !task.isRecurring && <span className={s.dueDate < today && !s.isDone ? 'is-alert' : ''}>{fmtDate(s.dueDate)}</span>}
                                      {task.isRecurring && <span title={`Auto recurring — same as task: ${(task.recurringWeekdays || []).join(', ')}`}><Repeat size={10} /> Auto</span>}
                                      {s.isDone && s.doneAt && <span className="is-done"><CheckCircle2 size={10} /> {fmtDoneAt(s.doneAt)}</span>}
                                    </span>
                                  ) : null}
                                </span>
                                <button type="button" className="pb-icon is-danger" onClick={() => update((d) => deleteStep(d, s.id))} aria-label={`Delete step ${s.text}`}>
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        );
      })()}
    </div>
  );
}

// ── Milestone row (list) — open, inline deadline edit, delete ────────────────

function MilestoneRow({ doc, m, idx, update, onOpen, onDeleteGoal }) {
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [draft, setDraft] = useState(m.timingDate || '');
  const pct = milestoneProgress(doc, m.id);
  const goalCount = goalsOfMilestone(doc, m.id).length;
  const isOverdue = m.timingDate && m.timingDate < todayKey() && pct < 100;
  const save = () => {
    update((d) => updateGoal(d, m.id, { timingDate: draft || null, timingLabel: draft ? fmtDate(draft) : null }));
    setEditingDeadline(false);
  };

  return (
    <div className={`pb-mile${pct === 100 ? ' is-done' : ''}`} data-milestone-id={m.id}>
      <div
        className="pb-mile-main"
        role="button"
        tabIndex={0}
        onClick={() => !editingDeadline && onOpen()}
        onKeyDown={(e) => { if (e.key === 'Enter' && !editingDeadline) onOpen(); }}
        title={`Milestone ${idx + 1} : ${m.title} — open goals`}
      >
        <span className="pb-index">{pad2(idx + 1)}</span>
        <span className="pb-mile-body">
          <span className="pb-mile-title">{m.title}</span>
          <span className="pb-mile-meta">
            <Bar pct={pct} />
            <span className="pb-pct">{pct}%</span>
            <span className="pb-dot" aria-hidden="true" />
            <span>{goalCount} goal{goalCount === 1 ? '' : 's'}</span>
          </span>
        </span>
      </div>

      <div className="pb-mile-side">
        {!editingDeadline ? (
          m.timingDate ? (
            <button type="button" className={`pb-chip${isOverdue ? ' is-alert' : ''}`} onClick={() => { setDraft(m.timingDate || ''); setEditingDeadline(true); }} title="Edit deadline">
              <CalendarDays size={11} /> {isOverdue ? 'Overdue · ' : ''}{fmtDate(m.timingDate)}
            </button>
          ) : (
            <button type="button" className="pb-chip is-dashed" onClick={() => { setDraft(''); setEditingDeadline(true); }}>
              <CalendarDays size={11} /> Add deadline
            </button>
          )
        ) : (
          <span className="pb-inline-edit">
            <LpDateInput value={draft} onChange={setDraft} autoFocus />
            <button type="button" className="btn btn-primary btn-sm" onClick={save}>OK</button>
            {m.timingDate && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { update((d) => updateGoal(d, m.id, { timingDate: null, timingLabel: null })); setDraft(''); setEditingDeadline(false); }}>Clear</button>
            )}
            <button type="button" className="pb-icon" onClick={() => setEditingDeadline(false)} aria-label="Cancel"><X size={14} /></button>
          </span>
        )}
        <button type="button" className="pb-icon is-danger" onClick={(e) => { e.stopPropagation(); onDeleteGoal(m); }} title={`Delete milestone ${m.title}`} aria-label={`Delete milestone ${m.title}`}>
          <Trash2 size={14} />
        </button>
        <button type="button" className="pb-icon pb-mile-go" onClick={onOpen} aria-label={`Open milestone ${m.title}`}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Goal row — check, reorder, open, ⋯ menu ─────────────────────────────────

function GoalRow({
  doc, update, goal, onEditGoal, onDeleteGoal,
  onMove, canMoveUp, canMoveDown, onOpen,
  isMenuOpen = false, onToggleMenu, onCloseMenu,
}) {
  const pct = goalProgress(doc, goal.id);
  const locked = goalLocked(doc, goal.id);
  const deps = depsOfGoal(doc, goal.id);
  const depNames = deps.map((d) => byId(doc.goals, d.dependsOnGoalId)?.title).filter(Boolean).join(', ');
  const autoDeadline = goalAutoDeadline(doc, goal.id);
  const isOverdue = autoDeadline && autoDeadline < todayKey() && pct < 100;
  const hasTasks = tasksOfGoal(doc, goal.id).length > 0;
  const menuRef = useRef(null);
  const btnRef = useRef(null);
  const [lockWarn, setLockWarn] = useState('');

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const handleDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      onCloseMenu?.();
    };
    const handleEsc = (e) => { if (e.key === 'Escape') onCloseMenu?.(); };
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isMenuOpen, onCloseMenu]);

  useEffect(() => {
    if (!lockWarn) return undefined;
    const t = setTimeout(() => setLockWarn(''), 3200);
    return () => clearTimeout(t);
  }, [lockWarn]);

  const handleGoalCheck = (e) => {
    e.stopPropagation();
    if (pct !== 100) {
      if (locked) { setLockWarn(depNames ? `Complete prerequisite first: ${depNames}` : 'Complete prerequisite goal first'); return; }
      if (hasTasks) { setLockWarn('Complete all tasks to finish this goal'); return; }
    }
    update((d) => toggleGoalDone(d, goal.id));
  };

  return (
    <div className={`pb-goal${isMenuOpen ? ' is-menu-open' : ''}${pct === 100 ? ' is-done' : ''}${locked && pct !== 100 ? ' is-locked' : ''}`} data-goal-id={goal.id}>
      <div className="pb-goal-row">
        <input
          type="checkbox"
          className="lp-check lp-goal-check pb-check"
          checked={pct === 100}
          onChange={handleGoalCheck}
          aria-label={`Mark goal ${goal.title} ${pct === 100 ? 'not done' : 'done'}`}
          title={locked && pct !== 100 ? `Locked — waiting on ${depNames}` : hasTasks && pct !== 100 ? 'Complete tasks to check goal' : pct === 100 ? 'Mark not done' : 'Mark done'}
        />

        <div
          className="pb-goal-main"
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
        >
          <span className="pb-goal-title">
            <span className="pb-goal-num">G{goalDisplayNumber(doc, goal)}</span>
            <span className="pb-goal-text">{goal.title}</span>
            {locked && <Lock size={12} className="pb-lock" aria-label={`Locked — waiting on ${depNames}`} />}
          </span>
          <span className="pb-goal-meta">
            <Bar pct={pct} />
            <span className="pb-pct">{pct}%</span>
            {(goal.types || []).filter((t) => t !== 'goal').map((t) => (
              <span key={t} className="pb-tag">{TYPE_META[t]?.label || t}</span>
            ))}
            {goal.costLabel && <span className="pb-tag">{goal.costLabel}</span>}
            {deps.length > 0 && !locked && <span className="pb-tag">Depends on {deps.length}</span>}
          </span>
        </div>

        <div className="pb-goal-side">
          {autoDeadline ? (
            <span className={`pb-chip${isOverdue ? ' is-alert' : ''}`} title="Auto from tasks’ last end date"><Clock size={11} /> {fmtDate(autoDeadline)}</span>
          ) : (
            <span className="pb-chip is-dashed" title="Add tasks with end dates to get an auto deadline"><CalendarDays size={11} /> No deadline</span>
          )}
          {(canMoveUp || canMoveDown) && (
            <span className="pb-move">
              <button type="button" className="pb-icon is-sm" disabled={!canMoveUp} onClick={() => onMove(goal.id, 'up')} aria-label="Move goal up"><ArrowUp size={12} /></button>
              <button type="button" className="pb-icon is-sm" disabled={!canMoveDown} onClick={() => onMove(goal.id, 'down')} aria-label="Move goal down"><ArrowDown size={12} /></button>
            </span>
          )}
          <span className="pb-menu-anchor">
            <button ref={btnRef} type="button" className="pb-icon" onClick={(e) => { e.stopPropagation(); onToggleMenu?.(); }} aria-label={`Options for ${goal.title}`} aria-haspopup="true" aria-expanded={isMenuOpen}>
              <MoreHorizontal size={16} />
            </button>
            {isMenuOpen && (
              <div ref={menuRef} className="pb-menu" role="menu" onClick={() => onCloseMenu?.()}>
                <button type="button" className="pb-menu-item" role="menuitem" onClick={() => onEditGoal(goal)}>Edit goal</button>
                <button type="button" className="pb-menu-item is-danger" role="menuitem" onClick={() => onDeleteGoal(goal)}>Delete goal</button>
              </div>
            )}
          </span>
        </div>
      </div>
      {lockWarn && <div className="pb-note is-alert" role="alert"><Lock size={12} /> {lockWarn}</div>}
    </div>
  );
}
