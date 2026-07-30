// TODO: Swap localStorage for API calls — see MIGRATION.md Phase 3
//   GET  /api/messages        → getConversations()
//   GET  /api/messages?peer=X → getThread()
//   POST /api/messages        → sendMessage()
// Keep function signatures identical so UI components don't change.
import { getAccountById, getInitials } from './authStorage';
import { sanitizeUserInput, MAX_TEXT_LENGTH } from './sanitize';

const messagesKey = 'aust-messages-v1';

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
  try {
    localStorage.setItem(messagesKey, JSON.stringify(list));
  } catch {
    // storage full or unavailable
  }
}

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

  // If replying to a message, attach the reply metadata
  if (replyTo && replyTo.messageId) {
    message.replyTo = {
      messageId: replyTo.messageId,
      text: String(replyTo.text || '').slice(0, 120),
      fromId: replyTo.fromId || '',
    };
  }

  const messages = loadMessages();
  messages.push(message);
  saveMessages(messages);
  return message;
}

// All conversations involving `userId`, newest activity first.
export function getConversations(userId) {
  const messages = loadMessages();
  const map = new Map();

  for (const msg of messages) {
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

    if (msg.toId === userId && !msg.read) {
      map.get(convId).unread += 1;
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp)
  );
}

// Ordered message thread between two users.
export function getThread(userId, peerId) {
  const convId = getConversationId(userId, peerId);
  return loadMessages()
    .filter((m) => m.conversationId === convId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
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

export function getUnreadCount(userId) {
  return loadMessages().filter((m) => m.toId === userId && !m.read).length;
}

/* ─── Message Deletion & Editing ─── */

/** Soft-delete a message. Returns the updated message or null if not found. */
export function deleteMessage(messageId) {
  const messages = loadMessages();
  const msg = messages.find((m) => m.id === messageId);
  if (!msg) return null;

  msg.deleted = true;
  msg.text = '';
  msg.edited = false;
  saveMessages(messages);
  return { id: msg.id, conversationId: msg.conversationId, deleted: true };
}

/** Edit a message. Returns the updated message or null if not found/deleted. */
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
  return { id: msg.id, text: msg.text, edited: true, editedAt: msg.editedAt, conversationId: msg.conversationId };
}

/* ─── Message Reactions ─── */

const DEFAULT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/** Add or remove a reaction from a message. Returns the updated reactions map. */
export function toggleReaction(messageId, userId, emoji) {
  const messages = loadMessages();
  const msg = messages.find((m) => m.id === messageId);
  if (!msg) return null;

  // Ensure reactions object exists
  if (!msg.reactions) msg.reactions = {};
  if (!msg.reactions[emoji]) msg.reactions[emoji] = [];

  // Toggle user's reaction
  const idx = msg.reactions[emoji].indexOf(userId);
  if (idx > -1) {
    msg.reactions[emoji].splice(idx, 1);
    if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
  } else {
    msg.reactions[emoji].push(userId);
  }

  saveMessages(messages);
  return { ...msg.reactions };
}

/** Search messages within a conversation for a query. Returns array of matching message IDs. */
export function searchMessages(userId, peerId, query) {
  const cleanQuery = String(query || '').trim().toLowerCase();
  if (!cleanQuery || !userId || !peerId) return [];

  const convId = getConversationId(userId, peerId);
  return loadMessages()
    .filter((m) => m.conversationId === convId && m.text.toLowerCase().includes(cleanQuery))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map((m) => m.id);
}

/** Get the list of available default emoji reactions. */
export function getDefaultReactions() {
  return DEFAULT_REACTIONS;
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
