import { useState, useRef, useCallback, useEffect, forwardRef } from 'react';
import {
  NotebookPen, FileText, Image,
  Check, FileDown, Sparkles, User, X, UserPlus, MoreVertical, RotateCcw,
  Shield, ShieldCheck, ShieldX, Eye, EyeOff, Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import CourseAutocomplete from '../../components/CourseAutocomplete';
import austwiseLogo from '../../assets/austwise-4.svg';
import austLogo from '../../assets/aust-logo.jpg';
import RoleAccessControlCard from '../admin/RoleAccessControlCard';
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

// ─── Cover form persistence (survives page refresh) ───
const COVER_FORM_KEY = 'aust-cover-form-v1';

function loadCoverForm() {
  try {
    const raw = localStorage.getItem(COVER_FORM_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
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

export default function CoverPageGeneratorPage() {
  const { user } = useAuth();
  const STORAGE_KEY = 'aust-role-access-v2:cover';
  const DEFAULT_STATS_ALLOWED = ['admin', 'moderator'];
  const [statsAllowed, setStatsAllowed] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (Array.isArray(p.statsAllowed)) return p.statsAllowed;
      }
    } catch {}
    return DEFAULT_STATS_ALLOWED;
  });
  useEffect(() => {
    const onUpdate = (e) => { if (e.detail?.key === STORAGE_KEY && e.detail?.statsAllowed) setStatsAllowed(e.detail.statsAllowed); };
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try { const p = JSON.parse(e.newValue); if (Array.isArray(p.statsAllowed)) setStatsAllowed(p.statsAllowed); } catch {}
      }
    };
    window.addEventListener('role-access-updated', onUpdate);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('role-access-updated', onUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  const isAdmin = statsAllowed.includes(user?.role);
  const previewRef = useRef(null);
  const cloneRef = useRef(null);
  const frameRef = useRef(null);
  const menuRef = useRef(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
  // Real-time server-connected instant update (SSE + polling fallback)
  useEffect(() => {
    if (!isAdmin) return;
    let es = null;
    try {
      es = new EventSource('/api/cover-stats/stream');
      es.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          if (typeof d.uniqueUsers === 'number') setCoverStats({ uniqueUsers: d.uniqueUsers, totalPdf: d.totalPdf, totalPng: d.totalPng, lastMonthUsers: d.lastMonthUsers || 0, todaysNewUsers: d.todaysNewUsers || 0, avg6Months: d.avg6Months || 0 });
        } catch {}
      };
    } catch {}
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

  /* Close ⋮ dropdown on outside click */
  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  // ─── Form state (persisted to localStorage) ───
  const [savedForm] = useState(() => loadCoverForm());
  const [coverType, setCoverType] = useState(savedForm.coverType || 'Assignment');
  const [courseCode, setCourseCode] = useState(savedForm.courseCode || '');
  const [courseName, setCourseName] = useState(savedForm.courseName || '');
  const [title, setTitle] = useState(savedForm.title || '');
  const [teachers, setTeachers] = useState(() => {
    if (Array.isArray(savedForm.teachers) && savedForm.teachers.length) return savedForm.teachers;
    return [{
      name: savedForm.courseTeacher || '',
      designation: savedForm.designation || '',
    }];
  });
  const [refNo, setRefNo] = useState(savedForm.refNo || '');
  const [groupNo, setGroupNo] = useState(savedForm.groupNo || '');
  const getRealStudentId = (u) => {
    const raw = u?.id || '';
    if (/^\d{8,}$/.test(raw)) return raw;
    const aw = u?.awid || '';
    if (/^\d{8,}$/.test(aw)) return aw;
    const email = u?.email || '';
    const m = String(email).match(/(\d{8,})/);
    if (m) return m[1];
    if (raw && raw.startsWith('STU-')) return '20230204026';
    if (aw && aw.includes('AW')) return '20230204026';
    return raw || aw || '20230204026';
  };
  const [members, setMembers] = useState(() => {
    if (Array.isArray(savedForm.members) && savedForm.members.length) {
      return savedForm.members.map(mm => {
        const id = String(mm?.id || '');
        if (id.startsWith('STU-') || id.includes('AW') || !/^\d{8,}$/.test(id)) {
          return { ...mm, id: getRealStudentId(user) };
        }
        return mm;
      });
    }
    return [{
      name: user?.name || '',
      id: getRealStudentId(user),
    }];
  });
  // Fix persisted wrong IDs (STU-...) on first load
  useEffect(() => {
    if (!user) return;
    const real = getRealStudentId(user);
    const needsFix = members.some(m => String(m.id || '').startsWith('STU-') || String(m.id || '').includes('AW'));
    if (needsFix) {
      setMembers(prev => prev.map(m => {
        const id = String(m.id || '');
        if (id.startsWith('STU-') || id.includes('AW') || !/^\d{8,}$/.test(id)) return { ...m, id: real };
        return m;
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.awid, user?.email]);

  // Watermark settings (fixed values, previously adjustable)
  const watermarkSize = savedForm.watermarkSize || 500;
  const watermarkOpacity = savedForm.watermarkOpacity ?? 0.04;
  const watermarkX = savedForm.watermarkX ?? 0;
  const watermarkY = savedForm.watermarkY ?? 0;

  // Footer logo settings — choto + left e (user request)
  const savedSize = savedForm.footerLogoSize;
  const footerLogoSize = (savedSize && savedSize !== 60 && savedSize !== 80 && savedSize !== 110) ? savedSize : 80;
  const footerLogoX = savedForm.footerLogoX ?? -18;
  const footerLogoY = savedForm.footerLogoY ?? 0;

  // Save form to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(COVER_FORM_KEY, JSON.stringify({
        coverType,
        courseCode,
        courseName,
        title,
        refNo,
        groupNo,
        members,
        teachers,
        watermarkSize,
        watermarkOpacity,
        watermarkX,
        watermarkY,
        footerLogoSize,
        footerLogoX,
        footerLogoY,
      }));
    } catch { /* storage full / unavailable — ignore */ }
  }, [coverType, courseCode, courseName, title, refNo, groupNo, members, teachers, watermarkSize, watermarkOpacity, watermarkX, watermarkY, footerLogoSize, footerLogoX, footerLogoY]);

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

  return (
    <div className="glass-card-static schedule-widget cpgen-widget animate-fadeInUp">

      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <NotebookPen size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Daily Life</span>
            <p className="schedule-title">Cover Page Generator</p>
            <span className="schedule-subtitle">Assignment &amp; lab report cover pages</span>
          </div>
        </div>

        <div className="schedule-masthead-center">
          {generating ? (
            <span className="cpgen-status-badge">
              <span className="cpgen-spinner" /> Generating…
            </span>
          ) : generated ? (
            <span className="cpgen-success-badge">
              <Check size={14} /> Generated!
            </span>
          ) : null}
        </div>

        <div className="schedule-actions">
          {!isAdmin && (
            <div className="export-dropdown" ref={menuRef}>
              <button
                className="schedule-nav-btn"
                onClick={() => setMenuOpen((o) => !o)}
                title="Options"
                aria-haspopup="true"
                aria-expanded={menuOpen}
              >
                <MoreVertical size={18} />
              </button>
              {menuOpen && (
                <div className="export-menu" role="menu">
                  <button
                    className="export-menu-item"
                    onClick={() => { setMenuOpen(false); generateCover('pdf'); }}
                    disabled={!isFormValid || generating}
                    role="menuitem"
                  >
                    <FileDown size={14} /> Download PDF
                  </button>
                  <button
                    className="export-menu-item"
                    onClick={() => { setMenuOpen(false); generateCover('png'); }}
                    disabled={!isFormValid || generating}
                    role="menuitem"
                  >
                    <Image size={14} /> Download PNG
                  </button>
                  <div className="export-menu-sep" />
                  <button
                    className="export-menu-item"
                    onClick={resetForm}
                    role="menuitem"
                  >
                    <RotateCcw size={14} /> Reset Form
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
          <div className="glass-card" style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unique Users</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{coverStats.uniqueUsers}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>at least 1 export</div>
          </div>
          <div className="glass-card" style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total PDF Exports</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-blue)' }}>{coverStats.totalPdf}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>all users</div>
          </div>
          <div className="glass-card" style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total PNG Exports</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-emerald)' }}>{coverStats.totalPng}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>all users</div>
          </div>
          <div className="glass-card" style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Month Users</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-amber)' }}>{coverStats.lastMonthUsers}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>prev month</div>
          </div>
          <div className="glass-card" style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Today's New Users</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-purple)' }}>{coverStats.todaysNewUsers}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>first time today</div>
          </div>
          <div className="glass-card" style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Users / Month (6M)</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-cyan)' }}>{coverStats.avg6Months}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>last 6 months</div>
          </div>
        </div>
      )}
      {isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
          <button
            className="btn btn-rose btn-sm"
            onClick={async () => {
              if (!confirm('Reset all 6 counters to 0? New start hobe.')) return;
              try {
                const res = await fetch('/api/admin/cover-stats/reset', { method: 'POST', credentials: 'same-origin' });
                const d = await res.json();
                if (d.success) setCoverStats({ uniqueUsers: 0, totalPdf: 0, totalPng: 0, lastMonthUsers: 0, todaysNewUsers: 0, avg6Months: 0 });
                else loadCoverStats();
              } catch { loadCoverStats(); }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              borderRadius: '999px',
              padding: '8px 22px',
              background: 'var(--accent-rose)',
              color: 'var(--text-inverse, #fff)',
              border: '1px solid var(--accent-rose)',
              boxShadow: '0 4px 14px var(--accent-rose-glow, rgba(244,63,94,0.25)), 0 1px 3px rgba(0,0,0,0.08)',
              fontWeight: 700,
              fontSize: '12px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'transform 0.15s, boxShadow 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px var(--accent-rose-glow, rgba(244,63,94,0.35))'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px var(--accent-rose-glow, rgba(244,63,94,0.25)), 0 1px 3px rgba(0,0,0,0.08)'; }}
          >
            <RotateCcw size={13} />
            Reset
          </button>
        </div>
      )}
      {isAdmin && <RoleAccessControlCard pageKey="cover" />}

      {!isAdmin && (
        <div className="cpgen-layout">
        {/* ─── Form Panel ─── */}
        <div className="cpgen-form-panel">
          <div className="cpgen-form-header">
            <FileText size={18} />
            <span>Cover Page Details</span>
          </div>

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

          {/* No. — Title er age */}
          <div className="cpgen-field">
            <label className="cpgen-label">No.</label>
            <input
              className="input"
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

          {/* Group No. — upore */}
          <div className="cpgen-field">
            <label className="cpgen-label">Group No.</label>
            <input
              className="input"
              placeholder="e.g. 04"
              value={groupNo}
              onChange={(e) => setGroupNo(e.target.value)}
            />
          </div>

          {/* Group Members — Add Member upore, Course Teacher er age */}
          <div className="cpgen-field">
            <label className="cpgen-label">Group Members</label>
            <div className="cpgen-members-list">
              {members.map((member, index) => (
                <div className="cpgen-member-row" key={index}>
                  <input
                    className="input"
                    placeholder={`Member ${index + 1} name`}
                    value={member.name}
                    onChange={(e) => updateMember(index, 'name', capitalizeWords(e.target.value))}
                  />
                  <input
                    className="input"
                    placeholder="Student ID"
                    value={member.id}
                    onChange={(e) => updateMember(index, 'id', e.target.value)}
                  />
                  <button
                    type="button"
                    className="cpgen-member-remove"
                    onClick={() => removeMember(index)}
                    title="Remove member"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="cpgen-add-member" onClick={addMember}>
              <UserPlus size={13} /> Add Member
            </button>
          </div>

          {/* Course Teacher — last e */}
          <div className="cpgen-field">
            <label className="cpgen-label">Course Teacher</label>
            <div className="cpgen-members-list">
              {teachers.map((teacher, index) => (
                <div className="cpgen-member-row" key={index} style={{ gridTemplateColumns: '1fr auto' }}>
                  <input
                    className="input"
                    placeholder={`Teacher ${index + 1} name`}
                    value={teacher.name}
                    onChange={(e) => updateTeacher(index, 'name', capitalizeWords(e.target.value))}
                  />
                  <button
                    type="button"
                    className="cpgen-member-remove"
                    onClick={() => removeTeacher(index)}
                    title="Remove teacher"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="cpgen-add-member" onClick={addTeacher}>
              <UserPlus size={13} /> Add Teacher
            </button>
          </div>
        </div>

        {/* ─── Preview Panel ─── */}
        <div className="cpgen-preview-panel">
          <div className="cpgen-preview-header">
            <Sparkles size={16} />
            <span>Live Preview</span>
          </div>
          <div className="cpgen-preview-frame" ref={frameRef}>
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
            {!isFormValid && (
              <div className="cpgen-preview-placeholder">
                <NotebookPen size={40} strokeWidth={1.2} />
                <p>Fill in the course code and title to see your cover page preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* ─── Profile Info (Read-only) — full-width, below the editor ─── */}
      {!isAdmin && (
        <div className="cpgen-profile-card">
        <div className="cpgen-profile-header">
          <User size={14} />
          <span>Your Profile</span>
        </div>
        <div className="cpgen-profile-grid">
          <div className="cpgen-profile-item">
            <span className="cpgen-profile-label">Name</span>
            <span className="cpgen-profile-value">{studentName || '—'}</span>
          </div>
          <div className="cpgen-profile-item">
            <span className="cpgen-profile-label">ID</span>
            <span className="cpgen-profile-value">{studentId || '—'}</span>
          </div>
          <div className="cpgen-profile-item">
            <span className="cpgen-profile-label">Department</span>
            <span className="cpgen-profile-value">{department || '—'}</span>
          </div>
          <div className="cpgen-profile-item">
            <span className="cpgen-profile-label">Semester</span>
            <span className="cpgen-profile-value">{semester || '—'}</span>
          </div>
          <div className="cpgen-profile-item">
            <span className="cpgen-profile-label">Batch</span>
            <span className="cpgen-profile-value">{batch || '—'}</span>
          </div>
          <div className="cpgen-profile-item">
            <span className="cpgen-profile-label">Section</span>
            <span className="cpgen-profile-value">{section || '—'}</span>
          </div>
          <div className="cpgen-profile-item cpgen-profile-item--wide">
            <span className="cpgen-profile-label">Lab Group</span>
            <span className="cpgen-profile-value">{labGroup || '—'}</span>
          </div>
        </div>
      </div>
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
      </div>
    </div>
  );
};


// ─── Cover Page Preview (forwardRef so parent can capture via ref) ───
const CoverPagePreview = forwardRef((props, ref) => (
  <MinimalCover innerRef={ref} {...props} />
));

CoverPagePreview.displayName = 'CoverPagePreview';
