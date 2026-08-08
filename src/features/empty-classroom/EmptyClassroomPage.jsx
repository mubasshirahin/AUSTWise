import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  DoorOpen, Search, X, Building2, Check, Hourglass,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import {
  freeRoomData, roomCatalog,
  computeRoomAvailability, computeDemoAvailability,
  currentDayOfWeek, currentTimeString,
} from '../../data/mockData';
import '../campus/SemesterViewWidget.css';
import './EmptyClassroomPage.css';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all');
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

  // Live availability: fetch from the server (derived from CR-published
  // routines) on mount + whenever a routine is shared or the admin updates
  // the auditorium. Falls back to local computed state so the page still
  // renders if the API is unreachable.
  const [liveFloors, setLiveFloors] = useState(() => computeDemoAvailability());
  const [liveSource, setLiveSource] = useState('local');

  const fetchAvailability = useCallback(async () => {
    // Locally-shared routines (offline / fallback shares) always overlay.
    const localShared = typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem('aust-shared-routines') || '[]')
      : [];
    try {
      const res = await fetch(`/api/rooms/availability?day=${currentDayOfWeek()}&time=${currentTimeString()}`);
      if (!res.ok) throw new Error('api');
      const data = await res.json();
      if (data.success && Array.isArray(data.floors)) {
        // Always pass server floors through the local builder so the
        // ground-floor venue statuses (canteen open/closed + auditorium
        // event) are overlaid on top.
        setLiveFloors(computeRoomAvailability(currentDayOfWeek(), currentTimeString(), data.floors));
        setLiveSource('server');
        return;
      }
      throw new Error('bad payload');
    } catch {
      // Fallback: local routines only
      setLiveFloors(computeDemoAvailability());
      setLiveSource('local');
    }
  }, []);

  useEffect(() => {
    fetchAvailability();
    const handler = () => fetchAvailability();
    window.addEventListener('routine-updated', handler);
    window.addEventListener('auditorium-updated', handler);
    // Keep the canteen open/closed state live as the real time changes — a
    // light local recompute (no network request every minute).
    const minuteTimer = setInterval(() => {
      setLiveFloors((prev) => computeRoomAvailability(currentDayOfWeek(), currentTimeString(), prev));
    }, 60 * 1000);
    return () => {
      window.removeEventListener('routine-updated', handler);
      window.removeEventListener('auditorium-updated', handler);
      clearInterval(minuteTimer);
    };
  }, [fetchAvailability]);

  const { floors: allFloors } = { floors: liveFloors };

  // 1) Floor filter
  const floorScoped = useMemo(
    () =>
      floorFilter === 'all'
        ? allFloors
        : allFloors.filter((f) => f.id === floorFilter),
    [allFloors, floorFilter]
  );

  // 2) Search filter
  const searchFloors = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return floorScoped;

    return floorScoped
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
  }, [floorScoped, searchTerm]);

  // 3) Totals across all floors (always full counts — not search-filtered)
  const totals = useMemo(() => {
    let free = 0;
    let busy = 0;
    allFloors.forEach((f) =>
      f.rooms.forEach((r) => (r.status === 'free' ? (free += 1) : (busy += 1)))
    );
    return { free, busy, total: free + busy };
  }, [allFloors]);

  // 4) Status filter for display
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
    searchTerm.trim() !== '' || statusFilter !== 'all' || floorFilter !== 'all';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayFloors, searchTerm, statusFilter, floorFilter, isFiltering]);

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
            <span className="schedule-subtitle">Live availability across all floors</span>
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

        <div className="ecf-floor-select">
          <select
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            className="ecf-floor-select-input"
            aria-label="Filter by floor"
          >
            <option value="all">All Floors</option>
            {roomCatalog.floors.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
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
                              <RoomCard key={room.id} room={room} />
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

    </div>
  );
}

function RoomCard({ room }) {
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
    <div className={`ecf-card ${isFree ? 'free' : 'busy'}`}>
      <div className="ecf-card-top">
        <span className="ecf-card-id">
          {room.id}
          <span className="ecf-card-type">{room.type === 'lab' ? 'Lab' : 'Classroom'}</span>
        </span>
        <span className={`ecf-led ${isFree ? 'free' : 'busy'}`} title={isFree ? 'Free' : 'Busy'} />
      </div>

      {isFree ? (
        <div className="ecf-card-free">Available for self-study</div>
      ) : (
        d && (
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
        )
      )}
    </div>
  );
}
