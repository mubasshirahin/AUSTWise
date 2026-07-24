import { NotebookPen, FileText, Printer } from 'lucide-react';
import './CoverPageGeneratorPage.css';
import '../../components/PageHero.css';

export default function CoverPageGeneratorPage() {
  return (
    <div className="cpgen-page animate-fadeIn">
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <NotebookPen size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">Cover Page Generator</span>
              </h1>
              <p className="page-hero-subtitle">
                Generate professional assignment and lab report cover pages in seconds.
              </p>
            </div>
          </div>
        </div>
      </header>
      <div className="cpgen-coming-soon">
        <div className="cpgen-cs-card">
          <FileText size={32} strokeWidth={1.5} />
          <h2>Cover Page Generator — Coming Soon</h2>
          <p>Select your department, course code, batch, and section — we'll generate a beautifully formatted cover page ready for print.</p>
          <div className="cpgen-feature-pills">
            <span><NotebookPen size={14} /> Assignment Covers</span>
            <span><Printer size={14} /> Print-Ready PDF</span>
            <span><FileText size={14} /> Lab Report Covers</span>
          </div>
        </div>
      </div>
    </div>
  );
}
