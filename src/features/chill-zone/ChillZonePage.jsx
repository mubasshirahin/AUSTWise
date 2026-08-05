import { useState } from 'react';
import { Coffee, LayoutGrid, MessageCircleQuestion, Brain, Gamepad2, Film } from 'lucide-react';
import GliderTabs from '../../components/GliderTabs';
import OrganizingArea from './tabs/OrganizingArea';
import RumourOrReal from './tabs/RumourOrReal';
import Trivia from './tabs/Trivia';
import GamingZone from './tabs/GamingZone';
import MediaTracker from './tabs/MediaTracker';
import './ChillZonePage.css';
import '../../components/PageHero.css';

// All tabs share the single brand accent (gold) — no per-category color rotation.
const TABS = [
  { id: 'organizing',  label: 'Organizing Area',  icon: LayoutGrid,             color: 'amber', desc: 'Plan & organize'  },
  { id: 'media',       label: 'Media Tracker',    icon: Film,                   color: 'amber', desc: 'Movies & more'    },
  { id: 'rumour',      label: 'Rumour or Real',   icon: MessageCircleQuestion,  color: 'amber', desc: 'Fact or fiction'  },
  { id: 'trivia',      label: 'Trivia',           icon: Brain,                  color: 'amber', desc: 'Test your brain'  },
  { id: 'gaming',      label: 'Gaming Zone',      icon: Gamepad2,               color: 'amber', desc: 'Mini games'       },
];

const STORAGE_KEY = 'chill-zone-active-tab';

export default function ChillZonePage() {
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'organizing'
  );

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEY, tab);
  };

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
      <header className="cz-hero">
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
      </header>

      {/* ── 2. Glider tabs bar (own card) ── */}
      <div className="glass-card-static cz-tabs-card">
        <GliderTabs
          tabs={TABS}
          activeTab={activeTab}
          onChange={handleTabChange}
          variant="dashboard"
          compact
        />
      </div>

      {/* ── 3. Main content box (own card) ── */}
      <div className="cz-content-card" key={activeTab}>
        <div className="chill-tab-content">
          {renderTab()}
        </div>
      </div>
    </div>
  );
}
