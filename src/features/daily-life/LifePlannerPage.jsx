import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  CalendarDays, MoreVertical, Target, ListChecks,
  Clock, TrendingUp, FileDown, ChevronRight, RotateCcw,
  Flag, Sparkles, Repeat, AlertTriangle,
} from 'lucide-react';
import './LifePlannerPage.css';
import './LifePlannerRedesign.css';
import './LifePlannerBody.css';
import './DailyMasthead.css';
import './LifePlannerHouse.css';
import {
  useLifePlanner, EMPTY_DOC, overallProgress, milestoneProgress, goalsOfMilestone, byId, tasksOfGoal, stepsOfTask, WEEKDAYS,
  buildTimeline, fmtDate, todayKey, daysBetween,
  goalProgress, taskProgress, goalDisplayNumber, goalAutoDeadline, createGoal, updateGoal, deleteGoal, addTask, addStep, purgeOrphans, stripExampleContent, normalizePlanner,
} from './lifePlannerStorage';
import { LpSubnav, LpBar, LpRing, LpStat, LpEmpty, LpModal, LpConfirm, LpDateInput, useConfirmState } from './LifePlannerUI';
import GoalFormModal from './GoalFormModal';
import GoalsView from './GoalsView';
import TimelineView from './TimelineView';
import MindmapView from './MindmapView';
import CoursesView from './CoursesView';
import AutomateView from './AutomateView';
import { exportLifePlannerPDF } from './lifePlannerPDF';

const LP_VIEW_KEY = 'aust-life-planner-view';
const LP_VALID_VIEWS = ['dashboard', 'goals', 'courses', 'mindmap', 'timeline', 'automate'];

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
    // A deleted / reset goal can linger in the URL or localStorage — drop it so the
    // Milestones view doesn't open an empty "Goal" panel with an Add Task button.
    if (activeGoalId && !doc.goals.some((g) => g.id === activeGoalId && !(g.types || []).includes('milestone'))) {
      setActiveGoalId(null);
      setActiveTaskId(null);
    }
  }, [doc.goals, activeGoalId]);
  useEffect(() => {
    if (activeTaskId &&!doc.tasks.some((t) => t.id === activeTaskId)) setActiveTaskId(null);
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
    // Upcoming panel: all tasks in the next 5 days; if none, the next 5 tasks
    const in5Days = future.filter((e) => daysBetween(new Date(), e.date) <= 5);
    const usingFallback = in5Days.length === 0 && future.length > 0;
    const list = usingFallback ? future.slice(0, 5) : in5Days;
    return { overdue, next: future, list, usingFallback };
  }, [timeline, today]);

  const nextDeadline = upcoming.next[0] || null;
  const daysLeft = nextDeadline ? daysBetween(new Date(), nextDeadline.date) : null;

  // Milestones live in doc.goals too (type 'milestone'); goal counts must exclude them.
  const realGoals = doc.goals.filter((g) => !(g.types || []).includes('milestone'));
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

  // ── Timeline / Mindmap → jump into Goals view at the clicked node ──
  const scrollToFocus = (selector) => {
    setTimeout(() => {
      const el = document.querySelector(selector);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('lp-flash');
      setTimeout(() => el.classList.remove('lp-flash'), 1700);
    }, 350);
  };
  const openTarget = ({ milestoneId = null, goalId = null, taskId = null, stepId = null }) => {
    setView('goals');
    setActiveMilestoneId(milestoneId);
    setActiveGoalId(goalId);
    setActiveTaskId(taskId);
    const sel = stepId
      ? `[data-step-id="${stepId}"]`
      : taskId
        ? `[data-task-id="${taskId}"]`
        : goalId
          ? `[data-goal-id="${goalId}"]`
          : milestoneId
            ? `[data-milestone-id="${milestoneId}"]`
            : null;
    if (sel) scrollToFocus(sel);
  };
  const openMindmapMilestone = (m) => {
    openTarget({ milestoneId: m.id });
  };
  const openMindmapGoal = (g) => {
    openTarget({ milestoneId: g.milestoneId || null, goalId: g.id });
  };
  const openMindmapTask = (t, stepId = null) => {
    const g = byId(doc.goals, t.goalId);
    openTarget({ milestoneId: g?.milestoneId || null, goalId: g?.id || null, taskId: t.id, stepId });
  };
  // Timeline entry click — task/step entries land on their task/step
  const openTimelineEntry = (goalId, extra = {}) => {
    const g = byId(doc.goals, goalId);
    if (!g) return;
    openTarget({
      milestoneId: g.milestoneId || extra.milestoneId || null,
      goalId: g.id,
      taskId: extra.taskId || null,
      stepId: extra.stepId || null,
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

  const milestoneCount = doc.goals.filter((g) => (g.types || []).includes('milestone')).length;
  const resetTaskComposer = () => {
    setShowTaskTopInput(false); setTaskTopInput(''); setTaskTopStartDate(''); setTaskTopDueDate('');
    setTaskIsRecurring(false); setTaskRecurringWeekdays([]); setTaskRecurringEndDate(''); setTaskRecurringStartDate('');
  };
  const taskAddDisabled = !taskTopInput.trim() || (!taskIsRecurring
    ? !taskTopDueDate
    : (taskRecurringWeekdays.length === 0 || !taskRecurringStartDate || !taskRecurringEndDate));

  // Contextual primary action for the Goals view (Milestone → Goal → Task → Step)
  const goalsAction = view !== 'goals' ? null
    : !activeMilestoneId ? { icon: Flag, label: 'Add Milestone', toggle: () => setShowMilestoneInput((v) => !v) }
    : !activeGoalId ? { icon: Target, label: 'Add Goal', toggle: () => setShowGoalTopInput((v) => !v) }
    : !activeTaskId ? { icon: ListChecks, label: 'Add Task', toggle: () => setShowTaskTopInput((v) => !v) }
    : { icon: ListChecks, label: 'Add Step', toggle: () => setShowStepTopInput((v) => !v) };
  const GoalsActionIcon = goalsAction?.icon;

  return (
    <div className="glass-card-static schedule-widget lp-widget animate-fadeInUp">

      {/* ── Masthead ── */}
      <header className="dl-head has-actions">
        <div className="dl-head-title">
          <div className="dl-head-tile" aria-hidden="true">
            <CalendarDays size={20} strokeWidth={2.1} />
          </div>
          <div className="dl-head-text">
            <span className="dl-head-overline">Daily Life</span>
            <h2 className="dl-head-name">Life Planner</h2>
            <span className="dl-head-subtitle">Milestones, goals &amp; week plan</span>
          </div>
        </div>

        <dl className="dl-head-stats">
          <div className="dl-head-stat">
            <dt>Goals</dt>
            <dd>{realGoals.length}</dd>
          </div>
          <div className="dl-head-stat">
            <dt>Milestones</dt>
            <dd>{milestoneCount}</dd>
          </div>
          <div className="dl-head-stat">
            <dt>Progress</dt>
            <dd>{progress}%</dd>
          </div>
          {upcoming.overdue.length > 0 && (
            <div className="dl-head-stat is-alert">
              <dt>Overdue</dt>
              <dd>{upcoming.overdue.length}</dd>
            </div>
          )}
        </dl>

        <div className="dl-head-actions">
          <div className="lp-menu" ref={menuBtnRef}>
            <button
              type="button"
              className="lp-menu-btn"
              onClick={openMenu}
              title="Options"
              aria-label="Planner options"
              aria-haspopup="true"
              aria-expanded={showMenu}
            >
              <MoreVertical size={17} />
            </button>
            {showMenu && (
              <div className="lp-menu-list" role="menu">
                <button type="button" className="lp-menu-item" role="menuitem" onClick={handleExportPDF} disabled={exporting}>
                  <FileDown size={14} /> {exporting ? 'Rendering…' : 'Export PDF'}
                </button>
                <div className="lp-menu-sep" />
                <button type="button" className="lp-menu-item is-danger" role="menuitem" onClick={handleReset}>
                  <RotateCcw size={14} /> Reset planner
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Toolbar: sub-navigation + contextual add action ── */}
      <div className="lp-toolbar">
        <LpSubnav view={view} onChange={(v) => setView(v)} />
        {goalsAction && (
          <button type="button" className="btn btn-primary btn-sm lp-toolbar-action" onClick={goalsAction.toggle}>
            <GoalsActionIcon size={14} /> {goalsAction.label}
          </button>
        )}
      </div>

      {/* ── Composers ── */}
      {view === 'goals' && !activeMilestoneId && showMilestoneInput && (
        <div className="lp-composer" style={{ '--tone': 'var(--accent-purple)' }}>
          <div className="lp-composer-row">
            <span className="lp-composer-icon"><Flag size={14} /></span>
            <input
              className="input lp-composer-input"
              value={milestoneInput}
              onChange={(e) => setMilestoneInput(e.target.value)}
              placeholder="Milestone name"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddMilestoneTop(); }}
              autoFocus
            />
            <LpDateInput value={milestoneDeadline} onChange={setMilestoneDeadline} title="Deadline" />
            <div className="lp-composer-btns">
              <button type="button" className="btn btn-primary btn-sm" onClick={handleAddMilestoneTop}>Add</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowMilestoneInput(false); setMilestoneInput(''); setMilestoneDeadline(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {view === 'goals' && activeMilestoneId && !activeGoalId && showGoalTopInput && (
        <div className="lp-composer" style={{ '--tone': 'var(--accent-amber)' }}>
          <div className="lp-composer-row">
            <span className="lp-composer-icon"><Target size={14} /></span>
            <input
              className="input lp-composer-input"
              value={goalTopInput}
              onChange={(e) => setGoalTopInput(e.target.value)}
              placeholder="Goal title"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddGoalTop(); }}
              autoFocus
            />
            <div className="lp-composer-btns">
              <button type="button" className="btn btn-primary btn-sm" onClick={handleAddGoalTop}>Add</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowGoalTopInput(false); setGoalTopInput(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {view === 'goals' && activeGoalId && !activeTaskId && showTaskTopInput && (
        <div className="lp-composer" style={{ '--tone': 'var(--accent-amber)' }}>
          <div className="lp-composer-row">
            <span className="lp-composer-icon"><ListChecks size={14} /></span>
            <input
              className="input lp-composer-input"
              value={taskTopInput}
              onChange={(e) => setTaskTopInput(e.target.value)}
              placeholder="Task title"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTaskTop(); }}
              autoFocus
            />
            <div className="lp-composer-btns">
              <button type="button" className="btn btn-primary btn-sm" onClick={handleAddTaskTop} disabled={taskAddDisabled}>Add</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={resetTaskComposer}>Cancel</button>
            </div>
          </div>

          {!taskIsRecurring && (
            <div className="lp-composer-fields">
              <div className="lp-field">
                <label className="lp-field-label">End date</label>
                <LpDateInput value={taskTopDueDate} onChange={setTaskTopDueDate} required />
              </div>
            </div>
          )}

          <label className="lp-switch-row">
            <input
              type="checkbox"
              className="lp-check recurring"
              checked={taskIsRecurring}
              onChange={(e) => { setTaskIsRecurring(e.target.checked); if (!e.target.checked) { setTaskRecurringWeekdays([]); setTaskRecurringEndDate(''); setTaskRecurringStartDate(''); } }}
              aria-label="Recurring task"
            />
            <span className="lp-switch-label"><Repeat size={12} /> Recurring</span>
            {taskIsRecurring && <span className="lp-hint">week e koidin → kon kon din select koro</span>}
          </label>

          {taskIsRecurring && (
            <div className="lp-composer-recurring">
              <div className="lp-weekdays">
                {WEEKDAYS.map((w) => {
                  const on = taskRecurringWeekdays.includes(w.key);
                  return (
                    <button
                      key={w.key}
                      type="button"
                      className={`lp-day-chip${on ? ' is-on' : ''}`}
                      aria-pressed={on}
                      onClick={() => setTaskRecurringWeekdays((prev) => on ? prev.filter((x) => x !== w.key) : [...prev, w.key])}
                    >
                      {w.label}
                    </button>
                  );
                })}
              </div>
              <div className="lp-composer-fields">
                <div className="lp-field">
                  <label className="lp-field-label"><Clock size={10} /> Start date</label>
                  <LpDateInput value={taskRecurringStartDate} onChange={setTaskRecurringStartDate} required />
                </div>
                <div className="lp-field">
                  <label className="lp-field-label">End date</label>
                  <LpDateInput value={taskRecurringEndDate} onChange={setTaskRecurringEndDate} required />
                </div>
              </div>
              <div className="lp-hint">
                {taskRecurringWeekdays.length === 0 ? 'Select at least one day' : `${taskRecurringWeekdays.length} days • ${taskRecurringWeekdays.join(', ')}`} {taskRecurringEndDate ? `• until ${fmtDate(taskRecurringEndDate)}` : '• set an end date'} — the task and steps will repeat automatically
              </div>
            </div>
          )}
        </div>
      )}
      {view === 'goals' && activeTaskId && showStepTopInput && (() => {
        const parentTask = doc.tasks.find((x) => x.id === activeTaskId);
        const parentIsRecurring = !!parentTask?.isRecurring;
        return (
          <div className="lp-composer" style={{ '--tone': parentIsRecurring ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
            <div className="lp-composer-row">
              <span className="lp-composer-icon"><ListChecks size={14} /></span>
              <input
                className="input lp-composer-input"
                value={stepTopInput}
                onChange={(e) => setStepTopInput(e.target.value)}
                placeholder="Step title"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddStepTop(); }}
                autoFocus
              />
              {parentIsRecurring ? (
                <span className="lp-badge lp-badge-amber"><Repeat size={10} /> Auto recurring • {(parentTask.recurringWeekdays || []).join(', ')}</span>
              ) : (
                <LpDateInput value={stepTopDueDate} onChange={setStepTopDueDate} title="Deadline" />
              )}
              <div className="lp-composer-btns">
                <button type="button" className="btn btn-primary btn-sm" onClick={handleAddStepTop}>Add</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowStepTopInput(false); setStepTopInput(''); setStepTopDueDate(''); }}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Views ── */}
      <div className="lp-view" key={view}>
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
          onOpenGoal={openTimelineEntry}
        />
      )}

      {view === 'goals' && (
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

      {view === 'courses' && <CoursesView />}
      {view === 'timeline' && <TimelineView doc={doc} onOpenGoal={openTimelineEntry} />}
      {view === 'automate' && <AutomateView doc={doc} update={update} />}
      {view === 'mindmap' && (
        <MindmapView
          doc={doc}
          onOpenMilestone={openMindmapMilestone}
          onOpenGoal={openMindmapGoal}
          onOpenTask={openMindmapTask}
          onViewTimeline={() => setView('timeline')}
        />
      )}
      </div>

      {/* ── Add / Edit Goal modal ── */}
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
// DASHBOARD VIEW — progress hero + KPIs, milestone list, up-next agenda
// ═════════════════════════════════════════════════════════════════════════════

function DashboardView({
  doc, progress, upcoming, nextDeadline, daysLeft,
  hasAnything, onPhaseClick, onViewTimeline, onOpenGoal,
}) {
  const realGoals = doc.goals.filter((g) => !(g.types || []).includes('milestone'));
  const doneGoals = realGoals.filter((g) => goalProgress(doc, g.id) === 100).length;
  const milestones = doc.goals
    .filter((g) => (g.types || []).includes('milestone'))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (!hasAnything) {
    return (
      <LpEmpty
        icon={Target}
        title="No plan yet"
        hint="Your dashboard is empty. Create a milestone from the Milestones tab to start seeing insights here."
      />
    );
  }

  const overdueCount = upcoming.overdue.length;
  const agenda = [
    ...upcoming.overdue.slice(0, 3).map((e) => ({ e, overdue: true })),
    ...upcoming.list.map((e) => ({ e, overdue: false })),
  ];

  return (
    <div className="pb-stack">
      {/* ── Hero: overall progress + KPIs ── */}
      <section className="pb-card pb-hero">
        <div className="pb-hero-main">
          <span className="pb-label">Overall progress</span>
          <div className="pb-hero-value">{progress}<span>%</span></div>
          <p className="pb-hero-sub">
            {doneGoals} of {realGoals.length} goal{realGoals.length === 1 ? '' : 's'} complete
            {' · '}{milestones.length} milestone{milestones.length === 1 ? '' : 's'}
          </p>
        </div>

        <dl className="pb-kpis">
          <div className="pb-kpi">
            <dt>Goals done</dt>
            <dd>{doneGoals}<small>/{realGoals.length}</small></dd>
          </div>
          <div className="pb-kpi">
            <dt>Milestones</dt>
            <dd>{milestones.length}</dd>
          </div>
          <div className="pb-kpi">
            <dt>Next deadline</dt>
            <dd>{nextDeadline ? (daysLeft === 0 ? 'Today' : `${daysLeft}d`) : '—'}</dd>
            {nextDeadline && <span className="pb-kpi-note" title={nextDeadline.label}>{nextDeadline.label}</span>}
          </div>
          <div className={`pb-kpi${overdueCount ? ' is-alert' : ''}`}>
            <dt>Overdue</dt>
            <dd>{overdueCount}</dd>
          </div>
        </dl>

        <div className="pb-hero-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Overall progress">
          <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      </section>

      <div className="pb-grid-2">
        {/* ── Milestones ── */}
        <section className="pb-card">
          <header className="pb-head">
            <h3 className="pb-title">Milestones</h3>
            <span className="pb-count">{milestones.length}</span>
            <button type="button" className="pb-link" onClick={onPhaseClick}>Open <ChevronRight size={13} /></button>
          </header>
          {milestones.length === 0 ? (
            <p className="pb-empty-line">No milestones yet.</p>
          ) : (
            <div className="pb-list">
              {milestones.map((m, idx) => {
                const pct = milestoneProgress(doc, m.id);
                const goals = goalsOfMilestone(doc, m.id).length;
                return (
                  <button key={m.id} type="button" className="pb-mrow" onClick={onPhaseClick}>
                    <span className="pb-index">{String(idx + 1).padStart(2, '0')}</span>
                    <span className="pb-mrow-body">
                      <span className="pb-mrow-title" title={m.title}>{m.title}</span>
                      <span className="pb-mrow-meta">
                        <span className="pb-bar"><span style={{ width: `${pct}%` }} /></span>
                        <span>{goals} goal{goals === 1 ? '' : 's'}</span>
                      </span>
                    </span>
                    <span className="pb-pct">{pct}%</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Up next ── */}
        <section className="pb-card">
          <header className="pb-head">
            <h3 className="pb-title">Up next</h3>
            <span className="pb-meta">{upcoming.usingFallback ? 'Next 5 tasks' : 'Next 5 days'}</span>
            <button type="button" className="pb-link" onClick={onViewTimeline}>Timeline <ChevronRight size={13} /></button>
          </header>
          {agenda.length === 0 ? (
            <p className="pb-empty-line">Nothing due ahead. Items with dates will show up here.</p>
          ) : (
            <div className="pb-list pb-list-scroll">
              {agenda.map(({ e, overdue }, i) => (
                <AgendaRow key={`${overdue ? 'od' : 'nx'}-${i}`} entry={e} overdue={overdue} onOpenGoal={onOpenGoal} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function AgendaRow({ entry, overdue = false, onOpenGoal }) {
  const d = new Date(`${entry.date}T00:00:00`);
  const valid = !Number.isNaN(d.getTime());
  return (
    <button
      type="button"
      onClick={() => entry.goal && onOpenGoal(entry.goal.id, { taskId: entry.task?.id || null, stepId: entry.step?.id || null, milestoneId: entry.milestone?.id || null })}
      className={`pb-arow${overdue ? ' is-overdue' : ''}`}
      disabled={!entry.goal}
    >
      <span className="pb-date" aria-label={fmtDate(entry.date)}>
        {valid ? (
          <>
            <strong>{d.getDate()}</strong>
            <span>{d.toLocaleString('en-GB', { month: 'short' })}</span>
          </>
        ) : <span>{fmtDate(entry.date)}</span>}
      </span>
      <span className="pb-arow-body">
        <span className="pb-arow-title">{entry.label}</span>
        <span className="pb-arow-meta">
          {overdue && <em>Overdue</em>}
          {entry.goal ? entry.goal.title : (entry.kind === 'step' ? 'Step' : 'Task')}
        </span>
      </span>
      <ChevronRight size={14} className="pb-chev" aria-hidden="true" />
    </button>
  );
}
