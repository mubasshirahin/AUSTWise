import { FileSpreadsheet } from 'lucide-react';
import TranscriptTemplatesPanel from '../admin/TranscriptTemplatesPanel';
import './DashboardPage.css';

export default function TranscriptTemplatesPage() {
  return (
    <div className="dashboard-page animate-fadeIn">
      <div className="dashboard-header-section">
        <div className="flex items-center gap-3">
          <div className="icon" style={{ backgroundColor: 'var(--accent-cyan-glow)', color: 'var(--accent-cyan)', padding: '8px', borderRadius: '12px' }}>
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <h1 className="page-title">Transcript Templates</h1>
            <p className="page-description">Manage course templates for different semesters. Users can load these templates to quickly populate their transcript.</p>
          </div>
        </div>
      </div>

      <TranscriptTemplatesPanel />
    </div>
  );
}