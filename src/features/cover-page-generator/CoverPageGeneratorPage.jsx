import { useState, useRef, useCallback, useEffect, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import {
  NotebookPen, FileText, Image,
  Check, FileDown, Sparkles, User, X, UserPlus, MoreVertical, RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import CourseAutocomplete from '../../components/CourseAutocomplete';
import austwiseLogo from '../../assets/austwise-icon-final.svg';
import austLogo from '../../assets/aust-logo.jpg';
import { useRoleAccess } from '../../hooks/useRoleAccess';
import { getAccessRole } from '../../utils/accessRole';
import { ensureFetched, getLiveValue, setLiveValue, onLiveChange } from '../../utils/liveStore';
import '../daily-life/DailyMasthead.css';
import './CoverPageGeneratorPage.css';

function formatDate(date) {
  const d = new Date(date);
  const months = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── A4 dimensions at 96dpi (210mm × 2
// 97mm) ───
const A4_W = 794;
const A4_H = 1123;

// ─── Title-case: first letter of each word capital, spaces preserved ───
function capitalizeWords(str) {
  return (str || '').replace(/(\S+)/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

// ─── html2canvas-pro leaves SVG <img>s blank (the AUSTWise footer logo
//     vanished from exports). Swap each SVG image in the capture clone for a
//     PNG drawn by the browser itself, at 6× its CSS size so it stays sharp
//     at the 3× export scale. ───
async function rasterizeSvgImages(root) {
  const imgs = [...root.querySelectorAll('img')].filter((img) => /\.svg(\?|#|$)|^data:image\/svg/i.test(img.src));
  await Promise.all(imgs.map(async (img) => {
    try {
      // window.Image: the lucide `Image` icon import shadows the global here.
      const probe = new window.Image();
      probe.src = img.src;
      await probe.decode();
      const cssW = parseFloat(img.style.width) || img.width || 64;
      const ratio = (probe.naturalHeight || 1) / (probe.naturalWidth || 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(cssW * 6);
      canvas.height = Math.ceil(cssW * 6 * ratio);
      canvas.getContext('2d').drawImage(probe, 0, 0, canvas.width, canvas.height);
      // Wait on `load` (not decode(): it can hang for off-screen images),
      // capped so an export never stalls on the logo.
      await new Promise((resolve) => {
        const done = () => { clearTimeout(t); resolve(); };
        const t = setTimeout(resolve, 1500);
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        img.src = canvas.toDataURL('image/png');
      });
    } catch { /* keep the original image if rasterizing fails */ }
  }));
}

// ─── Real (numeric) AUST student ID from the profile, never the AWID.
//     Returns '' when the profile has none, so the field stays empty
//     instead of showing someone else's ID. ───
function getRealStudentId(u) {
  for (const v of [u?.studentId, u?.id, u?.awid]) {
    const s = String(v || '');
    if (/^\d{8,}$/.test(s)) return s;
  }
  const m = String(u?.email || '').match(/(\d{8,})/);
  return m ? m[1] : '';
}

const sameName = (a, b) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

// ─── Cover form persistence — server-synced per account ───
//     The whole form is one document in the per-user store (liveStore →
//     /api/store/user/:key), so it follows the user across devices and
//     updates live on their other open tabs/devices. localStorage is only
//     liveStore's cache (purged on logout).
const COVER_STORE_KEY = 'aust-cover-page-v1';
const OLD_FALLBACK_ID = '20230204026';
const SAVE_DEBOUNCE_MS = 700;

// Older browser-only drafts, moved to the server once if it has none yet.
const LEGACY_COVER_FORM_KEY = 'aust-cover-form-v1';
const localDraftKey = (u) => `aust-cover-form-v2:${u?.id || u?.email || 'guest'}`;

function loadLocalDraft(u) {
  try {
    const own = localStorage.getItem(localDraftKey(u));
    if (own) return { draft: JSON.parse(own), keys: [localDraftKey(u)] };
    // Old shared key: adopt it only if it was this account's own form.
    const legacy = JSON.parse(localStorage.getItem(LEGACY_COVER_FORM_KEY) || 'null');
    if (legacy && sameName(legacy.members?.[0]?.name, u?.name)) {
      return { draft: legacy, keys: [LEGACY_COVER_FORM_KEY] };
    }
  } catch { /* corrupt / unavailable storage — start fresh */ }
  return null;
}

function clearLocalDrafts(keys) {
  (keys || []).forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
}

/** Any stored shape → a complete, clean form document for user `u`. */
function normalizeForm(raw, u) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const me = { name: u?.name || '', id: getRealStudentId(u) };
  // Member 1 defaults to your own profile name + real student ID.
  const members = Array.isArray(src.members) && src.members.length
    ? src.members.map((mm, i) => {
      const m = { name: String(mm?.name || ''), id: String(mm?.id || '') };
      // Internal account IDs (STU-…, AWID, DEV-…) are never a student ID.
      const isInternal = /^(STU|DEV)-/i.test(m.id) || m.id.includes('AW');
      // Your own row: keep its ID in sync with your profile.
      if (i === 0 && sameName(m.name, me.name) && me.id && m.id !== me.id) return { ...m, id: me.id };
      // Old builds stamped one fixed ID into everyone's first row when their
      // profile had none — drop it for anyone whose profile isn't that ID.
      if (i === 0 && !me.id && m.id === OLD_FALLBACK_ID) return { ...m, id: '' };
      if (isInternal) return { ...m, id: i === 0 ? me.id : '' };
      return m;
    })
    : [me];
  const teachers = Array.isArray(src.teachers) && src.teachers.length
    ? src.teachers.map((t) => ({ name: String(t?.name || ''), designation: String(t?.designation || '') }))
    : [{ name: String(src.courseTeacher || ''), designation: String(src.designation || '') }];
  return {
    coverType: typeof src.coverType === 'string' ? src.coverType : 'Assignment',
    courseCode: String(src.courseCode || ''),
    courseName: String(src.courseName || ''),
    title: String(src.title || ''),
    refNo: String(src.refNo || ''),
    groupNo: String(src.groupNo || ''),
    members,
    teachers,
    watermarkSize: src.watermarkSize || 500,
    watermarkOpacity: src.watermarkOpacity ?? 0.04,
    watermarkX: src.watermarkX ?? 0,
    watermarkY: src.watermarkY ?? 0,
  };
}

// ─── Fit A4 sheet into the preview frame (sized by width so the
//     cover renders at its full page size when the panel is wide enough) ───
function useCoverScale(frameRef) {
  const [coverScale, setCoverScale] = useState(1);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const compute = () => {
      const w = frame.clientWidth;
      if (!w) return;
      const scale = (w - 20) / A4_W;
      setCoverScale(scale > 0 ? Math.min(scale, 1) : 0.1);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [frameRef]);
  return coverScale;
}

// Remount the form whenever the signed-in account changes, so its state
// (and saved draft) always belongs to the current user.
export default function CoverPageGeneratorPage() {
  const { user } = useAuth();
  return <CoverPageGeneratorForm key={user?.id || user?.email || 'guest'} />;
}

function CoverPageGeneratorForm() {
  const { user } = useAuth();
  // Same live config as the admin card and the page gate (keyed by route path).
  const { config, loading: accessLoading } = useRoleAccess('/cover-page-generator');
  const statsAllowed = config.statsAllowed || ['admin', 'moderator'];
  const featureHidden = config.featureHidden || [];
  const accessRole = getAccessRole(user);
  const isStaff = user?.role === 'admin' || user?.role === 'moderator';
  const denied = !accessLoading && !isStaff && featureHidden.includes(accessRole);
  const isAdmin = statsAllowed.includes(accessRole);
  const previewRef = useRef(null);
  const cloneRef = useRef(null);
  const frameRef = useRef(null);
  const menuRef = useRef(null);
  const menuPortalRef = useRef(null);
  const menuButtonRef = useRef(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [logoSrc] = useState(austLogo);
  const coverScale = useCoverScale(frameRef);
  const [coverStats, setCoverStats] = useState({ uniqueUsers: 0, totalPdf: 0, totalPng: 0, lastMonthUsers: 0, todaysNewUsers: 0, avg6Months: 0 });
  const loadCoverStats = async () => {
    try {
      const res = await fetch(isAdmin ? '/api/admin/cover-stats' : '/api/cover-stats', { credentials: 'same-origin' });
      const data = await res.json();
      if (data.success) setCoverStats({ uniqueUsers: data.uniqueUsers, totalPdf: data.totalPdf, totalPng: data.totalPng, lastMonthUsers: data.lastMonthUsers || 0, todaysNewUsers: data.todaysNewUsers || 0, avg6Months: data.avg6Months || 0 });
    } catch {}
  };
  useEffect(() => { if (isAdmin) loadCoverStats(); }, [isAdmin]);
  // Real-time server-connected instant update (SSE + polling fallback) — with reconnect for Safari/Firefox
  useEffect(() => {
    if (!isAdmin) return;
    let es = null;
    let retryTimer = null;
    let closed = false;
    const connectSSE = () => {
      if (closed) return;
      try {
        es = new EventSource('/api/cover-stats/stream');
        es.onmessage = (e) => {
          try {
            const d = JSON.parse(e.data);
            if (typeof d.uniqueUsers === 'number') setCoverStats({ uniqueUsers: d.uniqueUsers, totalPdf: d.totalPdf, totalPng: d.totalPng, lastMonthUsers: d.lastMonthUsers || 0, todaysNewUsers: d.todaysNewUsers || 0, avg6Months: d.avg6Months || 0 });
          } catch {}
        };
        es.onerror = () => {
          try { es.close(); } catch {}
          if (!closed) retryTimer = setTimeout(connectSSE, 3000);
        };
        es.onopen = () => {
          if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
        };
      } catch {
        if (!closed) retryTimer = setTimeout(connectSSE, 3000);
      }
    };
    connectSSE();
    const iv = setInterval(loadCoverStats, 5000);
    const onCoverStats = (e) => {
      const d = e.detail || e;
      if (d && d.type === 'cover-stats' && d.payload) {
        setCoverStats({ uniqueUsers: d.payload.uniqueUsers, totalPdf: d.payload.totalPdf, totalPng: d.payload.totalPng, lastMonthUsers: d.payload.lastMonthUsers || 0, todaysNewUsers: d.payload.todaysNewUsers || 0, avg6Months: d.payload.avg6Months || 0 });
      }
    };
    window.addEventListener('message', onCoverStats);
    // also listen for WS broadcast via custom event if app dispatches
    window.addEventListener('cover-stats', onCoverStats);
    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (es) try { es.close(); } catch {}
      clearInterval(iv);
      window.removeEventListener('message', onCoverStats);
      window.removeEventListener('cover-stats', onCoverStats);
    };
  }, [isAdmin]);
  const trackExport = async (format) => {
    try {
      const res = await fetch('/api/cover-stats/track', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      });
      const data = await res.json();
      if (data.success) setCoverStats({ uniqueUsers: data.uniqueUsers, totalPdf: data.totalPdf, totalPng: data.totalPng, lastMonthUsers: data.lastMonthUsers || 0, todaysNewUsers: data.todaysNewUsers || 0, avg6Months: data.avg6Months || 0 });
      else loadCoverStats();
    } catch {}
  };

  /* Close the portaled ⋮ menu on outside click, including mobile touch. */
  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e) {
      if (menuRef.current?.contains(e.target) || menuPortalRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside, { passive: true });
    document.addEventListener('click', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('click', handleOutside);
    };
  }, [menuOpen]);

  const toggleExportMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const rect = menuButtonRef.current?.getBoundingClientRect();
    if (rect) {
      const menuWidth = Math.min(180, window.innerWidth - 24);
      const menuHeight = 136;
      const left = Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12));
      const below = rect.bottom + 6;
      const top = below + menuHeight <= window.innerHeight - 8
        ? below
        : Math.max(8, rect.top - menuHeight - 6);
      setMenuPosition({ top, left });
    }
    setMenuOpen(true);
  };

  // ─── Form state (server-synced per account) ───
  // First paint comes from liveStore's cached copy of the server document;
  // with none (fresh device / first use) an old browser-only draft is shown
  // and moved to the server once the server confirms it has nothing.
  const [initial] = useState(() => {
    ensureFetched('user', COVER_STORE_KEY);
    const cached = getLiveValue('user', COVER_STORE_KEY, null);
    const local = cached ? null : loadLocalDraft(user);
    return { form: normalizeForm(cached || local?.draft, user), migrate: local };
  });
  const [coverType, setCoverType] = useState(initial.form.coverType);
  const [courseCode, setCourseCode] = useState(initial.form.courseCode);
  const [courseName, setCourseName] = useState(initial.form.courseName);
  const [title, setTitle] = useState(initial.form.title);
  const [teachers, setTeachers] = useState(initial.form.teachers);
  const [refNo, setRefNo] = useState(initial.form.refNo);
  const [groupNo, setGroupNo] = useState(initial.form.groupNo);
  const [members, setMembers] = useState(initial.form.members);

  // Watermark settings (fixed values, previously adjustable)
  const { watermarkSize, watermarkOpacity, watermarkX, watermarkY } = initial.form;

  // Keep the brand mark small and anchored in the cover's bottom-right corner.
  const footerLogoSize = 24;
  const footerLogoX = 0;
  const footerLogoY = 0;

  const formJson = JSON.stringify({
    coverType, courseCode, courseName, title, refNo, groupNo, members, teachers,
    watermarkSize, watermarkOpacity, watermarkX, watermarkY,
  });
  const syncedJsonRef = useRef(JSON.stringify(initial.form)); // what the server has (as far as we know)
  const pendingJsonRef = useRef(null); // local edit not yet sent
  const migrateRef = useRef(initial.migrate);
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const pushForm = useCallback((json) => {
    pendingJsonRef.current = null;
    syncedJsonRef.current = json;
    migrateRef.current = null; // the user's own edit supersedes any old draft
    setLiveValue('user', COVER_STORE_KEY, JSON.parse(json));
  }, []);

  // Save edits to the server, debounced so typing isn't a write per key.
  useEffect(() => {
    if (formJson === syncedJsonRef.current) { pendingJsonRef.current = null; return undefined; }
    pendingJsonRef.current = formJson;
    const t = setTimeout(() => pushForm(formJson), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [formJson, pushForm]);

  // Never drop the last keystrokes: flush on unmount and when the tab closes.
  useEffect(() => {
    const flush = () => { if (pendingJsonRef.current) pushForm(pendingJsonRef.current); };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [pushForm]);

  // Live updates: the server copy arrived (fresh device) or another device
  // changed the form → show it, unless this device is mid-edit.
  const applyRemote = useCallback((remote) => {
    if (!remote) return;
    if (migrateRef.current) { clearLocalDrafts(migrateRef.current.keys); migrateRef.current = null; }
    const next = normalizeForm(remote, userRef.current);
    const json = JSON.stringify(next);
    if (json === syncedJsonRef.current || pendingJsonRef.current) return;
    syncedJsonRef.current = json;
    setCoverType(next.coverType);
    setCourseCode(next.courseCode);
    setCourseName(next.courseName);
    setTitle(next.title);
    setRefNo(next.refNo);
    setGroupNo(next.groupNo);
    setMembers(next.members);
    setTeachers(next.teachers);
  }, []);

  useEffect(() => onLiveChange((composite, isLocal) => {
    if (isLocal || composite !== `user:${COVER_STORE_KEY}`) return;
    applyRemote(getLiveValue('user', COVER_STORE_KEY, null));
  }), [applyRemote]);

  // One-time move of an old browser-only draft to the server — only when the
  // server has no cover form for this account yet.
  useEffect(() => {
    const mig = migrateRef.current;
    if (!mig) return undefined;
    let cancelled = false;
    // Direct request (not userStore.get, which also returns null on errors):
    // migrate only on a confirmed "no value" answer from the server.
    fetch(`/api/store/user/${encodeURIComponent(COVER_STORE_KEY)}`, { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        if (!data?.success) throw new Error('store read failed');
        if (cancelled || !migrateRef.current) return;
        if (data.value == null) {
          const json = JSON.stringify(normalizeForm(mig.draft, userRef.current));
          if (!pendingJsonRef.current) pushForm(json);
          clearLocalDrafts(mig.keys);
          migrateRef.current = null;
        } else {
          applyRemote(data.value); // server copy wins over the old local draft
        }
      })
      .catch(() => { /* offline / server error: keep the local draft, retry next visit */ });
    return () => { cancelled = true; };
  }, [pushForm, applyRemote]);

  // Auto-fill from profile — real student ID (numeric), not AWID
  const studentName = user?.name || '';
  const studentId = getRealStudentId(user);
  const department = user?.department || 'CSE';
  const semNumber = user?.semester || 1;
  const profileYear = Math.ceil(semNumber / 2);
  const profileSemester = ((semNumber % 2) === 0) ? 2 : 1;
  const semester = user?.yearSemester || `Year ${profileYear} - Semester ${profileSemester}`;
  const batch = user?.batch || user?.batchNo || '';
  const section = user?.section || '';
  const labGroup = user?.labSection || '';

  const updateMember = (index, field, value) => {
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const addMember = () => setMembers((prev) => [...prev, { name: '', id: '' }]);

  const removeMember = (index) => setMembers((prev) => prev.filter((_, i) => i !== index));

  const updateTeacher = (index, field, value) => {
    setTeachers((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  };

  const addTeacher = () => setTeachers((prev) => [...prev, { name: '', designation: '' }]);

  const removeTeacher = (index) => setTeachers((prev) => prev.filter((_, i) => i !== index));

  // ─── Course autocomplete ───
  const handleCourseSelect = (course) => {
    if (!course) {
      setCourseCode('');
      setCourseName('');
      return;
    }
    if (course.partialUpdate) {
      if (course.field === 'code' && course.code !== undefined) setCourseCode(course.code);
      if (course.field === 'name' && course.name !== undefined) setCourseName(course.name);
      return;
    }
    setCourseCode(course.code || '');
    setCourseName(course.name || '');
  };

  // ─── Generate cover page ───
  const generateCover = useCallback(async (format) => {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas-pro'), import('jspdf')
    ]);
    const el = previewRef.current;
    if (!el) {
      console.warn('Preview element not found');
      return;
    }
    setGenerating(true);

    try {
      // Clone the element for capture so the live preview stays intact
      const clone = el.cloneNode(true);
      clone.style.cssText = `
        position: fixed; left: -9999px; top: 0;
        display: flex; flex-direction: column;
        width: ${A4_W}px; height: ${A4_H}px;
        background: #ffffff;
        transform: none; zoom: 1;
        z-index: 99999;
      `;
      await rasterizeSvgImages(clone);
      document.body.appendChild(clone);
      cloneRef.current = clone;

      // Wait for webfonts and images to settle before capturing
      if (document.fonts?.ready) {
        try { await document.fonts.ready; } catch { /* best effort */ }
      }
      await new Promise(r => setTimeout(r, 300));

      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
      const safeScale = Math.min(isMobile ? 2 : 3, dpr * 2, 3);
      const canvas = await html2canvas(clone, {
        scale: safeScale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: clone.scrollWidth,
        height: clone.scrollHeight,
      });

      if (format === 'png') {
        const link = document.createElement('a');
        link.download = `Cover_Page_${courseCode || 'Assignment'}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // PDF
        const imgData = canvas.toDataURL('image/png');
        const imgW = 210;
        const imgH = (canvas.height * imgW) / canvas.width;
        const pdf = new jsPDF('p', 'mm', 'a4');
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, 210, 297, 'F');
        pdf.addImage(imgData, 'PNG', 0, 0, imgW, Math.min(imgH, 297));
        pdf.save(`Cover_Page_${courseCode || 'Assignment'}.pdf`);
      }

      document.body.removeChild(clone);
      cloneRef.current = null;

      trackExport(format).catch(()=>{});
      setGenerated(true);
      setTimeout(() => setGenerated(false), 3000);
    } catch (err) {
      console.error('Generation failed:', err);
      try { alert('Failed to generate cover: ' + (err?.message || 'Please try again. If on mobile, close other apps and retry.')); } catch {}
      if (cloneRef.current && document.body.contains(cloneRef.current)) {
        document.body.removeChild(cloneRef.current);
        cloneRef.current = null;
      }
    } finally {
      setGenerating(false);
    }
  }, [courseCode]);

  // Only Course Code * and Title * required — Course Name optional (auto-filled via autocomplete)
  const isFormValid = courseCode.trim() && title.trim();

  /* Reset the form back to profile-defaults — real ID */
  const resetForm = () => {
    setCoverType('Assignment');
    setCourseCode('');
    setCourseName('');
    setTitle('');
    setTeachers([{ name: '', designation: '' }]);
    setRefNo('');
    setGroupNo('');
    setMembers([{ name: studentName, id: studentId }]);
    setMenuOpen(false);
  };

  if (denied) {
    return null;
  }

  const filledMembers = members.filter((m) => (m.name || '').trim() || (m.id || '').trim()).length;
  const statusLabel = generating ? 'Saving…' : generated ? 'Saved' : isFormValid ? 'Ready' : 'Draft';

  const resetAdminStats = async () => {
    if (!confirm('Reset all 6 counters to 0? This starts fresh.')) return;
    try {
      const res = await fetch('/api/admin/cover-stats/reset', { method: 'POST', credentials: 'same-origin' });
      const d = await res.json();
      if (d.success) setCoverStats({ uniqueUsers: 0, totalPdf: 0, totalPng: 0, lastMonthUsers: 0, todaysNewUsers: 0, avg6Months: 0 });
      else loadCoverStats();
    } catch { loadCoverStats(); }
  };

  const adminKpis = [
    { label: 'Unique users', value: coverStats.uniqueUsers, note: 'at least 1 export' },
    { label: 'PDF exports', value: coverStats.totalPdf, note: 'all users' },
    { label: 'PNG exports', value: coverStats.totalPng, note: 'all users' },
    { label: 'Last month users', value: coverStats.lastMonthUsers, note: 'prev month' },
    { label: "Today's new users", value: coverStats.todaysNewUsers, note: 'first time today' },
    { label: 'Avg users / month', value: coverStats.avg6Months, note: 'last 6 months' },
  ];

  return (
    <div className="glass-card-static cpgen-widget animate-fadeInUp">

      {/* ── Masthead (shared dl-head, skill-style §2) ── */}
      <header className={`dl-head${isAdmin ? '' : ' has-actions'}`}>
        <div className="dl-head-title">
          <div className="dl-head-tile" aria-hidden="true">
            <NotebookPen size={20} strokeWidth={2.1} />
          </div>
          <div className="dl-head-text">
            <span className="dl-head-overline">Daily Life</span>
            <h2 className="dl-head-name">Cover Page Generator</h2>
            <span className="dl-head-subtitle">Assignment &amp; lab report cover pages</span>
          </div>
        </div>

        {isAdmin ? (
          <dl className="dl-head-stats">
            <div className="dl-head-stat"><dt>Users</dt><dd>{coverStats.uniqueUsers}</dd></div>
            <div className="dl-head-stat"><dt>PDF</dt><dd>{coverStats.totalPdf}</dd></div>
            <div className="dl-head-stat"><dt>PNG</dt><dd>{coverStats.totalPng}</dd></div>
          </dl>
        ) : (
          <dl className="dl-head-stats">
            <div className="dl-head-stat"><dt>Type</dt><dd className="is-small cpgen-stat-text">{coverType || '—'}</dd></div>
            <div className="dl-head-stat"><dt>Members</dt><dd>{filledMembers}</dd></div>
            <div className="dl-head-stat">
              <dt>Status</dt>
              <dd className="is-small cpgen-stat-status">
                {generating ? <span className="cpgen-spinner" aria-hidden="true" /> : generated ? <Check size={13} aria-hidden="true" /> : null}
                {statusLabel}
              </dd>
            </div>
          </dl>
        )}

        {!isAdmin && (
          <div className="dl-head-actions">
            <div className="cpgen-menu" ref={menuRef}>
              <button
                ref={menuButtonRef}
                type="button"
                className="cpgen-menu-btn"
                onClick={toggleExportMenu}
                title="Options"
                aria-label="Cover page options"
                aria-haspopup="true"
                aria-expanded={menuOpen}
                aria-controls="cpgen-export-menu"
              >
                <MoreVertical size={17} />
              </button>
              {menuOpen && createPortal(
                <div
                  ref={menuPortalRef}
                  id="cpgen-export-menu"
                  className="cpgen-menu-list"
                  role="menu"
                  style={{ top: menuPosition.top, left: menuPosition.left }}
                >
                  <button
                    type="button"
                    className="cpgen-menu-item"
                    onClick={() => { setMenuOpen(false); generateCover('pdf'); }}
                    disabled={!isFormValid || generating}
                    role="menuitem"
                  >
                    <FileDown size={14} /> Download PDF
                  </button>
                  <button
                    type="button"
                    className="cpgen-menu-item"
                    onClick={() => { setMenuOpen(false); generateCover('png'); }}
                    disabled={!isFormValid || generating}
                    role="menuitem"
                  >
                    <Image size={14} /> Download PNG
                  </button>
                  <div className="cpgen-menu-sep" />
                  <button
                    type="button"
                    className="cpgen-menu-item is-danger"
                    onClick={resetForm}
                    role="menuitem"
                  >
                    <RotateCcw size={14} /> Reset form
                  </button>
                </div>,
                document.body
              )}
            </div>
          </div>
        )}
      </header>

      {isAdmin && (
        <section className="cpgen-card cpgen-admin-card">
          <div className="cpgen-card-head-row">
            <h3 className="cpgen-card-title"><Sparkles size={14} /> Export stats</h3>
            <button type="button" className="cpgen-btn cpgen-btn-danger" onClick={resetAdminStats}>
              <RotateCcw size={13} /> Reset
            </button>
          </div>
          <div className="cpgen-kpi-grid">
            {adminKpis.map((k) => (
              <div className="cpgen-kpi" key={k.label}>
                <span className="cpgen-kpi-label">{k.label}</span>
                <span className="cpgen-kpi-value">{k.value}</span>
                <span className="cpgen-kpi-note">{k.note}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!isAdmin && (
        <div className="cpgen-layout">
        {/* ─── Form Panel ─── */}
        <section className="cpgen-card cpgen-form-panel" aria-label="Cover page details">
          <h3 className="cpgen-card-title cpgen-card-title--ruled">
            <FileText size={14} />
            <span>Cover page details</span>
          </h3>

          {/* Cover Type */}
          <div className="cpgen-field">
            <label className="cpgen-label">Cover Type</label>
            <input
              className="input"
              placeholder="e.g. Assignment, Lab Report, Project"
              value={coverType}
              onChange={(e) => setCoverType(e.target.value)}
            />
          </div>

          {/* Course Code */}
          <div className="cpgen-field">
            <label className="cpgen-label">Course Code <span className="cpgen-required">*</span></label>
            <CourseAutocomplete
              value={courseCode}
              placeholder="e.g. CSE 3101"
              type="code"
              department={department}
              showCredit={false}
              onCourseSelect={handleCourseSelect}
            />
          </div>

          <div className="cpgen-field">
            <label className="cpgen-label">Course Name</label>
            <CourseAutocomplete
              value={courseName}
              placeholder="e.g. Software Engineering"
              type="name"
              department={department}
              showCredit={false}
              onCourseSelect={handleCourseSelect}
            />
          </div>

          {/* No. */}
          <div className="cpgen-field">
            <label className="cpgen-label">No.</label>
            <input
              className="input"
              inputMode="numeric"
              placeholder="e.g. 01"
              value={refNo}
              onChange={(e) => setRefNo(e.target.value.replace(/\D/g, ''))}
              onBlur={() => {
                const digits = refNo.replace(/\D/g, '');
                setRefNo(digits.length === 1 ? `0${digits}` : digits);
              }}
            />
          </div>

          {/* Assignment/Report Title */}
          <div className="cpgen-field">
            <label className="cpgen-label">
              Title <span className="cpgen-required">*</span>
            </label>
            <input
              className="input"
              placeholder="e.g. Design Pattern Implementation"
              value={title}
              onChange={(e) => setTitle(capitalizeWords(e.target.value))}
            />
          </div>

          {/* Group No. */}
          <div className="cpgen-field">
            <label className="cpgen-label">Group No.</label>
            <input
              className="input"
              placeholder="e.g. 04"
              value={groupNo}
              onChange={(e) => setGroupNo(e.target.value)}
            />
          </div>

          {/* Group Members */}
          <div className="cpgen-field">
            <div className="cpgen-label-row">
              <label className="cpgen-label">Group Members</label>
              <button type="button" className="cpgen-add-btn" onClick={addMember}>
                <UserPlus size={13} /> Add member
              </button>
            </div>
            <div className="cpgen-members-list">
              {members.map((member, index) => (
                <div className="cpgen-member-row" key={index}>
                  <input
                    className="input cpgen-member-name"
                    placeholder={`Member ${index + 1} name`}
                    value={member.name}
                    onChange={(e) => updateMember(index, 'name', capitalizeWords(e.target.value))}
                  />
                  <input
                    className="input cpgen-member-id"
                    placeholder="Student ID"
                    value={member.id}
                    onChange={(e) => updateMember(index, 'id', e.target.value)}
                  />
                  <button
                    type="button"
                    className="cpgen-member-remove"
                    onClick={() => removeMember(index)}
                    title="Remove member"
                    aria-label={`Remove member ${index + 1}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Course Teacher */}
          <div className="cpgen-field">
            <div className="cpgen-label-row">
              <label className="cpgen-label">Course Teacher</label>
              <button type="button" className="cpgen-add-btn" onClick={addTeacher}>
                <UserPlus size={13} /> Add teacher
              </button>
            </div>
            <div className="cpgen-members-list">
              {teachers.map((teacher, index) => (
                <div className="cpgen-member-row is-teacher" key={index}>
                  <input
                    className="input cpgen-member-name"
                    placeholder={`Teacher ${index + 1} name`}
                    value={teacher.name}
                    onChange={(e) => updateTeacher(index, 'name', capitalizeWords(e.target.value))}
                  />
                  <button
                    type="button"
                    className="cpgen-member-remove"
                    onClick={() => removeTeacher(index)}
                    title="Remove teacher"
                    aria-label={`Remove teacher ${index + 1}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Preview Panel ─── */}
        <section className="cpgen-card cpgen-preview-panel" aria-label="Live preview">
          <div className="cpgen-card-head-row cpgen-card-title--ruled">
            <h3 className="cpgen-card-title">
              <Sparkles size={14} />
              <span>Live preview</span>
            </h3>
            <span className="cpgen-preview-meta">A4 · 210 × 297 mm</span>
          </div>
          <div className="cpgen-preview-frame" ref={frameRef}>
            {isFormValid ? (
              <div
                className="cpgen-cover-viewport"
                style={{ width: `${A4_W * coverScale}px`, height: `${A4_H * coverScale}px` }}
              >
                <div
                  style={{
                    transform: `scale(${coverScale})`,
                    transformOrigin: 'top left',
                    width: `${A4_W}px`,
                    height: `${A4_H}px`,
                  }}
                >
                  <CoverPagePreview
                    ref={previewRef}
                    coverType={coverType}
                    courseCode={courseCode}
                    courseName={courseName}
                    title={title}
                    teachers={teachers}
                    refNo={refNo}
                    labGroup={labGroup}
                    groupNo={groupNo}
                    studentName={studentName}
                    studentId={studentId}
                    members={members}
                    department={department}
                    semester={semester}
                    profileYear={profileYear}
                    profileSemester={profileSemester}
                    batch={batch}
                    section={section}
                    logoSrc={logoSrc}
                    watermarkSize={watermarkSize}
                    watermarkOpacity={watermarkOpacity}
                    watermarkX={watermarkX}
                    watermarkY={watermarkY}
                    footerLogoSize={footerLogoSize}
                    footerLogoX={footerLogoX}
                    footerLogoY={footerLogoY}
                  />
                </div>
              </div>
            ) : (
              <div className="cpgen-empty">
                <span className="cpgen-empty-icon"><NotebookPen size={16} /></span>
                <p className="cpgen-empty-hint">Add a <strong>Course Code</strong> and <strong>Title</strong> to see the cover. Course Name is optional.</p>
              </div>
            )}
          </div>
        </section>
      </div>
      )}

      {/* ─── Profile Info (Read-only) — full-width, below the editor ─── */}
      {!isAdmin && (
        <section className="cpgen-card cpgen-profile-card" aria-label="Your profile">
          <h3 className="cpgen-card-title cpgen-card-title--ruled">
            <User size={14} />
            <span>Your profile</span>
          </h3>
          <dl className="cpgen-profile-grid">
            <div className="cpgen-profile-item">
              <dt className="cpgen-profile-label">Name</dt>
              <dd className="cpgen-profile-value">{studentName || '—'}</dd>
            </div>
            <div className="cpgen-profile-item">
              <dt className="cpgen-profile-label">ID</dt>
              <dd className="cpgen-profile-value">{studentId || '—'}</dd>
            </div>
            <div className="cpgen-profile-item">
              <dt className="cpgen-profile-label">Department</dt>
              <dd className="cpgen-profile-value">{department || '—'}</dd>
            </div>
            <div className="cpgen-profile-item">
              <dt className="cpgen-profile-label">Semester</dt>
              <dd className="cpgen-profile-value">{semester || '—'}</dd>
            </div>
            <div className="cpgen-profile-item">
              <dt className="cpgen-profile-label">Batch</dt>
              <dd className="cpgen-profile-value">{batch || '—'}</dd>
            </div>
            <div className="cpgen-profile-item">
              <dt className="cpgen-profile-label">Section</dt>
              <dd className="cpgen-profile-value">{section || '—'}</dd>
            </div>
            <div className="cpgen-profile-item">
              <dt className="cpgen-profile-label">Lab Group</dt>
              <dd className="cpgen-profile-value">{labGroup || '—'}</dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
}


// ─── Minimal template row (module-scope so it isn't recreated each render) ───
const MinimalRow = ({ label, value }) =>
  value !== undefined && value !== null && String(value).trim() ? (
    <p className="cpgen-min-row">
      <span className="cpgen-min-row-label">{label}:</span>{' '}
      <span className="cpgen-min-row-value">{value}</span>
    </p>
  ) : null;

// ─── Minimal member row — name left, ID aligned in centered column ───
const MinimalMemberRow = ({ index, name, id }) =>
  (name && name.trim()) || (id && id.trim()) ? (
    <p className="cpgen-min-row cpgen-min-member-row">
      <span>
        <span className="cpgen-min-row-label">Member {index + 1}:</span>{' '}
        <span className="cpgen-min-row-value">{name}</span>
      </span>
      <span className="cpgen-min-member-id">
        <span className="cpgen-min-row-label">ID:</span>{' '}
        <span className="cpgen-min-row-value">{id}</span>
      </span>
    </p>
  ) : null;

// ─── Minimal template (black & white, left-accent rows) ───
const MinimalCover = ({
  innerRef,
  coverType,
  courseCode,
  courseName,
  title,
  teachers,
  refNo,
  labGroup,
  groupNo,
  members,
  profileYear,
  profileSemester,
  section,
  logoSrc,
  watermarkSize,
  watermarkOpacity,
  watermarkX,
  watermarkY,
  footerLogoSize,
  footerLogoX,
  footerLogoY,
}) => {
  return (
    <div ref={innerRef} className="cpgen-cover cpgen-cover--minimal">
      {/* Outer black border with margin */}
      <div className="cpgen-min-border" />

      {/* Watermark — AUST logo, centered, low opacity */}
      {logoSrc && (
        <img
          className="cpgen-min-watermark"
          src={logoSrc}
          alt=""
          aria-hidden="true"
          style={{
            width: `${watermarkSize}px`,
            opacity: watermarkOpacity,
            transform: `translate(calc(-50% + ${watermarkX}px), calc(-50% + ${watermarkY}px))`,
          }}
        />
      )}

      {/* Content */}
      <div className="cpgen-min-content">
        {/* Logo + University Name */}
        <div className="cpgen-min-head">
          {logoSrc && (
            <img className="cpgen-min-logo" src={logoSrc} alt="AUST Logo" />
          )}
          <h1 className="cpgen-min-university">
            Ahsanullah University of Science &amp; Technology
          </h1>
        </div>

        {/* Assignment / Course Info */}
        <div className="cpgen-min-group cpgen-min-group-first">
          {refNo && <MinimalRow label={`${coverType} No`} value={refNo} />}
          <MinimalRow label={`${coverType} Title`} value={title} />
          <MinimalRow label="Course No" value={courseCode} />
          <MinimalRow label="Course Title" value={courseName} />
        </div>

        {/* Submitted By */}
        <h2 className="cpgen-min-subhead cpgen-min-subhead--by">Submitted By:</h2>
        <div className="cpgen-min-group">
          {(members || []).map((member, index) => (
            <MinimalMemberRow key={index} index={index} name={member.name} id={member.id} />
          ))}
          <MinimalRow label="Year" value={profileYear} />
          <MinimalRow label="Semester" value={profileSemester} />
          <MinimalRow label="Section" value={section} />
          <MinimalRow label="Lab Group" value={labGroup} />
          <MinimalRow label="Group No" value={groupNo} />
        </div>

        {/* Submitted To */}
        <h2 className="cpgen-min-subhead">Submitted to:</h2>
        <div className="cpgen-min-group">
          {(teachers || []).map((teacher, index) => (
            <div key={index}>
              <MinimalRow label={teachers.length > 1 ? `Teacher ${index + 1} Name` : 'Name'} value={teacher.name} />
            </div>
          ))}
        </div>

        {/* Date */}
        <h2 className="cpgen-min-subhead">
          Date of Submission: <span className="cpgen-min-date">{formatDate(new Date())}</span>
        </h2>
      </div>

      {/* Footer logo — small AUSTWise logo at the bottom */}
      <div className="cpgen-min-footer">
        <img
          className="cpgen-min-footer-logo"
          src={austwiseLogo}
          alt="AUSTWise"
          style={{
            width: `${footerLogoSize}px`,
            transform: `translate(${footerLogoX}px, ${footerLogoY}px)`,
          }}
        />
        <span className="cpgen-min-footer-name">AUSTWise</span>
      </div>
    </div>
  );
};


// ─── Cover Page Preview (forwardRef so parent can capture via ref) ───
const CoverPagePreview = forwardRef((props, ref) => (
  <MinimalCover innerRef={ref} {...props} />
));

CoverPagePreview.displayName = 'CoverPagePreview';
