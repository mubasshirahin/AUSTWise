import { useState } from 'react';
import { ShoppingBag, Home, Search } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import ExchangeKits from './ExchangeKits';
import ToLetListings from './ToLetListings';
import LostAndFound from './LostAndFound';
import GliderTabs from '../../components/GliderTabs';
import MarketplaceMasthead from './MarketplaceMasthead';
import './MarketplacePage.css';
import '../../components/PageHero.css';

const MARKETPLACE_TAB_KEY = 'aust-marketplace-active-tab';

const marketplaceTabs = [
  { id: 'exchange', label: 'AW Market', icon: ShoppingBag, color: 'amber', desc: 'Trade books & equipment' },
  { id: 'tolet', label: 'ToLet Mama', icon: Home, color: 'purple', desc: 'Bachelor sharing hosts' },
  { id: 'lost', label: 'Lost & Found', icon: Search, color: 'emerald', desc: 'Locate lost products' },
];

export default function MarketplacePage() {
  const { theme } = useTheme();
  const isNewsprint = theme === 'newsprint';
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(MARKETPLACE_TAB_KEY) || 'exchange';
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem(MARKETPLACE_TAB_KEY, tab);
  };

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
        <MarketplaceMasthead />
      ) : (
        <>
          {/* ─── Dashboard-style Hero Header ─── */}
          <header className="page-hero">
            <div className="page-hero-content">
              <div className="page-hero-title-row">
                <div className="page-hero-icon">
                  <ShoppingBag size={24} />
                </div>
                <div>
                  <h1 className="page-hero-title">
                    <span className="page-hero-title-highlight">Marketplace</span>
                  </h1>
                  <p className="page-hero-subtitle">
                    Trade student equipment/books, find bachelor sharing hosts, locate lost products, and connect study buddies.
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* ─── GliderTabs ─── */}
          <GliderTabs
            tabs={marketplaceTabs}
            activeTab={activeTab}
            onChange={handleTabChange}
            variant="dashboard"
          />

          {/* ─── Section Header ─── */}
          <div className="section-header">
            <h2 className="section-title">
              <span className="icon" style={{ background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>
                <ShoppingBag size={16} />
              </span>
              Browse Listings
            </h2>
          </div>
        </>
      )}

      <div className="marketplace-content-area">
        {renderActiveTab()}
      </div>
    </div>
  );
}
