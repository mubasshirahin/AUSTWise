import { Banknote, CreditCard, Receipt } from 'lucide-react';
import '../campus/SemesterViewWidget.css';
import './AustBharaPage.css';

export default function AustBharaPage() {
  return (
    <div className="glass-card-static schedule-widget sv-widget bhara-widget animate-fadeInUp">

      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile bhara-icon-tile">
            <Banknote size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Campus</span>
            <div className="schedule-title">Bhara Koto</div>
            <span className="schedule-subtitle">
              Semester fees, tuition &amp; AUST-related payments
            </span>
          </div>
          <div className="schedule-stat">
            <span className="schedule-stat-value bhara-cs-badge">Soon</span>
            <span className="schedule-stat-label">Status</span>
          </div>
        </div>

        <div className="schedule-actions">
          {/* placeholder — no actions yet */}
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {/* ── Coming Soon body ── */}
      <div className="sv-empty">
        <Receipt size={38} className="sv-empty-icon" />
        <h3>Fee Tracker — Coming Soon</h3>
        <p>
          View semester-wise fee breakdowns, track payment deadlines, and get reminders before
          due dates. All your AUST payment history in one clean dashboard.
        </p>
        <div className="bhara-feature-pills">
          <span className="bhara-pill"><CreditCard size={14} /> Semester Fees</span>
          <span className="bhara-pill"><Banknote size={14} /> Exam Fees</span>
          <span className="bhara-pill"><Receipt size={14} /> Payment History</span>
        </div>
      </div>

    </div>
  );
}
