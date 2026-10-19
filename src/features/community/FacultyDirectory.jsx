import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  School, Search, Mail, ExternalLink, Users, MessageCircle,
} from 'lucide-react';
import { getAllAccounts, getInitials } from '../../utils/authStorage';
import { useAuth } from '../../context/AuthContext';

// Canonical AUST department order — every department renders even when empty.
const DEPARTMENTS = ['CSE', 'EEE', 'CE', 'ME', 'IPE', 'TE', 'ARCH', 'BBA'];

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

// Canonical designation order — anything else sorts alphabetically after.
const DESIGNATION_ORDER = ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer'];

const AVATAR_IMG_STYLE = { width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' };

/**
 * Faculty list = localStorage accounts ∪ server member list (deduped by id).
 * The server is authoritative for registered faculty (dev seeds include one
 * per department); local accounts merge in extra contact fields (email,
 * linkedin) that the sanitized member list does not expose.
 */
async function loadFacultyList() {
  const byId = new Map();
  const push = (m) => {
    if (!m || !String(m.name || '').trim()) return;
    const id = String(m.id || '').trim();
    if (id) byId.set(id, m);
  };

  // 1) Server member list — authoritative for registered faculty
  try {
    const res = await fetch('/api/presence/members', { credentials: 'same-origin' });
    const data = await res.json().catch(() => null);
    if (data?.success && Array.isArray(data.members)) {
      data.members.filter((m) => m.role === 'faculty').forEach(push);
    }
  } catch { /* server not reachable — keep local list */ }

  // 2) Registered accounts stored locally (works offline / server down)
  try {
    getAllAccounts()
      .filter((a) => a.role === 'faculty')
      .forEach((a) => {
        const existing = byId.get(a.id);
        if (existing) {
          // Merge contact fields the member list omits.
          byId.set(a.id, { ...existing, email: existing.email || a.email || '', linkedin: existing.linkedin || a.linkedin || '' });
        } else {
          push(a);
        }
      });
  } catch { /* best effort */ }

  return [...byId.values()].map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email || '',
    avatar: m.avatar || null,
    initials: m.initials || getInitials(m.name),
    department: m.department || 'Department not set',
    designation: m.designation || '',
    linkedin: m.linkedin || '',
  }));
}

export default function FacultyDirectory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDept, setActiveDept] = useState('all');

  const isGuest = user?.role === 'guest' || !user?.id;

  useEffect(() => {
    let cancelled = false;
    loadFacultyList().then((list) => {
      if (!cancelled) {
        setFaculty(list);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Departments that actually have faculty, for the filter bar.
  const departments = useMemo(() => {
    const present = new Set(faculty.map((f) => f.department));
    return DEPARTMENTS.filter((d) => present.has(d));
  }, [faculty]);

  const totalFaculty = faculty.length;

  // Apply department + search filters.
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return faculty.filter((f) => {
      const matchesDept = activeDept === 'all' || f.department === activeDept;
      const matchesSearch =
        !term ||
        f.name.toLowerCase().includes(term) ||
        f.designation.toLowerCase().includes(term) ||
        (DEPT_FULL_NAMES[f.department] || f.department).toLowerCase().includes(term);
      return matchesDept && matchesSearch;
    });
  }, [faculty, activeDept, searchTerm]);

  // Group by department (canonical order), members sorted by designation
  // rank then name.
  const deptGroups = useMemo(() => {
    const byDept = {};
    filtered.forEach((f) => {
      (byDept[f.department] = byDept[f.department] || []).push(f);
    });
    return Object.entries(byDept)
      .sort((a, b) => {
        const ia = DEPARTMENTS.indexOf(a[0]);
        const ib = DEPARTMENTS.indexOf(b[0]);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a[0].localeCompare(b[0]);
      })
      .map(([dept, members]) => {
        members.sort((a, b) => {
          const ia = DESIGNATION_ORDER.indexOf(a.designation);
          const ib = DESIGNATION_ORDER.indexOf(b.designation);
          if (ia !== -1 && ib !== -1) return ia - ib;
          if (ia !== -1) return -1;
          if (ib !== -1) return 1;
          return a.name.localeCompare(b.name) || a.designation.localeCompare(b.designation);
        });
        return { dept, members };
      });
  }, [filtered]);

  const handleMessage = (f) => {
    if (isGuest) {
      navigate('/login');
      return;
    }
    navigate(`/messages?peer=${f.id}`);
  };

  return (
    <div className="student-dir faculty-dir">
      {/* Masthead */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="student-dir-header-icon">
            <School size={26} />
          </div>
          <div>
            <span className="schedule-overline">Community</span>
            <h2 className="student-dir-header-title">Faculty Directory</h2>
            <p className="student-dir-header-subtitle">
              Find AUST faculty members — grouped by department &amp; designation.
            </p>
          </div>
        </div>

        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="schedule-stat-value">{departments.length}</span>
              <span className="schedule-stat-label">Departments</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">{loading ? '—' : totalFaculty}</span>
              <span className="schedule-stat-label">Faculty</span>
            </div>
          </div>
        </div>

        <div className="schedule-actions">
          <div className="search-box alumni-search">
            <input
              type="text"
              placeholder="Search name / designation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search faculty"
            />
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" style={{ marginTop: 0 }} />

      {/* Filter bar */}
      {departments.length > 0 && (
        <div className="student-dir-controls">
          <div className="student-dir-filter-group">
            <Search size={14} />
            <button
              className={`student-dir-filter-btn ${activeDept === 'all' ? 'active' : ''}`}
              onClick={() => setActiveDept('all')}
            >
              All
              {totalFaculty > 0 && (
                <span className="student-dir-filter-count">{totalFaculty}</span>
              )}
            </button>
            {departments.map((dept) => (
              <button
                key={dept}
                className={`student-dir-filter-btn ${activeDept === dept ? 'active' : ''}`}
                onClick={() => setActiveDept(dept)}
              >
                {dept}
                <span className="student-dir-filter-count">
                  {faculty.filter((f) => f.department === dept).length}
                </span>
              </button>
            ))}
          </div>

          {activeDept !== 'all' && (
            <button className="student-dir-clear-filter" onClick={() => setActiveDept('all')}>
              <Users size={12} /> Clear filter
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="student-dir-empty">
          <div className="student-dir-empty-icon">
            <School size={28} />
          </div>
          <h3>Loading faculty…</h3>
        </div>
      ) : faculty.length === 0 ? (
        <div className="student-dir-empty">
          <div className="student-dir-empty-icon">
            <School size={28} />
          </div>
          <h3>No faculty registered yet</h3>
          <p>Faculty who sign up with a faculty account will appear here, grouped by department and designation.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="student-dir-empty">
          <div className="student-dir-empty-icon">
            <Search size={28} />
          </div>
          <h3>No faculty match your filters</h3>
        </div>
      ) : (
        <div className="student-dir-content">
          {deptGroups.map(({ dept, members }) => (
            <div key={dept} className="student-dir-dept-section faculty-dept">
              <div className="student-dir-dept-header">
                <div className="student-dir-dept-icon">
                  <School size={18} />
                </div>
                <div className="student-dir-dept-info">
                  <h3 className="student-dir-dept-name">
                    Department of {DEPT_FULL_NAMES[dept] || dept}
                  </h3>
                  <span className="student-dir-dept-meta">
                    {members.length} faculty member{members.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className="student-dir-dept-count">{members.length}</span>
              </div>

              <div className="faculty-dir-dept-body">
                <div className="alumni-grid-inner">
                  {members.map((f) => {
                    const isMe = f.id === user?.id;
                    return (
                      <div key={f.id} className="alumni-card">
                        <div className="alumni-card-top">
                          <div
                            className="avatar"
                            style={{
                              width: '40px',
                              height: '40px',
                              flexShrink: 0,
                              background: 'var(--accent-purple-glow)',
                              color: 'var(--accent-purple)',
                              fontSize: '12px',
                              fontWeight: 700,
                              overflow: 'hidden',
                            }}
                          >
                            {f.avatar ? (
                              <img src={f.avatar} alt="" style={AVATAR_IMG_STYLE} />
                            ) : f.initials}
                          </div>
                          <div className="alumni-card-info">
                            <h3 className="alumni-card-name">
                              {f.name}
                              {isMe && (
                                <span className="badge badge-amber" style={{ fontSize: '9px', marginLeft: '6px', padding: '1px 6px' }}>
                                  You
                                </span>
                              )}
                            </h3>
                            <p className="alumni-card-dept">{dept}</p>
                          </div>
                        </div>

                        <div className="alumni-card-details">
                          {f.designation && (
                            <span className="alumni-card-detail">
                              <School size={12} /> {f.designation}
                            </span>
                          )}
                          {f.email && (
                            <a href={`mailto:${f.email}`} className="alumni-card-email">
                              <Mail size={12} /> {f.email}
                            </a>
                          )}
                        </div>

                        <div className="alumni-card-footer">
                          <span className="faculty-chip">
                            <School size={10} /> Faculty
                          </span>
                          {f.linkedin ? (
                            <a
                              href={f.linkedin}
                              target="_blank"
                              rel="noreferrer"
                              className="faculty-card-linkedin"
                              title={`${f.name} on LinkedIn`}
                            >
                              <ExternalLink size={13} />
                            </a>
                          ) : (
                            <span />
                          )}
                          {isMe ? (
                            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Your profile</span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleMessage(f)}
                            >
                              <MessageCircle size={13} /> Message
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
