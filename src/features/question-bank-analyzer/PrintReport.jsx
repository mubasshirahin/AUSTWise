import { createPortal } from 'react-dom';
import { buildQuestionVersions, compareSemestersDesc } from './previewAnalytics';
import { splitSemesterList, splitSubQuestions } from './parseQuestionBank';
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

/**
 * Question text with every (a), (b), (c) part in its own block, followed by
 * the pictures that belong to that part. The same component is used for the
 * semester papers and the topic-wise list, so printed pages match the screen.
 */
function ReportQuestionText({ text, number, partImages = [] }) {
  const { stem, parts } = splitSubQuestions(text || '');
  if (!parts.length) {
    return <span className="qba-report-question-text">{text || ''}</span>;
  }

  return (
    <div className="qba-report-question-stack">
      {stem ? <span className="qba-report-question-text">{stem}</span> : null}
      <ol className="qba-report-subparts">
        {parts.map((part, index) => {
          const prefix = part.number
            || (number !== null && number !== undefined ? String(number) : '');
          const pictures = partImages[index]
            && (Array.isArray(partImages[index].question) || Array.isArray(partImages[index].answer))
            ? partImages[index]
            : { question: [], answer: [] };
          return (
            <li className="qba-report-subpart" key={`${part.label}-${index}`}>
              <div className="qba-report-subpart-head">
                <span className="qba-report-subpart-num">
                  {prefix ? `${prefix}.${part.label})` : `${part.label})`}
                </span>
                <span className="qba-report-subpart-text">{part.text}</span>
              </div>
              <FigureList images={pictures.question} label="Question" />
              <FigureList images={pictures.answer} label="Answer" />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ReportQuestion({ question }) {
  const variants = Array.isArray(question?.variants) ? question.variants : [];
  const versions = buildQuestionVersions(question);
  const images = Array.isArray(question?.images) ? question.images : [];
  const answerImages = Array.isArray(question?.answerImages) ? question.answerImages : [];
  const versionImages = Array.isArray(question?.versionImages) ? question.versionImages : [];
  const versionAnswerImages = Array.isArray(question?.versionAnswerImages)
    ? question.versionAnswerImages
    : [];
  const partImages = Array.isArray(question?.partImages) ? question.partImages : [];
  const versionPartImages = Array.isArray(question?.versionPartImages)
    ? question.versionPartImages
    : [];

  const versionBlocks = versions.length ? (
    <div className="qba-report-versions">
      {versions.map((version, index) => (
        <div className="qba-report-version" key={`${version.label}-${index}`}>
          <span className="qba-report-version-label">{version.label}</span>
          <ReportQuestionText
            text={version.text}
            number={question?.number}
            partImages={versionPartImages[index] || []}
          />
          <FigureList images={versionImages[index]} label="Question" />
          <FigureList images={versionAnswerImages[index]} label="Answer" />
        </div>
      ))}
    </div>
  ) : null;

  const body = (
    <ReportQuestionText
      text={question?.question}
      number={question?.number}
      partImages={partImages}
    />
  );

  if (!variants.length) {
    return (
      <>
        {versionBlocks || body}
        {versions.length ? null : <FigureList images={images} label="Question" />}
        {versions.length ? null : <FigureList images={answerImages} label="Answer" />}
      </>
    );
  }

  return (
    <div className="qba-report-question-stack">
      {versionBlocks}
      {versions.length ? null : body}
      {versions.length ? null : <FigureList images={images} label="Question" />}
      {versions.length ? null : <FigureList images={answerImages} label="Answer" />}
    </div>
  );
}

function groupBySemester(topics) {
  const map = new Map();
  for (const topic of topics) {
    for (const question of topic.questions) {
      // A merged row can name several semesters — show it under each one.
      const names = splitSemesterList(question.semester);
      if (!names.length) names.push('Unknown semester');
      for (const semester of names) {
        if (!map.has(semester)) map.set(semester, []);
        map.get(semester).push({ topic: topic.name, ...question });
      }
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => compareSemestersDesc(a, b));
}

export default function PrintReport({ data, className = '', innerRef }) {
  if (!data) return null;

  const generated = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const semesters = data.semesters && data.semesters.length
    ? data.semesters.join(' · ')
    : 'Semesters not listed';

  const topicGroups = groupBySemester(data.topics || []);
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
        <div className="qba-report-kicker">AUSTWise · Question Bank Analysis</div>
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
            ['Questions', summary.totalQuestions ?? 0],
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
        {(data.topics || []).map((topic, topicIndex) => (
          <div className="qba-report-topic" key={`${topic.name}-${topicIndex}`}>
            <div className="qba-report-topic-head">
              <h3>{topic.name}</h3>
              <PriorityBadge priority={topic.priority} />
              <span className="qba-report-topic-meta">
                {topic.questions.length} question{topic.questions.length === 1 ? '' : 's'} · asked {display(topic.timesAsked, 0)} time{topic.timesAsked === 1 ? '' : 's'}
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
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="qba-sno">#</th>
                  <th scope="col">Question</th>
                  <th scope="col">Exam</th>
                  <th scope="col">Semester</th>
                  <th scope="col" className="qba-num">Marks</th>
                  <th scope="col" className="qba-num">Times</th>
                </tr>
              </thead>
              <tbody>
                {topic.questions.map((question) => (
                  <tr key={`${topic.name}-${question.number}-${question.question}`}>
                    <td className="qba-sno">{question.number}</td>
                    <td className="qba-report-question"><ReportQuestion question={question} /></td>
                    <td>{display(question.exam)}</td>
                    <td>{display(question.semester)}</td>
                    <td className="qba-num">{display(question.marks)}</td>
                    <td className="qba-num">{display(question.times, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section className="qba-report-section">
        <h2 className="qba-report-heading">Semester-wise view</h2>
        {semesterPapers.length ? (
          semesterPapers.map((paper) => (
            <div className="qba-report-topic" key={paper.semester}>
              <div className="qba-report-topic-head">
                <h3>{paper.semester}</h3>
                <span className="qba-report-topic-meta">
                  {paper.questions.length} question{paper.questions.length === 1 ? '' : 's'} · as printed
                </span>
              </div>
              <table className="qba-report-table">
                <colgroup>
                  <col className="qba-col-paper-sno" />
                  <col className="qba-col-paper-question" />
                  <col className="qba-col-paper-exam" />
                  <col className="qba-col-paper-marks" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="qba-sno">#</th>
                    <th scope="col">Question</th>
                    <th scope="col">Exam</th>
                    <th scope="col" className="qba-num">Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {paper.questions.map((question, index) => (
                    <tr key={`${paper.semester}-${index}`}>
                      <td className="qba-sno">{question.number ?? index + 1}</td>
                      <td className="qba-report-question"><ReportQuestion question={question} /></td>
                      <td>{display(question.exam)}</td>
                      <td className="qba-num">{display(question.marks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
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
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Topic</th>
                    <th scope="col">Question</th>
                    <th scope="col">Exam</th>
                    <th scope="col" className="qba-num">Marks</th>
                    <th scope="col" className="qba-num">Times</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((question, index) => (
                    <tr key={`${semester}-${question.topic}-${index}`}>
                      <td><strong>{question.topic}</strong></td>
                      <td className="qba-report-question"><ReportQuestion question={question} /></td>
                      <td>{display(question.exam)}</td>
                      <td className="qba-num">{display(question.marks)}</td>
                      <td className="qba-num">{display(question.times, 0)}</td>
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
export function PrintPortal({ data }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <PrintReport data={data} className="qba-print-root" />,
    document.body,
  );
}
