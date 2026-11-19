/* eslint-disable react-refresh/only-export-components */
import { useMemo } from 'react';
import { WORLD_H, GROUND, mulberry } from './coasterTrack';

/* ─── Side-view scenery for the Fire, Forest and Space ride themes ───
   Same layer contract as ParkScenery (the Night city theme):
     Sky      — fixed decoration inside .sr-sky (sun / planet / embers)
     SkyLife  — things that cross the sky (clouds, birds, satellites)
     Far      — slowest parallax strip (volcanoes, snowy peaks, asteroids)
     Park     — mid strip, the theme's "skyline"
     Back     — <g> inside the world, behind the coaster supports
     Front    — <g> inside the world, in front of the supports (ground, crowd)
     Fg       — fastest strip, nearest to the rider
   All SVG strips share the 600-unit world height with GROUND as the horizon.
   Flat fills only: depth comes from tone, motion does the rest. */

const f0 = (n) => n.toFixed(0);
const f1 = (n) => n.toFixed(1);

/* rolling ridge: random heights joined by quadratic curves through midpoints */
function ridgePath(r, width, base, amp, step) {
  const pts = [];
  for (let x = -step; x <= width + step * 2; x += step * (0.7 + r() * 0.6)) {
    pts.push([x, base - amp * (0.25 + r() * 0.75)]);
  }
  let d = `M${f0(pts[0][0])} ${GROUND} L${f0(pts[0][0])} ${f0(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${f0(pts[i][0])} ${f0(pts[i][1])} ${f0(mx)} ${f0(my)}`;
  }
  return `${d} L${f0(pts[pts.length - 1][0])} ${GROUND} Z`;
}

/* drifting cloud puffs (same markup + animation as the city clouds) */
function Clouds({ seed, count, className, top = 30 }) {
  const clouds = useMemo(() => {
    const r = mulberry(seed);
    return Array.from({ length: count }, (_, i) => ({
      i,
      top: 5 + r() * top,
      scale: 0.6 + r() * 0.9,
      dur: 150 + r() * 120,
      delay: -r() * 260,
      puffs: Array.from({ length: 4 + Math.floor(r() * 3) }, (__, k) => ({
        cx: 30 + k * 26 + r() * 10,
        cy: 34 - r() * 14,
        r: 14 + r() * 14,
      })),
    }));
  }, [seed, count, top]);
  return clouds.map((c) => (
    <span
      key={c.i}
      className={`sr-cloud ${className}`}
      style={{ top: `${c.top}%`, '--sc': c.scale, '--dur': `${c.dur}s`, animationDelay: `${c.delay}s` }}
    >
      <svg viewBox="0 0 200 60" aria-hidden="true">
        {c.puffs.map((p, k) => <circle key={k} cx={p.cx} cy={p.cy} r={p.r} />)}
        <rect x="24" y="34" width={c.puffs.length * 26 + 20} height="16" rx="8" />
      </svg>
    </span>
  ));
}

/* small particles positioned in % of the sky (embers, dust) */
function useSpecks(seed, count, topMax = 90) {
  return useMemo(() => {
    const r = mulberry(seed);
    return Array.from({ length: count }, (_, i) => ({
      i, left: r() * 100, top: 10 + r() * topMax, size: 1.4 + r() * 2.2, d: 5 + r() * 7, dl: -r() * 12,
    }));
  }, [seed, count, topMax]);
}

/* a crowd near each station / gate */
function Crowd({ crowdAt, seed, kind }) {
  const people = useMemo(() => {
    const r = mulberry(seed);
    const out = [];
    crowdAt.forEach((cx, gi) => {
      const count = 4 + Math.floor(r() * 4);
      for (let i = 0; i < count; i += 1) {
        out.push({
          x: cx - 70 + r() * 140, h: 28 + r() * 10, tone: Math.floor(r() * 4), wave: r() < 0.35, d: r() * 1.2, k: `${gi}-${i}`,
        });
      }
    });
    return out.sort((a, b) => a.h - b.h);
  }, [crowdAt, seed]);

  return people.map((p) => {
    const top = GROUND + 8 - p.h;
    const arm = p.wave
      ? <line x1={p.x + 5} y1={top + 12} x2={p.x + 12} y2={top} className="sr-person-arm sr-wave" style={{ transformOrigin: `${p.x + 5}px ${top + 12}px`, animationDelay: `${-p.d}s` }} />
      : <line x1={p.x + 6} y1={top + 12} x2={p.x + 8} y2={top + 10 + p.h * 0.4} className="sr-person-arm" />;
    if (kind === 'astro') {
      return (
        <g key={p.k} className="sr-astro">
          <rect x={p.x - 9} y={top + 9} width="5" height={p.h * 0.36} rx="1.5" className="sr-astro-pack" />
          <circle cx={p.x} cy={top + 3} r="5.4" className="sr-astro-helmet" />
          <path d={`M${p.x - 1} ${top + 1} h5 q1 3 -1 5 h-4 z`} className="sr-astro-visor" />
          <path d={`M${p.x - 6} ${top + 10} h12 l1 ${p.h * 0.42} h-14 z`} className="sr-astro-suit" />
          <path d={`M${p.x - 4} ${top + 10 + p.h * 0.42} v${p.h * 0.5 - 8} M${p.x + 4} ${top + 10 + p.h * 0.42} v${p.h * 0.5 - 8}`} className="sr-astro-legs" />
          {arm}
        </g>
      );
    }
    // hiker: cap + backpack
    return (
      <g key={p.k} className={`sr-hiker sr-hiker-${p.tone}`}>
        <rect x={p.x - 10} y={top + 10} width="5" height={p.h * 0.34} rx="2" className="sr-hiker-pack" />
        <circle cx={p.x} cy={top + 4} r="4.2" className="sr-person-head" />
        <path d={`M${p.x - 5} ${top + 1.5} q5 -6 10 0 z`} className="sr-hiker-cap" />
        <path d={`M${p.x - 6} ${top + 10} h12 l1 ${p.h * 0.42} h-14 z`} className="sr-hiker-shirt" />
        <path d={`M${p.x - 4} ${top + 10 + p.h * 0.42} v${p.h * 0.5 - 8} M${p.x + 4} ${top + 10 + p.h * 0.42} v${p.h * 0.5 - 8}`} className="sr-person-legs" />
        {arm}
      </g>
    );
  });
}

/* ═══════════════════════ FIRE ═══════════════════════ */

function FireSky() {
  const embers = useSpecks(5150, 34, 80);
  return (
    <>
      <span className="sr-fire-sun" />
      {embers.map((e) => (
        <span
          key={e.i}
          className="sr-sky-ember"
          style={{ left: `${e.left}%`, top: `${e.top}%`, width: e.size, height: e.size, '--d': `${e.d}s`, animationDelay: `${e.dl}s` }}
        />
      ))}
    </>
  );
}

function FireSkyLife() {
  return <Clouds seed={6061} count={7} className="sr-smoke" top={34} />;
}

function FireFar({ width }) {
  const data = useMemo(() => {
    const r = mulberry(7001);
    const ridge = ridgePath(r, width, GROUND - 50, 110, 240);
    const volcanoes = [];
    for (let x = 220; x < width; x += 820 + r() * 700) {
      const h = 190 + r() * 170;
      const w = h * (2 + r() * 0.6);
      const cw = 34 + r() * 22;
      volcanoes.push({ x, h, w, cw, erupt: r() < 0.55, d: r() * 3 });
    }
    return { ridge, volcanoes };
  }, [width]);

  return (
    <svg className="sr-layer-svg" viewBox={`0 0 ${width} ${WORLD_H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={data.ridge} className="sr-fire-ridge" />
      {data.volcanoes.map((v) => {
        const top = GROUND - v.h;
        const l = v.x - v.w / 2;
        const rr = v.x + v.w / 2;
        const body = `M${f0(l)} ${GROUND} Q${f0(v.x - v.w * 0.2)} ${f0(GROUND - v.h * 0.18)} ${f0(v.x - v.cw / 2)} ${f0(top)} L${f0(v.x + v.cw / 2)} ${f0(top)} Q${f0(v.x + v.w * 0.2)} ${f0(GROUND - v.h * 0.18)} ${f0(rr)} ${GROUND} Z`;
        return (
          <g key={v.x}>
            <path d={body} className="sr-volcano" />
            <path d={`M${f0(v.x - v.cw * 0.2)} ${f0(top + 2)} Q${f0(v.x - v.w * 0.1)} ${f0(GROUND - v.h * 0.55)} ${f0(v.x - v.w * 0.22)} ${f0(GROUND - v.h * 0.08)}`} className="sr-lava-stream" />
            <path d={`M${f0(v.x + v.cw * 0.25)} ${f0(top + 2)} Q${f0(v.x + v.w * 0.06)} ${f0(GROUND - v.h * 0.5)} ${f0(v.x + v.w * 0.14)} ${f0(GROUND - v.h * 0.2)}`} className="sr-lava-stream sr-lava-stream-thin" />
            <ellipse cx={v.x} cy={top + 1} rx={v.cw / 2} ry="4" className="sr-lava-cap" />
            {v.erupt && (
              <g className="sr-erupt" style={{ animationDelay: `${-v.d}s` }}>
                {[-14, -5, 4, 12].map((dx, k) => (
                  <circle key={dx} cx={v.x + dx} cy={top - 6} r={3 + (k % 2) * 1.6} className="sr-lava-blob" style={{ '--dx': `${dx * 2.2}px`, animationDelay: `${-v.d - k * 0.35}s` }} />
                ))}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function FirePark({ width }) {
  const data = useMemo(() => {
    const r = mulberry(7111);
    const hills = ridgePath(r, width, GROUND - 30, 60, 200);
    const items = [];
    for (let x = 120; x < width - 80; x += 170 + r() * 260) {
      const roll = r();
      items.push({ x, kind: roll < 0.45 ? 'spire' : (roll < 0.85 ? 'columns' : 'fall'), h: 90 + r() * 150, w: 30 + r() * 40, s: r() });
    }
    return { hills, items };
  }, [width]);

  return (
    <svg className="sr-layer-svg" viewBox={`0 0 ${width} ${WORLD_H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={data.hills} className="sr-fire-hills" />
      {data.items.map((it) => {
        if (it.kind === 'spire') {
          const { x, w, h } = it;
          return (
            <path
              key={x}
              d={`M${f0(x - w)} ${GROUND} L${f0(x - w * 0.35)} ${f0(GROUND - h * 0.55)} L${f0(x - w * 0.12)} ${f0(GROUND - h)} L${f0(x + w * 0.18)} ${f0(GROUND - h * 0.7)} L${f0(x + w * 0.4)} ${f0(GROUND - h * 0.82)} L${f0(x + w)} ${GROUND} Z`}
              className="sr-fire-spire"
            />
          );
        }
        if (it.kind === 'columns') {
          const n = 5 + Math.floor(it.s * 4);
          return (
            <g key={it.x} className="sr-basalt">
              {Array.from({ length: n }, (_, k) => {
                const cx = it.x + (k - n / 2) * 15;
                const ch = it.h * (1 - Math.abs(k - n / 2) / n) * (0.75 + ((k * 37) % 10) / 40);
                const tilt = (k % 2 ? 4 : -3);
                return <path key={k} d={`M${f1(cx)} ${GROUND} V${f1(GROUND - ch)} L${f1(cx + 14)} ${f1(GROUND - ch + tilt)} V${GROUND} Z`} />;
              })}
            </g>
          );
        }
        // cliff with a lava fall
        const top = GROUND - it.h - 40;
        return (
          <g key={it.x}>
            <path d={`M${f0(it.x - 70)} ${GROUND} L${f0(it.x - 60)} ${f0(top + 12)} L${f0(it.x - 20)} ${f0(top)} L${f0(it.x + 30)} ${f0(top + 6)} L${f0(it.x + 70)} ${GROUND} Z`} className="sr-fire-spire" />
            <rect x={it.x - 8} y={top + 2} width="14" height={GROUND - top - 2} className="sr-lavafall" />
            <line x1={it.x - 1} y1={top + 2} x2={it.x - 1} y2={GROUND} className="sr-lavafall-flow" />
          </g>
        );
      })}
    </svg>
  );
}

function FireBack({ width, avoid }) {
  const data = useMemo(() => {
    const r = mulberry(7222);
    const clear = (x, pad = 0) => !avoid.some(([a, b]) => x > a - pad && x < b + pad);
    const rocks = [];
    for (let x = 30; x < width; x += 90 + r() * 140) {
      if (clear(x)) rocks.push({ x, w: 26 + r() * 40, h: 22 + r() * 46 });
    }
    const torches = [];
    for (let x = 240; x < width; x += 320 + r() * 200) {
      if (clear(x, 20)) torches.push(x);
    }
    const signs = [];
    for (let x = 700; x < width - 200; x += 1200 + r() * 800) {
      if (clear(x, 40)) signs.push(x);
    }
    return { rocks, torches, signs };
  }, [width, avoid]);

  return (
    <g className="sr-world-back">
      {data.rocks.map((k) => (
        <path
          key={`r${k.x}`}
          d={`M${f0(k.x - k.w / 2)} ${GROUND} L${f0(k.x - k.w * 0.4)} ${f0(GROUND - k.h * 0.6)} L${f0(k.x - k.w * 0.1)} ${f0(GROUND - k.h)} L${f0(k.x + k.w * 0.3)} ${f0(GROUND - k.h * 0.8)} L${f0(k.x + k.w / 2)} ${GROUND} Z`}
          className="sr-rock"
        />
      ))}
      {data.signs.map((x) => (
        <g key={`sg${x}`} className="sr-fire-sign">
          <line x1={x} y1={GROUND} x2={x} y2={GROUND - 48} />
          <path d={`M${x} ${GROUND - 74} l14 14 l-14 14 l-14 -14 z`} />
          <text x={x} y={GROUND - 55}>!</text>
        </g>
      ))}
      {data.torches.map((x, i) => (
        <g key={`t${x}`} className="sr-torch">
          <rect x={x - 2} y={GROUND - 54} width="4" height="54" />
          <path d={`M${x - 8} ${GROUND - 58} h16 l-3 6 h-10 z`} className="sr-torch-bowl" />
          <path
            d={`M${x - 6} ${GROUND - 58} Q${x - 7} ${GROUND - 70} ${x} ${GROUND - 80} Q${x + 7} ${GROUND - 70} ${x + 6} ${GROUND - 58} Z`}
            className="sr-flame"
            style={{ transformOrigin: `${x}px ${GROUND - 58}px`, animationDelay: `${-(i % 5) * 0.21}s` }}
          />
          <path d={`M${x - 3} ${GROUND - 58} Q${x - 3} ${GROUND - 65} ${x} ${GROUND - 71} Q${x + 3} ${GROUND - 65} ${x + 3} ${GROUND - 58} Z`} className="sr-flame-core" />
        </g>
      ))}
    </g>
  );
}

function FireFront({ width }) {
  const data = useMemo(() => {
    const r = mulberry(7333);
    const pools = [];
    for (let x = 600; x < width - 300; x += 900 + r() * 700) pools.push({ x, w: 180 + r() * 180 });
    let crack = `M0 ${GROUND + 6}`;
    for (let x = 0; x < width; x += 40 + r() * 60) crack += ` L${f0(x)} ${f0(GROUND + 4 + r() * 8)}`;
    return { pools, crack };
  }, [width]);

  return (
    <g className="sr-world-front">
      <rect x="0" y={GROUND} width={width} height={WORLD_H - GROUND} className="sr-crust" />
      <path d={data.crack} className="sr-crack" />
      {data.pools.map((p) => (
        <g key={p.x}>
          <rect x={p.x} y={GROUND + 12} width={p.w} height="20" rx="10" className="sr-lava-pool" />
          {[0.2, 0.45, 0.7].map((t, k) => (
            <rect key={t} x={p.x + p.w * t} y={GROUND + 18} width="18" height="7" rx="3" className="sr-lava-plate" style={{ animationDelay: `${-k * 1.7}s` }} />
          ))}
          {[0.32, 0.6, 0.85].map((t, k) => (
            <circle key={t} cx={p.x + p.w * t} cy={GROUND + 18} r="2.6" className="sr-lava-bubble" style={{ animationDelay: `${-k * 0.9}s` }} />
          ))}
        </g>
      ))}
    </g>
  );
}

function FireFg({ width }) {
  const data = useMemo(() => {
    const r = mulberry(7444);
    const rocks = [];
    for (let x = 0; x < width; x += 140 + r() * 260) rocks.push({ x, w: 40 + r() * 80, h: 18 + r() * 30 });
    const embers = [];
    for (let x = 40; x < width; x += 60 + r() * 120) embers.push({ x, y: GROUND - 10 - r() * 80, d: 3 + r() * 4, dl: -r() * 6 });
    return { rocks, embers };
  }, [width]);
  const y = GROUND + 34;
  return (
    <svg className="sr-layer-svg" viewBox={`0 0 ${width} ${WORLD_H}`} preserveAspectRatio="none" aria-hidden="true">
      {data.rocks.map((k) => (
        <path key={k.x} d={`M${f0(k.x)} ${y + 10} L${f0(k.x + k.w * 0.2)} ${f0(y - k.h)} L${f0(k.x + k.w * 0.55)} ${f0(y - k.h * 0.7)} L${f0(k.x + k.w * 0.8)} ${f0(y - k.h * 0.9)} L${f0(k.x + k.w)} ${y + 10} Z`} className="sr-fg-rock" />
      ))}
      {data.embers.map((e) => (
        <circle key={e.x} cx={e.x} cy={e.y} r="1.8" className="sr-ember" style={{ '--d': `${e.d}s`, animationDelay: `${e.dl}s` }} />
      ))}
    </svg>
  );
}

/* ═══════════════════════ FOREST ═══════════════════════ */

function ForestSky() {
  return <span className="sr-sun" />;
}

function ForestSkyLife() {
  return (
    <>
      <Clouds seed={8181} count={7} className="sr-cloud-day" top={32} />
      {[0, 1].map((k) => (
        <span key={k} className="sr-birds" style={{ top: `${12 + k * 13}%`, animationDelay: `${-k * 34 - 6}s` }}>
          <svg viewBox="0 0 60 24" aria-hidden="true">
            {[[6, 12], [18, 6], [30, 14], [42, 8], [52, 16]].slice(0, 3 + k * 2).map(([x, y]) => (
              <path key={x} d={`M${x - 5} ${y} q2.5 -3 5 0 q2.5 -3 5 0`} className="sr-bird" />
            ))}
          </svg>
        </span>
      ))}
    </>
  );
}

function ForestFar({ width }) {
  const data = useMemo(() => {
    const r = mulberry(8001);
    const range = (base, amp, step) => {
      const peaks = [];
      for (let x = -step; x <= width + step; x += step * (0.7 + r() * 0.6)) peaks.push([x, base - amp * (0.4 + r() * 0.6)]);
      let d = `M${f0(peaks[0][0])} ${GROUND}`;
      const caps = [];
      peaks.forEach(([px, py], i) => {
        const next = peaks[i + 1];
        d += ` L${f0(px)} ${f0(py)}`;
        if (next) {
          const vx = (px + next[0]) / 2;
          const vy = Math.max(py, next[1]) + 40 + r() * 40;
          d += ` L${f0(vx)} ${f0(Math.min(GROUND - 20, vy))}`;
        }
        if (GROUND - py > amp * 0.75) {
          const s = 26 + r() * 10;
          caps.push(`M${f0(px - s)} ${f0(py + s * 0.8)} L${f0(px)} ${f0(py)} L${f0(px + s * 0.9)} ${f0(py + s * 0.7)} L${f0(px + s * 0.35)} ${f0(py + s * 0.55)} L${f0(px - s * 0.3)} ${f0(py + s * 0.85)} Z`);
        }
      });
      return { d: `${d} L${f0(peaks[peaks.length - 1][0])} ${GROUND} Z`, caps: caps.join('') };
    };
    return { far: range(GROUND - 90, 260, 300), near: range(GROUND - 50, 150, 220) };
  }, [width]);
  return (
    <svg className="sr-layer-svg" viewBox={`0 0 ${width} ${WORLD_H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={data.far.d} className="sr-peak-far" />
      <path d={data.far.caps} className="sr-snow" />
      <path d={data.near.d} className="sr-peak-near" />
      <path d={data.near.caps} className="sr-snow sr-snow-near" />
    </svg>
  );
}

function ForestPark({ width }) {
  const data = useMemo(() => {
    const r = mulberry(8111);
    const hills = ridgePath(r, width, GROUND - 40, 70, 240);
    const rows = [[], []];
    rows.forEach((row, ri) => {
      for (let x = 0; x < width; x += (ri ? 22 : 30) + r() * 26) {
        row.push({ x, h: (ri ? 50 : 70) + r() * (ri ? 40 : 60), y: GROUND - (ri ? 0 : 20) - r() * 16 });
      }
    });
    const towers = [];
    const mills = [];
    for (let x = 500; x < width - 200; x += 1100 + r() * 900) {
      if (r() < 0.5) towers.push(x); else mills.push({ x, d: 8 + r() * 6 });
    }
    return { hills, rows, towers, mills };
  }, [width]);
  return (
    <svg className="sr-layer-svg" viewBox={`0 0 ${width} ${WORLD_H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={data.hills} className="sr-forest-hills" />
      {data.rows.map((row, ri) => row.map((t) => (
        <path key={`${ri}-${t.x}`} d={`M${f0(t.x - t.h * 0.3)} ${f0(t.y)} L${f0(t.x)} ${f0(t.y - t.h)} L${f0(t.x + t.h * 0.3)} ${f0(t.y)} Z`} className={ri ? 'sr-fpine-b' : 'sr-fpine-a'} />
      )))}
      {data.towers.map((x) => (
        <g key={`tw${x}`} className="sr-watchtower">
          <path d={`M${x - 22} ${GROUND} L${x - 10} ${GROUND - 150} M${x + 22} ${GROUND} L${x + 10} ${GROUND - 150} M${x - 18} ${GROUND - 40} L${x + 16} ${GROUND - 90} M${x + 18} ${GROUND - 40} L${x - 16} ${GROUND - 90}`} />
          <rect x={x - 18} y={GROUND - 172} width="36" height="22" />
          <path d={`M${x - 24} ${GROUND - 172} L${x} ${GROUND - 192} L${x + 24} ${GROUND - 172} Z`} />
          <rect x={x - 11} y={GROUND - 167} width="22" height="9" className="sr-watchtower-win" />
        </g>
      ))}
      {data.mills.map((m) => (
        <g key={`ml${m.x}`} className="sr-windmill">
          <path d={`M${m.x - 16} ${GROUND} L${m.x - 7} ${GROUND - 160} L${m.x + 7} ${GROUND - 160} L${m.x + 16} ${GROUND} Z`} />
          <g className="sr-spin" style={{ transformOrigin: `${m.x}px ${GROUND - 160}px`, animationDuration: `${m.d}s` }}>
            {[0, 90, 180, 270].map((a) => (
              <rect key={a} x={m.x - 3} y={GROUND - 224} width="6" height="64" rx="2" transform={`rotate(${a} ${m.x} ${GROUND - 160})`} className="sr-windmill-blade" />
            ))}
          </g>
          <circle cx={m.x} cy={GROUND - 160} r="5" className="sr-windmill-hub" />
        </g>
      ))}
    </svg>
  );
}

function ForestBack({ width, avoid }) {
  const data = useMemo(() => {
    const r = mulberry(8222);
    const clear = (x, pad = 0) => !avoid.some(([a, b]) => x > a - pad && x < b + pad);
    const pines = [];
    for (let x = 20; x < width; x += 50 + r() * 90) {
      if (clear(x)) pines.push({ x, h: 80 + r() * 80, w: 0.28 + r() * 0.1 });
    }
    const cabins = [];
    for (let x = 520; x < width - 200; x += 700 + r() * 500) {
      if (clear(x, 70)) cabins.push(x);
    }
    return { pines, cabins };
  }, [width, avoid]);
  return (
    <g className="sr-world-back">
      {data.pines.map((p) => (
        <g key={`p${p.x}`} className="sr-pine">
          <rect x={p.x - 3} y={GROUND - 16} width="6" height="16" className="sr-trunk" />
          <path d={`M${f0(p.x - p.h * p.w)} ${GROUND - 12} L${p.x} ${f0(GROUND - p.h * 0.62)} L${f0(p.x + p.h * p.w)} ${GROUND - 12} Z M${f0(p.x - p.h * p.w * 0.85)} ${f0(GROUND - p.h * 0.38)} L${p.x} ${f0(GROUND - p.h * 0.86)} L${f0(p.x + p.h * p.w * 0.85)} ${f0(GROUND - p.h * 0.38)} Z M${f0(p.x - p.h * p.w * 0.65)} ${f0(GROUND - p.h * 0.66)} L${p.x} ${f0(GROUND - p.h - 8)} L${f0(p.x + p.h * p.w * 0.65)} ${f0(GROUND - p.h * 0.66)} Z`} />
        </g>
      ))}
      {data.cabins.map((x, i) => (
        <g key={`c${x}`} className="sr-cabin">
          <rect x={x - 44} y={GROUND - 50} width="88" height="50" className="sr-cabin-wall" />
          <path d={`M${x - 44} ${GROUND - 38} H${x + 44} M${x - 44} ${GROUND - 26} H${x + 44} M${x - 44} ${GROUND - 14} H${x + 44}`} className="sr-cabin-log" />
          <path d={`M${x - 54} ${GROUND - 50} L${x} ${GROUND - 86} L${x + 54} ${GROUND - 50} Z`} className="sr-cabin-roof" />
          <rect x={x + 18} y={GROUND - 90} width="10" height="22" className="sr-cabin-wall" />
          <rect x={x - 32} y={GROUND - 40} width="18" height="14" className="sr-cabin-win" />
          <rect x={x + 6} y={GROUND - 34} width="16" height="34" className="sr-cabin-door" />
          {[0, 1, 2].map((k) => (
            <circle key={k} cx={x + 23} cy={GROUND - 96} r={4 + k * 1.5} className="sr-chimney-smoke" style={{ animationDelay: `${-k * 1.3 - i}s` }} />
          ))}
        </g>
      ))}
    </g>
  );
}

const FLOWERS = ['#ffd166', '#ff7aa8', '#ffffff', '#a99cff'];

function ForestFront({ width, crowdAt }) {
  const data = useMemo(() => {
    const r = mulberry(8333);
    const flowers = [];
    for (let x = 10; x < width; x += 14 + r() * 40) flowers.push({ x, y: GROUND + 4 + r() * 10, c: FLOWERS[Math.floor(r() * FLOWERS.length)] });
    const ponds = [];
    for (let x = 900; x < width - 300; x += 1500 + r() * 900) ponds.push({ x, w: 170 + r() * 120 });
    const bushes = [];
    for (let x = 20; x < width; x += 40 + r() * 70) bushes.push({ x, r: 7 + r() * 11 });
    return { flowers, ponds, bushes };
  }, [width]);
  return (
    <g className="sr-world-front">
      <rect x="0" y={GROUND} width={width} height={WORLD_H - GROUND} className="sr-meadow" />
      <rect x="0" y={GROUND + 22} width={width} height="9" className="sr-trail" />
      {data.ponds.map((p) => (
        <g key={`pd${p.x}`} className="sr-pond sr-pond-day">
          <rect x={p.x} y={GROUND + 6} width={p.w} height="20" rx="10" />
          {[0, 1, 2, 3].map((k) => (
            <line key={k} x1={p.x + 18 + k * (p.w / 5)} y1={GROUND + 12 + (k % 2) * 7} x2={p.x + 38 + k * (p.w / 5)} y2={GROUND + 12 + (k % 2) * 7} className="sr-ripple" style={{ animationDelay: `${-k * 0.7}s` }} />
          ))}
        </g>
      ))}
      <Crowd crowdAt={crowdAt} seed={8344} kind="hiker" />
      {data.bushes.map((b) => <circle key={`b${b.x}`} cx={b.x} cy={GROUND + 6} r={b.r} className="sr-bush" />)}
      {data.flowers.map((fl) => <circle key={`f${fl.x}`} cx={fl.x} cy={fl.y} r="1.8" style={{ fill: fl.c }} />)}
    </g>
  );
}

function ForestFg({ width }) {
  const data = useMemo(() => {
    const r = mulberry(8444);
    const posts = [];
    for (let x = 0; x < width; x += 72) posts.push(x);
    const grass = [];
    for (let x = 0; x < width; x += 14 + r() * 30) grass.push({ x, h: 8 + r() * 16 });
    const flies = [];
    for (let x = 80; x < width; x += 180 + r() * 260) flies.push({ x, y: GROUND - 20 - r() * 80, d: 4 + r() * 4, dl: -r() * 6, c: FLOWERS[Math.floor(r() * FLOWERS.length)] });
    return { posts, grass, flies };
  }, [width]);
  const y = GROUND + 30;
  return (
    <svg className="sr-layer-svg" viewBox={`0 0 ${width} ${WORLD_H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`M0 ${y - 15} H${width} M0 ${y - 5} H${width}`} className="sr-log-rail" />
      {data.posts.map((x) => <rect key={x} x={x} y={y - 22} width="7" height="32" rx="2" className="sr-log-post" />)}
      {data.grass.map((g) => (
        <path key={g.x} d={`M${f1(g.x)} ${y + 10} q2 -${f1(g.h)} 6 -${f1(g.h * 1.1)} q-1 ${f1(g.h * 0.6)} 2 ${f1(g.h * 1.1)} z`} className="sr-tall-grass" />
      ))}
      {data.flies.map((b) => (
        <g key={b.x} className="sr-butterfly" style={{ '--d': `${b.d}s`, animationDelay: `${b.dl}s` }}>
          <g className="sr-wings" style={{ transformOrigin: `${b.x}px ${b.y}px` }}>
            <ellipse cx={b.x - 2.4} cy={b.y} rx="2.6" ry="1.8" style={{ fill: b.c }} />
            <ellipse cx={b.x + 2.4} cy={b.y} rx="2.6" ry="1.8" style={{ fill: b.c }} />
          </g>
        </g>
      ))}
    </svg>
  );
}

/* ═══════════════════════ SPACE ═══════════════════════ */

function SpaceSky({ stars }) {
  return (
    <>
      {stars.map((s) => (
        <span
          key={s.i}
          className="sr-star"
          style={{ left: `${s.left}%`, top: `${s.top * 1.5}%`, width: s.size, height: s.size, '--d': `${s.d}s`, animationDelay: `${s.dl}s` }}
        />
      ))}
      <span className="sr-planet" aria-hidden="true">
        <svg viewBox="0 0 200 120">
          <ellipse cx="100" cy="62" rx="96" ry="18" className="sr-planet-ring-back" />
          <circle cx="100" cy="60" r="46" className="sr-planet-body" />
          <path d="M58 44 Q100 36 142 44 L144 50 Q100 42 56 50 Z M54 66 Q100 58 146 66 L145 73 Q100 65 55 73 Z" className="sr-planet-band" />
          <path d="M4 62 Q100 92 196 62 Q100 84 4 62 Z" className="sr-planet-ring" />
        </svg>
      </span>
      <span className="sr-smallmoon" />
    </>
  );
}

function SpaceSkyLife() {
  return (
    <>
      {[0, 1].map((k) => (
        <span key={k} className="sr-satellite" style={{ top: `${14 + k * 16}%`, animationDelay: `${-k * 60 - 10}s` }}>
          <svg viewBox="0 0 50 20" aria-hidden="true">
            <rect x="4" y="7" width="14" height="6" className="sr-sat-panel" />
            <rect x="32" y="7" width="14" height="6" className="sr-sat-panel" />
            <rect x="19" y="5" width="12" height="10" rx="2" className="sr-sat-body" />
            <line x1="25" y1="5" x2="25" y2="0" className="sr-sat-ant" />
            <circle cx="25" cy="10" r="1.4" className="sr-bulb-warn" />
          </svg>
        </span>
      ))}
      {[0, 1, 2].map((k) => (
        <span key={`c${k}`} className="sr-shoot sr-comet" style={{ top: `${10 + k * 12}%`, left: `${14 + k * 29}%`, animationDelay: `${k * 5.1 + 2}s` }} />
      ))}
    </>
  );
}

function SpaceFar({ width }) {
  const data = useMemo(() => {
    const r = mulberry(9001);
    const rocks = [];
    for (let x = 40; x < width; x += 60 + r() * 140) {
      const rad = 4 + r() * (r() < 0.12 ? 26 : 10);
      const cy = 90 + r() * 330;
      const sides = 6 + Math.floor(r() * 3);
      const pts = Array.from({ length: sides }, (_, k) => {
        const a = (k / sides) * Math.PI * 2;
        const rr = rad * (0.7 + r() * 0.4);
        return `${f1(x + Math.cos(a) * rr)},${f1(cy + Math.sin(a) * rr)}`;
      }).join(' ');
      rocks.push({ x, cy, pts, dur: 30 + r() * 60, rev: r() < 0.5 });
    }
    const stations = [];
    for (let x = 700; x < width; x += 2200 + r() * 1400) stations.push({ x, y: 150 + r() * 120, r: 44 + r() * 26 });
    return { rocks, stations };
  }, [width]);
  return (
    <svg className="sr-layer-svg" viewBox={`0 0 ${width} ${WORLD_H}`} preserveAspectRatio="none" aria-hidden="true">
      {data.stations.map((s) => (
        <g key={`st${s.x}`} className="sr-ringstation">
          <g className="sr-spin" style={{ transformOrigin: `${s.x}px ${s.y}px`, animationDuration: '90s' }}>
            <circle cx={s.x} cy={s.y} r={s.r} className="sr-ring-rim" />
            {[0, 60, 120].map((a) => (
              <line key={a} x1={s.x - s.r} y1={s.y} x2={s.x + s.r} y2={s.y} transform={`rotate(${a} ${s.x} ${s.y})`} className="sr-ring-spoke" />
            ))}
          </g>
          <circle cx={s.x} cy={s.y} r="7" className="sr-ring-hub" />
        </g>
      ))}
      {data.rocks.map((k) => (
        <polygon
          key={k.x}
          points={k.pts}
          className={`sr-asteroid sr-spin ${k.rev ? 'sr-spin-rev' : ''}`}
          style={{ transformOrigin: `${k.x}px ${k.cy}px`, animationDuration: `${k.dur}s` }}
        />
      ))}
    </svg>
  );
}

function SpacePark({ width }) {
  const items = useMemo(() => {
    const r = mulberry(9111);
    const out = [];
    let n = 0;
    for (let x = 160; x < width - 160; x += 260 + r() * 260) {
      out.push({ x, kind: ['module', 'solar', 'dish', 'module', 'crane'][n % 5], h: r() });
      n += 1;
    }
    return out;
  }, [width]);
  return (
    <svg className="sr-layer-svg" viewBox={`0 0 ${width} ${WORLD_H}`} preserveAspectRatio="none" aria-hidden="true">
      <rect x="0" y={GROUND - 26} width={width} height="26" className="sr-station-base" />
      {items.map((it) => {
        const { x } = it;
        if (it.kind === 'module') {
          const h = 120 + it.h * 120;
          return (
            <g key={x} className="sr-module">
              <path d={`M${x - 20} ${GROUND} L${x - 6} ${GROUND - h} M${x + 20} ${GROUND} L${x + 6} ${GROUND - h} M${x - 16} ${GROUND - h * 0.3} L${x + 12} ${GROUND - h * 0.6}`} className="sr-truss" />
              <rect x={x - 60} y={GROUND - h - 30} width="120" height="30" rx="15" className="sr-module-body" />
              {[-36, -12, 12, 36].map((dx) => <circle key={dx} cx={x + dx} cy={GROUND - h - 15} r="4" className="sr-module-win" />)}
              <circle cx={x} cy={GROUND - h - 34} r="2.6" className="sr-bulb sr-bulb-warn" />
            </g>
          );
        }
        if (it.kind === 'solar') {
          const h = 150 + it.h * 80;
          return (
            <g key={x} className="sr-solar">
              <line x1={x} y1={GROUND} x2={x} y2={GROUND - h} className="sr-truss" />
              {[-1, 1].map((side) => (
                <g key={side}>
                  {[0, 1, 2].map((k) => (
                    <rect key={k} x={side < 0 ? x - 12 - (k + 1) * 26 : x + 12 + k * 26} y={GROUND - h - 18} width="24" height="36" className="sr-solar-cell" />
                  ))}
                </g>
              ))}
            </g>
          );
        }
        if (it.kind === 'dish') {
          return (
            <g key={x} className="sr-dish">
              <path d={`M${x - 10} ${GROUND} L${x} ${GROUND - 90} L${x + 10} ${GROUND}`} className="sr-truss" />
              <g className="sr-dish-turn" style={{ transformOrigin: `${x}px ${GROUND - 92}px` }}>
                <path d={`M${x - 44} ${GROUND - 120} Q${x} ${GROUND - 70} ${x + 44} ${GROUND - 120} Z`} className="sr-dish-bowl" />
                <line x1={x} y1={GROUND - 92} x2={x} y2={GROUND - 132} className="sr-truss" />
              </g>
            </g>
          );
        }
        return (
          <g key={x} className="sr-crane">
            <rect x={x - 6} y={GROUND - 210} width="12" height="210" className="sr-module-body" />
            <path d={`M${x} ${GROUND - 206} L${x + 110} ${GROUND - 196} M${x} ${GROUND - 206} L${x - 40} ${GROUND - 198}`} className="sr-truss" />
            <line x1={x + 96} y1={GROUND - 197} x2={x + 96} y2={GROUND - 140} className="sr-truss sr-truss-thin" />
            <rect x={x + 88} y={GROUND - 140} width="16" height="12" className="sr-module-body" />
          </g>
        );
      })}
    </svg>
  );
}

function SpaceBack({ width, avoid }) {
  const data = useMemo(() => {
    const r = mulberry(9222);
    const clear = (x, pad = 0) => !avoid.some(([a, b]) => x > a - pad && x < b + pad);
    const domes = [];
    for (let x = 420; x < width - 200; x += 560 + r() * 380) {
      if (clear(x, 60)) domes.push({ x, r: 36 + r() * 22 });
    }
    const masts = [];
    for (let x = 160; x < width; x += 300 + r() * 200) {
      if (clear(x, 10)) masts.push({ x, h: 60 + r() * 50 });
    }
    const crates = [];
    for (let x = 260; x < width; x += 480 + r() * 400) {
      if (clear(x, 30)) crates.push({ x, n: 1 + Math.floor(r() * 3) });
    }
    return { domes, masts, crates };
  }, [width, avoid]);
  return (
    <g className="sr-world-back">
      {data.domes.map((d) => (
        <g key={`d${d.x}`} className="sr-dome">
          <path d={`M${d.x - d.r} ${GROUND} A${d.r} ${d.r} 0 0 1 ${d.x + d.r} ${GROUND} Z`} className="sr-dome-glass" />
          <path d={`M${d.x - d.r} ${GROUND} A${d.r} ${d.r} 0 0 1 ${d.x + d.r} ${GROUND} M${d.x} ${GROUND - d.r} V${GROUND} M${f1(d.x - d.r * 0.7)} ${f1(GROUND - d.r * 0.7)} L${d.x} ${GROUND} L${f1(d.x + d.r * 0.7)} ${f1(GROUND - d.r * 0.7)}`} className="sr-dome-frame" />
          <rect x={d.x - d.r - 6} y={GROUND - 8} width={d.r * 2 + 12} height="8" className="sr-dome-base" />
          <rect x={d.x + d.r * 0.3} y={GROUND - 22} width="12" height="14" className="sr-dome-door" />
        </g>
      ))}
      {data.crates.map((c) => (
        <g key={`c${c.x}`} className="sr-crate">
          {Array.from({ length: c.n }, (_, k) => (
            <rect key={k} x={c.x + (k % 2) * 26 - 13} y={GROUND - 22 * (Math.floor(k / 2) + 1) - (k === 2 ? 0 : 0)} width="24" height="22" />
          ))}
        </g>
      ))}
      {data.masts.map((m, i) => (
        <g key={`m${m.x}`} className="sr-antenna">
          <line x1={m.x} y1={GROUND} x2={m.x} y2={GROUND - m.h} />
          <path d={`M${m.x - 8} ${GROUND - m.h + 14} H${m.x + 8} M${m.x - 5} ${GROUND - m.h + 26} H${m.x + 5}`} />
          <circle cx={m.x} cy={GROUND - m.h - 2} r="2.6" className="sr-bulb sr-bulb-warn" style={{ animationDelay: `${-(i % 4) * 0.3}s` }} />
        </g>
      ))}
    </g>
  );
}

function SpaceFront({ width, crowdAt }) {
  const seams = useMemo(() => {
    let d = '';
    for (let x = 0; x < width; x += 64) d += `M${x} ${GROUND} V${WORLD_H}`;
    return d;
  }, [width]);
  const lights = useMemo(() => {
    const out = [];
    for (let x = 32; x < width; x += 128) out.push(x);
    return out;
  }, [width]);
  return (
    <g className="sr-world-front">
      <rect x="0" y={GROUND} width={width} height={WORLD_H - GROUND} className="sr-deck" />
      <path d={seams} className="sr-deck-seam" />
      <line x1="0" y1={GROUND + 1.5} x2={width} y2={GROUND + 1.5} className="sr-deck-edge" />
      {lights.map((x, i) => (
        <rect key={x} x={x - 5} y={GROUND + 10} width="10" height="3" rx="1.5" className="sr-deck-light" style={{ animationDelay: `${-(i % 8) * 0.25}s` }} />
      ))}
      <Crowd crowdAt={crowdAt} seed={9344} kind="astro" />
    </g>
  );
}

function SpaceFg({ width }) {
  const data = useMemo(() => {
    const r = mulberry(9444);
    const posts = [];
    for (let x = 0; x < width; x += 56) posts.push(x);
    const dust = [];
    for (let x = 30; x < width; x += 50 + r() * 110) dust.push({ x, y: GROUND - 20 - r() * 260, d: 6 + r() * 6, dl: -r() * 8 });
    return { posts, dust };
  }, [width]);
  const y = GROUND + 30;
  return (
    <svg className="sr-layer-svg" viewBox={`0 0 ${width} ${WORLD_H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`M0 ${y - 16} H${width} M0 ${y - 6} H${width}`} className="sr-guard-rail" />
      {data.posts.map((x) => <rect key={x} x={x} y={y - 20} width="4" height="30" rx="1" className="sr-guard-post" />)}
      {data.dust.map((d) => (
        <circle key={d.x} cx={d.x} cy={d.y} r="1.3" className="sr-dust" style={{ '--d': `${d.d}s`, animationDelay: `${d.dl}s` }} />
      ))}
    </svg>
  );
}

export const THEME_SCENERY = {
  fire: { Sky: FireSky, SkyLife: FireSkyLife, Far: FireFar, Park: FirePark, Back: FireBack, Front: FireFront, Fg: FireFg },
  forest: { Sky: ForestSky, SkyLife: ForestSkyLife, Far: ForestFar, Park: ForestPark, Back: ForestBack, Front: ForestFront, Fg: ForestFg },
  space: { Sky: SpaceSky, SkyLife: SpaceSkyLife, Far: SpaceFar, Park: SpacePark, Back: SpaceBack, Front: SpaceFront, Fg: SpaceFg },
};
