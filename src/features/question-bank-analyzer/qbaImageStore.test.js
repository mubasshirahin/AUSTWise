import { describe, it, expect } from 'vitest';
import {
  attachImagesToReport,
  courseSlug,
  dataUrlToBlob,
  questionImageKey,
} from './qbaImageStore';

describe('courseSlug', () => {
  it('makes a stable, URL-safe key from a course code', () => {
    expect(courseSlug('CSE 3101')).toBe('cse-3101');
    expect(courseSlug('cse-3101')).toBe('cse-3101');
    expect(courseSlug('')).toBe('default');
    expect(courseSlug(undefined)).toBe('default');
  });
});

describe('questionImageKey', () => {
  it('keys a picture by course, topic and question position', () => {
    expect(questionImageKey('cse-3101', 'Normalization', 2)).toBe('cse-3101::normalization::2');
  });

  it('ignores the case of the topic name', () => {
    expect(questionImageKey('cse-3101', 'Normalization', 2))
      .toBe(questionImageKey('cse-3101', 'NORMALIZATION', 2));
  });
});

describe('attachImagesToReport', () => {
  const report = {
    course: 'CSE 3101',
    title: 'Database Management Systems',
    topics: [
      {
        name: 'Transactions',
        questions: [
          { number: 1, question: 'Explain ACID' },
          { number: 2, question: 'Draw the graph' },
        ],
      },
    ],
  };

  it('puts the picture under the question it belongs to', () => {
    const byQuestion = {
      'cse-3101::transactions::0': [{ id: 'a', name: 'acid.png', url: 'blob:a' }],
    };

    const withImages = attachImagesToReport(report, 'cse-3101', byQuestion);

    expect(withImages.topics[0].questions[0].images).toEqual([
      { name: 'acid.png', url: 'blob:a' },
    ]);
    expect(withImages.topics[0].questions[1].images).toBeUndefined();
  });

  it('uses the original question index when questions were merged', () => {
    const merged = {
      topics: [{
        name: 'Transactions',
        questions: [
          { number: 1, question: 'Merged row', originalIndex: 0 },
          { number: 2, question: 'Another row', originalIndex: 3 },
        ],
      }],
    };
    const byQuestion = {
      'cse-3101::transactions::3': [{ id: 'b', name: 'graph.png', url: 'blob:b' }],
    };

    const withImages = attachImagesToReport(merged, 'cse-3101', byQuestion);

    expect(withImages.topics[0].questions[0].images).toBeUndefined();
    expect(withImages.topics[0].questions[1].images).toHaveLength(1);
  });

  it('never mutates the report it was given', () => {
    const byQuestion = {
      'cse-3101::transactions::0': [{ id: 'a', name: 'acid.png', url: 'blob:a' }],
    };

    const withImages = attachImagesToReport(report, 'cse-3101', byQuestion);

    expect(report.topics[0].questions[0].images).toBeUndefined();
    expect(withImages).not.toBe(report);
  });

  it('returns the report untouched when there are no pictures', () => {
    expect(attachImagesToReport(report, 'cse-3101', {})).toBe(report);
    expect(attachImagesToReport(null, 'cse-3101', {})).toBeNull();
  });
});

describe('dataUrlToBlob', () => {
  it('turns a data URL back into a blob', () => {
    const blob = dataUrlToBlob('data:image/png;base64,aGVsbG8=');
    expect(blob).toBeTruthy();
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(5);
  });

  it('returns null for anything that is not a data URL', () => {
    expect(dataUrlToBlob('nope')).toBeNull();
    expect(dataUrlToBlob('')).toBeNull();
  });
});
