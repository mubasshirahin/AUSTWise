import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShoppingBag, Home, Search } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import ExchangeKits from './ExchangeKits';
import ToLetListings from './ToLetListings';
import LostAndFound from './LostAndFound';
import GliderTabs from '../../components/GliderTabs';
import useTabUrlState from '../../hooks/useTabUrlState';
import MarketplaceMasthead from './MarketplaceMasthead';
import './MarketplacePage.css';
import '../../components/PageHero.css';

const MARKETPLACE_TAB_KEY = 'aust-marketplace-active-tab';

const marketplaceTabs = [
  { id: 'exchange', label: 'AW Market', icon: ShoppingBag, color: 'amber', desc: 'Trade books & equipment' },
  { id: 'tolet', label: 'ToLet Mama', icon: Home, color: 'amber', desc: 'Bachelor sharing hosts' },
  { id: 'lost', label: 'Lost & Found', icon: Search, color: 'amber', desc: 'Locate lost products' },
];

export default function MarketplacePage() {
  const { theme } = useTheme();
  const isNewsprint = theme === 'newsprint';
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || localStorage.getItem(MARKETPLACE_TAB_KEY) || 'exchange';
  });

  const handleTabChange = useTabUrlState({
    storageKey: MARKETPLACE_TAB_KEY,
    defaultValue: 'exchange',
    onChange: setActiveTab,
  });

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'exchange': return <ExchangeKits />;
      case 'tolet': return <ToLetListings />;
      case 'lost': return <LostAndFound />;
      default: return <ExchangeKits />;
    }
  };

  return (
    <div className={`marketplace-page animate-fadeIn${isNewsprint ? ' marketplace-newsprint' : ''}`}>
      {isNewsprint ? (
        <>
          <MarketplaceMasthead />
          <div className="marketplace-content-area">
            {renderActiveTab()}
          </div>
        </>
      ) : (
        <>
          {/* ── 1. Hero box (own card) ── */}
          <header className="mp-hero">
            <div className="mp-hero-content">
              <div className="mp-hero-eyebrow">
                <span className="mp-hero-period-icon">
                  <ShoppingBag size={16} />
                </span>
                <span className="mp-hero-date-label">
                  Student marketplace
                </span>
              </div>
              <h1 className="mp-hero-title">
                Market<span className="mp-hero-name">place</span>
              </h1>
              <p className="mp-hero-subtitle">
                Trade equipment &amp; books, find bachelor sharing hosts, locate lost products, and connect study buddies.
              </p>
            </div>
          </header>

          {/* ── 2. Glider tabs bar (own card) ── */}
          <div className="glass-card-static mp-tabs-card">
            <GliderTabs
              tabs={marketplaceTabs}
              activeTab={activeTab}
              onChange={handleTabChange}
              variant="dashboard"
              compact
            />
          </div>

          {/* ── 3. Main content box (own card) ── */}
          <div className="mp-content-card" key={activeTab}>
            <div className="marketplace-content-area">
              {renderActiveTab()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
