import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  ClipboardList,
  Crown,
  FileSearch,
  Layers,
  ListChecks,
  Repeat2,
  Sparkles,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import {
  buildPreviewAnalytics,
  buildPreviewInsights,
  compareSemestersDesc,
  PRIORITIES,
} from './previewAnalytics';
import OriginalPanel from './OriginalPanel';
import CropFixer from './CropFixer';
import { resetCropOverrides } from './InsightsShared';
import { getOverrides } from './qbaOriginal';
import './OriginalPanel.css';
import { semesterImageKey } from './qbaImageStore';
import { splitSemesterList } from './parseQuestionBank';
import {
  anchorIdForKey,
  buildPaperSourceReferences,
  buildQuestionMatchIndex,
  questionSignature,
} from './qbaQuestionMatch';
import { PaperWorkspace, TopicWorkspace } from './QuestionWorkspace';
import { OriginalContext } from './qbaOriginalContext';
import './PreviewPanel.css';

const INSIGHT_ICONS = {
  trophy: Trophy,
  crown: Crown,
  clipboard: ClipboardList,
  calendar: CalendarDays,
  repeat: Repeat2,
};

const STAT_ICONS = {
  topics: Layers,
  questions: ListChecks,
  asks: Repeat2,
  vip: Crown,
  semesters: CalendarDays,
  approx: Sparkles,
};

function priorityValue(value) {
  const upper = String(value || 'MEDIUM').toUpperCase();
  return PRIORITIES.includes(upper) ? upper : 'MEDIUM';
}

function PriorityBadge({ priority, small = false }) {
  const value = priorityValue(priority);
  return (
    <span className={`qba-dash-badge qba-dash-badge-${value.toLowerCase()}${small ? ' qba-dash-badge-sm' : ''}`}>
      {value}
    </span>
  );
}

function DonutChart({ segments, total, centerValue, centerLabel, ariaLabel }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const positive = segments.filter((segment) => segment.value > 0);
  const arcs = positive.reduce((result, segment) => {
    const previousEnd = result.length ? result[result.length - 1].end : 0;
    const fraction = total ? segment.value / total : 0;
    result.push({ segment, start: previousEnd, end: previousEnd + fraction, fraction });
    return result;
  }, []);

  return (
    <div className="qba-dash-donut-wrap">
      <div className="qba-dash-donut-box">
        <svg className="qba-dash-donut" viewBox="0 0 120 120" role="img" aria-label={ariaLabel}>
          <circle className="qba-dash-donut-track" cx="60" cy="60" r={radius} />
          {arcs.map(({ segment, start, fraction }) => {
            const length = fraction * circumference;
            const gap = positive.length > 1 ? Math.min(1.8, length / 3) : 0;
            const dash = Math.max(length - gap, 0);
            return (
              <circle
                key={segment.key}
                className={`qba-dash-donut-seg qba-dash-stroke-${segment.tone}`}
                cx="60"
                cy="60"
                r={radius}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-start * circumference}
                transform="rotate(-90 60 60)"
              />
            );
          })}
        </svg>
        <div className="qba-dash-donut-center" aria-hidden="true">
          <span className="qba-dash-donut-value">{centerValue}</span>
          <span className="qba-dash-donut-label">{centerLabel}</span>
        </div>
      </div>
      <ul className="qba-dash-legend">
        {segments.map((segment) => (
          <li className="qba-dash-legend-item" key={segment.key}>
            <span className={`qba-dash-legend-dot qba-dash-bg-${segment.tone}`} aria-hidden="true" />
            <span className="qba-dash-legend-label">
              {segment.label}
              <span className="qba-dash-legend-sub">{segment.sub}</span>
            </span>
            <span className="qba-dash-legend-value">{segment.value}</span>
            <span className="qba-dash-legend-pct">
              {total ? Math.round((segment.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TopicBars({ topics, maxTimes, totalAsked, onFocusTopic }) {
  if (!topics.length) {
    return <p className="qba-dash-muted">No topic data was found.</p>;
  }

  return (
    <ul className="qba-dash-bars">
      {topics.map((topic, index) => {
        const width = topic.timesAsked > 0 ? Math.max(3, (topic.timesAsked / maxTimes) * 100) : 0;
        const share = totalAsked ? Math.round((topic.timesAsked / totalAsked) * 100) : 0;
        return (
          <li key={`${topic.name}-${index}`}>
            <button
              type="button"
              className="qba-dash-bar-row"
              onClick={() => onFocusTopic?.(topic.name)}
              aria-label={`Show questions for ${topic.name}`}
              title={`Show questions for ${topic.name}`}
            >
              <span className="qba-dash-bar-rank">{String(index + 1).padStart(2, '0')}</span>
              <span className="qba-dash-bar-main">
                <span className="qba-dash-bar-top">
                  <span className="qba-dash-bar-name">{topic.name}</span>
                  <span className="qba-dash-bar-value">
                    {topic.timesAsked}
                    <span> asks</span>
                  </span>
                </span>
                <span className="qba-dash-bar-track" aria-hidden="true">
                  <span
                    className={`qba-dash-bar-fill qba-dash-bg-${topic.priority.toLowerCase()}`}
                    style={{ '--qba-bar-width': `${width}%` }}
                  />
                </span>
              </span>
              <span className="qba-dash-bar-share">{share}%</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SemesterBars({ semesters }) {
  if (!semesters.length) {
    return <p className="qba-dash-muted">Semester information was not listed.</p>;
  }

  return (
    <>
      <ul className="qba-dash-sem-chart">
        {semesters.map((semester) => (
          <li className="qba-dash-sem-chart-row" key={semester.name}>
            <div className="qba-dash-sem-chart-head">
              <span className="qba-dash-sem-chart-name">{semester.name}</span>
              <span className="qba-dash-sem-chart-meta">
                {semester.total} q · {semester.asks} asks
              </span>
            </div>
            <div
              className="qba-dash-stack"
              role="img"
              aria-label={`${semester.name}: ${semester.total} questions, ${semester.asks} recorded asks`}
            >
              {PRIORITIES.map((priority) => {
                const count = semester.byPriority[priority] || 0;
                if (!count) return null;
                return (
                  <span
                    key={priority}
                    className={`qba-dash-stack-seg qba-dash-bg-${priority.toLowerCase()}`}
                    style={{ flexGrow: count }}
                    title={`${priority}: ${count} question${count === 1 ? '' : 's'}`}
                  />
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <div className="qba-dash-inline-legend" aria-hidden="true">
        {PRIORITIES.map((priority) => (
          <span className="qba-dash-inline-legend-item" key={priority}>
            <span className={`qba-dash-legend-dot qba-dash-bg-${priority.toLowerCase()}`} />
            {priority}
          </span>
        ))}
      </div>
    </>
  );
}

function ExamBars({ exams, maxCount }) {
  if (!exams.length) {
    return <p className="qba-dash-muted">Exam types were not listed.</p>;
  }

  return (
    <ul className="qba-dash-exam-list">
      {exams.map((exam) => (
        <li className={`qba-dash-exam-row qba-dash-tone-${exam.tone}`} key={exam.label}>
          <div className="qba-dash-exam-head">
            <span className="qba-dash-exam-name">{exam.label}</span>
            <span className="qba-dash-exam-count">
              {exam.count} q · {exam.asks} asks
            </span>
          </div>
          <div className="qba-dash-exam-track" aria-hidden="true">
            <span
              className="qba-dash-exam-fill"
              style={{ '--qba-bar-width': `${Math.max(4, (exam.count / maxCount) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function MatrixRow({ row, maxTimes, onFocusTopic }) {
  const priority = row.priority.toLowerCase();
  const width = row.timesAsked > 0 ? Math.max(3, (row.timesAsked / maxTimes) * 100) : 0;

  return (
    <div className={`qba-dash-matrix-row qba-dash-matrix-${priority}`} role="row">
      <span className="qba-dash-matrix-rank" role="cell">{String(row.rank).padStart(2, '0')}</span>
      <div className="qba-dash-matrix-topic" role="cell">
        <button
          type="button"
          className="qba-dash-matrix-name"
          onClick={() => onFocusTopic?.(row.topic)}
          aria-label={`Show questions for ${row.topic}`}
          title={`Show questions for ${row.topic}`}
        >
          {row.topic}
        </button>
        <span className="qba-dash-matrix-sub">
          {row.questionCount
            ? `${row.questionCount} question${row.questionCount === 1 ? '' : 's'}`
            : 'Topic summary'}
        </span>
      </div>
      <div className="qba-dash-matrix-metrics" role="presentation">
        <div className="qba-dash-matrix-metric qba-dash-matrix-times" role="cell">
          <span className="qba-dash-matrix-label">Times asked</span>
          <span className="qba-dash-matrix-value">{row.timesAsked}</span>
          <span className="qba-dash-meter" aria-hidden="true">
            <span
              className={`qba-dash-meter-fill qba-dash-bg-${priority}`}
              style={{ '--qba-bar-width': `${width}%` }}
            />
          </span>
        </div>
        <div className="qba-dash-matrix-metric" role="cell">
          <span className="qba-dash-matrix-label">Avg marks</span>
          <span className="qba-dash-matrix-value">{row.avgMarks ?? '—'}</span>
        </div>
        <div className="qba-dash-matrix-metric" role="cell">
          <span className="qba-dash-matrix-label">Last asked</span>
          <span className="qba-dash-matrix-value qba-dash-matrix-date">
            {row.lastAsked && row.lastAsked !== '-' ? row.lastAsked : '—'}
          </span>
        </div>
      </div>
      <div className="qba-dash-matrix-priority" role="cell">
        <PriorityBadge priority={row.priority} small />
      </div>
    </div>
  );
}

function StudyPlan({ items, topics }) {
  if (!items.length) {
    return <p className="qba-dash-muted">No study plan was found.</p>;
  }

  const sortedTopics = [...topics].sort(
    (a, b) => String(b.name || '').length - String(a.name || '').length,
  );

  return (
    <ol className="qba-dash-plan">
      {items.map((item, index) => {
        const text = String(item.text || '');
        const lower = text.toLowerCase();
        const topic = sortedTopics.find(
          (candidate) => candidate.name && lower.includes(String(candidate.name).toLowerCase()),
        );
        const priority = topic ? priorityValue(topic.priority).toLowerCase() : 'cyan';
        const startsWithTopic = topic && lower.startsWith(String(topic.name).toLowerCase());
        const lead = startsWithTopic ? topic.name : '';
        const rest = startsWithTopic ? text.slice(topic.name.length) : '';

        return (
          <li className={`qba-dash-plan-item qba-dash-tone-${priority}`} key={item.step ?? index}>
            <span className="qba-dash-plan-num">{String(index + 1).padStart(2, '0')}</span>
            <div className="qba-dash-plan-body">
              <div className="qba-dash-plan-top">
                <p className="qba-dash-plan-text">
                  {lead ? (
                    <>
                      <strong>{lead}</strong>
                      {rest}
                    </>
                  ) : text}
                </p>
                <span className="qba-dash-plan-tags">
                  {index === 0 ? <span className="qba-dash-plan-start">Start here</span> : null}
                  {topic ? <PriorityBadge priority={topic.priority} small /> : null}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
/**
 * The report. `mode` picks one section so the page never shows everything
 * at once: 'topics' (topic-wise questions), 'semesters' (every paper as
 * printed) or 'overview' (charts, VIP matrix, study plan).
 */
export default function PreviewPanel({
  data,
  mode = 'topics',
  activeTopic = '',
  onActiveTopicChange,
  activePaper = '',
  onActivePaperChange,
  onFocusTopic,
  onMergeQuestions,
  onUnmergeQuestions,
  courseKey = '',
  images = {},
  onAttachImage,
  onRemoveImage,
  checklistItems = {},
  onSetChecklist,
  checklistEnabled = false,
  sourceFiles = [],
  messages = null,
}) {
  const [lightbox, setLightbox] = useState(null);
  const [originalTarget, setOriginalTarget] = useState(null); // { qid, questionText }
  const [cropRefresh, setCropRefresh] = useState(0);
  const [cropOverrides, setCropOverrides] = useState({});
  const [fixTarget, setFixTarget] = useState(null);
  const [highlightKey, setHighlightKey] = useState('');
  const pictureInputRef = useRef(null);
  const pendingKeyRef = useRef({ imageKey: '', kind: 'question' });
  const canEditPictures = typeof onAttachImage === 'function';

  const pickPicture = (imageKey, kind = 'question') => {
    pendingKeyRef.current = { imageKey, kind };
    pictureInputRef.current?.click();
  };

  // Escape closes the picture lightbox.
  useEffect(() => {
    if (!lightbox) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightbox]);

  // A topic clicked on a paper question opens the topic-wise list and
  // scrolls to the same question. The list may need a frame to render.
  useEffect(() => {
    if (!highlightKey || mode !== 'topics') return undefined;
    let cancelled = false;
    let tries = 0;
    const tick = () => {
      if (cancelled) return;
      const node = document.getElementById(anchorIdForKey(highlightKey));
      if (node && node.offsetParent !== null) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      tries += 1;
      if (tries < 12) window.setTimeout(tick, 70);
    };
    tick();
    const timer = window.setTimeout(() => setHighlightKey(''), 3200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [highlightKey, mode, activeTopic]);

  const handlePictureFiles = async (imageKey, files, kind = 'question') => {
    if (!imageKey || !files || !files.length) return;
    await onAttachImage?.(imageKey, files, kind);
  };

  // The crop fixes the student saved, read again after every change.
  useEffect(() => {
    let cancelled = false;
    getOverrides()
      .then((all) => { if (!cancelled) setCropOverrides(all); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [cropRefresh]);

  // QID -> paper rows, for the crops and the Original modal.
  const qidRows = useMemo(() => {
    const map = new Map();
    (Array.isArray(data?.semesterPapers) ? data.semesterPapers : []).forEach((paper) => {
      (paper.questions || []).forEach((question, index) => {
        if (!question.qid) return;
        const key = String(question.qid).toUpperCase();
        if (!map.has(key)) map.set(key, []);
        map.get(key).push({
          semester: paper.semester,
          n: question.number ?? index + 1,
          part: String(question.part || '').toLowerCase(),
          exam: question.exam,
          marks: question.marks,
          sourceRegions: question.sourceRegions || [],
          source: question.source || '',
        });
      });
    });
    return map;
  }, [data]);

  // Every paper question is linked to the topic-wise wording it came from.
  // A paper question the AI forgot to put in a TOPIC block is added to an
  // "Other questions" topic, so no semester question is ever left out.
  const matchIndex = useMemo(
    () => buildQuestionMatchIndex(data, courseKey),
    [data, courseKey],
  );
  const sourceRefsByKey = useMemo(
    () => buildPaperSourceReferences(data, courseKey, matchIndex),
    [data, courseKey, matchIndex],
  );
  const { topicData, paperRows } = useMemo(() => {
    const baseTopics = Array.isArray(data?.topics) ? data.topics : [];
    const topicsClone = baseTopics.map((topic) => ({
      ...topic,
      questions: Array.isArray(topic.questions) ? [...topic.questions] : [],
    }));
    const otherTopic = topicsClone.find(
      (topic) => String(topic.name).trim().toLowerCase() === 'other questions',
    ) || {
      name: 'Other questions',
      priority: 'MEDIUM',
      questions: [],
    };
    const otherQuestions = otherTopic.questions;
    const otherBySignature = new Map();
    const otherStartIndex = otherQuestions.length;

    const papers = (Array.isArray(data?.semesterPapers) ? data.semesterPapers : [])
      .map((paper) => ({
        ...paper,
        questions: (Array.isArray(paper.questions) ? paper.questions : []).map((question, index) => {
          const legacyKey = semesterImageKey(courseKey, paper.semester, index);
          const match = matchIndex.match(question.question, question.qid);
          if (match) {
            return { ...question, __match: match, __legacyKey: legacyKey, __topic: match.topic };
          }

          const signature = questionSignature(question.question);
          let added = otherBySignature.get(signature);
          if (!added) {
            added = {
              ...question,
              semester: paper.semester,
              times: question.times || 1,
              originalIndex: otherStartIndex + otherQuestions.length,
              pictureKey: legacyKey,
              addedFromPaper: true,
            };
            otherBySignature.set(signature, added);
            otherQuestions.push(added);
          } else {
            const seen = new Set(
              splitSemesterList(added.semester || '').map((name) => name.toLowerCase()),
            );
            if (paper.semester && !seen.has(paper.semester.toLowerCase())) {
              added.semester = [added.semester, paper.semester].filter(Boolean).join(', ');
            }
            added.times = (added.times || 1) + 1;
          }
          return {
            ...question,
            __match: { topic: 'Other questions', key: added.pictureKey },
            __legacyKey: legacyKey,
            __topic: 'Other questions',
          };
        }),
      }));

    if (otherQuestions.length) {
      otherTopic.timesAsked = otherQuestions.reduce(
        (sum, question) => sum + (Number(question.times) || 1),
        0,
      );
      if (!topicsClone.includes(otherTopic)) topicsClone.push(otherTopic);
    }

    return {
      topicData: { ...data, topics: topicsClone },
      paperRows: papers,
    };
  }, [data, courseKey, matchIndex]);

  const analytics = useMemo(() => buildPreviewAnalytics(topicData), [topicData]);
  const insights = useMemo(() => buildPreviewInsights(analytics), [analytics]);
  // The newest paper comes first ("Fall 2024, Spring 2024, Fall 2023, ...").
  const semesterPapers = useMemo(
    () => paperRows.filter((paper) => paper.questions.length)
      .sort((a, b) => compareSemestersDesc(a.semester, b.semester)),
    [paperRows],
  );
  const topicsByName = useMemo(() => {
    const map = new Map();
    analytics.topics.forEach((topic) => map.set(String(topic.name).toLowerCase(), topic));
    return map;
  }, [analytics]);

  const jumpToQuestion = (match) => {
    if (!match?.topic) return;
    onActiveTopicChange?.(match.topic);
    setHighlightKey(match.key || '');
  };

  const originalContext = useMemo(
    () => ({
      qidRows,
      sourceFiles: sourceFiles || [],
      refreshKey: cropRefresh,
      overrides: cropOverrides,
      openFixer: (sourceFiles || []).length ? setFixTarget : null,
    }),
    [qidRows, sourceFiles, cropRefresh, cropOverrides],
  );

  const originalData = useMemo(() => {
    if (!originalTarget) return null;
    const qid = String(originalTarget.qid || '').trim().toUpperCase();
    const rows = qid ? (qidRows.get(qid) || []) : [];
    return { qid, questionText: originalTarget.questionText, rows };
  }, [originalTarget, qidRows]);

  if (!data || !analytics.topics.length) {
    return (
      <div className="qba-empty">
        <FileSearch size={28} aria-hidden="true" />
        <h3>Nothing to show yet</h3>
        <p>Add the Markdown returned by your AI in Setup, then press Preview.</p>
      </div>
    );
  }

  const pictureHandlers = {
    canEdit: canEditPictures,
    onOpen: setLightbox,
    onPick: pickPicture,
    onRemove: onRemoveImage,
    onDrop: handlePictureFiles,
  };
  const openOriginal = (qid, text) => setOriginalTarget({ qid, questionText: text });

  return (
    <OriginalContext.Provider value={originalContext}>
    <div className="qba-dash">
      {mode === 'topics' ? (
        <TopicWorkspace
          topics={analytics.topics}
          activeTopic={activeTopic}
          onActiveTopicChange={onActiveTopicChange}
          courseKey={courseKey}
          images={images}
          sourceRefsByKey={sourceRefsByKey}
          pictureHandlers={pictureHandlers}
          checklistItems={checklistItems}
          checklistEnabled={checklistEnabled}
          onSetChecklist={onSetChecklist}
          highlightKey={highlightKey}
          onMergeQuestions={onMergeQuestions}
          onUnmergeQuestions={onUnmergeQuestions}
          onOpenOriginal={openOriginal}
        />
      ) : null}

      {mode === 'semesters' ? (
        <PaperWorkspace
          papers={semesterPapers}
          topicsByName={topicsByName}
          activePaper={activePaper}
          onActivePaperChange={onActivePaperChange}
          courseKey={courseKey}
          images={images}
          pictureHandlers={pictureHandlers}
          checklistItems={checklistItems}
          checklistEnabled={checklistEnabled}
          onSetChecklist={onSetChecklist}
          onJump={(match) => { jumpToQuestion(match); onFocusTopic?.(match.topic, { keepScroll: true }); }}
          onOpenOriginal={openOriginal}
        />
      ) : null}

      {mode === 'overview' ? (
        <OverviewSection
          data={data}
          analytics={analytics}
          insights={insights}
          messages={messages}
          studyPlan={Array.isArray(topicData.studyPlan) ? topicData.studyPlan : []}
          semesters={Array.isArray(topicData.semesters) ? topicData.semesters : []}
          onFocusTopic={onFocusTopic}
        />
      ) : null}

      {/* One shared file picker for every question/answer box. No `accept`
          filter and `multiple`, so any file type and any number are allowed. */}
      <input
        ref={pictureInputRef}
        type="file"
        multiple
        className="qba-dash-pic-input"
        onChange={(event) => {
          // Copy the files out first — resetting `value` empties the live FileList.
          const files = Array.from(event.target.files || []);
          const { imageKey, kind } = pendingKeyRef.current;
          event.target.value = '';
          pendingKeyRef.current = { imageKey: '', kind: 'question' };
          if (imageKey && files.length) handlePictureFiles(imageKey, files, kind);
        }}
      />

      {lightbox && typeof document !== 'undefined' ? createPortal(
        <div
          className="qba-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.name}
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox.url} alt={lightbox.name} />
          <div className="qba-lightbox-bar">
            <span className="qba-lightbox-name">{lightbox.name}</span>
            <button
              type="button"
              className="qba-lightbox-close"
              onClick={() => setLightbox(null)}
              aria-label="Close picture"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>,
        document.body,
      ) : null}

      {fixTarget ? (
        <CropFixer
          target={fixTarget}
          sourceFiles={sourceFiles || []}
          data={data}
          onClose={() => setFixTarget(null)}
          onSaved={() => {
            resetCropOverrides();
            setCropRefresh((value) => value + 1);
          }}
        />
      ) : null}

      {originalData ? (
        <OriginalPanel
          qid={originalData.qid}
          questionText={originalData.questionText}
          data={data}
          storedFiles={sourceFiles || []}
          onClose={() => {
            setOriginalTarget(null);
            resetCropOverrides();
            setCropRefresh((value) => value + 1);
          }}
        />
      ) : null}
    </div>
    </OriginalContext.Provider>
  );
}

/** Charts, the VIP matrix and the study plan — the old one-page dashboard. */
function OverviewSection({ data, analytics, insights, messages, studyPlan, semesters, onFocusTopic }) {
  const prioritySegments = PRIORITIES.map((priority) => ({
    key: priority,
    label: priority,
    tone: priority.toLowerCase(),
    value: analytics.priorityAsks[priority],
    sub: `${analytics.priorityTopics[priority]} ${analytics.priorityTopics[priority] === 1 ? 'topic' : 'topics'}`,
  }));
  const totalPriorityAsks = prioritySegments.reduce((sum, segment) => sum + segment.value, 0);
  const topPriority = analytics.topTopic ? analytics.topTopic.priority.toLowerCase() : 'cyan';
  const stats = [
    { key: 'topics', label: 'Topics', value: analytics.topics.length, tone: 'cyan' },
    { key: 'questions', label: 'Unique questions', value: analytics.totalQuestions, tone: 'violet' },
    { key: 'asks', label: 'Times asked', value: analytics.totalAsked, tone: 'amber' },
    { key: 'vip', label: 'VIP topics', value: analytics.vipTopics.length, tone: 'vip' },
    { key: 'semesters', label: 'Semesters', value: analytics.knownSemesterCount, tone: 'emerald' },
    { key: 'approx', label: 'Approximate', value: analytics.approxCount, tone: 'orange' },
  ];

  return (
    <div className="qbs-overview">
      {messages}

      <header className={`qba-dash-hero qba-dash-tone-${topPriority}`}>
        <div className="qba-dash-hero-main">
          <h2 className="qba-dash-title">
            {data.course || 'Course code'} — {data.title || 'Course title'}
          </h2>
          <p className="qba-dash-meta">
            <CalendarDays size={13} aria-hidden="true" />
            {semesters.length ? semesters.join(', ') : 'Semesters not listed'}
          </p>
        </div>
        {analytics.topTopic ? (
          <div className="qba-dash-hero-side">
            <button type="button" className="qba-dash-focus" onClick={() => onFocusTopic?.(analytics.topTopic.name)}>
              <span className="qba-dash-focus-label">
                <Crown size={13} aria-hidden="true" />
                Start with
              </span>
              <strong className="qba-dash-focus-value">{analytics.topTopic.name}</strong>
              <span className="qba-dash-focus-detail">
                Asked {analytics.topTopic.timesAsked} times, {analytics.topShare}% of all repeats
              </span>
              <PriorityBadge priority={analytics.topTopic.priority} small />
            </button>
          </div>
        ) : null}
      </header>

      <div className="qba-dash-stats">
        {stats.map(({ key, label, value, tone }) => {
          const Icon = STAT_ICONS[key] || BarChart3;
          return (
            <div className={`qba-dash-stat qba-dash-tone-${tone}`} key={key}>
              <span className="qba-dash-stat-icon">
                <Icon size={16} aria-hidden="true" />
              </span>
              <span className="qba-dash-stat-value">{value}</span>
              <span className="qba-dash-stat-label">{label}</span>
            </div>
          );
        })}
      </div>

      <div className="qba-dash-insights">
        {insights.map((insight) => {
          const Icon = INSIGHT_ICONS[insight.icon] || Sparkles;
          return (
            <div className={`qba-dash-insight qba-dash-tone-${insight.tone}`} key={insight.key}>
              <span className="qba-dash-insight-icon">
                <Icon size={16} aria-hidden="true" />
              </span>
              <div className="qba-dash-insight-body">
                <span className="qba-dash-insight-label">{insight.label}</span>
                <strong className="qba-dash-insight-value">{insight.value}</strong>
                <span className="qba-dash-insight-detail">{insight.detail}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="qba-dash-analytics">
        <section className="qba-dash-card qba-dash-tone-cyan" aria-labelledby="qba-dash-priority-title">
          <div className="qba-dash-card-head">
            <div>
              <h3 id="qba-dash-priority-title" className="qba-dash-card-title">
                <Target size={16} aria-hidden="true" />
                Priority weight
              </h3>
              <p className="qba-dash-card-sub">Share of all recorded asks</p>
            </div>
          </div>
          <div className="qba-dash-card-body">
            <DonutChart
              segments={prioritySegments}
              total={totalPriorityAsks}
              centerValue={totalPriorityAsks}
              centerLabel="asks"
              ariaLabel={`Priority weight: ${prioritySegments.map((segment) => `${segment.label} ${segment.value}`).join(', ')}`}
            />
          </div>
        </section>

        <section className="qba-dash-card qba-dash-tone-amber" aria-labelledby="qba-dash-topics-title">
          <div className="qba-dash-card-head">
            <div>
              <h3 id="qba-dash-topics-title" className="qba-dash-card-title">
                <BarChart3 size={16} aria-hidden="true" />
                Most repeated topics
              </h3>
              <p className="qba-dash-card-sub">
                {analytics.topTopics.length < analytics.topics.length
                  ? `Top ${analytics.topTopics.length} of ${analytics.topics.length} topics by asks`
                  : 'Ranked by recorded asks'}
              </p>
            </div>
          </div>
          <div className="qba-dash-card-body">
            <TopicBars
              topics={analytics.topTopics}
              maxTimes={analytics.maxTimes}
              totalAsked={analytics.totalAsked}
              onFocusTopic={onFocusTopic}
            />
          </div>
        </section>

        <section className="qba-dash-card qba-dash-tone-emerald" aria-labelledby="qba-dash-semester-title">
          <div className="qba-dash-card-head">
            <div>
              <h3 id="qba-dash-semester-title" className="qba-dash-card-title">
                <CalendarDays size={16} aria-hidden="true" />
                Semester coverage
              </h3>
              <p className="qba-dash-card-sub">Questions per semester, split by priority</p>
            </div>
          </div>
          <div className="qba-dash-card-body">
            <SemesterBars semesters={analytics.semesterStats} />
          </div>
        </section>

        <section className="qba-dash-card qba-dash-tone-violet" aria-labelledby="qba-dash-exam-title">
          <div className="qba-dash-card-head">
            <div>
              <h3 id="qba-dash-exam-title" className="qba-dash-card-title">
                <ClipboardList size={16} aria-hidden="true" />
                Exam mix
              </h3>
              <p className="qba-dash-card-sub">Unique questions by exam type</p>
            </div>
          </div>
          <div className="qba-dash-card-body">
            <ExamBars exams={analytics.examStats} maxCount={analytics.maxExamCount} />
          </div>
        </section>
      </div>

      <section className="qba-dash-panel" aria-labelledby="qba-dash-matrix-title">
        <div className="qba-dash-panel-head">
          <div>
            <h3 id="qba-dash-matrix-title" className="qba-dash-panel-title">
              <Trophy size={17} aria-hidden="true" />
              VIP matrix
            </h3>
            <p className="qba-dash-panel-sub">
              Ranked by priority, then by how often the topic appears. Click a topic to open its questions.
            </p>
          </div>
          <span className="qba-dash-panel-note">
            {analytics.matrix.length} {analytics.matrix.length === 1 ? 'topic' : 'topics'}
          </span>
        </div>
        <div className="qba-dash-matrix" role="table" aria-label="VIP matrix ranked by priority and frequency">
          <div className="qba-dash-matrix-head" role="row">
            <span role="columnheader">#</span>
            <span role="columnheader">Topic</span>
            <span role="columnheader">Times asked</span>
            <span role="columnheader">Avg marks</span>
            <span role="columnheader">Last asked</span>
            <span role="columnheader">Priority</span>
          </div>
          {analytics.matrix.map((row) => (
            <MatrixRow
              key={`${row.topic}-${row.rank}`}
              row={row}
              maxTimes={analytics.maxMatrixTimes}
              onFocusTopic={onFocusTopic}
            />
          ))}
        </div>
      </section>

      <section className="qba-dash-panel" aria-labelledby="qba-dash-plan-title">
        <div className="qba-dash-panel-head">
          <div>
            <h3 id="qba-dash-plan-title" className="qba-dash-panel-title">
              <BookOpenCheck size={17} aria-hidden="true" />
              Study plan
            </h3>
            <p className="qba-dash-panel-sub">Highest-yield topics first. Work through the steps from the top.</p>
          </div>
          <span className="qba-dash-panel-note">
            {studyPlan.length} {studyPlan.length === 1 ? 'step' : 'steps'}
          </span>
        </div>
        <StudyPlan items={studyPlan} topics={analytics.topics} />
      </section>
    </div>
  );
}
