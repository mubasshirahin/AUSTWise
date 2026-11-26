import { useMemo, useRef, useState } from 'react';
import { BookMarked, FileUp, Info, Loader2, Printer, Sparkles, Wand2 } from 'lucide-react';
import { examOptions, inferPaperStructure, OTHER_TOPIC } from './qbaInsights';
import { matchSyllabusTopics, parseMarksList, predictPaper } from './qbaPredict';
import { extractFileText } from './qbaOriginal';
import { BandBadge, CropImage, QuestionLines, TrendBadge } from './InsightsShared';

const PRINT_CLASS = 'qbi-printing-paper';

export default function PredictedPaperPanel({ data, sourceFiles = [], course = '', title = '' }) {
  const options = useMemo(() => examOptions(data), [data]);
  const [exam, setExam] = useState(() => options[0]?.exam || 'all');
  const structure = useMemo(() => inferPaperStructure(data, exam), [data, exam]);
  const [questionCount, setQuestionCount] = useState(structure.questionCount);
  const [answerCount, setAnswerCount] = useState('');
  const [marksText, setMarksText] = useState(String(structure.marksEach));
  const [showOriginals, setShowOriginals] = useState(true);
  const topicNames = useMemo(
    () => (data?.topics || []).map((topic) => topic.name).filter((name) => name !== OTHER_TOPIC),
    [data],
  );
  // Topics left OUT of the syllabus — a topic added later is in by default.
  const [excluded, setExcluded] = useState(() => new Set());
  const syllabus = useMemo(
    () => new Set(topicNames.filter((name) => !excluded.has(name))),
    [topicNames, excluded],
  );
  const [syllabusText, setSyllabusText] = useState('');
  const [syllabusNote, setSyllabusNote] = useState('');
  const [reading, setReading] = useState(false);
  const fileRef = useRef(null);

  // A new exam type brings its own usual paper shape.
  const changeExam = (next) => {
    const shape = inferPaperStructure(data, next);
    setExam(next);
    setQuestionCount(shape.questionCount);
    setMarksText(String(shape.marksEach));
  };

  const marks = useMemo(() => parseMarksList(marksText, questionCount), [marksText, questionCount]);
  const paper = useMemo(() => predictPaper(data, {
    exam,
    syllabus: syllabus.size === topicNames.length ? null : syllabus,
    questionCount,
    answerCount,
    marks: marks.length ? marks : structure.marksEach,
  }), [data, exam, syllabus, topicNames.length, questionCount, answerCount, marks, structure.marksEach]);

  const toggleTopic = (name) => {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const applySyllabus = (text) => {
    const matched = matchSyllabusTopics(topicNames, text);
    if (!matched.size) {
      setSyllabusNote('No topic name was found in that syllabus — tick the topics by hand.');
      return;
    }
    setExcluded(new Set(topicNames.filter((name) => !matched.has(name))));
    setSyllabusNote(`Matched ${matched.size} of ${topicNames.length} topics. Check the ticks and fix any the syllabus words differently.`);
  };

  const readSyllabusFile = async (file) => {
    if (!file) return;
    setReading(true);
    setSyllabusNote('');
    try {
      const text = await extractFileText(file);
      if (!text.trim()) {
        setSyllabusNote('That file has no readable text (it may be a scan). Paste the syllabus text instead.');
      } else {
        setSyllabusText(text.slice(0, 20000));
        applySyllabus(text);
      }
    } catch {
      setSyllabusNote('The file could not be read. Paste the syllabus text instead.');
    } finally {
      setReading(false);
    }
  };

  const handlePrint = () => {
    const root = document.documentElement;
    const previous = document.title;
    document.title = `${(course || 'course').replace(/\s+/g, '_')}_predicted_${exam === 'all' ? 'paper' : exam.toLowerCase()}`;
    root.classList.add(PRINT_CLASS);
    const cleanup = () => {
      root.classList.remove(PRINT_CLASS);
      document.title = previous;
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 30000);
    window.print();
  };

  if (!topicNames.length) {
    return <div className="qbi-empty"><p>Build the report first — the prediction is made from its topics.</p></div>;
  }

  const examName = exam === 'all' ? 'Examination' : `${exam} Examination`;
  const totalMarks = paper.slots.reduce((sum, slot) => sum + (slot.marks || 0), 0);
  const answerAny = Number(answerCount) > 0 && Number(answerCount) < paper.slots.length ? Number(answerCount) : null;

  return (
    <div className="qbi-panel">
      <div className="qbi-panel-head">
        <div>
          <h3>Predicted paper</h3>
          <p>Built from {paper.paperCount} past paper{paper.paperCount === 1 ? '' : 's'} — your syllabus and mark plan decide the shape.</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrint} disabled={!paper.slots.length}>
          <Printer size={14} aria-hidden="true" /> Print / PDF
        </button>
      </div>

      <section className="qbi-card qbi-controls">
        <div className="qbi-form-grid">
          <label>
            Exam
            <select className="input" value={exam} onChange={(event) => changeExam(event.target.value)}>
              {options.map((option) => (
                <option key={option.exam} value={option.exam}>{option.exam} ({option.count} papers)</option>
              ))}
              <option value="all">All exams together</option>
            </select>
          </label>
          <label>
            Questions on paper
            <input
              className="input"
              type="number"
              min="1"
              max="20"
              value={questionCount}
              onChange={(event) => setQuestionCount(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
            />
          </label>
          <label>
            <span>Answer any <span className="qbi-muted">(optional)</span></span>
            <input
              className="input"
              type="number"
              min="0"
              max={questionCount}
              value={answerCount}
              onChange={(event) => setAnswerCount(event.target.value)}
              placeholder={`e.g. ${Math.max(1, questionCount - 2)}`}
            />
          </label>
          <label>
            Marks per question
            <input
              className="input"
              value={marksText}
              onChange={(event) => setMarksText(event.target.value)}
              placeholder="10  or  10,10,15  or  4x10 2x15"
            />
          </label>
        </div>

        <div className="qbi-syllabus">
          <div className="qbi-syllabus-head">
            <span className="qbi-label">
              <BookMarked size={14} aria-hidden="true" /> Syllabus for this exam
              <span className="qbi-muted"> · {syllabus.size}/{topicNames.length} topics</span>
            </span>
            <span className="qbi-row">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExcluded(new Set())}>All</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExcluded(new Set(topicNames))}>None</button>
            </span>
          </div>
          <div className="qbi-chips qbi-chips-wrap">
            {topicNames.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={syllabus.has(name)}
                className={`qbi-chip${syllabus.has(name) ? ' is-active' : ''}`}
                onClick={() => toggleTopic(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <details className="qbi-syllabus-match">
            <summary><Wand2 size={14} aria-hidden="true" /> Tick topics from your teacher’s syllabus</summary>
            <textarea
              className="input"
              rows={4}
              value={syllabusText}
              onChange={(event) => setSyllabusText(event.target.value)}
              placeholder="Paste the syllabus / course outline for this exam"
            />
            <div className="qbi-row">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => applySyllabus(syllabusText)} disabled={!syllabusText.trim()}>
                <Sparkles size={14} aria-hidden="true" /> Match topics
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt,.md,text/plain,application/pdf"
                className="qba-file-input"
                onChange={(event) => { readSyllabusFile(event.target.files?.[0]); event.target.value = ''; }}
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={reading}>
                {reading ? <Loader2 size={14} className="qba-spin" aria-hidden="true" /> : <FileUp size={14} aria-hidden="true" />}
                Upload syllabus (PDF / TXT)
              </button>
            </div>
          </details>
          {syllabusNote ? <p className="qbi-note"><Info size={13} aria-hidden="true" /> {syllabusNote}</p> : null}
        </div>
      </section>

      {paper.usedAllExams ? (
        <p className="qbi-note">
          <Info size={13} aria-hidden="true" />
          Fewer than two {exam} papers were found, so every exam type was used for the prediction.
        </p>
      ) : null}

      {!paper.slots.length ? (
        <div className="qbi-empty"><p>Tick at least one syllabus topic to build the paper.</p></div>
      ) : (
        <>
          <div className="qbi-row qbi-sheet-tools">
            <label className="qbi-switch">
              <input type="checkbox" checked={showOriginals} onChange={(event) => setShowOriginals(event.target.checked)} />
              Show original question pictures
            </label>
            {paper.slots.length < questionCount ? (
              <span className="qbi-muted">
                Only {paper.slots.length} different question{paper.slots.length === 1 ? '' : 's'} exist for these topics.
              </span>
            ) : null}
          </div>

          <article className="qbi-sheet" aria-label="Predicted question paper">
            <header className="qbi-sheet-head">
              <span className="qbi-sheet-kicker">Predicted · made by AUSTWise from past papers</span>
              <h4>{course || data.course || 'Course'}{(title || data.title) ? ` — ${title || data.title}` : ''}</h4>
              <p className="qbi-sheet-exam">{examName}</p>
              <p className="qbi-sheet-meta">
                <span>Total marks: {answerAny && paper.slots.every((slot) => slot.marks === paper.slots[0].marks)
                  ? answerAny * (paper.slots[0].marks || 0)
                  : totalMarks}</span>
                <span>{answerAny ? `Answer any ${answerAny} of ${paper.slots.length}` : `Answer all ${paper.slots.length} questions`}</span>
              </p>
            </header>

            <ol className="qbi-sheet-list">
              {paper.slots.map((slot) => (
                <li key={slot.number} className="qbi-slot">
                  <div className="qbi-slot-head">
                    <span className="qbi-slot-no">{slot.number}.</span>
                    <span className="qbi-slot-topic">{slot.topic}</span>
                    <BandBadge band={slot.band} />
                    <TrendBadge trend={slot.trend} />
                    {slot.marks ? <span className="qbi-slot-marks">[{slot.marks}]</span> : null}
                  </div>
                  {slot.question ? (
                    <>
                      <QuestionLines text={slot.question.text} />
                      {showOriginals ? (
                        <CropImage
                          regions={slot.question.sourceRegions}
                          sourceFiles={sourceFiles}
                          semester={slot.question.sourceSemester}
                          number={slot.question.sourceNumber}
                          alt={`Original of question ${slot.number}`}
                          missingHint={false}
                        />
                      ) : null}
                      <p className="qbi-slot-why">
                        {slot.reason}
                        {slot.question.count > 1 ? ` · this exact question came ${slot.question.count} times` : ''}
                      </p>
                      {slot.alternates.length ? (
                        <details className="qbi-alt">
                          <summary>Could also come as ({slot.alternates.length})</summary>
                          {slot.alternates.map((alt) => (
                            <div key={alt.text} className="qbi-alt-item">
                              <QuestionLines text={alt.text} />
                              <small>{alt.semesters.join(', ')}</small>
                            </div>
                          ))}
                        </details>
                      ) : null}
                    </>
                  ) : null}
                </li>
              ))}
            </ol>

            {paper.backups.length ? (
              <footer className="qbi-sheet-foot">
                <h5>Also prepare</h5>
                <ul>
                  {paper.backups.map((backup) => (
                    <li key={backup.topic}>
                      <strong>{backup.topic}</strong> <BandBadge band={backup.band} />
                      <small>{backup.reason}</small>
                    </li>
                  ))}
                </ul>
              </footer>
            ) : null}
            <p className="qbi-sheet-disclaimer">
              A prediction from {paper.paperCount} past paper{paper.paperCount === 1 ? '' : 's'} — not a leaked paper.
              Use it to decide what to study first, and still cover the whole syllabus.
            </p>
          </article>
        </>
      )}
    </div>
  );
}
