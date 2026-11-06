// Server-backed message API client. Falls back to localStorage cache when the
// API is unreachable (offline / no backend) so messaging keeps working in
// hybrid mode. localStorage is the *cache of last resort*, not the source.
//
// Migration note: the server exposes /api/messages (GET/POST) and per-id
// PUT/DELETE routes in server/dev.mjs + server/prisma.js.
import { sanitizeUserInput, MAX_TEXT_LENGTH } from './sanitize';
import { getConversationId } from './messageStorage';

const messagesKey = 'aust-messages-v1';

function api() {
  const base = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) || '';
  return {
    baseUrl: base,
    async fetch(input, init = {}) {
      const url = base + (input.startsWith('/') ? input : '/' + input);
      const resp = await window.fetch(url, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const err = new Error(data.error || data.message || 'Request failed');
        err.status = resp.status;
        err.data = data;
        throw err;
      }
      return data;
    },
  };
}

function readLocal() {
  try {
    const raw = localStorage.getItem(messagesKey);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function writeLocal(list) {
  try { localStorage.setItem(messagesKey, JSON.stringify(list)); } catch { /* full */ }
}

export async function sendMessage(userId, toId, text, replyTo, messageId = null) {
  const clean = sanitizeUserInput(String(text || '').trim(), MAX_TEXT_LENGTH);
  if (!clean || !userId || !toId || userId === toId) return null;
  const payload = { toId, text: clean };
  if (messageId) payload.id = messageId;
  if (replyTo && replyTo.messageId) {
    payload.replyTo = {
      messageId: replyTo.messageId,
      text: String(replyTo.text || '').slice(0, 120),
      fromId: replyTo.fromId || '',
    };
  }
  const message = {
    id: `MSG-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    conversationId: getConversationId(userId, toId),
    fromId: userId,
    toId,
    text: clean,
    timestamp: new Date().toISOString(),
    read: false,
  };
  if (payload.replyTo) message.replyTo = payload.replyTo;

  try {
    await api().fetch('/api/messages', { method: 'POST', body: JSON.stringify(payload) });
  } catch {
    // NOTE: do NOT write to the local cache here — the caller
    // (messageStorage.sendMessage) already cached the optimistic copy.
    // Writing another copy here duplicated the message on every POST failure.
  }
  return message;
}

export async function fetchThread(userId, peerId) {
  try {
    const data = await api().fetch(`/api/messages?peer=${encodeURIComponent(peerId)}`);
    return data.thread || [];
  } catch {
    const convId = getConversationId(userId, peerId);
    return readLocal().filter((m) => m.conversationId === convId);
  }
}

export async function fetchConversations(userId) {
  try {
    const data = await api().fetch('/api/messages');
    return data.conversations || [];
  } catch {
    const list = readLocal();
    const map = new Map();
    for (const m of list) {
      if (m.fromId !== userId && m.toId !== userId) continue;
      const peerId = m.fromId === userId ? m.toId : m.fromId;
      const convId = getConversationId(userId, peerId);
      const existing = map.get(convId);
      if (!existing || new Date(m.timestamp) > new Date(existing.lastTimestamp)) {
        map.set(convId, {
          conversationId: convId,
          peerId,
          lastMessage: m,
          lastTimestamp: m.timestamp,
          unread: m.toId === userId && !m.read ? 1 : 0,
        });
      } else if (m.toId === userId && !m.read) {
        existing.unread += 1;
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      new Date(b.lastTimestamp) - new Date(a.lastTimestamp)
    );
  }
}

export async function deleteRemoteMessage(messageId) {
  try {
    await api().fetch(`/api/messages/${encodeURIComponent(messageId)}`, {
      method: 'DELETE',
    });
  } catch { /* cache only */ }
  // optimistic local delete
  const list = readLocal().map((m) =>
    m.id === messageId ? { ...m, deleted: true, text: '' } : m
  );
  writeLocal(list);
}

export async function editRemoteMessage(messageId, text) {
  const clean = sanitizeUserInput(String(text || '').trim(), MAX_TEXT_LENGTH);
  if (!clean) return null;
  try {
    await api().fetch(`/api/messages/${encodeURIComponent(messageId)}`, {
      method: 'PUT',
      body: JSON.stringify({ text: clean }),
    });
  } catch { /* cache only */ }
  const list = readLocal();
  const idx = list.findIndex((m) => m.id === messageId);
  if (idx !== -1) {
    list[idx].text = clean;
    list[idx].edited = true;
    list[idx].editedAt = new Date().toISOString();
    writeLocal(list);
    return list[idx];
  }
  return null;
}

export async function toggleRemoteReaction(messageId, userId, emoji) {
  try {
    await api().fetch(`/api/messages/${encodeURIComponent(messageId)}/reaction`, {
      method: 'POST',
      body: JSON.stringify({ userId, emoji }),
    });
  } catch { /* cache only */ }
  const list = readLocal();
  const msg = list.find((m) => m.id === messageId);
  if (msg) {
    if (!msg.reactions) msg.reactions = {};
    const arr = msg.reactions[emoji] || [];
    const i = arr.indexOf(userId);
    if (i > -1) arr.splice(i, 1);
    else arr.push(userId);
    if (arr.length) msg.reactions[emoji] = arr;
    else delete msg.reactions[emoji];
    writeLocal(list);
    return { ...msg.reactions };
  }
  return null;
}
