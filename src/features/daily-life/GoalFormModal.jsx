import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { LpModal } from './LifePlannerUI';
import { GOAL_TYPES, TYPE_META } from './lifePlannerStorage';

/**
 * Add/Edit Goal modal — Phase removed, now Milestone → Goal directly.
 * Fields: title, milestone (parent), types (multi), cost label,
 * timing label + optional date, dependencies, DoD, repeatable tasks with steps.
 */
export default function GoalFormModal({ doc, goal, onClose, onSave }) {
  const editing = !!goal;
  const milestones = doc.goals.filter((g) => (g.types || []).includes('milestone'));
  const [title, setTitle] = useState(goal?.title || '');
  const [milestoneId, setMilestoneId] = useState(goal?.milestoneId || '');
  const [types, setTypes] = useState(goal?.types?.length ? goal.types : ['goal']);
  const [costLabel, setCostLabel] = useState(goal?.costLabel || '');
  const [timingLabel, setTimingLabel] = useState(goal?.timingLabel || '');
  const [timingDate, setTimingDate] = useState(goal?.timingDate || '');
  const [dod, setDod] = useState(goal?.definitionOfDone || '');
  const [dependsOn, setDependsOn] = useState(
    (doc.deps || []).filter((d) => d.goalId === goal?.id).map((d) => d.dependsOnGoalId)
  );
  const [showDepPicker, setShowDepPicker] = useState(false);
  const [depQuery, setDepQuery] = useState('');
  const [tasks, setTasks] = useState(
    editing ? [] : [{ name: '', costLabel: '', dueLabel: '', dueDate: '', steps: [{ text: '', dueDate: '', note: '' }] }]
  );
  const [error, setError] = useState('');

  const toggleType = (t) => {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

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

  const setTask = (i, patch) => {
    setTasks((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  };
  const addTask = () => setTasks((prev) => [...prev, { name: '', costLabel: '', dueLabel: '', dueDate: '', steps: [{ text: '', dueDate: '', note: '' }] }]);
  const removeTask = (i) => setTasks((prev) => prev.filter((_, idx) => idx !== i));
  const setStep = (ti, si, patch) => {
    setTasks((prev) => prev.map((t, idx) => (idx === ti
      ? { ...t, steps: t.steps.map((s, sidx) => (sidx === si ? { ...s, ...patch } : s)) }
      : t)));
  };
  const addStep = (ti) => {
    setTasks((prev) => prev.map((t, idx) => (idx === ti
      ? { ...t, steps: [...t.steps, { text: '', dueDate: '', note: '' }] }
      : t)));
  };
  const removeStep = (ti, si) => {
    setTasks((prev) => prev.map((t, idx) => (idx === ti
      ? { ...t, steps: t.steps.filter((_, sidx) => sidx !== si) }
      : t)));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) { setError('Give the goal a title.'); return; }
    onSave(buildPayload());
  };

  const isMilestone = types.includes('milestone');

  const buildPayload = () => ({
    milestoneId: isMilestone ? null : (milestoneId || null),
    phaseId: null,
    title,
    types,
    costLabel,
    timingLabel: isMilestone ? timingLabel : null,
    timingDate: isMilestone ? (timingDate || null) : null,
    definitionOfDone: dod,
    dependsOn,
    tasks: editing ? [] : tasks.map((t) => ({
      name: t.name,
      costLabel: t.costLabel,
      dueLabel: t.dueLabel,
      dueDate: t.dueDate || null,
      steps: (t.steps || []).map((s) => ({ text: s.text, dueDate: s.dueDate || null, note: s.note })),
    })),
  });

  return (
    <LpModal title={editing ? 'Edit Goal' : 'New Goal'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="lp-form-grid">
        <div className="lp-modal-scroll">
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

          <div>
            <label className="lp-form-label" htmlFor="lp-goal-milestone">Milestone (parent)</label>
            <select
              id="lp-goal-milestone"
              className="input"
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
              disabled={isMilestone}
            >
              <option value="">{isMilestone ? 'Milestones have no parent' : 'No milestone (unassigned)'}</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id} disabled={m.id === goal?.id}>{m.title}</option>
              ))}
            </select>
            {isMilestone && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Milestone goals sit at the top level, goals belong inside them.</span>}
          </div>

          <div>
            <span className="lp-form-label">Type</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {GOAL_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`lp-type-chip${types.includes(t) ? ` on-${t}` : ''}`}
                  aria-pressed={types.includes(t)}
                  onClick={() => toggleType(t)}
                >
                  {TYPE_META[t].label}
                </button>
              ))}
            </div>
          </div>

          {isMilestone ? (
            <div className="lp-form-row">
              <div>
                <label className="lp-form-label" htmlFor="lp-goal-cost">Cost label</label>
                <input
                  id="lp-goal-cost"
                  className="input"
                  value={costLabel}
                  onChange={(e) => setCostLabel(e.target.value)}
                  placeholder="e.g. ≈12,000৳ or Cost: 0"
                />
              </div>
              <div>
                <label className="lp-form-label" htmlFor="lp-goal-timing">Timing label</label>
                <input
                  id="lp-goal-timing"
                  className="input"
                  value={timingLabel}
                  onChange={(e) => setTimingLabel(e.target.value)}
                  placeholder="e.g. Before Jan 27, 2027"
                />
              </div>
              <div>
                <label className="lp-form-label" htmlFor="lp-goal-date">Exact date (optional)</label>
                <input
                  id="lp-goal-date"
                  type="date"
                  className="input"
                  value={timingDate}
                  onChange={(e) => setTimingDate(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="lp-form-label" htmlFor="lp-goal-cost">Cost label</label>
              <input
                id="lp-goal-cost"
                className="input"
                value={costLabel}
                onChange={(e) => setCostLabel(e.target.value)}
                placeholder="e.g. ≈12,000৳ or Cost: 0"
              />
            </div>
          )}

          {/* Dependencies */}
          <div className="lp-form-block">
            <div className="lp-form-block-title">
              <span>Depends on</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowDepPicker((v) => !v)}>
                {showDepPicker ? 'Done' : <><Plus size={12} /> Add dependency</>}
              </button>
            </div>
            {dependsOn.length === 0 && !showDepPicker && (
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>No dependencies — this goal can start anytime.</span>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {dependsOn.map((id) => {
                const g = doc.goals.find((x) => x.id === id);
                if (!g) return null;
                return (
                  <span key={id} className="lp-dep-chip">
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
              <div style={{ marginTop: 8 }}>
                <input
                  className="input"
                  value={depQuery}
                  onChange={(e) => setDepQuery(e.target.value)}
                  placeholder="Search goals…"
                  style={{ marginBottom: 6 }}
                />
                <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {depCandidates.length === 0 && (
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>No other goals found.</span>
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

          {/* Definition of Done */}
          <div>
            <label className="lp-form-label" htmlFor="lp-goal-dod">Definition of Done</label>
            <textarea
              id="lp-goal-dod"
              className="input"
              rows={2}
              value={dod}
              onChange={(e) => setDod(e.target.value)}
              placeholder="What does 'done' look like?"
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Tasks (new non-milestone entries only — milestones are containers) */}
          {!editing && !isMilestone && (
            <div className="lp-form-block">
              <div className="lp-form-block-title">
                <span>Tasks</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={addTask}><Plus size={12} /> Add task</button>
              </div>
              {tasks.map((t, ti) => (
                <div key={ti} style={{ border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', padding: 8, marginBottom: 8, background: 'var(--bg-card)' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      className="input"
                      value={t.name}
                      onChange={(e) => setTask(ti, { name: e.target.value })}
                      placeholder={`Task ${ti + 1} name`}
                      style={{ flex: 1 }}
                    />
                    <button type="button" className="lp-icon-btn" onClick={() => removeTask(ti)} aria-label="Remove task">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="lp-form-row" style={{ marginTop: 6 }}>
                    <input className="input" value={t.costLabel} onChange={(e) => setTask(ti, { costLabel: e.target.value })} placeholder="Cost (optional)" />
                    <input className="input" value={t.dueLabel} onChange={(e) => setTask(ti, { dueLabel: e.target.value })} placeholder="Due label (optional)" />
                    <input type="date" className="input" value={t.dueDate} onChange={(e) => setTask(ti, { dueDate: e.target.value })} />
                  </div>
                  {t.steps.map((s, si) => (
                    <div key={si} style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <input className="input" value={s.text} onChange={(e) => setStep(ti, si, { text: e.target.value })} placeholder={`Step ${si + 1}`} style={{ flex: 1 }} />
                      <input type="date" className="input" value={s.dueDate} onChange={(e) => setStep(ti, si, { dueDate: e.target.value })} style={{ maxWidth: 130 }} />
                      <button type="button" className="lp-icon-btn" onClick={() => removeStep(ti, si)} aria-label="Remove step">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => addStep(ti)}>
                    <Plus size={12} /> Add step
                  </button>
                </div>
              ))}
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                You can also save now and add tasks later from the goal's detail page.
              </span>
            </div>
          )}

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
