#!/usr/bin/env node
/**
 * WCAG contrast audit for AUSTWise design tokens.
 * Parses the [data-theme="..."] blocks in src/index.css and checks every
 * plausible foreground/background pairing against WCAG 2.1 thresholds.
 *
 * Usage: node scripts/contrast-audit.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(__dirname, "..", "src", "index.css");

const css = readFileSync(CSS_PATH, "utf8");

// ---- color parsing -------------------------------------------------------
function parseHex(hex) {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function parseRgba(str) {
  const m = str.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/i);
  if (!m) return null;
  return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] };
}

function channel(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance(rgb) {
  const [r, g, b] = rgb.map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
function composite(fg, alpha, bgRgb) {
  return fg.map((c) => c * alpha + bgRgb[c] * (1 - alpha));
}

// ---- token extraction ----------------------------------------------------
function extractThemeBlocks() {
  const themes = {};
  const re = /\[data-theme="([^"]+)"\]\s*\{/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const name = m[1];
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    themes[name] = css.slice(m.index + m[0].length, i - 1);
  }
  // :root block
  const rm = /:root\s*\{/.exec(css);
  if (rm) {
    let depth = 1;
    let i = rm.index + rm[0].length;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    themes.__root__ = css.slice(rm.index + rm[0].length, i - 1);
  }
  return themes;
}

function extractVars(block) {
  const vars = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    vars[m[1]] = m[2].trim();
  }
  return vars;
}

function resolve(value, vars, depth = 0) {
  if (depth > 8) return null;
  const v = value.trim();
  const hm = v.match(/^#([0-9a-f]{3,8})$/i);
  if (hm) return parseHex(v);
  const vm = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/);
  if (vm) {
    const target = vars[vm[1]];
    if (target === undefined) return vm[2] ? resolve(vm[2], vars, depth + 1) : null;
    return resolve(target, vars, depth + 1);
  }
  const rg = parseRgba(v);
  if (rg) return rg;
  return null;
}

const themes = extractThemeBlocks();

// Foreground-ish token names to test
const FG = [
  "--text-primary", "--text-secondary", "--text-tertiary", "--text-inverse",
  "--color-foreground", "--color-muted-foreground", "--color-on-primary",
  "--color-on-secondary", "--color-on-accent", "--color-card-foreground",
];
const BG = [
  "--bg-primary", "--bg-secondary", "--bg-tertiary", "--bg-card", "--bg-input",
  "--color-background", "--color-muted", "--color-card",
];

let total = 0;
let failures = 0;
const rows = [];

for (const [theme, block] of Object.entries(themes)) {
  const vars = extractVars(block);
  for (const fgName of FG) {
    if (!(fgName in vars)) continue;
    for (const bgName of BG) {
      if (!(bgName in vars)) continue;
      const fgRaw = resolve(vars[fgName], vars);
      const bgRaw = resolve(vars[bgName], vars);
      if (!fgRaw || !bgRaw) continue;

      let fgRgb, bgRgb;
      if (fgRaw.rgb) {
        if (fgRaw.a < 1) continue; // skip translucent fg for simplicity
        fgRgb = fgRaw.rgb;
      } else fgRgb = fgRaw;
      if (bgRaw.rgb) {
        bgRgb = bgRaw.a < 1 ? composite(bgRaw.rgb, bgRaw.a, [0, 0, 0]) : bgRaw.rgb;
      } else bgRgb = bgRaw;

      const ratio = contrast(fgRgb, bgRgb);
      total++;
      const fails = ratio < 4.5;
      if (fails) failures++;
      rows.push({ theme, fgName, bgName, ratio, fails, fg: vars[fgName], bg: vars[bgName] });
    }
  }
}

rows.sort((a, b) => a.ratio - b.ratio);

console.log(`\nAUSTWise WCAG contrast audit  (${total} token pairings checked)\n`);
console.log("FAILING pairs (need >= 4.5:1 for normal text):\n");
const shown = new Set();
for (const r of rows) {
  if (!r.fails) continue;
  const key = `${r.theme}|${r.fgName}|${r.bgName}`;
  if (shown.has(key)) continue;
  shown.add(key);
  console.log(
    `  ${r.theme.padEnd(12)} ${r.fgName.padEnd(22)} on ${r.bgName.padEnd(18)} ${r.ratio.toFixed(2)}:1`
  );
  console.log(`               ${r.fg}  /  ${r.bg}\n`);
}
console.log(`\n${failures} of ${total} pairings fail 4.5:1 (${((failures / total) * 100).toFixed(1)}%)\n`);
