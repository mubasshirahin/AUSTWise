import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users, GraduationCap, Building2, UserPlus, School,
} from 'lucide-react';
import GliderTabs from '../../components/GliderTabs';
import useTabUrlState from '../../hooks/useTabUrlState';
import useAdminMode from '../../hooks/useAdminMode';
import AlumniDirectory from './AlumniDirectory';
import ClubPortal from './ClubPortal';
import StudentDirectory from './StudentDirectory';
import FacultyDirectory from './FacultyDirectory';
import MentorRequests from './MentorRequests';
import '../campus/SemesterViewWidget.css';
import './CommunityPage.css';

const COMMUNITY_TAB_KEY = 'aust-community-active-tab';

// Unified theme: every tab uses the single brand accent (amber) so the tab bar
// stays monochrome instead of rotating purple/green/blue per category.
const communityTabs = [
  { id: 'alumni', label: 'Alumni Directory', icon: GraduationCap, color: 'amber', desc: 'Connect with alumni' },
  { id: 'clubs', label: 'Clubs Hub', icon: Building2, color: 'amber', desc: 'Join student clubs' },
  { id: 'students', label: 'Student Directory', icon: Users, color: 'amber', desc: 'Find classmates' },
  { id: 'faculty', label: 'Faculty Directory', icon: School, color: 'amber', desc: 'Meet your teachers' },
  { id: 'mentorRequests', label: 'Mentor Requests', icon: UserPlus, color: 'amber', desc: 'Connect study buddies' },
];

export default function CommunityPage() {
  const { isAdmin } = useAdminMode();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || localStorage.getItem(COMMUNITY_TAB_KEY) || 'alumni';
  });
  const activeMeta = communityTabs.find((t) => t.id === activeTab) || communityTabs[0];

  const handleTabChange = useTabUrlState({
    storageKey: COMMUNITY_TAB_KEY,
    defaultValue: 'alumni',
    onChange: setActiveTab,
  });

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'alumni': return <AlumniDirectory />;
      case 'clubs': return <ClubPortal />;
      case 'students': return <StudentDirectory />;
      case 'faculty': return <FacultyDirectory />;
      case 'mentorRequests': return <MentorRequests />;
      default: return <AlumniDirectory />;
    }
  };

  return (
    <div className="community-page animate-fadeIn">

      {/* ── 1. Hero box (own card) ── */}
      <header className="cm-hero">
        <div className="cm-hero-content">
          <div className="cm-hero-eyebrow">
            <span className="cm-hero-period-icon">
              <Users size={16} />
            </span>
            <span className="cm-hero-date-label">
              Inside AUST
            </span>
          </div>
          <h1 className="cm-hero-title">
            Communit<span className="cm-hero-name">y</span>
          </h1>
          <p className="cm-hero-subtitle">
            {activeMeta.desc} · connect with alumni, faculty, clubs, classmates and mentors.
          </p>
        </div>
      </header>

      {/* ── 2. Glider tabs bar (own card) ── */}
      <div className="glass-card-static cm-tabs-card">
        <div className="cm-tabs-row">
          <GliderTabs
            tabs={communityTabs}
            activeTab={activeTab}
            onChange={handleTabChange}
            variant="dashboard"
            compact
          />
        </div>
      </div>

      {/* ── 3. Main content box (own card) ── */}
      {!isAdmin && (
        <div className="cm-content-card" key={activeTab}>
          <div className="community-content-area">
            {renderActiveTab()}
          </div>
        </div>
      )}
    </div>
  );
}
