import { HardDrive } from 'lucide-react';
import '../daily-life/DailyMasthead.css';

/**
 * Shared Resource Vault masthead — the house `dl-head` (skill-style §2).
 * `stats`: [{ label, value, alert?, small? }] — 2-4 values the tab already has.
 * `actions`: optional node for the right-hand slot (bare icon buttons).
 */
export default function VaultMasthead({
  icon: Icon = HardDrive,
  title = 'Batch Drive',
  subtitle = 'Study materials & drive',
  stats = [],
  actions,
}) {
  return (
    <header className={`dl-head vl-head${actions ? ' has-actions' : ''}`}>
      <div className="dl-head-title">
        <div className="dl-head-tile" aria-hidden="true"><Icon size={20} strokeWidth={2.1} /></div>
        <div className="dl-head-text">
          <span className="dl-head-overline">Resource Vault</span>
          <h2 className="dl-head-name">{title}</h2>
          {subtitle && <span className="dl-head-subtitle">{subtitle}</span>}
        </div>
      </div>
      {stats.length > 0 && (
        <dl className="dl-head-stats">
          {stats.map((s) => (
            <div key={s.label} className={`dl-head-stat${s.alert ? ' is-alert' : ''}`}>
              <dt>{s.label}</dt>
              <dd className={s.small ? 'is-small' : undefined}>{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {actions && <div className="dl-head-actions">{actions}</div>}
    </header>
  );
}
