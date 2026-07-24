import { useState } from 'react';
import { Coffee, LayoutGrid, MessageCircleQuestion, Brain, Gamepad2 } from 'lucide-react';
import GliderTabs from '../../components/GliderTabs';
import OrganizingArea from './tabs/OrganizingArea';
import RumourOrReal from './tabs/RumourOrReal';
import Trivia from './tabs/Trivia';
import GamingZone from './tabs/GamingZone';
import './ChillZonePage.css';
import '../../components/PageHero.css';

const TABS = [
  { id: 'organizing',  label: 'Organizing Area',  icon: LayoutGrid,             color: 'blue',   desc: 'Plan & organize'  },
  { id: 'rumour',      label: 'Rumour or Real',   icon: MessageCircleQuestion,  color: 'rose',   desc: 'Fact or fiction'  },
  { id: 'trivia',      label: 'Trivia',           icon: Brain,                  color: 'purple', desc: 'Test your brain'  },
  { id: 'gaming',      label: 'Gaming Zone',      icon: Gamepad2,               color: 'emerald',desc: 'Mini games'       },
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
      case 'rumour':     return <RumourOrReal />;
      case 'trivia':     return <Trivia />;
      case 'gaming':     return <GamingZone />;
      default:           return <OrganizingArea />;
    }
  };

  return (
    <div className="chill-page animate-fadeIn">
      {/* ── Hero ── */}
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <Coffee size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">DownTime</span>
              </h1>
              <p className="page-hero-subtitle">
                Take a break — organize, debate rumours, test trivia, and game with fellow AUSTians.
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
        variant="chillzone"
        compact
      />

      {/* ── Tab Content ── */}
      <div className="chill-tab-content" key={activeTab}>
        {renderTab()}
      </div>
    </div>
  );
}
