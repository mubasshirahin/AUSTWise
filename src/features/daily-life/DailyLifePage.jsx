import { useState } from 'react';
import { Home, DollarSign, ClipboardCheck, NotebookPen, UtensilsCrossed, Banknote } from 'lucide-react';
import GliderTabs from '../../components/GliderTabs';
import MoneyTrackerPage from '../money-tracker/MoneyTrackerPage';
import ExamChecklistPage from '../exam-checklist/ExamChecklistPage';
import CoverPageGeneratorPage from '../cover-page-generator/CoverPageGeneratorPage';
import MessMealTrackerPage from './MessMealTrackerPage';
import BharaKoto from './BharaKoto';
import './DailyLifePage.css';
import '../../components/PageHero.css';

const TABS = [
  { id: 'exam-checklist',       label: 'Exam Checklist',      icon: ClipboardCheck,color: 'blue',    desc: 'Exam prep'          },
  { id: 'cover-page-generator', label: 'Cover Page',          icon: NotebookPen,   color: 'purple',  desc: 'Generate cover page'},
  { id: 'money-tracker',        label: 'TiyaHodeJargoi',       icon: DollarSign,    color: 'emerald', desc: 'Expenses & budget'  },
  { id: 'mess-meal',            label: 'Mess Meal',           icon: UtensilsCrossed,color: 'orange', desc: 'Meal planner'       },
  { id: 'bhara-koto',           label: 'Bhara Koto',          icon: Banknote,       color: 'orange', desc: 'Fare estimator'     },
];

const STORAGE_KEY = 'daily-life-active-tab';

export default function DailyLifePage() {
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'money-tracker'
  );

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEY, tab);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'money-tracker':        return <MoneyTrackerPage />;
      case 'exam-checklist':       return <ExamChecklistPage />;
      case 'cover-page-generator': return <CoverPageGeneratorPage />;
      case 'mess-meal':            return <MessMealTrackerPage />;
      case 'bhara-koto':           return <BharaKoto />;
      default:                     return <MoneyTrackerPage />;
    }
  };

  return (
    <div className="daily-life-page animate-fadeIn">
      {/* ── Hero ── */}
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <Home size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">Daily Life</span>
              </h1>
              <p className="page-hero-subtitle">
                Manage finances, prep for exams, and generate cover pages.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Glider Tabs ── */}
      <GliderTabs
        tabs={TABS}
        activeTab={activeTab}
        onChange={handleTabChange}
        variant="dashboard"
        compact
      />

      {/* ── Tab Content ── */}
      <div className="daily-life-tab-content" key={activeTab}>
        {renderTab()}
      </div>
    </div>
  );
}
