import { describe, it, expect } from 'vitest';
import {
  parseQuestionBank,
  parseQuestionBankParts,
  mergeAnalyses,
  normalizePriority,
  parseCount,
  sortVipMatrix,
  extractFigureMarker,
  parseMasterPool,
  splitQuestionVersions,
  splitSubQuestions,
  splitSemesterList,
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

const MULTI_SEMESTER = `---
course: CSE 3109
title: Digital System Design
semesters: [Spring 2023, Fall 2023, Spring 2024]
total_questions_extracted: 12
total_rows_after_merge: 2
---

## TOPIC: Combinational Logic
priority: HIGH
total_asked: 5

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | Version 1: Simplify F.<br>Version 2: Minimise F with a K-map. | Final | Spring 2023, Fall 2023, Spring 2024 | 15 | 4 |
| 2 | [image] Design a 4-bit adder | Mid | Fall 2023 | 10 | 1 |

## VIP_MATRIX

| Topic | Times Asked | Avg Marks | Semesters Present | Last Asked | Priority |
|-------|-------------|-----------|-------------------|------------|----------|
| Combinational Logic | 5 | 14 | Spring 2023, Fall 2023, Spring 2024 | Spring 2024 | HIGH |

## STUDY_PLAN

1. Combinational Logic - asked 5 times.`;

describe('parseQuestionBank — merged questions across semesters', () => {
  const { data, warnings, errors } = parseQuestionBank(MULTI_SEMESTER);

  it('keeps the whole semester list in the question row', () => {
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(data.topics[0].questions[0].semester)
      .toBe('Spring 2023, Fall 2023, Spring 2024');
    expect(data.topics[0].questions[0].versions).toHaveLength(2);
    expect(data.topics[0].questions[1].needsFigure).toBe(true);
  });

  it('splits the list for coverage and "last asked"', () => {
    expect(data.semesters).toEqual(['Spring 2023', 'Fall 2023', 'Spring 2024']);
    expect(data.topics[0].lastAsked).toBe('Spring 2024');
    expect(data.vipMatrix[0].lastAsked).toBe('Spring 2024');
    expect(splitSemesterList('Spring 2023, Fall 2023')).toEqual(['Spring 2023', 'Fall 2023']);
    expect(splitSemesterList('-')).toEqual([]);
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

describe('splitSubQuestions', () => {
  it('splits a stem and its lettered parts', () => {
    expect(
      splitSubQuestions('Define super key.\n(a) Explain the difference from a candidate key.\n(b) Show a relation with two candidate keys.'),
    ).toEqual({
      stem: 'Define super key.',
      parts: [
        { number: '', label: 'a', text: 'Explain the difference from a candidate key.' },
        { number: '', label: 'b', text: 'Show a relation with two candidate keys.' },
      ],
    });
  });

  it('keeps a main number written in front of the letter', () => {
    expect(
      splitSubQuestions('Define super key.\n2.a) First part\n2.b) Second part'),
    ).toEqual({
      stem: 'Define super key.',
      parts: [
        { number: '2', label: 'a', text: 'First part' },
        { number: '2', label: 'b', text: 'Second part' },
      ],
    });
  });

  it('keeps roman and Bengali markers', () => {
    expect(
      splitSubQuestions('(i) One\n(ii) Two'),
    ).toEqual({
      stem: '',
      parts: [
        { number: '', label: 'i', text: 'One' },
        { number: '', label: 'ii', text: 'Two' },
      ],
    });

    expect(
      splitSubQuestions('(ক) এক\n(খ) দুই').parts.map((part) => part.label),
    ).toEqual(['ক', 'খ']);
  });

  it('leaves a plain question whole', () => {
    expect(splitSubQuestions('Define candidate key and primary key')).toEqual({
      stem: 'Define candidate key and primary key',
      parts: [],
    });
  });

  it('keeps wrapped lines inside the part they belong to', () => {
    const result = splitSubQuestions('Explain keys.\n(a) First line\nsecond line\n(b) Last part');

    expect(result.parts).toEqual([
      { number: '', label: 'a', text: 'First line\nsecond line' },
      { number: '', label: 'b', text: 'Last part' },
    ]);
  });

  it('does not split a lone marker with no stem', () => {
    expect(splitSubQuestions('(a) only one part')).toEqual({
      stem: '(a) only one part',
      parts: [],
    });
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

describe('parseQuestionBank — raw semester papers', () => {
  const WITH_PAPERS = `---
course: CSE 3109
title: Digital System Design
semesters: [Spring 2017, Fall 2017]
---

## TOPIC: Handshaking
priority: HIGH
total_asked: 3

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | Version 1: Explain handshaking.<br>Version 2: Describe the handshake sequence. | Final | Spring 2017, Fall 2017 | 4 | 3 |

## VIP_MATRIX

| Topic | Times Asked | Avg Marks | Last Asked | Priority |
|-------|-------------|-----------|------------|----------|
| Handshaking | 3 | 4 | Fall 2017 | HIGH |

## STUDY_PLAN

1. Handshaking - asked 3 times.

## SEMESTER_PAPERS

### Spring 2017
| # | Question | Exam | Marks |
|---|----------|------|-------|
| 1 | Explain handshaking. | Final | 4 |
| 2 | [image] Derive the simplified function for D and B0 of Figure 1. | Final | 4 |
| 2 | Explain handshaking. | Mid | 2 |

### Fall 2017
| # | Question | Exam | Marks |
|---|----------|------|-------|
| 1 | Describe the handshake sequence. | Final | 4 |`;

  it('keeps every raw row, in order, without merging duplicates', () => {
    const { data } = parseQuestionBank(WITH_PAPERS);

    expect(data.semesterPapers).toHaveLength(2);
    const [spring, fall] = data.semesterPapers;
    expect(spring.semester).toBe('Spring 2017');
    expect(spring.questions.map((question) => question.question)).toEqual([
      'Explain handshaking.',
      'Derive the simplified function for D and B0 of Figure 1.',
      'Explain handshaking.',
    ]);
    expect(fall.questions).toHaveLength(1);
    expect(fall.questions[0].question).toBe('Describe the handshake sequence.');
  });

  it('keeps the picture marker and the marks of a raw question', () => {
    const { data } = parseQuestionBank(WITH_PAPERS);
    const picture = data.semesterPapers[0].questions[1];

    expect(picture.needsFigure).toBe(true);
    expect(picture.figurePosition).toBe('start');
    expect(picture.question).not.toMatch(/\[image\]/i);
    expect(picture.marks).toBe(4);
    expect(picture.exam).toBe('Final');
  });

  it('keeps the merged topic rows separate from the raw papers', () => {
    const { data } = parseQuestionBank(WITH_PAPERS);

    expect(data.topics[0].questions).toHaveLength(1);
    expect(data.topics[0].questions[0].versions).toHaveLength(2);
  });

  it('adds the raw papers in every part when analyses are merged', () => {
    const first = parseQuestionBank(WITH_PAPERS);
    const second = parseQuestionBank(WITH_PAPERS);
    const merged = parseQuestionBankParts([WITH_PAPERS, WITH_PAPERS]);

    expect(first.data.semesterPapers).toHaveLength(2);
    expect(second.data.semesterPapers).toHaveLength(2);
    // Exact repeats from a "continue" overlap must not double the paper.
    expect(merged.data.semesterPapers).toHaveLength(2);
    expect(merged.data.semesterPapers[0].questions).toHaveLength(3);
  });
});

describe('master question pool (QID references)', () => {
  const QID_FILE = `---
course: CSE 3109
title: Digital System Design
semesters: [Spring 2025, Fall 2024]
---

<!-- MASTER QUESTION POOL (SINGLE SOURCE OF TRUTH) -->
<!-- [QID: 001] Explain the ALU with a block diagram. [image] -->
<!-- Answer: The ALU performs arithmetic and logic operations. -->
<!-- Topic: 8085 Architecture -->
<!-- Semesters: Spring 2025, Fall 2024 -->
<!-- [QID: 002] Design a full adder using only NAND gates. -->
<!-- Answer: Two half adders and an OR gate. -->
<!-- Topic: Logic Design -->
<!-- Semesters: Fall 2024 -->

## TOPIC: 8085 Architecture
priority: VIP
total_asked: 2

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: 001] | Final | Spring 2025, Fall 2024 | 15 | 2 |

## TOPIC: Logic Design
priority: HIGH
total_asked: 1

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: 002] | Mid | Fall 2024 | 10 | 1 |

## VIP_MATRIX

| Topic | Times Asked | Avg Marks | Last Asked | Priority |
|-------|-------------|-----------|------------|----------|
| 8085 Architecture | 2 | 15 | Spring 2025 | VIP |
| Logic Design | 1 | 10 | Fall 2024 | HIGH |

## STUDY_PLAN

1. 8085 Architecture — asked 2 times, most recent Spring 2025.
2. Logic Design — asked once, Fall 2024.

## SEMESTER_PAPERS

### Spring 2025
| # | Question | Exam | Marks |
|---|----------|------|-------|
| 1 | [QID: 001] | Final | 15 |

### Fall 2024
| # | Question | Exam | Marks |
|---|----------|------|-------|
| 1 | [QID: 002] | Mid | 10 |`;

  it('reads the master pool and resolves QID references in topic rows', () => {
    const { data, warnings } = parseQuestionBank(QID_FILE);

    expect(warnings).toEqual([]);
    expect(data.topics).toHaveLength(2);
    expect(data.topics[0].questions[0].question)
      .toBe('Explain the ALU with a block diagram.');
    expect(data.topics[0].questions[0].needsFigure).toBe(true);
    expect(data.topics[1].questions[0].question)
      .toBe('Design a full adder using only NAND gates.');
  });

  it('resolves QID references in the raw semester papers', () => {
    const { data } = parseQuestionBank(QID_FILE);

    expect(data.semesterPapers).toHaveLength(2);
    expect(data.semesterPapers[0].questions[0].question)
      .toBe('Explain the ALU with a block diagram.');
    expect(data.semesterPapers[0].questions[0].needsFigure).toBe(true);
    expect(data.semesterPapers[1].questions[0].question)
      .toBe('Design a full adder using only NAND gates.');
  });

  it('keeps sub-parts printed on the paper when the master entry has none', () => {
    const file = QID_FILE.replace(
      '| 1 | [QID: 002] | Mid | 10 |',
      '| 1 | [QID: 002]<br>1.a) Write the truth table.<br>1.b) Draw the circuit. | Mid | 10 |',
    );
    const { data } = parseQuestionBank(file);
    const { stem, parts } = splitSubQuestions(data.semesterPapers[1].questions[0].question);

    expect(stem).toBe('Design a full adder using only NAND gates.');
    expect(parts.map((part) => part.label)).toEqual(['a', 'b']);
  });

  it('reads the pool even when the entries are not wrapped in comments', () => {
    const file = QID_FILE
      .replace(/<!--\s*/g, '')
      .replace(/\s*-->/g, '');
    const pool = parseMasterPool(file);

    expect(pool.get('001').question).toContain('Explain the ALU');
    expect(pool.get('001').answer).toContain('arithmetic and logic');
    expect(pool.get('002').topic).toBe('Logic Design');
  });
});

describe('master prompt output — QID-only papers and verified counts', () => {
  const POOL_FILE = `---
course: CSE 3109
title: Digital System Design
semesters: [Spring 2024, Fall 2024]
total_questions_extracted: 3
total_rows_after_merge: 2
---

<!-- MASTER QUESTION POOL (SINGLE SOURCE OF TRUTH) -->
<!-- [QID: 001] Explain the fetch-decode-execute cycle.<br>(a) Draw the timing diagram.<br>(b) Why is the cycle repeated? -->
<!-- Topic: 8085 Architecture -->
<!-- Semesters: Spring 2024, Fall 2024 -->
<!-- [QID: 002] [image] Design a 4-bit adder. -->
<!-- Topic: Combinational Logic -->
<!-- Semesters: Fall 2024 -->

## TOPIC: 8085 Architecture
priority: VIP
total_asked: 2

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: 001] | Final | Spring 2024, Fall 2024 | 15 | 2 |

## TOPIC: Combinational Logic
priority: HIGH
total_asked: 1

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: 002] | Mid | Fall 2024 | 10 | 1 |

## VIP_MATRIX

| Topic | Times Asked | Avg Marks | Last Asked | Priority |
|-------|-------------|-----------|------------|----------|
| 8085 Architecture | 2 | 15 | Fall 2024 | VIP |
| Combinational Logic | 1 | 10 | Fall 2024 | HIGH |

## STUDY_PLAN

1. 8085 Architecture — asked twice.
2. Combinational Logic — asked once.

## SEMESTER_PAPERS

### Spring 2024
| # | Question | Exam | Marks |
|---|----------|------|-------|
| 1 | [QID: 001] | Final | 15 |

### Fall 2024
| # | Question | Exam | Marks |
|---|----------|------|-------|
| 1 | [QID: 001] | Mid | 10 |
| 2 | [QID: 002] | Final | 10 |`;

  it('shows the pool sub-parts in both views, exactly once', () => {
    const { data, warnings, errors } = parseQuestionBank(POOL_FILE);

    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    const topicText = data.topics[0].questions[0].question;
    const paperText = data.semesterPapers[0].questions[0].question;
    expect(splitSubQuestions(topicText).parts).toHaveLength(2);
    expect(splitSubQuestions(paperText).parts).toHaveLength(2);
    expect(topicText).toBe(paperText);
    expect(paperText.match(/fetch-decode-execute/g)).toHaveLength(1);
    expect(data.semesterPapers[1].questions.map((question) => question.question))
      .toEqual([paperText, 'Design a 4-bit adder.']);
    expect(data.semesterPapers[1].questions[1].needsFigure).toBe(true);
  });

  it('warns when the declared extracted count does not match the paper rows', () => {
    const { warnings } = parseQuestionBank(
      POOL_FILE.replace('total_questions_extracted: 3', 'total_questions_extracted: 2'),
    );

    expect(warnings.join('\n')).toMatch(/says 2 question\(s\) were extracted.*hold 3 row\(s\)/);
  });

  it('warns when the declared merged count does not match the topic rows', () => {
    const { warnings } = parseQuestionBank(
      POOL_FILE.replace('total_rows_after_merge: 2', 'total_rows_after_merge: 5'),
    );

    expect(warnings.join('\n')).toMatch(/says 5 question\(s\) remained after merging.*hold 2 row\(s\)/);
  });

  it('warns about a reference with no pool entry', () => {
    const { warnings } = parseQuestionBank(
      POOL_FILE.replace('| 2 | [QID: 002] | Final | 10 |', '| 2 | [QID: 009] | Final | 10 |'),
    );

    expect(warnings.join('\n')).toMatch(/QID: 009/);
    expect(warnings.join('\n')).toMatch(/no entry in the MASTER QUESTION POOL/);
  });

  it('warns about a pool entry that no view uses', () => {
    const { warnings } = parseQuestionBank(POOL_FILE.replace(
      '<!-- Semesters: Fall 2024 -->',
      '<!-- Semesters: Fall 2024 -->\n<!-- [QID: 003] A question that never reached a topic. -->',
    ));

    expect(warnings.join('\n')).toMatch(/QID: 003/);
    expect(warnings.join('\n')).toMatch(/not used by any TOPIC or SEMESTER_PAPERS row/);
  });
});
