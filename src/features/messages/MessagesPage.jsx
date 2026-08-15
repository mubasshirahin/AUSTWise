import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  MessageSquare, Send, ArrowLeft, Inbox, Mail, Search, X,
  Check, CheckCheck, WifiOff, SmilePlus, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, MoreVertical, Edit3, Trash2, Bell, BellOff, Reply,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getConversations,
  getThread,
  sendMessage as storeMessage,
  markConversationRead as markRead,
  getUnreadCount,
  formatMessageTime,
  formatConversationTime,
  getConversationId,
  toggleReaction,
  getDefaultReactions,
  searchMessages,
  deleteMessage,
  editMessage,
} from '../../utils/messageStorage';
import useWebSocket from '../../hooks/useWebSocket';
import useMessageNotifications from '../../hooks/useMessageNotifications';
import { getAccountById, getRoleLabel } from '../../utils/authStorage';
import { sanitizeUserInput, MAX_TEXT_LENGTH } from '../../utils/sanitize';
import '../campus/SemesterViewWidget.css';
import './MessagesPage.css';

/* ─── Emoji Reactions ─── */
const REACTION_EMOJIS = getDefaultReactions();

function ReactionsBar({ messageId, reactions, userId, onReact, disabled }) {
  const entries = Object.entries(reactions || {}).filter(([, users]) => users.length > 0);
  if (entries.length === 0) return null;

  return (
    <div className="reactions-bar">
      {entries.map(([emoji, users]) => {
        const count = users.length;
        const isActive = users.includes(userId);
        return (
          <button
            key={emoji}
            type="button"
            className={`reaction-pill ${isActive ? 'reaction-pill-active' : ''}`}
            onClick={() => onReact(messageId, emoji)}
            disabled={disabled}
          >
            <span className="reaction-emoji">{emoji}</span>
            {count > 1 && <span className="reaction-count">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function ReactionPicker({ messageId, onReact, disabled, onClose }) {
  const pickerRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose?.();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div className="reaction-picker" ref={pickerRef}>
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="reaction-picker-btn"
          onClick={() => {
            onReact(messageId, emoji);
            onClose?.();
          }}
          disabled={disabled}
          title={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/* ─── Message Status Icon ─── */
function MessageStatus({ status }) {
  if (status === 'sent') {
    return (
      <span className="message-status sent" title="Sent">
        <Check size={11} />
      </span>
    );
  }
  if (status === 'delivered') {
    return (
      <span className="message-status delivered" title="Delivered">
        <CheckCheck size={11} />
      </span>
    );
  }
  if (status === 'read') {
    return (
      <span className="message-status read" title="Read">
        <CheckCheck size={11} />
      </span>
    );
  }
  return null;
}

/* ─── Typing Indicator ─── */
function TypingIndicator({ peerName }) {
  return (
    <div className="typing-indicator">
      <div className="typing-dots">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span className="typing-text">{peerName || 'Someone'} is typing...</span>
    </div>
  );
}

/* ─── Highlighted Search Text (React-only, no innerHTML) ─── */
function HighlightedText({ text, query }) {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="chat-highlight">{part}</mark>
      : part
  );
}

function ChatThread({ userId, peerId, peer, onSent, wsSendMessage, wsSendTyping, wsSendRead, wsSendReaction, wsSendDelete, wsSendEdit, peerTyping, setPeerTyping, wsReady, connected, onMessageStatusUpdate, queueMessage, onReactionChange, onDeleteEvent, onEditEvent }) {
  const [thread, setThread] = useState(() => getThread(userId, peerId));
  const [draft, setDraft] = useState('');
  const [deliveredIds, setDeliveredIds] = useState(new Set());
  const [openPickerId, setOpenPickerId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [searchResultIds, setSearchResultIds] = useState([]);
  const [activeResultIdx, setActiveResultIdx] = useState(-1);
  const scrollRef = useRef(null);
  const typingTimerRef = useRef(null);
  const chatSearchInputRef = useRef(null);
  const resultRefs = useRef({});
  const conversationId = getConversationId(userId, peerId);

  // Mark conversation as read and notify peer
  useEffect(() => {
    if (!userId || !peerId) return;
    markRead(userId, peerId);
    if (wsReady) {
      wsSendRead(peerId, conversationId);
    }
    setThread(getThread(userId, peerId));
  }, [userId, peerId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thread, peerTyping]);

  // Poll thread as fallback
  useEffect(() => {
    const interval = setInterval(() => {
      const updated = getThread(userId, peerId);
      setThread((prev) => {
        if (updated.length !== prev.length) return updated;
        return prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [userId, peerId]);

  // Subscribe to delivery confirmations
  useEffect(() => {
    if (!onMessageStatusUpdate) return;
    const unsub = onMessageStatusUpdate((messageId, status) => {
      setDeliveredIds((prev) => {
        const next = new Set(prev);
        if (status === 'delivered' || status === 'read') next.add(messageId);
        return next;
      });
    });
    return unsub;
  }, [onMessageStatusUpdate]);

  // Listen for incoming reactions from peer
  useEffect(() => {
    if (!onReactionChange) return;
    const unsub = onReactionChange((payload) => {
      const { messageId, emoji, userId: reactorId } = payload;
      toggleReaction(messageId, reactorId, emoji);
      setThread(getThread(userId, peerId));
    });
    return unsub;
  }, [onReactionChange, userId, peerId]);

  // Listen for incoming delete events from peer
  useEffect(() => {
    if (!onDeleteEvent) return;
    const unsub = onDeleteEvent((payload) => {
      const { messageId } = payload;
      if (messageId) {
        deleteMessage(messageId);
        setThread(getThread(userId, peerId));
      }
    });
    return unsub;
  }, [onDeleteEvent, userId, peerId]);

  // Listen for incoming edit events from peer
  useEffect(() => {
    if (!onEditEvent) return;
    const unsub = onEditEvent((payload) => {
      const { messageId, text } = payload;
      if (messageId && text) {
        editMessage(messageId, text);
        setThread(getThread(userId, peerId));
      }
    });
    return unsub;
  }, [onEditEvent, userId, peerId]);

  // Remove typing indicator after 3 seconds
  useEffect(() => {
    if (peerTyping) {
      const timer = setTimeout(() => setPeerTyping(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [peerTyping, setPeerTyping]);

  // Focus search input when opening
  useEffect(() => {
    if (chatSearchOpen && chatSearchInputRef.current) {
      chatSearchInputRef.current.focus();
    }
  }, [chatSearchOpen]);

  // Run search when query changes
  useEffect(() => {
    if (chatSearchQuery.trim() && userId && peerId) {
      const results = searchMessages(userId, peerId, chatSearchQuery);
      setSearchResultIds(results);
      setActiveResultIdx(results.length > 0 ? 0 : -1);
    } else {
      setSearchResultIds([]);
      setActiveResultIdx(-1);
    }
  }, [chatSearchQuery, userId, peerId]);

  // Scroll to active search result
  useEffect(() => {
    if (activeResultIdx >= 0 && searchResultIds.length > 0) {
      const targetId = searchResultIds[activeResultIdx];
      const el = resultRefs.current[targetId];
      if (el && scrollRef.current) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [activeResultIdx, searchResultIds]);

  // Cleanup typing timer ref on unmount
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  const handleSend = (e) => {
    e.preventDefault();
    const text = sanitizeUserInput(draft.trim(), MAX_TEXT_LENGTH);
    if (!text) return;

    const replyData = replyTarget ? {
      messageId: replyTarget.messageId,
      text: replyTarget.text.slice(0, 120),
      fromId: replyTarget.fromId,
    } : null;

    const saved = storeMessage(userId, peerId, text, replyData);
    if (!saved) return;

    if (wsReady) {
      wsSendMessage(userId, peerId, saved.text, saved.id, saved.timestamp, replyData);
    } else {
      queueMessage?.(peerId, saved.text, saved.id, saved.timestamp);
    }

    setDraft('');
    setReplyTarget(null);
    setThread(getThread(userId, peerId));
    markRead(userId, peerId);
    onSent();
  };

  const handleInputChange = (e) => {
    const val = e.target.value.slice(0, MAX_TEXT_LENGTH);
    setDraft(val);
    if (wsReady && userId && peerId) {
      wsSendTyping(peerId, true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        wsSendTyping(peerId, false);
      }, 1500);
    }
  };

  /** Delete a message */
  const handleDelete = (messageId) => {
    if (!userId) return;
    deleteMessage(messageId);
    setThread(getThread(userId, peerId));
    setConfirmDeleteId(null);
    if (wsReady) {
      wsSendDelete(messageId, userId, conversationId);
    }
    onSent();
  };

  /** Start replying to a message */
  const startReply = (msg) => {
    setReplyTarget({
      messageId: msg.id,
      text: msg.text,
      fromId: msg.fromId,
      fromName: msg.fromId === userId ? 'You' : (peer?.name || 'User'),
    });
    setOpenPickerId(null);
  };

  /** Cancel reply */
  const cancelReply = () => {
    setReplyTarget(null);
  };

  /** Start editing a message */
  const startEdit = (msg) => {
    setEditingId(msg.id);
    setEditDraft(msg.text);
    setOpenPickerId(null);
  };

  /** Save an edited message */
  const saveEdit = (messageId) => {
    const text = sanitizeUserInput(editDraft.trim(), MAX_TEXT_LENGTH);
    if (!text) return;
    const result = editMessage(messageId, text);
    if (!result) return;
    setThread(getThread(userId, peerId));
    setEditingId(null);
    setEditDraft('');
    if (wsReady) {
      wsSendEdit(messageId, result.text, userId, conversationId);
    }
  };

  /** Cancel editing */
  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft('');
  };

  /** Toggle reaction on a message */
  const handleReact = (messageId, emoji) => {
    if (!userId) return;
    // Toggle in local storage
    toggleReaction(messageId, userId, emoji);
    // Refresh thread
    setThread(getThread(userId, peerId));
    // Send via WebSocket
    if (wsReady) {
      wsSendReaction(messageId, emoji, userId, conversationId);
    }
  };

  const getMessageStatus = (msgId, index, total) => {
    if (deliveredIds.has(msgId)) return 'delivered';
    if (!connected || !wsReady) return 'sent';
    if (index < total - 1) return 'delivered';
    return 'sent';
  };

  const closePicker = useCallback(() => setOpenPickerId(null), []);

  /** Navigate search results */
  const goToResult = (direction) => {
    if (searchResultIds.length === 0) return;
    const next = (activeResultIdx + direction + searchResultIds.length) % searchResultIds.length;
    setActiveResultIdx(next);
  };

  /** Check if a message is the active search result */
  const isActiveResult = (msgId) => {
    return searchResultIds.length > 0 && searchResultIds[activeResultIdx] === msgId;
  };

  return (
    <>
      <header className="chat-header">
        <button
          type="button"
          className="chat-back hide-desktop"
          onClick={() => onSent('back')}
          aria-label="Back to inbox"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="avatar-wrapper">
          <div className="avatar" style={{ width: '40px', height: '40px' }}>
            {peer?.initials}
          </div>
          <span className={`avatar-status-dot ${connected ? 'online' : 'offline'}`} />
        </div>
        <div className="chat-peer-info" style={{ flex: 1 }}>
          <span className="chat-peer-name">{peer?.name}</span>
          <span className="chat-peer-sub">
            {['admin', 'moderator', 'faculty', 'alumni', 'cr', 'sr'].includes(peer?.role)
              ? getRoleLabel(peer.role)
              : (peer?.role || 'Member')}
            {peer?.department ? ` · ${peer.department}` : ''}
            <span style={{ marginLeft: '6px' }}>
              · {connected ? 'Online' : 'Offline'}
            </span>
          </span>
        </div>
        <button
          type="button"
          className={`chat-search-toggle ${chatSearchOpen ? 'active' : ''}`}
          onClick={() => {
            if (chatSearchOpen) setChatSearchQuery('');
            setChatSearchOpen((o) => !o);
          }}
          title={chatSearchOpen ? 'Close search' : 'Search in conversation'}
        >
          <Search size={16} />
        </button>
      </header>

      {/* In-conversation search bar */}
      {chatSearchOpen && (
        <div className="chat-search-bar">
          <div className="chat-search-input-wrap">
            <Search size={13} className="chat-search-input-icon" />
            <input
              ref={chatSearchInputRef}
              type="text"
              placeholder="Search in this conversation..."
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (e.shiftKey) goToResult(-1);
                  else goToResult(1);
                }
                if (e.key === 'Escape') {
                  setChatSearchOpen(false);
                  setChatSearchQuery('');
                }
              }}
            />
            {chatSearchQuery && (
              <button
                type="button"
                className="chat-search-input-clear"
                onClick={() => setChatSearchQuery('')}
              >
                <X size={12} />
              </button>
            )}
          </div>
          {searchResultIds.length > 0 && (
            <div className="chat-search-nav">
              <span className="chat-search-count">
                {activeResultIdx + 1} of {searchResultIds.length}
              </span>
              <button
                type="button"
                className="chat-search-nav-btn"
                onClick={() => goToResult(-1)}
                title="Previous result"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                className="chat-search-nav-btn"
                onClick={() => goToResult(1)}
                title="Next result"
              >
                <ChevronDown size={14} />
              </button>
            </div>
          )}
          {chatSearchQuery && searchResultIds.length === 0 && (
            <span className="chat-search-no-results">No results</span>
          )}
        </div>
      )}

      <div className="chat-messages" ref={scrollRef}>
        {thread.map((m, idx) => {
          const mine = m.fromId === userId;
          const status = mine ? getMessageStatus(m.id, idx, thread.length) : null;
          const hasReactions = m.reactions && Object.keys(m.reactions).some(k => m.reactions[k].length > 0);
          const isDeleted = m.deleted;
          const isEdited = m.edited && !isDeleted;
          const isEditing = editingId === m.id;

          return (
            <div key={m.id} className={`chat-bubble-row ${mine ? 'mine' : 'theirs'}`}>
              <div
                className={`chat-bubble-wrapper ${isActiveResult(m.id) ? 'chat-bubble-wrapper-active' : ''}`}
                ref={(el) => { resultRefs.current[m.id] = el; }}
                onMouseEnter={() => !mine && setOpenPickerId(m.id)}
                onMouseLeave={() => !mine && openPickerId === m.id && setOpenPickerId(null)}
              >
                {/* Deleted message placeholder */}
                {isDeleted ? (
                  <div className="chat-bubble chat-bubble-deleted">
                    <p className="deleted-text">
                      {mine ? 'You deleted this message' : 'This message was deleted'}
                    </p>
                    <div className="chat-bubble-footer">
                      <span className="chat-time">{formatMessageTime(m.timestamp)}</span>
                    </div>
                  </div>
                ) : isEditing ? (
                  /* Edit mode */
                  <div className="chat-bubble chat-bubble-editing">
                    <textarea
                      className="edit-textarea"
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          saveEdit(m.id);
                        }
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      autoFocus
                      rows={2}
                    />
                    <div className="edit-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => saveEdit(m.id)}
                        disabled={!editDraft.trim()}
                      >
                        <Check size={12} /> Save
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={cancelEdit}
                      >
                        <X size={12} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Normal message bubble */
                  <div className={`chat-bubble ${isActiveResult(m.id) ? 'chat-bubble-active-search' : ''}`}>
                    <p>
                      <HighlightedText text={m.text} query={chatSearchQuery} />
                    </p>
                    {/* Quoted message preview */}
                    {m.replyTo && (
                      <div className="quoted-preview">
                        <div className="quoted-preview-header">
                          <Reply size={10} />
                          <span>Reply to {m.replyTo.fromId === userId ? 'yourself' : (m.replyTo.fromName || (m.replyTo.fromId === peerId ? (peer?.name || 'User') : 'User'))}</span>
                        </div>
                        <div className="quoted-preview-text">{m.replyTo.text}</div>
                      </div>
                    )}
                    {isEdited && <span className="edited-badge">(edited)</span>}
                    <div className="chat-bubble-footer">
                      <span className="chat-time">{formatMessageTime(m.timestamp)}</span>
                      {mine && <MessageStatus status={status} />}
                    </div>

                    {/* Reactions on this message */}
                    {hasReactions && (
                      <ReactionsBar
                        messageId={m.id}
                        reactions={m.reactions}
                        userId={userId}
                        onReact={handleReact}
                        disabled={!wsReady}
                      />
                    )}
                  </div>
                )}

                {/* Received message reply trigger (appears on hover) */}
                {!mine && !isDeleted && !isEditing && (
                  <button
                    type="button"
                    className="theirs-reply-btn"
                    onClick={() => startReply(m)}
                    title="Reply"
                  >
                    <Reply size={11} />
                  </button>
                )}

                {/* Reaction picker — shown on hover for received messages */}
                {!mine && !isDeleted && openPickerId === m.id && (
                  <ReactionPicker
                    messageId={m.id}
                    onReact={handleReact}
                    disabled={!wsReady}
                    onClose={closePicker}
                  />
                )}

                {/* Actions & reaction button for own messages */}
                {mine && !isDeleted && !isEditing && (
                  <div
                    className="own-message-actions"
                    onMouseEnter={() => setOpenPickerId(m.id)}
                    onMouseLeave={() => setOpenPickerId(null)}
                  >
                    <div className="own-actions-row">
                      <button
                        type="button"
                        className="msg-action-btn"
                        onClick={() => startEdit(m)}
                        title="Edit"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        type="button"
                        className="msg-action-btn msg-action-delete"
                        onClick={() => setConfirmDeleteId(m.id)}
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                      <button
                        type="button"
                        className="msg-action-btn"
                        onClick={() => startReply(m)}
                        title="Reply"
                      >
                        <Reply size={12} />
                      </button>
                      <button
                        type="button"
                        className="own-reaction-btn msg-action-reaction"
                        onClick={() => setOpenPickerId(openPickerId === m.id ? null : m.id)}
                        disabled={!wsReady}
                        title="Add reaction"
                      >
                        <SmilePlus size={12} />
                      </button>
                    </div>
                    {openPickerId === m.id && (
                      <ReactionPicker
                        messageId={m.id}
                        onReact={handleReact}
                        disabled={!wsReady}
                        onClose={closePicker}
                      />
                    )}
                  </div>
                )}

                {/* Delete confirmation */}
                {confirmDeleteId === m.id && (
                  <div className="delete-confirm">
                    <span className="delete-confirm-text">Delete this message?</span>
                    <div className="delete-confirm-actions">
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(m.id)}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {peerTyping && (
          <div className="chat-bubble-row theirs">
            <TypingIndicator peerName={peer?.name} />
          </div>
        )}
      </div>

      {/* Reply preview bar */}
      {replyTarget && (
        <div className="reply-preview-bar">
          <div className="reply-preview-info">
            <Reply size={12} className="reply-preview-icon" />
            <div className="reply-preview-body">
              <span className="reply-preview-label">Replying to <strong>{replyTarget.fromName}</strong></span>
              <span className="reply-preview-snippet">{replyTarget.text}</span>
            </div>
          </div>
          <button
            type="button"
            className="reply-preview-cancel"
            onClick={cancelReply}
            title="Cancel reply"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <form className="chat-input" onSubmit={handleSend}>
        <input
          type="text"
          maxLength={MAX_TEXT_LENGTH}
          placeholder={replyTarget ? `Reply to ${replyTarget.fromName}...` : `Message ${peer?.name || ''}...`}
          value={draft}
          onChange={handleInputChange}
          autoFocus
        />
        <button
          type="submit"
          className="chat-send"
          disabled={!draft.trim()}
          aria-label="Send message"
          title={!wsReady ? 'Sending when connected...' : 'Send'}
        >
          <Send size={16} />
        </button>
      </form>
    </>
  );
}

export default function MessagesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUserId = user?.id;
  const [conversations, setConversations] = useState(() =>
    currentUserId ? getConversations(currentUserId) : []
  );
  const [activePeerId, setActivePeerId] = useState(searchParams.get('peer') || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the ⋮ dropdown when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);
  const [peerTyping, setPeerTyping] = useState(false);
  const messageStatusListenersRef = useRef(new Set());
  const reactionListenersRef = useRef(new Set());
  const deleteListenersRef = useRef(new Set());
  const editListenersRef = useRef(new Set());
  const pendingQueueRef = useRef([]);
  const activePeerIdRef = useRef(activePeerId);
  activePeerIdRef.current = activePeerId;

  // Subscribe to message status updates
  const onMessageStatusUpdate = useCallback((listener) => {
    messageStatusListenersRef.current.add(listener);
    return () => messageStatusListenersRef.current.delete(listener);
  }, []);

  // Subscribe to reaction updates from peer
  const onReactionChange = useCallback((listener) => {
    reactionListenersRef.current.add(listener);
    return () => reactionListenersRef.current.delete(listener);
  }, []);

  // Subscribe to delete events from peer
  const onDeleteEvent = useCallback((listener) => {
    deleteListenersRef.current.add(listener);
    return () => deleteListenersRef.current.delete(listener);
  }, []);

  // Subscribe to edit events from peer
  const onEditEvent = useCallback((listener) => {
    editListenersRef.current.add(listener);
    return () => editListenersRef.current.delete(listener);
  }, []);

  const drainQueue = useCallback((userId) => {
    const queue = pendingQueueRef.current;
    pendingQueueRef.current = [];
    queue.forEach((item) => {
      wsSendMessage(userId, item.toId, item.text, item.id, item.timestamp);
    });
  }, []);

  const queueMessage = useCallback((toId, text, id, timestamp) => {
    pendingQueueRef.current.push({ toId, text, id, timestamp });
  }, []);

  // Message notifications hook (background push notifications)
  const {
    permission: notifPermission,
    enabled: notifEnabled,
    notifyNewMessage,
    toggleEnabled: toggleNotifEnabled,
    requestPermission: requestNotifPermission,
    supported: notifSupported,
  } = useMessageNotifications(currentUserId);

  // WebSocket hook
  const {
    connected: wsConnected,
    onlineUsers,
    sendMessage: wsSendMessage,
    sendTyping: wsSendTyping,
    sendRead: wsSendRead,
    sendReaction: wsSendReaction,
    sendDelete: wsSendDelete,
    sendEdit: wsSendEdit,
    subscribe: wsSubscribe,
    unsubscribe: wsUnsubscribe,
  } = useWebSocket(currentUserId, {
    onMessage: useCallback((payload) => {
      const { fromId, toId, text, timestamp, replyTo } = payload;
      if (!fromId || !toId || !text) return;
      storeMessage(fromId, toId, text, replyTo ? { messageId: replyTo.messageId, text: replyTo.text, fromId: replyTo.fromId } : null);
      if (currentUserId) {
        setConversations(getConversations(currentUserId));
        // Show notification if message is FROM someone else (not our own send)
        if (fromId !== currentUserId) {
          const account = getAccountById(fromId);
          notifyNewMessage({
            fromId,
            fromName: account?.name || 'AUST User',
            text,
            timestamp: timestamp || new Date().toISOString(),
          });
        }
      }
    }, [currentUserId, notifyNewMessage]),

    onTyping: useCallback((payload) => {
      const { fromId, isTyping } = payload;
      setPeerTyping((prev) => {
        if (fromId === activePeerIdRef.current) return isTyping;
        return prev;
      });
    }, []),

    onRead: useCallback(() => {}, []),

    onMessageStatus: useCallback((payload) => {
      const { messageId, status } = payload;
      if (messageId && status) {
        messageStatusListenersRef.current.forEach((listener) => {
          listener(messageId, status);
        });
      }
    }, []),

    onReaction: useCallback((payload) => {
      reactionListenersRef.current.forEach((listener) => {
        listener(payload);
      });
    }, []),

    onDelete: useCallback((payload) => {
      // Peer deleted a message — forward to active ChatThread
      deleteListenersRef.current.forEach((listener) => {
        listener(payload);
      });
    }, []),

    onEdit: useCallback((payload) => {
      // Peer edited a message — forward to active ChatThread
      editListenersRef.current.forEach((listener) => {
        listener(payload);
      });
    }, []),

    onOnlineUsers: useCallback(() => {}, []),

    onConnectionChange: useCallback((isConnected) => {
      if (isConnected && currentUserId) {
        setConversations(getConversations(currentUserId));
        drainQueue(currentUserId);
      }
    }, [currentUserId, drainQueue]),
  });

  // Subscribe/unsubscribe to active conversation
  useEffect(() => {
    if (wsConnected && currentUserId && activePeerId) {
      const convId = getConversationId(currentUserId, activePeerId);
      wsSubscribe(convId);
      return () => wsUnsubscribe(convId);
    }
  }, [wsConnected, currentUserId, activePeerId, wsSubscribe, wsUnsubscribe]);

  const refreshConversations = useCallback(() => {
    if (!currentUserId) return;
    setConversations(getConversations(currentUserId));
  }, [currentUserId]);

  useEffect(() => {
    const interval = setInterval(refreshConversations, 5000);
    return () => clearInterval(interval);
  }, [refreshConversations]);

  const openConversation = (peerId) => {
    setActivePeerId(peerId);
    setSearchParams(peerId ? { peer: peerId } : {});
    setPeerTyping(false);
  };

  const handleThreadEvent = (action) => {
    if (action === 'back') {
      setActivePeerId('');
      setSearchParams({});
      return;
    }
    refreshConversations();
  };

  const unreadTotal = useMemo(() => {
    return currentUserId ? getUnreadCount(currentUserId) : 0;
  }, [currentUserId, conversations]);

  const filteredConversations = useMemo(() => {
    let list = conversations.filter((c) =>
      c.peer.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
    );
    if (filterMode === 'unread') {
      list = list.filter((c) => c.unread > 0);
    }
    return list;
  }, [conversations, searchTerm, filterMode]);

  const activePeer = conversations.find((c) => c.peerId === activePeerId)?.peer;

  const onlineChatCount = useMemo(
    () => conversations.filter((c) => onlineUsers.includes(c.peerId)).length,
    [conversations, onlineUsers]
  );

  const handleNotifToggle = async () => {
    if (notifPermission !== 'granted') {
      const result = await requestNotifPermission();
      if (result !== 'granted') return;
    }
    toggleNotifEnabled();
  };

  // Prev/next navigation through the filtered conversation list
  const navigateConversation = (dir) => {
    const list = filteredConversations;
    if (list.length === 0) return;
    const idx = list.findIndex((c) => c.peerId === activePeerId);
    const next = idx === -1 ? (dir > 0 ? 0 : list.length - 1) : (idx + dir + list.length) % list.length;
    openConversation(list[next].peerId);
  };

  // Pill label — position of the active conversation within the filtered list
  const pillLabel = useMemo(() => {
    const idx = filteredConversations.findIndex((c) => c.peerId === activePeerId);
    if (idx === -1) return filteredConversations.length === 0 ? '0 / 0' : `0 / ${filteredConversations.length}`;
    return `${idx + 1} / ${filteredConversations.length}`;
  }, [filteredConversations, activePeerId]);

  // Single shared conversation-cell renderer — used by every list mode
  // (All / Unread / search results) so cells look identical everywhere.
  const renderConversationCell = (c) => {
    const isActive = c.peerId === activePeerId;
    const isOnline = onlineUsers.includes(c.peerId);
    const unread = c.unread || 0;
    const densityClass = unread >= 3 ? 'is-rose' : unread === 2 ? 'is-amber' : unread === 1 ? 'is-cyan' : 'is-emerald';
    return (
      <button
        key={c.conversationId}
        type="button"
        className={`sv-cell conversation-cell ${densityClass}${isActive ? ' active' : ''}${unread > 0 ? ' has-unread' : ''}`}
        onClick={() => openConversation(c.peerId)}
      >
        {unread > 0 && <span className={`sv-count${unread >= 3 ? ' hot' : ''}`}>{unread}</span>}
        <div className="conv-cell-main">
          <div className="avatar-wrapper">
            <div className="avatar">{c.peer.initials}</div>
            <span className={`avatar-status-dot ${isOnline ? 'online' : 'offline'}`} />
          </div>
          <div className="conv-cell-body">
            <div className="conv-cell-top">
              <span className="sv-cell-title conv-name">{c.peer.name}</span>
              <span className="conv-time">{formatConversationTime(c.lastTimestamp)}</span>
            </div>
            <div className="conv-preview">
              {c.lastMessage.fromId === currentUserId && (
                <CheckCheck size={11} className="preview-status" />
              )}
              {c.lastMessage.text}
            </div>
          </div>
        </div>
      </button>
    );
  };

  if (!currentUserId) {
    return (
      <div className="messages-page animate-fadeIn">
        <header className="ms-hero">
          <div className="ms-hero-content">
            <div className="ms-hero-eyebrow">
              <span className="ms-hero-period-icon"><Mail size={16} /></span>
              <span className="ms-hero-date-label">ConnectBox</span>
            </div>
            <h1 className="ms-hero-title">
              Connect<span className="ms-hero-name">Box</span>
            </h1>
            <p className="ms-hero-subtitle">Chat with alumni, classmates &amp; mentors.</p>
          </div>
        </header>
        <div className="ms-content-card">
          <div className="sv-empty">
            <MessageSquare size={38} className="sv-empty-icon" />
            <h3>Login to view messages</h3>
            <p>You need an account to use the inbox.</p>
            <button className="btn btn-primary" onClick={() => navigate('/login')}>
              Login / Sign up
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="messages-page animate-fadeIn">

      {/* ── 1. Hero box (own card) ── */}
      <header className="ms-hero">
        <div className="ms-hero-content">
          <div className="ms-hero-eyebrow">
            <span className="ms-hero-period-icon"><Mail size={16} /></span>
            <span className="ms-hero-date-label">Community · ConnectBox</span>
          </div>
          <h1 className="ms-hero-title">
            Connect<span className="ms-hero-name">Box</span>
          </h1>
          <p className="ms-hero-subtitle">
            {unreadTotal > 0
              ? `${unreadTotal} unread · ${conversations.length} chats · ${onlineChatCount} online`
              : `${conversations.length} chats · ${onlineChatCount} online`}
          </p>
        </div>
      </header>

      {/* ── 2. Main box — masthead header + chat layout (one card) ── */}
      <div className="ms-content-card">
        {/* Masthead header */}
        <div className="schedule-masthead ms-masthead">
          {/* Left: title block */}
          <div className="schedule-title-block">
            <div className="schedule-icon-tile">
              <MessageSquare size={20} strokeWidth={2.2} />
            </div>
            <div>
              <span className="schedule-overline">ConnectBox</span>
              <div className="schedule-title">Messages</div>
              <span className="schedule-subtitle">Inbox &amp; filters</span>
            </div>
          </div>

          {/* Center: stats */}
          <div className="schedule-masthead-center">
            <div className="schedule-stats">
              <div className="schedule-stat">
                <span className="schedule-stat-value">{conversations.length}</span>
                <span className="schedule-stat-label">chats</span>
              </div>
              <div className="schedule-stat">
                <span className="schedule-stat-value" style={{ color: unreadTotal > 0 ? 'var(--accent-rose)' : undefined }}>
                  {unreadTotal}
                </span>
                <span className="schedule-stat-label">unread</span>
              </div>
              <div className="schedule-stat">
                <span className="schedule-stat-value">{onlineChatCount}</span>
                <span className="schedule-stat-label">online</span>
              </div>
            </div>
          </div>

          {/* Right: nav + ⋮ menu */}
          <div className="schedule-actions">
            <div className="schedule-week-nav">
              <button className="schedule-nav-btn" onClick={() => navigateConversation(-1)} title="Previous conversation" aria-label="Previous conversation">
                <ChevronLeft size={20} />
              </button>
              <div className="schedule-week-pill">
                <span className="schedule-week-pill-value">{pillLabel}</span>
              </div>
              <button className="schedule-nav-btn" onClick={() => navigateConversation(1)} title="Next conversation" aria-label="Next conversation">
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="export-dropdown" ref={menuRef}>
              <button
                className="schedule-nav-btn"
                onClick={() => setMenuOpen((o) => !o)}
                title="Options"
                aria-haspopup="true"
                aria-expanded={menuOpen}
              >
                <MoreVertical size={18} />
              </button>
              {menuOpen && (
                <div className="export-menu" role="menu">
                  <button
                    className={`export-menu-item${filterMode === 'all' ? ' menu-active' : ''}`}
                    onClick={() => { setFilterMode('all'); setMenuOpen(false); }}
                    role="menuitem"
                  >
                    <Inbox size={14} /> All conversations
                    {filterMode === 'all' && <Check size={14} className="menu-check" />}
                  </button>
                  <button
                    className={`export-menu-item${filterMode === 'unread' ? ' menu-active' : ''}`}
                    onClick={() => { setFilterMode('unread'); setMenuOpen(false); }}
                    role="menuitem"
                  >
                    <Mail size={14} /> Unread only
                    {filterMode === 'unread' && <Check size={14} className="menu-check" />}
                  </button>
                  <div className="export-menu-sep" />
                  {notifSupported && (
                    <button
                      className={`export-menu-item${notifEnabled ? ' menu-active' : ''}`}
                      onClick={handleNotifToggle}
                      role="menuitem"
                    >
                      {notifEnabled ? <Bell size={14} /> : <BellOff size={14} />} Browser notifications
                      {notifEnabled && <Check size={14} className="menu-check" />}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="schedule-dotted-divider" />

        {!wsConnected && currentUserId && (
          <div className="connection-status-banner">
            <WifiOff size={14} />
            <span>Reconnecting to real-time messaging...</span>
          </div>
        )}

        <div className="messages-layout">
          <aside className={`messages-list ${activePeerId ? 'hidden-mobile' : ''}`}>
            <div className="messages-search-wrapper">
              <div className="search-box">
                <Search size={14} className="messages-search-icon" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button
                  type="button"
                  className={`messages-search-clear ${searchTerm ? 'visible' : ''}`}
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            <div className="conversation-items">
              {filteredConversations.length === 0 ? (
                <div className="sv-empty small">
                  <Inbox size={28} className="sv-empty-icon" />
                  <h3>{filterMode === 'unread' ? 'No unread messages' : 'No conversations yet'}</h3>
                  <p>
                    {filterMode === 'unread'
                      ? 'All messages are read. Great job!'
                      : 'Message an alumnus or classmate to start a conversation.'}
                  </p>
                </div>
              ) : (
                filteredConversations.map(renderConversationCell)
              )}
            </div>
          </aside>

          <section className={`messages-chat ${!activePeerId ? 'hidden-mobile' : ''}`}>
            {!activePeerId ? (
              <div className="sv-empty">
                <MessageSquare size={32} className="sv-empty-icon" />
                <h3>Select a conversation</h3>
                <p>Pick a chat from the left to start messaging.</p>
              </div>
            ) : (
              <ChatThread
                key={activePeerId}
                userId={currentUserId}
                peerId={activePeerId}
                peer={activePeer}
                onSent={handleThreadEvent}
                wsSendMessage={wsSendMessage}
                wsSendTyping={wsSendTyping}
                wsSendRead={wsSendRead}
                peerTyping={peerTyping}
                setPeerTyping={setPeerTyping}
                wsReady={wsConnected}
                connected={onlineUsers.includes(activePeerId)}
                onMessageStatusUpdate={onMessageStatusUpdate}
                onReactionChange={onReactionChange}
                onDeleteEvent={onDeleteEvent}
                onEditEvent={onEditEvent}
                wsSendDelete={wsSendDelete}
                wsSendEdit={wsSendEdit}
                queueMessage={queueMessage}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
