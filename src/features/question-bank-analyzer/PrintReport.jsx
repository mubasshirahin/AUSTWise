import { createPortal } from 'react-dom';
import austwiseIcon from '../../assets/austwise-icon-final.svg';
import { compareSemestersDesc } from './previewAnalytics';
import { splitSemesterList } from './parseQuestionBank';
import { buildQuestionMatchIndex } from './qbaQuestionMatch';
import { questionCheckIds } from './qbaChecklist';
import {
  countSolvedSingles,
  formatSingleNumber,
  isSingleSolved,
  orderTopicRows,
  rowSingles,
  singleCheckId,
  splitIntoSingles,
} from './qbaSingles';
import './PrintReport.css';

function PriorityBadge({ priority }) {
  const value = priority || 'MEDIUM';
  return <span className={`qba-prio qba-prio-${value.toLowerCase()}`}>{value}</span>;
}

function priorityClass(priority) {
  return `qba-row-${String(priority || 'MEDIUM').toLowerCase()}`;
}

function display(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return value;
}

function isImageAttachment(item) {
  if (!item) return false;
  if (item.media === 'image') return true;
  if (item.media === 'file') return false;
  if (item.mime) return String(item.mime).startsWith('image/');
  // Records from before the split have no mime/media and are always pictures.
  return true;
}

function fileLabel(item) {
  const name = String(item?.name || 'attachment');
  const dot = name.lastIndexOf('.');
  const extension = dot >= 0 ? name.slice(dot + 1).toUpperCase() : '';
  return extension || 'File';
}

/**
 * Question and answer attachments under one small label. Pictures are printed
 * as figures; PDF/PPT/DOC files are printed as a named attachment because a
 * print engine cannot render their pages.
 */
function FigureList({ images, label = '' }) {
  if (!Array.isArray(images) || !images.length) return null;
  const pictures = images.filter(isImageAttachment);
  const files = images.filter((image) => !isImageAttachment(image));

  return (
    <div className="qba-report-attachments">
      {label ? <span className="qba-report-attachment-label">{label}</span> : null}
      {pictures.length ? (
        <div className="qba-report-figures">
          {pictures.map((image, index) => (
            <figure className="qba-report-figure" key={`${image.name || 'figure'}-${index}`}>
              <img src={image.url} alt={image.name || `Figure ${index + 1}`} />
              <figcaption>
                {label ? `${label} ` : ''}{index + 1}{image.name ? ` — ${image.name}` : ''}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      {files.length ? (
        <div className="qba-report-file-list">
          {files.map((file, index) => (
            <span className="qba-report-file" key={`${file.name || 'file'}-${index}`}>
              <strong>{fileLabel(file)}</strong>
              <span>{file.name || 'Attachment'}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const NO_FIGURES = { question: [], answer: [] };

function figuresFrom(entry) {
  if (!entry) return NO_FIGURES;
  return {
    question: Array.isArray(entry.question) ? entry.question : [],
    answer: Array.isArray(entry.answer) ? entry.answer : [],
  };
}

/**
 * The attachments of one single question. A split part uses its own part
 * slot; whole-row pictures from before the split go with the first part, so
 * nothing attached earlier goes missing from the PDF.
 */
function singleFigures(question, single, isFirst) {
  const versionIndex = typeof single.versionIndex === 'number' ? single.versionIndex : -1;
  const whole = versionIndex >= 0
    ? { question: question.versionImages?.[versionIndex] || [], answer: question.versionAnswerImages?.[versionIndex] || [] }
    : { question: question.images || [], answer: question.answerImages || [] };
  if (!single.part) return figuresFrom(whole);
  const pool = versionIndex >= 0 ? (question.versionPartImages?.[versionIndex] || []) : (question.partImages || []);
  const own = figuresFrom(pool[single.index]);
  if (!isFirst) return own;
  return { question: [...whole.question, ...own.question], answer: [...whole.answer, ...own.answer] };
}

/** One single question: version label, shared stem, its own text, its files. */
function SingleQuestion({ single, figures }) {
  return (
    <div className="qba-report-question-stack">
      {single.version?.label ? <span className="qba-report-version-label">{single.version.label}</span> : null}
      {single.stem ? <span className="qba-report-stem">{single.stem}</span> : null}
      <span className="qba-report-question-text">{single.text || '—'}</span>
      <FigureList images={figures.question} label="Question" />
      <FigureList images={figures.answer} label="Answer" />
    </div>
  );
}

/** A box to tick on paper; already ticked when solved on the site. */
function DoneBox({ solved }) {
  return (
    <span className={`qba-done-box${solved ? ' is-on' : ''}`} aria-label={solved ? 'Solved' : 'Not solved'}>
      {solved ? '✓' : ''}
    </span>
  );
}

/** Every single question of a topic, numbered like the screen: 1, 2)a, 2)b. */
function topicSingleRows(topic, items) {
  const rows = [];
  orderTopicRows(topic.questions).forEach((question, rowIndex) => {
    let lastWording = null;
    rowSingles(topic.name, question).forEach((single) => {
      const isFirst = lastWording !== single.versionIndex;
      lastWording = single.versionIndex;
      rows.push({
        key: `${question.originalIndex}-${single.versionIndex}-${single.index}`,
        number: formatSingleNumber(rowIndex + 1, single.label),
        question,
        single,
        figures: singleFigures(question, single, isFirst),
        solved: isSingleSolved(items, single),
      });
    });
  });
  return rows;
}

/** Every single question of a printed paper, with its own topic. */
function paperSingleRows(paper, matchIndex, items) {
  const rows = [];
  paper.questions.forEach((question, rowIndex) => {
    const topic = matchIndex.match(question.question, question.qid)?.topic || 'Other questions';
    const singles = splitIntoSingles(question.question, question.part);
    singles.forEach((single, singleIndex) => {
      const withIds = {
        ...single,
        id: singleCheckId(topic, single, question.question),
        legacyIds: questionCheckIds(topic, { question: question.question }),
      };
      rows.push({
        key: `${rowIndex}-${singleIndex}`,
        number: formatSingleNumber(question.number ?? rowIndex + 1, single.label),
        topic,
        question,
        single: withIds,
        figures: singleFigures(question, single, singleIndex === 0),
        solved: isSingleSolved(items, withIds),
      });
    });
  });
  return rows;
}

/** Older answers without raw papers: the topic rows grouped by semester. */
function groupBySemester(topics, items) {
  const map = new Map();
  for (const topic of topics) {
    for (const row of topicSingleRows(topic, items)) {
      // A merged row can name several semesters — show it under each one.
      const names = splitSemesterList(row.question.semester);
      if (!names.length) names.push('Unknown semester');
      for (const semester of names) {
        if (!map.has(semester)) map.set(semester, []);
        map.get(semester).push({ ...row, topic: topic.name });
      }
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => compareSemestersDesc(a, b));
}

export default function PrintReport({ data, className = '', innerRef, checklist = null }) {
  if (!data) return null;

  const generated = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const semesters = data.semesters && data.semesters.length
    ? data.semesters.join(' · ')
    : 'Semesters not listed';

  const items = checklist || {};
  const topicRows = new Map((data.topics || []).map((topic) => [topic.name, topicSingleRows(topic, items)]));
  const topicGroups = groupBySemester(data.topics || [], items);
  const matchIndex = buildQuestionMatchIndex(data, '');
  const singleCount = countSolvedSingles(data.topics || [], {}).total;
  const semesterPapers = (data.semesterPapers || [])
    .filter((paper) => paper.questions?.length)
    // Newest paper first, same order as the preview.
    .sort((a, b) => compareSemestersDesc(a.semester, b.semester));
  const summary = data.summary || {};
  const pictureCount = (data.topics || []).reduce(
    (sum, topic) => sum + (topic.questions || []).reduce(
      (inner, question) => {
        const hasVersionAttachments = (
          (Array.isArray(question.versionImages) && question.versionImages.length)
          || (Array.isArray(question.versionAnswerImages) && question.versionAnswerImages.length)
        );
        return inner
          + (hasVersionAttachments ? 0 : (Array.isArray(question.images) ? question.images.length : 0))
          + (hasVersionAttachments ? 0 : (Array.isArray(question.answerImages) ? question.answerImages.length : 0))
          + (Array.isArray(question.versionImages)
            ? question.versionImages.reduce((count, images) => count + images.length, 0)
            : 0)
          + (Array.isArray(question.versionAnswerImages)
            ? question.versionAnswerImages.reduce((count, images) => count + images.length, 0)
            : 0);
      },
      0,
    ),
    0,
  ) + (data.semesterPapers || []).reduce(
    (sum, paper) => sum + (paper.questions || []).reduce(
      (inner, question) => inner
        + (Array.isArray(question.images) ? question.images.length : 0)
        + (Array.isArray(question.answerImages) ? question.answerImages.length : 0),
      0,
    ),
    0,
  );

  return (
    <div className={`qba-report ${className}`.trim()} ref={innerRef}>
      <header className="qba-report-header">
        <div className="qba-report-kicker"><img src={austwiseIcon} alt="AUSTWise" style={{ width: 22, height: 22, objectFit: 'contain', verticalAlign: 'middle', marginRight: 8 }} />AUSTWise · Question Bank Analysis</div>
        <h1 className="qba-report-course">
          {display(data.course, 'Course code')} — {display(data.title, 'Course title')}
        </h1>
        <div className="qba-report-meta">
          <span><strong>Semesters:</strong> {semesters}</span>
          <span><strong>Generated:</strong> {generated}</span>
          {pictureCount ? <span><strong>Attachments:</strong> {pictureCount}</span> : null}
        </div>
      </header>

      <section className="qba-report-section">
        <h2 className="qba-report-heading">Quick summary</h2>
        <div className="qba-summary-grid">
          {[
            ['Topics', summary.topicCount ?? (data.topics || []).length],
            ['Questions', singleCount],
            ['Times asked', summary.totalAsked ?? 0],
            ['VIP topics', summary.vipCount ?? 0],
            ['HIGH', summary.highCount ?? 0],
            ['MEDIUM', summary.mediumCount ?? 0],
            ['LOW', summary.lowCount ?? 0],
          ].map(([label, value]) => (
            <div className="qba-summary-card" key={label}>
              <span className="qba-summary-value">{value}</span>
              <span className="qba-summary-label">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="qba-report-section">
        <h2 className="qba-report-heading">VIP matrix</h2>
        <p className="qba-report-note">
          Sorted by priority, then by how often the topic was asked. Priority is shown as text as well as colour so the
          report stays readable in black and white.
        </p>
        <table className="qba-report-table qba-vip-table">
          <colgroup>
            <col className="qba-col-vip-topic" />
            <col className="qba-col-vip-asked" />
            <col className="qba-col-vip-avg" />
            <col className="qba-col-vip-last" />
            <col className="qba-col-vip-priority" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Topic</th>
              <th scope="col" className="qba-num">Times asked</th>
              <th scope="col" className="qba-num">Avg marks</th>
              <th scope="col">Last asked</th>
              <th scope="col">Priority</th>
            </tr>
          </thead>
          <tbody>
            {(data.vipMatrix || []).map((row, index) => (
              <tr className={priorityClass(row.priority)} key={`${row.topic}-${index}`}>
                <td><strong>{row.topic}</strong></td>
                <td className="qba-num">{display(row.timesAsked, 0)}</td>
                <td className="qba-num">{display(row.avgMarks)}</td>
                <td>{display(row.lastAsked)}</td>
                <td><PriorityBadge priority={row.priority} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="qba-report-section">
        <h2 className="qba-report-heading">Topic-wise questions</h2>
        <p className="qba-report-note">
          Every sub-part is its own question (2)a, 2)b …), newest first. Tick the box when you have solved it.
        </p>
        {(data.topics || []).map((topic, topicIndex) => {
          const rows = topicRows.get(topic.name) || [];
          return (
          <div className="qba-report-topic" key={`${topic.name}-${topicIndex}`}>
            <div className="qba-report-topic-head">
              <h3>{topic.name}</h3>
              <PriorityBadge priority={topic.priority} />
              <span className="qba-report-topic-meta">
                {rows.length} question{rows.length === 1 ? '' : 's'} · asked {display(topic.timesAsked, 0)} time{topic.timesAsked === 1 ? '' : 's'}
                {topic.avgMarks !== null && topic.avgMarks !== undefined ? ` · average ${topic.avgMarks} marks` : ''}
                {topic.lastAsked && topic.lastAsked !== '-' ? ` · last asked ${topic.lastAsked}` : ''}
              </span>
            </div>
            <table className="qba-report-table">
              <colgroup>
                <col className="qba-col-sno" />
                <col className="qba-col-question" />
                <col className="qba-col-exam" />
                <col className="qba-col-semester" />
                <col className="qba-col-marks" />
                <col className="qba-col-times" />
                <col className="qba-col-done" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="qba-sno">#</th>
                  <th scope="col">Question</th>
                  <th scope="col">Exam</th>
                  <th scope="col">Semester</th>
                  <th scope="col" className="qba-num">Marks</th>
                  <th scope="col" className="qba-num">Times</th>
                  <th scope="col" className="qba-done">Done</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${topic.name}-${row.key}`}>
                    <td className="qba-sno">{row.number}</td>
                    <td className="qba-report-question"><SingleQuestion single={row.single} figures={row.figures} /></td>
                    <td>{display(row.question.exam)}</td>
                    <td>{display(row.question.semester)}</td>
                    <td className="qba-num">{display(row.question.marks)}</td>
                    <td className="qba-num">{display(row.question.times, 0)}</td>
                    <td className="qba-done"><DoneBox solved={row.solved} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          );
        })}
      </section>

      <section className="qba-report-section">
        <h2 className="qba-report-heading">Semester-wise view</h2>
        {semesterPapers.length ? (
          semesterPapers.map((paper) => {
            const rows = paperSingleRows(paper, matchIndex, items);
            return (
            <div className="qba-report-topic" key={paper.semester}>
              <div className="qba-report-topic-head">
                <h3>{paper.semester}</h3>
                <span className="qba-report-topic-meta">
                  {rows.length} question{rows.length === 1 ? '' : 's'} · numbered as printed
                </span>
              </div>
              <table className="qba-report-table">
                <colgroup>
                  <col className="qba-col-paper-sno" />
                  <col className="qba-col-paper-topic" />
                  <col className="qba-col-paper-question" />
                  <col className="qba-col-paper-exam" />
                  <col className="qba-col-paper-marks" />
                  <col className="qba-col-done" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="qba-sno">#</th>
                    <th scope="col">Topic</th>
                    <th scope="col">Question</th>
                    <th scope="col">Exam</th>
                    <th scope="col" className="qba-num">Marks</th>
                    <th scope="col" className="qba-done">Done</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${paper.semester}-${row.key}`}>
                      <td className="qba-sno">{row.number}</td>
                      <td><strong>{row.topic}</strong></td>
                      <td className="qba-report-question"><SingleQuestion single={row.single} figures={row.figures} /></td>
                      <td>{display(row.question.exam)}</td>
                      <td className="qba-num">{display(row.question.marks)}</td>
                      <td className="qba-done"><DoneBox solved={row.solved} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            );
          })
        ) : topicGroups.length === 0 ? (
          <p className="qba-report-note">No semester information was found in the file.</p>
        ) : (
          topicGroups.map(([semester, rows]) => (
            <div className="qba-report-topic" key={semester}>
              <div className="qba-report-topic-head">
                <h3>{semester}</h3>
                <span className="qba-report-topic-meta">{rows.length} question{rows.length === 1 ? '' : 's'}</span>
              </div>
              <table className="qba-report-table">
                <colgroup>
                  <col className="qba-col-sem-topic" />
                  <col className="qba-col-sem-question" />
                  <col className="qba-col-sem-exam" />
                  <col className="qba-col-sem-marks" />
                  <col className="qba-col-sem-times" />
                  <col className="qba-col-done" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Topic</th>
                    <th scope="col">Question</th>
                    <th scope="col">Exam</th>
                    <th scope="col" className="qba-num">Marks</th>
                    <th scope="col" className="qba-num">Times</th>
                    <th scope="col" className="qba-done">Done</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${semester}-${row.topic}-${row.key}`}>
                      <td><strong>{row.topic}</strong> {row.number}</td>
                      <td className="qba-report-question"><SingleQuestion single={row.single} figures={row.figures} /></td>
                      <td>{display(row.question.exam)}</td>
                      <td className="qba-num">{display(row.question.marks)}</td>
                      <td className="qba-num">{display(row.question.times, 0)}</td>
                      <td className="qba-done"><DoneBox solved={row.solved} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </section>

      <section className="qba-report-section qba-plan-section">
        <h2 className="qba-report-heading">Study plan</h2>
        {(data.studyPlan || []).length === 0 ? (
          <p className="qba-report-note">No study plan was found in the file.</p>
        ) : (
          <ol className="qba-report-plan">
            {data.studyPlan.map((item) => (
              <li key={item.step}>{item.text}</li>
            ))}
          </ol>
        )}
      </section>

      <footer className="qba-report-footer">
        Generated by AUSTWise · Question Bank Analyzer · {generated}
      </footer>
    </div>
  );
}

/**
 * Portal the report straight into <body> so the print stylesheet can hide
 * the entire #root when the browser prints. Screen CSS keeps it hidden.
 */
export function PrintPortal({ data, checklist = null }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <PrintReport data={data} checklist={checklist} className="qba-print-root" />,
    document.body,
  );
}
