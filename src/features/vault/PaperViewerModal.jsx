import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getPaperForViewing } from '../../utils/questionBankStorage';
import { formatPaperLabel, getPaperNo } from './vaultExamTypes';

export default function PaperViewerModal({ paperId, onClose }) {
  const [paper, setPaper] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!paperId) return;

    let cancelled = false;

    async function openPaper() {
      try {
        const loadedPaper = await getPaperForViewing(paperId);
        if (cancelled) return;
        setPaper(loadedPaper);
        setError('');
      } catch (loadError) {
        if (cancelled) return;
        setPaper(null);
        setError(loadError.message || 'Could not open this paper.');
      }
    }

    openPaper();
    return () => {
      cancelled = true;
    };
  }, [paperId]);

  if (!paperId) return null;

  const title = paper ? formatPaperLabel(paper.type, getPaperNo(paper)) : 'Question Paper';
  const isPdf =
    paper?.fileType === 'pdf' || String(paper?.fileName || '').toLowerCase().endsWith('.pdf');
  const pdfSrc = paper?.fileData ? `${paper.fileData}#toolbar=0&navpanes=0` : '';

  return createPortal(
    <div className="qb-paper-viewer-backdrop" onClick={onClose}>
      <div
        className="qb-paper-viewer glass-card-static"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="qb-paper-viewer-header">
          <div>
            <h3 style={{ margin: 0, fontSize: 'var(--fs-md)' }}>{title}</h3>
            {paper && (
              <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                {paper.course} · {paper.name} · {paper.year} {paper.semester}
              </p>
            )}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close viewer">
            <X size={18} />
          </button>
        </div>

        <div className="qb-paper-viewer-body">
          {error ? (
            <p className="qb-protected-error" style={{ padding: 'var(--sp-5)', textAlign: 'center' }}>
              {error}
            </p>
          ) : paper ? (
            isPdf ? (
              <iframe
                title={title}
                src={pdfSrc}
                className="qb-paper-viewer-frame"
              />
            ) : (
              <img src={paper.fileData} alt={title} className="qb-paper-viewer-image" />
            )
          ) : (
            <p style={{ padding: 'var(--sp-5)', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Opening paper…
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
