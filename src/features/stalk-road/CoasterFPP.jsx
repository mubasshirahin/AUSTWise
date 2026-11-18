import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GROUND, CAR_GAP, CAR_COUNT } from './coasterTrack';
import { buildCityWorld } from './nightCity';
import { buildFireWorld } from './worldFire';
import { buildForestWorld } from './worldForest';
import { buildSpaceWorld } from './worldSpace';

/* ─── Orbit Express — first-person (front seat) view ───
   The same procedural track as the side view, lifted into 3D:
     X = track x, Y = height above ground, Z = a gentle lateral sway plus a
     sideways shift through every loop (so the exit runs beside the entry).
   The scene owns no animation loop — StalkRoadScene calls api.render(L, …)
   from its frame loop, so scroll, auto ride, gates and panels stay shared
   with the side view. Flat materials only (house style: no bloom / glow);
   depth comes from fog, like the side view's atmospheric tones. */

const STEP = 3; // frame sampling along the track
const GAUGE = 6; // half distance between the rails
const HEART = 10; // heartline height — corkscrews roll around it
const EYE = 13; // rider's eye above the rail centre
const LOOP_SHIFT = 28;

/* Backgrounds the rider can pick. elev = height of the ground the supports
   stand on (city: a sky-deck ~110 floors up, 7 units per floor). */
const THEMES = {
  city: {
    elev: 770, sky: 0x070b14, fog: [900, 7600], far: 16000,
    hemi: [0x46587c, 0x080c15, 1.5], sun: [0xc8d4ff, 1.1], sunDir: [0.35, 0.5, -0.79],
    steel: 0x33405a, brace: 0x2a3650, footing: 0x3a4152, build: buildCityWorld,
  },
  fire: {
    elev: 230, sky: 0x1c0a07, fog: [700, 6400], far: 16000,
    hemi: [0x5a2a1c, 0xff6a2a, 1.35], sun: [0xff9a6a, 0.55], sunDir: [-0.45, 0.32, -0.83],
    steel: 0x3b2d2b, brace: 0x2e2220, footing: 0x2a1f1d, build: buildFireWorld,
  },
  forest: {
    elev: 0, sky: 0xa9cfe0, fog: [700, 9500], far: 16000,
    hemi: [0xe4f3ff, 0x4d6b35, 1.45], sun: [0xfff0d2, 1.7], sunDir: [0.42, 0.3, -0.86],
    steel: 0xe7e3d8, brace: 0xcfcabd, footing: 0x8f8a7e, build: buildForestWorld,
  },
  space: {
    elev: 0, sky: 0x02030a, fog: null, far: 42000,
    hemi: [0x3a4a70, 0x0a0a14, 0.75], sun: [0xffffff, 2.4], sunDir: [0.55, 0.38, -0.74],
    steel: 0x9aa4b8, brace: 0x6b7488, footing: 0x59627a, build: buildSpaceWorld,
  },
};
const UP = new THREE.Vector3(0, 1, 0);

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (t) => t * t * (3 - 2 * t);
const prefersCalm = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/* ── 3D frames (centre, tangent, up, right) sampled along the track ── */
function buildFrames(track, ELEV) {
  const { total, loopLens, rollSpans, endLen } = track;
  const zAt = (L) => {
    const env = smooth(clamp01((L - 380) / 520)) * smooth(clamp01((endLen - 260 - L) / 520));
    let z = 80 * Math.sin(L / 760) * env;
    loopLens.forEach(([a, b]) => {
      if (L >= b) z += LOOP_SHIFT;
      else if (L > a) z += LOOP_SHIFT * smooth((L - a) / (b - a));
    });
    return z;
  };
  const rollAt = (L) => {
    for (const [a, b, turns] of rollSpans) {
      if (L > a && L < b) return Math.PI * 2 * turns * smooth((L - a) / (b - a));
    }
    return 0;
  };
  const p3 = (L, out) => {
    const [x, y] = track.pointAt(L);
    return out.set(x, GROUND - y + ELEV, zAt(L));
  };

  const n = Math.ceil(total / STEP) + 1;
  const C = new Float32Array(n * 3);
  const T = new Float32Array(n * 3);
  const N = new Float32Array(n * 3);
  const B = new Float32Array(n * 3);
  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const n0 = new THREE.Vector3();
  const b = new THREE.Vector3();
  const nn = new THREE.Vector3();
  const nr = new THREE.Vector3();
  const br = new THREE.Vector3();
  for (let i = 0; i < n; i += 1) {
    const L = Math.min(total, i * STEP);
    p3(L, p);
    t.subVectors(p3(L + 1.5, pa), p3(L - 1.5, pb)).normalize();
    const a = track.angleAt(L);
    n0.set(Math.sin(a), Math.cos(a), 0); // the 2D "up" normal, flips through loops
    b.crossVectors(t, n0).normalize();
    nn.crossVectors(b, t).normalize();
    const th = rollAt(L);
    const c = Math.cos(th);
    const s = Math.sin(th);
    nr.copy(nn).multiplyScalar(c).addScaledVector(b, s);
    br.copy(b).multiplyScalar(c).addScaledVector(nn, -s);
    // roll around the heartline: rail centre = heart − rolled up × HEART
    p.addScaledVector(nn, HEART).addScaledVector(nr, -HEART);
    C.set([p.x, p.y, p.z], i * 3);
    T.set([t.x, t.y, t.z], i * 3);
    N.set([nr.x, nr.y, nr.z], i * 3);
    B.set([br.x, br.y, br.z], i * 3);
  }

  const frameAt = (len, o) => {
    const f = Math.max(0, Math.min(n - 1.001, len / STEP));
    const i = Math.floor(f);
    const k = f - i;
    const lerp = (arr, v) => v.set(
      arr[i * 3] + (arr[i * 3 + 3] - arr[i * 3]) * k,
      arr[i * 3 + 1] + (arr[i * 3 + 4] - arr[i * 3 + 1]) * k,
      arr[i * 3 + 2] + (arr[i * 3 + 5] - arr[i * 3 + 2]) * k,
    );
    lerp(C, o.c);
    lerp(T, o.t).normalize();
    lerp(N, o.n).normalize();
    lerp(B, o.b).normalize();
    return o;
  };
  return { n, C, T, N, B, zAt, frameAt };
}

const newFrame = () => ({ c: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), b: new THREE.Vector3() });

/* Sweep a 2D profile (u along right, v along up) along frames i0..i1 */
function sweep(fr, i0, i1, profile, closed = true) {
  const m = profile.length;
  const rings = i1 - i0 + 1;
  const pos = new Float32Array(rings * m * 3);
  const uv = new Float32Array(rings * m * 2);
  const { C, N, B } = fr;
  for (let r = 0; r < rings; r += 1) {
    const i = (i0 + r) * 3;
    for (let k = 0; k < m; k += 1) {
      const [u, v] = profile[k];
      const o = (r * m + k) * 3;
      pos[o] = C[i] + B[i] * u + N[i] * v;
      pos[o + 1] = C[i + 1] + B[i + 1] * u + N[i + 1] * v;
      pos[o + 2] = C[i + 2] + B[i + 2] * u + N[i + 2] * v;
      uv[(r * m + k) * 2] = k / Math.max(1, m - 1);
      uv[(r * m + k) * 2 + 1] = (r * STEP) / 4;
    }
  }
  const idx = [];
  const kMax = closed ? m : m - 1;
  for (let r = 0; r < rings - 1; r += 1) {
    for (let k = 0; k < kMax; k += 1) {
      const kk = (k + 1) % m;
      const a = r * m + k;
      const b2 = r * m + kk;
      const c = (r + 1) * m + k;
      const d = (r + 1) * m + kk;
      idx.push(a, c, b2, b2, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const ring = (cu, cv, r, sides) => Array.from({ length: sides }, (_, k) => {
  const a = (k / sides) * Math.PI * 2;
  return [cu + Math.cos(a) * r, cv + Math.sin(a) * r];
});

/* Flat sign: dark card, 1px-style accent border, light text */
function signTexture(over, title, accent, w = 512, h = 160) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0c101a';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (over) {
    ctx.fillStyle = accent;
    ctx.font = '700 26px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(over, w / 2, h * 0.3);
  }
  ctx.fillStyle = '#e8eef8';
  let size = 60;
  ctx.font = `800 ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
  while (ctx.measureText(title).width > w - 60 && size > 24) {
    size -= 4;
    ctx.font = `800 ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
  }
  ctx.fillText(title, w / 2, over ? h * 0.64 : h / 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function chainTexture() {
  const cv = document.createElement('canvas');
  cv.width = 8;
  cv.height = 32;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#141b29';
  ctx.fillRect(0, 0, 8, 32);
  ctx.fillStyle = '#c7d0df';
  ctx.fillRect(0, 4, 8, 10);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    mats.forEach((m) => {
      if (m.map) m.map.dispose();
      m.dispose();
    });
  });
}

export default function CoasterFPP({ track, accent, labels, apiRef, theme = 'city' }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const calm = prefersCalm();
    const th = THEMES[theme] || THEMES.city;
    const ELEV = th.elev;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: th.far > 20000,
      });
    } catch {
      return undefined;
    }
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
    renderer.setClearColor(th.sky, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(th.sky);
    if (th.fog) scene.fog = new THREE.Fog(th.sky, th.fog[0], th.fog[1]);
    const camera = new THREE.PerspectiveCamera(68, 1, 0.3, th.far);
    scene.add(camera);

    const hemi = new THREE.HemisphereLight(...th.hemi);
    scene.add(hemi);
    const sunDir = new THREE.Vector3(...th.sunDir).normalize();
    const sun = new THREE.DirectionalLight(...th.sun);
    sun.position.copy(sunDir).multiplyScalar(1000);
    scene.add(sun);

    const accentCol = new THREE.Color(accent);
    const fr = buildFrames(track, ELEV);
    const last = fr.n - 1;

    // ── track ──
    const railMat = new THREE.MeshBasicMaterial({ color: accentCol });
    const spineMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(0x182133).lerp(accentCol, 0.34) });
    const steelMat = new THREE.MeshLambertMaterial({ color: th.steel });
    scene.add(new THREE.Mesh(sweep(fr, 0, last, ring(-GAUGE, 0, 0.9, 6)), railMat));
    scene.add(new THREE.Mesh(sweep(fr, 0, last, ring(GAUGE, 0, 0.9, 6)), railMat));
    scene.add(new THREE.Mesh(sweep(fr, 0, last, [[-1.8, -6.6], [1.8, -6.6], [1.8, -3.4], [-1.8, -3.4]]), spineMat));

    const tieEvery = 9;
    const tieCount = Math.floor(track.total / tieEvery);
    const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 1.1, GAUGE * 2 + 2.4), steelMat, tieCount);
    const webs = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 4.6, 1.3), steelMat, tieCount);
    const m4 = new THREE.Matrix4();
    const f = newFrame();
    const tmp = new THREE.Vector3();
    for (let k = 0; k < tieCount; k += 1) {
      fr.frameAt(k * tieEvery, f);
      m4.makeBasis(f.t, f.n, f.b).setPosition(tmp.copy(f.c).addScaledVector(f.n, -0.9));
      ties.setMatrixAt(k, m4);
      m4.setPosition(tmp.copy(f.c).addScaledVector(f.n, -3));
      webs.setMatrixAt(k, m4);
    }
    scene.add(ties, webs);

    // lift chain — a scrolling strip between the rails
    const [liftFrom, liftTo] = track.liftLens;
    const chainTex = chainTexture();
    const chainMat = new THREE.MeshBasicMaterial({ map: chainTex, side: THREE.DoubleSide });
    scene.add(new THREE.Mesh(
      sweep(fr, Math.floor(liftFrom / STEP), Math.ceil(liftTo / STEP), [[-1.3, 0.5], [1.3, 0.5]], false),
      chainMat,
    ));

    // supports + footings + lattice
    const pts = track.supportPts;
    const supports = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.9, 1.9, 1, 6), steelMat, pts.length);
    const footings = new THREE.InstancedMesh(new THREE.BoxGeometry(9, 3, 9), new THREE.MeshLambertMaterial({ color: th.footing }), pts.length);
    const braceVerts = [];
    let prev = null;
    pts.forEach((sp, k) => {
      const z = fr.zAt(sp.len);
      const h = Math.max(1, GROUND - sp.top);
      m4.makeScale(1, h, 1).setPosition(sp.x, ELEV + h / 2, z);
      supports.setMatrixAt(k, m4);
      m4.identity().setPosition(sp.x, ELEV + 1.5, z);
      footings.setMatrixAt(k, m4);
      if (prev && sp.x - prev.x > 20 && sp.x - prev.x < 70 && Math.min(h, prev.h) > 40) {
        const lo = Math.min(h, prev.h);
        braceVerts.push(prev.x, ELEV + lo, prev.z, sp.x, ELEV + 3, z, prev.x, ELEV + 3, prev.z, sp.x, ELEV + lo, z);
      }
      prev = { x: sp.x, h, z };
    });
    scene.add(supports, footings);
    const braceGeo = new THREE.BufferGeometry();
    braceGeo.setAttribute('position', new THREE.Float32BufferAttribute(braceVerts, 3));
    scene.add(new THREE.LineSegments(braceGeo, new THREE.LineBasicMaterial({ color: th.brace })));

    // place a flat object in a track frame: x along the track, y up, z right
    const placeAt = (obj, len, along = 0, up = 0, right = 0) => {
      fr.frameAt(len, f);
      obj.position.copy(f.c).addScaledVector(f.t, along).addScaledVector(f.n, up).addScaledVector(f.b, right);
      m4.makeBasis(f.t, f.n, f.b);
      obj.quaternion.setFromRotationMatrix(m4);
      return obj;
    };
    const facing = (obj, len, up, along = 0) => {
      // a plane that faces the oncoming rider
      fr.frameAt(len, f);
      obj.position.copy(f.c).addScaledVector(f.n, up).addScaledVector(f.t, along);
      m4.makeBasis(f.b, f.n, tmp.copy(f.t).negate());
      obj.quaternion.setFromRotationMatrix(m4);
      return obj;
    };

    // ── stations ──
    const deckMat = new THREE.MeshLambertMaterial({ color: 0x232c3e });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x1a2232 });
    const postMat = new THREE.MeshLambertMaterial({ color: 0x2a3650 });
    const bulbGeo = new THREE.SphereGeometry(1.1, 8, 6);
    const warmMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    const station = (centerLen, title, signLen) => {
      const grp = new THREE.Group();
      const deck = new THREE.Mesh(new THREE.BoxGeometry(270, 4, 30), deckMat);
      deck.position.set(0, -9, GAUGE + 19);
      grp.add(deck);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(290, 3, 74), roofMat);
      roof.position.set(0, 50, 10);
      grp.add(roof);
      [-130, -45, 45, 130].forEach((x) => {
        [-24, 44].forEach((z) => {
          const post = new THREE.Mesh(new THREE.BoxGeometry(3, 60, 3), postMat);
          post.position.set(x, 20, z);
          grp.add(post);
        });
      });
      for (let k = 0; k < 24; k += 1) {
        const bl = new THREE.Mesh(bulbGeo, k % 2 ? warmMat : railMat);
        bl.position.set(-140 + k * (280 / 23), 47.5, -26);
        grp.add(bl);
      }
      scene.add(placeAt(grp, centerLen));
      if (signLen < 0) return; // the rider starts under the departure roof
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(56, 17.5),
        new THREE.MeshBasicMaterial({ map: signTexture('', title, accent) }),
      );
      scene.add(facing(sign, signLen, 40));
    };
    station(160, 'ORBIT EXPRESS', -1);
    station(track.endLen - 20, 'ARRIVAL', track.endLen - 150);

    // ── checkpoint gates: the arch waits just ahead of the front seat ──
    const ahead = ((CAR_COUNT - 1) * CAR_GAP) / 2 + 150;
    const dimCol = new THREE.Color(0x5b667a);
    const passedCol = new THREE.Color(0x1c2536).lerp(accentCol, 0.6);
    const gates = track.gates.map((g, i) => {
      const at = g.len + ahead;
      const grp = new THREE.Group();
      const gateMat = new THREE.MeshLambertMaterial({ color: 0x2a3650 });
      fr.frameAt(at, f);
      const railY = f.c.y - ELEV; // gate legs stand on the deck
      [-1, 1].forEach((side) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(4, railY + 46, 4), gateMat);
        post.position.set(0, (46 - railY) / 2, side * 26);
        grp.add(post);
      });
      const beam = new THREE.Mesh(new THREE.BoxGeometry(3, 20, 56), gateMat);
      beam.position.set(0, 44, 0);
      grp.add(beam);
      const bulbMat = new THREE.MeshBasicMaterial({ color: dimCol.clone() });
      for (let k = 0; k < 14; k += 1) {
        const z = -24 + k * (48 / 13);
        [33.5, 54.5].forEach((y) => {
          const bl = new THREE.Mesh(bulbGeo, bulbMat);
          bl.position.set(-1.8, y, z);
          grp.add(bl);
        });
      }
      scene.add(placeAt(grp, at));
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(46, 14.4),
        new THREE.MeshBasicMaterial({ map: signTexture(`STOP ${i + 1}`, String(labels[i] || '').toUpperCase(), accent) }),
      );
      scene.add(facing(sign, at, 44, -2));
      return { at, bulbMat, state: '' };
    });

    // ── world: the picked background around the coaster ──
    const world = th.build({
      scene,
      width: track.width,
      accent: accentCol,
      elev: ELEV,
      zAt: fr.zAt,
      track,
      anisotropy: renderer.capabilities.getMaxAnisotropy(),
      hiRes: !small,
      small,
      sunDir,
      hemi,
      sun,
    });

    // ── rider rig (lives in camera space: −Z forward, +Y up) ──
    const rig = new THREE.Group();
    const shellMat = new THREE.MeshLambertMaterial({ color: accentCol });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x141b29 });
    const cowl = new THREE.Mesh(new THREE.BoxGeometry(20, 3, 13), shellMat);
    cowl.position.set(0, -11.2, -16);
    rig.add(cowl);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(20, 2.4, 6), shellMat);
    nose.position.set(0, -12.4, -24.5);
    nose.rotation.x = 0.35;
    rig.add(nose);
    const dash = new THREE.Mesh(new THREE.BoxGeometry(17, 1.2, 7), darkMat);
    dash.position.set(0, -9.4, -11);
    dash.rotation.x = -0.25;
    rig.add(dash);
    const barMat = new THREE.MeshLambertMaterial({ color: 0xc7d0df });
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 10, 8), barMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, -6.9, -11);
    rig.add(bar);
    [-5.5, 5.5].forEach((x) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4, 8), barMat);
      leg.position.set(x, -8.9, -11);
      rig.add(leg);
    });
    const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x3a4a6c });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xc9987a });
    const armGeo = new THREE.CylinderGeometry(0.38, 0.5, 1, 8);
    const handGeo = new THREE.SphereGeometry(0.75, 10, 8);
    const arms = [-1, 1].map((side) => {
      const arm = new THREE.Mesh(armGeo, sleeveMat);
      const hand = new THREE.Mesh(handGeo, skinMat);
      rig.add(arm, hand);
      return {
        arm,
        hand,
        shoulder: new THREE.Vector3(side * 6, -11.5, -3),
        rest: new THREE.Vector3(side * 3.2, -6.4, -11),
        upPos: new THREE.Vector3(side * 7.5, 1.6, -16),
        cur: new THREE.Vector3(side * 3.2, -6.4, -11),
      };
    });
    camera.add(rig);

    // ── per-frame ──
    const qTarget = new THREE.Quaternion();
    const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.1);
    const fwd = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const f2 = newFrame();
    const dir = new THREE.Vector3();
    let first = true;
    let time = 0;
    let fov = 68;
    let armsUp = 0;
    let baseFov = 68;
    let vw = 1;
    let vh = 1;

    const resize = (w, h, offX = 0, offY = 0) => {
      vw = Math.max(1, Math.round(w));
      vh = Math.max(1, Math.round(h));
      renderer.setSize(vw, vh, false);
      camera.aspect = vw / vh;
      // portrait screens keep a similar sideways view instead of a keyhole
      const vFromH = (2 * Math.atan(Math.tan((37 * Math.PI) / 180) / camera.aspect) * 180) / Math.PI;
      baseFov = Math.max(68, Math.min(90, vFromH));
      camera.setViewOffset(vw, vh, offX, offY, vw, vh);
      camera.updateProjectionMatrix();
    };
    resize(host.clientWidth, host.clientHeight);

    const render = (L, speed, dt) => {
      time += dt;
      const len = Math.max(0, Math.min(track.total - 1, L));
      fr.frameAt(len, f);
      fr.frameAt(len + 16, f2);
      fwd.copy(f.t).multiplyScalar(0.6).addScaledVector(f2.t, 0.4).normalize();
      right.crossVectors(fwd, f.n).normalize();
      up.crossVectors(right, fwd).normalize();
      m4.makeBasis(right, up, tmp.copy(fwd).negate());
      qTarget.setFromRotationMatrix(m4).multiply(qPitch);
      if (first) camera.quaternion.copy(qTarget);
      else camera.quaternion.slerp(qTarget, 1 - Math.exp(-dt * 16));

      const onLift = len > liftFrom && len < liftTo + 40;
      let amp = 0;
      if (!calm) {
        amp = (onLift && speed > 20 ? 0.12 : 0) + clamp01((speed - 300) / 700) * 0.32;
      }
      camera.position.copy(f.c).addScaledVector(f.n, EYE)
        .addScaledVector(right, Math.sin(time * 31) * amp)
        .addScaledVector(up, Math.sin(time * 23 + 1.3) * amp * 0.8);

      const fovGoal = calm ? baseFov : baseFov - 2 + clamp01((speed - 200) / 700) * 12;
      fov += (fovGoal - fov) * (first ? 1 : Math.min(1, dt * 4));
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      first = false;

      // hands: on the lapbar, or up when the train flies
      armsUp += ((speed > 340 ? 1 : 0) - armsUp) * Math.min(1, dt * 6);
      arms.forEach((a) => {
        a.cur.lerpVectors(a.rest, a.upPos, smooth(armsUp));
        if (!calm && armsUp > 0.5) a.cur.y += Math.sin(time * 9 + a.shoulder.x) * 0.25;
        a.hand.position.copy(a.cur);
        dir.subVectors(a.cur, a.shoulder);
        const l = dir.length();
        a.arm.position.copy(a.shoulder).addScaledVector(dir, 0.5);
        a.arm.scale.set(1, l, 1);
        a.arm.quaternion.setFromUnitVectors(UP, dir.normalize());
      });

      // gates light up as the front seat rolls in
      gates.forEach((g) => {
        const st = len > g.at + 20 ? 'passed' : (len > g.at - 300 ? 'near' : 'ahead');
        if (st !== g.state) {
          g.state = st;
          g.bulbMat.color.copy(st === 'near' ? accentCol : (st === 'passed' ? passedCol : dimCol));
        }
      });

      if (!calm) chainTex.offset.y -= dt * 1.6;
      world.tick(time, calm, camera.position);
      if (world.sky) world.sky.position.copy(camera.position);
      renderer.render(scene, camera);
    };

    apiRef.current = { render, resize, lay: -1 };

    return () => {
      apiRef.current = null;
      disposeScene(scene);
      chainTex.dispose();
      world.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [track, accent, labels, apiRef, theme]);

  return <div className="sr-fpp-canvas" ref={hostRef} />;
}
