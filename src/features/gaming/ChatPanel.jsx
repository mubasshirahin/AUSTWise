import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MessagesSquare, Send, Trash2, Flag, Eye } from 'lucide-react';
import { useGamingRoom, clockTime } from './gamingApi';
import { Avatar, Badge, GzEmpty, useFlash, TIER_LABEL } from './gamingUi';
import ReportModal from './panels/ReportModal';

/**
 * Live room chat card. `canChat` / `blockedReason` come from the room's
 * capabilities; `canDelete(message)` decides the trash icon per message.
 */
export default function ChatPanel({
  roomId, title = 'Chat', canRead = true, canChat, blockedReason, canDelete, meId,
  onRoom, onMembers, onClosed, emptyHint = 'No messages yet. Say hi.', footer,
}) {
  const chat = useGamingRoom(roomId, { enabled: canRead, onRoom, onMembers, onClosed });
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState(null);
  const [flash, showFlash] = useFlash();
  const scroller = useRef(null);
  const stick = useRef(true);

  const onScroll = () => {
    const el = scroller.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [chat.messages.length]);
  useEffect(() => { stick.current = true; }, [roomId]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const result = await chat.send(text);
      setDraft('');
      stick.current = true;
      if (result.linksRemoved) showFlash('Links outside the allowed list were removed.', 'info');
    } catch (err) {
      showFlash(err.message);
    } finally {
      setSending(false);
    }
  };

  const typingNames = Object.keys(chat.typing)
    .filter((id) => id !== meId)
    .map((id) => chat.authors[id]?.name || chat.viewers.find((viewer) => viewer.id === id)?.name)
    .filter(Boolean);

  return (
    <section className="gmz-card gmz-chat">
      <div className="gmz-card-head-row is-ruled">
        <h3 className="gmz-card-title"><MessagesSquare size={14} /> {title}</h3>
        <span className="gmz-chat-meta">
          <span title={chat.viewers.map((viewer) => viewer.name).join(', ')}><Eye size={11} /> {chat.viewers.length}</span>
          {chat.live ? <Badge tone="emerald">Live</Badge> : <Badge>Offline</Badge>}
        </span>
      </div>

      {!canRead ? (
        <GzEmpty icon={MessagesSquare} hint={blockedReason || 'Join the room to read its chat.'} />
      ) : (
        <>
          <div className="gmz-chat-scroll" ref={scroller} onScroll={onScroll} aria-live="polite">
            {chat.hasMore && (
              <button type="button" className="gmz-chat-older" onClick={() => chat.loadOlder().catch((err) => showFlash(err.message))}>
                Load older messages
              </button>
            )}
            {chat.loading ? (
              <p className="gmz-loading">Loading chat…</p>
            ) : chat.error ? (
              <GzEmpty icon={MessagesSquare} hint={chat.error.message} />
            ) : chat.messages.length === 0 ? (
              <GzEmpty icon={MessagesSquare} hint={emptyHint} />
            ) : (
              chat.messages.map((message, index) => {
                if (message.kind === 'system') {
                  return <p key={message.id} className="gmz-msg-system">{message.text}<span>{clockTime(message.createdAt)}</span></p>;
                }
                const author = chat.authors[message.fromId];
                const prev = chat.messages[index - 1];
                const grouped = prev && prev.fromId === message.fromId && prev.kind !== 'system'
                  && new Date(message.createdAt) - new Date(prev.createdAt) < 3 * 60 * 1000;
                const mine = message.fromId === meId;
                return (
                  <div key={message.id} className={`gmz-msg${grouped ? ' is-grouped' : ''}${mine ? ' is-mine' : ''}`}>
                    {!grouped ? <Avatar user={author} size="sm" /> : <span className="gmz-msg-gutter" aria-hidden="true" />}
                    <div className="gmz-msg-body">
                      {!grouped && (
                        <span className="gmz-msg-head">
                          <span className="gmz-msg-name">{author?.name || 'Player'}</span>
                          {TIER_LABEL[author?.tier] && <span className="gmz-user-tier">{TIER_LABEL[author.tier]}</span>}
                          <span className="gmz-msg-time">{clockTime(message.createdAt)}</span>
                        </span>
                      )}
                      <p className={`gmz-msg-text${message.deleted ? ' is-deleted' : ''}`}>
                        {message.deleted ? 'Message removed' : message.text}
                      </p>
                    </div>
                    {!message.deleted && (
                      <span className="gmz-msg-actions">
                        {canDelete?.(message) && (
                          <button type="button" className="gmz-icon-btn is-danger" aria-label="Delete message" onClick={() => chat.remove(message.id).catch((err) => showFlash(err.message))}>
                            <Trash2 size={11} />
                          </button>
                        )}
                        {!mine && author && (
                          <button type="button" className="gmz-icon-btn" aria-label={`Report ${author.name}`} onClick={() => setReport({ target: author, message })}>
                            <Flag size={11} />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <p className="gmz-typing" aria-live="polite">
            {typingNames.length ? `${typingNames.slice(0, 2).join(', ')}${typingNames.length > 2 ? ' and others' : ''} typing…` : ' '}
          </p>
          {flash}
          {canChat ? (
            <form className="gmz-composer-row" onSubmit={(event) => { event.preventDefault(); send(); }}>
              <textarea
                className="input gmz-chat-input"
                rows={1}
                maxLength={500}
                placeholder="Message… (Enter to send, Shift+Enter for a new line)"
                value={draft}
                onChange={(event) => { setDraft(event.target.value); chat.notifyTyping(); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); }
                }}
              />
              <button type="submit" className="btn btn-primary gmz-send-btn" disabled={sending || !draft.trim()} aria-label="Send">
                <Send size={14} />
              </button>
            </form>
          ) : (
            <p className="gmz-chat-blocked">{blockedReason}</p>
          )}
          {footer}
        </>
      )}
      {report && <ReportModal target={report.target} roomId={roomId} message={report.message} onClose={() => setReport(null)} />}
    </section>
  );
}
