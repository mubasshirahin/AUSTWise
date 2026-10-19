import { describe, expect, it } from 'vitest';
import { applyManualMerges, buildPreviewAnalytics, filterPreviewData } from './previewAnalytics';

function topic(name, priority, questions, timesAsked = questions.reduce((sum, q) => sum + q.times, 0)) {
  return {
    name,
    priority,
    timesAsked,
    avgMarks: 10,
    lastAsked: questions[questions.length - 1]?.semester ?? '-',
    questions,
  };
}

const data = {
  course: 'CSE 3101',
  title: 'Database Management Systems',
  semesters: ['Spring 2023', 'Fall 2023', 'Spring 2024'],
  topics: [
    topic('Normalization', 'VIP', [
      { question: 'Normalize R to 3NF', exam: 'Final', semester: 'Spring 2024', marks: 15, times: 2 },
      { question: 'Explain BCNF', exam: 'Mid', semester: 'Fall 2023', marks: 10, times: 1 },
    ]),
    topic('SQL', 'HIGH', [
      { question: 'Write a JOIN query', exam: 'Final', semester: 'Spring 2024', marks: 10, times: 3 },
    ]),
    topic('Indexing', 'LOW', [
      { question: 'Compare B+ tree and hash', exam: 'Quiz', semester: 'Spring 2023', marks: 5, times: 1 },
    ]),
  ],
  vipMatrix: [
    { topic: 'Normalization', timesAsked: 3, avgMarks: 12.5, lastAsked: 'Spring 2024', priority: 'VIP' },
    { topic: 'SQL', timesAsked: 3, avgMarks: 10, lastAsked: 'Spring 2024', priority: 'HIGH' },
    { topic: 'Indexing', timesAsked: 1, avgMarks: 5, lastAsked: 'Spring 2023', priority: 'LOW' },
  ],
  studyPlan: [
    { step: 1, text: 'Normalization - start here.' },
    { step: 2, text: 'SQL - practise joins.' },
    { step: 3, text: 'Indexing - review last.' },
  ],
  summary: {
    topicCount: 3,
    totalQuestions: 4,
    totalAsked: 7,
    vipCount: 1,
    highCount: 1,
    mediumCount: 0,
    lowCount: 1,
    approximateCount: 0,
  },
};

describe('filterPreviewData', () => {
  it('keeps only the selected topic and recalculates the preview summary', () => {
    const filtered = filterPreviewData(data, ['SQL']);

    expect(filtered.topics.map((item) => item.name)).toEqual(['SQL']);
    expect(filtered.vipMatrix.map((row) => row.topic)).toEqual(['SQL']);
    expect(filtered.studyPlan.map((item) => item.text)).toEqual(['SQL - practise joins.']);
    expect(filtered.semesters).toEqual(['Spring 2024']);
    expect(filtered.summary).toMatchObject({
      topicCount: 1,
      totalQuestions: 1,
      totalAsked: 3,
      vipCount: 0,
      highCount: 1,
      mediumCount: 0,
      lowCount: 0,
    });

    const analytics = buildPreviewAnalytics(filtered);
    expect(analytics.totalQuestions).toBe(1);
    expect(analytics.totalAsked).toBe(3);
    expect(analytics.knownSemesterCount).toBe(1);
    expect(analytics.topTopic.name).toBe('SQL');
  });

  it('supports multiple selected topics', () => {
    const filtered = filterPreviewData(data, ['Normalization', 'Indexing']);

    expect(filtered.topics.map((item) => item.name)).toEqual(['Normalization', 'Indexing']);
    expect(filtered.summary.totalQuestions).toBe(3);
    expect(filtered.summary.totalAsked).toBe(4);
    expect(filtered.studyPlan).toHaveLength(2);
  });

  it('returns the original report when nothing is selected or every topic is selected', () => {
    expect(filterPreviewData(data, [])).toBe(data);
    expect(filterPreviewData(data, data.topics.map((item) => item.name))).toBe(data);
  });

  it('ignores stale topic names and keeps the original report if none match', () => {
    expect(filterPreviewData(data, ['Removed topic'])).toBe(data);

    const filtered = filterPreviewData(data, ['SQL', 'Removed topic']);
    expect(filtered.topics.map((item) => item.name)).toEqual(['SQL']);
  });
});

describe('applyManualMerges', () => {
  it('groups selected questions under the first one and keeps every version', () => {
    const merged = applyManualMerges(data, { Normalization: [[0, 1]] });
    const normalisation = merged.topics[0];

    expect(normalisation.questions).toHaveLength(1);
    expect(normalisation.questions[0]).toMatchObject({
      merged: true,
      originalIndex: 0,
      mergedIndices: [0, 1],
      times: 3,
    });
    expect(normalisation.questions[0].variants).toHaveLength(2);
    expect(normalisation.questions[0].variants.map((question) => question.question)).toEqual([
      'Normalize R to 3NF',
      'Explain BCNF',
    ]);
    expect(merged.summary.totalQuestions).toBe(3);
    expect(merged.summary.totalAsked).toBe(7);
    expect(merged.summary.vipCount).toBe(1);

    const analytics = buildPreviewAnalytics(merged);
    expect(analytics.totalQuestions).toBe(3);
    expect(analytics.matrix.find((row) => row.topic === 'Normalization').questionCount).toBe(1);
    expect(analytics.topics[0].questions[0].variants).toHaveLength(2);
  });

  it('ignores invalid and overlapping groups instead of losing questions', () => {
    const merged = applyManualMerges(data, {
      Normalization: [[0, 1], [1, 0], [9, 10]],
      SQL: [[0]],
    });

    expect(merged.topics[0].questions).toHaveLength(1);
    expect(merged.topics[0].questions[0].variants).toHaveLength(2);
    expect(merged.topics[1].questions).toHaveLength(1);
  });

  it('returns the original report when there is nothing valid to merge', () => {
    expect(applyManualMerges(data, {})).toBe(data);
    expect(applyManualMerges(data, { Normalization: [[0]] })).toBe(data);
    expect(applyManualMerges(data, { Removed: [[0, 1]] })).toBe(data);
  });
});
