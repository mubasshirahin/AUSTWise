import React, { useState, useMemo, useRef, useEffect } from 'react';
import { UserCheck, Mail, Phone, Calendar, Search, Users, GraduationCap, Briefcase, X, MoreVertical, Check } from 'lucide-react';
import { facultyData } from '../../data/mockData';
import './SemesterViewWidget.css';
import './FacultyStatus.css';

const STATUS_DENSITY = {
  available: 'is-emerald',
  away: 'is-cyan',
  busy: 'is-amber',
  'in-class': 'is-rose',
  offline: 'is-rose',
};

function getStatusText(status) {
  switch (status) {
    case 'available': return 'Available (in office)';
    case 'away': return 'Away (out of campus)';
    case 'busy': return 'Busy (meetings)';
    case 'in-class': return 'In a Class Lecture';
    default: return 'Offline';
  }
}

export default function FacultyStatus() {
  const [searchTerm, setSearchTerm] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState('default'); // default | available-first
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  const filteredFaculty = useMemo(() => {
    let list = facultyData.filter(fac =>
      fac.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fac.expertise.some(e => e.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    if (sortBy === 'available-first') {
      const order = { available: 0, busy: 1, 'in-class': 2, away: 3, offline: 4 };
      list = [...list].sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4));
    }
    return list;
  }, [searchTerm, sortBy]);

  const counts = useMemo(() => {
    const c = { available: 0, inClass: 0, busy: 0, away: 0, offline: 0 };
    facultyData.forEach(fac => {
      if (fac.status === 'available') c.available += 1;
      else if (fac.status === 'in-class') c.inClass += 1;
      else if (fac.status === 'busy') c.busy += 1;
      else if (fac.status === 'away') c.away += 1;
      else c.offline += 1;
    });
    return c;
  }, []);

  return (
    <div className="glass-card-static schedule-widget sv-widget faculty-widget animate-fadeInUp">

      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <UserCheck size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Campus</span>
            <div className="schedule-title">Faculty Status</div>
            <span className="schedule-subtitle">
              {facultyData.length > 0
                ? `${filteredFaculty.length}/${facultyData.length} faculty shown`
                : 'Office hours & availability'}
            </span>
          </div>
        </div>

        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="schedule-stat-value">{counts.available}</span>
              <span className="schedule-stat-label">Available</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">{counts.inClass + counts.busy}</span>
              <span className="schedule-stat-label">In Class / Busy</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">{counts.away + counts.offline}</span>
              <span className="schedule-stat-label">Away</span>
            </div>
          </div>
        </div>

        <div className="schedule-actions">
          <div className="faculty-search">
            <Search size={13} className="faculty-search-icon" />
            <input
              type="text"
              placeholder="Search name or domain…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="faculty-search-input"
            />
            {searchTerm && (
              <button className="faculty-search-clear" onClick={() => setSearchTerm('')} title="Clear search">
                <X size={12} />
              </button>
            )}
          </div>
          <div className="export-dropdown" ref={menuRef}>
            <button className="schedule-nav-btn" onClick={() => setMenuOpen((o) => !o)} title="Options" aria-haspopup="true" aria-expanded={menuOpen}>
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div className="export-menu" role="menu">
                <button
                  className={`export-menu-item${sortBy === 'available-first' ? ' menu-active' : ''}`}
                  onClick={() => { setSortBy((s) => (s === 'available-first' ? 'default' : 'available-first')); setMenuOpen(false); }}
                  role="menuitem"
                >
                  <GraduationCap size={14} />
                  {sortBy === 'available-first' ? 'Default order' : 'Available first'}
                  {sortBy === 'available-first' && <Check size={14} className="menu-check" />}
                </button>
                <div className="export-menu-sep" />
                <div className="export-menu-item" style={{ cursor: 'default', color: 'var(--text-tertiary)' }}>
                  <Users size={14} /> {facultyData.length} faculty listed
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {/* ── Faculty grid ── */}
      {filteredFaculty.length === 0 ? (
        <div className="sv-empty">
          <Briefcase size={38} className="sv-empty-icon" />
          <h3>{facultyData.length === 0 ? 'No Faculty Data' : 'No Matching Faculty'}</h3>
          <p>
            {facultyData.length === 0
              ? 'Faculty office hours and availability will appear here once they are published.'
              : 'Try a different name or domain keyword.'}
          </p>
        </div>
      ) : (
        <div className="faculty-grid">
          {filteredFaculty.map(fac => (
            <div key={fac.id} className={`sv-cell faculty-cell ${STATUS_DENSITY[fac.status] || 'is-rose'}`}>
              <span className={`sv-count${(fac.expertise?.length || 0) >= 3 ? ' hot' : ''}`}>
                {fac.expertise?.length || 0}
              </span>

              <div className="faculty-cell-head">
                <div className="faculty-cell-id">
                  <span className={`faculty-status-dot ${fac.status === 'available' ? 'online' : fac.status === 'away' ? 'away' : 'busy'}`} />
                  {fac.status === 'available' ? 'In office' : getStatusText(fac.status)}
                </div>
              </div>

              <div className="sv-cell-title">{fac.name}</div>
              <div className="sv-cell-sub">
                {fac.designation} · Dept of {fac.department}
              </div>

              <div className="faculty-cell-meta">
                <span className="faculty-meta-item"><Calendar size={12} /> Office {fac.room}</span>
                <span className="faculty-meta-item"><Calendar size={12} /> {fac.officeHours}</span>
              </div>

              <div className="faculty-cell-foot">
                <span className="faculty-meta-item"><Mail size={12} /> {fac.email}</span>
                {fac.phone && <span className="faculty-meta-item"><Phone size={12} /> {fac.phone}</span>}
              </div>

              {(fac.expertise?.length || 0) > 0 && (
                <div className="faculty-tags">
                  {fac.expertise.map(exp => (
                    <span key={exp} className="faculty-tag">{exp}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
