/**
 * Realtime fan-out for Gaming Zone rooms: which sockets watch which room,
 * plus user-level delivery injected from wsServer (no import cycle).
 */

const roomSockets = new Map(); // roomId -> Set<ws>
const socketRooms = new Map(); // ws -> Set<roomId>
const socketUser = new Map(); // ws -> userId

let deliverToUsers = () => {};
let onlineUserIds = () => [];
let dbReady = () => true;

/** Called once at boot with wsServer's helpers. */
export function configureGamingBus({ broadcastToUsers, getPresenceMap, isDbReady }) {
  if (isDbReady) dbReady = isDbReady;
  if (broadcastToUsers) deliverToUsers = broadcastToUsers;
  if (getPresenceMap) onlineUserIds = () => Object.keys(getPresenceMap() || {});
}

function send(ws, data) {
  try {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(data));
  } catch { /* socket closing */ }
}

export function sendToSocket(ws, type, payload) {
  send(ws, { type, payload });
}

export function subscribeSocket(ws, userId, roomId) {
  if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set());
  roomSockets.get(roomId).add(ws);
  if (!socketRooms.has(ws)) socketRooms.set(ws, new Set());
  socketRooms.get(ws).add(roomId);
  socketUser.set(ws, userId);
}

export function unsubscribeSocket(ws, roomId) {
  roomSockets.get(roomId)?.delete(ws);
  if (roomSockets.get(roomId)?.size === 0) roomSockets.delete(roomId);
  socketRooms.get(ws)?.delete(roomId);
}

/** Forget a closed socket. Returns the rooms it was watching. */
export function dropSocket(ws) {
  const rooms = [...(socketRooms.get(ws) || [])];
  for (const roomId of rooms) unsubscribeSocket(ws, roomId);
  socketRooms.delete(ws);
  socketUser.delete(ws);
  return rooms;
}

/** Stop every socket of `userId` from watching `roomId` (kick / ban). */
export function unsubscribeUserFromRoom(userId, roomId) {
  for (const ws of [...(roomSockets.get(roomId) || [])]) {
    if (socketUser.get(ws) === String(userId)) unsubscribeSocket(ws, roomId);
  }
}

export function broadcastToRoom(roomId, type, payload) {
  for (const ws of roomSockets.get(roomId) || []) send(ws, { type, payload });
}

/** Distinct users currently watching a room. */
export function roomViewers(roomId) {
  const ids = new Set();
  for (const ws of roomSockets.get(roomId) || []) {
    const userId = socketUser.get(ws);
    if (userId) ids.add(userId);
  }
  return [...ids];
}

export function viewerCounts() {
  const out = {};
  for (const roomId of roomSockets.keys()) out[roomId] = roomViewers(roomId).length;
  return out;
}

export function sendToUsers(userIds, type, payload) {
  deliverToUsers(userIds, { type, payload });
}

export function getOnlineUserIds() {
  return onlineUserIds();
}

export function isGamingDbReady() {
  return !!dbReady();
}
