/**
 * SavedAnalysesPanel — server-synced
 *
 * Loads saved QBA analyses from the server (/api/store/user/…).
 * Clicking a card expands it to show the full PreviewPanel with download
 * buttons, exactly like the Analyzer tab.
 */
/* eslint-disable react-hooks/set-state-in-effect -- intentional state updates in effects for data fetching and UI initialization */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  BookOpenCheck,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Info,
  Loader2,
  Printer,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import PreviewPanel from './PreviewPanel';
import PrintReport, { PrintPortal } from './PrintReport';
import { downloadReportImagePdf, reportBaseName } from './qbaPdf';
import { attachImagesToReport } from './qbaImageStore';
import useQbaImages from './useQbaImages';
import {
  clearAllAnalyses,
  deleteAnalysis,
  formatSavedAt,
  getSavedAnalyses,
} from './qbaSavedStore';
import './SavedAnalysesPanel.css';

/* ── helpers ──────────────────────────────────────────────────────────────── */

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 40)));
  });
}

/* ── single saved-entry card ───────────────────────────────────────────────── */

function SavedCard({ entry, onDelete }) {
  const { id, savedAt, courseCode, courseTitle, displayData } = entry;

  const [expanded, setExpanded]     = useState(false);
  const [openTopics, setOpenTopics] = useState(() => new Set());
  const [busy, setBusy]             = useState(''); // 'print' | 'image' | 'delete'
  const [notice, setNotice]         = useState('');
  const [printMount, setPrintMount] = useState(false);
  const [printData, setPrintData]   = useState(null);
  const reportRef = useRef(null);
  const cardRef   = useRef(null);

  // The pictures attached to this course — the same ones the Analyzer tab
  // shows, so a saved analysis keeps its figures.
  const pictures = useQbaImages(courseCode);
  const printableData = useMemo(
    () => attachImagesToReport(displayData, pictures.courseKey, pictures.byQuestion),
    [displayData, pictures.courseKey, pictures.byQuestion],
  );

  const topicCount    = displayData?.summary?.topicCount    ?? displayData?.topics?.length ?? 0;
  const questionCount = displayData?.summary?.totalQuestions ?? 0;
  const label         = courseCode || courseTitle || 'Unnamed course';

  // Seed open topics on first expand
  useEffect(() => {
    if (!expanded || openTopics.size > 0) return;
    const topics = displayData?.topics ?? [];
    const vip    = topics.filter((t) => t.priority === 'VIP');
    const seed   = vip.length ? vip : topics.slice(0, 1);
    setOpenTopics(new Set(seed.map((t) => t.name)));
  }, [expanded, displayData, openTopics.size]);

  const toggleExpand = () => {
    const opening = !expanded;
    setExpanded(opening);
    if (opening) {
      requestAnimationFrame(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const handlePrint = async (e) => {
    e.stopPropagation();
    if (!displayData?.topics?.length) {
      setNotice('Nothing to export — this saved analysis has no topics.');
      return;
    }
    setNotice('');
    const prevTitle = document.title;
    document.title  = `${reportBaseName(courseCode)}_question_bank_analysis`;
    setPrintData(printableData);
    setPrintMount(true);
    setBusy('print');
    document.documentElement.classList.add('qba-printing');

    // Wait for PrintPortal to fully mount and paint in document.body
    await waitForPaint();
    // Extra frames to ensure portal content is fully laid out
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 100));

    let cleaned = false;
    let timer   = null;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearTimeout(timer);
      document.documentElement.classList.remove('qba-printing');
      setPrintMount(false);
      setPrintData(null);
      setBusy('');
      document.title = prevTitle;
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    // Fallback: clean up after 30 seconds (not 120) in case afterprint doesn't fire
    timer = window.setTimeout(cleanup, 30000);
    try {
      window.print();
    } catch {
      cleanup();
      setNotice('Your browser blocked the print dialog. Use Quick Download instead.');
    }
  };

  const handleQuickDownload = async (e) => {
    e.stopPropagation();
    if (!displayData?.topics?.length) {
      setNotice('Nothing to export — this saved analysis has no topics.');
      return;
    }
    setNotice('');
    setBusy('image');
    try {
      await waitForPaint();
      const node = reportRef.current;
      if (!node) throw new Error('The report is still rendering. Please try again.');
      await downloadReportImagePdf(node, courseCode);
    } catch (error) {
      setNotice(error?.message || 'The image PDF could not be created. Try Download PDF instead.');
    } finally {
      setBusy('');
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    setBusy('delete');
    await onDelete(id);
    setBusy('');
  };

  return (
    <div
      className={`qba-saved-card glass-card-static${expanded ? ' qba-saved-card-open' : ''}`}
      ref={cardRef}
    >
      {/* ── header row ──
           NOTE: this row must NOT be a <button>. Interactive controls cannot
           be nested inside a <button> — Chrome retargets their clicks to the
           outer button, which made Download PDF / Quick Download do nothing
           but expand the card. The info block and the chevron are the two
           real expand toggles; the download/delete buttons are siblings. */}
      <div className="qba-saved-card-header">
        <button
          type="button"
          className="qba-saved-card-toggle"
          onClick={toggleExpand}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} analysis for ${label}`}
        >
          <div className="qba-saved-card-info">
            <div className="qba-saved-card-course">
              {courseCode  ? <span className="qba-saved-card-code">{courseCode}</span>  : null}
              {courseTitle ? <span className="qba-saved-card-title">{courseTitle}</span> : null}
              {!courseCode && !courseTitle
                ? <span className="qba-saved-card-title qba-saved-muted">Unnamed course</span>
                : null}
            </div>
            <div className="qba-saved-card-meta">
              <span className="qba-saved-card-meta-item">
                <BookOpenCheck size={13} aria-hidden="true" />
                {topicCount} topic{topicCount !== 1 ? 's' : ''}
              </span>
              <span className="qba-saved-card-meta-sep" aria-hidden="true">·</span>
              <span className="qba-saved-card-meta-item">
                {questionCount} question{questionCount !== 1 ? 's' : ''}
              </span>
              <span className="qba-saved-card-meta-sep" aria-hidden="true">·</span>
              <span className="qba-saved-card-meta-item qba-saved-muted" title={savedAt}>
                {formatSavedAt(savedAt)}
              </span>
            </div>
          </div>
        </button>

        <div className="qba-saved-card-right">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handlePrint}
            disabled={Boolean(busy)}
            title="Download PDF (print dialog)"
          >
            {busy === 'print'
              ? <Loader2 size={13} className="qba-spin" aria-hidden="true" />
              : <Printer size={13} aria-hidden="true" />}
            <span className="qba-saved-btn-label">
              {busy === 'print' ? 'Opening…' : 'Download PDF'}
            </span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleQuickDownload}
            disabled={Boolean(busy)}
            title="Quick Download (image PDF)"
          >
            {busy === 'image'
              ? <Loader2 size={13} className="qba-spin" aria-hidden="true" />
              : <ImageIcon size={13} aria-hidden="true" />}
            <span className="qba-saved-btn-label">
              {busy === 'image' ? 'Building…' : 'Quick Download'}
            </span>
          </button>
          <button
            type="button"
            className="qba-saved-card-delete"
            onClick={handleDelete}
            disabled={busy === 'delete'}
            aria-label={`Delete saved analysis for ${label}`}
            title="Delete"
          >
            {busy === 'delete'
              ? <Loader2 size={14} className="qba-spin" aria-hidden="true" />
              : <Trash2 size={14} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="qba-saved-chevron"
            onClick={toggleExpand}
            aria-label={expanded ? 'Collapse analysis' : 'Expand analysis'}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {notice ? (
        <div className="qba-saved-card-notice" role="status" aria-live="polite">
          <Info size={13} aria-hidden="true" />
          <span>{notice}</span>
        </div>
      ) : null}

      {/* ── expanded: full PreviewPanel ── */}
      {expanded ? (
        <div className="qba-saved-card-body">
          <div className="qba-saved-divider" />
          <PreviewPanel
            data={displayData}
            openTopics={openTopics}
            onToggleTopic={(name) => setOpenTopics((prev) => {
              const next = new Set(prev);
              next.has(name) ? next.delete(name) : next.add(name);
              return next;
            })}
            onFocusTopic={(name) => setOpenTopics((prev) => {
              const next = new Set(prev); next.add(name); return next;
            })}
            onRevealTopics={(names) => {
              if (!Array.isArray(names)) return;
              setOpenTopics((prev) => {
                const next = new Set(prev);
                names.forEach((n) => next.add(n));
                return next;
              });
            }}
            onMergeQuestions={() => {}}
            onUnmergeQuestions={() => {}}
            courseKey={pictures.courseKey}
            images={pictures.byQuestion}
            onAttachImage={pictures.attach}
            onRemoveImage={pictures.remove}
          />
          {/* bottom download bar */}
          <div className="qba-saved-card-dl-bar">
            <button type="button" className="btn btn-primary btn-sm" onClick={handlePrint} disabled={Boolean(busy)}>
              {busy === 'print' ? <Loader2 size={14} className="qba-spin" aria-hidden="true" /> : <Printer size={14} aria-hidden="true" />}
              {busy === 'print' ? 'Opening print…' : 'Download PDF'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleQuickDownload} disabled={Boolean(busy)}>
              {busy === 'image' ? <Loader2 size={14} className="qba-spin" aria-hidden="true" /> : <ImageIcon size={14} aria-hidden="true" />}
              {busy === 'image' ? 'Building image PDF…' : 'Quick Download (image PDF)'}
            </button>
          </div>
        </div>
      ) : null}

      {/* offscreen capture for image PDF */}
      {!printMount ? (
        <div className="qba-capture-host" aria-hidden="true">
          <PrintReport data={printableData} innerRef={reportRef} />
        </div>
      ) : null}
      {printMount && printData ? <PrintPortal data={printData} /> : null}
    </div>
  );
}

/* ── main panel ────────────────────────────────────────────────────────────── */

export default function SavedAnalysesPanel({ onCountChange }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getSavedAnalyses();
      setEntries(data);
    } catch {
      setError('Could not load saved analyses. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    onCountChange?.(entries.length);
  }, [entries.length, onCountChange]);

  const handleDelete = useCallback(async (id) => {
    await deleteAnalysis(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleClearAll = useCallback(async () => {
    await clearAllAnalyses();
    setEntries([]);
  }, []);

  /* ── loading state ── */
  if (loading) {
    return (
      <div className="qba-saved-loading">
        <Loader2 size={22} className="qba-spin" aria-hidden="true" />
        <span>Loading saved analyses…</span>
      </div>
    );
  }

  /* ── error state ── */
  if (error) {
    return (
      <div className="qba-saved-empty">
        <p style={{ color: 'var(--color-danger, #e05c5c)' }}>{error}</p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
          <RefreshCw size={14} aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  /* ── empty state ── */
  if (!entries.length) {
    return (
      <div className="qba-saved-empty">
        <Bookmark size={36} className="qba-saved-empty-icon" aria-hidden="true" />
        <h3>No saved analyses yet</h3>
        <p>
          Build a preview in the <strong>Analyzer</strong> tab, then press{' '}
          <strong>Save Preview</strong>. Your analysis will appear here and you can
          download it any time — on any device.
        </p>
      </div>
    );
  }

  /* ── list ── */
  return (
    <div className="qba-saved-panel">
      <div className="qba-saved-panel-head">
        <div className="qba-saved-panel-title-group">
          <Bookmark size={16} aria-hidden="true" />
          <span>{entries.length} saved {entries.length === 1 ? 'analysis' : 'analyses'}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={load}
            title="Refresh list"
          >
            <RefreshCw size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm qba-saved-clear-btn"
            onClick={handleClearAll}
            title="Delete all saved analyses"
          >
            <Trash2 size={13} aria-hidden="true" />
            Clear all
          </button>
        </div>
      </div>

      <div className="qba-saved-panel-info">
        <Info size={14} aria-hidden="true" />
        <span>Synced to your account — available on any device. Click a card to view the full analysis.</span>
      </div>

      <div className="qba-saved-list">
        {entries.map((entry) => (
          <SavedCard key={entry.id} entry={entry} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}
