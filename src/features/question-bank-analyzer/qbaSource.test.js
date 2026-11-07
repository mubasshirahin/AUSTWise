import { describe, it, expect } from 'vitest';
import {
  parseQuestionBank,
  parseSourceCell,
  parseSourceRegion,
  extractQidRef,
} from './parseQuestionBank';

describe('Source parser', () => {
  it('parses a single region with a box', () => {
    expect(parseSourceRegion('a.pdf :: p1 :: 0.05,0.18,0.95,0.42')).toEqual({
      file: 'a.pdf',
      kind: 'box',
      page: 1,
      box: [0.05, 0.18, 0.95, 0.42],
      invalidBox: false,
      raw: 'a.pdf :: p1 :: 0.05,0.18,0.95,0.42',
    });
  });

  it('parses multiple regions separated by ;', () => {
    const regions = parseSourceCell('5__Fall_22__5_.pdf :: p2 :: 0.04,0.60,0.96,0.97 ; 5__Fall_22__5_.pdf :: p3 :: 0.04,0.03,0.96,0.30');
    expect(regions).toHaveLength(2);
    expect(regions[0].page).toBe(2);
    expect(regions[1].page).toBe(3);
  });

  it('handles ? and none as text-only sources', () => {
    expect(parseSourceRegion('a.pdf :: ?')).toEqual({ file: 'a.pdf', kind: 'unknown', raw: 'a.pdf :: ?' });
    expect(parseSourceRegion('notes.txt :: none')).toEqual({ file: 'notes.txt', kind: 'none', raw: 'notes.txt :: none' });
  });

  it('clamps numbers and flags invalid boxes', () => {
    const clamped = parseSourceRegion('a.pdf :: p1 :: -0.2,0.1,1.5,0.5');
    expect(clamped.box).toEqual([0, 0.1, 1, 0.5]);
    expect(clamped.invalidBox).toBe(false);
    const bad = parseSourceRegion('a.pdf :: p1 :: 0.8,0.2,0.4,0.5');
    expect(bad.box).toEqual([0, 0, 1, 1]);
    expect(bad.invalidBox).toBe(true);
  });

  it('keeps spaces and underscores in file names', () => {
    expect(parseSourceRegion('My File_01.pdf :: p1 :: 0.1,0.1,0.9,0.9').file).toBe('My File_01.pdf');
  });

  it('extracts the QID reference from a paper row', () => {
    expect(extractQidRef('[QID: 007]')).toBe('007');
    expect(extractQidRef('no ref here')).toBe('');
  });
});

describe('parseQuestionBank with Source', () => {
  const WITH_SOURCE = `---
course: CSE 3109
title: Digital System Design
semesters: [Spring 2022, Fall 2022]
files: [6__Spring_22__4_.pdf, 5__Fall_22__5_.pdf]
total_questions_extracted: 3
total_rows_after_merge: 2
---

## TOPIC: Counter Design
priority: HIGH
total_asked: 3

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: 001] | Final | Spring 2022, Fall 2022 | 10 | 2 |
| 2 | [QID: 002] | Final | Fall 2022 | 10 | 1 |

## VIP_MATRIX

| Topic | Times Asked | Avg Marks | Semesters Present | Last Asked | Priority |
|-------|-------------|-----------|-------------------|------------|----------|
| Counter Design | 3 | 10 | Spring 2022, Fall 2022 | Fall 2022 | HIGH |

## STUDY_PLAN

1. Counter Design — asked 3 times.

## SEMESTER_PAPERS

### Spring 2022
| # | Question | Exam | Marks | Source |
|---|----------|------|-------|--------|
| 1 | [QID: 001] | Final | 10 | 6__Spring_22__4_.pdf :: p1 :: 0.05,0.18,0.95,0.42 |

### Fall 2022
| # | Question | Exam | Marks | Source |
|---|----------|------|-------|--------|
| 1 | [QID: 001] | Final | 10 | 5__Fall_22__5_.pdf :: p2 :: 0.04,0.60,0.96,0.97 ; 5__Fall_22__5_.pdf :: p3 :: 0.04,0.03,0.96,0.30 |
| 2 | [QID: 002] | Final | 10 | 5__Fall_22__5_.pdf :: ? |

---
`;

  it('reads files front matter and per-row sources', () => {
    const { data, errors } = parseQuestionBank(WITH_SOURCE);
    expect(errors).toEqual([]);
    expect(data.files).toEqual(['6__Spring_22__4_.pdf', '5__Fall_22__5_.pdf']);
    expect(data.semesterPapers).toHaveLength(2);
    expect(data.semesterPapers[0].questions[0].sourceRegions).toMatchObject([{ file: '6__Spring_22__4_.pdf', page: 1 }]);
    expect(data.semesterPapers[1].questions[0].sourceRegions).toHaveLength(2);
    expect(data.semesterPapers[1].questions[0].qid).toBe('001');
    expect(data.semesterPapers[1].questions[1].sourceRegions[0].kind).toBe('unknown');
  });

  it('still parses old files without a Source column', () => {
    const old = `---
course: CSE 3101
title: Database
---
## TOPIC: Keys
priority: VIP
total_asked: 1
| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | Define a key | Final | Spring 2023 | 5 | 1 |
`;
    const { data, errors } = parseQuestionBank(old);
    expect(errors).toEqual([]);
    expect(data.files).toEqual([]);
    expect(data.semesterPapers).toEqual([]);
  });
});
