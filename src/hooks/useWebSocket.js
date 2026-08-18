import { useEffect, useRef, useCallback, useState } from 'react';

const WS_RECONNECT_DELAY = 2000;
const WS_MAX_RECONNECT_DELAY = 15000;
const PING_INTERVAL = 30000;

/**
 * Custom hook for WebSocket-based real-time messaging.
 *
 * @param {string|null} userId - Current user's ID (null = not logged in)
 * @param {object} options
 * @param {function} options.onMessage - Called when a new message arrives
 * @param {function} options.onMessageStatus - Called with { messageId, status } when delivery is confirmed
 * @param {function} options.onTyping - Called when peer is typing
 * @param {function} options.onRead - Called when peer reads messages
 * @param {function} options.onReaction - Called when peer reacts to a message
 * @param {function} options.onDelete - Called when peer deletes a message
 * @param {function} options.onEdit - Called when peer edits a message
 * @param {function} options.onOnlineUsers - Called with array of online user IDs
 * @param {function} options.onPresence - Called with { userId, status, lastSeenAt } when a user's presence changes
 * @param {function} options.onPresenceSnapshot - Called with { presence } object map on connect
 * @param {function} options.onConnectionChange - Called with boolean (connected/disconnected)
 * @param {function} options.onMarketplaceListing - Called with { action: 'create'|'delete', item?, id? } when a listing changes
 * @param {function} options.onProfileUpdate - Called with { userId, fields } when a user profile is updated
 * @param {function} options.onRoutineShared - Called with { action: 'publish'|'delete', crId } when a routine is shared/removed
 * @param {function} options.onNoticeNew - Called with { title, content, postedByName, postedByRole } when a notice is posted
 * @param {function} options.onLibraryOccupancy - Called with { action, userId, isInside? } when library checkin/checkout happens
 * @param {function} options.onStoreChange - Called with { scope: 'user'|'shared', key } when a stored value changes
 */
export default function useWebSocket(userId, options = {}) {
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const mountedRef = useRef(true);
  const connectRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);

  // Store callbacks in refs to avoid re-creating `connect` when callbacks change
  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; }, [options]);

  const connect = useCallback(() => {
    if (!userId || !mountedRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/socket.io/`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close();
          return;
        }
        setConnected(true);
        reconnectAttemptRef.current = 0;

        // Notify parent and allow it to drain any pending message queue
        optionsRef.current.onConnectionChange?.(true);

        // Register user with server
        ws.send(JSON.stringify({
          type: 'subscribe',
          payload: { userId },
        }));

        // Start ping interval
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', payload: {} }));
          }
        }, PING_INTERVAL);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;

        try {
          const { type, payload } = JSON.parse(event.data);
          if (!type || !payload) return;

          const opts = optionsRef.current;

          switch (type) {
            case 'connected':
            case 'user-registered':
            case 'subscribed':
              break;

            case 'message':
              opts.onMessage?.(payload);
              break;

            case 'message-status':
              opts.onMessageStatus?.(payload);
              break;

            case 'typing':
              opts.onTyping?.(payload);
              break;

            case 'read':
              opts.onRead?.(payload);
              break;

            case 'reaction':
              opts.onReaction?.(payload);
              break;

            case 'delete-message':
              opts.onDelete?.(payload);
              break;

            case 'edit-message':
              opts.onEdit?.(payload);
              break;

            case 'online': {
              setOnlineUsers((prev) => {
                const updated = payload.online
                  ? [...new Set([...prev, payload.userId])]
                  : prev.filter((id) => id !== payload.userId);
                opts.onOnlineUsers?.(updated);
                return updated;
              });
              break;
            }

            case 'online-users':
              setOnlineUsers(payload.userIds || []);
              opts.onOnlineUsers?.(payload.userIds || []);
              break;

            case 'presence':
              opts.onPresence?.(payload);
              break;

            case 'presence-snapshot':
              opts.onPresenceSnapshot?.(payload.presence || {});
              break;

            case 'marketplace-listing':
              opts.onMarketplaceListing?.(payload);
              break;

            case 'profile-update':
              opts.onProfileUpdate?.(payload);
              break;

            case 'routine-shared':
              opts.onRoutineShared?.(payload);
              break;

            case 'notice-new':
              opts.onNoticeNew?.(payload);
              break;

            case 'library-occupancy':
              opts.onLibraryOccupancy?.(payload);
              break;

            case 'store-change':
              opts.onStoreChange?.(payload);
              break;

            case 'error':
              console.warn('WebSocket message:', payload.message);
              break;
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        optionsRef.current.onConnectionChange?.(false);

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Auto-reconnect with exponential backoff
        if (userId && mountedRef.current) {
          const delay = Math.min(
            WS_RECONNECT_DELAY * Math.pow(1.5, reconnectAttemptRef.current),
            WS_MAX_RECONNECT_DELAY
          );
          reconnectAttemptRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => connectRef.current?.(), delay);
        }
      };

      ws.onerror = () => {
        // Error triggers onclose, so we handle reconnection there
      };
    } catch {
      // Connection failed, will retry via onclose
    }
  }, [userId]); // Only reconnect when userId changes — callbacks are read from ref

  // Keep the latest connect in a ref so the reconnect timeout can call it
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Connect when userId changes
  useEffect(() => {
    mountedRef.current = true;
    if (userId) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [userId, connect]);

  /** Send a message to a peer */
  const sendMessage = useCallback((fromId, toId, text, id, timestamp) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        payload: { fromId, toId, text, id, timestamp: timestamp || new Date().toISOString() },
      }));
    }
  }, []);

  /** Signal typing status to a peer */
  const sendTyping = useCallback((toId, isTyping) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        payload: { toId, isTyping },
      }));
    }
  }, []);

  /** Signal read receipt to a peer */
  const sendRead = useCallback((peerId, conversationId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'read',
        payload: { peerId, conversationId },
      }));
    }
  }, []);

  /** Send a reaction to a message */
  const sendReaction = useCallback((messageId, emoji, userId, conversationId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'reaction',
        payload: { messageId, emoji, userId, conversationId },
      }));
    }
  }, []);

  /** Send a message deletion event */
  const sendDelete = useCallback((messageId, userId, conversationId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'delete-message',
        payload: { messageId, userId, conversationId },
      }));
    }
  }, []);

  /** Send a message edit event */
  const sendEdit = useCallback((messageId, text, userId, conversationId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'edit-message',
        payload: { messageId, text, userId, conversationId },
      }));
    }
  }, []);

  /** Subscribe to a specific conversation */
  const subscribe = useCallback((conversationId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        payload: { conversationId },
      }));
    }
  }, []);

  /** Unsubscribe from a specific conversation */
  const unsubscribe = useCallback((conversationId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        payload: { conversationId },
      }));
    }
  }, []);

  return {
    connected,
    onlineUsers,
    sendMessage,
    sendTyping,
    sendRead,
    sendReaction,
    sendDelete,
    sendEdit,
    subscribe,
    unsubscribe,
    isReady: connected,
  };
}
