import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  FilePlus2,
  FileWarning,
  Loader2,
  MousePointerSquareDashed,
  Plus,
  ScanSearch,
  Trash2,
  X,
} from 'lucide-react';
import { buildCoverage, buildRecoveryPrompt, OTHER_TOPIC, sameExam, sameSemester } from './qbaInsights';
import { getPageCount, matchSourceFile, renderPagePreview } from './qbaOriginal';
import { CopyButton } from './InsightsShared';

/** Every Source region on every paper row, with where it came from. */
function collectRegions(data) {
  const list = [];
  (data?.semesterPapers || []).forEach((paper) => {
    (paper.questions || []).forEach((row) => {
      (row.sourceRegions || []).forEach((region) => {
        if (region?.kind !== 'box') return;
        list.push({ ...region, semester: paper.semester, exam: row.exam, number: row.number });
      });
    });
  });
  return list;
}

function sameFile(a, b) {
  return String(a || '').trim().toLowerCase().replace(/[\s_]+/g, '') === String(b || '').trim().toLowerCase().replace(/[\s_]+/g, '');
}

function PageCheck({ data, sourceFiles, onOpenPage }) {
  const regions = useMemo(() => collectRegions(data), [data]);
  const fileNames = useMemo(() => {
    const names = [...(data?.files || [])];
    regions.forEach((region) => {
      if (!names.some((name) => sameFile(name, region.file))) names.push(region.file);
    });
    return names;
  }, [data, regions]);
  const [pageCounts, setPageCounts] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = {};
      for (const name of fileNames) {
        const file = matchSourceFile(name, sourceFiles);
        if (!file) continue;
        try {
          next[name] = await getPageCount(file);
        } catch {
          next[name] = 0;
        }
      }
      if (!cancelled) setPageCounts(next);
    })();
    return () => { cancelled = true; };
  }, [fileNames, sourceFiles]);

  if (!fileNames.length) return null;
  const uploaded = fileNames.filter((name) => matchSourceFile(name, sourceFiles));

  return (
    <section className="qbi-card">
      <header className="qbi-card-head">
        <ScanSearch size={16} aria-hidden="true" />
        <div>
          <h4>Page check</h4>
          <p>
            Every page of your original papers, with how many questions were cut from it. A page with
            <strong> 0</strong> may hold a question the AI skipped — open it and add it yourself.
          </p>
        </div>
      </header>
      {!uploaded.length ? (
        <p className="qbi-muted">Upload the original papers in Step 3 to check them page by page.</p>
      ) : null}
      <ul className="qbi-files">
        {fileNames.map((name) => {
          const file = matchSourceFile(name, sourceFiles);
          const count = pageCounts[name];
          return (
            <li key={name} className="qbi-file">
              <span className="qbi-file-name" title={name}>{name}</span>
              {!file ? <span className="qbi-file-missing">not uploaded</span> : null}
              {file && count === undefined ? <Loader2 size={14} className="qba-spin" aria-label="Reading pages" /> : null}
              {file && count ? (
                <span className="qbi-pages">
                  {Array.from({ length: count }, (_, index) => {
                    const page = index + 1;
                    const boxes = regions.filter((region) => sameFile(region.file, name) && region.page === page).length;
                    return (
                      <button
                        key={page}
                        type="button"
                        className={`qbi-page${boxes ? '' : ' is-empty'}`}
                        onClick={() => onOpenPage({ name, file, page, pageCount: count })}
                        title={boxes ? `Page ${page}: ${boxes} question box${boxes === 1 ? '' : 'es'}` : `Page ${page}: no question was cut from this page`}
                      >
                        p{page}
                        <span>{boxes}</span>
                      </button>
                    );
                  })}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function suggestPaper(data, fileName) {
  const inventory = (data?.inventory || []).find((entry) => sameFile(entry.file, fileName));
  if (inventory) return { semester: inventory.semester, exam: inventory.exam };
  for (const paper of data?.semesterPapers || []) {
    const row = (paper.questions || []).find((item) => (item.sourceRegions || []).some((region) => sameFile(region.file, fileName)));
    if (row) return { semester: paper.semester, exam: row.exam };
  }
  return { semester: data?.semesters?.[0] || '', exam: 'Final' };
}

function firstMissingNumber(coverage, semester, exam) {
  const entry = coverage.entries.find((item) => sameSemester(item.semester, semester) && sameExam(item.exam, exam));
  return entry?.missing?.[0] || '';
}

function PageInspector({ target, data, coverage, onClose, onAdd }) {
  const [page, setPage] = useState(target.page);
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [box, setBox] = useState(null);
  const dragRef = useRef(null);
  const suggestion = useMemo(() => suggestPaper(data, target.name), [data, target.name]);
  const topicNames = useMemo(
    () => [...new Set([...(data?.topics || []).map((topic) => topic.name), OTHER_TOPIC])],
    [data],
  );
  const [form, setForm] = useState(() => ({
    semester: suggestion.semester,
    exam: suggestion.exam && suggestion.exam !== '-' ? suggestion.exam : 'Final',
    number: firstMissingNumber(coverage, suggestion.semester, suggestion.exam),
    marks: '',
    topic: topicNames[0] || OTHER_TOPIC,
    newTopic: '',
    text: '',
  }));

  useEffect(() => {
    let cancelled = false;
    setImage(null);
    setError('');
    renderPagePreview(target.file, page)
      .then((result) => { if (!cancelled) setImage(result); })
      .catch((err) => { if (!cancelled) setError(err?.message || 'This page could not be shown.'); });
    return () => { cancelled = true; };
  }, [target.file, page]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const boxes = useMemo(() => collectRegions(data)
    .filter((region) => sameFile(region.file, target.name) && region.page === page), [data, target.name, page]);

  const point = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clamp = (value) => Math.min(1, Math.max(0, value));
    return [clamp((event.clientX - rect.left) / rect.width), clamp((event.clientY - rect.top) / rect.height)];
  };
  const onPointerDown = (event) => {
    if (!drawing) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const start = point(event);
    dragRef.current = start;
    setBox([start[0], start[1], start[0], start[1]]);
  };
  const onPointerMove = (event) => {
    if (!drawing || !dragRef.current) return;
    const [x, y] = point(event);
    const [sx, sy] = dragRef.current;
    setBox([Math.min(sx, x), Math.min(sy, y), Math.max(sx, x), Math.max(sy, y)]);
  };
  const onPointerUp = () => {
    dragRef.current = null;
    setBox((current) => (current && current[2] - current[0] > 0.02 && current[3] - current[1] > 0.02 ? current : null));
  };

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const canSave = box && form.semester.trim() && Number(form.number) > 0;
  const save = () => {
    if (!canSave) return;
    onAdd({
      semester: form.semester.trim(),
      exam: form.exam,
      number: Number(form.number),
      marks: Number(form.marks) || null,
      topic: form.topic === '__new' ? (form.newTopic.trim() || OTHER_TOPIC) : form.topic,
      text: form.text.trim(),
      file: target.name,
      page,
      box: box.map((value) => Math.round(value * 1000) / 1000),
    });
    onClose();
  };

  const node = (
    <div className="qba-original-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="qba-original-modal qbi-inspector" role="dialog" aria-modal="true" aria-label={`${target.name} page ${page}`}>
        <header className="qba-original-head">
          <div>
            <span className="qba-original-kicker">{target.name}</span>
            <div className="qbi-inspector-pages">
              {Array.from({ length: target.pageCount }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  className={`qbi-page${index + 1 === page ? ' is-current' : ''}`}
                  onClick={() => { setPage(index + 1); setBox(null); }}
                >
                  p{index + 1}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="qba-original-close" onClick={onClose} aria-label="Close page" autoFocus>
            <X size={18} />
          </button>
        </header>
        <div className="qba-original-body qbi-inspector-body">
          <div className="qbi-inspector-tools">
            <button
              type="button"
              className={`btn btn-sm ${drawing ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setDrawing((value) => !value); setBox(null); }}
            >
              <MousePointerSquareDashed size={14} aria-hidden="true" />
              {drawing ? 'Drawing — drag over the question' : 'Add a missed question'}
            </button>
            <span className="qbi-muted">{boxes.length} question box{boxes.length === 1 ? '' : 'es'} already on this page</span>
          </div>
          <div
            className={`qbi-stage${drawing ? ' is-drawing' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {image ? <img src={image.url} alt={`Page ${page}`} draggable={false} /> : null}
            {!image && !error ? <div className="qbi-stage-loading"><Loader2 size={18} className="qba-spin" aria-hidden="true" /></div> : null}
            {error ? <p className="qbi-error">{error}</p> : null}
            {image ? boxes.map((region, index) => (
              <span
                key={index}
                className="qbi-box"
                style={{
                  left: `${region.box[0] * 100}%`,
                  top: `${region.box[1] * 100}%`,
                  width: `${(region.box[2] - region.box[0]) * 100}%`,
                  height: `${(region.box[3] - region.box[1]) * 100}%`,
                }}
              >
                <em>Q{region.number}</em>
              </span>
            )) : null}
            {box ? (
              <span
                className="qbi-box qbi-box-new"
                style={{
                  left: `${box[0] * 100}%`,
                  top: `${box[1] * 100}%`,
                  width: `${(box[2] - box[0]) * 100}%`,
                  height: `${(box[3] - box[1]) * 100}%`,
                }}
              />
            ) : null}
          </div>

          {box ? (
            <form className="qbi-add-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
              <h4>New question from this box</h4>
              <div className="qbi-form-grid">
                <label>
                  Semester
                  <input className="input" value={form.semester} onChange={update('semester')} placeholder="Fall 2023" required />
                </label>
                <label>
                  Exam
                  <select className="input" value={form.exam} onChange={update('exam')}>
                    {['Final', 'Mid', 'Quiz', 'Class Test'].map((exam) => <option key={exam}>{exam}</option>)}
                  </select>
                </label>
                <label>
                  Question no.
                  <input className="input" type="number" min="1" value={form.number} onChange={update('number')} required />
                </label>
                <label>
                  Marks
                  <input className="input" type="number" min="0" value={form.marks} onChange={update('marks')} placeholder="10" />
                </label>
                <label className="qbi-span-2">
                  Topic
                  <select className="input" value={form.topic} onChange={update('topic')}>
                    {topicNames.map((name) => <option key={name} value={name}>{name}</option>)}
                    <option value="__new">+ New topic…</option>
                  </select>
                </label>
                {form.topic === '__new' ? (
                  <label className="qbi-span-2">
                    New topic name
                    <input className="input" value={form.newTopic} onChange={update('newTopic')} placeholder="e.g. Deadlock" />
                  </label>
                ) : null}
                <label className="qbi-span-4">
                  <span>Question text <span className="qbi-muted">(optional — the cut-out picture is always shown)</span></span>
                  <textarea className="input" rows={2} value={form.text} onChange={update('text')} />
                </label>
              </div>
              <div className="qbi-form-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBox(null)}>Redraw</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={!canSave}>
                  <Plus size={14} aria-hidden="true" /> Add to report
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
  return createPortal(node, document.body);
}

export default function CoveragePanel({ data, sourceFiles = [], manual, onAddPart }) {
  const coverage = useMemo(() => buildCoverage(data), [data]);
  const recoveryPrompt = useMemo(() => buildRecoveryPrompt(data, coverage), [data, coverage]);
  const [reply, setReply] = useState('');
  const [inspect, setInspect] = useState(null);

  const missingEntries = coverage.entries.filter((entry) => entry.missing.length);
  const tone = !coverage.hasInventory ? 'muted' : coverage.missingCount ? 'warn' : 'ok';

  return (
    <div className="qbi-panel">
      <div className="qbi-panel-head">
        <div>
          <h3>Coverage check</h3>
          <p>Proof that every printed question made it into your report.</p>
        </div>
      </div>

      <section className={`qbi-coverage-hero qbi-cov-${tone}`}>
        <div className="qbi-ring" style={{ '--qbi-pct': coverage.hasInventory ? coverage.percent : 0 }} aria-hidden="true">
          <span>{coverage.hasInventory ? `${coverage.percent}%` : '—'}</span>
        </div>
        <div>
          {coverage.hasInventory ? (
            <>
              <h4>
                {coverage.missingCount
                  ? `${coverage.missingCount} printed question${coverage.missingCount === 1 ? ' is' : 's are'} missing`
                  : 'Every printed question is in the report'}
              </h4>
              <p>
                {coverage.found} of {coverage.expected} questions across {coverage.entries.length} paper
                {coverage.entries.length === 1 ? '' : 's'} were extracted.
                {coverage.missingCount ? ' Get them back with the message below, or cut them out of the page yourself.' : ''}
              </p>
            </>
          ) : (
            <>
              <h4>This answer has no paper inventory</h4>
              <p>
                It was made with an older prompt, so the site cannot count the printed questions. Copy the prompt again in
                Step 1 for an exact check. The page check below still works.
              </p>
            </>
          )}
        </div>
      </section>

      {coverage.entries.length ? (
        <ul className="qbi-papers">
          {coverage.entries.map((entry) => (
            <li key={`${entry.semester}-${entry.exam}-${entry.file}`} className={`qbi-paper is-${entry.status}`}>
              {entry.status === 'ok'
                ? <CheckCircle2 size={16} aria-hidden="true" />
                : <AlertTriangle size={16} aria-hidden="true" />}
              <span className="qbi-paper-name">
                {entry.semester} {entry.exam !== '-' ? entry.exam : ''}
                {entry.file ? <small>{entry.file}</small> : null}
              </span>
              <span className="qbi-paper-count">{entry.found}/{entry.expected}</span>
              {entry.missing.length ? (
                <span className="qbi-paper-missing">
                  {entry.missing.map((number) => <em key={number}>Q{number}</em>)}
                </span>
              ) : null}
            </li>
          ))}
          {coverage.untracked.map((item) => (
            <li key={`u-${item.semester}-${item.exam}`} className="qbi-paper is-untracked">
              <FileWarning size={16} aria-hidden="true" />
              <span className="qbi-paper-name">{item.semester} {item.exam}<small>not in the inventory</small></span>
              <span className="qbi-paper-count">{item.rows} rows</span>
            </li>
          ))}
        </ul>
      ) : null}

      {missingEntries.length ? (
        <section className="qbi-card qbi-recovery">
          <header className="qbi-card-head">
            <FilePlus2 size={16} aria-hidden="true" />
            <div>
              <h4>Get the missing questions back</h4>
              <p>Send this to the <strong>same AI chat</strong>, then paste its reply below.</p>
            </div>
          </header>
          <pre className="qbi-prompt">{recoveryPrompt}</pre>
          <div className="qbi-row">
            <CopyButton text={recoveryPrompt} label="Copy message" className="btn btn-primary btn-sm" />
          </div>
          {onAddPart ? (
          <>
          <label className="qbi-label" htmlFor="qbi-recovery-reply">AI reply</label>
          <textarea
            id="qbi-recovery-reply"
            className="input qbi-reply"
            rows={5}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder="Paste the AI's reply (the Markdown block with the missing questions)"
            spellCheck={false}
          />
          <div className="qbi-row">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={!reply.trim()}
              onClick={() => { onAddPart?.(reply); setReply(''); }}
            >
              <Plus size={14} aria-hidden="true" /> Add to report
            </button>
          </div>
          </>
          ) : null}
        </section>
      ) : null}

      <PageCheck data={data} sourceFiles={sourceFiles} onOpenPage={setInspect} />

      {manual?.entries?.length ? (
        <section className="qbi-card">
          <header className="qbi-card-head">
            <Plus size={16} aria-hidden="true" />
            <div>
              <h4>Questions you added</h4>
              <p>Saved in this browser for this course.</p>
            </div>
          </header>
          <ul className="qbi-manual">
            {manual.entries.map((entry) => (
              <li key={entry.id}>
                <span>
                  <strong>{entry.semester} {entry.exam} · Q{entry.number}</strong>
                  <small>{entry.topic} · {entry.file} p{entry.page}</small>
                </span>
                <button type="button" className="qba-icon-btn qba-icon-btn-danger" onClick={() => manual.remove(entry.id)} aria-label={`Remove ${entry.semester} Q${entry.number}`}>
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {inspect ? (
        <PageInspector
          target={inspect}
          data={data}
          coverage={coverage}
          onClose={() => setInspect(null)}
          onAdd={(entry) => manual?.add(entry)}
        />
      ) : null}
    </div>
  );
}
