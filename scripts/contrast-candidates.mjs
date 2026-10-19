#!/usr/bin/env node
/**
 * Candidate checker: does a replacement value for --text-tertiary clear WCAG AA
 * against every dark-theme surface it is likely to land on?
 */
const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
const lum = (hex) => { const h = hex.replace("#", ""); const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]; return (hi + 0.05) / (lo + 0.05); };

const DARK_SURFACES = { "--bg-primary": "#0E0E10", "--bg-secondary": "#1B1B1F", "--bg-tertiary": "#222227", "--bg-card": "#1B1B1F", "--bg-input": "#222227" };
const LIGHT_SURFACES = { "--bg-primary": "#f8f7f4", "--bg-secondary": "#ffffff", "--bg-tertiary": "#efede8", "--bg-input": "#f0eee9" };

function test(label, candidates, surfaces, current) {
  console.log(`\n=== ${label} ===`);
  console.log(`current ${current}:`);
  for (const [name, bg] of Object.entries(surfaces)) {
    const r = ratio(current, bg);
    console.log(`   ${name.padEnd(16)} ${r.toFixed(2)}:1  ${r < 4.5 ? "FAIL" : "pass"}`);
  }
  for (const c of candidates) {
    const results = Object.entries(surfaces).map(([n, bg]) => [n, ratio(c, bg)]);
    const worst = Math.min(...results.map((r) => r[1]));
    const allPass = results.every((r) => r[1] >= 4.5);
    console.log(`   ${c}  worst=${worst.toFixed(2)}:1  ${allPass ? "ALL PASS" : "fail"}   ` + results.map(([n, r]) => `${n.replace("--bg-", "")}=${r.toFixed(2)}`).join(" "));
  }
}

test("DARK theme --text-tertiary", ["#82828B", "#86868F", "#8A8A93", "#8E8E97", "#909099"], DARK_SURFACES, "#6E6E75");
test("LIGHT theme --text-tertiary", ["#5A6170", "#5F6673", "#636A77", "#676E7B"], LIGHT_SURFACES, "#6b7280");
