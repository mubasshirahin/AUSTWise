import { DoorOpen, Search, MapPin } from 'lucide-react';
import '../campus/SemesterViewWidget.css';
import './EmptyClassroomPage.css';

export default function EmptyClassroomPage() {
  return (
    <div className="glass-card-static schedule-widget sv-widget ecf-widget animate-fadeInUp">

      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile ecf-icon-tile">
            <DoorOpen size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Campus</span>
            <div className="schedule-title">Free Rooms</div>
            <span className="schedule-subtitle">
              Available classrooms for self-study, group work, or practice
            </span>
          </div>
        </div>

        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="schedule-stat-value ecf-cs-badge">Soon</span>
              <span className="schedule-stat-label">Status</span>
            </div>
          </div>
        </div>

        <div className="schedule-actions">
          {/* placeholder — no actions yet */}
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {/* ── Coming Soon body ── */}
      <div className="sv-empty">
        <Search size={38} className="sv-empty-icon" />
        <h3>Classroom Finder — Coming Soon</h3>
        <p>
          See real-time availability of all classrooms across campus. Filter by building, floor,
          capacity, and time slot to find the perfect spot.
        </p>
        <div className="ecf-feature-pills">
          <span className="ecf-pill"><DoorOpen size={14} /> Real-Time Availability</span>
          <span className="ecf-pill"><MapPin size={14} /> Floor Maps</span>
          <span className="ecf-pill"><Search size={14} /> Capacity Filter</span>
        </div>
      </div>

    </div>
  );
}
