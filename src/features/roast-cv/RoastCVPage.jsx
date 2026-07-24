import { Flame, FileBadge, Sparkles } from 'lucide-react';
import './RoastCVPage.css';
import '../../components/PageHero.css';

export default function RoastCVPage() {
  return (
    <div className="roastcv-page animate-fadeIn">
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <Flame size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">Roast CV</span>
              </h1>
              <p className="page-hero-subtitle">
                Upload your CV and get brutally honest, AI-powered feedback to land your dream job.
              </p>
            </div>
          </div>
        </div>
      </header>
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
