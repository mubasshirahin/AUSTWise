import { useMemo, useState } from 'react';
import { Flame, Repeat2, TrendingUp } from 'lucide-react';
import { buildTopicTrends, examOptions, paperLabel } from './qbaInsights';
import { BandBadge, TrendBadge } from './InsightsShared';

function shortSemester(semester) {
  const text = String(semester || '');
  const season = text.match(/spring|summer|fall|autumn|winter/i);
  const year = text.match(/(?:19|20)(\d{2})/);
  if (!season || !year) return text.slice(0, 8);
  return `${season[0].slice(0, 3)} ’${year[1]}`;
}

function ExamChips({ options, value, onChange }) {
  if (options.length < 2) return null;
  return (
    <div className="qbi-chips" role="radiogroup" aria-label="Exam type">
      {[{ exam: 'all', count: options.reduce((sum, item) => sum + item.count, 0) }, ...options].map((option) => (
        <button
          key={option.exam}
          type="button"
          role="radio"
          aria-checked={value === option.exam}
          className={`qbi-chip${value === option.exam ? ' is-active' : ''}`}
          onClick={() => onChange(option.exam)}
        >
          {option.exam === 'all' ? 'All exams' : option.exam}
          <span className="qbi-chip-count">{option.count}</span>
        </button>
      ))}
    </div>
  );
}

function HighlightCard({ icon: Icon, tone, title, hint, topics, empty }) {
  return (
    <section className={`qbi-highlight qbi-tone-${tone}`}>
      <header>
        <span className="qbi-highlight-icon"><Icon size={15} aria-hidden="true" /></span>
        <div>
          <h4>{title}</h4>
          <p>{hint}</p>
        </div>
      </header>
      {topics.length ? (
        <ul>
          {topics.map((topic) => (
            <li key={topic.name}>
              <span className="qbi-highlight-name">{topic.name}</span>
              <span className="qbi-highlight-stat">{topic.hits}/{topic.paperCount}</span>
            </li>
          ))}
        </ul>
      ) : <p className="qbi-highlight-empty">{empty}</p>}
    </section>
  );
}

export default function TrendsPanel({ data }) {
  const options = useMemo(() => examOptions(data), [data]);
  const [exam, setExam] = useState(() => options[0]?.exam || 'all');
  const activeExam = exam === 'all' || options.some((option) => option.exam === exam) ? exam : 'all';
  const trends = useMemo(() => buildTopicTrends(data, { exam: activeExam }), [data, activeExam]);

  if (!trends.papers.length) {
    return (
      <div className="qbi-empty">
        <p>No semester information was found, so there is nothing to chart yet.</p>
      </div>
    );
  }

  const due = trends.topics.filter((topic) => topic.trend === 'due').slice(0, 4);
  const rising = trends.topics.filter((topic) => topic.trend === 'rising' || topic.trend === 'new').slice(0, 4);
  const constant = trends.topics.filter((topic) => topic.hitRate >= 0.75 && topic.trend !== 'due').slice(0, 4);
  const maxMarks = Math.max(1, ...trends.topics.flatMap((topic) => topic.cells.map((cell) => cell.marks || cell.count)));
  const showExam = activeExam === 'all';

  return (
    <div className="qbi-panel">
      <div className="qbi-panel-head">
        <div>
          <h3>Topic trends</h3>
          <p>
            {trends.papers.length} paper{trends.papers.length === 1 ? '' : 's'}, oldest to newest
            {trends.source === 'topics' ? ' · built from topic rows (no raw papers in this answer)' : ''}
          </p>
        </div>
        <ExamChips options={options} value={activeExam} onChange={setExam} />
      </div>

      <div className="qbi-highlights">
        <HighlightCard
          icon={Flame}
          tone="rose"
          title="Due this time"
          hint="Usually comes, skipped last paper"
          topics={due}
          empty="No regular topic was skipped last time."
        />
        <HighlightCard
          icon={TrendingUp}
          tone="amber"
          title="Rising"
          hint="Coming more in recent papers"
          topics={rising}
          empty="No topic is clearly rising."
        />
        <HighlightCard
          icon={Repeat2}
          tone="emerald"
          title="Almost always"
          hint="In 3 of every 4 papers or more"
          topics={constant}
          empty="No topic comes that reliably."
        />
      </div>

      <div className="qbi-grid-wrap" role="region" aria-label="Topic by paper timeline" tabIndex={0}>
        <table className="qbi-grid">
          <thead>
            <tr>
              <th scope="col" className="qbi-grid-topic">Topic</th>
              {trends.papers.map((paper) => (
                <th scope="col" key={paper.id} title={paperLabel(paper)}>
                  <span>{shortSemester(paper.semester)}</span>
                  {showExam ? <small>{paper.exam}</small> : null}
                </th>
              ))}
              <th scope="col" className="qbi-grid-sum">Came</th>
            </tr>
          </thead>
          <tbody>
            {trends.topics.map((topic) => (
              <tr key={topic.name}>
                <th scope="row" className="qbi-grid-topic">
                  <span className="qbi-grid-name">{topic.name}</span>
                  <span className="qbi-grid-tags">
                    <BandBadge band={topic.band} />
                    <TrendBadge trend={topic.trend} />
                  </span>
                </th>
                {topic.cells.map((cell, index) => {
                  const paper = trends.papers[index];
                  const weight = cell.count ? 0.35 + 0.65 * ((cell.marks || cell.count) / maxMarks) : 0;
                  const label = cell.count
                    ? `${paperLabel(paper)}: ${cell.count} question${cell.count === 1 ? '' : 's'}${cell.marks ? `, ${cell.marks} marks` : ''}`
                    : `${paperLabel(paper)}: not asked`;
                  return (
                    <td key={paper.id} title={label} aria-label={label}>
                      {cell.count ? (
                        <span className="qbi-dot" style={{ '--qbi-dot': weight }}>
                          {cell.count > 1 ? cell.count : ''}
                        </span>
                      ) : <span className="qbi-dot-empty" aria-hidden="true" />}
                    </td>
                  );
                })}
                <td className="qbi-grid-sum">
                  <strong>{topic.hits}</strong>/{topic.paperCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="qbi-footnote">
        A filled dot means the topic was asked in that paper; a darker dot carried more marks. “Due”, “Rising” and the
        likelihood labels are worked out from these dots — how often, how recently, and how many marks.
      </p>
    </div>
  );
}
