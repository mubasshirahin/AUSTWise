import { BookOpen } from 'lucide-react';
import Cheatsheets from './Cheatsheets';
import './Cheatsheets.css';
import '../../components/PageHero.css';

export default function CheatsheetsPage() {
  return (
    <div className="csh-page animate-fadeIn">
      {/* ── Hero ── */}
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <BookOpen size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">Cheat Sheets</span>
              </h1>
              <p className="page-hero-subtitle">
                Quick-reference formula sheets across all departments and topics.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Cheatsheets ── */}
      <Cheatsheets vaultContext={{ course: null, courseName: 'All courses' }} />
    </div>
  );
}
