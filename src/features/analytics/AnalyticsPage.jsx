import { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { TrendingUp, Layers, Grid3x3, Trophy, FlaskConical, GitBranch } from 'lucide-react';
import CGPAGraph from './CGPAGraph';
import SemesterTracker from './SemesterTracker';
import DeptHeatmap from './DeptHeatmap';
import CoursePoll from './CoursePoll';
import PrerequisiteTree from './PrerequisiteTree';
import GliderTabs from '../../components/GliderTabs';
import MastheadAccessControl from '../../components/MastheadAccessControl';
import FeatureAccessGate from '../admin/FeatureAccessGate';
import SidebarPageAccessPanel from '../admin/SidebarPageAccessPanel';
import useAdminMode from '../../hooks/useAdminMode';
import './AnalyticsPage.css';
import './analytics-tokens.css';

const TAB_KEY = 'analyticsActiveTab';

const gradeLabTabs = [
  { id: 'cgpagraph', label: 'CGPA Calculator', icon: TrendingUp, color: 'amber', desc: 'Grade trends', accessKey: 'feature:analytics:cgpagraph' },
  { id: 'semestertracker', label: 'Semester Wise', icon: Layers, color: 'amber', desc: 'Per-semester', accessKey: 'feature:analytics:semestertracker' },
  { id: 'heatmap', label: 'Dept Heatmap', icon: Grid3x3, color: 'amber', desc: 'Avg CGPA', accessKey: 'feature:analytics:heatmap' },
  { id: 'bestworst', label: 'Best & Worst', icon: Trophy, color: 'amber', desc: 'Course poll', accessKey: 'feature:analytics:bestworst' },
  { id: 'prereqs', label: 'Prerequisites', icon: GitBranch, color: 'amber', desc: 'Course flow map', accessKey: 'feature:analytics:prereqs' },
];

export default function AnalyticsPage() {
  const { isAdmin } = useAdminMode();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sectionTab = ({ 'cgpa-calculator': 'cgpagraph', 'semester-wise': 'semestertracker', 'dept-heatmap': 'heatmap', 'best-worst': 'bestworst', prerequisites: 'prereqs' })[location.pathname.split('/')[2]];
  const [activeTab, setActiveTab] = useState(() => {
    if (sectionTab) return sectionTab;
    return searchParams.get('tab') || localStorage.getItem(TAB_KEY) || 'cgpagraph';
  });

  const handleTabChange = (tab) => {
    const section = ({ cgpagraph: 'cgpa-calculator', semestertracker: 'semester-wise', heatmap: 'dept-heatmap', bestworst: 'best-worst', prereqs: 'prerequisites' })[tab] || 'cgpa-calculator';
    setActiveTab(tab);
    localStorage.setItem(TAB_KEY, tab);
    navigate(`/gradelab/${section}`, { replace: true });
  };

  useEffect(() => {
    const queryTab = searchParams.get('tab');
    const selected = sectionTab || queryTab;
    if (selected && gradeLabTabs.some((tab) => tab.id === selected)) {
      setActiveTab(selected);
      if (queryTab) navigate(`/gradelab/${({ cgpagraph: 'cgpa-calculator', semestertracker: 'semester-wise', heatmap: 'dept-heatmap', bestworst: 'best-worst', prereqs: 'prerequisites' })[selected]}`, { replace: true });
    } else if (location.pathname === '/gradelab') {
      const stored = localStorage.getItem(TAB_KEY);
      const initial = gradeLabTabs.some((tab) => tab.id === stored) ? stored : 'cgpagraph';
      navigate(`/gradelab/${({ cgpagraph: 'cgpa-calculator', semestertracker: 'semester-wise', heatmap: 'dept-heatmap', bestworst: 'best-worst', prereqs: 'prerequisites' })[initial]}`, { replace: true });
      setActiveTab(initial);
    }
  }, [location.pathname, searchParams]);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'cgpagraph': return <CGPAGraph />;
      case 'semestertracker': return <SemesterTracker />;
      case 'heatmap': return <DeptHeatmap />;
      case 'bestworst': return <CoursePoll />;
      case 'prereqs': return <PrerequisiteTree />;
      default: return <CGPAGraph />;
    }
  };

  const heroSubtitle = useMemo(() => {
    const tab = gradeLabTabs.find(t => t.id === activeTab);
    return tab ? `Explore ${tab.desc} across all semesters` : 'Track historical grades, simulate what-if scenarios, and view syllabus completion.';
  }, [activeTab]);

  return (
    <div className="analytics-page animate-fadeIn">

      {isAdmin ? (
        <header style={{ marginBottom: '18px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', lineHeight: 1.2, fontWeight: 750, color: 'var(--text-primary)' }}>GradeLab</h1>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Manage GradeLab access and feature visibility.</p>
        </header>
      ) : <header className="gl-hero">
        <div className="gl-hero-content">
          <div className="gl-hero-eyebrow">
            <span className="gl-hero-period-icon">
              <FlaskConical size={16} />
            </span>
            <span className="gl-hero-date-label">
              Analytics · all semesters
            </span>
          </div>
          <h1 className="gl-hero-title">
            Grade<span className="gl-hero-name"> Lab</span>
          </h1>
          <p className="gl-hero-subtitle">{heroSubtitle}</p>
        </div>
      </header>}

      {/* ── 2. Glider tabs bar (always visible) ── */}
      {isAdmin && <SidebarPageAccessPanel pageKey="/analytics" part="parent" />}
      <div className="glass-card-static gl-tabs-card">
        <GliderTabs
          tabs={gradeLabTabs}
          activeTab={activeTab}
          onChange={handleTabChange}
          variant="dashboard"
        />
      </div>

      {isAdmin ? <SidebarPageAccessPanel pageKey="/analytics" featureKey={`feature:analytics:${activeTab}`} part="child" /> : <MastheadAccessControl>
        <div className="gl-content-card" key={activeTab}>
          <div className="analytics-content-area">
            <FeatureAccessGate featureKey={`feature:analytics:${activeTab}`}>
              {renderActiveTab()}
            </FeatureAccessGate>
          </div>
        </div>
      </MastheadAccessControl>}
    </div>
  );
}
