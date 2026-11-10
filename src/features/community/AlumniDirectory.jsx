import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, GraduationCap, Users, MessageCircle, Radio } from 'lucide-react';
import { getAlumniAccounts, setOpenForTalk } from '../../utils/authStorage';
import { getCachedMembers, refreshMemberDirectory } from '../../utils/memberDirectory';
import { useAuth } from '../../context/AuthContext';

export default function AlumniDirectory() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [alumni, setAlumni] = useState(() => {
    const cached = getCachedMembers();
    const localById = new Map(getAlumniAccounts().map((account) => [account.id, account]));
    return cached.filter((member) => ['alumni', 'alumni_with_carry'].includes(member.role)
      || member.roles?.some((role) => ['alumni', 'alumni_with_carry'].includes(role)))
      .map((member) => ({ ...localById.get(member.id), ...member }));
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
            return {
              id: m.id,
              name: m.name,
              email: local.email || '',
              department: m.department || local.department || '',
              batchNo: String(m.batchNo || local.batchNo || '').trim(),
              batch: m.batch || local.batch || 'N/A',
              batchName: m.batchName || local.batchName || m.batch || local.batch || '',
              company: m.company || local.company || '',
              designation: m.designation || local.designation || '',
              graduationYear: m.graduationYear || local.graduationYear || '',
              avatar: m.avatar || local.avatar || null,
              initials: m.initials || local.initials || 'AU',
              openForTalk: Boolean(m.openForTalk ?? local.openForTalk),
            };
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
                        <button
                          type="button"
                          className="avatar"
                          style={{ width: '40px', height: '40px', flexShrink: 0, padding: 0, border: 'none', cursor: 'pointer' }}
                          onClick={() => navigate(`/members/${al.id}`)}
                          title={`View ${al.name}'s profile / ID`}
                          aria-label={`View ${al.name}'s profile`}
                        >
                          {al.avatar ? (
                            <img src={al.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : al.initials}
                        </button>
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
          ))}
        </div>
      )}
    </div>
  );
}
