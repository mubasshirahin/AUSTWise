import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  School, Search, Mail, ExternalLink, MessageCircle, Phone, Building2,
  ChevronDown,
} from 'lucide-react';
import { getAllAccounts, getInitials } from '../../utils/authStorage';
import { getCachedMembers, refreshMemberDirectory } from '../../utils/memberDirectory';
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
function mapFacultyList(serverMembers = []) {
  const byId = new Map();
  const push = (m) => {
    if (!m || !String(m.name || '').trim()) return;
    const id = String(m.id || '').trim();
    if (id) byId.set(id, m);
  };

  // Server directory profiles are cached locally for an immediate first paint.
  serverMembers.filter((m) => m.role === 'faculty' || m.roles?.includes('faculty')).forEach(push);

  // 2) Registered accounts stored locally (works offline / server down)
  try {
    getAllAccounts()
      .filter((a) => a.role === 'faculty')
      .forEach((a) => {
        const existing = byId.get(a.id);
        if (existing) {
          // Merge contact fields the member list omits.
          byId.set(a.id, { ...existing, email: existing.email || a.email || '', phone: existing.phone || a.phone || '', linkedin: existing.linkedin || a.linkedin || '' });
        } else {
          push(a);
        }
      });
  } catch { /* best effort */ }

  return [...byId.values()].map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email || '',
    phone: m.phone || '',
    avatar: m.avatar || null,
    initials: m.initials || getInitials(m.name),
    department: m.department || 'Department not set',
    designation: m.designation || '',
    linkedin: m.linkedin || '',
  }));
}

async function loadFacultyList() {
  const members = await refreshMemberDirectory();
  return mapFacultyList(members.length ? members : getCachedMembers());
}

export default function FacultyDirectory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [faculty, setFaculty] = useState(() => mapFacultyList(getCachedMembers()));
  const [loading, setLoading] = useState(() => getCachedMembers().length === 0);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDept, setActiveDept] = useState('all');
  // Department accordion. Deliberately NOT persisted: leaving the page (tab
  // switch or route change) unmounts this component, so everything comes back
  // collapsed instead of remembering a wall of open sections.
  const [openDepts, setOpenDepts] = useState({});

  const isGuest = user?.role === 'guest' || !user?.id;

  const toggleDept = (dept) => {
    setOpenDepts((previous) => ({ ...previous, [dept]: !previous[dept] }));
  };

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

  // Apply department + search filters.
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return faculty.filter((f) => {
      const matchesDept = activeDept === 'all' || f.department === activeDept;
      const matchesSearch =
        !term ||
        f.name.toLowerCase().includes(term) ||
        f.designation.toLowerCase().includes(term) ||
        f.email.toLowerCase().includes(term) ||
        f.phone.toLowerCase().includes(term) ||
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
          <div className="schedule-icon-tile">
            <School size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Community</span>
            <div className="schedule-title">Faculty Directory</div>
            <span className="schedule-subtitle">Find AUST faculty members.</span>
          </div>
        </div>

        <div className="schedule-masthead-center" />

        <div className="schedule-actions student-dir-controls">
          <select
            className="input alumni-select"
            value={activeDept}
            onChange={(event) => setActiveDept(event.target.value)}
            aria-label="Filter faculty by department"
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept} ({faculty.filter((member) => member.department === dept).length})
              </option>
            ))}
          </select>
          <div className="search-box alumni-search student-dir-search">
            <Search size={14} aria-hidden="true" />
            <input
              type="text"
              placeholder="Search name / designation"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search faculty"
            />
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" style={{ marginTop: 0 }} />

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
        <div className="student-dir-content alumni-groups">
          {deptGroups.map(({ dept, members }) => {
            // Searching or picking one department auto-reveals the matching
            // group, so results never hide behind a collapsed header.
            const isOpen = Boolean(openDepts[dept])
              || Boolean(searchTerm.trim())
              || activeDept !== 'all';

            return (
              <div key={dept} className="student-dir-dept-section faculty-dept alumni-dept-group">
                <div className="alumni-batch-header">
                <button
                  type="button"
                  className="student-dir-dept-header alumni-group-toggle"
                  onClick={() => toggleDept(dept)}
                  aria-expanded={isOpen}
                >
                    <ChevronDown size={16} className={`student-dir-dept-chevron alumni-group-chevron${isOpen ? ' is-expanded' : ''}`} />
                  <Building2 size={16} className="student-dir-dept-icon alumni-department-icon" />
                  <span className="student-dir-dept-info">
                    <span className="student-dir-dept-name alumni-department-name" role="heading" aria-level="3">
                      {dept}
                    </span>
                  </span>
                </button>
                </div>

                {isOpen && (
                  <div className="faculty-dir-dept-body">
                    <div className="alumni-grid-inner">
                      {members.map((f) => {
                        const isMe = f.id === user?.id;
                        return (
                          <div key={f.id} className="alumni-card">
                            <div className="alumni-card-top">
                              <button
                                type="button"
                                className="avatar"
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  flexShrink: 0,
                                  background: 'var(--accent-amber-glow)',
                                  color: 'var(--accent-amber)',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  overflow: 'hidden',
                                  padding: 0,
                                  border: 'none',
                                  cursor: 'pointer',
                                }}
                                onClick={() => navigate(`/members/${f.id}`)}
                                title={`View ${f.name}'s profile / ID`}
                                aria-label={`View ${f.name}'s profile`}
                              >
                                {f.avatar ? (
                                  <img src={f.avatar} alt="" style={AVATAR_IMG_STYLE} />
                                ) : f.initials}
                              </button>
                              <div className="alumni-card-info">
                                <h3 className="alumni-card-name">
                                  {f.name}
                                  {isMe && (
                                    <span className="badge badge-amber" style={{ fontSize: '9px', marginLeft: '6px', padding: '1px 6px' }}>
                                      You
                                    </span>
                                  )}
                                </h3>
                                {f.designation && (
                                  <p className="alumni-card-dept" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    <School size={11} /> {f.designation}
                                  </p>
                                )}
                                <p className="alumni-card-dept">{DEPT_FULL_NAMES[dept] || dept}</p>
                              </div>
                            </div>

                            <div className="alumni-card-details">
                              <span className="alumni-card-detail">
                                <Mail size={12} /> {f.email || ''}
                              </span>
                              <span className="alumni-card-detail">
                                <Phone size={12} /> {f.phone || ''}
                              </span>
                            </div>

                            <div className="alumni-card-footer">
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
