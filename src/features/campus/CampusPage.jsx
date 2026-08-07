import { useState } from 'react';
import { Map, MapPin, Users, Library, UtensilsCrossed, Bus, DoorOpen } from 'lucide-react';
import InteractiveMap from './InteractiveMap';
import FacultyStatus from './FacultyStatus';
import LibraryPulse from './LibraryPulse';
import CanteenMenu from './CanteenMenu';
import BusTracker from './BusTracker';
import EmptyClassroomPage from '../empty-classroom/EmptyClassroomPage';
import GliderTabs from '../../components/GliderTabs';
import './CampusPage.css';
import './campus-tokens.css';

const campusTabs = [
  { id: 'map',       label: 'Floor Map',      icon: MapPin,          color: 'amber', desc: '' },
  { id: 'faculty',   label: 'Faculty Status', icon: Users,           color: 'amber', desc: 'Office hours' },
  { id: 'library',   label: 'Library Pulse',  icon: Library,         color: 'amber', desc: 'Occupancy' },
  { id: 'canteen',   label: 'Canteen Menu',   icon: UtensilsCrossed, color: 'amber', desc: "Today's menu" },
  { id: 'bus',       label: 'Bus Tracker',    icon: Bus,             color: 'amber', desc: 'Shuttle routes' },
  { id: 'classroom', label: 'Free Rooms',     icon: DoorOpen,        color: 'amber', desc: 'Find available rooms' },
];

const CAMPUS_TAB_KEY = 'aust-campus-active-tab';

export default function CampusPage() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(CAMPUS_TAB_KEY) || 'map';
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem(CAMPUS_TAB_KEY, tab);
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'map': return <InteractiveMap />;
      case 'faculty': return <FacultyStatus />;
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
      <header className="cp-hero">
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
      </header>

      {/* ── 2. Glider tabs bar (own card) ── */}
      <div className="glass-card-static cp-tabs-card">
        <GliderTabs
          tabs={campusTabs}
          activeTab={activeTab}
          onChange={handleTabChange}
          variant="dashboard"
          compact
        />
      </div>

      {/* ── 3. Main content box (own card) ── */}
      <div className="cp-content-card" key={activeTab}>
        <div className="campus-content-area">
          {renderActiveTab()}
        </div>
      </div>
    </div>
  );
}
