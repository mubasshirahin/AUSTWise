import { HardDrive } from 'lucide-react';

export default function VaultMasthead({
  title = 'Batch Drive',
  subtitle = 'Study materials & drive',
  actions,
}) {
  return (
    <>
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <HardDrive size={22} />
          </div>
          <div>
            <span className="schedule-overline">
              Resource Vault
            </span>
            <p className="schedule-title">{title}</p>
            <span className="schedule-subtitle">{subtitle}</span>
          </div>
        </div>
        <div className="schedule-masthead-center" />
        <div className="schedule-actions">{actions}</div>
      </div>
      <div className="vault-masthead-divider" />
    </>
  );
}