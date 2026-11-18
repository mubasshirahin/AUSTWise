import * as THREE from 'three';

/* Shared bits for the first-person worlds (city, fire, forest, space).
   Everything is flat-coloured: no bloom, no glow — depth comes from fog
   and from the light/dark of plain Lambert shading. */

export const flat = (color, opts = {}) => new THREE.MeshBasicMaterial({ color, ...opts });
export const lambert = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const smooth = (t) => t * t * (3 - 2 * t);
export const sstep = (a, b, v) => smooth(clamp01((v - a) / (b - a)));

/* ── value noise (2D + 3D), deterministic per seed ── */
function hash(seed) {
  return (x, y, z = 0) => {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)
      + Math.imul(z | 0, 1440662683) + Math.imul(seed | 0, 144269504)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  };
}
export function noise2(seed = 1) {
  const h = hash(seed);
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = smooth(x - xi);
    const v = smooth(y - yi);
    const a = h(xi, yi);
    const b = h(xi + 1, yi);
    const c = h(xi, yi + 1);
    const d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
export function noise3(seed = 1) {
  const h = hash(seed);
  return (x, y, z) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const u = smooth(x - xi);
    const v = smooth(y - yi);
    const w = smooth(z - zi);
    const l = (a, b, t) => a + (b - a) * t;
    const x00 = l(h(xi, yi, zi), h(xi + 1, yi, zi), u);
    const x10 = l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u);
    const x01 = l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u);
    const x11 = l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u);
    return l(l(x00, x10, v), l(x01, x11, v), w);
  };
}
export function fbm(n, oct = 4) {
  // works for 2D and 3D noise (a 2D noise ignores z)
  return (x, y, z = 0) => {
    let s = 0;
    let a = 0.5;
    let f = 1;
    let norm = 0;
    for (let o = 0; o < oct; o += 1) {
      s += a * n(x * f, y * f, z * f);
      norm += a;
      a *= 0.5;
      f *= 2.03;
    }
    return s / norm;
  };
}

/* Jitter a geometry's vertices (shared positions move together, so the
   mesh stays closed) — the low-poly rock / mountain look */
export function jitter(geo, amt, rnd, keep = () => false) {
  const pos = geo.attributes.position;
  const seen = new Map();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (keep(x, y, z)) continue;
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let d = seen.get(key);
    if (!d) {
      d = [(rnd() - 0.5) * amt, (rnd() - 0.5) * amt, (rnd() - 0.5) * amt];
      seen.set(key, d);
    }
    pos.setXYZ(i, x + d[0], y + d[1], z + d[2]);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/* Paint a whole geometry one colour (for merged, vertex-coloured meshes) */
export function tint(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) col.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

export function canvasTex(w, h, draw, { repeat = false, aniso = 8, mips = true } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  if (!mips) {
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
  }
  return tex;
}

/* Stars on a dome (radius r) — sits in a sky group that follows the camera */
export function starDome(rnd, {
  count = 650, radius = 9000, size = 1.6, opacity = 0.6, lower = 0.1,
  palette = [0xdfe6f5], band = null,
} = {}) {
  const pos = [];
  const col = [];
  const cols = palette.map((c) => new THREE.Color(c));
  const v3 = new THREE.Vector3();
  const axis = band ? new THREE.Vector3(...band.axis).normalize() : null;
  for (let k = 0; k < count; k += 1) {
    if (axis) {
      // Milky-Way style: hug a great circle with a gaussian-ish spread
      const u = rnd() * Math.PI * 2;
      const spread = (rnd() + rnd() + rnd() - 1.5) * band.width;
      v3.set(Math.cos(u), spread, Math.sin(u)).normalize();
      v3.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis));
      v3.multiplyScalar(radius);
    } else {
      const u = rnd() * Math.PI * 2;
      const v = Math.acos(rnd() * (1 + lower) - lower);
      v3.set(Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)).multiplyScalar(radius);
    }
    pos.push(v3.x, v3.y, v3.z);
    const c = cols[Math.floor(rnd() * cols.length)];
    const b = 0.55 + rnd() * 0.45;
    col.push(c.r * b, c.g * b, c.b * b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    size, sizeAttenuation: false, fog: false, transparent: true, opacity, vertexColors: true, depthWrite: false,
  }));
}

/* A flat disc "at infinity" facing the origin of its (camera-following) group */
export function skyDisc(dir, dist, radius, color, segs = 48) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(radius, segs), flat(color, { fog: false }));
  m.position.copy(dir).normalize().multiplyScalar(dist);
  m.lookAt(0, 0, 0);
  return m;
}

/* Particles that hang in the air around the rider (embers, seeds, dust).
   They stay put in the world and wrap around the camera, so riding through
   them reads as motion. */
export function driftField(scene, rnd, {
  count = 700, box = [1400, 700, 1400], color = 0xffffff, size = 2, opacity = 0.9,
  vel = [0, 10, 0], wobble = 6, palette = null, attenuate = true,
} = {}) {
  const base = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  const phase = new Float32Array(count);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const cols = (palette || [color]).map((c) => new THREE.Color(c));
  for (let k = 0; k < count; k += 1) {
    base[k * 3] = rnd() * box[0];
    base[k * 3 + 1] = rnd() * box[1];
    base[k * 3 + 2] = rnd() * box[2];
    speed[k] = 0.5 + rnd();
    phase[k] = rnd() * Math.PI * 2;
    const c = cols[k % cols.length];
    col.set([c.r, c.g, c.b], k * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size, sizeAttenuation: attenuate, transparent: true, opacity, vertexColors: true, depthWrite: false,
  }));
  pts.frustumCulled = false;
  scene.add(pts);
  const wrap = (v, s) => ((v % s) + s) % s;
  const half = box.map((b) => b / 2);
  return {
    tick(time, cam) {
      if (!cam) return;
      for (let k = 0; k < count; k += 1) {
        const s = speed[k];
        const w = Math.sin(time * 0.8 * s + phase[k]) * wobble;
        const x = base[k * 3] + vel[0] * s * time + w;
        const y = base[k * 3 + 1] + vel[1] * s * time;
        const z = base[k * 3 + 2] + vel[2] * s * time + Math.cos(time * 0.6 * s + phase[k]) * wobble;
        pos[k * 3] = cam.x - half[0] + wrap(x - (cam.x - half[0]), box[0]);
        pos[k * 3 + 1] = cam.y - half[1] + wrap(y - (cam.y - half[1]), box[1]);
        pos[k * 3 + 2] = cam.z - half[2] + wrap(z - (cam.z - half[2]), box[2]);
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

/* A ribbon laid along a polyline of [x, y, z] points (rivers, lava flows) */
export function ribbon(points, width, { uvScale = 1, widthAt = null } = {}) {
  const n = points.length;
  const pos = new Float32Array(n * 2 * 3);
  const uv = new Float32Array(n * 2 * 2);
  const idx = [];
  let dist = 0;
  const side = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const upv = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i += 1) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    side.crossVectors(dir, upv);
    if (side.lengthSq() < 1e-6) side.set(0, 0, 1);
    side.normalize();
    const p = points[i];
    if (i > 0) {
      const q = points[i - 1];
      dist += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    }
    const w = (widthAt ? widthAt(i / (n - 1)) : 1) * width * 0.5;
    pos.set([p[0] - side.x * w, p[1] - side.y * w, p[2] - side.z * w], i * 6);
    pos.set([p[0] + side.x * w, p[1] + side.y * w, p[2] + side.z * w], i * 6 + 3);
    uv.set([0, (dist / width) * uvScale, 1, (dist / width) * uvScale], i * 4);
    if (i < n - 1) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ── Ferris wheel (spins), lying in its local XY plane ── */
export function ferrisWheel(R, bulbColor, steelHex = 0x2a3650) {
  const g = new THREE.Group();
  const steel = lambert(steelHex);
  const rotor = new THREE.Group();
  [-5, 5].forEach((z) => {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 1.2, 6, 64), steel);
    rim.position.z = z;
    rotor.add(rim);
  });
  const spokes = [];
  const SPOKES = 16;
  for (let k = 0; k < SPOKES; k += 1) {
    const a = (k / SPOKES) * Math.PI * 2;
    spokes.push(0, 0, 0, Math.cos(a) * R, Math.sin(a) * R, 0);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(spokes, 3));
  rotor.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0x33415c })));
  const bulbs = [];
  for (let k = 0; k < 48; k += 1) {
    const a = (k / 48) * Math.PI * 2;
    bulbs.push(Math.cos(a) * R, Math.sin(a) * R, 6);
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(bulbs, 3));
  rotor.add(new THREE.Points(bg, new THREE.PointsMaterial({ color: bulbColor, size: 4 })));
  g.add(rotor);
  const cabs = [];
  const cabGeo = new THREE.BoxGeometry(10, 9, 9);
  const cabColors = [0x6a4f8a, 0x3f6d7a, 0x8a5a4f, 0x4f6a8a];
  for (let k = 0; k < 8; k += 1) {
    const cab = new THREE.Mesh(cabGeo, lambert(cabColors[k % 4]));
    g.add(cab);
    cabs.push({ cab, a: (k / 8) * Math.PI * 2 });
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 14, 10), steel);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  [-1, 1].forEach((side) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(3, R * 1.25, 3), steel);
    leg.position.set(side * R * 0.32, -R * 0.56, 0);
    leg.rotation.z = side * 0.5;
    g.add(leg);
  });
  const tick = (time) => {
    const a0 = time * 0.12;
    rotor.rotation.z = a0;
    cabs.forEach(({ cab, a }) => {
      cab.position.set(Math.cos(a + a0) * R, Math.sin(a + a0) * R - 6, 0);
    });
  };
  tick(0);
  return { group: g, tick };
}
