import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUnreadCount } from '../utils/messageStorage';
import { prefetchRoute } from '../utils/routePrefetch';
import { useRoleAccessMap, pageAccessKey } from '../hooks/useRoleAccess';
import { getAccessRole } from '../utils/accessRole';

import {
  LayoutDashboard, BarChart3, BookOpen, MapPin, Users, ShoppingBag, Settings, MessageSquare,
  LogIn, Shield,
  ChevronLeft, ChevronRight, Crown,
  NotebookPen, Coffee,
  Zap, Home, Moon, FileSearch
} from 'lucide-react';
import './Sidebar.css';

// Top nav — primary campus tools.
const navItems = [
  { path: '/dashboard/quickstats', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/daily-life', label: 'Daily Life', icon: Home },
  { path: '/gradelab', label: 'GradeLab', icon: BarChart3 },
  { path: '/insideaust', label: 'InsideAUST', icon: MapPin },
  { path: '/resource-vault', label: 'Resource Vault', icon: BookOpen },
  { path: '/notebook', label: 'Notebook', icon: NotebookPen },
  { path: '/question-bank', label: 'Question Bank', icon: FileSearch },
  { path: '/community', label: 'Community', icon: Users },
  { path: '/connectbox', label: 'ConnectBox', icon: MessageSquare },
  { path: '/productivity', label: 'Productivity', icon: Zap },
  { path: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
  { path: '/downtime', label: 'DownTime', icon: Coffee },
  { path: '/shadow', label: 'Shadow', icon: Moon },
];

// Bottom nav — secondary/utility items, separated by a divider.
const bottomNavItems = [
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/see-plans', label: 'See Plans', icon: Crown },
];

function RoleAwareNavItem({ item, collapsed, unread }) {
  const isPro = item.path === '/see-plans';
  const baseClass = `nav-item ${collapsed ? 'collapsed' : ''}`;
  const extraClass = isPro ? ' nav-item-premium' : '';
  const sparklePositions = [
    { top: '10%', left: '-8px' },
    { top: '30%', right: '-6px' },
    { top: '70%', left: '-10px' },
    { top: '50%', right: '-8px' },
    { top: '85%', right: '-5px' },
  ];

  return (
    <NavLink
      key={item.path}
      to={item.path}
      className={({ isActive }) => `${baseClass}${extraClass}${(isActive || (item.label === 'Dashboard' && window.location.pathname.startsWith('/dashboard/'))) ? ' active' : ''}`}
      end={false}
      onMouseEnter={() => prefetchRoute(item.path)}
      onFocus={() => prefetchRoute(item.path)}
    >
      <div className="nav-icon-wrapper">
        <item.icon size={20} />
        {item.path === '/connectbox' && unread > 0 && (
          <span className="nav-badge">{unread > 99 ? '99+' : unread}</span>
        )}
      </div>
      {!collapsed && (
        <span className="nav-label">
          {item.label}
          {item.path === '/connectbox' && unread > 0 && (
            <span className="nav-badge-inline">{unread > 99 ? '99+' : unread}</span>
          )}
        </span>
      )}
      {collapsed && <div className="nav-tooltip">{item.label}</div>}
      {isPro && !collapsed && sparklePositions.map((pos, i) => (
        <span key={i} className="sparkle" style={{ ...pos, animationDelay: `${i * 0.3}s` }} />
      ))}
    </NavLink>
  );
}

export default function Sidebar({ collapsed, onToggle }) {
  const { user, isAuthenticated, hasRole } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(() => (user?.id ? getUnreadCount(user.id) : 0));
  // Every page's access rule in one request, kept live: when an admin blocks a
  // role for a page, that page's link vanishes from the sidebar for that role —
  // no "you don't have access" dead end to click into.
  const accessMap = useRoleAccessMap();
  const accessRole = getAccessRole(user);
  const isStaff = hasRole?.('admin') || hasRole?.('moderator');
  const isBlocked = (path) => {
    if (isStaff) return false; // admins & moderators are never blocked (safety)
    const cfg = accessMap?.[pageAccessKey(path)];
    return !!cfg && (cfg.featureHidden || []).includes(accessRole);
  };

  useEffect(() => {
    const refresh = () => { if (user?.id) setUnread(getUnreadCount(user.id)); };
    const interval = setInterval(() => {
      // An invisible tab doesn't need a live badge — skip the localStorage
      // parse. Refreshed immediately on focus/visibility below instead.
      if (document.hidden) return;
      refresh();
    }, 2000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [user?.id]);



  let navList = [...navItems];
  let bottomList = [...bottomNavItems];
  if (user?.role === 'admin' || user?.role === 'moderator') {
    // For admin users, show the Admin Panel plus the normal student links.
    navList = [
      { path: '/admin-panel/overview', label: 'Admin Panel', icon: Shield },
      ...navItems,
    ];
    bottomList = [{ path: '/settings', label: 'Settings', icon: Settings }];
  }

  // Drop links the viewer's role is not allowed to open. Staff are exempt and
  // `isBlocked` already returns false for unknown/uncached pages, so the sidebar
  // never over-hides while the config is still loading.
  navList = navList.filter((item) => !isBlocked(item.path));
  bottomList = bottomList.filter((item) => !isBlocked(item.path));

  const renderNavItem = (item) => (
    <RoleAwareNavItem key={item.path} item={item} collapsed={collapsed} unread={unread} />
  );

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header" />

      <nav className="sidebar-nav">
        {navList.map(renderNavItem)}

        {bottomList.length > 0 && <div className="sidebar-nav-divider" />}

        {bottomList.map(renderNavItem)}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className={`sidebar-collapse-btn${collapsed ? ' collapsed' : ''}`}
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        {!isAuthenticated && (
          <button
            type="button"
            className={`nav-item logout-btn ${collapsed ? 'collapsed' : ''}`}
            onClick={() => navigate('/login')}
            style={{ marginTop: '8px', width: '100%', border: 'none', cursor: 'pointer' }}
          >
            <div className="nav-icon-wrapper">
              <LogIn size={18} />
            </div>
            {!collapsed && <span className="nav-label">Login / Sign up</span>}
            {collapsed && <div className="nav-tooltip">Login / Sign up</div>}
          </button>
        )}
      </div>
    </aside>
  );
}
