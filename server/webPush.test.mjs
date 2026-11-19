import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  // data: the DB-backed per-user store ({ userId: [subs] }); legacy: the old
  // webPushSubscriptions.json file that is migrated into it once.
  const store = { data: {}, legacy: {}, sent: [] };
  const sendNotification = vi.fn(async (sub, payload) => {
    store.sent.push({ sub, payload });
  });
  return { store, sendNotification };
});

vi.mock('./jsonDB.mjs', () => ({
  readJson: vi.fn(async () => mocks.store.legacy),
  writeJson: vi.fn(async (_file, data) => { mocks.store.legacy = data; }),
}));

vi.mock('./storeDB.mjs', () => ({
  SERVER_ONLY_USER_KEY_PREFIX: '__server:',
  getUserStoreValue: vi.fn(async (userId, _key, fallback) => mocks.store.data[userId] ?? fallback),
  setUserStoreValue: vi.fn(async (userId, _key, value) => { mocks.store.data[userId] = value; }),
  listUserStoreValuesForKey: vi.fn(async () =>
    Object.entries(mocks.store.data).map(([userId, value]) => ({ userId, value }))),
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

const FCM = 'https://fcm.googleapis.com/fcm/send/';

function sub(id) {
  const endpoint = /^https?:\/\//.test(id) ? id : FCM + id;
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
    mocks.store.legacy = {};
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
    expect((await mod.saveSubscription('u1', sub('1'))).count).toBe(1);
    const again = await mod.saveSubscription('u1', sub('1'));
    expect(again.count).toBe(1);
    expect((await mod.getSubscriptions('u1'))[0].keys.p256dh).toBe(`p256dh-${FCM}1`);
  });

  it('only accepts https endpoints on known push services (no SSRF targets)', async () => {
    for (const endpoint of [
      'http://fcm.googleapis.com/fcm/send/x',
      'https://169.254.169.254/latest/meta-data',
      'https://localhost:5174/api/admin/reset',
      'https://evil.example.com/collect',
      'https://fcm.googleapis.com.evil.example/x',
    ]) {
      expect((await mod.saveSubscription('u1', sub(endpoint))).success).toBe(false);
    }
    for (const endpoint of [
      'https://fcm.googleapis.com/fcm/send/a',
      'https://updates.push.services.mozilla.com/wpush/v2/b',
      'https://web.push.apple.com/c',
      'https://wns2-par02p.notify.windows.com/w/?token=d',
    ]) {
      expect((await mod.saveSubscription('u1', sub(endpoint))).success).toBe(true);
    }
  });

  it('keeps subscriptions in the DB-backed store and migrates the legacy file once', async () => {
    mocks.store.legacy = { old: [sub('legacy-device')] };
    await mod.saveSubscription('u1', sub('new-device'));
    expect(mocks.store.data.u1[0].endpoint).toBe(FCM + 'new-device');
    expect(mocks.store.data.old[0].endpoint).toBe(FCM + 'legacy-device');
    expect(mocks.store.legacy).toEqual({});
    expect((await mod.getAllSubscriberIds()).sort()).toEqual(['old', 'u1']);
  });

  it('removes one device, or all when no endpoint is given', async () => {
    await mod.saveSubscription('u1', sub('1'));
    await mod.saveSubscription('u1', sub('2'));
    expect((await mod.removeSubscription('u1', FCM + '1')).count).toBe(1);
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
    expect(mocks.store.sent[0].sub.endpoint).toBe(FCM + 'match-device');
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
  it('skips categories switched off in Settings and follows the vibrate switch', async () => {
    await mod.saveSubscription('u1', sub('e1'));
    getUserById.mockImplementation(async (id) => ({
      id,
      settings: { notifications: { vibrate: false, channels: { browser: { messages: false, gaming: true } } } },
    }));
    const off = await mod.sendPushToUser('u1', { title: 'dm', category: 'messages' });
    expect(off.sent).toBe(0);
    expect(mocks.store.sent).toHaveLength(0);

    await mod.sendPushToUser('u1', { title: 'squad', category: 'gaming' });
    const payload = JSON.parse(mocks.store.sent[0].payload);
    expect(payload.silent).toBe(true);
    expect(payload.vibrate).toEqual([]);
  });

  it('mirrors known realtime events as pushes and ignores the rest', async () => {
    getUserById.mockImplementation(async (id) => ({ id, settings: { notifications: {} } }));
    await mod.saveSubscription('u1', sub('e1'));
    mod.pushRealtimeEvent(['u1'], { type: 'role-review', payload: { applicationId: 'a1', title: 'Application approved', body: 'ok' } });
    mod.pushRealtimeEvent(['u1'], { type: 'store-change', payload: {} });
    await vi.waitFor(() => expect(mocks.store.sent).toHaveLength(1));
    const payload = JSON.parse(mocks.store.sent[0].payload);
    expect(payload).toMatchObject({ title: 'Application approved', category: 'applications', vibrate: [200, 100, 200], silent: false });
  });
});
