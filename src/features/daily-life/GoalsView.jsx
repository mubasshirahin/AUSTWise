import { useState, useMemo } from 'react';
import { Lock, ArrowUp, ArrowDown, Flag, Target, Trash2, ListChecks, ChevronRight, CalendarDays, Clock, X, Repeat, RefreshCw } from 'lucide-react';
import { LpEmpty } from './LifePlannerUI';
import {
  goalsOfMilestone, goalProgress, goalLocked, depsOfGoal, byId, TYPE_META,
  tasksOfGoal, stepsOfTask, toggleStep, deleteStep, updateGoal, updateTask, fmtDate, todayKey, WEEKDAYS, isTaskRecurring,
} from './lifePlannerStorage';

export default function GoalsView({
  doc, update, onOpenGoal, onEditGoal, onDeleteGoal, onConfirm,
  activeMilestoneId, setActiveMilestoneId,
  activeGoalId, setActiveGoalId, activeTaskId, setActiveTaskId,
}) {
  const milestones = useMemo(() => doc.goals.filter((g) => (g.types || []).includes('milestone')), [doc.goals]);
  const activeMilestone = useMemo(() => milestones.find((m) => m.id === activeMilestoneId) || null, [milestones, activeMilestoneId]);
  const activeGoal = activeGoalId ? byId(doc.goals, activeGoalId) : null;
  const activeTask = activeTaskId ? doc.tasks.find((t) => t.id === activeTaskId) : null;
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskDraftDate, setTaskDraftDate] = useState('');
  const [taskDraftWeekdays, setTaskDraftWeekdays] = useState([]);

  const hasMilestone = milestones.length > 0;

  const milestoneGoals = useMemo(() => {
    if (!activeMilestoneId) return [];
    return goalsOfMilestone(doc, activeMilestoneId);
  }, [doc, activeMilestoneId]);

  return (
    <div>
      {/* ── Breadcrumb — Milestone → Goal → Task (Phase removed) ── */}
      {(activeMilestoneId || activeGoalId || activeTaskId) && (
        <div className="lp-breadcrumb">
          <button type="button" className="lp-breadcrumb-item" onClick={() => { setActiveMilestoneId(null); if (setActiveGoalId) setActiveGoalId(null); if (setActiveTaskId) setActiveTaskId(null); }} style={{ cursor: 'pointer' }}><Flag size={10} /> Milestones</button>
          {activeMilestone && (
            <>
              <ChevronRight size={12} className="lp-breadcrumb-sep" />
              <button
                type="button"
                className="lp-breadcrumb-item purple active"
                onClick={() => { if (setActiveGoalId) setActiveGoalId(null); if (setActiveTaskId) setActiveTaskId(null); }}
                style={{ cursor: 'pointer' }}
                title="Go to milestone goals"
              >
                <Flag size={10} /> Milestone {milestones.findIndex((m) => m.id === activeMilestone.id) + 1} : {activeMilestone.title}
              </button>
            </>
          )}
          {activeGoal && (
            <>
              <ChevronRight size={12} className="lp-breadcrumb-sep" />
              <button
                type="button"
                className="lp-breadcrumb-item active"
                onClick={() => { if (setActiveTaskId) setActiveTaskId(null); }}
                style={{ cursor: 'pointer', background: 'var(--accent-amber-glow)', borderColor: 'var(--accent-amber)', color: 'var(--accent-amber)' }}
                title="Go to goal tasks"
              >
                <Target size={10} /> G{activeGoal.number} : {activeGoal.title}
              </button>
            </>
          )}
          {activeTask && (
            <>
              <ChevronRight size={12} className="lp-breadcrumb-sep" />
              <span className="lp-breadcrumb-item active" style={{ cursor: 'default', background: 'var(--accent-emerald-glow)', borderColor: 'var(--accent-emerald)', color: 'var(--accent-emerald)' }}><ListChecks size={10} /> {activeTask.name}</span>
            </>
          )}
        </div>
      )}

      {/* Milestones list — when no milestone selected */}
      {!activeMilestoneId && (
        <div className="lp-panel">
          <h4 className="lp-panel-title"><Flag size={15} style={{ color: 'var(--accent-purple)' }} /> Milestones</h4>
          {hasMilestone ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {milestones.map((m, idx) => (
                <MilestoneCard key={m.id} doc={doc} m={m} idx={idx} update={update} setActiveMilestoneId={setActiveMilestoneId} onDeleteGoal={onDeleteGoal} />
              ))}
            </div>
          ) : (
            <LpEmpty icon={Flag} title="No milestones yet" hint="Click Add Milestone at the top to create your first milestone." />
          )}
        </div>
      )}

      {/* Milestone → Goals (direct, no Phase) */}
      {activeMilestoneId && !activeGoalId && (
        <div className="lp-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Flag size={20} style={{ color: 'var(--accent-purple)', flexShrink: 0 }} />
            <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, wordBreak: 'break-word' }}>Milestone {activeMilestone ? milestones.findIndex((m) => m.id === activeMilestone.id) + 1 : ''} : {activeMilestone?.title}</h3>
          </div>
          {milestoneGoals.length === 0 ? (
            <LpEmpty icon={Target} title="No goals yet" hint="Add a goal inside this milestone — click Add Goal at the top." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {milestoneGoals.map((g, idx) => (
                <GoalCard
                  key={g.id}
                  doc={doc}
                  update={update}
                  goal={g}
                  phaseColor="var(--accent-purple)"
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
                      return { ...d, goals: d.goals.map((x) => x.id === goal.id ? { ...x, order: swap.order } : x.id === swap.id ? { ...x, order: goal.order } : x) };
                    });
                  }}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < milestoneGoals.length - 1}
                  setActiveGoalId={setActiveGoalId}
                  setActiveTaskId={setActiveTaskId}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeGoalId && (
        <div className="lp-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Target size={16} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
            <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, wordBreak: 'break-word' }}>Goal {activeGoal?.number} : {activeGoal?.title}</h3>
          </div>
          {(() => {
            const tasks = tasksOfGoal(doc, activeGoalId);
            if (tasks.length === 0) return <LpEmpty icon={Target} title="No tasks yet" hint="Add a task for this goal — click Add Task at the top." />;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tasks.map((task) => {
                  const steps = stepsOfTask(doc, task.id);
                  const done = steps.filter((s) => s.isDone).length;
                  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
                    const isActiveTask = activeTaskId === task.id;
                    const taskOverdue = task.dueDate && task.dueDate < todayKey() && pct < 100;
                    const isEditingThisTask = editingTaskId === task.id;
                    const taskIsRecurring = !!task.isRecurring;
                    return (
                    <div key={task.id} className="lp-task" style={{ borderColor: isActiveTask ? 'var(--accent-amber)' : undefined, borderLeft: taskIsRecurring ? '2px solid var(--accent-amber)' : undefined }}>
                      <button type="button" className="lp-task-header" onClick={() => setActiveTaskId(isActiveTask ? null : task.id)} aria-expanded={isActiveTask}>
                        <span className="lp-task-name">{task.name}</span>
                        {steps.length > 0 && <span className="lp-badge lp-badge-muted">{done}/{steps.length}</span>}
                        <span className="lp-badge" style={{ background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>{pct}%</span>
                        {taskIsRecurring && !isEditingThisTask && (
                          <span className="lp-badge lp-badge-amber" style={{ gap: 4, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setTaskDraftWeekdays(task.recurringWeekdays || []); setEditingTaskId(task.id); }}>
                            <Repeat size={10} /> Recurring {task.recurringWeekdays?.length || 0}/week • {(task.recurringWeekdays || []).join(', ')}
                          </span>
                        )}
                        {!taskIsRecurring && task.dueDate && !isEditingThisTask && <span className={`lp-badge ${taskOverdue ? 'lp-badge-rose' : 'lp-badge-cyan'}`} onClick={(e) => { e.stopPropagation(); setTaskDraftDate(task.dueDate); setEditingTaskId(task.id); }}><CalendarDays size={10} /> {fmtDate(task.dueDate)}</span>}
                        {!taskIsRecurring && !task.dueDate && !isEditingThisTask && <span className="lp-badge lp-badge-muted" style={{ borderStyle: 'dashed', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setTaskDraftDate(''); setEditingTaskId(task.id); }}><CalendarDays size={10} /> Add deadline</span>}
                      </button>
                      {isEditingThisTask && (
                        taskIsRecurring ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 16px', borderBottom: '1px dashed var(--border-primary)', background: 'var(--bg-tertiary)' }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}><Repeat size={12} /> Recurring — week e koidin • kon kon din</span>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {WEEKDAYS.map((w) => {
                                const on = taskDraftWeekdays.includes(w.key);
                                return <button key={w.key} type="button" className={`lp-badge ${on ? 'lp-badge-amber' : 'lp-badge-muted'}`} style={{ cursor: 'pointer', borderStyle: on ? 'solid' : 'dashed' }} onClick={() => setTaskDraftWeekdays((prev) => on ? prev.filter((x) => x !== w.key) : [...prev, w.key])}>{w.label}</button>;
                              })}
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{taskDraftWeekdays.length} din selected</span>
                              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                                <button type="button" className="btn btn-primary btn-sm" style={{ height: 30 }} disabled={taskDraftWeekdays.length===0} onClick={() => { update((d) => updateTask(d, task.id, { recurringWeekdays: taskDraftWeekdays, recurringDaysPerWeek: taskDraftWeekdays.length })); setEditingTaskId(null); }}>Save</button>
                                <button type="button" className="btn btn-ghost btn-sm" style={{ height: 30 }} onClick={() => { update((d) => updateTask(d, task.id, { isRecurring: false, recurringWeekdays: [], recurringDaysPerWeek: null })); setEditingTaskId(null); }}>Remove recurring</button>
                                <button type="button" className="lp-icon-btn" onClick={() => setEditingTaskId(null)}><X size={12} /></button>
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, padding: '8px 16px', alignItems: 'center', borderBottom: '1px dashed var(--border-primary)', background: 'var(--bg-tertiary)' }}>
                            <input type="date" value={taskDraftDate} onChange={(e) => setTaskDraftDate(e.target.value)} className="input" style={{ height: 30, maxWidth: 150 }} />
                            <button type="button" className="btn btn-primary btn-sm" style={{ height: 30 }} onClick={() => { update((d) => updateTask(d, task.id, { dueDate: taskDraftDate || null, dueLabel: taskDraftDate ? fmtDate(taskDraftDate) : '' })); setEditingTaskId(null); }}>Save</button>
                            <button type="button" className="btn btn-ghost btn-sm" style={{ height: 30 }} onClick={() => { update((d) => updateTask(d, task.id, { dueDate: null, dueLabel: '' })); setTaskDraftDate(''); setEditingTaskId(null); }}>Clear</button>
                            <button type="button" className="lp-icon-btn" onClick={() => setEditingTaskId(null)}><X size={12} /></button>
                          </div>
                        )
                      )}
                      {isActiveTask && (
                        <div className="lp-task-body">
                          {steps.length === 0 ? <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>No subtasks yet.</span> : steps.map((s) => (
                            <div key={s.id} className="lp-step-row">
                              <input type="checkbox" className="lp-step-check" checked={s.isDone} onChange={() => update((d) => toggleStep(d, s.id))} />
                              <span className={`lp-step-text${s.isDone ? ' done' : ''}`}>{s.text}</span>
                              {task.isRecurring && <span className="lp-badge lp-badge-amber" style={{ fontSize: 9, padding: '2px 6px', gap: 3 }} title={`Auto recurring — same as task: ${(task.recurringWeekdays||[]).join(', ')}`}><Repeat size={9} /> Auto</span>}
                              <button type="button" className="lp-icon-btn" onClick={() => update((d) => deleteStep(d, s.id))}><Trash2 size={12} /></button>
                            </div>
                          ))}
                          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', padding: '8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Click Add Subtask at the top to add</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── Milestone card with deadline — single delete button ──────────────────

function MilestoneCard({ doc, m, idx, update, setActiveMilestoneId, onDeleteGoal }) {
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [draft, setDraft] = useState(m.timingDate || '');
  const isOverdue = m.timingDate && m.timingDate < todayKey() && goalProgress(doc, m.id) < 100;
  const save = () => {
    update((d) => updateGoal(d, m.id, { timingDate: draft || null, timingLabel: draft ? fmtDate(draft) : null }));
    setEditingDeadline(false);
  };
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          flex: 1, padding: '16px 16px', textAlign: 'left',
          background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)',
          cursor: 'pointer', transition: 'all var(--transition-base)',
        }}
        onClick={() => !editingDeadline && setActiveMilestoneId(m.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' && !editingDeadline) setActiveMilestoneId(m.id); }}
        title={`Milestone ${idx + 1} : ${m.title} — click to see goals`}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--accent-purple)', fontSize: 'var(--fs-md)', fontWeight: 700, lineHeight: 1.3 }}>
            <Flag size={18} style={{ flexShrink: 0 }} /> <span style={{ flex: 1, wordBreak: 'break-word', color: 'var(--text-primary)' }}>Milestone {idx + 1} : {m.title}</span>
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{goalsOfMilestone(doc, m.id).length} goal{goalsOfMilestone(doc, m.id).length === 1 ? '' : 's'} · Click to open goals</span>
        </div>
        <span style={{ marginLeft: 'auto', alignSelf: 'center', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {!editingDeadline ? (
            m.timingDate ? (
              <button type="button" className={`lp-badge ${isOverdue ? 'lp-badge-rose' : 'lp-badge-cyan'}`} style={{ gap: 4, border: 'none', cursor: 'pointer' }} onClick={() => { setDraft(m.timingDate || ''); setEditingDeadline(true); }}>
                <CalendarDays size={10} /> {isOverdue ? 'Overdue ' : ''}{fmtDate(m.timingDate)}
              </button>
            ) : (
              <button type="button" className="lp-badge lp-badge-muted" style={{ gap: 4, borderStyle: 'dashed', cursor: 'pointer' }} onClick={() => { setDraft(''); setEditingDeadline(true); }}>
                <CalendarDays size={10} /> Add deadline
              </button>
            )
          ) : (
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="date" value={draft} onChange={(e) => setDraft(e.target.value)} style={{ height: 30, borderRadius: 8, maxWidth: 140 }} className="input" autoFocus />
              <button type="button" className="btn btn-primary btn-sm" onClick={save} style={{ height: 30, padding: '0 10px' }}>OK</button>
              {m.timingDate && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { update((d) => updateGoal(d, m.id, { timingDate: null, timingLabel: null })); setDraft(''); setEditingDeadline(false); }} style={{ height: 30 }}>Clear</button>}
              <button type="button" className="lp-icon-btn" onClick={() => setEditingDeadline(false)} style={{ width: 28, height: 28 }}><X size={12} /></button>
            </span>
          )}
        </span>
      </div>
      {/* Single delete button per milestone */}
      <button
        type="button"
        className="lp-icon-btn"
        onClick={(e) => { e.stopPropagation(); onDeleteGoal(m); }}
        title={`Delete milestone ${m.title}`}
        aria-label={`Delete milestone ${m.title}`}
        style={{ alignSelf: 'center', width: 36, height: 36, borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ── Goal card with deadline ────────────────────────────────────────────────

function GoalCard({
  doc, update, goal, phaseColor, onEditGoal, onDeleteGoal,
  onMove, canMoveUp, canMoveDown,
  setActiveGoalId, setActiveTaskId,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [draft, setDraft] = useState(goal.timingDate || '');
  const pct = goalProgress(doc, goal.id);
  const locked = goalLocked(doc, goal.id);
  const deps = depsOfGoal(doc, goal.id);
  const isOverdue = goal.timingDate && goal.timingDate < todayKey() && pct < 100;

  // we need update here — get it from closure via document hack: use window temp ? Instead pass update via prop — but GoalsView already has update in scope for MilestoneCard, for GoalCard we can use doc+update via import? We'll use a direct liveStore update through a custom event: fallback use document.
  // Simpler: GoalsView passes `update` — add it to GoalCard props via GoalsView. For now use direct updateGoal via GoalsView's update in parent — we attach to window as hack, but better add update prop.
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
      {(canMoveUp || canMoveDown) && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
          <button type="button" className="lp-icon-btn" disabled={!canMoveUp} onClick={() => onMove(goal.id, 'up')} aria-label="Move goal up">
            <ArrowUp size={12} />
          </button>
          <button type="button" className="lp-icon-btn" disabled={!canMoveDown} onClick={() => onMove(goal.id, 'down')} aria-label="Move goal down">
            <ArrowDown size={12} />
          </button>
        </div>
      )}

      <div className="lp-goal-card" role="button" tabIndex={0} onClick={() => { if (setActiveGoalId) { setActiveGoalId(goal.id); if (setActiveTaskId) setActiveTaskId(null); } else if (onEditGoal) onEditGoal(goal); }} onKeyDown={(e) => { if (e.key === 'Enter') { if (setActiveGoalId) { setActiveGoalId(goal.id); if (setActiveTaskId) setActiveTaskId(null); } else if (onEditGoal) onEditGoal(goal); } }} style={{ borderLeft: `3px solid ${phaseColor}`, cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="lp-goal-main" style={{ flex: 1, minWidth: 0 }}>
          <span className="lp-goal-title">
            <span style={{ color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 'bold' }}>G{goal.number}</span>
            {goal.title}
            {locked && (
              <span title={`Waiting on: ${deps.map((d) => byId(doc.goals, d.dependsOnGoalId)?.title).filter(Boolean).join(', ')}`}>
                <Lock size={12} style={{ color: 'var(--accent-rose)' }} aria-label="Locked by dependency" />
              </span>
            )}
          </span>
          <div className="lp-goal-meta">
            {goal.types.map((t) => (
              <span key={t} className={`lp-badge ${TYPE_META[t].badge}`}>{TYPE_META[t].label}</span>
            ))}
            {goal.costLabel && <span className="lp-badge lp-badge-muted">{goal.costLabel}</span>}
          </div>
        </div>
        <span style={{ marginLeft: 'auto', alignSelf: 'center', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {!editingDeadline ? (
            (goal.timingLabel || goal.timingDate) ? (
              <button type="button" className={`lp-badge ${isOverdue ? 'lp-badge-rose' : 'lp-badge-cyan'}`} style={{ border: 'none', cursor: 'pointer' }} onClick={() => { setDraft(goal.timingDate || ''); setEditingDeadline(true); }}>
                <Clock size={10} /> {goal.timingLabel || fmtDate(goal.timingDate)}
              </button>
            ) : (
              <button type="button" className="lp-badge lp-badge-muted" style={{ borderStyle: 'dashed', cursor: 'pointer' }} onClick={() => { setDraft(''); setEditingDeadline(true); }}>
                <CalendarDays size={10} /> Add deadline
              </button>
            )
          ) : (
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="date" value={draft} onChange={(e) => setDraft(e.target.value)} style={{ height: 30, maxWidth: 140 }} className="input" autoFocus />
              <button type="button" className="btn btn-primary btn-sm" style={{ height: 30 }} onClick={() => { update((d) => updateGoal(d, goal.id, { timingDate: draft || null, timingLabel: draft ? fmtDate(draft) : null })); setEditingDeadline(false); }}>OK</button>
              {(goal.timingDate || goal.timingLabel) && <button type="button" className="btn btn-ghost btn-sm" style={{ height: 30 }} onClick={() => { update((d) => updateGoal(d, goal.id, { timingDate: null, timingLabel: null })); setDraft(''); setEditingDeadline(false); }}>Clear</button>}
              <button type="button" className="lp-icon-btn" onClick={() => setEditingDeadline(false)} style={{ width: 28, height: 28 }}><X size={12} /></button>
            </span>
          )}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
          <button type="button" className="lp-icon-btn" onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }} aria-label={`Options for ${goal.title}`} aria-haspopup="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" />
            </svg>
          </button>
          {showMenu && (
            <div
              style={{
                position: 'absolute', right: 0, top: 30, zIndex: 60, minWidth: 170, padding: 4,
                background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
              }}
              onClick={() => setShowMenu(false)}
            >
              <button type="button" className="export-menu-item" onClick={() => onEditGoal(goal)}>Edit goal</button>
              <button type="button" className="export-menu-item" onClick={() => { setDraft(goal.timingDate || ''); setEditingDeadline(true); setShowMenu(false); }}><CalendarDays size={12} /> {goal.timingDate ? 'Edit deadline' : 'Add deadline'}</button>
              <div className="export-menu-sep" />
              <button type="button" className="export-menu-item" style={{ color: 'var(--accent-rose)' }} onClick={() => onDeleteGoal(goal)}>Delete goal</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
