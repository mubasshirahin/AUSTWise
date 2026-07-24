import { useState, useRef, useCallback, forwardRef } from 'react';
import {
  NotebookPen, FileText, Image,
  Check, FileDown, Sparkles, User,
  CalendarDays
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { findCourseByCode } from '../../data/courses';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import './CoverPageGeneratorPage.css';
import '../../components/PageHero.css';

const COVER_TYPES = [
  { id: 'assignment', label: 'Assignment' },
  { id: 'lab-report', label: 'Lab Report' },
  { id: 'project', label: 'Project' },
];

function formatDate(date) {
  const d = new Date(date);
  const months = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function CoverPageGeneratorPage() {
  const { user } = useAuth();
  const previewRef = useRef(null);
  const cloneRef = useRef(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  // ─── Form state ───
  const [coverType, setCoverType] = useState('assignment');
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [title, setTitle] = useState('');
  const [courseTeacher, setCourseTeacher] = useState('');

  // Auto-fill from profile
  const studentName = user?.name || '';
  const studentId = user?.awid || user?.id || '';
  const department = user?.department || 'CSE';
  const semester = user?.yearSemester || `Year ${Math.ceil((user?.semester || 1) / 2)} - Semester ${((user?.semester || 1) % 2 === 0) ? 2 : 1}`;
  const batch = user?.batch || user?.batchNo || '';
  const section = user?.section || '';

  // ─── Course autocomplete ───
  const handleCourseCodeChange = (value) => {
    setCourseCode(value);
    const found = findCourseByCode(value, department);
    if (found) {
      setCourseName(found.name || '');
    }
  };

  // ─── Generate cover page ───
  const generateCover = useCallback(async (format) => {
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
        width: 210mm; min-height: 297mm;
        background: #ffffff; color: #1a1a2e;
        font-family: 'Times New Roman', 'Inter', serif;
        z-index: 99999;
      `;
      document.body.appendChild(clone);
      cloneRef.current = clone;

      // Wait for rendering
      await new Promise(r => setTimeout(r, 150));

      const canvas = await html2canvas(clone, {
        scale: 3,
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

      setGenerated(true);
      setTimeout(() => setGenerated(false), 3000);
    } catch (err) {
      console.error('Generation failed:', err);
      if (cloneRef.current && document.body.contains(cloneRef.current)) {
        document.body.removeChild(cloneRef.current);
        cloneRef.current = null;
      }
    } finally {
      setGenerating(false);
    }
  }, [courseCode, title]);

  const isFormValid = courseCode.trim() && title.trim();

  return (
    <div className="cpgen-page animate-fadeIn">
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <NotebookPen size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">Cover Page Generator</span>
              </h1>
              <p className="page-hero-subtitle">
                Generate professional assignment and lab report cover pages — auto-filled from your profile.
              </p>
            </div>
          </div>
        </div>
      </header>

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
            <div className="cpgen-type-tabs">
              {COVER_TYPES.map(t => (
                <button
                  key={t.id}
                  className={`cpgen-type-tab ${coverType === t.id ? 'active' : ''}`}
                  onClick={() => setCoverType(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Course Code */}
          <div className="cpgen-field">
            <label className="cpgen-label">Course Code <span className="cpgen-required">*</span></label>
            <input
              className="input"
              placeholder="e.g. CSE 3101"
              value={courseCode}
              onChange={(e) => handleCourseCodeChange(e.target.value.toUpperCase())}
            />
          </div>

          <div className="cpgen-field">
            <label className="cpgen-label">Course Name</label>
            <input
              className="input"
              placeholder="e.g. Software Engineering"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
            />
          </div>

          {/* Assignment/Report Title */}
          <div className="cpgen-field">
            <label className="cpgen-label">
              {coverType === 'assignment' ? 'Assignment' : coverType === 'lab-report' ? 'Lab Report' : 'Project'} Title <span className="cpgen-required">*</span>
            </label>
            <input
              className="input"
              placeholder="e.g. Design Pattern Implementation"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Course Teacher */}
          <div className="cpgen-field">
            <label className="cpgen-label">Course Teacher</label>
            <input
              className="input"
              placeholder="e.g. Dr. Abdur Rahim"
              value={courseTeacher}
              onChange={(e) => setCourseTeacher(e.target.value)}
            />
          </div>

          {/* ─── Profile Info (Read-only) ─── */}
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
            </div>
          </div>

          {/* Generate Buttons */}
          <div className="cpgen-actions">
            <button
              className="btn btn-primary cpgen-btn"
              disabled={!isFormValid || generating}
              onClick={() => generateCover('pdf')}
            >
              {generating ? (
                <span className="cpgen-spinner" />
              ) : (
                <FileDown size={16} />
              )}
              {generating ? 'Generating...' : 'Download PDF'}
            </button>
            <button
              className="btn btn-secondary cpgen-btn"
              disabled={!isFormValid || generating}
              onClick={() => generateCover('png')}
            >
              <Image size={16} />
              Download PNG
            </button>
            {generated && (
              <div className="cpgen-success-badge">
                <Check size={14} /> Generated successfully!
              </div>
            )}
          </div>
        </div>

        {/* ─── Preview Panel ─── */}
        <div className="cpgen-preview-panel">
          <div className="cpgen-preview-header">
            <Sparkles size={16} />
            <span>Live Preview</span>
          </div>
          <div className="cpgen-preview-frame">
            <CoverPagePreview
              ref={previewRef}
              coverType={coverType}
              courseCode={courseCode}
              courseName={courseName}
              title={title}
              courseTeacher={courseTeacher}
              studentName={studentName}
              studentId={studentId}
              department={department}
              semester={semester}
              batch={batch}
              section={section}
            />
            {!isFormValid && (
              <div className="cpgen-preview-placeholder">
                <NotebookPen size={40} strokeWidth={1.2} />
                <p>Fill in the course code and title to see your cover page preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Cover Page Preview (forwardRef so parent can capture via ref) ───
const CoverPagePreview = forwardRef(({
  coverType,
  courseCode,
  courseName,
  title,
  courseTeacher,
  studentName,
  studentId,
  department,
  semester,
  batch,
  section,
}, ref) => {
  const typeLabel = coverType === 'assignment' ? 'Assignment'
    : coverType === 'lab-report' ? 'Lab Report'
    : 'Project Report';

  return (
    <div ref={ref} className="cpgen-cover">
      {/* Decorative top bar */}
      <div className="cpgen-cover-topbar" />

      {/* University header */}
      <div className="cpgen-cover-header">
        <div className="cpgen-cover-logo">
          <svg viewBox="0 0 40 40" fill="none" width="44" height="44">
            <rect width="40" height="40" rx="8" fill="#1a365d" />
            <text x="20" y="26" textAnchor="middle" fill="#fbbf24" fontSize="18" fontWeight="bold" fontFamily="serif">A</text>
          </svg>
        </div>
        <div className="cpgen-cover-title-group">
          <h1 className="cpgen-cover-university">Ahsanullah University of Science and Technology</h1>
          <p className="cpgen-cover-dept">Department of {department}</p>
        </div>
      </div>

      {/* Divider */}
      <div className="cpgen-cover-divider" />

      {/* Type badge */}
      <div className="cpgen-cover-type-badge">{typeLabel} Cover</div>

      {/* Course info */}
      <div className="cpgen-cover-course">
        {courseCode && <span className="cpgen-cover-course-code">{courseCode}</span>}
        {courseName && <span className="cpgen-cover-course-name">{courseName}</span>}
      </div>

      {/* Title */}
      <div className="cpgen-cover-title-area">
        <h2 className="cpgen-cover-title">{title || 'Your Title Here'}</h2>
      </div>

      {/* Info table */}
      <table className="cpgen-cover-table">
        <tbody>
          {courseTeacher && (
            <tr>
              <td className="cpgen-cover-td-label">Submitted To</td>
              <td className="cpgen-cover-td-value">{courseTeacher}</td>
            </tr>
          )}
          <tr>
            <td className="cpgen-cover-td-label">Submitted By</td>
            <td className="cpgen-cover-td-value">{studentName || 'Your Name'}</td>
          </tr>
          {studentId && (
            <tr>
              <td className="cpgen-cover-td-label">Student ID</td>
              <td className="cpgen-cover-td-value">{studentId}</td>
            </tr>
          )}
          <tr>
            <td className="cpgen-cover-td-label">Department</td>
            <td className="cpgen-cover-td-value">{department}</td>
          </tr>
          <tr>
            <td className="cpgen-cover-td-label">Semester</td>
            <td className="cpgen-cover-td-value">{semester}</td>
          </tr>
          {batch && (
            <tr>
              <td className="cpgen-cover-td-label">Batch</td>
              <td className="cpgen-cover-td-value">{batch}</td>
            </tr>
          )}
          {section && (
            <tr>
              <td className="cpgen-cover-td-label">Section</td>
              <td className="cpgen-cover-td-value">{section}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Date */}
      <div className="cpgen-cover-date">
        <CalendarDays size={14} />
        <span>{formatDate(new Date())}</span>
      </div>

      {/* Decorative bottom bar */}
      <div className="cpgen-cover-bottombar" />
    </div>
  );
});

CoverPagePreview.displayName = 'CoverPagePreview';
