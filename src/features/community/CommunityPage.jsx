import { useState } from 'react';
import { Users, Building2, GraduationCap, MessageCircle, UserPlus } from 'lucide-react';
import AlumniDirectory from './AlumniDirectory';
import ClubPortal from './ClubPortal';
import StudentDirectory from './StudentDirectory';
import MentorRequests from './MentorRequests';
import GliderTabs from '../../components/GliderTabs';
import '../../components/PageHero.css';
import './CommunityPage.css';

const COMMUNITY_TAB_KEY = 'aust-community-active-tab';

const communityTabs = [
  { id: 'alumni', label: 'Alumni Directory', icon: GraduationCap, color: 'purple', desc: 'Connect with alumni' },
  { id: 'clubs', label: 'Clubs Hub', icon: Building2, color: 'emerald', desc: 'Join student clubs' },
  { id: 'students', label: 'Student Directory', icon: Users, color: 'blue', desc: 'Find classmates' },
  { id: 'mentorRequests', label: 'Mentor Requests', icon: UserPlus, color: 'amber', desc: 'Connect study buddies' },
];

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(COMMUNITY_TAB_KEY) || 'alumni';
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem(COMMUNITY_TAB_KEY, tab);
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'alumni': return <AlumniDirectory />;
      case 'clubs': return <ClubPortal />;
      case 'students': return <StudentDirectory />;
      case 'mentorRequests': return <MentorRequests />;
      default: return <AlumniDirectory />;
    }
  };

  return (
    <div className="community-page animate-fadeIn">
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <MessageCircle size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">Community</span>
              </h1>
               <p className="page-hero-subtitle">
                 Connect with alumni networks, join student clubs, find classmates, and request mentors.
               </p>
            </div>
          </div>
        </div>
      </header>


      <GliderTabs
        tabs={communityTabs}
        activeTab={activeTab}
        onChange={handleTabChange}
        variant="dashboard"
      />

      {/* ─── Section header for tabs ─── */}
      <div className="section-header">
        <h2 className="section-title">
          <span className="icon" style={{ background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>
            <MessageCircle size={16} />
          </span>
          Explore Community
        </h2>
      </div>

      <div className="community-content-area" key={activeTab}>
        {renderActiveTab()}
      </div>
    </div>
  );
}
