// Generates desktop/tray.png (32×32) from the same geometry as the bubble SVG,
// so the tray icon needs no hand-made binary asset.
//
//   node desktop/make-tray-icon.js
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SIZE = 32;
const SS = 4; // supersampling factor per axis
const N = SIZE * SS;

const WHITE = [255, 255, 255];
const AMBER = [242, 169, 0];
const DISC = [17, 17, 17];

// Geometry lives in the SVG's 400×400 space.
const k = N / 400;

/** Distance from a point to a line segment. */
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

const POLYLINE = [
  [104, 128],
  [154, 282],
  [200, 100],
  [246, 282],
  [296, 128],
];

/** Colour of one supersampled sample in SVG space. */
function sampleAt(x, y) {
  const cx = 200;
  const cy = 200;

  // Outer disc.
  if (Math.hypot(x - cx, y - cy) > 188) return null;

  // White ring (thickened from the SVG's 3 units so it survives 16px scaling).
  const ringDist = Math.abs(Math.hypot(x - cx, y - cy) - 176);
  if (ringDist <= 7) return WHITE;

  // Amber rule under the letters (wider than the SVG so it reads at 16px).
  const localY = y - 8;
  if (
    x >= 152 && x <= 248 &&
    Math.abs(localY - 246) <= 13
  ) {
    return AMBER;
  }

  // A / W polyline, translated down by 8 like the SVG group.
  const py = localY;
  for (let i = 0; i < POLYLINE.length - 1; i += 1) {
    const [x1, y1] = POLYLINE[i];
    const [x2, y2] = POLYLINE[i + 1];
    if (distToSegment(x, py, x1, y1, x2, y2) <= 11) return WHITE;
  }

  return DISC;
}

// ── Rasterise with 4×4 supersampling ──────────────────────────────────────
const pixels = Buffer.alloc(SIZE * SIZE * 4);

for (let py = 0; py < SIZE; py += 1) {
  for (let px = 0; px < SIZE; px += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    let hits = 0;

    for (let sy = 0; sy < SS; sy += 1) {
      for (let sx = 0; sx < SS; sx += 1) {
        const x = ((px + (sx + 0.5) / SS) * 400) / SIZE;
        const y = ((py + (sy + 0.5) / SS) * 400) / SIZE;
        const color = sampleAt(x, y);
        if (!color) continue;
        r += color[0];
        g += color[1];
        b += color[2];
        hits += 1;
      }
    }

    const offset = (py * SIZE + px) * 4;
    if (hits === 0) continue;
    pixels[offset] = Math.round(r / hits);
    pixels[offset + 1] = Math.round(g / hits);
    pixels[offset + 2] = Math.round(b / hits);
    pixels[offset + 3] = Math.round((hits / (SS * SS)) * 255);
  }
}

// ── Minimal PNG encoder (RGBA, 8-bit, no filtering) ───────────────────────
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // colour type: RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y += 1) {
  raw[y * (SIZE * 4 + 1)] = 0; // filter: none
  pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(__dirname, 'tray.png');
fs.writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes, ${SIZE}x${SIZE})`);
