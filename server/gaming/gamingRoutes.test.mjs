import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Readable } from 'node:stream';

const h = vi.hoisted(() => ({ actor: { id: 's1', role: 'student', roles: ['student'] } }));

vi.mock('../middleware.mjs', () => ({
  requireAuth: (req, res) => {
    if (!h.actor) { res.writeHead(401); res.end(JSON.stringify({ success: false })); return null; }
    return h.actor;
  },
}));

vi.mock('./gamingService.mjs', () => {
  class GamingError extends Error {
    constructor(status, message, extra = {}) { super(message); this.status = status; Object.assign(this, extra); }
  }
  return {
    GamingError,
    getMe: vi.fn(async (actor) => ({ me: actor.id })),
    getRoomDetail: vi.fn(async (_a, id) => ({ id })),
    postMessage: vi.fn(async () => { throw new GamingError(429, 'Slow down a little.', { retryAfterMs: 1200 }); }),
    overview: vi.fn(async () => { throw new Error('db exploded'); }),
    kickMember: vi.fn(async (_a, id, userId, opts) => ({ id, userId, opts })),
  };
});

const { handleGamingRoute, matchGamingRoute } = await import('./gamingRoutes.mjs');
const svc = await import('./gamingService.mjs');

function call(method, url, body, { access = { allowed: true }, dbReady = true } = {}) {
  const req = Readable.from(body ? [JSON.stringify(body)] : []);
  Object.assign(req, { method, url, headers: {} });
  const res = { status: 0, body: null, writeHead(code) { this.status = code; }, end(text) { this.body = text ? JSON.parse(text) : null; } };
  const sendJson = (r, status, payload) => { r.status = status; r.body = payload; };
  const readJsonBody = (r) => new Promise((resolve) => {
    let data = '';
    r.on('data', (chunk) => { data += chunk; });
    r.on('end', () => resolve(data ? JSON.parse(data) : {}));
  });
  return handleGamingRoute(req, res, { sendJson, readJsonBody, checkAccess: async () => access, dbReady: () => dbReady })
    .then((handled) => ({ handled, res }));
}

beforeEach(() => { h.actor = { id: 's1', role: 'student', roles: ['student'] }; });

describe('route table', () => {
  it('matches params and methods', () => {
    expect(matchGamingRoute('GET', '/rooms/abc').params).toEqual({ id: 'abc' });
    expect(matchGamingRoute('DELETE', '/rooms/r1/messages/m%201').params).toEqual({ id: 'r1', messageId: 'm 1' });
    expect(matchGamingRoute('DELETE', '/rooms/r1')).toBe(null);
    expect(matchGamingRoute('GET', '/rooms/a/b/c')).toBe(null);
  });
});

describe('handleGamingRoute', () => {
  it('ignores non-gaming URLs', async () => {
    expect((await call('GET', '/api/other')).handled).toBe(false);
  });

  it('404 for unknown endpoints, 401 without a session', async () => {
    expect((await call('GET', '/api/gaming/nope')).res.status).toBe(404);
    h.actor = null;
    expect((await call('GET', '/api/gaming/me')).res.status).toBe(401);
  });

  it('503 without the database, 403 when the page is hidden for the role', async () => {
    expect((await call('GET', '/api/gaming/me', null, { dbReady: false })).res.status).toBe(503);
    const denied = await call('GET', '/api/gaming/me', null, { access: { allowed: false, reason: 'Off for guests.' } });
    expect(denied.res).toMatchObject({ status: 403, body: { error: 'Off for guests.' } });
  });

  it('passes actor, params and body to the service', async () => {
    const ok = await call('GET', '/api/gaming/me');
    expect(ok.res).toMatchObject({ status: 200, body: { success: true, data: { me: 's1' } } });
    const kicked = await call('POST', '/api/gaming/rooms/r9/kick', { userId: 's2', ban: 1, reason: 'spam' });
    expect(kicked.res.body.data).toEqual({ id: 'r9', userId: 's2', opts: { ban: true, reason: 'spam' } });
    expect(svc.kickMember).toHaveBeenCalledWith(h.actor, 'r9', 's2', { ban: true, reason: 'spam' });
  });

  it('maps GamingError to its status and hides unexpected errors', async () => {
    const limited = await call('POST', '/api/gaming/rooms/r1/messages', { text: 'hi' });
    expect(limited.res).toMatchObject({ status: 429, body: { error: 'Slow down a little.', retryAfterMs: 1200 } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom = await call('GET', '/api/gaming/overview');
    expect(boom.res).toMatchObject({ status: 500, body: { error: 'Something went wrong in the Gaming Zone.' } });
    spy.mockRestore();
  });
});
