import {
  box, cyl, cone, tri, dome, disc, ball, ring, glyph, line, pixels, shift,
} from './themeParts';

/* ─── Interest ride themes ───
   One spec per interest (gamer, football, cricket, tech, coder, hacker,
   music, artist, bookworm, foodie, fitness, traveler). The spec is pure data:
   interestScenery.jsx turns it into the side-view layers and the side car,
   worldInterest.js into the first-person world and the front-seat car.
   The track layout for each id lives in coasterTrack LAYOUTS.

   pal      world colours (sky, far / mid silhouettes, ground, structure)
   props    stand behind the coaster (side view) / beside it (3D)
   landmark big pieces for the mid skyline and the 3D horizon
   small    little things on the ground among the crowd
   flyers   cross the sky                (parts, see themeParts.js) */

/* ── shared props ── */
const trophy = (gold = '#f2c23a', dark = '#c9952a') => [
  box(0, 0, 44, 10, '#3a2e26', { d: 30 }),
  box(0, 10, 30, 12, '#5a4636', { d: 22 }),
  cyl(0, 22, 4, 16, dark),
  cyl(0, 38, 12, 34, gold, { r2: 22 }),
  ring(-24, 60, 9, 4, dark),
  ring(24, 60, 9, 4, dark),
  box(0, 72, 46, 4, dark, { d: 36 }),
  glyph(0, 50, '1', 14, '#7a5a1a', { wt: 900 }),
];
const tree = (trunk, leaf, leaf2) => [
  cyl(0, 0, 5, 46, trunk),
  ball(0, 64, 26, leaf),
  ball(-16, 52, 16, leaf2 || leaf),
  ball(15, 54, 17, leaf2 || leaf),
];
const lampPost = (pole, bulb) => [
  cyl(0, 0, 2.2, 96, pole),
  box(0, 92, 18, 4, pole),
  ball(-7, 88, 4.4, bulb),
  ball(7, 88, 4.4, bulb),
];
const flagPole = (pole, flag, h = 110) => [
  cyl(0, 0, 2, h, pole),
  tri(14, h - 30, 28, 22, flag, { rz: -90, d: 2 }),
  ball(0, h + 2, 3, pole),
];
const billboard = (frame, face, text, ink, w = 120) => [
  line(-w * 0.3, 0, -w * 0.3, 54, 4, frame),
  line(w * 0.3, 0, w * 0.3, 54, 4, frame),
  box(0, 50, w, 40, frame, { d: 8 }),
  box(0, 53, w - 8, 34, face, { d: 9 }),
  glyph(0, 70, text, 14, ink, { wt: 900 }),
];
const balloon = (c, c2) => [
  ball(0, 46, 24, c, { sy: 1.15 }),
  box(0, 40, 6, 30, c2, { d: 44 }),
  line(-10, 18, -6, 0, 1, '#5a4a3a'),
  line(10, 18, 6, 0, 1, '#5a4a3a'),
  box(0, -10, 14, 10, '#8a5a34', { d: 14 }),
];
const plane = (body, wing, win) => [
  box(0, 0, 70, 12, body, { rr: 6, d: 12 }),
  cone(40, 0, 6, 12, body, { rz: -90 }),
  tri(-4, 2, 30, 8, wing, { ax: -8, d: 60 }),
  tri(-30, 10, 14, 14, wing, { ax: -6, d: 2 }),
  ...[-20, -10, 0, 10, 20].map((x) => disc(x, 7, 1.8, win, { z: 7 })),
];
const paperPlane = (c, c2) => [
  tri(0, 0, 50, 12, c, { ax: 25, d: 20 }),
  tri(-4, 0, 34, 7, c2, { ax: 21, d: 2, z: 1 }),
];
const cloudPuff = (c) => [
  ball(-18, 10, 14, c), ball(0, 16, 18, c), ball(18, 10, 13, c), box(0, 0, 56, 14, c, { rr: 7 }),
];

/* a grid of small windows on a tower; every few one blinks */
function windows(x0, y0, cols, rows, gx, gy, w, h, colors, blinkEvery = 7) {
  const out = [];
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const k = j * cols + i;
      out.push(box(x0 + i * gx, y0 + j * gy, w, h, colors[k % colors.length], {
        d: 2, z: 1, ...(k % blinkEvery === 3 ? { a: 'blink', dl: (k % 5) * 0.4 } : {}),
      }));
    }
  }
  return out;
}

/* ═════════════ GAMER ═════════════ */
const G = { pink: '#ff4fd8', cyan: '#7cf0ff', gold: '#ffd23a', violet: '#7c5cff', green: '#5aff8a', red: '#ff3a5a', ink: '#140b2e', deep: '#1a1036', plum: '#2e1c5c' };
const gamer = {
  id: 'gamer',
  label: 'Gamer',
  note: 'Arcade city of pixels and power-ups',
  ride: 'LEVEL UP',
  carName: 'Pixel Racer',
  blurb: 'bunny hops, a boss-level spike and a zero-g roll',
  icon: 'Gamepad2',
  sky: G.ink,
  ink: G.cyan,
  pal: {
    sky: G.ink, far: '#22154a', mid: G.plum, ground: G.deep, ground2: '#26184e', line: G.pink,
    steel: '#3a2a6a', steel2: '#2a1d50', spine: '#4b2f8f', roof: '#2a1d50', deck: '#3a2a6a', board: G.deep, footing: '#3a2a6a',
  },
  sun: { c: '#ffd0f4', size: 70, top: 12, right: 12, pixel: true },
  stars: true,
  skyGlyphs: { list: ['+1', 'GG', '★', '♥', 'XP', 'LVL 9', '★', '♥'], colors: [G.pink, G.cyan, G.gold, G.green] },
  far: { kind: 'blocks', palette: ['#22154a', '#261850', '#1e1242'], lit: [G.pink, G.cyan, G.gold] },
  props: [
    [ // arcade cabinet
      box(0, 0, 46, 96, '#3b2a7a', { d: 40 }),
      box(0, 96, 50, 16, G.pink, { d: 42 }),
      glyph(0, 104, 'PLAY', 10, G.ink, { wt: 900 }),
      box(0, 50, 34, 30, '#0d0820', { d: 41 }),
      box(0, 54, 28, 22, '#1b3d7a', { d: 42 }),
      ...pixels(['.c.', 'ccc', 'c.c'], 4, { c: G.cyan }, 0, 58, { z: 22, a: 'blink' }),
      box(0, 38, 46, 8, '#24164a', { d: 46 }),
      line(-10, 46, -10, 56, 2, '#c7d0df', { z: 22 }),
      ball(-10, 57, 3.4, G.red, { z: 22 }),
      disc(6, 50, 2.6, G.gold, { z: 23 }),
      disc(14, 50, 2.6, G.cyan, { z: 23 }),
    ],
    [ // controller on a plinth
      box(0, 0, 40, 6, '#3a2a6a', { d: 30 }),
      cyl(0, 6, 7, 40, '#2a1d50'),
      ball(-30, 56, 17, G.violet),
      ball(30, 56, 17, G.violet),
      box(0, 52, 76, 30, G.violet, { rr: 13, d: 22 }),
      box(-22, 65, 16, 5, G.deep, { d: 2, z: 12 }),
      box(-22, 59.5, 5, 16, G.deep, { d: 2, z: 12 }),
      disc(22, 75, 3.4, G.red, { z: 12 }),
      disc(28, 68, 3.4, G.gold, { z: 12 }),
      disc(16, 68, 3.4, G.cyan, { z: 12 }),
      disc(22, 61, 3.4, G.green, { z: 12 }),
      disc(-7, 58, 4.6, G.deep, { z: 12 }),
      disc(7, 58, 4.6, G.deep, { z: 12 }),
    ],
    [ // pixel heart on a pole
      line(0, 0, 0, 46, 3, '#3a2a6a'),
      ...pixels(['.RR.RR.', 'RWRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'], 7, { R: G.red, W: '#ffd0da' }, 0, 44, { a: 'thump' }),
    ],
    [ // block stack
      ...[[-24, 0, G.pink, '#ff8ae6'], [0, 0, G.cyan, '#c4f8ff'], [24, 0, G.gold, '#ffe68a'], [-12, 24, G.violet, '#a48cff'], [12, 24, G.green, '#a8ffc4'], [0, 48, G.red, '#ff8a9c']]
        .flatMap(([x, y, c, c2]) => [box(x, y, 24, 24, c, { d: 24 }), box(x, y + 5, 14, 14, c2, { d: 25 })]),
      glyph(0, 60, '?', 14, G.ink, { wt: 900 }),
    ],
    [ // floating coin
      box(0, 0, 30, 8, '#3a2a6a', { d: 20 }),
      disc(0, 46, 18, G.gold, { a: 'flip', d: 5 }),
      disc(0, 46, 12, '#f2b01e', { a: 'flip', d: 6 }),
      glyph(0, 46, '$', 13, '#a8740a', { wt: 900, a: 'flip' }),
    ],
    billboard('#3a2a6a', G.deep, 'GAME ON', G.pink),
    [ // health bar
      line(-40, 0, -40, 40, 3, '#3a2a6a'),
      line(40, 0, 40, 40, 3, '#3a2a6a'),
      box(0, 38, 96, 22, '#0d0820', { d: 6 }),
      glyph(-38, 49, 'HP', 9, G.pink, { wt: 900 }),
      ...[0, 1, 2, 3, 4].map((k) => box(-18 + k * 13, 42, 11, 14, k < 4 ? G.green : '#24164a', { d: 7, ...(k === 3 ? { a: 'blink' } : {}) })),
    ],
  ],
  landmarks: [
    [ // pixel tower
      box(0, 0, 90, 230, G.plum, { d: 60 }),
      box(0, 230, 60, 30, '#3a2a6a', { d: 40 }),
      line(0, 260, 0, 300, 3, '#3a2a6a'),
      ball(0, 302, 4, G.red, { a: 'blink' }),
      ...windows(-33, 16, 6, 12, 13.2, 17.5, 8, 10, [G.pink, G.cyan, '#3a2a6a', G.gold, '#3a2a6a']),
    ],
    [ // sword in the stone
      box(0, 10, 12, 110, '#c7d0df', { d: 4 }),
      box(0, 118, 50, 9, G.gold, { d: 10 }),
      box(0, 127, 10, 28, '#6a3a2a', { d: 10 }),
      ball(0, 160, 7, G.gold),
      dome(0, 0, 44, '#4a3f6a', { z: 4 }),
      dome(0, 0, 30, '#5a4f7a', { z: 5 }),
    ],
    [ // giant controller statue
      ...shift([
        ball(-46, 40, 30, G.violet), ball(46, 40, 30, G.violet),
        box(0, 30, 118, 50, G.violet, { rr: 22, d: 40 }),
        box(-34, 52, 26, 8, G.deep, { d: 2, z: 22 }), box(-34, 43, 8, 26, G.deep, { d: 2, z: 22 }),
        disc(34, 66, 6, G.red, { z: 22 }), disc(45, 55, 6, G.gold, { z: 22 }), disc(23, 55, 6, G.cyan, { z: 22 }), disc(34, 44, 6, G.green, { z: 22 }),
      ], 0, 60),
      box(0, 0, 30, 70, '#2a1d50', { d: 30 }),
    ],
  ],
  small: [
    [disc(0, 14, 8, G.gold, { a: 'flip', d: 3 }), disc(0, 14, 5, '#f2b01e', { a: 'flip', d: 4 })],
    [box(0, 0, 16, 16, G.cyan, { d: 16 }), box(0, 4, 9, 9, '#c4f8ff', { d: 17 })],
    [glyph(0, 18, '+1', 14, G.green, { wt: 900, a: 'bob' })],
  ],
  flyers: [
    [ball(0, 0, 28, G.violet, { sy: 0.3 }), dome(0, 5, 13, G.cyan), disc(-15, -1, 2.4, G.gold, { a: 'blink', z: 2 }), disc(0, -3, 2.4, G.pink, { a: 'blink', dl: 0.3, z: 2 }), disc(15, -1, 2.4, G.green, { a: 'blink', dl: 0.6, z: 2 })],
  ],
  ground: { kind: 'checker' },
  crowd: { shirts: [G.pink, G.cyan, G.gold, G.violet], acc: 'headset' },
  fg: { kind: 'cable', colors: [G.pink, G.cyan, G.violet] },
  particles: { palette: [G.pink, G.cyan, G.gold, G.green], vel: [0, 8, 0], size: 2.4, count: 420 },
  fpp: { hemi: ['#6a4ab8', '#1a1036', 1.25], sun: ['#ffd0f4', 0.9], sunDir: [0.4, 0.42, -0.8], fog: [800, 7800] },
  car: {
    shell: G.violet, trim: G.cyan, seat: G.deep, lamp: G.cyan, badge: '▶ PLAY',
    deco: [box(-8, 15, 6, 2, G.deep, {}), box(-8, 13, 2, 6, G.deep, {}), disc(6, 16, 1.4, G.red), disc(10, 16, 1.4, G.gold), disc(8, 18, 1.4, G.green)],
  },
};

/* ═════════════ FOOTBALL ═════════════ */
const F = { grass: '#2f7d3a', grass2: '#3a8f45', white: '#f4f6f2', night: '#0b1a2e', red: '#d33a3a', blue: '#2a5ad3', gold: '#f2c23a', steel: '#3a4a62' };
const footballBall = (r = 18) => [
  ball(0, r, r, '#ffffff', { a: 'bob' }),
  disc(0, r, r * 0.3, '#1a1a1a', { a: 'bob', z: 1 }),
  disc(-r * 0.62, r + r * 0.28, r * 0.2, '#1a1a1a', { a: 'bob', z: 1 }),
  disc(r * 0.62, r + r * 0.28, r * 0.2, '#1a1a1a', { a: 'bob', z: 1 }),
  disc(-r * 0.4, r - r * 0.62, r * 0.2, '#1a1a1a', { a: 'bob', z: 1 }),
  disc(r * 0.4, r - r * 0.62, r * 0.2, '#1a1a1a', { a: 'bob', z: 1 }),
];
const goal = () => {
  const net = [];
  for (let x = -66; x <= 66; x += 12) net.push(line(x, 0, x, 74, 0.8, '#c9d3dc', { z: -14 }));
  for (let y = 8; y <= 72; y += 12) net.push(line(-68, y, 68, y, 0.8, '#c9d3dc', { z: -14 }));
  return [
    ...net,
    box(-70, 0, 6, 80, F.white, { d: 6 }),
    box(70, 0, 6, 80, F.white, { d: 6 }),
    box(0, 76, 146, 6, F.white, { d: 6 }),
  ];
};
const football = {
  id: 'football',
  label: 'Football',
  note: 'Floodlit stadium, match night',
  ride: 'GOLDEN GOAL',
  carName: 'Striker',
  blurb: 'a top-corner loop, step-over hops and an injury-time dive',
  icon: 'Trophy',
  sky: F.night,
  ink: '#ffffff',
  pal: {
    sky: F.night, far: '#13243c', mid: '#1a2e4a', ground: F.grass, ground2: F.grass2, line: F.white,
    steel: F.steel, steel2: '#2a3850', spine: '#24403a', roof: '#1a2e4a', deck: F.steel, board: '#10202e', footing: '#3a4a62',
  },
  sun: { c: '#e9e4d2', size: 60, top: 10, right: 14 },
  stars: true,
  far: { kind: 'stands', palette: ['#13243c', '#172a44'], crowd: [F.red, F.white, F.blue, F.gold, '#24406a'] },
  props: [
    goal(),
    [ // floodlight
      cyl(0, 0, 4, 170, '#5a6a82', { r2: 2.6 }),
      box(0, 166, 60, 34, '#3a4a62', { d: 10, rz: -8 }),
      ...[-18, -6, 6, 18].flatMap((x) => [disc(x, 176, 4, '#fffbe6', { z: 6, rz: -8 }), disc(x, 188, 4, '#fffbe6', { z: 6 })]),
    ],
    [ // scoreboard
      line(-36, 0, -36, 60, 5, '#3a4a62'),
      line(36, 0, 36, 60, 5, '#3a4a62'),
      box(0, 56, 110, 50, '#0e1622', { d: 10 }),
      glyph(-30, 94, 'HOME', 8, '#9fb0c8', { wt: 800 }),
      glyph(30, 94, 'AWAY', 8, '#9fb0c8', { wt: 800 }),
      glyph(-30, 74, '2', 24, F.gold, { wt: 900 }),
      glyph(0, 74, '-', 20, '#9fb0c8', { wt: 900 }),
      glyph(30, 74, '1', 24, F.gold, { wt: 900 }),
      glyph(0, 62, "90+3'", 8, '#ff7a7a', { wt: 800, a: 'blink' }),
    ],
    footballBall(20),
    trophy(),
    [ // corner flag
      line(0, 0, 0, 60, 2, '#f4f6f2'),
      tri(10, 42, 20, 16, F.red, { rz: -90, d: 1, a: 'sway' }),
    ],
    [ // dugout
      box(0, 0, 100, 44, '#1e2c40', { d: 30 }),
      box(0, 40, 110, 6, '#c9d3dc', { d: 34 }),
      ...[-34, -12, 10, 32].map((x) => box(x, 10, 16, 14, F.blue, { d: 12, z: 12 })),
    ],
  ],
  landmarks: [
    [ // floodlight tower
      cyl(0, 0, 8, 300, '#3a4a62', { r2: 4 }),
      box(0, 296, 110, 60, '#2a3850', { d: 14 }),
      ...[-36, -12, 12, 36].flatMap((x) => [disc(x, 314, 8, '#fffbe6', { z: 10 }), disc(x, 338, 8, '#fffbe6', { z: 10 })]),
    ],
    [ // stadium screen
      box(-80, 0, 10, 120, '#2a3850', { d: 10 }),
      box(80, 0, 10, 120, '#2a3850', { d: 10 }),
      box(0, 110, 200, 90, '#0e1622', { d: 14 }),
      glyph(0, 165, 'GOAL!', 34, F.gold, { wt: 900, a: 'blink' }),
      glyph(0, 128, 'HOME 2 - 1 AWAY', 12, '#ffffff', { wt: 800 }),
    ],
    trophy(),
  ],
  small: [
    footballBall(9),
    [cone(0, 0, 8, 16, '#ff7a2a'), box(0, 0, 18, 2, '#ff7a2a', { d: 18 })],
  ],
  flyers: [
    [ball(0, 0, 40, '#c9d3dc', { sy: 0.38 }), tri(-42, -2, 16, 20, F.red, { ax: -4, d: 2 }), box(0, -20, 20, 6, '#3a4a62', { d: 8 }), glyph(0, 1, 'FINAL', 11, F.red, { wt: 900, z: 16 })],
  ],
  ground: { kind: 'stripes' },
  crowd: { shirts: [F.red, F.white, F.blue, F.gold], acc: 'scarf' },
  fg: { kind: 'boards', colors: ['#0e1622', '#14233a'], ink: [F.gold, '#ffffff', '#7ad1ff', '#ff7a7a'], words: ['GOAL!', 'KICK OFF', 'FULL TIME', 'HAT-TRICK', 'OLE OLE'] },
  particles: { palette: [F.red, F.white, F.blue, F.gold], vel: [0, -6, 0], size: 2.6, count: 380 },
  fpp: { hemi: ['#5a7aa8', '#14301a', 1.35], sun: ['#fffbe6', 1.5], sunDir: [0.3, 0.6, -0.74], fog: [900, 8200] },
  car: {
    shell: '#1f8a3a', trim: '#ffffff', seat: '#0e3a1a', lamp: '#fffbe6', badge: '10',
    deco: [glyph(2, 16, '10', 9, '#ffffff', { wt: 900 }), box(-14, 12, 2, 10, '#ffffff'), box(-10, 12, 2, 10, '#ffffff')],
  },
};

/* ═════════════ CRICKET ═════════════ */
const K = { sky: '#bfe0f0', grass: '#5e9e48', grass2: '#6aac52', willow: '#e8c98f', wood: '#8f6a40', cream: '#f2efe2', red: '#b8202a', green: '#1f6a3a' };
const stumps = () => [
  box(0, 0, 50, 3, '#d9c08a', { d: 30 }),
  ...[-9, 0, 9].map((x) => cyl(x, 0, 2.2, 44, K.cream)),
  box(-4.5, 44, 9, 2, K.willow, { d: 3 }),
  box(4.5, 44, 9, 2, K.willow, { d: 3 }),
];
const cricketBall = (r = 12) => [ball(0, r, r, K.red), line(-r * 0.7, r + r * 0.7, r * 0.7, r - r * 0.7, 1.2, '#f2efe2', { z: 1 })];
const cricket = {
  id: 'cricket',
  label: 'Cricket',
  note: 'Sunny ground, pavilion and sixes',
  ride: 'SIXER',
  carName: 'Willow Express',
  blurb: 'a wooden coaster of camelbacks, a top-edge spike and a boundary dive',
  icon: 'Target',
  sky: K.sky,
  ink: K.green,
  light: true,
  pal: {
    sky: K.sky, far: '#9cc3a6', mid: '#84b48a', ground: K.grass, ground2: K.grass2, line: K.cream,
    steel: '#b98b56', steel2: K.wood, spine: '#7a5530', roof: K.wood, deck: '#b98b56', board: '#2a3a2a', footing: '#9a8f7e',
  },
  sun: { c: '#fff3c4', size: 80, top: 9, right: 12 },
  clouds: '#ffffff',
  far: { kind: 'ridge', amp: 70 },
  props: [
    stumps(),
    [ // giant bat leaning
      box(0, 0, 26, 104, K.willow, { rz: 10, d: 8, rr: 5 }),
      box(-10, 104, 8, 40, '#2a3a2a', { rz: 10, d: 7 }),
      box(0, 14, 18, 4, '#c9a46a', { rz: 10, d: 9 }),
    ],
    cricketBall(14),
    [ // sight screen
      line(-50, 0, -50, 30, 4, '#c9c2b0'),
      line(50, 0, 50, 30, 4, '#c9c2b0'),
      box(0, 26, 130, 72, '#fbfaf5', { d: 6 }),
    ],
    [ // scoreboard
      box(0, 0, 100, 96, K.green, { d: 20 }),
      tri(0, 96, 110, 20, K.wood, { d: 26 }),
      glyph(0, 80, 'RUNS', 9, '#cfe8d0', { wt: 800 }),
      glyph(0, 62, '186/4', 18, '#ffffff', { wt: 900 }),
      glyph(0, 40, 'OVERS 18.2', 9, '#cfe8d0', { wt: 800 }),
      glyph(0, 20, 'NEED 12', 9, '#ffd27a', { wt: 800, a: 'blink' }),
    ],
    [ // pitch roller
      disc(-18, 16, 16, '#5a6a5a', { d: 40 }),
      disc(-18, 16, 6, '#3a4a3a', { d: 41 }),
      line(-18, 16, 30, 46, 3, '#3a4a3a'),
      line(26, 46, 34, 46, 3, '#3a4a3a'),
    ],
    tree('#6a4a2a', '#3f7a3a', '#4f8a42'),
  ],
  landmarks: [
    [ // pavilion
      box(0, 0, 230, 90, K.cream, { d: 60 }),
      tri(0, 90, 250, 46, '#a8483a', { d: 70 }),
      box(0, 136, 30, 20, K.cream, { d: 30 }),
      tri(0, 156, 38, 16, '#a8483a', { d: 34 }),
      disc(0, 113, 12, '#ffffff', { z: 36 }),
      ring(0, 113, 12, 2, K.wood, { z: 37 }),
      ...[-90, -54, -18, 18, 54, 90].map((x) => box(x, 0, 6, 60, '#ffffff', { d: 6, z: 31 })),
      ...[-72, -36, 0, 36, 72].map((x) => box(x, 20, 20, 26, '#4a6a8a', { d: 2, z: 30 })),
      ...shift(flagPole('#8a8a8a', K.green, 60), 0, 172),
    ],
    tree('#6a4a2a', '#3f7a3a', '#4f8a42'),
    [ // big screen
      box(0, 0, 14, 110, '#5a6a5a', { d: 12 }),
      box(0, 100, 170, 80, '#1c2a22', { d: 12 }),
      glyph(0, 150, 'SIX!', 30, '#ffd27a', { wt: 900, a: 'blink' }),
      glyph(0, 116, '4  6  4  1  6  6', 11, '#ffffff', { wt: 800 }),
    ],
  ],
  small: [cricketBall(7), [cyl(0, 0, 1.6, 18, K.cream), cyl(6, 0, 1.6, 18, K.cream)]],
  flyers: [
    [ball(0, 0, 9, K.red), line(-12, 4, -34, 4, 1.5, '#ffffff', { op: 0.7 }), line(-12, -4, -28, -4, 1.5, '#ffffff', { op: 0.7 })],
    plane('#ffffff', '#3a6a9a', '#3a6a9a'),
  ],
  ground: { kind: 'stripes' },
  crowd: { shirts: ['#f4f1e6', K.green, '#2a5ad3', '#ffd23a'], acc: 'cap' },
  fg: { kind: 'rope', colors: ['#ffffff', '#2a3a2a'], words: ['FOUR', 'SIX', 'HOWZAT!', 'OUT!'], ink: ['#ffd27a', '#ffffff'] },
  fpp: { hemi: ['#e4f3ff', '#4d6b35', 1.45], sun: ['#fff0d2', 1.7], sunDir: [0.42, 0.38, -0.82], fog: [800, 9800] },
  car: {
    shell: K.willow, trim: K.wood, seat: '#6a4a2a', lamp: '#fff3c4', badge: 'SIX',
    deco: [box(0, 12, 30, 2, K.wood), glyph(4, 18, '6', 8, K.red, { wt: 900 })],
  },
};

/* ═════════════ TECH ═════════════ */
const T = { sky: '#dfe9f5', blue: '#2a6af0', navy: '#1c2433', teal: '#20c4a0', grey: '#9aa8bd', white: '#ffffff', amber: '#ffb000' };
const phone = (h = 92) => [
  box(0, 0, h * 0.5, h, T.navy, { rr: 7, d: 6 }),
  box(0, 6, h * 0.5 - 6, h - 14, T.blue, { d: 7 }),
  ...[0, 1, 2, 3].flatMap((j) => [0, 1, 2].map((i) => box(-12 + i * 12, h * 0.6 - j * 13, 8, 8, [T.white, T.teal, T.amber, '#ff6a8a'][(i + j) % 4], { d: 8, rr: 2 }))),
  box(0, h - 6, 12, 3, T.navy, { d: 8 }),
];
const tech = {
  id: 'tech',
  label: 'Tech',
  note: 'Gadget city of chips, drones and screens',
  ride: 'GIGAHERTZ',
  carName: 'Circuit Pod',
  blurb: 'a giant loop, twin corkscrews and a hard-reset dive',
  icon: 'Cpu',
  sky: T.sky,
  ink: T.blue,
  light: true,
  pal: {
    sky: T.sky, far: '#c3d3e8', mid: '#a9bfdc', ground: '#e3e9f1', ground2: '#d0d9e6', line: T.blue,
    steel: T.grey, steel2: '#7d8ba3', spine: '#5a6a85', roof: '#c9d3e2', deck: T.grey, board: T.navy, footing: '#8a96aa',
  },
  sun: { c: '#ffffff', size: 70, top: 10, right: 12 },
  clouds: '#f4f8fc',
  far: { kind: 'blocks', palette: ['#c3d3e8', '#b8cae2', '#cddaec'] },
  props: [
    phone(),
    [ // laptop
      box(0, 0, 90, 6, '#c9d3e2', { d: 60 }),
      box(-2, 6, 80, 54, '#c9d3e2', { rz: 6, d: 4, z: -10 }),
      box(-2, 10, 72, 46, T.navy, { rz: 6, d: 5, z: -9 }),
      ...[0, 1, 2, 3].map((k) => box(-10 + (k % 2) * 6, 40 - k * 8, 34 - k * 4, 3, [T.teal, T.blue, T.amber, T.white][k], { rz: 6, d: 6, z: -8 })),
    ],
    [ // chip
      line(0, 0, 0, 30, 4, T.grey),
      box(0, 30, 72, 72, '#24303f', { rr: 5, d: 10 }),
      box(0, 42, 48, 48, '#34445a', { d: 11 }),
      glyph(0, 66, 'CPU', 13, T.teal, { wt: 900 }),
      ...[0, 1, 2, 3, 4].flatMap((k) => [box(-41, 38 + k * 13, 10, 4, '#c9a24a', { d: 4 }), box(41, 38 + k * 13, 10, 4, '#c9a24a', { d: 4 })]),
    ],
    [ // robot arm
      cyl(0, 0, 18, 12, T.grey),
      disc(0, 18, 8, T.navy, { z: 8 }),
      line(0, 18, 22, 66, 10, T.amber),
      disc(22, 66, 7, T.navy, { z: 8 }),
      line(22, 66, 56, 74, 8, T.amber),
      disc(56, 74, 5, T.navy, { z: 8 }),
      line(56, 74, 66, 64, 3, T.navy),
      line(56, 74, 68, 80, 3, T.navy),
    ],
    [ // server tower
      box(0, 0, 44, 110, T.navy, { d: 40 }),
      ...[0, 1, 2, 3, 4, 5, 6].map((k) => box(0, 10 + k * 14, 36, 9, '#2a3448', { d: 41 })),
      ...[0, 1, 2, 3, 4, 5, 6].map((k) => disc(13, 14.5 + k * 14, 1.8, k % 3 ? T.teal : T.amber, { a: 'blink', dl: k * 0.35, z: 22 })),
    ],
    [ // smart watch
      box(0, 0, 14, 90, '#3a4a62', { d: 6 }),
      box(0, 30, 44, 50, T.navy, { rr: 10, d: 12 }),
      disc(0, 55, 16, T.blue, { z: 7 }),
      glyph(0, 55, '10:09', 8, T.white, { wt: 800 }),
    ],
    [ // VR headset sign
      line(0, 0, 0, 40, 4, T.grey),
      box(0, 40, 80, 34, T.white, { rr: 12, d: 30 }),
      box(-17, 46, 28, 20, T.navy, { rr: 6, d: 31 }),
      box(17, 46, 28, 20, T.navy, { rr: 6, d: 31 }),
      ring(0, 60, 44, 3, T.grey, { z: -2 }),
    ],
  ],
  landmarks: [
    [ // glass tower
      box(0, 0, 100, 260, '#a9c4e6', { d: 80 }),
      ...windows(-40, 10, 5, 14, 20, 17.6, 16, 2, ['#e8f0fa', '#8fb0d8']),
      box(0, 260, 60, 20, T.navy, { d: 50 }),
      line(0, 280, 0, 330, 3, T.navy),
      ball(0, 332, 4, '#ff5a6a', { a: 'blink' }),
    ],
    phone(220),
    [ // wind of fibre: a big satellite dish
      box(0, 0, 40, 60, T.grey, { d: 40 }),
      line(0, 60, 0, 110, 8, '#7d8ba3'),
      ball(0, 140, 60, T.white, { sy: 0.32, rz: 28 }),
      line(0, 140, 30, 180, 3, '#7d8ba3'),
      ball(30, 182, 5, T.blue),
    ],
  ],
  small: [[box(0, 0, 30, 4, T.grey, { d: 20 }), box(0, 4, 26, 16, T.navy, { d: 4, rz: 8 })]],
  flyers: [
    [box(0, 0, 26, 8, T.navy, { rr: 3, d: 26 }), line(-12, 6, -26, 10, 2, T.grey), line(12, 6, 26, 10, 2, T.grey), box(-26, 10, 22, 2, '#7d8ba3', { a: 'pulse', d: 22 }), box(26, 10, 22, 2, '#7d8ba3', { a: 'pulse', d: 22 }), disc(0, 3, 2, T.teal, { a: 'blink', z: 14 })],
  ],
  ground: { kind: 'circuit' },
  crowd: { shirts: [T.blue, T.navy, T.white, T.teal], acc: 'glasses' },
  fg: { kind: 'cable', colors: [T.navy, T.blue, T.amber] },
  particles: { palette: [T.blue, T.teal], vel: [0, 6, 0], size: 1.8, count: 300 },
  fpp: { hemi: ['#ffffff', '#9aa8bd', 1.5], sun: ['#ffffff', 1.4], sunDir: [0.4, 0.45, -0.8], fog: [900, 9600] },
  car: {
    shell: '#f4f7fb', trim: T.blue, seat: T.navy, lamp: T.teal, badge: 'GHz',
    deco: [line(-18, 12, -6, 12, 1, T.blue), line(-6, 12, -2, 17, 1, T.blue), disc(-2, 17, 1.3, T.teal), line(4, 11, 14, 11, 1, T.blue), disc(14, 11, 1.3, T.amber)],
  },
};

/* ═════════════ CODER ═════════════ */
const C = { bg: '#1b1d2b', panel: '#11131c', bar: '#2c3047', green: '#8be9a0', pink: '#ff79c6', blue: '#8aa2ff', orange: '#ffb86c', yellow: '#f1fa8c', purple: '#bd93f9', grey: '#6a7090' };
const codeLines = (x0, y0, n, maxW, gap = 9, z = 1) => Array.from({ length: n }, (_, k) => {
  const w = [0.7, 0.45, 0.85, 0.3, 0.6, 0.5, 0.75][k % 7] * maxW;
  const ind = [0, 8, 8, 16, 8, 0, 8][k % 7];
  return box(x0 + ind + w / 2, y0 - k * gap, w, 3.4, [C.pink, C.blue, C.green, C.orange, C.purple, C.yellow, C.grey][k % 7], { d: 2, z });
});
const terminal = (w = 120, h = 84) => [
  box(0, 0, w, h, C.panel, { rr: 5, d: 8 }),
  box(0, h - 14, w, 14, C.bar, { rr: 5, d: 9 }),
  disc(-w / 2 + 10, h - 7, 2.6, '#ff5f57', { z: 5 }),
  disc(-w / 2 + 19, h - 7, 2.6, '#febc2e', { z: 5 }),
  disc(-w / 2 + 28, h - 7, 2.6, '#28c840', { z: 5 }),
  ...codeLines(-w / 2 + 10, h - 24, Math.floor((h - 30) / 9), w - 30, 9, 5),
  box(-w / 2 + 14, 8, 6, 8, C.green, { a: 'blink', d: 2, z: 6 }),
];
const coder = {
  id: 'coder',
  label: 'Coder',
  note: 'Dark-mode editor world, code and coffee',
  ride: 'HELLO WORLD',
  carName: 'Commit Cart',
  blurb: 'nested loops, a zero-g refactor and a deploy-day dive',
  icon: 'CodeXml',
  sky: C.bg,
  ink: C.green,
  pal: {
    sky: C.bg, far: '#24273a', mid: '#2c3047', ground: '#171925', ground2: '#20233a', line: C.blue,
    steel: '#3a3f5c', steel2: C.bar, spine: '#3f4670', roof: '#24273a', deck: '#3a3f5c', board: C.panel, footing: '#3a3f5c',
  },
  stars: true,
  skyGlyphs: { list: ['{ }', '</>', '=>', '( )', ';', '//', '[ ]', '&&', 'fn', '#!', '!=', '++'], colors: [C.green, C.pink, C.blue, C.orange, C.yellow, C.purple] },
  far: { kind: 'blocks', palette: ['#22253a', '#262a42', '#1f2234'], lit: [C.blue, C.green, C.purple] },
  props: [
    terminal(),
    [line(0, 0, 0, 30, 4, '#3a3f5c'), glyph(0, 66, '{ }', 64, C.pink, { wt: 900 })],
    [line(0, 0, 0, 30, 4, '#3a3f5c'), glyph(0, 64, '</>', 52, C.green, { wt: 900 })],
    [ // coffee mug
      cyl(0, 0, 20, 40, C.blue),
      ring(24, 22, 9, 5, C.blue),
      box(0, 36, 34, 3, '#4a2c18', { d: 34 }),
      ball(-6, 52, 4, '#c9cfe0', { a: 'bob', op: 0.55 }),
      ball(4, 62, 5, '#c9cfe0', { a: 'bob', dl: 0.6, op: 0.45 }),
      glyph(0, 18, 'JS', 10, C.panel, { wt: 900 }),
    ],
    [ // rubber duck (debugging partner)
      ball(0, 18, 22, '#ffd23a', { sy: 0.78 }),
      ball(12, 40, 13, '#ffd23a'),
      box(26, 38, 10, 5, '#ff8a2a', { d: 8, rr: 2 }),
      disc(16, 44, 2, '#1b1d2b', { z: 10 }),
      ball(-6, 22, 12, '#f2c21a', { sy: 0.6, z: 8 }),
    ],
    [ // git branch sign
      line(0, 0, 0, 110, 4, C.grey),
      line(0, 40, 30, 70, 4, C.pink),
      line(30, 70, 30, 96, 4, C.pink),
      line(30, 96, 0, 110, 4, C.pink),
      ...[[0, 20, C.blue], [0, 56, C.blue], [0, 110, C.blue], [30, 76, C.pink], [30, 96, C.pink]].map(([x, y, c]) => disc(x, y, 6, c, { z: 3 })),
      glyph(48, 112, 'main', 9, C.blue, { wt: 800 }),
      glyph(54, 84, 'feat/', 9, C.pink, { wt: 800 }),
    ],
    [ // bug
      ball(0, 14, 16, '#ff5f57', { sy: 0.7, a: 'bob' }),
      ball(16, 18, 8, '#1b1d2b', { a: 'bob' }),
      line(18, 24, 24, 34, 1.5, '#1b1d2b'),
      line(14, 24, 14, 35, 1.5, '#1b1d2b'),
      ...[-10, 0, 10].map((x) => line(x, 6, x - 4, 0, 1.6, '#1b1d2b')),
      line(0, 7, 0, 22, 1.2, '#1b1d2b', { z: 2 }),
    ],
  ],
  landmarks: [
    [ // monitor
      box(0, 0, 70, 10, '#3a3f5c', { d: 40 }),
      box(0, 10, 16, 50, '#3a3f5c', { d: 14 }),
      ...shift(terminal(220, 150), 0, 58),
    ],
    [ // brace tower
      box(0, 0, 60, 190, C.bar, { d: 50 }),
      glyph(0, 160, '{', 40, C.pink, { wt: 900 }),
      glyph(0, 110, '...', 30, C.yellow, { wt: 900 }),
      glyph(0, 56, '}', 40, C.pink, { wt: 900 }),
    ],
    [ // deploy rocket on the pad
      box(0, 0, 70, 12, '#3a3f5c', { d: 50 }),
      cyl(0, 12, 20, 110, '#e8ecf8'),
      cone(0, 122, 20, 44, C.pink),
      tri(-24, 12, 18, 36, C.blue, { ax: 6, d: 4 }),
      tri(24, 12, 18, 36, C.blue, { ax: -6, d: 4 }),
      disc(0, 90, 8, C.blue, { z: 12 }),
      glyph(0, 50, 'v2.0', 10, C.panel, { wt: 900 }),
    ],
  ],
  small: [
    [glyph(0, 14, ';', 22, C.yellow, { wt: 900, a: 'bob' })],
    [cyl(0, 0, 8, 16, C.pink), ring(10, 8, 4, 3, C.pink)],
  ],
  flyers: [
    [cyl(0, 0, 8, 40, '#e8ecf8', { rz: -90 }), cone(0, -20, 8, 14, C.pink, { rz: -90 }), tri(30, -14, 14, 10, C.blue, { rz: -90, d: 2 }), cone(48, 0, 6, 16, C.orange, { rz: 90, a: 'blink' })],
    [glyph(0, 0, '{ }', 26, C.purple, { wt: 900 })],
  ],
  ground: { kind: 'grid' },
  crowd: { shirts: ['#3f4670', C.pink, C.green, C.orange], acc: 'headphones' },
  fg: { kind: 'keys', colors: [C.bar, '#3a3f5c'], ink: [C.green, C.pink, C.blue, '#e8ecf8'], words: ['{', '}', ';', 'Esc', 'Tab', '⌘', 'Ctrl', 'Z', 'S', ':wq', '↵', 'F5'] },
  particles: { palette: [C.green, C.pink, C.blue], vel: [0, 4, 0], size: 1.8, count: 260 },
  fpp: { hemi: ['#4a5288', '#11131c', 1.3], sun: ['#c8d4ff', 1.0], sunDir: [0.35, 0.5, -0.79], fog: [800, 7600] },
  car: {
    shell: C.bar, trim: C.green, seat: C.panel, lamp: C.green, badge: '{ }',
    deco: [box(-12, 15, 12, 2, C.pink), box(0, 15, 8, 2, C.blue), box(-10, 11, 18, 2, C.green)],
  },
};

/* ═════════════ HACKER ═════════════ */
const H = { bg: '#020805', green: '#38ff6a', dim: '#1f8a3e', dark: '#06140b', rack: '#0b1a10', amber: '#ffb000', red: '#ff3a3a' };
const hacker = {
  id: 'hacker',
  label: 'Hacker',
  note: 'Code rain over a server farm',
  ride: 'ROOT ACCESS',
  carName: 'Ghost Shell',
  blurb: 'a backdoor plunge, firewall corkscrews and a root-level spike',
  icon: 'Terminal',
  sky: H.bg,
  ink: H.green,
  pal: {
    sky: H.bg, far: '#06140b', mid: '#0a1f12', ground: '#030a06', ground2: '#071a0e', line: H.green,
    steel: '#143a22', steel2: '#0d2818', spine: '#0f4a26', roof: H.dark, deck: '#143a22', board: H.bg, footing: '#143a22',
  },
  rain: H.green,
  far: { kind: 'blocks', palette: ['#06140b', '#081a0e', '#051009'], lit: [H.green, H.dim] },
  props: [
    [ // server rack
      box(0, 0, 50, 130, H.rack, { d: 44 }),
      ...Array.from({ length: 9 }, (_, k) => box(0, 8 + k * 13.5, 42, 9, '#10261a', { d: 45 })),
      ...Array.from({ length: 9 }, (_, k) => disc(-14, 12.5 + k * 13.5, 1.8, k % 4 === 2 ? H.amber : H.green, { a: 'blink', dl: k * 0.27, z: 24 })),
      ...Array.from({ length: 9 }, (_, k) => disc(-8, 12.5 + k * 13.5, 1.8, H.green, { a: 'blink', dl: k * 0.41 + 0.2, z: 24 })),
    ],
    [ // padlock (open)
      ring(0, 66, 18, 7, '#8a9a90', { z: -2 }),
      box(-14, 46, 7, 22, '#8a9a90', { d: 7, z: -2 }),
      box(0, 10, 56, 48, H.green, { rr: 6, d: 20 }),
      disc(0, 38, 6, H.bg, { z: 11 }),
      box(0, 22, 4, 14, H.bg, { d: 2, z: 11 }),
      box(0, 0, 30, 10, '#143a22', { d: 20 }),
    ],
    [ // hooded figure at a laptop
      box(0, 0, 70, 30, '#0d2818', { d: 40 }),
      cyl(-12, 30, 18, 34, '#111814', { r2: 12 }),
      dome(-12, 62, 14, '#111814'),
      box(-12, 54, 12, 10, '#000000', { d: 2, z: 10 }),
      box(16, 30, 30, 4, '#2a3a30', { d: 24 }),
      box(22, 34, 4, 22, '#2a3a30', { rz: -12, d: 22 }),
      box(19, 36, 2, 18, H.green, { rz: -12, d: 1, z: -2, a: 'blink' }),
    ],
    [ // jolly roger
      ...flagPole('#5a6a60', '#0b0b0b', 110),
      glyph(14, 91, '☠', 14, '#e8f2ea', { z: 2 }),
    ],
    [ // firewall
      ...Array.from({ length: 4 }, (_, j) => Array.from({ length: 5 }, (__, i) => box(-48 + i * 24 + (j % 2) * 12, j * 13, 22, 11, j % 2 ? '#7a2a12' : '#8a3416', { d: 20 }))).flat(),
      glyph(0, 62, 'FIREWALL', 9, H.amber, { wt: 900 }),
      ...[-30, 0, 30].map((x, k) => cone(x, 52, 6, 14, '#ff6a2a', { a: 'thump', dl: k * 0.2, z: 3 })),
    ],
    [ // prompt sign
      line(-30, 0, -30, 40, 3, '#143a22'),
      line(30, 0, 30, 40, 3, '#143a22'),
      box(0, 36, 96, 36, '#000000', { d: 6 }),
      glyph(-8, 54, '>_ sudo', 13, H.green, { wt: 900 }),
      box(36, 46, 6, 10, H.green, { a: 'blink', d: 2, z: 5 }),
    ],
    [ // antenna mast
      line(0, 0, 0, 140, 3, '#3a5a46'),
      line(-20, 0, 0, 70, 2, '#3a5a46'),
      line(20, 0, 0, 70, 2, '#3a5a46'),
      ball(0, 120, 22, '#2a3a30', { sy: 0.3, rz: 24 }),
      disc(0, 142, 3, H.red, { a: 'blink', z: 2 }),
    ],
  ],
  landmarks: [
    [ // data tower
      box(0, 0, 90, 250, '#081a0e', { d: 70 }),
      ...windows(-34, 14, 5, 14, 17, 16.5, 10, 6, [H.green, '#0f3a1e', H.dim, '#0f3a1e']),
      line(0, 250, 0, 300, 3, '#143a22'),
      disc(0, 302, 4, H.red, { a: 'blink' }),
    ],
    [ // giant terminal
      box(0, 0, 40, 60, '#0d2818', { d: 40 }),
      box(0, 60, 220, 140, '#000000', { d: 16 }),
      box(0, 64, 210, 132, '#020a05', { d: 17 }),
      glyph(-50, 170, '$ ssh root', 13, H.green, { wt: 800 }),
      glyph(-34, 146, 'ACCESS GRANTED', 13, H.green, { wt: 900, a: 'blink' }),
      glyph(-58, 122, '01101 0110', 13, H.dim, { wt: 800 }),
      glyph(-62, 98, '> _', 13, H.green, { wt: 800 }),
    ],
  ],
  small: [
    [glyph(0, 12, '0', 18, H.green, { wt: 900, a: 'blink' })],
    [glyph(0, 12, '1', 18, H.dim, { wt: 900, a: 'blink', dl: 0.5 })],
  ],
  flyers: [
    [box(0, 0, 30, 6, '#111814', { d: 30 }), line(-14, 4, -28, 10, 2, '#2a3a30'), line(14, 4, 28, 10, 2, '#2a3a30'), box(-28, 10, 22, 2, '#2a3a30', { a: 'pulse' }), box(28, 10, 22, 2, '#2a3a30', { a: 'pulse' }), disc(0, 2, 2, H.green, { a: 'blink', z: 16 })],
  ],
  ground: { kind: 'grid' },
  crowd: { shirts: ['#0f2a18', '#151515', '#143a22', '#202020'], acc: 'hood' },
  fg: { kind: 'cable', colors: ['#0d2818', H.dim, '#143a22'] },
  particles: { palette: [H.green, H.dim], vel: [0, -46, 0], size: 2.2, count: 700 },
  glyphRain: true,
  fpp: { hemi: ['#1f6a3a', '#020805', 0.95], sun: ['#9affb8', 0.7], sunDir: [0.3, 0.6, -0.74], fog: [600, 6200] },
  car: {
    shell: '#0c0f0d', trim: H.green, seat: '#000000', lamp: H.green, badge: '>_',
    deco: [glyph(0, 16, '>_', 8, H.green, { wt: 900 }), box(-14, 12, 10, 1.6, H.dim)],
  },
};

/* ═════════════ MUSIC ═════════════ */
const M = { bg: '#180a24', pink: '#ff5ad1', cyan: '#5ad1ff', yellow: '#ffd23a', violet: '#9a5aff', black: '#0d0812', amp: '#1e1428', grey: '#4a4058' };
const speaker = (h = 110) => [
  box(0, 0, 62, h, M.amp, { d: 44, rr: 3 }),
  disc(0, h * 0.68, 20, M.grey, { a: 'thump', d: 6, z: 22 }),
  disc(0, h * 0.68, 8, M.black, { a: 'thump', d: 7, z: 23 }),
  disc(0, h * 0.26, 14, M.grey, { a: 'thump', dl: 0.2, d: 6, z: 22 }),
  disc(0, h * 0.26, 5, M.black, { a: 'thump', dl: 0.2, d: 7, z: 23 }),
];
const music = {
  id: 'music',
  label: 'Music',
  note: 'Festival stage, speakers and beats',
  ride: 'BASS DROP',
  carName: 'Amp Rider',
  blurb: 'a beat-drop loop, airtime on every bar and a corkscrew solo',
  icon: 'Music',
  sky: M.bg,
  ink: M.pink,
  pal: {
    sky: M.bg, far: '#26103a', mid: '#321650', ground: '#120818', ground2: '#1e0f2a', line: M.pink,
    steel: '#3a2450', steel2: '#2a1a3c', spine: '#5a2a7a', roof: '#26103a', deck: '#3a2450', board: M.black, footing: '#3a2450',
  },
  sun: { c: '#ffd0f4', size: 58, top: 11, right: 13 },
  stars: true,
  skyGlyphs: { list: ['♪', '♫', '♬', '♩', '♪', '♫'], colors: [M.pink, M.cyan, M.yellow, M.violet] },
  far: { kind: 'ridge', amp: 60 },
  props: [
    [...speaker(), ...shift(speaker(80), 0, 110)],
    [ // guitar
      ...[
        line(0, 40, 0, 150, 6, '#6a3a1a'),
        box(0, 148, 12, 22, '#2a1a10', { d: 4 }),
        ball(0, 28, 26, '#d33a3a', { sy: 0.9 }),
        ball(0, 62, 19, '#d33a3a', { sy: 0.9 }),
        disc(0, 50, 7, M.black, { z: 3 }),
        box(0, 18, 18, 4, M.black, { d: 3, z: 3 }),
        line(-2, 20, -2, 150, 0.6, '#e8e8e8', { z: 4 }),
        line(2, 20, 2, 150, 0.6, '#e8e8e8', { z: 4 }),
      ].map((p) => ({ ...p, rz: (p.rz || 0) - 18 })),
      box(0, 0, 30, 6, '#3a2450', { d: 30 }),
    ],
    [ // drum kit
      disc(0, 26, 26, '#e8e8f2', { d: 30 }),
      disc(0, 26, 22, M.pink, { d: 31 }),
      glyph(0, 26, 'BEAT', 9, '#ffffff', { wt: 900, z: 16 }),
      disc(-34, 52, 13, '#e8e8f2', { d: 20, z: -6 }),
      disc(30, 54, 12, '#e8e8f2', { d: 20, z: -6 }),
      line(-48, 0, -48, 82, 1.5, M.grey),
      box(-48, 82, 34, 2, M.yellow, { rz: 10, d: 34, a: 'sway' }),
      line(48, 0, 48, 76, 1.5, M.grey),
      box(48, 76, 30, 2, M.yellow, { rz: -8, d: 30, a: 'sway', dl: 0.3 }),
    ],
    [ // vinyl on a turntable
      box(0, 0, 100, 34, '#2a1a3c', { d: 80 }),
      disc(0, 70, 40, M.black, { a: 'spin', d: 3 }),
      ring(0, 70, 30, 1, '#2a2030', { a: 'spin', z: 2 }),
      ring(0, 70, 22, 1, '#2a2030', { a: 'spin', z: 2 }),
      disc(0, 70, 12, M.pink, { a: 'spin', z: 3, d: 4 }),
      glyph(0, 70, '33', 7, '#ffffff', { a: 'spin', wt: 900 }),
      line(40, 34, 30, 92, 3, M.grey, { z: 4 }),
    ],
    [ // equalizer
      box(0, 0, 112, 8, '#2a1a3c', { d: 30 }),
      ...[0, 1, 2, 3, 4, 5, 6].map((k) => box(-48 + k * 16, 8, 12, [70, 100, 56, 120, 84, 64, 96][k], [M.cyan, M.cyan, M.violet, M.pink, M.pink, M.yellow, M.yellow][k], { a: 'pulse', dl: k * 0.13, d: 12 })),
    ],
    [ // mic stand
      line(0, 0, 0, 96, 2.5, M.grey),
      line(-16, 0, 16, 0, 3, M.grey),
      line(0, 96, 18, 110, 2.5, M.grey),
      ball(22, 113, 7, '#c9c2d8'),
    ],
    [ // keyboard
      line(-40, 0, -30, 40, 3, M.grey), line(40, 0, 30, 40, 3, M.grey),
      box(0, 40, 110, 14, M.black, { d: 30 }),
      ...Array.from({ length: 12 }, (_, k) => box(-49 + k * 9, 44, 7.5, 8, '#f2f0f8', { d: 2, z: 16 })),
      ...[0, 1, 3, 4, 5, 7, 8, 10].map((k) => box(-45 + k * 9, 48, 4.5, 5, M.black, { d: 2, z: 17 })),
    ],
  ],
  landmarks: [
    [ // main stage
      line(-130, 0, -130, 210, 6, M.grey), line(130, 0, 130, 210, 6, M.grey),
      line(-134, 206, 134, 206, 6, M.grey),
      box(0, 0, 250, 30, '#2a1a3c', { d: 80 }),
      box(0, 60, 180, 110, M.black, { d: 10, z: -20 }),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => box(-70 + k * 20, 70, 12, [40, 70, 30, 84, 60, 44, 76, 50][k], [M.cyan, M.violet, M.pink, M.yellow][k % 4], { a: 'pulse', dl: k * 0.11, d: 4, z: -15 })),
      ...[-100, -60, -20, 20, 60, 100].map((x, k) => disc(x, 196, 7, [M.pink, M.cyan, M.yellow][k % 3], { z: 6, a: 'blink', dl: k * 0.2 })),
      ...shift(speaker(120), -160, 0),
      ...shift(speaker(120), 160, 0),
    ],
    [ // giant headphones
      ring(0, 120, 60, 12, '#2a1a3c'),
      box(-62, 50, 30, 60, M.pink, { rr: 12, d: 30 }),
      box(62, 50, 30, 60, M.pink, { rr: 12, d: 30 }),
      box(0, 0, 20, 50, '#2a1a3c', { d: 20 }),
      box(0, 0, 90, 8, '#2a1a3c', { d: 40 }),
    ],
    [...speaker(160), ...shift(speaker(110), 0, 160)],
  ],
  small: [[glyph(0, 14, '♪', 22, M.cyan, { a: 'bob' })], [glyph(0, 14, '♫', 22, M.pink, { a: 'bob', dl: 0.4 })]],
  flyers: [[glyph(0, 0, '♫', 34, M.yellow, { a: 'bob' })], [glyph(0, 0, '♪', 30, M.cyan, { a: 'bob' })]],
  ground: { kind: 'tiles' },
  crowd: { shirts: [M.pink, M.cyan, M.yellow, M.violet], acc: 'hands' },
  fg: { kind: 'barrier', colors: ['#4a4058', '#2a1a3c'] },
  particles: { palette: [M.pink, M.cyan, M.yellow, M.violet], vel: [0, -8, 0], size: 2.6, count: 460 },
  fpp: { hemi: ['#6a3a9a', '#120818', 1.25], sun: ['#ffd0f4', 0.9], sunDir: [0.35, 0.5, -0.79], fog: [800, 7400] },
  car: {
    shell: M.pink, trim: '#2a1a3c', seat: M.black, lamp: M.cyan, badge: '♪',
    deco: [disc(-6, 16, 5, '#2a1a3c'), disc(-6, 16, 2, M.cyan), box(6, 12, 2, 6, M.cyan), box(9, 12, 2, 9, M.yellow), box(12, 12, 2, 5, M.violet)],
  },
};

/* ═════════════ ARTIST ═════════════ */
const A = { sky: '#f5ecdd', red: '#e2553a', blue: '#3a8ae2', yellow: '#f2c23a', green: '#4ab870', purple: '#9a5ae2', wood: '#b98a5a', dark: '#3a2e26', white: '#fbf8f2' };
const artist = {
  id: 'artist',
  label: 'Artist',
  note: 'Paint studio of easels and splashes',
  ride: 'BRUSHSTROKE',
  carName: 'Paint Pot',
  blurb: 'swooping strokes, a loop of colour and splash-down hops',
  icon: 'Palette',
  sky: A.sky,
  ink: A.red,
  light: true,
  pal: {
    sky: A.sky, far: '#e9dac2', mid: '#dfcbab', ground: '#c9a67a', ground2: '#b8946a', line: '#8a6a48',
    steel: '#8a7a6a', steel2: '#6e5f52', spine: '#5a4a40', roof: '#6e5f52', deck: '#8a7a6a', board: A.dark, footing: '#8a7a6a',
  },
  sun: { c: '#ffd27a', size: 80, top: 10, right: 12 },
  clouds: ['#f7c8bd', '#c8dcf7', '#f7e7b0', '#cdeccd'],
  far: { kind: 'ridge', amp: 60 },
  props: [
    [ // easel with a painting
      line(-26, 0, -6, 120, 4, A.wood), line(26, 0, 6, 120, 4, A.wood), line(0, 0, 0, 110, 4, '#9a7048', { z: -4 }),
      box(0, 30, 60, 6, A.wood, { d: 20 }),
      box(0, 36, 72, 60, A.white, { d: 4, z: 2 }),
      box(0, 40, 64, 52, '#a8d4f0', { d: 5, z: 2 }),
      disc(16, 78, 7, A.yellow, { z: 4 }),
      dome(-12, 40, 22, A.green, { z: 4 }),
      dome(16, 40, 16, '#3a9a5a', { z: 4 }),
    ],
    [ // giant paintbrush
      box(0, 0, 10, 100, A.dark, { rz: -14, d: 10, rr: 4 }),
      box(-25, 98, 14, 16, '#c9cfd8', { rz: -14, d: 14 }),
      cone(-30, 114, 9, 28, A.blue, { rz: -14 }),
      ball(-8, 4, 14, A.blue, { sy: 0.35, z: 6 }),
    ],
    [ // palette on a stand
      line(0, 0, 0, 40, 4, A.wood),
      ball(0, 70, 44, '#d9b080', { sy: 0.62 }),
      disc(24, 66, 7, A.sky, { z: 2 }),
      ...[[-26, 72, A.red], [-10, 86, A.yellow], [8, 88, A.blue], [-24, 54, A.green], [-4, 54, A.purple], [22, 84, A.white]].map(([x, y, c]) => ball(x, y, 6, c, { sy: 0.8, z: 3 })),
    ],
    [ // pencil cup
      ...[[-10, A.red, -8], [-3, A.yellow, -2], [4, A.blue, 4], [11, A.green, 10]].flatMap(([x, c, rz]) => [
        box(x, 20, 6, 70, c, { rz, d: 6 }),
        cone(x - Math.sin((rz * Math.PI) / 180) * 35, 89, 3, 9, '#e8c98f', { rz }),
      ]),
      cyl(0, 0, 22, 42, A.dark, { z: 6 }),
    ],
    [ // paint tube
      box(0, 0, 40, 60, A.purple, { rr: 4, d: 26 }),
      box(0, 60, 22, 10, '#c9cfd8', { d: 18 }),
      box(0, 70, 14, 12, A.dark, { d: 14 }),
      box(0, 18, 30, 16, A.white, { d: 27 }),
      glyph(0, 26, 'OIL', 8, A.purple, { wt: 900 }),
      ball(26, 6, 10, A.purple, { sy: 0.4, z: 2 }),
    ],
    [ // paint bucket, overflowing
      cyl(0, 0, 26, 44, '#c9cfd8', { r2: 30 }),
      ball(0, 44, 30, A.red, { sy: 0.2, z: 1 }),
      box(-14, 22, 8, 22, A.red, { rr: 4, d: 2, z: 16 }),
      box(10, 28, 7, 16, A.red, { rr: 3.5, d: 2, z: 16 }),
      ring(0, 52, 26, 2, '#8a8f98', { z: -2 }),
    ],
    [ // sculpture bust
      box(0, 0, 50, 46, A.white, { d: 50 }),
      cyl(0, 46, 16, 24, '#e8e2d6', { r2: 30 }),
      cyl(0, 70, 7, 12, '#e8e2d6'),
      ball(0, 96, 18, '#e8e2d6', { sy: 1.15 }),
    ],
  ],
  landmarks: [
    [ // giant pencils
      ...[[-40, A.red, 210], [0, A.yellow, 260], [40, A.blue, 180]].flatMap(([x, c, h]) => [
        box(x, 0, 34, h, c, { d: 34 }),
        cone(x, h, 17, 34, '#e8c98f'),
        cone(x, h + 22, 6, 12, A.dark),
        box(x, 0, 34, 14, '#e8a0a0', { d: 35 }),
      ]),
    ],
    [ // big canvas frame
      box(0, 0, 30, 60, A.wood, { d: 30 }),
      box(0, 60, 220, 160, '#9a6a3a', { d: 12 }),
      box(0, 70, 200, 140, A.white, { d: 13 }),
      ...[[-50, 160, 30, A.red], [30, 120, 40, A.blue], [-20, 100, 22, A.yellow], [60, 180, 18, A.green]].map(([x, y, r, c]) => ball(x, y, r, c, { z: 8 })),
    ],
    tree('#7a5a3a', '#7ab870', '#5aa860'),
  ],
  small: [
    [ball(0, 2, 16, A.red, { sy: 0.18 })],
    [ball(0, 2, 12, A.blue, { sy: 0.18 })],
    [ball(0, 2, 14, A.yellow, { sy: 0.18 })],
  ],
  flyers: [paperPlane(A.white, '#e0d6c4'), paperPlane('#f7c8bd', '#e2a89a')],
  ground: { kind: 'planks' },
  crowd: { shirts: [A.red, A.blue, A.yellow, A.green], acc: 'beret' },
  fg: { kind: 'rail', colors: [A.wood, '#9a7048'] },
  particles: { palette: [A.red, A.blue, A.yellow, A.green, A.purple], vel: [0, 4, 0], size: 2.4, count: 260 },
  fpp: { hemi: ['#fff6e8', '#b8946a', 1.4], sun: ['#fff0d2', 1.5], sunDir: [0.42, 0.4, -0.8], fog: [900, 9000] },
  car: {
    shell: A.yellow, trim: A.red, seat: A.dark, lamp: '#fff3c4', badge: 'ART',
    deco: [box(-16, 9, 3, 10, A.red, { rr: 1.5 }), box(-8, 7, 3, 12, A.blue, { rr: 1.5 }), box(0, 9, 3, 10, A.green, { rr: 1.5 }), box(8, 6, 3, 13, A.purple, { rr: 1.5 })],
  },
};

/* ═════════════ BOOKWORM ═════════════ */
const B = { sky: '#2a2138', gold: '#ffd27a', cream: '#f2e8d4', wood: '#5a4636', red: '#8a3a3a', blue: '#3a5a8a', green: '#4f6a3a', mustard: '#c29a4a', plum: '#6a3a6a', teal: '#2f6a6a' };
const SPINES = [B.red, B.blue, B.green, B.mustard, B.plum, B.teal, '#a8583a'];
const bookStack = (n = 6, seed = 0) => {
  const out = [];
  let y = 0;
  for (let k = 0; k < n; k += 1) {
    const w = 56 + ((k * 37 + seed * 13) % 26);
    const h = 10 + ((k * 11 + seed) % 6);
    const dx = ((k * 19 + seed * 7) % 12) - 6;
    out.push(box(dx, y, w, h, SPINES[(k + seed) % SPINES.length], { d: 40, rr: 1.5 }));
    out.push(box(dx + w / 2 - 3, y + 2, 4, h - 4, B.cream, { d: 41 }));
    out.push(box(dx - w / 4, y + h / 2 - 1, 10, 2, B.gold, { d: 41 }));
    y += h;
  }
  return out;
};
const bookRow = (n = 8, h = 90) => Array.from({ length: n }, (_, k) => {
  const bh = h - ((k * 23) % 26);
  const x = -n * 6 + k * 12;
  return [box(x, 0, 11, bh, SPINES[k % SPINES.length], { d: 40, rr: 1 }), box(x, bh * 0.7, 11, 3, B.gold, { d: 41 }), box(x, bh * 0.25, 11, 2, B.gold, { d: 41 })];
}).flat();
const bookworm = {
  id: 'bookworm',
  label: 'Bookworm',
  note: 'Cosy library of towering books',
  ride: 'PLOT TWIST',
  carName: 'Page Turner',
  blurb: 'a cliffhanger loop, page-turn rolls and a twist ending',
  icon: 'BookOpen',
  sky: B.sky,
  ink: B.gold,
  pal: {
    sky: B.sky, far: '#352a46', mid: '#40324f', ground: '#3a2a24', ground2: '#4a362c', line: B.gold,
    steel: B.wood, steel2: '#46362a', spine: '#6a4a30', roof: '#46362a', deck: B.wood, board: '#1f1812', footing: B.wood,
  },
  sun: { c: '#f2e8d4', size: 62, top: 11, right: 12 },
  stars: true,
  skyGlyphs: { list: ['A', 'a', '?', '!', '“ ”', '…', '¶', '&', 'Ω'], colors: [B.cream, B.gold, '#c9b8e8'] },
  far: { kind: 'blocks', palette: SPINES.map((c) => c), shelves: true },
  props: [
    bookStack(7, 0),
    bookRow(8),
    [ // open book on a stand
      box(0, 0, 40, 30, B.wood, { d: 30 }),
      box(-24, 30, 46, 6, B.cream, { rz: 14, d: 34 }),
      box(24, 30, 46, 6, B.cream, { rz: -14, d: 34 }),
      box(0, 26, 6, 8, B.red, { d: 36 }),
      box(-24, 44, 30, 26, B.cream, { rz: 32, d: 2, z: -6, a: 'sway' }),
    ],
    [ // reading lamp
      box(0, 0, 36, 6, '#2a2018', { d: 36 }),
      line(0, 6, 10, 86, 3, '#c9a24a'),
      cone(14, 74, 22, 26, B.teal, { rz: 160 }),
      ball(16, 72, 6, '#fff1c4', { a: 'blink' }),
    ],
    [ // quill and ink
      cyl(0, 0, 16, 24, '#1f1812', { r2: 10 }),
      box(0, 24, 14, 6, '#3a2e26', { d: 14 }),
      tri(10, 26, 10, 80, B.cream, { rz: -16, d: 3, ax: 3 }),
      line(4, 24, 20, 90, 1, '#c9b8a0', { z: 2 }),
    ],
    [ // armchair
      box(0, 0, 70, 30, B.red, { rr: 6, d: 50 }),
      box(0, 30, 70, 46, '#7a3030', { rr: 10, d: 20, z: -14 }),
      box(-38, 20, 14, 30, B.red, { rr: 6, d: 54 }),
      box(38, 20, 14, 30, B.red, { rr: 6, d: 54 }),
      ...shift(bookStack(2, 3), 0, 30, 10).map((p) => ({ ...p, w: p.w * 0.5, h: p.h * 0.8 })),
    ],
    [ // big glasses on a post
      line(0, 0, 0, 50, 3, B.wood),
      ring(-20, 66, 16, 4, B.gold),
      ring(20, 66, 16, 4, B.gold),
      line(-4, 68, 4, 68, 3, B.gold),
    ],
  ],
  landmarks: [
    [ // bookshelf
      box(0, 0, 200, 240, '#4a362a', { d: 50 }),
      ...[0, 1, 2, 3].map((k) => box(0, 10 + k * 58, 186, 52, '#2a1e18', { d: 51 })),
      ...[0, 1, 2, 3].flatMap((k) => shift(bookRow(14, 48), 0, 10 + k * 58, 4)),
    ],
    [ // tower of books
      ...bookStack(14, 2).map((p) => ({ ...p, w: p.w * 1.6, h: p.h * 1.5, y: p.y * 1.5, x: p.x * 1.6 })),
      ...shift(lampPost('#c9a24a', '#fff1c4'), 0, 190),
    ],
  ],
  small: [[box(0, 0, 30, 8, B.blue, { d: 20 }), box(0, 8, 26, 7, B.mustard, { d: 18 })], [box(0, 0, 8, 22, B.red, { rz: 12, d: 16 })]],
  flyers: [paperPlane(B.cream, '#d8ccb4'), [box(-10, 0, 22, 3, B.cream, { rz: 18, d: 2, a: 'sway' }), box(10, 0, 22, 3, B.cream, { rz: -18, d: 2, a: 'sway' }), box(0, -2, 4, 4, B.red)]],
  ground: { kind: 'planks' },
  crowd: { shirts: [B.red, B.blue, B.green, B.mustard], acc: 'glasses' },
  fg: { kind: 'books' },
  particles: { palette: ['#fff1c4', '#f2e8d4'], vel: [0, 3, 0], size: 1.8, count: 260 },
  fpp: { hemi: ['#6a5a7a', '#2a1e18', 1.25], sun: ['#ffe2b0', 1.1], sunDir: [0.35, 0.5, -0.79], fog: [800, 7200] },
  car: {
    shell: B.red, trim: B.gold, seat: '#3a1e1e', lamp: '#fff1c4', badge: 'CH. 1',
    deco: [box(0, 9, 42, 3, B.cream), box(-10, 14, 2, 8, B.gold), box(10, 14, 2, 8, B.gold)],
  },
};

/* ═════════════ FOODIE ═════════════ */
const D = { sky: '#ffe4d1', red: '#e2553a', teal: '#3ab8a0', yellow: '#f2c23a', pink: '#ff8ab0', bun: '#e0a050', brown: '#7a3e1e', cream: '#fff6e6', green: '#5aa83a', choc: '#5a2e1a' };
const burger = () => [
  box(0, 0, 80, 14, D.bun, { rr: 6, d: 70 }),
  box(0, 14, 86, 14, D.brown, { rr: 6, d: 76 }),
  tri(-20, 22, 24, 12, D.yellow, { rz: 180, d: 78 }),
  tri(16, 22, 24, 12, D.yellow, { rz: 180, d: 78 }),
  box(0, 28, 88, 8, D.yellow, { d: 78 }),
  box(0, 36, 90, 7, D.green, { rr: 3, d: 80 }),
  box(0, 43, 80, 7, D.red, { d: 74 }),
  dome(0, 50, 42, D.bun),
  ...[[-20, 74], [-4, 84], [14, 78], [24, 64], [-30, 62]].map(([x, y]) => ball(x, y, 2.4, D.cream, { z: 30 })),
];
const foodie = {
  id: 'foodie',
  label: 'Foodie',
  note: 'Picnic land of giant snacks',
  ride: 'SNACK ATTACK',
  carName: 'Food Truck',
  blurb: 'sugar-rush hops, a loop-de-loop and a sundae top-hat spike',
  icon: 'Pizza',
  sky: D.sky,
  ink: D.red,
  light: true,
  pal: {
    sky: D.sky, far: '#f6c9b0', mid: '#eeb49a', ground: D.cream, ground2: D.red, line: '#c23a2a',
    steel: '#c99a7a', steel2: '#a87a5a', spine: '#8a5a3a', roof: D.red, deck: '#c99a7a', board: '#3a1e14', footing: '#c99a7a',
  },
  sun: { c: '#fff3c4', size: 84, top: 9, right: 11 },
  clouds: '#fffaf2',
  far: { kind: 'ridge', amp: 50 },
  props: [
    burger(),
    [ // pizza slice
      tri(0, 0, 70, 100, '#f2b84a', { rz: 180, d: 8 }),
      tri(0, 8, 58, 84, '#f2d04a', { rz: 180, d: 9 }),
      box(0, 94, 76, 12, '#c98a3a', { rr: 6, d: 12 }),
      ...[[-12, 78], [12, 74], [0, 52], [-4, 28]].map(([x, y]) => disc(x, y, 6, '#c2302a', { z: 5 })),
      ...[[6, 62], [-14, 60]].map(([x, y]) => disc(x, y, 2.4, D.green, { z: 6 })),
    ],
    [ // cupcake
      cyl(0, 0, 22, 34, D.pink, { r2: 30 }),
      ...[-16, -6, 6, 16].map((x) => line(x * 0.75, 2, x, 32, 1.2, '#ff6a98', { z: 32 })),
      dome(0, 34, 32, D.cream),
      dome(0, 50, 22, D.cream),
      dome(0, 62, 12, D.cream),
      ball(0, 78, 7, '#d3202a'),
      line(0, 84, 4, 96, 1.2, D.green),
    ],
    [ // ice cream cone
      cone(0, 0, 22, 70, '#e0a050', { rz: 180 }),
      ...[0, 1, 2].map((k) => line(-14 + k * 14, 66, 0 + k * 4, 6, 1, '#b87a3a', { z: 12 })),
      ball(0, 82, 22, D.pink),
      ball(-6, 106, 18, D.cream),
      ball(4, 124, 14, D.choc),
      ball(6, 140, 5, '#d3202a'),
    ],
    [ // donut
      disc(0, 40, 38, D.bun, { d: 22 }),
      disc(0, 40, 32, D.pink, { d: 23 }),
      disc(0, 40, 12, D.sky, { d: 24 }),
      ...[[-20, 52, 30], [14, 62, -20], [24, 34, 60], [-8, 18, 10], [-26, 30, -40], [6, 56, 80]].map(([x, y, rz], k) => box(x, y, 7, 2.4, [D.yellow, D.teal, D.cream, D.red][k % 4], { rz, d: 2, z: 13 })),
    ],
    [ // takeaway coffee
      cyl(0, 0, 18, 60, D.cream, { r2: 23 }),
      box(0, 18, 42, 22, '#a8683a', { d: 42 }),
      box(0, 60, 50, 8, D.choc, { rr: 3, d: 48 }),
      ball(-6, 80, 5, '#ffffff', { a: 'bob', op: 0.8 }),
      ball(5, 92, 6, '#ffffff', { a: 'bob', dl: 0.5, op: 0.7 }),
    ],
    [ // fries
      ...[-14, -8, -2, 4, 10, 16].map((x, k) => box(x, 30, 6, 40 + (k % 3) * 8, D.yellow, { rz: (k - 2.5) * 4, d: 6 })),
      cyl(0, 0, 18, 46, D.red, { r2: 26, z: 4 }),
      glyph(0, 22, 'YUM', 9, D.yellow, { wt: 900, z: 20 }),
    ],
  ],
  landmarks: [
    [ // layered cake
      cyl(0, 0, 100, 60, D.pink),
      cyl(0, 60, 74, 54, D.cream),
      cyl(0, 114, 48, 46, D.choc),
      ...[-30, -10, 10, 30].flatMap((x) => [cyl(x, 160, 3, 26, [D.teal, D.yellow, D.pink, D.red][(x + 30) / 20]), ball(x, 192, 4, '#ffb000', { a: 'blink', dl: (x + 30) / 60 })]),
      ...Array.from({ length: 9 }, (_, k) => ball(-88 + k * 22, 60, 8, D.cream, { z: 40 })),
    ],
    [ // giant ice cream
      cone(0, 0, 46, 120, '#e0a050', { rz: 180 }),
      ball(0, 150, 46, D.teal),
      ball(-10, 200, 38, D.pink),
      ball(6, 240, 28, D.cream),
      ball(8, 270, 9, '#d3202a'),
    ],
    burger(),
  ],
  small: [
    [ball(0, 6, 7, '#d3202a'), line(0, 12, 3, 20, 1, D.green)],
    [disc(0, 10, 10, D.bun, { d: 6 }), disc(0, 10, 8, D.choc, { d: 7 }), disc(0, 10, 3, D.cream, { d: 8 })],
  ],
  flyers: [balloon(D.pink, '#ff6a98'), balloon(D.teal, '#2a9a86')],
  ground: { kind: 'checker' },
  crowd: { shirts: [D.red, D.teal, D.yellow, '#8a5ae2'], acc: 'chef' },
  fg: { kind: 'candy', colors: [D.red, '#ffffff'] },
  particles: { palette: [D.red, D.teal, D.yellow, D.pink], vel: [0, -5, 0], size: 2.2, count: 300 },
  fpp: { hemi: ['#fff2e8', '#e2a888', 1.45], sun: ['#fff0d2', 1.6], sunDir: [0.42, 0.4, -0.8], fog: [900, 9400] },
  car: {
    shell: D.teal, trim: '#ffffff', seat: '#1e4a42', lamp: '#fff3c4', badge: 'YUM',
    deco: [...[-18, -10, -2, 6, 14].map((x, k) => box(x, 19, 8, 4, k % 2 ? '#ffffff' : D.red)), glyph(0, 12, 'YUM', 6, '#ffffff', { wt: 900 })],
  },
};

/* ═════════════ FITNESS ═════════════ */
const P = { sky: '#ffd9b3', orange: '#ff6a3a', track: '#c8553a', dark: '#1c2228', steel: '#6a7a8a', blue: '#3a8ae2', green: '#4ab870', gold: '#f2c23a', white: '#ffffff' };
const dumbbell = (w = 90, r = 22) => [
  box(0, r - 3, w, 6, '#9aa4b0', { d: 6 }),
  disc(-w / 2 + 8, r, r, P.dark, { d: 14 }), disc(-w / 2 + 20, r, r * 0.8, '#2e3640', { d: 12 }),
  disc(w / 2 - 8, r, r, P.dark, { d: 14 }), disc(w / 2 - 20, r, r * 0.8, '#2e3640', { d: 12 }),
];
const fitness = {
  id: 'fitness',
  label: 'Fitness',
  note: 'Sunrise gym and running track',
  ride: 'PERSONAL BEST',
  carName: 'Sprint Sled',
  blurb: 'a deadlift spike, sprint hops and a finish-line loop',
  icon: 'Dumbbell',
  sky: P.sky,
  ink: P.orange,
  light: true,
  pal: {
    sky: P.sky, far: '#f2b994', mid: '#e6a07e', ground: P.track, ground2: '#b84a32', line: P.white,
    steel: P.steel, steel2: '#50606e', spine: '#3a4652', roof: '#3a4652', deck: P.steel, board: P.dark, footing: P.steel,
  },
  sun: { c: '#ffb07a', size: 120, top: 18, right: 10 },
  clouds: '#fff2e4',
  far: { kind: 'ridge', amp: 80 },
  props: [
    [ // barbell on a rack
      line(-40, 0, -40, 70, 5, P.steel), line(40, 0, 40, 70, 5, P.steel),
      box(-40, 58, 14, 4, P.dark, { d: 14 }), box(40, 58, 14, 4, P.dark, { d: 14 }),
      ...shift(dumbbell(130, 26), 0, 36),
    ],
    [ // kettlebell
      ball(0, 26, 26, P.dark),
      ring(0, 58, 14, 6, P.dark, { z: -2 }),
      glyph(0, 24, '24', 12, P.orange, { wt: 900, z: 14 }),
    ],
    [ // podium
      box(-40, 0, 40, 46, '#c9cfd8', { d: 40 }),
      box(0, 0, 40, 66, P.gold, { d: 40 }),
      box(40, 0, 40, 32, '#d9a070', { d: 40 }),
      glyph(-40, 24, '2', 16, P.dark, { wt: 900, z: 22 }),
      glyph(0, 36, '1', 18, P.dark, { wt: 900, z: 22 }),
      glyph(40, 17, '3', 14, P.dark, { wt: 900, z: 22 }),
    ],
    [ // stopwatch
      line(0, 0, 0, 40, 4, P.steel),
      disc(0, 76, 34, P.white, { d: 10 }),
      ring(0, 76, 34, 5, P.orange, { z: 2 }),
      box(0, 110, 12, 8, P.orange, { d: 10 }),
      line(0, 76, 0, 100, 2.5, P.dark, { a: 'spin', z: 6 }),
      glyph(0, 62, '9.58', 9, P.dark, { wt: 900, z: 6 }),
    ],
    [ // treadmill
      box(0, 0, 100, 12, P.dark, { d: 50, rz: 4 }),
      box(0, 2, 90, 6, '#3a4652', { d: 52, rz: 4 }),
      line(40, 10, 34, 74, 4, P.steel),
      box(30, 72, 30, 12, P.dark, { d: 30 }),
      box(30, 75, 20, 6, P.green, { d: 31, a: 'blink' }),
    ],
    [ // hurdles
      line(-30, 0, -30, 40, 3, P.white), line(30, 0, 30, 40, 3, P.white),
      box(0, 34, 70, 10, P.white, { d: 4 }), box(-12, 34, 12, 10, P.dark, { d: 5 }), box(12, 34, 12, 10, P.dark, { d: 5 }),
    ],
    [ // water bottle
      cyl(0, 0, 14, 60, P.blue, { rr: 4 }),
      cyl(0, 60, 8, 12, P.white),
      box(0, 18, 28, 18, P.white, { d: 28 }),
      glyph(0, 27, 'H2O', 7, P.blue, { wt: 900, z: 15 }),
    ],
  ],
  landmarks: [
    [ // medal
      tri(-24, 140, 30, 90, P.blue, { rz: 200, d: 4 }),
      tri(24, 140, 30, 90, P.orange, { rz: 160, d: 4 }),
      disc(0, 90, 50, P.gold, { d: 10, z: 4 }),
      disc(0, 90, 38, '#e0aa2a', { d: 11, z: 4 }),
      glyph(0, 90, 'PB', 26, '#8a5a0a', { wt: 900, z: 4 }),
      box(0, 0, 20, 40, P.steel, { d: 20 }),
    ],
    [ // stadium clock
      box(-70, 0, 12, 150, P.steel, { d: 12 }),
      box(70, 0, 12, 150, P.steel, { d: 12 }),
      box(0, 140, 190, 80, P.dark, { d: 14 }),
      glyph(0, 190, 'FINISH', 14, P.white, { wt: 900 }),
      glyph(0, 160, '00:42.17', 22, P.orange, { wt: 900, a: 'blink' }),
    ],
    [...dumbbell(220, 50), box(0, 0, 40, 30, P.steel, { d: 40 })].map((p) => (p.s === 'box' && p.w === 40 ? p : { ...p, y: p.y + 30 })),
  ],
  small: [[cone(0, 0, 8, 18, P.orange), box(0, 0, 18, 2, P.orange, { d: 18 })], [ball(0, 12, 12, '#c9a0e0')]],
  flyers: [[ball(0, 0, 36, P.white, { sy: 0.38 }), tri(-38, -2, 16, 18, P.orange, { ax: -4, d: 2 }), glyph(0, 1, 'GO!', 12, P.orange, { wt: 900, z: 16 })]],
  ground: { kind: 'lanes' },
  crowd: { shirts: [P.orange, P.blue, P.dark, P.green], acc: 'band' },
  fg: { kind: 'rail', colors: [P.white, P.steel] },
  fpp: { hemi: ['#fff0e0', '#c8553a', 1.45], sun: ['#ffd2a8', 1.6], sunDir: [0.5, 0.22, -0.84], fog: [900, 9400] },
  car: {
    shell: P.orange, trim: P.dark, seat: P.dark, lamp: '#fff3c4', badge: 'GO',
    deco: [disc(0, 16, 5.5, P.white), glyph(0, 16, '1', 7, P.dark, { wt: 900 }), box(-14, 11, 12, 2, P.white), box(14, 11, 12, 2, P.white)],
  },
};

/* ═════════════ TRAVELER ═════════════ */
const V = { sky: '#9fd6f0', sea: '#3aa0c8', sand: '#f1dcae', palm: '#3a9a4a', trunk: '#8a6a3a', red: '#e2553a', yellow: '#f2c23a', teal: '#3ab8a0', white: '#ffffff', navy: '#16354a' };
const palm = (h = 110, lean = 8) => {
  const top = [Math.sin((lean * Math.PI) / 180) * h * 0.9, h];
  return [
    ...[0, 1, 2, 3, 4].map((k) => box(Math.sin((lean * Math.PI) / 180) * h * (k / 5), (h / 5) * k, 12 - k, h / 5 + 2, k % 2 ? V.trunk : '#7a5a2a', { rz: -lean, d: 12 - k })),
    ...[-150, -110, -60, -20, 20].map((a, k) => tri(top[0], top[1], 16, 56, k % 2 ? V.palm : '#2f8a3e', { rz: a + 90, d: 3, a: 'sway', dl: k * 0.15 })),
    ball(top[0] - 4, top[1] - 4, 5, '#6a4a2a'),
    ball(top[0] + 4, top[1] - 6, 5, '#6a4a2a'),
  ];
};
const traveler = {
  id: 'travel',
  label: 'Traveler',
  note: 'Beaches, palms and landmarks',
  ride: 'WANDERLUST',
  carName: 'Jet Setter',
  blurb: 'a giant loop over the bay, wave hops and a cliff dive',
  icon: 'Plane',
  sky: V.sky,
  ink: '#0a6aa0',
  light: true,
  pal: {
    sky: V.sky, far: '#7fb8d6', mid: V.sea, ground: V.sand, ground2: '#e6cc98', line: V.white,
    steel: '#e9eef2', steel2: '#c8d0d8', spine: '#8a9aa8', roof: V.red, deck: '#c8d0d8', board: V.navy, footing: '#b8c0c8',
  },
  sun: { c: '#fff6c4', size: 86, top: 10, right: 12 },
  clouds: '#ffffff',
  far: { kind: 'sea', amp: 60 },
  props: [
    palm(),
    [ // beach umbrella
      line(0, 0, 4, 90, 3, '#c9b48a'),
      dome(4, 82, 46, V.red),
      tri(4, 82, 34, 46, V.white, { d: 50, z: 1 }),
      ball(4, 129, 3, V.white, { z: 2 }),
      box(40, 0, 50, 6, V.teal, { d: 30 }),
    ],
    [ // suitcase
      box(0, 0, 60, 76, V.teal, { rr: 6, d: 30 }),
      box(0, 76, 24, 12, V.navy, { rr: 4, d: 6 }),
      ...[-18, 0, 18].map((x) => box(x, 4, 3, 68, '#2a9a86', { d: 31 })),
      box(-12, 44, 22, 14, V.yellow, { rz: 12, d: 32, rr: 3 }),
      glyph(-12, 51, 'DXB', 6, V.navy, { wt: 900, rz: 12, z: 18 }),
      box(14, 22, 20, 14, V.red, { rz: -8, d: 32, rr: 3 }),
      glyph(14, 29, 'NYC', 6, V.white, { wt: 900, rz: -8, z: 18 }),
      disc(-20, -4, 5, V.navy, { d: 6, z: 10 }),
      disc(20, -4, 5, V.navy, { d: 6, z: 10 }),
    ],
    [ // sandcastle
      box(0, 0, 90, 34, '#e0c088', { d: 60 }),
      box(-30, 34, 22, 30, '#e0c088', { d: 22 }),
      box(30, 34, 22, 30, '#e0c088', { d: 22 }),
      box(0, 34, 30, 44, '#d9b47a', { d: 26 }),
      cone(-30, 64, 13, 16, '#d9b47a'), cone(30, 64, 13, 16, '#d9b47a'), cone(0, 78, 17, 20, '#e0c088'),
      line(0, 98, 0, 118, 1.5, '#8a6a3a'), tri(7, 108, 14, 10, V.red, { rz: -90, d: 1, a: 'sway' }),
      box(0, 0, 14, 20, '#b8945a', { rr: 7, d: 62 }),
    ],
    [ // signpost
      line(0, 0, 0, 110, 5, V.trunk),
      ...[['PARIS', 96, 1, V.red], ['TOKYO', 78, -1, V.white], ['DHAKA', 60, 1, V.yellow], ['RIO', 42, -1, V.teal]].flatMap(([t, y, dir, c]) => [
        box(dir * 22, y - 6, 48, 13, c, { d: 4, rz: dir * 3 }),
        glyph(dir * 22, y + 0.5, t, 7, V.navy, { wt: 900, rz: dir * 3 }),
      ]),
    ],
    [ // lighthouse
      cyl(0, 0, 26, 150, V.white, { r2: 16 }),
      ...[20, 70, 120].map((y) => cyl(0, y, 25 - (y / 150) * 9, 22, V.red, { r2: 24 - (y / 150) * 10 })),
      box(0, 150, 40, 8, V.navy, { d: 40 }),
      box(0, 158, 26, 20, '#fff3a0', { d: 26, a: 'blink' }),
      cone(0, 178, 20, 20, V.red),
    ],
    [ // beach ball + towel
      box(0, 0, 70, 3, V.yellow, { d: 40 }),
      ball(10, 20, 17, V.white, { a: 'bob' }),
      ball(10, 20, 17, V.red, { a: 'bob', sy: 0.35, z: 1 }),
      ball(10, 20, 6, V.teal, { a: 'bob', z: 2 }),
    ],
  ],
  landmarks: [
    [ // lattice tower
      tri(0, 0, 120, 320, '#9a8a7a', { d: 50 }),
      tri(0, 0, 70, 120, V.sky, { d: 51, z: 1 }),
      box(0, 110, 70, 8, '#7a6a5a', { d: 60, z: 2 }),
      box(0, 200, 44, 6, '#7a6a5a', { d: 40, z: 2 }),
      line(0, 320, 0, 350, 3, '#7a6a5a'),
    ],
    [ // pagoda
      ...[0, 1, 2, 3].flatMap((k) => [
        box(0, k * 56, 110 - k * 20, 40, '#e9dcc4', { d: 80 - k * 12 }),
        tri(0, k * 56 + 36, 150 - k * 24, 24, '#c2302a', { d: 100 - k * 14 }),
      ]),
      line(0, 236, 0, 280, 4, '#c2302a'),
    ],
    [ // domed hall
      box(0, 0, 200, 90, '#f2ead8', { d: 100 }),
      dome(0, 90, 64, '#e8d8b8'),
      cyl(0, 154, 4, 24, '#c9a24a'),
      ...[-84, 84].flatMap((x) => [cyl(x, 0, 10, 170, '#f2ead8'), cone(x, 170, 12, 28, '#e8d8b8')]),
      ...[-50, -16, 16, 50].map((x) => box(x, 20, 20, 44, '#c9b48a', { d: 2, z: 52, rr: 10 })),
    ],
    palm(180, 12),
  ],
  small: [[ball(0, 4, 6, '#ff9a7a', { sy: 0.6 })], [box(0, 0, 12, 5, '#f2ead8', { rr: 2.5, d: 8 })]],
  flyers: [plane(V.white, '#3a6a9a', '#3a6a9a'), balloon(V.red, V.yellow)],
  ground: { kind: 'sand' },
  crowd: { shirts: [V.red, V.yellow, V.teal, V.white], acc: 'cap' },
  fg: { kind: 'rope', colors: ['#c9b48a', V.trunk] },
  fpp: { hemi: ['#e8f6ff', '#d9c08a', 1.45], sun: ['#fff6e0', 1.7], sunDir: [0.42, 0.35, -0.83], fog: [900, 10400] },
  car: {
    shell: '#0a6aa0', trim: V.white, seat: V.navy, lamp: '#fff6c4', badge: 'FLY',
    deco: [...[-14, -6, 2, 10].map((x) => disc(x, 17, 1.8, V.white)), box(0, 11, 34, 1.6, V.yellow)],
  },
};

export const INTEREST_THEMES = [gamer, football, cricket, tech, coder, hacker, music, artist, bookworm, foodie, fitness, traveler];
export const INTEREST_BY_ID = Object.fromEntries(INTEREST_THEMES.map((t) => [t.id, t]));
export { cloudPuff };
