import { createPortal } from 'react-dom';
import { buildQuestionVersions } from './previewAnalytics';
import { splitSemesterList } from './parseQuestionBank';
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

function ReportQuestion({ question }) {
  const variants = Array.isArray(question?.variants) ? question.variants : [];
  const versions = buildQuestionVersions(question);
  const images = Array.isArray(question?.images) ? question.images : [];

  const versionBlocks = versions.length ? (
    <div className="qba-report-versions">
      {versions.map((version, index) => (
        <div className="qba-report-version" key={`${version.label}-${index}`}>
          <span className="qba-report-version-label">{version.label}</span>
          <span className="qba-report-version-text">{version.text}</span>
        </div>
      ))}
    </div>
  ) : null;

  const figures = images.length ? (
    <div className="qba-report-figures">
      {images.map((image, index) => (
        <figure className="qba-report-figure" key={image.name || index}>
          <img src={image.url} alt={image.name || `Figure ${index + 1}`} />
          <figcaption>Figure {index + 1}{image.name ? ` — ${image.name}` : ''}</figcaption>
        </figure>
      ))}
    </div>
  ) : null;

  if (!variants.length) {
    return (
      <>
        {versionBlocks || <span className="qba-report-question-text">{question?.question || ''}</span>}
        {figures}
      </>
    );
  }

  return (
    <div className="qba-report-question-stack">
      {versionBlocks}
      {figures}
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
  return [...map.entries()];
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
  const summary = data.summary || {};
  const pictureCount = (data.topics || []).reduce(
    (sum, topic) => sum + (topic.questions || []).reduce(
      (inner, question) => inner + (Array.isArray(question.images) ? question.images.length : 0),
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
          {pictureCount ? <span><strong>Pictures:</strong> {pictureCount}</span> : null}
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
        {topicGroups.length === 0 ? (
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
