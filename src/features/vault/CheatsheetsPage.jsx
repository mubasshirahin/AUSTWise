import { BookOpen } from 'lucide-react';
import Cheatsheets from './Cheatsheets';
import './Cheatsheets.css';
import '../../components/PageHero.css';
import './vault-tokens.css';

export default function CheatsheetsPage() {
  return (
    <div className="csh-page animate-fadeIn">
      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <BookOpen size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Productivity</span>
            <div className="schedule-title">Cheat Sheets</div>
            <span className="schedule-subtitle">Quick-reference formula sheets across all departments and topics.</span>
          </div>
        </div>
        <div className="schedule-masthead-center" />
      </div>

      <div className="schedule-dotted-divider" style={{ marginTop: 0 }} />

      {/* ── Cheatsheets ── */}
      <Cheatsheets vaultContext={{ course: null, courseName: 'All courses' }} />
    </div>
  );
}
