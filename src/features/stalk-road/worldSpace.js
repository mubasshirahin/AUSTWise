import * as THREE from 'three';
import { mulberry } from './coasterTrack';
import {
  flat, lambert, noise3, fbm, canvasTex, starDome, skyDisc, driftField, jitter,
} from './fppKit';

/* ─── Mohakash: an orbital station above a blue planet ───
   The coaster rides on a long truss station: deck plates, a lower truss,
   hanging habitat modules, solar wings and a slowly turning ring habitat.
   Far below, a planet with oceans, continents and clouds turns; the sky
   holds a ringed gas giant, a small moon, a dense star field with a Milky
   Way band and nebula clouds, drifting asteroids, shuttles and meteors. */

function planetTexture(w, h, seed) {
  const n = fbm(noise3(seed), 4);
  const c = fbm(noise3(seed + 7), 2);
  return canvasTex(w, h, (ctx) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y += 1) {
      const lat = (y / (h - 1) - 0.5) * Math.PI;
      const cl = Math.cos(lat);
      const sl = Math.sin(lat);
      const polar = Math.abs(lat) / (Math.PI / 2);
      for (let x = 0; x < w; x += 1) {
        const lon = (x / w) * Math.PI * 2;
        const px = cl * Math.cos(lon) * 1.7;
        const pz = cl * Math.sin(lon) * 1.7;
        const py = sl * 1.7;
        const v = n(px + 9, py + 9, pz + 9);
        let r; let g; let b;
        if (v > 0.53) {
          const t = Math.min(1, (v - 0.53) / 0.2);
          const dry = c(px * 2 + 3, py * 2, pz * 2) > 0.55 || polar < 0.28;
          if (dry) { r = 176 - t * 40; g = 150 - t * 40; b = 96 - t * 30; } else { r = 70 - t * 18; g = 118 - t * 30; b = 58 - t * 14; }
          if (t > 0.75) { r = 132; g = 120; b = 104; }
        } else {
          const t = Math.max(0, (0.53 - v) / 0.25);
          r = 34 - t * 18; g = 92 - t * 46; b = 160 - t * 50;
          if (v > 0.5) { r = 58; g = 128; b = 178; }
        }
        if (polar > 0.8 + (v - 0.5) * 0.3) { r = 236; g = 242; b = 246; }
        const o = (y * w + x) * 4;
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, { aniso: 8 });
}

function cloudTexture(w, h, seed) {
  const n = fbm(noise3(seed), 4);
  return canvasTex(w, h, (ctx) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y += 1) {
      const lat = (y / (h - 1) - 0.5) * Math.PI;
      const cl = Math.cos(lat);
      for (let x = 0; x < w; x += 1) {
        const lon = (x / w) * Math.PI * 2;
        const v = n(cl * Math.cos(lon) * 2.6 + 4, Math.sin(lat) * 5.2, cl * Math.sin(lon) * 2.6);
        const a = v > 0.56 ? Math.min(1, (v - 0.56) / 0.12) : 0;
        const o = (y * w + x) * 4;
        img.data[o] = 255;
        img.data[o + 1] = 255;
        img.data[o + 2] = 255;
        img.data[o + 3] = a * 235;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, { aniso: 8 });
}

function gasGiantTexture() {
  return canvasTex(512, 256, (ctx, w, h) => {
    const rnd = mulberry(77);
    const bands = ['#d9b98c', '#c7955f', '#e8d3ac', '#b07a4a', '#dcc09a', '#a86f44', '#efe0c2', '#c49464'];
    let y = 0;
    while (y < h) {
      const bh = 6 + rnd() * 22;
      ctx.fillStyle = bands[Math.floor(rnd() * bands.length)];
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x / 40 + y) * 2.2);
      for (let x = w; x >= 0; x -= 16) ctx.lineTo(x, y + bh + Math.sin(x / 34 + y) * 2.2);
      ctx.fill();
      y += bh;
    }
    ctx.fillStyle = '#b5552f';
    ctx.beginPath();
    ctx.ellipse(w * 0.62, h * 0.64, 26, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d57a4a';
    ctx.beginPath();
    ctx.ellipse(w * 0.62, h * 0.64, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }, { aniso: 8 });
}

function ringTexture() {
  return canvasTex(512, 4, (ctx, w, h) => {
    const rnd = mulberry(12);
    for (let x = 0; x < w; x += 1) {
      const gap = (x > 300 && x < 318) || (x > 120 && x < 126);
      const a = gap ? 0.05 : 0.35 + rnd() * 0.45;
      const v = 190 + rnd() * 50;
      ctx.fillStyle = `rgba(${v},${v - 18},${v - 46},${a})`;
      ctx.fillRect(x, 0, 1, h);
    }
  }, { aniso: 8 });
}

function solarTexture() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c9ced8';
    ctx.fillRect(0, 0, w, h);
    const cells = 8;
    const cs = (w - 12) / cells;
    for (let j = 0; j < cells; j += 1) {
      for (let i = 0; i < cells; i += 1) {
        ctx.fillStyle = (i + j) % 3 ? '#1b2c52' : '#21365f';
        ctx.fillRect(6 + i * cs + 1.5, 6 + j * cs + 1.5, cs - 3, cs - 3);
        ctx.fillStyle = '#2d4677';
        ctx.fillRect(6 + i * cs + 1.5, 6 + j * cs + cs / 2, cs - 3, 1);
      }
    }
  }, { aniso: 8 });
}

export function buildSpaceWorld({
  scene, width: W, accent, anisotropy = 8, hiRes = true, sunDir,
}) {
  const rnd = mulberry(9191);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const textures = [];
  const keep = (t) => { t.anisotropy = Math.min(anisotropy, t.anisotropy); textures.push(t); return t; };
  const SX0 = -420;
  const SX1 = W + 420;
  const LEN = SX1 - SX0;
  const MID = (SX0 + SX1) / 2;

  // ── the station truss under the track ──
  const hull = lambert(0xb9c0cc);
  const darkHull = lambert(0x4a5366);
  const plateMat = lambert(0x3a4357);
  [-112, 15, 142].forEach((z) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(LEN, 6, 6), hull);
    beam.position.set(MID, -4, z);
    scene.add(beam);
  });
  const low = new THREE.Mesh(new THREE.BoxGeometry(LEN, 7, 7), hull);
  low.position.set(MID, -78, 15);
  scene.add(low);
  const crossN = Math.floor(LEN / 60) + 1;
  const cross = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 4, 260), darkHull, crossN);
  const plates = new THREE.InstancedMesh(new THREE.BoxGeometry(54, 1.5, 116), plateMat, crossN * 2);
  let pc = 0;
  const braces = [];
  for (let k = 0; k < crossN; k += 1) {
    const x = SX0 + k * 60;
    m4.makeTranslation(x, -4, 15);
    cross.setMatrixAt(k, m4);
    if (k < crossN - 1 && (k % 5 !== 2)) {
      [-50, 80].forEach((z) => {
        m4.makeTranslation(x + 30, -2, z);
        plates.setMatrixAt(pc, m4);
        pc += 1;
      });
    }
    // triangular truss: top beams to the lower spine
    braces.push(x, -4, -112, x + 30, -78, 15, x + 30, -78, 15, x + 60, -4, -112);
    braces.push(x, -4, 142, x + 30, -78, 15, x + 30, -78, 15, x + 60, -4, 142);
    braces.push(x, -4, -112, x + 60, -4, 142);
  }
  plates.count = pc;
  scene.add(cross, plates);
  const braceGeo = new THREE.BufferGeometry();
  braceGeo.setAttribute('position', new THREE.Float32BufferAttribute(braces, 3));
  scene.add(new THREE.LineSegments(braceGeo, new THREE.LineBasicMaterial({ color: 0x7d879b })));

  // habitat modules hanging under the truss
  const modGeo = new THREE.CylinderGeometry(26, 26, 170, 24, 1);
  modGeo.rotateZ(Math.PI / 2);
  const capGeo = new THREE.SphereGeometry(26, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const bandGeo = new THREE.TorusGeometry(26.6, 1.6, 6, 32);
  bandGeo.rotateY(Math.PI / 2);
  const winGeo = new THREE.BoxGeometry(5, 3, 0.6);
  const winWarm = flat(0xffd89a);
  const winCool = flat(0x9fdcff);
    for (let x = SX0 + 260, k = 0; x < SX1 - 200; x += 540, k += 1) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(modGeo, k % 3 ? hull : lambert(0xd9dde4)));
    [-1, 1].forEach((s) => {
      const cap = new THREE.Mesh(capGeo, hull);
      cap.rotation.z = -s * Math.PI / 2;
      cap.position.x = s * 85;
      g.add(cap);
    });
    [-60, -20, 20, 60].forEach((bx) => {
      const b = new THREE.Mesh(bandGeo, darkHull);
      b.position.x = bx;
      g.add(b);
    });
    for (let w = -70; w <= 70; w += 10) {
      [-1, 1].forEach((s) => {
        const win = new THREE.Mesh(winGeo, (w / 10 + k) % 4 ? winWarm : winCool);
        win.position.set(w, 6, s * 25.8);
        g.add(win);
      });
    }
    const strut = new THREE.Mesh(new THREE.BoxGeometry(6, 40, 6), darkHull);
    strut.position.y = 36;
    g.add(strut);
    g.position.set(x, -118, k % 2 ? -40 : 70);
    scene.add(g);
  }

  // solar wings on arms out to both sides
  const solar = keep(solarTexture());
  const panelMat = lambert(0xffffff, { map: solar, side: THREE.DoubleSide });
  const panelGeo = new THREE.BoxGeometry(150, 1.2, 210);
  const armMat = lambert(0x8f98aa);
  const navLights = [];
  for (let x = SX0 + 520, k = 0; x < SX1 - 200; x += 760, k += 1) {
    [-1, 1].forEach((s) => {
      const reach = 520 + (k % 2) * 220;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(5, 5, reach), armMat);
      arm.position.set(x, -20, s * (reach / 2 + 140));
      scene.add(arm);
      [0.45, 0.85].forEach((t) => {
        const p = new THREE.Mesh(panelGeo, panelMat);
        p.position.set(x, -20, s * (140 + reach * t));
        p.rotation.z = 0.55;
        scene.add(p);
      });
      navLights.push({ pos: [x, -20, s * (140 + reach + 6)], red: s < 0 });
    });
  }
  // nav lights at the wing tips and along the beams
  for (let x = SX0; x <= SX1; x += 240) {
    navLights.push({ pos: [x, -1, -116], red: true }, { pos: [x, -1, 146], red: false });
  }
  const navGeo = new THREE.SphereGeometry(2.4, 8, 6);
  const redMat = flat(0xff4d5e);
  const greenMat = flat(0x4dff9a);
  const redIm = new THREE.InstancedMesh(navGeo, redMat, navLights.length);
  const greenIm = new THREE.InstancedMesh(navGeo, greenMat, navLights.length);
  let rc = 0;
  let gc = 0;
  navLights.forEach((nl) => {
    m4.makeTranslation(...nl.pos);
    if (nl.red) { redIm.setMatrixAt(rc, m4); rc += 1; } else { greenIm.setMatrixAt(gc, m4); gc += 1; }
  });
  redIm.count = rc;
  greenIm.count = gc;
  scene.add(redIm, greenIm);
  const redOn = new THREE.Color(0xff4d5e);
  const greenOn = new THREE.Color(0x4dff9a);
  const offCol = new THREE.Color(0x2a2f3a);

  // ── a ring habitat turning beside the station ──
  const ringHab = new THREE.Group();
  ringHab.add(new THREE.Mesh(new THREE.TorusGeometry(700, 36, 18, 140), lambert(0xd3d8e0)));
  ringHab.add(new THREE.Mesh(new THREE.TorusGeometry(700, 38, 4, 140, Math.PI * 2), darkHull));
  ringHab.children[1].scale.set(1, 1, 0.35);
  for (let k = 0; k < 6; k += 1) {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 700, 8), hull);
    sp.rotation.z = (k / 6) * Math.PI;
    sp.scale.y = 2;
    ringHab.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(70, 70, 120, 24), lambert(0xc4cad4));
  hub.rotation.x = Math.PI / 2;
  ringHab.add(hub);
  const ringWins = [];
  for (let k = 0; k < 120; k += 1) {
    const a = (k / 120) * Math.PI * 2;
    ringWins.push(Math.cos(a) * 700, Math.sin(a) * 700, 38);
  }
  const rwGeo = new THREE.BufferGeometry();
  rwGeo.setAttribute('position', new THREE.Float32BufferAttribute(ringWins, 3));
  ringHab.add(new THREE.Points(rwGeo, new THREE.PointsMaterial({ color: 0xffe2a8, size: 7 })));
  ringHab.position.set(W * 0.46, 260, -1750);
  ringHab.rotation.y = 0.18;
  scene.add(ringHab);

  // ── the planet far below ──
  const big = hiRes;
  const pTex = keep(planetTexture(big ? 1024 : 512, big ? 512 : 256, 3));
  const cTex = keep(cloudTexture(big ? 768 : 512, big ? 384 : 256, 5));
  const PR = 14000;
  const planet = new THREE.Group();
  planet.position.set(MID, -16600, 2400);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(PR, 128, 80), lambert(0xffffff, { map: pTex }));
  const cloudShell = new THREE.Mesh(
    new THREE.SphereGeometry(PR * 1.006, 128, 80),
    lambert(0xffffff, { map: cTex, transparent: true, depthWrite: false }),
  );
  const air = new THREE.Mesh(
    new THREE.SphereGeometry(PR * 1.014, 96, 64),
    flat(0x7fb4ff, { transparent: true, opacity: 0.1, depthWrite: false }),
  );
  planet.add(globe, cloudShell, air);
  // pole axis lies sideways, so the rider looks down on oceans and continents
  planet.rotation.set(Math.PI / 2 - 0.4, 0.3, 0.2);
  scene.add(planet);

  // ── asteroids drifting around the station ──
  const ROCKS = hiRes ? 260 : 150;
  const rockGeo = jitter(new THREE.IcosahedronGeometry(1, 1), 0.38, rnd);
  const rocks = new THREE.InstancedMesh(rockGeo, lambert(0xffffff, { flatShading: true }), ROCKS);
  rocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const rockData = Array.from({ length: ROCKS }, (_, k) => {
    const side = k % 2 ? 1 : -1;
    const s = k % 23 === 0 ? 90 + rnd() * 80 : 5 + rnd() ** 2 * 45;
    const v = 0.36 + rnd() * 0.2;
    rocks.setColorAt(k, new THREE.Color(v * 1.08, v, v * 0.92));
    return {
      p: new THREE.Vector3(-2600 + rnd() * (W + 5200), -900 + rnd() * 2200, side * (650 + rnd() * 2800)),
      s: new THREE.Vector3(s * (0.8 + rnd() * 0.5), s * (0.7 + rnd() * 0.4), s),
      ax: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(),
      w: 0.05 + rnd() * 0.3,
      a0: rnd() * 6.3,
      drift: (rnd() - 0.5) * 6,
    };
  });
  const placeRocks = (time) => {
    rockData.forEach((r, k) => {
      q.setFromAxisAngle(r.ax, r.a0 + time * r.w);
      v3.copy(r.p);
      v3.x += r.drift * time;
      m4.compose(v3, q, r.s);
      rocks.setMatrixAt(k, m4);
    });
    rocks.instanceMatrix.needsUpdate = true;
  };
  placeRocks(0);
  scene.add(rocks);

  // ── shuttles crossing the view ──
  const shipGeo = (() => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(34, 8, 11), lambert(0xe3e7ee));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(5.5, 12, 8), lambert(0xe3e7ee));
    nose.rotation.z = -Math.PI / 2;
    nose.position.x = 23;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 34), lambert(0x6b7488));
    wing.position.x = -6;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(9, 9, 1.2), lambert(0x6b7488));
    fin.position.set(-13, 7, 0);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(4, 16, 8), flat(0x8fe3ff));
    flame.rotation.z = Math.PI / 2;
    flame.position.x = -25;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 4), flat(accent));
    tip.position.set(-13, 12, 0);
    g.add(body, nose, wing, fin, flame, tip);
    return g;
  })();
  const ships = [
    { z: -900, y: 300, v: 140, x0: 0 },
    { z: 1300, y: 560, v: -110, x0: W * 0.6 },
    { z: -2300, y: -260, v: 90, x0: W * 0.3 },
  ].map((s) => {
    const g = shipGeo.clone();
    if (s.v < 0) g.rotation.y = Math.PI;
    scene.add(g);
    return { ...s, g };
  });
  const span = W + 6000;
  const placeShips = (time) => {
    ships.forEach((s) => {
      const p = (((s.x0 + s.v * time) % span) + span) % span;
      s.g.position.set(-3000 + p, s.y + Math.sin(time * 0.4 + s.z) * 20, s.z);
    });
  };
  placeShips(0);

  // a little satellite tumbling near the track
  const sat = new THREE.Group();
  sat.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), lambert(0xd8b25a)));
  [-1, 1].forEach((s) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1, 9, 30), panelMat);
    p.position.z = s * 22;
    sat.add(p);
  });
  const dish = new THREE.Mesh(new THREE.ConeGeometry(7, 4, 16, 1, true), lambert(0xe6e9ee, { side: THREE.DoubleSide }));
  dish.position.y = 8;
  sat.add(dish);
  sat.position.set(W * 0.22, 420, 260);
  scene.add(sat);

  // space dust — tiny specks that stream past the rider
  const dust = driftField(scene, rnd, {
    count: hiRes ? 520 : 300, box: [1500, 900, 1500], vel: [0, 0.5, 0], wobble: 3,
    size: 1.7, opacity: 0.7, palette: [0xffffff, 0xcfdcff],
  });

  // ── sky: stars, Milky Way, nebulae, gas giant, moon, sun ──
  const sky = new THREE.Group();
  const starCols = [0xffffff, 0xdfe8ff, 0xbfd2ff, 0xfff1d8, 0xffd9b0];
  sky.add(starDome(rnd, { count: hiRes ? 3600 : 2200, radius: 13000, size: 1.2, opacity: 0.85, lower: 1, palette: starCols }));
  sky.add(starDome(rnd, { count: 520, radius: 12900, size: 2.1, opacity: 0.9, lower: 1, palette: starCols }));
  sky.add(starDome(rnd, { count: 70, radius: 12800, size: 3.2, opacity: 1, lower: 1, palette: starCols }));
  const bandAxis = [0.35, 1, 0.45];
  sky.add(starDome(rnd, {
    count: hiRes ? 5200 : 3000, radius: 13100, size: 1.1, opacity: 0.55, palette: [0xe8ecff, 0xd9d2ff, 0xffffff],
    band: { axis: bandAxis, width: 0.14 },
  }));
  const axis = new THREE.Vector3(...bandAxis).normalize();
  const bandQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
  const hazeNoise = noise3(31);
  const haze = (dir, dist, r, color, opacity) => {
    // an irregular soft-edged blob, not a perfect disc
    const g = new THREE.CircleGeometry(r, 36);
    const pos = g.attributes.position;
    const seed = rnd() * 50;
    for (let i = 1; i < pos.count; i += 1) {
      const a = Math.atan2(pos.getY(i), pos.getX(i));
      const k = 0.55 + hazeNoise(Math.cos(a) * 1.6 + seed, Math.sin(a) * 1.6, seed) * 0.8;
      pos.setXY(i, pos.getX(i) * k, pos.getY(i) * k * 0.7);
    }
    const m = new THREE.Mesh(g, flat(color, {
      transparent: true, opacity, depthWrite: false, fog: false,
    }));
    m.position.copy(dir).normalize().multiplyScalar(dist);
    m.lookAt(0, 0, 0);
    m.rotateZ(rnd() * Math.PI);
    sky.add(m);
  };
  for (let k = 0; k < 44; k += 1) {
    const u = rnd() * Math.PI * 2;
    v3.set(Math.cos(u), (rnd() - 0.5) * 0.12, Math.sin(u)).applyQuaternion(bandQ);
    haze(v3, 12600, 500 + rnd() * 900, k % 3 ? 0x8f8ad0 : 0x6f8fc8, 0.035);
  }
  [
    { dir: [-0.5, 0.55, 0.65], cols: [0x7a3fb0, 0xb04a8a, 0x5a3fc0] },
    { dir: [0.75, 0.2, 0.62], cols: [0x2f9fb0, 0x3f5fc0, 0x2f7fa0] },
  ].forEach((nb) => {
    const c = new THREE.Vector3(...nb.dir).normalize();
    for (let k = 0; k < 46; k += 1) {
      const spread = k < 10 ? 0.1 : 0.3;
      v3.copy(c).add(new THREE.Vector3((rnd() - 0.5) * spread, (rnd() - 0.5) * spread * 0.6, (rnd() - 0.5) * spread));
      haze(v3, 12300 - k * 4, 250 + rnd() * (k < 10 ? 700 : 1300), nb.cols[k % 3], 0.022 + rnd() * 0.03);
    }
  });

  const gDir = new THREE.Vector3(-0.62, 0.24, -0.75).normalize();
  const giant = new THREE.Group();
  giant.position.copy(gDir).multiplyScalar(11000);
  const giantTex = keep(gasGiantTexture());
  const giantBall = new THREE.Mesh(new THREE.SphereGeometry(2300, 64, 40), lambert(0xffffff, { map: giantTex, fog: false }));
  giant.add(giantBall);
  const ringGeo = new THREE.RingGeometry(3000, 5200, 160, 1);
  const rpos = ringGeo.attributes.position;
  const ruv = ringGeo.attributes.uv;
  for (let i = 0; i < rpos.count; i += 1) {
    const r = Math.hypot(rpos.getX(i), rpos.getY(i));
    ruv.setXY(i, (r - 3000) / 2200, 0.5);
  }
  const ringTex = keep(ringTexture());
  const ring = new THREE.Mesh(ringGeo, flat(0xffffff, {
    map: ringTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false,
  }));
  ring.rotation.x = Math.PI / 2 - 0.42;
  ring.rotation.y = 0.3;
  giant.add(ring);
  giant.rotation.z = 0.2;
  sky.add(giant);
  const moonTex = keep(canvasTex(256, 128, (ctx, w, h) => {
    const r2 = mulberry(4);
    ctx.fillStyle = '#9a9ca2';
    ctx.fillRect(0, 0, w, h);
    for (let k = 0; k < 60; k += 1) {
      ctx.fillStyle = r2() < 0.5 ? '#84868d' : '#aeb0b5';
      ctx.beginPath();
      ctx.arc(r2() * w, r2() * h, 2 + r2() * 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(420, 40, 24), lambert(0xffffff, { map: moonTex, fog: false }));
  moon.position.copy(gDir).multiplyScalar(11000).add(new THREE.Vector3(5200, 1900, 2600));
  sky.add(moon);
  sky.add(skyDisc(sunDir, 12000, 300, 0xfff8e7));

  // meteors: a streak every few seconds
  const metGeo = new THREE.BufferGeometry();
  metGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const metMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false });
  const meteor = new THREE.Line(metGeo, metMat);
  meteor.frustumCulled = false;
  sky.add(meteor);
  const met = { t0: -10, from: new THREE.Vector3(), dir: new THREE.Vector3(), next: 2 };
  const placeMeteor = (time) => {
    if (time > met.next) {
      met.t0 = time;
      met.next = time + 2.5 + rnd() * 4;
      met.from.set(rnd() - 0.5, 0.25 + rnd() * 0.6, rnd() - 0.5).normalize().multiplyScalar(11500);
      met.dir.set(rnd() - 0.5, -0.4 - rnd() * 0.3, rnd() - 0.5).normalize();
    }
    const a = (time - met.t0) / 0.9;
    if (a > 1) { metMat.opacity = 0; return; }
    const head = v3.copy(met.from).addScaledVector(met.dir, a * 2400);
    const arr = metGeo.attributes.position.array;
    arr.set([head.x, head.y, head.z, head.x - met.dir.x * 700, head.y - met.dir.y * 700, head.z - met.dir.z * 700]);
    metGeo.attributes.position.needsUpdate = true;
    metMat.opacity = Math.sin(a * Math.PI) * 0.9;
  };
  scene.add(sky);

  return {
    sky,
    tick(time, calm, cam) {
      if (calm) return;
      globe.rotation.y = time * 0.004;
      cloudShell.rotation.y = time * 0.006;
      giantBall.rotation.y = time * 0.02;
      ringHab.rotation.z = time * 0.05;
      sat.rotation.set(time * 0.2, time * 0.13, 0);
      placeRocks(time);
      placeShips(time);
      placeMeteor(time);
      dust.tick(time, cam);
      const on = Math.floor(time / 0.8) % 2 === 0;
      redMat.color.copy(on ? redOn : offCol);
      greenMat.color.copy(on ? offCol : greenOn);
    },
    dispose() {
      textures.forEach((t) => t.dispose());
      shipGeo.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    },
  };
}
