import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Users, Search, Filter, ChevronDown, ChevronRight,
  GraduationCap, BookOpen, Layers,
  BadgeCheck, Star, School,
} from 'lucide-react';
import { getAllAccounts, createAwid } from '../../utils/authStorage';
import { getSemesterCountForDepartment, formatSemesterLabel } from '../../utils/semester';

// Extract student ID from @aust.edu email the same way the profile does
function extractStudentId(student) {
  const email = student.email || '';
  if (email.includes('@aust.edu')) {
    const prefix = email.split('@')[0] || '';
    const id = prefix.replace(/^[a-z.]+/i, '');
    if (id) return id;
  }
  return student.id || '';
}

const DEPARTMENTS = ['CSE', 'EEE', 'CE', 'ME', 'IPE', 'TE', 'ARCH', 'BBA'];

// No per-department colors: all department icons/avatars share the single
// brand accent (amber) via theme tokens, keeping the directory monochrome.

const LAB_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const SECTION_ORDER = ['A', 'B', 'C'];

function getSectionLetter(section) {
  return (section || '')[0]?.toUpperCase() || 'Z';
}

function getLabSortKey(labSection) {
  const idx = LAB_ORDER.indexOf(labSection);
  return idx >= 0 ? idx : 99;
}

export default function StudentDirectory() {
  const [activeDept, setActiveDept] = useState('all');
  const [expandedSems, setExpandedSems] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Get all accounts and group them by dept → sem
  // Each semester has: srs (array), crs (array), regulars (array sorted by ID)
  const { grouped, deptStats } = useMemo(() => {
    const allAccounts = getAllAccounts();
    const students = allAccounts.filter(a => a.role === 'student' || a.role === 'cr' || a.role === 'sr');

    const grouped = {};
    const deptStats = {};

    for (const dept of DEPARTMENTS) {
      const deptStudents = students.filter(s => s.department === dept);

      const semCount = getSemesterCountForDepartment(dept);
      grouped[dept] = {};
      deptStats[dept] = { total: deptStudents.length, semesters: 0 };

      for (let sem = 1; sem <= semCount; sem++) {
        const semStudents = deptStudents.filter(s => Number(s.semester) === sem);

        // Separate by role
        const srs = semStudents.filter(s => s.role === 'sr');
        const crs = semStudents.filter(s => s.role === 'cr');
        const regulars = semStudents.filter(s => s.role === 'student');

        // Sort SRs by section (A, B, C)
        srs.sort((a, b) => {
          const aSec = getSectionLetter(a.section);
          const bSec = getSectionLetter(b.section);
          const aIdx = SECTION_ORDER.indexOf(aSec);
          const bIdx = SECTION_ORDER.indexOf(bSec);
          if (aIdx !== bIdx) return aIdx - bIdx;
          return (a.id || '').localeCompare(b.id || '');
        });

        // Sort CRs by labSection (A1, A2, B1, B2, C1, C2)
        crs.sort((a, b) => {
          const aLab = getLabSortKey(a.labSection || a.section);
          const bLab = getLabSortKey(b.labSection || b.section);
          if (aLab !== bLab) return aLab - bLab;
          return (a.id || '').localeCompare(b.id || '');
        });

        // Sort regular students by ID
        regulars.sort((a, b) => (a.id || '').localeCompare(b.id || ''));

        grouped[dept][sem] = { srs, crs, regulars };
        if (semStudents.length > 0) {
          deptStats[dept].semesters++;
        }
      }
    }

    return { grouped, deptStats };
  }, []);

  // All departments — show everyone, even those with no students yet
  const availableDepts = DEPARTMENTS;

  // Toggle semester expansion
  const toggleSem = (dept, sem) => {
    setExpandedSems(prev => ({
      ...prev,
      [`${dept}-${sem}`]: !prev[`${dept}-${sem}`],
    }));
  };

  // Auto-expand first semester when switching departments
  useEffect(() => {
    const dept = activeDept === 'all' ? (availableDepts[0] || '') : activeDept;
    if (dept && grouped[dept]) {
      const sems = Object.keys(grouped[dept]).sort((a, b) => Number(a) - Number(b));
      if (sems.length > 0 && !expandedSems[`${dept}-${sems[0]}`]) {
        setExpandedSems(prev => ({
          ...prev,
          [`${dept}-${sems[0]}`]: true,
        }));
      }
    }
  }, [activeDept]);

  // Filter students
  const filteredGrouped = useMemo(() => {
    if (!searchQuery.trim()) return grouped;

    const q = searchQuery.toLowerCase();
    const result = {};

    const depts = activeDept === 'all' ? availableDepts : [activeDept];
    for (const dept of depts) {
      if (!grouped[dept]) continue;
      result[dept] = {};
      for (const [sem, data] of Object.entries(grouped[dept])) {
        const { srs, crs, regulars } = data;

        const filteredSrs = srs.filter(s =>
          s.name?.toLowerCase().includes(q) ||
          s.section?.toLowerCase().includes(q) ||
          s.labSection?.toLowerCase().includes(q) ||
          s.batch?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q)
        );
        const filteredCrs = crs.filter(s =>
          s.name?.toLowerCase().includes(q) ||
          s.section?.toLowerCase().includes(q) ||
          s.labSection?.toLowerCase().includes(q) ||
          s.batch?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q)
        );
        const filteredRegulars = regulars.filter(s =>
          s.name?.toLowerCase().includes(q) ||
          s.section?.toLowerCase().includes(q) ||
          s.labSection?.toLowerCase().includes(q) ||
          s.batch?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          s.designation?.toLowerCase().includes(q)
        );

        if (filteredSrs.length > 0 || filteredCrs.length > 0 || filteredRegulars.length > 0) {
          result[dept][sem] = {
            srs: filteredSrs,
            crs: filteredCrs,
            regulars: filteredRegulars,
          };
        }
      }
    }
    return result;
  }, [grouped, searchQuery, activeDept, availableDepts]);

  const totalStudents = useMemo(() => {
    return Object.values(deptStats).reduce((sum, s) => sum + s.total, 0);
  }, [deptStats]);

  const displayDepts = activeDept === 'all' ? availableDepts : [activeDept];

  // Build SR slot data (3 slots: A, B, C)
  const SR_SLOTS = SECTION_ORDER.map(sec => ({
    section: sec,
    label: `Section ${sec}`,
  }));

  // Build CR slot data (6 slots: A1, A2, B1, B2, C1, C2)
  const CR_SLOTS = LAB_ORDER.map(lab => ({
    lab,
    section: lab[0],
    label: `Lab ${lab}`,
  }));

  return (
    <div className="student-dir">
      {/* Masthead */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="student-dir-header-icon">
            <GraduationCap size={26} />
          </div>
          <div>
            <span className="schedule-overline">Community</span>
            <h2 className="student-dir-header-title">Student Directory</h2>
            <p className="student-dir-header-subtitle">
              Browse students across all departments and semesters. SR, CR, and student lists sorted by ID.
            </p>
          </div>
        </div>

        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="schedule-stat-value">{availableDepts.length}</span>
              <span className="schedule-stat-label">Departments</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">{totalStudents}</span>
              <span className="schedule-stat-label">Students</span>
            </div>
          </div>
        </div>

        <div className="schedule-actions" />
      </div>

      <div className="schedule-dotted-divider" style={{ marginTop: 0 }} />

      {/* Controls */}
      <div className="student-dir-controls">
        <div className="student-dir-search">
          <Search size={16} />
          <input
            ref={searchRef}
            type="text"
            className="student-dir-search-input"
            placeholder="Search by name, section, batch, email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="student-dir-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
          <span className="student-dir-search-kbd">⌘K</span>
        </div>

        <div className="student-dir-controls-right">
          <div className="student-dir-filter-group">
            <Filter size={14} />
            <button
              className={`student-dir-filter-btn ${activeDept === 'all' ? 'active' : ''}`}
              onClick={() => setActiveDept('all')}
            >
              All
            </button>
            {availableDepts.map(dept => (
              <button
                key={dept}
                className={`student-dir-filter-btn ${activeDept === dept ? 'active' : ''}`}
                onClick={() => setActiveDept(dept)}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="student-dir-content">
        {displayDepts.length === 0 && (
          <div className="student-dir-empty">
            <div className="student-dir-empty-icon">
              <Users size={28} />
            </div>
            <h3>No students found</h3>
            <p>No student accounts are registered yet. Seed dev accounts or register students to see them here.</p>
          </div>
        )}

        {displayDepts.map(dept => {
          const sems = Object.keys(filteredGrouped[dept] || {})
            .sort((a, b) => Number(a) - Number(b));

          if (sems.length === 0) return null;

          return (
            <div key={dept} className="student-dir-dept-section">
              <div className="student-dir-dept-header">
                <div className="student-dir-dept-icon" style={{ background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>
                  <BookOpen size={18} />
                </div>
                <div className="student-dir-dept-info">
                  <h3 className="student-dir-dept-name">
                    Department of {dept === 'CE' ? 'Civil Engineering' :
                      dept === 'ME' ? 'Mechanical Engineering' :
                      dept === 'IPE' ? 'Industrial & Production Engineering' :
                      dept === 'TE' ? 'Textile Engineering' :
                      dept === 'ARCH' ? 'Architecture' :
                      dept === 'BBA' ? 'Business Administration' :
                      dept === 'CSE' ? 'Computer Science & Engineering' :
                      dept === 'EEE' ? 'Electrical & Electronic Engineering' : dept}
                  </h3>
                  <span className="student-dir-dept-meta">
                    {deptStats[dept]?.total || 0} students · {deptStats[dept]?.semesters || 0} semesters
                  </span>
                </div>
              </div>

              <div className="student-dir-sem-list">
                {sems.map(sem => {
                  const semKey = `${dept}-${sem}`;
                  const isExpanded = expandedSems[semKey];
                  const data = filteredGrouped[dept][sem];
                  const { srs, crs, regulars } = data;
                  const totalInSem = data.srs.length + data.crs.length + data.regulars.length;
                  // Density by student count — 0 → emerald · 1 → cyan · 2 → amber · 3+ → rose
                  const densityClass = totalInSem >= 3 ? 'is-rose' : totalInSem === 2 ? 'is-amber' : totalInSem === 1 ? 'is-cyan' : 'is-emerald';

                  // Map SRs to slots
                  const srSlotMap = {};
                  for (const sr of srs) {
                    const sec = getSectionLetter(sr.section);
                    srSlotMap[sec] = sr;
                  }

                  // Map CRs to slots
                  const crSlotMap = {};
                  for (const cr of crs) {
                    const lab = cr.labSection || cr.section;
                    crSlotMap[lab] = cr;
                  }

                  return (
                    <div key={semKey} className={`student-dir-sem-card ${densityClass}`}>
                      <button
                        className="student-dir-sem-header"
                        onClick={() => toggleSem(dept, sem)}
                        aria-expanded={isExpanded}
                      >
                        <div className="student-dir-sem-header-left">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          <Layers size={16} />
                          <span className="student-dir-sem-label">
                            Year {formatSemesterLabel(Number(sem))} (Semester {sem})
                          </span>
                        </div>
                        <div className="student-dir-sem-header-right">
                          {totalInSem > 0 && (
                            <span className={`sv-count${totalInSem >= 3 ? ' hot' : ''}`} title={`${totalInSem} student${totalInSem !== 1 ? 's' : ''}`}>
                              {totalInSem}
                            </span>
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="student-dir-sem-body">
                          {/* ═══ SR Row ═══ */}
                          <div className="student-dir-role-section">
                            <div className="student-dir-role-label">
                              <Star size={14} />
                              <span>Student Representatives (SR)</span>
                            </div>
                            <div className="student-dir-slot-row">
                              {SR_SLOTS.map(slot => {
                                const sr = srSlotMap[slot.section];
                                const uniq = `sr-${dept}-${sem}-${slot.section}`;
                                return sr ? (
                                  <div key={uniq} className="student-dir-slot-card student-dir-slot-sr">
                                    <div className="student-dir-slot-avatar stu-avatar-sr">
                                      <Star size={15} />
                                    </div>
                                    <div className="student-dir-slot-info">
                                      <span className="student-dir-slot-name">{sr.name}</span>
                                      <span className="student-dir-slot-sub">{slot.label}</span>
                                    </div>
                                    <span className="stu-badge stu-badge-sr">SR</span>
                                  </div>
                                ) : (
                                  <div key={uniq} className="student-dir-slot-card student-dir-slot-vacant">
                                    <div className="student-dir-slot-avatar stu-avatar-vacant">
                                      <Star size={14} />
                                    </div>
                                    <div className="student-dir-slot-info">
                                      <span className="student-dir-slot-name-vacant">— Vacant —</span>
                                      <span className="student-dir-slot-sub">{slot.label}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* ═══ CR Row ═══ */}
                          <div className="student-dir-role-section">
                            <div className="student-dir-role-label">
                              <BadgeCheck size={14} />
                              <span>Class Representatives (CR)</span>
                            </div>
                            <div className="student-dir-slot-row">
                              {CR_SLOTS.map(slot => {
                                const cr = crSlotMap[slot.lab];
                                const uniq = `cr-${dept}-${sem}-${slot.lab}`;
                                return cr ? (
                                  <div key={uniq} className="student-dir-slot-card student-dir-slot-cr">
                                    <div className="student-dir-slot-avatar stu-avatar-cr">
                                      <BadgeCheck size={15} />
                                    </div>
                                    <div className="student-dir-slot-info">
                                      <span className="student-dir-slot-name">{cr.name}</span>
                                      <span className="student-dir-slot-sub">{slot.label}</span>
                                    </div>
                                    <span className="stu-badge stu-badge-cr">{slot.lab}</span>
                                  </div>
                                ) : (
                                  <div key={uniq} className="student-dir-slot-card student-dir-slot-vacant">
                                    <div className="student-dir-slot-avatar stu-avatar-vacant">
                                      <BadgeCheck size={14} />
                                    </div>
                                    <div className="student-dir-slot-info">
                                      <span className="student-dir-slot-name-vacant">— Vacant —</span>
                                      <span className="student-dir-slot-sub">{slot.label}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* ═══ Student Table ═══ */}
                          {regulars.length > 0 && (
                            <div className="student-dir-role-section">
                              <div className="student-dir-role-label">
                                <Users size={14} />
                                <span>Students ({regulars.length})</span>
                              </div>
                              <div className="student-dir-table-wrapper">
                                <table className="student-dir-table">
                                  <thead>
                                    <tr>
                                      <th className="stu-th-name">Name</th>
                                      <th className="stu-th-id">AUST ID</th>
                                      <th className="stu-th-awid">AWID</th>
                                      <th className="stu-th-email">Email</th>
                                      <th className="stu-th-lab">Lab</th>
                                      <th className="stu-th-blood">Blood</th>
                                      <th className="stu-th-batch">Batch</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {regulars.map(student => (
                                      <tr key={student.id} className="student-dir-table-row">
                                        <td className="stu-td-name">
                                          <span className="student-dir-student-avatar" style={{
                                            background: student.avatar ? 'transparent' : 'var(--accent-amber-glow)',
                                            color: 'var(--accent-amber)',
                                            width: '28px',
                                            height: '28px',
                                            fontSize: '9px',
                                            overflow: 'hidden',
                                          }}>
                                            {student.avatar ? (
                                              <img src={student.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                            ) : (
                                              student.initials || student.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
                                            )}
                                          </span>
                                          <span className="student-dir-table-stu-name">{student.name}</span>
                                        </td>
                                        <td className="stu-td-id">
                                          <code className="student-dir-id-code">{extractStudentId(student)}</code>
                                        </td>
                                        <td className="stu-td-awid">
                                          <code className="student-dir-id-code" style={{ fontSize: '9px' }}>{student.awid || createAwid(student.department) || '—'}</code>
                                        </td>
                                        <td className="stu-td-email">
                                          <span className="student-dir-email">{student.email || '—'}</span>
                                        </td>
                                        <td className="stu-td-lab">{student.labSection || student.section || '—'}</td>
                                        <td className="stu-td-blood">
                                          <span className={`student-dir-blood ${student.bloodGroup ? 'has-blood' : ''}`}>
                                            {student.bloodGroup || '—'}
                                          </span>
                                        </td>
                                        <td className="stu-td-batch">{student.batch || student.batchName || student.batchNo || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {regulars.length === 0 && (
                            <div className="student-dir-role-section">
                              <div className="student-dir-role-label">
                                <Users size={14} />
                                <span>Students</span>
                              </div>
                              <div className="student-dir-table-empty">No regular students in this semester.</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
