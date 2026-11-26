import { describe, expect, it } from 'vitest';
import { parseQuestionBank, parseQuestionBankParts, parseQuestionNumbers } from './parseQuestionBank';
import {
  buildCoverage,
  buildOccurrences,
  buildRecoveryPrompt,
  buildTopicTrends,
  chanceBand,
  examOptions,
  inferPaperStructure,
  manualQuestionsToMarkdown,
  sameSemester,
} from './qbaInsights';
import { matchSyllabusTopics, parseMarksList, predictPaper } from './qbaPredict';

/*
 * Four finals (Spring 2022 → Fall 2023) and one mid.
 *   Keys       — every final                       → steady, top
 *   Normal     — Spring 22, Fall 22, Spring 23 only → due (skipped Fall 23)
 *   SQL        — Spring 23 + Fall 23 only           → new / rising
 *   Files      — Spring 22 only                     → cooling
 * Fall 2023 printed 4 questions but the AI wrote only #1, #2 and #4.
 */
const FIXTURE = `---
course: CSE 3101
title: Database Systems
files: [s22.pdf, f22.pdf, s23.pdf, f23.pdf, mid23.pdf]
---

[QID: 001] Define super key and candidate key.
Topic: Keys
Semesters: Spring 2022, Fall 2022

[QID: 002] Find all candidate keys of R(A,B,C,D).
Topic: Keys
Semesters: Spring 2023, Fall 2023

[QID: 003] Normalize R up to 3NF.
Topic: Normalization
Semesters: Spring 2022, Fall 2022, Spring 2023

[QID: 004] Write a SQL query using GROUP BY and HAVING.
Topic: SQL
Semesters: Spring 2023, Fall 2023

[QID: 005] Explain sequential and indexed file organization.
Topic: File Organization
Semesters: Spring 2022

[QID: 006] What is a weak entity set?
Topic: Keys
Semesters: Spring 2023

## TOPIC: Keys
priority: VIP
total_asked: 5

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: 001] | Final | Spring 2022, Fall 2022 | 10 | 2 |
| 2 | [QID: 002] | Final | Spring 2023, Fall 2023 | 10 | 2 |
| 3 | [QID: 006] | Mid | Spring 2023 | 5 | 1 |

## TOPIC: Normalization
priority: HIGH
total_asked: 3

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: 003] | Final | Spring 2022, Fall 2022, Spring 2023 | 15 | 3 |

## TOPIC: SQL
priority: HIGH
total_asked: 2

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: 004] | Final | Spring 2023, Fall 2023 | 10 | 2 |

## TOPIC: File Organization
priority: LOW
total_asked: 1

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: 005] | Final | Spring 2022 | 10 | 1 |

## SEMESTER_PAPERS

### Spring 2022
| # | Question | Exam | Marks | Source |
|---|----------|------|-------|--------|
| 1 | [QID: 001] | Final | 10 | s22.pdf :: p1 :: 0.05,0.10,0.95,0.30 |
| 2 | [QID: 003] | Final | 15 | s22.pdf :: p1 :: 0.05,0.30,0.95,0.60 |
| 3 | [QID: 005] | Final | 10 | s22.pdf :: p2 :: 0.05,0.05,0.95,0.40 |

### Fall 2022
| # | Question | Exam | Marks | Source |
|---|----------|------|-------|--------|
| 1 | [QID: 001] | Final | 10 | f22.pdf :: p1 :: 0.05,0.10,0.95,0.30 |
| 2 | [QID: 003] | Final | 15 | f22.pdf :: p1 :: 0.05,0.30,0.95,0.60 |

### Spring 2023
| # | Question | Exam | Marks | Source |
|---|----------|------|-------|--------|
| 1 | [QID: 006] | Mid | 5 | mid23.pdf :: p1 :: 0.05,0.10,0.95,0.30 |
| 1 | [QID: 002] | Final | 10 | s23.pdf :: p1 :: 0.05,0.10,0.95,0.30 |
| 2 | [QID: 003] | Final | 15 | s23.pdf :: p1 :: 0.05,0.30,0.95,0.60 |
| 3 | [QID: 004] | Final | 10 | s23.pdf :: p2 :: 0.05,0.05,0.95,0.40 |

### Fall 2023
| # | Question | Exam | Marks | Source |
|---|----------|------|-------|--------|
| 1 | [QID: 002] | Final | 10 | f23.pdf :: p1 :: 0.05,0.10,0.95,0.30 |
| 2 | [QID: 004] | Final | 10 | f23.pdf :: p1 :: 0.05,0.30,0.95,0.60 |
| 4 | [QID: 001] | Final | 10 | f23.pdf :: p2 :: 0.05,0.30,0.95,0.60 |

## PAPER_INVENTORY

| Semester | Exam | File | Questions on paper | Question numbers |
|----------|------|------|--------------------|------------------|
| Spring 2022 | Final | s22.pdf | 3 | 1, 2, 3 |
| Fall 2022 | Final | f22.pdf | 2 | 1-2 |
| Spring 2023 | Mid | mid23.pdf | 1 | 1 |
| Spring 2023 | Final | s23.pdf | 3 | 1, 2, 3 |
| Fall 2023 | Final | f23.pdf | 4 | 1, 2, 3, 4 |
`;

const parsed = () => parseQuestionBank(FIXTURE).data;

describe('PAPER_INVENTORY parsing', () => {
  it('reads every inventory row with its printed numbers', () => {
    const data = parsed();
    expect(data.inventory).toHaveLength(5);
    expect(data.inventory[1]).toMatchObject({ semester: 'Fall 2022', exam: 'Final', file: 'f22.pdf', count: 2, numbers: [1, 2] });
    expect(data.inventory[4].numbers).toEqual([1, 2, 3, 4]);
  });

  it('does not break the master pool or the semester papers', () => {
    const data = parsed();
    expect(data.topics.map((topic) => topic.name)).toEqual(['Keys', 'Normalization', 'SQL', 'File Organization']);
    expect(data.semesterPapers).toHaveLength(4);
    expect(data.semesterPapers[3].questions.map((row) => row.number)).toEqual([1, 2, 4]);
    expect(data.semesterPapers[0].questions[0].question).toBe('Define super key and candidate key.');
  });

  it('parses printed number lists and ranges', () => {
    expect(parseQuestionNumbers('1, 2, 3')).toEqual([1, 2, 3]);
    expect(parseQuestionNumbers('1-4')).toEqual([1, 2, 3, 4]);
    expect(parseQuestionNumbers('Q1–Q3, 5')).toEqual([1, 2, 3, 5]);
    expect(parseQuestionNumbers('1 to 3')).toEqual([1, 2, 3]);
    expect(parseQuestionNumbers('-')).toEqual([]);
  });
});

describe('buildCoverage', () => {
  it('names the exact printed question the AI skipped', () => {
    const coverage = buildCoverage(parsed());
    expect(coverage.hasInventory).toBe(true);
    expect(coverage.expected).toBe(13);
    expect(coverage.found).toBe(12);
    expect(coverage.missingCount).toBe(1);
    const fall23 = coverage.entries.find((entry) => entry.semester === 'Fall 2023');
    expect(fall23).toMatchObject({ status: 'missing', missing: [3], file: 'f23.pdf' });
  });

  it('keeps a mid and a final of the same semester apart', () => {
    const coverage = buildCoverage(parsed());
    const spring = coverage.entries.filter((entry) => entry.semester === 'Spring 2023');
    expect(spring.map((entry) => [entry.exam, entry.status])).toEqual([['Mid', 'ok'], ['Final', 'ok']]);
  });

  it('builds a recovery prompt for the same chat', () => {
    const data = parsed();
    const prompt = buildRecoveryPrompt(data, buildCoverage(data));
    expect(prompt).toContain('Fall 2023 Final — file f23.pdf: question 3');
    expect(prompt).toContain('R001');
    expect(prompt).toContain('Keys; Normalization; SQL; File Organization');
  });

  it('returns no prompt when nothing is missing', () => {
    expect(buildRecoveryPrompt(parsed(), { entries: [] })).toBe('');
  });

  it('matches loosely written semesters', () => {
    expect(sameSemester('Fall 2023', 'fall-23')).toBe(true);
    expect(sameSemester('Fall 2023', 'Spring 2023')).toBe(false);
  });
});

describe('recovery part merges back in paper order', () => {
  it('puts the recovered question between #2 and #4', () => {
    const recovery = `---
course: CSE 3101
files: [f23.pdf]
---

[QID: R001] Explain two-phase locking.
Topic: Transactions
Semesters: Fall 2023

## TOPIC: Transactions
priority: LOW
total_asked: 1

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: R001] | Final | Fall 2023 | 10 | 1 |

## SEMESTER_PAPERS

### Fall 2023
| # | Question | Exam | Marks | Source |
|---|----------|------|-------|--------|
| 3 | [QID: R001] | Final | 10 | f23.pdf :: p2 :: 0.05,0.05,0.95,0.30 |
`;
    const { data } = parseQuestionBankParts([FIXTURE, recovery]);
    const fall = data.semesterPapers.find((paper) => paper.semester === 'Fall 2023');
    expect(fall.questions.map((row) => row.number)).toEqual([1, 2, 3, 4]);
    expect(fall.questions[2].question).toBe('Explain two-phase locking.');
    expect(data.files).toEqual(['s22.pdf', 'f22.pdf', 's23.pdf', 'f23.pdf', 'mid23.pdf']);
    expect(data.inventory).toHaveLength(5);
    expect(buildCoverage(data).missingCount).toBe(0);
  });
});

describe('manualQuestionsToMarkdown', () => {
  it('produces a part the parser reads, with a crop box', () => {
    const markdown = manualQuestionsToMarkdown([
      { semester: 'Fall 2023', exam: 'Final', number: 3, marks: 10, topic: 'Keys', file: 'f23.pdf', page: 2, box: [0.05, 0.1, 0.95, 0.4] },
    ], { course: 'CSE 3101', title: 'Database Systems' });
    const { data, errors } = parseQuestionBank(markdown);
    expect(errors).toEqual([]);
    expect(data.topics[0].name).toBe('Keys');
    const row = data.semesterPapers[0].questions[0];
    expect(row.number).toBe(3);
    expect(row.sourceRegions[0]).toMatchObject({ file: 'f23.pdf', page: 2, kind: 'box' });
    expect(row.needsFigure).toBe(true);

    const merged = parseQuestionBankParts([FIXTURE, markdown]).data;
    expect(buildCoverage(merged).missingCount).toBe(0);
  });

  it('returns nothing for an empty list', () => {
    expect(manualQuestionsToMarkdown([])).toBe('');
  });
});

describe('buildTopicTrends', () => {
  it('orders finals oldest first and counts hits per topic', () => {
    const trends = buildTopicTrends(parsed(), { exam: 'Final' });
    expect(trends.papers.map((paper) => paper.semester)).toEqual(['Spring 2022', 'Fall 2022', 'Spring 2023', 'Fall 2023']);
    const keys = trends.topics.find((topic) => topic.name === 'Keys');
    expect(keys.hits).toBe(4);
    expect(keys.cells.map((cell) => cell.count)).toEqual([1, 1, 1, 2]);
    expect(trends.topics[0].name).toBe('Keys');
  });

  it('labels due, cooling and new topics', () => {
    const trends = buildTopicTrends(parsed(), { exam: 'Final' });
    const byName = Object.fromEntries(trends.topics.map((topic) => [topic.name, topic]));
    expect(byName.Normalization.trend).toBe('due');
    expect(byName['File Organization'].trend).toBe('cooling');
    expect(byName.SQL.trend).toBe('new');
  });

  it('lists exam types with the most papers first', () => {
    expect(examOptions(parsed())).toEqual([{ exam: 'Final', count: 4 }, { exam: 'Mid', count: 1 }]);
  });

  it('falls back to topic rows when there are no raw papers', () => {
    const legacy = `## TOPIC: A
| # | Question | Exam | Semester | Marks | Times |
|---|---|---|---|---|---|
| 1 | Q one | Final | Spring 2022, Fall 2022 | 10 | 2 |
`;
    const { occurrences, source } = buildOccurrences(parseQuestionBank(legacy).data);
    expect(source).toBe('topics');
    expect(occurrences.map((item) => item.semester)).toEqual(['Spring 2022', 'Fall 2022']);
  });

  it('maps scores to readable bands', () => {
    expect(chanceBand(0.8).label).toBe('Very likely');
    expect(chanceBand(0.1).label).toBe('Unlikely');
  });
});

describe('predictPaper', () => {
  it('infers the usual paper shape', () => {
    expect(inferPaperStructure(parsed(), 'Final')).toMatchObject({ questionCount: 3, marksEach: 10, paperCount: 4 });
  });

  it('fills every slot with a distinct syllabus topic, in the usual order', () => {
    const paper = predictPaper(parsed(), { exam: 'Final', questionCount: 3, marks: 10 });
    expect(paper.slots).toHaveLength(3);
    expect(new Set(paper.slots.map((slot) => slot.topic)).size).toBe(3);
    expect(paper.slots[0].topic).toBe('Keys');
    expect(paper.slots.every((slot) => slot.question && slot.reason.startsWith('Came in'))).toBe(true);
    expect(paper.totalMarks).toBe(30);
  });

  it('respects the syllabus', () => {
    const paper = predictPaper(parsed(), {
      exam: 'Final',
      questionCount: 2,
      marks: [10, 15],
      syllabus: new Set(['SQL', 'Normalization']),
    });
    expect(paper.slots.map((slot) => slot.topic).sort()).toEqual(['Normalization', 'SQL']);
    expect(paper.slots.map((slot) => slot.marks)).toEqual([10, 15]);
    expect(paper.backups).toEqual([]);
  });

  it('repeats a topic only with a different question', () => {
    const paper = predictPaper(parsed(), { exam: 'Final', questionCount: 3, syllabus: new Set(['Keys']), marks: 10 });
    const texts = paper.slots.map((slot) => slot.question.text);
    expect(new Set(texts).size).toBe(texts.length);
    expect(paper.slots.length).toBe(2);
  });

  it('picks the most-asked wording and crops its latest paper', () => {
    const paper = predictPaper(parsed(), { exam: 'Final', questionCount: 1, syllabus: new Set(['Keys']), marks: 10 });
    expect(paper.slots[0].question.text).toBe('Define super key and candidate key.');
    expect(paper.slots[0].question.count).toBe(3);
    expect(paper.slots[0].question.sourceRegions[0]).toMatchObject({ file: 'f23.pdf', page: 2 });
    expect(paper.slots[0].alternates[0].text).toBe('Find all candidate keys of R(A,B,C,D).');
  });

  it('widens to every exam when the chosen exam has too few papers', () => {
    const paper = predictPaper(parsed(), { exam: 'Mid', questionCount: 2, marks: 5 });
    expect(paper.usedAllExams).toBe(true);
    expect(paper.slots).toHaveLength(2);
  });
});

describe('syllabus and marks helpers', () => {
  it('matches topics by phrase or by most of their words', () => {
    const text = 'Unit 1: Relational model, keys and constraints. Unit 2: SQL queries. Unit 3: Normal forms and normalization.';
    const matched = matchSyllabusTopics(['Keys', 'SQL', 'Normalization', 'File Organization', 'Transaction Management'], text);
    expect([...matched].sort()).toEqual(['Keys', 'Normalization', 'SQL']);
  });

  it('reads mark lists in several shapes', () => {
    expect(parseMarksList('10', 3)).toEqual([10, 10, 10]);
    expect(parseMarksList('10, 15, 15', 3)).toEqual([10, 15, 15]);
    expect(parseMarksList('2x10 1x15', 3)).toEqual([10, 10, 15]);
    expect(parseMarksList('', 3)).toEqual([]);
  });
});

describe('demo sample (shown to free visitors)', () => {
  it('parses cleanly and shows every new view something real', async () => {
    const { readFileSync } = await import('node:fs');
    const markdown = readFileSync(new URL('../../../samples/sample_analysis_demo.md', import.meta.url), 'utf8');
    const { data, errors, warnings } = parseQuestionBank(markdown);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(data.topics).toHaveLength(8);

    const coverage = buildCoverage(data);
    expect(coverage.missingCount).toBe(1);
    expect(coverage.entries.find((entry) => entry.missing.length)).toMatchObject({ semester: 'Fall 2024', exam: 'Final', missing: [6] });

    const trends = buildTopicTrends(data, { exam: 'Final' });
    const byName = Object.fromEntries(trends.topics.map((topic) => [topic.name, topic.trend]));
    expect(byName['Normalization']).toBe('due');
    expect(byName['ER Modeling']).toBe('cooling');

    const paper = predictPaper(data, { exam: 'Final', questionCount: 6, marks: [10, 10, 10, 10, 15, 15] });
    expect(paper.slots).toHaveLength(6);
    expect(paper.slots.map((slot) => slot.topic)).toContain('Normalization');
  });
});
