import { useState } from 'react';
import { Zap, ScrollText, Code2, School, ExternalLink, Flame } from 'lucide-react';
import GliderTabs from '../../components/GliderTabs';
import CheatsheetsPage from '../vault/CheatsheetsPage';
import CPHubPage from '../cp-hub/CPHubPage';
import StudyRoomPage from '../study-room/StudyRoomPage';
import WorkspacePage from '../workspace/WorkspacePage';
import RoastCVPage from '../roast-cv/RoastCVPage';
import './ProductivityPage.css';
import '../../components/PageHero.css';

const TABS = [
  { id: 'study-room',  label: 'Study Time',   icon: School,       color: 'rose',    desc: 'Focus timer'      },
  { id: 'cheatsheets', label: 'Cheat Sheets', icon: ScrollText,   color: 'amber',   desc: 'Quick reference'  },
  { id: 'cp-hub',      label: 'Code Pulse',       icon: Code2,        color: 'cyan',    desc: 'Coding contests'  },
  { id: 'workspace',   label: 'Workspace',    icon: ExternalLink, color: 'emerald', desc: 'Google Classroom' },
  { id: 'roast-cv',    label: 'Roast CV',     icon: Flame,        color: 'rose',    desc: 'CV feedback'      },
];

const STORAGE_KEY = 'productivity-active-tab';

export default function ProductivityPage() {
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'study-room'
  );

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEY, tab);
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
      {/* ── Hero ── */}
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <Zap size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">Productivity</span>
              </h1>
              <p className="page-hero-subtitle">
                Your all-in-one hub — study room, cheat sheets, CP platforms, classroom and CV tools.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Glider Tabs ── */}
      <GliderTabs
        tabs={TABS}
        activeTab={activeTab}
        onChange={handleTabChange}
        variant="dashboard"
        compact
      />

      {/* ── Tab Content ── */}
      <div className="productivity-tab-content" key={activeTab}>
        {renderTab()}
      </div>
    </div>
  );
}
