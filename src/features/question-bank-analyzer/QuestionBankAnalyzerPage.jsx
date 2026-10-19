import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bookmark,
  BookmarkCheck,
  BookOpenCheck,
  Check,
  Copy,
  FileSearch,
  FileText,
  FileUp,
  HelpCircle,
  Image as ImageIcon,
  Info,
  Loader2,
  Printer,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { buildPrompt } from './qbaPrompt';
import { parseQuestionBankParts } from './parseQuestionBank';
import { applyManualMerges } from './previewAnalytics';
import PreviewPanel from './PreviewPanel';
import PrintReport, { PrintPortal } from './PrintReport';
import { downloadReportImagePdf, reportBaseName } from './qbaPdf';
import { getSavedAnalyses, saveAnalysis, deleteAnalysis } from './qbaSavedStore';
import SavedAnalysesPanel from './SavedAnalysesPanel';
import GliderTabs from '../../components/GliderTabs';
import sampleMarkdown from '../../../samples/sample_analysis.md?raw';
import './QuestionBankAnalyzerPage.css';

const STORAGE_KEY = 'aust-qba-v1';
const MAX_FILES = 5;
const MAX_FILE_BYTES = 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.md', '.markdown', '.txt'];

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return {
      courseCode: typeof parsed.courseCode === 'string' ? parsed.courseCode : '',
      courseTitle: typeof parsed.courseTitle === 'string' ? parsed.courseTitle : '',
      pasted: typeof parsed.pasted === 'string' ? parsed.pasted : '',
    };
  } catch {
    return {};
  }
}

function fallbackCopy(text) {
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, area.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
}

function safeReportData(data, code, title) {
  return {
    ...data,
    course: String(code || '').trim() || data.course || '',
    title: String(title || '').trim() || data.title || '',
  };
}

function defaultOpenTopics(data) {
  const vip = data.topics.filter((topic) => topic.priority === 'VIP');
  const chosen = vip.length ? vip : data.topics.slice(0, 1);
  return new Set(chosen.map((topic) => topic.name));
}

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 80)));
  });
}

function MessageList({ kind, items }) {
  if (!items || !items.length) return null;
  const isError = kind === 'error';
  const Icon = isError ? AlertCircle : AlertTriangle;
  return (
    <div className={`qba-messages qba-messages-${kind}`} role={isError ? 'alert' : 'status'}>
      <div className="qba-messages-title">
        <Icon size={16} aria-hidden="true" />
        {isError ? 'This report could not be built' : 'Warnings — some things were fixed automatically'}
      </div>
      <ul>
        {items.map((message, index) => (
          <li key={`${kind}-${index}`}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

function StepHeading({ number, title, hint, icon: Icon }) {
  return (
    <div className="qba-step-head">
      <span className="qba-step-num" aria-hidden="true">{number}</span>
      <div className="qba-step-title-block">
        <h2 className="qba-step-title">
          {Icon ? <Icon size={17} aria-hidden="true" /> : null}
          {title}
        </h2>
        {hint ? <p className="qba-step-hint">{hint}</p> : null}
      </div>
    </div>
  );
}

export default function QuestionBankAnalyzerPage() {
  const [initial] = useState(readStored);
  const [courseCode, setCourseCode] = useState(initial.courseCode || '');
  const [courseTitle, setCourseTitle] = useState(initial.courseTitle || '');
  const [pasted, setPasted] = useState(initial.pasted || '');
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');
  const [result, setResult] = useState(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [mergeGroups, setMergeGroups] = useState({});
  const [openTopics, setOpenTopics] = useState(() => new Set());
  const [busy, setBusy] = useState('');
  const [printMount, setPrintMount] = useState(false);
  const [printData, setPrintData] = useState(null);
  const [activeTab, setActiveTab] = useState('analyzer');
  const [savedCount, setSavedCount] = useState(0);
  const [savedEntryId, setSavedEntryId] = useState(null);

  // Load saved count once on mount
  useEffect(() => {
    getSavedAnalyses().then((list) => setSavedCount(list.length)).catch(() => {});
  }, []);

  // Must be declared before the checkIfSaved callback below, whose dependency
  // array reads `displayData` during render (a later `const` would throw a TDZ
  // ReferenceError at render time).
  const prompt = useMemo(() => buildPrompt(courseCode, courseTitle), [courseCode, courseTitle]);

  const reportData = useMemo(() => {
    if (!result || !result.data) return null;
    return safeReportData(result.data, courseCode, courseTitle);
  }, [result, courseCode, courseTitle]);

  const displayData = useMemo(
    () => reportData ? { ...applyManualMerges(reportData, mergeGroups), topics: [] } : { topics: [] },
    [reportData, mergeGroups],
  );

  // Check if current preview matches a saved analysis
  const checkIfSaved = useCallback(async () => {
    if (!displayData || !displayData.topics.length) {
      setSavedEntryId(null);
      return;
    }
    try {
      const entries = await getSavedAnalyses();
      const match = entries.find((entry) => {
        if (entry.courseCode !== courseCode || entry.courseTitle !== courseTitle) return false;
        if (!entry.displayData || !entry.displayData.topics) return false;
        // Compare topic count and first topic name as a quick fingerprint
        const currentTopics = displayData.topics.map((t) => t.name).sort();
        const savedTopics = entry.displayData.topics.map((t) => t.name).sort();
        return (
          currentTopics.length === savedTopics.length &&
          currentTopics.every((name, i) => name === savedTopics[i])
        );
      });
      setSavedEntryId(match?.id ?? null);
    } catch {
      setSavedEntryId(null);
    }
  }, [displayData, courseCode, courseTitle]);

  // Run check when preview data changes
  useEffect(() => {
    checkIfSaved();
  }, [checkIfSaved]);

  // Re-check when returning to analyzer tab (in case something was deleted from Saved tab)
  useEffect(() => {
    if (activeTab === 'analyzer') {
      checkIfSaved();
    }
  }, [activeTab, checkIfSaved]);

  const fileInputRef = useRef(null);
  const copyTimer = useRef(null);
  const noticeTimer = useRef(null);
  const reportRef = useRef(null);
  const previewRef = useRef(null);

  const showNotice = useCallback((message) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    if (message) noticeTimer.current = setTimeout(() => setNotice(''), 5000);
  }, []);

  useEffect(() => {
    try {
      if (!courseCode && !courseTitle && !pasted) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ courseCode, courseTitle, pasted }));
    } catch {
      /* storage may be full or disabled — the page still works */
    }
  }, [courseCode, courseTitle, pasted]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  const collectParts = useCallback(() => {
    const parts = files.map((file) => file.text);
    if (pasted.trim()) parts.push(pasted);
    return parts;
  }, [files, pasted]);

  const ensureParsed = useCallback(() => {
    const parsed = parseQuestionBankParts(collectParts());
    setResult(parsed);
    setPreviewReady(true);
    setOpenTopics(defaultOpenTopics(parsed.data));
    return parsed;
  }, [collectParts]);

  const handlePreview = () => {
    const parsed = ensureParsed();
    setPreviewVersion((version) => version + 1);
    if (parsed.data.topics.length) {
      showNotice(`Preview ready — ${parsed.data.summary.topicCount} topics, ${parsed.data.summary.totalQuestions} question rows.`);
    }
    requestAnimationFrame(() => {
      previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleCopy = async () => {
    let ok;
    try {
      await navigator.clipboard.writeText(prompt);
      ok = true;
    } catch {
      ok = fallbackCopy(prompt);
    }
    if (!ok) {
      showNotice('Copy did not work. Select the prompt text and copy it manually.');
      return;
    }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2200);
  };

  const handleClear = () => {
    setCourseCode('');
    setCourseTitle('');
    setPasted('');
    setFiles([]);
    setResult(null);
    setPreviewReady(false);
    setMergeGroups({});
    setPreviewVersion((version) => version + 1);
    setOpenTopics(new Set());
    setSavedEntryId(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    showNotice('Cleared. Saved course fields and pasted Markdown were removed.');
  };

  const handleSave = async () => {
    // If already saved, unsave (delete)
    if (savedEntryId) {
      const ok = await deleteAnalysis(savedEntryId);
      if (!ok) {
        showNotice('Could not unsave — try again.');
        return;
      }
      setSavedEntryId(null);
      getSavedAnalyses().then((list) => setSavedCount(list.length)).catch(() => {});
      showNotice('Analysis removed from saved.');
      return;
    }

    // Otherwise, save new
    if (!displayData || !displayData.topics.length) {
      showNotice('Nothing to save. Build the preview first by pressing Preview.');
      return;
    }
    const entry = await saveAnalysis({ courseCode, courseTitle, displayData });
    if (!entry) {
      showNotice('Could not save — server error or not logged in.');
      return;
    }
    setSavedEntryId(entry.id);
    getSavedAnalyses().then((list) => setSavedCount(list.length)).catch(() => {});
    showNotice('Analysis saved! Switch to the "Saved" tab to see it.');
  };

  const addFiles = useCallback(async (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;

    const problems = [];
    const accepted = [];

    for (const file of incoming) {
      if (files.length + accepted.length >= MAX_FILES) {
        problems.push(`You can add up to ${MAX_FILES} files.`);
        break;
      }
      const name = file.name || 'analysis.md';
      const dot = name.lastIndexOf('.');
      const extension = dot >= 0 ? name.slice(dot).toLowerCase() : '';
      const looksText = ALLOWED_EXTENSIONS.includes(extension) || (!extension && /^text\//i.test(file.type || ''));
      if (!looksText) {
        problems.push(`"${name}" is not a .md or .txt file.`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        problems.push(`"${name}" is ${formatBytes(file.size)} — the limit is 1 MB per file.`);
        continue;
      }
      if ([...files, ...accepted].some((item) => item.name === name && item.size === file.size)) {
        problems.push(`"${name}" is already in the list.`);
        continue;
      }
      try {
        const text = await file.text();
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          size: file.size,
          text,
        });
      } catch {
        problems.push(`"${name}" could not be read as text.`);
      }
    }

    if (accepted.length) {
      setFiles((current) => [...current, ...accepted]);
      setPreviewReady(false);
      setMergeGroups({});
      setSavedEntryId(null);
    }
    if (problems.length) showNotice(problems.join(' '));
    else if (accepted.length) showNotice(`${accepted.length} file${accepted.length === 1 ? '' : 's'} added.`);
  }, [files, showNotice]);

  const moveFile = (index, direction) => {
    setFiles((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setPreviewReady(false);
    setMergeGroups({});
    setSavedEntryId(null);
  };

  const removeFile = (id) => {
    setFiles((current) => current.filter((file) => file.id !== id));
    setPreviewReady(false);
    setMergeGroups({});
    setSavedEntryId(null);
  };

  const handlePastedChange = (value) => {
    setPasted(value);
    setPreviewReady(false);
    setMergeGroups({});
    setSavedEntryId(null);
  };

  const handleLoadSample = () => {
    setFiles([]);
    setPasted(sampleMarkdown);
    setCourseCode('CSE 3101');
    setCourseTitle('Database Management Systems');
    const parsed = parseQuestionBankParts([sampleMarkdown]);
    setResult(parsed);
    setPreviewReady(true);
    setMergeGroups({});
    setPreviewVersion((version) => version + 1);
    setOpenTopics(defaultOpenTopics(parsed.data));
    setSavedEntryId(null);
    showNotice('Sample loaded. Preview is ready — try Download PDF or Quick Download.');
  };

  const handlePrintPdf = async () => {
    const parsed = ensureParsed();
    if (!parsed.data.topics.length) {
      showNotice('Nothing to export. Add the AI Markdown in Step 3 first.');
      return;
    }

    const data = applyManualMerges(
      safeReportData(parsed.data, courseCode, courseTitle),
      mergeGroups,
    );
    const previousTitle = document.title;
    document.title = `${reportBaseName(data.course)}_question_bank_analysis`;
    setPrintData(data);
    setPrintMount(true);
    setBusy('print');
    document.documentElement.classList.add('qba-printing');

    // Wait for PrintPortal to fully mount and paint in document.body
    await waitForPaint();
    // Extra frames to ensure portal content is fully laid out
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 100));

    let cleaned = false;
    let fallbackTimer = null;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      document.documentElement.classList.remove('qba-printing');
      setPrintMount(false);
      setPrintData(null);
      setBusy('');
      document.title = previousTitle;
    };

    // Listen for afterprint (fires when print dialog closes)
    window.addEventListener('afterprint', cleanup, { once: true });
    // Fallback: clean up after 30 seconds (not 120) in case afterprint doesn't fire
    fallbackTimer = window.setTimeout(cleanup, 30000);

    try {
      window.print();
    } catch {
      cleanup();
      showNotice('The browser could not open the print dialog. Try Quick Download instead.');
    }
  };

  const handleQuickDownload = async () => {
    const parsed = ensureParsed();
    if (!parsed.data.topics.length) {
      showNotice('Nothing to export. Add the AI Markdown in Step 3 first.');
      return;
    }

    setBusy('image');
    try {
      await waitForPaint();
      const node = reportRef.current;
      if (!node) throw new Error('The report is still rendering. Please try again.');
      const data = applyManualMerges(
        safeReportData(parsed.data, courseCode, courseTitle),
        mergeGroups,
      );
      await downloadReportImagePdf(node, data.course);
      showNotice('Quick PDF downloaded.');
    } catch (error) {
      showNotice(error?.message || 'The image PDF could not be created. Try "Download PDF" instead.');
    } finally {
      setBusy('');
    }
  };

  const toggleTopic = (name) => {
    setOpenTopics((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const revealTopics = useCallback((names) => {
    if (!Array.isArray(names) || !names.length) return;
    setOpenTopics((current) => {
      const next = new Set(current);
      names.forEach((name) => next.add(name));
      return next;
    });
  }, []);

  const mergeTopicQuestions = useCallback((topicName, indices) => {
    if (!topicName || !Array.isArray(indices) || indices.length < 2) return;
    setMergeGroups((current) => {
      const existing = Array.isArray(current[topicName]) ? current[topicName] : [];
      const used = new Set(existing.flat());
      const clean = [...new Set(indices)]
        .filter((index) => Number.isInteger(index) && index >= 0 && !used.has(index))
        .sort((a, b) => a - b);
      if (clean.length < 2) return current;
      return { ...current, [topicName]: [...existing, clean] };
    });
  }, []);

  const unmergeTopicQuestions = useCallback((topicName, indices) => {
    if (!topicName || !Array.isArray(indices)) return;
    setMergeGroups((current) => {
      const existing = Array.isArray(current[topicName]) ? current[topicName] : [];
      const key = indices.join(',');
      const remaining = existing.filter((group) => group.join(',') !== key);
      if (remaining.length === existing.length) return current;
      const next = { ...current };
      if (remaining.length) next[topicName] = remaining;
      else delete next[topicName];
      return next;
    });
  }, []);

  const openTopicAndScroll = (name) => {
    const topics = displayData?.topics || [];
    const targetTopic = topics.find(
      (topic) => String(topic.name).toLowerCase() === String(name).toLowerCase(),
    );
    if (!targetTopic) return;
    setOpenTopics((current) => {
      const next = new Set(current);
      next.add(targetTopic.name);
      return next;
    });
    requestAnimationFrame(() => {
      const target = Array.from(document.querySelectorAll('[data-qba-topic]')).find(
        (element) => String(element.getAttribute('data-qba-topic')).toLowerCase()
          === String(name).toLowerCase(),
      );
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const hasData = Boolean(displayData && displayData.topics.length);
  const warnings = result?.warnings || [];
  const errors = result?.errors || [];

  return (
    <div className="qba-widget glass-card-static animate-fadeInUp">
      <div className="schedule-masthead qba-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <FileSearch size={22} aria-hidden="true" />
          </div>
          <div>
            <span className="schedule-overline">Study toolkit</span>
            <p className="schedule-title">Question Bank Analyzer</p>
            <span className="schedule-subtitle">Past papers in, ranked study plan out — free, with your own AI</span>
          </div>
        </div>
        <div className="schedule-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleClear}
            title="Clear saved fields, pasted Markdown and files"
          >
            <RotateCcw size={14} aria-hidden="true" />
            Clear
          </button>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      <GliderTabs
        tabs={[
          { id: 'analyzer', label: 'Analyzer', icon: FileSearch },
          { id: 'saved', label: savedCount > 0 ? `Saved (${savedCount})` : 'Saved', icon: Bookmark },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        compact
      />

      {notice ? (
        <div className="qba-notice" role="status" aria-live="polite">
          <Info size={15} aria-hidden="true" />
          <span>{notice}</span>
        </div>
      ) : null}

      {activeTab === 'saved' ? (
        <SavedAnalysesPanel
          onCountChange={setSavedCount}
        />
      ) : null}

      {activeTab === 'analyzer' ? (
      <>
      <div className="qba-steps">
        {/* ── Step 1 ─────────────────────────────────────────────────────── */}
        <section className="qba-step glass-card-static" aria-labelledby="qba-step-1">
          <StepHeading
            number="1"
            title="Course details and master prompt"
            hint="Type the course code and title. The prompt below updates live."
            icon={FileText}
          />

          <div className="qba-grid-2">
            <div className="qba-field">
              <label htmlFor="qba-course-code">Course code</label>
              <input
                id="qba-course-code"
                className="input"
                value={courseCode}
                onChange={(event) => { setCourseCode(event.target.value); setSavedEntryId(null); }}
                placeholder="e.g. CSE 3101"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="qba-field">
              <label htmlFor="qba-course-title">Course title</label>
              <input
                id="qba-course-title"
                className="input"
                value={courseTitle}
                onChange={(event) => { setCourseTitle(event.target.value); setSavedEntryId(null); }}
                placeholder="e.g. Database Management Systems"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="qba-field">
            <div className="qba-label-row">
              <label htmlFor="qba-prompt">Master prompt</label>
              <span className="qba-muted qba-label-hint">Read-only · copy this into your AI</span>
            </div>
            <textarea
              id="qba-prompt"
              className="input qba-prompt"
              value={prompt}
              readOnly
              spellCheck={false}
              aria-describedby="qba-prompt-hint"
            />
            <div className="qba-prompt-actions">
              <button type="button" className="btn btn-primary" onClick={handleCopy}>
                {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                {copied ? 'Copied!' : 'Copy Prompt'}
              </button>
              <span className="qba-copy-status" role="status" aria-live="polite">
                {copied ? 'Copied to clipboard.' : ''}
              </span>
            </div>
            <p className="qba-hint" id="qba-prompt-hint">
              The prompt is the same for every course; only the code and title change.
            </p>
          </div>
        </section>

        {/* ── Step 2 ─────────────────────────────────────────────────────── */}
        <section className="qba-step glass-card-static" aria-labelledby="qba-step-2">
          <StepHeading
            number="2"
            title="What to do inside your AI"
            hint="ChatGPT, Claude, Gemini or any assistant that can read files. No API key needed."
            icon={Sparkles}
          />
          <ol className="qba-instructions">
            <li>
              <strong>Paste the copied prompt</strong> into a fresh chat.
            </li>
            <li>
              <strong>Upload your course files</strong> there: slides, syllabus, quiz questions, mids and previous finals.
            </li>
            <li>
              The AI will list your files first. Reply <strong>OK</strong> so it starts the analysis.
            </li>
            <li>
              If the answer stops in the middle of a table, reply <strong>continue</strong> and keep each part.
            </li>
            <li>
              Bring the result back as <strong>.md or .txt</strong> — one file, or several parts in order.
            </li>
          </ol>
          <div className="qba-callout">
            <Info size={15} aria-hidden="true" />
            <p>
              Everything here is free and runs in your browser. Your course files go only to the AI you choose —
              never to AUSTWise.
            </p>
          </div>
        </section>

        {/* ── Step 3 ─────────────────────────────────────────────────────── */}
        <section className="qba-step glass-card-static" aria-labelledby="qba-step-3">
          <StepHeading
            number="3"
            title="Add the Markdown and build the report"
            hint="Drop the AI output here, or paste it directly."
            icon={FileUp}
          />

          <div className="qba-field">
            <div className="qba-label-row">
              <label htmlFor="qba-file-input">Markdown files</label>
              <span className="qba-muted qba-label-hint">
                Up to {MAX_FILES} files · 1 MB each · .md or .txt
              </span>
            </div>
            <input
              id="qba-file-input"
              ref={fileInputRef}
              type="file"
              className="qba-file-input"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              multiple
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = '';
              }}
            />
            <button
              type="button"
              className={`qba-dropzone${dragging ? ' qba-dropzone-active' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                addFiles(event.dataTransfer.files);
              }}
              aria-describedby="qba-file-hint"
            >
              <FileUp size={26} aria-hidden="true" />
              <span className="qba-dropzone-title">
                {dragging ? 'Drop the files here' : 'Drag and drop, or click to choose files'}
              </span>
              <span className="qba-dropzone-sub">
                Cut-off AI answer? Add both parts and use the arrows to keep them in order.
              </span>
            </button>
            <p className="qba-hint" id="qba-file-hint">
              Files are merged in the order shown below. Pasted Markdown is added after the files.
            </p>

            {files.length > 0 ? (
              <ol className="qba-file-list">
                {files.map((file, index) => (
                  <li className="qba-file-item" key={file.id}>
                    <span className="qba-file-index" aria-hidden="true">{index + 1}</span>
                    <FileText size={16} aria-hidden="true" className="qba-file-icon" />
                    <span className="qba-file-name" title={file.name}>{file.name}</span>
                    <span className="qba-file-size">{formatBytes(file.size)}</span>
                    <span className="qba-file-actions">
                      <button
                        type="button"
                        className="qba-icon-btn"
                        onClick={() => moveFile(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move ${file.name} up`}
                        title="Move up"
                      >
                        <ArrowUp size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="qba-icon-btn"
                        onClick={() => moveFile(index, 1)}
                        disabled={index === files.length - 1}
                        aria-label={`Move ${file.name} down`}
                        title="Move down"
                      >
                        <ArrowDown size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="qba-icon-btn qba-icon-btn-danger"
                        onClick={() => removeFile(file.id)}
                        aria-label={`Remove ${file.name}`}
                        title="Remove"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>

          <div className="qba-field">
            <div className="qba-label-row">
              <label htmlFor="qba-paste">Or paste the Markdown</label>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleLoadSample}>
                <Sparkles size={14} aria-hidden="true" />
                Load sample
              </button>
            </div>
            <textarea
              id="qba-paste"
              className="input qba-textarea"
              value={pasted}
              onChange={(event) => handlePastedChange(event.target.value)}
              placeholder={'Paste the AI output here — it should start with --- and contain "## TOPIC: ..." sections.'}
              spellCheck={false}
            />
            <p className="qba-hint">
              Saved automatically in this browser. Keep it here and you can refresh without losing work.
            </p>
          </div>

          <div className="qba-actions">
            <button type="button" className="btn btn-primary" onClick={handlePreview} disabled={Boolean(busy)}>
              <BookOpenCheck size={16} aria-hidden="true" />
              Preview
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handlePrintPdf}
              disabled={Boolean(busy)}
              title="Uses your browser's print dialog — best quality and selectable text"
            >
              {busy === 'print' ? <Loader2 size={16} className="qba-spin" aria-hidden="true" /> : <Printer size={16} aria-hidden="true" />}
              {busy === 'print' ? 'Opening print…' : 'Download PDF'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleQuickDownload}
              disabled={Boolean(busy)}
              title="Creates an image-based PDF — works even when print styles fail"
            >
              {busy === 'image' ? <Loader2 size={16} className="qba-spin" aria-hidden="true" /> : <ImageIcon size={16} aria-hidden="true" />}
              {busy === 'image' ? 'Building image PDF…' : 'Quick Download (image PDF)'}
            </button>
            <button
              type="button"
              className={`btn btn-secondary qba-save-btn${savedEntryId ? ' qba-save-btn-saved' : ''}`}
              onClick={handleSave}
              disabled={Boolean(busy) || !hasData}
              title={savedEntryId ? 'Unsave this preview' : 'Save this preview so you can download it later from the Saved tab'}
            >
              {savedEntryId ? <BookmarkCheck size={16} aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />}
              {savedEntryId ? 'Saved' : 'Save Preview'}
            </button>
          </div>
          <p className="qba-hint">
            <strong>Download PDF</strong> opens the print dialog — choose “Save as PDF”.{' '}
            <strong>Quick Download</strong> paints the report as an image, which is slower but more forgiving.
          </p>
        </section>
      </div>

      {/* ── Preview ─────────────────────────────────────────────────────── */}
      <section className="qba-preview glass-card-static" ref={previewRef} aria-labelledby="qba-preview-heading">
        <div className="qba-preview-bar">
          <h2 id="qba-preview-heading">Preview</h2>
          {previewReady ? <span className="qba-pill">{hasData ? 'Report ready' : 'Needs attention'}</span> : <span className="qba-pill qba-pill-muted">Not built yet</span>}
        </div>

        {previewReady && result ? (
          <>
            <MessageList kind="error" items={errors} />
            <MessageList kind="warning" items={warnings} />
            <PreviewPanel
              key={previewVersion}
              data={displayData}
              openTopics={openTopics}
              onToggleTopic={toggleTopic}
              onFocusTopic={openTopicAndScroll}
              onRevealTopics={revealTopics}
              onMergeQuestions={mergeTopicQuestions}
              onUnmergeQuestions={unmergeTopicQuestions}
            />
          </>
        ) : (
          <div className="qba-empty">
            <FileSearch size={28} aria-hidden="true" />
            <h3>Your analysed question bank will appear here</h3>
            <p>Add the AI Markdown above, then press <strong>Preview</strong>. Nothing is uploaded to a server.</p>
          </div>
        )}
      </section>

      {/* ── Common problems ─────────────────────────────────────────────── */}
      <section className="qba-help glass-card-static" aria-labelledby="qba-help-heading">
        <div className="qba-section-head">
          <h3 id="qba-help-heading">
            <HelpCircle size={17} aria-hidden="true" />
            Common problems
          </h3>
          <span className="qba-section-note">Most issues are fixed by one of these</span>
        </div>
        <div className="qba-help-grid">
          <details>
            <summary>“Wrong format” or no topics found</summary>
            <p>
              The page expects the Markdown the AI returned, not a PDF or a screenshot. The text should contain
              <code>---</code> front matter and <code>## TOPIC: ...</code> sections. Ask the AI to “follow the output
              format exactly” and save its answer as <code>.md</code>.
            </p>
          </details>
          <details>
            <summary>The AI answer was cut off</summary>
            <p>
              Reply <code>continue</code> in the same chat. Save part 1 and part 2 as separate files, add both in Step 3,
              and keep them in order with the up/down arrows. Identical rows are merged automatically.
            </p>
          </details>
          <details>
            <summary>Scanned PDFs or unreadable slides</summary>
            <p>
              Free AI plans often cannot read scanned images. Ask the AI to list which files it could not read, then
              upload a text-based PDF or type the questions. The analyzer will never invent questions for a missing page.
            </p>
          </details>
          <details>
            <summary>Too many files for a free AI plan</summary>
            <p>
              Send the files in batches: slides and syllabus first, then quiz/mid/final papers. Ask the AI to output one
              Markdown block per batch, then add all the parts here — they are merged into one report.
            </p>
          </details>
          <details>
            <summary>The preview says a column is missing</summary>
            <p>
              That is a warning, not an error. Missing Exam, Semester, Marks or Times cells are filled with <code>-</code>,
              and a missing Times cell is counted once. You can still download the report, but ask the AI to resend the
              table with every column for a cleaner result.
            </p>
          </details>
        </div>
      </section>
      </>
      ) : null}

      {/* Offscreen copy of the report, used only by the image-PDF exporter. */}
      {displayData && !printMount ? (
        <div className="qba-capture-host" aria-hidden="true">
          <PrintReport data={displayData} innerRef={reportRef} />
        </div>
      ) : null}

      {/* Print-only report mounted straight into <body>. */}
      {printMount && printData ? <PrintPortal data={printData} /> : null}
    </div>
  );
}
