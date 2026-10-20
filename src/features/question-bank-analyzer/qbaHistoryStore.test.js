import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  clearPreviewHistory,
  deletePreviewHistoryEntry,
  getPreviewHistory,
  MAX_HISTORY_ENTRIES,
  recordPreviewHistory,
} from './qbaHistoryStore';

function displayData(topicName = 'Transactions') {
  return {
    course: 'CSE 3101',
    title: 'Database Management Systems',
    topics: [{
      name: topicName,
      priority: 'HIGH',
      timesAsked: 2,
      questions: [{ number: 1, question: 'Explain ACID' }],
    }],
    summary: { totalQuestions: 1, topicCount: 1 },
    semesterPapers: [],
    studyPlan: [],
  };
}

function mockStore(initial = []) {
  const state = { value: initial };
  const fetchMock = vi.fn(async (_url, options = {}) => {
    if (!options.method || options.method === 'GET') {
      return { ok: true, json: async () => ({ value: state.value }) };
    }
    if (options.method === 'PUT') {
      state.value = JSON.parse(options.body).value;
      return { ok: true };
    }
    return { ok: false, status: 405 };
  });
  vi.stubGlobal('fetch', fetchMock);
  return state;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getPreviewHistory', () => {
  it('returns an empty list when nothing is stored', async () => {
    mockStore();
    await expect(getPreviewHistory()).resolves.toEqual([]);
  });

  it('throws when the server fails so the panel can show Retry', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
    await expect(getPreviewHistory()).rejects.toThrow('HTTP 503');
  });
});

describe('recordPreviewHistory', () => {
  it('adds a preview with its source and counts', async () => {
    mockStore();
    const entry = await recordPreviewHistory({
      courseCode: 'CSE 3101',
      courseTitle: 'Database Management Systems',
      displayData: displayData(),
      sourceText: '# source',
    });

    expect(entry).toBeTruthy();
    expect(entry.courseCode).toBe('CSE 3101');
    expect(entry.topicCount).toBe(1);
    expect(entry.questionCount).toBe(1);
    expect(entry.sourceText).toBe('# source');

    const list = await getPreviewHistory();
    expect(list).toHaveLength(1);
  });

  it('refreshes the timestamp instead of duplicating the same preview', async () => {
    mockStore();
    await recordPreviewHistory({ courseCode: 'CSE 3101', courseTitle: 'DBMS', displayData: displayData() });
    const second = await recordPreviewHistory({ courseCode: 'CSE 3101', courseTitle: 'DBMS', displayData: displayData() });

    const list = await getPreviewHistory();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(second.id);
  });

  it('keeps different previews newest first', async () => {
    mockStore();
    await recordPreviewHistory({ courseCode: 'CSE 3101', courseTitle: 'DBMS', displayData: displayData('Transactions') });
    await recordPreviewHistory({ courseCode: 'CSE 3101', courseTitle: 'DBMS', displayData: displayData('Indexing') });

    const list = await getPreviewHistory();
    expect(list).toHaveLength(2);
    expect(list[0].displayData.topics[0].name).toBe('Indexing');
    expect(list[1].displayData.topics[0].name).toBe('Transactions');
  });

  it('caps the history at 20 entries', async () => {
    mockStore();
    for (let index = 0; index < MAX_HISTORY_ENTRIES + 3; index += 1) {
      await recordPreviewHistory({
        courseCode: 'CSE 3101',
        courseTitle: 'DBMS',
        displayData: displayData(`Topic ${index}`),
      });
    }

    const list = await getPreviewHistory();
    expect(list).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(list[0].displayData.topics[0].name).toBe(`Topic ${MAX_HISTORY_ENTRIES + 2}`);
  });

  it('returns null when the server cannot be read (never overwrites)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    await expect(recordPreviewHistory({
      courseCode: 'CSE 3101',
      courseTitle: 'DBMS',
      displayData: displayData(),
    })).resolves.toBeNull();
  });
});

describe('deletePreviewHistoryEntry / clearPreviewHistory', () => {
  it('removes one entry', async () => {
    const state = mockStore();
    const entry = await recordPreviewHistory({
      courseCode: 'CSE 3101', courseTitle: 'DBMS', displayData: displayData(),
    });
    await expect(deletePreviewHistoryEntry(entry.id)).resolves.toBe(true);
    expect(state.value).toEqual([]);
  });

  it('clears everything', async () => {
    const state = mockStore();
    await recordPreviewHistory({
      courseCode: 'CSE 3101', courseTitle: 'DBMS', displayData: displayData(),
    });
    await expect(clearPreviewHistory()).resolves.toBe(true);
    expect(state.value).toEqual([]);
  });
});
