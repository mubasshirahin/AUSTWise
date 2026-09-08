import { useState, useMemo } from 'react';
import { Plus, Search, ChevronDown, ChevronUp, Lock, ArrowUp, ArrowDown, FolderPlus, Flag, CheckCircle2, Folder, FolderOpen, ArrowLeft, ChevronRight, Sparkles, Target, Trash2, ListChecks } from 'lucide-react';
import { LpEmpty, LpBar } from './LifePlannerUI';
import {
  goalsOfPhase, goalProgress, goalLocked, depsOfGoal, byId, TYPE_META,
  nextOrder, uid, createGoal, phaseProgress, tasksOfGoal, stepsOfTask, toggleStep, deleteStep,
} from './lifePlannerStorage';

export default function GoalsView({
  doc, update, onOpenGoal, onNewGoal, onEditGoal, onDeleteGoal, onConfirm,
  activeMilestoneId, setActiveMilestoneId, activePhaseId, setActivePhaseId,
  activeGoalId, setActiveGoalId, activeTaskId, setActiveTaskId,
}) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState([]);
  const [sortBy, setSortBy] = useState('phase');
  const [collapsed, setCollapsed] = useState({});
  const [showPhaseForm, setShowPhaseForm] = useState(false);
  const [newPhase, setNewPhase] = useState({ title: '', subtitle: '' });
  const [newGoalTitle, setNewGoalTitle] = useState('');

  const hasMilestone = useMemo(() => doc.goals.some((g) => (g.types || []).includes('milestone')), [doc.goals]);

  const q = query.trim().toLowerCase();

  const matches = (g) => {
    if (q && !g.title.toLowerCase().includes(q)) return false;
    if (typeFilter.length && !typeFilter.some((t) => g.types.includes(t))) return false;
    return true;
  };

  const sortGoals = (list) => {
    const copy = [...list];
    if (sortBy === 'alpha') return copy.sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === 'due') {
      return copy.sort((a, b) => (a.timingDate || '9999').localeCompare(b.timingDate || '9999'));
    }
    return copy.sort((a, b) => a.order - b.order);
  };

  const visiblePhases = useMemo(
    () => [...doc.phases].sort((a, b) => a.order - b.order),
    [doc.phases]
  );

  const milestones = useMemo(() => doc.goals.filter((g) => (g.types || []).includes('milestone')), [doc.goals]);

  const activeMilestone = useMemo(() => milestones.find((m) => m.id === activeMilestoneId) || null, [milestones, activeMilestoneId]);
  const milestonePhases = useMemo(() => {
    if (!activeMilestoneId) return [];
    return visiblePhases.filter((p) => p.milestoneId === activeMilestoneId);
  }, [visiblePhases, activeMilestoneId]);

  const unphased = sortGoals(doc.goals.filter((g) => !g.phaseId).filter(matches));
  const anyVisible = visiblePhases.some((p) => goalsOfPhase(doc, p.id).some(matches)) || unphased.length > 0;

  const toggleType = (t) =>
    setTypeFilter((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const toggleCollapse = (phaseId) =>
    setCollapsed((prev) => ({ ...prev, [phaseId]: !prev[phaseId] }));

  const moveGoal = (goalId, dir) => {
    update((d) => {
      const goal = byId(d.goals, goalId);
      if (!goal) return d;
      const siblings = d.goals
        .filter((g) => g.phaseId === goal.phaseId)
        .sort((a, b) => a.order - b.order);
      const idx = siblings.findIndex((g) => g.id === goalId);
      const swapWith = dir === 'up' ? siblings[idx - 1] : siblings[idx + 1];
      if (!swapWith) return d;
      const goals = d.goals.map((g) => {
        if (g.id === goal.id) return { ...g, order: swapWith.order };
        if (g.id === swapWith.id) return { ...g, order: goal.order };
        return g;
      });
      return { ...d, goals };
    });
  };

  const moveGoalToPhase = (goalId, phaseId) => {
    update((d) => {
      const goals = d.goals.map((g) => (g.id === goalId
        ? { ...g, phaseId, order: nextOrder(d.goals.filter((x) => x.phaseId === phaseId)) }
        : g));
      return { ...d, goals };
    });
  };

  const addPhaseInline = () => {
    if (!activeMilestoneId) return;
    const title = newPhase.title.trim() || `Phase ${milestonePhases.length + 1}`;
    update((d) => ({
      ...d,
      phases: [...d.phases, {
        id: uid(), title,
        subtitle: newPhase.subtitle.trim() || null,
        color: ['var(--accent-amber)', 'var(--accent-emerald)', 'var(--accent-cyan)', 'var(--accent-purple)'][d.phases.length % 4],
        order: nextOrder(d.phases.filter((p) => p.milestoneId === activeMilestoneId)),
        milestoneId: activeMilestoneId,
      }],
    }));
    setNewPhase({ title: '', subtitle: '' });
    setShowPhaseForm(false);
  };

  const handleAddGoalInline = () => {
    if (!newGoalTitle.trim() || !activePhaseId) return;
    update((d) => createGoal(d, {
      phaseId: activePhaseId,
      title: newGoalTitle.trim(),
      types: ['goal'],
      costLabel: null,
      timingLabel: null,
      timingDate: null,
      definitionOfDone: null,
      dependsOn: [],
      tasks: [],
    }));
    setNewGoalTitle('');
  };

  const removePhase = (phase) => {
    onConfirm({
      title: 'Remove phase?',
      message: `"${phase.title}" will be removed. Its goals are kept and become unphased.`,
      confirmLabel: 'Remove phase',
      onConfirm: () => {
        update((d) => ({
          ...d,
          phases: d.phases.filter((p) => p.id !== phase.id),
          goals: d.goals.map((g) => (g.phaseId === phase.id ? { ...g, phaseId: null } : g)),
        }));
        onConfirm(null);
      },
    });
  };

  const activePhase = activePhaseId ? doc.phases.find((p) => p.id === activePhaseId) : null;
  const activeGoal = activeGoalId ? byId(doc.goals, activeGoalId) : null;
  const activeTask = activeTaskId ? doc.tasks.find((t) => t.id === activeTaskId) : null;

  return (
    <div>
      {/* ── Premium breadcrumb — clickable, hierarchy visible ── */}
      {(activeMilestoneId || activePhaseId || activeGoalId || activeTaskId) && (
        <div className="lp-breadcrumb">
          <button type="button" className="lp-breadcrumb-item" onClick={() => { setActiveMilestoneId(null); setActivePhaseId(null); if (setActiveGoalId) setActiveGoalId(null); if (setActiveTaskId) setActiveTaskId(null); }} style={{ cursor: 'pointer' }}><Flag size={10} /> Milestones</button>
          {activeMilestone && (
            <>
              <ChevronRight size={12} className="lp-breadcrumb-sep" />
              <button
                type="button"
                className="lp-breadcrumb-item purple active"
                onClick={() => { setActivePhaseId(null); if (setActiveGoalId) setActiveGoalId(null); if (setActiveTaskId) setActiveTaskId(null); }}
                style={{ cursor: 'pointer' }}
                title="Go to milestone phases"
              >
                <Flag size={10} /> Milestone {milestones.findIndex((m) => m.id === activeMilestone.id) + 1} : {activeMilestone.title}
              </button>
            </>
          )}
          {activePhase && (
            <>
              <ChevronRight size={12} className="lp-breadcrumb-sep" />
              <button
                type="button"
                className="lp-breadcrumb-item active"
                onClick={() => { if (setActiveGoalId) setActiveGoalId(null); if (setActiveTaskId) setActiveTaskId(null); }}
                style={{ cursor: 'pointer' }}
                title="Go to phase goals"
              >
                <Folder size={10} /> Phase {milestonePhases.findIndex((p) => p.id === activePhaseId) + 1} : {activePhase.title}
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

      {/* Milestones — blank page even when no milestone: always show panel */}
      {!activeMilestoneId && (
        <div className="lp-panel">
          <h4 className="lp-panel-title"><Flag size={15} style={{ color: 'var(--accent-purple)' }} /> Milestones</h4>
          {hasMilestone ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {milestones.map((m, idx) => {
                const pct = goalProgress(doc, m.id);
                return (
                  <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                    <button
                      type="button"
                      onClick={() => setActiveMilestoneId(m.id)}
                      title={`Milestone ${idx + 1} : ${m.title} — click to see phases`}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 10,
                        flex: 1, padding: '16px 16px', textAlign: 'left',
                        background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)',
                        cursor: 'pointer', transition: 'all var(--transition-base)',
                      }}
                    >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--accent-purple)', fontSize: 'var(--fs-md)', fontWeight: 700, lineHeight: 1.3 }}>
                    <Flag size={18} style={{ flexShrink: 0 }} /> <span style={{ flex: 1, wordBreak: 'break-word', color: 'var(--text-primary)' }}>Milestone {idx + 1} : {m.title}</span>
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Click to open phases</span>
                    </button>
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
              })}
            </div>
          ) : (
            <LpEmpty icon={Flag} title="No milestones yet" hint="Click Add Milestone at the top to create your first milestone." />
          )}
        </div>
      )}
      {/* Milestone er bhitore — phase ashbe, phase add er option — merged single box (milestone + phases ekshathe) */}
      {activeMilestoneId && !activeGoalId && (
        <div className="lp-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Folder size={20} style={{ color: 'var(--accent-purple)', flexShrink: 0 }} />
            <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, wordBreak: 'break-word' }}>Milestone {activeMilestone ? milestones.findIndex((m) => m.id === activeMilestone.id) + 1 : ''} : {activeMilestone?.title}</h3>
          </div>
          {milestonePhases.length === 0 ? (
            <LpEmpty icon={Folder} title="No phases yet" hint="Add a phase inside this milestone to organize goals." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {milestonePhases.map((phase, idx) => {
                const goals = goalsOfPhase(doc, phase.id);
                const isCollapsed = collapsed[phase.id] ?? true;
                return (
                  <div key={phase.id} className="lp-phase-section" style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button type="button" className="lp-phase-header" onClick={() => { setActivePhaseId(phase.id); setCollapsed((p) => ({ ...p, [phase.id]: !isCollapsed })); }} aria-expanded={!isCollapsed} style={{ flex: 1, padding: '14px 16px' }}>
                        <span className="lp-phase-dot" style={{ background: phase.color, width: 12, height: 12, minWidth: 12, minHeight: 12 }} />
                        <span className="lp-phase-header-title" style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>Phase {idx + 1} : {phase.title}</span>
                        {phase.subtitle && <span className="lp-phase-header-sub">{phase.subtitle}</span>}
                        <span className="lp-phase-header-sub">{goals.length} goal{goals.length === 1 ? '' : 's'}</span>
                        {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                      </button>
                      <button type="button" className="lp-icon-btn" onClick={() => removePhase(phase)} aria-label={`Remove phase ${phase.title}`} title="Remove phase">
                        <Trash />
                      </button>
                    </div>
                    
                    {!isCollapsed && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                        {goals.length === 0 ? (
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', padding: '2px 10px' }}>{activePhaseId === phase.id ? 'No goals here yet.' : 'No goals yet.'}</span>
                        ) : (
                          goals.map((g, idx) => (
                            <GoalCard key={g.id} doc={doc} goal={g} phaseColor={phase.color} onOpenGoal={onOpenGoal} onEditGoal={onEditGoal} onDeleteGoal={onDeleteGoal} onMove={(id, dir) => {
                              update((d) => {
                                const goal = byId(d.goals, id);
                                if (!goal) return d;
                                const siblings = d.goals.filter((x) => x.phaseId === goal.phaseId).sort((a,b)=>a.order-b.order);
                                const i = siblings.findIndex((x)=>x.id===id);
                                const swap = dir==='up'?siblings[i-1]:siblings[i+1];
                                if(!swap) return d;
                                return { ...d, goals: d.goals.map((x)=> x.id===goal.id?{...x, order: swap.order}: x.id===swap.id?{...x, order: goal.order}: x) };
                              });
                            }} canMoveUp={idx>0} canMoveDown={idx < goals.length-1} onMoveToPhase={(gid, pid)=> update((d)=> ({...d, goals: d.goals.map((x)=> x.id===gid?{...x, phaseId: pid, order: nextOrder(d.goals.filter((y)=> y.phaseId===pid))}: x)}))} phases={milestonePhases.filter((p)=>p.id!==phase.id)} setActiveGoalId={setActiveGoalId} setActivePhaseId={setActivePhaseId} setActiveTaskId={setActiveTaskId} />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
                  return (
                    <div key={task.id} className="lp-task" style={{ borderColor: isActiveTask ? 'var(--accent-amber)' : undefined }}>
                      <button type="button" className="lp-task-header" onClick={() => setActiveTaskId(isActiveTask ? null : task.id)} aria-expanded={isActiveTask}>
                        <span className="lp-task-name">{task.name}</span>
                        {steps.length > 0 && <span className="lp-badge lp-badge-muted">{done}/{steps.length}</span>}
                        <span className="lp-badge" style={{ background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>{pct}%</span>
                      </button>
                      {isActiveTask && (
                        <div className="lp-task-body">
                          {steps.length === 0 ? <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>No subtasks yet.</span> : steps.map((s) => (
                            <div key={s.id} className="lp-step-row">
                              <input type="checkbox" className="lp-step-check" checked={s.isDone} onChange={() => update((d) => toggleStep(d, s.id))} />
                              <span className={`lp-step-text${s.isDone ? ' done' : ''}`}>{s.text}</span>
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

function Trash() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

// ── Goal card ────────────────────────────────────────────────────────────────

function GoalCard({
  doc, goal, phaseColor, onOpenGoal, onEditGoal, onDeleteGoal,
  onMove, canMoveUp, canMoveDown, onMoveToPhase, phases,
  setActiveGoalId, setActivePhaseId, setActiveTaskId,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const pct = goalProgress(doc, goal.id);
  const locked = goalLocked(doc, goal.id);
  const deps = depsOfGoal(doc, goal.id);

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

      <button type="button" className="lp-goal-card" onClick={() => { if (setActiveGoalId) { if (setActivePhaseId && goal.phaseId) setActivePhaseId(goal.phaseId); setActiveGoalId(goal.id); if (setActiveTaskId) setActiveTaskId(null); } else onOpenGoal(goal.id); }} style={{ borderLeft: `3px solid ${phaseColor}`, cursor: 'pointer' }}>
        <div className="lp-goal-main">
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
            {(goal.timingLabel || goal.timingDate) && (
              <span className="lp-badge lp-badge-cyan">{goal.timingLabel || goal.timingDate}</span>
            )}
          </div>
          
        </div>
      </button>

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
            <button type="button" className="export-menu-item" onClick={() => setMoveOpen((v) => !v)}>Move to phase…</button>
            {moveOpen && phases.map((p) => (
              <button key={p.id} type="button" className="export-menu-item" style={{ paddingLeft: 22 }} onClick={() => onMoveToPhase(goal.id, p.id)}>
                ↳ {p.title}
              </button>
            ))}
            <div className="export-menu-sep" />
            <button type="button" className="export-menu-item" style={{ color: 'var(--accent-rose)' }} onClick={() => onDeleteGoal(goal)}>Delete goal</button>
          </div>
        )}
      </div>
    </div>
  );
}
