import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { select, zoom as d3zoom, zoomIdentity } from 'd3';
import { FOOTPRINT, VIEW_BOX, polyBounds, polyCenter } from './floors';

export const MIN_SCALE = 1;
export const MAX_SCALE = 6;

const VB = VIEW_BOX;
// Landscape draws the plan as traced. Portrait (narrow phones) turns it 90°
// clockwise so the building's long side runs down the screen: west at the
// top, north on the right. Points are projected rather than the group being
// rotated, so text stays upright.
const LANDSCAPE = { ...VB };
const PORTRAIT = { x: 0, y: 0, w: VB.h, h: VB.w };
const toPortrait = ([x, y]) => [VB.y + VB.h - y, x - VB.x];
const asIs = (p) => p;
const toPoints = (poly) => poly.map(([x, y]) => `${x},${y}`).join(' ');

// Rough label width in screen px for a given font size, used to decide
// whether a label fits inside its room at the current zoom.
const estTextWidth = (text, px) => text.length * px * 0.58;

const STATUS_TYPES = new Set(['classroom', 'lab', 'hall', 'canteen']);

/**
 * Vector floor plan with pan/zoom (d3-zoom).
 *
 * - Mouse: drag to pan, ctrl/⌘ + wheel (or trackpad pinch) to zoom,
 *   double-click to zoom in. Plain wheel scrolls the page.
 * - Touch: two-finger pinch zooms; one finger pans only once zoomed in, so
 *   the page still scrolls past the map at fit.
 */
export default function FloorPlanSvg({
  ref,
  floor,
  selectedId,
  onSelect,
  getStatus,
  route = null,
  portrait = false,
  onScaleChange,
  wheelAlwaysZooms = false,
}) {
  const svgRef = useRef(null);
  const zoomRef = useRef(null);
  const kRef = useRef(1);
  const wheelRef = useRef(wheelAlwaysZooms);
  const onScaleRef = useRef(onScaleChange);
  useEffect(() => {
    wheelRef.current = wheelAlwaysZooms;
    onScaleRef.current = onScaleChange;
  });
  const [transform, setTransform] = useState(zoomIdentity);
  const [pxPerUnit, setPxPerUnit] = useState(0.5);
  const vb = portrait ? PORTRAIT : LANDSCAPE;
  const vbCenter = [vb.x + vb.w / 2, vb.y + vb.h / 2];
  const P = portrait ? toPortrait : asIs;

  // Screen pixels per viewBox unit at k=1 (svg uses "meet" scaling).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const measure = () => {
      const r = svg.getBoundingClientRect();
      const box = portrait ? PORTRAIT : LANDSCAPE;
      if (r.width && r.height) setPxPerUnit(Math.min(r.width / box.w, r.height / box.h));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [portrait]);

  useEffect(() => {
    const svgEl = svgRef.current;
    const box = portrait ? PORTRAIT : LANDSCAPE;
    const behavior = d3zoom()
      .scaleExtent([MIN_SCALE, MAX_SCALE])
      .extent([[box.x, box.y], [box.x + box.w, box.y + box.h]])
      .translateExtent([[box.x, box.y], [box.x + box.w, box.y + box.h]])
      .clickDistance(6)
      .filter((event) => {
        if (event.type === 'wheel') return wheelRef.current || event.ctrlKey || event.metaKey;
        if (event.type === 'touchstart') return event.touches.length > 1 || kRef.current > 1.01;
        return !event.button;
      })
      .on('zoom', (event) => {
        kRef.current = event.transform.k;
        setTransform(event.transform);
        // Let the page scroll past the map until it is zoomed in.
        svgEl.style.touchAction = event.transform.k > 1.01 ? 'none' : 'pan-x pan-y';
        onScaleRef.current?.(event.transform.k);
      });
    const sel = select(svgEl).call(behavior);
    sel.call(behavior.transform, zoomIdentity); // orientation changed → full view
    svgEl.style.touchAction = 'pan-x pan-y';
    zoomRef.current = behavior;
    return () => { sel.on('.zoom', null); };
  }, [portrait]);

  const run = (fn, duration = 450) => {
    const svg = select(svgRef.current);
    const t = svg.transition().duration(duration);
    fn(t, zoomRef.current);
  };

  // Both take plan coordinates and project them for the current orientation.
  const focusPoly = (planPoly) => {
    const poly = planPoly.map(P);
    const b = polyBounds(poly);
    const [cx, cy] = polyCenter(poly);
    const k = Math.max(1.5, Math.min(2.6, 0.3 * Math.min(vb.w / b.w, vb.h / b.h)));
    const t = zoomIdentity.translate(vbCenter[0], vbCenter[1]).scale(k).translate(-cx, -cy);
    run((tr, z) => tr.call(z.transform, t), 650);
  };

  useImperativeHandle(ref, () => ({
    zoomBy: (f) => run((t, z) => t.call(z.scaleBy, f)),
    zoomTo: (k) => run((t, z) => t.call(z.scaleTo, k)),
    reset: () => run((t, z) => t.call(z.transform, zoomIdentity)),
    focusRoom: (id) => {
      const room = floor.rooms.find((r) => r.id === id);
      if (room) focusPoly(room.poly);
    },
    fitPoints: (planPoints) => {
      if (!planPoints?.length) return;
      const points = planPoints.map(P);
      const b = polyBounds(points);
      const [cx, cy] = polyCenter(points);
      const k = Math.max(1, Math.min(2.4, 0.8 * Math.min(vb.w / Math.max(b.w, 1), vb.h / Math.max(b.h, 1))));
      const t = zoomIdentity.translate(vbCenter[0], vbCenter[1]).scale(k).translate(-cx, -cy);
      run((tr, z) => tr.call(z.transform, t), 650);
    },
  }));

  // New floor → back to the full view (instantly; the floor swap animates).
  useEffect(() => {
    if (zoomRef.current && svgRef.current) {
      select(svgRef.current).call(zoomRef.current.transform, zoomIdentity);
    }
  }, [floor.id]);

  const s = pxPerUnit * transform.k; // screen px per map unit right now
  const unit = (px) => px / s; // screen px → map units

  // Everything drawn, projected once per floor + orientation.
  const geo = useMemo(() => {
    const proj = portrait ? toPortrait : asIs;
    const pp = (poly) => poly.map(proj);
    const courtyard = floor.courtyard ? { ...floor.courtyard, poly: pp(floor.courtyard.poly) } : null;
    return {
      courtyard,
      courtyardCenter: courtyard ? polyCenter(courtyard.poly) : null,
      footprint: FOOTPRINT.map(pp),
      corridors: (floor.corridors || []).map(pp),
      connectors: (floor.connectors || []).map((c) => ({ ...c, at: proj(c.at) })),
      rooms: floor.rooms.map((room) => {
        const poly = pp(room.poly);
        return {
          room,
          poly,
          b: polyBounds(poly),
          center: proj(room.labelAt || polyCenter(room.poly)),
          isCoded: room.type === 'classroom' || room.type === 'lab',
        };
      }),
    };
  }, [floor, portrait]);
  const { rooms } = geo;
  const routePoints = route ? route.points.map(P) : null;

  const hasSelection = Boolean(selectedId);

  return (
    <svg
      ref={svgRef}
      className={`fp-svg${hasSelection ? ' has-selection' : ''}`}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      style={{ aspectRatio: `${vb.w} / ${vb.h}` }}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`AUST ${floor.label} floor plan`}
      onClick={() => onSelect?.(null)}
    >
      <defs>
        <pattern id="fp-hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="14" className="fp-hatch-line" />
        </pattern>
      </defs>

      <g transform={transform.toString()}>
        {/* Open courtyard (Badamtola) */}
        {geo.courtyard && (
          <g className="fp-courtyard">
            <polygon points={toPoints(geo.courtyard.poly)} className="fp-courtyard-fill" />
            <text
              x={geo.courtyardCenter[0] - (portrait ? 0 : 20)}
              y={geo.courtyardCenter[1]}
              className="fp-courtyard-label"
              fontSize={Math.max(unit(15), 34)}
            >
              {geo.courtyard.name}
            </text>
            {geo.courtyard.note && (
              <text
                x={geo.courtyardCenter[0] - (portrait ? 0 : 20)}
                y={geo.courtyardCenter[1] + Math.max(unit(15), 34) * 0.9}
                className="fp-courtyard-note"
                fontSize={Math.max(unit(10), 16)}
              >
                {geo.courtyard.note}
              </text>
            )}
          </g>
        )}

        {/* Building footprint: walkable floor under every room */}
        {geo.footprint.map((poly, i) => (
          <polygon key={`base-${i}`} points={toPoints(poly)} className="fp-floorbase" strokeWidth={unit(1.5)} />
        ))}

        {/* Corridors */}
        {geo.corridors.map((poly, i) => (
          <polygon key={i} points={toPoints(poly)} className="fp-corridor" />
        ))}

        {/* Rooms */}
        {rooms.map(({ room, poly }) => {
          const selected = room.id === selectedId;
          return (
            <polygon
              key={room.id}
              points={toPoints(poly)}
              className={`fp-room fp-room--${room.type}${selected ? ' is-selected' : ''}`}
              strokeWidth={unit(selected ? 2.5 : 1.2)}
              tabIndex={0}
              role="button"
              aria-label={room.name}
              aria-pressed={selected}
              onClick={(e) => { e.stopPropagation(); onSelect?.(selected ? null : room.id); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(room.id); }
              }}
            />
          );
        })}

        {/* Lifts and stairs */}
        {geo.connectors.map((c) => {
          const size = unit(Math.min(18, Math.max(11, 9 * transform.k)));
          const [x, y] = c.at;
          return (
            <g key={c.id} className={`fp-connector fp-connector--${c.kind}`} transform={`translate(${x} ${y})`} aria-hidden="true">
              <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={size * 0.22} strokeWidth={unit(1)} />
              {c.kind === 'lift' ? (
                <path
                  d={`M${-size * 0.18} ${size * 0.22} V${-size * 0.22} M${-size * 0.32} ${-size * 0.06} L${-size * 0.18} ${-size * 0.24} L${-size * 0.04} ${-size * 0.06} M${size * 0.18} ${-size * 0.22} V${size * 0.22} M${size * 0.04} ${size * 0.06} L${size * 0.18} ${size * 0.24} L${size * 0.32} ${size * 0.06}`}
                  strokeWidth={unit(1.2)}
                />
              ) : (
                <path
                  d={`M${-size * 0.32} ${size * 0.28} H${-size * 0.12} V${size * 0.06} H${size * 0.08} V${-size * 0.14} H${size * 0.28} V${-size * 0.32}`}
                  strokeWidth={unit(1.2)}
                />
              )}
            </g>
          );
        })}

        {/* Directions */}
        {routePoints && routePoints.length > 1 && (() => {
          const d = routePoints.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
          const first = routePoints[0];
          const last = routePoints[routePoints.length - 1];
          const pin = unit(15);
          return (
            <g className="fp-route" pointerEvents="none">
              <path d={d} className="fp-route-halo" strokeWidth={unit(11)} />
              <path d={d} className="fp-route-line" strokeWidth={unit(5)} />
              <path d={d} className="fp-route-flow" strokeWidth={unit(5)} strokeDasharray={`${unit(2)} ${unit(14)}`} style={{ '--fp-dash': unit(16) }} />
              {route.isStart ? (
                <circle cx={first[0]} cy={first[1]} r={unit(8)} className="fp-route-start" strokeWidth={unit(3)} />
              ) : (
                <circle cx={first[0]} cy={first[1]} r={unit(9)} className="fp-route-via" strokeWidth={unit(2.5)} />
              )}
              {route.isEnd ? (
                <g transform={`translate(${last[0]} ${last[1]})`}>
                  <path
                    d={`M0 0 C ${-pin * 0.15} ${-pin * 0.45} ${-pin * 0.62} ${-pin * 0.7} ${-pin * 0.62} ${-pin * 1.15} A ${pin * 0.62} ${pin * 0.62} 0 1 1 ${pin * 0.62} ${-pin * 1.15} C ${pin * 0.62} ${-pin * 0.7} ${pin * 0.15} ${-pin * 0.45} 0 0 Z`}
                    className="fp-route-pin"
                    strokeWidth={unit(2)}
                  />
                  <circle cx={0} cy={-pin * 1.15} r={pin * 0.25} className="fp-route-pin-dot" />
                </g>
              ) : (
                <circle cx={last[0]} cy={last[1]} r={unit(9)} className="fp-route-via" strokeWidth={unit(2.5)} />
              )}
            </g>
          );
        })()}

        {/* Labels + live status dots */}
        {rooms.map(({ room, b, center, isCoded }) => {
          const selected = room.id === selectedId;
          const status = STATUS_TYPES.has(room.type) ? getStatus?.(room.id) : null;
          const basePx = isCoded ? 11 : 12.5;
          const full = isCoded ? room.id : room.name;
          const short = room.short || full;
          // Across the room if it fits, else along it (tall, narrow rooms),
          // else one size smaller before giving up.
          const fitsAcross = (t, f) => estTextWidth(t, f) + 6 < b.w * s && f * 1.5 < b.h * s;
          const fitsAlong = (t, f) => estTextWidth(t, f) + 6 < b.h * s && f * 1.5 < b.w * s;
          let text = null;
          let vertical = false;
          let px = basePx;
          search: for (const f of [basePx, basePx * 0.84]) {
            for (const t of full === short ? [full] : [full, short]) {
              if (fitsAcross(t, f)) { text = t; px = f; break search; }
              if (fitsAlong(t, f)) { text = t; px = f; vertical = true; break search; }
            }
          }
          if (!text && selected) text = short;
          const [lx, ly] = center;
          const half = text ? estTextWidth(text, px) / 2 + 7 : 0;
          return (
            <g key={`${room.id}-label`} className={`fp-label-group${selected ? ' is-selected' : ''}`} pointerEvents="none">
              {text && (
                <text
                  x={lx}
                  y={ly}
                  transform={vertical ? `rotate(-90 ${lx} ${ly})` : undefined}
                  className={`fp-label${isCoded ? ' is-code' : ''}`}
                  fontSize={unit(px)}
                  dominantBaseline="central"
                  textAnchor="middle"
                >
                  {text}
                </text>
              )}
              {status && (text || s > 0.9) && (
                <circle
                  {...(() => {
                    // Beside the label when there is room, else the room's corner.
                    const room4dot = (vertical ? b.h : b.w) * s;
                    if (text && (half * 2 + 10) > room4dot) return { cx: b.x + b.w - unit(6), cy: b.y + unit(6) };
                    if (text && vertical) return { cx: lx, cy: ly - unit(half) };
                    if (text) return { cx: lx + unit(half), cy: ly };
                    return { cx: lx, cy: ly };
                  })()}
                  r={unit(3.6)}
                  className={`fp-status-dot is-${status.status}`}
                />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
