import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Home, DollarSign, NotebookPen, UtensilsCrossed, Banknote, ShieldCheck, KeyRound } from 'lucide-react';
import GliderTabs from '../../components/GliderTabs';
import useTabUrlState from '../../hooks/useTabUrlState';
import useAdminMode from '../../hooks/useAdminMode';
import MoneyTrackerPage from '../money-tracker/MoneyTrackerPage';
import CoverPageGeneratorPage from '../cover-page-generator/CoverPageGeneratorPage';
import MessMealTrackerPage from './MessMealTrackerPage';
import DhakaRoutes from './DhakaRoutes';
import DigitalFootprintCleaner from '../digital-footprint/DigitalFootprintCleaner';
import PasswordManagerPage from '../password-manager/PasswordManagerPage';
import './DailyLifePage.css';
import './daily-life-tokens.css';

const TABS = [
  { id: 'cover-page-generator', label: 'Cover Page',          icon: NotebookPen,    color: 'amber', desc: 'Generate cover page'},
  { id: 'bhara-koto',           label: 'Bhara Koto',          icon: Banknote,       color: 'amber', desc: 'Distance & cost'     },
  { id: 'money-tracker',        label: 'TakaGeloKoi',         icon: DollarSign,     color: 'amber', desc: 'Expenses & budget'  },
  { id: 'mess-meal',            label: 'Mess Meal',           icon: UtensilsCrossed,color: 'amber', desc: 'Meal planner'       },
  { id: 'digital-footprint',    label: 'Footprint',           icon: ShieldCheck,    color: 'cyan',  desc: 'Map online accounts' },
  { id: 'password-manager',     label: 'Passwords',           icon: KeyRound,       color: 'amber', desc: 'Secure login vault' },
];

const STORAGE_KEY = 'daily-life-active-tab';

export default function DailyLifePage() {
  const { isAdmin } = useAdminMode();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    () => searchParams.get('tab') || localStorage.getItem(STORAGE_KEY) || 'cover-page-generator'
  );

  const handleTabChange = useTabUrlState({
    storageKey: STORAGE_KEY,
    defaultValue: 'cover-page-generator',
    onChange: setActiveTab,
  });

  const renderTab = () => {
    switch (activeTab) {
      case 'money-tracker':        return <MoneyTrackerPage />;
      case 'cover-page-generator': return <CoverPageGeneratorPage />;
      case 'mess-meal':            return <MessMealTrackerPage />;
      case 'bhara-koto':           return <DhakaRoutes />;
      case 'digital-footprint':    return <DigitalFootprintCleaner />;
      case 'password-manager':     return <PasswordManagerPage />;
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
            Exam prep, budgets &amp; meals — all in one place.
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
      {!isAdmin && (
        <div className="dl-content-card" key={activeTab}>
          <div className="daily-life-tab-content">
            {renderTab()}
          </div>
        </div>
      )}
    </div>
  );
}
