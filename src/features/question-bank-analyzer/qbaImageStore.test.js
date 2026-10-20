import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  attachImagesToReport,
  courseSlug,
  dataUrlToBlob,
  markImageSyncTime,
  mergeImageLists,
  pullImagesFromServer,
  pushImagesToServer,
  questionImageKey,
  readImageSyncTime,
  semesterImageKey,
} from './qbaImageStore';

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it('keeps question and answer attachments in separate lists', () => {
    const byQuestion = {
      'cse-3101::transactions::0': [
        {
          id: 'q1', name: 'question.png', url: 'blob:q1', mime: 'image/png',
          media: 'image', kind: 'question',
        },
        {
          id: 'a1', name: 'answer.pdf', url: 'blob:a1', mime: 'application/pdf',
          media: 'file', kind: 'answer',
        },
      ],
    };

    const withImages = attachImagesToReport(report, 'cse-3101', byQuestion);
    const padded = withImages.topics[0].questions[0];

    expect(padded.images).toEqual([
      { name: 'question.png', url: 'blob:q1', mime: 'image/png', media: 'image' },
    ]);
    expect(padded.answerImages).toEqual([
      { name: 'answer.pdf', url: 'blob:a1', mime: 'application/pdf', media: 'file' },
    ]);
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

describe('semesterImageKey', () => {
  it('keys a raw paper picture by course, semester and position', () => {
    expect(semesterImageKey('cse-3101', 'Spring 2017', 2))
      .toBe('cse-3101::@semester::spring 2017::2');
  });

  it('never collides with a topic key', () => {
    expect(semesterImageKey('cse-3101', 'Spring 2017', 0))
      .not.toBe(questionImageKey('cse-3101', 'Spring 2017', 0));
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

describe('image sync time', () => {
  it('never throws when the browser has no localStorage', () => {
    expect(readImageSyncTime('cse-3101')).toBe('');
    expect(markImageSyncTime('cse-3101')).toBe('');
  });
});

describe('mergeImageLists', () => {
  const a = { id: 'a', createdAt: '2026-01-01T00:00:00.000Z' };
  const b = { id: 'b', createdAt: '2026-01-02T00:00:00.000Z' };
  const c = { id: 'c', createdAt: '2026-01-03T00:00:00.000Z' };
  const sync = '2026-01-02T12:00:00.000Z';

  it('adds pictures that exist only on the server', () => {
    const result = mergeImageLists([a], [a, b], sync);
    expect(result.merged.map((record) => record.id)).toEqual(['a', 'b']);
    expect(result.unsynced).toEqual([]);
    expect(result.dropped).toEqual([]);
  });

  it('drops a synced picture the server no longer has', () => {
    const result = mergeImageLists([a, b], [a], sync);
    expect(result.merged.map((record) => record.id)).toEqual(['a']);
    expect(result.dropped.map((record) => record.id)).toEqual(['b']);
  });

  it('keeps and reports a picture added after the last sync', () => {
    const result = mergeImageLists([a, c], [a], sync);
    expect(result.merged.map((record) => record.id)).toEqual(['a', 'c']);
    expect(result.unsynced.map((record) => record.id)).toEqual(['c']);
  });

  it('keeps every local picture when no sync has happened yet', () => {
    const result = mergeImageLists([a, b], [], '');
    expect(result.merged.map((record) => record.id)).toEqual(['a', 'b']);
    expect(result.unsynced.map((record) => record.id)).toEqual(['a', 'b']);
  });

  it('never duplicates a picture present on both sides', () => {
    const result = mergeImageLists([a], [a], sync);
    expect(result.merged).toHaveLength(1);
  });
});

describe('server mirror', () => {
  const serverUrl = '/api/store/user/aust-qba-images-v1%3Acse-3101';

  it('pushes an empty list so deleted pictures are removed from the server', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await expect(pushImagesToServer('cse-3101', [])).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      serverUrl,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ value: [] }),
      }),
    );
  });

  it('pushes the question/answer kind and image/file media', async () => {
    class FakeFileReader {
      readAsDataURL(blob) {
        this.result = `data:${blob.type};base64,aGVsbG8=`;
        this.onload();
      }
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('FileReader', FakeFileReader);

    await pushImagesToServer('cse-3101', [
      {
        id: 'q1', questionKey: 'cse-3101::transactions::0', name: 'question.png',
        mime: 'image/png', kind: 'question', media: 'image',
        blob: new Blob(['q'], { type: 'image/png' }),
      },
      {
        id: 'a1', questionKey: 'cse-3101::transactions::0', name: 'answer.pdf',
        mime: 'application/pdf', kind: 'answer', media: 'file',
        blob: new Blob(['a'], { type: 'application/pdf' }),
      },
    ]);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.value).toHaveLength(2);
    expect(body.value[0]).toMatchObject({
      id: 'q1', kind: 'question', media: 'image', name: 'question.png',
    });
    expect(body.value[1]).toMatchObject({
      id: 'a1', kind: 'answer', media: 'file', name: 'answer.pdf',
    });
  });

  it('returns false when the server rejects the pictures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(pushImagesToServer('cse-3101', [])).resolves.toBe(false);
  });

  it('reads the mirrored pictures and says the server answered', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        value: [{
          id: 'a1',
          questionKey: 'cse-3101::transactions::0',
          name: 'graph.png',
          mime: 'image/png',
          dataUrl: 'data:image/png;base64,aGVsbG8=',
          createdAt: '2026-01-02T03:04:05.000Z',
        }],
      }),
    }));

    const result = await pullImagesFromServer('cse-3101');

    expect(result.ok).toBe(true);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      id: 'a1',
      name: 'graph.png',
      createdAt: '2026-01-02T03:04:05.000Z',
    });
  });

  it('keeps the question/answer kind and media from the server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        value: [
          {
            id: 'a1',
            questionKey: 'cse-3101::transactions::0',
            name: 'answer.png',
            mime: 'image/png',
            kind: 'answer',
            media: 'image',
            dataUrl: 'data:image/png;base64,aGVsbG8=',
            createdAt: '2026-01-02T03:04:05.000Z',
          },
          {
            id: 'q1',
            questionKey: 'cse-3101::transactions::0',
            name: 'question.pdf',
            mime: 'application/pdf',
            kind: 'question',
            media: 'file',
            dataUrl: 'data:application/pdf;base64,aGVsbG8=',
            createdAt: '2026-01-02T03:04:05.000Z',
          },
          {
            id: 'old',
            questionKey: 'cse-3101::transactions::1',
            name: 'legacy.png',
            mime: 'image/png',
            dataUrl: 'data:image/png;base64,aGVsbG8=',
            createdAt: '2026-01-01T03:04:05.000Z',
          },
        ],
      }),
    }));

    const result = await pullImagesFromServer('cse-3101');

    expect(result.records[0]).toMatchObject({ id: 'a1', kind: 'answer', media: 'image' });
    expect(result.records[1]).toMatchObject({ id: 'q1', kind: 'question', media: 'file' });
    // Records from before the split are question pictures, not answer files.
    expect(result.records[2]).toMatchObject({ id: 'old', kind: 'question', media: 'image' });
  });

  it('keeps ok:false on failure so a local copy is never wiped', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await expect(pullImagesFromServer('cse-3101')).resolves.toEqual({
      ok: false,
      records: [],
    });
  });
});

describe('attachImagesToReport — versions and raw papers', () => {
  it('gives the first version the row picture and later versions their own', () => {
    const report = {
      topics: [
        {
          name: 'Normalization',
          questions: [
            {
              question: 'merged',
              originalIndex: 0,
              versions: [
                { label: 'Version 1', text: 'first' },
                { label: 'Version 2', text: 'second' },
              ],
            },
          ],
        },
      ],
    };
    const base = questionImageKey('cse-3101', 'Normalization', 0);
    const byQuestion = {
      [base]: [{ id: 'a', name: 'one.png', url: 'blob:one' }],
      [`${base}::v2`]: [{ id: 'b', name: 'two.png', url: 'blob:two' }],
    };

    const attached = attachImagesToReport(report, 'cse-3101', byQuestion);
    const question = attached.topics[0].questions[0];

    expect(question.images.map((image) => image.name)).toEqual(['one.png']);
    expect(question.versionImages.map((images) => images.map((image) => image.name))).toEqual([
      ['one.png'],
      ['two.png'],
    ]);
  });

  it('attaches the pictures of the raw semester papers by position', () => {
    const report = {
      topics: [],
      semesterPapers: [
        { semester: 'Spring 2017', questions: [{ question: 'raw one' }, { question: 'raw two' }] },
      ],
    };
    const byQuestion = {
      [semesterImageKey('cse-3101', 'Spring 2017', 1)]: [
        { id: 'c', name: 'raw.png', url: 'blob:raw' },
      ],
    };

    const attached = attachImagesToReport(report, 'cse-3101', byQuestion);

    expect(attached.semesterPapers[0].questions[0].images).toBeUndefined();
    expect(attached.semesterPapers[0].questions[1].images.map((image) => image.name)).toEqual([
      'raw.png',
    ]);
  });
});
