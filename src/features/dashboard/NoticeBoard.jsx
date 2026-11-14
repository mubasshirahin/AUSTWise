import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BellRing, Pin, ChevronDown, ChevronUp, Sparkles, Plus, X, Trash2, UserRound, Pencil } from 'lucide-react';
import { notices } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';
import useWebSocket from '../../hooks/useWebSocket';
import { loadSharedSync, loadSharedAsync, saveShared } from '../../utils/storageService';
import { getLiveValue } from '../../utils/liveStore';
import { removeNotificationById, removeNotificationsByTitle } from '../../utils/inAppNotifications';

const CRSR_KEY = 'aust-cr-sr-notices';
const NOTICE_TITLE_MAX = 80;
const NOTICE_CONTENT_MAX = 5000;
const NOTICE_RATE_KEY = 'aust-notice-last-post';
const NOTICE_RATE_MS = 30000; // 1 post per 30s client-side throttle
const SWIPE_TRIGGER = 72; // px of horizontal drag that fires edit/delete
const SWIPE_MAX = 110;

export default function NoticeBoard() {
  const { user } = useAuth();
  const [expandedNotice, setExpandedNotice] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formPinned, setFormPinned] = useState(false);
  const [editingId, setEditingId] = useState(null);
  // Swipe on own notices (touch): left → edit, right → delete confirm
  const [swipe, setSwipe] = useState(null); // { id, dx }
  const swipeStart = useRef(null);
  const swipeSuppressClick = useRef(false);

  // The navbar bell (useInAppNotifications) handles the notification itself;
  // here we only refresh the list so a new CR/SR notice shows up immediately.
  useWebSocket(user?.id || null, {
    onNoticeNew: useCallback(() => {
      loadSharedAsync(CRSR_KEY, []).then(v => { if (Array.isArray(v)) setCrsrNotices(v); });
    }, []),
  });

  const [adminNotices, setAdminNotices] = useState(() => loadSharedSync('aust-notices', notices));
  const [adminLoading, setAdminLoading] = useState(true);
  useEffect(() => { loadSharedAsync('aust-notices', notices).then(v => { setAdminNotices(v); setAdminLoading(false); }); }, []);

  const [crsrNotices, setCrsrNotices] = useState(() => loadSharedSync(CRSR_KEY, []));
  const [crsrLoading, setCrsrLoading] = useState(true);
  useEffect(() => { loadSharedAsync(CRSR_KEY, []).then(v => { setCrsrNotices(Array.isArray(v) ? v : []); setCrsrLoading(false); }); }, []);

  // Cross-device sync: if another CR posts, reflect immediately via polling + liveStore
  useEffect(() => {
    const poll = () => { loadSharedAsync(CRSR_KEY, []).then(v => { if (Array.isArray(v)) setCrsrNotices(v); }); };
    const id = setInterval(poll, 30000);
    const check = () => {
      const live = getLiveValue('shared', CRSR_KEY, null);
      if (Array.isArray(live)) setCrsrNotices(live);
    };
    window.addEventListener('storage', check);
    return () => { clearInterval(id); window.removeEventListener('storage', check); };
  }, []);

  const isCrSr = user?.hasRole
    ? (user.hasRole('cr') || user.hasRole('sr'))
    : (user?.role === 'cr' || user?.role === 'sr');

  const noticeMatches = (notice) => {
    if (!notice.scope) return true;
    if (notice.scope.department && notice.scope.department !== user.department) return false;
    if (notice.scope.semester && String(notice.scope.semester) !== String(user.semester || '')) return false;
    if (notice.scope.section && notice.scope.section !== user.section) return false;
    if (notice.scope.labSection && notice.scope.labSection !== user.labSection) return false;
    return true;
  };

  const visibleNotices = [...adminNotices, ...crsrNotices]
    .filter(noticeMatches)
    .sort((a, b) => (b.pinned - a.pinned) || (new Date(b.date || 0) - new Date(a.date || 0)));

  const saveCrsr = (next) => {
    setCrsrNotices(next);
    // Server-synced shared store (CR/SR only via ACL) + local fallback
    saveShared(CRSR_KEY, next);
  };

  const [formError, setFormError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const handleAdd = (e) => {
    e.preventDefault();
    const t = formTitle.trim();
    const c = formContent.trim();
    if (!t || !c) { setFormError('Title and content are required.'); return; }
    if (t.length < 5) { setFormError('Title must be at least 5 characters.'); return; }
    if (t.length > NOTICE_TITLE_MAX) { setFormError(`Title must be ≤ ${NOTICE_TITLE_MAX} characters.`); return; }
    if (c.length > NOTICE_CONTENT_MAX) { setFormError(`Content must be ≤ ${NOTICE_CONTENT_MAX} characters.`); return; }
    // Client-side rate limit (new posts only)
    const last = Number(localStorage.getItem(NOTICE_RATE_KEY) || 0);
    if (!editingId && Date.now() - last < NOTICE_RATE_MS) {
      const wait = Math.ceil((NOTICE_RATE_MS - (Date.now() - last)) / 1000);
      setFormError(`Please wait ${wait}s before posting another notice.`);
      return;
    }
    setFormError('');
    if (editingId) {
      saveCrsr(crsrNotices.map(n => n.id === editingId
        ? { ...n, title: t.slice(0, NOTICE_TITLE_MAX), content: c.slice(0, NOTICE_CONTENT_MAX), pinned: formPinned, editedAt: new Date().toISOString() }
        : n));
      closeForm();
      return;
    }
    const isCr = user.role === 'cr';
    const notice = {
      id: `cr-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      pinned: formPinned,
      date: new Date().toISOString().slice(0, 10),
      // Exact post time — `date` alone parses as UTC midnight, which made
      // the bell show "4h ago" for a notice posted minutes earlier.
      createdAt: new Date().toISOString(),
      // Poster's photo for the bell; skip oversized data URLs.
      postedByAvatar: typeof user.avatar === 'string' && user.avatar.length <= 120000 ? user.avatar : null,
      title: t.slice(0, NOTICE_TITLE_MAX),
      content: c.slice(0, NOTICE_CONTENT_MAX),
      postedBy: user.id,
      postedByName: user.name,
      postedByRole: user.role,
      postedBySection: user.section || '',
      postedByLabSection: user.labSection || '',
      scope: isCr
        ? { department: user.department, semester: String(user.semester), section: user.section, labSection: user.labSection }
        : { department: user.department, semester: String(user.semester), section: user.section },
    };
    saveCrsr([notice, ...crsrNotices]);
    try { localStorage.setItem(NOTICE_RATE_KEY, String(Date.now())); } catch {}
    // Send only title/content/pinned — server derives name/role from auth to prevent spoofing
    fetch('/api/telegram/send-notice', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        noticeId: notice.id,
        title: notice.title,
        content: notice.content,
        pinned: notice.pinned,
      }),
    }).catch(() => { /* Telegram broadcast is best-effort */ });
    closeForm();
  };

  const openNewForm = () => {
    setEditingId(null);
    setFormTitle('');
    setFormContent('');
    setFormPinned(false);
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (notice) => {
    setEditingId(notice.id);
    setFormTitle(notice.title || '');
    setFormContent(notice.content || '');
    setFormPinned(Boolean(notice.pinned));
    setFormError('');
    setShowForm(true);
  };

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormTitle('');
    setFormContent('');
    setFormPinned(false);
    setFormError('');
  }

  const onSwipeStart = (e, notice) => {
    const t = e.touches[0];
    if (!t) return;
    swipeStart.current = { id: notice.id, x: t.clientX, y: t.clientY, axis: null };
  };

  const onSwipeMove = (e) => {
    const st = swipeStart.current;
    const t = e.touches[0];
    if (!st || !t) return;
    const dx = t.clientX - st.x;
    const dy = t.clientY - st.y;
    if (!st.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      st.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
    }
    if (st.axis !== 'x') return;
    setSwipe({ id: st.id, dx: Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, dx)) });
  };

  const onSwipeEnd = (notice) => {
    const st = swipeStart.current;
    swipeStart.current = null;
    if (!st || st.axis !== 'x') { setSwipe(null); return; }
    swipeSuppressClick.current = true;
    setTimeout(() => { swipeSuppressClick.current = false; }, 350);
    const dx = swipe?.id === notice.id ? swipe.dx : 0;
    setSwipe(null);
    if (dx <= -SWIPE_TRIGGER) openEditForm(notice);
    else if (dx >= SWIPE_TRIGGER) setDeleteConfirmId(notice.id);
  };

  const handleDelete = (id) => {
    const target = crsrNotices.find(n => n.id === id);
    if (target) {
      removeNotificationById(target.notifId);
      removeNotificationById(`notice-${target.id}`);
      removeNotificationsByTitle(target.title);
    }
    saveCrsr(crsrNotices.filter(n => n.id !== id));
    setDeleteConfirmId(null);
  };

  const toggleExpand = (id) => {
    if (swipeSuppressClick.current) { swipeSuppressClick.current = false; return; }
    if (expandedNotice === id) {
      setExpandedNotice(null);
    } else {
      setExpandedNotice(id);
    }
  };

  const getCategoryBadgeClass = (category) => {
    switch (category) {
      case 'Exam': return 'badge-rose';
      case 'Library': return 'badge-cyan';
      case 'Event': return 'badge-purple';
      case 'Admin': return 'badge-amber';
      case 'IT': return 'badge-blue';
      default: return 'badge-blue';
    }
  };

  const isNewNotice = (dateStr) => {
    if (!dateStr) return false;
    const noticeDate = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - noticeDate) / (1000 * 60 * 60 * 24));
    return diffDays <= 2;
  };

  return (
    <div className="glass-card-static schedule-widget notice-widget animate-fadeInUp">

      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <BellRing size={20} />
          </div>
          <div>
            <span className="schedule-overline">Updates</span>
            <p className="schedule-title">Notice Board</p>
            <span className="schedule-subtitle">
              {visibleNotices.length} notice{visibleNotices.length === 1 ? '' : 's'} · click to expand
            </span>
          </div>
        </div>

        {isCrSr && (
          <div className="schedule-actions">
            <button className="schedule-nav-btn" onClick={openNewForm} aria-label="Post a notice" title="Post a notice">
              <Plus size={18} />
            </button>
          </div>
        )}
      </div>

      <div className="schedule-dotted-divider" />

      <div className="notice-list">
        {(adminLoading || crsrLoading) ? (
          <div className="notice-skeleton">
            {[0,1,2].map(i => (
              <div key={i} className="schedule-day-card skeleton-row" style={{ animationDelay: `${i*80}ms` }}>
                <div className="skeleton-line skeleton-line--short" />
                <div className="skeleton-line skeleton-line--mid" />
              </div>
            ))}
          </div>
        ) : visibleNotices.length === 0 ? (
          <div className="schedule-empty" style={{ padding: '28px 0', display:'flex', flexDirection:'column', gap:'10px', alignItems:'center' }}>
            <BellRing size={22} style={{ opacity: 0.3, marginBottom: '2px' }} />
            <span>No notices for your section yet</span>
            {isCrSr ? (
              <button className="btn btn-sm" onClick={openNewForm} style={{ display:'inline-flex', alignItems:'center', gap:'6px' }}>
                <Plus size={14} /> Post first notice
              </button>
            ) : (
              <span style={{ fontSize:'11px', color:'var(--text-tertiary)' }}>CR/SR will post lab/section updates here</span>
            )}
          </div>
        ) : visibleNotices.map((notice, idx) => {
          const isExpanded = expandedNotice === notice.id;
          const accent = notice.pinned ? 'var(--accent-amber)' : 'var(--accent-blue)';
          const isOwn = isCrSr && notice.postedBy === user.id;

          const dx = swipe?.id === notice.id ? swipe.dx : 0;
          const swipeHandlers = isOwn ? {
            onTouchStart: (e) => onSwipeStart(e, notice),
            onTouchMove: onSwipeMove,
            onTouchEnd: () => onSwipeEnd(notice),
            onTouchCancel: () => { swipeStart.current = null; setSwipe(null); },
          } : {};

          return (
            <div
              key={notice.id}
              className={`notice-swipe${isOwn ? ' is-swipeable' : ''}`}
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              {isOwn && (
                <div className="notice-swipe-bg" aria-hidden="true">
                  <span className={`notice-swipe-action is-delete${dx >= SWIPE_TRIGGER ? ' is-armed' : ''}`} style={{ opacity: dx > 0 ? 1 : 0 }}>
                    <Trash2 size={16} /> Delete
                  </span>
                  <span className={`notice-swipe-action is-edit${dx <= -SWIPE_TRIGGER ? ' is-armed' : ''}`} style={{ opacity: dx < 0 ? 1 : 0 }}>
                    Edit <Pencil size={16} />
                  </span>
                </div>
              )}
            <div
              className={`schedule-day-card notice-row${dx ? ' is-dragging' : ''}`}
              onClick={() => toggleExpand(notice.id)}
              {...swipeHandlers}
              style={{
                '--notice-accent': accent,
                transform: dx ? `translateX(${dx}px)` : undefined,
              }}
            >
              <div className="schedule-day-top">
                <div className="schedule-day-num-wrap">
                  {notice.postedByName ? (
                    <div className="notice-author-avatar" aria-hidden="true">
                      {(notice.postedByName || 'A').charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <UserRound size={14} className="notice-author-avatar-fallback" />
                  )}
                </div>
                <div className="schedule-day-badges">
                  {notice.pinned && (
                    <span className="notice-tag pinned"><Pin size={10} /> PINNED</span>
                  )}
                  {isNewNotice(notice.date) && (
                    <span className="notice-tag new"><Sparkles size={10} /> NEW</span>
                  )}
                  {notice.category && (
                    <span className={`notice-tag cat ${getCategoryBadgeClass(notice.category)}`}>
                      {notice.category}
                    </span>
                  )}
                  {isOwn && (
                    deleteConfirmId === notice.id ? (
                      <span className="notice-delete-confirm" onClick={e => e.stopPropagation()}>
                        <button className="btn btn-xs btn-danger" onClick={() => handleDelete(notice.id)}>Confirm</button>
                        <button className="btn btn-xs btn-ghost" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                      </span>
                    ) : (
                      <button
                        className="notice-tag delete"
                        aria-label="Delete notice"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(notice.id); }}
                      >
                        <Trash2 size={10} />
                      </button>
                    )
                  )}
                  <span className="notice-toggle">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </div>
              </div>

              <div className="notice-title">{notice.title}</div>
              <div className="notice-date">{notice.date}</div>
              {notice.postedByName && (
                <div className="notice-author-meta">
                  <span className="notice-author-name">{notice.postedByName}</span>
                  {notice.postedByRole && <span>{notice.postedByRole.toUpperCase()}</span>}
                  {(notice.postedBySection || notice.scope?.section) && (
                    <span>Section {notice.postedBySection || notice.scope.section}</span>
                  )}
                  {(notice.postedByLabSection || notice.scope?.labSection) && (
                    <span>Lab {notice.postedByLabSection || notice.scope.labSection}</span>
                  )}
                </div>
              )}

              {isExpanded ? (
                <div className="notice-details">
                  {notice.content}
                </div>
              ) : (
                <div className="notice-preview">{notice.content}</div>
              )}
            </div>
            </div>
          );
        })}
      </div>

      {showForm && createPortal(
        <>
          <div className="modal-overlay" onClick={closeForm} />
          <div className="routine-edit-modal notice-form-modal">
            <div className="routine-edit-header">
              <h3>{editingId ? 'Edit Notice' : 'Post a Notice'}</h3>
              <button className="schedule-nav-btn" onClick={closeForm} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="notice-form-body">
              {formError && (
                <div className="notice-form-error" style={{ padding:'8px 12px', borderRadius:'var(--radius-sm)', background:'var(--accent-rose-glow)', border:'1px solid var(--accent-rose)', color:'var(--accent-rose)', fontSize:'var(--fs-xs)' }}>
                  {formError}
                </div>
              )}
              <label className="notice-form-field">
                <span>Title <small style={{ color:'var(--text-tertiary)', fontWeight:400 }}>({formTitle.length}/{NOTICE_TITLE_MAX})</small></span>
                <input id="notice-title" name="title" className="input" value={formTitle} maxLength={NOTICE_TITLE_MAX} onChange={(e) => setFormTitle(e.target.value)} placeholder="Notice title (5-80 chars)" required />
              </label>
              <label className="notice-form-field">
                <span>Content <small style={{ color:'var(--text-tertiary)', fontWeight:400 }}>({formContent.length}/{NOTICE_CONTENT_MAX})</small></span>
                <textarea id="notice-content" name="content" className="input" rows="4" value={formContent} maxLength={NOTICE_CONTENT_MAX} onChange={(e) => setFormContent(e.target.value)} placeholder="Notice details" required />
              </label>
              <label className="notice-form-pin">
                <input id="notice-pinned" name="pinned" type="checkbox" checked={formPinned} onChange={(e) => setFormPinned(e.target.checked)} />
                <span className="notice-pin-track">
                  <span className="notice-pin-thumb" />
                </span>
                <Pin size={14} className="notice-pin-icon" />
                <span className="notice-pin-label">Pin this notice</span>
              </label>
              <div className="routine-edit-actions">
                <button type="button" className="btn btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingId ? 'Save Changes' : 'Post Notice'}</button>
              </div>
            </form>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
