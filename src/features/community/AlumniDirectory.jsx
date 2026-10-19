import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Mail, Building2, GraduationCap, Users, MessageCircle, Radio } from 'lucide-react';
import { getAlumniAccounts, setOpenForTalk } from '../../utils/authStorage';
import { useAuth } from '../../context/AuthContext';

export default function AlumniDirectory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [alumni, setAlumni] = useState(() => getAlumniAccounts());

  const isAlumniViewer = user?.role === 'alumni' || user?.role === 'alumni_with_carry';
  const isGuest = user?.role === 'guest' || !user?.id;

  // Registered alumni (role === 'alumni'). Reloaded after the
  // "Open for Talk" toggle so the change reflects immediately.
  const refreshAlumni = () => setAlumni(getAlumniAccounts());

  const myOpenForTalk = alumni.find((a) => a.id === user?.id)?.openForTalk ?? false;

  const toggleMyAvailability = () => {
    const next = !myOpenForTalk;
    setOpenForTalk(user.id, next);
    refreshAlumni();
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

  // Group by batch, then order groups so the OLDEST batch (smallest number) is
  // on top. Alumni without a batch number sink to the bottom.
  const batchGroups = useMemo(() => {
    const groups = new Map(); // batchNo -> { batchNo, label, members }
    for (const a of filtered) {
      const key = a.batchNo || 'NA';
      if (!groups.has(key)) {
        groups.set(key, {
          batchNo: a.batchNo ? Number(a.batchNo) : Infinity,
          label: a.batchNo ? `Batch ${a.batchNo}` : 'Batch not specified',
          members: [],
        });
      }
      groups.get(key).members.push(a);
    }
    return Array.from(groups.values()).sort((x, y) => x.batchNo - y.batchNo);
  }, [filtered]);

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
            <span className="schedule-subtitle">Registered AUST graduates, grouped by batch — oldest batches first</span>
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
            <input
              type="text"
              placeholder="Search by name / company..."
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
                Open for Talk {myOpenForTalk ? 'ON' : 'OFF'}
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                {myOpenForTalk
                  ? 'Students and other alumni can message you directly from this directory.'
                  : 'Turn this on so others can message you from the Alumni Directory.'}
              </p>
            </div>
          </div>
          <div
            className={`toggle-switch ${myOpenForTalk ? 'active' : ''}`}
            onClick={toggleMyAvailability}
            role="switch"
            aria-checked={myOpenForTalk}
            aria-label="Toggle Open for Talk"
          />
        </div>
      )}

      {alumni.length === 0 ? (
        <div className="alumni-empty-state">
          <GraduationCap size={40} style={{ opacity: 0.5, color: 'var(--text-tertiary)' }} />
          <h3>No alumni registered yet</h3>
          <p>Alumni who sign up with an alumni account will appear here, grouped by batch.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="alumni-empty-state" style={{ paddingTop: 'var(--sp-10)' }}>
          <Search size={36} style={{ opacity: 0.5, color: 'var(--text-tertiary)' }} />
          <p>No alumni match your filters.</p>
        </div>
      ) : (
        <div className="alumni-groups">
          {batchGroups.map((group) => (
            <div key={group.label}>
              {/* Batch header */}
              <div className="alumni-batch-header">
                <span className="badge badge-amber alumni-batch-badge">
                  {group.label}
                </span>
                <span className="alumni-batch-count">
                  <Users size={12} /> {group.members.length} alumni
                </span>
              </div>

              {/* Alumni cards for this batch */}
              <div className="alumni-grid-inner">
                {group.members.map((al) => {
                  const isMe = al.id === user?.id;
                  const canMessage = al.openForTalk && !isMe && !isGuest;
                  return (
                    <div key={al.id} className="alumni-card">
                      <div className="alumni-card-top">
                        <div className="avatar" style={{ width: '40px', height: '40px', flexShrink: 0 }}>
                          {al.avatar ? (
                            <img src={al.avatar} alt="" />
                          ) : al.initials}
                        </div>
                        <div className="alumni-card-info">
                          <h3 className="alumni-card-name">
                            {al.name}
                            {isMe && (
                              <span className="badge badge-amber" style={{ fontSize: '9px', marginLeft: '6px', padding: '1px 6px' }}>
                                You
                              </span>
                            )}
                          </h3>
                          <p className="alumni-card-dept">
                            {al.department}
                            {al.graduationYear ? ` · Class of ${al.graduationYear}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="alumni-card-details">
                        {al.designation && (
                          <span className="alumni-card-detail">
                            <GraduationCap size={12} /> {al.designation}
                          </span>
                        )}
                        {al.company && (
                          <span className="alumni-card-detail">
                            <Building2 size={12} /> {al.company}
                          </span>
                        )}
                        {al.email && (
                          <a href={`mailto:${al.email}`} className="alumni-card-email">
                            <Mail size={12} /> {al.email}
                          </a>
                        )}
                      </div>

                      <div className="alumni-card-footer">
                        {al.openForTalk ? (
                          <span className="alumni-card-status alumni-card-status-online">
                            <Radio size={11} /> Open for Talk
                          </span>
                        ) : (
                          <span className="alumni-card-status alumni-card-status-offline">Not available</span>
                        )}

                        {canMessage ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleMessage(al)}
                          >
                            <MessageCircle size={13} /> Message
                          </button>
                        ) : isMe ? (
                          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Your profile</span>
                        ) : (
                          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Messaging off</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
