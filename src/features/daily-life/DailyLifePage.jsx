import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Home, DollarSign, NotebookPen, UtensilsCrossed, Banknote, ShieldCheck, KeyRound, CalendarDays } from 'lucide-react';
import GliderTabs from '../../components/GliderTabs';
import MastheadAccessControl from '../../components/MastheadAccessControl';
import FeatureAccessGate from '../admin/FeatureAccessGate';
import SidebarPageAccessPanel from '../admin/SidebarPageAccessPanel';
import useTabUrlState from '../../hooks/useTabUrlState';
import useAdminMode from '../../hooks/useAdminMode';
import MoneyTrackerPage from '../money-tracker/MoneyTrackerPage';
import CoverPageGeneratorPage from '../cover-page-generator/CoverPageGeneratorPage';
import MessMealTrackerPage from './MessMealTrackerPage';
import LifePlannerPage from './LifePlannerPage';
import DhakaRoutes from './DhakaRoutes';
import DigitalFootprintCleaner from '../digital-footprint/DigitalFootprintCleaner';
import PasswordManagerPage from '../password-manager/PasswordManagerPage';
import './DailyLifePage.css';
import './daily-life-tokens.css';

const TABS = [
  { id: 'cover-page-generator', label: 'Cover Page',          icon: NotebookPen,    color: 'amber', desc: 'Generate cover page', accessKey: 'feature:daily-life:cover-page'},
  { id: 'bhara-koto',           label: 'Bhara Koto',          icon: Banknote,       color: 'amber', desc: 'Distance & cost', accessKey: 'feature:daily-life:bhara-koto'     },
  { id: 'money-tracker',        label: 'TakaGeloKoi',         icon: DollarSign,     color: 'amber', desc: 'Expenses & budget', accessKey: 'feature:daily-life:money-tracker'  },
  { id: 'mess-meal',            label: 'Mess Meal',           icon: UtensilsCrossed,color: 'amber', desc: 'Meal planner', accessKey: 'feature:daily-life:mess-meal'       },
  { id: 'life-planner',         label: 'Life Planner',        icon: CalendarDays,   color: 'amber', desc: 'Goals & week plan', accessKey: 'feature:daily-life:life-planner'  },
  { id: 'digital-footprint',    label: 'Footprint',           icon: ShieldCheck,    color: 'cyan',  desc: 'Map online accounts', accessKey: 'feature:daily-life:digital-footprint' },
  { id: 'password-manager',     label: 'Passwords',           icon: KeyRound,       color: 'amber', desc: 'Secure login vault', accessKey: 'feature:daily-life:password-manager' },
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
      case 'life-planner':         return <LifePlannerPage />;
      case 'bhara-koto':           return <DhakaRoutes />;
      case 'digital-footprint':    return <DigitalFootprintCleaner />;
      case 'password-manager':     return <PasswordManagerPage />;
      default:                     return <MoneyTrackerPage />;
    }
  };

  return (
    <div className="daily-life-page animate-fadeIn">

      {isAdmin ? (
        <header style={{ marginBottom: '18px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', lineHeight: 1.2, fontWeight: 750, color: 'var(--text-primary)' }}>Daily Life</h1>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Manage Daily Life access and feature visibility.</p>
        </header>
      ) : <header className="dl-hero">
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
      </header>}

      {/* ── 2. Glider tabs bar (own card) ── */}
      {isAdmin && <SidebarPageAccessPanel pageKey="/daily-life" part="parent" />}
      <div className="glass-card-static dl-tabs-card">
        <GliderTabs
          tabs={TABS}
          activeTab={activeTab}
          onChange={handleTabChange}
          variant="dashboard"
          compact
        />
      </div>

      {isAdmin ? <SidebarPageAccessPanel pageKey="/daily-life" featureKey={`feature:daily-life:${({ 'cover-page-generator': 'cover-page', 'bhara-koto': 'bhara-koto', 'money-tracker': 'money-tracker', 'mess-meal': 'mess-meal', 'life-planner': 'life-planner', 'digital-footprint': 'digital-footprint', 'password-manager': 'password-manager' })[activeTab] || 'cover-page'}`} part="child" /> : <MastheadAccessControl>
        <div className="dl-content-card" key={activeTab}>
          <div className="daily-life-tab-content">
            <FeatureAccessGate featureKey={`feature:daily-life:${({ 'cover-page-generator': 'cover-page', 'bhara-koto': 'bhara-koto', 'money-tracker': 'money-tracker', 'mess-meal': 'mess-meal', 'life-planner': 'life-planner', 'digital-footprint': 'digital-footprint', 'password-manager': 'password-manager' })[activeTab] || 'cover-page'}`}>
              {renderTab()}
            </FeatureAccessGate>
          </div>
        </div>
      </MastheadAccessControl>}
    </div>
  );
}
