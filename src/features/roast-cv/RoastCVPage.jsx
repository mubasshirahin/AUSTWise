import { Flame, FileBadge, Sparkles } from 'lucide-react';
import './RoastCVPage.css';
import '../../components/PageHero.css';

export default function RoastCVPage() {
  return (
    <div className="roastcv-page animate-fadeIn">
      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <Flame size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Productivity</span>
            <div className="schedule-title">Roast CV</div>
            <span className="schedule-subtitle">Upload your CV and get brutally honest, AI-powered feedback to land your dream job.</span>
          </div>
        </div>
        <div className="schedule-masthead-center" />
      </div>

      <div className="schedule-dotted-divider" style={{ marginTop: 0 }} />
      <div className="roastcv-coming-soon">
        <div className="roastcv-cs-card">
          <FileBadge size={32} strokeWidth={1.5} />
          <h2>CV Roaster — Coming Soon</h2>
          <p>Our AI will analyze your CV for formatting, ATS compatibility, keyword optimization, and overall impact. Get actionable roast feedback that actually helps.</p>
          <div className="roastcv-feature-pills">
            <span><Sparkles size={14} /> AI-Powered Analysis</span>
            <span><FileBadge size={14} /> ATS Score Check</span>
            <span><Flame size={14} /> Brutal Honesty</span>
          </div>
        </div>
      </div>
    </div>
  );
}
