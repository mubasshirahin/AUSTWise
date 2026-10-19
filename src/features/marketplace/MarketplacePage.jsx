import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShoppingBag, Home, Search } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import ExchangeKits from './ExchangeKits';
import ToLetListings from './ToLetListings';
import LostAndFound from './LostAndFound';
import GliderTabs from '../../components/GliderTabs';
import MastheadAccessControl from '../../components/MastheadAccessControl';
import FeatureAccessGate from '../admin/FeatureAccessGate';
import SidebarPageAccessPanel, { SidebarPageAccessHeader } from '../admin/SidebarPageAccessPanel';
import useTabUrlState from '../../hooks/useTabUrlState';
import useAdminMode from '../../hooks/useAdminMode';
import MarketplaceMasthead from './MarketplaceMasthead';
import './MarketplacePage.css';
import '../../components/PageHero.css';

const MARKETPLACE_TAB_KEY = 'aust-marketplace-active-tab';

const marketplaceTabs = [
  { id: 'exchange', label: 'AW Market', icon: ShoppingBag, color: 'amber', desc: 'Trade books & equipment', accessKey: 'feature:marketplace:exchange' },
  { id: 'tolet', label: 'ToLet Mama', icon: Home, color: 'amber', desc: 'Bachelor sharing hosts', accessKey: 'feature:marketplace:tolet' },
  { id: 'lost', label: 'Lost & Found', icon: Search, color: 'amber', desc: 'Locate lost products', accessKey: 'feature:marketplace:lost' },
];

export default function MarketplacePage() {
  const { theme } = useTheme();
  const { isAdmin } = useAdminMode();
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
    <div className={`marketplace-page animate-fadeIn${isNewsprint && !isAdmin ? ' marketplace-newsprint' : ''}`}>
      {isNewsprint && !isAdmin ? (
        <>
          <MarketplaceMasthead />
          <MastheadAccessControl>
            <div className="marketplace-content-area">
              <FeatureAccessGate featureKey={`feature:marketplace:${activeTab}`}>
                {renderActiveTab()}
              </FeatureAccessGate>
            </div>
          </MastheadAccessControl>
        </>
      ) : (
        <>
          {/* ── 1. Hero box (own card) ── */}
          {isAdmin ? <SidebarPageAccessHeader pageKey="/marketplace" /> : <header className="mp-hero">
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
          </header>}

          {/* ── 2. Glider tabs bar (own card) ── */}
          {isAdmin && <SidebarPageAccessPanel pageKey="/marketplace" part="parent" />}
          <div className="glass-card-static mp-tabs-card">
            <GliderTabs
              tabs={marketplaceTabs}
              activeTab={activeTab}
              onChange={handleTabChange}
              variant="dashboard"
              compact
            />
          </div>

          {/* ── 3. Main content box (own card, gated by per-tab featureHidden) ── */}
          {isAdmin ? <SidebarPageAccessPanel pageKey="/marketplace" featureKey={`feature:marketplace:${activeTab}`} part="child" /> : <MastheadAccessControl>
            <div className="mp-content-card" key={activeTab}>
              <div className="marketplace-content-area">
                <FeatureAccessGate featureKey={`feature:marketplace:${activeTab}`}>
                  {renderActiveTab()}
                </FeatureAccessGate>
              </div>
            </div>
          </MastheadAccessControl>}
        </>
      )}
    </div>
  );
}
