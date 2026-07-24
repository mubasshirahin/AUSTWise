import { Award, BadgeCheck, Download } from 'lucide-react';
import './CertificatePage.css';
import '../../components/PageHero.css';

export default function CertificatePage() {
  return (
    <div className="cert-page animate-fadeIn">
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <Award size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">Certificate</span>
              </h1>
              <p className="page-hero-subtitle">
                Generate, manage, and download your academic and extracurricular certificates.
              </p>
            </div>
          </div>
        </div>
      </header>
      <div className="cert-coming-soon">
        <div className="cert-cs-card">
          <BadgeCheck size={32} strokeWidth={1.5} />
          <h2>Certificate Hub — Coming Soon</h2>
          <p>Design and generate professional certificates for workshops, competitions, club events, and academic achievements. Download as high-quality PDF.</p>
          <div className="cert-feature-pills">
            <span><Award size={14} /> Certificate Generator</span>
            <span><BadgeCheck size={14} /> Verified Badges</span>
            <span><Download size={14} /> PDF Download</span>
          </div>
        </div>
      </div>
    </div>
  );
}
