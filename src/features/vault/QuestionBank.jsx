import { useState, useMemo, useEffect, useCallback } from 'react';
import { BookOpen, CheckCircle, Trash2, Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getQuestionBankSummaries,
  deleteQuestionPaper,
  migrateQuestionBankFilesToIndexedDb,
} from '../../utils/questionBankStorage';
import {
  getQuestionBankTerms,
  getDefaultQuestionBankTermKey,
  getExamTypesForCourseType,
  getQuestionBankSubtitle,
  formatPaperLabel,
  getPaperNo,
} from './vaultUtils';
import AddQuestionPaper from './AddQuestionPaper';
import PaperViewerModal from './PaperViewerModal';

export default function QuestionBank({ vaultContext }) {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState('All');
  const [selectedTermKey, setSelectedTermKey] = useState(getDefaultQuestionBankTermKey);
  const [, setRefreshKey] = useState(0);
  const [viewingPaperId, setViewingPaperId] = useState(null);

  const { department, yearSem, course, courseName, courseType = 'Theory' } = vaultContext;
  const examTypes = useMemo(() => getExamTypesForCourseType(courseType), [courseType]);
  const typeFilters = useMemo(() => ['All', ...examTypes], [examTypes]);
  const terms = useMemo(() => getQuestionBankTerms(), []);

  const refreshPapers = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  useEffect(() => {
    migrateQuestionBankFilesToIndexedDb().then(() => {
      refreshPapers();
    });
  }, [refreshPapers]);

  useEffect(() => {
    setSelectedTermKey(getDefaultQuestionBankTermKey());
    setSelectedType('All');
  }, [department, yearSem, course, courseType]);

  const selectedTerm = useMemo(
    () => terms.find((term) => term.key === selectedTermKey) || terms[0],
    [terms, selectedTermKey],
  );

  const courseQuestions = getQuestionBankSummaries().filter(
    (item) =>
      item.department === department &&
      item.yearSem === yearSem &&
      item.course === course,
  );

  const termQuestions = useMemo(() => {
    if (!selectedTerm) return [];
    return courseQuestions.filter(
      (item) => item.year === selectedTerm.year && item.semester === selectedTerm.season,
    );
  }, [courseQuestions, selectedTerm]);

  const filteredItems = useMemo(() => {
    return termQuestions.filter((item) => {
      const matchType = selectedType === 'All' || item.type === selectedType;
      return matchType;
    });
  }, [termQuestions, selectedType]);

  const getTermPaperCount = (term) =>
    courseQuestions.filter(
      (item) => item.year === term.year && item.semester === term.season,
    ).length;

  const handleView = (item) => {
    if (!item.hasFile) {
      alert('No file attached to this paper.');
      return;
    }
    setViewingPaperId(item.id);
  };

  const handleDelete = async (item, event) => {
    event.stopPropagation();
    try {
      await deleteQuestionPaper(item.id, user?.id, user?.role === 'admin');
      refreshPapers();
    } catch (deleteError) {
      alert(deleteError.message || 'Could not delete paper.');
    }
  };

  const canDelete = (item) =>
    item.isUserUpload && (item.contributorId === user?.id || user?.role === 'admin');

  return (
    <div className="glass-card-static schedule-widget question-bank-container animate-fadeInUp">
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <BookOpen size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Vault</span>
            <div className="schedule-title">Question Bank</div>
            <span className="schedule-subtitle">
              {courseName} — {getQuestionBankSubtitle(courseType)}
            </span>
          </div>
        </div>

        <div className="schedule-masthead-center" />

        <div className="schedule-actions" />
      </div>

      <div className="schedule-dotted-divider" />

      <div className="qb-year-section">
        <p className="qb-year-section-label">Academic Year</p>
        <div className="qb-year-slider-wrap">
          <div className="qb-term-nav qb-year-slider" role="tablist" aria-label="Academic year">
            {terms.map((term) => {
              const paperCount = getTermPaperCount(term);
              const isActive = term.key === selectedTermKey;

              return (
                <button
                  key={term.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`qb-term-chip ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedTermKey(term.key)}
                >
                  <span>{term.label}</span>
                  {paperCount > 0 && <span className="qb-term-chip-count">{paperCount}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="qb-type-nav qb-type-nav-standalone" role="tablist" aria-label="Paper type">
        {typeFilters.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={selectedType === t}
            className={`qb-term-chip ${selectedType === t ? 'active' : ''}`}
            onClick={() => setSelectedType(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <div className="empty-state" style={{ padding: '32px 16px', textAlign: 'center' }}>
          <BookOpen size={32} style={{ color: 'var(--text-tertiary)', marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', margin: 0 }}>
            No question papers for {courseName} in {selectedTerm?.label}.
          </p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', marginTop: '8px' }}>
            Be the first to upload using Add Question Paper above.
          </p>
        </div>
      ) : (
        <div className="grid-3">
          {filteredItems.map((item) => {
            const paperLabel = formatPaperLabel(item.type, getPaperNo(item));

            return (
            <div
              key={item.id}
              className="glass-card qb-paper-card"
              role="button"
              tabIndex={0}
              onClick={() => handleView(item)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleView(item);
                }
              }}
            >
              <div>
                <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                  <span className="badge badge-purple" style={{ fontSize: '10px' }}>
                    {item.course}
                  </span>
                  <div className="flex gap-1 flex-wrap">
                    {item.isUserUpload && (
                      <span className="badge badge-amber" style={{ fontSize: '8px' }}>
                        UPLOADED
                      </span>
                    )}
                    <span className="badge badge-blue" style={{ fontSize: '9px' }}>
                      {item.year} - {item.semester}
                    </span>
                  </div>
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: 'var(--fw-bold)', margin: '8px 0' }}>
                  {paperLabel}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.name}</p>
                {item.isUserUpload && item.contributorName && (
                  <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    Uploaded by {item.contributorName}
                  </p>
                )}
              </div>

              <div
                className="flex justify-between items-center mt-6 pt-3"
                style={{ borderTop: '1px solid var(--border-secondary)' }}
              >
                <div className="flex items-center gap-2">
                  {item.solved ? (
                    <span
                      className="badge badge-emerald"
                      style={{
                        fontSize: '8px',
                        padding: '1px 6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <CheckCircle size={10} /> SOLVED
                    </span>
                  ) : (
                    <span className="badge badge-rose" style={{ fontSize: '8px', padding: '1px 6px' }}>
                      PENDING
                    </span>
                  )}
                  {canDelete(item) && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={(event) => handleDelete(item, event)}
                      title="Delete upload"
                      style={{ padding: '2px 6px' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <span
                  className="qb-paper-view-hint"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                >
                  <Eye size={12} /> View
                </span>
              </div>
            </div>
            );
          })}
        </div>
      )}

      <AddQuestionPaper
        vaultContext={vaultContext}
        selectedTerm={selectedTerm}
        onAdded={refreshPapers}
      />

      {viewingPaperId && (
        <PaperViewerModal paperId={viewingPaperId} onClose={() => setViewingPaperId(null)} />
      )}
    </div>
  );
}
