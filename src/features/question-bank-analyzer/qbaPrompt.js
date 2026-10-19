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

STEP 2: Read all files carefully. Then:
- Extract EVERY question exactly as it appears in the source. Copy the
  full question text WORD-FOR-WORD. Do NOT shorten, summarise, paraphrase,
  translate, fix grammar, or remove examples. Keep the original language
  (including Bangla) and the original wording.
- If a question has sub-parts (a), (b), (c), keep every part in the same
  Question cell, separated by <br>. Never split one question into separate
  rows.
- Group questions by TOPIC (use syllabus topic names where possible).
- Tag each question with exam type (Quiz/Mid/Final) and semester/year.
- MERGE SIMILAR QUESTIONS into one row. If two questions ask the same
  underlying question with different wording, different sub-parts, or from
  different exams, treat them as versions of one question. Put every
  version's full text in the same Question cell, one below another, separated
  by <br>, and label them "Version 1:", "Version 2:", etc.
- Use a separate row only when the underlying question is genuinely different.
  Never drop a version just to make the list shorter.
- EXACT repeats (same wording and same sub-parts) should not become extra
  versions. Keep one full copy and count the repeats in "Times".
- For a merged row, use the first version's Exam and Semester, the highest
  Marks, and the total repeats across all versions in "Times".
- Count carefully and do not guess. If unsure, write "~" before the
  number.
- Give each topic a priority: VIP, HIGH, MEDIUM, or LOW, based on
  frequency, marks, and recency.
- If a file is scanned or unreadable, tell me which one instead of
  guessing its content.

OUTPUT RULES (STRICT):
- Output ONLY one Markdown code block. No text before or after.
- Follow the format below EXACTLY. Do not rename headings, add extra
  sections, or change column order.
- Copy question text exactly. Long Question cells are expected — never
  truncate them.
- Use plain text inside the Question cell. Do not use Markdown bold/italic.
  If the question itself contains a "|" character, escape it as \\|.
- Priority must be exactly one of: VIP, HIGH, MEDIUM, LOW.
- If output gets cut off, I will say "continue". Resume exactly from
  the last row and do not repeat anything.

FORMAT:

---
course: ${courseCode}
title: ${courseTitle}
semesters: [Spring 2023, Fall 2023]
---

## TOPIC: <topic name>
priority: <VIP|HIGH|MEDIUM|LOW>
total_asked: <number>

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | Version 1: <full question, copied exactly><br>Version 2: <full similar version, copied exactly> | Final | Spring 2023 | 15 | 3 |

(Group similar versions in one row. Use <br> for sub-parts and for each
version. Repeat the TOPIC block for every topic.)

## VIP_MATRIX

| Topic | Times Asked | Avg Marks | Last Asked | Priority |
|-------|-------------|-----------|------------|----------|
| <topic> | <n> | <n> | <semester> | <priority> |

## STUDY_PLAN

1. <topic> - <one line reason>
2. <topic> - <one line reason>`;
}

export default buildPrompt;
