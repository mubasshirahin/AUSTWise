/**
 * HistoryPanel — the last 20 previews, stored on the server.
 *
 * This is deliberately separate from Saved: Saved is the student's permanent
 * collection, History records every preview automatically (and is capped at
 * 20). Opening a history entry puts it back into the Analyzer tab.
 */

/* eslint-disable react-hooks/set-state-in-effect -- intentional fetch-on-mount */

import { useCallback, useEffect, useState } from 'react';
import {
  Bookmark,
  BookOpenCheck,
  Clock,
  History as HistoryIcon,
  Info,
  Layers,
  ListChecks,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { saveAnalysis, formatSavedAt } from './qbaSavedStore';
import {
  clearPreviewHistory,
  deletePreviewHistoryEntry,
  getPreviewHistory,
} from './qbaHistoryStore';
import './SavedAnalysesPanel.css';
import './HistoryPanel.css';

export default function HistoryPanel({ onOpen, onSaved, onCountChange }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getPreviewHistory();
      setEntries(data);
    } catch {
      setError('Could not load your preview history. Check your connection and try again.');
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

  const handleOpen = (entry) => {
    onOpen?.(entry);
  };

  const handleSave = async (entry) => {
    setBusyId(entry.id);
    setNotice('');
    const saved = await saveAnalysis({
      courseCode: entry.courseCode,
      courseTitle: entry.courseTitle,
      displayData: entry.displayData,
    });
    setBusyId('');
    if (!saved) {
      setNotice('Could not save this preview. Check your connection and try again.');
      return;
    }
    setNotice('Saved. It is now in the Saved tab as well.');
    onSaved?.(saved);
  };

  const handleDelete = async (id) => {
    setBusyId(id);
    setNotice('');
    const ok = await deletePreviewHistoryEntry(id);
    setBusyId('');
    if (!ok) {
      setNotice('Could not remove that preview from history. Try again.');
      return;
    }
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const handleClear = async () => {
    setClearing(true);
    setNotice('');
    const ok = await clearPreviewHistory();
    setClearing(false);
    if (!ok) {
      setNotice('Could not clear the history. Try again.');
      return;
    }
    setEntries([]);
  };

  if (loading) {
    return (
      <div className="qba-saved-loading">
        <Loader2 size={22} className="qba-spin" aria-hidden="true" />
        <span>Loading preview history…</span>
      </div>
    );
  }

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

  if (!entries.length) {
    return (
      <div className="qba-saved-empty">
        <HistoryIcon size={36} className="qba-saved-empty-icon" aria-hidden="true" />
        <h3>No previews yet</h3>
        <p>
          Build a preview in the <strong>Analyzer</strong> tab. The last 20 previews
          appear here automatically — you do not need to press <strong>Save Preview</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="qba-saved-panel">
      <div className="qba-saved-panel-head">
        <div className="qba-saved-panel-title-group">
          <HistoryIcon size={16} aria-hidden="true" />
          <span>
            {entries.length} recent preview{entries.length === 1 ? '' : 's'}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm qba-saved-clear-btn"
          onClick={handleClear}
          disabled={clearing}
          title="Clear the preview history"
        >
          {clearing ? <Loader2 size={13} className="qba-spin" aria-hidden="true" /> : <Trash2 size={13} aria-hidden="true" />}
          Clear history
        </button>
      </div>

      <div className="qba-saved-panel-info">
        <Info size={14} aria-hidden="true" />
        <span>
          Every Preview is recorded here automatically. Only the newest 20 are kept;
          items you want forever still belong in the Saved tab.
        </span>
      </div>

      {notice ? (
        <div className="qba-history-notice" role="status" aria-live="polite">
          <Info size={13} aria-hidden="true" />
          <span>{notice}</span>
        </div>
      ) : null}

      <div className="qba-saved-list">
        {entries.map((entry) => {
          const topics = Array.isArray(entry.displayData?.topics)
            ? entry.displayData.topics
            : [];
          const topTopics = topics.slice(0, 3).map((topic) => topic.name).filter(Boolean);
          const label = entry.courseCode || entry.courseTitle || 'Unnamed course';
          return (
            <div className="qba-saved-card glass-card-static qba-history-card" key={entry.id}>
              <div className="qba-history-row">
                <button
                  type="button"
                  className="qba-history-open"
                  onClick={() => handleOpen(entry)}
                  title="Open this preview in the Analyzer"
                >
                  <div className="qba-saved-card-course">
                    {entry.courseCode ? <span className="qba-saved-card-code">{entry.courseCode}</span> : null}
                    {entry.courseTitle ? <span className="qba-saved-card-title">{entry.courseTitle}</span> : null}
                    {!entry.courseCode && !entry.courseTitle
                      ? <span className="qba-saved-card-title qba-saved-muted">Unnamed course</span>
                      : null}
                  </div>
                  <div className="qba-saved-card-meta">
                    <span className="qba-saved-card-meta-item">
                      <Clock size={13} aria-hidden="true" />
                      {formatSavedAt(entry.createdAt)}
                    </span>
                    <span className="qba-saved-card-meta-sep" aria-hidden="true">·</span>
                    <span className="qba-saved-card-meta-item">
                      <Layers size={13} aria-hidden="true" />
                      {entry.topicCount || topics.length} topic{(entry.topicCount || topics.length) === 1 ? '' : 's'}
                    </span>
                    <span className="qba-saved-card-meta-sep" aria-hidden="true">·</span>
                    <span className="qba-saved-card-meta-item">
                      <ListChecks size={13} aria-hidden="true" />
                      {entry.questionCount} question{entry.questionCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  {topTopics.length ? (
                    <div className="qba-history-topics">
                      {topTopics.map((name) => (
                        <span className="qba-history-topic" key={name}>{name}</span>
                      ))}
                      {topics.length > topTopics.length ? (
                        <span className="qba-history-topic qba-history-topic-more">
                          +{topics.length - topTopics.length} more
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </button>

                <div className="qba-saved-card-right">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpen(entry)}
                  >
                    <BookOpenCheck size={13} aria-hidden="true" />
                    <span className="qba-saved-btn-label">Open</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSave(entry)}
                    disabled={busyId === entry.id}
                    title="Add this preview to the Saved tab"
                  >
                    {busyId === entry.id
                      ? <Loader2 size={13} className="qba-spin" aria-hidden="true" />
                      : <Bookmark size={13} aria-hidden="true" />}
                    <span className="qba-saved-btn-label">Save</span>
                  </button>
                  <button
                    type="button"
                    className="qba-saved-card-delete"
                    onClick={() => handleDelete(entry.id)}
                    disabled={busyId === entry.id}
                    aria-label={`Remove preview for ${label} from history`}
                    title="Remove from history"
                  >
                    {busyId === entry.id
                      ? <Loader2 size={14} className="qba-spin" aria-hidden="true" />
                      : <Trash2 size={14} aria-hidden="true" />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
