import { useState, useEffect, useRef } from 'react';
import { Zap, ScrollText, Code2, School, ExternalLink, Flame, MoreVertical, Check } from 'lucide-react';
import GliderTabs from '../../components/GliderTabs';
import CheatsheetsPage from '../vault/CheatsheetsPage';
import CPHubPage from '../cp-hub/CPHubPage';
import StudyRoomPage from '../study-room/StudyRoomPage';
import WorkspacePage from '../workspace/WorkspacePage';
import RoastCVPage from '../roast-cv/RoastCVPage';
import './ProductivityPage.css';

// All tools share the single brand accent (gold) — no per-category color rotation.
const TABS = [
  { id: 'study-room',  label: 'Study Time',   icon: School,       desc: 'Focus timer'      },
  { id: 'cheatsheets', label: 'Cheat Sheets', icon: ScrollText,   desc: 'Quick reference'  },
  { id: 'cp-hub',      label: 'Code Pulse',   icon: Code2,        desc: 'Coding contests'  },
  { id: 'workspace',   label: 'Workspace',    icon: ExternalLink, desc: 'Google Classroom' },
  { id: 'roast-cv',    label: 'Roast CV',     icon: Flame,        desc: 'CV feedback'      },
];

const STORAGE_KEY = 'productivity-active-tab';

export default function ProductivityPage() {
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'study-room'
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the ⋮ menu on outside click.
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEY, tab);
  };

  const selectTool = (tab) => {
    handleTabChange(tab);
    setMenuOpen(false);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'study-room':  return <StudyRoomPage />;
      case 'cheatsheets': return <CheatsheetsPage />;
      case 'cp-hub':      return <CPHubPage />;
      case 'workspace':   return <WorkspacePage />;
      case 'roast-cv':    return <RoastCVPage />;
      default:            return <StudyRoomPage />;
    }
  };

  return (
    <div className="productivity-page animate-fadeIn">

      {/* ── 1. Hero box (own card) ── */}
      <header className="pr-hero">
        <div className="pr-hero-content">
          <div className="pr-hero-eyebrow">
            <span className="pr-hero-period-icon">
              <Zap size={16} />
            </span>
            <span className="pr-hero-date-label">
              Tools &amp; Focus
            </span>
          </div>
          <h1 className="pr-hero-title">
            Productivit<span className="pr-hero-name">y</span>
          </h1>
          <p className="pr-hero-subtitle">
            Study room, cheat sheets, CP platforms, classroom &amp; CV tools.
          </p>
        </div>
      </header>

      {/* ── 2. Glider tabs bar (own card) ── */}
      <div className="glass-card-static pr-tabs-card">
        <div className="pr-tabs-row">
          <GliderTabs
            tabs={TABS}
            activeTab={activeTab}
            onChange={handleTabChange}
            variant="dashboard"
            compact
          />
          <div className="export-dropdown" ref={menuRef}>
            <button className="schedule-nav-btn pr-more-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="More options" aria-haspopup="true">
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div className="export-menu">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  const isActive = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      className={`export-menu-item${isActive ? ' menu-active' : ''}`}
                      onClick={() => selectTool(t.id)}
                    >
                      <Icon size={14} /> {t.label}
                      {isActive && <Check size={14} className="menu-check" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Main content box (own card) ── */}
      <div className="pr-content-card" key={activeTab}>
        <div className="productivity-tab-content">
          {renderTab()}
        </div>
      </div>
    </div>
  );
}
