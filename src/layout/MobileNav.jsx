import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BarChart3, BookOpen, MapPin, Users, ShoppingBag,
  MessageSquare, Settings, Crown, NotebookPen, Coffee, Zap, Moon, Home,
  MoreHorizontal, X,
} from 'lucide-react';
import './MobileNav.css';

// Primary items shown in the fixed bottom bar (most-used campus tools)
const primaryItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/analytics', label: 'Grades', icon: BarChart3 },
  { path: '/vault', label: 'Vault', icon: BookOpen },
  { path: '/community', label: 'Social', icon: Users },
  { path: '/messages', label: 'Chat', icon: MessageSquare },
];

// Everything else lives in the "More" bottom sheet
const moreSections = [
  {
    title: 'Campus',
    items: [
      { path: '/daily-life', label: 'Daily Life', icon: Home },
      { path: '/campus', label: 'InsideAUST', icon: MapPin },
      { path: '/notebook', label: 'Notebook', icon: NotebookPen },
      { path: '/productivity', label: 'Productivity', icon: Zap },
    ],
  },
  {
    title: 'Extras',
    items: [
      { path: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
      { path: '/chill-zone', label: 'DownTime', icon: Coffee },
      { path: '/shadow', label: 'Shadow', icon: Moon },
    ],
  },
  {
    title: 'Account',
    items: [
      { path: '/settings', label: 'Settings', icon: Settings },
      { path: '/pro', label: 'See Plans', icon: Crown },
    ],
  },
];

export default function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  // Check if any "more" item is currently active → highlight the More button
  const isMoreActive = moreSections.some((sec) =>
    sec.items.some((item) =>
      item.path === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(item.path)
    )
  );

  return (
    <>
      <nav className="mobile-nav hide-desktop">
        {primaryItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
            end={item.path === '/'}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`mobile-nav-item mobile-nav-more ${moreOpen || isMoreActive ? 'active' : ''}`}
          onClick={() => setMoreOpen(true)}
        >
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>

      {/* More bottom sheet */}
      <div className={`mobile-more-sheet ${moreOpen ? 'open' : ''}`}>
        <div className="mobile-more-backdrop" onClick={() => setMoreOpen(false)} />
        <div className="mobile-more-panel">
          <div className="mobile-more-header">
            <span className="mobile-more-title">All Sections</span>
            <button
              type="button"
              className="mobile-more-close"
              onClick={() => setMoreOpen(false)}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
          <div className="mobile-more-body">
            {moreSections.map((section) => (
              <div key={section.title} className="mobile-more-section">
                <div className="mobile-more-section-title">{section.title}</div>
                <div className="mobile-more-grid">
                  {section.items.map((item) => {
                    const isActive =
                      item.path === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(item.path);
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={`mobile-more-item ${isActive ? 'active' : ''}`}
                        onClick={() => setMoreOpen(false)}
                        end={item.path === '/'}
                      >
                        <div className="mobile-more-icon">
                          <item.icon size={20} />
                        </div>
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
