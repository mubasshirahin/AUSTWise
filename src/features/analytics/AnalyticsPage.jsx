import React, { useState, useMemo } from 'react';
import { TrendingUp, Layers, Grid3x3, Trophy, FlaskConical, GitBranch } from 'lucide-react';
import CGPAGraph from './CGPAGraph';
import SemesterTracker from './SemesterTracker';
import DeptHeatmap from './DeptHeatmap';
import CoursePoll from './CoursePoll';
import PrerequisiteTree from './PrerequisiteTree';
import GliderTabs from '../../components/GliderTabs';
import './AnalyticsPage.css';
import '../../components/PageHero.css';

const TAB_KEY = 'analyticsActiveTab';

const gradeLabTabs = [
  { id: 'cgpagraph', label: 'CGPA Bol', icon: TrendingUp, color: 'blue', desc: 'Grade trends' },
  { id: 'semestertracker', label: 'Semester View', icon: Layers, color: 'purple', desc: 'Per-semester' },
  { id: 'heatmap', label: 'Dept Heatmap', icon: Grid3x3, color: 'rose', desc: 'Avg CGPA' },
  { id: 'bestworst', label: 'Best & Worst', icon: Trophy, color: 'emerald', desc: 'Course poll' },
  { id: 'prereqs', label: 'Prerequisites', icon: GitBranch, color: 'purple', desc: 'Course flow map' },
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
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <FlaskConical size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">Grade Lab</span>
              </h1>
              <p className="page-hero-subtitle">{heroSubtitle}</p>
            </div>
          </div>
        </div>
      </header>

      <GliderTabs
        tabs={gradeLabTabs}
        activeTab={activeTab}
        onChange={handleTabChange}
        variant="gradelab"
      />

      <div className="analytics-content-area" key={activeTab}>
        {renderActiveTab()}
      </div>
    </div>
  );
}
