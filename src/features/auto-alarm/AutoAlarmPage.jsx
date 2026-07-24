import { AlarmClock, BellRing, CalendarClock } from 'lucide-react';
import './AutoAlarmPage.css';
import '../../components/PageHero.css';

export default function AutoAlarmPage() {
  return (
    <div className="aa-page animate-fadeIn">
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <AlarmClock size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">Auto Alarm</span>
              </h1>
              <p className="page-hero-subtitle">
                Automatically set alarms based on your class routine — never miss a lecture again.
              </p>
            </div>
          </div>
        </div>
      </header>
      <div className="aa-coming-soon">
        <div className="aa-cs-card">
          <BellRing size={32} strokeWidth={1.5} />
          <h2>Smart Alarms — Coming Soon</h2>
          <p>Link your class routine and we'll automatically set alarms before each class. Customise buffer time, snooze preferences, and get wake-up alarms for morning lectures.</p>
          <div className="aa-feature-pills">
            <span><CalendarClock size={14} /> Routine Sync</span>
            <span><AlarmClock size={14} /> Custom Buffer</span>
            <span><BellRing size={14} /> Smart Snooze</span>
          </div>
        </div>
      </div>
    </div>
  );
}
