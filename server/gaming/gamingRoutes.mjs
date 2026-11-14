/**
 * HTTP routes for /api/gaming/*. Thin layer: auth + feature gate + input
 * parsing, then gamingService does the work and the permission checks.
 *
 * dev.mjs wires it with:
 *   const handled = await handleGamingRoute(req, res, { sendJson, readJsonBody, checkAccess, dbReady });
 */
import { requireAuth } from '../middleware.mjs';
import * as svc from './gamingService.mjs';

const BODY_LIMIT = 16 * 1024;

// [method, pattern, handler(actor, params, body, query)]
const ROUTES = [
  ['GET', '/me', (a) => svc.getMe(a)],
  ['GET', '/overview', (a) => svc.overview(a)],

  ['GET', '/games', (a, _p, _b, q) => svc.listGames(a, { includeInactive: q.get('all') === '1' })],
  ['POST', '/games', (a, _p, b) => svc.createGame(a, b)],
  ['PATCH', '/games/:id', (a, p, b) => svc.updateGame(a, p.id, b)],

  ['GET', '/rooms', (a, _p, _b, q) => svc.listRooms(a, {
    game: q.get('game'), type: q.get('type'), platform: q.get('platform'), open: q.get('open'),
  })],
  ['POST', '/rooms', (a, _p, b) => svc.createRoom(a, b)],
  ['POST', '/join-by-code', (a, _p, b) => svc.joinByCode(a, b.code)],
  ['GET', '/rooms/:id', (a, p) => svc.getRoomDetail(a, p.id)],
  ['PATCH', '/rooms/:id', (a, p, b) => svc.updateRoomSettings(a, p.id, b)],
  ['POST', '/rooms/:id/join', (a, p, b) => svc.joinRoom(a, p.id, b)],
  ['POST', '/rooms/:id/leave', (a, p) => svc.leaveRoom(a, p.id)],
  ['POST', '/rooms/:id/close', (a, p) => svc.closeRoom(a, p.id)],
  ['POST', '/rooms/:id/kick', (a, p, b) => svc.kickMember(a, p.id, b.userId, { ban: !!b.ban, reason: b.reason })],
  ['POST', '/rooms/:id/mute', (a, p, b) => svc.muteMember(a, p.id, b.userId, b.minutes)],
  ['POST', '/rooms/:id/role', (a, p, b) => svc.setMemberRole(a, p.id, b.userId, b.roomRole)],
  ['POST', '/rooms/:id/transfer', (a, p, b) => svc.transferOwnership(a, p.id, b.userId)],
  ['POST', '/rooms/:id/ready', (a, p, b) => svc.setReady(a, p.id, b.ready !== false)],
  ['POST', '/rooms/:id/ready-check', (a, p) => svc.readyCheck(a, p.id)],
  ['POST', '/rooms/:id/ping', (a, p) => svc.pingLookingForSquad(a, p.id)],
  ['GET', '/rooms/:id/messages', (a, p, _b, q) => svc.listMessages(a, p.id, { before: q.get('before'), limit: q.get('limit') })],
  ['POST', '/rooms/:id/messages', (a, p, b) => svc.postMessage(a, p.id, b)],
  ['DELETE', '/rooms/:id/messages/:messageId', (a, p) => svc.deleteMessage(a, p.id, p.messageId)],

  ['GET', '/profile', (a) => svc.getProfile(a, a.id)],
  ['PUT', '/profile', (a, _p, b) => svc.saveProfile(a, b)],
  ['GET', '/profile/:userId', (a, p) => svc.getProfile(a, p.userId)],
  ['GET', '/lfg', (a, _p, _b, q) => svc.listLookingForSquad(a, q.get('game'))],

  ['GET', '/events', (a, _p, _b, q) => svc.listEvents(a, { game: q.get('game'), kind: q.get('kind'), past: q.get('past') === '1' })],
  ['POST', '/events', (a, _p, b) => svc.createEvent(a, b)],
  ['GET', '/events/:id', (a, p) => svc.getEventDetail(a, p.id)],
  ['PATCH', '/events/:id', (a, p, b) => svc.updateEvent(a, p.id, b)],
  ['POST', '/events/:id/register', (a, p, b) => svc.registerForEvent(a, p.id, b)],
  ['POST', '/events/:id/unregister', (a, p) => svc.unregisterFromEvent(a, p.id)],
  ['POST', '/events/:id/checkin', (a, p) => svc.checkIn(a, p.id)],
  ['POST', '/events/:id/bracket', (a, p) => svc.generateBracket(a, p.id)],
  ['POST', '/matches/:id/report', (a, p, b) => svc.reportMatch(a, p.id, b)],
  ['POST', '/matches/:id/confirm', (a, p) => svc.confirmMatch(a, p.id)],
  ['POST', '/matches/:id/dispute', (a, p) => svc.confirmMatch(a, p.id, { dispute: true })],
  ['POST', '/matches/:id/resolve', (a, p, b) => svc.resolveMatch(a, p.id, b)],
  ['GET', '/leaderboard', (a, _p, _b, q) => svc.leaderboard(a, { game: q.get('game'), period: q.get('period') })],

  ['POST', '/reports', (a, _p, b) => svc.createReport(a, b)],
  ['GET', '/reports', (a, _p, _b, q) => svc.listReports(a, { status: q.get('status') })],
  ['POST', '/reports/:id', (a, p, b) => svc.resolveReport(a, p.id, b)],
  ['GET', '/sanctions', (a, _p, _b, q) => svc.listSanctions(a, { userId: q.get('userId'), active: q.get('active') })],
  ['POST', '/sanctions', (a, _p, b) => svc.issueSanction(a, b)],
  ['POST', '/sanctions/:id/revoke', (a, p) => svc.revokeSanction(a, p.id)],
].map(([method, pattern, handler]) => {
  const names = [];
  const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_m, name) => { names.push(name); return '([^/]+)'; })}$`);
  return { method, re, names, handler };
});

export function matchGamingRoute(method, path) {
  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const match = path.match(route.re);
    if (!match) continue;
    const params = {};
    route.names.forEach((name, index) => {
      try { params[name] = decodeURIComponent(match[index + 1]); } catch { params[name] = match[index + 1]; }
    });
    return { handler: route.handler, params };
  }
  return null;
}

/** Returns true when the request was a gaming route (handled or rejected). */
export async function handleGamingRoute(req, res, { sendJson, readJsonBody, checkAccess, dbReady }) {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/gaming/')) return false;
  const path = url.pathname.slice('/api/gaming'.length);
  const route = matchGamingRoute(req.method, path);
  if (!route) {
    sendJson(res, 404, { success: false, error: 'Unknown Gaming Zone endpoint.' });
    return true;
  }
  const actor = requireAuth(req, res);
  if (!actor) return true;
  if (!dbReady()) {
    sendJson(res, 503, { success: false, error: 'The Gaming Zone needs the database, which is offline.' });
    return true;
  }
  const access = await checkAccess(actor);
  if (!access.allowed) {
    sendJson(res, 403, { success: false, error: access.reason || 'The Gaming Zone is not available for your account.' });
    return true;
  }
  let body = {};
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    try {
      body = (await readJsonBody(req, BODY_LIMIT)) || {};
    } catch (err) {
      sendJson(res, 400, { success: false, error: err.message || 'Invalid request body.' });
      return true;
    }
    if (typeof body !== 'object' || Array.isArray(body)) body = {};
  }
  try {
    const data = await route.handler(actor, route.params, body, url.searchParams);
    sendJson(res, 200, { success: true, data });
  } catch (err) {
    if (err instanceof svc.GamingError) {
      sendJson(res, err.status, { success: false, error: err.message, ...(err.retryAfterMs ? { retryAfterMs: err.retryAfterMs } : {}) });
    } else {
      console.error('[gaming]', req.method, url.pathname, err?.stack || err);
      sendJson(res, 500, { success: false, error: 'Something went wrong in the Gaming Zone.' });
    }
  }
  return true;
}
