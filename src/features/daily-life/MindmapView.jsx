import { useState, useMemo } from 'react';
import {
  Workflow, Flag, Target, ListChecks, CheckCircle2, Circle,
  ChevronDown, ChevronRight, Lock, Maximize2, Minimize2, CalendarClock,
} from 'lucide-react';
import { LpEmpty } from './LifePlannerUI';
import {
  goalsOfMilestone, milestoneProgress, goalProgress, goalLocked, depsOfGoal,
  tasksOfGoal, stepsOfTask, byId, overallProgress, fmtDate, todayKey,
} from './lifePlannerStorage';

/**
 * Mindmap (Section 5.x): draws the planner hierarchy as a connected
 * left-to-right mindmap tree — Life Plan → Milestones → Goals → Tasks →
 * Subtasks — with progress, deadlines (timeline), dependency locks and
 * click-to-open navigation into the Goals view.
 */
export default function MindmapView({ doc, onOpenMilestone, onOpenGoal, onOpenTask, onViewTimeline }) {
  const milestones = useMemo(
    () => doc.goals.filter((g) => (g.types || []).includes('milestone')).sort((a, b) => (a.order || 0) - (b.order || 0)),
    [doc.goals],
  );
  const unassigned = useMemo(
    () => doc.goals
      .filter((g) => !(g.types || []).includes('milestone') && !g.milestoneId && !g.phaseId)
      .sort((a, b) => (a.order || 0) - (b.order || 0)),
    [doc.goals],
  );
  const [collapsed, setCollapsed] = useState(() => new Set());

  const toggle = (id) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set([
    ...milestones.map((m) => m.id),
    ...doc.goals.map((g) => g.id),
    ...doc.tasks.map((t) => t.id),
    ...(unassigned.length > 0 ? ['__unassigned__'] : []),
  ]));

  if (milestones.length === 0 && unassigned.length === 0) {
    return (
      <LpEmpty
        icon={Workflow}
        title="Nothing to map yet"
        hint="Create milestones, goals, tasks and subtasks — this view draws them as one connected mindmap."
      />
    );
  }

  const totalGoals = doc.goals.length - milestones.length;
  const totalSteps = doc.steps.length;

  return (
    <div className="lp-mm">
      <div className="lp-mm-toolbar">
        <span className="lp-mm-hint">
          <Workflow size={13} /> Click any node to open it in Goals — dates show your timeline
        </span>
        <div className="lp-mm-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={expandAll}><Maximize2 size={12} /> Expand all</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={collapseAll}><Minimize2 size={12} /> Collapse all</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onViewTimeline}><CalendarClock size={12} /> View timeline</button>
        </div>
      </div>

      <div className="lp-mm-legend">
        {[
          ['Milestone', 'var(--accent-purple)'],
          ['Goal', 'var(--accent-amber)'],
          ['Task', 'var(--accent-cyan)'],
          ['Subtask', 'var(--accent-emerald)'],
        ].map(([label, color]) => (
          <span key={label} className="lp-mm-legend-item"><i style={{ background: color }} /> {label}</span>
        ))}
      </div>

      <div className="lp-mm-canvas">
        {/* Root — Life Plan */}
        <div className="lp-mm-root-node">
          <MmNodeCard
            color="var(--accent-amber)"
            icon={Workflow}
            kicker="Life Plan"
            title="Your plan"
            sub={`${milestones.length} milestone${milestones.length === 1 ? '' : 's'} · ${totalGoals} goal${totalGoals === 1 ? '' : 's'} · ${doc.tasks.length} task${doc.tasks.length === 1 ? '' : 's'} · ${totalSteps} subtask${totalSteps === 1 ? '' : 's'}`}
            pct={overallProgress(doc)}
          />
        </div>

        <ul className="lp-mm-branches">
          {milestones.map((m, idx) => (
            <MilestoneBranch
              key={m.id}
              doc={doc}
              m={m}
              idx={idx}
              collapsed={collapsed}
              toggle={toggle}
              onOpenMilestone={onOpenMilestone}
              onOpenGoal={onOpenGoal}
              onOpenTask={onOpenTask}
            />
          ))}

          {unassigned.length > 0 && (
            <li className="lp-mm-branch" style={{ '--mm': 'var(--text-tertiary)' }}>
              <MmNodeCard
                color="var(--text-tertiary)"
                icon={Flag}
                kicker="Unassigned"
                title={`${unassigned.length} goal${unassigned.length === 1 ? '' : 's'} without a milestone`}
                pct={Math.round(unassigned.reduce((s, g) => s + goalProgress(doc, g.id), 0) / unassigned.length)}
                hasChildren={!collapsed.has('__unassigned__')}
                collapsed={collapsed.has('__unassigned__')}
                onToggle={() => toggle('__unassigned__')}
              />
              {!collapsed.has('__unassigned__') && (
                <ul className="lp-mm-children">
                  {unassigned.map((g) => (
                    <GoalBranch
                      key={g.id}
                      doc={doc}
                      g={g}
                      collapsed={collapsed}
                      toggle={toggle}
                      onOpenGoal={onOpenGoal}
                      onOpenTask={onOpenTask}
                    />
                  ))}
                </ul>
              )}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

// ── Branches ─────────────────────────────────────────────────────────────────

function MilestoneBranch({ doc, m, idx, collapsed, toggle, onOpenMilestone, onOpenGoal, onOpenTask }) {
  const goals = goalsOfMilestone(doc, m.id);
  const pct = milestoneProgress(doc, m.id);
  const isCollapsed = collapsed.has(m.id);
  const overdue = m.timingDate && m.timingDate < todayKey() && pct < 100;
  return (
    <li className="lp-mm-branch" style={{ '--mm': 'var(--accent-purple)' }}>
      <MmNodeCard
        color="var(--accent-purple)"
        icon={Flag}
        kicker={`Milestone ${idx + 1}`}
        title={m.title}
        sub={`${goals.length} goal${goals.length === 1 ? '' : 's'}`}
        pct={pct}
        badge={m.timingDate ? (
          <span className={`lp-badge ${overdue ? 'lp-badge-rose' : 'lp-badge-cyan'}`}><CalendarClock size={10} /> {overdue ? 'Overdue ' : ''}{fmtDate(m.timingDate)}</span>
        ) : null}
        hasChildren={goals.length > 0}
        collapsed={isCollapsed}
        onToggle={() => toggle(m.id)}
        onClick={() => onOpenMilestone(m)}
      />
      {goals.length > 0 && !isCollapsed && (
        <ul className="lp-mm-children">
          {goals.map((g) => (
            <GoalBranch
              key={g.id}
              doc={doc}
              g={g}
              collapsed={collapsed}
              toggle={toggle}
              onOpenGoal={onOpenGoal}
              onOpenTask={onOpenTask}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function GoalBranch({ doc, g, collapsed, toggle, onOpenGoal, onOpenTask }) {
  const tasks = tasksOfGoal(doc, g.id);
  const pct = goalProgress(doc, g.id);
  const isCollapsed = collapsed.has(g.id);
  const overdue = g.timingDate && g.timingDate < todayKey() && pct < 100;
  const locked = goalLocked(doc, g.id);
  const depTitles = depsOfGoal(doc, g.id)
    .map((d) => byId(doc.goals, d.dependsOnGoalId)?.title)
    .filter(Boolean);
  return (
    <li className="lp-mm-branch" style={{ '--mm': 'var(--accent-amber)' }}>
      <MmNodeCard
        color="var(--accent-amber)"
        icon={Target}
        kicker={`Goal G${g.number}`}
        title={g.title}
        sub={`${tasks.length} task${tasks.length === 1 ? '' : 's'}`}
        pct={pct}
        badge={g.timingDate ? (
          <span className={`lp-badge ${overdue ? 'lp-badge-rose' : 'lp-badge-cyan'}`}><CalendarClock size={10} /> {overdue ? 'Overdue ' : ''}{fmtDate(g.timingDate)}</span>
        ) : null}
        locked={locked}
        lockTitle={locked && depTitles.length ? `Waiting on: ${depTitles.join(', ')}` : undefined}
        hasChildren={tasks.length > 0}
        collapsed={isCollapsed}
        onToggle={() => toggle(g.id)}
        onClick={() => onOpenGoal(g)}
      />
      {tasks.length > 0 && !isCollapsed && (
        <ul className="lp-mm-children">
          {tasks.map((t) => (
            <TaskBranch
              key={t.id}
              doc={doc}
              t={t}
              collapsed={collapsed}
              toggle={toggle}
              onOpenTask={onOpenTask}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function TaskBranch({ doc, t, collapsed, toggle, onOpenTask }) {
  const steps = stepsOfTask(doc, t.id);
  const done = steps.filter((s) => s.isDone).length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const isCollapsed = collapsed.has(t.id);
  const overdue = t.dueDate && t.dueDate < todayKey() && pct < 100;
  return (
    <li className="lp-mm-branch" style={{ '--mm': 'var(--accent-cyan)' }}>
      <MmNodeCard
        color="var(--accent-cyan)"
        icon={ListChecks}
        title={t.name}
        sub={`${done}/${steps.length} subtask${steps.length === 1 ? '' : 's'} done`}
        pct={pct}
        badge={t.dueDate ? (
          <span className={`lp-badge ${overdue ? 'lp-badge-rose' : 'lp-badge-cyan'}`}><CalendarClock size={10} /> {overdue ? 'Overdue ' : ''}{fmtDate(t.dueDate)}</span>
        ) : null}
        hasChildren={steps.length > 0}
        collapsed={isCollapsed}
        onToggle={() => toggle(t.id)}
        onClick={() => onOpenTask(t)}
      />
      {steps.length > 0 && !isCollapsed && (
        <ul className="lp-mm-children">
          {steps.map((s) => (
            <li key={s.id} className="lp-mm-branch" style={{ '--mm': 'var(--accent-emerald)' }}>
              <MmNodeCard
                color="var(--accent-emerald)"
                icon={s.isDone ? CheckCircle2 : Circle}
                title={s.text}
                done={s.isDone}
                badge={s.dueDate ? (
                  <span className={`lp-badge ${s.dueDate < todayKey() && !s.isDone ? 'lp-badge-rose' : s.isDone ? 'lp-badge-emerald' : 'lp-badge-muted'}`}><CalendarClock size={10} /> {fmtDate(s.dueDate)}</span>
                ) : s.isDone ? (
                  <span className="lp-badge lp-badge-emerald">Done</span>
                ) : null}
                onClick={() => onOpenTask(t)}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// ── Shared node card ─────────────────────────────────────────────────────────

function MmNodeCard({
  color, icon: Icon, kicker, title, sub, pct, showPct = true, badge,
  locked = false, lockTitle, done = false, hasChildren = false,
  collapsed = false, onToggle, onClick,
}) {
  return (
    <div
      className={`lp-mm-node${done ? ' done' : ''}`}
      style={{ '--mm': color }}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' && onClick) onClick(); }}
      title={lockTitle}
    >
      {hasChildren && (
        <button
          type="button"
          className="lp-mm-toggle"
          onClick={(e) => { e.stopPropagation(); if (onToggle) onToggle(); }}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </button>
      )}
      <span className="lp-mm-icon"><Icon size={15} /></span>
      <span className="lp-mm-text">
        {kicker && <span className="lp-mm-kicker">{kicker}</span>}
        <span className="lp-mm-title">{title}</span>
        {sub && <span className="lp-mm-sub">{sub}</span>}
      </span>
      <span className="lp-mm-side">
        {showPct && <span className="lp-mm-pct">{pct}%</span>}
        {locked && <Lock size={11} className="lp-mm-lock" aria-label={lockTitle} />}
        {badge}
      </span>
      {showPct && <span className="lp-mm-bar"><i style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} /></span>}
    </div>
  );
}