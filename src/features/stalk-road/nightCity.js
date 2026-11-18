import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry } from './coasterTrack';
import { ferrisWheel, starDome } from './fppKit';

/* ─── Night city for the first-person ride ───
   Downtown blocks on both sides of the coaster: rows of towers that get
   taller further back, lit window facades (canvas textures, one window per
   CELL units so every tower shares the same floor height), storefronts,
   neon signs, rooftop beacons and avenues with moving traffic lights.
   Everything is flat colour — the only "lighting" is lit windows and lamps;
   fog does the depth. Towers are merged per facade texture, so the whole
   skyline is a handful of draw calls. */

const CELL = 7; // world units per floor
const COLS = 20; // window columns per texture tile
const TILE = 32; // floors per texture tile
const COL_W = CELL * 1.6; // windows are wider than a floor is tall
const TILE_U = COLS * COL_W;
const TILE_V = TILE * CELL;

/* Facade styles. Lit windows come in runs along a floor in one family of
   tones per building (offices with the lights on), not per-window noise —
   that is what keeps the skyline calm instead of sparkly at a distance. */
const FACADES = [
  { // office grid, warm interiors
    seed: 11, style: 'grid', wall: '#0a101b', off: '#101827', slab: '#131b2a', mullion: '#0e1522',
    tones: ['#f2c77e', '#eecf9c', '#e6b86c'], lit: 0.46, win: 0.7,
  },
  { // glass curtain wall, cool office light
    seed: 23, style: 'band', wall: '#09111e', off: '#0f1a2b', slab: '#182234', mullion: '#0d1626',
    tones: ['#c9dbf7', '#b3c8ec', '#dfe8fb'], lit: 0.4, win: 0.62,
  },
  { // residential, sparse and warm
    seed: 37, style: 'grid', wall: '#0c111b', off: '#121925', slab: '#151c29', mullion: '#0e141f',
    tones: ['#f7b96f', '#f2d3a1', '#f9c985'], lit: 0.28, win: 0.5,
  },
  { // blue glass tower with vertical fins
    seed: 51, style: 'band', wall: '#0b1629', off: '#0f1e36', slab: '#152645', mullion: '#1b2c4c',
    tones: ['#a9d2ff', '#d5e9ff'], lit: 0.24, win: 0.56, fins: true,
  },
];
const WARM = ['#ffd27a', '#ffe2a6', '#ffc56a', '#fff0cc'];
const COOL = ['#a9c8ff', '#d6e4ff', '#8fb4ff', '#e8f0ff'];
const NEON = ['#ff7aa8', '#7cd4ff', '#ffd166', '#b69cff', '#7dffc4'];
const NEON_WORDS = ['ORBIT', 'AUSTWISE', 'HOTEL', 'CINEMA', '24/7', 'ARCADE', 'NIGHT MARKET', 'RAMEN', 'JAZZ BAR', 'METRO', 'CAFE', 'SKY LOUNGE'];
const VERTICAL_WORDS = ['OPEN', 'BAR', 'NEON', 'CITY', 'LIVE'];

function facadeTexture(f, size, anisotropy) {
  const r = mulberry(f.seed);
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');
  const cw = size / COLS;
  const rh = size / TILE;
  const tone = new THREE.Color();
  ctx.fillStyle = f.wall;
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < TILE; y += 1) {
    const floorOn = r() > 0.12; // some floors are dark end to end
    let c = 0;
    while (c < COLS) {
      const run = 2 + Math.floor(r() * 7);
      const on = floorOn && r() < f.lit;
      // one tone per run, a touch of brightness variation
      tone.set(f.tones[Math.floor(r() * f.tones.length)]).offsetHSL(0, 0, (r() - 0.5) * 0.06);
      const lit = `#${tone.getHexString()}`;
      for (let k = c; k < Math.min(COLS, c + run); k += 1) {
        ctx.fillStyle = on ? lit : f.off;
        if (f.style === 'band') {
          ctx.fillRect(k * cw, y * rh + rh * 0.2, cw, rh * f.win);
        } else {
          const ww = cw * f.win;
          ctx.fillRect(k * cw + (cw - ww) / 2, y * rh + rh * 0.24, ww, rh * 0.54);
        }
      }
      c += run;
    }
    // floor slab line
    ctx.fillStyle = f.slab;
    ctx.fillRect(0, y * rh, size, Math.max(1, rh * 0.08));
  }
  // mullions / fins
  ctx.fillStyle = f.mullion;
  const step = f.fins ? 1 : 2;
  for (let k = 0; k <= COLS; k += step) ctx.fillRect(k * cw - (f.fins ? 2 : 1), 0, f.fins ? 4 : 2, size);
  // keep the corner texel plain wall: roofs sample it
  ctx.fillStyle = f.wall;
  ctx.fillRect(0, size - 4, 4, 4);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = anisotropy;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

/* Box tower with world-scaled UVs (windows keep their size) and a little
   per-face tone so the blocks read as 3D under flat, unlit materials. */
const FACE_TONE = [0.72, 0.72, 0.6, 0.4, 1, 1];
function towerGeo(w, h, d, x, y0, z, ox, oy) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const col = new Float32Array(uv.count * 3);
  for (let f = 0; f < 6; f += 1) {
    for (let v = 0; v < 4; v += 1) {
      const i = f * 4 + v;
      if (f === 2 || f === 3) {
        uv.setXY(i, 0.0005, 0.0005); // roofs: plain wall colour
      } else {
        const fw = f < 2 ? d : w;
        uv.setXY(i, ox + (uv.getX(i) * fw) / TILE_U, oy + (y0 + uv.getY(i) * h) / TILE_V);
      }
      const t = FACE_TONE[f];
      col.set([t, t, t], i * 3);
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.translate(x, y0 + h / 2, z);
  return g;
}

function neonTexture(text, color, vertical = false) {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  if (vertical) {
    cv.width = 96;
    cv.height = 96 * text.length + 32;
  } else {
    cv.width = 512;
    cv.height = 144;
  }
  ctx.fillStyle = '#0a0d16';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.strokeRect(5, 5, cv.width - 10, cv.height - 10);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (vertical) {
    ctx.font = '800 70px system-ui, -apple-system, Segoe UI, sans-serif';
    [...text].forEach((ch, i) => ctx.fillText(ch, cv.width / 2, 16 + 96 * i + 48));
  } else {
    let size = 84;
    ctx.font = `800 ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
    while (ctx.measureText(text).width > cv.width - 60 && size > 30) {
      size -= 4;
      ctx.font = `800 ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
    }
    ctx.fillText(text, cv.width / 2, cv.height / 2 + 4);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function dashTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 8;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#121824';
  ctx.fillRect(0, 0, 64, 8);
  ctx.fillStyle = '#8a7c4e';
  ctx.fillRect(0, 3, 30, 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/**
 * @param scene     THREE.Scene to add into
 * @param width     track width (world units, along +X)
 * @param accent    THREE.Color of the rider's accent
 * @param plazas    [{ x, side }] gaps left open in the front rows (e.g. a wheel)
 * @param deck      { height, zMin, zMax } sky-deck the coaster rides on: a slab
 *                  carried by supertall towers, so the rider looks down on the city
 */
export function buildNightCity({
  scene, width: W, accent, plazas = [], deck = null, anisotropy = 8, hiRes = true,
}) {
  const rnd = mulberry(8080);
  const X0 = -900;
  const X1 = W + 1100;
  const m4 = new THREE.Matrix4();
  const flat = (color) => new THREE.MeshBasicMaterial({ color });
  // the rider's accent joins the neon palette
  const neon = [...NEON, `#${accent.getHexString()}`];

  // ── streets ──
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 + 9000, 9000), flat(0x090d15));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((X0 + X1) / 2, 0, 0);
  scene.add(ground);

  const Z0 = { '-1': 185, 1: 225 }; // first building row, clear of the deck
  const AVENUE_OFFS = [300, 680, 1100]; // gaps between row groups
  const avenues = [{ z: -160, side: -1 }, { z: 200, side: 1 }];
  [-1, 1].forEach((side) => {
    AVENUE_OFFS.forEach((off) => avenues.push({ z: side * (Z0[side] + off + 20), side }));
  });
  const dash = dashTexture();
  dash.repeat.set((X1 - X0) / 64, 1);
  avenues.forEach((av) => {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, 30), flat(0x111722));
    road.rotation.x = -Math.PI / 2;
    road.position.set((X0 + X1) / 2, 0.3, av.z);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, 1.2), new THREE.MeshBasicMaterial({ map: dash }));
    line.rotation.x = -Math.PI / 2;
    line.position.set((X0 + X1) / 2, 0.4, av.z);
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, 14), flat(0x171e2c));
    walk.rotation.x = -Math.PI / 2;
    walk.position.set((X0 + X1) / 2, 0.5, av.z + av.side * 22);
    scene.add(road, line, walk);
  });

  // ── blocks: shared per side, so cross streets line up through every row ──
  const blocksFor = () => {
    const out = [];
    let x = X0;
    while (x < X1) {
      const len = 260 + rnd() * 300;
      out.push([x, x + len]);
      x += len + 40;
    }
    return out;
  };
  // row groups between avenues; everything stays below the ~110-floor deck
  // except a few landmarks, so the ride looks out over the rooftops
  const ROWS = [
    { off: 0, dMin: 40, dMax: 70, hMin: 40, hMax: 300 },
    { off: 92, dMin: 50, dMax: 80, hMin: 70, hMax: 420 },
    { off: 196, dMin: 50, dMax: 90, hMin: 90, hMax: 480 },
    { off: 340, dMin: 50, dMax: 85, hMin: 80, hMax: 460 },
    { off: 440, dMin: 50, dMax: 95, hMin: 100, hMax: 560 },
    { off: 556, dMin: 50, dMax: 100, hMin: 120, hMax: 600 },
    { off: 720, dMin: 60, dMax: 95, hMin: 100, hMax: 560 },
    { off: 830, dMin: 60, dMax: 110, hMin: 120, hMax: 640 },
    { off: 960, dMin: 60, dMax: 110, hMin: 140, hMax: 680 },
    { off: 1140, dMin: 60, dMax: 110, hMin: 120, hMax: 640 },
    { off: 1260, dMin: 70, dMax: 130, hMin: 140, hMax: 720 },
  ];

  const byFacade = FACADES.map(() => []);
  const antennas = [];
  const crowns = [];
  const beaconsA = [];
  const beaconsB = [];
  const shopGeos = [];
  const signs = [];
  const crossStreets = [];

  const addTower = (x, z, w, d, h, rowIdx, front, side) => {
    const fi = Math.floor(rnd() * FACADES.length);
    const ox = Math.floor(rnd() * COLS) / COLS;
    const oy = Math.floor(rnd() * TILE) / TILE;
    // city blocks stay under the deck (the rider looks down on them); only the
    // distant ring (rowIdx 9) may hold a few supertall landmarks
    const maxTop = rowIdx === 9 ? Infinity : 680;
    const H = Math.max(CELL * 4, Math.round(Math.min(h, rowIdx === 9 ? h : 560) / CELL) * CELL);
    byFacade[fi].push(towerGeo(w, H, d, x, 0, z, ox, oy));
    const cap = (cw, cd, y) => {
      const g = new THREE.BoxGeometry(cw + 1.6, 2.4, cd + 1.6);
      g.translate(x, y + 1.2, z);
      antennas.push(g);
    };
    cap(w, d, H);
    let top = H;
    let tw = w;
    let td = d;
    // setback tiers make the skyline read as skyscrapers, not crates
    if (H > 320 && rnd() < 0.55) {
      const w2 = w * (0.55 + rnd() * 0.2);
      const d2 = d * (0.55 + rnd() * 0.2);
      const h2 = Math.round(Math.min(H * (0.15 + rnd() * 0.25), Math.max(CELL * 3, maxTop - H)) / CELL) * CELL;
      byFacade[fi].push(towerGeo(w2, h2, d2, x, H, z, ox, oy));
      cap(w2, d2, H + h2);
      top = H + h2;
      tw = w2;
      td = d2;
      if (rnd() < 0.35 && top + h2 * 0.6 < maxTop) {
        const h3 = Math.round((h2 * 0.6) / CELL) * CELL;
        byFacade[fi].push(towerGeo(w2 * 0.6, h3, d2 * 0.6, x, top, z, ox, oy));
        cap(w2 * 0.6, d2 * 0.6, top + h3);
        top += h3;
        tw = w2 * 0.6;
        td = d2 * 0.6;
      }
    }
    if (top > 420 && rnd() < 0.5) {
      const ah = 30 + rnd() * 70;
      const ag = new THREE.BoxGeometry(1.6, ah, 1.6);
      ag.translate(x, top + ah / 2, z);
      antennas.push(ag);
      (rnd() < 0.5 ? beaconsA : beaconsB).push([x, top + ah, z]);
    } else if (top > 300) {
      (rnd() < 0.5 ? beaconsA : beaconsB).push([x - w * 0.4, top + 1.5, z], [x + w * 0.4, top + 1.5, z]);
    }
    if (top > 380 && rnd() < 0.22) crowns.push({ x, y: top, z, w: tw + 1.2, d: td + 1.2, c: neon[Math.floor(rnd() * neon.length)] });

    // street level: lit shopfronts and neon signs on the front row
    if (rowIdx === 0) {
      const sg = new THREE.PlaneGeometry(w * 0.86, 9);
      if (side > 0) sg.rotateY(Math.PI);
      sg.translate(x, 6.5, front + side * -0.4);
      const shade = WARM[Math.floor(rnd() * 4)];
      const c = new THREE.Color(rnd() < 0.7 ? shade : COOL[Math.floor(rnd() * 4)]);
      const cols = new Float32Array(sg.attributes.position.count * 3);
      for (let k = 0; k < cols.length; k += 3) cols.set([c.r, c.g, c.b], k);
      sg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      sg.deleteAttribute('uv');
      sg.deleteAttribute('normal');
      shopGeos.push(sg);
      if (w > 55 && rnd() < 0.42) {
        signs.push({ x, y: 22 + rnd() * Math.min(80, H * 0.4), z: front + side * -0.8, w: Math.min(70, w * 0.8), side, vertical: false });
      } else if (H > 90 && rnd() < 0.3) {
        signs.push({ x: x + (rnd() < 0.5 ? -1 : 1) * w * 0.3, y: 30 + rnd() * 30, z: front + side * -2.5, w: 9, side, vertical: true });
      }
    }
  };

  [-1, 1].forEach((side) => {
    const z0 = Z0[side];
    const blocks = blocksFor();
    blocks.forEach(([a, b], bi) => {
      if (bi > 0) crossStreets.push({ x: a - 20, side, z0 });
      ROWS.forEach((row, ri) => {
        let x = a;
        while (x < b - 30) {
          const w = Math.min(b - x, 38 + rnd() * 80);
          const cx = x + w / 2;
          const inPlaza = ri < 3 && plazas.some((p) => p.side === side && Math.abs(p.x - cx) < 200);
          if (!inPlaza) {
            const d = row.dMin + rnd() * (row.dMax - row.dMin);
            const cluster = 0.6 + 0.4 * Math.sin(cx / 1400 + side * 1.7 + ri);
            const h = row.hMin + (row.hMax - row.hMin) * rnd() ** 1.5 * cluster;
            const recess = ri === 0 ? rnd() * 6 : rnd() * 20;
            const zFront = z0 + row.off + recess;
            addTower(cx, side * (zFront + d / 2), w - 3, d, h, ri, side * zFront, side);
          }
          x += w + 2 + rnd() * 6;
        }
      });
    });
  });

  // distant skyline ring: past both ends and far behind the side rows
  for (let k = 0; k < 260; k += 1) {
    let x;
    let z;
    if (k < 80) {
      x = X1 + 300 + rnd() * 1400;
      z = -1500 + rnd() * 3000;
    } else if (k < 120) {
      x = X0 - 300 - rnd() * 1200;
      z = -1500 + rnd() * 3000;
    } else {
      x = X0 + rnd() * (X1 - X0);
      z = (k % 2 ? 1 : -1) * (1650 + rnd() * 900);
    }
    const w = 60 + rnd() * 120;
    const h = k % 23 === 0 ? 950 + rnd() * 450 : 160 + rnd() ** 1.6 * 820;
    addTower(x, z, w, w * (0.7 + rnd() * 0.5), h, 9, 0, 1);
  }

  // ── sky-deck: a slab on supertall towers, with skybridge gaps between ──
  if (deck) {
    const { height: DH, zMin, zMax } = deck;
    const slabT = 18;
    const zc = (zMin + zMax) / 2;
    const deckX0 = -340;
    const deckX1 = W + 340;
    let x = deckX0;
    while (x < deckX1 - 120) {
      const tw = 170 + rnd() * 90;
      const fi = Math.floor(rnd() * FACADES.length);
      const H = Math.round((DH - slabT) / CELL) * CELL;
      byFacade[fi].push(towerGeo(tw, H, zMax - zMin - 10, x + tw / 2, 0, zc, Math.floor(rnd() * COLS) / COLS, 0));
      x += tw + 150 + rnd() * 120;
    }
    const slab = new THREE.Mesh(new THREE.BoxGeometry(deckX1 - deckX0, slabT, zMax - zMin + 16), flat(0x101622));
    slab.position.set((deckX0 + deckX1) / 2, DH - slabT / 2, zc);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(deckX1 - deckX0, zMax - zMin + 16), flat(0x111726));
    top.rotation.x = -Math.PI / 2;
    top.position.set((deckX0 + deckX1) / 2, DH + 0.2, zc);
    scene.add(slab, top);
    [zMin - 7, zMax + 7].forEach((z) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(deckX1 - deckX0, 5, 1.5), flat(0x1f2839));
      wall.position.set((deckX0 + deckX1) / 2, DH + 2.5, z);
      scene.add(wall);
    });
    // a row of lights along the slab's edge, seen from below and across
    const GAP = 22;
    const n = Math.floor((deckX1 - deckX0) / GAP);
    const edge = new THREE.InstancedMesh(new THREE.BoxGeometry(3, 1.6, 1.6), flat(0xffe2a6), n * 2);
    for (let k = 0; k < n; k += 1) {
      edge.setMatrixAt(k * 2, m4.makeTranslation(deckX0 + k * GAP, DH - 6, zMin - 8.2));
      edge.setMatrixAt(k * 2 + 1, m4.makeTranslation(deckX0 + k * GAP, DH - 6, zMax + 8.2));
    }
    scene.add(edge);
  }

  // merge towers per facade
  const facadeTex = [];
  byFacade.forEach((geos, i) => {
    if (!geos.length) return;
    const tex = facadeTexture(FACADES[i], hiRes ? 1024 : 512, anisotropy);
    facadeTex.push(tex);
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    scene.add(new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ map: tex, vertexColors: true })));
  });
  if (antennas.length) {
    const merged = mergeGeometries(antennas);
    antennas.forEach((g) => g.dispose());
    scene.add(new THREE.Mesh(merged, flat(0x1d2537)));
  }
  if (shopGeos.length) {
    const merged = mergeGeometries(shopGeos);
    shopGeos.forEach((g) => g.dispose());
    scene.add(new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ vertexColors: true })));
  }
  crowns.forEach((c) => {
    const ring = new THREE.Mesh(new THREE.BoxGeometry(c.w, 2.4, c.d), flat(new THREE.Color(c.c)));
    ring.position.set(c.x, c.y - 6, c.z);
    scene.add(ring);
  });

  // cross streets (planes running away from the avenue)
  crossStreets.forEach((cs) => {
    const len = 1400;
    const st = new THREE.Mesh(new THREE.PlaneGeometry(30, len), flat(0x10151f));
    st.rotation.x = -Math.PI / 2;
    st.position.set(cs.x, 0.35, cs.side * (cs.z0 + len / 2));
    scene.add(st);
  });

  // neon signs
  const neonCache = new Map();
  signs.forEach((s, i) => {
    const color = neon[i % neon.length];
    const word = s.vertical ? VERTICAL_WORDS[i % VERTICAL_WORDS.length] : NEON_WORDS[i % NEON_WORDS.length];
    const key = `${word}|${color}|${s.vertical}`;
    let mat = neonCache.get(key);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ map: neonTexture(word, color, s.vertical) });
      neonCache.set(key, mat);
    }
    const geo = s.vertical
      ? new THREE.PlaneGeometry(s.w, (s.w * (96 * word.length + 32)) / 96)
      : new THREE.PlaneGeometry(s.w, (s.w * 144) / 512);
    const sign = new THREE.Mesh(geo, mat);
    sign.position.set(s.x, s.y, s.z);
    if (s.side > 0) sign.rotation.y = Math.PI;
    scene.add(sign);
  });

  // rooftop aviation beacons, two alternating sets
  const beaconGeo = new THREE.SphereGeometry(2.4, 8, 6);
  const beaconMats = [flat(0xff4d5e), flat(0xff4d5e)];
  [beaconsA, beaconsB].forEach((list, j) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(beaconGeo, beaconMats[j], list.length);
    list.forEach(([x, y, z], k) => im.setMatrixAt(k, m4.makeTranslation(x, y, z)));
    scene.add(im);
  });

  // street lights along both avenues
  const LAMP_GAP = 80;
  const lampN = Math.ceil((X1 - X0) / LAMP_GAP);
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.7, 20, 5), flat(0x232c3e), lampN * 4);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(5, 1.2, 2), flat(0xffe2a6), lampN * 4);
  let li = 0;
  avenues.forEach((av) => {
    [-17, 17].forEach((dz, j) => {
      for (let k = 0; k < lampN; k += 1) {
        const x = X0 + k * LAMP_GAP + j * (LAMP_GAP / 2);
        posts.setMatrixAt(li, m4.makeTranslation(x, 10, av.z + dz));
        heads.setMatrixAt(li, m4.makeTranslation(x, 20, av.z + dz * 0.8));
        li += 1;
      }
    });
  });
  scene.add(posts, heads);

  // traffic: pairs of lights streaming along the avenues
  const lanes = [];
  avenues.forEach((av) => {
    lanes.push({ z: av.z - 7, dir: 1, color: 0xff3b4a });
    lanes.push({ z: av.z + 7, dir: -1, color: 0xfff1d6 });
  });
  const PER_LANE = 40;
  const span = X1 - X0;
  const lightGeo = new THREE.BoxGeometry(1.4, 1.1, 1.1);
  const cars = lanes.map((ln) => {
    const im = new THREE.InstancedMesh(lightGeo, flat(ln.color), PER_LANE * 2);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(im);
    return {
      ...ln,
      im,
      x0: Array.from({ length: PER_LANE }, (_, k) => (k / PER_LANE) * span + rnd() * 40),
      v: Array.from({ length: PER_LANE }, () => 45 + rnd() * 40),
    };
  });
  const placeCars = (time) => {
    cars.forEach((ln) => {
      for (let k = 0; k < PER_LANE; k += 1) {
        const p = (((ln.x0[k] + ln.dir * ln.v[k] * time) % span) + span) % span;
        const x = X0 + p;
        ln.im.setMatrixAt(k * 2, m4.makeTranslation(x, 2.2, ln.z - 1.3));
        ln.im.setMatrixAt(k * 2 + 1, m4.makeTranslation(x, 2.2, ln.z + 1.3));
      }
      ln.im.instanceMatrix.needsUpdate = true;
    });
  };
  placeCars(0);

  const red = new THREE.Color(0xff4d5e);
  const off = new THREE.Color(0x3a1c24);
  return {
    tick(time, calm) {
      if (calm) return;
      placeCars(time);
      const on = Math.floor(time / 0.9) % 2 === 0;
      beaconMats[0].color.copy(on ? red : off);
      beaconMats[1].color.copy(on ? off : red);
    },
    dispose() {
      facadeTex.forEach((t) => t.dispose());
      dash.dispose();
    },
  };
}

/* The night-city world: skyline + two observation wheels + stars and moon */
export function buildCityWorld({ scene, width: W, accent, elev, anisotropy, hiRes, sunDir }) {
  const plazas = [{ x: W * 0.3, side: -1 }, { x: W * 0.7, side: 1 }];
  const city = buildNightCity({
    scene, width: W, accent, plazas, deck: { height: elev, zMin: -130, zMax: 160 }, anisotropy, hiRes,
  });
  // an observation wheel stands in each open plaza between the towers
  const wheels = plazas.map((pz, k) => {
    const R = 170;
    const wh = ferrisWheel(R, k ? 0xffd27a : accent);
    wh.group.position.set(pz.x, R + 24, pz.side * 360);
    wh.group.rotation.y = pz.side * 0.35;
    scene.add(wh.group);
    return wh;
  });
  // sky: stars + moon sit at "infinity" (the group follows the camera)
  const rnd = mulberry(4242);
  const sky = new THREE.Group();
  sky.add(starDome(rnd, { count: 650, opacity: 0.6 }));
  const moon = new THREE.Group();
  moon.add(new THREE.Mesh(new THREE.CircleGeometry(260, 48), new THREE.MeshBasicMaterial({ color: 0xece6cf, fog: false })));
  [[-70, 50, 60], [80, -60, 40], [40, 100, 28], [-40, -110, 22]].forEach(([cx, cy, r]) => {
    const cr = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: 0xd8d1b8, fog: false }));
    cr.position.set(cx, cy, 1);
    moon.add(cr);
  });
  moon.position.copy(sunDir).multiplyScalar(8600);
  moon.lookAt(0, 0, 0);
  sky.add(moon);
  scene.add(sky);
  return {
    sky,
    tick(time, calm) {
      if (!calm) wheels.forEach((w) => w.tick(time));
      city.tick(time, calm);
    },
    dispose: city.dispose,
  };
}
