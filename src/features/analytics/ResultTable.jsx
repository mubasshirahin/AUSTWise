import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, FileDown, FileSpreadsheet, Layers, MoreVertical, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import CourseAutocomplete from '../../components/CourseAutocomplete';
import { formatSemesterLabel, getSemesterCountForDepartment } from '../../utils/semester';
import { syncHeatmapFromTracker } from '../../utils/deptHeatmapStorage';
import { semesterResults as mockSemesterResults } from '../../data/mockData';
import { getUserStorageItemWithGuestFallback, setUserStorageItem, removeUserStorageItem, removeGuestStorageItem } from '../../utils/authStorage';
import { transcriptTemplates, getTemplateCredits } from '../../data/transcriptTemplateData';
import { useAuth } from '../../context/AuthContext';
import { useLiveValue, useLiveRefresh, getLiveValue } from '../../utils/liveStore';

const gradePoints = {
  'A+': 4.00,
  'A': 3.75,
  'A-': 3.50,
  'B+': 3.25,
  'B': 3.00,
  'B-': 2.75,
  'C+': 2.50,
  'C': 2.25,
  'D': 2.00,
  'F': 0.00,
  '-': null,
};

const gradeOptions = Object.keys(gradePoints);
const storageKeyType = 'semesterResults';

// AUST departments — each will have its own transcript templates
const TRANSCRIPT_DEPARTMENTS = ['CSE', 'EEE', 'CE', 'ME', 'IPE', 'TE', 'ARCH', 'BBA'];

// Department → full name map for the picker
const DEPT_FULL_NAMES = {
  CSE: 'Computer Science & Engineering',
  EEE: 'Electrical & Electronic Engineering',
  CE: 'Civil Engineering',
  ME: 'Mechanical Engineering',
  IPE: 'Industrial & Production Engineering',
  TE: 'Textile Engineering',
  ARCH: 'Architecture',
  BBA: 'Business Administration',
};

const createBlankCourse = (semNum, _index = 0) => ({
  code: '',
  name: '',
  credit: 3,
  grade: '-',
  point: null,
});

const createBlankSemester = (semNum) => ({
  semester: semNum,
  year: '',
  sgpa: null,
  cgpa: null,
  courses: [createBlankCourse(semNum)],
});

const sortCourses = (courses) => [...courses].sort((firstCourse, secondCourse) => {
  const firstCode = firstCourse.code || firstCourse.name || '';
  const secondCode = secondCourse.code || secondCourse.name || '';
  return firstCode.localeCompare(secondCode, undefined, { numeric: true, sensitivity: 'base' });
});

const getCreditValue = (credit) => Number(credit) || 0;

const formatCredit = (credit) => parseFloat(Number(credit).toFixed(2)).toString();

const cloneResults = (results) => results.map((sem) => ({
  ...sem,
  courses: sortCourses(sem.courses.map((course) => ({ ...course }))),
}));

const normalizeResults = (results, maxSemester) => {
  const clonedResults = cloneResults(results);
  const normalizedResults = Array.from({ length: maxSemester }, (_, index) => {
    const semesterNumber = index + 1;
    return clonedResults.find((sem) => sem.semester === semesterNumber) ?? createBlankSemester(semesterNumber);
  });

  return normalizedResults.map((sem) => ({
    ...sem,
    courses: sortCourses(sem.courses.length > 0 ? sem.courses : [createBlankCourse(sem.semester)]),
  }));
};

const getDefaultResults = (maxSemester) => Array.from({ length: maxSemester }, (_, index) => createBlankSemester(index + 1));

const roundTwo = (value) => Number(value.toFixed(2));

const calculateSemesterStats = (results) => {
  let totalCredits = 0;
  let totalWeightedPoints = 0;

  return results.map((sem) => {
    const gradedCourses = sem.courses.filter((course) => course.point !== null);
    const semCredits = gradedCourses.reduce((sum, course) => sum + getCreditValue(course.credit), 0);
    const semWeightedPoints = gradedCourses.reduce((sum, course) => sum + (getCreditValue(course.credit) * course.point), 0);

    totalCredits += semCredits;
    totalWeightedPoints += semWeightedPoints;

    return {
      ...sem,
      courses: sortCourses(sem.courses.map((course) => ({
        ...course,
        credit: getCreditValue(course.credit),
      }))),
      sgpa: semCredits > 0 ? roundTwo(semWeightedPoints / semCredits) : null,
      cgpa: totalCredits > 0 ? roundTwo(totalWeightedPoints / totalCredits) : null,
    };
  });
};

const loadStoredResults = (maxSemester, liveOverride = null) => {
  try {
    // Server/live value wins when present; fall back to the legacy scoped
    // localStorage copy (or mock) so guests and first paint still work.
    const storedResults = (liveOverride && liveOverride.length ? liveOverride : null) || getUserStorageItemWithGuestFallback(storageKeyType);
    if (storedResults) {
      // Preserve any semesters beyond the department grid that were previously
      // loaded (e.g. ARCH's 5-1/5-2), so a reload never drops the 5th-year
      // courses.
      const storedMaxSem = storedResults.reduce((max, sem) => Math.max(max, Number(sem.semester) || 0), 0);
      return calculateSemesterStats(normalizeResults(storedResults, Math.max(maxSemester, storedMaxSem)));
    }
    if (mockSemesterResults && mockSemesterResults.length > 0) {
      return calculateSemesterStats(normalizeResults(mockSemesterResults, maxSemester));
    }
    return calculateSemesterStats(getDefaultResults(maxSemester));
  } catch {
    return calculateSemesterStats(getDefaultResults(maxSemester));
  }
};

export default function ResultTable({ onResultsChange }) {
  const { user } = useAuth();
  const maxSemester = getSemesterCountForDepartment(user?.department);
  // Live, cross-device source of truth for semester results. Seeds from
  // localStorage cache for instant paint, reconciles with the server, and
  // updates when another device saves grades (WS store-change).
  const [liveResults, setLiveResults, delLiveResults] = useLiveValue('user', 'aust-user-semester-results', null);
  const getInitialSem = () => {
    const ysMatch = (user?.yearSemester || '').match(/Year (\d+) - Semester (\d+)/);
    if (ysMatch) { const y = parseInt(ysMatch[1]), s = parseInt(ysMatch[2]); if (y >= 1 && y <= Math.ceil(maxSemester / 2) && s >= 1 && s <= 2) return (y - 1) * 2 + s; }
    if (user?.semester && user.semester >= 1 && user.semester <= maxSemester) return user.semester;
    return 1;
  };
  const [expandedSemester, setExpandedSemester] = useState(getInitialSem);
  const [results, setResults] = useState(() => loadStoredResults(maxSemester, liveResults));
  const [draftResults, setDraftResults] = useState(() => cloneResults(results));
  const [editingSemester, setEditingSemester] = useState(null);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [selectedDept, setSelectedDept] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const menuRef = useRef(null);

  // Persist to the live cross-device store AND the legacy scoped localStorage
  // copy so guests and older readers on this device keep working instantly.
  const persistResults = (value) => {
    setLiveResults(value);
    setUserStorageItem(storageKeyType, value);
  };

  // Close the ⋮ menu on outside click (desktop + mobile)
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, []);

  // Adopt server/remote results when another device saves OR resets grades.
  // Local writes already update `results` directly, so only non-local store
  // changes land here. Skipped while the user is editing on this device so
  // in-progress drafts are never clobbered. A remote reset (deleted key) falls
  // back to the scoped localStorage copy, then to an empty grid.
  useLiveRefresh(['aust-user-semester-results'], () => {
    if (editingSemester !== null) return;
    const live = getLiveValue('user', 'aust-user-semester-results', null);
    if (live && Array.isArray(live) && live.length) {
      const storedMaxSem = live.reduce((max, sem) => Math.max(max, Number(sem.semester) || 0), 0);
      const computed = calculateSemesterStats(normalizeResults(live, Math.max(maxSemester, storedMaxSem)));
      setResults(computed);
      setDraftResults(cloneResults(computed));
      return;
    }
    const scoped = getUserStorageItemWithGuestFallback(storageKeyType);
    if (scoped && Array.isArray(scoped) && scoped.length) {
      const storedMaxSem = scoped.reduce((max, sem) => Math.max(max, Number(sem.semester) || 0), 0);
      const computed = calculateSemesterStats(normalizeResults(scoped, Math.max(maxSemester, storedMaxSem)));
      setResults(computed);
      setDraftResults(cloneResults(computed));
      return;
    }
    const defaultResults = calculateSemesterStats(getDefaultResults(maxSemester));
    setResults(defaultResults);
    setDraftResults(cloneResults(defaultResults));
  });

  // Apply one or more curriculum templates to their mapped semesters at once.
  // targetCountOverride (used for full-curriculum loads) pins the grid to that
  // department's own semester count — ARCH=10, everyone else=8 — so switching
  // departments always yields the correct grid. Single-template loads only ever
  // expand the grid to fit the loaded semester.
  const applyTemplates = (templatesToApply, targetCountOverride) => {
    // Map curriculum semester code (1-1, 1-2 ...) to transcript semester number (1..8, ARCH up to 5-2 → 10)
    const semesterMap = {
      '1-1': 1, '1-2': 2, '2-1': 3, '2-2': 4,
      '3-1': 5, '3-2': 6, '4-1': 7, '4-2': 8,
      '5-1': 9, '5-2': 10
    };

    // Build a semester number → template courses lookup so multiple
    // templates (e.g. a full department curriculum) apply in one pass.
    const coursesBySemester = {};
    templatesToApply.forEach((template) => {
      const semNum = semesterMap[template.semester] || 1;
      coursesBySemester[semNum] = template.courses.map(course => ({
        code: course.code,
        name: course.name,
        credit: getCreditValue(course.credit),
        grade: '-',
        point: null,
      }));
    });

    // Full-curriculum loads pin the grid to the department's semester count;
    // single loads expand to fit the loaded semester but never shrink.
    const mappedSemesters = Object.keys(coursesBySemester).map(Number);
    const targetCount = targetCountOverride ?? Math.max(results.length, ...mappedSemesters);
    const baseResults = Array.from({ length: targetCount }, (_, index) => {
      const semesterNumber = index + 1;
      return results.find(sem => sem.semester === semesterNumber) ?? createBlankSemester(semesterNumber);
    });

    // Update every semester that has a matching template, keep others as-is
    const updatedResults = baseResults.map(sem => {
      const templateCourses = coursesBySemester[sem.semester];
      if (!templateCourses) return sem;
      return {
        ...sem,
        courses: sortCourses(templateCourses),
        year: sem.year,
      };
    });

    const calculatedResults = calculateSemesterStats(updatedResults);
    setResults(calculatedResults);
    setDraftResults(cloneResults(calculatedResults));
    persistResults(calculatedResults);
    setEditingSemester(null);
    syncHeatmapFromTracker();
    onResultsChange?.(calculatedResults);
    setShowDeptModal(false);
    setSelectedDept(null);
  };

  const handleLoadTemplate = (template) => applyTemplates([template]);

  // Load the complete department curriculum (all semesters) in one click.
  // Pins the grid to the department's own semester count so ARCH loads 10
  // semesters (5.1/5.2 visible) while every other department stays at 8.
  const handleLoadFullCurriculum = (dept) =>
    applyTemplates(transcriptTemplates[dept] || [], getSemesterCountForDepartment(dept));
  const inputRefs = useRef({});

  const handleKeyDown = (e, semNum, rowIdx, fieldIdx) => {
    const fields = ['code', 0, 1, 2]; // code, name, credit, grade
    const currIdx = fields.indexOf(fieldIdx);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (currIdx + 1 < fields.length) {
        inputRefs.current[`r_${semNum}_${rowIdx}_${fields[currIdx + 1]}`]?.focus();
      } else if (rowIdx + 1 < (draftResults.find(s => s.semester === semNum)?.courses.length || 0)) {
        inputRefs.current[`r_${semNum}_${rowIdx + 1}_code`]?.focus();
      }
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (currIdx - 1 >= 0) {
        inputRefs.current[`r_${semNum}_${rowIdx}_${fields[currIdx - 1]}`]?.focus();
      } else if (rowIdx - 1 >= 0) {
        inputRefs.current[`r_${semNum}_${rowIdx - 1}_2`]?.focus();
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const courses = draftResults.find(s => s.semester === semNum)?.courses || [];
      if (rowIdx + 1 < courses.length) {
        inputRefs.current[`r_${semNum}_${rowIdx + 1}_${fieldIdx}`]?.focus();
      }
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIdx - 1 >= 0) {
        inputRefs.current[`r_${semNum}_${rowIdx - 1}_${fieldIdx}`]?.focus();
      }
    }
  };


  const toggleSemester = (semNum) => {
    setExpandedSemester(expandedSemester === semNum ? null : semNum);
  };

  const startEditing = (semNum) => {
    setDraftResults(cloneResults(results));
    setEditingSemester(semNum);
    setExpandedSemester(semNum);
  };

  const cancelEditing = () => {
    setDraftResults(cloneResults(results));
    setEditingSemester(null);
  };

  const saveEditing = () => {
    const updatedResults = calculateSemesterStats(draftResults);
    setResults(updatedResults);
    setDraftResults(cloneResults(updatedResults));
    persistResults(updatedResults);
    setEditingSemester(null);
    syncHeatmapFromTracker();
    onResultsChange?.(updatedResults);
  };

  const resetResults = () => {
    const defaultResults = calculateSemesterStats(getDefaultResults(maxSemester));
    setResults(defaultResults);
    setDraftResults(cloneResults(defaultResults));
    delLiveResults();
    removeUserStorageItem(storageKeyType);
    removeGuestStorageItem(storageKeyType);
    setEditingSemester(null);
    syncHeatmapFromTracker();
    onResultsChange?.(defaultResults);
  };

  const updateCourseField = (semNum, courseIndex, field, value) => {
    setDraftResults((currentDraft) => currentDraft.map((sem) => {
      if (sem.semester !== semNum) return sem;

      return {
        ...sem,
        courses: sem.courses.map((course, index) => {
          if (index !== courseIndex) return course;

          const updatedCourse = { ...course, [field]: value };

          if (field === 'grade') {
            updatedCourse.point = gradePoints[value];
          }

          return updatedCourse;
        }),
      };
    }));
  };

  const addCourse = (semNum) => {
    setDraftResults((currentDraft) => currentDraft.map((sem) => {
      if (sem.semester !== semNum) return sem;

      return {
        ...sem,
        courses: [...sem.courses, createBlankCourse(semNum, sem.courses.length)],
      };
    }));
  };

  const removeCourse = (semNum, courseIndex) => {
    setDraftResults((currentDraft) => currentDraft.map((sem) => {
      if (sem.semester !== semNum || sem.courses.length === 1) return sem;

      return {
        ...sem,
        courses: sem.courses.filter((_, index) => index !== courseIndex),
      };
    }));
  };

  const exportTranscript = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = 190;
    let y = 20;

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Academic Transcript', pageW / 2, y, { align: 'center' });
    y += 10;

    results.forEach((sem) => {
      const hasCourses = sem.courses.some(c => c.code && c.code.trim() !== '');
      if (!hasCourses) return;

      const boxH = 12 + sem.courses.length * 7 + 12;
      if (y + boxH > 280) {
        doc.addPage();
        y = 20;
      }

      doc.setDrawColor(200);
      doc.setFillColor(248, 248, 252);
      doc.roundedRect(10, y, pageW, boxH, 3, 3, 'FD');

      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(`${formatSemesterLabel(sem.semester)}${sem.year ? ` (${sem.year})` : ''}`, 16, y + 8);

      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.text('Code', 16, y + 16);
      doc.text('Course', 42, y + 16);
      doc.text('Cr', 120, y + 16, { align: 'center' });
      doc.text('Grade', 138, y + 16, { align: 'center' });
      doc.text('GPA', 156, y + 16, { align: 'center' });

      let rowY = y + 16;
      sem.courses.forEach((course) => {
        if (!course.code && !course.name) return;
        rowY += 7;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);
        doc.text(course.code || '-', 16, rowY);
        doc.text(course.name || '-', 42, rowY);
        doc.text(formatCredit(course.credit), 120, rowY, { align: 'center' });
        doc.text(course.grade || '-', 138, rowY, { align: 'center' });
        doc.text(course.point !== null ? course.point.toFixed(2) : '-', 156, rowY, { align: 'center' });
      });

      const sumY = y + boxH - 5;
      doc.setFont(undefined, 'bold');
      doc.setFontSize(9);
      doc.text(`SGPA: ${sem.sgpa ?? '—'}    CGPA: ${sem.cgpa ?? '—'}`, pageW - 10, sumY, { align: 'right' });

      y += boxH + 6;
    });

    doc.save('aust-transcript.pdf');
  };

  const getCurrentSemester = () => {
    const ysMatch = (user?.yearSemester || '').match(/Year (\d+) - Semester (\d+)/);
    if (ysMatch) {
      const y = parseInt(ysMatch[1]), s = parseInt(ysMatch[2]);
      if (y >= 1 && y <= Math.ceil(maxSemester / 2) && s >= 1 && s <= 2) return (y - 1) * 2 + s;
    }
    if (user?.semester && user.semester >= 1 && user.semester <= maxSemester) return user.semester;
    for (let i = results.length - 1; i >= 0; i--) {
      const sem = results[i];
      const hasRealCourses = sem.courses.some(c => c.code && c.code.trim() !== '');
      const hasPendingGrade = sem.courses.some(c => c.grade === '-' || c.point === null);
      if (hasRealCourses && hasPendingGrade) return sem.semester;
    }
    return null;
  };

  const getGradeColor = (grade) => {
    switch (grade) {
      case 'A+': return 'badge-emerald';
      case 'A': return 'badge-blue';
      case 'A-': return 'badge-cyan';
      case 'B+': return 'badge-amber';
      case 'B': return 'badge-orange';
      case 'B-': return 'badge-purple';
      case '-': return 'badge-blue'; // In Progress
      default: return 'badge-rose';
    }
  };

  // ─── Shared semester-cell renderer — used identically by every semester ───
  const renderSemesterCard = (sem) => {
    const displaySemester = editingSemester === sem.semester
      ? draftResults.find((draftSem) => draftSem.semester === sem.semester) ?? sem
      : sem;
    const isExpanded = expandedSemester === sem.semester;
    const isCurrentSemester = displaySemester.semester === getCurrentSemester();
    const isEditing = editingSemester === sem.semester;

    return (
      <div
        key={sem.semester}
        className={`schedule-day-card cgpa-sem-card${isCurrentSemester ? ' today' : ''}`}
        onClick={() => toggleSemester(sem.semester)}
      >
        {/* Card header */}
        <div className="cgpa-sem-head">
          <div className="cgpa-sem-head-main">
            <div className="cgpa-sem-title">
              <span className="cgpa-sem-code" style={{ color: 'var(--accent-blue)' }}>{formatSemesterLabel(sem.semester)}</span>
              {displaySemester.year && <span className="cgpa-sem-year">Batch {displaySemester.year}</span>}
              {isCurrentSemester && <span className="cgpa-sem-current">CURRENT SEMESTER</span>}
            </div>
          </div>
          <div className="cgpa-sem-metrics">
            <div className="cgpa-sem-metric">
              <span>SGPA</span>
              <b style={{ color: 'var(--accent-cyan)' }}>{displaySemester.sgpa ?? '—'}</b>
            </div>
            <div className="cgpa-sem-metric">
              <span>CGPA</span>
              <b style={{ color: 'var(--accent-amber)' }}>{displaySemester.cgpa ?? '—'}</b>
            </div>
          </div>
          <div className="cgpa-sem-head-side">
            <div className="cgpa-sem-actions" onClick={(event) => event.stopPropagation()}>
              {!isEditing && (
                <button
                  className="schedule-nav-btn"
                  onClick={() => {
                    const updatedResults = results.map(s => {
                      if (s.semester === sem.semester) {
                        return {
                          ...s,
                          courses: [{ code: '', name: '', credit: 3, grade: '-', point: null }],
                          year: ''
                        };
                      }
                      return s;
                    });
                    const calculatedResults = calculateSemesterStats(updatedResults);
                    setResults(calculatedResults);
                    setDraftResults(cloneResults(calculatedResults));
                    persistResults(calculatedResults);
                    syncHeatmapFromTracker();
                    onResultsChange?.(calculatedResults);
                  }}
                  title={`Reset ${formatSemesterLabel(sem.semester)}`}
                >
                  <RotateCcw size={14} />
                </button>
              )}
              {isEditing ? (
                <>
                  <button className="btn btn-primary btn-sm" onClick={saveEditing}>
                    <Check size={14} /> Save
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={cancelEditing}>
                    <X size={14} /> Cancel
                  </button>
                </>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={() => startEditing(sem.semester)}>
                  <Pencil size={14} /> Edit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Collapsed/expanded details */}
        {isExpanded && (
          <div className="cgpa-sem-body" onClick={(event) => event.stopPropagation()}>
            <table className="cgpa-sem-table">
              <thead>
                <tr>
                  <th>Course Code</th>
                  <th>Course Title</th>
                  <th style={{ textAlign: 'center' }}>Credits</th>
                  <th style={{ textAlign: 'center' }}>Grade</th>
                  <th style={{ textAlign: 'center' }}>GPA</th>
                  {isEditing && <th style={{ width: '52px', textAlign: 'center' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {displaySemester.courses.map((course, courseIndex) => (
                  <tr
                    key={`${displaySemester.semester}-${courseIndex}`}
                    className="cgpa-course-row"
                  >
                    <td style={{ fontWeight: 'var(--fw-semibold)', position: 'relative', zIndex: 1000 }}>
                      {isEditing ? (
                        <input
                          ref={el => inputRefs.current[`r_${displaySemester.semester}_${courseIndex}_code`] = el}
                          className="input"
                          value={course.code}
                          onChange={(event) => updateCourseField(displaySemester.semester, courseIndex, 'code', event.target.value)}
                          placeholder="CSE 4201"
                          style={{
                            width: '100%',
                            minWidth: '90px',
                            background: 'transparent',
                            border: 'none',
                            boxShadow: 'none',
                            color: 'var(--accent-blue)',
                            fontWeight: 'var(--fw-bold)',
                            fontSize: 'inherit',
                            padding: '2px 4px',
                            outline: 'none'
                          }}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={e => handleKeyDown(e, displaySemester.semester, courseIndex, 'code')}
                        />
                      ) : (
                        <span style={{ color: 'var(--accent-blue)', fontWeight: 'var(--fw-bold)' }}>{course.code || '-'}</span>
                      )}
                    </td>
                    <td className="cgpa-course-name">
                      {isEditing ? (
                        <input
                          ref={el => inputRefs.current[`r_${displaySemester.semester}_${courseIndex}_0`] = el}
                          className="input"
                          value={course.name}
                          onChange={(event) => updateCourseField(displaySemester.semester, courseIndex, 'name', event.target.value)}
                          placeholder="Course title"
                          style={{
                            width: '100%',
                            minWidth: '180px',
                            background: 'transparent',
                            border: 'none',
                            boxShadow: 'none',
                            color: 'inherit',
                            fontSize: 'inherit',
                            padding: '2px 4px',
                            outline: 'none'
                          }}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={e => handleKeyDown(e, displaySemester.semester, courseIndex, 0)}
                        />
                      ) : (
                        course.name
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isEditing ? (
                        <input
                          ref={el => inputRefs.current[`r_${displaySemester.semester}_${courseIndex}_1`] = el}
                          className="input cgpa-credit-input"
                          type="number"
                          min="0"
                          step="0.5"
                          value={formatCredit(course.credit)}
                          onChange={(event) => updateCourseField(displaySemester.semester, courseIndex, 'credit', event.target.value)}
                          style={{
                            width: '56px',
                            background: 'transparent',
                            border: 'none',
                            boxShadow: 'none',
                            color: 'inherit',
                            fontSize: 'inherit',
                            textAlign: 'center',
                            padding: '2px 4px',
                            outline: 'none'
                          }}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={e => handleKeyDown(e, displaySemester.semester, courseIndex, 1)}
                        />
                      ) : (
                        formatCredit(course.credit)
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isEditing ? (
                        <select
                          ref={el => inputRefs.current[`r_${displaySemester.semester}_${courseIndex}_2`] = el}
                          className="input cgpa-grade-select"
                          value={course.grade}
                          onChange={(event) => updateCourseField(displaySemester.semester, courseIndex, 'grade', event.target.value)}
                          style={{
                            width: '60px',
                            minWidth: '60px',
                            background: 'transparent',
                            border: 'none',
                            boxShadow: 'none',
                            color: 'inherit',
                            fontSize: 'inherit',
                            fontWeight: '700',
                            textAlign: 'center',
                            padding: '2px 4px',
                            outline: 'none',
                            appearance: 'none',
                            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 4px center',
                            paddingRight: '20px'
                          }}
                          onKeyDown={e => handleKeyDown(e, displaySemester.semester, courseIndex, 2)}
                        >
                          {gradeOptions.map((grade) => (
                            <option key={grade} value={grade}>{grade}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`badge ${getGradeColor(course.grade)}`} style={{ padding: '3px 10px', minWidth: '40px', textAlign: 'center', justifyContent: 'center', fontWeight: '700', letterSpacing: '0.03em' }}>
                          {course.grade}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'var(--fw-semibold)' }}>
                      {course.point !== null ? course.point.toFixed(2) : '-'}
                    </td>
                    {isEditing && (
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-secondary btn-icon"
                          onClick={() => removeCourse(displaySemester.semester, courseIndex)}
                          disabled={displaySemester.courses.length === 1}
                          title="Remove course"
                          style={{ width: '30px', height: '30px', opacity: displaySemester.courses.length === 1 ? 0.45 : 1 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {isEditing && (
              <div className="cgpa-sem-foot">
                <button className="btn btn-secondary btn-sm" onClick={() => addCourse(displaySemester.semester)}>
                  <Plus size={14} /> Add Course
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="cgpa-transcript">
      {/* Section head — title + ⋮ menu (matches CGPA Calculator masthead) */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <FileSpreadsheet size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">GradeLab</span>
            <p className="schedule-title">Semester Breakdown</p>
            <span className="schedule-subtitle">Detailed semester-wise grade sheet breakdown</span>
          </div>
        </div>
        <div className="schedule-masthead-center" />
        <div className="cgpa-transcript-actions">
          <button className="schedule-nav-btn cgpa-load-template-btn cgpa-load-desktop" onClick={() => setShowDeptModal(true)}>
            <Layers size={15} /> Load Template
          </button>
          <div className="export-dropdown" ref={menuRef}>
          <button type="button" className="schedule-nav-btn cgpa-more-btn" onClick={() => setShowMenu((v) => !v)} aria-label="More options" aria-haspopup="true">
            <MoreVertical size={18} />
          </button>
          {showMenu && (
            <div className="export-menu">
              <button
                className="export-menu-item"
                onClick={() => { setShowMenu(false); exportTranscript(); }}
              >
                <FileDown size={14} /> Export Transcript PDF
              </button>
              <div className="export-menu-sep" />
              <button
                className="export-menu-item export-menu-item-danger"
                onClick={() => { setShowMenu(false); setShowResetConfirm(true); }}
              >
                <RotateCcw size={14} /> Reset All
              </button>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Mobile: Load Template sits right below the masthead box, right-aligned */}
      <div className="cgpa-load-mobile-wrap">
        <button className="schedule-nav-btn cgpa-load-template-btn" onClick={() => setShowDeptModal(true)}>
          <Layers size={15} /> Load Template
        </button>
      </div>

      <div className="schedule-dotted-divider" />

      {/* Semester cells */}
      <div className="cgpa-sem-list">
        {results.map(renderSemesterCard)}
      </div>

      {/* Load Template — Department Picker Modal — compact for 8 depts, portal + blurred */}
      {showDeptModal && createPortal(
        <div
          className="modal-overlay"
          onClick={() => { setShowDeptModal(false); setSelectedDept(null); }}
          style={{
            background: 'rgba(4, 6, 20, 0.52)',
            backdropFilter: 'blur(16px) saturate(140%)',
            WebkitBackdropFilter: 'blur(16px) saturate(140%)',
            zIndex: 99999,
            padding: 'var(--sp-4)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            className="modal glass-card-static"
            onClick={(e) => e.stopPropagation()}
            style={
              selectedDept
                ? { maxWidth: '520px', maxHeight: '72vh', overflowY: 'auto', padding: 'var(--sp-4)' }
                : { maxWidth: '400px', maxHeight: 'auto', overflowY: 'visible', padding: 'var(--sp-4)', width: 'min(400px, calc(100% - 32px))' }
            }
          >
            <div className="flex justify-between items-center" style={{ marginBottom: '12px', gap: '12px' }}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
                  {selectedDept ? `${DEPT_FULL_NAMES[selectedDept] || selectedDept}` : 'Load Template'}
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '2px 0 0', lineHeight: 1.4 }}>
                  {selectedDept
                    ? `Pick a semester for ${selectedDept}.`
                    : 'Choose your department — 8 options.'}
                </p>
              </div>
              <button
                className="btn btn-icon"
                onClick={() => { setShowDeptModal(false); setSelectedDept(null); }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)', flexShrink: 0, width: 32, height: 32 }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {!selectedDept ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                {TRANSCRIPT_DEPARTMENTS.map(dept => (
                  <button
                    key={dept}
                    className="btn btn-secondary"
                    onClick={() => setSelectedDept(dept)}
                    style={{
                      padding: '10px 8px',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 700,
                      letterSpacing: '0.03em',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 'var(--radius-md)',
                      lineHeight: 1.2,
                      minHeight: 56,
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 800 }}>{dept}</span>
                    <span style={{ fontSize: '9px', fontWeight: 500, opacity: 0.65, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                      {DEPT_FULL_NAMES[dept]}
                    </span>
                  </button>
                ))}
              </div>
            ) : (transcriptTemplates[selectedDept] || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                <div
                  style={{
                    fontSize: 'var(--fs-lg)',
                    fontWeight: 'bold',
                    color: 'var(--accent-cyan)',
                    marginBottom: '8px',
                  }}
                >
                  {selectedDept}
                </div>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: '0 0 4px' }}>
                  Templates for {selectedDept} are coming soon.
                </p>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', margin: 0 }}>
                  The department curriculum template will appear here.
                </p>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedDept(null)}
                  style={{ marginTop: '20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <ChevronLeft size={14} /> Back to departments
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Load entire department curriculum at once */}
                <button
                  className="btn btn-primary"
                  onClick={() => handleLoadFullCurriculum(selectedDept)}
                  style={{
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 'var(--fs-sm)' }}>Load Full Curriculum</div>
                    <div style={{ fontSize: '10px', opacity: 0.75, marginTop: '2px' }}>
                      All {(transcriptTemplates[selectedDept] || []).length} semesters of {selectedDept} in one go
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold' }}>
                      {(transcriptTemplates[selectedDept] || []).reduce((sum, t) => sum + getTemplateCredits(t), 0)} cr total
                    </span>
                    <ChevronRight size={16} />
                  </div>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0' }}>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    or load a single semester
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                </div>

                {(transcriptTemplates[selectedDept] || []).map(template => (
                  <button
                    key={template.semester}
                    className="btn btn-secondary"
                    onClick={() => handleLoadTemplate(template)}
                    style={{
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 'bold', fontSize: 'var(--fs-sm)' }}>{template.label}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                        {template.courses.length} courses
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--accent-amber)' }}>
                        {getTemplateCredits(template)} cr
                      </span>
                      <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                    </div>
                  </button>
                ))}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedDept(null)}
                  style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <ChevronLeft size={14} /> Back to departments
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Reset All — Confirmation Modal */}
      {showResetConfirm && createPortal(
        <div
          className="modal-overlay"
          onClick={() => setShowResetConfirm(false)}
          style={{
            background: 'rgba(4, 6, 20, 0.52)',
            backdropFilter: 'blur(16px) saturate(140%)',
            WebkitBackdropFilter: 'blur(16px) saturate(140%)',
            zIndex: 99999,
          }}
        >
          <div className="modal glass-card-static" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  margin: '0 auto 12px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--accent-rose-glow)',
                  color: 'var(--accent-rose)',
                }}
              >
                <RotateCcw size={22} />
              </div>
              <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', margin: 0 }}>Reset All Grades?</h3>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', margin: '8px 0 0', lineHeight: 1.5 }}>
                All {maxSemester} semesters of course data, SGPA &amp; CGPA will be permanently cleared. This cannot be undone.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setShowResetConfirm(false)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowResetConfirm(false);
                  resetResults();
                }}
                style={{ flex: 1, background: 'var(--accent-rose)', borderColor: 'var(--accent-rose)' }}
              >
                Reset All
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
