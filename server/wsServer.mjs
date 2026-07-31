/**
 * WebSocket Server — Real-time Messaging for AUSTWise
 *
 * Message protocol (JSON):
 *   { type: 'message',      payload: { fromId, toId, text, id, timestamp } }
 *   { type: 'typing',       payload: { fromId, toId, isTyping } }
 *   { type: 'read',         payload: { fromId, peerId } }
 *   { type: 'online',       payload: { userId, online } }
 *   { type: 'subscribe',    payload: { userId, conversationId } }
 *   { type: 'unsubscribe',  payload: { conversationId } }
 *   { type: 'conversations', payload: { userId } }  // request full refresh
 */

import { WebSocketServer } from 'ws';

// Map: userId -> Set<WebSocket>
const userClients = new Map();
// Map: conversationId -> Set<userId>
const conversationSubscribers = new Map();
// Map: userId -> Set<conversationId>
const userSubscriptions = new Map();

/* ─── Shadow Chat State ─── */
let shadowQueue = []; // Array<{ ws, shadowId }>
const shadowSessions = new Map(); // sessionId -> { userA: {ws, shadowId}, userB: {ws, shadowId}, expiresAt, timer }
const SHADOW_DURATION_MS = 10 * 60 * 1000; // 10 minutes

function generateSessionId() {
  return `shadow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function tryMatch() {
  if (shadowQueue.length < 2) return null;
  const userA = shadowQueue.shift();
  const userB = shadowQueue.shift();
  const sessionId = generateSessionId();
  const expiresAt = Date.now() + SHADOW_DURATION_MS;

  const session = {
    userA: { ws: userA.ws, shadowId: userA.shadowId },
    userB: { ws: userB.ws, shadowId: userB.shadowId },
    expiresAt,
    timer: null,
    tickInterval: null,
  };
  shadowSessions.set(sessionId, session);

  // Per-second server tick for fully synchronized countdown
  session.tickInterval = setInterval(() => {
    const remaining = Math.max(0, session.expiresAt - Date.now());
    const tickPayload = { type: 'shadow-tick', payload: { remaining, serverTime: Date.now() } };
    sendTo(session.userA.ws, tickPayload);
    sendTo(session.userB.ws, tickPayload);
  }, 1000);

  // Master timeout to auto-end session at exactly 10 minutes
  session.timer = setTimeout(() => {
    clearInterval(session.tickInterval);
    endShadowSession(sessionId, 'timeout');
  }, SHADOW_DURATION_MS);

  return { sessionId, userA, userB, expiresAt };
}

function endShadowSession(sessionId, reason) {
  const session = shadowSessions.get(sessionId);
  if (!session) return;

  if (session.timer) clearTimeout(session.timer);
  if (session.tickInterval) clearInterval(session.tickInterval);
  shadowSessions.delete(sessionId);

  const endPayload = { type: 'shadow-ended', payload: { sessionId, reason, serverTime: Date.now() } };
  sendTo(session.userA.ws, endPayload);
  sendTo(session.userB.ws, endPayload);
}

function findShadowSession(ws) {
  for (const [id, s] of shadowSessions) {
    if (s.userA.ws === ws || s.userB.ws === ws) return { sessionId: id, session: s };
  }
  return null;
}

function getShadowPeer(ws, session) {
  return session.userA.ws === ws ? session.userB : session.userA;
}

function removeFromShadowQueue(ws) {
  shadowQueue = shadowQueue.filter((entry) => entry.ws !== ws);
}

export function createWSServer(httpServer) {
  // noServer: true — we handle upgrades manually so Vite HMR and app
  // WebSocket connections can coexist on the same HTTP server.
  const wss = new WebSocketServer({ noServer: true });

  // Route upgrades: skip Vite HMR connections (identified by
  // sec-websocket-protocol header), handle app connections here.
  // The wss.on('connection', ...) handler below is already registered
  // synchronously by this point, so re-emitting 'connection' routes
  // the upgraded socket back into the existing handler.
  httpServer.on('upgrade', (request, socket, head) => {
    if (request.headers['sec-websocket-protocol'] === 'vite-hmr') {
      return; // Vite handles its own HMR upgrades
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws, req) => {
    let currentUserId = null;
    let shadowId = null;

    // Send a confirmation that connection is established
    sendTo(ws, { type: 'connected', payload: { serverTime: Date.now() } });

    /** Register the user ID for this connection */
    function setUserId(userId) {
      if (!userId) return false;
      const prevId = currentUserId;
      currentUserId = userId;

      // Remove from old user mapping
      if (prevId && prevId !== userId) {
        const clients = userClients.get(prevId);
        if (clients) clients.delete(ws);
        if (clients && clients.size === 0) {
          userClients.delete(prevId);
          broadcastOnlineStatus(prevId, false);
        }
      }

      // Add to new user mapping
      if (!userClients.has(userId)) {
        userClients.set(userId, new Set());
      }
      userClients.get(userId).add(ws);

      // Broadcast online status
      broadcastOnlineStatus(userId, true);

      // Send current user info back
      sendTo(ws, { type: 'user-registered', payload: { userId } });

      // Notify user about all currently online users
      const onlineUsers = [];
      for (const [uid] of userClients) {
        if (uid) onlineUsers.push(uid);
      }
      sendTo(ws, { type: 'online-users', payload: { userIds: onlineUsers } });
      return true;
    }

    ws.on('message', (raw) => {
      try {
        const { type, payload } = JSON.parse(raw.toString());
        if (!type || !payload) return;

        switch (type) {
          case 'subscribe':
            handleSubscribe(payload);
            break;

          case 'unsubscribe':
            handleUnsubscribe(payload);
            break;

          case 'message':
            handleMessage(payload);
            break;

          case 'typing':
            handleTyping(payload);
            break;

          case 'read':
            handleRead(payload);
            break;

          case 'reaction':
            handleReaction(payload);
            break;

          case 'delete-message':
            handleDelete(payload);
            break;

          case 'edit-message':
            handleEdit(payload);
            break;

          case 'ping':
            // Keep-alive, no response needed
            break;

          /* ─── Shadow Chat ─── */
          case 'shadow-join': {
            const { id } = payload;
            if (!id) return;
            shadowId = id;
            shadowQueue.push({ ws, shadowId: id });
            sendTo(ws, { type: 'shadow-queued', payload: { position: shadowQueue.length, serverTime: Date.now() } });
            // Try to match immediately
            const match = tryMatch();
            if (match) {
              const { sessionId, userA, userB, expiresAt } = match;
              const matchPayload = { sessionId, peerId: null, expiresAt, serverTime: Date.now() };
              sendTo(userA.ws, { type: 'shadow-matched', payload: { ...matchPayload, peerId: userB.shadowId } });
              sendTo(userB.ws, { type: 'shadow-matched', payload: { ...matchPayload, peerId: userA.shadowId } });
              // Update queue position for remaining queued users
              shadowQueue.forEach((entry, idx) => {
                sendTo(entry.ws, { type: 'shadow-queued', payload: { position: idx + 1, serverTime: Date.now() } });
              });
            }
            break;
          }

          case 'shadow-leave': {
            removeFromShadowQueue(ws);
            sendTo(ws, { type: 'shadow-left', payload: { serverTime: Date.now() } });
            shadowQueue.forEach((entry, idx) => {
              sendTo(entry.ws, { type: 'shadow-queued', payload: { position: idx + 1, serverTime: Date.now() } });
            });
            break;
          }

          case 'shadow-message': {
            const { sessionId, text, id: msgId, timestamp } = payload;
            if (!sessionId || !text) return;
            const s = shadowSessions.get(sessionId);
            if (!s) return;
            const peer = getShadowPeer(ws, s);
            sendTo(peer.ws, {
              type: 'shadow-message',
              payload: { text, id: msgId, timestamp: timestamp || Date.now(), from: shadowId },
            });
            break;
          }

          case 'shadow-typing': {
            const { sessionId, isTyping: typing } = payload;
            if (!sessionId) return;
            const s = shadowSessions.get(sessionId);
            if (!s) return;
            const peer = getShadowPeer(ws, s);
            sendTo(peer.ws, { type: 'shadow-typing', payload: { isTyping: typing } });
            break;
          }

          case 'shadow-time': {
            const { sessionId } = payload;
            if (!sessionId) return;
            const s = shadowSessions.get(sessionId);
            if (!s) return;
            const remaining = Math.max(0, s.expiresAt - Date.now());
            sendTo(ws, { type: 'shadow-time', payload: { remaining, serverTime: Date.now() } });
            break;
          }

          default:
            sendTo(ws, { type: 'error', payload: { message: `Unknown message type: ${type}` } });
        }
      } catch (err) {
        sendTo(ws, { type: 'error', payload: { message: 'Invalid message format' } });
      }
    });

    ws.on('close', () => {
      // Shadow cleanup
      if (shadowId) {
        removeFromShadowQueue(ws);
        const shadowEntry = findShadowSession(ws);
        if (shadowEntry) {
          endShadowSession(shadowEntry.sessionId, 'peer-disconnected');
        }
        shadowQueue.forEach((entry, idx) => {
          sendTo(entry.ws, { type: 'shadow-queued', payload: { position: idx + 1, serverTime: Date.now() } });
        });
      }
      // Regular user cleanup
      if (currentUserId) {
        broadcastOnlineStatus(currentUserId, false);
        cleanupUser(currentUserId);
      }
    });

    ws.on('error', () => {
      // Shadow cleanup
      if (shadowId) {
        removeFromShadowQueue(ws);
        const shadowEntry = findShadowSession(ws);
        if (shadowEntry) {
          endShadowSession(shadowEntry.sessionId, 'peer-disconnected');
        }
      }
      // Regular user cleanup
      if (currentUserId) {
        broadcastOnlineStatus(currentUserId, false);
        cleanupUser(currentUserId);
      }
    });

    /* ─── Message Handlers ─── */

    function handleSubscribe(payload) {
      const { userId, conversationId } = payload;
      const targetUserId = userId || currentUserId;

      if (!targetUserId) {
        sendTo(ws, { type: 'error', payload: { message: 'userId is required for subscribe' } });
        return;
      }

      // Register user on this connection if not already done
      if (!currentUserId || currentUserId !== targetUserId) {
        setUserId(targetUserId);
      } else if (!userClients.has(targetUserId) || !userClients.get(targetUserId).has(ws)) {
        // Ensure this ws is in the user's client set
        if (!userClients.has(targetUserId)) {
          userClients.set(targetUserId, new Set());
        }
        userClients.get(targetUserId).add(ws);
      }

      // Subscribe to conversation if provided
      if (conversationId) {
        if (!conversationSubscribers.has(conversationId)) {
          conversationSubscribers.set(conversationId, new Set());
        }
        conversationSubscribers.get(conversationId).add(targetUserId);

        if (!userSubscriptions.has(targetUserId)) {
          userSubscriptions.set(targetUserId, new Set());
        }
        userSubscriptions.get(targetUserId).add(conversationId);

        sendTo(ws, { type: 'subscribed', payload: { conversationId } });
      }
    }

    function handleUnsubscribe(payload) {
      const { conversationId } = payload;
      if (!currentUserId || !conversationId) return;

      const subscribers = conversationSubscribers.get(conversationId);
      if (subscribers) {
        subscribers.delete(currentUserId);
        if (subscribers.size === 0) conversationSubscribers.delete(conversationId);
      }

      const subs = userSubscriptions.get(currentUserId);
      if (subs) {
        subs.delete(conversationId);
        if (subs.size === 0) userSubscriptions.delete(currentUserId);
      }
    }

    function handleMessage(payload) {
      const { fromId, toId, text, id, timestamp } = payload;

      if (!fromId || !toId || !text || !id) {
        sendTo(ws, { type: 'error', payload: { message: 'fromId, toId, text, and id are required' } });
        return;
      }

      const messageData = {
        type: 'message',
        payload: { fromId, toId, text, id, timestamp: timestamp || new Date().toISOString() },
      };

      // Relay to recipient
      broadcastToUser(toId, messageData);

      // Also send back to sender to confirm delivery
      broadcastToUser(fromId, {
        type: 'message-status',
        payload: { messageId: id, status: 'delivered', timestamp: new Date().toISOString() },
      });
    }

    function handleTyping(payload) {
      const { toId, isTyping } = payload;
      if (!currentUserId || !toId) return;

      broadcastToUser(toId, {
        type: 'typing',
        payload: { fromId: currentUserId, isTyping },
      });
    }

    function handleRead(payload) {
      const { peerId, conversationId } = payload;
      if (!currentUserId || !peerId) return;

      broadcastToUser(peerId, {
        type: 'read',
        payload: { fromId: currentUserId, conversationId },
      });
    }

    function handleReaction(payload) {
      const { messageId, emoji, userId, conversationId } = payload;
      if (!messageId || !emoji || !userId || !conversationId) return;

      // Forward reaction to all other participants in the conversation
      const [userA, userB] = conversationId.split('|');
      const peerId = userA === userId ? userB : userA;

      broadcastToUser(peerId, {
        type: 'reaction',
        payload: { messageId, emoji, userId, conversationId },
      });
    }

    function handleDelete(payload) {
      const { messageId, userId, conversationId } = payload;
      if (!messageId || !userId || !conversationId) return;

      const [userA, userB] = conversationId.split('|');
      const peerId = userA === userId ? userB : userA;

      broadcastToUser(peerId, {
        type: 'delete-message',
        payload: { messageId, userId, conversationId },
      });
    }

    function handleEdit(payload) {
      const { messageId, text, userId, conversationId } = payload;
      if (!messageId || !text || !userId || !conversationId) return;

      const [userA, userB] = conversationId.split('|');
      const peerId = userA === userId ? userB : userA;

      broadcastToUser(peerId, {
        type: 'edit-message',
        payload: { messageId, text, userId, conversationId },
      });
    }
  });

  console.log('🔌 WebSocket server initialized');
  return wss;
}

/**
 * Broadcast a JSON message to ALL connected WebSocket clients.
 * Used for real-time updates like attendance sync from Telegram.
 */
export function broadcastToAll(data) {
  for (const [, clients] of userClients) {
    for (const ws of clients) {
      sendTo(ws, data);
    }
  }
}

/* ─── Internal Helpers ─── */

function sendTo(ws, data) {
  try {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(data));
    }
  } catch {
    // connection might be closed
  }
}

function broadcastToUser(userId, data) {
  const clients = userClients.get(userId);
  if (!clients) return;
  for (const ws of clients) {
    sendTo(ws, data);
  }
}

function broadcastOnlineStatus(userId, online) {
  const data = { type: 'online', payload: { userId, online } };
  for (const [uid, clients] of userClients) {
    if (uid && uid !== userId) {
      for (const ws of clients) {
        sendTo(ws, data);
      }
    }
  }
}

function cleanupUser(userId) {
  userClients.delete(userId);
  const subs = userSubscriptions.get(userId);
  if (subs) {
    for (const convId of subs) {
      const subscribers = conversationSubscribers.get(convId);
      if (subscribers) {
        subscribers.delete(userId);
        if (subscribers.size === 0) conversationSubscribers.delete(convId);
      }
    }
  }
  userSubscriptions.delete(userId);
}
