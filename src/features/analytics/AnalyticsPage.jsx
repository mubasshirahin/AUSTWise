import { useState, useMemo } from 'react';
import { TrendingUp, Layers, Grid3x3, Trophy, FlaskConical, GitBranch } from 'lucide-react';
import CGPAGraph from './CGPAGraph';
import SemesterTracker from './SemesterTracker';
import DeptHeatmap from './DeptHeatmap';
import CoursePoll from './CoursePoll';
import PrerequisiteTree from './PrerequisiteTree';
import GliderTabs from '../../components/GliderTabs';
import './AnalyticsPage.css';
import './analytics-tokens.css';

const TAB_KEY = 'analyticsActiveTab';

const gradeLabTabs = [
  { id: 'cgpagraph', label: 'CGPA Calculator', icon: TrendingUp, color: 'amber', desc: 'Grade trends' },
  { id: 'semestertracker', label: 'Semester Wise', icon: Layers, color: 'amber', desc: 'Per-semester' },
  { id: 'heatmap', label: 'Dept Heatmap', icon: Grid3x3, color: 'amber', desc: 'Avg CGPA' },
  { id: 'bestworst', label: 'Best & Worst', icon: Trophy, color: 'amber', desc: 'Course poll' },
  { id: 'prereqs', label: 'Prerequisites', icon: GitBranch, color: 'amber', desc: 'Course flow map' },
];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(TAB_KEY) || 'cgpagraph';
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem(TAB_KEY, tab);
  };

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

      {/* ── 1. Hero box (own card) ── */}
      <header className="gl-hero">
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
      </header>

      {/* ── 2. Glider tabs bar (own card) ── */}
      <div className="glass-card-static gl-tabs-card">
        <GliderTabs
          tabs={gradeLabTabs}
          activeTab={activeTab}
          onChange={handleTabChange}
          variant="dashboard"
          compact
        />
      </div>

      {/* ── 3. Main content box (own card) ── */}
      <div className="gl-content-card" key={activeTab}>
        <div className="analytics-content-area">
          {renderActiveTab()}
        </div>
      </div>
    </div>
  );
}
