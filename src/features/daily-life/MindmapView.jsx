import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Workflow, Flag, Target, ListChecks, CheckCircle2, Circle,
  ChevronDown, ChevronRight, Lock, Maximize2, Minimize2, CalendarClock,
  ZoomIn, ZoomOut, Expand, Shrink, RotateCcw,
} from 'lucide-react';
import { LpEmpty } from './LifePlannerUI';
import {
  goalsOfMilestone, milestoneProgress, goalProgress, taskProgress, goalLocked, depsOfGoal,
  tasksOfGoal, stepsOfTask, byId, overallProgress, fmtDate, todayKey, goalDisplayNumber, goalAutoDeadline,
} from './lifePlannerStorage';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;

/**
 * Mindmap — open infinite canvas (same interaction as Prerequisite Tree):
 * Your Plans → Milestones → Goals → Tasks → Steps
 * Wheel/pinch zoom (cursor-anchored), drag empty space to pan, no scrollbars.
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

  const [expanded, setExpanded] = useState(() => new Set());
  const [isFullscreen, setFullscreen] = useState(false);
  const [view, setView] = useState({ scale: 1, x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [isZooming, setIsZooming] = useState(false);

  const viewportRef = useRef(null);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOffsetRef = useRef({ x: 40, y: 40 });
  const zoomTimerRef = useRef(null);
  const touchRef = useRef({ dist: 0, panning: false, startX: 0, startY: 0 });

  const { scale, x: panX, y: panY } = view;

  const flashZoom = useCallback(() => {
    setIsZooming(true);
    clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = setTimeout(() => setIsZooming(false), 260);
  }, []);

  const zoomAt = useCallback((delta, px, py) => {
    setView((prev) => {
      const next = Math.min(Math.max(prev.scale + delta, MIN_ZOOM), MAX_ZOOM);
      if (next === prev.scale) return prev;
      const ratio = next / prev.scale;
      const nv = {
        scale: next,
        x: px - (px - prev.x) * ratio,
        y: py - (py - prev.y) * ratio,
      };
      panOffsetRef.current = { x: nv.x, y: nv.y };
      return nv;
    });
    flashZoom();
  }, [flashZoom]);

  const zoomFromCenter = useCallback((delta) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    zoomAt(delta, (rect?.width || 0) / 2, (rect?.height || 0) / 2);
  }, [zoomAt]);

  const zoomIn = useCallback(() => zoomFromCenter(ZOOM_STEP), [zoomFromCenter]);
  const zoomOut = useCallback(() => zoomFromCenter(-ZOOM_STEP), [zoomFromCenter]);
  const zoomReset = useCallback(() => {
    setView({ scale: 1, x: 40, y: 40 });
    panOffsetRef.current = { x: 40, y: 40 };
    flashZoom();
  }, [flashZoom]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    const px = e.clientX - (rect?.left || 0);
    const py = e.clientY - (rect?.top || 0);
    zoomAt(e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP, px, py);
  }, [zoomAt]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  useEffect(() => () => clearTimeout(zoomTimerRef.current), []);

  const getTouchDist = (t) => {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e) => {
    if (e.target.closest('.lp-mm-node') || e.target.closest('button')) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      touchRef.current.dist = getTouchDist(e.touches);
    } else if (e.touches.length === 1) {
      touchRef.current.panning = true;
      touchRef.current.startX = e.touches[0].clientX - panX;
      touchRef.current.startY = e.touches[0].clientY - panY;
    }
  }, [panX, panY]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const newDist = getTouchDist(e.touches);
      const ratio = newDist / (touchRef.current.dist || 1);
      touchRef.current.dist = newDist;
      const rect = viewportRef.current?.getBoundingClientRect();
      const cx = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - (rect?.left || 0);
      const cy = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - (rect?.top || 0);
      setView((prev) => {
        const next = Math.min(Math.max(prev.scale * ratio, MIN_ZOOM), MAX_ZOOM);
        if (next === prev.scale) return prev;
        const r = next / prev.scale;
        const nv = {
          scale: next,
          x: cx - (cx - prev.x) * r,
          y: cy - (cy - prev.y) * r,
        };
        panOffsetRef.current = { x: nv.x, y: nv.y };
        return nv;
      });
      flashZoom();
    } else if (e.touches.length === 1 && touchRef.current.panning) {
      const tx = e.touches[0].clientX - touchRef.current.startX;
      const ty = e.touches[0].clientY - touchRef.current.startY;
      setView((prev) => ({ ...prev, x: tx, y: ty }));
    }
  }, [flashZoom]);

  const handleTouchEnd = useCallback(() => {
    if (touchRef.current.panning) {
      touchRef.current.panning = false;
      panOffsetRef.current = { x: panX, y: panY };
    }
    touchRef.current.dist = 0;
  }, [panX, panY]);

  const handlePanStart = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.lp-mm-node') || e.target.closest('button')) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePanMove = useCallback((e) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setView((prev) => ({
      ...prev,
      x: panOffsetRef.current.x + dx,
      y: panOffsetRef.current.y + dy,
    }));
  }, [isPanning]);

  const handlePanEnd = useCallback(() => {
    if (!isPanning) return;
    setIsPanning(false);
    panOffsetRef.current = { x: panX, y: panY };
  }, [isPanning, panX, panY]);

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e) => handlePanMove(e);
    const onUp = () => handlePanEnd();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isPanning, handlePanMove, handlePanEnd]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isFullscreen) setFullscreen(false);
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomIn(); }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') { e.preventDefault(); zoomOut(); }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') { e.preventDefault(); zoomReset(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreen, zoomIn, zoomOut, zoomReset]);

  useEffect(() => {
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isFullscreen]);

  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const expandAll = () => {
    const all = new Set(['__root__']);
    milestones.forEach((m) => all.add(m.id));
    doc.goals.forEach((g) => all.add(g.id));
    doc.tasks.forEach((t) => all.add(t.id));
    if (unassigned.length) all.add('__unassigned__');
    setExpanded(all);
  };
  const collapseAll = () => setExpanded(new Set());

  if (milestones.length === 0 && unassigned.length === 0) {
    return (
      <LpEmpty
        icon={Workflow}
        title="Nothing to map yet"
        hint="Create milestones, goals, tasks and steps — click Your Plans to explore the tree."
      />
    );
  }

  const totalGoals = doc.goals.length - milestones.length;
  const totalSteps = doc.steps.length;
  const rootExpanded = expanded.has('__root__');

  return (
    <div className={`lp-mm ${isFullscreen ? 'lp-mm-fullscreen' : ''}`}>
      <div className="lp-mm-toolbar">
        <span className="lp-mm-hint">
          <Workflow size={13} />
          <span>
            <strong>Click</strong> a node to expand / collapse ·
            <strong> Scroll</strong> to zoom ·
            <strong> Drag</strong> canvas to pan
          </span>
        </span>
        <div className="lp-mm-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={expandAll}><Maximize2 size={12} /> Expand all</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={collapseAll}><Minimize2 size={12} /> Collapse all</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onViewTimeline}><CalendarClock size={12} /> View timeline</button>
        </div>
        <div className="lp-mm-actions lp-mm-zoom-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={zoomOut} disabled={scale <= MIN_ZOOM} aria-label="Zoom out"><ZoomOut size={14} /></button>
          <span className={`lp-mm-zoom-label${isZooming ? ' is-zooming' : ''}`}>{Math.round(scale * 100)}%</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={zoomIn} disabled={scale >= MAX_ZOOM} aria-label="Zoom in"><ZoomIn size={14} /></button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={zoomReset} aria-label="Reset view"><RotateCcw size={12} /></button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFullscreen((v) => !v)} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <Shrink size={14} /> : <Expand size={14} />}
          </button>
        </div>
      </div>

      <div className="lp-mm-legend">
        {[
          ['Milestone', 'var(--accent-purple)'],
          ['Goal', 'var(--accent-amber)'],
          ['Task', 'var(--accent-cyan)'],
          ['Step', 'var(--accent-emerald)'],
        ].map(([label, color]) => (
          <span key={label} className="lp-mm-legend-item"><i style={{ background: color }} /> {label}</span>
        ))}
      </div>

      <div
        className={`lp-mm-canvas ${isPanning ? 'is-panning' : ''}`}
        ref={viewportRef}
        onMouseDown={handlePanStart}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div
          className={`lp-mm-transform-layer${isZooming ? ' is-zooming' : ''}`}
          style={{ transform: `translate(${panX}px, ${panY}px) scale(${scale})` }}
        >
        {/* Root row: Your Plans node + its children (milestones) to the right */}
        <div className="lp-mm-root-row">
          <div className="lp-mm-node-wrap">
            <MmNodeCard
              color="var(--accent-amber)"
              icon={Workflow}
              kicker="Life Plan"
              title="Your Plans"
              sub={`${milestones.length} milestone${milestones.length === 1 ? '' : 's'} · ${totalGoals} goal${totalGoals === 1 ? '' : 's'} · ${doc.tasks.length} task${doc.tasks.length === 1 ? '' : 's'} · ${totalSteps} step${totalSteps === 1 ? '' : 's'}`}
              pct={overallProgress(doc)}
              hasChildren={milestones.length > 0 || unassigned.length > 0}
              collapsed={!rootExpanded}
              onToggle={() => toggle('__root__')}
              onClick={() => toggle('__root__')}
            />
            {/* connector from root node edge to children spine */}
            {rootExpanded && (milestones.length > 0 || unassigned.length > 0) && (
              <span className="lp-mm-edge-connector" style={{ '--mm': 'var(--accent-amber)' }} />
            )}
          </div>

          {rootExpanded && (
            <ul className="lp-mm-branches lp-mm-branches-root">
              {milestones.map((m, idx) => (
                <MilestoneBranch
                  key={m.id}
                  doc={doc}
                  m={m}
                  idx={idx}
                  expanded={expanded}
                  toggle={toggle}
                  onOpenMilestone={onOpenMilestone}
                  onOpenGoal={onOpenGoal}
                  onOpenTask={onOpenTask}
                />
              ))}
              {unassigned.length > 0 && (
                <li className="lp-mm-branch" style={{ '--mm': 'var(--text-tertiary)' }}>
                  <div className="lp-mm-branch-main">
                    <MmNodeCard
                      color="var(--text-tertiary)"
                      icon={Flag}
                      kicker="Unassigned"
                      title={`${unassigned.length} goal${unassigned.length === 1 ? '' : 's'} without milestone`}
                      pct={Math.round(unassigned.reduce((s, g) => s + goalProgress(doc, g.id), 0) / unassigned.length)}
                      hasChildren={true}
                      collapsed={!expanded.has('__unassigned__')}
                      onToggle={() => toggle('__unassigned__')}
                      onClick={() => toggle('__unassigned__')}
                    />
                  </div>
                  {expanded.has('__unassigned__') && (
                    <ul className="lp-mm-children">
                      {unassigned.map((g) => (
                        <GoalBranch
                          key={g.id}
                          doc={doc}
                          g={g}
                          expanded={expanded}
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
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

// ── Branches ─────────────────────────────────────────────────────────────────

function MilestoneBranch({ doc, m, idx, expanded, toggle, onOpenMilestone, onOpenGoal, onOpenTask }) {
  const goals = goalsOfMilestone(doc, m.id);
  const pct = milestoneProgress(doc, m.id);
  const isExpanded = expanded.has(m.id);
  const overdue = m.timingDate && m.timingDate < todayKey() && pct < 100;
  return (
    <li className="lp-mm-branch" style={{ '--mm': 'var(--accent-purple)' }}>
      <div className="lp-mm-branch-main">
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
          collapsed={!isExpanded}
          onToggle={() => toggle(m.id)}
          onClick={() => toggle(m.id)}
        />
        {isExpanded && goals.length > 0 && (
          <span className="lp-mm-edge-connector" style={{ '--mm': 'var(--accent-purple)' }} />
        )}
      </div>
      {isExpanded && goals.length > 0 && (
        <ul className="lp-mm-children">
          {goals.map((g) => (
            <GoalBranch
              key={g.id}
              doc={doc}
              g={g}
              expanded={expanded}
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

function GoalBranch({ doc, g, expanded, toggle, onOpenGoal, onOpenTask }) {
  const tasks = tasksOfGoal(doc, g.id);
  const pct = goalProgress(doc, g.id);
  const isExpanded = expanded.has(g.id);
  const autoDl = goalAutoDeadline(doc, g.id);
  const overdue = autoDl && autoDl < todayKey() && pct < 100;
  const locked = goalLocked(doc, g.id);
  const depTitles = depsOfGoal(doc, g.id)
    .map((d) => byId(doc.goals, d.dependsOnGoalId)?.title)
    .filter(Boolean);
  return (
    <li className="lp-mm-branch" style={{ '--mm': 'var(--accent-amber)' }}>
      <div className="lp-mm-branch-main">
        <MmNodeCard
          color="var(--accent-amber)"
          icon={Target}
          kicker={`Goal G${goalDisplayNumber(doc, g)}`}
          title={g.title}
          sub={`${tasks.length} task${tasks.length === 1 ? '' : 's'}`}
          pct={pct}
          badge={autoDl ? (
            <span className={`lp-badge ${overdue ? 'lp-badge-rose' : 'lp-badge-cyan'}`}><CalendarClock size={10} /> {overdue ? 'Overdue ' : ''}{fmtDate(autoDl)}</span>
          ) : null}
          locked={locked}
          lockTitle={locked && depTitles.length ? `Waiting on: ${depTitles.join(', ')}` : undefined}
          hasChildren={tasks.length > 0}
          collapsed={!isExpanded}
          onToggle={() => toggle(g.id)}
          onClick={() => toggle(g.id)}
        />
        {isExpanded && tasks.length > 0 && (
          <span className="lp-mm-edge-connector" style={{ '--mm': 'var(--accent-amber)' }} />
        )}
      </div>
      {isExpanded && tasks.length > 0 && (
        <ul className="lp-mm-children">
          {tasks.map((t) => (
            <TaskBranch
              key={t.id}
              doc={doc}
              t={t}
              expanded={expanded}
              toggle={toggle}
              onOpenTask={onOpenTask}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function TaskBranch({ doc, t, expanded, toggle, onOpenTask }) {
  const steps = stepsOfTask(doc, t.id);
  const done = steps.filter((s) => s.isDone).length;
  const pct = taskProgress(doc, t.id);
  const isExpanded = expanded.has(t.id);
  const autoEnd = t.isRecurring ? (t.recurringEndDate || t.recurringUntil || null) : (t.dueDate || null);
  const overdue = autoEnd && autoEnd < todayKey() && pct < 100;
  return (
    <li className="lp-mm-branch" style={{ '--mm': 'var(--accent-cyan)' }}>
      <div className="lp-mm-branch-main">
        <MmNodeCard
          color="var(--accent-cyan)"
          icon={ListChecks}
          title={t.name}
          sub={steps.length ? `${done}/${steps.length} step${steps.length === 1 ? '' : 's'} done` : (t.manualDone ? 'Completed' : 'No steps')}
          pct={pct}
          badge={t.isRecurring ? (
            <span className="lp-badge lp-badge-amber"><CalendarClock size={10} /> {(t.recurringWeekdays||[]).join(', ')} → {fmtDate(autoEnd || t.recurringEndDate)}</span>
          ) : autoEnd ? (
            <span className={`lp-badge ${overdue ? 'lp-badge-rose' : 'lp-badge-cyan'}`}><CalendarClock size={10} /> {overdue ? 'Overdue ' : ''}{fmtDate(autoEnd)}</span>
          ) : null}
          hasChildren={steps.length > 0}
          collapsed={!isExpanded}
          onToggle={() => toggle(t.id)}
          onClick={() => toggle(t.id)}
        />
        {isExpanded && steps.length > 0 && (
          <span className="lp-mm-edge-connector" style={{ '--mm': 'var(--accent-cyan)' }} />
        )}
      </div>
      {isExpanded && steps.length > 0 && (
        <ul className="lp-mm-children">
          {steps.map((s) => (
            <li key={s.id} className="lp-mm-branch lp-mm-leaf" style={{ '--mm': 'var(--accent-emerald)' }}>
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
                onClick={undefined}
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
        {showPct && pct !== undefined && <span className="lp-mm-pct">{pct}%</span>}
        {locked && <Lock size={11} className="lp-mm-lock" aria-label={lockTitle} />}
        {badge}
      </span>
      {showPct && pct !== undefined && <span className="lp-mm-bar"><i style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} /></span>}
    </div>
  );
}
