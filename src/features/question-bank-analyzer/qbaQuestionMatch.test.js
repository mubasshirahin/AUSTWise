import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  addUnmatchedPaperQuestions,
  buildPaperSourceReferences,
  buildQuestionMatchIndex,
  partImageKey,
  questionSignature,
  topicQuestionKey,
} from './qbaQuestionMatch';
import { questionImageKey, semesterImageKey } from './qbaKeys';
import { parseQuestionBank } from './parseQuestionBank';

const courseKey = 'cse-3101';

function reportWith(questions) {
  return {
    course: 'CSE 3101',
    topics: [{ name: 'Normalization', priority: 'HIGH', questions }],
    semesterPapers: [],
  };
}

describe('questionSignature', () => {
  it('ignores part labels and numbering', () => {
    const first = 'Consider the table.\n2.a) Find the keys.\n2.b) Find the dependencies.';
    const second = 'Consider the table.\n(a) Find the keys.\n(b) Find the dependencies.';
    expect(questionSignature(first)).toBe(questionSignature(second));
  });

  it('ignores punctuation, case and the Version prefix', () => {
    expect(questionSignature('Version 1: Define 1NF?')).toBe('define 1nf');
  });
});

describe('buildQuestionMatchIndex', () => {
  it('links a paper row to the topic row and reuses its picture key', () => {
    const report = reportWith([
      { question: 'Define 1NF.', originalIndex: 0, semester: 'Fall 2024' },
    ]);
    const index = buildQuestionMatchIndex(report, courseKey);
    const match = index.match('Define 1NF');

    expect(match).toBeTruthy();
    expect(match.topic).toBe('Normalization');
    expect(match.key).toBe(questionImageKey(courseKey, 'Normalization', 0));
  });

  it('links a paper row to the correct version slot', () => {
    const report = reportWith([
      {
        question: 'Version 1: First wording.\nVersion 2: Second wording.',
        originalIndex: 0,
        versions: [
          { label: 'Version 1', text: 'First wording.' },
          { label: 'Version 2', text: 'Second wording.' },
        ],
      },
    ]);
    const index = buildQuestionMatchIndex(report, courseKey);
    const base = questionImageKey(courseKey, 'Normalization', 0);

    expect(index.match('First wording.').key).toBe(base);
    expect(index.match('Second wording.').key).toBe(`${base}::v2`);
  });

  it('uses a fallback for a small copying difference', () => {
    const report = reportWith([
      {
        question: 'Explain the three normal forms with suitable examples.',
        originalIndex: 0,
      },
    ]);
    const index = buildQuestionMatchIndex(report, courseKey);
    const match = index.match('Explain the 3 normal forms with suitable examples');
    expect(match?.topic).toBe('Normalization');
    expect(match?.method).toBe('similar');
  });

  it('returns null when the question is not in any topic', () => {
    const index = buildQuestionMatchIndex(reportWith([
      { question: 'Define 1NF.', originalIndex: 0 },
    ]), courseKey);
    expect(index.match('Write a short note on database security.')).toBeNull();
  });
});

describe('buildPaperSourceReferences', () => {
  it('maps a topic version to its semester and original paper number', () => {
    const text = 'Consider a relation R.\n2.a) Find the keys.\n2.b) Normalize it.';
    const report = {
      topics: [
        {
          name: 'Normalization',
          questions: [{ question: text, originalIndex: 0 }],
        },
      ],
      semesterPapers: [
        {
          semester: 'Fall 2024',
          questions: [{ question: text, number: 2 }],
        },
      ],
    };
    const map = buildPaperSourceReferences(report, courseKey);
    const refs = map.get(questionImageKey(courseKey, 'Normalization', 0));

    expect(refs).toEqual([
      {
        semester: 'Fall 2024',
        number: 2,
        partLabels: ['a', 'b'],
        text,
      },
    ]);
  });

  it('keeps an unmatched paper row under its semester key', () => {
    const report = {
      topics: [{ name: 'Normalization', questions: [{ question: 'Define 1NF.' }] }],
      semesterPapers: [
        {
          semester: 'Spring 2025',
          questions: [{ question: 'Write a short note on database security.', number: 1 }],
        },
      ],
    };
    const map = buildPaperSourceReferences(report, courseKey);
    const refs = map.get(semesterImageKey(courseKey, 'Spring 2025', 0));

    expect(refs[0]).toMatchObject({
      semester: 'Spring 2025',
      number: 1,
      partLabels: [],
    });
  });
});

describe('addUnmatchedPaperQuestions', () => {
  it('keeps every paper-only question and merges repeated wording', () => {
    const report = {
      topics: [
        { name: 'Normalization', questions: [{ question: 'Define 1NF.', originalIndex: 0 }] },
      ],
      semesterPapers: [
        {
          semester: 'Fall 2024',
          questions: [
            { question: 'Define 1NF.' },
            { question: 'Write a short note on database security.' },
          ],
        },
        {
          semester: 'Spring 2024',
          questions: [
            { question: 'Write a short note on database security' },
            { question: 'Explain database backups.' },
          ],
        },
      ],
    };

    const complete = addUnmatchedPaperQuestions(report, courseKey);
    const other = complete.topics.find((topic) => topic.name === 'Other questions');

    expect(other.questions).toHaveLength(2);
    expect(other.questions[0].semester).toBe('Fall 2024, Spring 2024');
    expect(other.questions[0].times).toBe(2);
    expect(other.questions[1].question).toBe('Explain database backups.');
    expect(other.timesAsked).toBe(3);
    expect(other.lastAsked).toBe('Fall 2024');
  });
});

describe('partImageKey', () => {
  it('gives every sub-part its own stable key', () => {
    const base = questionImageKey(courseKey, 'Normalization', 0);
    expect(partImageKey(base, { label: 'a' }, 0)).toBe(`${base}::part:a-0`);
    expect(partImageKey(base, { label: 'b' }, 1)).toBe(`${base}::part:b-1`);
  });
});

describe('topicQuestionKey', () => {
  it('keeps the stable key of a question added from a paper row', () => {
    const saved = 'cse-3101::@semester::fall 2024::2';
    const question = { question: 'Unmatched wording', pictureKey: saved, originalIndex: 0 };
    expect(topicQuestionKey(courseKey, 'Other questions', question, 0, null)).toBe(saved);
  });

  it('still gives a normal topic question its topic key', () => {
    const question = { question: 'Define 1NF.', originalIndex: 1 };
    expect(topicQuestionKey(courseKey, 'Normalization', question, 1, null))
      .toBe(questionImageKey(courseKey, 'Normalization', 1));
  });
});

describe('sample question bank coverage', () => {
  it('links every raw paper question to a topic row', () => {
    const markdown = readFileSync(
      new URL('../../../samples/sample_analysis.md', import.meta.url),
      'utf8',
    );
    const { data } = parseQuestionBank(markdown);
    const index = buildQuestionMatchIndex(data, 'cse-3101');
    const unmatched = [];

    data.semesterPapers.forEach((paper) => {
      paper.questions.forEach((question) => {
        if (!index.match(question.question)) {
          unmatched.push(`${paper.semester}: ${question.question}`);
        }
      });
    });

    expect(unmatched).toEqual([]);
  });
});
