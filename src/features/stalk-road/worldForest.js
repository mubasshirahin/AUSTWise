import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry } from './coasterTrack';
import {
  flat, lambert, sstep, noise2, fbm, canvasTex, skyDisc, driftField, jitter, tint,
} from './fppKit';

/* ─── Wildwood: a pine valley on a clear morning ───
   Low-poly rolling hills (flat-shaded, vertex coloured) rise into snowy
   peaks; the coaster's white steel runs down a meadow in the middle of the
   valley. Thousands of instanced pines and broadleaf trees (a few already
   turning gold), a river and a lake under a waterfall, log cabins with
   chimney smoke, a lookout tower, flocks of birds and drifting seeds. */

const GRASS = [0x5f8f3e, 0x77a04a, 0x4e7a35, 0x6c9444];

export function buildForestWorld({ scene, width: W, anisotropy = 8, hiRes = true, sunDir }) {
  const rnd = mulberry(7373);
  const n = fbm(noise2(3), 4);
  const n2 = noise2(11);
  const X0 = -3600;
  const X1 = W + 3600;
  const Z = 5400;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const cc = new THREE.Color();
  const textures = [];

  // ── terrain ──
  const riverZ = (x) => -600 + 150 * Math.sin(x / 820) + 60 * Math.sin(x / 300 + 2);
  const lake = { x: W * 0.52, z: 1250, r: 520 };
  const height = (x, z) => {
    const c = sstep(230, 950, Math.abs(z - 14));
    let h = Math.max(0, (n(x / 900, z / 900) - 0.36) * 560) * c;
    h += (n(x / 210 + 7, z / 210) - 0.5) * 30 * (0.15 + c);
    h += Math.max(0, Math.abs(z) - 1700) * 0.36 * (0.6 + n2(x / 700, z / 700) * 0.8);
    const dr = Math.abs(z - riverZ(x));
    h = h * sstep(40, 230, dr) - 14 * (1 - sstep(34, 74, dr));
    const dl = Math.hypot(x - lake.x, (z - lake.z) * 1.3);
    h = h * sstep(lake.r * 0.7, lake.r * 1.45, dl) - 16 * (1 - sstep(lake.r * 0.75, lake.r * 0.95, dl));
    return h;
  };
  const segX = hiRes ? 230 : 150;
  const segZ = hiRes ? 170 : 110;
  const tg = new THREE.PlaneGeometry(X1 - X0, Z * 2, segX, segZ);
  tg.rotateX(-Math.PI / 2);
  tg.translate((X0 + X1) / 2, 0, 0);
  const tp = tg.attributes.position;
  const tcol = new Float32Array(tp.count * 3);
  const sand = new THREE.Color(0xcdbd8c);
  const rock = new THREE.Color(0x7a7d76);
  const snow = new THREE.Color(0xf3f6f8);
  const grass = GRASS.map((c) => new THREE.Color(c));
  for (let i = 0; i < tp.count; i += 1) {
    const x = tp.getX(i);
    const z = tp.getZ(i);
    const h = height(x, z);
    tp.setY(i, h);
    const g = n2(x / 260, z / 260) * (grass.length - 1);
    cc.copy(grass[Math.floor(g)]).lerp(grass[Math.min(grass.length - 1, Math.floor(g) + 1)], g % 1);
    const wet = Math.min(Math.abs(z - riverZ(x)) / 110, Math.hypot(x - lake.x, (z - lake.z) * 1.3) / (lake.r * 1.1));
    if (wet < 1) cc.lerp(sand, (1 - sstep(0.55, 1, wet)) * (1 - sstep(-6, 6, h) * 0.5));
    cc.lerp(rock, sstep(500, 760, h)).lerp(snow, sstep(860, 960, h));
    cc.multiplyScalar(0.92 + rnd() * 0.12);
    tcol.set([cc.r, cc.g, cc.b], i * 3);
  }
  tg.setAttribute('color', new THREE.BufferAttribute(tcol, 3));
  tg.computeVertexNormals();
  scene.add(new THREE.Mesh(tg, lambert(0xffffff, { vertexColors: true, flatShading: true })));

  // water: one sheet; the terrain dips below it in the river and the lake
  const ripple = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#4f8fae';
    ctx.fillRect(0, 0, w, h);
    const r2 = mulberry(5);
    for (let k = 0; k < 70; k += 1) {
      ctx.fillStyle = r2() < 0.6 ? '#79b2cc' : '#a9d3e4';
      ctx.fillRect(r2() * w, r2() * h, 8 + r2() * 26, 2);
    }
  }, { repeat: true, aniso: anisotropy });
  textures.push(ripple);
  ripple.repeat.set((X1 - X0) / 220, (Z * 2) / 220);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z * 2), flat(0xffffff, { map: ripple }));
  water.rotation.x = -Math.PI / 2;
  water.position.set((X0 + X1) / 2, -3, 0);
  scene.add(water);

  // ── far mountains ──
  const mLo = new THREE.Color(0x56705f);
  const mMid = new THREE.Color(0x6f7c88);
  const mountain = (x, z, R, H) => {
    const g = jitter(new THREE.ConeGeometry(R, H, 10, 6), R * 0.16, rnd, (px, py) => py < -H / 2 + 1);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i += 1) {
      const t = (pos.getY(i) + H / 2) / H;
      cc.copy(mLo).lerp(mMid, sstep(0.15, 0.55, t)).lerp(snow, sstep(0.62, 0.7, t + (rnd() - 0.5) * 0.06));
      col.set([cc.r, cc.g, cc.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, lambert(0xffffff, { vertexColors: true, flatShading: true }));
    m.position.set(x, H / 2 + 200, z);
    m.rotation.y = rnd() * Math.PI;
    scene.add(m);
  };
  for (let k = 0; k < 34; k += 1) {
    const side = k % 2 ? 1 : -1;
    mountain(X0 + (k / 34) * (X1 - X0) + rnd() * 300, side * (5600 + rnd() * 1800), 1300 + rnd() * 900, 1500 + rnd() * 1300);
  }
  [[X0 - 1200, -900], [X0 - 1600, 1400], [X1 + 1200, 600], [X1 + 1500, -1700]].forEach(([x, z]) => {
    mountain(x, z, 1600 + rnd() * 600, 1800 + rnd() * 900);
  });

  // ── trees ──
  const pineGeo = mergeGeometries([
    tint(new THREE.CylinderGeometry(0.06, 0.09, 0.4, 5).translate(0, 0.2, 0), 0x6b4a32),
    tint(new THREE.ConeGeometry(0.5, 0.62, 7).translate(0, 0.62, 0), 0x2f5a35),
    tint(new THREE.ConeGeometry(0.4, 0.55, 7).translate(0, 0.92, 0), 0x356640),
    tint(new THREE.ConeGeometry(0.28, 0.46, 7).translate(0, 1.2, 0), 0x3f744a),
  ]);
  const trunkGeo = tint(new THREE.CylinderGeometry(0.07, 0.11, 0.62, 5).translate(0, 0.31, 0), 0x6b4a32);
  const crownGeo = jitter(new THREE.IcosahedronGeometry(0.46, 0), 0.12, rnd).translate(0, 0.86, 0);
  crownGeo.scale(1, 0.9, 1);
  const PINES = hiRes ? 5200 : 2600;
  const LEAFY = hiRes ? 1500 : 800;
  const pines = new THREE.InstancedMesh(pineGeo, lambert(0xffffff, { vertexColors: true, flatShading: true }), PINES);
  const trunks = new THREE.InstancedMesh(trunkGeo, lambert(0xffffff, { vertexColors: true, flatShading: true }), LEAFY);
  const crowns = new THREE.InstancedMesh(crownGeo, lambert(0xffffff, { flatShading: true }), LEAFY);
  const leafCols = [0x4f8a3c, 0x5f9a45, 0x6aa04a, 0x4a7f38, 0xd99a2b, 0xc8622a, 0xe0b440];
  const spot = (tries, accept) => {
    for (let t = 0; t < tries; t += 1) {
      const x = X0 + 250 + rnd() * (X1 - X0 - 500);
      const z = (rnd() * 2 - 1) * (Z - 700);
      const dz = Math.abs(z - 14);
      if (dz < 150 || (dz < 300 && rnd() < 0.75)) continue;
      const h = height(x, z);
      if (h < 3 || !accept(h, x, z)) continue;
      const dens = n2(x / 650 + 3, z / 650);
      if (rnd() > dens * 1.5 - 0.2) continue;
      return [x, h, z];
    }
    return null;
  };
  let placed = 0;
  for (let k = 0; k < PINES; k += 1) {
    const p = spot(12, (h) => h < 820);
    if (!p) continue;
    const s = 24 + rnd() * 26 + (p[1] > 300 ? 8 : 0);
    m4.compose(v3.set(p[0], p[1] - 1, p[2]), q.setFromAxisAngle(yAxis, rnd() * 6.3), s3.set(s * (0.85 + rnd() * 0.3), s, s * (0.85 + rnd() * 0.3)));
    pines.setMatrixAt(placed, m4);
    const b = 0.82 + rnd() * 0.3;
    pines.setColorAt(placed, cc.setRGB(b * (0.95 + rnd() * 0.1), b, b * (0.9 + rnd() * 0.1)));
    placed += 1;
  }
  pines.count = placed;
  placed = 0;
  for (let k = 0; k < LEAFY; k += 1) {
    const p = spot(12, (h) => h < 380);
    if (!p) continue;
    const s = 26 + rnd() * 22;
    m4.compose(v3.set(p[0], p[1] - 1, p[2]), q.setFromAxisAngle(yAxis, rnd() * 6.3), s3.set(s, s * (0.85 + rnd() * 0.3), s));
    trunks.setMatrixAt(placed, m4);
    crowns.setMatrixAt(placed, m4);
    const autumn = rnd() < 0.16;
    cc.set(leafCols[autumn ? 4 + Math.floor(rnd() * 3) : Math.floor(rnd() * 4)]).multiplyScalar(0.9 + rnd() * 0.2);
    crowns.setColorAt(placed, cc);
    placed += 1;
  }
  trunks.count = placed;
  crowns.count = placed;
  scene.add(pines, trunks, crowns);

  // boulders along the river and on the slopes
  const ROCKS = hiRes ? 320 : 180;
  const rocks = new THREE.InstancedMesh(jitter(new THREE.DodecahedronGeometry(1, 0), 0.35, rnd), lambert(0xffffff, { flatShading: true }), ROCKS);
  for (let k = 0; k < ROCKS; k += 1) {
    const x = X0 + 500 + rnd() * (X1 - X0 - 1000);
    const nearRiver = k % 2 === 0;
    const z = nearRiver ? riverZ(x) + (rnd() < 0.5 ? -1 : 1) * (60 + rnd() * 90) : (rnd() < 0.5 ? -1 : 1) * (320 + rnd() * 2600);
    const s = 5 + rnd() * (nearRiver ? 9 : 18);
    m4.compose(v3.set(x, height(x, z) + s * 0.2, z), q.setFromAxisAngle(yAxis, rnd() * 6.3), s3.set(s * 1.3, s * 0.8, s));
    rocks.setMatrixAt(k, m4);
    const v = 0.5 + rnd() * 0.18;
    rocks.setColorAt(k, cc.setRGB(v, v * 1.01, v * 0.96));
  }
  scene.add(rocks);

  // meadow flowers by the track (tiny coloured points)
  const FLOWERS = hiRes ? 2600 : 1400;
  const fPos = [];
  const fCol = [];
  const petal = [0xffffff, 0xfff0a0, 0xf6a6c8, 0xb79be8, 0xffc970].map((c) => new THREE.Color(c));
  for (let k = 0; k < FLOWERS; k += 1) {
    const x = -600 + rnd() * (W + 1200);
    const z = 14 + (rnd() * 2 - 1) * 650;
    const h = height(x, z);
    if (h < 2) continue;
    fPos.push(x, h + 1.2, z);
    const c = petal[Math.floor(rnd() * petal.length)];
    fCol.push(c.r, c.g, c.b);
  }
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
  fGeo.setAttribute('color', new THREE.Float32BufferAttribute(fCol, 3));
  scene.add(new THREE.Points(fGeo, new THREE.PointsMaterial({ size: 3.2, vertexColors: true })));

  // ── waterfall over a cliff on the far side of the lake ──
  const cliff = new THREE.Mesh(
    jitter(new THREE.BoxGeometry(560, 380, 140, 7, 5, 2), 26, rnd),
    lambert(0x80837a, { flatShading: true }),
  );
  cliff.position.set(lake.x, 150, lake.z + 560);
  scene.add(cliff);
  const fallTex = canvasTex(64, 256, (ctx, w, h) => {
    ctx.fillStyle = '#cfe8f2';
    ctx.fillRect(0, 0, w, h);
    const r2 = mulberry(8);
    for (let k = 0; k < 40; k += 1) {
      ctx.fillStyle = r2() < 0.5 ? '#ffffff' : '#9fcbe0';
      const y = r2() * h;
      const x = r2() * w;
      const len = 30 + r2() * 90;
      ctx.fillRect(x, y, 2 + r2() * 4, len);
      ctx.fillRect(x, y - h, 2 + r2() * 4, len);
    }
  }, { repeat: true, aniso: 4 });
  textures.push(fallTex);
  fallTex.repeat.set(1, 1.6);
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(80, 330), flat(0xffffff, { map: fallTex }));
  fall.position.set(lake.x - 40, 172, lake.z + 486);
  fall.rotation.y = Math.PI;
  scene.add(fall);
  const foamGeo = jitter(new THREE.IcosahedronGeometry(1, 0), 0.3, rnd);
  for (let k = 0; k < 9; k += 1) {
    const foam = new THREE.Mesh(foamGeo, lambert(0xffffff, { flatShading: true, emissive: 0x8a9aa8 }));
    foam.position.set(lake.x - 40 + (rnd() - 0.5) * 90, 2, lake.z + 470 - rnd() * 40);
    foam.scale.setScalar(12 + rnd() * 12);
    scene.add(foam);
  }

  // ── log cabins with chimney smoke, and a lookout tower ──
  const wood = lambert(0x8a5a3a, { flatShading: true });
  const roofMat = lambert(0x4e3426, { flatShading: true });
  const stone = lambert(0x7f7c74, { flatShading: true });
  const windowMat = flat(0xffd890);
  const roofShape = new THREE.Shape([new THREE.Vector2(-26, 0), new THREE.Vector2(26, 0), new THREE.Vector2(0, 20)]);
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 40, bevelEnabled: false }).translate(0, 0, -20);
  const smokeGeo = jitter(new THREE.IcosahedronGeometry(1, 0), 0.25, rnd);
  const smoke = [];
  [[0.14, -330], [0.3, 360], [0.62, -300], [0.8, 420], [0.92, -380]].forEach(([t, z], k) => {
    const x = W * t + 80;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(44, 24, 34), wood);
    body.position.y = 12;
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 24;
    roof.rotation.y = Math.PI / 2;
    const chim = new THREE.Mesh(new THREE.BoxGeometry(6, 18, 6), stone);
    chim.position.set(12, 38, 6);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(7, 6), windowMat);
    win.position.set(-8, 13, z < 0 ? 17.2 : -17.2);
    if (z > 0) win.rotation.y = Math.PI;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(7, 13), lambert(0x4a2f20));
    door.position.set(10, 6.5, z < 0 ? 17.2 : -17.2);
    if (z > 0) door.rotation.y = Math.PI;
    g.add(body, roof, chim, win, door);
    g.position.set(x, height(x, z) - 0.5, z);
    g.rotation.y = (rnd() - 0.5) * 0.5;
    scene.add(g);
    for (let p = 0; p < 7; p += 1) {
      const mat = lambert(0xe8ecef, { flatShading: true, transparent: true, depthWrite: false, emissive: 0x6d7680 });
      const m = new THREE.Mesh(smokeGeo, mat);
      scene.add(m);
      const base = new THREE.Vector3(12, 48, 6).applyEuler(g.rotation).add(g.position);
      smoke.push({ m, mat, base, age: p / 7, k });
    }
  });
  const placeSmoke = (time) => {
    smoke.forEach((s) => {
      const a = (s.age + time * 0.09) % 1;
      s.m.position.set(s.base.x + a * 50 + Math.sin(a * 6 + s.k) * 6, s.base.y + a * 130, s.base.z + a * 14);
      s.m.scale.setScalar(4 + a * 16);
      s.mat.opacity = Math.min(1, a * 6) * (1 - a) * 0.85;
    });
  };
  placeSmoke(0);

  const tower = new THREE.Group();
  const tx = W * 0.44;
  const tz = 330;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(3, 120, 3), wood);
    leg.position.set(a * 12, 60, b * 12);
    leg.rotation.set(b * 0.05, 0, -a * 0.05);
    tower.add(leg);
  });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(34, 3, 34), wood);
  deck.position.y = 120;
  const cabinTop = new THREE.Mesh(new THREE.BoxGeometry(28, 14, 28), lambert(0x9a6a44, { flatShading: true }));
  cabinTop.position.y = 129;
  const tRoof = new THREE.Mesh(new THREE.ConeGeometry(25, 16, 4), roofMat);
  tRoof.position.y = 144;
  tRoof.rotation.y = Math.PI / 4;
  tower.add(deck, cabinTop, tRoof);
  tower.position.set(tx, height(tx, tz), tz);
  scene.add(tower);

  // ── clouds ──
  const cloudGeos = [];
  for (let k = 0; k < 7; k += 1) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(1.3, 0.62, 1);
    g.translate((rnd() - 0.5) * 2.8, (rnd() - 0.3) * 0.5, (rnd() - 0.5) * 1.4);
    cloudGeos.push(jitter(g, 0.16, rnd));
  }
  const cloudGeo = mergeGeometries(cloudGeos);
  const cloudMat = lambert(0xffffff, { flatShading: true, emissive: 0x7a8a98 });
  const clouds = Array.from({ length: 30 }, () => {
    const c = new THREE.Mesh(cloudGeo, cloudMat);
    c.position.set(X0 + rnd() * (X1 - X0), 1250 + rnd() * 900, (rnd() - 0.5) * 9000);
    c.scale.set(170 + rnd() * 200, 120 + rnd() * 90, 150 + rnd() * 160);
    c.rotation.y = rnd() * Math.PI;
    scene.add(c);
    return { c, v: 5 + rnd() * 7 };
  });

  // ── birds: flocks circling over the valley ──
  const FLOCKS = 6;
  const PER = 9;
  const birdPos = new Float32Array(FLOCKS * PER * 18);
  const birdGeo = new THREE.BufferGeometry();
  birdGeo.setAttribute('position', new THREE.BufferAttribute(birdPos, 3));
  const birds = new THREE.Mesh(birdGeo, flat(0x2e3b3f, { side: THREE.DoubleSide }));
  birds.frustumCulled = false;
  scene.add(birds);
  const flocks = Array.from({ length: FLOCKS }, (_, k) => ({
    cx: W * (0.1 + (k / FLOCKS) * 0.85),
    cz: (k % 2 ? 1 : -1) * (260 + rnd() * 380),
    y: 240 + rnd() * 260,
    R: 260 + rnd() * 320,
    w: (0.05 + rnd() * 0.05) * (k % 2 ? 1 : -1),
    ph: rnd() * 6.3,
    off: Array.from({ length: PER }, (_, i) => [
      -Math.ceil(i / 2) * 14 - rnd() * 4, (rnd() - 0.5) * 8, (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 11,
    ]),
  }));
  const fwd = new THREE.Vector3();
  const side = new THREE.Vector3();
  const bp = new THREE.Vector3();
  const placeBirds = (time) => {
    let o = 0;
    flocks.forEach((fl) => {
      const a = fl.ph + time * fl.w;
      const cx = fl.cx + Math.cos(a) * fl.R;
      const cz = fl.cz + Math.sin(a) * fl.R;
      const cy = fl.y + Math.sin(time * 0.3 + fl.ph) * 30;
      fwd.set(-Math.sin(a) * Math.sign(fl.w), 0, Math.cos(a) * Math.sign(fl.w));
      side.crossVectors(fwd, yAxis);
      fl.off.forEach(([ox, oy, oz], i) => {
        bp.set(cx, cy + oy, cz).addScaledVector(fwd, ox).addScaledVector(side, oz);
        const flap = Math.sin(time * 9 + i * 1.7 + fl.ph) * 3.2;
        const span = 7;
        // two wing triangles: front, back, tip
        [-1, 1].forEach((sd) => {
          birdPos.set([
            bp.x + fwd.x * 2, bp.y, bp.z + fwd.z * 2,
            bp.x - fwd.x * 2, bp.y, bp.z - fwd.z * 2,
            bp.x + side.x * span * sd - fwd.x * 2, bp.y + flap, bp.z + side.z * span * sd - fwd.z * 2,
          ], o);
          o += 9;
        });
      });
    });
    birdGeo.attributes.position.needsUpdate = true;
  };
  placeBirds(0);

  // drifting seeds / pollen
  const seeds = driftField(scene, rnd, {
    count: hiRes ? 360 : 200, box: [1300, 600, 1300], vel: [7, 2, 3], wobble: 12,
    size: 2.2, opacity: 0.85, palette: [0xfffbe8, 0xfff3c4],
  });

  // ── sky: a warm morning sun ──
  const sky = new THREE.Group();
  sky.add(skyDisc(sunDir, 8600, 300, 0xfff4d6));
  scene.add(sky);

  let last = 0;
  return {
    sky,
    tick(time, calm, cam) {
      const dt = Math.min(0.1, Math.max(0, time - last));
      last = time;
      if (calm) return;
      ripple.offset.x = time * 0.01;
      fallTex.offset.y = time * 0.9;
      placeSmoke(time);
      placeBirds(time);
      clouds.forEach((c) => { c.c.position.x += c.v * dt; });
      seeds.tick(time, cam);
    },
    dispose() {
      textures.forEach((t) => t.dispose());
      cloudGeos.forEach((g) => g.dispose());
    },
  };
}
