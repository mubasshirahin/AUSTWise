import { useState, useMemo } from 'react';
import { Plus, Search, ChevronDown, ChevronUp, Lock, ArrowUp, ArrowDown, FolderPlus } from 'lucide-react';
import { LpEmpty, LpBar } from './LifePlannerUI';
import {
  goalsOfPhase, goalProgress, goalLocked, depsOfGoal, byId, TYPE_META,
  nextOrder, uid,
} from './lifePlannerStorage';

/**
 * Goals view (Section 5.2): search + type filter + sort, collapsible phase
 * sections with their goal cards. Reorder within a phase via arrow buttons;
 * move between phases via the per-card menu.
 */
export default function GoalsView({
  doc, update, onOpenGoal, onNewGoal, onEditGoal, onDeleteGoal, onConfirm,
}) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState([]); // subset of GOAL_TYPES
  const [sortBy, setSortBy] = useState('phase');    // 'phase' | 'due' | 'alpha'
  const [collapsed, setCollapsed] = useState({});   // phaseId -> bool
  const [showPhaseForm, setShowPhaseForm] = useState(false);
  const [newPhase, setNewPhase] = useState({ title: '', subtitle: '' });

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

  const unphased = sortGoals(doc.goals.filter((g) => !g.phaseId).filter(matches));
  const anyVisible = visiblePhases.some((p) => goalsOfPhase(doc, p.id).some(matches)) || unphased.length > 0;

  const toggleType = (t) =>
    setTypeFilter((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const toggleCollapse = (phaseId) =>
    setCollapsed((prev) => ({ ...prev, [phaseId]: !prev[phaseId] }));

  // ── Reordering / moving ──
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
    if (!newPhase.title.trim()) return;
    update((d) => ({
      ...d,
      phases: [...d.phases, {
        id: uid(), title: newPhase.title.trim(),
        subtitle: newPhase.subtitle.trim() || null,
        color: ['var(--accent-amber)', 'var(--accent-emerald)', 'var(--accent-cyan)', 'var(--accent-purple)'][d.phases.length % 4],
        order: nextOrder(d.phases),
      }],
    }));
    setNewPhase({ title: '', subtitle: '' });
    setShowPhaseForm(false);
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

  return (
    <div>
      {/* Toolbar */}
      <div className="lp-toolbar">
        <div style={{ position: 'relative', flex: 1, minWidth: 160, maxWidth: 260 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search goals…"
            style={{ paddingLeft: 28, width: '100%' }}
            aria-label="Search goals"
          />
        </div>
        {Object.keys(TYPE_META).map((t) => (
          <button
            key={t}
            type="button"
            className={`lp-type-chip${typeFilter.includes(t) ? ` on-${t}` : ''}`}
            aria-pressed={typeFilter.includes(t)}
            onClick={() => toggleType(t)}
          >
            {TYPE_META[t].label}
          </button>
        ))}
        <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort goals" style={{ maxWidth: 150 }}>
          <option value="phase">Sort: manual</option>
          <option value="due">Sort: by date</option>
          <option value="alpha">Sort: A → Z</option>
        </select>
        <span className="lp-spacer" />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPhaseForm((v) => !v)}>
          <FolderPlus size={13} /> Add Phase
        </button>
        <button type="button" className="lp-add-btn" onClick={onNewGoal}>
          <Plus size={14} /> Add Goal
        </button>
      </div>

      {/* Inline phase form */}
      {showPhaseForm && (
        <div className="lp-panel">
          <div className="lp-form-row">
            <input className="input" value={newPhase.title} onChange={(e) => setNewPhase((p) => ({ ...p, title: e.target.value }))} placeholder="Phase title (e.g. Phase 1 — Foundation)" />
            <input className="input" value={newPhase.subtitle} onChange={(e) => setNewPhase((p) => ({ ...p, subtitle: e.target.value }))} placeholder="Subtitle (optional)" />
            <button type="button" className="btn btn-primary btn-sm" onClick={addPhaseInline}>Add</button>
          </div>
        </div>
      )}

      {/* Phase sections */}
      {!anyVisible && (
        <LpEmpty
          title={doc.goals.length ? 'No goals match your filters' : 'No goals yet'}
          hint={doc.goals.length ? 'Try clearing the search or type filters.' : 'Goals group into phases — create your first one to get going.'}
        />
      )}

      {visiblePhases.map((phase) => {
        const goals = sortGoals(goalsOfPhase(doc, phase.id).filter(matches));
        const isCollapsed = collapsed[phase.id];
        return (
          <div key={phase.id} className="lp-phase-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="lp-phase-header"
                onClick={() => toggleCollapse(phase.id)}
                aria-expanded={!isCollapsed}
                style={{ flex: 1 }}
              >
                <span className="lp-phase-dot" style={{ background: phase.color }} />
                <span className="lp-phase-header-title">{phase.title}</span>
                {phase.subtitle && <span className="lp-phase-header-sub">{phase.subtitle}</span>}
                <span className="lp-phase-header-sub">{goals.length} goal{goals.length === 1 ? '' : 's'}</span>
                {isCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
              </button>
              <button type="button" className="lp-icon-btn" onClick={() => removePhase(phase)} aria-label={`Remove phase ${phase.title}`} title="Remove phase">
                <Trash />
              </button>
            </div>
            {!isCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {goals.length === 0 && (
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', padding: '2px 10px' }}>
                    No goals here yet.
                  </span>
                )}
                {goals.map((g, idx) => (
                  <GoalCard
                    key={g.id}
                    doc={doc}
                    goal={g}
                    phaseColor={phase.color}
                    onOpenGoal={onOpenGoal}
                    onEditGoal={onEditGoal}
                    onDeleteGoal={onDeleteGoal}
                    onMove={moveGoal}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < goals.length - 1}
                    onMoveToPhase={moveGoalToPhase}
                    phases={doc.phases.filter((p) => p.id !== phase.id)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Unphased goals */}
      {unphased.length > 0 && (
        <div className="lp-phase-section">
          <div className="lp-phase-header" style={{ cursor: 'default' }}>
            <span className="lp-phase-dot" style={{ background: 'var(--text-tertiary)' }} />
            <span className="lp-phase-header-title">No phase</span>
            <span className="lp-phase-header-sub">{unphased.length} goal{unphased.length === 1 ? '' : 's'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {unphased.map((g) => (
              <GoalCard
                key={g.id}
                doc={doc}
                goal={g}
                phaseColor="var(--text-tertiary)"
                onOpenGoal={onOpenGoal}
                onEditGoal={onEditGoal}
                onDeleteGoal={onDeleteGoal}
                onMove={moveGoal}
                canMoveUp={false}
                canMoveDown={false}
                onMoveToPhase={moveGoalToPhase}
                phases={doc.phases}
              />
            ))}
          </div>
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
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const pct = goalProgress(doc, goal.id);
  const locked = goalLocked(doc, goal.id);
  const deps = depsOfGoal(doc, goal.id);

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
      {/* Reorder arrows (only where meaningful) */}
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

      <button type="button" className="lp-goal-card" onClick={() => onOpenGoal(goal.id)} style={{ borderLeft: `3px solid ${phaseColor}` }}>
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
          <div className="lp-goal-track">
            <LpBar pct={pct} color={phaseColor} />
            <span className="lp-goal-pct">{pct}% complete</span>
          </div>
        </div>
      </button>

      {/* Card menu */}
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
