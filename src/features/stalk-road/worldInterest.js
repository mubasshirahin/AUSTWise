import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry } from './coasterTrack';
import {
  flat, lambert, canvasTex, starDome, skyDisc, driftField, jitter, tint,
} from './fppKit';
import { ordered, bounds } from './themeParts';

/* ─── First-person world for an interest theme ───
   Builds the same props as the side view (interestThemes.js parts) as 3D
   meshes and lays them out around the coaster:
     near   the theme's props, both sides of the track
     small  little things right beside the rails
     mid    landmarks a little further out
     far    the horizon: hills / city blocks / a stadium bowl / the sea /
            walls of books — whatever the spec's `far.kind` asks for
   Static parts of a prop merge into one vertex-coloured geometry that is
   instanced; animated parts and text stay separate meshes so they can move.
   Flat Lambert / basic materials only — no glow, depth comes from fog. */

const DEG = Math.PI / 180;
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const hexN = (c) => parseInt(c.slice(1), 16);

/* text on a transparent canvas → texture + aspect */
export function textTexture(text, color, { weight = 800, bg = null, pad = 0.18 } = {}) {
  const fs = 96;
  const font = `${weight} ${fs}px ui-sans-serif, system-ui, "Segoe UI Symbol", sans-serif`;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const tw = Math.max(fs * 0.6, probe.measureText(String(text)).width);
  const w = Math.min(2048, Math.ceil(tw + fs * pad * 2));
  const h = Math.ceil(fs * 1.3);
  const tex = canvasTex(w, h, (ctx) => {
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text), w / 2, h / 2 + fs * 0.04);
  }, { aniso: 4 });
  return { tex, aspect: w / h };
}

/* ── one part → geometry centred on the part, plus where it goes ── */
function partGeo(p) {
  let geo;
  let cx = p.x;
  let cy;
  let d;
  let front = 0; // how far the part reaches toward +z from its centre
  switch (p.s) {
    case 'box':
      d = p.d ?? clampN(Math.min(p.w, p.h) * 0.5, 4, 24);
      geo = new THREE.BoxGeometry(p.w, p.h, d);
      cy = p.y + p.h / 2;
      front = d / 2;
      break;
    case 'cyl':
      geo = new THREE.CylinderGeometry(p.r2 ?? p.r, p.r, p.h, 20);
      cy = p.y + p.h / 2;
      front = Math.max(p.r, p.r2 ?? p.r);
      break;
    case 'cone':
      geo = new THREE.ConeGeometry(p.r, p.h, 20);
      cy = p.y + p.h / 2;
      front = p.r;
      break;
    case 'tri': {
      d = p.d ?? clampN(p.w * 0.5, 2, 30);
      const sh = new THREE.Shape();
      sh.moveTo(-p.w / 2, -p.h / 2);
      sh.lineTo(p.w / 2, -p.h / 2);
      sh.lineTo(p.ax || 0, p.h / 2);
      sh.closePath();
      geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
      geo.translate(0, 0, -d / 2);
      cy = p.y + p.h / 2;
      front = d / 2;
      break;
    }
    case 'dome':
      geo = new THREE.SphereGeometry(p.r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      cy = p.y;
      front = p.r;
      break;
    case 'disc':
      d = p.d ?? clampN(p.r * 0.5, 2, 14);
      geo = new THREE.CylinderGeometry(p.r, p.r, d, 24);
      geo.rotateX(Math.PI / 2);
      cy = p.y;
      front = d / 2;
      break;
    case 'ball':
      geo = new THREE.SphereGeometry(p.r, 16, 12);
      if (p.sy && p.sy !== 1) geo.scale(1, p.sy, 1);
      cy = p.y;
      front = p.r;
      break;
    case 'ring':
      geo = new THREE.TorusGeometry(p.r, p.t / 2, 8, 28);
      cy = p.y;
      front = p.t / 2;
      break;
    case 'line': {
      const len = Math.hypot(p.x2 - p.x1, p.y2 - p.y1) || 1;
      geo = new THREE.BoxGeometry(len + p.w * 0.6, p.w, p.w);
      geo.rotateZ(Math.atan2(p.y2 - p.y1, p.x2 - p.x1));
      cx = (p.x1 + p.x2) / 2;
      cy = (p.y1 + p.y2) / 2;
      front = p.w / 2;
      break;
    }
    case 'glyph': {
      const { tex, aspect } = textTexture(p.t, p.c, { weight: p.wt || 700 });
      const h = p.size * 1.3;
      geo = new THREE.PlaneGeometry(h * aspect, h);
      geo.userData.tex = tex;
      cy = p.y;
      break;
    }
    default:
      return null;
  }
  if (p.rz && p.s !== 'line') geo.rotateZ(p.rz * DEG);
  return { geo, cx, cy, front };
}

/* ── a prop template: merged static mesh + separately animated parts ── */
function buildTemplate(parts) {
  const statics = [];
  const dyn = [];
  const placed = []; // 2D boxes + their front z, for stacking later parts in front
  ordered(parts).forEach((p) => {
    const g = partGeo(p);
    if (!g) return;
    const b = bounds([p]);
    let cz = p.z || 0;
    // painter's order → depth: a part drawn over earlier parts sits just in front of them
    let reach = -Infinity;
    placed.forEach((q) => {
      if (b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0) reach = Math.max(reach, q.front);
    });
    if (p.s === 'glyph') cz = Math.max(cz, reach + 0.6);
    else if (reach > -Infinity && cz + g.front < reach + 0.5) cz = reach + 0.6 - g.front;
    placed.push({ ...b, front: cz + g.front });
    const entry = { p, geo: g.geo, c: [g.cx, g.cy, cz], y0: b.y0 };
    if (p.a || p.s === 'glyph' || (p.op ?? 1) < 1) dyn.push(entry);
    else {
      let geo = g.geo.index ? g.geo.toNonIndexed() : g.geo;
      if (geo !== g.geo) g.geo.dispose();
      geo.deleteAttribute('uv');
      geo.translate(...entry.c);
      geo = tint(geo, p.c);
      statics.push(geo);
    }
  });
  const merged = statics.length ? mergeGeometries(statics) : null;
  statics.forEach((s) => s.dispose());
  // one material per animated part, shared by every copy
  dyn.forEach((e) => {
    if (e.p.s === 'glyph') {
      e.mat = new THREE.MeshBasicMaterial({ map: e.geo.userData.tex, transparent: true, alphaTest: 0.12, depthWrite: false });
    } else {
      const op = e.p.op ?? 1;
      e.mat = lambert(hexN(e.p.c), op < 1 ? { transparent: true, opacity: op, depthWrite: false } : {});
    }
  });
  const bb = bounds(parts);
  return { merged, dyn, w: bb.w, h: bb.h, matrices: [] };
}

export function buildInterestWorld(spec, {
  scene, width: W, anisotropy = 8, hiRes = true, sunDir,
}) {
  const rnd = mulberry(4040 + spec.id.length * 97 + spec.id.charCodeAt(0));
  const { pal } = spec;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const textures = [];
  const keep = (t) => { t.anisotropy = Math.min(anisotropy, t.anisotropy); textures.push(t); return t; };
  const X0 = -900;
  const X1 = W + 900;
  const vcMat = lambert(0xffffff, { vertexColors: true });
  const anims = [];

  /* ── ground ── */
  const TILE = 320;
  const groundTex = keep(canvasTex(512, 512, (ctx, w, h) => {
    const r2 = mulberry(77);
    ctx.fillStyle = pal.ground;
    ctx.fillRect(0, 0, w, h);
    const kind = spec.ground?.kind;
    ctx.fillStyle = pal.ground2;
    ctx.strokeStyle = pal.ground2;
    if (kind === 'stripes') {
      ctx.fillRect(0, 0, w / 2, h);
    } else if (kind === 'checker') {
      const n = 8;
      for (let j = 0; j < n; j += 1) for (let i = 0; i < n; i += 1) if ((i + j) % 2) ctx.fillRect((i * w) / n, (j * h) / n, w / n, h / n);
    } else if (kind === 'planks') {
      ctx.lineWidth = 4;
      for (let j = 0; j < 8; j += 1) {
        ctx.beginPath(); ctx.moveTo(0, j * 64); ctx.lineTo(w, j * 64); ctx.stroke();
        const off = (j % 2) * 128;
        for (let x = off; x < w; x += 256) { ctx.beginPath(); ctx.moveTo(x, j * 64); ctx.lineTo(x, j * 64 + 64); ctx.stroke(); }
      }
    } else if (kind === 'grid' || kind === 'tiles') {
      if (kind === 'tiles') {
        const n = 8;
        for (let j = 0; j < n; j += 1) for (let i = 0; i < n; i += 1) if ((i + j) % 2) ctx.fillRect((i * w) / n, (j * h) / n, w / n, h / n);
      }
      ctx.strokeStyle = pal.line;
      ctx.globalAlpha = kind === 'tiles' ? 0.25 : 0.3;
      ctx.lineWidth = 3;
      for (let k = 0; k <= 8; k += 1) {
        ctx.beginPath(); ctx.moveTo((k * w) / 8, 0); ctx.lineTo((k * w) / 8, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, (k * h) / 8); ctx.lineTo(w, (k * h) / 8); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (kind === 'circuit') {
      ctx.strokeStyle = pal.line;
      ctx.fillStyle = pal.line;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 5;
      for (let k = 0; k < 26; k += 1) {
        let x = r2() * w;
        let y = r2() * h;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let s = 0; s < 3; s += 1) {
          if (s % 2) y += (r2() - 0.5) * 120; else x += (r2() - 0.5) * 160;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (kind === 'lanes') {
      ctx.fillStyle = pal.line;
      for (let k = 0; k < 4; k += 1) ctx.fillRect(0, k * 128 + 60, w, 6);
    } else if (kind === 'sand') {
      for (let k = 0; k < 900; k += 1) {
        ctx.globalAlpha = 0.5;
        ctx.fillRect(r2() * w, r2() * h, 3 + r2() * 3, 3 + r2() * 3);
      }
      ctx.globalAlpha = 1;
    }
  }, { repeat: true }));
  const GZ = spec.far?.kind === 'sea' ? 1100 : 11000;
  const groundGeo = new THREE.PlaneGeometry(X1 - X0 + 16000, GZ * 2);
  groundGeo.rotateX(-Math.PI / 2);
  groundGeo.translate((X0 + X1) / 2, 0, 0);
  groundTex.repeat.set((X1 - X0 + 16000) / TILE, (GZ * 2) / TILE);
  scene.add(new THREE.Mesh(groundGeo, lambert(0xffffff, { map: groundTex })));

  /* ── templates ── */
  const T = (list) => (list || []).map((parts) => buildTemplate(parts));
  const props = T(spec.props);
  const marks = T(spec.landmarks);
  const smalls = T(spec.small);
  const groupFor = (tpl, withDyn) => {
    const g = new THREE.Group();
    if (tpl.merged) g.add(new THREE.Mesh(tpl.merged, vcMat));
    if (withDyn) {
      tpl.dyn.forEach((e) => {
        const pivot = new THREE.Group();
        const mesh = new THREE.Mesh(e.geo, e.mat);
        const fromBase = e.p.a === 'pulse' || e.p.a === 'sway';
        pivot.position.set(e.c[0], fromBase ? e.y0 : e.c[1], e.c[2]);
        mesh.position.y = fromBase ? e.c[1] - e.y0 : 0;
        pivot.add(mesh);
        g.add(pivot);
        if (e.p.a) anims.push({ a: e.p.a, pivot, mesh, ph: (e.p.dl || 0) + rnd() * 0.25, y: pivot.position.y });
      });
    }
    return g;
  };
  // a placed prop: its static mesh joins the instanced batch, its moving parts get a group
  const place = (tpl, x, z, s, withDyn = true) => {
    const rotY = (z > 0 ? Math.PI : 0) + (rnd() - 0.5) * 0.4;
    q.setFromAxisAngle(yAxis, rotY);
    if (tpl.merged) {
      m4.compose(v3.set(x, 0, z), q, s3.set(s, s, s));
      tpl.matrices.push(m4.clone());
    }
    if (withDyn && tpl.dyn.length) {
      const g = new THREE.Group();
      const inner = groupFor({ merged: null, dyn: tpl.dyn }, true);
      g.add(inner);
      g.position.set(x, 0, z);
      g.quaternion.copy(q);
      g.scale.setScalar(s);
      scene.add(g);
    }
  };
  const side = () => (rnd() < 0.5 ? -1 : 1);

  // near band: the theme's props
  if (props.length) {
    let k = 0;
    for (let x = X0; x < X1; x += 70 + rnd() * 90) {
      const tpl = props[k % props.length];
      k += 1;
      const z = side() * (230 + rnd() * 780);
      place(tpl, x, z, 1 + rnd() * 0.6, Math.abs(z) < 900);
    }
  }
  // right beside the rails
  if (smalls.length) {
    for (let x = X0, k = 0; x < X1; x += 90 + rnd() * 120, k += 1) {
      place(smalls[k % smalls.length], x, side() * (130 + rnd() * 110), 1 + rnd() * 0.5, true);
    }
  }
  // landmarks
  if (marks.length) {
    for (let x = X0, k = 0; x < X1; x += 360 + rnd() * 380, k += 1) {
      place(marks[k % marks.length], x, side() * (1250 + rnd() * 1500), 2.2 + rnd() * 1.6, true);
    }
    for (let x = X0 - 3000, k = 0; x < X1 + 3000; x += 900 + rnd() * 700, k += 1) {
      place(marks[(k + 1) % marks.length], x, side() * (3400 + rnd() * 2400), 4.5 + rnd() * 3, false);
    }
  }

  /* ── horizon ── */
  const far = spec.far || { kind: 'ridge' };
  const farCol = new THREE.Color(pal.far);
  const midCol = new THREE.Color(pal.mid);
  if (far.kind === 'ridge' || far.kind === 'sea') {
    const N = far.kind === 'sea' ? 26 : 60;
    const hill = jitter(new THREE.ConeGeometry(1, 1, 7, 2), 0.12, rnd, (x, y) => y < -0.49);
    const hills = new THREE.InstancedMesh(hill, lambert(0xffffff, { flatShading: true }), N);
    for (let k = 0; k < N; k += 1) {
      const s = far.kind === 'sea' ? 0.6 + rnd() * 0.6 : 1;
      const r = (700 + rnd() * 1400) * s;
      const h = (far.amp || 70) * (5 + rnd() * 7) * s;
      q.setFromAxisAngle(yAxis, rnd() * 6.3);
      m4.compose(v3.set(X0 - 6000 + rnd() * (X1 - X0 + 12000), h / 2 - 10, side() * (5200 + rnd() * 4200)), q, s3.set(r, h, r * (0.7 + rnd() * 0.5)));
      hills.setMatrixAt(k, m4);
      hills.setColorAt(k, farCol.clone().lerp(midCol, rnd() * 0.5));
    }
    scene.add(hills);
    if (far.kind === 'sea') {
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 + 30000, 26000), lambert(hexN(pal.mid)));
      sea.rotation.x = -Math.PI / 2;
      sea.position.set((X0 + X1) / 2, -2, 0);
      scene.add(sea);
      // foam lines along the shore
      [-1, 1].forEach((sd) => {
        const foam = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 + 16000, 14), flat(0xffffff));
        foam.rotation.x = -Math.PI / 2;
        foam.position.set((X0 + X1) / 2, -1, sd * (GZ + 6));
        scene.add(foam);
      });
    }
  } else if (far.kind === 'blocks') {
    const pals = far.palette || [pal.far];
    const N = far.shelves ? 900 : 260;
    const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lambert(0xffffff), N);
    const lit = [];
    const cc = new THREE.Color();
    for (let k = 0; k < N; k += 1) {
      const sd = k % 2 ? 1 : -1;
      let x; let w; let h; let z;
      if (far.shelves) {
        // walls of giant books on both sides
        x = X0 - 2000 + (k / N) * (X1 - X0 + 4000) * 2 % (X1 - X0 + 4000);
        w = 26 + rnd() * 36;
        h = 260 + rnd() * 340;
        z = sd * (2300 + rnd() * 60);
      } else {
        x = X0 - 3000 + rnd() * (X1 - X0 + 6000);
        w = 90 + rnd() * 220;
        h = 200 + rnd() * 900;
        z = sd * (2800 + rnd() * 3400);
      }
      m4.compose(v3.set(x, h / 2, z), q.identity(), s3.set(w, h, far.shelves ? 160 : w * (0.7 + rnd() * 0.6)));
      blocks.setMatrixAt(k, m4);
      blocks.setColorAt(k, cc.set(pals[k % pals.length]).multiplyScalar(0.9 + rnd() * 0.2));
      if (far.lit) {
        for (let j = 0; j < 10; j += 1) lit.push(x + (rnd() - 0.5) * w * 0.9, 20 + rnd() * (h - 30), z - sd * (w * 0.36));
      }
    }
    scene.add(blocks);
    if (lit.length) {
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(lit, 3));
      scene.add(new THREE.Points(lg, new THREE.PointsMaterial({ color: hexN(far.lit[0]), size: 5, transparent: true, opacity: 0.8 })));
    }
  } else if (far.kind === 'stands') {
    // a stadium bowl: stepped stands down both sides, crowd specks, roof
    const len = X1 - X0 + 4000;
    const cx = (X0 + X1) / 2;
    const standMat = lambert(hexN(far.palette[0]));
    const tierMat = lambert(hexN(far.palette[1]));
    const crowd = [];
    const ccol = [];
    const cc = new THREE.Color();
    [-1, 1].forEach((sd) => {
      for (let s = 0; s < 6; s += 1) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(len, 40 + s * 46, 70), s % 2 ? tierMat : standMat);
        const z = sd * (1450 + s * 70);
        step.position.set(cx, (40 + s * 46) / 2, z);
        scene.add(step);
        for (let x = cx - len / 2; x < cx + len / 2; x += 9) {
          if (rnd() < 0.8) {
            crowd.push(x + rnd() * 4, 46 + s * 46, z - sd * 26 + (rnd() - 0.5) * 20);
            cc.set(far.crowd[Math.floor(rnd() * far.crowd.length)]);
            ccol.push(cc.r, cc.g, cc.b);
          }
        }
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(len, 14, 520), lambert(0x2a3850));
      roof.position.set(cx, 330, sd * 1700);
      roof.rotation.x = sd * -0.08;
      scene.add(roof);
    });
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(crowd, 3));
    cg.setAttribute('color', new THREE.Float32BufferAttribute(ccol, 3));
    scene.add(new THREE.Points(cg, new THREE.PointsMaterial({ size: 7, vertexColors: true })));
    // floodlight towers on the corners of the stands
    if (marks.length) {
      for (let x = X0; x < X1; x += 1400) [-1, 1].forEach((sd) => place(marks[0], x, sd * 2000, 2.2, true));
    }
  }

  // instanced static props
  [...props, ...marks, ...smalls].forEach((tpl) => {
    if (!tpl.merged || !tpl.matrices.length) return;
    const im = new THREE.InstancedMesh(tpl.merged, vcMat, tpl.matrices.length);
    tpl.matrices.forEach((mx, k) => im.setMatrixAt(k, mx));
    scene.add(im);
  });

  /* ── crowd along the track ── */
  const skins = ['#f0c8a0', '#d9a878', '#a8754a', '#7a4e2e'].map((c) => new THREE.Color(c));
  const shirts = (spec.crowd?.shirts || ['#888888']).map((c) => new THREE.Color(c));
  const PEOPLE = hiRes ? 520 : 300;
  const bodyGeo = new THREE.CylinderGeometry(4, 5, 22, 8);
  bodyGeo.translate(0, 11 + 12, 0);
  const legGeo = new THREE.CylinderGeometry(4.2, 4, 12, 6);
  legGeo.translate(0, 6, 0);
  const headGeo = new THREE.SphereGeometry(4.6, 10, 8);
  headGeo.translate(0, 39, 0);
  const bodies = new THREE.InstancedMesh(bodyGeo, lambert(0xffffff), PEOPLE);
  const legs = new THREE.InstancedMesh(legGeo, lambert(0x22242c), PEOPLE);
  const heads = new THREE.InstancedMesh(headGeo, lambert(0xffffff), PEOPLE);
  const bobbers = [];
  for (let k = 0; k < PEOPLE; k += 1) {
    const cluster = Math.floor(k / 8);
    const cxp = X0 + ((cluster * 37) % 100) / 100 * (X1 - X0) + (rnd() - 0.5) * 120;
    const z = (cluster % 2 ? 1 : -1) * (150 + rnd() * 120);
    const s = 0.9 + rnd() * 0.25;
    m4.compose(v3.set(cxp, 0, z), q.identity(), s3.set(s, s, s));
    bodies.setMatrixAt(k, m4);
    legs.setMatrixAt(k, m4);
    heads.setMatrixAt(k, m4);
    bodies.setColorAt(k, shirts[k % shirts.length]);
    heads.setColorAt(k, skins[Math.floor(rnd() * skins.length)]);
    if (rnd() < 0.3) bobbers.push({ k, x: cxp, z, s, ph: rnd() * 6 });
  }
  scene.add(bodies, legs, heads);

  /* ── sky: stars, sun / moon, glyphs (a group that follows the camera) ── */
  const sky = new THREE.Group();
  if (spec.stars || spec.rain) {
    sky.add(starDome(rnd, { count: hiRes ? 1400 : 800, radius: 9000, size: 1.5, opacity: 0.7, lower: 0.05 }));
  }
  if (spec.sun) {
    sky.add(skyDisc(sunDir, 9000, spec.sun.size * 4.4, hexN(spec.sun.c), spec.sun.pixel ? 4 : 48));
  }
  const spriteFor = (t, c) => {
    const { tex, aspect } = textTexture(t, c, { weight: 900 });
    keep(tex);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    sp.userData.aspect = aspect;
    return sp;
  };
  const airGlyphs = [];
  if (spec.skyGlyphs) {
    const { list, colors } = spec.skyGlyphs;
    for (let k = 0; k < 18; k += 1) {
      const sp = spriteFor(list[k % list.length], colors[k % colors.length]);
      const a = rnd() * Math.PI * 2;
      const el = (10 + rnd() * 35) * DEG;
      sp.position.set(Math.cos(a) * Math.cos(el) * 7000, Math.sin(el) * 7000, Math.sin(a) * Math.cos(el) * 7000);
      const size = 320 + rnd() * 380;
      sp.scale.set(size * sp.userData.aspect, size, 1);
      sky.add(sp);
    }
    // a few floating right beside the ride
    for (let k = 0; k < (hiRes ? 70 : 40); k += 1) {
      const sp = spriteFor(list[k % list.length], colors[(k + 1) % colors.length]);
      sp.material.fog = true;
      const size = 22 + rnd() * 26;
      sp.scale.set(size * sp.userData.aspect, size, 1);
      const y = 120 + rnd() * 420;
      sp.position.set(X0 + rnd() * (X1 - X0), y, side() * (170 + rnd() * 700));
      scene.add(sp);
      airGlyphs.push({ sp, y, ph: rnd() * 6 });
    }
  }
  scene.add(sky);

  /* ── clouds ── */
  const clouds = [];
  if (spec.clouds) {
    const cols = [].concat(spec.clouds);
    const puff = new THREE.IcosahedronGeometry(1, 1);
    for (let k = 0; k < 26; k += 1) {
      const g = new THREE.Group();
      const mat = lambert(hexN(cols[k % cols.length]), { flatShading: true });
      for (let j = 0; j < 5; j += 1) {
        const m = new THREE.Mesh(puff, mat);
        const r = 60 + rnd() * 70;
        m.scale.set(r * 1.4, r * 0.8, r);
        m.position.set((j - 2) * 85 + rnd() * 30, rnd() * 30, rnd() * 50);
        g.add(m);
      }
      g.position.set(X0 - 2000 + rnd() * (X1 - X0 + 4000), 900 + rnd() * 1100, side() * (700 + rnd() * 4200));
      scene.add(g);
      clouds.push({ g, x0: g.position.x, v: 8 + rnd() * 14 });
    }
  }

  /* ── flyers ── */
  const flyers = (spec.flyers || []).flatMap((parts) => {
    const tpl = buildTemplate(parts);
    return [0, 1, 2].map(() => {
      const sd = side();
      const g = groupFor(tpl, true);
      const s = 2.2 + rnd() * 1.2;
      g.scale.setScalar(s);
      if (sd > 0) g.rotation.y = Math.PI;
      scene.add(g);
      return {
        g, y: 600 + rnd() * 600, z: sd * (500 + rnd() * 1300), v: (sd > 0 ? -1 : 1) * (60 + rnd() * 70), x0: rnd() * (X1 - X0), ph: rnd() * 6,
      };
    });
  });
  const span = X1 - X0 + 4000;
  const placeFlyers = (time) => {
    flyers.forEach((f) => {
      const p = (((f.x0 + f.v * time) % span) + span) % span;
      f.g.position.set(X0 - 2000 + p, f.y + Math.sin(time * 0.5 + f.ph) * 18, f.z);
    });
  };
  placeFlyers(0);

  /* ── code rain (hacker): glyphs falling around the rider ── */
  const rain = [];
  if (spec.glyphRain) {
    for (let k = 0; k < (hiRes ? 140 : 80); k += 1) {
      const sp = spriteFor(rnd() < 0.5 ? '0' : '1', k % 3 ? pal.line : '#1f8a3e');
      sp.material.fog = true;
      const size = 10 + rnd() * 14;
      sp.scale.set(size * sp.userData.aspect, size, 1);
      scene.add(sp);
      rain.push({ sp, bx: rnd() * 1400, by: rnd() * 700, bz: rnd() * 1400, v: 50 + rnd() * 70 });
    }
  }
  const wrap = (v, s) => ((v % s) + s) % s;
  const placeRain = (time, cam) => {
    if (!cam) return;
    rain.forEach((d) => {
      d.sp.position.set(
        cam.x - 700 + wrap(d.bx - (cam.x - 700), 1400),
        cam.y - 350 + wrap(d.by - d.v * time - (cam.y - 350), 700),
        cam.z - 700 + wrap(d.bz - (cam.z - 700), 1400),
      );
    });
  };

  const particles = spec.particles ? driftField(scene, rnd, {
    count: hiRes ? spec.particles.count : Math.round(spec.particles.count * 0.6),
    box: [1400, 700, 1400],
    vel: spec.particles.vel,
    wobble: 5,
    size: spec.particles.size,
    opacity: 0.85,
    palette: spec.particles.palette.map(hexN),
  }) : null;

  return {
    sky,
    tick(time, calm, cam) {
      if (calm) {
        placeRain(0, cam);
        return;
      }
      anims.forEach((an) => {
        const t = time + an.ph;
        switch (an.a) {
          case 'spin': an.pivot.rotation.z = -t * 1.6; break;
          case 'flip': an.pivot.rotation.y = t * 2.2; break;
          case 'bob': an.pivot.position.y = an.y + Math.sin(t * 2.4) * 4; break;
          case 'pulse': an.pivot.scale.y = 0.35 + 0.65 * Math.abs(Math.sin(t * 3.2)); break;
          case 'thump': an.pivot.scale.setScalar(1 + 0.09 * Math.max(0, Math.sin(t * 7.5))); break;
          case 'blink': an.mesh.visible = Math.sin(t * 4.2) > -0.3; break;
          case 'sway': an.pivot.rotation.z = Math.sin(t * 1.6) * 0.12; break;
          default: break;
        }
      });
      bobbers.forEach((b) => {
        m4.compose(v3.set(b.x, Math.max(0, Math.sin(time * 5 + b.ph)) * 5, b.z), q.identity(), s3.set(b.s, b.s, b.s));
        bodies.setMatrixAt(b.k, m4);
        legs.setMatrixAt(b.k, m4);
        heads.setMatrixAt(b.k, m4);
      });
      if (bobbers.length) {
        bodies.instanceMatrix.needsUpdate = true;
        legs.instanceMatrix.needsUpdate = true;
        heads.instanceMatrix.needsUpdate = true;
      }
      airGlyphs.forEach((g) => { g.sp.position.y = g.y + Math.sin(time * 1.1 + g.ph) * 10; });
      clouds.forEach((c) => { c.g.position.x = X0 - 2000 + wrap(c.x0 - X0 + 2000 + c.v * time, X1 - X0 + 4000); });
      placeFlyers(time);
      placeRain(time, cam);
      particles?.tick(time, cam);
    },
    dispose() {
      textures.forEach((t) => t.dispose());
      [...props, ...marks, ...smalls].forEach((tpl) => tpl.merged?.dispose());
    },
  };
}

/* front-seat car details for an interest theme (camera space, −Z forward) */
export function decorateInterestCar(rig, spec, box) {
  const car = spec.car;
  const trim = flat(hexN(car.trim));
  box(20.2, 0.4, 0.5, trim, 0, -9.75, -21.5);
  [-6.5, 6.5].forEach((x) => box(3, 0.9, 0.5, flat(hexN(car.lamp)), x, -12.6, -27.6, 0.35));
  if (car.badge) {
    const { tex, aspect } = textTexture(car.badge, car.trim, { weight: 900, bg: car.seat });
    const h = 3.4;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h), new THREE.MeshBasicMaterial({ map: tex }));
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(0, -9.62, -18.5);
    rig.add(plate);
  }
}
