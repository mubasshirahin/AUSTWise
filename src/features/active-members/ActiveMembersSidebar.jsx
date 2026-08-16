import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, X, ChevronDown, ChevronRight,
  BookOpen, WifiOff, Loader2, Lock, UserCog, Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useWebSocket from '../../hooks/useWebSocket';
import { useStalk } from '../stalk-road/StalkContext';
import './ActiveMembersSidebar.css';

/* ─── Constants ─── */

const MEMBERS_POLL_MS = 30000;
const GROUPS_KEY = 'aust-members-groups-v1';

// Canonical AUST department list — every department shows in the member list,
// even ones with no members yet, so the full structure is always visible.
const ALL_DEPARTMENTS = ['CSE', 'EEE', 'CE', 'ME', 'IPE', 'TE', 'ARCH', 'BBA'];

// Canonical section + lab structure — every section (A/B/C/D) and its lab groups
// (A1/A2 … D1/D2) always renders inside a semester, even when empty.
const ALL_SECTIONS = ['A', 'B', 'C', 'D'];
const LABS_BY_SECTION = { A: ['A1', 'A2'], B: ['B1', 'B2'], C: ['C1', 'C2'], D: ['D1', 'D2'] };

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
function MemberRow({ member, onClick, isOffline, isAdmin, devSwitch, switching }) {
  return (
    <div
      className={`am-member-row${isOffline ? ' am-row-offline' : ''}${isAdmin ? ' am-row-admin' : ''}${devSwitch ? ' am-row-dev-switch' : ''}`}
      title={devSwitch ? `Dev: log in as ${member.name}` : member.name}
    >
      <button
        type="button"
        className="am-row-main"
        onClick={onClick}
        title={devSwitch ? `Quick log in as ${member.name}` : `View ${member.name}'s profile`}
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
            {member.name}
            {member.isYou && <span className="am-you">You</span>}
          </span>
          <span className="am-row-sub">
            {isAdmin ? (member.department || getRoleDisplay(member.role)) : getRoleDisplay(member.role)}
            {!isAdmin && member.department ? ` • ${member.department}` : ''}
            {!isAdmin && member.semester ? ` • Sem ${member.semester}` : ''}
          </span>
        </span>
        <span className="am-row-status-dot" data-status={member.status} />
        {devSwitch && (
          <span className="am-row-switch-chip">
            {switching ? <Loader2 size={10} className="spin" /> : 'Switch'}
          </span>
        )}
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

  const roleClass = `am-role-${member.role === 'admin' || member.role === 'moderator' ? 'admin' : member.role === 'faculty' ? 'faculty' : (member.role === 'cr' || member.role === 'sr') ? 'crsr' : 'student'}`;

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
    {member.role !== 'admin' && (member.semester ? <span className="am-chip">Semester {member.semester}</span>
      : member.yearSemester ? <span className="am-chip">{member.yearSemester}</span> : null)}
          {member.section && <span className="am-chip">Section {member.section}</span>}
          {member.labSection && <span className="am-chip">Lab {member.labSection}</span>}
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
          {member.role !== 'admin' && (
            <div className="am-pop-info-row">
              <span className="am-pop-info-label">Semester</span>
              <span className="am-pop-info-value">{member.semester ? `Semester ${member.semester}` : '—'}</span>
            </div>
          )}
          <div className="am-pop-info-row">
            <span className="am-pop-info-label">CGPA</span>
            <span className="am-pop-info-value">
              {member.cgpa != null ? member.cgpa.toFixed(2) : 'Private'}
            </span>
          </div>
        </div>

        <div className="am-pop-divider" />

        <div className="am-pop-actions">
          <button
            type="button"
            className="am-pop-action am-pop-action-stalk"
            onClick={() => { stalk(member); onClose(); }}
            title={`Visit ${member.name}'s orbit`}
          >
            <span aria-hidden="true">🐾</span>
            <span>Visit Orbit</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main sidebar ─── */
export default function ActiveMembersSidebar({ open, onClose, onToggle, isDesktop }) {
  const { user, isAuthenticated, loginDirect } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try { return JSON.parse(localStorage.getItem(GROUPS_KEY) || '{}'); }
    catch { return {}; }
  });
  const [popover, setPopover] = useState(null); // { member, rect }
  const rowRefs = useRef({});

  // Dev-only "quick login" tool — lets the developer click any member in the
  // list and instantly switch into their account (role/permission testing).
  // Shown only when the dev endpoints are actually available: the vite dev
  // build reports DEV=true immediately, and we probe the server for every
  // other dev-server mode (dist-served routes / static dev). Production
  // servers disable the endpoints, so the button never appears there.
  const [devEnabled, setDevEnabled] = useState(null); // null = probing
  const [devMode, setDevMode] = useState(false);
  const [switchingId, setSwitchingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/__dev/users', { credentials: 'same-origin' })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => { if (!cancelled) setDevEnabled(Boolean(d?.success)); })
      .catch(() => { if (!cancelled) setDevEnabled(false); });
    return () => { cancelled = true; };
  }, []);
  const showDevTools = import.meta.env.DEV || devEnabled === true;

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
  useWebSocket(isAuthenticated ? user?.id : null, {
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
    () => onlineMembers.length + members.filter((m) => m.role === 'admin').length,
    [onlineMembers, members]
  );
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
  // Admins always show as active — pinned at the top with a green dot, no
  // offline styling, and "Active now" in their profile popover.
  const admins = useMemo(
    () => filtered
      .filter((m) => m.role === 'admin')
      .map((m) => ({ ...m, status: 'online', ...(m.id === user?.id ? { isYou: true } : {}) })),
    [filtered, user]
  );

  // Group the filtered list by department, then semester inside each
  // department (offline users stay in their groups). Departments with members
  // come first (sorted by size); the remaining known departments render below
  // with an empty state so the whole AUST structure stays visible.
  const groups = useMemo(() => {
    const byDept = {};
    filtered.forEach((m) => {
      if (m.role === 'admin') return; // admins pinned in their own section
      const k = m.department || 'Undeclared';
      (byDept[k] = byDept[k] || []).push(m);
    });
    const membered = Object.entries(byDept)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([dept, list]) => {
        const bySem = {};
        list.forEach((m) => {
          const s = m.semester ? String(m.semester) : 'Other';
          (bySem[s] = bySem[s] || []).push(m);
        });
        const toGroups = (map) =>
          Object.entries(map)
            .sort((a, b) => {
              const oa = a[0] === 'Other' ? 1 : 0;
              const ob = b[0] === 'Other' ? 1 : 0;
              return oa - ob || a[0].localeCompare(b[0], undefined, { numeric: true });
            })
            .map(([k, members]) => ({ key: k, members }));
        const semesters = Object.entries(bySem)
          .sort((a, b) => {
            const na = a[0] === 'Other' ? 999 : Number(a[0]);
            const nb = b[0] === 'Other' ? 999 : Number(b[0]);
            return na - nb;
          })
          .map(([sem, members]) => {
            // Group by Section first, then by Lab group inside each section —
            // members without a labSection sit directly under the section.
            // Every canonical section (A/B/C/D) and its lab groups (A1/A2 …
            // D1/D2) always renders, even with zero members, so the full
            // structure stays visible like the department list.
            const bySec = {};
            members.forEach((m) => {
              const sec = m.section || 'Other';
              (bySec[sec] = bySec[sec] || []).push(m);
            });
            const splitLabs = (secMembers) => {
              const byLab = {};
              const loose = [];
              secMembers.forEach((m) => {
                if (m.labSection) (byLab[m.labSection] = byLab[m.labSection] || []).push(m);
                else loose.push(m);
              });
              return { byLab, loose };
            };
            const sections = ALL_SECTIONS.map((secKey) => {
              const secMembers = bySec[secKey] || [];
              const { byLab, loose } = splitLabs(secMembers);
              // Canonical lab groups first (in A1/A2 order), then any extra labs
              // that exist in the data but aren't in the canonical list.
              const canonical = (LABS_BY_SECTION[secKey] || []).map((lab) => ({ key: lab, members: byLab[lab] || [] }));
              const extra = Object.entries(byLab)
                .filter(([lab]) => !(LABS_BY_SECTION[secKey] || []).includes(lab))
                .map(([lab, labMembers]) => ({ key: lab, members: labMembers }))
                .sort((a, b) => (a.key === 'Other' ? 1 : 0) - (b.key === 'Other' ? 1 : 0) || a.key.localeCompare(b.key, undefined, { numeric: true }));
              return { key: secKey, count: secMembers.length, labs: [...canonical, ...extra], loose };
            });
            // Sections present in the data but outside the canonical list (e.g. 'Other').
            Object.entries(bySec).forEach(([secKey, secMembers]) => {
              if (ALL_SECTIONS.includes(secKey)) return;
              const { byLab, loose } = splitLabs(secMembers);
              sections.push({ key: secKey, count: secMembers.length, labs: toGroups(byLab), loose });
            });
            sections.sort((a, b) => {
              const ia = ALL_SECTIONS.indexOf(a.key);
              const ib = ALL_SECTIONS.indexOf(b.key);
              if (ia !== -1 && ib !== -1) return ia - ib;
              if (ia !== -1) return -1;
              if (ib !== -1) return 1;
              return (a.key === 'Other' ? 1 : 0) - (b.key === 'Other' ? 1 : 0) || a.key.localeCompare(b.key);
            });
            return { sem, sections };
          });
        return { dept, semesters, count: list.length };
      });
    const memberedSet = new Set(membered.map((g) => g.dept));
    const empty = ALL_DEPARTMENTS
      .filter((d) => !memberedSet.has(d))
      .map((d) => ({ dept: d, semesters: [], count: 0 }));
    return [...membered, ...empty].map(({ dept, semesters, count }) => ({
      key: `dept-${dept}`,
      title: dept,
      icon: <BookOpen size={13} />,
      count,
      semesters,
    }));
  }, [filtered]);

  const openPopover = (member, key) => {
    const el = rowRefs.current[key];
    if (el) {
      const r = el.getBoundingClientRect();
      setPopover({ member, rect: { left: r.left, right: r.right, top: r.top } });
    }
  };

  // Dev quick-login — the server sets the auth cookie for the target user,
  // then we hydrate the session locally with the returned user object.
  const handleDevSwitch = async (member) => {
    if (!devMode) return;
    setSwitchingId(member.id);
    try {
      const res = await fetch('/api/dev/switch-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ userId: member.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) throw new Error(data.error || 'Switch failed');
      loginDirect(data.user);
      setDevMode(false);
      setPopover(null);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to switch account.');
    } finally {
      setSwitchingId(null);
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
            {showDevTools && (
              <button
                type="button"
                className={`am-icon-btn am-dev-btn${devMode ? ' active' : ''}`}
                onClick={() => { setDevMode((v) => !v); setPopover(null); }}
                aria-label="Dev quick-login mode"
                title={devMode ? 'Turn off dev quick-login' : 'Dev: quick-login as any member'}
              >
                <UserCog size={15} />
              </button>
            )}
            {!isDesktop && (
              <button type="button" className="am-icon-btn" onClick={onClose} aria-label="Close members panel">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Dev mode hint */}
        {devMode && (
          <div className="am-dev-banner">
            <Zap size={12} />
            <span>Dev mode: click any member to log in as them</span>
          </div>
        )}

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
                      <MemberRow
                        member={m}
                        isOffline={m.status === 'offline'}
                        isAdmin
                        devSwitch={devMode}
                        switching={switchingId === m.id}
                        onClick={devMode ? () => handleDevSwitch(m) : () => openPopover(m, `adm-${m.id}`)}
                      />
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
                    count={g.count}
                    collapsed={collapsed}
                    onToggle={() => toggleGroup(key)}
                  >
                    {g.count === 0 ? (
                      <div className="am-group-empty">No members yet</div>
                    ) : g.semesters.map((s) => {
                      const semKey = `${key}-sem-${s.sem}`;
                      const semTotal = s.sections.reduce((n, x) => n + x.count, 0);
                      return (
                      <MemberGroup
                        key={semKey}
                        title={s.sem === 'Other' ? 'Other' : `Semester ${s.sem}`}
                        count={semTotal}
                        collapsed={collapsedGroups[semKey]}
                        onToggle={() => toggleGroup(semKey)}
                        className="am-sem-group"
                      >
                        {s.sections.map((sec) => {
                          const secKey = `${semKey}-sec-${sec.key}`;
                          return (
                            <MemberGroup
                              key={secKey}
                              title={sec.key === 'Other' ? 'Other' : `Sec ${sec.key}`}
                              count={sec.count}
                              collapsed={collapsedGroups[secKey]}
                              onToggle={() => toggleGroup(secKey)}
                              className="am-sec-group"
                            >
                              {sec.count === 0 ? (
                                <div className="am-group-empty">No members yet</div>
                              ) : (
                                <>
                                  {sec.labs.map((lab) => {
                                    const labKey = `${secKey}-lab-${lab.key}`;
                                    return (
                                      <MemberGroup
                                        key={labKey}
                                        title={lab.key === 'Other' ? 'Other' : `Lab ${lab.key}`}
                                        count={lab.members.length}
                                        collapsed={collapsedGroups[labKey]}
                                        onToggle={() => toggleGroup(labKey)}
                                        className="am-leaf-group"
                                      >
                                        {lab.members.length === 0 ? (
                                          <div className="am-group-empty">No members yet</div>
                                        ) : lab.members.map((m) => {
                                          const rowKey = `${labKey}-${m.id}`;
                                          return (
                                            <span key={rowKey} ref={(el) => { rowRefs.current[rowKey] = el; }}>
                                              <MemberRow
                                                member={m}
                                                devSwitch={devMode}
                                                switching={switchingId === m.id}
                                                onClick={devMode ? () => handleDevSwitch(m) : () => openPopover(m, rowKey)}
                                              />
                                            </span>
                                          );
                                        })}
                                      </MemberGroup>
                                    );
                                  })}
                                  {sec.loose.map((m) => {
                                    const rowKey = `${secKey}-loose-${m.id}`;
                                    return (
                                      <span key={rowKey} ref={(el) => { rowRefs.current[rowKey] = el; }}>
                                        <MemberRow
                                          member={m}
                                          devSwitch={devMode}
                                          switching={switchingId === m.id}
                                          onClick={devMode ? () => handleDevSwitch(m) : () => openPopover(m, rowKey)}
                                        />
                                      </span>
                                    );
                                  })}
                                </>
                              )}
                            </MemberGroup>
                          );
                        })}
                      </MemberGroup>
                      );
                    })}
                  </MemberGroup>
                );
              })}
            </>
          )}
        </div>

        {/* Collapse button — bottom, like the left sidebar */}
        <div className="am-footer-collapse">
          <button
            type="button"
            className="am-collapse-btn"
            onClick={onToggle}
            aria-label={open ? 'Hide active members' : 'Show active members'}
            title={open ? 'Hide members' : 'Show members'}
          >
            {open ? <ChevronRight size={16} /> : <Users size={16} />}
          </button>
        </div>
      </aside>

      {popover && popover.rect && (
        <MemberPopover member={popover.member} rect={popover.rect} onClose={() => setPopover(null)} />
      )}
    </>
  );
}
