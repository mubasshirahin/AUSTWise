import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  CalendarDays, MoreVertical, Target, Flame, Wallet, ListChecks,
  Clock, TrendingUp, FileDown, ChevronRight, Zap, RotateCcw,
  Flag, Sparkles, Repeat,
} from 'lucide-react';
import './LifePlannerPage.css';
import {
  useLifePlanner, EMPTY_DOC, examplePlan, overallProgress, milestoneProgress, goalsOfMilestone, byId, tasksOfGoal, stepsOfTask, WEEKDAYS,
  buildTimeline, ledgerTotals, fmtMoney, fmtDate, todayKey, daysBetween,
  goalProgress, createGoal, updateGoal, deleteGoal, addTask, addStep,
} from './lifePlannerStorage';
import { LpSubnav, LpBar, LpStat, LpEmpty, LpModal, LpConfirm, useConfirmState } from './LifePlannerUI';
import GoalFormModal from './GoalFormModal';
import GoalsView from './GoalsView';
import HabitsView from './HabitsView';
import TimelineView from './TimelineView';
import LedgerView from './LedgerView';
import MindmapView from './MindmapView';
import { exportLifePlannerPDF } from './lifePlannerPDF';

const LP_VIEW_KEY = 'aust-life-planner-view';
const LP_VALID_VIEWS = ['dashboard', 'goals', 'mindmap', 'habits', 'timeline', 'ledger'];

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
  const [milestoneDeadline, setMilestoneDeadline] = useState('');
  const [showGoalTopInput, setShowGoalTopInput] = useState(false);
  const [goalTopInput, setGoalTopInput] = useState('');
  const [goalTopDeadline, setGoalTopDeadline] = useState('');
  const [showTaskTopInput, setShowTaskTopInput] = useState(false);
  const [taskTopInput, setTaskTopInput] = useState('');
  const [taskTopDueDate, setTaskTopDueDate] = useState('');
  const [taskIsRecurring, setTaskIsRecurring] = useState(false);
  const [taskRecurringWeekdays, setTaskRecurringWeekdays] = useState([]);
  const [showSubtaskTopInput, setShowSubtaskTopInput] = useState(false);
  const [subtaskTopInput, setSubtaskTopInput] = useState('');
  const [subtaskTopDueDate, setSubtaskTopDueDate] = useState('');

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

  // Clear stale hierarchy ids — Phase removed, now Milestone → Goal → Task
  useEffect(() => {
    if (activeMilestoneId && !doc.goals.some((g) => g.id === activeMilestoneId && (g.types || []).includes('milestone'))) setActiveMilestoneId(null);
  }, [doc.goals, activeMilestoneId]);
  useEffect(() => {
    if (activeTaskId && !doc.tasks.some((t) => t.id === activeTaskId)) setActiveTaskId(null);
  }, [doc.tasks, activeTaskId]);
  useEffect(() => {
    if (activeGoalId && activeTaskId) {
      const t = doc.tasks.find((x) => x.id === activeTaskId);
      if (t && t.goalId !== activeGoalId) setActiveTaskId(null);
    }
    if (!activeGoalId) setActiveTaskId(null);
  }, [activeGoalId, activeTaskId, doc.tasks]);
  useEffect(() => {
    if (activeMilestoneId && activeGoalId) {
      const g = doc.goals.find((x) => x.id === activeGoalId);
      if (g && g.milestoneId !== activeMilestoneId) {
        // Legacy fallback: check via old phase linkage
        const ph = g.phaseId ? doc.phases.find((p) => p.id === g.phaseId) : null;
        if (!ph || ph.milestoneId !== activeMilestoneId) { setActiveGoalId(null); setActiveTaskId(null); }
      }
    }
    if (!activeMilestoneId) { setActiveGoalId(null); }
  }, [activeMilestoneId, activeGoalId, doc.goals, doc.phases]);

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
    try { if (activeGoalId) localStorage.setItem('aust-lp-goal', activeGoalId); else localStorage.removeItem('aust-lp-goal'); const url = new URL(window.location.href); if (activeGoalId) url.searchParams.set('goal', activeGoalId); else url.searchParams.delete('goal'); window.history.replaceState({}, '', url); } catch {}
  }, [activeGoalId]);
  useEffect(() => {
    try { if (activeTaskId) localStorage.setItem('aust-lp-task', activeTaskId); else localStorage.removeItem('aust-lp-task'); const url = new URL(window.location.href); if (activeTaskId) url.searchParams.set('task', activeTaskId); else url.searchParams.delete('task'); window.history.replaceState({}, '', url); } catch {}
  }, [activeTaskId]);
  // cleanup legacy phase key
  useEffect(() => { try { localStorage.removeItem('aust-lp-phase'); const url = new URL(window.location.href); url.searchParams.delete('phase'); window.history.replaceState({}, '', url); } catch {} }, []);

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
      message: 'This will permanently delete all milestones, goals, tasks, steps, habits and ledger entries. Your planner will be empty. This cannot be undone.',
      confirmLabel: 'Reset',
      onConfirm: () => {
        update({ ...EMPTY_DOC, habitLogs: {} });
        setConfirmState(null);
        setView('dashboard');
        setActiveMilestoneId(null);
        setActiveTaskId(null);
      },
    });
  };

  const handleAddMilestoneTop = () => {
    if (!milestoneInput.trim()) return;
    update((d) => createGoal(d, {
      milestoneId: null,
      phaseId: null,
      title: milestoneInput.trim(),
      types: ['milestone'],
      costLabel: null,
      timingLabel: milestoneDeadline ? fmtDate(milestoneDeadline) : null,
      timingDate: milestoneDeadline || null,
      definitionOfDone: null,
      dependsOn: [],
      tasks: [],
    }));
    setMilestoneInput('');
    setMilestoneDeadline('');
    setShowMilestoneInput(false);
    setView('goals');
    // stay in list — don't auto-navigate into new milestone (avoids race where doc not yet updated and cleanup clears activeId → "afer jaygay chole ashe")
  };

  const handleAddGoalTop = () => {
    if (!goalTopInput.trim() || !activeMilestoneId) return;
    update((d) => createGoal(d, {
      milestoneId: activeMilestoneId,
      phaseId: null,
      title: goalTopInput.trim(),
      types: ['goal'],
      costLabel: null,
      timingLabel: goalTopDeadline ? fmtDate(goalTopDeadline) : null,
      timingDate: goalTopDeadline || null,
      definitionOfDone: null,
      dependsOn: [],
      tasks: [],
    }));
    setGoalTopInput('');
    setGoalTopDeadline('');
    setShowGoalTopInput(false);
    // stay in milestone's goals list — don't auto-open new goal
  };

  const handleAddTaskTop = () => {
    if (!taskTopInput.trim() || !activeGoalId) return;
    if (taskIsRecurring && taskRecurringWeekdays.length === 0) return;
    update((d) => addTask(d, activeGoalId, {
      name: taskTopInput.trim(),
      costLabel: '',
      dueLabel: taskIsRecurring ? `Recurring ${taskRecurringWeekdays.length}/week` : (taskTopDueDate ? fmtDate(taskTopDueDate) : ''),
      dueDate: taskIsRecurring ? null : (taskTopDueDate || ''),
      isRecurring: taskIsRecurring,
      recurringDaysPerWeek: taskRecurringWeekdays.length,
      recurringWeekdays: taskRecurringWeekdays,
    }));
    setTaskTopInput('');
    setTaskTopDueDate('');
    setTaskIsRecurring(false);
    setTaskRecurringWeekdays([]);
    setShowTaskTopInput(false);
    // stay in goal's tasks list — don't auto-open new task
  };

  const handleAddSubtaskTop = () => {
    if (!subtaskTopInput.trim() || !activeTaskId) return;
    update((d) => addStep(d, activeTaskId, { text: subtaskTopInput.trim(), dueLabel: subtaskTopDueDate ? fmtDate(subtaskTopDueDate) : '', dueDate: subtaskTopDueDate || '', note: '' }));
    setSubtaskTopInput('');
    setSubtaskTopDueDate('');
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

  // ── Mindmap → jump into Goals view at the clicked node ──
  const openMindmapMilestone = (m) => {
    setView('goals');
    setActiveMilestoneId(m.id);
    setActiveGoalId(null);
    setActiveTaskId(null);
  };
  const openMindmapGoal = (g) => {
    setView('goals');
    setActiveMilestoneId(g.milestoneId || null);
    setActiveGoalId(g.id);
    setActiveTaskId(null);
  };
  const openMindmapTask = (t) => {
    const g = byId(doc.goals, t.goalId);
    setView('goals');
    setActiveMilestoneId(g?.milestoneId || null);
    setActiveGoalId(g?.id || null);
    setActiveTaskId(t.id);
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

      {/* ── Sub-navigation + Add Milestone/Goal (Phase removed) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <LpSubnav view={view} onChange={(v) => setView(v)} />
        </div>
        {view === 'goals' && !activeMilestoneId && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowMilestoneInput((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Flag size={14} /> Add Milestone
          </button>
        )}
        {view === 'goals' && activeMilestoneId && !activeGoalId && (
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
        <div className="lp-panel" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, padding: '12px 14px' }}>
          <Flag size={14} style={{ color: 'var(--accent-purple)', flexShrink: 0 }} />
          <input
            className="input"
            value={milestoneInput}
            onChange={(e) => setMilestoneInput(e.target.value)}
            placeholder="Milestone name"
            style={{ flex: '1 1 160px', height: 36 }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddMilestoneTop(); }}
            autoFocus
          />
          <input type="date" className="input" value={milestoneDeadline} onChange={(e) => setMilestoneDeadline(e.target.value)} title="Deadline" style={{ height: 36, maxWidth: 150 }} />
          <button type="button" className="btn btn-primary btn-sm" onClick={handleAddMilestoneTop} style={{ height: 36, padding: '0 14px' }}>Add</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowMilestoneInput(false); setMilestoneInput(''); setMilestoneDeadline(''); }} style={{ height: 36 }}>Cancel</button>
        </div>
      )}
      {view === 'goals' && activeMilestoneId && !activeGoalId && showGoalTopInput && (
        <div className="lp-panel" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, padding: '12px 14px' }}>
          <Target size={14} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
          <input
            className="input"
            value={goalTopInput}
            onChange={(e) => setGoalTopInput(e.target.value)}
            placeholder="Goal title"
            style={{ flex: '1 1 160px', height: 36 }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddGoalTop(); }}
            autoFocus
          />
          <input type="date" className="input" value={goalTopDeadline} onChange={(e) => setGoalTopDeadline(e.target.value)} title="Deadline" style={{ height: 36, maxWidth: 150 }} />
          <button type="button" className="btn btn-primary btn-sm" onClick={handleAddGoalTop} style={{ height: 36, padding: '0 14px' }}>Add</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowGoalTopInput(false); setGoalTopInput(''); setGoalTopDeadline(''); }} style={{ height: 36 }}>Cancel</button>
        </div>
      )}
      {view === 'goals' && activeGoalId && !activeTaskId && showTaskTopInput && (
        <div className="lp-panel" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12, padding: '12px 14px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <ListChecks size={14} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
            <input
              className="input"
              value={taskTopInput}
              onChange={(e) => setTaskTopInput(e.target.value)}
              placeholder="Task title"
              style={{ flex: '1 1 160px', height: 36 }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTaskTop(); }}
              autoFocus
            />
            {!taskIsRecurring && <input type="date" className="input" value={taskTopDueDate} onChange={(e) => setTaskTopDueDate(e.target.value)} title="Deadline" style={{ height: 36, maxWidth: 150 }} />}
            <button type="button" className="btn btn-primary btn-sm" onClick={handleAddTaskTop} style={{ height: 36, padding: '0 14px' }} disabled={taskIsRecurring && taskRecurringWeekdays.length===0}>Add</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowTaskTopInput(false); setTaskTopInput(''); setTaskTopDueDate(''); setTaskIsRecurring(false); setTaskRecurringWeekdays([]); }} style={{ height: 36 }}>Cancel</button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={taskIsRecurring} onChange={(e) => { setTaskIsRecurring(e.target.checked); if (!e.target.checked) setTaskRecurringWeekdays([]); }} style={{ width: 16, height: 16, accentColor: 'var(--accent-amber)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Recurring</span>
            {taskIsRecurring && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>week e koidin → kon kon din select koro</span>}
          </label>
          {taskIsRecurring && (
            <div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {WEEKDAYS.map((w) => {
                  const on = taskRecurringWeekdays.includes(w.key);
                  return (
                    <button key={w.key} type="button" className={`lp-badge ${on ? 'lp-badge-amber' : 'lp-badge-muted'}`} style={{ cursor: 'pointer', borderStyle: on ? 'solid' : 'dashed' }} onClick={() => setTaskRecurringWeekdays((prev) => on ? prev.filter((x) => x !== w.key) : [...prev, w.key])}>
                      {w.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>{taskRecurringWeekdays.length === 0 ? 'Ekta din o select koro' : `${taskRecurringWeekdays.length} din • ${taskRecurringWeekdays.join(', ')}`} — task + subtasks auto recurring hobe</div>
            </div>
          )}
        </div>
      )}
      {view === 'goals' && activeTaskId && showSubtaskTopInput && (() => {
        const parentTask = doc.tasks.find((x) => x.id === activeTaskId);
        const parentIsRecurring = !!parentTask?.isRecurring;
        return (
        <div className="lp-panel" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, padding: '12px 14px' }}>
          <ListChecks size={14} style={{ color: parentIsRecurring ? 'var(--accent-amber)' : 'var(--accent-emerald)', flexShrink: 0 }} />
          <input
            className="input"
            value={subtaskTopInput}
            onChange={(e) => setSubtaskTopInput(e.target.value)}
            placeholder="Subtask title"
            style={{ flex: '1 1 160px', height: 36 }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtaskTop(); }}
            autoFocus
          />
          {parentIsRecurring ? (
            <span className="lp-badge lp-badge-amber" style={{ gap: 4 }}><Repeat size={10} /> Auto recurring • {(parentTask.recurringWeekdays||[]).join(', ')}</span>
          ) : (
            <input type="date" className="input" value={subtaskTopDueDate} onChange={(e) => setSubtaskTopDueDate(e.target.value)} title="Deadline" style={{ height: 36, maxWidth: 150 }} />
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={handleAddSubtaskTop} style={{ height: 36, padding: '0 14px' }}>Add</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowSubtaskTopInput(false); setSubtaskTopInput(''); setSubtaskTopDueDate(''); }} style={{ height: 36 }}>Cancel</button>
        </div>
        );
      })()}

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
                  const overdue = m.timingDate && m.timingDate < todayKey() && pct < 100;
                  return (
                    <div className="lp-hierarchy-card" style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Flag size={12} style={{ color: 'var(--accent-purple)' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-purple)' }}>Milestone</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: 'var(--accent-purple)' }}>{pct}%</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, wordBreak: 'break-word' }}>Milestone {m.number} : {m.title}</div>
                      <LpBar pct={pct} color="var(--accent-purple)" />
                      {m.timingDate && <span className={`lp-badge ${overdue ? 'lp-badge-rose' : 'lp-badge-cyan'}`} style={{ marginTop: 8, display: 'inline-flex' }}><Clock size={10} /> {fmtDate(m.timingDate)}</span>}
                    </div>
                  );
                })()}
                {activeGoalId && (() => {
                  const g = byId(doc.goals, activeGoalId);
                  if (!g) return null;
                  const pct = goalProgress(doc, g.id);
                  const overdue = g.timingDate && g.timingDate < todayKey() && pct < 100;
                  return (
                    <div className="lp-hierarchy-card" style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Target size={12} style={{ color: 'var(--accent-amber)' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-amber)' }}>Goal G{g.number}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: 'var(--accent-amber)' }}>{pct}%</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, wordBreak: 'break-word' }}>{g.title}</div>
                      <LpBar pct={pct} color="var(--accent-amber)" />
                      {g.timingDate && <span className={`lp-badge ${overdue ? 'lp-badge-rose' : 'lp-badge-cyan'}`} style={{ marginTop: 8, display: 'inline-flex' }}><Clock size={10} /> {fmtDate(g.timingDate)}</span>}
                    </div>
                  );
                })()}
                {activeTaskId && (() => {
                  const t = doc.tasks.find((x) => x.id === activeTaskId);
                  if (!t) return null;
                  const steps = stepsOfTask(doc, t.id);
                  const done = steps.filter((s) => s.isDone).length;
                  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
                  const overdue = t.dueDate && t.dueDate < todayKey();
                  return (
                    <div className="lp-hierarchy-card" style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <ListChecks size={12} style={{ color: 'var(--accent-amber)' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-amber)' }}>Task</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: 'var(--accent-amber)' }}>{pct}%</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, wordBreak: 'break-word' }}>{t.name}</div>
                      <LpBar pct={pct} color="var(--accent-amber)" />
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>{done}/{steps.length} subtasks done</div>
                      {t.dueDate && <span className={`lp-badge ${overdue ? 'lp-badge-rose' : 'lp-badge-cyan'}`} style={{ marginTop: 6, display: 'inline-flex' }}><Clock size={10} /> {fmtDate(t.dueDate)}</span>}
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
      {view === 'mindmap' && (
        <MindmapView
          doc={doc}
          onOpenMilestone={openMindmapMilestone}
          onOpenGoal={openMindmapGoal}
          onOpenTask={openMindmapTask}
          onViewTimeline={() => setView('timeline')}
        />
      )}
      {view === 'ledger' && <LedgerView doc={doc} update={update} onConfirm={setConfirmState} />}

      {/* ── Add / Edit Goal modal — Phase removed, direct milestoneId ── */}
      {showGoalForm && (
        <GoalFormModal
          doc={doc}
          goal={editingGoal}
          onClose={() => { setShowGoalForm(false); setEditingGoal(null); }}
          onSave={(payload) => {
            update((d) => editingGoal ? updateGoal(d, editingGoal.id, payload) : createGoal(d, payload));
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
          {hasGoals ? (() => {
            const milestones = doc.goals.filter((g) => (g.types || []).includes('milestone'));
            const unMilestoned = doc.goals.filter((g) => !(g.types || []).includes('milestone') && !g.milestoneId && !g.phaseId);
            return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {milestones.map((m) => (
                <button key={m.id} type="button" className="lp-phase-row" onClick={onPhaseClick}>
                  <span className="lp-phase-dot" style={{ background: 'var(--accent-purple)' }} />
                  <span className="lp-phase-name">Milestone {m.number}: {m.title}</span>
                  <span className="lp-phase-track"><LpBar pct={milestoneProgress(doc, m.id)} color="var(--accent-purple)" /></span>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{milestoneProgress(doc, m.id)}%</span>
                </button>
              ))}
              {unMilestoned.length > 0 && (
                <div className="lp-phase-row" style={{ cursor: 'default' }}>
                  <span className="lp-phase-dot" style={{ background: 'var(--text-tertiary)' }} />
                  <span className="lp-phase-name">Unassigned goals</span>
                  <span className="lp-phase-track">
                    <LpBar
                      pct={Math.round(
                        unMilestoned.reduce((s, g) => s + goalProgress(doc, g.id), 0)
                        / Math.max(1, unMilestoned.length)
                      )}
                    />
                  </span>
                </div>
              )}
              {milestones.length === 0 && unMilestoned.length === 0 && (
                <div className="lp-phase-row" style={{ cursor: 'default' }}>
                  <span className="lp-phase-name" style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>All goals are assigned to milestones</span>
                </div>
              )}
            </div>
            );
          })() : (
            <LpEmpty icon={Target} title="No goals yet" hint="Create your first milestone & goal to start tracking progress." />
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
