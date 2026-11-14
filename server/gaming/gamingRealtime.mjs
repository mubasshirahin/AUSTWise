/**
 * WebSocket side of the Gaming Zone. wsServer.mjs forwards every `gz-*`
 * message here together with the socket's verified user id (never a client
 * value), and calls dropGamingSocket() when the socket closes.
 *
 * Client → server:
 *   gz-subscribe   { roomId }            watch a room live
 *   gz-unsubscribe { roomId }
 *   gz-message     { roomId, text, replyToId?, clientId? }
 *   gz-typing      { roomId, isTyping }
 *   gz-ready       { roomId, ready }
 * Server → client: gz-subscribed, gz-message, gz-message-deleted, gz-typing,
 *   gz-room-update, gz-members, gz-presence, gz-room-closed, gz-ready-check,
 *   gz-kicked, gz-muted, gz-sanction, gz-lfg-ping, gz-event-*, gz-error
 */
import * as svc from './gamingService.mjs';
import {
  subscribeSocket, unsubscribeSocket, dropSocket, broadcastToRoom, roomViewers, sendToSocket, isGamingDbReady,
} from './gamingBus.mjs';

const MAX_ROOMS_PER_SOCKET = 8;
const watching = new WeakMap(); // ws -> Set<roomId>

async function pushPresence(roomId) {
  const ids = roomViewers(roomId);
  const cards = await svc.userCards(ids);
  broadcastToRoom(roomId, 'gz-presence', { roomId, viewers: ids.map((id) => cards[id]).filter(Boolean) });
}

function fail(ws, type, err, extra = {}) {
  sendToSocket(ws, 'gz-error', {
    for: type,
    status: err?.status || 500,
    error: err instanceof svc.GamingError ? err.message : 'Something went wrong.',
    ...(err?.retryAfterMs ? { retryAfterMs: err.retryAfterMs } : {}),
    ...extra,
  });
  if (!(err instanceof svc.GamingError)) console.error('[gaming-ws]', type, err?.stack || err);
}

export async function handleGamingSocket(ws, userId, type, payload = {}) {
  if (!userId) {
    sendToSocket(ws, 'gz-error', { for: type, status: 401, error: 'Sign in to use the Gaming Zone.' });
    return;
  }
  const roomId = typeof payload.roomId === 'string' ? payload.roomId.slice(0, 64) : '';
  if (!isGamingDbReady()) {
    sendToSocket(ws, 'gz-error', { for: type, roomId, status: 503, error: 'The Gaming Zone needs the database, which is offline.' });
    return;
  }
  try {
    const actor = await svc.accountForSocket(userId);
    if (!actor) {
      sendToSocket(ws, 'gz-error', { for: type, status: 401, error: 'Account not found.' });
      return;
    }
    switch (type) {
      case 'gz-subscribe': {
        if (!roomId) return;
        const rooms = watching.get(ws) || new Set();
        if (!rooms.has(roomId) && rooms.size >= MAX_ROOMS_PER_SOCKET) {
          sendToSocket(ws, 'gz-error', { for: type, status: 429, error: 'Watching too many rooms at once.' });
          return;
        }
        const check = await svc.canWatchRoom(actor, roomId);
        if (!check.ok) {
          sendToSocket(ws, 'gz-error', { for: type, roomId, status: 403, error: check.error });
          return;
        }
        rooms.add(roomId);
        watching.set(ws, rooms);
        subscribeSocket(ws, String(userId), roomId);
        sendToSocket(ws, 'gz-subscribed', { roomId });
        await pushPresence(roomId);
        return;
      }
      case 'gz-unsubscribe': {
        if (!roomId) return;
        watching.get(ws)?.delete(roomId);
        unsubscribeSocket(ws, roomId);
        await pushPresence(roomId);
        return;
      }
      case 'gz-message': {
        const result = await svc.postMessage(actor, roomId, { text: payload.text, replyToId: payload.replyToId });
        sendToSocket(ws, 'gz-message-ack', {
          roomId, clientId: payload.clientId || null, messageId: result.message.id,
          flagged: result.flagged, linksRemoved: result.linksRemoved,
        });
        return;
      }
      case 'gz-typing':
        await svc.typing(actor, roomId, payload.isTyping);
        return;
      case 'gz-ready':
        await svc.setReady(actor, roomId, payload.ready !== false);
        return;
      default:
        sendToSocket(ws, 'gz-error', { for: type, status: 400, error: `Unknown gaming message: ${type}` });
    }
  } catch (err) {
    fail(ws, type, err, { roomId, clientId: payload.clientId || null });
  }
}

/** Socket closed: forget it and refresh presence in the rooms it watched. */
export function dropGamingSocket(ws) {
  const rooms = dropSocket(ws);
  watching.delete(ws);
  for (const roomId of rooms) pushPresence(roomId).catch(() => {});
}
