import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, X, ChevronDown, ChevronRight, MessageSquare, User as UserIcon,
  Link2, GraduationCap, BookOpen, Clock3, WifiOff, Loader2, Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useWebSocket from '../../hooks/useWebSocket';
import { useStalk } from '../stalk-road/StalkContext';
import './ActiveMembersSidebar.css';

/* ─── Constants ─── */

const MEMBERS_POLL_MS = 30000;
const GROUPS_KEY = 'aust-members-groups-v1';

const GROUPING_MODES = [
  { id: 'role', label: 'Role' },
  { id: 'department', label: 'Department' },
  { id: 'batch', label: 'Batch' },
  { id: 'semester', label: 'Semester' },
];

const ROLE_GROUPS = [
  { key: 'admin', label: 'Admin', icon: '👑' },
  { key: 'moderator', label: 'Moderator', icon: '🛡️' },
  { key: 'faculty', label: 'Faculty', icon: '🎓' },
  { key: 'crsr', label: 'CR / SR', icon: '📚' },
  { key: 'student', label: 'Student', icon: '🧑‍🎓' },
  { key: 'alumni', label: 'Alumni', icon: '💼' },
];

function roleGroupKey(role) {
  if (role === 'cr' || role === 'sr') return 'crsr';
  if (role === 'senior') return 'student';
  return role || 'student';
}

function getRoleDisplay(role) {
  if (role === 'cr') return 'CR';
  if (role === 'sr') return 'SR';
  if (role === 'senior') return 'Senior';
  if (role === 'admin') return 'Admin';
  if (role === 'moderator') return 'Moderator';
  if (role === 'faculty') return 'Faculty';
  if (role === 'alumni') return 'Alumni';
  return 'Student';
}

const AVATAR_IMG_STYLE = { width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' };

function formatLastSeen(ts) {
  if (!ts) return 'last seen recently';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'last seen just now';
  if (diff < 3600000) return `last seen ${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `last seen ${Math.floor(diff / 3600000)}h ago`;
  const d = new Date(ts);
  return `last seen ${d.getDate()}/${d.getMonth() + 1}`;
}

function presenceMeta(status) {
  switch (status) {
    case 'online': return { dot: 'am-online', label: 'Active now' };
    case 'idle': return { dot: 'am-idle', label: 'Idle' };
    default: return { dot: 'am-offline', label: 'Offline' };
  }
}

/* ─── Presence dot ─── */
function PresenceDot({ status, size }) {
  return <span className={`am-dot ${presenceMeta(status).dot}`} style={size ? { width: size, height: size } : undefined} />;
}

/* ─── Member row ─── */
function MemberRow({ member, onClick, isOffline, isAdmin }) {
  const { stalk } = useStalk();
  return (
    <div
      className={`am-member-row${isOffline ? ' am-row-offline' : ''}${isAdmin ? ' am-row-admin' : ''}`}
      title={member.name}
    >
      <button
        type="button"
        className="am-row-main"
        onClick={onClick}
        title={`View ${member.name}'s profile`}
      >
        <span className="am-avatar-wrap">
          <span className="am-avatar">
            {member.avatar ? (
              <img src={member.avatar} alt="" style={AVATAR_IMG_STYLE} />
            ) : (
              member.initials || member.name?.slice(0, 2).toUpperCase()
            )}
          </span>
          <PresenceDot status={member.status} size={11} />
        </span>
        <span className="am-row-body">
          <span className="am-row-name">
            {isAdmin && <span className="am-admin-crown-mini" aria-hidden="true">👑</span>}
            {member.name}
            {member.isYou && <span className="am-you">You</span>}
          </span>
          <span className="am-row-sub">
            {getRoleDisplay(member.role)}
            {member.department ? ` • ${member.department}` : ''}
            {member.semester ? ` • Sem ${member.semester}` : ''}
          </span>
        </span>
        <span className="am-row-status-dot" data-status={member.status} />
      </button>
      <button
        type="button"
        className="am-stalk-btn"
        onClick={(e) => { e.stopPropagation(); stalk(member); }}
        title={`Stalk ${member.name} 🐾`}
        aria-label={`Stalk ${member.name}`}
      >
        <span className="am-stalk-paw" aria-hidden="true">🐾</span>
        <span className="am-stalk-text">STALK</span>
      </button>
    </div>
  );
}

/* ─── Collapsible group section ─── */
function MemberGroup({ title, icon, count, children, defaultOpen, forceOpen, collapsed, onToggle, className }) {
  // `collapsed` is true when the user has collapsed this group
  const isOpen = forceOpen || (collapsed !== undefined ? !collapsed : defaultOpen !== false);
  return (
    <div className={`am-group${isOpen ? ' open' : ''}${className ? ` ${className}` : ''}`}>
      <button type="button" className="am-group-head" onClick={onToggle}>
        {onToggle && (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
        {icon && <span className="am-group-icon">{icon}</span>}
        <span className="am-group-title">{title}</span>
        <span className="am-group-count">{count}</span>
      </button>
      {isOpen && <div className="am-group-body">{children}</div>}
    </div>
  );
}

/* ─── Member profile popover (anchored to the clicked row) ─── */
function MemberPopover({ member, rect, onClose }) {
  const navigate = useNavigate();
  const popRef = useRef(null);
  const { stalk } = useStalk();

  // Compute placement from the anchored row's rect (captured at open time).
  // Done in render — no effect needed since rect is a frozen snapshot.
  const placed = useMemo(() => {
    if (!rect) return null;
    const W = 300;
    // Pop to the LEFT of the member list by default (panel is on the right edge)
    let left = rect.right - W - 16;
    let flip = false;
    if (left < 12) {
      left = rect.right + 16;
      flip = true;
    }
    const maxLeft = window.innerWidth - W - 12;
    if (left > maxLeft) left = Math.max(12, maxLeft);

    // Clamp vertically so it never overflows the viewport
    const estH = 430;
    let top = Math.min(rect.top, window.innerHeight - estH - 12);
    if (top < 12) top = 12;

    return { left, top, flip };
  }, [rect]);

  // Close on Escape or outside click
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  if (!member || !rect || !placed) return null;

  const meta = presenceMeta(member.status);
  const roleClass = `am-role-${member.role === 'admin' || member.role === 'moderator' ? 'admin' : member.role === 'faculty' ? 'faculty' : (member.role === 'cr' || member.role === 'sr') ? 'crsr' : 'student'}`;

  const copyLink = () => {
    const url = `${window.location.origin}/messages?peer=${encodeURIComponent(member.id)}`;
    navigator.clipboard?.writeText(url).catch(() => {});
  };

  return (
    <div
      ref={popRef}
      className={`am-popover${placed.flip ? ' flip' : ''}`}
      style={{ left: placed.left, top: placed.top }}
    >
      <div className={`am-pop-banner ${roleClass}`}>
        <span className="am-pop-banner-fade" />
      </div>
      <div className="am-pop-avatar-wrap">
        <span className={`am-pop-avatar ${roleClass}`}>
          {member.avatar ? (
            <img src={member.avatar} alt="" style={AVATAR_IMG_STYLE} />
          ) : (
            member.initials || member.name?.slice(0, 2).toUpperCase()
          )}
        </span>
        <PresenceDot status={member.status} size={14} />
      </div>
      <button type="button" className="am-pop-close" onClick={onClose} aria-label="Close profile">
        <X size={15} />
      </button>

      <div className="am-pop-body">
        <h3 className="am-pop-name">{member.name}</h3>
        <div className="am-pop-badges">
          <span className="am-chip am-chip-role">{getRoleDisplay(member.role)}</span>
          {member.batchNo && <span className="am-chip">Batch {member.batchNo}</span>}
          {member.department && <span className="am-chip">{member.department}</span>}
          {member.semester ? <span className="am-chip">Semester {member.semester}</span>
            : member.yearSemester ? <span className="am-chip">{member.yearSemester}</span> : null}
          {member.section && <span className="am-chip">Section {member.section}</span>}
          {member.labSection && <span className="am-chip">Lab {member.labSection}</span>}
        </div>

        <div className={`am-pop-status ${meta.dot}`}>
          <PresenceDot status={member.status} size={9} />
          <span>{member.status === 'online' ? 'Active now' : member.status === 'idle' ? 'Idle — away for a while' : formatLastSeen(member.lastSeenAt)}</span>
        </div>

        <div className="am-pop-divider" />

        <div className="am-pop-info">
          <div className="am-pop-info-row">
            <span className="am-pop-info-label">Department</span>
            <span className="am-pop-info-value">{member.department || '—'}</span>
          </div>
          <div className="am-pop-info-row">
            <span className="am-pop-info-label">Batch</span>
            <span className="am-pop-info-value">{member.batchNo ? `Batch ${member.batchNo}` : (member.batch || '—')}</span>
          </div>
          <div className="am-pop-info-row">
            <span className="am-pop-info-label">Semester</span>
            <span className="am-pop-info-value">{member.semester ? `Semester ${member.semester}` : '—'}</span>
          </div>
          <div className="am-pop-info-row">
            <span className="am-pop-info-label">CGPA</span>
            <span className="am-pop-info-value">
              {member.cgpa != null ? member.cgpa.toFixed(2) : 'Private'}
            </span>
          </div>
          <div className="am-pop-info-row">
            <span className="am-pop-info-label">Attendance</span>
            <span className="am-pop-info-value">
              {member.attendancePct != null ? `${member.attendancePct}%` : 'Private'}
            </span>
          </div>
        </div>

        <div className="am-pop-divider" />

        <div className="am-pop-actions">
          <button
            type="button"
            className="am-pop-action am-pop-action-stalk"
            onClick={() => { stalk(member); onClose(); }}
            title={`Go on a stalk road-trip to ${member.name}'s portfolio`}
          >
            <span aria-hidden="true">🐾</span>
            <span>Stalk</span>
          </button>
          <button
            type="button"
            className="am-pop-action"
            onClick={() => { navigate(`/messages?peer=${encodeURIComponent(member.id)}`); onClose(); }}
            title="Open a direct message"
          >
            <MessageSquare size={16} />
            <span>Message</span>
          </button>
          <button
            type="button"
            className="am-pop-action"
            onClick={() => { navigate('/community?tab=students'); onClose(); }}
            title="Open the student directory"
          >
            <UserIcon size={16} />
            <span>Profile</span>
          </button>
          <button type="button" className="am-pop-action" onClick={copyLink} title="Copy a link to this member">
            <Link2 size={16} />
            <span>Copy Link</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main sidebar ─── */
export default function ActiveMembersSidebar({ open, onClose, onToggle, isDesktop }) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('role');
  const [query, setQuery] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try { return JSON.parse(localStorage.getItem(GROUPS_KEY) || '{}'); }
    catch { return {}; }
  });
  const [offlineOpen, setOfflineOpen] = useState(false); // offline list: inverted vs collapsedGroups
  const [onlineOpen, setOnlineOpen] = useState(true); // online list: open by default (self visible)
  const [popover, setPopover] = useState(null); // { member, rect }
  const rowRefs = useRef({});

  // Initial load + polling fallback (WS updates presence live on top)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/presence/members', { credentials: 'same-origin' }).catch(() => null);
      if (cancelled || !res) return;
      const data = await res.json().catch(() => null);
      if (cancelled || !data) return;
      if (data.success) {
        setMembers(data.members || []);
        setError('');
        setAuthRequired(false);
      } else if (res.status === 401 || data.error === 'Authentication required.') {
        setAuthRequired(true);
        setError('');
      } else {
        setError(data.error || 'Failed to load members.');
      }
      setLoading(false);
    })();
    const t = setInterval(() => {
      fetch('/api/presence/members', { credentials: 'same-origin' })
        .then((r) => (r.status === 401 ? null : r.json()))
        .then((data) => {
          if (data?.success) {
            setMembers(data.members || []);
            setError('');
            setAuthRequired(false);
          } else if (data?.error === 'Authentication required.') {
            setAuthRequired(true);
            setError('');
          }
        })
        .catch(() => {});
    }, MEMBERS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isAuthenticated]);

  // Live presence updates over WebSocket (only when signed in — guests rely
  // on the 30s polling so they don't register as "online" themselves)
  const { connected } = useWebSocket(isAuthenticated ? user?.id : null, {
    onPresence: useCallback(({ userId, status, lastSeenAt }) => {
      setMembers((prev) => prev.map((m) =>
        m.id === userId ? { ...m, status, lastSeenAt } : m
      ));
    }, []),
    onPresenceSnapshot: useCallback((presence) => {
      setMembers((prev) => prev.map((m) => {
        const p = presence[m.id];
        return p ? { ...m, status: p.status, lastSeenAt: p.lastSeenAt } : m;
      }));
    }, []),
  });

  // Close popover on route change / scroll / resize
  useEffect(() => {
    const close = () => setPopover(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, []);

  // Persist collapsed-group state
  useEffect(() => {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(collapsedGroups));
  }, [collapsedGroups]);

  const toggleGroup = useCallback((key) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  }, []);

  // Online = everyone currently active (online/idle), with the signed-in user
  // always pinned in so you can see yourself ("You" row).
  const onlineMembers = useMemo(() => {
    const list = members.filter((m) => (m.status === 'online' || m.status === 'idle') && m.role !== 'admin');
    if (isAuthenticated && user?.id && user?.role !== 'admin' && !list.some((m) => m.id === user.id)) {
      list.push({ id: user.id, name: user.name, initials: user.initials, avatar: user.avatar, role: user.role, department: user.department, semester: user.semester, status: 'online', lastSeenAt: Date.now(), isYou: true });
    }
    return list.map((m) => (m.id === user?.id ? { ...m, isYou: true } : m));
  }, [members, user, isAuthenticated]);

  // Presence-aware counts — include self and online admins so the badge
  // tracks "who is online" live (admins live in their own pinned section,
  // so they're added back into the count here).
  const onlineCount = useMemo(
    () => onlineMembers.length + members.filter((m) => m.role === 'admin' && (m.status === 'online' || m.status === 'idle')).length,
    [onlineMembers, members]
  );
  const offlineMembers = useMemo(() => members.filter((m) => m.status === 'offline' && m.role !== 'admin'), [members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? members.filter((m) =>
      m.name?.toLowerCase().includes(q) ||
      m.department?.toLowerCase().includes(q) ||
      m.batchNo?.toLowerCase().includes(q)
    ) : members;
    return list;
  }, [members, query]);

  // Admins always live in their own pinned section at the very top — never
  // mixed into the Online list, the role groups, or the Offline section.
  // (Defined after `filtered` — it reads from it.)
  const admins = useMemo(
    () => filtered
      .filter((m) => m.role === 'admin')
      .map((m) => (m.id === user?.id ? { ...m, isYou: true } : m)),
    [filtered, user]
  );

  // Group the filtered list per active mode (offline users stay in their groups
  // for dept/batch/semester modes; for Role mode they move to the Offline section)
  const groups = useMemo(() => {
    if (mode === 'role') {
      return ROLE_GROUPS.map((g) => ({
        key: `role-${g.key}`,
        title: g.label,
        icon: g.icon,
        members: filtered.filter((m) => m.role !== 'admin' && roleGroupKey(m.role) === g.key && m.status !== 'offline'),
      })).filter((g) => g.members.length > 0);
    }
    if (mode === 'department') {
      const byDept = {};
      filtered.forEach((m) => {
        if (m.role === 'admin') return; // admins pinned in their own section
        const k = m.department || 'Undeclared';
        (byDept[k] = byDept[k] || []).push(m);
      });
      return Object.entries(byDept)
        .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
        .map(([dept, list]) => ({
          key: `dept-${dept}`,
          title: dept,
          icon: <BookOpen size={13} />,
          members: list,
        }));
    }
    if (mode === 'batch') {
      const byBatch = {};
      filtered.forEach((m) => {
        if (m.role === 'admin') return; // admins pinned in their own section
        const k = m.batchNo || (m.batch ? String(m.batch).replace(/^Batch\s*/i, '') : 'Other');
        (byBatch[k] = byBatch[k] || []).push(m);
      });
      return Object.entries(byBatch)
        .sort((a, b) => Number(b[0]) - Number(a[0]) || a[0].localeCompare(b[0]))
        .map(([b, list]) => ({
          key: `batch-${b}`,
          title: b === 'Other' ? 'Other' : `Batch ${b}`,
          icon: <GraduationCap size={13} />,
          members: list,
        }));
    }
    // semester
    const bySem = {};
    filtered.forEach((m) => {
      if (m.role === 'admin') return; // admins pinned in their own section
      const k = m.semester ? String(m.semester) : 'Other';
      (bySem[k] = bySem[k] || []).push(m);
    });
    return Object.entries(bySem)
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([s, list]) => ({
        key: `sem-${s}`,
        title: s === 'Other' ? 'Other' : `Semester ${s}`,
        icon: <Clock3 size={13} />,
        members: list,
      }));
  }, [mode, filtered]);

  const openPopover = (member, key) => {
    const el = rowRefs.current[key];
    if (el) {
      const r = el.getBoundingClientRect();
      setPopover({ member, rect: { left: r.left, right: r.right, top: r.top } });
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && !isDesktop && <div className="am-backdrop" onClick={onClose} />}

      <aside className={`am-sidebar${open ? ' open' : ''}`} aria-hidden={!open}>
        {/* Header */}
        <div className="am-header">
          <div className="am-header-title">
            <Users size={16} />
            <span>Active Now</span>
            <span className={`am-live-badge${onlineCount > 0 ? ' has-online' : ''}`}>
              <PresenceDot status={onlineCount > 0 ? 'online' : 'offline'} size={7} />
              {onlineCount}
            </span>
          </div>
          <div className="am-header-actions">
            {!isDesktop && (
              <button type="button" className="am-icon-btn" onClick={onClose} aria-label="Close members panel">
                <X size={16} />
              </button>
            )}
            <button
              type="button"
              className={`am-icon-btn am-toggle-btn${open ? ' active' : ''}`}
              onClick={onToggle}
              aria-label={open ? 'Hide active members' : 'Show active members'}
              title={open ? 'Hide members' : 'Show members'}
            >
              {open ? <ChevronRight size={16} /> : <Users size={16} />}
            </button>
          </div>
        </div>

        {/* Grouping pills */}
        <div className="am-mode-tabs">
          {GROUPING_MODES.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`am-mode-tab${mode === g.id ? ' active' : ''}`}
              onClick={() => setMode(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="am-search">
          <Search size={13} />
          <input
            type="text"
            placeholder="Find someone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search members"
          />
          {query && (
            <button type="button" className="am-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="am-list">
          {loading && members.length === 0 ? (
            <div className="am-empty">
              <Loader2 size={20} className="spin" />
              <span>Loading members…</span>
            </div>
          ) : authRequired ? (
            <div className="am-empty am-auth-required">
              <Lock size={20} />
              <span>Log in required to see members.</span>
              <button type="button" className="am-login-btn" onClick={() => navigate('/login')}>
                Log in
              </button>
            </div>
          ) : error && members.length === 0 ? (
            <div className="am-empty">
              <WifiOff size={20} />
              <span>{error}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="am-empty">
              <Users size={20} />
              <span>{query ? 'No one matches that name.' : "No one's around right now 👋"}</span>
            </div>
          ) : (
            <>
              {/* Admin section — pinned above everyone, always visible */}
              {admins.length > 0 && (
                <MemberGroup
                  title="Admin"
                  icon={<span className="am-admin-crown">👑</span>}
                  count={admins.length}
                  forceOpen
                  className="am-group-admin"
                >
                  {admins.map((m) => (
                    <span key={`adm-${m.id}`} ref={(el) => { rowRefs.current[`adm-${m.id}`] = el; }}>
                      <MemberRow member={m} isOffline={m.status === 'offline'} isAdmin onClick={() => openPopover(m, `adm-${m.id}`)} />
                    </span>
                  ))}
                </MemberGroup>
              )}

              {/* Online section — active now (online + idle), own name pinned */}
              {onlineMembers.length > 0 && (
                <MemberGroup
                  title="Online"
                  icon={<span className="am-live-dot" />}
                  count={onlineMembers.length}
                  defaultOpen={true}
                  collapsed={!onlineOpen}
                  onToggle={() => setOnlineOpen((o) => !o)}
                >
                  {onlineMembers.map((m) => (
                    <span key={`on-${m.id}`} ref={(el) => { rowRefs.current[`on-${m.id}`] = el; }}>
                      <MemberRow member={m} isOffline={false} onClick={() => openPopover(m, `on-${m.id}`)} />
                    </span>
                  ))}
                </MemberGroup>
              )}

              {groups.map((g) => {
                const key = g.key;
                const collapsed = collapsedGroups[key];
                return (
                  <MemberGroup
                    key={key}
                    title={g.title}
                    icon={g.icon}
                    count={g.members.length}
                    collapsed={collapsed}
                    onToggle={() => toggleGroup(key)}
                  >
                    {g.members.map((m) => {
                      const rowKey = `${key}-${m.id}`;
                      return (
                        <span key={rowKey} ref={(el) => { rowRefs.current[rowKey] = el; }}>
                          <MemberRow member={m} onClick={() => openPopover(m, rowKey)} />
                        </span>
                      );
                    })}
                  </MemberGroup>
                );
              })}

              {/* Offline section — only in Role mode, collapsed by default */}
              {mode === 'role' && offlineMembers.length > 0 && (
                <MemberGroup
                  title="Offline"
                  icon={<WifiOff size={13} />}
                  count={offlineMembers.length}
                  defaultOpen={false}
                  collapsed={!offlineOpen}
                  onToggle={() => setOfflineOpen((o) => !o)}
                >
                  {offlineMembers.map((m) => (
                    <span key={`off-${m.id}`} ref={(el) => { rowRefs.current[`off-${m.id}`] = el; }}>
                      <MemberRow member={m} isOffline onClick={() => openPopover(m, `off-${m.id}`)} />
                    </span>
                  ))}
                </MemberGroup>
              )}
            </>
          )}
        </div>

        {/* Footer status */}
        <div className="am-footer">
          <span className={`am-ws-dot${connected ? ' on' : ''}`} />
          <span>{connected ? 'Live presence' : (isAuthenticated ? 'Presence paused' : 'Log in for live updates')}</span>
          {!isDesktop && (
            <button type="button" className="am-footer-open" onClick={() => navigate('/messages')}>
              <MessageSquare size={12} /> ConnectBox
            </button>
          )}
        </div>
      </aside>

      {popover && popover.rect && (
        <MemberPopover member={popover.member} rect={popover.rect} onClose={() => setPopover(null)} />
      )}
    </>
  );
}
