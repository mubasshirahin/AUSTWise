import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllAnalyses,
  deleteAnalysis,
  saveAnalysis,
} from './qbaSavedStore';

const STORE_URL = '/api/store/user/aust-qba-saved-v1';

function response(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

const ENTRY = {
  id: '1',
  savedAt: '2026-01-01T00:00:00.000Z',
  courseCode: 'CSE 3101',
  courseTitle: 'DBMS',
  displayData: { topics: [] },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saveAnalysis', () => {
  it('returns the new entry when the server accepts it', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ value: [] }))
      .mockResolvedValueOnce(response({ success: true }));
    vi.stubGlobal('fetch', fetchMock);

    const entry = await saveAnalysis({
      courseCode: 'CSE 3101',
      courseTitle: 'DBMS',
      displayData: { topics: [] },
    });

    expect(entry).toMatchObject({ courseCode: 'CSE 3101', courseTitle: 'DBMS' });
    expect(fetchMock).toHaveBeenLastCalledWith(
      STORE_URL,
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('returns null when the server rejects the save', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ value: [] }))
      .mockResolvedValueOnce(response({ success: false }, false, 401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(saveAnalysis({
      courseCode: 'CSE 3101',
      courseTitle: 'DBMS',
      displayData: { topics: [] },
    })).resolves.toBeNull();
  });

  it('returns null when the network is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(saveAnalysis({
      courseCode: 'CSE 3101',
      courseTitle: 'DBMS',
      displayData: { topics: [] },
    })).resolves.toBeNull();
  });

  it('does not overwrite the list when it cannot be read first', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ success: false }, false, 500));
    vi.stubGlobal('fetch', fetchMock);

    await expect(saveAnalysis({
      courseCode: 'CSE 3101',
      courseTitle: 'DBMS',
      displayData: { topics: [] },
    })).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('deleteAnalysis', () => {
  it('returns true only when the server accepted the change', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response({ value: [ENTRY] }))
      .mockResolvedValueOnce(response({ success: true })));

    await expect(deleteAnalysis(ENTRY.id)).resolves.toBe(true);
  });

  it('returns false when the write fails', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response({ value: [ENTRY] }))
      .mockResolvedValueOnce(response({ success: false }, false, 500)));

    await expect(deleteAnalysis(ENTRY.id)).resolves.toBe(false);
  });
});

describe('clearAllAnalyses', () => {
  it('reports whether the server accepted the clear', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ success: true })));
    await expect(clearAllAnalyses()).resolves.toBe(true);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ success: false }, false, 401)));
    await expect(clearAllAnalyses()).resolves.toBe(false);
  });
});
