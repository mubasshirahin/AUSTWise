import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  CalendarDays, MoreVertical, Plus, Target, Flame, Wallet, ListChecks,
  Clock, TrendingUp, FileDown, ChevronRight, Zap,
} from 'lucide-react';
import './LifePlannerPage.css';
import {
  useLifePlanner, examplePlan, overallProgress, phaseProgress, goalsOfPhase,
  buildTimeline, ledgerTotals, fmtMoney, fmtDate, todayKey, daysBetween,
  goalLocked, goalProgress, createGoal, updateGoal, deleteGoal, addPhase,
} from './lifePlannerStorage';
import { LpSubnav, LpRing, LpBar, LpStat, LpEmpty, LpStartEmpty, LpModal, LpConfirm, useConfirmState } from './LifePlannerUI';
import GoalFormModal from './GoalFormModal';
import GoalDetail from './GoalDetail';
import GoalsView from './GoalsView';
import HabitsView from './HabitsView';
import TimelineView from './TimelineView';
import LedgerView from './LedgerView';
import { exportLifePlannerPDF } from './lifePlannerPDF';

export default function LifePlannerPage() {
  const [doc, update] = useLifePlanner();
  const [view, setView] = useState('dashboard');
  const [openGoalId, setOpenGoalId] = useState(null);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [showMenu, setShowMenu] = useState(false);
  const menuBtnRef = useRef(null);
  const [confirmState, setConfirmState] = useConfirmState();
  const [exporting, setExporting] = useState(false);

  // ── Menu (export / example seed) ──
  useEffect(() => {
    if (!showMenu) return undefined;
    const close = (e) => {
      if (menuBtnRef.current && !menuBtnRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showMenu]);

  const openMenu = () => {
    if (menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setShowMenu((v) => !v);
  };

  // ── Navigation helpers ──
  const goToGoal = useCallback((goalId) => {
    setOpenGoalId(goalId);
    setView('goals');
  }, []);

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
        setOpenGoalId(null);
        setConfirmState(null);
      },
    });
  };

  // ── Shared props for goal-related views ──
  const goalFlow = {
    doc,
    update,
    openGoalId,
    onOpenGoal: goToGoal,
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
          <div style={{ position: 'relative' }} ref={menuBtnRef}>
            <button type="button" className="schedule-nav-btn" onClick={openMenu} aria-label="More options" aria-haspopup="true">
              <MoreVertical size={18} />
            </button>
            {showMenu && (
              <div
                style={{
                  position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 99999,
                  minWidth: 190, padding: 4,
                  background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
                }}
              >
                <button type="button" className="export-menu-item" onClick={handleExportPDF} disabled={exporting}>
                  <FileDown size={14} /> {exporting ? 'Rendering…' : 'Export PDF'}
                </button>
                <button type="button" className="export-menu-item" onClick={() => { setShowMenu(false); loadExample(); }}>
                  <Zap size={14} /> Load example plan
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {/* ── Sub-navigation ── */}
      <LpSubnav view={view} onChange={(v) => { setView(v); if (v !== 'goals') setOpenGoalId(null); }} />

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
          onNewGoal={openNewGoal}
          onExample={loadExample}
          onViewTimeline={() => setView('timeline')}
          onViewLedger={() => setView('ledger')}
          onOpenGoal={goToGoal}
        />
      )}

      {view === 'goals' && (
        openGoalId ? (
          <GoalDetail
            {...goalFlow}
            goalId={openGoalId}
            onBack={() => setOpenGoalId(null)}
          />
        ) : (
          <GoalsView {...goalFlow} />
        )
      )}

      {view === 'habits' && <HabitsView doc={doc} update={update} onConfirm={setConfirmState} />}
      {view === 'timeline' && <TimelineView doc={doc} onOpenGoal={goToGoal} />}
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
                payload.phaseId = working.phases[before].id; // the newly added phase
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
  hasAnything, hasGoals, onPhaseClick, onNewGoal, onExample, onViewTimeline,
  onViewLedger, onOpenGoal,
}) {
  const doneGoals = doc.goals.filter((g) => goalProgress(doc, g.id) === 100).length;

  if (!hasAnything) {
    return (
      <LpStartEmpty onStart={onNewGoal} onExample={onExample} />
    );
  }

  return (
    <div>
      {/* Quick stats row */}
      <div className="lp-stats">
        <LpStat icon={<Target size={17} />} value={`${doneGoals}/${doc.goals.length}`} label="Goals done" />
        <LpStat icon={<Flame size={17} />} tone="rose" value={activeHabits.length} label="Habits active" />
        <LpStat icon={<Wallet size={17} />} tone="green" value={fmtMoney(totals.balance)} label="Balance" />
        {nextDeadline && (
          <LpStat icon={<Clock size={17} />} tone="cyan" value={daysLeft === 0 ? 'Today' : `${daysLeft}d`} label={`Next: ${nextDeadline.label.slice(0, 22)}`} />
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {/* Overall progress */}
        <div className="lp-panel">
          <h4 className="lp-panel-title"><TrendingUp size={15} /> Overall progress</h4>
          {hasGoals ? (
            <div className="lp-ring-wrap">
              <LpRing pct={progress} />
              <div className="lp-ring-side">
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
            </div>
          ) : (
            <LpEmpty icon={Target} title="No goals yet" hint="Create your first goal to start tracking progress." />
          )}
        </div>

        {/* Today panel */}
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

      {/* Primary actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
        <button type="button" className="lp-add-btn" onClick={onNewGoal}>
          <Plus size={14} /> New Goal
        </button>
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
