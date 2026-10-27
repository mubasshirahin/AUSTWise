#!/usr/bin/env node
/**
 * Builds a self-contained HTML harness that renders the Question Bank Analyzer
 * markup with the REAL stylesheets (src/index.css + QuestionBankAnalyzerPage.css)
 * so the page styling can be reviewed without the backend running.
 *
 * Usage:
 *   node scripts/qba-style-harness.mjs
 *   -> writes <temp>/qba-harness.html
 *
 * Open with ?theme=<name> to preview any of the 15 themes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const indexCss = readFileSync(join(root, "src", "index.css"), "utf8");
const pageCss = readFileSync(
  join(root, "src", "features", "question-bank-analyzer", "QuestionBankAnalyzerPage.css"),
  "utf8"
);

const rows = [
  ["1", "VIP", "qba-matrix-vip", "qba-badge-vip", "Graph traversal — BFS/DFS", "4", "2019–2024"],
  ["2", "High", "qba-matrix-high", "qba-badge-high", "Balanced trees (AVL, Red-Black)", "3", "2021–2024"],
  ["3", "Medium", "qba-matrix-medium", "qba-badge-medium", "Hashing & collision resolution", "2", "2022–2024"],
  ["4", "Low", "qba-matrix-low", "qba-badge-low", "Sorting complexity proofs", "1", "2023"],
];

const rowHtml = rows
  .map(
    ([n, label, rowCls, badgeCls, topic, times, years]) => `
      <tr class="${rowCls}">
        <td class="qba-sno">${n}</td>
        <td><span class="qba-badge ${badgeCls}">${label}</span></td>
        <td>${topic}</td>
        <td class="qba-num">${times}</td>
        <td class="qba-num">${years}</td>
      </tr>`
  )
  .join("");

const stats = [
  ["128", "Questions"],
  ["42", "Topics"],
  ["11", "Repeats"],
  ["6", "Semesters"],
  ["High", "Avg priority"],
  ["2024", "Latest paper"],
]
  .map(
    ([v, l]) => `
      <div class="qba-stat">
        <span class="qba-stat-value">${v}</span>
        <span class="qba-stat-label">${l}</span>
      </div>`
  )
  .join("");

const files = ["Fall 2024 Mid.pdf", "Spring 2024 Final.pdf", "Fall 2023 Mid.pdf"]
  .map(
    (name, i) => `
      <li class="qba-file-item">
        <span class="qba-file-index" aria-hidden="true">${i + 1}</span>
        <svg class="qba-file-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
        <span class="qba-file-name">${name}</span>
        <span class="qba-file-size">1.2 MB</span>
        <span class="qba-file-actions">
          <button type="button" class="qba-icon-btn" aria-label="Preview"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button type="button" class="qba-icon-btn qba-icon-btn-danger" aria-label="Remove"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
        </span>
      </li>`
  )
  .join("");

const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>QBA style harness</title>
<style>
${indexCss}
</style>
<style>
${pageCss}
</style>
<style>
  /* harness only */
  body { margin: 0; padding: 24px; background: var(--bg-primary); }
  .harness-theme-picker { position: fixed; top: 8px; right: 8px; z-index: 999; font: 12px system-ui; }
</style>
</head>
<body>
<div class="qba-widget qba-page">

  <div class="schedule-masthead qba-masthead">
    <div class="schedule-title-block">
      <div class="schedule-icon-tile">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
      </div>
      <span class="schedule-overline">Study toolkit</span>
      <p class="schedule-title">Question Bank Analyzer</p>
      <span class="schedule-subtitle">Past papers in, ranked study plan out — free, with your own AI</span>
    </div>
    <div class="schedule-actions">
      <button class="btn btn-ghost btn-sm">How it works</button>
    </div>
  </div>

  <div class="schedule-dotted-divider"></div>

  <div class="qba-notice" role="status">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
    <span>Your files never leave this device — parsing happens in your browser.</span>
  </div>

  <div class="qba-steps">

    <section class="qba-step glass-card-static">
      <div class="qba-step-head">
        <span class="qba-step-num" aria-hidden="true">1</span>
        <div class="qba-step-title-block">
          <h2 class="qba-step-title">Set up the prompt</h2>
          <p class="qba-step-hint">Copy this into ChatGPT, Claude or Gemini before uploading anything.</p>
        </div>
      </div>
      <div class="qba-grid-2">
        <div class="qba-field">
          <label>Course code</label>
          <input class="input" value="CSE 2101" />
        </div>
        <div class="qba-field">
          <label>Course title</label>
          <input class="input" value="Data Structures &amp; Algorithms" />
        </div>
      </div>
      <div class="qba-field">
        <div class="qba-label-row">
          <label>Analysis prompt</label>
          <span class="qba-muted qba-label-hint">Read-only — copy this into your AI</span>
        </div>
        <textarea class="input qba-prompt" readonly>You are analysing a question bank for CSE 2101 (Data Structures &amp; Algorithms).

For every question in the attached past papers, extract:
  - topic
  - year and exam type
  - marks
  - whether it repeats

Then rank topics by how often they appear, weighted by marks.</textarea>
        <div class="qba-prompt-actions">
          <button class="btn btn-primary">Copy prompt</button>
          <span class="qba-copy-status">Copied to clipboard</span>
        </div>
      </div>
    </section>

    <section class="qba-step glass-card-static">
      <div class="qba-step-head">
        <span class="qba-step-num" aria-hidden="true">2</span>
        <div class="qba-step-title-block">
          <h2 class="qba-step-title">Run it in your AI</h2>
          <p class="qba-step-hint">Paste the prompt, then attach your past papers in the same message.</p>
        </div>
      </div>
      <ol class="qba-instructions">
        <li>Open your AI chat and paste the prompt above.</li>
        <li>Attach every past paper PDF for this course.</li>
        <li><strong>Ask for JSON only</strong> — no prose, no code fences.</li>
      </ol>
      <div class="qba-callout">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <p>If the reply is wrapped in \`\`\`json fences, just paste it in — the parser strips them.</p>
      </div>
    </section>

    <section class="qba-step glass-card-static">
      <div class="qba-step-head">
        <span class="qba-step-num" aria-hidden="true">3</span>
        <div class="qba-step-title-block">
          <h2 class="qba-step-title">Paste the result</h2>
          <p class="qba-step-hint">Drop the JSON back in and build your ranked report.</p>
        </div>
      </div>
      <div class="qba-field">
        <div class="qba-label-row">
          <label>Past paper PDFs (optional)</label>
        </div>
        <button type="button" class="qba-dropzone">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
          <span class="qba-dropzone-title">Drop PDFs here, or click to browse</span>
          <span class="qba-dropzone-sub">Files are read locally and never uploaded.</span>
        </button>
        <ol class="qba-file-list">${files}</ol>
      </div>
      <div class="qba-field">
        <div class="qba-label-row">
          <label>AI response (JSON)</label>
          <button class="btn btn-ghost btn-sm">Load sample</button>
        </div>
        <textarea class="input qba-textarea">{
  "course": "CSE 2101",
  "topics": [
    { "name": "Graph traversal — BFS/DFS", "times": 4, "years": "2019–2024", "priority": "VIP" }
  ]
}</textarea>
      </div>
      <div class="qba-actions">
        <button class="btn btn-primary">Build report</button>
        <button class="btn btn-secondary">Print</button>
        <button class="btn btn-secondary">Save image</button>
      </div>
      <div class="qba-messages qba-messages-warning">
        <div class="qba-messages-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
          <span>2 topics had no year — they were kept but ranked last.</span>
        </div>
      </div>
    </section>
  </div>

  <section class="qba-preview glass-card-static">
    <div class="qba-preview-bar">
      <h2>Ranked report</h2>
      <span class="qba-pill">Report ready</span>
    </div>

    <div class="qba-preview-head">
      <div>
        <span class="qba-preview-kicker">Question bank analysis</span>
        <h1 class="qba-preview-title">CSE 2101 — Data Structures &amp; Algorithms</h1>
        <p class="qba-preview-meta">128 questions · 42 topics · built 19 Oct 2026</p>
      </div>
      <span class="qba-preview-stamp">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>
        6 papers parsed
      </span>
    </div>

    <div class="qba-summary-cards">${stats}</div>

    <div class="qba-preview-section">
      <div class="qba-section-head">
        <h3>Priority matrix</h3>
        <span class="qba-section-note">Ranked by weighted frequency</span>
      </div>
      <div class="qba-table-wrap">
        <table class="qba-table">
          <thead>
            <tr><th>#</th><th>Priority</th><th>Topic</th><th class="qba-num">Times</th><th class="qba-num">Years</th></tr>
          </thead>
          <tbody>${rowHtml}</tbody>
        </table>
      </div>
    </div>

    <div class="qba-preview-section">
      <div class="qba-section-head">
        <h3>Semester breakdown</h3>
      </div>
      <details class="qba-sem" open>
        <summary>Fall 2024 <span class="qba-sem-count">31 questions</span></summary>
        <div class="qba-table-wrap">
          <table class="qba-table">
            <thead><tr><th>#</th><th>Priority</th><th>Topic</th><th class="qba-num">Marks</th></tr></thead>
            <tbody>
              <tr class="qba-matrix-vip"><td class="qba-sno">1</td><td><span class="qba-badge qba-badge-vip">VIP</span></td><td>Graph traversal — BFS/DFS</td><td class="qba-num">15</td></tr>
              <tr class="qba-matrix-high"><td class="qba-sno">2</td><td><span class="qba-badge qba-badge-high">High</span></td><td>Balanced trees</td><td class="qba-num">12</td></tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>

    <div class="qba-preview-section">
      <div class="qba-section-head">
        <h3>Study plan</h3>
      </div>
      <ol class="qba-plan">
        <li>Week 1 — Graphs: BFS, DFS, shortest paths. Do 2019–2024 VIP questions first.</li>
        <li>Week 2 — Balanced trees, then hashing. Re-derive worst-case complexity from scratch.</li>
        <li>Week 3 — Mock under exam timing, focusing on mark-heavy topics.</li>
      </ol>
    </div>
  </section>

  <section class="qba-accordion glass-card-static" style="margin-top:22px">
    <div class="qba-acc-item">
      <button class="qba-acc-trigger">
        <span class="qba-acc-main">
          <span class="qba-acc-name">Graph traversal — BFS/DFS</span>
          <span class="qba-acc-meta">4 appearances · 2019, 2021, 2023, 2024</span>
        </span>
        <svg class="qba-chevron qba-chevron-open" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="qba-acc-panel">
        <p class="qba-hint">Appears in almost every paper, always in the 12–15 mark band.</p>
      </div>
    </div>
    <div class="qba-acc-item">
      <button class="qba-acc-trigger">
        <span class="qba-acc-main">
          <span class="qba-acc-name">Hashing &amp; collision resolution</span>
          <span class="qba-acc-meta">2 appearances · 2022, 2024</span>
        </span>
        <svg class="qba-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
      </button>
    </div>
  </section>

  <section class="qba-help glass-card-static" style="margin-top:22px">
    <div class="qba-section-head">
      <h3>Common problems</h3>
      <span class="qba-section-note">Most issues are fixed by one of these</span>
    </div>
    <div class="qba-help-grid">
      <details open>
        <summary>The JSON won't parse</summary>
        <p>Ask your AI for <code>JSON only</code>. Trailing commas and comments are the usual culprits.</p>
      </details>
      <details>
        <summary>Topics look merged</summary>
        <p>Near-duplicate names are folded together. Use the unmerge control if two topics are genuinely distinct.</p>
      </details>
    </div>
  </section>

</div>

<script>
  const t = new URLSearchParams(location.search).get('theme');
  if (t) document.documentElement.setAttribute('data-theme', t);
</script>
</body>
</html>
`;

const out = join(tmpdir(), "qba-harness.html");
writeFileSync(out, html, "utf8");
console.log(out);
