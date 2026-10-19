import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Map, MapPin, Library, UtensilsCrossed, Bus, DoorOpen } from 'lucide-react';
import InteractiveMap from './InteractiveMap';
import LibraryPulse from './LibraryPulse';
import CanteenMenu from './CanteenMenu';
import BusTracker from './BusTracker';
import EmptyClassroomPage from '../empty-classroom/EmptyClassroomPage';
import GliderTabs from '../../components/GliderTabs';
import MastheadAccessControl from '../../components/MastheadAccessControl';
import FeatureAccessGate from '../admin/FeatureAccessGate';
import SidebarPageAccessPanel, { SidebarPageAccessHeader } from '../admin/SidebarPageAccessPanel';
import useTabUrlState from '../../hooks/useTabUrlState';
import useAdminMode from '../../hooks/useAdminMode';
import './CampusPage.css';
import './campus-tokens.css';

const campusTabs = [
  { id: 'map',       label: 'Floor Map',      icon: MapPin,          color: 'amber', desc: '', accessKey: 'feature:campus:floor-map' },
  { id: 'library',   label: 'Library Pulse',  icon: Library,         color: 'amber', desc: 'Occupancy', accessKey: 'feature:campus:library-pulse' },
  { id: 'canteen',   label: 'Canteen Menu',   icon: UtensilsCrossed, color: 'amber', desc: "Today's menu", accessKey: 'feature:campus:canteen-menu' },
  { id: 'bus',       label: 'Bus Tracker',    icon: Bus,             color: 'amber', desc: 'Shuttle routes', accessKey: 'feature:campus:bus-tracker' },
  { id: 'classroom', label: 'Free Rooms',     icon: DoorOpen,        color: 'amber', desc: 'Find available rooms', accessKey: 'feature:campus:free-rooms' },
];

const CAMPUS_TAB_KEY = 'aust-campus-active-tab';

export default function CampusPage() {
  const { isAdmin } = useAdminMode();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const requestedTab = searchParams.get('tab') || localStorage.getItem(CAMPUS_TAB_KEY) || 'map';
    return requestedTab === 'faculty' ? 'map' : requestedTab;
  });

  const handleTabChange = useTabUrlState({
    storageKey: CAMPUS_TAB_KEY,
    defaultValue: 'map',
    onChange: setActiveTab,
  });

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'map': return <InteractiveMap />;
      case 'library': return <LibraryPulse />;
      case 'canteen': return <CanteenMenu />;
      case 'bus': return <BusTracker />;
      case 'classroom': return <EmptyClassroomPage />;
      default: return <InteractiveMap />;
    }
  };

  return (
    <div className="campus-page animate-fadeIn">

      {/* ── 1. Hero box (own card) ── */}
      {isAdmin ? <SidebarPageAccessHeader pageKey="/campus" /> : <header className="cp-hero">
        <div className="cp-hero-content">
          <div className="cp-hero-eyebrow">
            <span className="cp-hero-period-icon">
              <Map size={16} />
            </span>
            <span className="cp-hero-date-label">
              Campus · live updates
            </span>
          </div>
          <h1 className="cp-hero-title">
            Inside<span className="cp-hero-name">AUST</span>
          </h1>
          <p className="cp-hero-subtitle">
            Navigate buildings, check live canteen &amp; library traffic.
          </p>
        </div>
      </header>}

      {/* ── 2. Glider tabs bar (own card) ── */}
      {isAdmin && <SidebarPageAccessPanel pageKey="/campus" part="parent" />}
      <div className="glass-card-static cp-tabs-card">
        <GliderTabs
          tabs={campusTabs}
          activeTab={activeTab}
          onChange={handleTabChange}
          variant="dashboard"
          compact
        />
      </div>

      {/* ── 3. Main content box (own card, gated by per-tab featureHidden) ── */}
      {isAdmin ? <SidebarPageAccessPanel pageKey="/campus" featureKey={`feature:campus:${({ map: 'floor-map', library: 'library-pulse', canteen: 'canteen-menu', bus: 'bus-tracker', classroom: 'free-rooms' })[activeTab] || 'floor-map'}`} part="child" /> : <MastheadAccessControl>
        <div className="cp-content-card" key={activeTab}>
          <div className="campus-content-area">
            <FeatureAccessGate featureKey={`feature:campus:${({ map: 'floor-map', library: 'library-pulse', canteen: 'canteen-menu', bus: 'bus-tracker', classroom: 'free-rooms' })[activeTab] || 'floor-map'}`}>
              {renderActiveTab()}
            </FeatureAccessGate>
          </div>
        </div>
      </MastheadAccessControl>}
    </div>
  );
}
