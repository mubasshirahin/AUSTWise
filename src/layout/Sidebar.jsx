import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUnreadCount } from '../utils/messageStorage';

import {
  LayoutDashboard, BarChart3, BookOpen, MapPin, Users, ShoppingBag, Settings, MessageSquare,
  LogIn, Shield, Eye, Megaphone, Utensils,
  Library, FileText, FolderOpen, FileSpreadsheet,
  ChevronLeft, ChevronRight, Crown,
  NotebookPen, Coffee, Mic,
  Zap, Home, Moon, CalendarDays
} from 'lucide-react';
import './Sidebar.css';

// Top nav — primary campus tools.
const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/routine-templates', label: 'Routine Templates', icon: CalendarDays },
  { path: '/daily-life', label: 'Daily Life', icon: Home },
  { path: '/analytics', label: 'Grade Lab', icon: BarChart3 },
  { path: '/campus', label: 'InsideAUST', icon: MapPin },
  { path: '/vault', label: 'Resource Vault', icon: BookOpen },
  { path: '/notebook', label: 'Notebook', icon: NotebookPen },
  { path: '/community', label: 'Community', icon: Users },
  { path: '/messages', label: 'ConnectBox', icon: MessageSquare },
  { path: '/productivity', label: 'Productivity', icon: Zap },
  { path: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
  { path: '/chill-zone', label: 'DownTime', icon: Coffee },
  { path: '/shadow', label: 'Shadow', icon: Moon },
];

// Bottom nav — secondary/utility items, separated by a divider.
const bottomNavItems = [
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/pro', label: 'See Plans', icon: Crown },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(() => (user?.id ? getUnreadCount(user.id) : 0));

  useEffect(() => {
    const interval = setInterval(() => {
      if (user?.id) setUnread(getUnreadCount(user.id));
    }, 2000);
    return () => clearInterval(interval);
  }, [user?.id]);



  let navList = [...navItems];
  let bottomList = [...bottomNavItems];
  if (user?.role === 'admin' || user?.role === 'moderator') {
    // For admin users, show Admin Panel related navigation
    navList = [
      { path: '/admin', label: 'Admin Panel', icon: Shield },
      { path: '/admin/transcript-templates', label: 'Transcript Templates', icon: FileSpreadsheet },
      { path: '/admin/overview', label: 'Overview', icon: Eye },
      { path: '/admin/notice-board', label: 'Notice Board', icon: Megaphone },
      { path: '/admin/canteen', label: 'Canteen', icon: Utensils },
      { path: '/admin/library', label: 'Library', icon: Library },
      { path: '/admin/users', label: 'Users', icon: Users },
      { path: '/admin/applications', label: 'Applications', icon: FileText },
      { path: '/admin/cr-sr-directory', label: 'CR/SR Directory', icon: FolderOpen },
      { path: '/admin/auditorium', label: 'Auditorium', icon: Mic },
      { path: '/messages', label: 'ConnectBox', icon: MessageSquare },
      { path: '/daily-life', label: 'Daily Life', icon: Home },
      { path: '/productivity', label: 'Productivity', icon: Zap },
      { path: '/notebook', label: 'Notebook', icon: NotebookPen },
    ];
    bottomList = [{ path: '/settings', label: 'Settings', icon: Settings }];
  }

  const renderNavItem = (item) => {
    const isPro = item.path === '/pro';
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
        className={({ isActive }) =>
          `${baseClass}${extraClass}${isActive ? ' active' : ''}`
        }
        end={item.path === '/'}
      >
        <div className="nav-icon-wrapper">
          <item.icon size={20} />
          {item.path === '/messages' && unread > 0 && (
            <span className="nav-badge">{unread > 99 ? '99+' : unread}</span>
          )}
        </div>
        {!collapsed && (
          <span className="nav-label">
            {item.label}
            {item.path === '/messages' && unread > 0 && (
              <span className="nav-badge-inline">{unread > 99 ? '99+' : unread}</span>
            )}
          </span>
        )}
        {collapsed && <div className="nav-tooltip">{item.label}</div>}
        {isPro && !collapsed &&
          sparklePositions.map((pos, i) => (
            <span
              key={i}
              className="sparkle"
              style={{
                top: pos.top,
                left: pos.left,
                right: pos.right,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))
        }
      </NavLink>
    );
  };

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
