import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Zap, ScrollText, Code2, School, ExternalLink } from 'lucide-react';
import GliderTabs from '../../components/GliderTabs';
import MastheadAccessControl from '../../components/MastheadAccessControl';
import FeatureAccessGate from '../admin/FeatureAccessGate';
import SidebarPageAccessPanel, { SidebarPageAccessHeader } from '../admin/SidebarPageAccessPanel';
import useTabUrlState from '../../hooks/useTabUrlState';
import useAdminMode from '../../hooks/useAdminMode';
import CheatsheetsPage from '../vault/CheatsheetsPage';
import CPHubPage from '../cp-hub/CPHubPage';
import StudyRoomPage from '../study-room/StudyRoomPage';
import WorkspacePage from '../workspace/WorkspacePage';
import '../daily-life/DailyMasthead.css';
import './ProductivityPage.css';

// All tools share the single brand accent (gold) — no per-category color rotation.
const TABS = [
  { id: 'study-room',  label: 'Study Time',   icon: School,       desc: 'Focus timer', accessKey: 'feature:productivity:study-room'      },
  { id: 'cheatsheets', label: 'Cheat Sheets', icon: ScrollText,   desc: 'Quick reference', accessKey: 'feature:productivity:cheatsheets'  },
  { id: 'cp-hub',      label: 'Code Pulse',   icon: Code2,        desc: 'Coding contests', accessKey: 'feature:productivity:cp-hub'  },
  { id: 'workspace',   label: 'Workspace',    icon: ExternalLink, desc: 'Google Classroom', accessKey: 'feature:productivity:workspace' },
];

const STORAGE_KEY = 'productivity-active-tab';

export default function ProductivityPage() {
  const { isAdmin } = useAdminMode();
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
      {isAdmin ? <SidebarPageAccessHeader pageKey="/productivity" /> : <header className="dl-head pr-hub-head">
        <div className="dl-head-title">
          <div className="dl-head-tile" aria-hidden="true"><Zap size={20} strokeWidth={2.1} /></div>
          <div className="dl-head-text">
            <span className="dl-head-overline">Tools &amp; Focus</span>
            <h1 className="dl-head-name">Productivity</h1>
            <span className="dl-head-subtitle">Study room, cheat sheets, CP platforms and classroom tools.</span>
          </div>
        </div>
        <dl className="dl-head-stats">
          <div className="dl-head-stat"><dt>Tools</dt><dd>{TABS.length}</dd></div>
          <div className="dl-head-stat"><dt>Open</dt><dd>{TABS.find((t) => t.id === activeTab)?.label || '—'}</dd></div>
        </dl>
      </header>}

      {/* ── 2. Glider tabs bar (own card) ── */}
      {isAdmin && <SidebarPageAccessPanel pageKey="/productivity" part="parent" />}
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

      {/* ── 3. Main content box (own card, gated by per-tab featureHidden) ── */}
      {isAdmin ? <SidebarPageAccessPanel pageKey="/productivity" featureKey={`feature:productivity:${activeTab}`} part="child" /> : <MastheadAccessControl>
        <div className="pr-content-card" key={activeTab}>
          <div className="productivity-tab-content">
            <FeatureAccessGate featureKey={`feature:productivity:${activeTab}`}>
              {renderTab()}
            </FeatureAccessGate>
          </div>
        </div>
      </MastheadAccessControl>}
    </div>
  );
}
