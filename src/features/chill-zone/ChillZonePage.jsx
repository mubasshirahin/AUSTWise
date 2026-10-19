import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Coffee, LayoutGrid, MessageCircleQuestion, Brain, Gamepad2, Film } from 'lucide-react';
import GliderTabs from '../../components/GliderTabs';
import MastheadAccessControl from '../../components/MastheadAccessControl';
import FeatureAccessGate from '../admin/FeatureAccessGate';
import SidebarPageAccessPanel, { SidebarPageAccessHeader } from '../admin/SidebarPageAccessPanel';
import useTabUrlState from '../../hooks/useTabUrlState';
import useAdminMode from '../../hooks/useAdminMode';
import OrganizingArea from './tabs/OrganizingArea';
import RumourOrReal from './tabs/RumourOrReal';
import Trivia from './tabs/Trivia';
import GamingZone from './tabs/GamingZone';
import MediaTracker from './tabs/MediaTracker';
import './ChillZonePage.css';
import '../../components/PageHero.css';

// All tabs share the single brand accent (gold) — no per-category color rotation.
const TABS = [
  { id: 'organizing',  label: 'Organizing Area',  icon: LayoutGrid,             color: 'amber', desc: 'Plan & organize', accessKey: 'feature:chill-zone:organizing'  },
  { id: 'media',       label: 'Media Tracker',    icon: Film,                   color: 'amber', desc: 'Movies & more', accessKey: 'feature:chill-zone:media'    },
  { id: 'rumour',      label: 'Rumour or Real',   icon: MessageCircleQuestion,  color: 'amber', desc: 'Fact or fiction', accessKey: 'feature:chill-zone:rumour'  },
  { id: 'trivia',      label: 'Trivia',           icon: Brain,                  color: 'amber', desc: 'Test your brain', accessKey: 'feature:chill-zone:trivia'  },
  { id: 'gaming',      label: 'Gaming Zone',      icon: Gamepad2,               color: 'amber', desc: 'Mini games', accessKey: 'feature:chill-zone:gaming'       },
];

const STORAGE_KEY = 'chill-zone-active-tab';

export default function ChillZonePage() {
  const { isAdmin } = useAdminMode();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    () => searchParams.get('tab') || localStorage.getItem(STORAGE_KEY) || 'organizing'
  );

  const handleTabChange = useTabUrlState({
    storageKey: STORAGE_KEY,
    defaultValue: 'organizing',
    onChange: setActiveTab,
  });

  const renderTab = () => {
    switch (activeTab) {
      case 'organizing': return <OrganizingArea />;
      case 'media':      return <MediaTracker />;
      case 'rumour':     return <RumourOrReal />;
      case 'trivia':     return <Trivia />;
      case 'gaming':     return <GamingZone />;
      default:           return <OrganizingArea />;
    }
  };

  return (
    <div className="chill-page animate-fadeIn">

      {/* ── 1. Hero box (own card) ── */}
      {isAdmin ? <SidebarPageAccessHeader pageKey="/chill-zone" /> : <header className="cz-hero">
        <div className="cz-hero-content">
          <div className="cz-hero-eyebrow">
            <span className="cz-hero-period-icon">
              <Coffee size={16} />
            </span>
            <span className="cz-hero-date-label">
              Take a break
            </span>
          </div>
          <h1 className="cz-hero-title">
            Down<span className="cz-hero-name">Time</span>
          </h1>
          <p className="cz-hero-subtitle">
            Organize, debate rumours, test trivia, and game with fellow AUSTians.
          </p>
        </div>
      </header>}

      {/* ── 2. Glider tabs bar (own card) ── */}
      {isAdmin && <SidebarPageAccessPanel pageKey="/chill-zone" part="parent" />}
      <div className="glass-card-static cz-tabs-card">
        <GliderTabs
          tabs={TABS}
          activeTab={activeTab}
          onChange={handleTabChange}
          variant="dashboard"
          compact
        />
      </div>

      {/* ── 3. Main content box (own card, gated by per-tab featureHidden) ── */}
      {isAdmin ? <SidebarPageAccessPanel pageKey="/chill-zone" featureKey={`feature:chill-zone:${activeTab}`} part="child" /> : <MastheadAccessControl>
        <div className="cz-content-card" key={activeTab}>
          <div className="chill-tab-content">
            <FeatureAccessGate featureKey={`feature:chill-zone:${activeTab}`}>
              {renderTab()}
            </FeatureAccessGate>
          </div>
        </div>
      </MastheadAccessControl>}
    </div>
  );
}
