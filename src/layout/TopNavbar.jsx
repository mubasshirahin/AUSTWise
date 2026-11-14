import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getDisplayRoles, getRoleDisplayName, getRoleBadgeClass } from '../utils/authStorage';
import { getAcademicLabels, getDisplayBatchText } from '../utils/batchIdentity';
import NavPomodoro from './NavPomodoro';
import {
  Search, Bell, BellRing, Sun, Moon, Newspaper, Terminal, SquareTerminal, Check, User,
  Clock, Hourglass, AlertTriangle, CalendarCheck, Info, CheckCheck, Trash2,
  Settings, LogOut, Gauge, MoonStar, Pen, PenTool, Zap,
  Building2, Type, Grid2x2, Cpu, Users, Orbit, DraftingCompass, Menu, X, LayoutGrid, PanelsTopLeft, LayoutDashboard as BentoIcon,
  Rows3, Sparkles, Leaf, Crown, NotebookPen, Gem, WandSparkles, Coffee, Gamepad2, Cloud, Smile, Flower2 } from 'lucide-react';
import { PRO_LAYOUTS } from '../context/themeConstants';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { useInAppNotifications } from '../hooks/useInAppNotifications';
// import logoSilver from '../assets/logo-silver.png';
// import logoRed from '../assets/logo-red.png';
import brandMark from '../assets/austwise-icon-final.svg';
import './TopNavbar.css';

// ─── Helpers ───

function getNotifIcon(iconName) {
  switch (iconName) {
    case 'BellRing': case 'notice': return BellRing;
    case 'Hourglass': case 'deadline': return Hourglass;
    case 'AlertTriangle': return AlertTriangle;
    case 'CalendarCheck': case 'task': return CalendarCheck;
    case 'Clock': case 'class': return Clock;
    default: return Info;
  }
}

function formatNotifTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// Poster's photo for a notification; falls back to their initial if the
// image is missing or fails to load.
function NotifAvatar({ src, name }) {
  const [failed, setFailed] = useState(false);
  const initial = (String(name || '').trim().charAt(0) || '?').toUpperCase();
  return (
    <div className="notif-item-avatar" title={name || undefined}>
      {src && !failed
        ? <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
        : <span aria-hidden="true">{initial}</span>}
    </div>
  );
}

// Day bucket for grouping the notification list.
function notifGroupLabel(ts) {
  if (!ts) return 'Earlier';
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const t = start.getTime();
  if (ts >= t) return 'Today';
  if (ts >= t - 86400000) return 'Yesterday';
  return 'Earlier';
}

// ─── Constants ───



const darkThemeOptions = [
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'midnight', label: 'Midnight', icon: MoonStar },
  { id: 'nexus', label: 'Nexus', icon: Cpu },
  { id: 'cyberpunk', label: 'Cyberpunk', icon: Terminal },
  { id: 'terminal', label: 'Terminal', icon: SquareTerminal },
  { id: 'bitcoindefi', label: 'Bitcoin DeFi', icon: Zap },
  { id: 'art-deco', label: 'Art Deco', icon: Building2 },
  { id: 'poster', label: 'Bold Type', icon: Type },
  { id: 'meshtopo', label: 'Mesh Topology', icon: Orbit },
  { id: 'blueprint', label: 'Blueprint', icon: DraftingCompass },
  { id: 'obsidian', label: 'Obsidian', icon: Gem },
  { id: 'prism', label: 'Prism', icon: WandSparkles },
  { id: 'lofi', label: 'Lo-fi', icon: Coffee },
  { id: 'arcade', label: 'Arcade', icon: Gamepad2 },
];

// Page layouts — independent of the colour theme (see src/layout/*Layout*.css).
const layoutOptions = [
  { id: 'classic', label: 'Classic', desc: 'Original boxed pages', icon: LayoutGrid, group: 'Essentials' },
  { id: 'studio', label: 'Studio', desc: 'Open heroes, floating tab dock', icon: PanelsTopLeft, group: 'Essentials' },
  { id: 'bento', label: 'Bento', desc: 'Rounded tiles, tab grid', icon: BentoIcon, group: 'Pro' },
  { id: 'compact', label: 'Compact', desc: 'Dense, data-first workspace', icon: Rows3, group: 'Pro' },
  { id: 'aurora', label: 'Aurora', desc: 'Floating glass over ambient light', icon: Sparkles, group: 'Pro' },
  { id: 'zen', label: 'Zen', desc: 'Calm, borderless, airy', icon: Leaf, group: 'Pro' },
  { id: 'luxe', label: 'Luxe', desc: 'Premium · serif, gold hairlines', icon: Gem, group: 'Vibes' },
  { id: 'soft', label: 'Soft', desc: 'Aesthetic · pillowy pastel cards', icon: Cloud, group: 'Vibes' },
  { id: 'motion', label: 'Motion', desc: 'Animated · living gradients', icon: WandSparkles, group: 'Vibes' },
  { id: 'comic', label: 'Comic', desc: 'Cartoon · ink, bubbles, bounce', icon: Smile, group: 'Vibes' },
  { id: 'desk', label: 'Desk', desc: 'Study vibe · notebook paper', icon: NotebookPen, group: 'Vibes' },
  { id: 'manga', label: 'Manga', desc: 'Anime · speed lines, panels', icon: Flower2, group: 'Vibes' },
  { id: 'hud', label: 'HUD', desc: 'Gamer · brackets, scanlines', icon: Gamepad2, group: 'Vibes' },
];

const lightThemeOptions = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'swiss', label: 'Swiss', icon: Grid2x2 },
  { id: 'newsprint', label: 'Newsprint', icon: Newspaper },
  { id: 'sketchbook', label: 'Sketchbook', icon: PenTool },
  { id: 'industrial', label: 'Industrial', icon: Gauge },
  { id: 'minimalist-monochrome', label: 'Monochrome', icon: Pen },
  { id: 'pastel', label: 'Pastel', icon: Cloud },
  { id: 'toon', label: 'Toon', icon: Smile },
  { id: 'sakura', label: 'Sakura', icon: Flower2 },
];

export default function TopNavbar({ onMenuClick, onSearchOpen, membersOpen, onMembersToggle, drawerOpen = false }) {
  const { theme, setTheme, layout, setLayout } = useTheme();
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const layoutSwitcherRef = useRef(null);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState('all'); // 'all' | 'unread'
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const handleAvatarError = useCallback(() => setAvatarError(true), []);
  useEffect(() => { setAvatarError(false); }, [user?.avatar]);
  const [logoClicked, setLogoClicked] = useState(false);


  const toggleLogo = () => {
    setLogoClicked(true);
    setTimeout(() => setLogoClicked(false), 600);
    navigate('/');
  };
  const themeSwitcherRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  const { notifications, unread, markAsRead, markAllAsRead, clearAll } = useInAppNotifications(user);

  const allThemeOptions = [...darkThemeOptions, ...lightThemeOptions];
  const activeTheme = allThemeOptions.find((t) => t.id === theme) || allThemeOptions[0];
  const ThemeIcon = activeTheme.icon;
  const activeLayout = layoutOptions.find((l) => l.id === layout) || layoutOptions[0];
  const ActiveLayoutIcon = activeLayout.icon;
  const wordmarkSrc = brandMark;



  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setThemeMenuOpen(false);
        setLayoutMenuOpen(false);
        setNotifOpen(false);
        setProfileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click-outside closes the menus
  useEffect(() => {
    const handleClick = (e) => {
      if (themeSwitcherRef.current && !themeSwitcherRef.current.contains(e.target)) {
        setThemeMenuOpen(false);
      }
      if (layoutSwitcherRef.current && !layoutSwitcherRef.current.contains(e.target)) {
        setLayoutMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-menu-btn"
          onClick={onMenuClick}
          aria-label={drawerOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={drawerOpen}
          aria-controls="app-sidebar"
        >
          {drawerOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className="topbar-logo">
          <img
            src={wordmarkSrc}
            alt="AUSTWise"
            className={`topbar-wordmark-img ${logoClicked ? 'clicked' : ''}`}
            onClick={toggleLogo}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && toggleLogo()}
            title="AUSTWise"
            aria-label="AUSTWise logo"
          />
          <span className="topbar-brand-name">AUSTWise</span>
          <div className="logo-burst" aria-hidden="true">
            <i></i><i></i><i></i><i></i>
            <i></i><i></i><i></i><i></i>
          </div>

          {/* 
          <div className="logo-text">
            <div className="logo-wordmark">
              <span className="wm-ust">
                <span className="wc">u</span>
                <span className="wc">s</span>
                <span className="wc">t</span>
              </span>
              <span className="wm-ise">
                <span className="wc">i</span>
                <span className="wc">s</span>
                <span className="wc">e</span>
              </span>
            </div>
          </div>
          */}
        </div>


      </div>

      <div className="topbar-mid">
        {/* ── Inline Pomodoro Timer (isolated component) ── */}
        <NavPomodoro />

        <div className="topbar-search" onClick={() => onSearchOpen(true)} role="button" tabIndex={0}>
          <Search size={16} />
          <input
            id="global-search-trigger"
            name="globalSearchTrigger"
            type="text"
            placeholder="Search anything... (⌘K)"
            readOnly
          />
        </div>
        <div
          className={`theme-switcher ${themeMenuOpen ? 'open' : ''}`}
          ref={themeSwitcherRef}
          onMouseLeave={() => setThemeMenuOpen(false)}
        >
          <button
            type="button"
            className="topbar-icon-btn"
            aria-haspopup="menu"
            aria-expanded={themeMenuOpen}
            aria-label={`Theme: ${activeTheme.label}. Choose a theme`}
            onClick={() => setThemeMenuOpen((open) => !open)}
          >
            <div className={`theme-toggle-icon ${theme}`}>
              <ThemeIcon size={18} />
            </div>
          </button>

          <div className="theme-menu" role="menu" aria-label="Select theme">
            <span className="theme-menu-heading">Dark Mode</span>
            {darkThemeOptions.map(({ id, label, icon: Icon }) => {
              const isActive = theme === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  className={`theme-menu-item ${isActive ? 'active' : ''}`}
                  onClick={() => { setTheme(id); setThemeMenuOpen(false); }}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                  {isActive && <Check size={14} className="theme-menu-check" />}
                </button>
              );
            })}

            <div className="theme-menu-divider" />

            <span className="theme-menu-heading">Light Mode</span>
            {lightThemeOptions.map(({ id, label, icon: Icon }) => {
              const isActive = theme === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  className={`theme-menu-item ${isActive ? 'active' : ''}`}
                  onClick={() => { setTheme(id); setThemeMenuOpen(false); }}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                  {isActive && <Check size={14} className="theme-menu-check" />}
                </button>
              );
            })}
          </div>
        </div>
        <div
          className={`theme-switcher layout-switcher ${layoutMenuOpen ? 'open' : ''}`}
          ref={layoutSwitcherRef}
          onMouseLeave={() => setLayoutMenuOpen(false)}
        >
          <button
            type="button"
            className={`topbar-icon-btn layout-toggle-btn${layout !== 'classic' ? ' is-studio' : ''}`}
            aria-haspopup="menu"
            aria-expanded={layoutMenuOpen}
            aria-label={`Layout: ${activeLayout.label}. Choose a layout`}
            title={`Layout: ${activeLayout.label}`}
            onClick={() => setLayoutMenuOpen((open) => !open)}
          >
            <ActiveLayoutIcon size={18} />
            <span className="layout-toggle-label">{activeLayout.label}</span>
          </button>

          <div className="theme-menu layout-menu" role="menu" aria-label="Select layout">
            {layoutOptions.map(({ id, label, desc, icon: Icon, group }, index) => {
              const isActive = layout === id;
              const startsGroup = index === 0 || layoutOptions[index - 1].group !== group;
              return (
                <Fragment key={id}>
                {startsGroup && index > 0 && <div className="theme-menu-divider" />}
                {startsGroup && <span className="theme-menu-heading">{group === 'Essentials' ? 'Layout' : group}</span>}
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  className={`theme-menu-item layout-menu-item ${isActive ? 'active' : ''}`}
                  onClick={() => { setLayout(id); setLayoutMenuOpen(false); }}
                >
                  <Icon size={16} />
                  <span className="layout-menu-text">
                    <span className="layout-menu-name">
                      {label}
                      {PRO_LAYOUTS.includes(id) && <span className="layout-pro-tag"><Crown size={9} /> PRO</span>}
                    </span>
                    <span className="layout-menu-desc">{desc}</span>
                  </span>
                  {isActive && <Check size={14} className="theme-menu-check" />}
                </button>
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <div className="topbar-right">
        {/* Active members toggle — visible for everyone (member list is public) */}
        <button
          type="button"
          className={`topbar-icon-btn am-nav-toggle${membersOpen ? ' am-nav-toggle-active' : ''}`}
          onClick={() => onMembersToggle?.()}
          aria-label={membersOpen ? 'Hide active members' : 'Show active members'}
          aria-pressed={membersOpen}
          title={membersOpen ? 'Hide who\'s online' : 'See who\'s online'}
        >
          <Users size={18} />
        </button>

        <div className="notif-wrapper" ref={notifRef}>
          <button
            className="topbar-icon-btn"
            aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
            onClick={() => setNotifOpen((o) => !o)}
          >
            <span className="notif-bell-icon">
              {unread > 0 ? <BellRing size={18} /> : <Bell size={18} />}
              {unread > 0 && <span className="notification-badge">{unread > 99 ? '99+' : unread}</span>}
            </span>
          </button>

          {notifOpen && (() => {
            const ordered = [...notifications].reverse();
            const filtered = notifFilter === 'unread' ? ordered.filter((n) => !n.read) : ordered;
            const shown = filtered.slice(0, 50);
            const groups = [];
            shown.forEach((n) => {
              const label = notifGroupLabel(n.timestamp);
              const last = groups[groups.length - 1];
              if (last && last.label === label) last.items.push(n);
              else groups.push({ label, items: [n] });
            });
            return (
            <div className="notif-dropdown" role="menu" aria-label="Notifications">
              <div className="notif-header">
                <div className="notif-header-title">
                  <span className="notif-header-tile" aria-hidden="true"><BellRing size={15} /></span>
                  <span className="notif-header-text">
                    <span className="notif-header-name">Notifications</span>
                    <span className="notif-header-sub">
                      {unread > 0 ? `${unread} unread` : 'All caught up'}
                    </span>
                  </span>
                </div>
                <div className="notif-header-actions">
                  {unread > 0 && (
                    <button className="notif-action-btn" onClick={markAllAsRead} title="Mark all as read">
                      <CheckCheck size={14} />
                      <span>Mark all read</span>
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button className="notif-action-btn notif-action-danger" onClick={clearAll} title="Clear all" aria-label="Clear all">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {notifications.length > 0 && (
                <div className="notif-filter" role="tablist" aria-label="Filter notifications">
                  <button
                    role="tab"
                    aria-selected={notifFilter === 'all'}
                    className={`notif-filter-pill${notifFilter === 'all' ? ' is-active' : ''}`}
                    onClick={() => setNotifFilter('all')}
                  >
                    All <span className="notif-filter-count">{notifications.length}</span>
                  </button>
                  <button
                    role="tab"
                    aria-selected={notifFilter === 'unread'}
                    className={`notif-filter-pill${notifFilter === 'unread' ? ' is-active' : ''}`}
                    onClick={() => setNotifFilter('unread')}
                  >
                    Unread <span className="notif-filter-count">{unread}</span>
                  </button>
                </div>
              )}

              <div className="notif-list">
                {shown.length === 0 ? (
                  <div className="notif-empty">
                    <span className="notif-empty-icon"><Bell size={16} /></span>
                    <p className="notif-empty-hint">
                      {notifications.length === 0
                        ? 'No notifications yet — notices, deadlines and updates will show up here.'
                        : 'You’re all caught up — no unread notifications.'}
                    </p>
                  </div>
                ) : groups.map((g) => (
                  <div className="notif-group" key={g.label}>
                    <div className="notif-group-label">{g.label}</div>
                    {g.items.map((n) => {
                      const Icon = getNotifIcon(n.icon || n.type);
                      return (
                        <div
                          key={n.id}
                          className={`notif-item ${n.read ? 'read' : 'unread'} notif-${n.type || 'info'}`}
                          onClick={() => {
                            markAsRead(n.id);
                            setNotifOpen(false);
                            if (n.path) navigate(n.path);
                          }}
                          role="menuitem"
                        >
                          {n.avatar || n.actorName ? (
                            <NotifAvatar src={n.avatar} name={n.actorName} />
                          ) : (
                            <div className="notif-item-icon">
                              <Icon size={15} />
                            </div>
                          )}
                          <div className="notif-item-body">
                            <div className="notif-item-top">
                              <span className="notif-item-title">{n.title}</span>
                              <span className="notif-item-time">{formatNotifTime(n.timestamp)}</span>
                            </div>
                            {n.body && <span className="notif-item-body-text">{n.body}</span>}
                            {n.priority === 'high' && (
                              <span className="notif-item-flag">Important</span>
                            )}
                          </div>
                          {!n.read && <span className="notif-unread-dot" aria-label="Unread" />}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {filtered.length > 50 && (
                <div className="notif-footer">
                  <span>+{filtered.length - 50} older notifications</span>
                </div>
              )}
            </div>
            );
          })()}
        </div>

        {/* User profile */}
        {isAuthenticated ? (
          <div className="profile-wrapper" ref={profileRef}>
            <button
              type="button"
              className={`topbar-profile-btn ${profileMenuOpen ? 'open' : ''}`}
              onClick={() => setProfileMenuOpen((o) => !o)}
              title={`${user.name} · ${getDisplayRoles(user).map(getRoleDisplayName).join(' · ')}`}
              aria-haspopup="true"
              aria-expanded={profileMenuOpen}
            >
              <div className="avatar" style={{ width: 32, height: 32, fontSize: '0.65rem' }}>
                {user?.avatar && !avatarError ? <img src={user.avatar} alt="" onError={handleAvatarError} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : user?.initials}
              </div>
              <div className="profile-info">
                <span className="profile-info-name">{user.name}</span>
                <span className="profile-info-role">{getDisplayRoles(user).map(getRoleDisplayName).join(' · ')}</span>
              </div>
            </button>

            {profileMenuOpen && (
              <div className="profile-dropdown" role="menu" aria-label="User menu">
                <div className="profile-dropdown-header">
                  <div className="avatar" style={{ width: 40, height: 40 }}>
                    {user?.avatar && !avatarError ? <img src={user.avatar} alt="" onError={handleAvatarError} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : user?.initials}
                  </div>
                  <div className="profile-dropdown-info">
                    <span className="profile-dropdown-name">{user.name}</span>
                    <span className="profile-dropdown-email">{user.email || user.id}</span>
                    {user.department && (
                      <span className="profile-dropdown-dept">
                        {user.department}{getDisplayBatchText(user) ? ` • ${getDisplayBatchText(user)}` : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="profile-dropdown-body">
                  {/* Role pills — ALL display roles, same helper as member list/profile */}
                  <div className="profile-role-pills">
                    <div className="profile-pills-label">roles:</div>
                    <div className="profile-role-pills-row">
                      {getDisplayRoles(user).map((role) => (
                        <span key={role} className={`role-pill ${getRoleBadgeClass(role)}`}>
                          {getRoleDisplayName(role)}
                        </span>
                      ))}
                    </div>

                    {/* Academic pills — same labels/order as member popover */}
                    {getAcademicLabels(user, { hideSemester: getDisplayRoles(user).includes('admin') }).length > 0 && (
                      <div className="profile-role-pills-row">
                        {getAcademicLabels(user, { hideSemester: getDisplayRoles(user).includes('admin') }).map((label) => (
                          <span key={label} className="role-pill badge-dept">{label}</span>
                        ))}
                      </div>
                    )}

                  </div>

                  <button
                    type="button"
                    className="profile-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      navigate('/settings');
                    }}
                  >
                    <Settings size={16} />
                    <span>Edit Profile</span>
                  </button>

                  <div className="profile-dropdown-divider" />

                  <button
                    type="button"
                    className="profile-dropdown-item profile-dropdown-danger"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      logout();
                    }}
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="topbar-icon-btn"
            onClick={() => navigate('/login')}
            aria-label="Login"
          >
            <User size={18} />
          </button>
        )}
      </div>

    </header>
  );
}
