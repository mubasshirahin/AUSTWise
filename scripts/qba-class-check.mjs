#!/usr/bin/env node
/**
 * Class coverage check for QuestionBankAnalyzerPage.css.
 * Fails if the JSX references a qba-* class that the stylesheet no longer defines.
 */
import { readFileSync } from "node:fs";

const cssPath = "src/features/question-bank-analyzer/QuestionBankAnalyzerPage.css";
const files = [
  "src/features/question-bank-analyzer/QuestionBankAnalyzerPage.jsx",
  "src/features/question-bank-analyzer/PreviewPanel.jsx",
];

const css = readFileSync(cssPath, "utf8");
const defined = new Set([...css.matchAll(/\.(qba-[\w-]+)/g)].map((m) => m[1]));

const used = new Map();
for (const f of files) {
  const src = readFileSync(f, "utf8");
  // static className="..." and template literals
  for (const m of src.matchAll(/qba-[\w-]+/g)) {
    used.set(m[0], f);
  }
}

const missing = [...used].filter(([c]) => !defined.has(c));
console.log(`defined: ${defined.size}   referenced: ${used.size}`);
if (missing.length) {
  console.log("\nMISSING definitions:");
  for (const [c, f] of missing) console.log(`  ${c}  (${f})`);
  process.exitCode = 1;
} else {
  console.log("OK — every qba-* class referenced by the JSX is defined.");
}

// duplicate selector blocks (same exact selector declared twice at top level)
const selCount = new Map();
for (const m of css.matchAll(/^([.\[]?[^@{}\n]+?)\s*\{/gm)) {
  const s = m[1].trim();
  if (s.startsWith("@") || s.startsWith("/*")) continue;
  selCount.set(s, (selCount.get(s) || 0) + 1);
}
const dups = [...selCount].filter(([, n]) => n > 1);
if (dups.length) {
  console.log("\nDUPLICATE top-level selectors:");
  for (const [s, n] of dups) console.log(`  x${n}  ${s}`);
}
