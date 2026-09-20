import { useEffect, useRef, useState, useCallback } from 'react';
import {
  initLiveStore,
  onRealtimeMessage,
  onRealtimeStatus,
  sendRealtime,
  getLiveStoreStatus,
} from '../utils/liveStore';

/**
 * Custom hook for real-time messaging — multiplexed over the app's single
 * shared WebSocket (liveStore). Every consumer used to open its own
 * connection (8+ sockets per user); they all share one now, which matters on
 * hosts with per-user connection limits and slow cold starts (Render).
 *
 * The public API is unchanged: pass the same `options` callbacks, get the
 * same send helpers back. The server protocol is unchanged too — the shared
 * socket registers the user once (liveStore `subscribe`), and every message
 * type is fanned out to each mounted consumer by the liveStore message bus.
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
  const [socketConnected, setSocketConnected] = useState(getLiveStoreStatus().connected);
  // Derived so a logged-out consumer never reports a stale live connection.
  const connected = Boolean(userId) && socketConnected;
  const [onlineUsers, setOnlineUsers] = useState([]);

  // Store callbacks in a ref so bus subscriptions stay stable across renders
  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; });

  // One shared socket for the whole app — make sure it exists (idempotent).
  useEffect(() => {
    if (userId) initLiveStore(userId);
  }, [userId]);

  // Track the shared socket's connection status. onRealtimeStatus fires once
  // with the current status on subscribe, so a consumer that mounts after the
  // socket opened (or after login) syncs without a sync setState here.
  useEffect(() => {
    if (!userId) return undefined;
    return onRealtimeStatus((isConnected) => {
      setSocketConnected(isConnected);
      optionsRef.current.onConnectionChange?.(isConnected);
    });
  }, [userId]);

  // Fan protocol messages out to this instance's callbacks. Unsubscribing on
  // cleanup fully detaches this consumer from the bus — other consumers and
  // the shared socket keep running.
  useEffect(() => {
    if (!userId) return undefined;
    const opts = () => optionsRef.current;

    const unsubs = [
      onRealtimeMessage('message', (p) => opts().onMessage?.(p)),
      onRealtimeMessage('message-status', (p) => opts().onMessageStatus?.(p)),
      onRealtimeMessage('typing', (p) => opts().onTyping?.(p)),
      onRealtimeMessage('read', (p) => opts().onRead?.(p)),
      onRealtimeMessage('reaction', (p) => opts().onReaction?.(p)),
      onRealtimeMessage('delete-message', (p) => opts().onDelete?.(p)),
      onRealtimeMessage('edit-message', (p) => opts().onEdit?.(p)),
      onRealtimeMessage('online', (p) => {
        setOnlineUsers((prev) => {
          const updated = p.online
            ? [...new Set([...prev, p.userId])]
            : prev.filter((id) => id !== p.userId);
          opts().onOnlineUsers?.(updated);
          return updated;
        });
      }),
      onRealtimeMessage('online-users', (p) => {
        setOnlineUsers(p.userIds || []);
        opts().onOnlineUsers?.(p.userIds || []);
      }),
      onRealtimeMessage('presence', (p) => opts().onPresence?.(p)),
      onRealtimeMessage('presence-snapshot', (p) => opts().onPresenceSnapshot?.(p.presence || {})),
      onRealtimeMessage('marketplace-listing', (p) => opts().onMarketplaceListing?.(p)),
      onRealtimeMessage('profile-update', (p) => opts().onProfileUpdate?.(p)),
      onRealtimeMessage('routine-shared', (p) => opts().onRoutineShared?.(p)),
      onRealtimeMessage('notice-new', (p) => opts().onNoticeNew?.(p)),
      onRealtimeMessage('library-occupancy', (p) => opts().onLibraryOccupancy?.(p)),
      onRealtimeMessage('store-change', (p) => opts().onStoreChange?.(p)),
      onRealtimeMessage('error', (p) => console.warn('WebSocket message:', p?.message)),
    ];
    return () => unsubs.forEach((u) => u());
  }, [userId]);

  /** Send a message to a peer */
  const sendMessage = useCallback((fromId, toId, text, id, timestamp) => {
    sendRealtime('message', { fromId, toId, text, id, timestamp: timestamp || new Date().toISOString() });
  }, []);

  /** Signal typing status to a peer */
  const sendTyping = useCallback((toId, isTyping) => {
    sendRealtime('typing', { toId, isTyping });
  }, []);

  /** Signal read receipt to a peer */
  const sendRead = useCallback((peerId, conversationId) => {
    sendRealtime('read', { peerId, conversationId });
  }, []);

  /** Send a reaction to a message */
  const sendReaction = useCallback((messageId, emoji, userId, conversationId) => {
    sendRealtime('reaction', { messageId, emoji, userId, conversationId });
  }, []);

  /** Send a message deletion event */
  const sendDelete = useCallback((messageId, userId, conversationId) => {
    sendRealtime('delete-message', { messageId, userId, conversationId });
  }, []);

  /** Send a message edit event */
  const sendEdit = useCallback((messageId, text, userId, conversationId) => {
    sendRealtime('edit-message', { messageId, text, userId, conversationId });
  }, []);

  /** Subscribe to a specific conversation */
  const subscribe = useCallback((conversationId) => {
    sendRealtime('subscribe', { conversationId });
  }, []);

  /** Unsubscribe from a specific conversation */
  const unsubscribe = useCallback((conversationId) => {
    sendRealtime('unsubscribe', { conversationId });
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
