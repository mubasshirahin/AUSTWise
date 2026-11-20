import { Sparkles } from 'lucide-react';
import '../../daily-life/DailyMasthead.css';
import './ChillMasthead.css';

/* Shared DownTime tab that is not built yet: dl-head masthead + empty state
   (skill-style §2 / §6). */
export default function ComingSoonTab({ icon: Icon, title, subtitle, hint, features }) {
  return (
    <div className="cz-tab">
      <header className="dl-head">
        <div className="dl-head-title">
          <div className="dl-head-tile" aria-hidden="true"><Icon size={20} strokeWidth={2.1} /></div>
          <div className="dl-head-text">
            <span className="dl-head-overline">DownTime</span>
            <h2 className="dl-head-name">{title}</h2>
            <span className="dl-head-subtitle">{subtitle}</span>
          </div>
        </div>
        <dl className="dl-head-stats">
          <div className="dl-head-stat"><dt>Features</dt><dd>{features.length}</dd></div>
          <div className="dl-head-stat"><dt>Status</dt><dd className="is-small">Coming soon</dd></div>
        </dl>
      </header>

      <div className="cz-empty">
        <span className="cz-empty-icon"><Icon size={16} /></span>
        <p className="cz-empty-hint">{hint}</p>
        <ul className="cz-empty-features">
          {features.map(({ icon: FIcon, label }) => (
            <li key={label}><FIcon size={12} /> {label}</li>
          ))}
        </ul>
        <span className="cz-empty-badge"><Sparkles size={12} /> Coming soon</span>
      </div>
    </div>
  );
}
