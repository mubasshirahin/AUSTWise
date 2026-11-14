import { useCallback, useEffect, useRef, useState } from 'react';
import { onRealtimeMessage, onRealtimeStatus, sendRealtime } from '../../utils/liveStore';

/** Call /api/gaming/*. Resolves with `data`, rejects with Error(message) + status. */
export async function gz(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api/gaming${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const err = new Error(json.error || 'Something went wrong.');
    err.status = res.status;
    err.retryAfterMs = json.retryAfterMs;
    throw err;
  }
  return json.data;
}

/** Load a gaming endpoint: { data, error, loading, reload, setData }. */
export function useGz(path, { skip = false } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: !skip });
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (skip || !path) return;
    const id = ++seq.current;
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const data = await gz(path);
      if (id === seq.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (id === seq.current) setState((prev) => ({ ...prev, error, loading: false }));
    }
  }, [path, skip]);
  useEffect(() => { load(); }, [load]);
  const setData = useCallback((updater) => {
    setState((prev) => ({ ...prev, data: typeof updater === 'function' ? updater(prev.data) : updater }));
  }, []);
  return { ...state, reload: load, setData };
}

/** Subscribe to a server push type for the life of the component. */
export function useGzEvent(type, handler) {
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => onRealtimeMessage(type, (payload) => ref.current?.(payload)), [type]);
}

const mergeMessages = (list, incoming) => {
  const byId = new Map(list.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, { ...byId.get(message.id), ...message });
  return [...byId.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

/**
 * Live chat for one room. Reads history over HTTP, receives new messages over
 * the shared socket, sends over HTTP (so errors come back directly).
 */
export function useGamingRoom(roomId, { enabled = true, onRoom, onMembers, onClosed } = {}) {
  const [messages, setMessages] = useState([]);
  const [authors, setAuthors] = useState({});
  const [viewers, setViewers] = useState([]);
  const [typing, setTyping] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [live, setLive] = useState(false);
  const callbacks = useRef({ onRoom, onMembers, onClosed });
  useEffect(() => { callbacks.current = { onRoom, onMembers, onClosed }; });

  useEffect(() => {
    if (!roomId || !enabled) return undefined;
    let cancelled = false;
    setLoading(true);
    setMessages([]);
    gz(`/rooms/${encodeURIComponent(roomId)}/messages?limit=50`)
      .then((data) => {
        if (cancelled) return;
        setMessages(data.messages);
        setAuthors(data.authors);
        setHasMore(data.messages.length >= 50);
        setError(null);
      })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [roomId, enabled]);

  // (Re)subscribe whenever the socket (re)connects.
  useEffect(() => {
    if (!roomId || !enabled) return undefined;
    const offStatus = onRealtimeStatus((connected) => {
      setLive(connected);
      if (connected) sendRealtime('gz-subscribe', { roomId });
    });
    return () => {
      offStatus();
      sendRealtime('gz-unsubscribe', { roomId });
    };
  }, [roomId, enabled]);

  useEffect(() => {
    if (!roomId || !enabled) return undefined;
    const mine = (payload) => payload?.roomId === roomId;
    const offs = [
      onRealtimeMessage('gz-message', (p) => {
        if (!mine(p)) return;
        setMessages((list) => mergeMessages(list, [p.message]));
        if (p.author) setAuthors((map) => ({ ...map, [p.author.id]: p.author }));
        setTyping((map) => { const next = { ...map }; delete next[p.message.fromId]; return next; });
      }),
      onRealtimeMessage('gz-message-deleted', (p) => {
        if (!mine(p)) return;
        setMessages((list) => list.map((message) => (message.id === p.messageId ? { ...message, deleted: true, text: '' } : message)));
      }),
      onRealtimeMessage('gz-presence', (p) => { if (mine(p)) setViewers(p.viewers || []); }),
      onRealtimeMessage('gz-typing', (p) => {
        if (!mine(p)) return;
        setTyping((map) => {
          const next = { ...map };
          if (p.isTyping) next[p.userId] = Date.now(); else delete next[p.userId];
          return next;
        });
      }),
      onRealtimeMessage('gz-room-update', (p) => { if (mine(p)) callbacks.current.onRoom?.(p.room); }),
      onRealtimeMessage('gz-members', (p) => { if (mine(p)) callbacks.current.onMembers?.(p.members); }),
      onRealtimeMessage('gz-room-closed', (p) => { if (mine(p)) callbacks.current.onClosed?.(p.reason); }),
      onRealtimeMessage('gz-kicked', (p) => { if (mine(p)) callbacks.current.onClosed?.(p.banned ? 'banned' : 'kicked'); }),
    ];
    return () => offs.forEach((off) => off());
  }, [roomId, enabled]);

  // Drop typing flags after 6s of silence.
  useEffect(() => {
    const timer = setInterval(() => {
      setTyping((map) => {
        const now = Date.now();
        const next = Object.fromEntries(Object.entries(map).filter(([, at]) => now - at < 6000));
        return Object.keys(next).length === Object.keys(map).length ? map : next;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const send = useCallback(async (text, replyToId) => {
    const result = await gz(`/rooms/${encodeURIComponent(roomId)}/messages`, { method: 'POST', body: { text, replyToId } });
    setMessages((list) => mergeMessages(list, [result.message]));
    if (result.author) setAuthors((map) => ({ ...map, [result.author.id]: result.author }));
    return result;
  }, [roomId]);

  const remove = useCallback(async (messageId) => {
    await gz(`/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' });
    setMessages((list) => list.map((message) => (message.id === messageId ? { ...message, deleted: true, text: '' } : message)));
  }, [roomId]);

  const loadOlder = useCallback(async () => {
    const oldest = messages[0];
    if (!oldest) return;
    const data = await gz(`/rooms/${encodeURIComponent(roomId)}/messages?limit=50&before=${encodeURIComponent(oldest.createdAt)}`);
    setMessages((list) => mergeMessages(list, data.messages));
    setAuthors((map) => ({ ...map, ...data.authors }));
    setHasMore(data.messages.length >= 50);
  }, [messages, roomId]);

  const lastTypingSent = useRef(0);
  const notifyTyping = useCallback(() => {
    if (Date.now() - lastTypingSent.current < 2500) return;
    lastTypingSent.current = Date.now();
    sendRealtime('gz-typing', { roomId, isTyping: true });
  }, [roomId]);

  return { messages, authors, viewers, typing, loading, error, hasMore, live, send, remove, loadOlder, notifyTyping };
}

export function timeAgo(value) {
  const ms = Date.now() - new Date(value).getTime();
  if (ms < 60000) return 'just now';
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

export function formatWhen(value) {
  const date = new Date(value);
  return date.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function clockTime(value) {
  return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
