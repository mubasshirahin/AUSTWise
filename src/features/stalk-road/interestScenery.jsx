/* eslint-disable react-refresh/only-export-components */
import { cloneElement, useMemo } from 'react';
import { WORLD_H, GROUND, mulberry } from './coasterTrack';
import { mixHex, bounds, ordered } from './themeParts';
import { INTEREST_THEMES } from './interestThemes';

/* ─── Side view for the interest themes ───
   Turns an interest spec (interestThemes.js) into the same seven layers the
   other themes use (Sky, SkyLife, Far, Park, Back, Front, Fg) plus the side
   car. Every prop is drawn from its parts list, the same list the 3D view
   builds, so the two views match. Flat fills only; colour comes from the
   spec (inline), motion from the .ti-a-* classes in StalkRoad.css. */

const f0 = (n) => n.toFixed(0);
const f1 = (n) => n.toFixed(1);
const seedOf = (id) => [...id].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 7) >>> 0;
const FONT = 'ui-sans-serif, system-ui, "Segoe UI Symbol", sans-serif';

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

/* ── one part → one SVG element (y flips: parts are y-up) ── */
function partNode(p, k, col) {
  const fill = col(p.c);
  let el;
  let cx = p.x;
  let cy;
  const common = { opacity: p.op, stroke: p.sk, strokeWidth: p.sw };
  switch (p.s) {
    case 'box':
      cy = -(p.y + p.h / 2);
      el = <rect x={f1(p.x - p.w / 2)} y={f1(-(p.y + p.h))} width={f1(p.w)} height={f1(p.h)} rx={p.rr} fill={fill} {...common} />;
      break;
    case 'cyl': {
      cy = -(p.y + p.h / 2);
      const r2 = p.r2 ?? p.r;
      el = <polygon points={`${f1(p.x - p.r)},${f1(-p.y)} ${f1(p.x + p.r)},${f1(-p.y)} ${f1(p.x + r2)},${f1(-(p.y + p.h))} ${f1(p.x - r2)},${f1(-(p.y + p.h))}`} fill={fill} {...common} />;
      break;
    }
    case 'cone':
      cy = -(p.y + p.h / 2);
      el = <polygon points={`${f1(p.x - p.r)},${f1(-p.y)} ${f1(p.x + p.r)},${f1(-p.y)} ${f1(p.x)},${f1(-(p.y + p.h))}`} fill={fill} {...common} />;
      break;
    case 'tri':
      cy = -(p.y + p.h / 2);
      el = <polygon points={`${f1(p.x - p.w / 2)},${f1(-p.y)} ${f1(p.x + p.w / 2)},${f1(-p.y)} ${f1(p.x + (p.ax || 0))},${f1(-(p.y + p.h))}`} fill={fill} {...common} />;
      break;
    case 'dome':
      cy = -(p.y + p.r / 2);
      el = <path d={`M${f1(p.x - p.r)} ${f1(-p.y)} A${f1(p.r)} ${f1(p.r)} 0 0 1 ${f1(p.x + p.r)} ${f1(-p.y)} Z`} fill={fill} {...common} />;
      break;
    case 'disc':
      cy = -p.y;
      el = <circle cx={f1(p.x)} cy={f1(-p.y)} r={f1(p.r)} fill={fill} {...common} />;
      break;
    case 'ball':
      cy = -p.y;
      el = <ellipse cx={f1(p.x)} cy={f1(-p.y)} rx={f1(p.r)} ry={f1(p.r * (p.sy ?? 1))} fill={fill} {...common} />;
      break;
    case 'ring':
      cy = -p.y;
      el = <circle cx={f1(p.x)} cy={f1(-p.y)} r={f1(p.r)} fill="none" stroke={fill} strokeWidth={p.t} opacity={p.op} />;
      break;
    case 'glyph':
      cy = -p.y;
      el = (
        <text
          x={f1(p.x)}
          y={f1(-p.y)}
          fontSize={p.size}
          fontWeight={p.wt || 700}
          fontFamily={FONT}
          textAnchor="middle"
          dominantBaseline="central"
          fill={fill}
          opacity={p.op}
        >
          {p.t}
        </text>
      );
      break;
    case 'line':
      cx = (p.x1 + p.x2) / 2;
      cy = -(p.y1 + p.y2) / 2;
      el = <line x1={f1(p.x1)} y1={f1(-p.y1)} x2={f1(p.x2)} y2={f1(-p.y2)} stroke={fill} strokeWidth={p.w} strokeLinecap="round" opacity={p.op} />;
      break;
    default:
      return null;
  }
  const rot = p.rz ? `rotate(${-p.rz} ${f1(cx)} ${f1(cy)})` : undefined;
  if (p.a) {
    el = cloneElement(el, { className: `ti-a ti-a-${p.a}`, style: p.dl ? { animationDelay: `${-p.dl}s` } : undefined });
  }
  return rot ? <g key={k} transform={rot}>{el}</g> : cloneElement(el, { key: k });
}

/* a whole prop at (x, base) */
function Prop({ parts, x, base, s = 1, col }) {
  return (
    <g transform={`translate(${f1(x)} ${f1(base)}) scale(${s.toFixed(3)})`}>
      {ordered(parts).map((p, k) => partNode(p, k, col))}
    </g>
  );
}
const asIs = (c) => c;

/* ── people (side view) ── */
const SKIN = ['#f0c8a0', '#d9a878', '#a8754a', '#7a4e2e'];
function Person({
  x, h, shirt, skin, acc, wave, d,
}) {
  const top = GROUND + 8 - h;
  const body = h * 0.42;
  const legs = `M${f1(x - 4)} ${f1(top + 10 + body)} v${f1(h * 0.5 - 8)} M${f1(x + 4)} ${f1(top + 10 + body)} v${f1(h * 0.5 - 8)}`;
  const armUp = (side, k) => (
    <line
      key={`a${k}`}
      x1={f1(x + side * 5)}
      y1={f1(top + 12)}
      x2={f1(x + side * 11)}
      y2={f1(top - 1)}
      className="sr-wave"
      style={{ stroke: skin, strokeWidth: 2.6, strokeLinecap: 'round', transformOrigin: `${f1(x + side * 5)}px ${f1(top + 12)}px`, animationDelay: `${-d - k * 0.3}s` }}
    />
  );
  const armDown = <line x1={f1(x + 6)} y1={f1(top + 12)} x2={f1(x + 8)} y2={f1(top + 10 + h * 0.4)} style={{ stroke: skin, strokeWidth: 2.6, strokeLinecap: 'round' }} />;
  const bothUp = acc === 'hands' || acc === 'scarf';
  let extra = null;
  if (acc === 'headset' || acc === 'headphones') {
    extra = (
      <>
        <path d={`M${f1(x - 5)} ${f1(top + 4)} q5 -9 10 0`} fill="none" stroke="#1a1a22" strokeWidth="1.6" />
        <rect x={f1(x - 6.5)} y={f1(top + 2.5)} width="3" height="4.5" rx="1" fill="#1a1a22" />
        <rect x={f1(x + 3.5)} y={f1(top + 2.5)} width="3" height="4.5" rx="1" fill="#1a1a22" />
        {acc === 'headset' && <path d={`M${f1(x + 5)} ${f1(top + 6)} q2 4 -3 4`} fill="none" stroke="#1a1a22" strokeWidth="1.1" />}
      </>
    );
  } else if (acc === 'cap') {
    extra = <path d={`M${f1(x - 5)} ${f1(top + 1.5)} q5 -6 10 0 h4 z`} fill={shirt} />;
  } else if (acc === 'hood') {
    extra = <path d={`M${f1(x - 6)} ${f1(top + 10)} q-1 -13 6 -12 q7 -1 6 12 z`} fill={shirt} />;
  } else if (acc === 'beret') {
    extra = <ellipse cx={f1(x - 1)} cy={f1(top + 0.5)} rx="5.5" ry="2.2" fill="#3a2e26" />;
  } else if (acc === 'chef') {
    extra = (
      <>
        <rect x={f1(x - 4)} y={f1(top - 6)} width="8" height="7" fill="#ffffff" />
        <circle cx={f1(x)} cy={f1(top - 7)} r="4.5" fill="#ffffff" />
      </>
    );
  } else if (acc === 'glasses') {
    extra = <path d={`M${f1(x - 3.6)} ${f1(top + 4)} h7.2`} stroke="#1a1a22" strokeWidth="1.3" />;
  } else if (acc === 'band') {
    extra = <path d={`M${f1(x - 4.2)} ${f1(top + 1.6)} h8.4`} stroke="#ffffff" strokeWidth="1.6" />;
  }
  return (
    <g>
      <circle cx={f1(x)} cy={f1(top + 4)} r="4.2" fill={skin} />
      {acc !== 'hood' && acc !== 'chef' && acc !== 'cap' && acc !== 'beret' && (
        <path d={`M${f1(x - 4.2)} ${f1(top + 3)} q4.2 -6 8.4 0 z`} fill="#2a1e18" />
      )}
      <path d={`M${f1(x - 6)} ${f1(top + 10)} h12 l1 ${f1(body)} h-14 z`} fill={shirt} />
      <path d={legs} stroke="#20222c" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      {extra}
      {bothUp && [armUp(-1, 0), armUp(1, 1)]}
      {!bothUp && (wave ? armUp(1, 0) : armDown)}
      {acc === 'scarf' && <path d={`M${f1(x - 11)} ${f1(top - 1)} L${f1(x + 11)} ${f1(top - 1)}`} stroke={shirt} strokeWidth="3" />}
    </g>
  );
}

function Crowd({ crowdAt, seed, crowd }) {
  const people = useMemo(() => {
    const r = mulberry(seed);
    const out = [];
    crowdAt.forEach((cx, gi) => {
      const count = 4 + Math.floor(r() * 4);
      for (let i = 0; i < count; i += 1) {
        out.push({
          x: cx - 70 + r() * 140,
          h: 28 + r() * 10,
          shirt: crowd.shirts[Math.floor(r() * crowd.shirts.length)],
          skin: SKIN[Math.floor(r() * SKIN.length)],
          wave: r() < 0.35,
          d: r() * 1.2,
          k: `${gi}-${i}`,
        });
      }
    });
    return out.sort((a, b) => a.h - b.h);
  }, [crowdAt, seed, crowd]);
  return people.map((p) => <Person key={p.k} {...p} acc={crowd.acc} />);
}

/* ── ground patterns (the strip from GROUND to the bottom of the world) ── */
function groundPattern(kind, width, pal, r) {
  const H = WORLD_H - GROUND;
  const out = [];
  if (kind === 'stripes') {
    for (let x = 0; x < width; x += 80) out.push(<rect key={x} x={x} y={GROUND} width="40" height={H} fill={pal.ground2} />);
  } else if (kind === 'checker') {
    for (let x = 0, i = 0; x < width; x += 19, i += 1) {
      for (let j = 0; j < 2; j += 1) {
        if ((i + j) % 2) out.push(<rect key={`${x}-${j}`} x={x} y={GROUND + j * 19} width="19" height="19" fill={pal.ground2} />);
      }
    }
  } else if (kind === 'planks') {
    let d = `M0 ${GROUND + 13} H${width} M0 ${GROUND + 26} H${width}`;
    for (let x = 0, i = 0; x < width; x += 70, i += 1) {
      d += ` M${x + (i % 2) * 35} ${GROUND} v13 M${x + 20} ${GROUND + 13} v13 M${x + 52} ${GROUND + 26} v12`;
    }
    out.push(<path key="p" d={d} stroke={pal.ground2} strokeWidth="1.5" fill="none" />);
  } else if (kind === 'grid') {
    let d = `M0 ${GROUND + 12} H${width} M0 ${GROUND + 26} H${width}`;
    for (let x = 0; x < width; x += 40) d += ` M${x} ${GROUND} V${WORLD_H}`;
    out.push(<path key="g" d={d} stroke={pal.line} strokeOpacity="0.22" strokeWidth="1" fill="none" />);
  } else if (kind === 'circuit') {
    let d = '';
    const dots = [];
    for (let x = 10; x < width; x += 46 + r() * 40) {
      const y = GROUND + 7 + r() * 16;
      const len = 14 + r() * 22;
      const up = r() < 0.5 ? -1 : 1;
      d += ` M${f0(x)} ${f0(y)} h${f0(len)} l6 ${up * 6} h${f0(10 + r() * 14)}`;
      dots.push([x, y], [x + len + 6 + 12, y + up * 6]);
    }
    out.push(<path key="c" d={d} stroke={pal.line} strokeOpacity="0.42" strokeWidth="1.4" fill="none" />);
    dots.forEach(([x, y], k) => out.push(<circle key={`d${k}`} cx={f0(x)} cy={f0(y)} r="2" fill={pal.line} fillOpacity="0.6" />));
  } else if (kind === 'lanes') {
    out.push(<path key="l" d={`M0 ${GROUND + 11} H${width} M0 ${GROUND + 22} H${width} M0 ${GROUND + 33} H${width}`} stroke={pal.line} strokeOpacity="0.85" strokeWidth="1.4" fill="none" />);
  } else if (kind === 'tiles') {
    const lit = [pal.line, '#5ad1ff', '#ffd23a'];
    for (let x = 0, i = 0; x < width; x += 26, i += 1) {
      for (let j = 0; j < 2; j += 1) {
        const on = (i * 7 + j * 3) % 11 === 0;
        out.push(
          <rect
            key={`${x}-${j}`}
            x={x + 1}
            y={GROUND + 1 + j * 19}
            width="24"
            height="17"
            fill={on ? lit[(i + j) % 3] : ((i + j) % 2 ? pal.ground2 : pal.ground)}
            fillOpacity={on ? 0.55 : 1}
            className={on ? 'ti-a ti-a-blink' : undefined}
            style={on ? { animationDelay: `${-((i % 5) * 0.4)}s` } : undefined}
          />,
        );
      }
    }
  } else if (kind === 'sand') {
    for (let x = 4; x < width; x += 9 + r() * 16) out.push(<circle key={x} cx={f0(x)} cy={f0(GROUND + 4 + r() * (H - 6))} r={f1(0.8 + r() * 1.3)} fill={pal.ground2} />);
  }
  return out;
}

/* ── foreground fences ── */
function fence(fg, width, pal, r) {
  const y = GROUND + 30;
  const out = [];
  const c = fg.colors || [pal.steel, pal.steel2];
  if (fg.kind === 'boards') {
    for (let x = 0, k = 0; x < width; x += 170, k += 1) {
      out.push(<rect key={`b${x}`} x={x + 2} y={y - 30} width="166" height="28" fill={c[k % c.length]} />);
      out.push(<text key={`t${x}`} x={x + 85} y={y - 16} fontSize="13" fontWeight="900" fontFamily={FONT} textAnchor="middle" dominantBaseline="central" fill={fg.ink[k % fg.ink.length]}>{fg.words[k % fg.words.length]}</text>);
    }
  } else if (fg.kind === 'rope') {
    let d = `M0 ${y - 10}`;
    for (let x = 0; x < width; x += 90) d += ` Q${x + 45} ${y - 4} ${x + 90} ${y - 10}`;
    out.push(<path key="rope" d={d} stroke={c[0]} strokeWidth="3" fill="none" />);
    for (let x = 0; x < width; x += 90) out.push(<rect key={`p${x}`} x={x - 2} y={y - 14} width="4" height="22" fill={c[1]} />);
    if (fg.words) {
      for (let x = 260, k = 0; x < width; x += 700 + r() * 500, k += 1) {
        out.push(<rect key={`s${x}`} x={f0(x)} y={y - 36} width="70" height="20" fill={pal.board} />);
        out.push(<text key={`w${x}`} x={f0(x + 35)} y={y - 26} fontSize="10" fontWeight="900" fontFamily={FONT} textAnchor="middle" dominantBaseline="central" fill={fg.ink[k % fg.ink.length]}>{fg.words[k % fg.words.length]}</text>);
      }
    }
  } else if (fg.kind === 'rail') {
    out.push(<path key="r" d={`M0 ${y - 18} H${width} M0 ${y - 7} H${width}`} stroke={c[0]} strokeWidth="3" fill="none" />);
    for (let x = 0; x < width; x += 60) out.push(<rect key={x} x={x} y={y - 22} width="5" height="32" fill={c[1]} />);
  } else if (fg.kind === 'cable') {
    c.forEach((col, k) => {
      let d = `M0 ${y - 4 - k * 6}`;
      const span = 140 + k * 40;
      for (let x = 0; x < width; x += span) d += ` Q${f0(x + span / 2)} ${y + 8 - k * 6} ${f0(x + span)} ${y - 4 - k * 6}`;
      out.push(<path key={`c${k}`} d={d} stroke={col} strokeWidth={3 - k * 0.6} fill="none" />);
    });
    for (let x = 0; x < width; x += 280) out.push(<rect key={`j${x}`} x={x - 6} y={y - 20} width="12" height="26" rx="2" fill={pal.steel2} />);
  } else if (fg.kind === 'keys') {
    for (let x = 0, k = 0; x < width; x += 40, k += 1) {
      const wide = k % 9 === 4;
      out.push(<rect key={`k${x}`} x={x + 2} y={y - 26} width={wide ? 76 : 36} height="30" rx="5" fill={c[k % 2]} />);
      out.push(<rect key={`kt${x}`} x={x + 6} y={y - 24} width={wide ? 68 : 28} height="20" rx="4" fill={mixHex(c[k % 2], '#ffffff', 0.08)} />);
      out.push(<text key={`kg${x}`} x={x + (wide ? 40 : 20)} y={y - 14} fontSize="10" fontWeight="800" fontFamily={FONT} textAnchor="middle" dominantBaseline="central" fill={fg.ink[k % fg.ink.length]}>{fg.words[k % fg.words.length]}</text>);
      if (wide) x += 40;
    }
  } else if (fg.kind === 'barrier') {
    for (let x = 0; x < width; x += 64) {
      out.push(<rect key={`f${x}`} x={x + 2} y={y - 30} width="60" height="34" fill="none" stroke={c[0]} strokeWidth="2.2" />);
      out.push(<path key={`g${x}`} d={`M${x + 12} ${y - 30} v34 M${x + 22} ${y - 30} v34 M${x + 32} ${y - 30} v34 M${x + 42} ${y - 30} v34 M${x + 52} ${y - 30} v34`} stroke={c[0]} strokeWidth="1" />);
    }
  } else if (fg.kind === 'candy') {
    out.push(<path key="r" d={`M0 ${y - 16} H${width}`} stroke={c[1]} strokeWidth="3" fill="none" />);
    for (let x = 0; x < width; x += 70) {
      out.push(<rect key={`p${x}`} x={x} y={y - 28} width="7" height="36" fill={c[1]} />);
      out.push(<path key={`s${x}`} d={`M${x} ${y - 24} l7 -4 M${x} ${y - 14} l7 -4 M${x} ${y - 4} l7 -4`} stroke={c[0]} strokeWidth="3" />);
      out.push(<circle key={`b${x}`} cx={x + 3.5} cy={y - 30} r="5" fill={c[0]} />);
    }
  } else if (fg.kind === 'books') {
    const spines = ['#8a3a3a', '#3a5a8a', '#4f6a3a', '#c29a4a', '#6a3a6a', '#2f6a6a'];
    for (let x = 0, k = 0; x < width; k += 1) {
      const w = 9 + r() * 7;
      const h = 22 + r() * 16;
      out.push(<rect key={`b${k}`} x={f1(x)} y={f1(y + 6 - h)} width={f1(w)} height={f1(h)} fill={spines[k % spines.length]} />);
      out.push(<rect key={`g${k}`} x={f1(x)} y={f1(y + 6 - h * 0.7)} width={f1(w)} height="2" fill="#ffd27a" />);
      x += w + 1;
    }
  }
  return out;
}

/* ═════════ scenery factory ═════════ */
function makeScenery(spec) {
  const seed = seedOf(spec.id);
  const { pal } = spec;
  const fadeTo = (t) => (c) => mixHex(c, pal.sky, t);

  function Sky({ stars }) {
    const glyphs = useMemo(() => {
      if (!spec.skyGlyphs) return [];
      const r = mulberry(seed + 1);
      const { list, colors } = spec.skyGlyphs;
      return Array.from({ length: 16 }, (_, i) => ({
        i, t: list[i % list.length], c: colors[i % colors.length], left: r() * 96, top: 6 + r() * 48, size: 14 + r() * 18, d: 4 + r() * 4, dl: -r() * 8,
      }));
    }, []);
    const rain = useMemo(() => {
      if (!spec.rain) return [];
      const r = mulberry(seed + 2);
      return Array.from({ length: 34 }, (_, i) => ({
        i,
        left: (i / 34) * 100 + r() * 2,
        size: 11 + r() * 6,
        d: 6 + r() * 8,
        dl: -r() * 14,
        op: 0.25 + r() * 0.5,
        t: Array.from({ length: 14 + Math.floor(r() * 10) }, () => (r() < 0.5 ? '0' : '1')).join('\n'),
      }));
    }, []);
    const { sun } = spec;
    return (
      <>
        {spec.stars && stars.map((s) => (
          <span
            key={s.i}
            className="sr-star"
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, '--d': `${s.d}s`, animationDelay: `${s.dl}s` }}
          />
        ))}
        {sun && (
          <span
            className="ti-sun"
            style={{
              background: sun.c,
              top: `${sun.top}%`,
              right: `${sun.right}%`,
              width: `clamp(${Math.round(sun.size * 0.6)}px, ${(sun.size / 11).toFixed(1)}vw, ${sun.size}px)`,
              borderRadius: sun.pixel ? '16%' : '50%',
            }}
          />
        )}
        {rain.map((d) => (
          <span key={`r${d.i}`} className="ti-rain" style={{ left: `${d.left}%`, fontSize: d.size, color: spec.rain, opacity: d.op, animationDuration: `${d.d}s`, animationDelay: `${d.dl}s` }}>
            {d.t}
          </span>
        ))}
        {glyphs.map((g) => (
          <span key={`g${g.i}`} className="ti-skyglyph" style={{ left: `${g.left}%`, top: `${g.top}%`, fontSize: g.size, color: g.c, animationDuration: `${g.d}s`, animationDelay: `${g.dl}s` }}>
            {g.t}
          </span>
        ))}
      </>
    );
  }

  function SkyLife() {
    const data = useMemo(() => {
      const r = mulberry(seed + 3);
      const cloudCols = spec.clouds ? [].concat(spec.clouds) : [];
      const clouds = cloudCols.length ? Array.from({ length: 6 }, (_, i) => ({
        i,
        c: cloudCols[i % cloudCols.length],
        top: 5 + r() * 32,
        scale: 0.6 + r() * 0.9,
        dur: 150 + r() * 120,
        delay: -r() * 260,
        puffs: Array.from({ length: 4 + Math.floor(r() * 3) }, (__, k) => ({ cx: 30 + k * 26 + r() * 10, cy: 34 - r() * 14, r: 14 + r() * 14 })),
      })) : [];
      const flyers = (spec.flyers || []).flatMap((parts, fi) => [0, 1].map((n) => {
        const b = bounds(parts);
        return {
          k: `${fi}-${n}`, parts, b, top: 8 + r() * 30, w: Math.min(110, b.w * 1.1), dur: 60 + r() * 70, dl: -r() * 120,
        };
      }));
      return { clouds, flyers };
    }, []);
    return (
      <>
        {data.clouds.map((c) => (
          <span key={c.i} className="sr-cloud ti-cloud" style={{ top: `${c.top}%`, '--sc': c.scale, '--dur': `${c.dur}s`, animationDelay: `${c.delay}s` }}>
            <svg viewBox="0 0 200 60" aria-hidden="true" style={{ fill: c.c }}>
              {c.puffs.map((p, k) => <circle key={k} cx={p.cx} cy={p.cy} r={p.r} />)}
              <rect x="24" y="34" width={c.puffs.length * 26 + 20} height="16" rx="8" />
            </svg>
          </span>
        ))}
        {data.flyers.map((f) => (
          <span key={f.k} className="ti-flyer" style={{ top: `${f.top}%`, width: f.w, animationDuration: `${f.dur}s`, animationDelay: `${f.dl}s` }}>
            <svg viewBox={`${f1(f.b.x0 - 4)} ${f1(-f.b.y1 - 4)} ${f1(f.b.w + 8)} ${f1(f.b.h + 8)}`} aria-hidden="true">
              {ordered(f.parts).map((p, k) => partNode(p, k, asIs))}
            </svg>
          </span>
        ))}
      </>
    );
  }

  function Far({ width }) {
    const els = useMemo(() => {
      const r = mulberry(seed + 4);
      const far = spec.far || { kind: 'ridge' };
      const out = [];
      if (far.kind === 'ridge') {
        out.push(<path key="ridge" d={ridgePath(r, width, GROUND - 40, (far.amp || 70) * 2, 220)} fill={pal.far} />);
      } else if (far.kind === 'sea') {
        out.push(<path key="isl" d={ridgePath(r, width, GROUND - 10, (far.amp || 60), 420)} fill={pal.far} />);
      } else if (far.kind === 'blocks') {
        const pals = far.palette || [pal.far];
        for (let x = -20, k = 0; x < width; k += 1) {
          const w = far.shelves ? 22 + r() * 30 : 50 + r() * 70;
          const h = far.shelves ? 120 + r() * 170 : 80 + r() * 200;
          const c = far.shelves ? mixHex(pals[k % pals.length], pal.sky, 0.62) : pals[k % pals.length];
          out.push(<rect key={`b${k}`} x={f0(x)} y={f0(GROUND - h)} width={f0(w + 1)} height={f0(h)} fill={c} />);
          if (far.shelves) {
            out.push(<rect key={`s${k}`} x={f0(x)} y={f0(GROUND - h * 0.78)} width={f0(w + 1)} height="4" fill={mixHex('#ffd27a', pal.sky, 0.6)} />);
          } else if (far.lit) {
            for (let j = 0; j < 7; j += 1) {
              if (r() < 0.55) {
                out.push(
                  <rect
                    key={`w${k}-${j}`}
                    x={f0(x + 6 + r() * (w - 14))}
                    y={f0(GROUND - h + 12 + r() * (h - 24))}
                    width="4"
                    height="5"
                    fill={far.lit[Math.floor(r() * far.lit.length)]}
                    fillOpacity="0.55"
                  />,
                );
              }
            }
          }
          x += w + (far.shelves ? 1 : r() * 18);
        }
      } else if (far.kind === 'stands') {
        const top = GROUND - 170;
        out.push(<path key="st" d={`M0 ${GROUND} V${top + 40} L${width} ${top + 40} V${GROUND} Z`} fill={far.palette[0]} />);
        out.push(<rect key="tier" x="0" y={top} width={width} height="44" fill={far.palette[1]} />);
        out.push(<rect key="roof" x="0" y={top - 10} width={width} height="8" fill={mixHex(far.palette[0], '#ffffff', 0.12)} />);
        // one path per shirt colour — thousands of specks, a handful of nodes
        const specks = far.crowd.map(() => []);
        for (let row = 0; row < 9; row += 1) {
          const yy = top + 6 + row * 14 + (row > 2 ? 8 : 0);
          for (let x = (row % 2) * 4; x < width; x += 8) {
            if (r() < 0.82) specks[Math.floor(r() * far.crowd.length)].push(`M${x} ${yy}h4v5h-4z`);
          }
        }
        specks.forEach((d, k) => out.push(<path key={`c${k}`} d={d.join('')} fill={far.crowd[k]} fillOpacity="0.5" />));
      }
      // distant landmark silhouettes
      const lm = spec.landmarks || [];
      if (lm.length && far.kind !== 'stands') {
        const mono = mixHex(pal.far, pal.mid, 0.45);
        const col = () => mono;
        for (let x = 300, k = 0; x < width; x += 900 + r() * 900, k += 1) {
          out.push(<Prop key={`l${k}`} parts={lm[k % lm.length]} x={x} base={GROUND - 30} s={0.62 + r() * 0.3} col={col} />);
        }
      }
      return out;
    }, [width]);
    return <svg className="sr-layer-svg" viewBox={`0 0 ${width} ${WORLD_H}`} preserveAspectRatio="none" aria-hidden="true">{els}</svg>;
  }

  function Park({ width }) {
    const els = useMemo(() => {
      const r = mulberry(seed + 5);
      const out = [];
      if (spec.far?.kind === 'sea') {
        out.push(<rect key="sea" x="0" y={GROUND - 46} width={width} height="46" fill={pal.mid} />);
        let d = '';
        for (let x = 0; x < width; x += 60) d += ` M${x} ${GROUND - 30 + (x % 120 ? 12 : 0)} q15 -5 30 0`;
        out.push(<path key="waves" d={d} stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.5" fill="none" />);
      } else {
        out.push(<path key="hills" d={ridgePath(r, width, GROUND, 50, 160)} fill={pal.mid} />);
      }
      const lm = spec.landmarks || [];
      const col = fadeTo(spec.light ? 0.38 : 0.32);
      for (let x = 160, k = 0; x < width - 80; x += 380 + r() * 300, k += 1) {
        out.push(<Prop key={k} parts={lm[k % lm.length]} x={x} base={GROUND - 6} s={0.8 + r() * 0.35} col={col} />);
      }
      return out;
    }, [width]);
    return <svg className="sr-layer-svg" viewBox={`0 0 ${width} ${WORLD_H}`} preserveAspectRatio="none" aria-hidden="true">{els}</svg>;
  }

  function Back({ width, avoid }) {
    const els = useMemo(() => {
      const r = mulberry(seed + 6);
      const props = spec.props || [];
      const out = [];
      const clear = (x, pad) => !avoid.some(([a, b]) => x > a - pad && x < b + pad);
      let k = 0;
      for (let x = 220; x < width - 120; x += 150 + r() * 120) {
        const parts = props[k % props.length];
        const s = 0.85 + r() * 0.3;
        const half = (bounds(parts).w * s) / 2;
        if (clear(x, half + 24)) {
          out.push(<Prop key={x} parts={parts} x={x} base={GROUND + 2} s={s} col={asIs} />);
          k += 1;
        }
      }
      return out;
    }, [width, avoid]);
    return <g className="sr-world-back">{els}</g>;
  }

  function Front({ width, crowdAt }) {
    const els = useMemo(() => {
      const r = mulberry(seed + 7);
      const out = [<rect key="g" x="0" y={GROUND} width={width} height={WORLD_H - GROUND} fill={pal.ground} />];
      out.push(...groundPattern(spec.ground?.kind, width, pal, r));
      out.push(<line key="edge" x1="0" y1={GROUND + 0.75} x2={width} y2={GROUND + 0.75} stroke={pal.line} strokeOpacity="0.7" strokeWidth="1.5" />);
      const small = spec.small || [];
      if (small.length) {
        for (let x = 90, k = 0; x < width; x += 140 + r() * 220, k += 1) {
          out.push(<Prop key={`s${x}`} parts={small[k % small.length]} x={x} base={GROUND + 8 + r() * 6} s={0.9 + r() * 0.3} col={asIs} />);
        }
      }
      return out;
    }, [width]);
    return (
      <g className="sr-world-front">
        {els}
        <Crowd crowdAt={crowdAt} seed={seed + 8} crowd={spec.crowd} />
      </g>
    );
  }

  function Fg({ width }) {
    const els = useMemo(() => fence(spec.fg || { kind: 'rail' }, width, pal, mulberry(seed + 9)), [width]);
    return <svg className="sr-layer-svg" viewBox={`0 0 ${width} ${WORLD_H}`} preserveAspectRatio="none" aria-hidden="true">{els}</svg>;
  }

  return { Sky, SkyLife, Far, Park, Back, Front, Fg };
}

export const INTEREST_SCENERY = Object.fromEntries(INTEREST_THEMES.map((t) => [t.id, makeScenery(t)]));

/* ── side-view car for an interest theme ── */
export function InterestCarBody({ front, spec }) {
  const car = spec.car;
  const shell = { fill: car.shell, stroke: mixHex(car.shell, '#000000', 0.45) };
  return (
    <>
      <rect x="-19" y="-9" width="38" height="5" rx="1.5" className="sr-car-bogie" />
      {[-13, 13].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="-3.6" r="3.8" className="sr-car-wheel" />
          <circle cx={cx} cy="-3.6" r="1.3" style={{ fill: car.trim }} />
          <circle cx={cx} cy="6.4" r="2.2" className="sr-car-wheel sr-car-upstop" />
        </g>
      ))}
      <rect x="-15" y="-36" width="4" height="12" rx="2" style={{ fill: car.seat }} />
      <rect x="1" y="-36" width="4" height="12" rx="2" style={{ fill: car.seat }} />
      <g className="sr-riders">
        <line x1="-8" y1="-26" x2="-13" y2="-39" className="sr-arm" />
        <line x1="-6" y1="-26" x2="-1" y2="-39" className="sr-arm" />
        <line x1="8" y1="-26" x2="3" y2="-39" className="sr-arm" />
        <line x1="10" y1="-26" x2="15" y2="-39" className="sr-arm" />
        <circle cx="-7" cy="-28.5" r="4.4" className="sr-rider" />
        <circle cx="9" cy="-28.5" r="4.4" className="sr-rider sr-rider-b" />
      </g>
      <path
        d={front
          ? 'M-22 -8 L-22 -21 Q-22 -25 -18 -25 L6 -25 Q12 -25 15 -21 L25 -13 Q27 -10 25 -8 Z'
          : 'M-22 -8 L-22 -21 Q-22 -25 -18 -25 L18 -25 Q22 -25 22 -21 L22 -8 Z'}
        style={{ ...shell, strokeWidth: 1.2 }}
      />
      <rect x="-18" y="-21" width={front ? 22 : 36} height="5" rx="2" style={{ fill: car.seat }} />
      <path d="M-2 -20 l5 -4 M14 -20 l5 -4" className="sr-car-lapbar" />
      <g>{ordered(car.deco || []).map((p, k) => partNode(p, k, asIs))}</g>
      {front && <circle cx="22" cy="-11.5" r="2" style={{ fill: car.lamp }} />}
      {!front && <rect x="-23" y="-17" width="2" height="4" rx="1" className="sr-car-tail" />}
    </>
  );
}
