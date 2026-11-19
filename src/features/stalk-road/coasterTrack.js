/* ─── Orbit Express: procedural roller-coaster track ───
   The track is built from simple pieces (station, lift hill, drops, hills,
   loops, corkscrews, gates) in "world units". The world is 600 units tall;
   the scene scales it uniformly to the screen, so loops stay round on every
   device. Everything is sampled into a lookup table (LUT) once, so each
   animation frame only does a binary search — no DOM path measuring. */

export const WORLD_H = 600;
export const GROUND = 562;
export const BASE = 420; // level of the station + checkpoint gates
export const CAR_GAP = 50; // spacing between train cars along the track
export const CAR_COUNT = 4;

/* Deterministic pseudo-random generator (stable scenery across mounts) */
export function mulberry(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const K = 0.5523; // cubic-bezier circle constant

function cubicPt(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

/* Each ride theme has its own layout: the element after every checkpoint
   gate (cycled), the lift-hill height, how deep the first drop goes and how
   the structure is built (steel: sparse columns; wood: dense lattice). */
export const LAYOUTS = {
  // steel looper over the city
  city: { elements: ['loop', 'camel', 'corkscrew', 'hops', 'dive', 'loop2'], liftTop: 112, valley: 528, step: 44 },
  // plunges into the lava valley, a top-hat spike, one fiery loop
  fire: { elements: ['plunge', 'spike', 'corkscrew', 'plunge2', 'loop', 'hops'], liftTop: 76, valley: 548, step: 44 },
  // classic wooden coaster: no inversions, all airtime hills
  forest: { elements: ['bunny', 'camel2', 'wave', 'camel', 'bunny', 'wave'], liftTop: 150, valley: 522, step: 26, wooden: true },
  // giant loop, zero-g rolls and a double corkscrew
  space: { elements: ['bigloop', 'zerog', 'corkscrew2', 'loop2', 'zerog', 'dive'], liftTop: 64, valley: 500, step: 56 },
  // interest themes (interestThemes.js) — each with its own run of elements
  gamer: { elements: ['hops', 'loop', 'spike', 'zerog', 'bunny', 'loop2'], liftTop: 96, valley: 530, step: 44 },
  football: { elements: ['camel', 'loop', 'hops', 'corkscrew', 'camel2', 'dive'], liftTop: 104, valley: 530, step: 44 },
  cricket: { elements: ['camel2', 'bunny', 'spike', 'wave', 'camel', 'hops'], liftTop: 120, valley: 524, step: 26, wooden: true },
  tech: { elements: ['bigloop', 'hops', 'corkscrew2', 'camel', 'loop2', 'dive'], liftTop: 70, valley: 505, step: 56 },
  coder: { elements: ['loop', 'camel', 'zerog', 'hops', 'loop2', 'dive'], liftTop: 100, valley: 528, step: 44 },
  hacker: { elements: ['plunge', 'corkscrew', 'spike', 'zerog', 'plunge2', 'loop'], liftTop: 76, valley: 548, step: 44 },
  music: { elements: ['wave', 'loop', 'bunny', 'corkscrew', 'hops', 'loop2'], liftTop: 104, valley: 528, step: 44 },
  artist: { elements: ['camel', 'wave', 'loop', 'bunny', 'camel2', 'hops'], liftTop: 110, valley: 526, step: 44 },
  bookworm: { elements: ['camel2', 'loop', 'wave', 'zerog', 'bunny', 'dive'], liftTop: 104, valley: 528, step: 44 },
  foodie: { elements: ['bunny', 'loop', 'camel', 'hops', 'spike', 'wave'], liftTop: 100, valley: 528, step: 44 },
  fitness: { elements: ['spike', 'hops', 'plunge2', 'loop', 'camel', 'bunny'], liftTop: 84, valley: 540, step: 44 },
  travel: { elements: ['camel', 'wave', 'bigloop', 'bunny', 'camel2', 'dive'], liftTop: 70, valley: 505, step: 56 },
};

export function buildTrack(stopCount, layoutId = 'city') {
  const layout = LAYOUTS[layoutId] || LAYOUTS.city;
  const ELEMENTS = layout.elements;
  const segs = []; // { type: 'L'|'C', pts: [...] }
  let x = 0;
  let y = BASE;
  const loops = []; // [startLen, endLen] measured later via segment index
  const rolls = []; // corkscrew ranges
  const gates = []; // { x, y, segIndex }
  const marks = {}; // named segment indices

  const line = (nx, ny) => {
    segs.push({ type: 'L', pts: [[x, y], [nx, ny]] });
    x = nx; y = ny;
  };
  const cubic = (c1, c2, e) => {
    segs.push({ type: 'C', pts: [[x, y], c1, c2, e] });
    x = e[0]; y = e[1];
  };
  // S-curve between two heights, horizontal tangent at both ends
  const sTo = (dx, ey, t = 0.42) => cubic([x + dx * t, y], [x + dx * (1 - t), ey], [x + dx, ey]);
  const hump = (w, peak, t = 0.42) => { const base = y; sTo(w / 2, peak, t); sTo(w / 2, base, t); };
  const flat = (len) => line(x + len, y);

  // ── departure station ──
  marks.stationStart = { x: 0, y: BASE };
  flat(320);
  marks.startLenSeg = segs.length; // train parks inside the station

  // ── chain lift hill (45°) + crest ──
  marks.liftStart = segs.length;
  cubic([x + 50, y], [x + 80, y - 18], [x + 110, y - 48]);
  const { liftTop } = layout;
  const climb = y - (liftTop + 40);
  line(x + climb, y - climb);
  marks.liftEnd = segs.length;
  cubic([x + 30, y - 30], [x + 62, y - 40], [x + 92, y - 40]);

  // ── first drop into a valley, then up to gate level ──
  sTo(250, layout.valley, 0.36);
  flat(30);
  sTo(230, BASE, 0.4);

  for (let i = 0; i < stopCount; i += 1) {
    // ── checkpoint gate (flat, calm section) ──
    flat(140);
    gates.push({ x, y, segIndex: segs.length });
    flat(140);

    // ── ride element ──
    const el = ELEMENTS[i % ELEMENTS.length];
    if (el === 'loop' || el === 'loop2' || el === 'bigloop') {
      const r = { loop: 118, loop2: 104, bigloop: 150 }[el];
      const off = r * 0.42;
      flat(30);
      const x0 = x;
      const y0 = y;
      const kr = K * r;
      const startSeg = segs.length;
      cubic([x0 + kr, y0], [x0 + r, y0 - r + kr], [x0 + r, y0 - r]);
      cubic([x0 + r, y0 - r - kr], [x0 + off / 2 + kr, y0 - 2 * r], [x0 + off / 2, y0 - 2 * r]);
      cubic([x0 + off / 2 - kr, y0 - 2 * r], [x0 - r + off, y0 - r - kr], [x0 - r + off, y0 - r]);
      cubic([x0 - r + off, y0 - r + kr], [x0 + off - kr, y0], [x0 + off, y0]);
      loops.push({ startSeg, endSeg: segs.length, cx: x0 + off / 2, cy: y0 - r, r, baseY: y0 });
      flat(60);
    } else if (el === 'camel') {
      hump(300, 170, 0.4);
      flat(20);
      hump(220, 300, 0.42);
    } else if (el === 'corkscrew') {
      sTo(150, 320, 0.42);
      flat(20);
      const startSeg = segs.length;
      hump(320, 236, 0.4);
      rolls.push({ startSeg, endSeg: segs.length, turns: 1 });
      flat(20);
      sTo(150, BASE, 0.42);
    } else if (el === 'hops') {
      hump(150, BASE - 74);
      hump(150, BASE - 74);
      hump(150, BASE - 74);
    } else if (el === 'corkscrew2' || el === 'zerog') {
      // zero-g roll: one slow roll over a tall crest; corkscrew2: two rolls
      const two = el === 'corkscrew2';
      sTo(150, two ? 300 : 280, 0.42);
      flat(20);
      const startSeg = segs.length;
      hump(two ? 420 : 340, two ? 230 : 190, 0.4);
      rolls.push({ startSeg, endSeg: segs.length, turns: two ? 2 : 1 });
      flat(20);
      sTo(150, BASE, 0.42);
    } else if (el === 'plunge' || el === 'plunge2') {
      // climb, then a steep plunge that skims the valley floor
      const deep = el === 'plunge' ? 548 : 540;
      sTo(150, el === 'plunge' ? 190 : 230, 0.42);
      flat(16);
      sTo(190, deep, 0.28);
      flat(40);
      sTo(230, BASE, 0.4);
    } else if (el === 'spike') {
      // top hat: tall, narrow crest
      flat(20);
      hump(220, 88, 0.3);
      flat(30);
    } else if (el === 'camel2') {
      hump(340, 150, 0.4);
      flat(16);
      hump(260, 260, 0.42);
      flat(16);
      hump(200, 330, 0.42);
    } else if (el === 'bunny') {
      for (let k = 0; k < 4; k += 1) hump(130, BASE - 56 - (k % 2) * 14);
    } else if (el === 'wave') {
      hump(220, 300, 0.42);
      hump(190, 340, 0.42);
      hump(160, 370, 0.42);
    } else if (el === 'dive') {
      sTo(170, 214, 0.42);
      flat(20);
      sTo(240, 530, 0.34);
      flat(20);
      sTo(200, BASE, 0.4);
    }
  }

  // ── brake run + arrival station ──
  flat(260);
  marks.brakeStart = segs.length;
  flat(180);
  marks.endLenSeg = segs.length;
  marks.stationEnd = { x, y };
  flat(260);
  const trackEndX = x;

  // ── sample into a LUT ──
  const xs = [];
  const ys = [];
  const ls = [];
  const segStartLen = [];
  let total = 0;
  segs.forEach((s, si) => {
    segStartLen[si] = total;
    const steps = s.type === 'L' ? Math.max(2, Math.ceil(Math.hypot(s.pts[1][0] - s.pts[0][0], s.pts[1][1] - s.pts[0][1]) / 8)) : 48;
    for (let k = si === 0 ? 0 : 1; k <= steps; k += 1) {
      const t = k / steps;
      const p = s.type === 'L'
        ? [s.pts[0][0] + (s.pts[1][0] - s.pts[0][0]) * t, s.pts[0][1] + (s.pts[1][1] - s.pts[0][1]) * t]
        : cubicPt(s.pts[0], s.pts[1], s.pts[2], s.pts[3], t);
      if (xs.length) total += Math.hypot(p[0] - xs[xs.length - 1], p[1] - ys[ys.length - 1]);
      xs.push(p[0]); ys.push(p[1]); ls.push(total);
    }
  });
  segStartLen[segs.length] = total;

  const pointAt = (len) => {
    const L = Math.max(0, Math.min(total, len));
    let lo = 0;
    let hi = ls.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ls[mid] <= L) lo = mid; else hi = mid;
    }
    const span = ls[hi] - ls[lo] || 1;
    const f = (L - ls[lo]) / span;
    return [xs[lo] + (xs[hi] - xs[lo]) * f, ys[lo] + (ys[hi] - ys[lo]) * f];
  };
  const angleAt = (len) => {
    const a = pointAt(len + 3);
    const b = pointAt(len - 3);
    return Math.atan2(a[1] - b[1], a[0] - b[0]);
  };

  const loopRanges = loops.map((lp) => ({ ...lp, from: segStartLen[lp.startSeg], to: segStartLen[lp.endSeg] }));
  const rollRanges = rolls.map((r) => ({ ...r, from: segStartLen[r.startSeg], to: segStartLen[r.endSeg] }));
  const rollAt = (len) => {
    for (const r of rollRanges) {
      if (len >= r.from && len <= r.to) {
        return Math.cos(((len - r.from) / (r.to - r.from)) * Math.PI * 2 * r.turns);
      }
    }
    return 1;
  };
  const inLoopUpper = (len, py) => loopRanges.some((lp) => len > lp.from && len < lp.to && py < lp.baseY - 12);

  const gateLens = gates.map((g) => segStartLen[g.segIndex]);
  const startLen = segStartLen[marks.startLenSeg] - 70;
  const endLen = segStartLen[marks.endLenSeg] - 40;

  // ── rails, spine and ties as polylines ──
  const RAIL = 4.2;
  const left = [];
  const right = [];
  const spine = [];
  const ties = [];
  const STEP = 6;
  for (let L = 0; L <= total; L += STEP) {
    const [px, py] = pointAt(L);
    const a = angleAt(L);
    const nx = Math.sin(a);
    const ny = -Math.cos(a); // left-hand normal (points "up" on flat track)
    const roll = rollAt(L);
    left.push(`${(px + nx * RAIL * roll).toFixed(1)},${(py + ny * RAIL * roll).toFixed(1)}`);
    right.push(`${(px - nx * RAIL * roll).toFixed(1)},${(py - ny * RAIL * roll).toFixed(1)}`);
    spine.push(`${(px - nx * 9 * roll).toFixed(1)},${(py - ny * 9 * roll).toFixed(1)}`);
    if (Math.round(L / STEP) % 3 === 0) {
      ties.push(`M${(px + nx * RAIL * roll).toFixed(1)} ${(py + ny * RAIL * roll).toFixed(1)}L${(px - nx * 9 * roll).toFixed(1)} ${(py - ny * 9 * roll).toFixed(1)}`);
    }
  }

  // ── lift-hill chain (animated dashes) ──
  const liftFrom = segStartLen[marks.liftStart];
  const liftTo = segStartLen[marks.liftEnd];
  const chain = [];
  for (let L = liftFrom; L <= liftTo; L += 6) {
    const [px, py] = pointAt(L);
    chain.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }

  // ── supports + lattice bracing ──
  const supports = [];
  const braces = [];
  const footings = [];
  const supportPts = []; // raw { x, top, len } for the 3D view
  let prev = null;
  const braceMin = layout.wooden ? 10 : 20;
  for (let L = 20; L < total - 10; L += layout.step) {
    const [px, py] = pointAt(L);
    if (inLoopUpper(L, py) || GROUND - py < 26) { prev = null; continue; }
    const top = py + 10;
    supports.push(`M${px.toFixed(1)} ${top.toFixed(1)}V${GROUND}`);
    supportPts.push({ x: px, top, len: L });
    footings.push(`M${(px - 6).toFixed(1)} ${GROUND - 4}h12v6h-12z`);
    if (prev && px - prev[0] > braceMin && px - prev[0] < 70) {
      const lo = Math.max(top, prev[1]);
      if (GROUND - lo > 40) {
        braces.push(`M${prev[0].toFixed(1)} ${prev[1].toFixed(1)}L${px.toFixed(1)} ${GROUND - 4}`);
        braces.push(`M${prev[0].toFixed(1)} ${GROUND - 4}L${px.toFixed(1)} ${top.toFixed(1)}`);
      }
    }
    prev = [px, top];
  }
  // loops get a pair of legs under their base
  loopRanges.forEach((lp) => {
    supports.push(`M${(lp.cx - lp.r * 0.7).toFixed(1)} ${lp.baseY + 10}V${GROUND}`);
    supports.push(`M${(lp.cx + lp.r * 0.7).toFixed(1)} ${lp.baseY + 10}V${GROUND}`);
    supports.push(`M${lp.cx.toFixed(1)} ${(lp.cy + lp.r * 0.2).toFixed(1)}V${GROUND}`);
    supportPts.push({ x: lp.cx - lp.r * 0.7, top: lp.baseY + 10, len: lp.from - lp.r * 0.49 });
    supportPts.push({ x: lp.cx + lp.r * 0.7, top: lp.baseY + 10, len: lp.to + lp.r * 0.49 });
  });

  // ── lift-hill catwalk: handrail above the track with posts ──
  const rail = [];
  const posts = [];
  for (let L = liftFrom + 20; L <= liftTo + 60; L += 6) {
    const [px, py] = pointAt(L);
    const a = angleAt(L);
    const nx = Math.sin(a);
    const ny = -Math.cos(a);
    rail.push(`${(px + nx * 20).toFixed(1)},${(py + ny * 20).toFixed(1)}`);
    if (Math.round(L / 6) % 4 === 0) {
      posts.push(`M${(px + nx * 5).toFixed(1)} ${(py + ny * 5).toFixed(1)}L${(px + nx * 20).toFixed(1)} ${(py + ny * 20).toFixed(1)}`);
    }
  }

  // mini-map polyline (coarse)
  const mini = [];
  for (let L = 0; L <= total; L += total / 220) {
    const [px, py] = pointAt(L);
    mini.push([px, py]);
  }

  return {
    // open ground past the buffer stop so the camera can keep following
    width: trackEndX + 900,
    layout: layoutId in LAYOUTS ? layoutId : 'city',
    wooden: Boolean(layout.wooden),
    trackEnd: trackEndX,
    total,
    pointAt,
    angleAt,
    rollAt,
    gates: gates.map((g, i) => ({ x: g.x, y: g.y, len: gateLens[i] })),
    startLen,
    endLen,
    stations: { start: marks.stationStart, end: marks.stationEnd },
    rails: { left: left.join(' '), right: right.join(' '), spine: spine.join(' '), ties: ties.join('') },
    chain: chain.join(' '),
    supports: supports.join(''),
    footings: footings.join(''),
    catwalk: { rail: rail.join(' '), posts: posts.join('') },
    loopSpans: loopRanges.map((lp) => [lp.cx - lp.r - 20, lp.cx + lp.r + 20]),
    braces: braces.join(''),
    mini,
    // raw data for the first-person (3D) view
    supportPts,
    loopLens: loopRanges.map((lp) => [lp.from, lp.to]),
    rollSpans: rollRanges.map((r) => [r.from, r.to, r.turns]),
    liftLens: [liftFrom, liftTo],
  };
}

/* Scroll progress (0..1) → track length. Knots sit on the station and every
   gate; in between, an ease makes the train dwell at gates and rush through
   the ride elements, like real brakes and drops. */
export function makeProgressMap(track) {
  // the train's middle (not its nose) lines up under each gate arch
  const mid = ((CAR_COUNT - 1) * CAR_GAP) / 2;
  const knots = [track.startLen, ...track.gates.map((g) => g.len + mid), track.endLen];
  const n = knots.length - 1;
  const ease = (t) => 0.22 * t + 0.78 * (t - Math.sin(2 * Math.PI * t) / (2 * Math.PI));
  return (p) => {
    const c = Math.max(0, Math.min(1, p)) * n;
    const i = Math.min(n - 1, Math.floor(c));
    const t = c - i;
    return knots[i] + (knots[i + 1] - knots[i]) * ease(t);
  };
}
