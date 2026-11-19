import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendPushToUser = vi.hoisted(() => vi.fn(async () => ({ sent: 1, failed: 0, removed: 0 })));
vi.mock('./webPush.mjs', () => ({ sendPushToUser }));

const { sendWorkspaceResultPush, normalizeResultItems, _resetWorkspaceResultDedupe } = await import('./workspaceResultPush.mjs');

describe('sendWorkspaceResultPush', () => {
  beforeEach(() => {
    sendPushToUser.mockClear();
    _resetWorkspaceResultDedupe();
  });

  it('pushes to the caller only, in the results category, with a fixed in-app url', async () => {
    const out = await sendWorkspaceResultPush('u1', [
      { id: 'p1', courseId: 'c1', courseName: 'CSE 3101', kind: 'post', body: 'CT-1 marks published', url: 'https://evil.example' },
    ]);
    expect(out).toMatchObject({ success: true, items: 1, sent: 1, skipped: 0 });
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    const [userId, payload] = sendPushToUser.mock.calls[0];
    expect(userId).toBe('u1');
    expect(payload).toMatchObject({ category: 'results', url: '/workspace', tag: 'ws-result-c1-p1' });
    expect(payload.title).toContain('CSE 3101');
  });

  it('pushes the same post once per user', async () => {
    const item = { id: 'p1', courseId: 'c1', body: 'Result out' };
    await sendWorkspaceResultPush('u1', [item]);
    const again = await sendWorkspaceResultPush('u1', [item]);
    expect(again.skipped).toBe(1);
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    await sendWorkspaceResultPush('u2', [item]);
    expect(sendPushToUser).toHaveBeenCalledTimes(2);
  });

  it('drops malformed items and caps the batch', () => {
    expect(normalizeResultItems('nope')).toEqual([]);
    expect(normalizeResultItems([{ id: 'x' }, { courseId: 'c' }])).toEqual([]);
    const many = Array.from({ length: 25 }, (_, i) => ({ id: `p${i}`, courseId: 'c', body: 'x'.repeat(500) }));
    const out = normalizeResultItems(many);
    expect(out).toHaveLength(10);
    expect(out[0].body.length).toBe(160);
  });
});
