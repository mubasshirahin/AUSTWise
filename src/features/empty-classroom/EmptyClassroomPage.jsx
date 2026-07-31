import { useState, useMemo, useEffect } from 'react';
import { DoorOpen, Search, Clock, MapPin, CheckCircle2, XCircle, AlertCircle, Layers, Users, Database, Share2 } from 'lucide-react';
import { useRoutine } from '../../context/RoutineContext';
import { loadSharedRoutinesFromServer } from '../../utils/sharedRoutines';
import { getAllAccounts } from '../../utils/authStorage';
import { useAuth } from '../../context/AuthContext';
import './EmptyClassroomPage.css';
import '../../components/PageHero.css';

// ─── Time helpers ───
const slotBoundaries = [
  '08:00', '08:50', '09:40', '10:30', '11:20', '12:10',
  '13:00', '13:50', '14:40', '15:30', '16:20', '17:10', '18:00',
];

const slotLabels = [
  '08:00-08:50', '08:50-09:40', '09:40-10:30', '10:30-11:20',
  '11:20-12:10', '12:10-01:00', '01:00-01:50', '01:50-02:40',
  '02:40-03:30', '03:30-04:20', '04:20-05:10', '05:10-06:00',
];

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

// ─── AUST coverage constants ───
// 7 dept × 8 sem × 3 sec × 2 lab + 1 dept × 10 sem × 3 sec × 2 lab = 336 + 60 = 396
const TOTAL_POSSIBLE_ROUTINES = 396;

function normalizeTime(value) {
  const match = (value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2];
  const period = match[3]?.toLowerCase();
  if (period === 'pm' && hour !== 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;
  if (!period && hour >= 1 && hour <= 6) hour += 12;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

function parseTimeToSlots(timeStr) {
  const [rawStart, rawEnd] = (timeStr || '').split('-');
  const start = normalizeTime(rawStart || '');
  const end = normalizeTime(rawEnd || '');
  let startIdx = slotBoundaries.indexOf(start);
  let endIdx = slotBoundaries.indexOf(end);
  if (startIdx === -1 && start) {
    startIdx = slotBoundaries.findIndex(s => s > start) - 1;
  }
  if (endIdx === -1 && end) {
    endIdx = slotBoundaries.findIndex(s => s >= end);
  }
  if (startIdx < 0) startIdx = 0;
  if (endIdx <= startIdx) endIdx = startIdx + 1;
  return { startIdx, endIdx };
}

function mergeRoutineIntoMap(roomMap, routine) {
  for (const day of days) {
    const classes = routine[day] || [];
    for (const cls of classes) {
      const room = (cls.room || '').trim();
      if (!room) continue;
      const time = (cls.time || '').trim();
      if (!time) continue;
      if (!roomMap[room]) roomMap[room] = {};
      const { startIdx, endIdx } = parseTimeToSlots(time);
      const bookedSlots = roomMap[room][day] || new Set();
      for (let i = startIdx; i < endIdx; i++) {
        bookedSlots.add(i);
      }
      roomMap[room][day] = bookedSlots;
    }
  }
}

// ─── Aggregate ALL shared CR routines + user's personal routine ───
function buildAggregatedRoomBookings(userRoutine, sharedRoutines) {
  const roomMap = {};

  // 1) Merge all CR-contributed shared routines
  for (const shared of sharedRoutines) {
    if (shared.routine) {
      mergeRoutineIntoMap(roomMap, shared.routine);
    }
  }

  // 2) Merge user's personal routine
  if (userRoutine) {
    mergeRoutineIntoMap(roomMap, userRoutine);
  }

  return roomMap;
}

function getCurrentSlotIndex() {
  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < slotBoundaries.length - 1; i++) {
    const startParts = slotBoundaries[i].split(':').map(Number);
    const endParts = slotBoundaries[i + 1].split(':').map(Number);
    const startMins = startParts[0] * 60 + startParts[1];
    const endMins = endParts[0] * 60 + endParts[1];
    if (currentMinutes >= startMins && currentMinutes < endMins) {
      return { dayIndex: currentDay, slotIndex: i };
    }
  }
  return { dayIndex: currentDay, slotIndex: -1 };
}

export default function EmptyClassroomPage() {
  const { routine, weekDays } = useRoutine();
  const { user } = useAuth();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('single');



  // Load shared CR routines from server
  const [sharedRoutines, setSharedRoutines] = useState([]);
  useEffect(() => {
    let cancelled = false;
    loadSharedRoutinesFromServer().then(data => {
      if (!cancelled) setSharedRoutines(data);
    });
    return () => { cancelled = true; };
  }, []);
  const allAccounts = useMemo(() => getAllAccounts(), []);

  // Count total CRs across all depts/sems
  const crStats = useMemo(() => {
    const crs = allAccounts.filter(a => a.role === 'cr');
    const byDept = {};
    for (const cr of crs) {
      const dept = cr.department || 'Unknown';
      if (!byDept[dept]) byDept[dept] = 0;
      byDept[dept]++;
    }
    return { totalCRs: crs.length, byDept };
  }, [allAccounts]);

  // Combine: ALL shared routines + user's personal routine
  const roomBookings = useMemo(
    () => buildAggregatedRoomBookings(routine, sharedRoutines),
    [routine, sharedRoutines]
  );
  const roomNames = useMemo(() => Object.keys(roomBookings).sort(), [roomBookings]);

  // ─── Stats ───
  const stats = useMemo(() => {
    const sharedCount = sharedRoutines.length;
    // Count total classes across all shared routines + user routine
    let totalClasses = 0;
    const depts = new Set();
    for (const s of sharedRoutines) {
      if (s.department) depts.add(s.department);
      for (const day of days) {
        totalClasses += (s.routine?.[day] || []).length;
      }
    }
    for (const day of days) {
      totalClasses += (routine?.[day] || []).length;
    }
    const uniqueRooms = Object.keys(roomBookings).length;
    const coveragePct = Math.round((sharedCount / TOTAL_POSSIBLE_ROUTINES) * 100);
    return {
      sharedCount,
      totalClasses,
      uniqueRooms,
      deptCount: depts.size,
      coveragePct,
      isLowCoverage: coveragePct < 5,
    };
  }, [sharedRoutines, routine, roomBookings]);

  const { dayIndex: nowDayIdx, slotIndex: nowSlotIdx } = useMemo(() => getCurrentSlotIndex(), []);
  const nowDay = nowDayIdx >= 0 && nowDayIdx < 5 ? days[nowDayIdx] : null;

  const [selectedDay, setSelectedDay] = useState(nowDay || days[0]);

  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return roomNames;
    const q = searchQuery.toLowerCase();
    return roomNames.filter(r => r.toLowerCase().includes(q));
  }, [roomNames, searchQuery]);

  const freeNow = useMemo(() => {
    if (nowSlotIdx < 0 || !nowDay) return [];
    return roomNames.filter(room => {
      const dayBookings = roomBookings[room]?.[nowDay];
      return !dayBookings || !dayBookings.has(nowSlotIdx);
    });
  }, [roomNames, roomBookings, nowDay, nowSlotIdx]);

  const freeCounts = useMemo(() => {
    const counts = [];
    for (let i = 0; i < 12; i++) {
      let free = 0;
      for (const room of roomNames) {
        const dayBookings = roomBookings[room]?.[selectedDay];
        if (!dayBookings || !dayBookings.has(i)) free++;
      }
      counts.push(free);
    }
    return counts;
  }, [roomNames, roomBookings, selectedDay]);

  // ─── Per-department CR coverage: registered vs shared ───
  const deptCoverage = useMemo(() => {
    // Count shared routines per department
    const sharedByDept = {};
    for (const s of sharedRoutines) {
      const dept = s.department || 'Unknown';
      sharedByDept[dept] = (sharedByDept[dept] || 0) + 1;
    }
    // Build per-dept breakdown: { dept: { registered, shared } }
    const allDepts = new Set([
      ...Object.keys(crStats.byDept),
      ...Object.keys(sharedByDept),
    ]);
    const DEPT_ORDER = ['CSE', 'EEE', 'CE', 'ME', 'IPE', 'TE', 'ARCH', 'BBA'];
    const result = [];
    for (const dept of DEPT_ORDER) {
      const registered = crStats.byDept[dept] || 0;
      const shared = sharedByDept[dept] || 0;
      if (registered > 0 || shared > 0) {
        result.push({ dept, registered, shared, hasAny: shared > 0 });
      }
    }
    // Add any unknown dept at the end
    for (const dept of allDepts) {
      if (!DEPT_ORDER.includes(dept)) {
        result.push({ dept, registered: crStats.byDept[dept] || 0, shared: sharedByDept[dept] || 0, hasAny: (sharedByDept[dept] || 0) > 0 });
      }
    }
    return result;
  }, [crStats, sharedRoutines]);

  const hasRooms = roomNames.length > 0;

  // If 0 CRs are registered, always show empty state — no phantom data
  if (!hasRooms || crStats.totalCRs === 0) {
    return (
      <div className="ecf-page animate-fadeIn">
        <header className="page-hero">
          <div className="page-hero-content">
            <div className="page-hero-title-row">
              <div className="page-hero-icon">
                <DoorOpen size={24} />
              </div>
              <div>
                <h1 className="page-hero-title">
                  <span className="page-hero-title-highlight">Free Rooms</span>
                </h1>
                <p className="page-hero-subtitle">
                  Find available classrooms for self-study, group work, or extra practice.
                </p>
              </div>
            </div>
          </div>
        </header>
        <div className="ecf-empty-state">
          <AlertCircle size={36} strokeWidth={1.5} />
          <h3>No routine data collected yet</h3>
          <p>
            Free Rooms works by aggregating routines from <strong>Class Representatives (CRs)</strong> across all departments.
            Each of the {TOTAL_POSSIBLE_ROUTINES} lab groups has a CR who can share their routine.
          </p>
          <p className="ecf-empty-hint">
            <strong>How it works:</strong> 7 depts × 8 sem × 3 sec × 2 lab + 1 dept × 10 sem × 3 sec × 2 lab = {TOTAL_POSSIBLE_ROUTINES} routines.
            CRs share their routines → aggregated here → real campus-wide room availability.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ecf-page animate-fadeIn">
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <DoorOpen size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">Free Rooms</span>
              </h1>
              <p className="page-hero-subtitle">
                Aggregated from {stats.sharedCount} CR-shared routines + your schedule across {stats.deptCount} department{stats.deptCount !== 1 ? 's' : ''}.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Coverage Stats Bar ─── */}
      <div className={`ecf-coverage-bar ${stats.isLowCoverage ? 'low' : 'good'}`}>
        <div className="ecf-coverage-stats">
          <div className="ecf-coverage-stat">
            <Layers size={14} />
            <span><strong>{stats.sharedCount}</strong> / {TOTAL_POSSIBLE_ROUTINES} CR routines shared</span>
          </div>
          <div className="ecf-coverage-stat">
            <Share2 size={14} />
            <span><strong>{crStats.totalCRs}</strong> CRs registered across all depts</span>
          </div>
          <div className="ecf-coverage-stat">
            <Database size={14} />
            <span><strong>{stats.totalClasses}</strong> classes tracked</span>
          </div>
          <div className="ecf-coverage-stat">
            <Users size={14} />
            <span><strong>{stats.deptCount}</strong> departments</span>
          </div>
          <div className="ecf-coverage-stat">
            <MapPin size={14} />
            <span><strong>{stats.uniqueRooms}</strong> unique rooms</span>
          </div>
        </div>
        <div className="ecf-coverage-meter">
          <div className="ecf-coverage-fill" style={{ width: `${Math.min(stats.coveragePct, 100)}%` }} />
          <span className="ecf-coverage-label">{stats.coveragePct}% of {TOTAL_POSSIBLE_ROUTINES}</span>
        </div>
        {/* ─── Per-Department Breakdown ─── */}
        <div className="ecf-dept-chips">
          {deptCoverage.map(d => (
            <div key={d.dept} className={`ecf-dept-chip ${d.hasAny ? 'has-shared' : 'none-shared'}`} title={`${d.dept}: ${d.shared}/${d.registered} CRs shared`}>
              <span className="ecf-dept-chip-label">{d.dept}</span>
              <span className="ecf-dept-chip-count">{d.shared}/{d.registered}</span>
            </div>
          ))}
        </div>

        {stats.isLowCoverage && (
          <div className="ecf-coverage-warning">
            <AlertCircle size={12} />
            <span>
              Low coverage — {stats.sharedCount} of {TOTAL_POSSIBLE_ROUTINES} routines shared. Each CR (lab group rep) should share their routine for accurate results.
              {crStats.totalCRs > 0 && ` ${crStats.totalCRs} CRs are registered — ask them to share!`}
            </span>
          </div>
        )}
      </div>

      {/* ─── Quick stats: Free NOW ─── */}
      {freeNow.length > 0 && nowDay === selectedDay && (
        <div className="ecf-free-now">
          <div className="ecf-free-now-badge">
            <CheckCircle2 size={14} />
            <span>Free Now</span>
          </div>
          <div className="ecf-free-now-rooms">
            {freeNow.map(room => (
              <button
                key={room}
                className="ecf-free-now-chip"
                onClick={() => { setSearchQuery(room); setViewMode('single'); }}
              >
                <MapPin size={10} /> {room}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Controls ─── */}
      <div className="ecf-controls">
        <div className="ecf-view-toggle">
          <button
            className={`ecf-view-btn ${viewMode === 'single' ? 'active' : ''}`}
            onClick={() => setViewMode('single')}
          >
            Room Detail
          </button>
          <button
            className={`ecf-view-btn ${viewMode === 'all' ? 'active' : ''}`}
            onClick={() => setViewMode('all')}
          >
            All Rooms ({stats.uniqueRooms})
          </button>
        </div>

        <div className="ecf-day-tabs">
          {days.map(day => (
            <button
              key={day}
              className={`ecf-day-tab ${selectedDay === day ? 'active' : ''} ${nowDay === day ? 'today' : ''}`}
              onClick={() => setSelectedDay(day)}
            >
              {day.substring(0, 3)}
              {nowDay === day && <span className="ecf-today-dot" />}
            </button>
          ))}
        </div>

        {viewMode === 'single' && (
          <div className="ecf-search-wrap">
            <Search size={14} className="ecf-search-icon" />
            <input
              className="ecf-search-input"
              type="text"
              placeholder={`Search ${stats.uniqueRooms} rooms...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* ─── Single Room View ─── */}
      {viewMode === 'single' && (
        <div className="ecf-single-view">
          {searchQuery.trim() && (
            <>
              {filteredRooms.length === 0 ? (
                <div className="ecf-no-match">
                  <Search size={20} />
                  <p>No room matching "<strong>{searchQuery}</strong>" found across {stats.sharedCount} shared routines.</p>
                </div>
              ) : (
                <div className="ecf-room-cards">
                  {filteredRooms.map(room => {
                    const dayBookings = roomBookings[room]?.[selectedDay];
                    const freeSlots = dayBookings
                      ? slotLabels.filter((_, i) => !dayBookings.has(i)).length
                      : 12;
                    return (
                      <div key={room} className="ecf-room-card">
                        <div className="ecf-room-card-header">
                          <div className="ecf-room-card-name">
                            <MapPin size={15} />
                            <span>{room}</span>
                          </div>
                          <div className="ecf-room-card-meta">
                            <Clock size={12} />
                            <span>{selectedDay}</span>
                            <span className="ecf-room-free-count">
                              {freeSlots}/{12} free
                            </span>
                          </div>
                        </div>
                        <div className="ecf-timeline">
                          {slotLabels.map((label, i) => {
                            const isBooked = dayBookings?.has(i);
                            const isNow = nowDay === selectedDay && nowSlotIdx === i;
                            return (
                              <div
                                key={i}
                                className={`ecf-slot ${isBooked ? 'booked' : 'free'} ${isNow ? 'now' : ''}`}
                                title={`${label} — ${isBooked ? 'BOOKED' : 'FREE'}${isNow ? ' (NOW)' : ''}`}
                              >
                                <span className="ecf-slot-time">{label}</span>
                                <span className="ecf-slot-status">
                                  {isBooked ? <XCircle size={12} /> : <CheckCircle2 size={12} />}
                                  {isBooked ? 'Busy' : 'Free'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {!searchQuery.trim() && (
            <div className="ecf-prompt">
              <Search size={28} strokeWidth={1.5} />
              <h3>Search for a room</h3>
              <p>Type a room name to see its free/busy schedule across all {stats.sharedCount} shared routines.</p>
              <div className="ecf-prompt-rooms">
                <span>Available rooms ({stats.uniqueRooms} total):</span>
                <div className="ecf-prompt-chips">
                  {roomNames.slice(0, 10).map(room => (
                    <button
                      key={room}
                      className="ecf-prompt-chip"
                      onClick={() => setSearchQuery(room)}
                    >
                      {room}
                    </button>
                  ))}
                  {roomNames.length > 10 && (
                    <span className="ecf-prompt-more">+{roomNames.length - 10} more</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── All Rooms Grid View ─── */}
      {viewMode === 'all' && (
        <div className="ecf-all-view">
          <div className="ecf-grid-header">
            <div className="ecf-grid-header-label">Room ({stats.uniqueRooms})</div>
            {slotLabels.map((label, i) => (
              <div
                key={i}
                className={`ecf-grid-header-slot ${nowDay === selectedDay && nowSlotIdx === i ? 'now' : ''}`}
                title={`${label} — ${freeCounts[i]} free`}
              >
                <span className="ecf-grid-slot-time">{label.split('-')[0]}</span>
                <span className="ecf-grid-slot-count">{freeCounts[i]} free</span>
              </div>
            ))}
          </div>
          <div className="ecf-grid-body">
            {roomNames.map(room => {
              const dayBookings = roomBookings[room]?.[selectedDay];
              return (
                <div key={room} className="ecf-grid-row">
                  <div className="ecf-grid-room-name" title={room}>
                    <MapPin size={11} />
                    <span>{room}</span>
                  </div>
                  {slotLabels.map((_, i) => {
                    const isBooked = dayBookings?.has(i);
                    const isNow = nowDay === selectedDay && nowSlotIdx === i;
                    return (
                      <div
                        key={i}
                        className={`ecf-grid-cell ${isBooked ? 'booked' : 'free'} ${isNow ? 'now' : ''}`}
                        title={`${room} — ${slotLabels[i]} — ${isBooked ? 'BUSY' : 'FREE'}`}
                      >
                        {isBooked ? <XCircle size={10} /> : <CheckCircle2 size={10} />}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Legend ─── */}
      <div className="ecf-legend">
        <span className="ecf-legend-item"><span className="ecf-legend-dot free" /> Free</span>
        <span className="ecf-legend-item"><span className="ecf-legend-dot booked" /> Booked</span>
        {nowDay === selectedDay && <span className="ecf-legend-item"><span className="ecf-legend-dot now" /> Now</span>}
      </div>
    </div>
  );
}
