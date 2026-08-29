import { UtensilsCrossed, MoreVertical } from 'lucide-react';
import './MessMealTrackerPage.css';

export default function MessMealTrackerPage() {
  return (
    <div className="glass-card-static schedule-widget mm-widget animate-fadeInUp">

      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <UtensilsCrossed size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Daily Life</span>
            <p className="schedule-title">Mess Meal Tracker</p>
            <span className="schedule-subtitle">Meal planner &amp; cost split</span>
          </div>
        </div>

        <div className="schedule-actions">
          <button className="schedule-nav-btn" disabled aria-label="More options">
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {/* ── Placeholder / Coming Soon ── */}
      <div className="mm-placeholder">
        <UtensilsCrossed size={48} />
        <h3>Coming Soon</h3>
        <p>Meal logging, weekly menu planner, and cost splitting.</p>
      </div>

    </div>
  );
}
