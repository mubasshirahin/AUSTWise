import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle, BookOpen, FlaskConical, X, Check, Settings2, ChevronLeft, ChevronRight, RotateCcw, Info, FileDown, MoreVertical, Layers
} from 'lucide-react';

import { getUserStorageItemWithGuestFallback, getCurrentUserId } from '../../utils/authStorage';
import { useAuth } from '../../context/AuthContext';
import { formatSemesterLabel } from '../../utils/semester';
import { getLiveValue, setLiveValue, onLiveChange, ensureFetched, useLiveValue } from '../../utils/liveStore';
import './SemesterTracker.css';

const STORAGE_PREFIXES = {
  courses: 'aust-user-tracker-courses',
  marks: 'aust-user-tracker-marks',
  theoryConfig: 'aust-user-tracker-theory-config',
  labCourses: 'aust-user-tracker-lab-courses',
  labConfig: 'aust-user-tracker-lab-config',
  labMarks: 'aust-user-tracker-lab-marks',
};

/* Server-side (bare) per-semester keys — synced across all the user's devices. */
const getSemKey = (type, sem) => {
  const prefix = STORAGE_PREFIXES[type];
  if (!prefix) return null;
  return `${prefix}_${sem}`;
};

const getSemItem = (type, sem) => {
  const key = getSemKey(type, sem);
  if (!key) return null;
  const cached = getLiveValue('user', key, null);
  if (cached !== null) return cached;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  // One-time migration from the old per-user suffixed keys
  // (e.g. aust-user-tracker-marks-<uid>_<sem>).
  try {
    const uid = getCurrentUserId();
    const legacyKey = `${STORAGE_PREFIXES[type]}-${uid || 'guest'}_${sem}`;
    const raw = localStorage.getItem(legacyKey);
    if (raw) {
      const value = JSON.parse(raw);
      // Seed the server copy off the render path (see liveStorage.liveLoad).
      queueMicrotask(() => setLiveValue('user', key, value));
      return value;
    }
  } catch { /* ignore */ }
  return null;
};

const setSemItem = (type, sem, value) => {
  const key = getSemKey(type, sem);
  if (!key) return;
  setLiveValue('user', key, value);
};

const isLabCourse = (code) => {
  if (!code) return false;
  const last = code.trim().slice(-1);
  const digit = parseInt(last, 10);
  return !isNaN(digit) && digit % 2 === 0;
};

const getTotalColor = (total) => {
  if (total >= 80) return 'var(--accent-emerald)';
  if (total >= 60) return 'var(--accent-amber)';
  if (total >= 40) return 'var(--accent-amber)';
  return 'var(--accent-rose)';
};

/* ─── Theory mark fields (fixed) — all columns share the primary accent.
   No per-assessment rotating color; red/green/teal are reserved for the
   semantic grade scale (getGrade / cell classes). ─── */
const MARK_ACCENT = 'var(--accent-blue)';
const THEORY_FIXED_FIELDS = [
  { id: 'attendance', label: 'Attend.', fullLabel: 'Attendance', maxMarks: 10, color: MARK_ACCENT },
  { id: 'midterm',    label: 'Midterm', fullLabel: 'Midterm',     maxMarks: 20, color: MARK_ACCENT },
  { id: 'final',      label: 'Final',   fullLabel: 'Final Exam',  maxMarks: 50, color: MARK_ACCENT },
];

const getTheoryFields = (quizCount = 3, bestOf = 2) => {
  const perQuizMax = Math.round((20 / bestOf) * 100) / 100;
  const fields = [THEORY_FIXED_FIELDS[0]]; // attendance
  for (let i = 1; i <= quizCount; i++) {
    fields.push({ id: `quiz${i}`, label: `Quiz ${i}`, fullLabel: `Quiz ${i}`, maxMarks: perQuizMax, color: MARK_ACCENT });
  }
  fields.push(THEORY_FIXED_FIELDS[1]); // midterm
  fields.push(THEORY_FIXED_FIELDS[2]); // final
  return fields;
};

/* ─── Lab component types ─── */
const LAB_TYPES = [
  { type: 'online',       label: 'Online',       icon: '🌐' },
  { type: 'offline',      label: 'Offline',      icon: '📝' },
  { type: 'assignment',   label: 'Assignment',   icon: '📋' },
  { type: 'lab_report',   label: 'Lab Report',   icon: '📄' },
  { type: 'lab_mid',      label: 'Lab Mid',      icon: '📊' },
  { type: 'lab_final',    label: 'Lab Final',    icon: '🎯' },
  { type: 'presentation', label: 'Presentation', icon: '🎤' },
  { type: 'attendance',   label: 'Attendance',   icon: '✅' },
  { type: 'viva',         label: 'Viva',         icon: '🗣️'  },
  { type: 'project',      label: 'Project',      icon: '🛠️'  },
  { type: 'homework',     label: 'Homework',     icon: '🏠' },
  { type: 'custom',       label: 'Custom',       icon: '✏️'  },
];

/* ─── Helpers ─── */
function getGrade(total) {
  if (total >= 80) return { letter: 'A+', gpa: '4.00', color: 'var(--accent-emerald)' };
  if (total >= 75) return { letter: 'A',  gpa: '3.75', color: 'var(--accent-emerald)' };
  if (total >= 70) return { letter: 'A-', gpa: '3.50', color: 'var(--accent-cyan)'    };
  if (total >= 65) return { letter: 'B+', gpa: '3.25', color: 'var(--accent-cyan)'    };
  if (total >= 60) return { letter: 'B',  gpa: '3.00', color: 'var(--accent-blue)'    };
  if (total >= 55) return { letter: 'B-', gpa: '2.75', color: 'var(--accent-amber)'   };
  if (total >= 50) return { letter: 'C+', gpa: '2.50', color: 'var(--accent-amber)'   };
  if (total >= 45) return { letter: 'C',  gpa: '2.25', color: 'var(--accent-orange)'  };
  if (total >= 40) return { letter: 'D',  gpa: '2.00', color: 'var(--accent-rose)'    };
  return             { letter: 'F',  gpa: '0.00', color: 'var(--danger)'           };
}

function getCellClass(value, max) {
  if (value === undefined || value === '') return '';
  const pct = value / max;
  if (pct >= 0.8) return 'cell-green';
  if (pct >= 0.6) return 'cell-yellow';
  return 'cell-red';
}

/* Expand lab config into per-item columns, grouped by component */
function expandLabColumns(config) {
  if (!config?.components?.length) return { groups: [], allCols: [] };
  const groups = [];
  const allCols = [];
  config.components.forEach((comp, ci) => {
    const marksEach = comp.totalMarks / comp.count;
    const items = [];
    for (let i = 0; i < comp.count; i++) {
      const col = {
        key: `${comp.type}_${ci}_${i}`,
        label: comp.count > 1 ? `${comp.label} ${i + 1}` : comp.label,
        max: marksEach,
        compIdx: ci,
        itemIdx: i,
        color: LAB_TYPES.find(t => t.type === comp.type)?.color || 'var(--text-secondary)',
      };
      items.push(col);
      allCols.push(col);
    }
    groups.push({ label: comp.label, max: comp.totalMarks, items });
  });
  return { groups, allCols };
}

/* ══════════════════════════════════════════
   Main Component
═══════════════════════════════════════════ */
export default function SemesterTracker() {
  const { user } = useAuth();
  const [liveSemResults] = useLiveValue('user', 'aust-user-semester-results', null);
  /* User's current semester (their standing in studies) */
  const getCurrentSemester = () => {
    const ysMatch = (user?.yearSemester || '').match(/Year (\d+) - Semester (\d+)/);
    if (ysMatch) { const y = parseInt(ysMatch[1]), s = parseInt(ysMatch[2]); if (y >= 1 && y <= 4 && s >= 1 && s <= 2) return (y - 1) * 2 + s; }
    if (user?.semester && user.semester >= 1 && user.semester <= 8) return user.semester;
    return null;
  };
  const getInitialSem = () => {
    const current = getCurrentSemester();
    if (current !== null) return current;
    const saved = localStorage.getItem(`aust-tracker-sem-${getCurrentUserId() || 'guest'}`);
    if (saved) { const n = parseInt(saved, 10); if (n >= 1 && n <= 8) return n; }
    return 1;
  };
  // Auto-switch to the first available semester when the saved one has no
  // transcript data (but never move away from the user's current semester).
  const [selectedSemester, setSelectedSemester] = useState(() => {
    const current = getCurrentSemester();
    const initial = getInitialSem();
    if (current !== null) return initial;
    const allResults = getUserStorageItemWithGuestFallback('semesterResults') || [];
    const hasData = allResults.some(r => r.semester === initial && r.courses?.some(c => c.code));
    if (allResults.length > 0 && !hasData) {
      const fromData = allResults
        .filter(r => r.courses?.some(c => c.code && c.code.trim()))
        .map(r => r.semester)
        .sort((a, b) => a - b);
      const first = fromData.length > 0 ? fromData[0] : 1;
      if (first && first !== initial) return first;
    }
    return initial;
  });
  const prevSemRef = useRef(null);
  const currentSemRef = useRef(getInitialSem());

  /* Persist selected semester */
  useEffect(() => {
    localStorage.setItem(`aust-tracker-sem-${getCurrentUserId() || 'guest'}`, selectedSemester);
  }, [selectedSemester]);

  /* ── Load data for a semester ── */
  const loadTranscriptCourses = (sem) => {
    const allResults = (liveSemResults && liveSemResults.length ? liveSemResults : null) || getUserStorageItemWithGuestFallback('semesterResults') || [];
    const semData = allResults.find(r => r.semester === sem);
    if (!semData?.courses?.length) return { theoryCourses: [], labCourses: [] };
    const theoryCourses = semData.courses
      .filter(c => c.code && !isLabCourse(c.code))
      .map(c => ({ id: c.code, code: c.code, name: c.name || '' }));
    const labCourses = semData.courses
      .filter(c => c.code && isLabCourse(c.code))
      .map(c => ({ id: c.code, code: c.code, name: c.name || '' }));
    return { theoryCourses, labCourses };
  };

  const loadSemesterData = (sem) => {
    const transcript = loadTranscriptCourses(sem);
    return {
      theoryCourses: transcript.theoryCourses,
      theoryMarks:   getSemItem('marks', sem)   || {},
      theoryConfig:  getSemItem('theoryConfig', sem) || {},
      labCourses:    transcript.labCourses,
      labConfig:     getSemItem('labConfig', sem)  || {},
      labMarks:      getSemItem('labMarks', sem)   || {},
    };
  };

  const initData = loadSemesterData(getInitialSem());

  /* ── State tracks current semester data ── */
  const [theoryCourses, setTheoryCourses] = useState(initData.theoryCourses);
  const [theoryMarks,   setTheoryMarks]   = useState(initData.theoryMarks);
  const [theoryConfig,  setTheoryConfig]  = useState(initData.theoryConfig);
  const [labCourses, setLabCourses] = useState(initData.labCourses);
  const [labConfig,  setLabConfig]  = useState(initData.labConfig);
  const [labMarks,   setLabMarks]   = useState(initData.labMarks);

  /* ── Setup wizard state ── */
  const [setupCourseId, setSetupCourseId] = useState(null); // which course is being configured
  const [draftComponents, setDraftComponents] = useState([]);

  /* ── Active cell ── */
  const [activeCell, setActiveCell] = useState(null);
  const inputRefs = useRef({});

  /* ── Raw marks input state ── */
  const [rawInputs, setRawInputs] = useState({}); // `${courseId}_${colKey}` → { raw: "8/10" }

  /* ── Quiz config draft values (strings, to allow free typing) ── */
  const [quizDrafts, setQuizDrafts] = useState({}); // `${course.id}_q` or `${course.id}_b` → string

  const [showQuizCfg, setShowQuizCfg] = useState(false);

  /* ── Confirm dialog ── */
  const [confirm, setConfirm] = useState(null); // { message, onConfirm } | null

  const askConfirm = (message, onConfirm) => setConfirm({ message, onConfirm });

  /* ── ⋮ dropdown menu ── */
  const [stMenuOpen, setStMenuOpen] = useState(false);
  const stMenuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (stMenuRef.current && !stMenuRef.current.contains(e.target)) setStMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* ── Save to per-semester keys (live save for edits within current semester) ── */
  useEffect(() => { setSemItem('courses', currentSemRef.current, theoryCourses); }, [theoryCourses]);
  useEffect(() => { setSemItem('marks', currentSemRef.current, theoryMarks); }, [theoryMarks]);
  useEffect(() => { setSemItem('theoryConfig', currentSemRef.current, theoryConfig); }, [theoryConfig]);
  useEffect(() => { setSemItem('labCourses', currentSemRef.current, labCourses); }, [labCourses]);
  useEffect(() => { setSemItem('labConfig', currentSemRef.current, labConfig); }, [labConfig]);
  useEffect(() => { setSemItem('labMarks', currentSemRef.current, labMarks); }, [labMarks]);

  /* ── Real-time sync: when another device edits the current semester's data,
     reload it so this device updates without a refresh. A JSON round-trip
     comparison prevents the server echo from triggering a save loop. ── */
  const stateDeps = [theoryCourses, theoryMarks, theoryConfig, labCourses, labConfig, labMarks];
  const currentSnapshotRef = useRef(null);
  useEffect(() => {
    currentSnapshotRef.current = stateDeps.map(v => JSON.stringify(v || null));
  }, stateDeps);

  /* Fetch the active semester's server data whenever it's shown, so a brand-new
     device (empty localStorage) still gets the user's saved data. */
  useEffect(() => {
    const sem = currentSemRef.current;
    Object.values(STORAGE_PREFIXES).forEach(p => ensureFetched('user', `${p}_${sem}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSemester]);

  useEffect(() => {
    return onLiveChange((composite) => {
      const [scope, rawKey] = String(composite || '').split(':');
      if (scope !== 'user') return;
      const sem = currentSemRef.current;
      const currentKeys = Object.values(STORAGE_PREFIXES).map(p => `${p}_${sem}`);
      // Grade Lab (CGPA calc) results also drive this view's course list, so a
      // change from another device reloads the current semester's transcript.
      if (!currentKeys.includes(rawKey) && rawKey !== 'aust-user-semester-results') return;
      const nd = loadSemesterData(sem);
      const next = [nd.theoryCourses, nd.theoryMarks, nd.theoryConfig, nd.labCourses, nd.labConfig, nd.labMarks];
      const snap = currentSnapshotRef.current || [];
      if (next.every((v, i) => JSON.stringify(v || null) === snap[i])) return;
      setTheoryCourses(next[0]);
      setTheoryMarks(next[1]);
      setTheoryConfig(next[2]);
      setLabCourses(next[3]);
      setLabConfig(next[4]);
      setLabMarks(next[5]);
      setQuizDrafts({});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Semester switch: save old semester's data, then load the new one ── */
  const switchToSemester = (next) => {
    if (next === selectedSemester) return;
    const prev = prevSemRef.current;
    if (prev !== null && prev !== next) {
      setSemItem('courses', prev, theoryCourses);
      setSemItem('marks', prev, theoryMarks);
      setSemItem('theoryConfig', prev, theoryConfig);
      setSemItem('labCourses', prev, labCourses);
      setSemItem('labConfig', prev, labConfig);
      setSemItem('labMarks', prev, labMarks);
    }
    prevSemRef.current = next;
    currentSemRef.current = next;

    const nd = loadSemesterData(next);
    setTheoryCourses(nd.theoryCourses);
    setTheoryMarks(nd.theoryMarks);
    setTheoryConfig(nd.theoryConfig);
    setLabCourses(nd.labCourses);
    setLabConfig(nd.labConfig);
    setLabMarks(nd.labMarks);
    setQuizDrafts({});
    setSelectedSemester(next);
  };

  /* ════════════════════
     THEORY LOGIC
  ════════════════════ */
  const theoryBestTwo = (cid) => {
    const m = theoryMarks[cid] || {};
    const cfg = theoryConfig[cid];
    const qc = cfg?.quizCount || 3;
    const best = cfg?.bestOf || 2;
    const quizMarks = [];
    for (let i = 1; i <= qc; i++) quizMarks.push(m[`quiz${i}`] || 0);
    return quizMarks.sort((a,b)=>b-a).slice(0, best).reduce((s,v)=>s+v, 0);
  };
  const theoryTotal = (cid) => {
    const m = theoryMarks[cid] || {};
    return (m.attendance||0) + theoryBestTwo(cid) + (m.midterm||0) + (m.final||0);
  };
  const handleTheoryMark = (cid, fid, val) => {
    const cfg = theoryConfig[cid];
    const fields = getTheoryFields(cfg?.quizCount || 3, cfg?.bestOf || 2);
    const max = fields.find(f=>f.id===fid)?.maxMarks || 0;
    const num = parseFloat(val);
    setTheoryMarks(prev => ({
      ...prev, [cid]: { ...prev[cid], [fid]: isNaN(num) ? undefined : Math.max(0, Math.min(max, num)) }
    }));
  };
  const resetTheoryMarks = () => {
    askConfirm('Reset all theory marks for this semester?', () => {
      setTheoryMarks({});
    });
  };

  /* ── Semester nav (masthead chevrons) ── */
  const goPrevSem = () => {
    const idx = availableSemesters.indexOf(selectedSemester);
    if (idx > 0) switchToSemester(availableSemesters[idx - 1]);
  };
  const goNextSem = () => {
    const idx = availableSemesters.indexOf(selectedSemester);
    if (idx < availableSemesters.length - 1) switchToSemester(availableSemesters[idx + 1]);
  };

  /* ════════════════════
     LAB SETUP WIZARD
  ════════════════════ */
  const openSetup = (courseId) => {
    const existing = labConfig[courseId];
    setDraftComponents(existing?.components ? [...existing.components] : []);
    setSetupCourseId(courseId);
  };

  const addDraftComponent = (type) => {
    const meta = LAB_TYPES.find(t=>t.type===type);
    if (type === 'custom') {
      setDraftComponents(p => [...p, { type:'custom', label:'', count:'', totalMarks:'' }]);
    } else {
      // avoid duplicate non-custom
      if (draftComponents.some(c=>c.type===type && c.type!=='custom')) return;
      setDraftComponents(p => [...p, { type, label: meta.label, count:'', totalMarks:'' }]);
    }
  };

  const updateDraft = (idx, field, value) => {
    // If it's a numeric field, we allow empty string but otherwise parse it
    let finalVal = value;
    if ((field === 'count' || field === 'totalMarks') && value !== '') {
      finalVal = parseFloat(value);
      if (isNaN(finalVal)) finalVal = '';
    }
    setDraftComponents(p => p.map((c,i) => i===idx ? {...c, [field]: finalVal} : c));
  };

  const removeDraft = (idx) => {
    setDraftComponents(p => p.filter((_,i)=>i!==idx));
  };

  const saveLabSetup = () => {
    const valid = draftComponents.filter(c => c.label.trim() && c.count >= 1 && c.totalMarks > 0);
    if (!valid.length) { alert('Add at least one valid component with total marks > 0.'); return; }
    setLabConfig(prev => ({ ...prev, [setupCourseId]: { components: valid } }));
    setSetupCourseId(null);
    setDraftComponents([]);
  };

  const resetLabSetup = (courseId) => {
    askConfirm('Reset this lab setup? All marks will be cleared.', () => {
      setLabConfig(prev => { const n={...prev}; delete n[courseId]; return n; });
      setLabMarks(prev  => { const n={...prev}; delete n[courseId]; return n; });
    });
  };

  const resetAllLabMarks = () => {
    askConfirm('Reset all lab marks for this semester?', () => {
      setLabMarks({});
    });
  };

  const handleLabKeyDown = (e, courseId, gi, ii, groupCount, maxCols) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = ii + 1;
      if (next < maxCols) {
        inputRefs.current[`l_${courseId}_${gi}_${next}`]?.focus();
      } else if (gi + 1 < groupCount) {
        inputRefs.current[`l_${courseId}_${gi + 1}_0`]?.focus();
      }
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = ii - 1;
      if (prev >= 0) {
        inputRefs.current[`l_${courseId}_${gi}_${prev}`]?.focus();
      } else if (gi - 1 >= 0) {
        inputRefs.current[`l_${courseId}_${gi - 1}_${maxCols - 1}`]?.focus();
      }
    }
    if (e.key === 'ArrowDown' && gi + 1 < groupCount) {
      e.preventDefault();
      inputRefs.current[`l_${courseId}_${gi + 1}_${ii}`]?.focus();
    }
    if (e.key === 'ArrowUp' && gi - 1 >= 0) {
      e.preventDefault();
      inputRefs.current[`l_${courseId}_${gi - 1}_${ii}`]?.focus();
    }
  };
  const handleLabMark = (cid, colKey, val, max) => {
    const num = parseFloat(val);
    setLabMarks(prev => ({
      ...prev,
      [cid]: { ...prev[cid], [colKey]: isNaN(num) ? undefined : Math.max(0, Math.min(max, num)) }
    }));
  };

  const handleRawMark = (cid, colKey, rawStr, perExamMax) => {
    const rawKey = `${cid}_${colKey}`;
    setRawInputs(prev => ({ ...prev, [rawKey]: { raw: rawStr } }));
    const parts = rawStr.split('/');
    if (parts.length === 2) {
      const s = parseFloat(parts[0].trim());
      const o = parseFloat(parts[1].trim());
      if (!isNaN(s) && !isNaN(o) && o > 0) {
        const converted = (s / o) * perExamMax;
        handleLabMark(cid, colKey, converted.toFixed(2), perExamMax);
        return;
      }
    }
    // Plain number → treat as direct mark
    handleLabMark(cid, colKey, rawStr, perExamMax);
  };

  const labTotal = (cid, cols) =>
    cols.reduce((sum, col) => sum + (labMarks[cid]?.[col.key] || 0), 0);

  const exportSemesterPdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageW = 277;
    let y = 20;

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(`Semester Tracker - ${formatSemesterLabel(selectedSemester)}`, pageW / 2, y, { align: 'center' });
    y += 12;

    const rowH = 7;

    /* ── Theory section ── */
    if (theoryCourses.length > 0) {
      const maxQuizCount = Math.max(...theoryCourses.map(c => theoryConfig[c.id]?.quizCount || 3));
      const maxBest = Math.max(...theoryCourses.map(c => theoryConfig[c.id]?.bestOf || 2));
      const maxFields = getTheoryFields(maxQuizCount, maxBest);

      const colW = (pageW - 70) / maxFields.length;

      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Theory Courses', 10, y);
      y += 8;

      /* header */
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      let x = 10;
      doc.text('Course', x, y); x += 55;
      maxFields.forEach(f => { doc.text(f.label, x + colW / 2, y, { align: 'center' }); x += colW; });
      doc.text('Best2', x + colW / 2, y, { align: 'center' }); x += colW;
      doc.text('Total', x + colW / 2, y, { align: 'center' }); x += colW;
      doc.text('Grade', x + colW / 2, y, { align: 'center' });
      y += 5;

      theoryCourses.forEach(course => {
        const cfg = theoryConfig[course.id] || {};
        const qc = cfg.quizCount || 3;
        const best = cfg.bestOf || 2;
        const courseFields = getTheoryFields(qc, best);
        const m = theoryMarks[course.id] || {};
        const b2 = courseFields.filter(f => f.id.startsWith('quiz')).map(f => m[f.id] || 0).sort((a,b) => b - a).slice(0, best).reduce((s,v) => s + v, 0);
        const tot = (m.attendance||0) + b2 + (m.midterm||0) + (m.final||0);
        const grade = getGrade(tot).letter;

        if (y + rowH > 190) { doc.addPage(); y = 20; }

        doc.setFont(undefined, 'normal');
        doc.setFontSize(6.5);
        x = 10;
        doc.text(course.code, x, y); x += 55;
        courseFields.forEach(f => {
          const val = m[f.id];
          doc.text(val !== undefined && val !== '' ? String(val) : '-', x + colW / 2, y, { align: 'center' });
          x += colW;
        });
        doc.text(String(b2), x + colW / 2, y, { align: 'center' }); x += colW;
        doc.text(String(tot), x + colW / 2, y, { align: 'center' }); x += colW;
        doc.text(grade, x + colW / 2, y, { align: 'center' });
        y += rowH + 1;
      });
      y += 6;
    }

    /* ── Lab section ── */
    if (labCourses.length > 0) {
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Lab Courses', 10, y);
      y += 8;

      labCourses.forEach(course => {
        const config = labConfig[course.id];
        if (!config) return;
        const { groups, allCols } = expandLabColumns(config);
        if (allCols.length === 0) return;

        if (y + 15 > 190) { doc.addPage(); y = 20; }

        doc.setFont(undefined, 'bold');
        doc.setFontSize(7);
        doc.text(`${course.code} - ${course.name}`, 10, y); y += 4;

        const colW = Math.min(20, (pageW - 40) / allCols.length);
        let x = 10;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(6);
        allCols.forEach(col => { doc.text(String(col.itemIdx + 1), x + colW / 2, y, { align: 'center' }); x += colW; });
        doc.text('Sub', x + colW / 2, y, { align: 'center' }); x += colW;
        doc.text('Grade', x + colW / 2, y, { align: 'center' });
        y += 4;

        groups.forEach(comp => {
          if (y + rowH > 190) { doc.addPage(); y = 20; }
          doc.setFont(undefined, 'normal');
          doc.setFontSize(6);
          x = 10;
          comp.items.forEach(col => {
            const val = labMarks[course.id]?.[col.key];
            doc.text(val !== undefined ? String(val) : '-', x + colW / 2, y - 1, { align: 'center' });
            x += colW;
          });
          const subTotal = comp.items.reduce((s, col) => s + (labMarks[course.id]?.[col.key] || 0), 0);
          doc.text(String(subTotal), x + colW / 2, y - 1, { align: 'center' }); x += colW;
          const grade = getGrade(subTotal).letter;
          doc.text(grade, x + colW / 2, y - 1, { align: 'center' });
          y += rowH;
        });
        y += 4;
      });
    }

    doc.save(`semester-tracker-${selectedSemester}.pdf`);
  };

  /* ── Keyboard nav ── */
  const handleKeyDown = (e, courses, courseIdx, fieldIdx, fieldCount, prefix) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextF = fieldIdx + 1;
      if (nextF < fieldCount) {
        inputRefs.current[`${prefix}_${courses[courseIdx].id}_${nextF}`]?.focus();
      } else if (courseIdx + 1 < courses.length) {
        inputRefs.current[`${prefix}_${courses[courseIdx+1].id}_0`]?.focus();
      }
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevF = fieldIdx - 1;
      if (prevF >= 0) {
        inputRefs.current[`${prefix}_${courses[courseIdx].id}_${prevF}`]?.focus();
      } else if (courseIdx - 1 >= 0) {
        const prevCourseFields = prefix === 't'
          ? getTheoryFields(theoryConfig[courses[courseIdx-1].id]?.quizCount || 3).length
          : fieldCount;
        inputRefs.current[`${prefix}_${courses[courseIdx-1].id}_${prevCourseFields - 1}`]?.focus();
      }
    }
    if (e.key==='ArrowDown' && courseIdx+1<courses.length)
      inputRefs.current[`${prefix}_${courses[courseIdx+1].id}_${fieldIdx}`]?.focus();
    if (e.key==='ArrowUp' && courseIdx-1>=0)
      inputRefs.current[`${prefix}_${courses[courseIdx-1].id}_${fieldIdx}`]?.focus();
  };

  const totalPossibleLab = (config) =>
    // totalMarks is what the user entered as the total for each component
    (config?.components||[]).reduce((s,c)=>s+(c.totalMarks||0),0);

  /* ════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════ */
  const allResults = useMemo(() => (liveSemResults && liveSemResults.length ? liveSemResults : null) || getUserStorageItemWithGuestFallback('semesterResults') || [], [liveSemResults]);
  const availableSemesters = (() => {
    const fromData = allResults
      .filter(r => r.courses?.some(c => c.code && c.code.trim()))
      .map(r => r.semester)
      .sort((a, b) => a - b);
    return fromData.length > 0 ? fromData : Array.from({ length: 8 }, (_, i) => i + 1);
  })();

  return (
    <div className="glass-card-static schedule-widget st-widget animate-fadeInUp">

      {/* ── Masthead (matches dashboard Semester View) ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <Layers size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Grade Lab</span>
            <p className="schedule-title">Semester Wise</p>
            <span className="schedule-subtitle">
              {user?.department
                ? `${user.department} · ${formatSemesterLabel(selectedSemester)}`
                : 'Theory & lab mark sheet'}
            </span>
          </div>
        </div>

        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="schedule-stat-value">{theoryCourses.length}</span>
              <span className="schedule-stat-label">Theory</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">{labCourses.length}</span>
              <span className="schedule-stat-label">Lab</span>
            </div>
          </div>
        </div>

        <div className="schedule-actions">
          <div className="schedule-week-nav">
            <button className="schedule-nav-btn" onClick={goPrevSem} title="Previous semester">
              <ChevronLeft size={20} />
            </button>
            <div className="schedule-week-pill">
              <span className="schedule-week-pill-value">{formatSemesterLabel(selectedSemester)}</span>
            </div>
            <button className="schedule-nav-btn" onClick={goNextSem} title="Next semester">
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="export-dropdown" ref={stMenuRef}>
            <button className="schedule-nav-btn" onClick={() => setStMenuOpen((v) => !v)} aria-label="More options" aria-haspopup="true">
              <MoreVertical size={18} />
            </button>
            {stMenuOpen && (
              <div className="export-menu">
                <button className="export-menu-item" onClick={() => { setStMenuOpen(false); exportSemesterPdf(); }}>
                  <FileDown size={14} /> Export PDF
                </button>
                <div className="export-menu-sep" />
                <button
                  className="export-menu-item"
                  onClick={() => { setStMenuOpen(false); resetTheoryMarks(); }}
                  disabled={theoryCourses.length === 0}
                >
                  <RotateCcw size={14} /> Reset Theory Marks
                </button>
                <button
                  className="export-menu-item"
                  onClick={() => { setStMenuOpen(false); resetAllLabMarks(); }}
                  disabled={labCourses.length === 0}
                >
                  <RotateCcw size={14} /> Reset Lab Marks
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {/* ══════════════════════════════
          THEORY SECTION
      ══════════════════════════════ */}
      <div className="st-section-header">
        <div className="st-section-icon theory-icon"><BookOpen size={16}/></div>
        <div>
          <h2 className="st-section-title">Theory Courses</h2>
          <p className="st-section-sub">
            Set quiz count &amp; best-of per course below
          </p>
        </div>
        <button
          className="st-quiz-toggle"
          onClick={()=>setShowQuizCfg(v=>!v)}
          title={showQuizCfg ? 'Hide quiz configuration' : 'Show quiz configuration'}
        >
          <Info size={12} /> {showQuizCfg ? 'Hide' : 'Show'} quiz config
        </button>
      </div>

      {theoryCourses.length === 0 ? (
        <div className="st-empty">
          <AlertCircle size={38} className="st-empty-icon"/>
          <h3>No Theory Courses</h3>
          <p>Theory courses from your routine will appear here automatically.</p>
        </div>
      ) : (
        (() => {
          const maxQuizCount = Math.max(...theoryCourses.map(c => theoryConfig[c.id]?.quizCount || 3));
          const maxBest = Math.max(...theoryCourses.map(c => theoryConfig[c.id]?.bestOf || 2));
          const maxFields = getTheoryFields(maxQuizCount, maxBest);
          return (
        <div className="st-table-scroll">
          <table className="st-table">
            <thead>
              <tr>
                <th className="st-th st-th-course">Course</th>
                {maxFields.map(f=>(
                  <th key={f.id} className="st-th st-th-mark" style={{'--col-color':f.color}}>
                    <div className="st-th-inner">
                      <span className="st-th-label">{f.label}</span>
                      <span className="st-th-max">/{f.id.startsWith('quiz') ? f.maxMarks.toFixed(2) : f.maxMarks}</span>
                    </div>
                  </th>
                ))}
                <th className="st-th st-th-best2">Best<br/><span className="st-th-sub">/20</span></th>
                <th className="st-th st-th-total">Total<br/><span className="st-th-sub">/100</span></th>
                <th className="st-th st-th-grade">Grade</th>
              </tr>
            </thead>
            <tbody>
              {theoryCourses.map((course, cIdx)=>{
                const cfg = theoryConfig[course.id] || {};
                const qc = cfg.quizCount || 3;
                const best = cfg.bestOf || 2;
                const courseFields = getTheoryFields(qc, best);
                const m = theoryMarks[course.id] || {};
                const b2 = theoryBestTwo(course.id);
                const tot = theoryTotal(course.id);
                const grade = getGrade(tot);
                const hasAny = courseFields.some(f=>m[f.id]!==undefined);
                return (
                  <tr key={course.id} className="st-row">
                    <td className="st-td st-td-course" style={{minWidth:'130px'}}>
                      <div>
                        <span className="st-course-code">{course.code}</span>
                        <span className="st-course-name">{course.name}</span>
                      </div>
                      <div className="st-quiz-config" style={{marginTop:'2px',display:'flex',gap:'4px',alignItems:'center',flexWrap:'wrap'}}>
                        {showQuizCfg && <>
                        <span style={{fontSize:'0.55rem',color:'var(--text-tertiary)',fontWeight:'600'}}>Best</span>
                        <input type="text" inputMode="numeric"
                          value={quizDrafts[`${course.id}_b`] ?? best}
                          className="st-cell-input"
                          style={{width:'24px',height:'20px',fontSize:'0.55rem',textAlign:'center',padding:'0',border:'1px solid var(--border-primary)',borderRadius:'var(--radius-sm)',background:'var(--bg-tertiary)'}}
                          onChange={e=>{
                            const v = e.target.value;
                            setQuizDrafts(p=>({...p,[`${course.id}_b`]:v}));
                            if (v === '') return;
                            const n = Number(v);
                            if (!isNaN(n) && n >= 1 && n <= qc) {
                              setTheoryConfig(p=>({...p,[course.id]:{...p[course.id],bestOf:n}}));
                            }
                          }}
                          onBlur={() => setQuizDrafts(p=>{const n={...p}; delete n[`${course.id}_b`]; return n;})}
                        />
                        <span style={{fontSize:'0.55rem',color:'var(--text-tertiary)',fontWeight:'600'}}>of</span>
                        <input type="text" inputMode="numeric"
                          value={quizDrafts[`${course.id}_q`] ?? qc}
                          className="st-cell-input"
                          style={{width:'24px',height:'20px',fontSize:'0.55rem',textAlign:'center',padding:'0',border:'1px solid var(--border-primary)',borderRadius:'var(--radius-sm)',background:'var(--bg-tertiary)'}}
                          onChange={e=>{
                            const v = e.target.value;
                            setQuizDrafts(p=>({...p,[`${course.id}_q`]:v}));
                            if (v === '') return;
                            const n = Number(v);
                            if (!isNaN(n) && n >= 1 && n <= 10) {
                              setTheoryConfig(p=>({...p,[course.id]:{...p[course.id],quizCount:n}}));
                            }
                          }}
                          onBlur={() => setQuizDrafts(p=>{const n={...p}; delete n[`${course.id}_q`]; return n;})}
                        />
                        <span style={{fontSize:'0.5rem',color:'var(--text-tertiary)'}}>quizzes</span>
                        </>}
                      </div>
                    </td>
                    {maxFields.map((field,fIdx)=>{
                      const belongs = courseFields.some(f=>f.id===field.id);
                      if (!belongs) {
                        return <td key={field.id} className="st-td" style={{padding:'2px'}}/>;
                      }
                      const val = m[field.id];
                      const isActive = activeCell?.key===`t_${course.id}_${fIdx}`;
                      return (
                        <td key={field.id}
                          data-label={`${field.label} /${field.id.startsWith('quiz') ? field.maxMarks.toFixed(2) : field.maxMarks}`}
                          className={`st-td st-td-input ${getCellClass(val,field.maxMarks)} ${isActive?'st-td-active':''}`}
                          style={{'--col-color':field.color}}
                        >
                          <input
                            ref={el=>inputRefs.current[`t_${course.id}_${fIdx}`]=el}
                            type="number" min="0" max={field.maxMarks}
                            step={field.id.startsWith('quiz') ? "0.01" : "0.5"}
                            value={val??''} placeholder="—"
                            className="st-cell-input"
                            onFocus={()=>setActiveCell({key:`t_${course.id}_${fIdx}`})}
                            onBlur={()=>setActiveCell(null)}
                            onChange={e=>handleTheoryMark(course.id,field.id,e.target.value)}
                            // eslint-disable-next-line react-hooks/refs -- handleKeyDown only runs in the keydown event, never during render
                            onKeyDown={e=>handleKeyDown(e,theoryCourses,cIdx,fIdx,maxFields.length,'t')}
                          />
                        </td>
                      );
                    })}
                    {/* Best */}
                    <td className="st-td st-td-computed" data-label="Best /20">
                      <span className={`st-computed-val ${getCellClass(b2,20)}`}>{b2>0?b2:'—'}/20</span>
                    </td>
                    {/* Total */}
                    <td className="st-td st-td-total-cell" data-label="Total /100">
                      <div className="st-total-wrap">
                        <span className="st-total-val" style={{color:hasAny?grade.color:'var(--text-tertiary)'}}>
                          {hasAny?tot.toFixed(1):'—'}
                        </span>
                        {hasAny&&(
                          <div className="st-total-bar">
                            <div className="st-total-bar-fill" style={{width:`${tot}%`,background:getTotalColor(tot)}}/>
                          </div>
                        )}
                      </div>
                    </td>
                    {/* Grade */}
                    <td className="st-td st-td-grade" data-label="Grade">
                      {hasAny?(
                        <div className="st-grade-badge" style={{'--grade-color':grade.color}}>
                          <span className="st-grade-letter">{grade.letter}</span>
                          <span className="st-grade-gpa">{grade.gpa}</span>
                        </div>
                      ):<span className="st-nil">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
          );
        })()
      )}

      {/* Keyboard hint */}


      {/* ══════════════════════════════
          LAB SECTION
      ══════════════════════════════ */}
      <div className="st-divider"/>

      <div className="st-section-header">
        <div className="st-section-icon lab-icon"><FlaskConical size={16}/></div>
        <div>
          <h2 className="st-section-title">Lab Courses</h2>
          <p className="st-section-sub">
            Configure mark distribution per lab — then enter marks in the table
          </p>
        </div>
      </div>

      {labCourses.length === 0 ? (
        <div className="st-empty">
          <AlertCircle size={38} className="st-empty-icon"/>
          <h3>No Lab Courses</h3>
          <p>Lab / Sessional courses from your routine will appear here.</p>
        </div>
      ) : (
        <div className="st-lab-list">
          {labCourses.map(course=>{
            const config  = labConfig[course.id];
            const { groups, allCols } = config ? expandLabColumns(config) : { groups: [], allCols: [] };
            const maxTot  = totalPossibleLab(config);
            const lMarks  = labMarks[course.id] || {};
            const tot     = labTotal(course.id, allCols);
            const pct     = maxTot ? (tot/maxTot)*100 : 0;
            const grade   = getGrade(pct);
            const hasAny  = allCols.some(c=>lMarks[c.key]!==undefined);
            const isSetup = setupCourseId === course.id;

            return (
              <div key={course.id} className="st-lab-card">
                {/* ─ Card Header ─ */}
                <div className="st-lab-card-header">
                  <div className="st-lab-title-row">
                    <div>
                      <span className="st-course-code">{course.code}</span>
                      <span className="st-course-name" style={{marginLeft:'10px'}}>{course.name}</span>
                    </div>
                    <div className="st-lab-header-actions">
                      {config && (
                        <button className="st-icon-btn" onClick={()=>resetLabSetup(course.id)} title="Reset setup">
                          <RotateCcw size={13}/>
                        </button>
                      )}
                      <button
                        className={`st-icon-btn ${isSetup?'active':''}`}
                        onClick={()=> isSetup ? setSetupCourseId(null) : openSetup(course.id)}
                        title={config?'Edit setup':'Configure marks'}
                      >
                        <Settings2 size={13}/>
                        <span style={{fontSize:'0.65rem',marginLeft:'3px'}}>
                          {config ? 'Edit Setup' : 'Setup Marks'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Total bar (if configured) */}
                  {config && hasAny && (
                    <div className="st-lab-progress-row">
                      <div className="st-total-bar" style={{flex:1}}>
                        <div className="st-total-bar-fill" style={{width:`${pct}%`,background:getTotalColor(pct)}}/>
                      </div>
                      <span style={{fontSize:'var(--fs-xs)',color:grade.color,fontWeight:700,minWidth:'90px',textAlign:'right'}}>
                        {tot.toFixed(1)}/{maxTot} ({pct.toFixed(1)}%)
                      </span>
                      <div className="st-grade-badge" style={{'--grade-color':grade.color}}>
                        <span className="st-grade-letter">{grade.letter}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ─ Setup Wizard ─ */}
                {isSetup && (
                  <div className="st-setup-panel">
                    <p className="st-setup-heading">
                      Select components → set count &amp; total marks → per-item calculated automatically:
                    </p>

                    {/* Type picker */}
                    <div className="st-type-grid">
                      {LAB_TYPES.map(lt=>{
                        const already = draftComponents.some(c=>c.type===lt.type && lt.type!=='custom');
                        return (
                          <button
                            key={lt.type}
                            className={`st-type-btn ${already?'active':''}`}
                            onClick={()=>addDraftComponent(lt.type)}
                            title={already && lt.type!=='custom' ? 'Already added' : ''}
                          >
                            <span>{lt.icon}</span>
                            <span>{lt.label}</span>
                            {already && lt.type!=='custom' && <Check size={10} className="st-type-check"/>}
                          </button>
                        );
                      })}
                    </div>

                    {/* Draft component rows */}
                    {draftComponents.length > 0 && (
                      <div className="st-draft-list">
                        <div className="st-draft-header-row">
                          <span style={{flex:2}}>Component</span>
                          <span style={{flex:1,textAlign:'center'}}>Count</span>
                          <span style={{flex:1,textAlign:'center'}}>Total Marks</span>
                          <span style={{flex:1,textAlign:'center'}}>Per Item</span>
                          <span style={{width:'28px'}}/>
                        </div>
                        {draftComponents.map((comp,idx)=>{
                          const perItem = comp.count > 0 ? (comp.totalMarks / comp.count) : 0;
                          return (
                          <div key={idx} className="st-draft-row">
                            {/* Label */}
                            {comp.type==='custom' ? (
                              <input
                                className="st-draft-input st-draft-label"
                                placeholder="Type label..."
                                value={comp.label}
                                onChange={e=>updateDraft(idx,'label',e.target.value)}
                              />
                            ):(
                              <span className="st-draft-label-text">
                                {LAB_TYPES.find(t=>t.type===comp.type)?.icon} {comp.label}
                              </span>
                            )}
                            {/* Count */}
                            <input
                              type="number" min="1" max="20"
                              className="st-draft-input st-draft-num"
                              value={comp.count}
                              placeholder="1"
                              onChange={e=>updateDraft(idx,'count',e.target.value)}
                            />
                            {/* Total Marks (user enters this) */}
                            <input
                              type="number" min="1" max="500"
                              className="st-draft-input st-draft-num"
                              value={comp.totalMarks}
                              placeholder="10"
                              onChange={e=>updateDraft(idx,'totalMarks',e.target.value)}
                            />
                            {/* Per Item (auto-calculated) */}
                            <span className="st-draft-sub" title={`${comp.totalMarks} ÷ ${comp.count}`}>
                              {Number.isInteger(perItem) ? perItem : perItem.toFixed(2)}
                            </span>
                            {/* Remove */}
                            <button className="st-icon-btn danger" onClick={()=>removeDraft(idx)}>
                              <X size={12}/>
                            </button>
                          </div>
                          );
                        })}
                        <div className="st-draft-total-row">
                          <span>Grand Total</span>
                          <span style={{color:'var(--accent-amber)',fontWeight:700}}>
                            {draftComponents.reduce((s,c)=>s+(c.totalMarks||0),0)}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="st-setup-actions">
                      <button className="btn btn-secondary btn-sm" onClick={()=>{setSetupCourseId(null);setDraftComponents([]);}}>
                        Cancel
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={saveLabSetup} disabled={!draftComponents.length}>
                        <Check size={13}/> Save Setup
                      </button>
                    </div>
                  </div>
                )}

                {/* ─ Lab Marks Table ─ */}
                {config && !isSetup && allCols.length > 0 && (
                  <div className="st-table-scroll" style={{marginTop:'8px'}}>
                    {(() => {
                      const maxCount = Math.max(...groups.map(g => g.items.length));
                      return (
                    <table className="st-table st-lab-marks-table">
                      <thead>
                        <tr>
                          <th className="st-th st-th-course" style={{minWidth:'80px',textAlign:'center'}}>Component</th>
                          {Array.from({length: maxCount}, (_, i) => (
                            <th key={i} className="st-th st-th-mark" style={{'--col-color':'var(--accent-blue)',minWidth:'36px'}}>
                              <span style={{fontSize:'0.55rem'}}>{i + 1}</span>
                            </th>
                          ))}
                          <th className="st-th st-th-mark" style={{'--col-color':'var(--accent-blue)',minWidth:'45px',background:'var(--bg-tertiary)'}}>
                            <span style={{fontSize:'0.5rem',color:'var(--text-secondary)'}}>Sub Total</span>
                          </th>
                          <th className="st-th st-th-total" style={{minWidth:'50px'}}>Total<br/><span className="st-th-sub">/{maxTot}</span></th>
                          <th className="st-th st-th-grade" style={{minWidth:'50px'}}>Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map((group, gi) => {
                          const groupTotal = group.items.reduce((s, item) => s + (lMarks[item.key] || 0), 0);
                          return (
                            <tr key={gi} className="st-row">
                              <td className="st-td st-td-course" style={{padding:'2px 8px',fontSize:'0.6rem',textAlign:'center',borderRight:'1.5px solid var(--border-primary)'}}>
                                <span style={{fontWeight:'var(--fw-bold)',color:'var(--text-secondary)'}}>{group.label}</span>
                              </td>
                              {Array.from({length: maxCount}, (_, ii) => {
                                const col = group.items[ii];
                                if (!col) {
                                  return <td key={ii} className="st-td" style={{padding:'2px'}}/>;
                                }
                                const val = lMarks[col.key];
                                const isActive = activeCell?.key===`l_${course.id}_${gi}_${ii}`;
                                const rawKey = `${course.id}_${col.key}`;
                                const raw = rawInputs[rawKey] || {};
                                const displayVal = raw.raw ?? (val != null ? val : '');
                                return (
                                  <td key={col.key}
                                    className={`st-td st-td-input ${getCellClass(val,col.max)} ${isActive?'st-td-active':''}`}
                                    style={{'--col-color':'var(--accent-blue)'}}
                                  >
                                    <div className="st-raw-wrap">
                                      <input
                                        ref={el=>inputRefs.current[`l_${course.id}_${gi}_${ii}`]=el}
                                        type="text" inputMode="decimal"
                                        value={displayVal}
                                        placeholder="—"
                                        className="st-cell-input st-raw-single"
                                        style={{height:'28px',fontSize:'0.55rem',width:'52px',textAlign:'center'}}
                                        onFocus={()=>setActiveCell({key:`l_${course.id}_${gi}_${ii}`})}
                                        onBlur={()=>setActiveCell(null)}
                                        onChange={e=>handleRawMark(course.id,col.key,e.target.value,col.max)}
                                        onKeyDown={e=>handleLabKeyDown(e,course.id,gi,ii,groups.length,maxCount)}
                                      />
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="st-td st-td-computed" style={{padding:'2px',minWidth:'45px',background:'var(--bg-tertiary)'}}>
                                <span className="st-computed-val" style={{fontSize:'0.6rem',fontWeight:'bold',color:hasAny?'var(--accent-amber)':'var(--text-tertiary)'}}>
                                  {hasAny ? groupTotal.toFixed(1) : '—'}/{group.max}
                                </span>
                              </td>
                              <td className="st-td" style={{padding:'4px',textAlign:'center'}}>
                                <span style={{fontSize:'0.7rem',fontWeight:'bold',color:hasAny?grade.color:'var(--text-tertiary)'}}>
                                  {hasAny?groupTotal.toFixed(1):'—'}
                                </span>
                              </td>
                              <td className="st-td" style={{padding:'2px'}}/>
                            </tr>
                          );
                        })}
                        {/* Grand total + grade row */}
                        <tr className="st-row" style={{background:'var(--bg-tertiary)'}}>
                          <td className="st-td" style={{padding:'2px 8px',fontSize:'0.6rem',textAlign:'center',fontWeight:'bold',borderRight:'1.5px solid var(--border-primary)'}}>
                            Total
                          </td>
                          {Array.from({length: maxCount}, (_, i) => (
                            <td key={i} className="st-td" style={{padding:'2px'}}/>
                          ))}
                          <td className="st-td" style={{padding:'2px'}}/>
                          <td className="st-td" style={{padding:'4px',textAlign:'center'}}>
                            <span style={{fontSize:'0.7rem',fontWeight:'bold',color:hasAny?grade.color:'var(--text-tertiary)'}}>
                              {hasAny?tot.toFixed(1):'—'}
                            </span>
                            {hasAny&&(
                              <div className="st-total-bar" style={{margin:'2px auto 0',width:'40px'}}>
                                <div className="st-total-bar-fill" style={{width:`${pct}%`,background:getTotalColor(pct)}}/>
                              </div>
                            )}
                          </td>
                          <td className="st-td st-td-grade" style={{textAlign:'center'}}>
                            {hasAny && (
                              <div className="st-grade-badge" style={{'--grade-color':grade.color}}>
                                <span className="st-grade-letter" style={{fontSize:'0.7rem'}}>{grade.letter}</span>
                                <span className="st-grade-gpa" style={{fontSize:'0.55rem'}}>{grade.gpa}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    );
                    })()}
                  </div>
                )}

                {/* ─ Prompt to setup ─ */}
                {!config && !isSetup && (
                  <div className="st-setup-prompt" onClick={()=>openSetup(course.id)}>
                    <Settings2 size={16} style={{opacity:0.5}}/>
                    <span>Click <strong>Setup Marks</strong> above to configure mark distribution</span>
                    <ChevronRight size={14} style={{opacity:0.4}}/>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}


      {/* ─ Confirm Modal — portal to <body> so it always covers the screen
           (the widget's transform + overflow:hidden would otherwise clip it) */}
      {confirm && createPortal(
        <div className="st-modal-overlay" onClick={() => setConfirm(null)}>
          <div className="st-modal" onClick={e => e.stopPropagation()}>
            <p className="st-modal-message">{confirm.message}</p>
            <div className="st-modal-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" style={{background:'var(--accent-rose)'}} onClick={() => { confirm.onConfirm(); setConfirm(null); }}>Confirm</button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
