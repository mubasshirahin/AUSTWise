import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const store = { data: {}, sent: [] };
  const sendNotification = vi.fn(async (sub, payload) => {
    store.sent.push({ sub, payload });
  });
  return { store, sendNotification };
});

vi.mock('./jsonDB.mjs', () => ({
  readJson: vi.fn(async () => mocks.store.data),
  writeJson: vi.fn(async (_file, data) => { mocks.store.data = data; }),
}));

vi.mock('./userStore.mjs', () => ({
  getUserById: vi.fn(async (id) => ({
    id,
    department: 'CSE',
    semester: '3.1',
    section: 'A',
    labSection: 'L1',
    settings: { notifications: { channels: { browser: { notices: true } } } },
  })),
}));

vi.mock('web-push', () => ({
  setVapidDetails: vi.fn(),
  sendNotification: (...args) => mocks.sendNotification(...args),
}));

function sub(endpoint) {
  return {
    endpoint,
    keys: { p256dh: `p256dh-${endpoint}`, auth: `auth-${endpoint}` },
  };
}

describe('webPush server module', () => {
  let mod;
  let getUserById;

  beforeEach(async () => {
    vi.resetModules();
    mocks.store.data = {};
    mocks.store.sent = [];
    mocks.sendNotification.mockClear();
    vi.stubEnv('VAPID_PUBLIC_KEY', 'PUBKEY');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'PRIVKEY');
    mod = await import('./webPush.mjs');
    getUserById = (await import('./userStore.mjs')).getUserById;
  });

  it('reports configured and exposes the public key only', () => {
    expect(mod.isWebPushConfigured).toBe(true);
    expect(mod.getVapidPublicKey()).toBe('PUBKEY');
  });

  it('rejects malformed subscriptions and de-duplicates by endpoint', async () => {
    expect((await mod.saveSubscription('u1', { endpoint: 'x' })).success).toBe(false);
    expect((await mod.saveSubscription('u1', sub('https://push/1'))).count).toBe(1);
    const again = await mod.saveSubscription('u1', sub('https://push/1'));
    expect(again.count).toBe(1);
    expect((await mod.getSubscriptions('u1'))[0].keys.p256dh).toBe('p256dh-https://push/1');
  });

  it('removes one device, or all when no endpoint is given', async () => {
    await mod.saveSubscription('u1', sub('https://push/1'));
    await mod.saveSubscription('u1', sub('https://push/2'));
    expect((await mod.removeSubscription('u1', 'https://push/1')).count).toBe(1);
    expect((await mod.removeSubscription('u1')).count).toBe(0);
    expect(await mod.getSubscriptions('u1')).toEqual([]);
  });

  it('pushes a notice only to in-scope, opted-in devices, never the author', async () => {
    mocks.store.data = {
      author: [sub('author-device')],
      match: [sub('match-device')],
      otherDept: [sub('other-device')],
      optedOut: [sub('optout-device')],
    };
    getUserById.mockImplementation(async (id) => ({
      id,
      department: id === 'otherDept' ? 'EEE' : 'CSE',
      semester: '3.1',
      section: 'A',
      labSection: 'L1',
      settings: { notifications: { channels: { browser: { notices: id !== 'optedOut' } } } },
    }));

    const result = await mod.sendNoticeWebPush({
      noticeId: 'cr-1',
      title: 'Exam schedule',
      content: 'Tomorrow at 10am',
      postedById: 'author',
      postedByName: 'CR',
      scope: { department: 'CSE', semester: '3.1', section: 'A' },
    });

    expect(result.sent).toBe(1);
    expect(mocks.store.sent).toHaveLength(1);
    expect(mocks.store.sent[0].sub.endpoint).toBe('match-device');
    const payload = JSON.parse(mocks.store.sent[0].payload);
    expect(payload.title).toBe('Exam schedule');
    expect(payload.tag).toBe('notice-cr-1');
    expect(payload.url).toBe('/');
  });

  it('drops subscriptions that the push service reports as gone', async () => {
    mocks.store.data = { u1: [sub('gone-device')] };
    const err = Object.assign(new Error('Gone'), { statusCode: 410 });
    mocks.sendNotification.mockRejectedValueOnce(err);
    const result = await mod.sendPushToUser('u1', { title: 'hi' });
    expect(result.removed).toBe(1);
    expect(await mod.getSubscriptions('u1')).toEqual([]);
  });
});
