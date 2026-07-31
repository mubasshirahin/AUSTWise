import { useState, useEffect } from 'react';
import { Megaphone, BellRing, Pin, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { getNotices } from '../../utils/noticeStorage';

export default function NoticeBoard() {
  const [expandedNotice, setExpandedNotice] = useState(null);
  const [noticesList, setNoticesList] = useState([]);

  // Fetch the admin-managed notices — same source the Admin Panel publishes to.
  useEffect(() => {
    let active = true;
    getNotices().then((list) => {
      if (active) setNoticesList(list);
    });
    return () => { active = false; };
  }, []);

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
    <div className="glass-card-static notice-board premium-card animate-fadeInUp">
      <div className="flex items-center justify-between" style={{ paddingTop: '10px', paddingBottom: '8px' }}>
        <div className="flex items-center gap-2">
          <div className="icon" style={{ backgroundColor: 'var(--accent-amber-glow)', color: 'var(--accent-amber)', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Megaphone size={18} />
          </div>
          <div>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Official University Announcements</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
        {noticesList.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <BellRing size={32} />
            <p>No notices posted</p>
          </div>
        ) : noticesList.map((notice) => {
          const isExpanded = expandedNotice === notice.id;
          
          return (
            <div 
              key={notice.id}
              className="notice-item premium-list-item"
              style={{
                background: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                border: notice.pinned ? '1px solid color-mix(in srgb, var(--accent-amber) 30%, transparent)' : '1px solid var(--border-primary)',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
              }}
              onClick={() => toggleExpand(notice.id)}
            >
              <div className="flex justify-between items-start gap-2 mb-1">
                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    {notice.pinned && (
                      <span className="badge badge-amber" style={{ fontSize: '8px', padding: '1px 4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <Pin size={8} /> PINNED
                      </span>
                    )}
                    {isNewNotice(notice.date) && (
                      <span className="badge badge-emerald notice-new-badge" style={{ fontSize: '8px', padding: '1px 4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <Sparkles size={8} /> NEW
                      </span>
                    )}
                    <span className={`badge ${getCategoryBadgeClass(notice.category)}`} style={{ fontSize: '8px', padding: '1px 4px' }}>
                      {notice.category}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>{notice.date}</span>
                  </div>
                  <h4 style={{ fontSize: '13px', fontWeight: 'var(--fw-semibold)', color: notice.pinned ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {notice.title}
                  </h4>
                </div>
                <button style={{ color: 'var(--text-tertiary)', padding: '2px' }}>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {isExpanded ? (
                <div className="notice-details mt-2 animate-fadeIn" style={{ fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-primary)', paddingTop: '8px', lineHeight: '1.4' }}>
                  <p>{notice.content}</p>
                </div>
              ) : (
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '4px' }}>
                  {notice.content}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
