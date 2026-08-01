import Notebook from './Notebook';
import './Notebook.css';
import './VaultPage.css';
import '../../components/PageHero.css';
import { StickyNote } from 'lucide-react';

// Standalone Notebook page — moved out of the Vault into its own sidebar entry.
// Uses a fixed default context so notes are saved under one stable storage key.
const DEFAULT_CONTEXT = { department: 'General', yearSem: 'All' };

export default function NotebookPage() {
  return (
    <div className="vault-page animate-fadeIn">
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <StickyNote size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">Notebook</span>
              </h1>
              <p className="page-hero-subtitle">
                Your notes, whiteboard &amp; study canvas
              </p>
            </div>
          </div>
        </div>
      </header>

      <Notebook vaultContext={DEFAULT_CONTEXT} batch={null} />
    </div>
  );
}
