import { useState } from 'react';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { LpModal } from './LifePlannerUI';

/**
 * Edit Goal modal — strictly 4 fields:
 * Title, Milestone (parent), Expected Cost (optional), Dependency (prerequisite goals).
 * Dependency is a prerequisite: if any dependsOn goal is not 100% done, this goal is locked
 * and its checkbox cannot be ticked — warning shown.
 */
export default function GoalFormModal({ doc, goal, onClose, onSave }) {
  const editing = !!goal;
  const milestones = doc.goals.filter((g) => (g.types || []).includes('milestone'));
  const isMilestoneGoal = (goal?.types || []).includes('milestone');
  const [title, setTitle] = useState(goal?.title || '');
  const [milestoneId, setMilestoneId] = useState(goal?.milestoneId || '');
  const [costLabel, setCostLabel] = useState(goal?.costLabel || '');
  const [dependsOn, setDependsOn] = useState(
    (doc.deps || []).filter((d) => d.goalId === goal?.id).map((d) => d.dependsOnGoalId)
  );
  const [showDepPicker, setShowDepPicker] = useState(false);
  const [depQuery, setDepQuery] = useState('');
  const [error, setError] = useState('');

  const toggleDep = (id) => {
    setDependsOn((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const wouldCycle = (candidateId) => {
    const depMap = new Map(doc.goals.map((g) => [g.id,
      doc.deps.filter((d) => d.goalId === g.id).map((d) => d.dependsOnGoalId)]));
    const nextDeps = new Map(depMap);
    const key = goal?.id || '__new__';
    nextDeps.set(key, [...(depMap.get(key) || []), candidateId].filter(Boolean));
    const stack = [candidateId];
    const seen = new Set();
    while (stack.length) {
      const cur = stack.pop();
      if (cur === key) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const n of nextDeps.get(cur) || []) stack.push(n);
    }
    return false;
  };

  const depCandidates = doc.goals
    .filter((g) => g.id !== goal?.id)
    .filter((g) => !dependsOn.includes(g.id))
    .filter((g) => g.title.toLowerCase().includes(depQuery.toLowerCase()));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) { setError('Give the goal a title.'); return; }
    onSave(buildPayload());
  };

  const buildPayload = () => ({
    milestoneId: isMilestoneGoal ? null : (milestoneId || null),
    phaseId: null,
    title: title.trim(),
    types: editing ? (goal.types?.length ? goal.types : ['goal']) : ['goal'],
    costLabel: costLabel?.trim() || null,
    timingLabel: goal?.timingLabel ?? null,
    timingDate: goal?.timingDate ?? null,
    definitionOfDone: goal?.definitionOfDone ?? null,
    dependsOn,
    tasks: [],
  });

  return (
    <LpModal title={editing ? 'Edit Goal' : 'New Goal'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="lp-form-grid">
        <div className="lp-modal-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Title */}
          <div>
            <label className="lp-form-label" htmlFor="lp-goal-title">Title</label>
            <input
              id="lp-goal-title"
              className="input"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(''); }}
              placeholder="e.g. Finish thesis proposal"
              autoFocus
            />
          </div>

          {/* Milestone */}
          <div>
            <label className="lp-form-label" htmlFor="lp-goal-milestone">Milestone</label>
            <select
              id="lp-goal-milestone"
              className="input"
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
              disabled={isMilestoneGoal}
            >
              <option value="">{isMilestoneGoal ? 'Milestones have no parent' : 'No milestone (unassigned)'}</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id} disabled={m.id === goal?.id}>{m.title}</option>
              ))}
            </select>
            {isMilestoneGoal && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Milestone goals sit at the top level, goals belong inside them.</span>}
          </div>

          {/* Expected Cost (optional) */}
          <div>
            <label className="lp-form-label" htmlFor="lp-goal-cost">Expected cost <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-tertiary)' }}>(optional)</span></label>
            <input
              id="lp-goal-cost"
              className="input"
              value={costLabel}
              onChange={(e) => setCostLabel(e.target.value)}
              placeholder="e.g. ≈12,000৳ or 0"
            />
          </div>

          {/* Dependency — prerequisite */}
          <div className="lp-form-block">
            <div className="lp-form-block-title">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={13} style={{ color: 'var(--accent-amber)' }} /> Dependency <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', textTransform: 'none', letterSpacing: 0 }}>(prerequisite)</span></span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowDepPicker((v) => !v)}>
                {showDepPicker ? 'Done' : <><Plus size={12} /> Add</>}
              </button>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 8 }}>
              Select prerequisite goal(s). This goal will stay locked until the prerequisite is 100% completed — checkbox will show a warning if you try to complete it early.
            </span>
            {dependsOn.length === 0 && !showDepPicker && (
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>No dependencies — this goal can start anytime.</span>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {dependsOn.map((id) => {
                const g = doc.goals.find((x) => x.id === id);
                if (!g) return null;
                return (
                  <span key={id} className="lp-dep-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: 'var(--accent-amber-glow)', border: '1px solid var(--accent-amber)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}>
                    {g.title}
                    <button
                      type="button"
                      onClick={() => toggleDep(id)}
                      aria-label={`Remove dependency on ${g.title}`}
                      style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </span>
                );
              })}
            </div>
            {showDepPicker && (
              <div style={{ marginTop: 10 }}>
                <input
                  className="input"
                  value={depQuery}
                  onChange={(e) => setDepQuery(e.target.value)}
                  placeholder="Search goals…"
                  style={{ marginBottom: 6 }}
                />
                <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, border: '1px solid var(--border-primary)', borderRadius: 10, padding: 6, background: 'var(--bg-card)' }}>
                  {depCandidates.length === 0 && (
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', padding: 6 }}>No other goals found.</span>
                  )}
                  {depCandidates.map((g) => {
                    const blocked = wouldCycle(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        className="lp-phase-row"
                        disabled={blocked}
                        onClick={() => toggleDep(g.id)}
                        title={blocked ? 'Adding this would create a circular dependency' : undefined}
                        style={{ opacity: blocked ? 0.45 : 1 }}
                      >
                        <span className="lp-phase-name">{g.title}</span>
                        {blocked && <span className="lp-badge lp-badge-rose">circular</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {error && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-rose)' }}>{error}</span>}
        </div>

        <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border-secondary)' }}>
          <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1 }}>
            {editing ? 'Save changes' : 'Create Goal'}
          </button>
        </div>
      </form>
    </LpModal>
  );
}
