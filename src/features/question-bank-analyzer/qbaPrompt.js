/**
 * Master prompt for the Question Bank Analyzer.
 *
 * The whole feature is client-side and free: the user pastes this prompt into
 * their own AI, uploads the course files there, and brings back one Markdown
 * file. Keep the output contract in sync with parseQuestionBank.js.
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
of rows in your output (before merging) must equal the total count of
questions across all uploaded files. If you are unsure whether something
is a question, include it.

RULE 2 — EXACT WORDING:
Copy every question WORD-FOR-WORD from the source. Do NOT shorten,
summarise, paraphrase, translate, fix grammar, or remove examples.
Keep the original language (including Bangla) and original wording.
If a question has sub-parts (a), (b), (c), keep every part in the same
Question cell, separated by <br>. Never split one question into separate rows.

RULE 3 — MERGING SIMILAR QUESTIONS:
After extracting all questions, group them by TOPIC, then merge similar
questions within the same topic using these exact rules:

  a) EXACT DUPLICATE: Same wording AND same sub-parts from different
     exams. Keep ONE full copy. Do NOT add a Version 2. Increment
     "Times" by 1 for each repeat. List EVERY semester it appeared in
     the "Semester" column, separated by commas.
     Example Semester cell: Spring 2022, Fall 2022, Spring 2023

  b) SIMILAR (same underlying concept, different wording or sub-parts):
     Merge into ONE row. Write "Version 1: <full text><br>Version 2:
     <full text>" etc. Keep ALL version texts in full — never truncate
     any version. List every semester across all versions in Semester
     cell. Use the highest Marks value. Sum the Times across versions.

  c) GENUINELY DIFFERENT: Separate row. Never merge questions that test
     different concepts even if they share keywords.

RULE 4 — ALL SEMESTERS MUST BE VISIBLE:
The Semester column must list EVERY semester a question (or any of its
versions) appeared in. Never write only the first semester. Never write
"multiple". Write them all, comma-separated, in chronological order.
Example: Spring 2021, Fall 2022, Spring 2023, Fall 2024

RULE 5 — RECENT SEMESTERS EQUAL TREATMENT:
Questions from Fall 2024 or any recent semester must be extracted and
displayed with the same completeness as questions from older semesters.
A question is never deprioritised because it is recent or because the
semester only contributed a small number of questions.

RULE 6 — IMAGES:
If a question needs a diagram, figure, circuit, graph, table, or any
picture that cannot be copied as plain text, write the literal token
[image] exactly where the picture appeared — at the START of the cell
if it was above the question text, at the END if it was below. One
[image] per missing picture. Do NOT describe or invent the picture.

RULE 7 — UNREADABLE FILES:
If a file is scanned or unreadable, say which one and stop. Never guess
its content.

RULE 8 — RAW SEMESTER PAPERS (never merged):
The TOPIC blocks are merged. The teacher's papers must ALSO be reproduced
raw, exactly as they were printed, in the SEMESTER_PAPERS section at the
end. For every semester:
  - one row per main question, in the order it appears on that paper;
  - the "#" column runs 1, 2, 3 ... with NO gaps, NO repeats and NO skipped
    numbers — every source question gets exactly one row;
  - NEVER merge, deduplicate, relabel or add "Version" text here — if the
    same question appears twice, write it twice;
  - copy the wording exactly (RULE 2) and keep the [image] token exactly
    where the picture was (RULE 6);
  - SUB-QUESTIONS (this is how I check for missing parts): every lettered
    sub-part gets its OWN line inside the cell, starting with the row's
    number, a dot and a lower-case letter:
        | 2 | <question stem><br>2.a) <first sub-part><br>2.b) <second sub-part> | Mid | 10 |
    The prefix must match the row's own "#" (row 2 means 2.a), 2.b)).
    The letters run a, b, c, d ... in source order with NO gaps. A 2.b)
    may never exist without a 2.a), and no later part may be renumbered to
    hide a missing one. Never write the parts as one run-on line, and
    never put two sub-parts in the same line. For the parts themselves,
    use the wording as printed (if the paper writes (i), (ii), keep that
    wording but the label in front is still 2.a), 2.b)). If a source part
    is unreadable, keep its line with [unclear] so the count does not
    shift. A question with no sub-parts stays on one line with no letter.
  - Exam = Final / Mid / Quiz / Class Test / Other;
  - Marks = the marks printed on the paper.
Before closing a semester, count the source questions and sub-parts again:
the output must contain every one, in the same order.
The total number of rows in SEMESTER_PAPERS must equal
total_questions_extracted (one row per main question; sub-parts stay
inside their row).

═══════════════════
OUTPUT RULES (STRICT)
═══════════════════

- Output ONLY one Markdown code block. No text before or after.
- Follow the format below EXACTLY. Do not rename headings, add extra
  sections, or change column order.
- Use plain text inside Question cells. Do not use Markdown bold/italic.
  If the question itself contains "|", escape it as \\|.
- Priority must be exactly one of: VIP, HIGH, MEDIUM, LOW.
- The picture token must be exactly [image] — lowercase, square brackets,
  nothing else inside.
- DO NOT stop mid-output. If the response is getting long, continue in
  the same format without repeating headers. If output gets cut off, I
  will say "continue" — resume exactly from the last incomplete row.
  In SEMESTER_PAPERS, repeat the current "### <semester>" heading and the
  table header before the resumed rows.
- After finishing ALL topic blocks, output the VIP_MATRIX, then the
  STUDY_PLAN, then the SEMESTER_PAPERS section.

═══════
FORMAT
═══════

---
course: ${courseCode}
title: ${courseTitle}
semesters: [list every semester found across all files]
total_questions_extracted: <exact count of main question rows (sub-parts stay inside their row)>
total_rows_after_merge: <exact count after merging>
---

## TOPIC: <topic name>
priority: <VIP|HIGH|MEDIUM|LOW>
total_asked: <total times this topic was examined, counting all versions and repeats>

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | Version 1: <full question copied exactly><br>Version 2: <full similar version copied exactly> | Final | Spring 2022, Fall 2023, Spring 2024 | 15 | 4 |

(Repeat the TOPIC block for every topic found.)

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
| 1 | <question exactly as printed — raw, never merged> | Final | 15 |
| 2 | <question stem><br>2.a) <first sub-part exactly as printed><br>2.b) <second sub-part exactly as printed> | Mid | 10 |

(Repeat one ### block for every semester, oldest semester first.)`;
}

export default buildPrompt;
