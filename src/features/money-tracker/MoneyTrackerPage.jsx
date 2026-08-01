import { DollarSign, MoreVertical } from 'lucide-react';
import './MoneyTrackerPage.css';

export default function MoneyTrackerPage() {
  return (
    <div className="glass-card-static schedule-widget mt-widget animate-fadeInUp">

      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <DollarSign size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Daily Life</span>
            <p className="schedule-title">TiyaHodeJargoi</p>
            <span className="schedule-subtitle">Expenses &amp; budget</span>
          </div>
        </div>

        <div className="schedule-masthead-center" />

        <div className="schedule-actions">
          <button className="schedule-nav-btn" disabled aria-label="More options">
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {/* ── Placeholder / Empty State ── */}
      <div className="mt-placeholder">
        <DollarSign size={48} />
        <h3>Coming Soon</h3>
        <p>Expense tracking, budget goals, and monthly summaries.</p>
      </div>

    </div>
  );
}
