import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Users, Search, Clock, MapPin, Mail, ChevronDown,
  UserCheck, UserX, AlertCircle, Zap, Edit3, Plus, Trash2,
  Calendar, BookOpen, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getAllFacultyWithStatus,
  getFacultyProfiles,
  getFacultyRoutine,
  saveFacultyRoutine,
  setFacultyStatus,
  getComputedFacultyStatus,
  getFacultyDepartments,
} from '../../utils/facultyStorage';
import './FacultyStatus.css';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const ALL_DEPTS = '__all__';

// ─── Color palette for avatar backgrounds ────────────────────────────────
const AVATAR_COLORS = [
  '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
  '#10b981', '#f97316', '#ec4899', '#6366f1',
  '#14b8a6', '#eab308', '#84cc16', '#a855f7',
  '#0ea5e9', '#f43f5e', '#22c55e', '#d946ef',
];

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name) {
  return (name || '')
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('') || '?';
}

// ─── Status display helpers ──────────────────────────────────────────────
function getStatusIcon(status) {
  switch (status) {
    case 'available': return UserCheck;
    case 'busy': return UserX;
    case 'away': return AlertCircle;
    default: return Users;
  }
}

// ─── Time parsing helper ────────────────────────────────────────────────
function parseTimeRange(timeStr) {
  const parts = timeStr.split('-').map(s => s.trim());
  if (parts.length !== 2) return null;
  const parse = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  return [parse(parts[0]), parse(parts[1])];
}

function isCurrentClass(timeStr) {
  const range = parseTimeRange(timeStr);
  if (!range) return false;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= range[0] && nowMin < range[1];
}

// ─── Sub-component: Faculty Routine Viewer ──────────────────────────────
function FacultyRoutineView({ facultyId }) {
  const routine = getFacultyRoutine(facultyId);
  const [activeDay, setActiveDay] = useState(() => {
    const todayIdx = new Date().getDay();
    return todayIdx >= 0 && todayIdx <= 4 ? WEEKDAYS[todayIdx] : WEEKDAYS[0];
  });

  const todayName = WEEKDAYS[new Date().getDay()] || WEEKDAYS[0];
  const dayClasses = routine?.[activeDay] || [];

  if (!routine || Object.values(routine).every(d => d.length === 0)) {
    return (
      <div className="fs-routine-empty">
        <BookOpen size={14} style={{ opacity: 0.5, marginBottom: 4 }} />
        <div>No routine set for this faculty member.</div>
      </div>
    );
  }

  return (
    <div>
      {/* Day tabs */}
      <div className="fs-routine-day-tabs">
        {WEEKDAYS.map(day => (
          <button
            key={day}
            className={`fs-routine-day-tab ${activeDay === day ? 'active' : ''} ${day === todayName ? 'today' : ''}`}
            onClick={() => setActiveDay(day)}
          >
            {day.slice(0, 3)}
          </button>
        ))}
      </div>

      {/* Class list */}
      {dayClasses.length === 0 ? (
        <div className="fs-routine-empty">
          No classes on {activeDay}
        </div>
      ) : (
        <ul className="fs-routine-list">
          {dayClasses.map((cls, i) => (
            <li
              key={i}
              className={`fs-routine-item ${isCurrentClass(cls.time) ? 'now' : ''}`}
            >
              <span className="fs-routine-time">{cls.time}</span>
              <div className="fs-routine-course">
                <div className="fs-routine-course-code">{cls.course || cls.name}</div>
                {cls.name && cls.course !== cls.name && (
                  <div className="fs-routine-course-name">{cls.name}</div>
                )}
              </div>
              <span className="fs-routine-room">
                <MapPin size={10} />
                {cls.room}
              </span>
              {cls.type && (
                <span className={`fs-routine-type ${cls.type}`}>{cls.type}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Sub-component: Faculty Routine Editor (for own profile) ────────────
function FacultyRoutineEditor({ facultyId, onClose }) {
  const routine = getFacultyRoutine(facultyId) || {};
  const [editDay, setEditDay] = useState(WEEKDAYS[0]);
  const [newClass, setNewClass] = useState({ time: '', course: '', name: '', room: '', type: 'Theory' });

  const daysWithClasses = editDay ? (routine[editDay] || []) : [];

  const addClass = () => {
    if (!newClass.time || !newClass.course) return;
    const updated = { ...routine };
    if (!updated[editDay]) updated[editDay] = [];
    updated[editDay] = [...updated[editDay], { ...newClass, id: Date.now() }];
    saveFacultyRoutine(facultyId, updated);
    setNewClass({ time: '', course: '', name: '', room: '', type: 'Theory' });
  };

  const removeClass = (index) => {
    const updated = { ...routine };
    if (updated[editDay]) {
      updated[editDay] = updated[editDay].filter((_, i) => i !== index);
      saveFacultyRoutine(facultyId, updated);
    }
  };

  return (
    <div className="fs-routine-edit-area">
      <div className="fs-routine-day-tabs" style={{ marginTop: 0 }}>
        {WEEKDAYS.map(day => (
          <button
            key={day}
            className={`fs-routine-day-tab ${editDay === day ? 'active' : ''}`}
            onClick={() => setEditDay(day)}
          >
            {day.slice(0, 3)}
          </button>
        ))}
      </div>

      {/* Existing classes for the selected day */}
      <ul className="fs-routine-list" style={{ marginBottom: 'var(--sp-3)' }}>
        {daysWithClasses.length === 0 ? (
          <div className="fs-routine-empty">No classes — add one below</div>
        ) : (
          daysWithClasses.map((cls, i) => (
            <li key={i} className="fs-routine-item" style={{ cursor: 'default' }}>
              <span className="fs-routine-time">{cls.time}</span>
              <div className="fs-routine-course">
                <div className="fs-routine-course-code">{cls.course || cls.name}</div>
                {cls.name && cls.name !== cls.course && (
                  <div className="fs-routine-course-name">{cls.name}</div>
                )}
              </div>
              <span className="fs-routine-room">
                <MapPin size={10} />
                {cls.room}
              </span>
              {cls.type && (
                <span className={`fs-routine-type ${cls.type}`}>{cls.type}</span>
              )}
              <button
                onClick={() => removeClass(i)}
                style={{
                  background: 'none', border: 'none', color: 'var(--accent-rose)',
                  cursor: 'pointer', padding: '2px', flexShrink: 0
                }}
                title="Remove class"
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))
        )}
      </ul>

      {/* Add new class */}
      <div className="fs-routine-edit-row">
        <label>Time</label>
        <input
          type="text"
          placeholder="e.g. 08:00 - 09:40"
          value={newClass.time}
          onChange={e => setNewClass({ ...newClass, time: e.target.value })}
        />
      </div>
      <div className="fs-routine-edit-row">
        <label>Course</label>
        <input
          type="text"
          placeholder="e.g. CSE 3101"
          value={newClass.course}
          onChange={e => setNewClass({ ...newClass, course: e.target.value })}
        />
      </div>
      <div className="fs-routine-edit-row">
        <label>Name</label>
        <input
          type="text"
          placeholder="Course name (optional)"
          value={newClass.name}
          onChange={e => setNewClass({ ...newClass, name: e.target.value })}
        />
      </div>
      <div className="fs-routine-edit-row">
        <label>Room</label>
        <input
          type="text"
          placeholder="e.g. Room 301"
          value={newClass.room}
          onChange={e => setNewClass({ ...newClass, room: e.target.value })}
        />
      </div>
      <div className="fs-routine-edit-row">
        <label>Type</label>
        <select
          value={newClass.type}
          onChange={e => setNewClass({ ...newClass, type: e.target.value })}
          className="fs-manual-status-select"
        >
          <option value="Theory">Theory</option>
          <option value="Lab">Lab</option>
        </select>
      </div>

      <div className="fs-routine-edit-actions">
        <button className="fs-routine-edit-btn add" onClick={addClass}>
          <Plus size={12} style={{ marginRight: 4 }} />
          Add Class
        </button>
        <button className="fs-routine-edit-btn delete" onClick={onClose}>
          Done Editing
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────
export default function FacultyStatus() {
  const { user, isAuthenticated } = useAuth();

  // Is the current logged-in user a faculty member?
  const isFacultyUser = isAuthenticated && user?.role === 'faculty';
  const currentFacultyId = isFacultyUser
    ? getFacultyProfiles().find(f => f.email === user?.email)?.id || null
    : null;

  // ─── State ──────────────────────────────────────────────────────────
  const [facultyList, setFacultyList] = useState(() => getAllFacultyWithStatus());
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState(ALL_DEPTS);
  const [expandedCard, setExpandedCard] = useState(null);
  const [editingRoutine, setEditingRoutine] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Re-compute statuses periodically (every 30 seconds) to keep "now" indicators fresh
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(k => k + 1);
      setFacultyList(getAllFacultyWithStatus());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const refresh = useCallback(() => {
    setFacultyList(getAllFacultyWithStatus());
    setRefreshKey(k => k + 1);
  }, []);

  const departments = useMemo(() => getFacultyDepartments(), [refreshKey]);

  // ─── Filters ────────────────────────────────────────────────────────
  const filteredFaculty = useMemo(() => {
    return facultyList.filter(f => {
      const matchesSearch = !searchTerm ||
        f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.expertise.some(e => e.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesDept = deptFilter === ALL_DEPTS || f.department === deptFilter;
      return matchesSearch && matchesDept;
    });
  }, [facultyList, searchTerm, deptFilter]);

  // ─── Stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const available = facultyList.filter(f => f.status === 'available').length;
    const busy = facultyList.filter(f => f.status === 'busy').length;
    const away = facultyList.filter(f => f.status === 'away').length;
    const offline = facultyList.filter(f => f.status === 'offline' || !f.status).length;
    return { total: facultyList.length, available, busy, away, offline };
  }, [facultyList]);

  // ─── Handlers ──────────────────────────────────────────────────────
  const handleToggleMode = (facultyId) => {
    const current = getComputedFacultyStatus(facultyId);
    const newMode = current.statusMode === 'auto' ? 'manual' : 'auto';
    setFacultyStatus(facultyId, {
      statusMode: newMode,
      ...(newMode === 'manual' ? { manualStatus: 'available' } : {}),
    });
    refresh();
  };

  const handleManualStatusChange = (facultyId, newStatus) => {
    setFacultyStatus(facultyId, { statusMode: 'manual', manualStatus: newStatus });
    refresh();
  };

  const handleCardClick = (facultyId) => {
    if (expandedCard === facultyId) {
      setExpandedCard(null);
      setEditingRoutine(false);
    } else {
      setExpandedCard(facultyId);
      setEditingRoutine(false);
    }
  };

  const handleRoutineSave = () => {
    refresh();
  };

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className="fs-page animate-fadeIn">
      {/* ─── Hero ─── */}
      <div className="fs-hero">
        <div className="fs-hero-bg">
          <div className="fs-hero-grid" />
          <div className="fs-hero-orb fs-hero-orb-1" />
          <div className="fs-hero-orb fs-hero-orb-2" />
        </div>
        <div className="fs-hero-shimmer" />
        <div className="fs-hero-content">
          <div className="fs-hero-title-row">
            <div className="fs-hero-icon">
              <Users size={20} />
            </div>
            <div>
              <h1 className="fs-hero-title">
                <span className="fs-hero-name">Faculty Status</span>
              </h1>
              <p className="fs-hero-subtitle">
                Real-time faculty availability — auto-detected from class schedules.
                Click any card to view their weekly routine.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Stats Bar ─── */}
      <div className="fs-stats-bar">
        <span className="fs-stat">
          <span className="fs-stat-dot available" />
          <strong>{stats.available}</strong> Available
        </span>
        <span className="fs-stat">
          <span className="fs-stat-dot busy" />
          <strong>{stats.busy}</strong> Busy
        </span>
        <span className="fs-stat">
          <span className="fs-stat-dot away" />
          <strong>{stats.away}</strong> Away
        </span>
        <span className="fs-stat">
          <span className="fs-stat-dot offline" />
          <strong>{stats.offline}</strong> Offline
        </span>
        <span className="fs-stat" style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }}>
          <RefreshCw size={12} />
          Auto-refreshes every 30s
        </span>
      </div>

      {/* ─── Controls ─── */}
      <div className="fs-controls">
        <div className="fs-search-wrap">
          <Search size={14} className="fs-search-icon" />
          <input
            type="text"
            className="fs-search-input"
            placeholder="Search faculty by name, department, or expertise..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="fs-filter-chips">
          <button
            className={`fs-filter-chip ${deptFilter === ALL_DEPTS ? 'active' : ''}`}
            onClick={() => setDeptFilter(ALL_DEPTS)}
          >
            All
          </button>
          {departments.map(dept => (
            <button
              key={dept}
              className={`fs-filter-chip ${deptFilter === dept ? 'active' : ''}`}
              onClick={() => setDeptFilter(dept)}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Faculty Cards Grid ─── */}
      {filteredFaculty.length === 0 ? (
        <div className="fs-empty">
          <Search size={32} />
          <h3>No faculty found</h3>
          <p>Try adjusting your search or filter criteria.</p>
        </div>
      ) : (
        <div className="fs-grid">
          {filteredFaculty.map(fac => {
            const StatusIcon = getStatusIcon(fac.status);
            const isExpanded = expandedCard === fac.id;
            const isOwnCard = isFacultyUser && currentFacultyId === fac.id;

            return (
              <div
                key={fac.id}
                className={`fs-card ${isExpanded ? 'expanded' : ''}`}
                onClick={() => handleCardClick(fac.id)}
              >
                {/* Color bar */}
                <div className={`fs-card-status-bar ${fac.status}`} />

                {/* Header */}
                <div className="fs-card-header">
                  <div
                    className="fs-card-avatar"
                    style={{ background: getAvatarColor(fac.name) }}
                  >
                    {getInitials(fac.name)}
                  </div>
                  <div className="fs-card-info">
                    <div className="fs-card-name">{fac.name}</div>
                    <div className="fs-card-dept">
                      {fac.designation} · {fac.department}
                    </div>
                  </div>
                  <div className={`fs-card-status-pill ${fac.status}`}>
                    <span className={`fs-card-status-dot ${fac.status}`} />
                    {fac.label || fac.status}
                  </div>
                </div>

                {/* Body summary (always visible) */}
                <div className="fs-card-body">
                  <div className="fs-card-details">
                    <div className="fs-card-details-row">
                      <MapPin />
                      <span>Office <strong>{fac.room}</strong></span>
                    </div>
                    <div className="fs-card-details-row">
                      <Mail />
                      <span>{fac.email}</span>
                    </div>
                    <div className="fs-card-details-row">
                      <Calendar />
                      <span>Hours: <strong>{fac.officeHours}</strong></span>
                    </div>
                  </div>

                  {/* Next free / busy info */}
                  {fac.status === 'busy' && fac.currentClass ? (
                    <div className="fs-next-free busy">
                      <StatusIcon size={12} />
                      <span>
                        In class: <strong>{fac.currentClass.course}</strong> ({fac.currentClass.room}) ·{' '}
                        {fac.nextFree || 'Free later'}
                      </span>
                    </div>
                  ) : fac.status === 'available' ? (
                    <div className="fs-next-free available">
                      <StatusIcon size={12} />
                      <span>Currently available{fac.nextFree ? ` · ${fac.nextFree}` : ''}</span>
                    </div>
                  ) : (
                    <div className={`fs-next-free ${fac.status}`}>
                      <StatusIcon size={12} />
                      <span>{fac.status === 'away' ? 'Away from campus' : 'Not available'}</span>
                    </div>
                  )}

                  {/* Expertise tags */}
                  <div className="fs-card-expertise" onClick={e => e.stopPropagation()}>
                    {fac.expertise.slice(0, 4).map(exp => (
                      <span key={exp} className="fs-card-expertise-tag">{exp}</span>
                    ))}
                    {fac.expertise.length > 4 && (
                      <span className="fs-card-expertise-tag" style={{ opacity: 0.6 }}>
                        +{fac.expertise.length - 4}
                      </span>
                    )}
                  </div>

                  {/* Expand button */}
                  <button
                    className={`fs-expand-btn ${isExpanded ? 'expanded' : ''}`}
                    onClick={e => { e.stopPropagation(); handleCardClick(fac.id); }}
                  >
                    <ChevronDown size={12} />
                    {isExpanded ? 'Hide Routine' : 'View Routine'}
                  </button>
                </div>

                {/* ─── Expanded Section: Routine + Controls ─── */}
                {isExpanded && (
                  <div className="fs-routine-section" onClick={e => e.stopPropagation()}>
                    {/* Faculty self-editing controls (only for own card) */}
                    {isOwnCard && (
                      <div className="fs-faculty-controls">
                        <span className="fs-mode-label">Status Mode:</span>
                        <span className={`fs-mode-badge ${fac.statusMode}`}>
                          {fac.statusMode === 'auto' ? <Zap size={10} /> : <Edit3 size={10} />}
                          {fac.statusMode === 'auto' ? 'Auto' : 'Manual'}
                        </span>
                        <button
                          className="fs-mode-toggle-btn"
                          onClick={() => handleToggleMode(fac.id)}
                        >
                          Switch to {fac.statusMode === 'auto' ? 'Manual' : 'Auto'}
                        </button>

                        {fac.statusMode === 'manual' && (
                          <>
                            <span className="fs-mode-label">Set Status:</span>
                            <select
                              className="fs-manual-status-select"
                              value={fac.status}
                              onChange={e => handleManualStatusChange(fac.id, e.target.value)}
                            >
                              <option value="available">Available</option>
                              <option value="busy">Busy</option>
                              <option value="away">Away</option>
                              <option value="offline">Offline</option>
                            </select>
                          </>
                        )}

                        <button
                          className="fs-mode-toggle-btn"
                          onClick={() => setEditingRoutine(!editingRoutine)}
                          style={{ marginLeft: 'auto' }}
                        >
                          <Edit3 size={10} style={{ marginRight: 4 }} />
                          {editingRoutine ? 'Close Editor' : 'Edit Routine'}
                        </button>
                      </div>
                    )}

                    {/* Routine display */}
                    {editingRoutine && isOwnCard ? (
                      <FacultyRoutineEditor
                        facultyId={fac.id}
                        onClose={() => { setEditingRoutine(false); handleRoutineSave(); }}
                      />
                    ) : (
                      <FacultyRoutineView facultyId={fac.id} />
                    )}
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
