/**
 * Master prompt for the Question Bank Analyzer.
 *
 * The whole feature is client-side and free: the user pastes this prompt into
 * their own AI, uploads the course files there, and brings back one Markdown
 * file. Keep the output contract in sync with parseQuestionBank.js.
 *
 * Single source of truth: every question is written once in the MASTER
 * QUESTION POOL with a unique [QID: nnn], sub-parts included. The TOPIC blocks
 * and the raw SEMESTER_PAPERS contain only that QID, so editing one pool entry
 * — text, [image] token, topic or semesters — changes both views on the site.
 */

function placeholder(value, fallback) {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function buildPrompt(code, title) {
  const courseCode = placeholder(code, '[COURSE CODE]');
  const courseTitle = placeholder(title, '[COURSE TITLE]');

  return `You are an expert exam analyst. I will upload files for the course
${courseCode} - ${courseTitle}: slides, syllabus, quiz questions,
mid questions, previous semester finals, and other instructions.

STEP 1: List every file I uploaded and tell me what type each is
(slide / syllabus / quiz / mid / final / other). Wait for my "OK".
When I say "OK", go to Step 2.

STEP 2: Read ALL files with ZERO omissions. Then follow every rule below.

═══════════════════════════════════════════
EXTRACTION RULES — MANDATORY, NO EXCEPTIONS
═══════════════════════════════════════════

RULE 1 — ZERO SKIPPING:
Extract EVERY SINGLE question from EVERY file. No question may be left
out for any reason — not for length, not for similarity, not for
repetition, not for recency. If a semester has 20 questions, all 20 must
appear. If a semester has 1 question, that 1 must appear. The total count
of questions across all uploaded files must be exact. If you are unsure
whether something is a question, include it.

RULE 2 — EXACT WORDING:
Copy every question WORD-FOR-WORD from the source. Do NOT shorten,
summarise, paraphrase, translate, fix grammar, or remove examples.
Keep the original language (including Bangla) and original wording.
If a question has sub-parts (a), (b), (c), keep every part inside the same
question entry, each part on its own line in the source order, separated by
<br>. Never split one question into separate entries. Write the sub-part
labels exactly as printed — (a), (b), (c) or (i), (ii), (iii) — with no main
question number in front; my website adds the paper's own number itself.
A question with no sub-parts stays on one line.

RULE 3 — MASTER QUESTION POOL (SINGLE SOURCE OF TRUTH):
The full text of every question is written EXACTLY ONCE, in the MASTER
QUESTION POOL at the top of the output, with a unique ID:

  [QID: 001] Full question text word for word<br>(a) first sub-part<br>(b) second sub-part
  Topic: <topic name>
  Semesters: Spring 2022, Fall 2023

Every other section — the TOPIC blocks AND SEMESTER_PAPERS — contains ONLY
the [QID: nnn] reference. Never repeat the question text there, never write a
shortened copy, never add "Version 1 / Version 2" text. Editing one pool entry
must be enough to update both the semester-wise view and the topic-wise view
of my website, so nothing may exist in two places.

Number the IDs 001, 002, 003 ... with NO gaps, NO repeats and NO unused IDs.
Every pool entry must be referenced by at least one TOPIC row, and every QID
used in any table must exist in the pool.

Assign a clear TOPIC NAME to every question based on its core concept
(e.g., "8085 Architecture", "8086 Interfacing", "8051 Timers",
"Addressing Modes"). Group each question under exactly one topic block.

MERGE ONLY IDENTICAL TEXT:
Use ONE QID for a question that appears in several semesters ONLY when the
wording is character-for-character identical, sub-parts included. If the
wording differs in ANY way — even one word, one number or one sub-part —
give it its own QID. Never paraphrase, never keep only the newest wording,
never merge two questions just because they are about the same thing.

RULE 4 — ALL SEMESTERS MUST BE VISIBLE:
The Semester column must list EVERY semester a question appeared in. Never
write only the first semester. Never write "multiple". Write them all,
comma-separated, in chronological order.
Example: Spring 2021, Fall 2022, Spring 2023, Fall 2024

RULE 5 — RECENT SEMESTERS EQUAL TREATMENT:
Questions from Fall 2024 or any recent semester must be extracted and
displayed with the same completeness as questions from older semesters.
A question is never deprioritised because it is recent or because the
semester only contributed a small number of questions.

RULE 6 — IMAGES:
If a question needs a diagram, figure, circuit, graph, table, or any
picture that cannot be copied as plain text, write the literal token
[image] exactly where the picture appeared — at the START of the entry
if it was above the question text, at the END if it was below. One
[image] per missing picture. Do NOT describe or invent the picture.
The token belongs in the MASTER QUESTION POOL entry, so both views show it.

RULE 7 — UNREADABLE FILES:
If a file is scanned or unreadable, say which one and stop. Never guess
its content.

RULE 8 — RAW SEMESTER PAPERS (never merged):
The TOPIC blocks are for study. The teacher's papers must ALSO be
reproduced raw, exactly as they were printed, in the SEMESTER_PAPERS section
at the end. For every semester:
  - one row per main question, in the order it appears on that paper;
  - the "#" column runs 1, 2, 3 ... with NO gaps, NO repeats and NO skipped
    numbers — every source question gets exactly one row;
  - NEVER merge, deduplicate, relabel or drop anything here — if the same
    question appears twice on the paper, write it twice;
  - the Question cell contains ONE thing only: the reference [QID: nnn] of
    that exact question. No question text, no sub-parts, no extra words —
    the pool already holds all of it and my website fills it in. The same
    QID may appear in several semesters; that is correct;
  - Exam = Final / Mid / Quiz / Class Test / Other;
  - Marks = the marks printed on the paper.
Before closing a semester, count the source questions again: every one must
have its own row, in the same order.

═══════════════════
OUTPUT RULES (STRICT)
═══════════════════

- Output ONLY one Markdown code block. No text before or after.
- Follow the format below EXACTLY. Do not rename headings, add extra
  sections, or change column order.
- Use plain text inside Question cells. Do not use Markdown bold/italic.
  If the question itself contains "|", escape it as \\|.
- Priority must be exactly one of: VIP, HIGH, MEDIUM, LOW.
- Do NOT write answers. I add answer pictures myself in the website.
- The picture token must be exactly [image] — lowercase, square brackets,
  nothing else inside.
- Count the two front-matter numbers carefully — my website checks them:
    total_questions_extracted = total rows in ALL SEMESTER_PAPERS tables
    total_rows_after_merge    = total entries in the MASTER QUESTION POOL
  Sub-parts never get their own row; they live inside their question.
- DO NOT stop mid-output. If the response is getting long, continue in
  the same format without repeating headers. If output gets cut off, I
  will say "continue" — resume exactly from the last incomplete row.
  In SEMESTER_PAPERS, repeat the current "### <semester>" heading and the
  table header before the resumed rows.
- Output order: MASTER QUESTION POOL, then ALL topic blocks, then
  VIP_MATRIX, then STUDY_PLAN, then SEMESTER_PAPERS.

═══════
FORMAT
═══════

---
course: ${courseCode}
title: ${courseTitle}
semesters: [every semester found across all files, chronological]
total_questions_extracted: <total rows in all SEMESTER_PAPERS tables>
total_rows_after_merge: <total entries in the MASTER QUESTION POOL>
---

<!-- MASTER QUESTION POOL — SINGLE SOURCE OF TRUTH -->
<!-- Example lines (DELETE them from your output, they are only a shape to copy): -->
<!-- Example: [QID: 001] Full question text word for word<br>(a) first sub-part<br>(b) second sub-part -->
<!-- Example: Topic: 8085 Architecture -->
<!-- Example: Semesters: Spring 2022, Fall 2023 -->
<!-- Write one real entry per unique wording, IDs 001, 002, 003 ... with no gaps. -->
<!-- [image] goes inside the entry, where the picture appeared. -->

## TOPIC: <topic name>
priority: <VIP|HIGH|MEDIUM|LOW>
total_asked: <sum of the Times column below>

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: 001] | Final | Spring 2022, Fall 2023, Spring 2024 | 15 | 3 |

(Repeat the TOPIC block for every topic found. The Question cell holds only the
QID reference; Times is how many past papers this exact question appeared in.)

## VIP_MATRIX

| Topic | Times Asked | Avg Marks | Semesters Present | Last Asked | Priority |
|-------|-------------|-----------|-------------------|------------|----------|
| <topic> | <n> | <n> | <all semesters> | <most recent semester> | <priority> |

## STUDY_PLAN

1. <topic> — <one-line reason including how many times asked and most recent semester>
2. <topic> — <one-line reason>

## SEMESTER_PAPERS

### <semester name, exactly as written on the paper>
| # | Question | Exam | Marks |
|---|----------|------|-------|
| 1 | [QID: 001] | Final | 15 |
| 2 | [QID: 002] | Mid | 10 |

(Repeat one ### block for every semester, oldest semester first. Every row is
one printed question with only its QID reference. Sub-parts stay inside the
pool entry, so they are never written again here.)`;
}

export default buildPrompt;
