import { UtensilsCrossed } from 'lucide-react';
import './MessMealTrackerPage.css';
import '../../components/PageHero.css';

export default function MessMealTrackerPage() {
  return (
    <div className="mm-page animate-fadeIn">
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <UtensilsCrossed size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">Mess Meal Tracker</span>
              </h1>
              <p className="page-hero-subtitle">Track your mess meals, plan your weekly menu, and split costs with roommates.</p>
            </div>
          </div>
        </div>
      </header>
      <div className="mm-placeholder">
        <UtensilsCrossed size={48} />
        <h3>Coming Soon</h3>
        <p>Meal logging, weekly menu planner, and cost splitting.</p>
      </div>
    </div>
  );
}
