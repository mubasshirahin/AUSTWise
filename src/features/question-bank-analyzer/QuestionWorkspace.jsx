import { useContext, useMemo, useState } from 'react';
import {
  Camera,
  Check,
  FileText,
  Image as ImageIcon,
  Maximize2,
  Merge,
  Search,
  Unlink2,
  Upload,
  X,
} from 'lucide-react';
import { CropImage } from './InsightsShared';
import { matchSourceFile } from './qbaOriginal';
import { questionImageKey, semesterImageKey } from './qbaImageStore';
import { anchorIdForKey, partImageKey } from './qbaQuestionMatch';
import { PRIORITIES } from './previewAnalytics';
import { questionCheckIds } from './qbaChecklist';
import {
  formatSingleNumber,
  isSingleSolved,
  orderTopicRows,
  rowSingles,
  singleCheckId,
  singleToggleChanges,
  splitIntoSingles,
} from './qbaSingles';
import { OriginalContext } from './qbaOriginalContext';
import './QuestionWorkspace.css';


function priorityValue(value) {
  const upper = String(value || 'MEDIUM').toUpperCase();
  return PRIORITIES.includes(upper) ? upper : 'MEDIUM';
}

function isBoxRegion(region) {
  return Boolean(region) && (region.kind === 'box' || region.kind === 'bare');
}

function hasCropRegion(row) {
  return (row?.sourceRegions || []).some(isBoxRegion);
}

/** Combine lists of attachments without showing the same file twice. */
function mergeAttachmentLists(...lists) {
  const seen = new Set();
  const merged = [];
  lists.filter(Array.isArray).forEach((list) => {
    list.forEach((item) => {
      const key = item?.id || `${item?.name || ''}-${item?.size || 0}-${item?.url || ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(item);
    });
  });
  return merged;
}

/** "0.05,0.16,0.95,0.41" → "x 5–95%, y 16–41%" is harder to read; keep the raw fractions. */
function regionLabel(region) {
  if (!region) return '';
  if (region.kind === 'box') {
    const [x1, y1, x2, y2] = region.box || [0, 0, 1, 1];
    const f = (value) => Number(value).toFixed(2);
    return `${region.file} · page ${region.page} · ${f(x1)}, ${f(y1)} to ${f(x2)}, ${f(y2)}`;
  }
  return region.file;
}

// ── attachments ──────────────────────────────────────────────────────────────

function AttachmentChip({ attachment, canEdit, onOpen, onRemove }) {
  const isImage = attachment.media === 'image'
    || (!attachment.media && String(attachment.mime || '').startsWith('image/'));
  const sizeKb = attachment.size ? Math.max(1, Math.round(attachment.size / 1024)) : 0;

  if (isImage) {
    return (
      <span className="qbs-pic">
        <button type="button" className="qbs-pic-open" onClick={() => onOpen?.(attachment)} title={`Open ${attachment.name}`}>
          <img src={attachment.url} alt={attachment.name} loading="lazy" />
        </button>
        {canEdit ? (
          <button
            type="button"
            className="qbs-pic-remove"
            onClick={() => onRemove?.(attachment.id)}
            aria-label={`Remove ${attachment.name}`}
          >
            <X size={11} aria-hidden="true" />
          </button>
        ) : null}
      </span>
    );
  }

  return (
    <span className="qbs-file">
      <a href={attachment.url} download={attachment.name} target="_blank" rel="noreferrer">
        <FileText size={14} aria-hidden="true" />
        <span className="qbs-file-name">{attachment.name}</span>
        {sizeKb ? <span className="qbs-file-size">{sizeKb} KB</span> : null}
      </a>
      {canEdit ? (
        <button
          type="button"
          className="qbs-pic-remove"
          onClick={() => onRemove?.(attachment.id)}
          aria-label={`Remove ${attachment.name}`}
        >
          <X size={11} aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}

function AttachmentBox({ title, hint, list, canEdit, onOpen, onPick, onRemove, onDrop }) {
  const [dropActive, setDropActive] = useState(false);
  const droppable = Boolean(canEdit && onDrop);
  return (
    <div
      className={`qbs-attach${dropActive ? ' is-drop' : ''}`}
      onDragOver={droppable ? (event) => { event.preventDefault(); setDropActive(true); } : undefined}
      onDragLeave={droppable ? () => setDropActive(false) : undefined}
      onDrop={droppable ? (event) => {
        event.preventDefault();
        event.stopPropagation();
        setDropActive(false);
        if (event.dataTransfer?.files?.length) onDrop(event.dataTransfer.files);
      } : undefined}
    >
      <span className="qbs-attach-title">{title}</span>
      {list.length ? (
        <div className="qbs-attach-list">
          {list.map((attachment) => (
            <AttachmentChip key={attachment.id} attachment={attachment} canEdit={canEdit} onOpen={onOpen} onRemove={onRemove} />
          ))}
        </div>
      ) : (
        <p className="qbs-attach-empty">{hint}</p>
      )}
      {canEdit ? (
        <button type="button" className="qbs-attach-add" onClick={onPick}>
          <Upload size={12} aria-hidden="true" />
          {list.length ? 'Add more' : 'Choose files'}
        </button>
      ) : null}
    </div>
  );
}

// ── one single question ──────────────────────────────────────────────────────

/** The paper row that holds this question's crop: its own row first, then any row with the QID. */
function useOriginalRow(original) {
  const { qidRows } = useContext(OriginalContext);
  if (!original) return null;
  if ((original.regions || []).some(isBoxRegion)) {
    return { semester: original.semester || '', n: original.number, sourceRegions: original.regions };
  }
  const key = String(original.qid || '').trim().toUpperCase();
  const rows = (key && qidRows?.get(key)) || [];
  return rows.find(hasCropRegion) || null;
}

export function SingleCard({
  number,
  topic = '',
  priority = 'MEDIUM',
  onTopicClick,
  tags = [],
  versionLabel = '',
  extra = null,
  stem = '',
  text = '',
  needsFigure = false,
  solved = false,
  checklistEnabled = false,
  onToggleSolved,
  selectable = false,
  selected = false,
  onSelect,
  original = null,
  onOpenFull,
  pictures = null,
  anchorId,
  highlighted = false,
}) {
  const { sourceFiles, refreshKey } = useContext(OriginalContext);
  const row = useOriginalRow(original);
  const [showOriginal, setShowOriginal] = useState(Boolean(needsFigure));
  const [showPictures, setShowPictures] = useState(false);
  const prio = priorityValue(priority).toLowerCase();
  const pictureList = pictures?.list || [];
  const questionFiles = pictureList.filter((item) => item.kind !== 'answer');
  const answerFiles = pictureList.filter((item) => item.kind === 'answer');
  const canEdit = Boolean(pictures?.canEdit);
  const boxRegions = row ? row.sourceRegions.filter(isBoxRegion) : [];
  const fileReady = row ? row.sourceRegions.some((region) => matchSourceFile(region.file, sourceFiles)) : false;
  const showPictureButton = canEdit || pictureList.length > 0;

  const className = [
    'qbs-card',
    solved ? 'is-solved' : '',
    selected ? 'is-selected' : '',
    highlighted ? 'is-target' : '',
  ].filter(Boolean).join(' ');

  return (
    <li className={className} id={anchorId}>
      <div className="qbs-margin" aria-hidden="true">
        <span className="qbs-no">{number}</span>
        {solved ? <Check size={14} className="qbs-margin-check" /> : null}
      </div>

      <div className="qbs-body">
        <div className="qbs-meta">
          <span className="qbs-sr">Question {number}.</span>
          {topic ? (
            onTopicClick ? (
              <button type="button" className="qbs-topic" onClick={onTopicClick} title={`Open ${topic} in the topic-wise list`}>
                <span className={`qbs-dot qba-dash-bg-${prio}`} aria-hidden="true" />
                {topic}
              </button>
            ) : (
              <span className="qbs-topic is-static">
                <span className={`qbs-dot qba-dash-bg-${prio}`} aria-hidden="true" />
                {topic}
              </span>
            )
          ) : null}
          {versionLabel ? <span className="qbs-tag is-version">{versionLabel}</span> : null}
          {tags.map((tag) => (
            <span className={`qbs-tag${tag.tone ? ` is-${tag.tone}` : ''}`} key={tag.key || tag.label}>{tag.label}</span>
          ))}
          {extra}
        </div>

        {stem ? <p className="qbs-stem">{stem}</p> : null}
        <p className="qbs-text">{text || '—'}</p>

        <div className="qbs-actions">
          {row ? (
            <button
              type="button"
              className={`qbs-act${showOriginal ? ' is-on' : ''}`}
              aria-expanded={showOriginal}
              onClick={() => setShowOriginal((value) => !value)}
            >
              <Camera size={14} aria-hidden="true" />
              Original
            </button>
          ) : onOpenFull ? (
            <button type="button" className="qbs-act" onClick={onOpenFull}>
              <Camera size={14} aria-hidden="true" />
              Find original
            </button>
          ) : null}
          {showPictureButton ? (
            <button
              type="button"
              className={`qbs-act${showPictures ? ' is-on' : ''}`}
              aria-expanded={showPictures}
              onClick={() => setShowPictures((value) => !value)}
            >
              <ImageIcon size={14} aria-hidden="true" />
              {pictureList.length ? `Pictures ${pictureList.length}` : 'Add picture'}
            </button>
          ) : null}
          {needsFigure && !row && !questionFiles.length ? (
            <span className="qbs-tag is-warn">Has a diagram</span>
          ) : null}
        </div>

        {showOriginal && row ? (
          <div className="qbs-original">
            <CropImage
              regions={row.sourceRegions}
              sourceFiles={sourceFiles}
              semester={row.semester}
              number={row.n}
              refreshKey={refreshKey}
              alt={`Original of question ${number}${row.semester ? ` from ${row.semester}` : ''}`}
            />
            <div className="qbs-coords">
              <ul>
                {boxRegions.map((region, index) => (
                  <li key={`${region.raw || region.file}-${index}`}>{regionLabel(region)}</li>
                ))}
              </ul>
              {fileReady && onOpenFull ? (
                <button type="button" className="qbs-act is-quiet" onClick={onOpenFull}>
                  <Maximize2 size={13} aria-hidden="true" />
                  Fix crop
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {showPictures && pictures ? (
          <div className="qbs-pictures">
            <AttachmentBox
              title="Real question"
              hint={needsFigure ? 'The paper had a figure here — add it.' : 'Drop the printed question or its figure.'}
              list={questionFiles}
              canEdit={canEdit}
              onOpen={pictures.onOpen}
              onPick={() => pictures.onPick?.('question')}
              onRemove={pictures.onRemove}
              onDrop={(files) => pictures.onDrop?.('question', files)}
            />
            <AttachmentBox
              title="Your answer"
              hint="Drop a photo or file of your answer."
              list={answerFiles}
              canEdit={canEdit}
              onOpen={pictures.onOpen}
              onPick={() => pictures.onPick?.('answer')}
              onRemove={pictures.onRemove}
              onDrop={(files) => pictures.onDrop?.('answer', files)}
            />
          </div>
        ) : null}
      </div>

      <div className="qbs-check">
        {selectable ? (
          <label className={`qbs-tick is-select${selected ? ' is-on' : ''}`}>
            <input type="checkbox" checked={selected} onChange={() => onSelect?.()} />
            <span className="qbs-tick-box" aria-hidden="true"><Check size={13} /></span>
            <span className="qbs-tick-label">Pick</span>
            <span className="qbs-sr">Select question {number} for merging</span>
          </label>
        ) : checklistEnabled ? (
          <label className={`qbs-tick${solved ? ' is-on' : ''}`} title={solved ? 'Solved — click to mark it pending' : 'Mark as solved'}>
            <input type="checkbox" checked={solved} onChange={() => onToggleSolved?.()} />
            <span className="qbs-tick-box" aria-hidden="true"><Check size={13} /></span>
            <span className="qbs-tick-label">{solved ? 'Solved' : 'Solve'}</span>
            <span className="qbs-sr">Question {number} solved</span>
          </label>
        ) : null}
      </div>
    </li>
  );
}

// ── shared pieces of both workspaces ─────────────────────────────────────────

function RailItem({ active, label, sub, solved, total, priority, onClick }) {
  const percent = total ? Math.round((solved / total) * 100) : 0;
  return (
    <button
      type="button"
      className={`qbs-rail-item${active ? ' is-active' : ''}`}
      aria-current={active ? 'true' : undefined}
      onClick={onClick}
    >
      <span className="qbs-rail-top">
        {priority ? <span className={`qbs-dot qba-dash-bg-${priority.toLowerCase()}`} aria-hidden="true" /> : null}
        <span className="qbs-rail-name">{label}</span>
        <span className="qbs-rail-count">{solved}/{total}</span>
      </span>
      {sub ? <span className="qbs-rail-sub">{sub}</span> : null}
      <span className="qbs-rail-bar" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </span>
    </button>
  );
}

function ListFilter({ value, onChange, counts }) {
  return (
    <div className="qbs-seg" role="group" aria-label="Show questions">
      {[
        { id: 'all', label: `All ${counts.total}` },
        { id: 'todo', label: `To solve ${counts.total - counts.solved}` },
        { id: 'done', label: `Solved ${counts.solved}` },
      ].map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          className={value === option.id ? 'is-on' : ''}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function keepByFilter(filter, solved) {
  if (filter === 'todo') return !solved;
  if (filter === 'done') return solved;
  return true;
}

function refTag(ref, label) {
  return `${ref.semester} · ${formatSingleNumber(ref.number, label || ref.part || '')}`;
}

function pictureProps(key, legacyKey, images, handlers) {
  return {
    list: mergeAttachmentLists(images[key], legacyKey && legacyKey !== key ? images[legacyKey] : []),
    canEdit: handlers.canEdit,
    onOpen: handlers.onOpen,
    onPick: (kind) => handlers.onPick?.(key, kind),
    onRemove: handlers.onRemove,
    onDrop: (kind, files) => handlers.onDrop?.(key, files, kind),
  };
}

// ── topic-wise ───────────────────────────────────────────────────────────────

/** Every single item of one topic, newest rows first. */
function topicItems(topic, courseKey, sourceRefsByKey) {
  const ordered = orderTopicRows(topic.questions);

  const items = [];
  ordered.forEach((question, rowIndex) => {
    const originalIndex = question.originalIndex ?? rowIndex;
    const singles = rowSingles(topic.name, question);
    singles.forEach((single, singleIndex) => {
      const version = single.version;
      const source = typeof version?.sourceIndex === 'number' ? version.sourceIndex : originalIndex;
      const base = question.pictureKey || questionImageKey(courseKey, topic.name, source);
      const wordingKey = version?.slot ? `${base}::${version.slot}` : base;
      const imageKey = single.part ? partImageKey(wordingKey, single.part, single.index) : wordingKey;
      const refs = (sourceRefsByKey?.get(wordingKey) || []).filter((ref) => (
        !single.idLabel || !ref.partLabels?.length || ref.partLabels.includes(single.idLabel)
      ));
      items.push({
        key: `${originalIndex}-${singleIndex}`,
        rowIndex,
        originalIndex,
        question,
        single,
        siblings: singles,
        number: formatSingleNumber(rowIndex + 1, single.label),
        imageKey,
        refs,
        firstOfRow: singleIndex === 0,
      });
    });
  });
  return items;
}

export function TopicWorkspace({
  topics,
  activeTopic,
  onActiveTopicChange,
  courseKey = '',
  images = {},
  sourceRefsByKey = null,
  pictureHandlers,
  checklistItems = {},
  checklistEnabled = false,
  onSetChecklist,
  highlightKey = '',
  onMergeQuestions,
  onUnmergeQuestions,
  onOpenOriginal,
}) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [mergeSelection, setMergeSelection] = useState(null); // Set of originalIndex while merging

  const itemsByTopic = useMemo(() => {
    const map = new Map();
    topics.forEach((topic) => map.set(topic.name, topicItems(topic, courseKey, sourceRefsByKey)));
    return map;
  }, [topics, courseKey, sourceRefsByKey]);

  const counts = (name) => {
    const items = itemsByTopic.get(name) || [];
    const solved = items.filter((item) => isSingleSolved(checklistItems, item.single)).length;
    return { total: items.length, solved };
  };

  const current = topics.find((topic) => topic.name === activeTopic) || topics[0];
  if (!current) return <p className="qbs-empty">No topics were found in this answer.</p>;

  const items = itemsByTopic.get(current.name) || [];
  const currentCounts = counts(current.name);
  const visible = items.filter((item) => keepByFilter(filter, isSingleSolved(checklistItems, item.single)));
  const query = search.trim().toLowerCase();
  const railTopics = query ? topics.filter((topic) => topic.name.toLowerCase().includes(query)) : topics;
  const merging = mergeSelection instanceof Set;
  const mergeable = current.questions.filter((question) => !question.merged).length;
  const priority = priorityValue(current.priority);

  const choose = (name) => {
    setMergeSelection(null);
    onActiveTopicChange?.(name);
  };

  return (
    <div className="qbs-workspace">
      <aside className="qbs-rail" aria-label="Topics">
        {topics.length > 6 ? (
          <label className="qbs-rail-search">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a topic"
              aria-label="Find a topic"
            />
          </label>
        ) : null}
        <div className="qbs-rail-list">
          {railTopics.map((topic) => {
            const { total, solved } = counts(topic.name);
            return (
              <RailItem
                key={topic.name}
                active={topic.name === current.name}
                label={topic.name}
                priority={priorityValue(topic.priority)}
                solved={solved}
                total={total}
                onClick={() => choose(topic.name)}
              />
            );
          })}
          {!railTopics.length ? <p className="qbs-rail-none">No topic matches “{search}”.</p> : null}
        </div>
      </aside>

      <section className="qbs-main" aria-labelledby="qbs-topic-title">
        <header className="qbs-main-head">
          <div className="qbs-main-title">
            <h3 id="qbs-topic-title">{current.name}</h3>
            <p>
              <span className={`qbs-prio is-${priority.toLowerCase()}`}>{priority}</span>
              {currentCounts.total} question{currentCounts.total === 1 ? '' : 's'}
              {current.timesAsked ? ` · asked ${current.timesAsked} times` : ''}
              {current.avgMarks !== null && current.avgMarks !== undefined ? ` · about ${current.avgMarks} marks` : ''}
            </p>
          </div>
          <div className="qbs-main-tools">
            <ListFilter value={filter} onChange={setFilter} counts={currentCounts} />
            {onMergeQuestions && mergeable >= 2 && !merging ? (
              <button type="button" className="qbs-act" onClick={() => setMergeSelection(new Set())}>
                <Merge size={14} aria-hidden="true" />
                Merge similar
              </button>
            ) : null}
          </div>
        </header>

        {merging ? (
          <div className="qbs-merge-bar" role="status">
            <span>Pick two or more questions that are the same. They will share one number.</span>
            <button
              type="button"
              className="qbs-act is-primary"
              disabled={mergeSelection.size < 2}
              onClick={() => {
                onMergeQuestions?.(current.name, [...mergeSelection]);
                setMergeSelection(null);
              }}
            >
              <Merge size={14} aria-hidden="true" />
              Merge {mergeSelection.size || ''}
            </button>
            <button type="button" className="qbs-act" onClick={() => setMergeSelection(null)}>Cancel</button>
          </div>
        ) : null}

        {visible.length ? (
          <ol className="qbs-list">
            {visible.map((item) => {
              const { question, single } = item;
              const solved = isSingleSolved(checklistItems, single);
              const tags = [];
              item.refs.slice(0, 3).forEach((ref) => tags.push({ key: `${ref.semester}-${ref.number}-${ref.part}`, label: refTag(ref, single.label) }));
              if (item.refs.length > 3) tags.push({ key: 'more', label: `+${item.refs.length - 3} more` });
              if (!item.refs.length && question.semester && question.semester !== '-') tags.push({ key: 'sem', label: question.semester });
              if (question.exam && question.exam !== '-') tags.push({ key: 'exam', label: question.exam });
              if (question.marks !== null && question.marks !== undefined) tags.push({ key: 'marks', label: `${question.marks} marks` });
              if (question.times > 1) tags.push({ key: 'times', label: `asked ${question.times}×`, tone: 'hot' });
              const canPick = merging && !question.merged;
              return (
                <SingleCard
                  key={`${current.name}-${item.key}`}
                  number={item.number}
                  topic={current.name}
                  priority={current.priority}
                  tags={tags}
                  versionLabel={single.version?.label || ''}
                  extra={question.merged && item.firstOfRow && onUnmergeQuestions ? (
                    <button
                      type="button"
                      className="qbs-tag is-button"
                      onClick={() => onUnmergeQuestions(current.name, question.mergedIndices)}
                    >
                      <Unlink2 size={11} aria-hidden="true" /> Unmerge
                    </button>
                  ) : null}
                  stem={single.stem}
                  text={single.text}
                  needsFigure={Boolean(single.version ? single.version.needsFigure : question.needsFigure)}
                  solved={solved}
                  checklistEnabled={checklistEnabled}
                  onToggleSolved={() => onSetChecklist?.(singleToggleChanges(checklistItems, single, item.siblings))}
                  selectable={canPick}
                  selected={canPick && mergeSelection.has(item.originalIndex)}
                  onSelect={() => setMergeSelection((set) => {
                    const next = new Set(set);
                    if (next.has(item.originalIndex)) next.delete(item.originalIndex);
                    else next.add(item.originalIndex);
                    return next;
                  })}
                  original={{ qid: question.qid || '', regions: question.sourceRegions || [], semester: question.semester || '', number: question.number }}
                  onOpenFull={onOpenOriginal ? () => onOpenOriginal(question.qid || '', question.question) : undefined}
                  pictures={pictureProps(item.imageKey, '', images, pictureHandlers)}
                  anchorId={anchorIdForKey(item.imageKey)}
                  highlighted={Boolean(highlightKey) && highlightKey === item.imageKey}
                />
              );
            })}
          </ol>
        ) : (
          <p className="qbs-empty">
            {filter === 'todo' ? 'Every question in this topic is solved.' : filter === 'done' ? 'Nothing solved in this topic yet.' : 'No questions in this topic.'}
          </p>
        )}
      </section>
    </div>
  );
}

// ── semester-wise ────────────────────────────────────────────────────────────

/** Every single item of one paper, in printed order. */
function paperItems(paper, courseKey) {
  const items = [];
  paper.questions.forEach((question, rowIndex) => {
    const match = question.__match;
    const topic = match?.topic || question.__topic || '';
    const legacyBase = question.__legacyKey || semesterImageKey(courseKey, paper.semester, rowIndex);
    const base = match?.key || legacyBase;
    const singles = splitIntoSingles(question.question, question.part).map((single) => ({
      ...single,
      id: singleCheckId(topic, single, question.question),
      legacyIds: questionCheckIds(topic, { question: question.question }),
    }));
    singles.forEach((single, singleIndex) => {
      const imageKey = single.part ? partImageKey(base, single.part, single.index) : base;
      const legacyKey = single.part ? partImageKey(legacyBase, single.part, single.index) : legacyBase;
      items.push({
        key: `${rowIndex}-${singleIndex}`,
        question,
        single,
        siblings: singles,
        topic,
        match,
        imageKey,
        legacyKey,
        number: formatSingleNumber(question.number ?? rowIndex + 1, single.label),
      });
    });
  });
  return items;
}

export function PaperWorkspace({
  papers,
  topicsByName,
  activePaper,
  onActivePaperChange,
  courseKey = '',
  images = {},
  pictureHandlers,
  checklistItems = {},
  checklistEnabled = false,
  onSetChecklist,
  onJump,
  onOpenOriginal,
}) {
  const [filter, setFilter] = useState('all');

  const itemsByPaper = useMemo(() => {
    const map = new Map();
    papers.forEach((paper) => map.set(paper.semester, paperItems(paper, courseKey)));
    return map;
  }, [papers, courseKey]);

  if (!papers.length) {
    return (
      <p className="qbs-empty">
        This answer has no SEMESTER_PAPERS section, so the papers cannot be shown as printed.
        Copy the master prompt again and re-run it to get every paper question by question.
      </p>
    );
  }

  const current = papers.find((paper) => paper.semester === activePaper) || papers[0];
  const items = itemsByPaper.get(current.semester) || [];
  const solvedCount = items.filter((item) => isSingleSolved(checklistItems, item.single)).length;
  const visible = items.filter((item) => keepByFilter(filter, isSingleSolved(checklistItems, item.single)));
  const exams = [...new Set(items.map((item) => item.question.exam || '-'))];
  const groups = exams.map((exam) => ({ exam, items: visible.filter((item) => (item.question.exam || '-') === exam) }))
    .filter((group) => group.items.length);

  return (
    <div className="qbs-workspace">
      <aside className="qbs-rail" aria-label="Papers">
        <div className="qbs-rail-list">
          {papers.map((paper) => {
            const list = itemsByPaper.get(paper.semester) || [];
            const solved = list.filter((item) => isSingleSolved(checklistItems, item.single)).length;
            const paperExams = [...new Set(paper.questions.map((question) => question.exam).filter((exam) => exam && exam !== '-'))];
            return (
              <RailItem
                key={paper.semester}
                active={paper.semester === current.semester}
                label={paper.semester}
                sub={paperExams.join(' and ')}
                solved={solved}
                total={list.length}
                onClick={() => onActivePaperChange?.(paper.semester)}
              />
            );
          })}
        </div>
      </aside>

      <section className="qbs-main" aria-labelledby="qbs-paper-title">
        <header className="qbs-main-head">
          <div className="qbs-main-title">
            <h3 id="qbs-paper-title">{current.semester}</h3>
            <p>{items.length} question{items.length === 1 ? '' : 's'}, numbered as printed on the paper</p>
          </div>
          <div className="qbs-main-tools">
            <ListFilter value={filter} onChange={setFilter} counts={{ total: items.length, solved: solvedCount }} />
          </div>
        </header>

        {groups.length ? groups.map((group) => (
          <div className="qbs-group" key={group.exam}>
            {exams.length > 1 ? <h4 className="qbs-group-title">{group.exam === '-' ? 'Other' : group.exam}</h4> : null}
            <ol className="qbs-list">
              {group.items.map((item) => {
                const { question, single, topic } = item;
                const solved = isSingleSolved(checklistItems, single);
                const tags = [];
                if (question.marks !== null && question.marks !== undefined) tags.push({ key: 'marks', label: `${question.marks} marks` });
                const topicInfo = topicsByName.get(String(topic).toLowerCase());
                return (
                  <SingleCard
                    key={`${current.semester}-${item.key}`}
                    number={item.number}
                    topic={topic}
                    priority={topicInfo?.priority}
                    onTopicClick={item.match && onJump ? () => onJump({ topic, key: item.imageKey }) : undefined}
                    tags={tags}
                    stem={single.stem}
                    text={single.text}
                    needsFigure={Boolean(question.needsFigure)}
                    solved={solved}
                    checklistEnabled={checklistEnabled && Boolean(topic)}
                    onToggleSolved={() => onSetChecklist?.(singleToggleChanges(checklistItems, single, item.siblings))}
                    original={{ qid: question.qid || '', regions: question.sourceRegions || [], semester: current.semester, number: question.number }}
                    onOpenFull={onOpenOriginal ? () => onOpenOriginal(question.qid || '', question.question) : undefined}
                    pictures={pictureProps(item.imageKey, item.legacyKey, images, pictureHandlers)}
                  />
                );
              })}
            </ol>
          </div>
        )) : (
          <p className="qbs-empty">
            {filter === 'todo' ? 'Every question on this paper is solved.' : 'Nothing solved on this paper yet.'}
          </p>
        )}
      </section>
    </div>
  );
}

// ── section nav ──────────────────────────────────────────────────────────────

/**
 * The bar that splits the question bank into sections, like a navbar:
 * Setup · Topic-wise · Semester-wise · Overview · Coverage · Trends · Predicted.
 * `sep: true` on an item draws a thin divider before it.
 */
export function SectionNav({ sections, active, onChange, label = 'Question bank sections', navRef }) {
  return (
    <nav className="qbs-nav" aria-label={label} ref={navRef}>
      {sections.map(({ id, label: text, icon: Icon, count, alert, disabled, sep }) => (
        <span key={id} style={{ display: 'contents' }}>
          {sep ? <span className="qbs-nav-sep" aria-hidden="true" /> : null}
          <button
            type="button"
            className={`qbs-nav-btn${active === id ? ' is-active' : ''}`}
            aria-current={active === id ? 'page' : undefined}
            disabled={disabled}
            onClick={() => onChange(id)}
          >
            {Icon ? <Icon size={16} aria-hidden="true" /> : null}
            <span>{text}</span>
            {count !== undefined && count !== null ? (
              <span className={`qbs-nav-count${alert ? ' is-alert' : ''}`}>{count}</span>
            ) : null}
          </button>
        </span>
      ))}
    </nav>
  );
}
