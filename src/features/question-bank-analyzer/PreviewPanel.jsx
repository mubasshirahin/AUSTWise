import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Award,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Crown,
  FileSearch,
  Filter,
  Image as ImageIcon,
  Info,
  Layers,
  ListChecks,
  Maximize2,
  Merge,
  Repeat2,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  Unlink2,
  X,
} from 'lucide-react';
import {
  buildPreviewAnalytics,
  buildPreviewInsights,
  buildQuestionVersions,
  filterPreviewData,
  PRIORITIES,
} from './previewAnalytics';
import { questionImageKey } from './qbaImageStore';
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

function TopicFilter({
  topics,
  selectedTopics,
  visibleTopicCount,
  visibleQuestionCount,
  onToggle,
  onClear,
}) {
  const selectedCount = selectedTopics.size;
  const narrowed = selectedCount > 0 && selectedCount < topics.length;

  return (
    <section className="qba-dash-filter" aria-labelledby="qba-dash-filter-title">
      <div className="qba-dash-filter-head">
        <div className="qba-dash-filter-heading">
          <span className="qba-dash-filter-icon" aria-hidden="true">
            <Filter size={16} />
          </span>
          <div>
            <h3 id="qba-dash-filter-title" className="qba-dash-filter-title">
              Filter by topic
            </h3>
            <p className="qba-dash-filter-sub">
              Pick one or more topics. Only their questions stay visible.
            </p>
          </div>
        </div>
        <div className="qba-dash-filter-tools">
          <span className="qba-dash-filter-status" role="status" aria-live="polite">
            {selectedCount ? `${selectedCount} of ${topics.length} selected` : 'All topics'}
          </span>
          {selectedCount ? (
            <button type="button" className="qba-dash-filter-reset" onClick={onClear}>
              <RotateCcw size={13} aria-hidden="true" />
              Show all
            </button>
          ) : null}
        </div>
      </div>

      <div className="qba-dash-filter-list" role="group" aria-label="Filter questions by topic">
        {topics.map((topic) => {
          const selected = selectedTopics.has(topic.name);
          const priority = priorityValue(topic.priority);
          const questionCount = Array.isArray(topic.questions) ? topic.questions.length : 0;
          return (
            <button
              type="button"
              className="qba-dash-filter-chip"
              key={topic.name}
              aria-pressed={selected}
              aria-label={`${selected ? 'Remove' : 'Add'} ${topic.name} filter, ${priority}, ${questionCount} question${questionCount === 1 ? '' : 's'}`}
              onClick={() => onToggle(topic.name)}
            >
              <span
                className={`qba-dash-filter-dot qba-dash-bg-${priority.toLowerCase()}`}
                aria-hidden="true"
              />
              <span className="qba-dash-filter-name">{topic.name}</span>
              <span className="qba-dash-filter-count">{questionCount}</span>
              {selected ? <Check size={13} aria-hidden="true" className="qba-dash-filter-check" /> : null}
            </button>
          );
        })}
      </div>

      <p className={`qba-dash-filter-note${narrowed ? ' qba-dash-filter-note-active' : ''}`}>
        {narrowed
          ? `Showing ${visibleQuestionCount} question row${visibleQuestionCount === 1 ? '' : 's'} from ${visibleTopicCount} selected topic${visibleTopicCount === 1 ? '' : 's'}. Other topics are hidden.`
          : `Showing all ${topics.length} topic${topics.length === 1 ? '' : 's'}. Select any topic above to narrow the questions.`}
      </p>
    </section>
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

function QuestionMeta({ question, topic, showTopic = false }) {
  const chips = [];

  if (showTopic && topic) {
    chips.push({ key: 'topic', icon: Layers, label: topic, className: 'qba-dash-chip-topic' });
  }
  if (question.exam && question.exam !== '-') {
    chips.push({ key: 'exam', icon: ClipboardList, label: question.exam });
  }
  if (!showTopic && question.semester && question.semester !== '-') {
    chips.push({ key: 'semester', icon: CalendarDays, label: question.semester });
  }
  if (question.marks !== null && question.marks !== undefined) {
    chips.push({ key: 'marks', icon: Award, label: `${question.marks} marks` });
  }
  if (question.times > 0) {
    chips.push({
      key: 'times',
      icon: Repeat2,
      label: `${question.times}×`,
      className: question.times > 1 ? 'qba-dash-chip-repeat' : '',
    });
  }
  if (question.timesApproximate || question.marksApproximate) {
    chips.push({ key: 'approx', icon: Info, label: 'approx.', className: 'qba-dash-chip-warn' });
  }

  if (!chips.length) return null;
  return (
    <div className="qba-dash-q-meta">
      {chips.map(({ key, icon: Icon, label, className }) => (
        <span className={`qba-dash-chip ${className || ''}`} key={key}>
          <Icon size={12} aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  );
}

/**
 * Every wording of one question, each in its own pill. The AI merges similar
 * questions into a single row ("Version 1: ... Version 2: ..."), and the
 * student can merge rows by hand — both end up here.
 */
function VersionPills({ versions }) {
  if (!versions.length) return null;
  return (
    <ol className="qba-dash-q-versions">
      {versions.map((version, index) => (
        <li className="qba-dash-q-version" key={`${version.label}-${index}`}>
          <span className="qba-dash-q-version-pill">
            <Layers size={11} aria-hidden="true" />
            {version.label}
          </span>
          <p className="qba-dash-q-text">{version.text || '—'}</p>
        </li>
      ))}
    </ol>
  );
}

/**
 * The pictures of one question: what the student attached, plus the marker
 * that says this question had a picture in the source.
 */
function QuestionPictures({ question, images, onOpen, onPick, onRemove, canEdit }) {
  const list = Array.isArray(images) ? images : [];
  const needsFigure = Boolean(question?.needsFigure);
  if (!needsFigure && !list.length && !canEdit) return null;

  return (
    <div className="qba-dash-q-pics">
      {needsFigure ? (
        <span className="qba-dash-chip qba-dash-chip-figure">
          <ImageIcon size={12} aria-hidden="true" />
          Picture needed
        </span>
      ) : null}

      {list.map((image) => (
        <span className="qba-dash-q-pic" key={image.id}>
          <button
            type="button"
            className="qba-dash-q-pic-open"
            onClick={() => onOpen?.(image)}
            title={`Open ${image.name}`}
          >
            <img src={image.url} alt={image.name} loading="lazy" />
            <span className="qba-dash-q-pic-zoom" aria-hidden="true">
              <Maximize2 size={12} />
            </span>
          </button>
          {canEdit ? (
            <button
              type="button"
              className="qba-dash-q-pic-remove"
              onClick={() => onRemove?.(image.id)}
              aria-label={`Remove picture ${image.name}`}
              title="Remove picture"
            >
              <X size={11} aria-hidden="true" />
            </button>
          ) : null}
        </span>
      ))}

      {canEdit ? (
        <button type="button" className="qba-dash-q-pic-add" onClick={onPick}>
          <ImageIcon size={13} aria-hidden="true" />
          {list.length ? 'Add another' : 'Add picture'}
        </button>
      ) : null}
    </div>
  );
}

function QuestionCard({
  question,
  topic,
  priority,
  number,
  showTopic = false,
  selectable = false,
  selected = false,
  onSelect,
  onUnmerge,
  images = [],
  canEditPictures = false,
  onOpenPicture,
  onPickPicture,
  onRemovePicture,
  onDropPictures,
}) {
  const value = priorityValue(priority);
  const variants = Array.isArray(question.variants) ? question.variants : [];
  const [dropActive, setDropActive] = useState(false);

  // The wordings of this question: the AI's own "Version 1 / Version 2"
  // labels, or the rows the student merged by hand.
  const versions = buildQuestionVersions(question);

  const handleDrop = (event) => {
    if (!canEditPictures) return;
    event.preventDefault();
    event.stopPropagation();
    setDropActive(false);
    const files = event.dataTransfer?.files;
    if (files && files.length) onDropPictures?.(files);
  };

  return (
    <Fragment>
    <li
      className={`qba-dash-question qba-dash-q-prio-${value.toLowerCase()}${selected ? ' qba-dash-q-selected' : ''}${selectable ? ' qba-dash-q-selectable' : ''}${dropActive ? ' qba-dash-q-drop' : ''}`}
      onDragOver={canEditPictures ? (event) => { event.preventDefault(); setDropActive(true); } : undefined}
      onDragLeave={canEditPictures ? () => setDropActive(false) : undefined}
      onDrop={canEditPictures ? handleDrop : undefined}
    >
      {selectable ? (
        <label className="qba-dash-q-check">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect?.()}
            aria-label={`Select question ${number ?? ''} for merging`}
          />
          <span className="qba-dash-q-check-box" aria-hidden="true">
            <Check size={12} />
          </span>
        </label>
      ) : number !== null && number !== undefined ? (
        <span className="qba-dash-q-num" aria-label={`Question ${number}`}>{number}</span>
      ) : (
        <span className="qba-dash-q-bullet" aria-hidden="true" />
      )}

      <div className="qba-dash-q-body">
        {showTopic && topic ? <span className="qba-dash-q-topic">{topic}</span> : null}

        {variants.length ? (
          // Merged by hand: the row only carries the group header, the
          // wordings sit in their own pills below it.
          <div className="qba-dash-q-merged-head">
            <span className="qba-dash-q-merged-pill">
              <Layers size={12} aria-hidden="true" />
              {variants.length} similar versions
            </span>
            {onUnmerge ? (
              <button
                type="button"
                className="qba-dash-q-unmerge"
                onClick={onUnmerge}
              >
                <Unlink2 size={12} aria-hidden="true" />
                Unmerge
              </button>
            ) : null}
          </div>
        ) : null}

        {!versions.length && question.figurePosition === 'start' ? (
          <QuestionPictures
            question={question}
            images={images}
            onOpen={onOpenPicture}
            onPick={onPickPicture}
            onRemove={onRemovePicture}
            canEdit={canEditPictures}
          />
        ) : null}

        {!versions.length ? (
          <p className="qba-dash-q-text">{question.question || '—'}</p>
        ) : null}

        <QuestionMeta question={question} topic={topic} showTopic={showTopic} />

        {!versions.length && question.figurePosition !== 'start' ? (
          <QuestionPictures
            question={question}
            images={images}
            onOpen={onOpenPicture}
            onPick={onPickPicture}
            onRemove={onRemovePicture}
            canEdit={canEditPictures}
          />
        ) : null}

        {versions.length ? (
          <QuestionPictures
            question={question}
            images={images}
            onOpen={onOpenPicture}
            onPick={onPickPicture}
            onRemove={onRemovePicture}
            canEdit={canEditPictures}
          />
        ) : null}
      </div>
    </li>

    {/* The wordings of this question — separate pills, not part of the row. */}
    {versions.length ? (
      <li className="qba-dash-q-version-list">
        <VersionPills versions={versions} />
      </li>
    ) : null}
    </Fragment>
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

function TopicAccordion({
  topics,
  openTopics,
  onToggleTopic,
  maxTimes,
  mergeTopic,
  mergeSelection,
  onStartMerge,
  onCancelMerge,
  onToggleMergeQuestion,
  onMergeSelected,
  onUnmerge,
  courseKey = '',
  images = {},
  canEditPictures = false,
  onOpenPicture,
  onPickPicture,
  onRemovePicture,
  onDropPictures,
}) {
  return (
    <div className="qba-dash-accordion">
      {topics.map((topic, index) => {
        const open = openTopics.has(topic.name);
        const panelId = `qba-dash-topic-panel-${index}`;
        const priority = priorityValue(topic.priority);
        const width = topic.timesAsked > 0 ? Math.max(3, (topic.timesAsked / maxTimes) * 100) : 0;
        const merging = mergeTopic === topic.name;
        const selectedCount = merging ? mergeSelection.size : 0;
        const mergeableCount = topic.questions.filter((question) => !question.merged).length;
        const canMerge = selectedCount >= 2;

        return (
          <div
            className={`qba-dash-acc qba-dash-q-prio-${priority.toLowerCase()}${open ? ' qba-dash-acc-open' : ''}`}
            id={`qba-dash-topic-${index}`}
            data-qba-topic={topic.name}
            key={`${topic.name}-${index}`}
          >
            <button
              type="button"
              className="qba-dash-acc-trigger"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => onToggleTopic(topic.name)}
            >
              <span className="qba-dash-acc-main">
                <span className="qba-dash-acc-top">
                  <span className="qba-dash-acc-name">{topic.name}</span>
                  <PriorityBadge priority={topic.priority} small />
                </span>
                <span className="qba-dash-acc-meta">
                  {topic.questions.length} question{topic.questions.length === 1 ? '' : 's'}
                  {' · '}
                  {topic.timesAsked} asks
                  {topic.avgMarks !== null && topic.avgMarks !== undefined
                    ? ` · avg ${topic.avgMarks} marks`
                    : ''}
                </span>
                <span className="qba-dash-acc-meter" aria-hidden="true">
                  <span
                    className={`qba-dash-acc-meter-fill qba-dash-bg-${priority.toLowerCase()}`}
                    style={{ '--qba-bar-width': `${width}%` }}
                  />
                </span>
              </span>
              <ChevronDown
                size={18}
                className={`qba-dash-acc-chevron${open ? ' qba-dash-acc-chevron-open' : ''}`}
                aria-hidden="true"
              />
            </button>
            <div className="qba-dash-acc-panel" id={panelId} hidden={!open}>
              {topic.questions.length ? (
                <>
                  {mergeableCount >= 2 || topic.questions.some((question) => question.merged) ? (
                    <div className={`qba-dash-merge-tools${merging ? ' qba-dash-merge-tools-active' : ''}`}>
                      <div className="qba-dash-merge-copy">
                        <span className="qba-dash-merge-title">
                          <Merge size={14} aria-hidden="true" />
                          Merge similar questions
                        </span>
                        <span className="qba-dash-merge-hint">
                          {merging
                            ? 'Select 2 or more similar questions. They stay together under one number, with every version below it.'
                            : 'Group versions of the same question so they share one number in this topic.'}
                        </span>
                      </div>
                      <div className="qba-dash-merge-actions">
                        {merging ? (
                          <>
                            <span className="qba-dash-merge-count" role="status" aria-live="polite">
                              {selectedCount} selected
                            </span>
                            <button
                              type="button"
                              className="qba-dash-merge-confirm"
                              disabled={!canMerge}
                              onClick={() => onMergeSelected(topic.name)}
                              title={canMerge ? 'Merge the selected questions' : 'Select at least two questions first'}
                            >
                              <Merge size={13} aria-hidden="true" />
                              Merge selected
                            </button>
                            <button type="button" className="qba-dash-merge-cancel" onClick={onCancelMerge}>
                              <X size={13} aria-hidden="true" />
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="qba-dash-merge-start"
                            onClick={() => onStartMerge(topic.name)}
                          >
                            <Merge size={13} aria-hidden="true" />
                            Merge questions
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <ol className="qba-dash-questions">
                    {topic.questions.map((question, questionIndex) => {
                      const originalIndex = question.originalIndex ?? questionIndex;
                      const imageKey = questionImageKey(courseKey, topic.name, originalIndex);
                      return (
                        <QuestionCard
                          key={question.merged ? `merged-${topic.name}-${originalIndex}` : `${topic.name}-${originalIndex}`}
                          question={question}
                          number={question.number}
                          priority={topic.priority}
                          selectable={merging && !question.merged}
                          selected={merging && mergeSelection.has(originalIndex)}
                          onSelect={() => onToggleMergeQuestion(originalIndex)}
                          onUnmerge={question.merged
                            ? () => onUnmerge(topic.name, question.mergedIndices)
                            : undefined}
                          images={images[imageKey] || []}
                          canEditPictures={canEditPictures}
                          onOpenPicture={onOpenPicture}
                          onPickPicture={() => onPickPicture?.(imageKey)}
                          onRemovePicture={onRemovePicture}
                          onDropPictures={(files) => onDropPictures?.(imageKey, files)}
                        />
                      );
                    })}
                  </ol>
                </>
              ) : (
                <p className="qba-dash-muted">No question rows were found for this topic.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SemesterView({
  groups,
  courseKey = '',
  images = {},
  canEditPictures = false,
  onOpenPicture,
  onPickPicture,
  onRemovePicture,
  onDropPictures,
}) {
  if (!groups.length) {
    return <p className="qba-dash-muted">No semester information was found.</p>;
  }

  return (
    <div className="qba-dash-timeline">
      {groups.map((group) => (
        <details className="qba-dash-sem-card" key={group.name}>
          <summary className="qba-dash-sem-summary">
            <span className="qba-dash-sem-dot" aria-hidden="true" />
            <span className="qba-dash-sem-main">
              <span className="qba-dash-sem-top">
                <span className="qba-dash-sem-title">{group.name}</span>
                <span className="qba-dash-sem-count">
                  {group.total} question{group.total === 1 ? '' : 's'} · {group.asks} asks
                </span>
              </span>
              <span className="qba-dash-sem-mini" aria-hidden="true">
                {PRIORITIES.map((priority) => {
                  const count = group.byPriority[priority] || 0;
                  if (!count) return null;
                  return (
                    <span
                      key={priority}
                      className={`qba-dash-mini-seg qba-dash-bg-${priority.toLowerCase()}`}
                      style={{ flexGrow: count }}
                      title={`${priority}: ${count}`}
                    />
                  );
                })}
              </span>
            </span>
            <ChevronDown size={18} className="qba-dash-sem-chevron" aria-hidden="true" />
          </summary>
          <div className="qba-dash-sem-body">
            <ol className="qba-dash-questions">
              {group.questions.map((question, index) => {
                const originalIndex = question.originalIndex ?? question.questionIndex ?? index;
                const imageKey = questionImageKey(courseKey, question.topic, originalIndex);
                return (
                  <QuestionCard
                    key={`${group.name}-${index}`}
                    question={question}
                    topic={question.topic}
                    priority={question.topicPriority}
                    showTopic
                    images={images[imageKey] || []}
                    canEditPictures={canEditPictures}
                    onOpenPicture={onOpenPicture}
                    onPickPicture={() => onPickPicture?.(imageKey)}
                    onRemovePicture={onRemovePicture}
                    onDropPictures={(files) => onDropPictures?.(imageKey, files)}
                  />
                );
              })}
            </ol>
          </div>
        </details>
      ))}
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

export default function PreviewPanel({
  data,
  openTopics = new Set(),
  onToggleTopic = () => {},
  onFocusTopic,
  onRevealTopics,
  onMergeQuestions,
  onUnmergeQuestions,
  courseKey = '',
  images = {},
  onAttachImage,
  onRemoveImage,
}) {
  const [selectedTopics, setSelectedTopics] = useState(() => new Set());
  const [mergeTopic, setMergeTopic] = useState('');
  const [mergeSelection, setMergeSelection] = useState(() => new Set());
  const [lightbox, setLightbox] = useState(null);
  const pictureInputRef = useRef(null);
  const pendingKeyRef = useRef('');
  const canEditPictures = typeof onAttachImage === 'function';

  const pickPicture = (imageKey) => {
    pendingKeyRef.current = imageKey;
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

  const handlePictureFiles = async (imageKey, files) => {
    if (!imageKey || !files || !files.length) return;
    await onAttachImage?.(imageKey, files);
  };
  const topics = useMemo(() => (Array.isArray(data?.topics) ? data.topics : []), [data]);
  const selectedNames = useMemo(() => (
    topics.filter((topic) => selectedTopics.has(topic.name)).map((topic) => topic.name)
  ), [topics, selectedTopics]);
  const filteredData = useMemo(
    () => filterPreviewData(data, selectedNames),
    [data, selectedNames],
  );
  const analytics = useMemo(() => buildPreviewAnalytics(filteredData), [filteredData]);
  const insights = useMemo(() => buildPreviewInsights(analytics), [analytics]);
  const semesterGroups = useMemo(() => {
    const map = new Map();
    for (const question of analytics.allQuestions) {
      const name = question.semester && question.semester !== '-'
        ? question.semester
        : 'Unknown semester';
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(question);
    }
    return analytics.semesterStats.map((semester) => ({
      ...semester,
      questions: map.get(semester.name) || [],
    }));
  }, [analytics]);

  const handleFilterToggle = (name) => {
    const willSelect = !selectedTopics.has(name);
    setSelectedTopics((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    setMergeTopic('');
    setMergeSelection(new Set());
    if (willSelect) onRevealTopics?.([name]);
  };

  const handleFilterClear = () => {
    setSelectedTopics(new Set());
    setMergeTopic('');
    setMergeSelection(new Set());
  };

  const handleStartMerge = (topicName) => {
    setMergeTopic(topicName);
    setMergeSelection(new Set());
  };

  const handleCancelMerge = () => {
    setMergeTopic('');
    setMergeSelection(new Set());
  };

  const handleToggleMergeQuestion = (index) => {
    setMergeSelection((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleMergeSelected = (topicName) => {
    if (mergeSelection.size < 2) return;
    onMergeQuestions?.(topicName, [...mergeSelection]);
    setMergeTopic('');
    setMergeSelection(new Set());
  };

  const handleUnmerge = (topicName, indices) => {
    onUnmergeQuestions?.(topicName, indices);
    setMergeSelection(new Set());
  };

  if (!data || !analytics.topics.length) {
    return (
      <div className="qba-empty">
        <FileSearch size={28} aria-hidden="true" />
        <h3>Nothing to preview yet</h3>
        <p>Add the Markdown returned by your AI in Step 3, then press Preview again.</p>
      </div>
    );
  }

  const prioritySegments = PRIORITIES.map((priority) => ({
    key: priority,
    label: priority,
    tone: priority.toLowerCase(),
    value: analytics.priorityAsks[priority],
    sub: `${analytics.priorityTopics[priority]} ${analytics.priorityTopics[priority] === 1 ? 'topic' : 'topics'}`,
  }));
  const totalPriorityAsks = prioritySegments.reduce((sum, segment) => sum + segment.value, 0);
  const topPriority = analytics.topTopic ? analytics.topTopic.priority.toLowerCase() : 'cyan';
  const semesters = Array.isArray(filteredData.semesters) ? filteredData.semesters : [];
  const studyPlan = Array.isArray(filteredData.studyPlan) ? filteredData.studyPlan : [];
  const openVisibleCount = analytics.topics.filter((topic) => openTopics.has(topic.name)).length;
  const stats = [
    { key: 'topics', label: 'Topics', value: analytics.topics.length, tone: 'cyan' },
    { key: 'questions', label: 'Unique questions', value: analytics.totalQuestions, tone: 'violet' },
    { key: 'asks', label: 'Times asked', value: analytics.totalAsked, tone: 'amber' },
    { key: 'vip', label: 'VIP topics', value: analytics.vipTopics.length, tone: 'vip' },
    { key: 'semesters', label: 'Semesters', value: analytics.knownSemesterCount, tone: 'emerald' },
    { key: 'approx', label: 'Approximate', value: analytics.approxCount, tone: 'orange' },
  ];

  return (
    <div className="qba-dash">
      <TopicFilter
        topics={topics}
        selectedTopics={selectedTopics}
        visibleTopicCount={analytics.topics.length}
        visibleQuestionCount={analytics.totalQuestions}
        onToggle={handleFilterToggle}
        onClear={handleFilterClear}
      />

      <header className={`qba-dash-hero qba-dash-tone-${topPriority}`}>
        <div className="qba-dash-hero-main">
          <span className="qba-dash-kicker">
            <Sparkles size={13} aria-hidden="true" />
            Question bank analysis
          </span>
          <h2 className="qba-dash-title">
            {data.course || 'Course code'} — {data.title || 'Course title'}
          </h2>
          <p className="qba-dash-meta">
            <CalendarDays size={13} aria-hidden="true" />
            {semesters.length ? semesters.join(' · ') : 'Semesters not listed'}
            <span className="qba-dash-dot" aria-hidden="true" />
            <ListChecks size={13} aria-hidden="true" />
            {analytics.totalQuestions} question rows
          </p>
          <div className="qba-dash-hero-chips">
            <span className="qba-dash-chip">
              <Layers size={13} aria-hidden="true" />
              {analytics.topics.length} topics
            </span>
            <span className="qba-dash-chip">
              <Repeat2 size={13} aria-hidden="true" />
              {analytics.totalAsked} total asks
            </span>
            <span className="qba-dash-chip">
              <CalendarDays size={13} aria-hidden="true" />
              {analytics.knownSemesterCount} semesters
            </span>
            {selectedNames.length ? (
              <span className="qba-dash-chip qba-dash-chip-soft">
                <Filter size={13} aria-hidden="true" />
                {selectedNames.length} topic{selectedNames.length === 1 ? '' : 's'} selected
              </span>
            ) : null}
            <span className="qba-dash-chip qba-dash-chip-soft">
              <BookOpenCheck size={13} aria-hidden="true" />
              Parsed in your browser
            </span>
          </div>
        </div>
        <div className="qba-dash-hero-side">
          <span className="qba-dash-stamp">
            <BookOpenCheck size={14} aria-hidden="true" />
            Analysis ready
          </span>
          {analytics.topTopic ? (
            <div className="qba-dash-focus">
              <span className="qba-dash-focus-label">
                <Crown size={13} aria-hidden="true" />
                Focus first
              </span>
              <strong className="qba-dash-focus-value">{analytics.topTopic.name}</strong>
              <span className="qba-dash-focus-detail">
                {analytics.topTopic.timesAsked} asks · {analytics.topShare}% of all repeats
              </span>
              <PriorityBadge priority={analytics.topTopic.priority} small />
            </div>
          ) : null}
        </div>
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
              Ranked by priority, then by how often the topic appears. Click a topic to jump to its questions.
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

      <section className="qba-dash-panel" aria-labelledby="qba-dash-questions-title">
        <div className="qba-dash-panel-head">
          <div>
            <h3 id="qba-dash-questions-title" className="qba-dash-panel-title">
              <ListChecks size={17} aria-hidden="true" />
              Topic-wise questions
            </h3>
            <p className="qba-dash-panel-sub">
              Every question is shown in full, exactly as the AI copied it.
            </p>
          </div>
          <span className="qba-dash-panel-note">{openVisibleCount} open</span>
        </div>
        <TopicAccordion
          topics={analytics.topics}
          openTopics={openTopics}
          onToggleTopic={onToggleTopic}
          maxTimes={analytics.maxTimes}
          mergeTopic={mergeTopic}
          mergeSelection={mergeSelection}
          onStartMerge={handleStartMerge}
          onCancelMerge={handleCancelMerge}
          onToggleMergeQuestion={handleToggleMergeQuestion}
          onMergeSelected={handleMergeSelected}
          onUnmerge={handleUnmerge}
          courseKey={courseKey}
          images={images}
          canEditPictures={canEditPictures}
          onOpenPicture={setLightbox}
          onPickPicture={pickPicture}
          onRemovePicture={onRemoveImage}
          onDropPictures={handlePictureFiles}
        />
      </section>

      <section className="qba-dash-panel" aria-labelledby="qba-dash-semester-view-title">
        <div className="qba-dash-panel-head">
          <div>
            <h3 id="qba-dash-semester-view-title" className="qba-dash-panel-title">
              <CalendarDays size={17} aria-hidden="true" />
              Semester-wise view
            </h3>
            <p className="qba-dash-panel-sub">
              The same questions, grouped by semester. Open a semester to see its full question text.
            </p>
          </div>
          <span className="qba-dash-panel-note">
            {semesterGroups.length} {semesterGroups.length === 1 ? 'semester' : 'semesters'}
          </span>
        </div>
        <SemesterView
          groups={semesterGroups}
          courseKey={courseKey}
          images={images}
          canEditPictures={canEditPictures}
          onOpenPicture={setLightbox}
          onPickPicture={pickPicture}
          onRemovePicture={onRemoveImage}
          onDropPictures={handlePictureFiles}
        />
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

      {/* One shared file picker for every question on this panel. */}
      <input
        ref={pictureInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="qba-dash-pic-input"
        onChange={(event) => {
          // Copy the files out first — resetting `value` empties the live
          // FileList, so the array has to be taken before the reset.
          const files = Array.from(event.target.files || []);
          const imageKey = pendingKeyRef.current;
          event.target.value = '';
          if (imageKey && files.length) handlePictureFiles(imageKey, files);
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
    </div>
  );
}
