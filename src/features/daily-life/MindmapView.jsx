import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  Workflow, Flag, Target, ListChecks, CheckCircle2, Circle,
  ChevronLeft, Lock, Maximize2, Minimize2, CalendarClock,
  ZoomIn, ZoomOut, Expand, Shrink, RotateCcw,
} from 'lucide-react';
import { LpEmpty } from './LifePlannerUI';
import {
  goalsOfMilestone, milestoneProgress, goalProgress, taskProgress, goalLocked, depsOfGoal,
  tasksOfGoal, stepsOfTask, byId, overallProgress, fmtDate, todayKey, goalDisplayNumber, goalAutoDeadline,
} from './lifePlannerStorage';
import brandMark from '../../assets/austwise-icon-final.svg';
import './MindmapView.css';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;
const EXPORT_PAD = 40;

// Export requests are Date.now() tokens from LifePlannerPage. Remembered at
// module level so remounting the view (e.g. switching tabs) never re-exports.
let lastHandledExport = 0;

// rAF is paused in background tabs; the timeout keeps the export moving there
const nextFrame = () => new Promise((r) => {
  const t = setTimeout(r, 50);
  requestAnimationFrame(() => { clearTimeout(t); r(); });
});

/** First non-transparent background going up from `el` (the capture's backdrop). */
function solidBackground(el) {
  for (let n = el; n; n = n.parentElement) {
    const c = getComputedStyle(n).backgroundColor;
    if (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) return c;
  }
  return '#ffffff';
}

/**
 * Wrap the mindmap capture in an AUSTWise-branded sheet: logo + wordmark +
 * "Life Planner · Mindmap" header with date and plan stats, the map in a
 * bordered card, and a "Made with AUSTWise" footer. Flat theme surfaces only
 * (house style: no gradients / glows). `brand` = routineExport's helpers.
 */
function drawBrandedFrame(shot, brand, logo, stats) {
  const { readPalette, setFont, drawBrand, roundRect } = brand;
  const P = readPalette();
  const S = 2; // the capture is rendered at 2x
  const M = 40 * S;
  const headerH = 64 * S;
  const gap = 20 * S;
  const footerH = 28 * S;
  const W = Math.max(shot.width + M * 2, 760 * S);
  const H = M + headerH + gap + shot.height + gap + footerH + M * 0.75;

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d');
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, H);

  // Header: brand left, date + stats right
  drawBrand(ctx, P, logo, M, M, 44 * S, 'left', 'Life Planner · Mindmap');
  const now = new Date();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  setFont(ctx, P, 15 * S, 700);
  ctx.fillStyle = P.text;
  ctx.fillText(now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), W - M, M + 14 * S);
  setFont(ctx, P, 11.5 * S, 500);
  ctx.fillStyle = P.text3;
  ctx.fillText(stats, W - M, M + 36 * S);

  // Divider under the header
  const divY = M + headerH;
  ctx.fillStyle = P.border;
  ctx.fillRect(M, divY, W - M * 2, 1 * S);

  // The map in a rounded, bordered card
  const cardX = M;
  const cardY = divY + gap;
  const r = 16 * S;
  ctx.save();
  roundRect(ctx, cardX, cardY, shot.width, shot.height, r);
  ctx.clip();
  ctx.drawImage(shot, cardX, cardY);
  ctx.restore();
  roundRect(ctx, cardX + 0.5 * S, cardY + 0.5 * S, shot.width - S, shot.height - S, r);
  ctx.lineWidth = 1 * S;
  ctx.strokeStyle = P.border;
  ctx.stroke();

  // Footer: "Made with AUSTWise" left, export time right
  const fy = cardY + shot.height + gap + footerH / 2;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  setFont(ctx, P, 12 * S, 500);
  ctx.fillStyle = P.text3;
  const made = 'Made with ';
  ctx.fillText(made, M, fy);
  const madeW = ctx.measureText(made).width;
  setFont(ctx, P, 12 * S, 800);
  ctx.fillStyle = P.accent;
  ctx.fillText('AUSTWise', M + madeW, fy);
  const brandW = ctx.measureText('AUSTWise').width;
  setFont(ctx, P, 12 * S, 500);
  ctx.fillStyle = P.text3;
  ctx.fillText('  ·  Life Planner', M + madeW + brandW, fy);
  ctx.textAlign = 'right';
  ctx.fillText(`Exported ${now.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`, W - M, fy);
  return out;
}

/**
 * Mindmap — open infinite canvas (same interaction as Prerequisite Tree):
 * Your Plans → Milestones → Goals → Tasks → Steps
 * Wheel/pinch zoom (cursor-anchored), drag empty space to pan, no scrollbars.
 */
export default function MindmapView({ doc, onOpenMilestone, onOpenGoal, onOpenTask, onViewTimeline, exportRequest = 0, onExportDone }) {
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

  const layerRef = useRef(null);
  const [links, setLinks] = useState({ w: 0, h: 0, paths: [] });

  // Measure every node in un-scaled layer coordinates and build curved links
  const measureLinks = useCallback(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const pos = (el) => {
      let x = 0; let y = 0; let n = el;
      while (n && n !== layer) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      return { x, y, w: el.offsetWidth, h: el.offsetHeight };
    };
    const nodes = new Map();
    layer.querySelectorAll('[data-mm-key]').forEach((el) => nodes.set(el.dataset.mmKey, el));
    const paths = [];
    nodes.forEach((el, key) => {
      const parentKey = el.dataset.mmParent;
      const parent = parentKey && nodes.get(parentKey);
      if (!parent) return;
      const a = pos(parent);
      const b = pos(el);
      const x1 = a.x + a.w + 11; // leave from the edge toggle
      const y1 = a.y + a.h / 2;
      paths.push({
        key,
        level: el.dataset.mmLevel,
        locked: el.dataset.mmLocked === '1',
        d: sketchCurve(x1, y1, b.x - 2, b.y + b.h / 2, key),
      });
    });
    setLinks({ w: layer.scrollWidth, h: layer.scrollHeight, paths });
  }, []);

  useLayoutEffect(() => { measureLinks(); }, [measureLinks, expanded, doc, isFullscreen]);

  // Re-measure whenever the layout moves, not only when the layer box resizes:
  // a breakpoint change (phone ↔ desktop), live CSS or late-loading fonts shift
  // nodes while the layer keeps its size, which left the links stranded.
  // Branch lists are watched by border-box so padding changes count too.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return undefined;
    let timer = 0; // batched; setTimeout (not rAF) so background tabs still update
    const remeasure = () => { clearTimeout(timer); timer = setTimeout(measureLinks, 16); };
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(remeasure);
      ro.observe(layer);
      layer.querySelectorAll('.lp-mm-root-row, .lp-mm-branches, .lp-mm-children, [data-mm-key]')
        .forEach((el) => ro.observe(el, { box: 'border-box' }));
    }
    window.addEventListener('resize', remeasure);
    document.fonts?.ready?.then(remeasure).catch(() => {});
    return () => {
      clearTimeout(timer);
      ro?.disconnect();
      window.removeEventListener('resize', remeasure);
    };
  }, [measureLinks, expanded, doc, isFullscreen]);

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

  const allExpandedKeys = useCallback(() => {
    const all = new Set(['__root__']);
    milestones.forEach((m) => all.add(m.id));
    doc.goals.forEach((g) => all.add(g.id));
    doc.tasks.forEach((t) => all.add(t.id));
    if (unassigned.length) all.add('__unassigned__');
    return all;
  }, [milestones, doc.goals, doc.tasks, unassigned.length]);

  const expandAll = () => setExpanded(allExpandedKeys());
  const collapseAll = () => setExpanded(new Set());

  // Latest values for the async export (it runs across several renders)
  const latestRef = useRef({});
  useLayoutEffect(() => {
    latestRef.current = { expanded, allExpandedKeys, onExportDone, doc, milestoneCount: milestones.length };
  });

  // "Export mindmap": expand every node, capture the whole layer as a PNG at
  // 100% zoom (in html2canvas's clone, so the on-screen zoom/pan never moves),
  // then put the user's expansion back.
  useEffect(() => {
    if (!exportRequest || exportRequest === lastHandledExport) return;
    lastHandledExport = exportRequest;
    (async () => {
      const { expanded: prevExpanded, allExpandedKeys: allKeys } = latestRef.current;
      const done = () => latestRef.current.onExportDone?.();
      if (!layerRef.current) { done(); return; } // empty planner: nothing to map
      // Full titles in the image: unclamp them live so the links are measured
      // against the final node sizes (html2canvas can't draw line-clamp).
      const liveLayer = layerRef.current;
      liveLayer.classList.add('lp-mm-export-full');
      try {
        setExpanded(allKeys());
        await nextFrame();
        await nextFrame();
        measureLinks();
        await nextFrame();

        const layer = layerRef.current;
        const canvasEl = viewportRef.current;
        if (!layer || !canvasEl) return;
        const width = layer.scrollWidth + EXPORT_PAD * 2;
        const height = layer.scrollHeight + EXPORT_PAD * 2;
        // Theme colours can be lost when html2canvas serialises the SVG links,
        // so hand each path its resolved stroke before cloning.
        const linkStyles = [...layer.querySelectorAll('.lp-mm-link')].map((p) => {
          const cs = getComputedStyle(p);
          return { stroke: cs.stroke, width: cs.strokeWidth, dash: cs.strokeDasharray, opacity: cs.strokeOpacity };
        });
        const { default: html2canvas } = await import('html2canvas-pro');
        const shot = await html2canvas(layer, {
          backgroundColor: solidBackground(canvasEl),
          scale: 2,
          useCORS: true,
          width,
          height,
          // Keep the clone at the live window size so the same breakpoint
          // (phone vs desktop) applies: the links were measured on this layout.
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          onclone: (cloneDoc) => {
            const cl = cloneDoc.querySelector('[data-mm-export-layer]');
            if (!cl) return;
            const vp = cl.parentElement;
            vp.style.height = `${height}px`;
            vp.style.width = `${width}px`;
            vp.style.overflow = 'visible';
            cl.style.transform = 'none';
            cl.style.width = `${width}px`;
            cl.style.height = `${height}px`;
            cl.style.boxSizing = 'border-box';
            cl.style.padding = `${EXPORT_PAD}px`;
            cl.classList.add('lp-mm-exporting');
            cl.querySelectorAll('.lp-mm-link').forEach((p, i) => {
              const s = linkStyles[i];
              if (!s) return;
              p.setAttribute('stroke', s.stroke);
              p.setAttribute('stroke-width', s.width);
              p.setAttribute('fill', 'none');
              if (s.dash && s.dash !== 'none') p.setAttribute('stroke-dasharray', s.dash);
              if (s.opacity) p.setAttribute('stroke-opacity', s.opacity);
            });
            // Links were measured without the export padding; shift them with the nodes
            const svg = cl.querySelector('.lp-mm-links');
            if (svg) { svg.style.top = `${EXPORT_PAD - 8}px`; svg.style.left = `${EXPORT_PAD - 8}px`; }
          },
        });

        // Frame the capture with AUSTWise branding (same brand helpers as the
        // routine export) and save it.
        const brand = await import('../dashboard/routineExport');
        const logo = await brand.loadLogo(brandMark);
        const { doc: d0, milestoneCount } = latestRef.current;
        const goalCount = d0.goals.length - milestoneCount;
        const stats = [
          `${milestoneCount} milestone${milestoneCount === 1 ? '' : 's'}`,
          `${goalCount} goal${goalCount === 1 ? '' : 's'}`,
          `${d0.tasks.length} task${d0.tasks.length === 1 ? '' : 's'}`,
          `${d0.steps.length} step${d0.steps.length === 1 ? '' : 's'}`,
          `${overallProgress(d0)}% done`,
        ].join('  ·  ');
        const framed = drawBrandedFrame(shot, brand, logo, stats);

        const d = new Date();
        const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        brand.saveBlob(await brand.toBlob(framed, 'image/png'), `AUSTWise-Life-Planner-Mindmap-${stamp}.png`);
      } catch (err) {
        console.error('Mindmap export failed:', err);
      } finally {
        liveLayer.classList.remove('lp-mm-export-full');
        setExpanded(prevExpanded || new Set());
        done();
      }
    })();
  }, [exportRequest, measureLinks]);

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
      <div className="pb-card pb-mm-bar">
        <div className="pb-mm-group">
          <button type="button" className="pb-btn-soft" onClick={expandAll}><Maximize2 size={13} /> <span>Expand all</span></button>
          <button type="button" className="pb-btn-soft" onClick={collapseAll}><Minimize2 size={13} /> <span>Collapse all</span></button>
          <button type="button" className="pb-btn-soft" onClick={onViewTimeline}><CalendarClock size={13} /> <span>Timeline</span></button>
        </div>
        <div className="pb-mm-legend" aria-hidden="true">
          <span><i className="lv-m" /> Milestone</span>
          <span><i className="lv-g" /> Goal</span>
          <span><i className="lv-t" /> Task</span>
          <span><i className="lv-s" /> Step</span>
        </div>
        <div className="pb-zoom" role="group" aria-label="Zoom">
          <button type="button" className="pb-icon" onClick={zoomOut} disabled={scale <= MIN_ZOOM} aria-label="Zoom out"><ZoomOut size={15} /></button>
          <span className={`pb-zoom-value${isZooming ? ' is-zooming' : ''}`}>{Math.round(scale * 100)}%</span>
          <button type="button" className="pb-icon" onClick={zoomIn} disabled={scale >= MAX_ZOOM} aria-label="Zoom in"><ZoomIn size={15} /></button>
          <span className="pb-zoom-sep" aria-hidden="true" />
          <button type="button" className="pb-icon" onClick={zoomReset} aria-label="Reset view" title="Reset view"><RotateCcw size={14} /></button>
          <button type="button" className="pb-icon" onClick={() => setFullscreen((v) => !v)} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <Shrink size={14} /> : <Expand size={14} />}
          </button>
        </div>
      </div>
      <p className="pb-mm-hint"><Workflow size={12} /> Click a node to open it · chevron to expand · scroll or pinch to zoom · drag to pan</p>

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
          ref={layerRef}
          data-mm-export-layer=""
          className={`lp-mm-transform-layer${isZooming ? ' is-zooming' : ''}`}
          style={{ transform: `translate(${panX}px, ${panY}px) scale(${scale})` }}
        >
        <svg className="lp-mm-links" width={links.w} height={links.h} aria-hidden="true">
          {links.paths.map((p) => (
            <path key={p.key} d={p.d} className={`lp-mm-link is-${p.level}${p.locked ? ' is-locked' : ''}`} />
          ))}
        </svg>
        {/* Root row: Your Plans node + its children (milestones) to the right */}
        <div className="lp-mm-root-row">
          <div className="lp-mm-node-wrap">
            <MmNodeCard
              nodeKey="__root__"
              level="root"
              color="var(--accent-amber)"
              icon={Workflow}
              kicker="Life Plan"
              title="Your Plans"
              sub={`${milestones.length} milestone${milestones.length === 1 ? '' : 's'} · ${totalGoals} goal${totalGoals === 1 ? '' : 's'} · ${doc.tasks.length} task${doc.tasks.length === 1 ? '' : 's'} · ${totalSteps} step${totalSteps === 1 ? '' : 's'}`}
              pct={overallProgress(doc)}
              childCount={milestones.length + (unassigned.length ? 1 : 0)}
              collapsed={!rootExpanded}
              onToggle={() => toggle('__root__')}
              onClick={() => toggle('__root__')}
            />
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
                      nodeKey="__unassigned__"
                      parentKey="__root__"
                      level="m"
                      color="var(--text-tertiary)"
                      icon={Flag}
                      kicker="Unassigned"
                      title={`${unassigned.length} goal${unassigned.length === 1 ? '' : 's'} without milestone`}
                      pct={Math.round(unassigned.reduce((s, g) => s + goalProgress(doc, g.id), 0) / unassigned.length)}
                      childCount={unassigned.length}
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
                          parentKey="__unassigned__"
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
    <li className="lp-mm-branch" style={{ '--mm': 'var(--mm-m)' }}>
      <div className="lp-mm-branch-main">
        <MmNodeCard
          nodeKey={`m:${m.id}`}
          parentKey="__root__"
          level="m"
          color="var(--mm-m)"
          icon={Flag}
          kicker={`Milestone ${idx + 1}`}
          title={m.title}
          sub={`${goals.length} goal${goals.length === 1 ? '' : 's'}`}
          pct={pct}
          badge={m.timingDate ? (
            <span className={`lp-badge ${overdue ? 'lp-badge-rose' : 'lp-badge-cyan'}`}><CalendarClock size={10} /> {overdue ? 'Overdue ' : ''}{fmtDate(m.timingDate)}</span>
          ) : null}
          childCount={goals.length}
          collapsed={!isExpanded}
          onToggle={() => toggle(m.id)}
          onClick={() => onOpenMilestone?.(m)}
        />
      </div>
      {isExpanded && goals.length > 0 && (
        <ul className="lp-mm-children">
          {goals.map((g) => (
            <GoalBranch
              key={g.id}
              doc={doc}
              g={g}
              parentKey={`m:${m.id}`}
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

function GoalBranch({ doc, g, parentKey, expanded, toggle, onOpenGoal, onOpenTask }) {
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
    <li className="lp-mm-branch" style={{ '--mm': 'var(--mm-g)' }}>
      <div className="lp-mm-branch-main">
        <MmNodeCard
          nodeKey={`g:${g.id}`}
          parentKey={parentKey}
          level="g"
          color="var(--mm-g)"
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
          childCount={tasks.length}
          collapsed={!isExpanded}
          onToggle={() => toggle(g.id)}
          onClick={() => onOpenGoal?.(g)}
        />
      </div>
      {isExpanded && tasks.length > 0 && (
        <ul className="lp-mm-children">
          {tasks.map((t) => (
            <TaskBranch
              key={t.id}
              doc={doc}
              g={g}
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

function TaskBranch({ doc, g, t, expanded, toggle, onOpenTask }) {
  const steps = stepsOfTask(doc, t.id);
  const done = steps.filter((s) => s.isDone).length;
  const pct = taskProgress(doc, t.id);
  const isExpanded = expanded.has(t.id);
  const autoEnd = t.isRecurring ? (t.recurringEndDate || t.recurringUntil || null) : (t.dueDate || null);
  const overdue = autoEnd && autoEnd < todayKey() && pct < 100;
  return (
    <li className="lp-mm-branch" style={{ '--mm': 'var(--mm-t)' }}>
      <div className="lp-mm-branch-main">
        <MmNodeCard
          nodeKey={`t:${t.id}`}
          parentKey={`g:${g.id}`}
          level="t"
          color="var(--mm-t)"
          icon={ListChecks}
          title={t.name}
          sub={steps.length ? `${done}/${steps.length} step${steps.length === 1 ? '' : 's'} done` : (t.manualDone ? 'Completed' : 'No steps')}
          pct={pct}
          badge={t.isRecurring ? (
            <span className="lp-badge lp-badge-amber"><CalendarClock size={10} /> {(t.recurringWeekdays || []).length >= 7 ? 'Daily' : (t.recurringWeekdays || []).join(', ')} → {fmtDate(autoEnd || t.recurringEndDate)}</span>
          ) : autoEnd ? (
            <span className={`lp-badge ${overdue ? 'lp-badge-rose' : 'lp-badge-cyan'}`}><CalendarClock size={10} /> {overdue ? 'Overdue ' : ''}{fmtDate(autoEnd)}</span>
          ) : null}
          childCount={steps.length}
          collapsed={!isExpanded}
          onToggle={() => toggle(t.id)}
          onClick={() => onOpenTask?.(t)}
        />
      </div>
      {isExpanded && steps.length > 0 && (
        <ul className="lp-mm-children">
          {steps.map((s) => (
            <li key={s.id} className="lp-mm-branch lp-mm-leaf" style={{ '--mm': 'var(--mm-s)' }}>
              <MmNodeCard
                nodeKey={`s:${s.id}`}
                parentKey={`t:${t.id}`}
                level="s"
                color={s.isDone ? 'var(--accent-emerald)' : 'var(--mm-s)'}
                icon={s.isDone ? CheckCircle2 : Circle}
                title={s.text}
                done={s.isDone}
                badge={s.dueDate ? (
                  <span className={`lp-badge ${s.dueDate < todayKey() && !s.isDone ? 'lp-badge-rose' : s.isDone ? 'lp-badge-emerald' : 'lp-badge-muted'}`}><CalendarClock size={10} /> {fmtDate(s.dueDate)}</span>
                ) : null}
                onClick={() => onOpenTask?.(t, s.id)}
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
  nodeKey, parentKey, level = 't', color, icon: Icon, kicker, title, sub, pct, badge,
  locked = false, lockTitle, done = false, childCount = 0,
  collapsed = false, onToggle, onClick,
}) {
  const hasPct = pct !== undefined;
  const clamped = hasPct ? Math.max(0, Math.min(100, pct)) : 0;
  const hasMeta = Boolean(badge) || locked;
  return (
    <div
      className={`lp-mm-node lp-mm-lv-${level}${done ? ' done' : ''}${locked ? ' is-locked' : ''}${hasPct && clamped >= 100 ? ' is-complete' : ''}`}
      style={{ '--mm': color }}
      data-mm-key={nodeKey}
      data-mm-parent={parentKey}
      data-mm-level={level}
      data-mm-locked={locked ? '1' : undefined}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' && onClick) onClick(); }}
      title={lockTitle || (typeof title === 'string' ? title : undefined)}
    >
      <span className="lp-mm-row">
        <span className="lp-mm-icon"><Icon size={level === 's' ? 14 : 15} /></span>
        <span className="lp-mm-text">
          {kicker && <span className="lp-mm-kicker">{kicker}</span>}
          <span className="lp-mm-title">{title}</span>
          {sub && <span className="lp-mm-sub">{sub}</span>}
        </span>
        {hasPct && <span className="lp-mm-pct">{pct}%</span>}
      </span>
      {hasMeta && (
        <span className="lp-mm-meta">
          {locked && <span className="lp-mm-lock" aria-label={lockTitle}><Lock size={10} /> Locked</span>}
          {badge}
        </span>
      )}
      {hasPct && <span className="lp-mm-bar"><i style={{ width: `${clamped}%` }} /></span>}
      {childCount > 0 && (
        <button
          type="button"
          className={`lp-mm-toggle${collapsed ? ' is-collapsed' : ''}`}
          onClick={(e) => { e.stopPropagation(); if (onToggle) onToggle(); }}
          aria-label={collapsed ? `Expand (${childCount})` : 'Collapse'}
          title={collapsed ? `Show ${childCount}` : 'Hide'}
        >
          {collapsed ? <span>{childCount}</span> : <ChevronLeft size={12} />}
        </button>
      )}
    </div>
  );
}

// ── Hand-drawn curve ─────────────────────────────────────────────────────────

/** Deterministic hash → [0, 1) so each link keeps the same wobble between renders. */
function seeded(str, salt) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Soft S-curve from parent (x1,y1) to child (x2,y2), built from two cubic
 * segments that meet at a slightly drifted midpoint — reads as hand drawn.
 */
function sketchCurve(x1, y1, x2, y2, key) {
  const j = (salt, amt) => (seeded(key, salt) - 0.5) * 2 * amt;
  const dx = Math.max(24, x2 - x1);
  const dy = y2 - y1;
  const drift = Math.min(4, 1.5 + Math.abs(dy) * 0.02);
  const mx = x1 + dx * (0.5 + j(1, 0.06));
  const my = y1 + dy * (0.5 + j(2, 0.06)) + j(3, drift);
  const c1x = x1 + dx * (0.32 + j(4, 0.06));
  const c1y = y1 + j(5, drift);
  const c2x = mx - dx * 0.16;
  const c2y = my - dy * 0.32;
  const c4x = x2 - dx * (0.3 + j(6, 0.06));
  const c4y = y2 + j(7, drift * 0.6);
  const f = (n) => n.toFixed(1);
  return `M${f(x1)},${f(y1)} C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(mx)},${f(my)} `
    + `S${f(c4x)},${f(c4y)} ${f(x2)},${f(y2)}`;
}
