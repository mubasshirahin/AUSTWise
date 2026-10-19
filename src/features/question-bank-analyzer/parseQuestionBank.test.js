import { describe, it, expect } from 'vitest';
import {
  parseQuestionBank,
  parseQuestionBankParts,
  mergeAnalyses,
  normalizePriority,
  parseCount,
  sortVipMatrix,
  extractFigureMarker,
  splitQuestionVersions,
} from './parseQuestionBank';

const CLEAN = `---
course: CSE 3101
title: Database Management Systems
semesters: [Spring 2023, Fall 2023, Spring 2024]
---

## TOPIC: Relational Keys
priority: VIP
total_asked: 5

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | Define candidate key and primary key | Final | Spring 2024 | 10 | 3 |
| 2 | Difference between primary and foreign key | Quiz | Fall 2023 | 5 | 2 |

## TOPIC: Normalization
priority: HIGH
total_asked: 2

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | Normalize a relation up to 3NF | Final | Spring 2023 | 15 | 2 |

## TOPIC: SQL
priority: LOW
total_asked: 1

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | Write a JOIN query with GROUP BY | Quiz | Spring 2023 | 5 | 1 |

## VIP_MATRIX

| Topic | Times Asked | Avg Marks | Last Asked | Priority |
|-------|-------------|-----------|------------|----------|
| Relational Keys | 5 | 8.3 | Spring 2024 | VIP |
| Normalization | 2 | 15 | Spring 2023 | HIGH |
| SQL | 1 | 5 | Spring 2023 | LOW |

## STUDY_PLAN

1. Relational Keys - highest frequency.
2. Normalization - high marks.
3. SQL - low frequency.`;

const MISSING_MATRIX = `---
course: CSE 3101
title: Database Management Systems
---

## TOPIC: Normalization
priority: LOW
total_asked: 4

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | Normalize a relation to 3NF | Final | Spring 2024 | 15 | 4 |`;

const MISSING_COLUMNS = `---
course: CSE 3101
title: Database Management Systems
---

## TOPIC: Indexing
priority: VIP
total_asked: 2

| # | Question | Times |
|---|----------|-------|
| 1 | Compare B+ tree and hash index | 1 |
| 2 | Calculate disk blocks for a sparse index | 1 |`;

const BAD_PRIORITY = `## TOPIC: Triggers
priority: CRITICAL
total_asked: 2

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | Write an AFTER UPDATE trigger | Mid | Fall 2023 | 10 | 2 |`;

const APPROXIMATE = `## TOPIC: Joins
priority: HIGH
total_asked: 5

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | Explain inner and outer joins | Final | ~Spring 2024 | 10 | ~3 |
| 2 | Write a self join | Mid | Fall 2023 | 5 | 2 |`;

function partA() {
  return `---
course: CSE 3101
title: Database Management Systems
---

## TOPIC: Normalization
priority: HIGH
total_asked: 3

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | Normalize a relation to 3NF | Final | Spring 2024 | 15 | 3 |`;
}

function partB() {
  return `---
course: CSE 3101
title: Database Management Systems
---

## TOPIC: normalization
priority: VIP
total_asked: 5

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | Normalize a relation to 3NF | Final | Spring 2024 | 15 | 3 |
| 2 | Explain BCNF with an example | Mid | Fall 2023 | 10 | 2 |`;
}

describe('parseQuestionBank — clean input', () => {
  it('parses front matter, topics, matrix and study plan', () => {
    const { data, warnings, errors } = parseQuestionBank(CLEAN);

    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(data.course).toBe('CSE 3101');
    expect(data.title).toBe('Database Management Systems');
    expect(data.semesters).toEqual(['Spring 2023', 'Fall 2023', 'Spring 2024']);
    expect(data.topics).toHaveLength(3);
    expect(data.topics[0].name).toBe('Relational Keys');
    expect(data.topics[0].questions[0]).toMatchObject({
      question: 'Define candidate key and primary key',
      exam: 'Final',
      semester: 'Spring 2024',
      marks: 10,
      times: 3,
    });
    expect(data.summary).toMatchObject({
      topicCount: 3,
      totalQuestions: 4,
      totalAsked: 8,
      vipCount: 1,
      highCount: 1,
      mediumCount: 0,
      lowCount: 1,
    });
    expect(data.vipMatrix.map((row) => row.topic)).toEqual([
      'Relational Keys',
      'Normalization',
      'SQL',
    ]);
    expect(data.studyPlan).toHaveLength(3);
  });
});

describe('parseQuestionBank — code fences', () => {
  it('strips a wrapping ```markdown fence', () => {
    const { data, errors } = parseQuestionBank(`\`\`\`markdown\n${CLEAN}\n\`\`\``);
    expect(errors).toEqual([]);
    expect(data.course).toBe('CSE 3101');
    expect(data.topics).toHaveLength(3);
  });
});

describe('parseQuestionBank — casing and whitespace', () => {
  it('accepts lowercase headings, attributes and headers', () => {
    const input = `---
course: CSE 3101
title: Database Systems
---

## topic:   normalization   
PRIORITY:   vip
TOTAL_ASKED: 2

| # | question | exam | semester | marks | times |
|---|----------|------|----------|-------|-------|
| 1 |   Normalize   to BCNF   | final | Spring 2024 | 10 | 2 |

## vip matrix

| topic | times asked | avg marks | last asked | priority |
|-------|-------------|-----------|------------|----------|
| Normalization | 2 | 10 | Spring 2024 | vip |

## study plan

1. Normalization - revise first.`;

    const { data, warnings, errors } = parseQuestionBank(input);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(data.topics[0].name).toBe('normalization');
    expect(data.topics[0].priority).toBe('VIP');
    expect(data.vipMatrix[0].priority).toBe('VIP');
    expect(data.topics[0].questions[0].question).toBe('Normalize to BCNF');
    expect(data.studyPlan[0].text).toBe('Normalization - revise first.');
  });
});

describe('parseQuestionBank — duplicate topic blocks in one file', () => {
  it('merges same-named topics, de-duplicates rows and recomputes counts', () => {
    const input = `## TOPIC: SQL
priority: HIGH
total_asked: 2

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | Write a JOIN query | Final | Spring 2024 | 10 | 2 |

## TOPIC: sql
priority: VIP
total_asked: 3

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | Write a JOIN query | Final | Spring 2024 | 10 | 2 |
| 2 | Explain the query planner | Quiz | Fall 2023 | 5 | 1 |`;

    const { data, warnings, errors } = parseQuestionBank(input);
    expect(errors).toEqual([]);
    expect(data.topics).toHaveLength(1);
    expect(data.topics[0].name).toBe('SQL');
    expect(data.topics[0].priority).toBe('VIP');
    expect(data.topics[0].questions).toHaveLength(2);
    expect(data.topics[0].timesAsked).toBe(3);
    expect(data.topics[0].totalAsked).toBe(3);
    expect(data.topics[0].avgMarks).toBe(7.5);
    expect(warnings.some((message) => /appeared more than once.*1 duplicate/i.test(message))).toBe(true);
  });
});

describe('parseQuestionBank — missing columns', () => {
  it('fills missing columns with "-" while keeping counts', () => {
    const { data, warnings, errors } = parseQuestionBank(MISSING_COLUMNS);
    expect(errors).toEqual([]);
    expect(warnings.some((message) => /missing the Exam, Semester, Marks column/i.test(message))).toBe(true);
    expect(data.topics[0].questions[0]).toMatchObject({
      exam: '-',
      semester: '-',
      marks: null,
      times: 1,
    });
    expect(data.summary.totalAsked).toBe(2);
  });
});

describe('parseQuestionBank — verbatim question text', () => {
  it('keeps the full wording and turns <br> into readable line breaks', () => {
    const input = `## TOPIC: Normalization
priority: HIGH
total_asked: 2

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | Consider the relation R(A, B, C, D) with the following functional dependencies. <br>(a) Find every candidate key and explain why it is minimal. <br>(b) Normalize the relation up to 3NF and show each step. | Final | Spring 2024 | 15 | 2 |`;

    const { data, errors } = parseQuestionBank(input);
    expect(errors).toEqual([]);
    expect(data.topics[0].questions[0].question).toBe(
      'Consider the relation R(A, B, C, D) with the following functional dependencies.\n'
      + '(a) Find every candidate key and explain why it is minimal.\n'
      + '(b) Normalize the relation up to 3NF and show each step.',
    );
  });
});

describe('parseQuestionBank — priorities', () => {
  it('normalises aliases and falls back to MEDIUM for unknown values', () => {
    expect(normalizePriority('vip')).toBe('VIP');
    expect(normalizePriority('HIGH PRIORITY')).toBe('HIGH');
    expect(normalizePriority('medium')).toBe('MEDIUM');
    expect(normalizePriority('Low')).toBe('LOW');
    expect(normalizePriority('CRITICAL')).toBeNull();

    const { data, warnings } = parseQuestionBank(BAD_PRIORITY);
    expect(data.topics[0].priority).toBe('MEDIUM');
    expect(warnings.some((message) => /CRITICAL.*using MEDIUM/i.test(message))).toBe(true);
  });
});

describe('parseQuestionBank — approximate counts', () => {  it('reads "~3" as 3 and flags it as approximate', () => {
    expect(parseCount('~3')).toEqual({ value: 3, approximate: true });
    expect(parseCount('≈ 4')).toEqual({ value: 4, approximate: true });
    expect(parseCount('3x')).toEqual({ value: 3, approximate: false });

    const { data, warnings } = parseQuestionBank(APPROXIMATE);
    expect(data.topics[0].questions[0].times).toBe(3);
    expect(data.topics[0].questions[0].timesApproximate).toBe(true);
    expect(data.topics[0].questions[0].semester).toBe('~Spring 2024');
    expect(data.summary.approximateCount).toBe(1);
    expect(warnings.some((message) => /approximate/i.test(message))).toBe(true);
  });

  it('recomputes total_asked when it disagrees with the Times column', () => {
    const input = BAD_PRIORITY.replace('total_asked: 2', 'total_asked: 99');
    const { data, warnings } = parseQuestionBank(input);
    expect(data.topics[0].totalAsked).toBe(2);
    expect(warnings.some((message) => /99.*add up to 2/i.test(message))).toBe(true);
  });
});

describe('parseQuestionBank — missing VIP matrix', () => {
  it('builds the matrix from topics and sorts VIP > HIGH > MEDIUM > LOW', () => {
    const { data, warnings } = parseQuestionBank(MISSING_MATRIX);
    expect(warnings.some((message) => /No VIP_MATRIX section/i.test(message))).toBe(true);
    expect(data.vipMatrix).toHaveLength(1);
    expect(data.vipMatrix[0]).toMatchObject({
      topic: 'Normalization',
      timesAsked: 4,
      avgMarks: 15,
      lastAsked: 'Spring 2024',
      priority: 'LOW',
    });

    const sorted = sortVipMatrix([
      { topic: 'Low', priority: 'LOW', timesAsked: 99 },
      { topic: 'Medium', priority: 'MEDIUM', timesAsked: 99 },
      { topic: 'High A', priority: 'HIGH', timesAsked: 1 },
      { topic: 'High B', priority: 'HIGH', timesAsked: 8 },
      { topic: 'Vip', priority: 'VIP', timesAsked: 0 },
    ]);
    expect(sorted.map((row) => row.topic)).toEqual(['Vip', 'High B', 'High A', 'Medium', 'Low']);
  });
});

describe('parseQuestionBank — merging parts', () => {
  it('passes a single file through without rewriting its VIP matrix', () => {
    const { data, warnings, errors } = parseQuestionBankParts([CLEAN]);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(data.vipMatrix.map((row) => row.topic)).toEqual([
      'Relational Keys',
      'Normalization',
      'SQL',
    ]);
  });

  it('merges same-named topics and de-duplicates overlap rows', () => {
    const { data, warnings, errors } = parseQuestionBankParts([partA(), partB()]);

    expect(errors).toEqual([]);
    expect(data.topics).toHaveLength(1);
    expect(data.topics[0].name).toBe('Normalization');
    expect(data.topics[0].questions).toHaveLength(2);
    expect(data.topics[0].priority).toBe('VIP');
    expect(data.topics[0].timesAsked).toBe(5);
    expect(data.summary.totalQuestions).toBe(2);
    expect(data.summary.totalAsked).toBe(5);
    expect(data.vipMatrix[0]).toMatchObject({ topic: 'Normalization', timesAsked: 5, priority: 'VIP' });
    expect(warnings.some((message) => /duplicate question row/i.test(message))).toBe(true);
  });

  it('keeps unique rows from both parts in order', () => {
    const merged = mergeAnalyses([parseQuestionBank(partA()), parseQuestionBank(partB())]);
    expect(merged.data.topics[0].questions.map((question) => question.times)).toEqual([3, 2]);
    expect(merged.data.topics[0].questions.map((question) => question.number)).toEqual([1, 2]);
  });

  it('survives one unreadable part and reports it as a warning', () => {
    const { data, warnings, errors } = parseQuestionBankParts([partA(), 'this is not markdown']);
    expect(errors).toEqual([]);
    expect(data.topics).toHaveLength(1);
    expect(warnings.some((message) => /Part 2 could not be read/i.test(message))).toBe(true);
  });
});

describe('parseQuestionBank — bad input never throws', () => {
  it('returns a fatal error for empty input', () => {
    for (const value of ['', '   ', null, undefined, 42]) {
      const result = parseQuestionBank(value);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.data.topics).toEqual([]);
    }
  });

  it('returns a fatal error for garbage that has no sections', () => {
    const { data, warnings, errors } = parseQuestionBank('hello world\n\nthis is just prose, no tables.');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/does not look like a Question Bank Analysis/i);
    expect(data.topics).toEqual([]);
    expect(Array.isArray(warnings)).toBe(true);
  });

  it('returns an error when parts are missing entirely', () => {
    const { errors } = parseQuestionBankParts([]);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('extractFigureMarker', () => {
  it('finds the [image] token and says where the picture was', () => {
    expect(extractFigureMarker('[image] Draw the graph')).toEqual({
      text: 'Draw the graph',
      needsFigure: true,
      figurePosition: 'start',
    });
    expect(extractFigureMarker('Draw the graph [image]')).toEqual({
      text: 'Draw the graph',
      needsFigure: true,
      figurePosition: 'end',
    });
  });

  it('accepts the variants an AI might write', () => {
    for (const marker of ['[image]', '[Image]', '[ image ]', '[[image]]', '[diagram]', '[figure]', '[picture]']) {
      const result = extractFigureMarker(`${marker} Question text`);
      expect(result.needsFigure).toBe(true);
      expect(result.text).toBe('Question text');
    }
  });

  it('also catches a Markdown image', () => {
    const result = extractFigureMarker('Look at this ![graph](https://example.com/a.png) please');
    expect(result.needsFigure).toBe(true);
    expect(result.text).not.toContain('example.com');
  });

  it('leaves a question without a picture alone', () => {
    const result = extractFigureMarker('Define candidate key and primary key');
    expect(result).toEqual({
      text: 'Define candidate key and primary key',
      needsFigure: false,
      figurePosition: 'end',
    });
  });
});

describe('splitQuestionVersions', () => {
  it('splits the AI wordings of one question apart', () => {
    const versions = splitQuestionVersions(
      'Version 1: Find every candidate key.\nVersion 2: List all candidate keys and prove minimality.',
    );

    expect(versions).toEqual([
      { label: 'Version 1', text: 'Find every candidate key.' },
      { label: 'Version 2', text: 'List all candidate keys and prove minimality.' },
    ]);
  });

  it('leaves a plain question alone', () => {
    expect(splitQuestionVersions('Define candidate key and primary key')).toEqual([]);
  });

  it('ignores a question that only mentions a version', () => {
    expect(splitQuestionVersions('Which version 2: is correct?')).toEqual([]);
  });

  it('needs at least two wordings', () => {
    expect(splitQuestionVersions('Version 1: only one')).toEqual([]);
  });
});

describe('parseQuestionBank — picture markers', () => {
  const WITH_FIGURE = `---
course: CSE 3101
title: Database Management Systems
---

## TOPIC: Transactions
priority: HIGH
total_asked: 2

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | Explain ACID properties | Final | Spring 2023 | 10 | 1 |
| 2 | [image] Draw the precedence graph of this schedule | Mid | Fall 2023 | 10 | 1 |

## VIP_MATRIX

| Topic | Times Asked | Avg Marks | Last Asked | Priority |
|-------|-------------|-----------|------------|----------|
| Transactions | 2 | 10 | Fall 2023 | HIGH |`;

  it('flags the question that needs a picture and cleans its text', () => {
    const { data, notes } = parseQuestionBank(WITH_FIGURE);
    const [plain, withFigure] = data.topics[0].questions;

    expect(plain.needsFigure).toBe(false);
    expect(withFigure.needsFigure).toBe(true);
    expect(withFigure.figurePosition).toBe('start');
    expect(withFigure.question).toBe('Draw the precedence graph of this schedule');
    expect(notes.some((message) => /had a picture in the source/i.test(message))).toBe(true);
  });

  it('keeps the marker out of the printed question text', () => {
    const { data } = parseQuestionBank(WITH_FIGURE);
    expect(data.topics[0].questions[1].question).not.toMatch(/\[image\]/i);
  });
});

describe('parseQuestionBank — question versions', () => {
  const WITH_VERSIONS = `---
course: CSE 3101
title: Database Management Systems
---

## TOPIC: Normalization
priority: HIGH
total_asked: 2

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | Version 1: Consider R(A, B, C, D) with AB → C. Find every candidate key.<br>Version 2: For R(A, B, C, D) with AB → C, list the candidate keys and prove minimality. | Final | Spring 2023 | 15 | 2 |
| 2 | Explain BCNF with an example where 3NF fails | Mid | Fall 2023 | 10 | 1 |

## VIP_MATRIX

| Topic | Times Asked | Avg Marks | Last Asked | Priority |
|-------|-------------|-----------|------------|----------|
| Normalization | 3 | 12.5 | Fall 2023 | HIGH |`;

  it('keeps every wording of a merged question', () => {
    const { data } = parseQuestionBank(WITH_VERSIONS);
    const [merged] = data.topics[0].questions;

    expect(merged.versions).toHaveLength(2);
    expect(merged.versions[0]).toEqual({
      label: 'Version 1',
      text: 'Consider R(A, B, C, D) with AB → C. Find every candidate key.',
    });
    expect(merged.versions[1].label).toBe('Version 2');
    expect(merged.versions[1].text).toContain('prove minimality');
  });

  it('gives a plain question no versions', () => {
    const { data } = parseQuestionBank(WITH_VERSIONS);
    expect(data.topics[0].questions[1].versions).toEqual([]);
  });
});
