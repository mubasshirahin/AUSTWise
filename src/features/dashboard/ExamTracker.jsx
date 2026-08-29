import { useState, useMemo } from 'react';
import { useRoutine } from '../../context/RoutineContext';
import { useAuth } from '../../context/AuthContext';
import { useLiveValue } from '../../utils/liveStore';
import { BookOpen, PenLine, X, Check } from 'lucide-react';
import ExamFlowTracker from './ExamFlowTracker';
import './ExamTracker.css';

const STORAGE_KEY = 'aust-exam-tracker';
const SHARED_PREFIX = 'aust-exam-schedule:';
const EDITOR_ROLES = ['admin', 'moderator', 'cr', 'sr'];

/* One shared schedule per section slot — the same key the server and
   RoutineSharingStatus use to group a CR with their students. */
export const examSlotKeyOf = (u) => `${u?.department || ''}|${u?.yearSemester || ''}|${u?.section || ''}|${u?.labSection || ''}`;

const EXAM_SLOTS = [
  { key: 'quiz1', label: 'Quiz 1', color: 'var(--accent-blue)', glow: 'var(--accent-blue-glow)' },
  { key: 'quiz2', label: 'Quiz 2', color: 'var(--accent-orange)', glow: 'var(--accent-orange-glow)' },
  { key: 'quiz3', label: 'Quiz 3', color: 'var(--accent-purple)', glow: 'var(--accent-purple-glow)' },
  { key: 'quiz4', label: 'Quiz 4', color: 'var(--accent-emerald)', glow: 'var(--accent-emerald-glow)' },
  { key: 'mid', label: 'Mid', color: 'var(--accent-amber)', glow: 'var(--accent-amber-glow)' },
  { key: 'final', label: 'Final', color: 'var(--accent-rose)', glow: 'var(--accent-rose-glow)' },
];

function getSlotState(dateStr) {
  if (!dateStr) return { label: '\u2014', cls: 'neutral' };
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: 'Passed', cls: 'passed' };
  if (diff === 0) return { label: 'Today', cls: 'today' };
  if (diff <= 3) return { label: `${diff}d`, cls: 'urgent' };
  if (diff <= 7) return { label: `${diff}d`, cls: 'soon' };
  return { label: `${diff}d`, cls: 'normal' };
}

function formatDate(dateStr) {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ExamTracker() {
  const { routine } = useRoutine();
  const { user } = useAuth();
  const [exams, setExams] = useLiveValue('shared', `${SHARED_PREFIX}${examSlotKeyOf(user)}`, {});
  const [legacyExams] = useLiveValue('user', STORAGE_KEY, {});
  const [detailModal, setDetailModal] = useState(null); // { slotKey, slotLabel, date, syllabus, courseCode, courseName, isEditing, editDate, editSyllabus }

  const isAdminView = user?.role === 'admin' || user?.role === 'moderator';
  const canEdit = EDITOR_ROLES.includes(user?.role);

  /* Everyone reads the shared section schedule. Until an editor saves the
     first shared copy, fall back to this account's legacy personal data so
     nothing that existed before sharing appears lost. */
  const examData = useMemo(() => {
    const hasShared = exams && Object.keys(exams).some((k) => k !== '_meta' && exams[k] && typeof exams[k] === 'object');
    return hasShared ? exams : (legacyExams || {});
  }, [exams, legacyExams]);

  const theoryCourses = useMemo(() => {
    const courses = []; const seen = new Set();
    Object.values(routine || {}).forEach((dayClasses) => {
      (dayClasses || []).forEach((cls) => {
        if (cls.type === 'Theory' && cls.course && !seen.has(cls.course)) {
          seen.add(cls.course);
          courses.push({ code: cls.course, name: cls.name || cls.course, color: cls.color || 'var(--accent-blue)' });
        }
      });
    });
    return courses;
  }, [routine]);

  const fmtSem = (s) => {
    const m = (s || '').match(/Year\s*(\d+)\s*-\s*Semester\s*(\d+)/i);
    if (!m) return s;
    const ord = +m[1] === 1 ? '1st' : +m[1] === 2 ? '2nd' : +m[1] === 3 ? '3rd' : `${m[1]}th`;
    return `${ord} Year, ${m[2]} Sem`;
  };

  const totalScheduled = useMemo(() => {
    return theoryCourses.reduce((sum, course) => {
      const exams = examData[course.code] || {};
      return sum + Object.keys(exams).filter((k) => {
        const v = exams[k];
        return v?.date && getSlotState(v.date).cls !== 'passed';
      }).length;
    }, 0);
  }, [theoryCourses, examData]);

  const openDetails = (slotKey, slotLabel, date, syllabus, courseCode, courseName) => {
    setDetailModal({ slotKey, slotLabel, date, syllabus, courseCode, courseName, isEditing: false, editDate: date || '', editSyllabus: syllabus || '' });
  };

  const handleSaveSingleSlot = () => {
    if (!detailModal) return;
    const { courseCode, slotKey, editDate, editSyllabus } = detailModal;
    const updated = { ...examData };
    if (!updated[courseCode]) updated[courseCode] = {};
    updated[courseCode][slotKey] = {
      date: editDate || '',
      syllabus: editSyllabus || ''
    };
    updated._meta = {
      updatedBy: user?.name || user?.awid || 'Unknown',
      role: user?.role || '',
      updatedAt: new Date().toISOString(),
    };
    setExams(updated);
    setDetailModal(null);
  };

  /* Shared course-cell renderer — used identically for every course cell. */
  const renderCourseCell = (course) => {
    const courseExams = examData[course.code] || {};
    const slots = EXAM_SLOTS.map((slot) => ({ ...slot, data: courseExams[slot.key] }));
    const scheduled = slots.filter((s) => s.data?.date);
    const hasToday = slots.some((s) => s.data?.date && getSlotState(s.data.date).cls === 'today');

    return (
      <div
        key={course.code}
        className={[
          'schedule-day-card',
          'exam-cell',
          hasToday ? 'today' : '',
        ].filter(Boolean).join(' ')}
      >
        <div className="schedule-day-top">
          <div className="schedule-day-num-wrap">
            <div className="exam-cell-code">{course.code}</div>
          </div>
          <div className="schedule-day-badges">
            {scheduled.length > 0 && (
              <span className="schedule-day-count">{scheduled.length}</span>
            )}
          </div>
        </div>
        <div className="exam-cell-name">{course.name}</div>
        <div className="schedule-task-list">
          {slots.map((slot) => {
            const state = getSlotState(slot.data?.date);
            const handleClick = () => openDetails(slot.key, slot.label, slot.data?.date, slot.data?.syllabus, course.code, course.name);
            return (
              <div
                key={slot.key}
                className="schedule-task-item exam-slot-item"
                onClick={handleClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
              >
                <span className="exam-slot-name" style={{ color: 'var(--text-primary)' }}>{slot.label}</span>
                <span className="exam-slot-date">{formatDate(slot.data?.date)}</span>
                {slot.data?.date && <span className={`exam-slot-state ${state.cls}`}>{state.label}</span>}
              </div>
            );
          })}
          {scheduled.length === 0 && <div className="schedule-empty">No exams scheduled</div>}
        </div>
      </div>
    );
  };

  return (
    <div className="glass-card-static schedule-widget exam-widget animate-fadeInUp">
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <BookOpen size={20} />
          </div>
          <div>
            <span className="schedule-overline">Dashboard</span>
            <p className="schedule-title">Zero Hour</p>
            <span className="schedule-subtitle">
              {user?.department || 'AUST'}
              {user?.yearSemester ? ` · ${fmtSem(user.yearSemester)}` : ''}
              {user?.section ? ` · Section ${user.section}` : ''}
              {user?.labSection ? ` · Lab ${user.labSection}` : ''}
            </span>
            <span className={`exam-access-badge ${canEdit ? 'editor' : 'viewer'}`}>
              {canEdit ? <PenLine size={10} /> : <BookOpen size={10} />}
              {canEdit ? 'Editor · updates visible to your section' : 'View only · updated by your CR'}
            </span>
          </div>
        </div>
        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="schedule-stat-value">{theoryCourses.length}</span>
              <span className="schedule-stat-label">courses</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">{totalScheduled}</span>
              <span className="schedule-stat-label">scheduled</span>
            </div>
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {exams?._meta?.updatedAt && (
        <p className="exam-updated-meta">
          Last updated by <strong>{exams._meta.updatedBy}</strong>
          {exams._meta.role ? ` (${exams._meta.role.toUpperCase()})` : ''}
          {' · '}
          {new Date(exams._meta.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </p>
      )}

      {theoryCourses.length === 0 ? (
        <div className="exam-empty">
          <BookOpen size={24} style={{ opacity: 0.3 }} />
          <p>No theory courses found</p>
          <span>Add theory courses to your routine first</span>
        </div>
      ) : (
        <div className="exam-grid">
          {theoryCourses.map(renderCourseCell)}
        </div>
      )}

      {isAdminView && <ExamFlowTracker user={user} canEdit={canEdit} />}

      {/* ─── Detail Overlay ─── */}
      {detailModal && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)}>
          <div className="modal glass-card-static" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '90%', padding: '24px', margin: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-blue)', fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{detailModal.slotLabel}</span>
                <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', margin: '4px 0 0' }}>{detailModal.courseCode}</h3>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: '2px 0 0' }}>{detailModal.courseName}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {canEdit && !detailModal.isEditing && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setDetailModal(prev => ({ ...prev, isEditing: true }))}
                  >
                    <PenLine size={12} /> Edit
                  </button>
                )}
                {canEdit && detailModal.isEditing && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveSingleSlot}
                  >
                    <Check size={13} /> Done
                  </button>
                )}
                <button className="btn btn-ghost btn-icon" onClick={() => setDetailModal(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {detailModal.isEditing ? (
              <>
                <div style={{ marginBottom: '14px' }}>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date</span>
                  <input
                    type="date"
                    value={detailModal.editDate || ''}
                    onChange={(e) => setDetailModal(prev => ({ ...prev, editDate: e.target.value }))}
                    style={{
                      width: '100%', height: '38px', padding: '6px 12px', fontSize: 'var(--fs-sm)',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)',
                      background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Syllabus</span>
                  <textarea
                    value={detailModal.editSyllabus || ''}
                    onChange={(e) => setDetailModal(prev => ({ ...prev, editSyllabus: e.target.value }))}
                    placeholder="Syllabus topics, chapters, page numbers..."
                    rows={6}
                    style={{
                      width: '100%', padding: '10px 12px', fontSize: 'var(--fs-sm)', lineHeight: '1.6',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)',
                      background: 'var(--bg-input)', color: 'var(--text-primary)', resize: 'vertical',
                      fontFamily: 'inherit', outline: 'none'
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: '16px' }}>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>Date</span>
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>{formatDate(detailModal.date)}</span>
                </div>
                {detailModal.syllabus ? (
                  <div>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Syllabus</span>
                    <div style={{ fontSize: 'var(--fs-base)', lineHeight: '1.7', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                      {detailModal.syllabus}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
                    No syllabus added yet
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
