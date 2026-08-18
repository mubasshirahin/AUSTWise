// Messaging persistence: localStorage-first cache + async server API.
// The UI reads synchronously from localStorage for instant renders, then the
// component calls refreshThread/refreshConversations to pull the server copy
// (authoritative) and re-renders. Writes go to the server immediately and are
// cached locally on success.
import { getAccountById, getInitials } from './authStorage';
import { sanitizeUserInput, MAX_TEXT_LENGTH } from './sanitize';
import * as api from './messageApi';

const messagesKey = 'aust-messages-v1';

export function getConversationId(a, b) {
  return [a, b].sort().join('|');
}

function resolvePeer(peerId) {
  const account = getAccountById(peerId);
  if (account) {
    return {
      id: account.id,
      name: account.name,
      initials: getInitials(account.name),
      role: account.role,
      department: account.department || '',
    };
  }
  return { id: peerId, name: 'AUST User', initials: 'AU', role: '', department: '' };
}

// ── localStorage cache (sync) ──────────────────────────────────────────────────

function loadMessages() {
  try {
    const raw = localStorage.getItem(messagesKey);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveMessages(list) {
  try { localStorage.setItem(messagesKey, JSON.stringify(list)); } catch { /* full */ }
}

// ── Sync cache reads (instant UI) ──────────────────────────────────────────────

export function getThread(userId, peerId) {
  const convId = getConversationId(userId, peerId);
  return loadMessages()
    .filter((m) => m.conversationId === convId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

export function getConversations(userId) {
  const list = loadMessages();
  const map = new Map();
  for (const msg of list) {
    if (msg.fromId !== userId && msg.toId !== userId) continue;
    const peerId = msg.fromId === userId ? msg.toId : msg.fromId;
    const convId = getConversationId(userId, peerId);
    const existing = map.get(convId);
    if (!existing) {
      map.set(convId, {
        conversationId: convId,
        peerId,
        peer: resolvePeer(peerId),
        lastMessage: msg,
        lastTimestamp: msg.timestamp,
        unread: 0,
      });
    } else if (new Date(msg.timestamp) > new Date(existing.lastTimestamp)) {
      existing.lastMessage = msg;
      existing.lastTimestamp = msg.timestamp;
    }
    if (msg.toId === userId && !msg.read) map.get(convId).unread += 1;
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp)
  );
}

export function getUnreadCount(userId) {
  return loadMessages().filter((m) => m.toId === userId && !m.read).length;
}

export function searchMessages(userId, peerId, query) {
  const cleanQuery = String(query || '').trim().toLowerCase();
  if (!cleanQuery || !userId || !peerId) return [];
  const convId = getConversationId(userId, peerId);
  return loadMessages()
    .filter((m) => m.conversationId === convId && m.text.toLowerCase().includes(cleanQuery))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map((m) => m.id);
}

export function getDefaultReactions() {
  return DEFAULT_REACTIONS;
}

const DEFAULT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// ── Sync cache mutators (also fire async server writes) ────────────────────────

/** @returns {object} message object (sync), server write is fire-and-forget */
export function sendMessage(fromId, toId, text, replyTo) {
  const clean = sanitizeUserInput(String(text || '').trim(), MAX_TEXT_LENGTH);
  if (!clean || !fromId || !toId || fromId === toId) return null;

  const message = {
    id: `MSG-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    conversationId: getConversationId(fromId, toId),
    fromId,
    toId,
    text: clean,
    timestamp: new Date().toISOString(),
    read: false,
  };
  if (replyTo && replyTo.messageId) {
    message.replyTo = {
      messageId: replyTo.messageId,
      text: String(replyTo.text || '').slice(0, 120),
      fromId: replyTo.fromId || '',
    };
  }

  const list = loadMessages();
  list.push(message);
  saveMessages(list);

  // Persist to server (non-blocking — local cache is authoritative for instant UI)
  void api.sendMessage(fromId, toId, clean, replyTo).catch(() => {
    /* keep local copy; sync on next refresh */
  });
  return message;
}

export function deleteMessage(messageId) {
  const messages = loadMessages();
  const msg = messages.find((m) => m.id === messageId);
  if (!msg) return null;
  msg.deleted = true;
  msg.text = '';
  msg.edited = false;
  saveMessages(messages);
  void api.deleteRemoteMessage(messageId).catch(() => {});
  return { id: msg.id, conversationId: msg.conversationId, deleted: true };
}

export function editMessage(messageId, newText) {
  const clean = sanitizeUserInput(String(newText || '').trim(), MAX_TEXT_LENGTH);
  if (!clean) return null;
  const messages = loadMessages();
  const msg = messages.find((m) => m.id === messageId);
  if (!msg || msg.deleted) return null;
  msg.text = clean;
  msg.edited = true;
  msg.editedAt = new Date().toISOString();
  saveMessages(messages);
  void api.editRemoteMessage(messageId, clean).catch(() => {});
  return { id: msg.id, text: msg.text, edited: true, editedAt: msg.editedAt, conversationId: msg.conversationId };
}

export function toggleReaction(messageId, userId, emoji) {
  const messages = loadMessages();
  const msg = messages.find((m) => m.id === messageId);
  if (!msg) return null;
  if (!msg.reactions) msg.reactions = {};
  if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
  const idx = msg.reactions[emoji].indexOf(userId);
  if (idx > -1) {
    msg.reactions[emoji].splice(idx, 1);
    if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
  } else {
    msg.reactions[emoji].push(userId);
  }
  saveMessages(messages);
  void api.toggleRemoteReaction(messageId, userId, emoji).catch(() => {});
  return { ...msg.reactions };
}

export function markConversationRead(userId, peerId) {
  const convId = getConversationId(userId, peerId);
  const messages = loadMessages();
  let changed = false;
  for (const msg of messages) {
    if (msg.conversationId === convId && msg.toId === userId && !msg.read) {
      msg.read = true;
      changed = true;
    }
  }
  if (changed) saveMessages(messages);
  return changed;
}

export function formatMessageTime(iso) {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function formatConversationTime(iso) {
  try {
    const date = new Date(iso);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// ── Async server refreshes (call in useEffect to sync cache) ─────────────────

/** Pull server copy of a thread and replace the local cache for that conversation. */
export async function refreshThread(userId, peerId) {
  try {
    const remote = await api.fetchThread(userId, peerId);
    if (!remote.length) return false;
    const list = loadMessages();
    const convId = getConversationId(userId, peerId);
    const filtered = list.filter((m) => m.conversationId !== convId);
    filtered.push(...remote);
    filtered.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    saveMessages(filtered);
    return true;
  } catch {
    return false;
  }
}

/** Pull server copy of all conversations and merge unread counts. */
export async function refreshConversations(userId) {
  try {
    const remote = await api.fetchConversations(userId);
    if (!remote.length) return false;
    const list = loadMessages();
    const convIdSet = new Set();
    for (const c of remote) {
      const convId = c.conversationId || getConversationId(c.fromId, c.toId);
      if (convId) convIdSet.add(convId);
      if (c.lastMessage) {
        // replace latest message in cache if server has it
        const existing = list.find((m) => !m.deleted && m.conversationId === convId && m.id === c.lastMessage.id);
        if (!existing && !list.some((m) => m.id === c.lastMessage.id)) {
          list.unshift(c.lastMessage);
        }
      }
    }
    saveMessages(list);
    return true;
  } catch {
    return false;
  }
}
