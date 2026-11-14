import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useRoutine } from '../../context/RoutineContext';
import { useAuth } from '../../context/AuthContext';
import { useLiveValue } from '../../utils/liveStore';
import { isZeroHourReady } from '../../utils/profileCompleteness';
import { BookOpen, PenLine, X, Check, Users, User } from 'lucide-react';
import ExamFlowTracker from './ExamFlowTracker';
import './ExamTracker.css';

const SHARED_PREFIX = 'aust-exam-schedule:';
const PERSONAL_STORAGE_KEY = 'aust-exam-tracker';

/* One shared schedule per section slot — the same key the server and
   RoutineSharingStatus use to group a CR with their students. */
export const examSlotKeyOf = (u) => {
  if (!u?.department || !u?.yearSemester || !u?.section || !u?.labSection) return null;
  return `${u.department}|${u.yearSemester}|${u.section}|${u.labSection}`;
};

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
  // TZ-safe parse YYYY-MM-DD as local midnight
  const target = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00'); target.setHours(0, 0, 0, 0);
  if (isNaN(target.getTime())) return { label: '\u2014', cls: 'neutral' };
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: 'Passed', cls: 'passed' };
  if (diff === 0) return { label: 'Today', cls: 'today' };
  if (diff <= 3) return { label: `${diff}d`, cls: 'urgent' };
  if (diff <= 7) return { label: `${diff}d`, cls: 'soon' };
  return { label: `${diff}d`, cls: 'normal' };
}

function formatDate(dateStr) {
  if (!dateStr) return '\u2014';
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '\u2014';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ExamTracker() {
  const { routine } = useRoutine();
  const { user } = useAuth();
  const slotKey = examSlotKeyOf(user);
  const sharedKey = slotKey ? `${SHARED_PREFIX}${slotKey}` : null;
  const [exams, setExams] = useLiveValue('shared', sharedKey, {});
  const [personalExams, setPersonalExams] = useLiveValue('user', PERSONAL_STORAGE_KEY, {});
  const [detailModal, setDetailModal] = useState(null); // { slotKey, slotLabel, date, syllabus, courseCode, courseName, courseSource, isEditing, editDate, editSyllabus }

  const isAdminView = user?.role === 'admin' || user?.role === 'moderator';
  const hasCrRole = user?.hasRole ? user.hasRole('cr') : user?.role === 'cr';
  const canEditShared = isZeroHourReady(user) && hasCrRole;

  const profileIncomplete = !isZeroHourReady(user);

  // ── CR shared routine (for the 25 students under this labSection) ──
  const [sharedRoutine, setSharedRoutine] = useState(null);
  const [sharedRoutineMeta, setSharedRoutineMeta] = useState(null); // {crName, updatedAt}
  const [labCrName, setLabCrName] = useState('');

  useEffect(() => {
    if (!slotKey) { setLabCrName(''); return; }
    let cancelled = false;
    fetch('/api/zero-hour/cr', { credentials: 'same-origin' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (!cancelled) setLabCrName(data?.cr?.name || ''); })
      .catch(() => { if (!cancelled) setLabCrName(''); });
    return () => { cancelled = true; };
  }, [slotKey]);

  useEffect(() => {
    if (!slotKey) { setSharedRoutine(null); setSharedRoutineMeta(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/routines/shared', { credentials: 'same-origin' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const list = Array.isArray(data.routines) ? data.routines : [];
        const mine = list.find((r) => `${r.department || ''}|${r.yearSemester || ''}|${r.section || ''}|${r.labSection || ''}` === slotKey);
        if (mine) {
          let parsed = mine.routine;
          if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch { parsed = {}; }
          }
          setSharedRoutine(parsed && typeof parsed === 'object' ? parsed : null);
          setSharedRoutineMeta({ crName: mine.crName || '', updatedAt: mine.updatedAt || mine.createdAt || '' });
        } else {
          setSharedRoutine(null);
          setSharedRoutineMeta(null);
        }
      } catch {
        if (!cancelled) { setSharedRoutine(null); setSharedRoutineMeta(null); }
      }
    })();
    return () => { cancelled = true; };
  }, [slotKey]);

  // Keep CR-published exam data separate from each user's own manually added
  // course data. A CR course always resolves to the shared schedule below.
  const sharedExamData = exams && typeof exams === 'object' ? exams : {};

  // Merged Theory courses: personal + CR shared routine
  // Duplicate courseCode => only CR wins, personal is discarded (per requirement)
  const mergedCourses = useMemo(() => {
    const map = new Map(); // code -> {code, name, color, source, crName}
    const addFrom = (srcRoutine, source) => {
      if (!srcRoutine || typeof srcRoutine !== 'object') return;
      Object.values(srcRoutine).forEach((dayClasses) => {
        (dayClasses || []).forEach((cls) => {
          if (cls.type !== 'Theory' || !cls.course) return;
          const existing = map.get(cls.course);
          if (!existing) {
            map.set(cls.course, {
              code: cls.course,
              name: cls.name || cls.course,
              color: cls.color || 'var(--accent-blue)',
              source,
              crName: labCrName || sharedRoutineMeta?.crName || '',
            });
          } else if (source === 'cr' && existing.source === 'personal') {
            // Duplicate: CR authoritative — discard personal, keep only CR
            map.set(cls.course, {
              code: cls.course,
              name: cls.name || existing.name,
              color: cls.color || existing.color,
              source: 'cr',
              crName: labCrName || sharedRoutineMeta?.crName || '',
            });
          }
          // else: duplicate already cr or personal duplicate — keep first, ignore
        });
      });
    };
    addFrom(routine, 'personal');
    if (sharedRoutine) addFrom(sharedRoutine, 'cr');
    return [...map.values()];
  }, [routine, sharedRoutine, sharedRoutineMeta, labCrName]);

  // Keep theoryCourses alias for stats that previously used it (now merged)
  const theoryCourses = mergedCourses;

  const fmtSem = (s) => {
    const value = String(s || '').trim();
    const full = value.match(/Year\s*(\d+)\s*-\s*Semester\s*(\d+)/i);
    const compact = value.match(/^(\d+)\s*[./-]\s*(\d+)$/);
    const match = full || compact;
    return match ? `Y${match[1]}/S${match[2]}` : value;
  };

  // Every course shown in Zero Hour uses the shared CR schedule.
  const getExamDataForCourse = (course) => {
    return course.source === 'personal'
      ? (personalExams?.[course.code] || {})
      : (sharedExamData?.[course.code] || {});
  };

  const totalScheduled = useMemo(() => {
    return theoryCourses.reduce((sum, course) => {
      const raw = course.source === 'personal'
        ? (personalExams?.[course.code] || {})
        : (sharedExamData?.[course.code] || {});
      return sum + Object.keys(raw).filter((k) => {
        const v = raw[k];
        return v?.date && getSlotState(v.date).cls !== 'passed';
      }).length;
    }, 0);
  }, [theoryCourses, sharedExamData, personalExams]);

  // Days until the nearest upcoming exam (masthead "Next" stat).
  const nextExamLabel = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let best = Infinity;
    theoryCourses.forEach((course) => {
      const raw = course.source === 'personal'
        ? (personalExams?.[course.code] || {})
        : (sharedExamData?.[course.code] || {});
      Object.values(raw).forEach((v) => {
        if (!v?.date) return;
        const t = new Date(v.date.includes('T') ? v.date : `${v.date}T00:00:00`);
        t.setHours(0, 0, 0, 0);
        const diff = Math.round((t - today) / 86400000);
        if (diff >= 0 && diff < best) best = diff;
      });
    });
    if (!Number.isFinite(best)) return '—';
    return best === 0 ? 'Today' : `${best}d`;
  }, [theoryCourses, sharedExamData, personalExams]);

  const openDetails =(slotKey, slotLabel, date, syllabus, courseCode, courseName, courseSource) => {
    setDetailModal({ slotKey, slotLabel, date, syllabus, courseCode, courseName, courseSource, isEditing: false, editDate: date || '', editSyllabus: syllabus || '' });
  };

  const canEditCourse = (course) => {
    if (!course) return false;
    // Zero Hour is a shared, read-only schedule for students. Only a CR with
    // a complete section/lab profile can publish updates.
    if (course.source === 'personal') return true;
    return canEditShared;
  };

  const handleSaveSingleSlot = () => {
    if (!detailModal || !canEditCourse({ source: detailModal.courseSource })) return;
    const { courseCode, slotKey: sKey, editDate, editSyllabus, courseSource } = detailModal;
    const safeSyllabus = (editSyllabus || '').slice(0, 2000);
    const payload = { date: editDate || '', syllabus: safeSyllabus };

    if (courseSource === 'personal') {
      const next = { ...personalExams };
      if (!next[courseCode]) next[courseCode] = {};
      next[courseCode][sKey] = payload;
      next._meta = { updatedBy: user?.name || user?.awid || 'You', role: user?.role || '', updatedAt: new Date().toISOString() };
      setPersonalExams(next);
    } else {
      // The shared store/API remains CR-only; regular students cannot publish
      // their personal edits into the lab group's schedule.
      if (!canEditShared || !slotKey) return;
      const next = { ...sharedExamData };
      if (!next[courseCode]) next[courseCode] = {};
      next[courseCode][sKey] = payload;
      next._meta = { updatedBy: user?.name || user?.awid || 'Unknown', role: user?.role || '', updatedAt: new Date().toISOString() };
      setExams(next);
    }
    setDetailModal(null);
  };

  /* Shared course-cell renderer — used identically for every course cell. */
  const renderCourseCell = (course) => {
    const courseExams = getExamDataForCourse(course);
    const slots = EXAM_SLOTS.map((slot) => ({ ...slot, data: courseExams[slot.key] }));
    const scheduled = slots.filter((s) => s.data?.date);
    const hasToday = slots.some((s) => s.data?.date && getSlotState(s.data.date).cls === 'today');
    const editable = canEditCourse(course);

    return (
      <article key={course.code} className={`exam-cell${hasToday ? ' today' : ''}`}>
        <header className="exam-cell-head">
          <div className="exam-cell-titles">
            <div className="exam-cell-code-row">
              <span className="exam-cell-code">{course.code}</span>
              <span className={`exam-source-badge ${course.source === 'personal' ? 'personal' : 'cr'}`} title={course.source === 'personal' ? 'Added to your own routine' : `Shared by your lab group CR${course.crName ? `, ${course.crName}` : ''}`}>
                {course.source === 'personal' ? <User size={10} /> : <Users size={10} />}
                {course.source === 'personal' ? 'You' : (course.crName || labCrName ? `CR · ${course.crName || labCrName}` : 'No CR')}
              </span>
            </div>
            <div className="exam-cell-name" title={course.name}>{course.name}</div>
          </div>
          <span className="exam-cell-count" title={`${scheduled.length} of ${slots.length} scheduled${!editable && course.source === 'cr' ? ' · read-only' : ''}`}>
            {scheduled.length}<span>/{slots.length}</span>
          </span>
        </header>
        <div className="exam-slot-list" role="list">
          {slots.map((slot) => {
            const state = getSlotState(slot.data?.date);
            const handleClick = () => openDetails(slot.key, slot.label, slot.data?.date, slot.data?.syllabus, course.code, course.name, course.source);
            return (
              <button
                key={slot.key}
                type="button"
                role="listitem"
                className={`exam-slot-item${slot.data?.date ? '' : ' is-empty'}`}
                onClick={handleClick}
              >
                <span className="exam-slot-name">{slot.label}</span>
                <span className="exam-slot-date">{formatDate(slot.data?.date)}</span>
                <span className={`exam-slot-state ${state.cls}`}>{slot.data?.date ? state.label : ''}</span>
              </button>
            );
          })}
        </div>
      </article>
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
              {user?.section ? ` · Sec ${user.section}` : ''}
              {user?.labSection ? ` · Lab ${user.labSection}` : ''}
            </span>
            {canEditShared && (
              <span className="exam-access-badge editor">
                <PenLine size={10} /> Editor · updates visible to your section
              </span>
            )}
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
              <span className="schedule-stat-label">upcoming</span>
            </div>
            <div className={`schedule-stat${nextExamLabel === 'Today' ? ' is-alert' : ''}`}>
              <span className="schedule-stat-value">{nextExamLabel}</span>
              <span className="schedule-stat-label">next</span>
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

      {profileIncomplete && (
        <div className="exam-notice" role="status">
          <span className="exam-notice-icon" aria-hidden="true"><BookOpen size={13} /></span>
          <span><strong>Lab Group missing</strong> — add Section + Lab Group in <Link to="/settings">Settings</Link> to enable CR sync. Your personal courses are still shown below.</span>
        </div>
      )}

      {!slotKey && !profileIncomplete ? (
        <div className="exam-empty">
          <span className="exam-empty-icon" aria-hidden="true"><BookOpen size={16} /></span>
          <p>Loading schedule…</p>
          <span>Syncing shared section data</span>
        </div>
      ) : theoryCourses.length === 0 ? (
        <div className="exam-empty">
          <span className="exam-empty-icon" aria-hidden="true"><BookOpen size={16} /></span>
          <p>No theory courses found</p>
          <span>Add theory courses to your routine first{slotKey && sharedRoutine ? '' : ' — or wait for your CR to share'}</span>
        </div>
      ) : (
        <div className="exam-grid">
          {theoryCourses.map(renderCourseCell)}
        </div>
      )}

      {isAdminView && <ExamFlowTracker user={user} canEdit={canEditShared} />}

      {/* ─── Detail Overlay ─── */}
      {detailModal && (() => {
        const editableModal = canEditCourse({ source: detailModal.courseSource });
        const modalState = getSlotState(detailModal.date);
        const closeModal = () => setDetailModal(null);
        return createPortal(
          <div className="modal-overlay exam-detail-overlay" onClick={closeModal}>
            <div
              className="modal exam-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-label={`${detailModal.slotLabel} · ${detailModal.courseCode}`}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => { if (e.key === 'Escape') closeModal(); }}
            >
              <div className="exam-modal-head">
                <span className="exam-modal-title">
                  <BookOpen size={13} /> {detailModal.slotLabel} · {detailModal.courseCode}
                </span>
                <button type="button" className="exam-modal-close" aria-label="Close" onClick={closeModal}>
                  <X size={12} />
                </button>
              </div>
              <p className="exam-modal-course">{detailModal.courseName}</p>

              <div className="exam-modal-summary">
                <span className="exam-badge is-muted">
                  {detailModal.courseSource === 'personal' ? <User size={10} /> : <Users size={10} />}
                  {detailModal.courseSource === 'personal' ? 'You' : (labCrName ? `CR · ${labCrName}` : 'No CR')}
                </span>
                <span className="exam-badge is-accent">{detailModal.date ? formatDate(detailModal.date) : 'No date yet'}</span>
                {detailModal.date && (
                  <span className={`exam-badge ${modalState.cls === 'today' ? 'is-alert' : 'is-muted'}`}>{modalState.label}</span>
                )}
              </div>

              {detailModal.isEditing ? (
                <>
                  <label className="exam-modal-field">
                    <span className="exam-modal-label">Date</span>
                    <input
                      type="date"
                      className="input exam-modal-input"
                      value={detailModal.editDate || ''}
                      onChange={(e) => setDetailModal(prev => ({ ...prev, editDate: e.target.value }))}
                    />
                  </label>
                  <label className="exam-modal-field">
                    <span className="exam-modal-label">Syllabus</span>
                    <textarea
                      className="input exam-modal-input exam-modal-textarea"
                      value={detailModal.editSyllabus || ''}
                      onChange={(e) => setDetailModal(prev => ({ ...prev, editSyllabus: e.target.value }))}
                      placeholder="Syllabus topics, chapters, page numbers..."
                      rows={5}
                    />
                  </label>
                </>
              ) : (
                <div className="exam-modal-field">
                  <span className="exam-modal-label">Syllabus</span>
                  {detailModal.syllabus ? (
                    <div className="exam-modal-syllabus">{detailModal.syllabus}</div>
                  ) : (
                    <div className="exam-modal-empty">No syllabus added yet</div>
                  )}
                </div>
              )}

              <div className="exam-modal-actions">
                {editableModal && detailModal.isEditing ? (
                  <>
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveSingleSlot}>
                      <Check size={13} /> Save
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setDetailModal(prev => ({ ...prev, isEditing: false, editDate: prev.date || '', editSyllabus: prev.syllabus || '' }))}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {editableModal && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setDetailModal(prev => ({ ...prev, isEditing: true }))}>
                        <PenLine size={12} /> Edit
                      </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={closeModal}>Close</button>
                  </>
                )}
                {!editableModal && detailModal.courseSource === 'cr' && (
                  <span className="exam-modal-note">Only your CR can edit this</span>
                )}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}
