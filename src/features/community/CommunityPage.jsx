import { useState, useEffect, useRef } from 'react';
import {
  Users, GraduationCap, Building2, UserPlus,
  MoreVertical, Check, Shuffle,
} from 'lucide-react';
import GliderTabs from '../../components/GliderTabs';
import AlumniDirectory from './AlumniDirectory';
import ClubPortal from './ClubPortal';
import StudentDirectory from './StudentDirectory';
import MentorRequests from './MentorRequests';
import '../campus/SemesterViewWidget.css';
import './CommunityPage.css';

const COMMUNITY_TAB_KEY = 'aust-community-active-tab';

// Unified theme: every tab uses the single brand accent (amber) so the tab bar
// stays monochrome instead of rotating purple/green/blue per category.
const communityTabs = [
  { id: 'alumni', label: 'Alumni Directory', icon: GraduationCap, color: 'amber', desc: 'Connect with alumni' },
  { id: 'clubs', label: 'Clubs Hub', icon: Building2, color: 'amber', desc: 'Join student clubs' },
  { id: 'students', label: 'Student Directory', icon: Users, color: 'amber', desc: 'Find classmates' },
  { id: 'mentorRequests', label: 'Mentor Requests', icon: UserPlus, color: 'amber', desc: 'Connect study buddies' },
];

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(COMMUNITY_TAB_KEY) || 'alumni';
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the ⋮ dropdown when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const activeMeta = communityTabs.find((t) => t.id === activeTab) || communityTabs[0];

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setMenuOpen(false);
    localStorage.setItem(COMMUNITY_TAB_KEY, tab);
  };

  // Fun little "surprise me" action from the ⋮ menu.
  const surpriseTab = () => {
    const others = communityTabs.filter((t) => t.id !== activeTab);
    handleTabChange(others[Math.floor(Math.random() * others.length)].id);
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'alumni': return <AlumniDirectory />;
      case 'clubs': return <ClubPortal />;
      case 'students': return <StudentDirectory />;
      case 'mentorRequests': return <MentorRequests />;
      default: return <AlumniDirectory />;
    }
  };

  return (
    <div className="community-page animate-fadeIn">

      {/* ── 1. Hero box (own card) ── */}
      <header className="cm-hero">
        <div className="cm-hero-content">
          <div className="cm-hero-eyebrow">
            <span className="cm-hero-period-icon">
              <Users size={16} />
            </span>
            <span className="cm-hero-date-label">
              Inside AUST
            </span>
          </div>
          <h1 className="cm-hero-title">
            Communit<span className="cm-hero-name">y</span>
          </h1>
          <p className="cm-hero-subtitle">
            {activeMeta.desc} · connect with alumni, clubs, classmates and mentors.
          </p>
        </div>
      </header>

      {/* ── 2. Glider tabs bar (own card) ── */}
      <div className="glass-card-static cm-tabs-card">
        <div className="cm-tabs-row">
          <GliderTabs
            tabs={communityTabs}
            activeTab={activeTab}
            onChange={handleTabChange}
            variant="dashboard"
            compact
          />
          <div className="export-dropdown" ref={menuRef}>
            <button
              type="button"
              className="schedule-nav-btn cm-more-btn"
              onClick={() => setMenuOpen((o) => !o)}
              title="Options"
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div className="export-menu" role="menu">
                {communityTabs.map((tab) => {
                  const TabIcon = tab.icon;
                  const isActive = tab.id === activeTab;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={`export-menu-item${isActive ? ' menu-active' : ''}`}
                      onClick={() => handleTabChange(tab.id)}
                      role="menuitem"
                    >
                      <TabIcon size={14} /> {tab.label}
                      {isActive && <Check size={14} className="menu-check" />}
                    </button>
                  );
                })}
                <div className="export-menu-sep" />
                <button
                  type="button"
                  className="export-menu-item"
                  onClick={surpriseTab}
                  role="menuitem"
                >
                  <Shuffle size={14} /> Surprise me
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Main content box (own card) ── */}
      <div className="cm-content-card" key={activeTab}>
        <div className="community-content-area">
          {renderActiveTab()}
        </div>
      </div>
    </div>
  );
}
