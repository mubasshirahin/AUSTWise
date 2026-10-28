import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BarChart3, BookOpen, MapPin, Users, ShoppingBag,
  MessageSquare, Settings, Crown, NotebookPen, Coffee, Zap, Moon, Home,
  MoreHorizontal, X, FileSearch,
} from 'lucide-react';
import { prefetchRoute } from '../utils/routePrefetch';
import './MobileNav.css';

// Primary items shown in the fixed bottom bar (most-used campus tools)
const primaryItems = [
  { path: '/dashboard/quickstats', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/gradelab', label: 'GradeLab', icon: BarChart3 },
  { path: '/resource-vault', label: 'Resource Vault', icon: BookOpen },
  { path: '/community', label: 'Social', icon: Users },
  { path: '/connectbox', label: 'Chat', icon: MessageSquare },
];

// Everything else lives in the "More" bottom sheet
const moreSections = [
  {
    title: 'Campus',
    items: [
      { path: '/daily-life', label: 'Daily Life', icon: Home },
      { path: '/insideaust', label: 'InsideAUST', icon: MapPin },
      { path: '/notebook', label: 'Notebook', icon: NotebookPen },
      { path: '/question-bank', label: 'Question Bank', icon: FileSearch },
      { path: '/productivity', label: 'Productivity', icon: Zap },
    ],
  },
  {
    title: 'Extras',
    items: [
      { path: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
      { path: '/downtime', label: 'DownTime', icon: Coffee },
      { path: '/shadow', label: 'Shadow', icon: Moon },
    ],
  },
  {
    title: 'Account',
    items: [
      { path: '/settings', label: 'Settings', icon: Settings },
      { path: '/see-plans', label: 'See Plans', icon: Crown },
    ],
  },
];

function PrimaryMobileLink({ item, onClick }) {
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => `mobile-nav-item ${isActive || (item.label === 'Dashboard' && window.location.pathname.startsWith('/dashboard/')) ? 'active' : ''}`}
      onClick={onClick}
      end={false}
      onMouseEnter={() => prefetchRoute(item.path)}
      onFocus={() => prefetchRoute(item.path)}
    >
      <item.icon size={20} />
      <span>{item.label}</span>
    </NavLink>
  );
}

function MoreMobileLink({ item, isActive, onClick }) {
  return (
    <NavLink
      to={item.path}
      className={`mobile-more-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
      end={item.path === '/'}
      onMouseEnter={() => prefetchRoute(item.path)}
      onFocus={() => prefetchRoute(item.path)}
    >
      <div className="mobile-more-icon"><item.icon size={20} /></div>
      <span>{item.label}</span>
    </NavLink>
  );
}

export default function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const visibleSections = moreSections;

  // Touch devices have no hover, so the sheet's links only exist once it opens.
  // Warm every one of their chunks the moment it opens, so a tap lands on an
  // already-cached chunk instead of paying a full round-trip.
  useEffect(() => {
    if (!moreOpen) return;
    moreSections.forEach((sec) => sec.items.forEach((item) => prefetchRoute(item.path)));
  }, [moreOpen]);

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
          <PrimaryMobileLink key={item.path} item={item} onClick={() => setMoreOpen(false)} />
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
            {visibleSections.map((section) => (
              <div key={section.title} className="mobile-more-section">
                <div className="mobile-more-section-title">{section.title}</div>
                <div className="mobile-more-grid">
                  {section.items.map((item) => {
                    const isActive =
                      item.path === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(item.path);
                    return (
                      <MoreMobileLink
                        key={item.path}
                        item={item}
                        isActive={isActive}
                        onClick={() => setMoreOpen(false)}
                      />
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
