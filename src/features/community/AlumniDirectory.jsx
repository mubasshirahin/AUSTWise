import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, GraduationCap, MessageCircle, Radio, ChevronDown, Building2 } from 'lucide-react';
import { getAlumniAccounts, setOpenForTalk } from '../../utils/authStorage';
import { getCachedMembers, refreshMemberDirectory } from '../../utils/memberDirectory';
import { useAuth } from '../../context/AuthContext';
import { getAlumniEmployment } from '../../utils/alumniEmployment';

const DEPARTMENT_EXPANSION_KEY = 'austwise-alumni-department-expansion';
const DEPARTMENT_FULL_NAMES = {
  CSE: 'Department of Computer Science and Engineering',
  EEE: 'Department of Electrical and Electronic Engineering',
  CE: 'Department of Civil Engineering',
  ME: 'Department of Mechanical Engineering',
  IPE: 'Department of Industrial and Production Engineering',
  TE: 'Department of Textile Engineering',
  ARCH: 'Department of Architecture',
  BBA: 'Department of Business Administration',
};

function getDepartmentLabel(value) {
  const department = String(value || '').trim();
  if (!department) return 'Department not specified';

  const nameOrCode = department.replace(/^department\s+of\s+/i, '').trim();
  return DEPARTMENT_FULL_NAMES[nameOrCode.toUpperCase()] || `Department of ${nameOrCode}`;
}

export default function AlumniDirectory() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [expandedDepartments, setExpandedDepartments] = useState(() => {
    try {
      const stored = sessionStorage.getItem(DEPARTMENT_EXPANSION_KEY);
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  });
  const [alumni, setAlumni] = useState(() => {
    const cached = getCachedMembers();
    const localById = new Map(getAlumniAccounts().map((account) => [account.id, account]));
    return cached.filter((member) => ['alumni', 'alumni_with_carry'].includes(member.role)
      || member.roles?.some((role) => ['alumni', 'alumni_with_carry'].includes(role)))
      .map((member) => {
        const merged = { ...localById.get(member.id), ...member };
        return { ...merged, ...getAlumniEmployment(merged) };
      });
  });

  const isAlumniViewer = user?.role === 'alumni' || user?.role === 'alumni_with_carry';
  const isGuest = user?.role === 'guest' || !user?.id;

  // Accounts are server-side (JWT): localStorage only mirrors the accounts
  // that happen to have signed in on THIS browser, so reading it alone left
  // the directory empty for everyone else. Load the public member directory
  // instead and use the local mirror only for fields the server keeps private
  // (email). Falls back to the local mirror when offline.
  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      try {
        const members = await refreshMemberDirectory();
        if (cancelled) return;
        const localById = new Map(getAlumniAccounts().map((a) => [a.id, a]));
        const rows = members
          .filter((m) => {
            const roles = [m.role, ...(Array.isArray(m.roles) ? m.roles : [])];
            return roles.includes('alumni') || roles.includes('alumni_with_carry');
          })
          .map((m) => {
            const local = localById.get(m.id) || {};
            const merged = {
              id: m.id,
              name: m.name,
              email: local.email || '',
              department: m.department || local.department || '',
              batchNo: String(m.batchNo || local.batchNo || '').trim(),
              batch: m.batch || local.batch || 'N/A',
              batchName: m.batchName || local.batchName || m.batch || local.batch || '',
              company: typeof m.company === 'string' ? m.company : (local.company || ''),
              designation: m.designation || local.designation || '',
              graduationYear: m.graduationYear || local.graduationYear || '',
              avatar: m.avatar || local.avatar || null,
              initials: m.initials || local.initials || 'AU',
              openForTalk: Boolean(m.openForTalk ?? local.openForTalk),
            };
            return { ...merged, ...getAlumniEmployment(merged) };
          })
          .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        if (!cancelled) setAlumni(rows);
      } catch { /* Keep the local directory when offline. */ }
    };

    sync();
    const timer = setInterval(sync, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const myOpenForTalk = alumni.find((a) => a.id === user?.id)?.openForTalk ?? false;

  const toggleMyAvailability = () => {
    if (!user?.id) return;
    const next = !myOpenForTalk;
    setOpenForTalk(user.id, next); // local mirror
    setAlumni((prev) => prev.map((a) => (a.id === user.id ? { ...a, openForTalk: next } : a)));
    updateUser?.({ openForTalk: next }); // persist so other browsers see it
  };

  // Departments that actually have alumni, for the selector.
  const departments = useMemo(() => {
    const set = new Set(alumni.map((a) => a.department).filter(Boolean));
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [alumni]);

  // Apply department + search filters.
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return alumni.filter((a) => {
      const matchesDept = selectedDept === 'All' || a.department === selectedDept;
      const matchesSearch =
        !term ||
        a.name.toLowerCase().includes(term) ||
        a.company.toLowerCase().includes(term) ||
        a.designation.toLowerCase().includes(term) ||
        a.batch.toLowerCase().includes(term);
      return matchesDept && matchesSearch;
    });
  }, [alumni, selectedDept, searchTerm]);

  // Group the filtered alumni by department, with unspecified departments last.
  const departmentGroups = useMemo(() => {
    const groups = new Map();
    for (const a of filtered) {
      const department = String(a.department || '').trim();
      const key = department || '__unspecified__';
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          department,
          label: getDepartmentLabel(department),
          members: [],
        });
      }
      groups.get(key).members.push(a);
    }
    return Array.from(groups.values()).sort((a, b) => {
      if (!a.department) return 1;
      if (!b.department) return -1;
      return a.department.localeCompare(b.department);
    });
  }, [filtered]);

  const toggleDepartment = (departmentId) => {
    setExpandedDepartments((current) => {
      const next = new Set(current);
      if (next.has(departmentId)) next.delete(departmentId);
      else next.add(departmentId);
      return next;
    });
  };

  useEffect(() => {
    try {
      sessionStorage.setItem(DEPARTMENT_EXPANSION_KEY, JSON.stringify([...expandedDepartments]));
    } catch { /* Keep the current view usable when session storage is unavailable. */ }
  }, [expandedDepartments]);

  useEffect(() => () => {
    try {
      sessionStorage.removeItem(DEPARTMENT_EXPANSION_KEY);
    } catch { /* Ignore storage cleanup failures. */ }
  }, []);

  const handleMessage = (al) => {
    if (isGuest) {
      navigate('/login');
      return;
    }
    navigate(`/messages?peer=${al.id}`);
  };

  return (
    <div className="alumni-page">
      {/* Header section */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <GraduationCap size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Community</span>
            <div className="schedule-title">Alumni Corner</div>
            <span className="schedule-subtitle">Registered AUST graduates</span>
          </div>
        </div>

        <div className="schedule-masthead-center" />

        <div className="schedule-actions">
          <select
            className="input alumni-select"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept === 'All' ? 'All Departments' : dept}
              </option>
            ))}
          </select>

          <div className="search-box alumni-search">
            <Search size={12} aria-hidden="true" />
            <input
              type="text"
              placeholder="Search name or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" style={{ marginTop: 0 }} />

      {/* Alumni self-service: toggle availability for direct messages. */}
      {isAlumniViewer && (
        <div
          className="open-for-talk-banner"
          style={{
            borderColor: myOpenForTalk ? 'var(--accent-amber)' : 'var(--border-primary)',
            background: myOpenForTalk ? 'var(--accent-amber-glow)' : 'var(--bg-input)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="open-for-talk-icon"
              style={{
                background: myOpenForTalk ? 'var(--accent-amber)' : 'var(--bg-secondary)',
                color: myOpenForTalk ? '#fff' : 'var(--text-tertiary)',
              }}
            >
              <Radio size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '14px', margin: 0, fontWeight: 700 }}>
                Open for Messages {myOpenForTalk ? 'ON' : 'OFF'}
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                {myOpenForTalk
                  ? 'Students and other alumni can message you directly from this directory.'
                  : 'Turn this on to let others message you from the Alumni Directory.'}
              </p>
            </div>
          </div>
          <div
            className={`toggle-switch ${myOpenForTalk ? 'active' : ''}`}
            onClick={toggleMyAvailability}
            role="switch"
            aria-checked={myOpenForTalk}
            aria-label="Toggle Open for Messages"
          />
        </div>
      )}

      {alumni.length === 0 ? (
        <div className="alumni-empty-state">
          <GraduationCap size={40} style={{ opacity: 0.5, color: 'var(--text-tertiary)' }} />
          <h3>No alumni registered yet</h3>
          <p>Alumni who sign up with an alumni account will appear here, grouped by department.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="alumni-empty-state" style={{ paddingTop: 'var(--sp-10)' }}>
          <Search size={36} style={{ opacity: 0.5, color: 'var(--text-tertiary)' }} />
          <p>No alumni match your filters.</p>
        </div>
      ) : (
        <div className="alumni-groups">
          {departmentGroups.map((group) => {
            const expanded = expandedDepartments.has(group.id);
            const contentId = `alumni-department-${encodeURIComponent(group.id)}`;
            return (
              <div key={group.id}>
                {/* Department header */}
                <div className="alumni-batch-header">
                  <button
                    type="button"
                    className="alumni-group-toggle"
                    aria-expanded={expanded}
                    aria-controls={contentId}
                    onClick={() => toggleDepartment(group.id)}
                  >
                    <Building2 className="alumni-department-icon" size={16} aria-hidden="true" />
                    <span className="alumni-department-name">{group.label}</span>
                    <span className="alumni-department-count">{group.members.length}</span>
                    <ChevronDown className={`alumni-group-chevron${expanded ? ' is-expanded' : ''}`} size={16} aria-hidden="true" />
                  </button>
                </div>

                {/* Alumni cards for this department */}
                <div id={contentId} className="alumni-grid-inner" hidden={!expanded}>
                  {group.members.map((al) => {
                  const isMe = al.id === user?.id;
                  const canMessage = al.openForTalk && !isMe && !isGuest;
                  return (
                    <div key={al.id} className="alumni-card">
                      <div className="alumni-card-top">
                        <div className="alumni-avatar-preview">
                          <button
                            type="button"
                            className="avatar"
                            style={{ width: '40px', height: '40px', flexShrink: 0, padding: 0, border: 'none', cursor: 'pointer' }}
                            onClick={() => navigate(`/members/${al.id}`)}
                            title={`View ${al.name}'s profile / ID`}
                            aria-label={`View ${al.name}'s profile`}
                            aria-describedby={`alumni-profile-preview-${encodeURIComponent(String(al.id))}`}
                          >
                            {al.avatar ? (
                              <img src={al.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : al.initials}
                          </button>
                          <div
                            id={`alumni-profile-preview-${encodeURIComponent(String(al.id))}`}
                            className="alumni-profile-preview"
                            role="tooltip"
                          >
                            <div className="alumni-profile-preview-head">
                              <span className="alumni-profile-preview-avatar">
                                {al.avatar ? (
                                  <img src={al.avatar} alt="" />
                                ) : al.initials}
                              </span>
                              <span className="alumni-profile-preview-identity">
                                <strong>{al.name}</strong>
                                <span>Alumni</span>
                              </span>
                            </div>
                            <div className="alumni-profile-preview-stats">
                              <div><span>Department</span><strong>{getDepartmentLabel(al.department)}</strong></div>
                              {(al.batchName || al.batch) && <div><span>Batch</span><strong>{al.batchName || al.batch}</strong></div>}
                              {al.graduationYear && <div><span>Graduated</span><strong>{al.graduationYear}</strong></div>}
                              {al.designation && <div><span>Designation</span><strong>{al.designation}</strong></div>}
                              {al.company && <div><span>Company</span><strong>{al.company}</strong></div>}
                            </div>
                          </div>
                        </div>
                        <div className="alumni-card-info">
                          <h3 className="alumni-card-name">
                            {al.name}
                            {isMe && <span className="alumni-card-you">you</span>}
                          </h3>
                          <p className="alumni-card-dept">
                            {al.department}
                            {al.batchName ? ` · ${al.batchName}` : ''}
                            {al.graduationYear ? ` · ${al.graduationYear}` : ''}
                          </p>
                          {(al.designation || al.company || al.email) && (
                            <p className="alumni-card-meta">
                              {[al.designation, al.company].filter(Boolean).join(' · ')}
                              {al.email && (
                                <>
                                  {(al.designation || al.company) && ' · '}
                                  <a href={`mailto:${al.email}`} className="alumni-card-email" title={al.email}>
                                    {al.email}
                                  </a>
                                </>
                              )}
                            </p>
                          )}
                        </div>

                        <div className="alumni-card-actions">
                          {canMessage && (
                            <button
                              type="button"
                              className="alumni-card-msg"
                              onClick={() => handleMessage(al)}
                              title={`Message ${al.name}`}
                              aria-label={`Message ${al.name}`}
                            >
                              <MessageCircle size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
