import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Zap, ScrollText, Code2, School, ExternalLink } from 'lucide-react';
import GliderTabs from '../../components/GliderTabs';
import useTabUrlState from '../../hooks/useTabUrlState';
import CheatsheetsPage from '../vault/CheatsheetsPage';
import CPHubPage from '../cp-hub/CPHubPage';
import StudyRoomPage from '../study-room/StudyRoomPage';
import WorkspacePage from '../workspace/WorkspacePage';
import './ProductivityPage.css';

// All tools share the single brand accent (gold) — no per-category color rotation.
const TABS = [
  { id: 'study-room',  label: 'Study Time',   icon: School,       desc: 'Focus timer'      },
  { id: 'cheatsheets', label: 'Cheat Sheets', icon: ScrollText,   desc: 'Quick reference'  },
  { id: 'cp-hub',      label: 'Code Pulse',   icon: Code2,        desc: 'Coding contests'  },
  { id: 'workspace',   label: 'Workspace',    icon: ExternalLink, desc: 'Google Classroom' },
];

const STORAGE_KEY = 'productivity-active-tab';

export default function ProductivityPage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    () => searchParams.get('tab') || localStorage.getItem(STORAGE_KEY) || 'study-room'
  );
  const handleTabChange = useTabUrlState({
    storageKey: STORAGE_KEY,
    defaultValue: 'study-room',
    onChange: setActiveTab,
  });

  const renderTab = () => {
    switch (activeTab) {
      case 'study-room':  return <StudyRoomPage />;
      case 'cheatsheets': return <CheatsheetsPage />;
      case 'cp-hub':      return <CPHubPage />;
      case 'workspace':   return <WorkspacePage />;
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
