import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry } from './coasterTrack';
import {
  flat, lambert, sstep, noise2, noise3, fbm, canvasTex, starDome, skyDisc, driftField, ribbon, jitter,
} from './fppKit';

/* ─── Inferno: a volcanic badland at night ───
   The coaster runs along a basalt ridge (the "deck", elev units high) above
   a cooling lava field — dark crust plates split by bright cracks — with
   lava rivers, lava falls pouring off the ridge, basalt column clusters,
   volcanoes (one erupting under a smoke plume with lightning), fire jets
   and torches along the ridge, and embers drifting past the rider. */

/* tileable crust: dark irregular plates split by cracks — a few run hot,
   most have cooled to a dull red (cellular noise, wobbled so it never reads
   as a grid) */
function crustTexture(aniso) {
  return canvasTex(512, 512, (ctx, w, h) => {
    const rnd = mulberry(91);
    const G = 6;
    const cell = w / G;
    const pts = [];
    for (let j = 0; j < G; j += 1) {
      for (let i = 0; i < G; i += 1) {
        pts.push([(i + 0.05 + rnd() * 0.9) * cell, (j + 0.05 + rnd() * 0.9) * cell, 0.7 + rnd() * 0.6]);
      }
    }
    const heatOf = (a, b) => {
      const k = a < b ? a * 97 + b : b * 97 + a;
      const v = Math.sin(k * 12.9898) * 43758.5453;
      return v - Math.floor(v);
    };
    const n = noise2(5);
    const TAU = Math.PI * 2;
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y += 1) {
      for (let x0 = 0; x0 < w; x0 += 1) {
        // periodic wobble keeps the tile seamless
        const x = x0 + 7 * Math.sin(TAU * (y / h) * 4 + 1.3) + 4 * Math.sin(TAU * (x0 / w) * 7 + TAU * (y / h) * 2);
        const yy = y + 7 * Math.sin(TAU * (x0 / w) * 3 + 0.4) + 4 * Math.sin(TAU * (y / h) * 6 + TAU * (x0 / w));
        const ci = Math.floor(x / cell);
        const cj = Math.floor(yy / cell);
        let f1 = 1e9;
        let f2 = 1e9;
        let i1 = 0;
        let i2 = 0;
        for (let dj = -1; dj <= 1; dj += 1) {
          for (let di = -1; di <= 1; di += 1) {
            const ii = (((ci + di) % G) + G) % G;
            const jj = (((cj + dj) % G) + G) % G;
            const id = jj * G + ii;
            const p = pts[id];
            const px = p[0] + (ci + di - ii) * cell;
            const py = p[1] + (cj + dj - jj) * cell;
            const d = Math.hypot(x - px, yy - py);
            if (d < f1) { f2 = f1; i2 = i1; f1 = d; i1 = id; } else if (d < f2) { f2 = d; i2 = id; }
          }
        }
        const e = f2 - f1;
        const shade = pts[i1][2];
        const grain = 0.8 + n(x0 / 7, y / 7) * 0.4;
        let r = 27 * shade * grain;
        let g = 14 * shade * grain;
        let b = 11 * shade * grain;
        const heat = heatOf(i1, i2);
        const hot = heat > 0.62;
        const half = hot ? 1.4 + (heat - 0.62) * 4 : 0.9 + heat * 1.2;
        if (e < half) {
          if (hot) { r = 255; g = 170 + heat * 60; b = 60 + heat * 50; } else { r = 150 + heat * 60; g = 38 + heat * 20; b = 14; }
        } else if (e < half * 3.2) {
          const t = (e - half) / (half * 2.2);
          const cr = hot ? 235 : 92;
          const cg = hot ? 70 : 22;
          const cb = hot ? 18 : 12;
          r = cr * (1 - t) + r * t; g = cg * (1 - t) + g * t; b = cb * (1 - t) + b * t;
        }
        const o = (y * w + x0) * 4;
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, { repeat: true, aniso });
}

/* banded flame: yellow at the root, orange, red tip; a little twisted */
function flameGeometry(rnd) {
  const g = new THREE.ConeGeometry(1, 1, 7, 4);
  g.translate(0, 0.5, 0);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const bands = [0xffe27a, 0xffb43c, 0xff7a22, 0xe8481c, 0xb8301a].map((c) => new THREE.Color(c));
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i);
    const tw = y * 0.9;
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setXYZ(i, x * Math.cos(tw) - z * Math.sin(tw), y, x * Math.sin(tw) + z * Math.cos(tw));
    const c = bands[Math.min(4, Math.round(y * 4))];
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return jitter(g, 0.12, rnd, (x, y) => y > 0.99 || y < 0.01);
}

/* flowing lava: hot streaks along v, a few dark crust rafts */
function lavaTexture() {
  return canvasTex(128, 512, (ctx, w, h) => {
    const rnd = mulberry(17);
    ctx.fillStyle = '#ff6a1c';
    ctx.fillRect(0, 0, w, h);
    for (let k = 0; k < 46; k += 1) {
      const x = rnd() * w;
      const y = rnd() * h;
      const len = 60 + rnd() * 180;
      ctx.fillStyle = rnd() < 0.5 ? '#ffb43c' : '#ffd977';
      ctx.fillRect(x, y, 2 + rnd() * 5, len);
      ctx.fillRect(x, y - h, 2 + rnd() * 5, len);
    }
    for (let k = 0; k < 16; k += 1) {
      const x = rnd() * w;
      const y = rnd() * h;
      ctx.fillStyle = rnd() < 0.5 ? '#7a2410' : '#a3340f';
      ctx.beginPath();
      ctx.ellipse(x, y, 5 + rnd() * 12, 10 + rnd() * 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: true, aniso: 4 });
}

/* basalt hexes for the ridge top */
function hexTexture(aniso) {
  return canvasTex(222, 192, (ctx, w, h) => {
    const rnd = mulberry(33);
    ctx.fillStyle = '#3a170d';
    ctx.fillRect(0, 0, w, h);
    const r = 32;
    const dx = Math.sqrt(3) * r;
    for (let row = -1; row < 5; row += 1) {
      for (let col = -1; col < 6; col += 1) {
        const cx = col * dx + (row % 2 ? dx / 2 : 0);
        const cy = row * r * 1.5;
        const v = 52 + rnd() * 22;
        ctx.fillStyle = `rgb(${v + 6},${v - 6},${v - 10})`;
        ctx.beginPath();
        for (let k = 0; k < 6; k += 1) {
          const a = Math.PI / 6 + (k * Math.PI) / 3;
          const px = cx + Math.cos(a) * (r - 2.5);
          const py = cy + Math.sin(a) * (r - 2.5);
          if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  }, { repeat: true, aniso });
}

export function buildFireWorld({
  scene, width: W, elev, anisotropy = 8, hiRes = true, sunDir, hemi,
}) {
  const rnd = mulberry(6161);
  const n2 = noise2(21);
  const n3 = fbm(noise3(9), 3);
  const X0 = -2600;
  const X1 = W + 2600;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  const textures = [];
  const keep = (t) => { textures.push(t); return t; };

  // ── lava field ──
  const crust = keep(crustTexture(anisotropy));
  crust.repeat.set(40000 / 620, 40000 / 620);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), flat(0xffffff, { map: crust }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(W / 2, 0, 0);
  scene.add(ground);

  const lava = keep(lavaTexture());
  const lavaMat = flat(0xffffff, { map: lava, side: THREE.DoubleSide });
  const lakeTex = keep(lava.clone());
  lakeTex.repeat.set(3, 3);
  lakeTex.needsUpdate = true;
  const lakeMat = flat(0xffffff, { map: lakeTex });

  // rivers winding across the field
  [
    { z: (x) => -760 + 170 * Math.sin(x / 700) + 80 * Math.sin(x / 260 + 1), w: 92 },
    { z: (x) => 960 + 210 * Math.sin(x / 880 + 2) + 60 * Math.sin(x / 310), w: 110 },
    { z: (x) => -1650 + 260 * Math.sin(x / 1200 + 4), w: 70 },
  ].forEach((rv) => {
    const pts = [];
    for (let x = X0; x <= X1; x += 30) pts.push([x, 0.6, rv.z(x)]);
    scene.add(new THREE.Mesh(ribbon(pts, rv.w, { uvScale: 0.25, widthAt: (t) => 0.75 + 0.5 * n2(t * 30, 3) }), lavaMat));
  });
  // lava lakes
  for (let k = 0; k < 7; k += 1) {
    const r = 140 + rnd() * 220;
    const g = new THREE.CircleGeometry(r, 40);
    const pos = g.attributes.position;
    for (let i = 1; i < pos.count; i += 1) {
      const s = 0.8 + n2(i * 0.5, k * 7) * 0.4;
      pos.setXY(i, pos.getX(i) * s, pos.getY(i) * s);
    }
    const lake = new THREE.Mesh(g, lakeMat);
    lake.rotation.x = -Math.PI / 2;
    const side = k % 2 ? 1 : -1;
    lake.position.set(X0 + 1400 + rnd() * (X1 - X0 - 2800), 0.4, side * (480 + rnd() * 1300));
    scene.add(lake);
  }

  // ── the basalt ridge the coaster rides on ──
  const RX0 = -1700;
  const RX1 = W + 1700;
  const PROFILE = [
    [-345, -0.03], [-270, 0.33], [-214, 0.64], [-178, 0.86], [-157, 0.97], [-150, 1],
    [165, 1], [172, 0.97], [193, 0.86], [229, 0.64], [285, 0.33], [358, -0.03],
  ];
  const env = (x) => sstep(RX0, RX0 + 800, x) * sstep(RX1, RX1 - 800, x);
  const xs = [];
  for (let x = RX0; x <= RX1; x += 40) xs.push(x);
  const P = PROFILE.length;
  const cliffPos = new Float32Array(xs.length * P * 3);
  const cliffCol = new Float32Array(xs.length * P * 3);
  const lo = new THREE.Color(0x4a2a1d);
  const hi = new THREE.Color(0x231614);
  const cc = new THREE.Color();
  xs.forEach((x, i) => {
    const e = env(x);
    PROFILE.forEach(([z, fy], k) => {
      const edge = k === 5 || k === 6;
      const jz = edge ? 0 : (n2(x / 110, k * 3.1) - 0.5) * 60 + (rnd() - 0.5) * 10;
      const jy = edge || fy < 0 ? 0 : (n2(x / 90, k * 5.7) - 0.5) * 26;
      const y = fy < 0 ? fy * 200 : fy * elev * e + jy * e;
      const o = (i * P + k) * 3;
      cliffPos.set([x, y, z + jz], o);
      cc.copy(lo).lerp(hi, Math.max(0, fy)).multiplyScalar(0.85 + rnd() * 0.3);
      cliffCol.set([cc.r, cc.g, cc.b], o);
    });
  });
  const cliffIdx = [];
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let k = 0; k < P - 1; k += 1) {
      if (k === 5) continue; // the top is its own (textured) surface
      const a = i * P + k;
      const b = a + 1;
      const c = a + P;
      const d = c + 1;
      cliffIdx.push(a, b, c, b, d, c);
    }
  }
  const cliffGeo = new THREE.BufferGeometry();
  cliffGeo.setAttribute('position', new THREE.BufferAttribute(cliffPos, 3));
  cliffGeo.setAttribute('color', new THREE.BufferAttribute(cliffCol, 3));
  cliffGeo.setIndex(cliffIdx);
  cliffGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(cliffGeo, lambert(0xffffff, { vertexColors: true, flatShading: true, side: THREE.DoubleSide })));

  const hex = keep(hexTexture(anisotropy));
  const topPos = [];
  const topUv = [];
  const topIdx = [];
  xs.forEach((x, i) => {
    const y = elev * env(x);
    topPos.push(x, y, -150, x, y, 165);
    topUv.push(x / 74, -150 / 64, x / 74, 165 / 64);
    if (i < xs.length - 1) topIdx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  });
  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.Float32BufferAttribute(topPos, 3));
  topGeo.setAttribute('uv', new THREE.Float32BufferAttribute(topUv, 2));
  topGeo.setIndex(topIdx);
  topGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(topGeo, lambert(0xffffff, { map: hex, side: THREE.DoubleSide })));

  // lava falls pouring off both cliffs
  [0.16, 0.41, 0.66, 0.9].forEach((t, k) => {
    [-1, 1].forEach((side) => {
      const x = W * t + (side > 0 ? 260 : 0) + k * 30;
      const prof = side < 0 ? PROFILE.slice(0, 6).reverse() : PROFILE.slice(6);
      const pts = prof.map(([z, fy]) => [x, Math.max(0.8, fy * elev), z + side * (fy > 0.95 ? 6 : 18)]);
      scene.add(new THREE.Mesh(ribbon(pts, 30, { uvScale: 0.35, widthAt: (u) => 0.7 + u * 0.9 }), lavaMat));
      const pool = new THREE.Mesh(new THREE.CircleGeometry(48, 24), lakeMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x, 0.5, prof[prof.length - 1][0] + side * 30);
      scene.add(pool);
    });
  });

  // ── basalt column clusters ──
  const colCount = hiRes ? 1400 : 800;
  const cols = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6), lambert(0xffffff, { flatShading: true }), colCount);
  let ci = 0;
  const colTone = new THREE.Color();
  while (ci < colCount) {
    const side = rnd() < 0.5 ? -1 : 1;
    const cx = X0 + 400 + rnd() * (X1 - X0 - 800);
    const cz = side * (420 + rnd() * 1700);
    const peak = 60 + rnd() * 220;
    const r = 9 + rnd() * 6;
    const n = 8 + Math.floor(rnd() * 26);
    for (let k = 0; k < n && ci < colCount; k += 1) {
      const ring = Math.floor(Math.sqrt(k));
      const a = rnd() * Math.PI * 2;
      const x = cx + Math.cos(a) * ring * r * 1.8;
      const z = cz + Math.sin(a) * ring * r * 1.8;
      const h = Math.max(12, peak * (1 - ring * 0.18) * (0.75 + rnd() * 0.4));
      m4.compose(v3.set(x, h / 2, z), q.setFromAxisAngle(s3.set(0, 1, 0), rnd()), s3.set(r, h, r));
      cols.setMatrixAt(ci, m4);
      const v = 0.12 + rnd() * 0.07;
      cols.setColorAt(ci, colTone.setRGB(v * 1.25, v * 0.9, v * 0.85));
      ci += 1;
    }
  }
  scene.add(cols);

  // ── volcanoes ──
  const rockLo = new THREE.Color(0x3d271f);
  const rockHi = new THREE.Color(0x1a100e);
  const volcano = (x, z, R, H, cr, streams) => {
    const g = new THREE.CylinderGeometry(cr, R, H, 44, 14, true);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const surf = (cx, cz, y) => 1 + (n3(cx * 1.6, cz * 1.6, y / 260) - 0.5) * 0.28;
    for (let i = 0; i < pos.count; i += 1) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      const rr = Math.hypot(px, pz) || 1;
      const s = surf(px / rr, pz / rr, py);
      pos.setXYZ(i, px * s, py, pz * s);
      const t = (py + H / 2) / H;
      cc.copy(rockLo).lerp(rockHi, t).multiplyScalar(0.85 + n2(i * 0.7, 2) * 0.3);
      col.set([cc.r, cc.g, cc.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, lambert(0xffffff, { vertexColors: true, flatShading: true }));
    m.position.set(x, H / 2 - 4, z);
    scene.add(m);
    // crater pool
    const poolMesh = new THREE.Mesh(new THREE.CircleGeometry(cr * 0.92, 32), lakeMat);
    poolMesh.rotation.x = -Math.PI / 2;
    poolMesh.position.set(x, H - 30, z);
    scene.add(poolMesh);
    // lava streams down the flanks (they follow the jittered surface)
    for (let k = 0; k < streams; k += 1) {
      const a0 = rnd() * Math.PI * 2;
      const len = 0.45 + rnd() * 0.55;
      const pts = [];
      for (let t = 0; t <= len; t += 0.02) {
        const a = a0 + Math.sin(t * 9 + k) * 0.05;
        const y = H * (1 - t) - H / 2;
        const rr = (cr + (R - cr) * t) * surf(Math.cos(a), Math.sin(a), y) + 6;
        pts.push([x + Math.cos(a) * rr, y + H / 2 - 4, z + Math.sin(a) * rr]);
      }
      scene.add(new THREE.Mesh(ribbon(pts, 20 + R * 0.015, { uvScale: 0.2, widthAt: (u) => 0.5 + u * 1.2 }), lavaMat));
    }
    return { x, y: H - 30, z, cr };
  };
  const main = volcano(W * 0.58, -3050, 2100, 1900, 260, 7);
  [
    [W * 0.12, 2650, 1500, 1150, 200, 4],
    [W * 0.95, 2950, 1700, 1300, 220, 5],
    [-1900, -2700, 1300, 900, 170, 3],
    [W + 2500, -2300, 1400, 1050, 180, 3],
    [W * 0.36, 4300, 2100, 1550, 240, 3],
    [W * 0.15, -4800, 2300, 1500, 250, 2],
    [W * 0.82, 5200, 2400, 1700, 260, 2],
  ].forEach((v) => volcano(...v));

  // eruption: a fountain of lava sparks over the main crater
  const SPARKS = hiRes ? 700 : 360;
  const spPos = new Float32Array(SPARKS * 3);
  const spCol = new Float32Array(SPARKS * 3);
  const spVel = new Float32Array(SPARKS * 3);
  const spawn = (k, scatter) => {
    const a = rnd() * Math.PI * 2;
    const rr = rnd() * main.cr * 0.6;
    spPos.set([main.x + Math.cos(a) * rr, main.y + (scatter ? rnd() * 900 : 0), main.z + Math.sin(a) * rr], k * 3);
    const h = 60 + rnd() * 160;
    spVel.set([Math.cos(a) * h, 380 + rnd() * 380, Math.sin(a) * h], k * 3);
  };
  for (let k = 0; k < SPARKS; k += 1) spawn(k, true);
  const spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  spGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
  const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 34, vertexColors: true }));
  sparks.frustumCulled = false;
  scene.add(sparks);
  const hot = new THREE.Color(0xffe08a);
  const warm = new THREE.Color(0xff6a1c);
  const cool = new THREE.Color(0x8a1f0c);

  // smoke plume above the main crater
  const puffGeo = jitter(new THREE.IcosahedronGeometry(1, 1), 0.25, rnd);
  const puffs = Array.from({ length: 34 }, (_, k) => {
    const mat = lambert(k % 3 ? 0x2b201d : 0x3a2b26, { flatShading: true, transparent: true, depthWrite: false });
    const p = new THREE.Mesh(puffGeo, mat);
    scene.add(p);
    return { p, mat, age: k / 34, sx: (rnd() - 0.5) * 300, sz: (rnd() - 0.5) * 300, life: 18 + rnd() * 8 };
  });
  const placePuffs = (dt) => {
    puffs.forEach((pf) => {
      pf.age = (pf.age + dt / pf.life) % 1;
      const a = pf.age;
      pf.p.position.set(main.x + pf.sx * a + a * a * 1300, main.y + 80 + a * 2100, main.z + pf.sz * a + a * 500);
      pf.p.scale.setScalar(110 + a * 520);
      pf.p.rotation.y = a * 2 + pf.sx;
      pf.mat.opacity = Math.min(1, a * 8) * (1 - sstep(0.7, 1, a)) * 0.95;
    });
  };
  placePuffs(0);

  // lightning inside the plume
  const boltGeo = new THREE.BufferGeometry();
  boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 6), 3));
  const bolt = new THREE.LineSegments(boltGeo, new THREE.LineBasicMaterial({ color: 0xfff1d6 }));
  bolt.visible = false;
  bolt.frustumCulled = false;
  scene.add(bolt);
  const strike = () => {
    const arr = boltGeo.attributes.position.array;
    let x = main.x + 200 + rnd() * 700;
    let y = main.y + 1300 + rnd() * 500;
    let z = main.z + 150 + rnd() * 300;
    for (let k = 0; k < 16; k += 1) {
      const nx = x + (rnd() - 0.5) * 140;
      const ny = y - 40 - rnd() * 70;
      const nz = z + (rnd() - 0.5) * 80;
      arr.set([x, y, z, nx, ny, nz], k * 6);
      x = nx; y = ny; z = nz;
    }
    boltGeo.attributes.position.needsUpdate = true;
  };
  let nextStrike = 3;
  let boltOff = 0;

  // ── fire on the ridge: torches along both edges + timed fire jets ──
  const torchXs = [];
  for (let x = -120; x <= W + 140; x += 110) torchXs.push(x);
  const torchZ = [-141, 157];
  const tCount = torchXs.length * 2;
  const pedestal = new THREE.InstancedMesh(new THREE.CylinderGeometry(3.4, 5.2, 9, 6), lambert(0x241917, { flatShading: true }), tCount);
  const flameGeo = flameGeometry(rnd);
  const flameMat = flat(0xffffff, { vertexColors: true });
  const outer = new THREE.InstancedMesh(flameGeo, flameMat, tCount);
  outer.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const torches = [];
  torchXs.forEach((x) => torchZ.forEach((z) => {
    const y = elev * env(x);
    m4.makeTranslation(x, y + 4.5, z);
    pedestal.setMatrixAt(torches.length, m4);
    torches.push({ x, y: y + 9, z, ph: rnd() * 10 });
  }));
  scene.add(pedestal, outer);
  const placeTorches = (time) => {
    torches.forEach((t, k) => {
      const f = 1 + Math.sin(time * 13 + t.ph) * 0.18 + Math.sin(time * 29 + t.ph * 2) * 0.08;
      q.setFromAxisAngle(s3.set(0, 1, 0), time * 2.4 + t.ph);
      m4.compose(v3.set(t.x, t.y, t.z), q, s3.set(4 * (1.1 - f * 0.1), 15 * f, 4 * (1.1 - f * 0.1)));
      outer.setMatrixAt(k, m4);
    });
    outer.instanceMatrix.needsUpdate = true;
  };


  const jets = [0.06, 0.19, 0.31, 0.44, 0.56, 0.69, 0.81, 0.93].map((t, k) => {
    const x = W * t + 60;
    const z = k % 2 ? 150 : -134;
    const grp = new THREE.Group();
    grp.position.set(x, elev * env(x), z);
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(7, 10, 5, 8), lambert(0x1c1312, { flatShading: true }));
    vent.position.y = 2.5;
    grp.add(vent);
    const cones = [[0, 0, 9, 1], [5, 3, 5.5, 0.7], [-4, -3, 5, 0.62]].map(([ox, oz, r, h], i) => {
      const c = new THREE.Mesh(flameGeo, flameMat);
      c.position.set(ox, 5, oz);
      c.rotation.y = i * 2.1;
      grp.add(c);
      return { c, r, h };
    });
    scene.add(grp);
    return { cones, ph: k * 0.73, period: 4.2 + (k % 3) * 0.9 };
  });
  const placeJets = (time, calm) => {
    jets.forEach((j) => {
      const u = (((time + j.ph * j.period) % j.period) + j.period) % j.period;
      const burst = calm ? 0.12 : (u < 1.7 ? Math.sin((u / 1.7) * Math.PI) ** 0.6 : 0);
      const f = 1 + Math.sin(time * 17 + j.ph * 5) * 0.12;
      j.cones.forEach(({ c, r, h }) => {
        const H = (8 + burst * 150) * h * f;
        c.scale.set(r * (0.6 + burst * 0.6), Math.max(0.01, H), r * (0.6 + burst * 0.6));
      });
    });
  };

  // ── ash clouds, lit orange from below by the lava ──
  const cloudGeos = [];
  for (let k = 0; k < 7; k += 1) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(1.4, 0.55, 1);
    g.translate((rnd() - 0.5) * 2.6, (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 1.6);
    cloudGeos.push(jitter(g, 0.2, rnd));
  }
  const cloudGeo = mergeGeometries(cloudGeos);
  cloudGeos.forEach((g) => g.dispose());
  const clouds = Array.from({ length: 24 }, () => {
    const c = new THREE.Mesh(cloudGeo, lambert(0x2a1814, { flatShading: true }));
    c.position.set(X0 + rnd() * (X1 - X0), 1500 + rnd() * 800, (rnd() - 0.5) * 7000);
    c.scale.setScalar(220 + rnd() * 260);
    c.rotation.y = rnd() * Math.PI;
    scene.add(c);
    return { c, v: 4 + rnd() * 6 };
  });

  // ── air: embers rising, ash falling ──
  const embers = driftField(scene, rnd, {
    count: hiRes ? 1100 : 600,
    box: [1600, 900, 1600],
    vel: [7, 24, 3],
    size: 2.8,
    palette: [0xffb347, 0xff7a2a, 0xffd27a, 0xff5a1f],
  });
  const ash = driftField(scene, rnd, {
    count: hiRes ? 420 : 220,
    box: [1400, 800, 1400],
    vel: [5, -9, 2],
    size: 2.2,
    opacity: 0.8,
    palette: [0x8a7d78, 0x5c524e, 0x6f6460],
  });

  // ── sky: a smoky dome, a few dim stars, a blood moon ──
  const sky = new THREE.Group();
  sky.add(starDome(rnd, { count: 240, opacity: 0.35, palette: [0xffd9c7, 0xffc0a0] }));
  const moon = skyDisc(sunDir, 8600, 330, 0xb8452a);
  sky.add(moon);
  [[-80, 60, 70], [90, -50, 46], [30, 120, 30], [-60, -120, 34]].forEach(([cx, cy, r]) => {
    const cr = new THREE.Mesh(new THREE.CircleGeometry(r, 24), flat(0x9a3822, { fog: false }));
    cr.position.set(cx, cy, 1);
    moon.add(cr);
  });
  scene.add(sky);

  const baseHemi = hemi.intensity;
  let last = 0;
  placeTorches(0);
  placeJets(0, false);
  return {
    sky,
    tick(time, calm, cam) {
      const dt = Math.min(0.1, Math.max(0, time - last));
      last = time;
      lava.offset.y -= dt * 0.12;
      lakeTex.offset.y -= dt * 0.03;
      placeJets(time, calm);
      if (calm) {
        hemi.intensity = baseHemi;
        return;
      }
      placeTorches(time);
      placePuffs(dt);
      clouds.forEach((c) => { c.c.position.x += c.v * dt; });
      embers.tick(time, cam);
      ash.tick(time, cam);
      // sparks: ballistic, re-born in the crater
      for (let k = 0; k < SPARKS; k += 1) {
        const o = k * 3;
        spVel[o + 1] -= 260 * dt;
        spPos[o] += spVel[o] * dt;
        spPos[o + 1] += spVel[o + 1] * dt;
        spPos[o + 2] += spVel[o + 2] * dt;
        if (spPos[o + 1] < main.y - 500) spawn(k, false);
        const hgt = clamp(spPos[o + 1] - main.y, 0, 900) / 900;
        const c = spVel[o + 1] > 0 ? cc.copy(hot).lerp(warm, hgt) : cc.copy(warm).lerp(cool, 1 - hgt);
        spCol.set([c.r, c.g, c.b], o);
      }
      spGeo.attributes.position.needsUpdate = true;
      spGeo.attributes.color.needsUpdate = true;
      // lightning
      if (time > nextStrike) {
        strike();
        bolt.visible = true;
        boltOff = time + 0.09 + rnd() * 0.08;
        nextStrike = time + 3 + rnd() * 6;
      }
      if (bolt.visible && time > boltOff) bolt.visible = false;
      // the lava light breathes
      hemi.intensity = baseHemi * (1 + Math.sin(time * 2.1) * 0.05 + Math.sin(time * 5.3) * 0.03) + (bolt.visible ? 0.35 : 0);
    },
    dispose() {
      textures.forEach((t) => t.dispose());
    },
  };
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
