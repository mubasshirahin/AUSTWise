import { describe, it, expect } from 'vitest';
import { parsePaperNumberCell, parseQuestionBank } from './parseQuestionBank';
import { questionCheckIds } from './qbaChecklist';
import {
  countSolvedSingles,
  formatSingleNumber,
  isSingleSolved,
  rowSingles,
  singleToggleChanges,
  splitIntoSingles,
} from './qbaSingles';

describe('parsePaperNumberCell', () => {
  it.each([
    ['2', 2, ''],
    ['2a', 2, 'a'],
    ['2(b)', 2, 'b'],
    ['2.c)', 2, 'c'],
    ['Q4ii', 4, 'ii'],
    ['12', 12, ''],
  ])('reads %s', (cell, number, part) => {
    expect(parsePaperNumberCell(cell)).toEqual({ number, part });
  });
});

describe('splitIntoSingles', () => {
  it('turns every sub-part into its own item with the shared stem', () => {
    const singles = splitIntoSingles('Normalize R.\n(a) Find partial dependencies.\n(b) Show each step.');
    expect(singles.map((item) => item.label)).toEqual(['a', 'b']);
    expect(singles[0].stem).toBe('Normalize R.');
    expect(singles[1].text).toBe('Show each step.');
  });

  it('keeps a question with no parts whole', () => {
    expect(splitIntoSingles('Define 3NF.')).toEqual([
      { label: '', idLabel: '', text: 'Define 3NF.', stem: '', index: 0, part: null },
    ]);
  });

  it('keeps only the printed part when a "2b" row still holds every part', () => {
    const singles = splitIntoSingles('Stem.\n(a) First.\n(b) Second.', 'b');
    expect(singles).toHaveLength(1);
    expect(singles[0].text).toBe('Second.');
  });

  it('strips a lone leading label and keeps it as the part', () => {
    const [single] = splitIntoSingles('(b) Explain BCNF.', 'b');
    expect(single.label).toBe('b');
    expect(single.text).toBe('Explain BCNF.');
  });
});

describe('formatSingleNumber', () => {
  it('writes 2)a for a part and the plain number otherwise', () => {
    expect(formatSingleNumber(2, 'a')).toBe('2)a');
    expect(formatSingleNumber(3, '')).toBe('3');
  });
});

describe('solved ticks per part', () => {
  const question = { question: 'Stem.\n(a) First.\n(b) Second.' };
  const singles = rowSingles('SQL', question);

  it('gives every part its own id', () => {
    expect(singles).toHaveLength(2);
    expect(singles[0].id).not.toBe(singles[1].id);
  });

  it('keeps an old whole-row tick for every part', () => {
    const items = Object.fromEntries(questionCheckIds('SQL', question).map((id) => [id, { solved: true }]));
    expect(singles.every((single) => isSingleSolved(items, single))).toBe(true);
    expect(countSolvedSingles([{ name: 'SQL', questions: [question] }], items)).toEqual({ total: 2, solved: 2, percent: 100 });
  });

  it('unticking one part of an old row tick keeps the other part ticked', () => {
    const items = Object.fromEntries(questionCheckIds('SQL', question).map((id) => [id, { solved: true }]));
    const changes = singleToggleChanges(items, singles[0], singles);
    const next = { ...items };
    Object.entries(changes).forEach(([id, solved]) => { next[id] = { solved }; });
    expect(isSingleSolved(next, singles[0])).toBe(false);
    expect(isSingleSolved(next, singles[1])).toBe(true);
  });

  it('ticks only the clicked part', () => {
    expect(singleToggleChanges({}, singles[1], singles)).toEqual({ [singles[1].id]: true });
  });
});

describe('paper rows with parts', () => {
  it('keeps the printed part of every row', () => {
    const markdown = `---
course: CSE 1
title: T
---

[QID: 001] Normalize R.<br>(a) Find keys.
Topic: Keys
Semesters: Fall 2024

[QID: 002] Normalize R.<br>(b) Decompose to BCNF.
Topic: Normalization
Semesters: Fall 2024

## TOPIC: Keys
priority: HIGH
total_asked: 1

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: 001] | Final | Fall 2024 | 5 | 1 |

## TOPIC: Normalization
priority: VIP
total_asked: 1

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: 002] | Final | Fall 2024 | 5 | 1 |

## SEMESTER_PAPERS

### Fall 2024
| # | Question | Exam | Marks | Source |
|---|----------|------|-------|--------|
| 2a | [QID: 001] | Final | 5 | a.pdf :: p1 :: 0.05,0.10,0.95,0.30 |
| 2b | [QID: 002] | Final | 5 | a.pdf :: p1 :: 0.05,0.30,0.95,0.50 |
`;
    const { data } = parseQuestionBank(markdown);
    const rows = data.semesterPapers[0].questions;
    expect(rows.map((row) => [row.number, row.part])).toEqual([[2, 'a'], [2, 'b']]);
    expect(rows[1].sourceRegions[0].box).toEqual([0.05, 0.3, 0.95, 0.5]);
  });
});
