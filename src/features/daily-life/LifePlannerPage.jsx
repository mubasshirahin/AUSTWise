import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  CalendarDays, MoreVertical, Target, Flame, Wallet, ListChecks,
  Clock, TrendingUp, FileDown, ChevronRight, Zap, RotateCcw,
  Flag, Folder, Sparkles, FolderPlus,
} from 'lucide-react';
import './LifePlannerPage.css';
import {
  useLifePlanner, EMPTY_DOC, examplePlan, overallProgress, phaseProgress, goalsOfPhase, byId, tasksOfGoal, stepsOfTask, stepsOfGoal,
  buildTimeline, ledgerTotals, fmtMoney, fmtDate, todayKey, daysBetween,
  goalLocked, goalProgress, createGoal, updateGoal, deleteGoal, addPhase, addTask, addStep,
} from './lifePlannerStorage';
import { LpSubnav, LpBar, LpStat, LpEmpty, LpModal, LpConfirm, useConfirmState } from './LifePlannerUI';
import GoalFormModal from './GoalFormModal';
import GoalsView from './GoalsView';
import HabitsView from './HabitsView';
import TimelineView from './TimelineView';
import LedgerView from './LedgerView';
import { exportLifePlannerPDF } from './lifePlannerPDF';

const LP_VIEW_KEY = 'aust-life-planner-view';
const LP_VALID_VIEWS = ['dashboard', 'goals', 'habits', 'timeline', 'ledger'];

function readInitialView() {
  try {
    const params = new URLSearchParams(window.location.search);
    const lp = params.get('lp');
    if (lp && LP_VALID_VIEWS.includes(lp)) return lp;
  } catch {}
  try {
    const saved = localStorage.getItem(LP_VIEW_KEY);
    if (saved && LP_VALID_VIEWS.includes(saved)) return saved;
  } catch {}
  return 'dashboard';
}

export default function LifePlannerPage() {
  const [doc, update] = useLifePlanner();
  const [view, setView] = useState(readInitialView);
  const [activeMilestoneId, setActiveMilestoneId] = useState(() => {
    try { const p = new URLSearchParams(window.location.search).get('milestone'); if (p) return p; return localStorage.getItem('aust-lp-milestone') || null; } catch { return null; }
  });
  const [activePhaseId, setActivePhaseId] = useState(() => {
    try { const p = new URLSearchParams(window.location.search).get('phase'); if (p) return p; return localStorage.getItem('aust-lp-phase') || null; } catch { return null; }
  });
  const [activeGoalId, setActiveGoalId] = useState(() => {
    try { const p = new URLSearchParams(window.location.search).get('goal'); if (p) return p; return localStorage.getItem('aust-lp-goal') || null; } catch { return null; }
  });
  const [activeTaskId, setActiveTaskId] = useState(() => {
    try { const p = new URLSearchParams(window.location.search).get('task'); if (p) return p; return localStorage.getItem('aust-lp-task') || null; } catch { return null; }
  });
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuBtnRef = useRef(null);
  const [confirmState, setConfirmState] = useConfirmState();
  const [exporting, setExporting] = useState(false);
  const [showMilestoneInput, setShowMilestoneInput] = useState(false);
  const [milestoneInput, setMilestoneInput] = useState('');
  const [showPhaseTopInput, setShowPhaseTopInput] = useState(false);
  const [phaseTopInput, setPhaseTopInput] = useState('');
  const [showGoalTopInput, setShowGoalTopInput] = useState(false);
  const [goalTopInput, setGoalTopInput] = useState('');
  const [showTaskTopInput, setShowTaskTopInput] = useState(false);
  const [taskTopInput, setTaskTopInput] = useState('');
  const [showSubtaskTopInput, setShowSubtaskTopInput] = useState(false);
  const [subtaskTopInput, setSubtaskTopInput] = useState('');

  // ── Menu (export / example seed) ──
  useEffect(() => {
    if (!showMenu) return undefined;
    const close = (e) => {
      if (menuBtnRef.current && !menuBtnRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showMenu]);

  const openMenu = () => setShowMenu((v) => !v);

  // Clear stale hierarchy ids
  useEffect(() => {
    if (activeMilestoneId && !doc.goals.some((g) => g.id === activeMilestoneId && (g.types || []).includes('milestone'))) setActiveMilestoneId(null);
  }, [doc.goals, activeMilestoneId]);
  useEffect(() => {
    if (activePhaseId && !doc.phases.some((p) => p.id === activePhaseId)) { setActivePhaseId(null); setActiveTaskId(null); }
  }, [doc.phases, activePhaseId]);
  useEffect(() => {
    if (activeTaskId && !doc.tasks.some((t) => t.id === activeTaskId)) setActiveTaskId(null);
  }, [doc.tasks, activeTaskId]);
  useEffect(() => {
    if (activeMilestoneId && activePhaseId) {
      const ph = doc.phases.find((p) => p.id === activePhaseId);
      if (ph && ph.milestoneId !== activeMilestoneId) { setActivePhaseId(null); setActiveTaskId(null); }
    }
    if (!activeMilestoneId) { setActivePhaseId(null); }
  }, [activeMilestoneId, activePhaseId, doc.phases]);
  useEffect(() => {
    if (activePhaseId && activeGoalId) {
      const g = doc.goals.find((x) => x.id === activeGoalId);
      if (g && g.phaseId !== activePhaseId) { setActiveGoalId(null); setActiveTaskId(null); }
    }
    if (!activePhaseId) { setActiveGoalId(null); }
  }, [activePhaseId, activeGoalId, doc.goals]);
  useEffect(() => {
    if (activeGoalId && activeTaskId) {
      const t = doc.tasks.find((x) => x.id === activeTaskId);
      if (t && t.goalId !== activeGoalId) setActiveTaskId(null);
    }
    if (!activeGoalId) setActiveTaskId(null);
  }, [activeGoalId, activeTaskId, doc.tasks]);

  // ── Persist view + hierarchy across refresh ──
  useEffect(() => {
    try { localStorage.setItem(LP_VIEW_KEY, view); } catch {}
    try {
      const url = new URL(window.location.href);
      if (view === 'dashboard') url.searchParams.delete('lp');
      else url.searchParams.set('lp', view);
      window.history.replaceState({}, '', url);
    } catch {}
  }, [view]);

  useEffect(() => {
    try { if (activeMilestoneId) localStorage.setItem('aust-lp-milestone', activeMilestoneId); else localStorage.removeItem('aust-lp-milestone'); const url = new URL(window.location.href); if (activeMilestoneId) url.searchParams.set('milestone', activeMilestoneId); else url.searchParams.delete('milestone'); window.history.replaceState({}, '', url); } catch {}
  }, [activeMilestoneId]);
  useEffect(() => {
    try { if (activePhaseId) localStorage.setItem('aust-lp-phase', activePhaseId); else localStorage.removeItem('aust-lp-phase'); const url = new URL(window.location.href); if (activePhaseId) url.searchParams.set('phase', activePhaseId); else url.searchParams.delete('phase'); window.history.replaceState({}, '', url); } catch {}
  }, [activePhaseId]);
  useEffect(() => {
    try { if (activeGoalId) localStorage.setItem('aust-lp-goal', activeGoalId); else localStorage.removeItem('aust-lp-goal'); const url = new URL(window.location.href); if (activeGoalId) url.searchParams.set('goal', activeGoalId); else url.searchParams.delete('goal'); window.history.replaceState({}, '', url); } catch {}
  }, [activeGoalId]);
  useEffect(() => {
    try { if (activeTaskId) localStorage.setItem('aust-lp-task', activeTaskId); else localStorage.removeItem('aust-lp-task'); const url = new URL(window.location.href); if (activeTaskId) url.searchParams.set('task', activeTaskId); else url.searchParams.delete('task'); window.history.replaceState({}, '', url); } catch {}
  }, [activeTaskId]);

  const openNewGoal = () => { setEditingGoal(null); setShowGoalForm(true); };
  const openEditGoal = (g) => { setEditingGoal(g); setShowGoalForm(true); };

  const loadExample = () => {
    setConfirmState({
      title: 'Load example plan?',
      message: 'This replaces your current planner content with a small generic example (phases, goals, habits, ledger). Your existing planner data will be overwritten.',
      confirmLabel: 'Load example',
      onConfirm: () => { update(examplePlan()); setConfirmState(null); setView('dashboard'); },
    });
  };

  const handleReset = () => {
    setShowMenu(false);
    setConfirmState({
      title: 'Reset planner?',
      message: 'This will permanently delete all phases, goals, tasks, steps, habits and ledger entries. Your planner will be empty. This cannot be undone.',
      confirmLabel: 'Reset',
      onConfirm: () => {
        update({ ...EMPTY_DOC, habitLogs: {} });
        setConfirmState(null);
        setView('dashboard');
        setActiveMilestoneId(null);
        setActivePhaseId(null);
        setActiveTaskId(null);
      },
    });
  };

  const handleAddMilestoneTop = () => {
    if (!milestoneInput.trim()) return;
    let newId = null;
    update((d) => {
      const next = createGoal(d, {
        phaseId: null,
        title: milestoneInput.trim(),
        types: ['milestone'],
        costLabel: null,
        timingLabel: null,
        timingDate: null,
        definitionOfDone: null,
        dependsOn: [],
        tasks: [],
      });
      const created = next.goals.find((g) => !d.goals.some((x) => x.id === g.id));
      if (created) newId = created.id;
      return next;
    });
    setMilestoneInput('');
    setShowMilestoneInput(false);
    setView('goals');
    if (newId) setActiveMilestoneId(newId);
  };

  const handleAddPhaseTop = () => {
    if (!phaseTopInput.trim() || !activeMilestoneId) return;
    const title = phaseTopInput.trim();
    let newPhaseId = null;
    update((d) => {
      const next = addPhase(d, { title, subtitle: null, milestoneId: activeMilestoneId });
      const created = next.phases.find((p) => !d.phases.some((x) => x.id === p.id));
      if (created) newPhaseId = created.id;
      return next;
    });
    setPhaseTopInput('');
    setShowPhaseTopInput(false);
    if (newPhaseId) setActivePhaseId(newPhaseId);
  };

  const handleAddGoalTop = () => {
    if (!goalTopInput.trim() || !activePhaseId) return;
    let newGoalId = null;
    update((d) => {
      const next = createGoal(d, {
        phaseId: activePhaseId,
        title: goalTopInput.trim(),
        types: ['goal'],
        costLabel: null,
        timingLabel: null,
        timingDate: null,
        definitionOfDone: null,
        dependsOn: [],
        tasks: [],
      });
      const created = next.goals.find((g) => !d.goals.some((x) => x.id === g.id));
      if (created) newGoalId = created.id;
      return next;
    });
    setGoalTopInput('');
    setShowGoalTopInput(false);
    if (newGoalId) setActiveGoalId(newGoalId);
  };

  const handleAddTaskTop = () => {
    if (!taskTopInput.trim() || !activeGoalId) return;
    let newTaskId = null;
    update((d) => {
      const next = addTask(d, activeGoalId, { name: taskTopInput.trim(), costLabel: '', dueLabel: '', dueDate: '' });
      const created = next.tasks.find((t) => !d.tasks.some((x) => x.id === t.id));
      if (created) newTaskId = created.id;
      return next;
    });
    setTaskTopInput('');
    setShowTaskTopInput(false);
    if (newTaskId) setActiveTaskId(newTaskId);
  };

  const handleAddSubtaskTop = () => {
    if (!subtaskTopInput.trim() || !activeTaskId) return;
    update((d) => addStep(d, activeTaskId, { text: subtaskTopInput.trim(), dueLabel: '', dueDate: '', note: '' }));
    setSubtaskTopInput('');
    setShowSubtaskTopInput(false);
  };

  // ── Dashboard aggregates ──
  const progress = useMemo(() => overallProgress(doc), [doc]);
  const totals = useMemo(() => ledgerTotals(doc), [doc]);
  const timeline = useMemo(() => buildTimeline(doc), [doc]);
  const activeHabits = doc.habits.filter((h) => !h.archived);

  const today = todayKey();
  const upcoming = useMemo(() => {
    const open = timeline.filter((e) => !(e.kind === 'step' && e.done));
    const overdue = open.filter((e) => e.date < today);
    const future = open.filter((e) => e.date >= today);
    return { overdue, next: future.slice(0, 3) };
  }, [timeline, today]);

  const nextDeadline = upcoming.next[0] || null;
  const daysLeft = nextDeadline ? daysBetween(new Date(), nextDeadline.date) : null;

  const hasAnything = doc.goals.length > 0 || doc.habits.length > 0 || doc.ledger.length > 0;
  const hasGoals = doc.goals.length > 0;

  const handleExportPDF = async () => {
    setShowMenu(false);
    setExporting(true);
    try {
      await exportLifePlannerPDF(doc);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteGoal = (g) => {
    setConfirmState({
      title: 'Delete goal?',
      message: `"${g.title}" and all of its tasks, steps and dependency links will be removed. This cannot be undone.`,
      onConfirm: () => {
        update((d) => deleteGoal(d, g.id));
        setConfirmState(null);
      },
    });
  };

  // ── Shared props for goal-related views ──
  const goalFlow = {
    doc,
    update,
    onNewGoal: openNewGoal,
    onEditGoal: openEditGoal,
    onDeleteGoal: handleDeleteGoal,
    onConfirm: setConfirmState,
  };

  return (
    <div className="glass-card-static schedule-widget lp-widget animate-fadeInUp">

      {/* ── Masthead (tool's own header) ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <CalendarDays size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Daily Life</span>
            <p className="schedule-title">Life Planner</p>
            <span className="schedule-subtitle">Goals, habits &amp; week plan</span>
          </div>
        </div>

        <div className="schedule-masthead-center" />

        <div className="schedule-actions">
          <div className="export-dropdown" ref={menuBtnRef}>
            <button
              type="button"
              className="schedule-nav-btn"
              onClick={openMenu}
              title="Options"
              aria-haspopup="true"
              aria-expanded={showMenu}
            >
              <MoreVertical size={18} />
            </button>
            {showMenu && (
              <div className="export-menu" role="menu">
                <button type="button" className="export-menu-item" role="menuitem" onClick={handleExportPDF} disabled={exporting}>
                  <FileDown size={14} /> {exporting ? 'Rendering…' : 'Export PDF'}
                </button>
                <button type="button" className="export-menu-item" role="menuitem" onClick={() => { setShowMenu(false); loadExample(); }}>
                  <Zap size={14} /> Load example plan
                </button>
                <div className="export-menu-sep" />
                <button type="button" className="export-menu-item" role="menuitem" style={{ color: 'var(--accent-rose)' }} onClick={handleReset}>
                  <RotateCcw size={14} /> Reset planner
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {/* ── Sub-navigation + Add Milestone/Phase/Goal (top bar) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <LpSubnav view={view} onChange={(v) => setView(v)} />
        </div>
        {view === 'goals' && !activeMilestoneId && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowMilestoneInput((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Flag size={14} /> Add Milestone
          </button>
        )}
        {view === 'goals' && activeMilestoneId && !activePhaseId && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowPhaseTopInput((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <FolderPlus size={14} /> Add Phase
          </button>
        )}
        {view === 'goals' && activePhaseId && !activeGoalId && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowGoalTopInput((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Target size={14} /> Add Goal
          </button>
        )}
        {view === 'goals' && activeGoalId && !activeTaskId && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowTaskTopInput((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <ListChecks size={14} /> Add Task
          </button>
        )}
        {view === 'goals' && activeTaskId && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowSubtaskTopInput((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <ListChecks size={14} /> Add Subtask
          </button>
        )}
      </div>
      {view === 'goals' && !activeMilestoneId && showMilestoneInput && (
        <div className="lp-panel" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, padding: '12px 14px' }}>
          <Flag size={14} style={{ color: 'var(--accent-purple)', flexShrink: 0 }} />
          <input
            className="input"
            value={milestoneInput}
            onChange={(e) => setMilestoneInput(e.target.value)}
            placeholder="Milestone name"
            style={{ flex: 1, height: 36 }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddMilestoneTop(); }}
            autoFocus
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={handleAddMilestoneTop} style={{ height: 36, padding: '0 14px' }}>Add</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowMilestoneInput(false); setMilestoneInput(''); }} style={{ height: 36 }}>Cancel</button>
        </div>
      )}
      {view === 'goals' && activeMilestoneId && !activePhaseId && showPhaseTopInput && (
        <div className="lp-panel" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, padding: '12px 14px' }}>
          <Folder size={14} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
          <input
            className="input"
            value={phaseTopInput}
            onChange={(e) => setPhaseTopInput(e.target.value)}
            placeholder="Phase title"
            style={{ flex: 1, height: 36 }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddPhaseTop(); }}
            autoFocus
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={handleAddPhaseTop} style={{ height: 36, padding: '0 14px' }}>Add</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowPhaseTopInput(false); setPhaseTopInput(''); }} style={{ height: 36 }}>Cancel</button>
        </div>
      )}
      {view === 'goals' && activePhaseId && !activeGoalId && showGoalTopInput && (
        <div className="lp-panel" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, padding: '12px 14px' }}>
          <Target size={14} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
          <input
            className="input"
            value={goalTopInput}
            onChange={(e) => setGoalTopInput(e.target.value)}
            placeholder="Goal title"
            style={{ flex: 1, height: 36 }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddGoalTop(); }}
            autoFocus
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={handleAddGoalTop} style={{ height: 36, padding: '0 14px' }}>Add</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowGoalTopInput(false); setGoalTopInput(''); }} style={{ height: 36 }}>Cancel</button>
        </div>
      )}
      {view === 'goals' && activeGoalId && !activeTaskId && showTaskTopInput && (
        <div className="lp-panel" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, padding: '12px 14px' }}>
          <ListChecks size={14} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
          <input
            className="input"
            value={taskTopInput}
            onChange={(e) => setTaskTopInput(e.target.value)}
            placeholder="Task title"
            style={{ flex: 1, height: 36 }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddTaskTop(); }}
            autoFocus
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={handleAddTaskTop} style={{ height: 36, padding: '0 14px' }}>Add</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowTaskTopInput(false); setTaskTopInput(''); }} style={{ height: 36 }}>Cancel</button>
        </div>
      )}
      {view === 'goals' && activeTaskId && showSubtaskTopInput && (
        <div className="lp-panel" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, padding: '12px 14px' }}>
          <ListChecks size={14} style={{ color: 'var(--accent-emerald)', flexShrink: 0 }} />
          <input
            className="input"
            value={subtaskTopInput}
            onChange={(e) => setSubtaskTopInput(e.target.value)}
            placeholder="Subtask title"
            style={{ flex: 1, height: 36 }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtaskTop(); }}
            autoFocus
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={handleAddSubtaskTop} style={{ height: 36, padding: '0 14px' }}>Add</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowSubtaskTopInput(false); setSubtaskTopInput(''); }} style={{ height: 36 }}>Cancel</button>
        </div>
      )}

      {/* ── Views ── */}
      {view === 'dashboard' && (
        <DashboardView
          doc={doc}
          progress={progress}
          totals={totals}
          upcoming={upcoming}
          nextDeadline={nextDeadline}
          daysLeft={daysLeft}
          activeHabits={activeHabits}
          hasAnything={hasAnything}
          hasGoals={hasGoals}
          onPhaseClick={() => setView('goals')}
          onViewTimeline={() => setView('timeline')}
          onViewLedger={() => setView('ledger')}
          onOpenGoal={() => {}}
        />
      )}

      {view === 'goals' && !activeMilestoneId && (
        <GoalsView
          {...goalFlow}
          activeMilestoneId={activeMilestoneId}
          setActiveMilestoneId={setActiveMilestoneId}
          activePhaseId={activePhaseId}
          setActivePhaseId={setActivePhaseId}
          activeGoalId={activeGoalId}
          setActiveGoalId={setActiveGoalId}
          activeTaskId={activeTaskId}
          setActiveTaskId={setActiveTaskId}
        />
      )}
      {view === 'goals' && activeMilestoneId && (
        <div className="lp-two-box">
          <div className="lp-box lp-box-filler">
            <h4 className="lp-panel-title"><Sparkles size={14} /> Fillers</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(() => {
                  const m = doc.goals.find((g) => g.id === activeMilestoneId);
                  if (!m) return null;
                  const pct = goalProgress(doc, m.id);
                  return (
                    <div className="lp-hierarchy-card" style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Flag size={12} style={{ color: 'var(--accent-purple)' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-purple)' }}>Milestone</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: 'var(--accent-purple)' }}>{pct}%</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, wordBreak: 'break-word' }}>Milestone {m.number} : {m.title}</div>
                      <LpBar pct={pct} color="var(--accent-purple)" />
                    </div>
                  );
                })()}
                {activePhaseId && (() => {
                  const ph = doc.phases.find((p) => p.id === activePhaseId);
                  if (!ph) return null;
                  const pct = phaseProgress(doc, ph.id);
                  return (
                    <div className="lp-hierarchy-card" style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Folder size={12} style={{ color: ph.color }} />
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: ph.color }}>Phase {doc.phases.filter((p) => p.milestoneId === activeMilestoneId).findIndex((p) => p.id === activePhaseId) + 1}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: ph.color }}>{pct}%</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{ph.title}</div>
                      <LpBar pct={pct} color={ph.color} />
                    </div>
                  );
                })()}
                {activeGoalId && (() => {
                  const g = byId(doc.goals, activeGoalId);
                  if (!g) return null;
                  const pct = goalProgress(doc, g.id);
                  const ph = doc.phases.find((p) => p.id === g.phaseId);
                  return (
                    <div className="lp-hierarchy-card" style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Target size={12} style={{ color: ph?.color || 'var(--accent-amber)' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: ph?.color || 'var(--accent-amber)' }}>Goal G{g.number}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: ph?.color || 'var(--accent-amber)' }}>{pct}%</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, wordBreak: 'break-word' }}>{g.title}</div>
                      <LpBar pct={pct} color={ph?.color || 'var(--accent-amber)'} />
                    </div>
                  );
                })()}
                {activeTaskId && (() => {
                  const t = doc.tasks.find((x) => x.id === activeTaskId);
                  if (!t) return null;
                  const steps = stepsOfTask(doc, t.id);
                  const done = steps.filter((s) => s.isDone).length;
                  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
                  const g = byId(doc.goals, t.goalId);
                  const ph = g ? doc.phases.find((p) => p.id === g.phaseId) : null;
                  return (
                    <div className="lp-hierarchy-card" style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <ListChecks size={12} style={{ color: ph?.color || 'var(--accent-amber)' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: ph?.color || 'var(--accent-amber)' }}>Task</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: ph?.color || 'var(--accent-amber)' }}>{pct}%</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, wordBreak: 'break-word' }}>{t.name}</div>
                      <LpBar pct={pct} color={ph?.color || 'var(--accent-amber)'} />
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>{done}/{steps.length} subtasks done</div>
                    </div>
                  );
                })()}
              </div>
          </div>
          <div className="lp-box lp-box-content">
            <GoalsView
              {...goalFlow}
              activeMilestoneId={activeMilestoneId}
              setActiveMilestoneId={setActiveMilestoneId}
              activePhaseId={activePhaseId}
              setActivePhaseId={setActivePhaseId}
              activeGoalId={activeGoalId}
              setActiveGoalId={setActiveGoalId}
              activeTaskId={activeTaskId}
              setActiveTaskId={setActiveTaskId}
            />
          </div>
        </div>
      )}

      {view === 'habits' && <HabitsView doc={doc} update={update} onConfirm={setConfirmState} />}
      {view === 'timeline' && <TimelineView doc={doc} onOpenGoal={() => {}} />}
      {view === 'ledger' && <LedgerView doc={doc} update={update} onConfirm={setConfirmState} />}

      {/* ── Add / Edit Goal modal ── */}
      {showGoalForm && (
        <GoalFormModal
          doc={doc}
          goal={editingGoal}
          onClose={() => { setShowGoalForm(false); setEditingGoal(null); }}
          onSave={(payload) => {
            update((d) => {
              let working = d;
              if (payload.__newPhase) {
                const before = working.phases.length;
                working = addPhase(working, payload.__newPhase);
                payload.phaseId = working.phases[before].id;
              }
              return editingGoal ? updateGoal(working, editingGoal.id, payload) : createGoal(working, payload);
            });
            setShowGoalForm(false);
            setEditingGoal(null);
          }}
        />
      )}

      {/* ── Confirm dialog ── */}
      {confirmState && (
        <LpConfirm
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// DASHBOARD VIEW — progress ring, phase bars, today panel, quick stats
// ═════════════════════════════════════════════════════════════════════════════

function DashboardView({
  doc, progress, totals, upcoming, nextDeadline, daysLeft, activeHabits,
  hasAnything, hasGoals, onPhaseClick, onViewTimeline,
  onViewLedger, onOpenGoal,
}) {
  const doneGoals = doc.goals.filter((g) => goalProgress(doc, g.id) === 100).length;

  if (!hasAnything) {
    return (
      <LpEmpty
        icon={Target}
        title="No plan yet"
        hint="Your dashboard is empty. Create goals, habits or ledger entries from their tabs to see insights here."
      />
    );
  }

  return (
    <div>
      <div className="lp-stats">
        <LpStat icon={<Target size={17} />} value={`${doneGoals}/${doc.goals.length}`} label="Goals done" />
        <LpStat icon={<Flame size={17} />} tone="rose" value={activeHabits.length} label="Habits active" />
        <LpStat icon={<Wallet size={17} />} tone="green" value={fmtMoney(totals.balance)} label="Balance" />
        {nextDeadline && (
          <LpStat icon={<Clock size={17} />} tone="cyan" value={daysLeft === 0 ? 'Today' : `${daysLeft}d`} label={`Next: ${nextDeadline.label.slice(0, 22)}`} />
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div className="lp-panel">
          <h4 className="lp-panel-title"><TrendingUp size={15} /> Overall progress</h4>
          {hasGoals ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {doc.phases.map((p) => (
                <button key={p.id} type="button" className="lp-phase-row" onClick={onPhaseClick}>
                  <span className="lp-phase-dot" style={{ background: p.color }} />
                  <span className="lp-phase-name">{p.title}</span>
                  <span className="lp-phase-track"><LpBar pct={phaseProgress(doc, p.id)} color={p.color} /></span>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{phaseProgress(doc, p.id)}%</span>
                </button>
              ))}
              {doc.goals.some((g) => !g.phaseId) && (
                <div className="lp-phase-row" style={{ cursor: 'default' }}>
                  <span className="lp-phase-dot" style={{ background: 'var(--text-tertiary)' }} />
                  <span className="lp-phase-name">Unphased goals</span>
                  <span className="lp-phase-track">
                    <LpBar
                      pct={Math.round(
                        doc.goals.filter((g) => !g.phaseId).reduce((s, g) => s + goalProgress(doc, g.id), 0)
                        / Math.max(1, doc.goals.filter((g) => !g.phaseId).length)
                      )}
                    />
                  </span>
                </div>
              )}
            </div>
          ) : (
            <LpEmpty icon={Target} title="No goals yet" hint="Create your first goal to start tracking progress." />
          )}
        </div>

        <div className="lp-panel">
          <h4 className="lp-panel-title"><Clock size={15} /> Today</h4>
          {upcoming.overdue.length === 0 && upcoming.next.length === 0 ? (
            <LpEmpty icon={Clock} title="Nothing scheduled" hint="Items with due dates from your tasks and steps will show up here." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcoming.overdue.slice(0, 3).map((e, i) => (
                <TimelineRow key={`od-${i}`} entry={e} overdue onOpenGoal={onOpenGoal} />
              ))}
              {upcoming.next.map((e, i) => (
                <TimelineRow key={`nx-${i}`} entry={e} onOpenGoal={onOpenGoal} />
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onViewTimeline}>View Timeline</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onViewLedger}>View Ledger</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineRow({ entry, overdue = false, onOpenGoal }) {
  return (
    <button
      type="button"
      onClick={() => entry.goal && onOpenGoal(entry.goal.id)}
      className="lp-phase-row"
      style={{ alignItems: 'flex-start' }}
      disabled={!entry.goal}
    >
      <span
        className="lp-badge"
        style={{
          background: overdue ? 'var(--accent-rose-glow)' : 'var(--bg-tertiary)',
          color: overdue ? 'var(--accent-rose)' : 'var(--text-secondary)',
        }}
      >
        {overdue ? 'Overdue' : fmtDate(entry.date)}
      </span>
      <span className="lp-phase-name" style={{ whiteSpace: 'normal', lineHeight: 1.4 }}>
        {entry.label}
        {entry.goal && <span style={{ color: 'var(--text-tertiary)' }}> · {entry.goal.title}</span>}
      </span>
      <ChevronRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 2 }} />
    </button>
  );
}
