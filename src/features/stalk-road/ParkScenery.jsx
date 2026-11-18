import { useMemo } from 'react';
import { WORLD_H, GROUND, mulberry } from './coasterTrack';

/* ─── Orbit Express scenery ───
   Every layer shares the world's vertical scale (600 units tall, ground at
   GROUND) so horizons line up; only their parallax speed differs. Depth comes
   from flat tones getting lighter/bluer with distance (atmospheric
   perspective) — no gradients or glows. */

const BALLOON_COLORS = ['#ff7aa8', '#ffd166', '#7cd4ff', '#9be38a', 'var(--stalk-accent)'];
const SHIRTS = ['#3a4a6c', '#4f3f6a', '#6a4f40', '#3f5d57', '#5a4466', '#365273'];

/* ── Sky life: clouds, shooting stars, a plane, a hot-air balloon ── */
export function SkyLife() {
  const clouds = useMemo(() => {
    const r = mulberry(404);
    return Array.from({ length: 6 }, (_, i) => ({
      i,
      top: 6 + r() * 30,
      scale: 0.6 + r() * 0.9,
      dur: 150 + r() * 120,
      delay: -r() * 260,
      puffs: Array.from({ length: 4 + Math.floor(r() * 3) }, (__, k) => ({
        cx: 30 + k * 26 + r() * 10,
        cy: 34 - r() * 14,
        r: 14 + r() * 14,
      })),
    }));
  }, []);

  return (
    <>
      {clouds.map((c) => (
        <span
          key={c.i}
          className="sr-cloud"
          style={{ top: `${c.top}%`, '--sc': c.scale, '--dur': `${c.dur}s`, animationDelay: `${c.delay}s` }}
        >
          <svg viewBox="0 0 200 60" aria-hidden="true">
            {c.puffs.map((p, k) => <circle key={k} cx={p.cx} cy={p.cy} r={p.r} />)}
            <rect x="24" y="34" width={c.puffs.length * 26 + 20} height="16" rx="8" />
          </svg>
        </span>
      ))}

      {[0, 1, 2].map((k) => (
        <span key={`ss${k}`} className="sr-shoot" style={{ top: `${8 + k * 11}%`, left: `${18 + k * 27}%`, animationDelay: `${k * 4.3 + 1.5}s` }} />
      ))}

      <span className="sr-plane">
        <svg viewBox="0 0 40 12" aria-hidden="true">
          <path d="M2 6 L30 5 Q36 5 38 6 Q36 7 30 7 L2 7 Z" className="sr-plane-body" />
          <path d="M14 6 L22 1 L25 1 L20 6 Z M14 6 L22 11 L25 11 L20 6 Z M3 6 L5 2 L7 2 L7 6 Z" className="sr-plane-body" />
          <circle cx="23" cy="1.4" r="1.2" className="sr-plane-red" />
          <circle cx="23" cy="10.6" r="1.2" className="sr-plane-white" />
        </svg>
      </span>

      <span className="sr-hab">
        <svg viewBox="0 0 60 92" aria-hidden="true">
          <path d="M30 2 C8 2 2 22 4 36 C6 50 20 60 24 68 L36 68 C40 60 54 50 56 36 C58 22 52 2 30 2 Z" className="sr-hab-a" />
          <path d="M30 2 C20 2 16 22 18 36 C20 50 26 60 27 68 L33 68 C34 60 40 50 42 36 C44 22 40 2 30 2 Z" className="sr-hab-b" />
          <path d="M30 2 C27 2 26 22 27 36 C28 50 29 60 29.5 68 L30.5 68 C31 60 32 50 33 36 C34 22 33 2 30 2 Z" className="sr-hab-a" />
          <path d="M24 68 L26 78 M36 68 L34 78" className="sr-hab-rope" />
          <rect x="25" y="78" width="10" height="8" rx="1.5" className="sr-hab-basket" />
        </svg>
      </span>
    </>
  );
}

/* ── Far layer: mountain ranges + city skyline with lit windows ── */
export function FarBackdrop({ width }) {
  const data = useMemo(() => {
    const r = mulberry(1212);
    // smooth rolling ridge: random heights joined by quadratic curves
    // through the midpoints, so there are no sawtooth peaks
    const ridge = (base, amp, step) => {
      const pts = [];
      for (let x = -step; x <= width + step * 2; x += step * (0.7 + r() * 0.6)) {
        pts.push([x, base - amp * (0.25 + r() * 0.75)]);
      }
      let d = `M${pts[0][0].toFixed(0)} ${GROUND} L${pts[0][0].toFixed(0)} ${pts[0][1].toFixed(0)}`;
      for (let i = 1; i < pts.length - 1; i += 1) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2;
        const my = (pts[i][1] + pts[i + 1][1]) / 2;
        d += ` Q${pts[i][0].toFixed(0)} ${pts[i][1].toFixed(0)} ${mx.toFixed(0)} ${my.toFixed(0)}`;
      }
      return `${d} L${pts[pts.length - 1][0].toFixed(0)} ${GROUND} Z`;
    };
    const far = ridge(GROUND - 70, 130, 260);
    const near = ridge(GROUND - 40, 80, 180);

    const buildings = [];
    const windows = [];
    let x = 40;
    while (x < width) {
      if (r() < 0.16) { x += 120 + r() * 200; continue; } // gaps let the mountains show
      const w = 26 + r() * 46;
      const h = 50 + r() * 150 * (r() < 0.2 ? 1.6 : 1);
      const top = GROUND - h;
      buildings.push({ x, w, top, h, spire: r() < 0.14 });
      for (let wy = top + 8; wy < GROUND - 10; wy += 11) {
        for (let wx = x + 5; wx < x + w - 6; wx += 9) {
          const lit = r();
          if (lit < 0.24) windows.push({ x: wx, y: wy, blink: lit < 0.012, warm: r() > 0.25 });
        }
      }
      x += w + 2 + r() * 10;
    }
    const masts = [];
    for (let mx = 600; mx < width; mx += 1400 + r() * 900) masts.push(mx);
    return { far, near, buildings, windows, masts };
  }, [width]);

  return (
    <svg className="sr-layer-svg" viewBox={`0 0 ${width} ${WORLD_H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={data.far} className="sr-mtn-far" />
      <path d={data.near} className="sr-mtn-near" />
      {data.masts.map((mx) => (
        <g key={mx} className="sr-mast">
          <path d={`M${mx - 16} ${GROUND} L${mx} ${GROUND - 300} L${mx + 16} ${GROUND} M${mx - 10} ${GROUND - 120} L${mx + 10} ${GROUND - 120} M${mx - 6} ${GROUND - 200} L${mx + 6} ${GROUND - 200}`} />
          <circle cx={mx} cy={GROUND - 302} r="3" className="sr-mast-light" />
        </g>
      ))}
      {data.buildings.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.top} width={b.w} height={b.h} className="sr-city-bld" />
          {b.spire && <rect x={b.x + b.w / 2 - 1.5} y={b.top - 24} width="3" height="24" className="sr-city-bld" />}
        </g>
      ))}
      {data.windows.map((w, i) => (
        <rect
          key={i}
          x={w.x}
          y={w.y}
          width="4"
          height="5"
          className={`sr-win ${w.warm ? '' : 'sr-win-cool'} ${w.blink ? 'sr-win-blink' : ''}`}
          style={w.blink ? { animationDelay: `${-(i % 9)}s` } : undefined}
        />
      ))}
    </svg>
  );
}

/* ── Park layer rides ── */
function FerrisWheel({ cx, r }) {
  const cy = GROUND - r - 44;
  const spokes = 12;
  const dur = `${r > 120 ? 70 : 54}s`;
  return (
    <g>
      <path className="sr-park-frame" d={`M${cx} ${cy}L${cx - r * 0.55} ${GROUND}M${cx} ${cy}L${cx + r * 0.55} ${GROUND}M${cx - r * 0.34} ${cy + r * 0.62}L${cx + r * 0.34} ${cy + r * 0.62}`} />
      <g className="sr-spin" style={{ transformOrigin: `${cx}px ${cy}px`, animationDuration: dur }}>
        <circle cx={cx} cy={cy} r={r} className="sr-park-rim" />
        <circle cx={cx} cy={cy} r={r * 0.82} className="sr-park-rim sr-park-rim-in" />
        {Array.from({ length: spokes }, (_, i) => {
          const a = (i / spokes) * Math.PI * 2;
          const gx = cx + Math.cos(a) * r;
          const gy = cy + Math.sin(a) * r;
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={gx} y2={gy} className="sr-park-spoke" />
              <line x1={cx + Math.cos(a) * r * 0.82} y1={cy + Math.sin(a) * r * 0.82} x2={cx + Math.cos(a + Math.PI / spokes) * r} y2={cy + Math.sin(a + Math.PI / spokes) * r} className="sr-park-spoke sr-park-spoke-thin" />
              <g className="sr-spin sr-spin-rev" style={{ transformOrigin: `${gx}px ${gy}px`, animationDuration: dur }}>
                <line x1={gx} y1={gy} x2={gx} y2={gy + 10} className="sr-park-spoke" />
                <path d={`M${gx - 10} ${gy + 10} h20 l-2 13 h-16 z`} className="sr-park-cab" />
                <rect x={gx - 6} y={gy + 13} width="12" height="5" rx="1" className="sr-park-cab-win" />
              </g>
            </g>
          );
        })}
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2 + 0.13;
          return <circle key={`b${i}`} cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r} r="2.6" className={`sr-bulb ${i % 2 ? 'sr-bulb-b' : ''}`} />;
        })}
      </g>
      <circle cx={cx} cy={cy} r="9" className="sr-park-hub" />
      <rect x={cx - 40} y={GROUND - 16} width="80" height="16" rx="2" className="sr-park-tent-body" />
    </g>
  );
}

function Tent({ cx, h: seed }) {
  const w = 120 + seed * 60;
  const h = 70 + seed * 30;
  const x0 = cx - w / 2;
  const wallTop = GROUND - h * 0.55;
  // scalloped valance under the roof
  let val = `M${x0} ${wallTop}`;
  const n = 8;
  for (let i = 0; i < n; i += 1) val += ` q${w / n / 2} 10 ${w / n} 0`;
  return (
    <g>
      <rect x={x0 + 10} y={wallTop} width={w - 20} height={h * 0.55} className="sr-park-tent-body" />
      <path d={`M${cx - 14} ${GROUND} L${cx - 14} ${GROUND - 30} Q${cx} ${GROUND - 40} ${cx + 14} ${GROUND - 30} L${cx + 14} ${GROUND} Z`} className="sr-park-door" />
      <path d={`M${x0} ${wallTop}L${cx} ${GROUND - h - 30}L${x0 + w} ${wallTop}Z`} className="sr-park-tent-top" />
      {[0.25, 0.5, 0.75].map((f) => (
        <path key={f} d={`M${cx} ${GROUND - h - 30}L${x0 + w * f} ${wallTop}`} className="sr-park-seam" />
      ))}
      <path d={val} className="sr-park-valance" />
      <line x1={cx} y1={GROUND - h - 30} x2={cx} y2={GROUND - h - 56} className="sr-park-frame sr-park-frame-thin" />
      <path d={`M${cx} ${GROUND - h - 56}l18 6l-18 6z`} className="sr-park-pennant sr-flutter" style={{ transformOrigin: `${cx}px ${GROUND - h - 50}px` }} />
      {[0.2, 0.4, 0.6, 0.8].map((f, i) => (
        <circle key={f} cx={x0 + 10 + (w - 20) * f} cy={wallTop + 2} r="2.4" className={`sr-bulb ${i % 2 ? 'sr-bulb-b' : ''}`} />
      ))}
    </g>
  );
}

function DropTower({ cx, h: seed }) {
  const th = 300 + seed * 60;
  const rungs = [];
  for (let y = GROUND - 20; y > GROUND - th; y -= 24) rungs.push(y);
  return (
    <g>
      <rect x={cx - 7} y={GROUND - th} width="14" height={th} className="sr-park-tower-mast" />
      {rungs.map((y) => <line key={y} x1={cx - 7} y1={y} x2={cx + 7} y2={y - 12} className="sr-park-rung" />)}
      <rect x={cx - 18} y={GROUND - th - 14} width="36" height="14" rx="3" className="sr-park-tower-mast" />
      <circle cx={cx} cy={GROUND - th - 20} r="3" className="sr-bulb sr-bulb-warn" />
      <g className="sr-drop" style={{ '--th': `${th - 60}px`, animationDelay: `${(-seed * 6).toFixed(1)}s` }}>
        <rect x={cx - 22} y={GROUND - 46} width="44" height="16" rx="4" className="sr-park-tower-car" />
        {[-14, -5, 4, 13].map((dx) => <circle key={dx} cx={cx + dx} cy={GROUND - 50} r="3" className="sr-park-rider" />)}
      </g>
    </g>
  );
}

function Carousel({ cx }) {
  const roofY = GROUND - 112;
  const poles = [-60, -30, 0, 30, 60];
  let val = `M${cx - 88} ${roofY}`;
  for (let i = 0; i < 11; i += 1) val += ` q8 9 16 0`;
  return (
    <g>
      <rect x={cx - 82} y={GROUND - 20} width="164" height="12" rx="2" className="sr-park-tower-mast" />
      <rect x={cx - 74} y={GROUND - 8} width="148" height="8" className="sr-park-tent-body" />
      <rect x={cx - 6} y={roofY - 30} width="12" height={112} className="sr-park-tower-mast" />
      {poles.map((dx, i) => (
        <g key={dx}>
          <line x1={cx + dx} y1={roofY} x2={cx + dx} y2={GROUND - 20} className="sr-park-pole" />
          <g className="sr-bob" style={{ animationDelay: `${-i * 0.55}s` }}>
            <path
              d={`M${cx + dx - 13} ${GROUND - 52} q0 -9 11 -9 h5 l7 -9 l5 2 l-3 9 q3 7 -5 9 h-20 z M${cx + dx - 9} ${GROUND - 44} l-3 10 M${cx + dx + 7} ${GROUND - 44} l3 10`}
              className={`sr-horse ${i % 2 ? 'sr-horse-b' : ''}`}
            />
          </g>
        </g>
      ))}
      <path d={`M${cx - 92} ${roofY} L${cx} ${roofY - 46} L${cx + 92} ${roofY} Z`} className="sr-park-tent-top" />
      <path d={val} className="sr-park-valance" />
      <path d={`M${cx} ${roofY - 46} v-16`} className="sr-park-frame sr-park-frame-thin" />
      <circle cx={cx} cy={roofY - 64} r="4" className="sr-bulb" />
      {Array.from({ length: 9 }, (_, i) => (
        <circle key={i} cx={cx - 84 + i * 21} cy={roofY + 3} r="2.4" className={`sr-bulb ${i % 2 ? 'sr-bulb-b' : ''}`} />
      ))}
    </g>
  );
}

function PirateShip({ cx }) {
  const py = GROUND - 176;
  return (
    <g>
      <path d={`M${cx - 78} ${GROUND} L${cx} ${py} L${cx + 78} ${GROUND} M${cx - 44} ${GROUND - 70} L${cx + 44} ${GROUND - 70}`} className="sr-park-frame" />
      <g className="sr-pendulum" style={{ transformOrigin: `${cx}px ${py}px` }}>
        <path d={`M${cx} ${py} L${cx - 46} ${GROUND - 66} M${cx} ${py} L${cx + 46} ${GROUND - 66}`} className="sr-park-frame sr-park-frame-mid" />
        <path d={`M${cx - 96} ${GROUND - 84} L${cx + 96} ${GROUND - 84} L${cx + 84} ${GROUND - 70} Q${cx} ${GROUND - 26} ${cx - 84} ${GROUND - 70} Z`} className="sr-ship-hull" />
        <path d={`M${cx - 70} ${GROUND - 74} L${cx + 70} ${GROUND - 74}`} className="sr-ship-trim" />
        {[-60, -36, -12, 12, 36, 60].map((dx) => <circle key={dx} cx={cx + dx} cy={GROUND - 89} r="3.4" className="sr-park-rider" />)}
        <path d={`M${cx + 96} ${GROUND - 84} l10 -22 l-4 0 l-10 22 z M${cx - 96} ${GROUND - 84} l-10 -22 l4 0 l10 22 z`} className="sr-ship-hull" />
      </g>
      <circle cx={cx} cy={py} r="6" className="sr-park-hub" />
    </g>
  );
}

function SwingRide({ cx }) {
  const topY = GROUND - 228;
  const rimY = topY + 30;
  return (
    <g>
      <path d={`M${cx - 30} ${GROUND} L${cx - 8} ${topY + 10} L${cx + 8} ${topY + 10} L${cx + 30} ${GROUND} Z`} className="sr-park-tower-mast" />
      <g className="sr-tilt" style={{ transformOrigin: `${cx}px ${topY}px` }}>
        <path d={`M${cx - 80} ${rimY} L${cx} ${topY - 8} L${cx + 80} ${rimY} Z`} className="sr-park-tent-top" />
        {Array.from({ length: 9 }, (_, i) => {
          const ax = cx - 70 + i * 17.5;
          return (
            <g key={i} className="sr-swing" style={{ transformOrigin: `${ax}px ${rimY}px`, animationDelay: `${-i * 0.36}s` }}>
              <line x1={ax} y1={rimY} x2={ax} y2={rimY + 74} className="sr-park-pole" />
              <rect x={ax - 4} y={rimY + 74} width="8" height="6" rx="1.5" className="sr-park-cab" />
              <circle cx={ax} cy={rimY + 70} r="2.6" className="sr-park-rider" />
            </g>
          );
        })}
        {Array.from({ length: 8 }, (_, i) => (
          <circle key={`b${i}`} cx={cx - 70 + i * 20} cy={rimY} r="2.3" className={`sr-bulb ${i % 2 ? 'sr-bulb-b' : ''}`} />
        ))}
      </g>
    </g>
  );
}

const PARK_SEQ = ['wheel', 'tent', 'carousel', 'tower', 'ship', 'swing', 'tent', 'wheel-s', 'carousel', 'ship', 'tower', 'swing'];
const PARK_GAP = { wheel: 560, 'wheel-s': 440, tent: 300, carousel: 360, tower: 240, ship: 380, swing: 340 };

export function ParkBackdrop({ width }) {
  const items = useMemo(() => {
    const rand = mulberry(9090);
    const out = [];
    let x = 260;
    let n = 0;
    while (x < width - 200) {
      const kind = PARK_SEQ[n % PARK_SEQ.length];
      out.push({ kind, x, k: n, h: rand() });
      x += PARK_GAP[kind] + rand() * 120;
      n += 1;
    }
    return out;
  }, [width]);

  const hills = useMemo(() => {
    const rand = mulberry(515);
    let d = `M0 ${GROUND} L0 ${GROUND - 60}`;
    for (let x = 0; x < width; x += 260) {
      const h = GROUND - 40 - rand() * 70;
      d += ` Q${x + 130} ${h - 30} ${x + 260} ${h}`;
    }
    return `${d} L${width} ${GROUND} Z`;
  }, [width]);

  const trees = useMemo(() => {
    const rand = mulberry(616);
    const out = [];
    for (let x = 10; x < width; x += 30 + rand() * 60) out.push({ x, h: 34 + rand() * 46 });
    return out;
  }, [width]);

  return (
    <svg className="sr-layer-svg" viewBox={`0 0 ${width} ${WORLD_H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={hills} className="sr-park-hills" />
      {items.map((it) => {
        switch (it.kind) {
          case 'wheel': return <FerrisWheel key={it.k} cx={it.x} r={150} />;
          case 'wheel-s': return <FerrisWheel key={it.k} cx={it.x} r={104} />;
          case 'tent': return <Tent key={it.k} cx={it.x} h={it.h} />;
          case 'carousel': return <Carousel key={it.k} cx={it.x} />;
          case 'ship': return <PirateShip key={it.k} cx={it.x} />;
          case 'swing': return <SwingRide key={it.k} cx={it.x} />;
          default: return <DropTower key={it.k} cx={it.x} h={it.h} />;
        }
      })}
      {trees.map((t) => (
        <path key={t.x} d={`M${t.x - t.h * 0.32} ${GROUND} L${t.x} ${GROUND - t.h} L${t.x + t.h * 0.32} ${GROUND} Z`} className="sr-park-pine" />
      ))}
    </svg>
  );
}

/* ── World props behind the supports: pines, stalls, lamps ── */
export function WorldBack({ width, avoid }) {
  const data = useMemo(() => {
    const r = mulberry(31337);
    const clear = (x, pad = 0) => !avoid.some(([a, b]) => x > a - pad && x < b + pad);
    const pines = [];
    for (let x = 20; x < width; x += 70 + r() * 110) {
      if (clear(x)) pines.push({ x, h: 70 + r() * 70, w: 0.3 + r() * 0.1 });
    }
    const stalls = [];
    const names = ['POPCORN', 'CANDY', 'TICKETS', 'SNACKS', 'COFFEE', 'ICE CREAM'];
    let n = 0;
    for (let x = 520; x < width - 200; x += 520 + r() * 340) {
      if (clear(x, 60)) { stalls.push({ x, name: names[n % names.length], tone: n % 3 }); n += 1; }
    }
    const lamps = [];
    for (let x = 180; x < width; x += 300 + r() * 140) lamps.push(x);
    return { pines, stalls, lamps };
  }, [width, avoid]);

  return (
    <g className="sr-world-back">
      {data.pines.map((p) => (
        <g key={`p${p.x}`} className="sr-pine">
          <rect x={p.x - 2.5} y={GROUND - 14} width="5" height="14" />
          <path d={`M${p.x - p.h * p.w} ${GROUND - 10} L${p.x} ${GROUND - p.h} L${p.x + p.h * p.w} ${GROUND - 10} Z M${p.x - p.h * p.w * 0.8} ${GROUND - p.h * 0.42} L${p.x} ${GROUND - p.h - 12} L${p.x + p.h * p.w * 0.8} ${GROUND - p.h * 0.42} Z`} />
        </g>
      ))}
      {data.stalls.map((s) => {
        const x0 = s.x - 40;
        let awn = `M${x0 - 6} ${GROUND - 56}`;
        for (let i = 0; i < 7; i += 1) awn += ` q6.57 9 13.14 0`;
        return (
          <g key={`s${s.x}`} className={`sr-stall sr-stall-${s.tone}`}>
            <rect x={x0} y={GROUND - 56} width="80" height="56" className="sr-stall-body" />
            <rect x={x0 + 8} y={GROUND - 44} width="64" height="20" className="sr-stall-win" />
            <rect x={x0 + 4} y={GROUND - 24} width="72" height="5" className="sr-stall-counter" />
            <path d={`M${x0 - 6} ${GROUND - 56} L${x0 + 6} ${GROUND - 72} L${x0 + 74} ${GROUND - 72} L${x0 + 86} ${GROUND - 56} Z`} className="sr-stall-roof" />
            <path d={awn} className="sr-stall-awning" />
            <rect x={x0 + 14} y={GROUND - 92} width="52" height="16" rx="3" className="sr-stall-sign" />
            <text x={s.x} y={GROUND - 81} className="sr-stall-text">{s.name}</text>
            <circle cx={s.x - 14} cy={GROUND - 36} r="3.5" className="sr-park-rider" />
          </g>
        );
      })}
      {data.lamps.map((x) => (
        <g key={`l${x}`} className="sr-lamp">
          <line x1={x} y1={GROUND} x2={x} y2={GROUND - 62} />
          <path d={`M${x} ${GROUND - 62} q0 -8 9 -8`} className="sr-lamp-arm" />
          <rect x={x + 5} y={GROUND - 74} width="12" height="6" rx="2" />
          <circle cx={x + 11} cy={GROUND - 66} r="2.6" />
        </g>
      ))}
    </g>
  );
}

/* ── World props in front of the supports: path, pond, crowd, balloons ── */
export function WorldFront({ width, crowdAt }) {
  const data = useMemo(() => {
    const r = mulberry(8080);
    const people = [];
    crowdAt.forEach((cx, gi) => {
      const count = 5 + Math.floor(r() * 4);
      for (let i = 0; i < count; i += 1) {
        const x = cx - 70 + r() * 140;
        people.push({
          x,
          h: 28 + r() * 10,
          shirt: SHIRTS[Math.floor(r() * SHIRTS.length)],
          wave: r() < 0.35,
          balloon: r() < 0.22 ? BALLOON_COLORS[(gi + i) % BALLOON_COLORS.length] : null,
          d: r() * 1.2,
          k: `${gi}-${i}`,
        });
      }
    });
    people.sort((a, b) => a.h - b.h);
    const ponds = [];
    for (let x = 900; x < width - 300; x += 1500 + r() * 900) ponds.push({ x, w: 160 + r() * 120 });
    const bushes = [];
    for (let x = 20; x < width; x += 40 + r() * 70) bushes.push({ x, r: 7 + r() * 10 });
    const fence = [];
    for (let x = 0; x < width; x += 22) fence.push(x);
    return { people, ponds, bushes, fence };
  }, [width, crowdAt]);

  return (
    <g className="sr-world-front">
      <rect x="0" y={GROUND} width={width} height={WORLD_H - GROUND} className="sr-path" />
      <line x1="0" y1={GROUND + 3} x2={width} y2={GROUND + 3} className="sr-path-edge" />
      {data.ponds.map((p) => (
        <g key={`pd${p.x}`} className="sr-pond">
          <rect x={p.x} y={GROUND + 10} width={p.w} height="22" rx="11" />
          {[0, 1, 2, 3].map((k) => (
            <line key={k} x1={p.x + 18 + k * (p.w / 5)} y1={GROUND + 16 + (k % 2) * 8} x2={p.x + 38 + k * (p.w / 5)} y2={GROUND + 16 + (k % 2) * 8} className="sr-ripple" style={{ animationDelay: `${-k * 0.7}s` }} />
          ))}
        </g>
      ))}
      {data.people.map((p) => {
        const top = GROUND + 8 - p.h;
        return (
          <g key={p.k} className="sr-person">
            {p.balloon && (
              <g className="sr-balloon" style={{ animationDelay: `${-p.d * 2}s` }}>
                <path d={`M${p.x + 6} ${top + 8} Q${p.x + 10} ${top - 10} ${p.x + 8} ${top - 26}`} className="sr-balloon-str" />
                <ellipse cx={p.x + 8} cy={top - 32} rx="6" ry="7.4" style={{ fill: p.balloon }} />
              </g>
            )}
            <circle cx={p.x} cy={top + 4} r="4.2" className="sr-person-head" />
            <path d={`M${p.x - 6} ${top + 10} h12 l1 ${p.h * 0.42} h-14 z`} style={{ fill: p.shirt }} />
            <path d={`M${p.x - 4} ${top + 10 + p.h * 0.42} v${p.h * 0.5 - 8} M${p.x + 4} ${top + 10 + p.h * 0.42} v${p.h * 0.5 - 8}`} className="sr-person-legs" />
            {p.wave ? (
              <line x1={p.x + 5} y1={top + 12} x2={p.x + 12} y2={top} className="sr-person-arm sr-wave" style={{ transformOrigin: `${p.x + 5}px ${top + 12}px`, animationDelay: `${-p.d}s` }} />
            ) : (
              <line x1={p.x + 6} y1={top + 12} x2={p.x + 8} y2={top + 10 + p.h * 0.4} className="sr-person-arm" />
            )}
          </g>
        );
      })}
      {data.bushes.map((b) => (
        <circle key={`b${b.x}`} cx={b.x} cy={GROUND + 6} r={b.r} className="sr-bush" />
      ))}
    </g>
  );
}

/* ── Near foreground (moves faster than the world): fence, grass, fireflies ── */
export function ForegroundLayer({ width }) {
  const data = useMemo(() => {
    const r = mulberry(2468);
    const posts = [];
    for (let x = 0; x < width; x += 64) posts.push(x);
    const grass = [];
    for (let x = 0; x < width; x += 18 + r() * 40) grass.push({ x, h: 6 + r() * 10 });
    const flies = [];
    for (let x = 60; x < width; x += 90 + r() * 160) flies.push({ x, y: GROUND - 10 - r() * 70, d: 3 + r() * 4, dl: -r() * 6 });
    return { posts, grass, flies };
  }, [width]);

  const y = GROUND + 30;
  return (
    <svg className="sr-layer-svg" viewBox={`0 0 ${width} ${WORLD_H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`M0 ${y - 14} H${width} M0 ${y - 4} H${width}`} className="sr-fg-rail" />
      {data.posts.map((x) => <rect key={x} x={x} y={y - 20} width="5" height="30" rx="1.5" className="sr-fg-post" />)}
      {data.grass.map((g) => (
        <path key={g.x} d={`M${g.x} ${y + 8} l3 -${g.h} l2 ${g.h} l3 -${g.h * 0.8} l2 ${g.h * 0.8} z`} className="sr-fg-grass" />
      ))}
      {data.flies.map((f) => (
        <circle key={f.x} cx={f.x} cy={f.y} r="1.8" className="sr-firefly" style={{ '--d': `${f.d}s`, animationDelay: `${f.dl}s` }} />
      ))}
    </svg>
  );
}
