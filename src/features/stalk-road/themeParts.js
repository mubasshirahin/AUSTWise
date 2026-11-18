/* ─── Theme parts: one prop definition, two views ───
   Interest themes (gamer, football, coder …) describe every prop once as a
   list of simple parts. interestScenery.jsx draws the parts as flat SVG in
   the side view; worldInterest.js builds the same parts as three.js meshes
   in the first-person view — so a theme looks the same both ways.

   Units are world units (the side view's 600-unit world; a person is ~38
   tall). x runs right, y runs UP from the prop's base, z comes toward the
   side-view camera (later / larger z draws on top; in 3D it is real depth).

   Anchors:
     box, cyl, cone, tri   x = centre, y = bottom
     disc, ball, ring      x, y = centre (disc / ring face the camera)
     dome                  x = centre, y = flat base
     glyph                 x, y = centre of the text
     line                  two end points
   Common options (o): z, d (3D depth), rz (degrees, counter-clockwise),
   a (animation: spin | flip | bob | pulse | thump | blink | sway), dl (delay,
   seconds), op (opacity), rr (corner radius, side view only), sk / sw
   (outline colour / width, side view only). */

const part = (s, c, props, o = {}) => ({ s, c, ...props, ...o });

export const box = (x, y, w, h, c, o) => part('box', c, { x, y, w, h }, o);
export const cyl = (x, y, r, h, c, o) => part('cyl', c, { x, y, r, h }, o);
export const cone = (x, y, r, h, c, o) => part('cone', c, { x, y, r, h }, o);
export const tri = (x, y, w, h, c, o) => part('tri', c, { x, y, w, h }, o);
export const dome = (x, y, r, c, o) => part('dome', c, { x, y, r }, o);
export const disc = (x, y, r, c, o) => part('disc', c, { x, y, r }, o);
export const ball = (x, y, r, c, o) => part('ball', c, { x, y, r }, o);
export const ring = (x, y, r, t, c, o) => part('ring', c, { x, y, r, t }, o);
export const glyph = (x, y, t, size, c, o) => part('glyph', c, { x, y, t, size }, o);
export const line = (x1, y1, x2, y2, w, c, o) => part('line', c, { x1, y1, x2, y2, w }, o);

/* pixel art: rows read top to bottom, each character a colour key ('.' = empty) */
export function pixels(rows, size, colors, x0 = 0, y0 = 0, o = {}) {
  const out = [];
  const w = rows[0].length;
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch === '.' || !colors[ch]) return;
      out.push(box(x0 + (i - (w - 1) / 2) * size, y0 + (rows.length - 1 - j) * size, size, size, colors[ch], { d: size, ...o }));
    });
  });
  return out;
}

/* move a list of parts */
export const shift = (parts, dx, dy = 0, dz = 0) => parts.map((p) => (p.s === 'line'
  ? { ...p, x1: p.x1 + dx, x2: p.x2 + dx, y1: p.y1 + dy, y2: p.y2 + dy, z: (p.z || 0) + dz }
  : { ...p, x: p.x + dx, y: p.y + dy, z: (p.z || 0) + dz }));

/* blend two #rrggbb colours (t = 0 → a, 1 → b) */
export function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/* rough bounding box of a prop (for spacing and the flyer viewBox) */
export function bounds(parts) {
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  const add = (ax, bx, ay, by) => {
    x0 = Math.min(x0, ax); x1 = Math.max(x1, bx); y0 = Math.min(y0, ay); y1 = Math.max(y1, by);
  };
  parts.forEach((p) => {
    switch (p.s) {
      case 'box': case 'tri': add(p.x - p.w / 2, p.x + p.w / 2, p.y, p.y + p.h); break;
      case 'cyl': { const r = Math.max(p.r, p.r2 ?? p.r); add(p.x - r, p.x + r, p.y, p.y + p.h); break; }
      case 'cone': add(p.x - p.r, p.x + p.r, p.y, p.y + p.h); break;
      case 'dome': add(p.x - p.r, p.x + p.r, p.y, p.y + p.r); break;
      case 'ball': add(p.x - p.r, p.x + p.r, p.y - p.r * (p.sy ?? 1), p.y + p.r * (p.sy ?? 1)); break;
      case 'disc': case 'ring': add(p.x - p.r, p.x + p.r, p.y - p.r, p.y + p.r); break;
      case 'glyph': { const hw = (p.size * String(p.t).length * 0.32); add(p.x - hw, p.x + hw, p.y - p.size / 2, p.y + p.size / 2); break; }
      case 'line': add(Math.min(p.x1, p.x2), Math.max(p.x1, p.x2), Math.min(p.y1, p.y2), Math.max(p.y1, p.y2)); break;
      default: break;
    }
  });
  return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
}

/* parts in draw order: by z, then as listed */
export const ordered = (parts) => parts
  .map((p, i) => ({ p, i }))
  .sort((a, b) => (a.p.z || 0) - (b.p.z || 0) || a.i - b.i)
  .map(({ p }) => p);
