import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  CalendarDays, MoreVertical, Target, ListChecks,
  Clock, TrendingUp, FileDown, ChevronRight, RotateCcw,
  Flag, Sparkles, Repeat,
} from 'lucide-react';
import './LifePlannerPage.css';
import {
  useLifePlanner, EMPTY_DOC, overallProgress, milestoneProgress, goalsOfMilestone, byId, tasksOfGoal, stepsOfTask, WEEKDAYS,
  buildTimeline, fmtDate, todayKey, daysBetween,
  goalProgress, taskProgress, goalDisplayNumber, goalAutoDeadline, createGoal, updateGoal, deleteGoal, addTask, addStep, purgeOrphans, stripExampleContent, normalizePlanner,
} from './lifePlannerStorage';
import { LpSubnav, LpBar, LpStat, LpEmpty, LpModal, LpConfirm, useConfirmState } from './LifePlannerUI';
import GoalFormModal from './GoalFormModal';
import GoalsView from './GoalsView';
import TimelineView from './TimelineView';
import MindmapView from './MindmapView';
import CoursesView from './CoursesView';
import { exportLifePlannerPDF } from './lifePlannerPDF';

const LP_VIEW_KEY = 'aust-life-planner-view';
const LP_VALID_VIEWS = ['dashboard', 'goals', 'courses', 'mindmap', 'timeline'];

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
  const [taskTopStartDate, setTaskTopStartDate] = useState('');
  const [taskTopDueDate, setTaskTopDueDate] = useState('');
  const [taskIsRecurring, setTaskIsRecurring] = useState(false);
  const [taskRecurringWeekdays, setTaskRecurringWeekdays] = useState([]);
  const [taskRecurringEndDate, setTaskRecurringEndDate] = useState('');
  const [taskRecurringStartDate, setTaskRecurringStartDate] = useState('');
  const [showStepTopInput, setShowStepTopInput] = useState(false);
  const [stepTopInput, setStepTopInput] = useState('');
  const [stepTopDueDate, setStepTopDueDate] = useState('');

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

  // One-time cleanup: example seed leftovers + DF ghosts (orphaned & milestone-attached tasks) + dangling goals
  useEffect(() => {
    const cleaned = normalizePlanner(stripExampleContent(purgeOrphans(doc)));
    if (cleaned !== doc) update(() => cleaned);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // No milestone active: allow goal selection only for unassigned goals (no dangling milestoneId)
    if (!activeMilestoneId && activeGoalId) {
      const g = doc.goals.find((x) => x.id === activeGoalId);
      if (g && (g.milestoneId || g.phaseId)) { setActiveGoalId(null); setActiveTaskId(null); }
    }
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

  const handleReset = () => {
    setShowMenu(false);
    setConfirmState({
      title: 'Reset planner?',
      message: 'This will permanently delete all milestones, goals, tasks and steps. Your planner will be empty. This cannot be undone.',
      confirmLabel: 'Reset',
      onConfirm: () => {
        update({ ...EMPTY_DOC });
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
      timingLabel: null,
      timingDate: null,
      definitionOfDone: null,
      dependsOn: [],
      tasks: [],
    }));
    setGoalTopInput('');
    setShowGoalTopInput(false);
    // stay in milestone's goals list — don't auto-open new goal
  };

  const handleAddTaskTop = () => {
    if (!taskTopInput.trim() || !activeGoalId) return;
    if (!taskIsRecurring) {
      if (!taskTopDueDate) return; // normal task: just End date must
    } else {
      if (taskRecurringWeekdays.length === 0) return;
      if (!taskRecurringStartDate || !taskRecurringEndDate) return; // recurring: start -> end must
      if (taskRecurringStartDate > taskRecurringEndDate) return;
    }
    update((d) => addTask(d, activeGoalId, {
      name: taskTopInput.trim(),
      costLabel: '',
      dueLabel: '',
      dueDate: taskIsRecurring ? null : (taskTopDueDate || ''),
      startDate: taskIsRecurring ? (taskRecurringStartDate || null) : null,
      isRecurring: taskIsRecurring,
      recurringDaysPerWeek: taskRecurringWeekdays.length,
      recurringWeekdays: taskRecurringWeekdays,
      recurringEndDate: taskIsRecurring ? taskRecurringEndDate : null,
      recurringStartDate: taskIsRecurring ? taskRecurringStartDate : null,
    }));
    setTaskTopInput('');
    setTaskTopStartDate('');
    setTaskTopDueDate('');
    setTaskIsRecurring(false);
    setTaskRecurringWeekdays([]);
    setTaskRecurringEndDate('');
    setTaskRecurringStartDate('');
    setShowTaskTopInput(false);
  };

  const handleAddStepTop = () => {
    if (!stepTopInput.trim() || !activeTaskId) return;
    update((d) => addStep(d, activeTaskId, { text: stepTopInput.trim(), dueLabel: stepTopDueDate ? fmtDate(stepTopDueDate) : '', dueDate: stepTopDueDate || '', note: '' }));
    setStepTopInput('');
    setStepTopDueDate('');
    setShowStepTopInput(false);
  };

  // ── Dashboard aggregates ──
  const progress = useMemo(() => overallProgress(doc), [doc]);
  const timeline = useMemo(() => buildTimeline(doc), [doc]);

  const today = todayKey();
  const upcoming = useMemo(() => {
    const open = timeline.filter((e) => !(e.kind === 'step' && e.done));
    const overdue = open.filter((e) => e.date < today);
    const future = open.filter((e) => e.date >= today);
    return { overdue, next: future.slice(0, 3) };
  }, [timeline, today]);

  const nextDeadline = upcoming.next[0] || null;
  const daysLeft = nextDeadline ? daysBetween(new Date(), nextDeadline.date) : null;

  const hasAnything = doc.goals.length > 0;
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
            <span className="schedule-subtitle">Goals &amp; week plan</span>
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
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowStepTopInput((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <ListChecks size={14} /> Add Step
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
            style={{ flex: '1 1 240px', height: 36 }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddGoalTop(); }}
            autoFocus
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={handleAddGoalTop} style={{ height: 36, padding: '0 14px' }}>Add</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowGoalTopInput(false); setGoalTopInput(''); }} style={{ height: 36 }}>Cancel</button>
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
              style={{ flex: '1 1 180px', height: 36 }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTaskTop(); }}
              autoFocus
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={handleAddTaskTop} style={{ height: 36, padding: '0 14px' }} disabled={!taskTopInput.trim() || (!taskIsRecurring ? !taskTopDueDate : (taskRecurringWeekdays.length===0 || !taskRecurringStartDate || !taskRecurringEndDate))}>Add</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowTaskTopInput(false); setTaskTopInput(''); setTaskTopStartDate(''); setTaskTopDueDate(''); setTaskIsRecurring(false); setTaskRecurringWeekdays([]); setTaskRecurringEndDate(''); setTaskRecurringStartDate(''); }} style={{ height: 36 }}>Cancel</button>
          </div>
          {!taskIsRecurring && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>End date</label>
                <input type="date" className="input" value={taskTopDueDate} onChange={(e) => setTaskTopDueDate(e.target.value)} required style={{ height: 36, width: '100%' }} />
              </div>
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" className="lp-check recurring" checked={taskIsRecurring} onChange={(e) => { setTaskIsRecurring(e.target.checked); if (!e.target.checked) { setTaskRecurringWeekdays([]); setTaskRecurringEndDate(''); setTaskRecurringStartDate(''); } }} aria-label="Recurring task" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Recurring</span>
            {taskIsRecurring && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>week e koidin → kon kon din select koro</span>}
          </label>
          {taskIsRecurring && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 140px' }}>
                  <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}><Clock size={10} style={{ verticalAlign: '-1px' }} /> Start date</label>
                  <input type="date" className="input" value={taskRecurringStartDate} onChange={(e)=>setTaskRecurringStartDate(e.target.value)} style={{ height: 34, width: '100%' }} required />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>End date</label>
                  <input type="date" className="input" value={taskRecurringEndDate} onChange={(e)=>setTaskRecurringEndDate(e.target.value)} style={{ height: 34, width: '100%' }} required />
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{taskRecurringWeekdays.length === 0 ? 'Ekta din o select koro' : `${taskRecurringWeekdays.length} din • ${taskRecurringWeekdays.join(', ')}`} {taskRecurringEndDate ? `• till ${fmtDate(taskRecurringEndDate)}` : '• end date daw'} — task + steps auto recurring hobe</div>
            </div>
          )}
        </div>
      )}
      {view === 'goals' && activeTaskId && showStepTopInput && (() => {
        const parentTask = doc.tasks.find((x) => x.id === activeTaskId);
        const parentIsRecurring = !!parentTask?.isRecurring;
        return (
        <div className="lp-panel" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, padding: '12px 14px' }}>
          <ListChecks size={14} style={{ color: parentIsRecurring ? 'var(--accent-amber)' : 'var(--accent-emerald)', flexShrink: 0 }} />
          <input
            className="input"
            value={stepTopInput}
            onChange={(e) => setStepTopInput(e.target.value)}
            placeholder="Step title"
            style={{ flex: '1 1 160px', height: 36 }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddStepTop(); }}
            autoFocus
          />
          {parentIsRecurring ? (
            <span className="lp-badge lp-badge-amber" style={{ gap: 4 }}><Repeat size={10} /> Auto recurring • {(parentTask.recurringWeekdays||[]).join(', ')}</span>
          ) : (
            <input type="date" className="input" value={stepTopDueDate} onChange={(e) => setStepTopDueDate(e.target.value)} title="Deadline" style={{ height: 36, maxWidth: 150 }} />
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={handleAddStepTop} style={{ height: 36, padding: '0 14px' }}>Add</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowStepTopInput(false); setStepTopInput(''); setStepTopDueDate(''); }} style={{ height: 36 }}>Cancel</button>
        </div>
        );
      })()}

      {/* ── Views ── */}
      {view === 'dashboard' && (
        <DashboardView
          doc={doc}
          progress={progress}
          upcoming={upcoming}
          nextDeadline={nextDeadline}
          daysLeft={daysLeft}
          hasAnything={hasAnything}
          hasGoals={hasGoals}
          onPhaseClick={() => setView('goals')}
          onViewTimeline={() => setView('timeline')}
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
        <>
          {/* Breadcrumb outside box, above it */}
          {(() => {
            const milestonesBc = doc.goals.filter((g) => (g.types || []).includes('milestone')).sort((a,b)=>(a.order||0)-(b.order||0));
            const activeMilestoneBc = milestonesBc.find((m) => m.id === activeMilestoneId) || null;
            const activeGoalBc = activeGoalId ? byId(doc.goals, activeGoalId) : null;
            const activeTaskBc = activeTaskId ? doc.tasks.find((t) => t.id === activeTaskId) : null;
            return (
              <div className="lp-breadcrumb" style={{ marginBottom: 12 }}>
                <button type="button" className="lp-breadcrumb-item" onClick={() => { setActiveMilestoneId(null); setActiveGoalId(null); setActiveTaskId(null); }} style={{ cursor: 'pointer' }}><Flag size={10} /> Milestones</button>
                {activeMilestoneBc && (
                  <>
                    <ChevronRight size={12} className="lp-breadcrumb-sep" />
                    <button type="button" className="lp-breadcrumb-item purple active" onClick={() => { setActiveGoalId(null); setActiveTaskId(null); }} style={{ cursor: 'pointer', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${activeMilestoneBc.title} — click to see goals`}><Flag size={10} /> Milestone {milestonesBc.findIndex((m) => m.id === activeMilestoneBc.id) + 1}</button>
                  </>
                )}
                {activeGoalBc && (
                  <>
                    <ChevronRight size={12} className="lp-breadcrumb-sep" />
                    <button type="button" className="lp-breadcrumb-item active" onClick={() => setActiveTaskId(null)} style={{ cursor: 'pointer', background: 'var(--accent-amber-glow)', borderColor: 'var(--accent-amber)', color: 'var(--accent-amber)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${activeGoalBc.title} — click to see tasks`}><Target size={10} /> Goal {goalDisplayNumber(doc, activeGoalBc)}</button>
                  </>
                )}
                {activeTaskBc && (
                  <>
                    <ChevronRight size={12} className="lp-breadcrumb-sep" />
                    <span className="lp-breadcrumb-item active" style={{ cursor: 'default', background: 'var(--accent-emerald-glow)', borderColor: 'var(--accent-emerald)', color: 'var(--accent-emerald)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={activeTaskBc.name}><ListChecks size={10} /> {activeTaskBc.name}</span>
                  </>
                )}
              </div>
            );
          })()}
          <div className="lp-two-box" style={{ paddingTop: 4, alignItems: 'flex-start' }}>
           <div className="lp-box lp-box-filler">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(() => {
                  const m = doc.goals.find((g) => g.id === activeMilestoneId);
                  if (!m) return null;
                  const milestonesSorted = [...doc.goals].filter((g) => (g.types || []).includes('milestone')).sort((a,b)=> (a.order||0)-(b.order||0));
                  const idx = milestonesSorted.findIndex((x)=>x.id===m.id);
                  const displayNum = idx >=0 ? idx+1 : m.number;
                  const pct = milestoneProgress(doc, m.id);
                  const overdue = m.timingDate && m.timingDate < todayKey() && pct < 100;
                  return (
                    <div className="lp-hierarchy-card" style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Flag size={12} style={{ color: 'var(--accent-purple)' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-purple)' }}>Milestone</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: 'var(--accent-purple)' }}>{pct}%</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, wordBreak: 'break-word' }}>Milestone {displayNum} : {m.title}</div>
                      <LpBar pct={pct} color="var(--accent-purple)" />
                      {m.timingDate && <span className={`lp-badge ${overdue ? 'lp-badge-rose' : 'lp-badge-cyan'}`} style={{ marginTop: 8, display: 'inline-flex' }}><Clock size={10} /> {fmtDate(m.timingDate)}</span>}
                    </div>
                  );
                })()}
                {activeGoalId && (() => {
                  const g = byId(doc.goals, activeGoalId);
                  if (!g) return null;
                  const pct = goalProgress(doc, g.id);
                  const autoDl = goalAutoDeadline(doc, g.id);
                  const overdue = autoDl && autoDl < todayKey() && pct < 100;
                  return (
                    <div className="lp-hierarchy-card" style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Target size={12} style={{ color: 'var(--accent-amber)' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-amber)' }}>Goal G{goalDisplayNumber(doc,g)}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: 'var(--accent-amber)' }}>{pct}%</span>
                      </div>
                       <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, wordBreak: 'break-word' }}>{g.title}</div>
                      <LpBar pct={pct} color="var(--accent-amber)" />
                      {autoDl ? (
                        <span className={`lp-badge ${overdue ? 'lp-badge-rose' : 'lp-badge-cyan'}`} style={{ marginTop: 8, display: 'inline-flex' }} title="Auto from tasks’ last end date"><Clock size={10} /> {fmtDate(autoDl)}</span>
                      ) : (
                        <span className="lp-badge lp-badge-muted" style={{ marginTop: 8, display: 'inline-flex', borderStyle: 'dashed' }}><CalendarDays size={10} /> No deadline</span>
                      )}
                    </div>
                  );
                })()}
                {activeTaskId && (() => {
                  const t = doc.tasks.find((x) => x.id === activeTaskId);
                  if (!t) return null;
                  const steps = stepsOfTask(doc, t.id);
                  const done = steps.filter((s) => s.isDone).length;
                  const pct = taskProgress(doc, t.id);
                  const overdue = t.dueDate && t.dueDate < todayKey() && pct < 100;
                  return (
                    <div className="lp-hierarchy-card" style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <ListChecks size={12} style={{ color: 'var(--accent-amber)' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-amber)' }}>Task</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: 'var(--accent-amber)' }}>{pct}%</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, wordBreak: 'break-word' }}>{t.name}</div>
                      <LpBar pct={pct} color="var(--accent-amber)" />
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>{steps.length ? `${done}/${steps.length} steps done` : (t.manualDone ? 'Completed' : 'No steps — tick to complete')}</div>
                      {t.isRecurring ? (
                        <span className="lp-badge lp-badge-amber" style={{ marginTop: 6, display: 'inline-flex', gap:4 }}><Repeat size={10}/> {(t.recurringWeekdays||[]).join(', ')} {t.startDate || t.recurringStartDate ? `${fmtDate(t.startDate || t.recurringStartDate)} → ` : ''}{t.recurringEndDate ? fmtDate(t.recurringEndDate) : 'No end'}</span>
                      ) : (t.startDate || t.dueDate) ? (
                        <span className={`lp-badge ${overdue ? 'lp-badge-rose' : 'lp-badge-cyan'}`} style={{ marginTop: 6, display: 'inline-flex', gap:4 }}><Clock size={10} /> {t.startDate && t.dueDate && t.startDate !== t.dueDate ? `${fmtDate(t.startDate)} → ${fmtDate(t.dueDate)}` : fmtDate(t.dueDate || t.startDate)}</span>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
          </div>
          <div className="lp-box lp-box-content" style={{ marginTop: 12, transform: 'translateY(-4px)' }}>
            <GoalsView
              {...goalFlow}
              activeMilestoneId={activeMilestoneId}
              setActiveMilestoneId={setActiveMilestoneId}
              activeGoalId={activeGoalId}
              setActiveGoalId={setActiveGoalId}
              activeTaskId={activeTaskId}
              setActiveTaskId={setActiveTaskId}
              hideBreadcrumb
            />
          </div>
        </div>
        </>
      )}

      {view === 'courses' && <CoursesView />}
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
  doc, progress, upcoming, nextDeadline, daysLeft,
  hasAnything, hasGoals, onPhaseClick, onViewTimeline,
  onOpenGoal,
}) {
  const doneGoals = doc.goals.filter((g) => goalProgress(doc, g.id) === 100).length;

  if (!hasAnything) {
    return (
      <LpEmpty
        icon={Target}
        title="No plan yet"
        hint="Your dashboard is empty. Create goals or timeline entries from their tabs to see insights here."
      />
    );
  }

  return (
    <div>
      <div className="lp-stats">
        <LpStat icon={<Target size={17} />} value={`${doneGoals}/${doc.goals.length}`} label="Goals done" />
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
              {milestones.map((m, idx) => (
                <button key={m.id} type="button" className="lp-phase-row" onClick={onPhaseClick}>
                  <span className="lp-phase-dot" style={{ background: 'var(--accent-purple)' }} />
                  <span className="lp-phase-name">Milestone {idx + 1}: {m.title}</span>
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
