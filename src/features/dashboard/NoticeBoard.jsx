import { useState } from 'react';
import { createPortal } from 'react-dom';
import { BellRing, Pin, ChevronDown, ChevronUp, Sparkles, Plus, X, Trash2, UserRound } from 'lucide-react';
import { notices } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';
import { addNotification, makeNotifId, showNativeNotification, removeNotificationById, removeNotificationsByTitle } from '../../utils/inAppNotifications';

const CRSR_KEY = 'aust-cr-sr-notices';

export default function NoticeBoard() {
  const { user } = useAuth();
  const [expandedNotice, setExpandedNotice] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formPinned, setFormPinned] = useState(false);

  const [adminNotices] = useState(() => {
    try {
      const stored = localStorage.getItem('aust-notices');
      return stored ? JSON.parse(stored) : notices;
    } catch {
      return notices;
    }
  });

  const [crsrNotices, setCrsrNotices] = useState(() => {
    try {
      const stored = localStorage.getItem(CRSR_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

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
    try { localStorage.setItem(CRSR_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) return;
    const isCr = user.role === 'cr';
    const notice = {
      id: `cr-${Date.now()}`,
      pinned: formPinned,
      date: new Date().toISOString().slice(0, 10),
      title: formTitle.trim(),
      content: formContent.trim(),
      postedBy: user.id,
      postedByName: user.name,
      postedByRole: user.role,
      scope: isCr
        ? { department: user.department, semester: String(user.semester), labSection: user.labSection }
        : { department: user.department, semester: String(user.semester), section: user.section },
    };
    const notif = {
      id: makeNotifId('notice'),
      title: 'New Notice',
      body: notice.title,
      type: 'notice',
      icon: 'BellRing',
      path: '/',
      timestamp: Date.now(),
      read: false,
      priority: notice.pinned ? 'high' : 'medium',
    };
    addNotification(notif);
    showNativeNotification(notif);
    saveCrsr([{ ...notice, notifId: notif.id }, ...crsrNotices]);
    fetch('/api/telegram/send-notice', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: notice.title,
        content: notice.content,
        pinned: notice.pinned,
        postedByName: notice.postedByName,
        postedByRole: notice.postedByRole,
      }),
    }).catch(() => { /* Telegram broadcast is best-effort */ });
    setFormTitle('');
    setFormContent('');
    setFormPinned(false);
    setShowForm(false);
  };

  const handleDelete = (id) => {
    const target = crsrNotices.find(n => n.id === id);
    if (target) {
      removeNotificationById(target.notifId);
      removeNotificationsByTitle(target.title);
    }
    saveCrsr(crsrNotices.filter(n => n.id !== id));
  };

  const toggleExpand = (id) => {
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
            <button className="schedule-nav-btn" onClick={() => setShowForm(true)} aria-label="Post a notice" title="Post a notice">
              <Plus size={18} />
            </button>
          </div>
        )}
      </div>

      <div className="schedule-dotted-divider" />

      <div className="notice-list">
        {visibleNotices.length === 0 ? (
          <div className="schedule-empty" style={{ padding: '28px 0' }}>
            <BellRing size={22} style={{ opacity: 0.3, marginBottom: '6px' }} />
            No notices posted
          </div>
        ) : visibleNotices.map((notice, idx) => {
          const isExpanded = expandedNotice === notice.id;
          const accent = notice.pinned ? 'var(--accent-amber)' : 'var(--accent-blue)';
          const isOwn = isCrSr && notice.postedBy === user.id;

          return (
            <div
              key={notice.id}
              className="schedule-day-card notice-row"
              onClick={() => toggleExpand(notice.id)}
              style={{
                borderLeft: `2px solid ${accent}`,
                cursor: 'pointer',
                animationDelay: `${idx * 60}ms`,
              }}
            >
              <div className="schedule-day-top">
                <div className="schedule-day-num-wrap">
                  <div className="schedule-day-count">{notice.date}</div>
                </div>
                <div className="schedule-day-badges">
                  {notice.postedByRole && (
                    <span className="notice-tag role">
                      <UserRound size={10} />
                      {notice.postedByRole.toUpperCase()} · {notice.scope?.labSection || notice.scope?.section || ''}
                    </span>
                  )}
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
                    <button
                      className="notice-tag delete"
                      aria-label="Delete notice"
                      onClick={(e) => { e.stopPropagation(); handleDelete(notice.id); }}
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                  <span className="notice-toggle">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </div>
              </div>

              <div className="notice-title">{notice.title}</div>

              {isExpanded ? (
                <div className="notice-details">
                  {notice.content}
                  {notice.postedByName && (
                    <div className="notice-author">Posted by {notice.postedByName}</div>
                  )}
                </div>
              ) : (
                <div className="notice-preview">{notice.content}</div>
              )}
            </div>
          );
        })}
      </div>

      {showForm && createPortal(
        <>
          <div className="modal-overlay" onClick={() => setShowForm(false)} />
          <div className="routine-edit-modal notice-form-modal">
            <div className="routine-edit-header">
              <h3>Post a Notice</h3>
              <button className="schedule-nav-btn" onClick={() => setShowForm(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="notice-form-body">
              <label className="notice-form-field">
                <span>Title</span>
                <input className="input" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Notice title" required />
              </label>
              <label className="notice-form-field">
                <span>Content</span>
                <textarea className="input" rows="4" value={formContent} onChange={(e) => setFormContent(e.target.value)} placeholder="Notice details" required />
              </label>
              <label className="notice-form-pin">
                <input type="checkbox" checked={formPinned} onChange={(e) => setFormPinned(e.target.checked)} />
                <span className="notice-pin-track">
                  <span className="notice-pin-thumb" />
                </span>
                <Pin size={14} className="notice-pin-icon" />
                <span className="notice-pin-label">Pin this notice</span>
              </label>
              <div className="routine-edit-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Post Notice</button>
              </div>
            </form>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
