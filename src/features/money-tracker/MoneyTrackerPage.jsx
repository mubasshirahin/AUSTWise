import { DollarSign, Plus, ArrowUpDown } from 'lucide-react';
import './MoneyTrackerPage.css';
import '../../components/PageHero.css';

export default function MoneyTrackerPage() {
  return (
    <div className="mt-page animate-fadeIn">
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <DollarSign size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">Money Tracker</span>
              </h1>
              <p className="page-hero-subtitle">Track your daily expenses, set budgets, and manage your student finances.</p>
            </div>
          </div>
        </div>
      </header>
      <div className="mt-placeholder">
        <DollarSign size={48} />
        <h3>Coming Soon</h3>
        <p>Expense tracking, budget goals, and monthly summaries.</p>
      </div>
    </div>
  );
}
