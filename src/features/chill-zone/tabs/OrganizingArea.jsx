import { LayoutGrid, Pin, StickyNote, ListChecks, Sparkles } from 'lucide-react';
import '../ChillZonePage.css';

export default function OrganizingArea() {
  return (
    <div className="cz-tab-page">
      <div className="cz-coming-card">
        <div className="cz-coming-icon" style={{ background: 'var(--accent-blue-glow)', color: 'var(--accent-blue)' }}>
          <LayoutGrid size={32} strokeWidth={1.5} />
        </div>
        <h2>Organizing Area</h2>
        <p>
          A shared pinboard for AUSTians — post sticky notes, coordinate group projects,
          pin important announcements, and keep your semester chaos under control.
        </p>
        <div className="cz-feature-pills" style={{ '--pill-color': 'var(--accent-blue)' }}>
          <span><Pin size={13} /> Pinboard</span>
          <span><StickyNote size={13} /> Sticky Notes</span>
          <span><ListChecks size={13} /> Group Tasks</span>
          <span><Sparkles size={13} /> Coming Soon</span>
        </div>
      </div>
    </div>
  );
}
