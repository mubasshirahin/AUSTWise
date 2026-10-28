import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  DoorOpen, Search, X, Building2, Check, Hourglass, CalendarDays, Clock3,
  ChevronDown, ChevronRight, BookOpen,
} from 'lucide-react';
import { roomCatalog,
  computeRoomAvailability,
  currentDayOfWeek, currentTimeString,
} from '../../data/mockData';
import '../campus/SemesterViewWidget.css';
import './EmptyClassroomPage.css';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ROOM_GRID_BOUNDARIES = ['08:00', '08:50', '09:40', '10:30', '11:20', '12:10', '13:00', '13:50', '14:40', '15:30', '16:20', '17:10', '18:00'];
const ROOM_GRID_LABELS = ['08:00-08:50', '08:50-09:40', '09:40-10:30', '10:30-11:20', '11:20-12:10', '12:10-01:00', '01:00-01:50', '01:50-02:40', '02:40-03:30', '03:30-04:20', '04:20-05:10', '05:10-06:00'];
const ROOM_GRID_SLOTS = ROOM_GRID_BOUNDARIES.slice(0, -1).map((start, index) => ({
  start,
  end: ROOM_GRID_BOUNDARIES[index + 1],
  label: ROOM_GRID_LABELS[index],
}));

function normalizeRoutineTime(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const period = match[3]?.toLowerCase();
  if (period === 'pm' && hour !== 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;
  if (!period && hour >= 1 && hour <= 6) hour += 12;
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

function getRoomGridRange(time) {
  const matches = [...String(time || '').matchAll(/(\d{1,2}:\d{2})\s*(am|pm)?/gi)];
  const start = normalizeRoutineTime(matches[0] ? `${matches[0][1]} ${matches[0][2] || ''}` : '');
  const end = normalizeRoutineTime(matches[1] ? `${matches[1][1]} ${matches[1][2] || ''}` : '');
  let startIdx = ROOM_GRID_BOUNDARIES.indexOf(start);
  let endIdx = ROOM_GRID_BOUNDARIES.indexOf(end);
  if (startIdx < 0 && start) {
    const next = ROOM_GRID_BOUNDARIES.findIndex((boundary) => boundary > start);
    startIdx = next <= 0 ? 0 : Math.min(next - 1, ROOM_GRID_SLOTS.length - 1);
  }
  if (startIdx < 0) startIdx = 0;
  if (startIdx >= ROOM_GRID_SLOTS.length) startIdx = ROOM_GRID_SLOTS.length - 1;
  if (endIdx < 0 && end) {
    const next = ROOM_GRID_BOUNDARIES.findIndex((boundary) => boundary >= end);
    endIdx = next < 0 ? ROOM_GRID_BOUNDARIES.length - 1 : next;
  }
  if (endIdx <= startIdx) endIdx = startIdx + 1;
  endIdx = Math.min(endIdx, ROOM_GRID_BOUNDARIES.length - 1);
  return { startIdx, colSpan: Math.max(1, endIdx - startIdx) };
}

function localDateValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function weekdayForDate(dateValue) {
  if (!dateValue) return currentDayOfWeek();
  return WEEKDAYS[new Date(`${dateValue}T00:00:00`).getDay()];
}

// Group a floor's rooms by Block (A / B / C). Rooms whose id doesn't follow
// the "<floor><BLOCK><no>" pattern (canteen, auditorium, FM lab, …) fall into
// a single "Other" group kept last.
function groupRoomsByBlock(rooms) {
  const groups = new Map();
  const other = [];
  for (const room of rooms) {
    const m = String(room.id).match(/^\d([ABC])/);
    if (m) {
      const block = m[1];
      if (!groups.has(block)) groups.set(block, []);
      groups.get(block).push(room);
    } else {
      other.push(room);
    }
  }
  const out = ['A', 'B', 'C']
    .filter((b) => groups.has(b))
    .map((b) => ({ key: b, label: `${b} Block`, rooms: groups.get(b) }));
  if (other.length) out.push({ key: 'other', label: 'Other', rooms: other });
  return out;
}

export default function EmptyClassroomPage() {
  const [selectedDate, setSelectedDate] = useState(() => localDateValue());
  const [selectedTime, setSelectedTime] = useState(() => currentTimeString());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [scheduleRoom, setScheduleRoom] = useState(null);
  const [roomSchedule, setRoomSchedule] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const scheduleCloseRef = useRef(null);
  // All floors start collapsed so the page is compact; tap a floor's arrow
  // (or its label) to expand/collapse it.
  const [collapsedFloors, setCollapsedFloors] = useState(
    () => new Set(roomCatalog.floors.map((f) => f.id))
  );

  const toggleFloor = (floorId) => {
    setCollapsedFloors((prev) => {
      const next = new Set(prev);
      if (next.has(floorId)) next.delete(floorId);
      else next.add(floorId);
      return next;
    });
  };

  const openRoomSchedule = async (room) => {
    setScheduleRoom(room);
    setRoomSchedule([]);
    setScheduleError('');
    setScheduleLoading(true);
    try {
      const response = await fetch('/api/routines/shared');
      if (!response.ok) throw new Error('Could not load shared routines.');
      const payload = await response.json();
      if (!payload.success || !Array.isArray(payload.routines)) throw new Error('Routine data is unavailable.');
      const normalizeRoomId = (value) => String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      const targetRoomId = normalizeRoomId(room.id);
      const entries = payload.routines.flatMap((record) => {
        let routine = record.routine;
        if (typeof routine === 'string') {
          try { routine = JSON.parse(routine); } catch { routine = {}; }
        }
        return Object.entries(routine || {}).flatMap(([day, classes]) => (
          Array.isArray(classes) ? classes
            .filter((item) => normalizeRoomId(item.room || item.roomId) === targetRoomId)
            .map((item) => ({
              day,
              time: item.time || '',
              course: item.course || '',
              courseName: item.name || item.courseName || '',
              teacher: item.teacher || '',
              department: record.department || '',
              semester: record.yearSemester || '',
              section: record.section || '',
            })) : []
        ));
      });
      const dayOrder = new Map(WEEKDAYS.map((day, index) => [day.toLowerCase(), index]));
      entries.sort((a, b) => (dayOrder.get(String(a.day).toLowerCase()) ?? 99) - (dayOrder.get(String(b.day).toLowerCase()) ?? 99)
        || String(a.time).localeCompare(String(b.time)));
      setRoomSchedule(entries);
    } catch (error) {
      setScheduleError(error.message || 'Could not load this room schedule.');
    } finally {
      setScheduleLoading(false);
    }
  };

  useEffect(() => {
    if (!scheduleRoom) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    scheduleCloseRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setScheduleRoom(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [scheduleRoom]);

  // Fetch availability for the selected weekday/time from CR-published
  // routines. Local events also trigger a refresh; offline mode uses the same
  // selected weekday/time against the locally cached routines.
  const [liveFloors, setLiveFloors] = useState(() =>
    computeRoomAvailability(weekdayForDate(localDateValue()), currentTimeString())
  );
  const [, setLiveSource] = useState('local');
  const selectedDay = weekdayForDate(selectedDate);
  const availabilityRequestRef = useRef(0);

  const fetchAvailability = useCallback(async () => {
    if (!selectedDate || !selectedTime) return;
    const requestId = ++availabilityRequestRef.current;
    try {
      const params = new URLSearchParams({ day: selectedDay, time: selectedTime });
      const res = await fetch(`/api/rooms/availability?${params}`);
      if (!res.ok) throw new Error('api');
      const data = await res.json();
      if (requestId !== availabilityRequestRef.current) return;
      if (data.success && Array.isArray(data.floors)) {
        // Always pass server floors through the local builder so the
        // ground-floor venue statuses (canteen open/closed + auditorium
        // event) are overlaid on top.
        setLiveFloors(computeRoomAvailability(selectedDay, selectedTime, data.floors));
        setLiveSource('server');
        return;
      }
      throw new Error('bad payload');
    } catch {
      if (requestId !== availabilityRequestRef.current) return;
      setLiveFloors(computeRoomAvailability(selectedDay, selectedTime));
      setLiveSource('local');
    }
  }, [selectedDate, selectedDay, selectedTime]);

  useEffect(() => {
    fetchAvailability();
    const handler = () => fetchAvailability();
    window.addEventListener('routine-updated', handler);
    window.addEventListener('auditorium-updated', handler);
    return () => {
      window.removeEventListener('routine-updated', handler);
      window.removeEventListener('auditorium-updated', handler);
    };
  }, [fetchAvailability]);

  const { floors: allFloors } = { floors: liveFloors };

  // 1) Search filter
  const searchFloors = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return allFloors;

    return allFloors
      .map((floor) => ({
        ...floor,
        rooms: floor.rooms.filter((room) => {
          const d = room.details;
          const evt = d?.event;
          const searchable = [
            d?.venue,
            d?.hours,
            d?.dept,
            d?.semester,
            d?.section,
            d?.course,
            d?.courseName,
            d?.teacher,
            d?.time,
            evt?.title,
            evt?.speaker,
            evt?.date,
            evt?.time,
          ].filter(Boolean).join(' ').toLowerCase();
          return (
            room.id.toLowerCase().includes(q) ||
            room.name.toLowerCase().includes(q) ||
            searchable.includes(q)
          );
        }),
      }))
      .filter((floor) => floor.rooms.length > 0);
  }, [allFloors, searchTerm]);

  // 2) Totals across all floors (always full counts — not search-filtered)
  const totals = useMemo(() => {
    let free = 0;
    let busy = 0;
    allFloors.forEach((f) =>
      f.rooms.forEach((r) => (r.status === 'free' ? (free += 1) : (busy += 1)))
    );
    return { free, busy, total: free + busy };
  }, [allFloors]);

  // 3) Status filter for display
  const displayFloors = useMemo(
    () =>
      statusFilter === 'all'
        ? searchFloors
        : searchFloors
            .map((f) => ({
              ...f,
              rooms: f.rooms.filter((r) => r.status === statusFilter),
            }))
            .filter((f) => f.rooms.length > 0),
    [searchFloors, statusFilter]
  );

  // Auto-expand floors whenever a filter is active (search / status / floor)
  // so the matching rooms are visible. When the user clears the last filter,
  // floors reset back to the compact all-closed default. A ref tracks the
  // previous filter state so live data refreshes don't reset manual expands.
  const wasFilteringRef = useRef(false);
  const isFiltering =
    searchTerm.trim() !== '' || statusFilter !== 'all';

  useEffect(() => {
    const wasFiltering = wasFilteringRef.current;
    wasFilteringRef.current = isFiltering;

    setCollapsedFloors((prev) => {
      const next = new Set(prev);
      if (isFiltering) {
        // Reveal every floor that has visible results
        displayFloors.forEach((f) => next.delete(f.id));
      } else if (wasFiltering) {
        // Just cleared the last filter → back to the compact default
        roomCatalog.floors.forEach((f) => next.add(f.id));
      }
      return next;
    });
     
  }, [displayFloors, searchTerm, statusFilter, isFiltering]);

  return (
    <div className="glass-card-static schedule-widget sv-widget ecf-widget animate-fadeInUp">

      {/* ── Masthead: title · centered counters · tools ── */}
      <div className="ecf-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile ecf-icon-tile">
            <DoorOpen size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Inside AUST</span>
            <div className="schedule-title">Free Rooms</div>
            <span className="schedule-subtitle">Availability for {selectedDay}, {selectedDate} at {selectedTime}</span>
          </div>
        </div>

        {/* Centered counters */}
        <div className="schedule-stats ecf-stats">
          <div className="schedule-stat">
            <span className="schedule-stat-value ecf-free">{totals.free}</span>
            <span className="schedule-stat-label">Free</span>
          </div>
          <span className="ecf-stat-divider" />
          <div className="schedule-stat">
            <span className="schedule-stat-value ecf-busy">{totals.busy}</span>
            <span className="schedule-stat-label">Busy</span>
          </div>
        </div>

        {/* Tools: search + share button */}
        <div className="ecf-tools">
          <div className="ecf-search">
            <Search size={14} className="ecf-search-icon" />
            <input
              type="text"
              placeholder="Search… (room, course, dept)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ecf-search-input"
            />
            {searchTerm ? (
              <button
                className="ecf-search-clear"
                onClick={() => setSearchTerm('')}
                title="Clear search"
              >
                <X size={13} />
              </button>
            ) : (
              <span className="ecf-search-kbd">⌘K</span>
            )}
          </div>
        </div>
      </div>

      <div className="ecf-date-time-controls" aria-label="Choose date and time for room availability">
        <label className="ecf-date-time-field">
          <CalendarDays size={15} />
          <span>Date</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            aria-label="Select a date"
          />
        </label>
        <label className="ecf-date-time-field">
          <Clock3 size={15} />
          <span>Time</span>
          <input
            type="time"
            value={selectedTime}
            onChange={(event) => setSelectedTime(event.target.value)}
            aria-label="Select a time"
          />
        </label>
        <span className="ecf-date-time-hint">Using the {selectedDay} routine</span>
      </div>

      <div className="schedule-dotted-divider" />

      {/* ── Filter bar ── */}
      <div className="ecf-filterbar">
        <div className="ecf-status-tabs">
          {[
            { id: 'all', label: 'All', Icon: Building2 },
            { id: 'free', label: 'Free', Icon: Check },
            { id: 'busy', label: 'Busy', Icon: Hourglass },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              data-status={id}
              className={`ecf-status-tab ${statusFilter === id ? 'active' : ''}`}
              onClick={() => setStatusFilter(id)}
            >
              <Icon size={13} />
              {label}
              {id !== 'all' && (
                <span className="ecf-tab-count">
                  {id === 'free' ? totals.free : totals.busy}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="ecf-filter-meta">
          {statusFilter === 'all'
            ? `${totals.total} rooms`
            : `${statusFilter === 'free' ? totals.free : totals.busy} rooms`}
        </div>
      </div>

      {/* ── Room cards by floor ── */}
      {displayFloors.length === 0 ? (
        <div className="sv-empty">
          <Search size={38} className="sv-empty-icon" />
          <h3>No Matching Rooms</h3>
          <p>Try a different search term or filter.</p>
        </div>
      ) : (
        <div className="ecf-floor-list">
          {displayFloors.map((floor) => {
            const isCollapsed = collapsedFloors.has(floor.id);
            return (
              <section key={floor.id} className={`ecf-floor ${isCollapsed ? 'is-collapsed' : ''}`}>
                <div className="ecf-floor-head">
                  <button
                    type="button"
                    className={`ecf-floor-toggle ${isCollapsed ? 'is-collapsed' : 'is-open'}`}
                    onClick={() => toggleFloor(floor.id)}
                    aria-expanded={!isCollapsed}
                    aria-label={isCollapsed ? `Expand ${floor.label}` : `Collapse ${floor.label}`}
                    title={isCollapsed ? `Expand ${floor.label}` : `Collapse ${floor.label}`}
                  >
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <span
                    className="ecf-floor-label"
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleFloor(floor.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleFloor(floor.id);
                      }
                    }}
                  >
                    {floor.label}
                  </span>
                  <span className="ecf-floor-badge">
                    {floor.rooms.filter((r) => r.status === 'free').length} / {floor.rooms.length} free
                  </span>
                </div>
                {!isCollapsed && (
                  <div className="ecf-blocks">
                    {groupRoomsByBlock(floor.rooms).map((group) => {
                      const freeCount = group.rooms.filter((r) => r.status === 'free').length;
                      return (
                        <div className="ecf-block" key={group.key}>
                          <div className="ecf-block-head">
                            <span className="ecf-block-title">{group.label}</span>
                            <span className="ecf-block-badge">
                              {freeCount} / {group.rooms.length} free
                            </span>
                          </div>
                          <div className="ecf-grid">
                            {group.rooms.map((room) => (
                              <RoomCard key={room.id} room={room} onOpenSchedule={openRoomSchedule} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {scheduleRoom && (
        <div className="ecf-schedule-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setScheduleRoom(null);
        }}>
          <section className="ecf-schedule-dialog" role="dialog" aria-modal="true" aria-labelledby="ecf-schedule-title">
            <header className="ecf-schedule-dialog-head">
              <div className="ecf-schedule-room-icon"><BookOpen size={17} /></div>
              <div>
                <span className="schedule-overline">Weekly Class Schedule</span>
                <h3 id="ecf-schedule-title">{scheduleRoom.name}</h3>
              </div>
              <button ref={scheduleCloseRef} type="button" className="ecf-schedule-close" onClick={() => setScheduleRoom(null)} aria-label="Close weekly schedule"><X size={17} /></button>
            </header>
            {scheduleLoading ? (
              <p className="ecf-schedule-message">Loading weekly routine…</p>
            ) : scheduleError ? (
              <p className="ecf-schedule-message is-error">{scheduleError}</p>
            ) : roomSchedule.length === 0 ? (
              <p className="ecf-schedule-message">No shared classes are scheduled in this room this week.</p>
            ) : (
              <div className="ecf-room-grid-scroll">
                <table className="ecf-room-grid">
                  <thead>
                    <tr>
                      <th className="ecf-room-grid-day-head">Day</th>
                      {ROOM_GRID_SLOTS.map((slot) => <th key={slot.start}>{slot.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {WEEKDAYS.map((day) => {
                      const dayEntries = roomSchedule
                        .filter((entry) => String(entry.day).toLowerCase() === day.toLowerCase())
                        .map((entry) => ({ ...entry, ...getRoomGridRange(entry.time) }))
                        .sort((a, b) => a.startIdx - b.startIdx);
                      return (
                        <tr key={day}>
                          <th className="ecf-room-grid-day">{day.slice(0, 3)}</th>
                          {ROOM_GRID_SLOTS.map((slot, slotIndex) => {
                            if (dayEntries.some((entry) => slotIndex > entry.startIdx && slotIndex < entry.startIdx + entry.colSpan)) return null;
                            const classes = dayEntries.filter((entry) => entry.startIdx === slotIndex);
                            const colSpan = Math.max(1, ...classes.map((entry) => entry.colSpan));
                            return (
                              <td key={`${day}-${slot.start}`} colSpan={classes.length ? colSpan : 1} className={classes.length ? 'has-class' : ''}>
                                {classes.length ? classes.map((entry, index) => (
                                  <div
                                    className="ecf-room-grid-class"
                                    key={`${entry.course}-${index}`}
                                    title={[entry.courseName, entry.department, entry.semester, entry.section && `Section ${entry.section}`, entry.teacher].filter(Boolean).join(' · ')}
                                  >
                                    <strong>{entry.course || entry.courseName || 'Class'}</strong>
                                    {entry.courseName && entry.courseName !== entry.course && <span>{entry.courseName}</span>}
                                    <small>{[entry.department, entry.semester, entry.section && `Sec ${entry.section}`].filter(Boolean).join(' · ')}</small>
                                    {entry.teacher && <small>{entry.teacher}</small>}
                                  </div>
                                )) : <span className="ecf-room-grid-empty">—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

    </div>
  );
}

function RoomCard({ room, onOpenSchedule }) {
  const isFree = room.status === 'free';
  const d = room.details;

  // ── Canteen card (open/closed from canteen menu hours) ──
  if (room.type === 'canteen') {
    const open = Boolean(d?.open);
    return (
      <div className={`ecf-card venue-card canteen-card ${open ? 'free' : 'busy'}`}>
        <div className="ecf-card-top">
          <span className="ecf-card-id">
            Canteen
            <span className="ecf-card-type">Canteen</span>
          </span>
          <span className={`ecf-led ${open ? 'free' : 'busy'}`} title={open ? 'Open' : 'Closed'} />
        </div>
        {open ? (
          <div className="ecf-card-free">Open now · {d?.hours}</div>
        ) : (
          <div className="ecf-card-details">
            <div className="ecf-detail-row"><span className="ecf-detail-dept">Closed</span></div>
            <div className="ecf-detail-meta">Hours: {d?.hours}</div>
          </div>
        )}
      </div>
    );
  }

  // ── M.H Khan Auditorium card (event from admin panel) ──
  if (room.type === 'auditorium') {
    const evt = d?.event;
    return (
      <div className={`ecf-card venue-card auditorium-card ${isFree ? 'free' : 'busy'}`}>
        <div className="ecf-card-top">
          <span className="ecf-card-id">
            M.H Khan Auditorium
            <span className="ecf-card-type">Auditorium</span>
          </span>
          <span className={`ecf-led ${isFree ? 'free' : 'busy'}`} title={isFree ? 'Free' : 'Event'} />
        </div>
        {isFree || !evt ? (
          <div className="ecf-card-free">Available · No event scheduled</div>
        ) : (
          <div className="ecf-card-details">
            <div className="ecf-detail-row">
              <span className="ecf-detail-dept">
                {evt.status === 'ongoing' ? 'In Progress' : 'Upcoming'}
              </span>
              {evt.date && <span>{evt.date}</span>}
            </div>
            <div className="ecf-detail-row">
              <span className="ecf-detail-course"><strong>{evt.title}</strong></span>
            </div>
            {evt.speaker && <div className="ecf-detail-meta">{evt.speaker}</div>}
            {evt.time && <div className="ecf-detail-meta">{evt.time}</div>}
          </div>
        )}
      </div>
    );
  }

  // ── Regular room / lab card ──
  return (
    <div
      className={`ecf-card ${isFree ? 'free' : 'busy'} is-schedulable`}
      role="button"
      tabIndex={0}
      onClick={() => onOpenSchedule(room)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenSchedule(room);
        }
      }}
      aria-label={`View weekly class schedule for ${room.name}`}
    >
      <div className="ecf-card-top">
        <span className="ecf-card-id">
          {room.id}
          <span className="ecf-card-type">{room.type === 'lab' ? 'Lab' : 'Classroom'}</span>
        </span>
        <span className={`ecf-led ${isFree ? 'free' : 'busy'}`} title={isFree ? 'Free' : 'Busy'} />
      </div>

      {!isFree && d && (
        <div className="ecf-card-details">
          <div className="ecf-detail-row">
            <span className="ecf-detail-dept">{d.dept}</span>
            {d.semester}{d.section ? ` · ${d.section}` : ''}
          </div>
          <div className="ecf-detail-row">
            <span className="ecf-detail-course"><strong>{d.course}</strong> — {d.courseName}</span>
          </div>
          <div className="ecf-detail-meta">{d.teacher} · {d.time}</div>
        </div>
      )}
    </div>
  );
}
