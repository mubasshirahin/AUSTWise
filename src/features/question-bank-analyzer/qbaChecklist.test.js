import { describe, it, expect } from 'vitest';
import {
  countSolvedQuestions,
  hashText,
  isQuestionSolved,
  mergeChecklistItems,
  normalizeQuestionText,
  pruneChecklistItems,
  questionCheckId,
  questionCheckIds,
  toggleChecklistIds,
  topicSlug,
} from './qbaChecklist';

describe('checklist ids', () => {
  it('normalises topic names and question text', () => {
    expect(topicSlug('Normalization & Indexing')).toBe('normalization-indexing');
    expect(topicSlug('')).toBe('general');
    expect(normalizeQuestionText('  Explain   ACID\n[image] ')).toBe('explain acid');
  });

  it('gives the same id after whitespace/case changes', () => {
    const a = questionCheckId('Transactions', { question: 'Explain ACID' });
    const b = questionCheckId('Transactions', { question: '  explain   acid ' });
    expect(a).toBe(b);
  });

  it('keeps different topics apart even with the same wording', () => {
    expect(questionCheckId('Transactions', { question: 'Explain ACID' }))
      .not.toBe(questionCheckId('Indexing', { question: 'Explain ACID' }));
  });

  it('gives a merged row one id per wording', () => {
    const row = {
      question: 'Merged',
      variants: [
        { question: 'Explain ACID' },
        { question: 'Define ACID' },
      ],
    };
    const ids = questionCheckIds('Transactions', row);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('toggleChecklistIds', () => {
  it('solves every id of a row, then clears them', () => {
    const ids = ['a', 'b'];
    const solved = toggleChecklistIds({}, ids, '2026-01-01T00:00:00.000Z');
    expect(solved.a).toEqual({ solved: true, updatedAt: '2026-01-01T00:00:00.000Z' });
    expect(solved.b.solved).toBe(true);
    expect(isQuestionSolved(solved, ids)).toBe(true);

    const cleared = toggleChecklistIds(solved, ids, '2026-01-02T00:00:00.000Z');
    expect(cleared.a.solved).toBe(false);
    expect(isQuestionSolved(cleared, ids)).toBe(false);
  });

  it('does not mutate the previous map', () => {
    const before = {};
    const after = toggleChecklistIds(before, ['a'], '2026-01-01T00:00:00.000Z');
    expect(before).toEqual({});
    expect(after.a.solved).toBe(true);
  });
});

describe('mergeChecklistItems', () => {
  it('keeps the newest edit of each id', () => {
    const merged = mergeChecklistItems(
      { a: { solved: false, updatedAt: '2026-01-01T00:00:00.000Z' } },
      { a: { solved: true, updatedAt: '2026-01-02T00:00:00.000Z' } },
    );
    expect(merged.a.solved).toBe(true);
  });

  it('keeps a server item when the local copy is older', () => {
    const merged = mergeChecklistItems(
      { a: { solved: true, updatedAt: '2026-01-03T00:00:00.000Z' } },
      { a: { solved: false, updatedAt: '2026-01-01T00:00:00.000Z' } },
    );
    expect(merged.a.solved).toBe(true);
  });
});

describe('countSolvedQuestions', () => {
  it('counts a merged row once and requires every wording', () => {
    const topics = [{
      name: 'Transactions',
      questions: [
        { question: 'Explain ACID' },
        {
          question: 'Merged',
          variants: [{ question: 'Define ACID' }, { question: 'Why ACID?' }],
        },
      ],
    }];
    const ids = questionCheckIds('Transactions', topics[0].questions[1]);
    const items = {
      [questionCheckId('Transactions', topics[0].questions[0])]: { solved: true },
      [ids[0]]: { solved: true },
    };

    expect(countSolvedQuestions(topics, items)).toEqual({ total: 2, solved: 1, percent: 50 });
  });

  it('returns zeroes for an empty report', () => {
    expect(countSolvedQuestions([], {})).toEqual({ total: 0, solved: 0, percent: 0 });
  });
});

describe('pruneChecklistItems', () => {
  it('drops old tombstones but keeps solved rows', () => {
    const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const kept = pruneChecklistItems({
      solved: { solved: true, updatedAt: old },
      pending: { solved: false, updatedAt: old },
      recent: { solved: false, updatedAt: new Date().toISOString() },
    });
    expect(kept.solved).toBeTruthy();
    expect(kept.pending).toBeUndefined();
    expect(kept.recent).toBeTruthy();
  });
});

describe('hashText', () => {
  it('is stable and returns a short base36 string', () => {
    expect(hashText('hello')).toBe(hashText('hello'));
    expect(hashText('hello')).not.toBe(hashText('hello!'));
    expect(hashText('hello')).toMatch(/^[0-9a-z]+$/);
  });
});
