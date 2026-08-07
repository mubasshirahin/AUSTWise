import { useState } from 'react';
import { Home, DollarSign, ClipboardCheck, NotebookPen, UtensilsCrossed, Banknote } from 'lucide-react';
import GliderTabs from '../../components/GliderTabs';
import MoneyTrackerPage from '../money-tracker/MoneyTrackerPage';
import ExamChecklistPage from '../exam-checklist/ExamChecklistPage';
import CoverPageGeneratorPage from '../cover-page-generator/CoverPageGeneratorPage';
import MessMealTrackerPage from './MessMealTrackerPage';
import BharaKoto from './BharaKoto';
import './DailyLifePage.css';
import './daily-life-tokens.css';

const TABS = [
  { id: 'exam-checklist',       label: 'Exam Checklist',      icon: ClipboardCheck, color: 'amber', desc: 'Exam prep'          },
  { id: 'cover-page-generator', label: 'Cover Page',          icon: NotebookPen,    color: 'amber', desc: 'Generate cover page'},
  { id: 'bhara-koto',           label: 'Bhara Koto',          icon: Banknote,       color: 'amber', desc: 'Fare estimator'     },
  { id: 'money-tracker',        label: 'TakaGeloKoi',         icon: DollarSign,     color: 'amber', desc: 'Expenses & budget'  },
  { id: 'mess-meal',            label: 'Mess Meal',           icon: UtensilsCrossed,color: 'amber', desc: 'Meal planner'       },
];

const STORAGE_KEY = 'daily-life-active-tab';

export default function DailyLifePage() {
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'exam-checklist'
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

      {/* ── 1. Hero box (own card, matches dashboard hero) ── */}
      <header className="dl-hero">
        <div className="dl-hero-content">
          <div className="dl-hero-eyebrow">
            <span className="dl-hero-period-icon">
              <Home size={16} />
            </span>
            <span className="dl-hero-date-label">
              Daily essentials · tools hub
            </span>
          </div>
          <h1 className="dl-hero-title">
            Daily<span className="dl-hero-name"> Life</span>
          </h1>
          <p className="dl-hero-subtitle">
            Exam prep, cover pages, fare estimates, budget tracking and meal planning — all in one place.
          </p>
        </div>
      </header>

      {/* ── 2. Glider tabs bar (own card) ── */}
      <div className="glass-card-static dl-tabs-card">
        <GliderTabs
          tabs={TABS}
          activeTab={activeTab}
          onChange={handleTabChange}
          variant="dashboard"
          compact
        />
      </div>

      {/* ── 3. Main content box (own card) ── */}
      <div className="dl-content-card" key={activeTab}>
        <div className="daily-life-tab-content">
          {renderTab()}
        </div>
      </div>
    </div>
  );
}
