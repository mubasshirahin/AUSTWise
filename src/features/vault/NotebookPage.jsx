import { NotebookPen } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAdminMode from '../../hooks/useAdminMode';
import SidebarPageAccessPanel, { SidebarPageAccessHeader } from '../admin/SidebarPageAccessPanel';
import './Notebook.css';
import './VaultPage.css';
import './vault-tokens.css';

export default function NotebookPage() {
  const { isAdmin } = useAdminMode();

  return (
    <div className="vault-page notebook-page animate-fadeIn">
      {/* ── Hero ── */}
      {isAdmin ? <SidebarPageAccessHeader pageKey="/notebook" /> : <header className="nb-hero">
        <div className="nb-hero-content">
          <div className="nb-hero-eyebrow">
            <span className="nb-hero-period-icon">
              <NotebookPen size={16} />
            </span>
            <span className="nb-hero-date-label">Your notes &amp; library</span>
          </div>
          <h1 className="nb-hero-title">
            Note<span className="nb-hero-name">book</span>
          </h1>
          <p className="nb-hero-subtitle">Handwritten notes with pen and paper — coming soon.</p>
        </div>
      </header>}

      {isAdmin && <SidebarPageAccessPanel pageKey="/notebook" part="parent" />}

      {/* ── Coming soon ── */}
      {isAdmin ? <SidebarPageAccessPanel pageKey="/notebook" featureKey="feature:notebook:main" part="child" /> : (
        <div className="vl-content-card">
          <div className="vault-coming-soon" style={{ border: 'none', boxShadow: 'none', padding: '48px 24px' }}>
            <NotebookPen size={48} strokeWidth={1.5} />
            <h3>Coming Soon</h3>
            <p>A real pen-and-paper notebook — with Apple Pencil pressure, shapes, and paper templates. Coming soon!</p>
            <Link to="/resource-vault?tab=notebook" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}>
              Open in Resource Vault
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
