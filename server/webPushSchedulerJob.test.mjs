import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  now: { weekdayIndex: 3, key: '2026-11-18', minutes: 7 * 60 + 30, hour: 7, minute: 30 },
  accounts: {},
  routines: {},
  weekDays: {},
  deadlines: {},
  subscribers: [],
  pushes: [],
  log: {},
}));

vi.mock('./jsonDB.mjs', () => ({
  readJson: vi.fn(async () => m.log),
  writeJson: vi.fn(async (_file, data) => { m.log = data; }),
}));

vi.mock('./storeDB.mjs', () => ({
  getUserStoreValue: vi.fn(async (userId, key, fallback) => {
    if (key === 'aust-user-weekdays') return m.weekDays[userId] ?? fallback;
    if (key === 'aust-user-routine') return m.routines[userId] ?? fallback;
    return fallback;
  }),
}));

vi.mock('./userStore.mjs', () => ({
  getUserById: vi.fn(async (id) => m.accounts[id] || null),
}));

vi.mock('./db.mjs', () => ({
  createDedicatedClient: vi.fn(() => ({
    on: vi.fn(),
    connect: vi.fn(async () => {}),
    query: vi.fn(async () => ({ rows: [{ locked: true }] })),
    end: vi.fn(async () => {}),
  })),
}));

vi.mock('./telegramSchedulerJob.mjs', () => ({
  dhakaNow: () => m.now,
  DAY_NAMES: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  parseRoutine: (raw) => raw || {},
  classStartMinutes: (cls) => {
    const match = String(cls?.time || '').match(/(\d{1,2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  },
  loadUserDeadlines: vi.fn(async (id) => m.deadlines[id] || []),
}));

vi.mock('./webPush.mjs', () => ({
  isWebPushConfigured: true,
  getAllSubscriberIds: vi.fn(async () => m.subscribers),
  sendPushToUser: vi.fn(async (id, payload) => { m.pushes.push({ id, payload }); }),
  isPushCategoryEnabled: (prefs, category) => {
    const push = prefs?.channels?.push;
    if (push && typeof push[category] === 'boolean') return push[category];
    return prefs?.channels?.browser?.[category] !== false;
  },
}));

describe('webPushSchedulerJob', () => {
  let mod;

  beforeEach(async () => {
    vi.resetModules();
    m.accounts = {
      u1: { id: 'u1', settings: { notifications: { enabled: true, channels: { browser: { classReminders: true, deadlines: true } } } } },
    };
    m.routines = { u1: { Wednesday: [{ course: 'CSE 101', name: 'Intro', time: '08:00 - 08:50', room: '7A-01' }] } };
    m.weekDays = { u1: ['Wednesday'] };
    m.deadlines = { u1: [{ id: 'dl1', title: 'Lab report', course: 'CSE 220', priority: 'medium', dueDate: Date.now() + 6 * 3600000 }] };
    m.subscribers = ['u1'];
    m.pushes = [];
    m.log = {};
    mod = await import('./webPushSchedulerJob.mjs');
  });

  it('pushes a class reminder inside the 30-minute window', async () => {
    await mod.runWebPushSchedulerTick();
    expect(m.pushes).toHaveLength(2); // 1 class + 1 deadline
    const cls = m.pushes.find((p) => p.payload.category === 'classReminders');
    expect(cls.payload.title).toContain('30 minutes');
    expect(cls.payload.body).toContain('CSE 101');
    expect(cls.payload.url).toBe('/dashboard/routine');
  });

  it('pushes a deadline inside the 12-hour window', async () => {
    await mod.runWebPushSchedulerTick();
    const dl = m.pushes.find((p) => p.payload.category === 'deadlines');
    expect(dl.payload.title).toContain('CSE 220');
    expect(dl.payload.body).toContain('6 hours');
    expect(dl.payload.url).toBe('/dashboard/quickstats');
  });

  it('never re-sends an already-fired reminder', async () => {
    await mod.runWebPushSchedulerTick();
    const first = m.pushes.length;
    await mod.runWebPushSchedulerTick();
    expect(m.pushes).toHaveLength(first);
  });

  it('honours per-channel browser preferences', async () => {
    m.accounts.u1.settings.notifications.channels.browser = { classReminders: false, deadlines: false };
    await mod.runWebPushSchedulerTick();
    expect(m.pushes).toHaveLength(0);
  });

  it('respects the master Smart Reminders switch', async () => {
    m.accounts.u1.settings.notifications.enabled = false;
    await mod.runWebPushSchedulerTick();
    expect(m.pushes).toHaveLength(0);
  });

  it('skips subscribers not in today’s weekdays', async () => {
    m.weekDays.u1 = ['Monday'];
    await mod.runWebPushSchedulerTick();
    expect(m.pushes.some((p) => p.payload.category === 'classReminders')).toBe(false);
    expect(m.pushes.some((p) => p.payload.category === 'deadlines')).toBe(true);
  });
});
