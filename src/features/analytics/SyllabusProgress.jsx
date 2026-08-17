import { useState } from 'react';
import { BookCheck, CheckSquare, Square, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { buildSyllabusData, SEMESTER_COURSES } from '../../data/syllabusCompletionData';

const STORAGE_KEY = 'aust-syllabus-progress';
const SEM_KEY = 'aust-syllabus-sem';

const allSyllabusData = buildSyllabusData();

function getProgressColor(p) {
  if (p >= 70) return 'var(--accent-emerald)';
  if (p >= 40) return 'var(--accent-amber)';
  return 'var(--accent-rose)';
}

export default function SyllabusProgress() {
  const [courses, setCourses] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch { /* ignore */ }
    return allSyllabusData.map(c => ({ ...c, completed: [...c.completed], progress: c.progress }));
  });

  const [selectedSem, setSelectedSem] = useState(() => {
    const saved = localStorage.getItem(SEM_KEY);
    if (saved) {
      const n = Number(saved);
      if (n >= 1 && n <= 8) return n;
    }
    return 1;
  });

  const [expandedCourse, setExpandedCourse] = useState(null);

  const saveCourses = (next) => {
    setCourses(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const handleSemChange = (sem) => {
    setSelectedSem(sem);
    localStorage.setItem(SEM_KEY, String(sem));
    setExpandedCourse(null);
  };

  const toggleTopic = (code, topicIdx) => {
    saveCourses(courses.map(c => {
      if (c.course !== code) return c;
      const completed = [...c.completed];
      completed[topicIdx] = !completed[topicIdx];
      const done = completed.filter(Boolean).length;
      return { ...c, completed, progress: Math.round((done / c.topics.length) * 100) };
    }));
  };

  const resetSemester = () => {
    saveCourses(courses.map(c => {
      if (c.semester !== selectedSem) return c;
      return { ...c, completed: new Array(c.topics.length).fill(false), progress: 0 };
    }));
  };

  const resetAll = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCourses(allSyllabusData.map(c => ({ ...c, completed: [...c.completed], progress: c.progress })));
  };

  const semCourses = courses.filter(c => c.semester === selectedSem);
  const totalTopics = semCourses.reduce((s, c) => s + c.topics.length, 0);
  const totalDone = semCourses.reduce((s, c) => s + c.completed.filter(Boolean).length, 0);
  const overallPct = totalTopics > 0 ? Math.round((totalDone / totalTopics) * 100) : 0;

  return (
    <div className="syllabus-progress-container animate-fadeInUp" style={{
      background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--sp-5)',
      boxShadow: '0 4px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
    }}>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="icon" style={{ backgroundColor: 'color-mix(in srgb, var(--accent-emerald) 14%, transparent)', color: 'var(--accent-emerald)', padding: '6px', borderRadius: '8px', border: '1px solid color-mix(in srgb, var(--accent-emerald) 22%, transparent)' }}>
            <BookCheck size={16} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="section-title" style={{ fontSize: 'var(--fs-lg)', margin: 0 }}>Syllabus Completion</h2>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
              {semCourses.length} courses &bull; {totalDone}/{totalTopics} topics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn btn-secondary btn-sm" onClick={resetSemester}>
            <RotateCcw size={13} /> Reset Semester
          </button>
          <button className="btn btn-secondary btn-sm" onClick={resetAll}>
            <RotateCcw size={13} /> Reset All
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {SEMESTER_COURSES.map(s => (
          <button
            key={s.semester}
            onClick={() => handleSemChange(s.semester)}
            style={{
              padding: '5px 14px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '700',
              border: selectedSem === s.semester 
                ? '1px solid var(--accent-amber)' 
                : '1px solid rgba(255,255,255,0.08)',
              background: selectedSem === s.semester 
                ? 'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(245,158,11,0.05))'
                : 'rgba(255,255,255,0.04)',
              color: selectedSem === s.semester ? 'var(--accent-amber)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              letterSpacing: selectedSem === s.semester ? '0.02em' : '0',
              boxShadow: selectedSem === s.semester ? '0 0 12px rgba(245,158,11,0.12)' : 'none',
            }}
          >
            Sem {s.semester}
          </button>
        ))}
      </div>

      {overallPct > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div className="flex justify-between items-center mb-1" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            <span>Semester Progress</span>
            <span style={{ fontWeight: 'bold', color: getProgressColor(overallPct) }}>{overallPct}%</span>
          </div>
          <div className="progress-bar" style={{ height: '8px' }}>
            <div className="progress-bar-fill" style={{ width: `${overallPct}%`, background: getProgressColor(overallPct) }} />
          </div>
        </div>
      )}

      <div className="syllabus-grid">
        {semCourses.map(course => {
          const isExpanded = expandedCourse === course.course;
          return (
            <div
              key={course.course}
              className="syllabus-course-card"
              style={{ cursor: 'pointer' }}
              onClick={() => setExpandedCourse(isExpanded ? null : course.course)}
            >
              <div className="flex justify-between items-center mb-1">
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{course.course}</span>
                <div className="flex items-center gap-2">
                  <span className="badge" style={{ backgroundColor: getProgressColor(course.progress) + '15', color: getProgressColor(course.progress), fontWeight: 'bold', fontSize: '11px' }}>
                    {course.progress}%
                  </span>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>
              <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)', marginBottom: '8px' }}>{course.name}</h3>

              <div className="progress-bar mb-3">
                <div className="progress-bar-fill" style={{ width: `${course.progress}%`, background: getProgressColor(course.progress) }} />
              </div>

              {isExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px' }}>
                  {course.topics.map((topic, idx) => {
                    const done = course.completed[idx];
                    return (
                      <div
                        key={idx}
                        onClick={(e) => { e.stopPropagation(); toggleTopic(course.course, idx); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: done ? 'var(--text-tertiary)' : 'var(--text-primary)', cursor: 'pointer', userSelect: 'none', padding: '2px 0' }}
                      >
                        {done ? <CheckSquare size={15} style={{ color: getProgressColor(course.progress), flexShrink: 0 }} /> : <Square size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />}
                        <span style={{ textDecoration: done ? 'line-through' : 'none' }}>{topic}</span>
                      </div>
                    );
                  })}
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px', textAlign: 'right' }}>
                    {course.completed.filter(Boolean).length}/{course.topics.length} completed
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {semCourses.length === 0 && (
        <div className="empty-state" style={{ padding: '32px' }}>
          <BookCheck size={32} />
          <p>No course data available for this semester.</p>
        </div>
      )}
    </div>
  );
}
