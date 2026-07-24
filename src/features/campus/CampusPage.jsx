import React, { useState } from 'react';
import { Map, MapPin, Users, Library, UtensilsCrossed, Bus, Banknote, DoorOpen } from 'lucide-react';
import InteractiveMap from './InteractiveMap';
import FacultyStatus from './FacultyStatus';
import LibraryPulse from './LibraryPulse';
import CanteenMenu from './CanteenMenu';
import BusTracker from './BusTracker';
import AustBharaPage from '../aust-bhara/AustBharaPage';
import EmptyClassroomPage from '../empty-classroom/EmptyClassroomPage';
import GliderTabs from '../../components/GliderTabs';
import './CampusPage.css';
import '../../components/PageHero.css';

const campusTabs = [
  { id: 'map',     label: 'Floor Map',        icon: MapPin,          color: 'cyan',    desc: '' },
  { id: 'faculty', label: 'Faculty Status',   icon: Users,           color: 'amber',   desc: 'Office hours' },
  { id: 'library', label: 'Library Pulse',    icon: Library,         color: 'emerald', desc: 'Occupancy' },
  { id: 'canteen', label: 'Canteen Menu',     icon: UtensilsCrossed, color: 'rose',    desc: "Today's menu" },
  { id: 'bus',     label: 'Bus Tracker',      icon: Bus,             color: 'indigo',  desc: 'Shuttle routes' },
  { id: 'bhara',     label: 'Bhara Koto',       icon: Banknote,        color: 'amber',   desc: 'Fee tracker' },
  { id: 'classroom', label: 'Free Rooms',   icon: DoorOpen,         color: 'violet',  desc: 'Find available rooms' },
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
      case 'bhara': return <AustBharaPage />;
      case 'classroom': return <EmptyClassroomPage />;
      default: return <InteractiveMap />;
    }
  };

  return (
    <div className="campus-page animate-fadeIn">
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <Map size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">InsideAUST</span>
              </h1>
              <p className="page-hero-subtitle">
                Navigate buildings, review faculty office hours, and check live canteen/library occupancy.
              </p>
            </div>
          </div>
        </div>
      </header>

      <GliderTabs
        tabs={campusTabs}
        activeTab={activeTab}
        onChange={handleTabChange}
        variant="gradelab"
        compact
      />

      <div className="campus-content-area" key={activeTab}>
        {renderActiveTab()}
      </div>
    </div>
  );
}
