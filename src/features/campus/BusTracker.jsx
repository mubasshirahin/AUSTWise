import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Bus,
  MapPin,
  Search,
  Navigation,
  AlertCircle,
  RefreshCw,
  Plus,
  X,
  Trash2,
  Save,
  Edit3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import './SemesterViewWidget.css';
import './BusTracker.css';

// ─── LocalStorage Helpers ───

const CUSTOM_BUSES_KEY = 'aust-bus-custom-routes';

function loadCustomBuses() {
  try {
    const raw = localStorage.getItem(CUSTOM_BUSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomBuses(buses) {
  localStorage.setItem(CUSTOM_BUSES_KEY, JSON.stringify(buses));
}

// ─── ID Generator ───

let idCounter = Date.now();
function genId() {
  return `custom-${++idCounter}`;
}

// ─── Helpers ───

function toMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function getNextDeparture(times) {
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  let next = null;
  let minDiff = Infinity;

  for (const t of times) {
    const tm = toMinutes(t);
    const diff = tm - nowMinutes;
    if (diff >= 0 && diff < minDiff) {
      minDiff = diff;
      next = t;
    }
  }
  if (!next && times.length > 0) {
    next = times[0];
    minDiff = toMinutes(times[0]) + 1440 - nowMinutes;
  }
  return { time: next, minutesUntil: next ? minDiff : null };
}

function getTodaySchedule(schedules) {
  const day = new Date().getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  if (day === 6) {
    const sat = schedules.find(s => s.day.includes('Saturday'));
    if (sat) return sat;
  }
  if (day === 5) return null;
  return schedules.find(s => s.day === 'Sun–Thu');
}

function getAllTodayTimes(route) {
  const sched = getTodaySchedule(route.schedule);
  if (!sched) return { departures: [], returns: [] };
  return { departures: sched.departures, returns: sched.returns };
}

// ─── Default Form State ───

// All buses share the app's theme accent color (no per-bus color choice)
const ACCENT = 'var(--accent-amber)';
const ACCENT_SOFT = 'var(--accent-amber-glow)';
const ACCENT_FADED = 'color-mix(in srgb, var(--accent-amber) 30%, transparent)';

const EMPTY_STOP = { name: '', time: '', direction: 'to-campus', details: '' };

const INITIAL_FORM_STATE = {
  name: '',
  stops: [{ name: '', time: '', direction: 'to-campus' }],
  returnStops: [{ name: '', time: '', direction: 'from-campus' }],
};

// ─── Component ───

export default function BusTracker() {
  const [activeRoute, setActiveRoute] = useState(null);
  const [view, setView] = useState('all');
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('to-campus');
  const [now, setNow] = useState(Date.now());
  const [showAddModal, setShowAddModal] = useState(false);
  const [customBuses, setCustomBuses] = useState(loadCustomBuses);
  const [editingBusId, setEditingBusId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [formErrors, setFormErrors] = useState({});

  // One shared rail — measured to span exactly first→last dot centers
  const timelineRef = useRef(null);
  const firstDotRef = useRef(null);
  const lastDotRef = useRef(null);
  const [rail, setRail] = useState(null);

  // Tick every 30s to refresh countdowns
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Reset form when modal closes
  useEffect(() => {
    if (!showAddModal) {
      setForm(INITIAL_FORM_STATE);
      setFormErrors({});
      setEditingBusId(null);
    }
  }, [showAddModal]);

  const routes = customBuses;

  const selectedRoute = useMemo(
    () => routes.find(r => r.id === activeRoute) || routes[0] || null,
    [activeRoute, routes]
  );

  // Default to the first route when routes exist but none is active
  useEffect(() => {
    if (routes.length > 0 && !activeRoute) {
      setActiveRoute(routes[0].id);
    }
  }, [routes, activeRoute]);

  const allRoutes = routes;

  const todayTimes = useMemo(() => {
    const result = {};
    for (const route of routes) {
      result[route.id] = getAllTodayTimes(route);
    }
    return result;
  }, [routes]);

  const currentDirectionStops = useMemo(
    () => {
      if (!selectedRoute) return [];
      const stops = direction === 'to-campus' ? selectedRoute.stops : selectedRoute.returnStops;
      return [...stops].sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
    },
    [direction, selectedRoute]
  );

  // One shared rail — measured to span exactly first→last dot centers
  useEffect(() => {
    const tl = timelineRef.current;
    if (!tl || currentDirectionStops.length < 2) {
      setRail(null);
      return undefined;
    }
    const measure = () => {
      const f = firstDotRef.current;
      const l = lastDotRef.current;
      if (!f || !l) return;
      const tlRect = tl.getBoundingClientRect();
      const fRect = f.getBoundingClientRect();
      const lRect = l.getBoundingClientRect();
      const top = fRect.top - tlRect.top + fRect.height / 2;
      const bottom = lRect.top - tlRect.top + lRect.height / 2;
      setRail({
        top,
        left: fRect.left - tlRect.left + fRect.width / 2 - 2.5,
        height: Math.max(0, bottom - top),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(tl);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [currentDirectionStops]);

  const currentDirectionTimes = useMemo(
    () => {
      const routeId = selectedRoute?.id;
      return direction === 'to-campus' ? todayTimes[routeId]?.departures || [] : todayTimes[routeId]?.returns || [];
    },
    [direction, todayTimes, selectedRoute]
  );

  const nextDeparture = useMemo(
    () => getNextDeparture(currentDirectionTimes),
    [currentDirectionTimes]
  );

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return routes
      .map(route => ({
        route,
        matches: [...route.stops, ...route.returnStops].filter(s => s.name.toLowerCase().includes(q)),
      }))
      .filter(r => r.matches.length > 0);
  }, [search, routes]);

  const isTodayActive = useMemo(() => {
    const day = new Date().getDay();
    return day !== 5;
  }, []);

  const toggleDirection = () => {
    setDirection(d => d === 'to-campus' ? 'from-campus' : 'to-campus');
  };

  // Prev / next route navigation
  const navigateRoute = useCallback((delta) => {
    if (routes.length === 0) return;
    const idx = routes.findIndex(r => r.id === selectedRoute?.id);
    const nextIdx = (idx + delta + routes.length) % routes.length;
    setActiveRoute(routes[nextIdx].id);
  }, [routes, selectedRoute]);

  // ─── Form Handlers ───

  const updateForm = useCallback((patch) => {
    setForm(prev => ({ ...prev, ...patch }));
  }, []);

  const updateStop = useCallback((idx, field, value, listKey) => {
    setForm(prev => {
      const stops = [...prev[listKey]];
      stops[idx] = { ...stops[idx], [field]: value };
      return { ...prev, [listKey]: stops };
    });
  }, []);

  const addStop = useCallback((listKey) => {
    setForm(prev => ({
      ...prev,
      [listKey]: [...prev[listKey], { ...EMPTY_STOP, direction: listKey === 'stops' ? 'to-campus' : 'from-campus' }],
    }));
  }, []);

  const removeStop = useCallback((idx, listKey) => {
    setForm(prev => ({
      ...prev,
      [listKey]: prev[listKey].filter((_, i) => i !== idx),
    }));
  }, []);

  const validateForm = useCallback(() => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Bus name is required';
    const validStops = form.stops.filter(s => s.name.trim() && s.time.trim());
    if (validStops.length === 0) errors.stops = 'At least one stop is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

  const handleSaveBus = useCallback(() => {
    if (!validateForm()) return;

    const validStops = form.stops
      .filter(s => s.name.trim() && s.time.trim())
      .map(s => ({ name: s.name.trim(), time: s.time.trim(), direction: 'to-campus', details: (s.details || '').trim() }))
      .sort((a, b) => toMinutes(a.time) - toMinutes(b.time));

    const validReturnStops = form.returnStops
      .filter(s => s.name.trim() && s.time.trim())
      .map(s => ({ name: s.name.trim(), time: s.time.trim(), direction: 'from-campus', details: (s.details || '').trim() }))
      .sort((a, b) => toMinutes(a.time) - toMinutes(b.time));

    const schedule = [
      {
        day: 'Sun–Thu',
        departures: validStops.map(s => s.time),
        returns: validReturnStops.map(s => s.time),
      },
    ];

    const icon = form.name.trim().split(/[\s/]+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

    const newBus = {
      id: editingBusId || genId(),
      name: form.name.trim(),
      icon,
      stops: validStops,
      returnStops: validReturnStops,
      schedule,
    };

    let updated;
    if (editingBusId) {
      updated = customBuses.map(b => b.id === editingBusId ? newBus : b);
    } else {
      updated = [...customBuses, newBus];
    }

    setCustomBuses(updated);
    saveCustomBuses(updated);
    setActiveRoute(newBus.id);
    setShowAddModal(false);
  }, [form, customBuses, editingBusId, validateForm]);

  const handleEditBus = useCallback((bus) => {
    setEditingBusId(bus.id);
    setForm({
      name: bus.name,
      stops: bus.stops.length > 0
        ? bus.stops.map(s => ({ name: s.name, time: s.time, direction: 'to-campus', details: s.details || '' }))
        : [{ name: '', time: '', direction: 'to-campus', details: '' }],
      returnStops: bus.returnStops.length > 0
        ? bus.returnStops.map(s => ({ name: s.name, time: s.time, direction: 'from-campus', details: s.details || '' }))
        : [{ name: '', time: '', direction: 'from-campus', details: '' }],

    });
    setShowAddModal(true);
  }, []);

  const handleDeleteBus = useCallback((busId) => {
    const updated = customBuses.filter(b => b.id !== busId);
    setCustomBuses(updated);
    saveCustomBuses(updated);
    if (activeRoute === busId) {
      setActiveRoute(updated[0]?.id || null);
    }
  }, [customBuses, activeRoute]);

  return (
    <div className="glass-card-static schedule-widget sv-widget bus-widget animate-fadeInUp">

      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <Bus size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Campus</span>
            <div className="schedule-title">Bus Tracker</div>
            <span className="schedule-subtitle">
              {isTodayActive ? 'Shuttle service active today' : 'No service today (Friday)'}
            </span>
          </div>
        </div>

        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="schedule-stat-value">{routes.length}</span>
              <span className="schedule-stat-label">Routes</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">{currentDirectionStops.length}</span>
              <span className="schedule-stat-label">Stops</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value" style={{ fontSize: 'var(--fs-sm)' }}>
                {nextDeparture.time ? nextDeparture.time : '—'}
              </span>
              <span className="schedule-stat-label">Next Bus</span>
            </div>
          </div>
        </div>

        <div className="schedule-actions">
          <button
            className="bus-add-btn"
            onClick={() => { setEditingBusId(null); setForm(INITIAL_FORM_STATE); setShowAddModal(true); }}
          >
            <Plus size={14} /> Add Bus
          </button>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {/* ─── Search Bar ─── */}
      <div className="bus-tracker-search">
        <Search size={14} className="bus-tracker-search-icon" />
        <input
          type="text"
          placeholder="Search by stop name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bus-tracker-search-input"
        />
        {search && (
          <button className="bus-tracker-search-clear" onClick={() => setSearch('')}>
            ✕
          </button>
        )}
      </div>

      {/* ─── Search Results Overlay ─── */}
      {search.trim() && searchResults.length > 0 && (
        <div className="bus-tracker-search-results">
          {searchResults.map(({ route, matches }) => (
            <button
              key={route.id}
              className="bus-tracker-search-result-item"
              onClick={() => {
                setActiveRoute(route.id);
                setSearch('');
                setView('route');
              }}
            >
              <span className="bus-tracker-search-result-icon" style={{ background: ACCENT, color: '#fff' }}>
                {route.icon}
              </span>
              <span className="bus-tracker-search-result-info">
                <span className="bus-tracker-search-result-name">{route.name}</span>
                <span className="bus-tracker-search-result-stops">
                  <MapPin size={11} />
                  {matches.map(m => m.name).join(' · ')}
                </span>
              </span>
              <ChevronRight size={15} className="bus-tracker-search-result-arrow" />
            </button>
          ))}
        </div>
      )}

      {/* ─── Empty State ─── */}
      {!search.trim() && routes.length === 0 && (
        <div className="sv-empty">
          <Bus size={36} className="sv-empty-icon" strokeWidth={1.5} />
          <h3>No Bus Routes Yet</h3>
          <p>Add your first bus route to start tracking schedules, stops, and departure times.</p>
          <button className="bus-add-btn" onClick={() => { setEditingBusId(null); setForm(INITIAL_FORM_STATE); setShowAddModal(true); }}>
            <Plus size={16} /> Add Your First Bus
          </button>
        </div>
      )}

      {/* ─── Route Navigation + Details ─── */}
      {!search.trim() && routes.length > 0 && (
        <>
          {/* Route switcher bar: To Campus on left, prev/pill/next on right */}
          <div className="schedule-week-nav bus-route-nav">
            <button className="bus-tracker-direction-btn" onClick={toggleDirection}>
              <Navigation size={13} />
              {direction === 'to-campus' ? 'To Campus' : 'From Campus'}
              <RefreshCw size={11} className="bus-tracker-direction-icon" />
            </button>
            <div className="bus-route-switch-group">
              <button className="schedule-nav-btn" onClick={() => navigateRoute(-1)} title="Previous route">
                <ChevronLeft size={20} />
              </button>
              <div className="schedule-week-pill bus-route-pill">
                <span className="bus-route-pill-icon" style={{ background: ACCENT }}>
                  {selectedRoute.icon}
                </span>
                <span className="schedule-week-pill-value bus-route-pill-name">{selectedRoute.name}</span>
              </div>
              <button className="schedule-nav-btn" onClick={() => navigateRoute(1)} title="Next route">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {/* ─── Route Details with Timeline ─── */}
          <div className="bus-tracker-route-detail">
            <div className="bus-tracker-route-header">
              <span
                className="bus-tracker-route-badge"
                style={{ background: ACCENT_SOFT, color: ACCENT, borderColor: ACCENT }}
              >
                <Bus size={12} strokeWidth={2.5} />
                {selectedRoute.name}
              </span>
              <span className="bus-tracker-route-actions">
                <button
                  className="bus-tracker-tab-action-btn"
                  title="Edit bus"
                  onClick={() => handleEditBus(selectedRoute)}
                >
                  <Edit3 size={11} />
                </button>
                <button
                  className="bus-tracker-tab-action-btn danger"
                  title="Delete bus"
                  onClick={() => handleDeleteBus(selectedRoute.id)}
                >
                  <Trash2 size={11} />
                </button>
              </span>
              <span className="bus-tracker-route-stop-count">
                {currentDirectionStops.length} stops
              </span>
            </div>

            <div className="bus-tracker-timeline" ref={timelineRef}>
              {rail && (
                <div
                  className="bus-tracker-timeline-rail"
                  style={{
                    top: rail.top,
                    left: rail.left,
                    height: rail.height,
                    background: ACCENT_FADED,
                  }}
                />
              )}
              {currentDirectionStops.map((stop, index) => {
                const idx = index;
                const isLast = idx === currentDirectionStops.length - 1;
                const isFirst = idx === 0;
                return (
                  <div key={idx} className={`bus-tracker-timeline-stop ${isLast ? 'last' : ''} ${isFirst ? 'first' : ''}`}>
                    <div className="bus-tracker-timeline-marker">
                      <div
                        ref={isFirst ? firstDotRef : isLast ? lastDotRef : undefined}
                        className="bus-tracker-timeline-dot"
                        style={{
                          background: (isFirst || isLast) ? ACCENT : undefined,
                          borderColor: ACCENT,
                        }}
                      />
                    </div>
                    <div className="bus-tracker-stop-info">
                      <span className="bus-tracker-stop-name">
                        {isLast && <MapPin size={11} style={{ color: ACCENT }} />}
                        {stop.name}
                      </span>
                      <span className="bus-tracker-stop-time">{stop.time}</span>
                      {stop.details && (
                        <span className="bus-tracker-stop-details">{stop.details}</span>
                      )}
                    </div>
                    {isFirst && (
                      <span
                        className="bus-tracker-route-start-badge"
                        style={{ background: ACCENT_SOFT, color: ACCENT }}
                      >
                        Start
                      </span>
                    )}
                    {isLast && (
                      <span
                        className="bus-tracker-route-end-badge"
                        style={{ background: ACCENT }}
                      >
                        Destination
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── Tips Footer ─── */}
          <div className="bus-tracker-tips">
            <AlertCircle size={12} />
            <span>Times are not fixed — subject to traffic.</span>
          </div>
        </>
      )}

      {/* ─── Add / Edit Bus Modal ─── */}
      {showAddModal && createPortal(
        <div className="bus-tracker-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="bus-tracker-modal" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bus-tracker-modal-header">
              <h3 className="bus-tracker-modal-title">
                <Bus size={16} />
                {editingBusId ? 'Edit Bus Route' : 'Add New Bus Route'}
              </h3>
              <button className="bus-tracker-modal-close" onClick={() => setShowAddModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="bus-tracker-modal-body">
              {/* Bus Name */}
              <div className="bus-tracker-form-group">
                <label className="bus-tracker-form-label">Bus / Route Name *</label>
                <input
                  type="text"
                  className={`bus-tracker-form-input ${formErrors.name ? 'error' : ''}`}
                  placeholder="e.g. Mirpur – 12 / 1"
                  value={form.name}
                  onChange={e => updateForm({ name: e.target.value })}
                />
                {formErrors.name && <span className="bus-tracker-form-error">{formErrors.name}</span>}
              </div>

              {/* Stops (To Campus) */}
              <div className="bus-tracker-form-section">
                <div className="bus-tracker-form-section-header">
                  <label className="bus-tracker-form-label">Stops (To Campus) *</label>
                  {formErrors.stops && <span className="bus-tracker-form-error">{formErrors.stops}</span>}
                </div>
                {form.stops.map((stop, idx) => (
                  <div key={idx} className="bus-tracker-stop-row">
                    <span className="bus-tracker-stop-number">{idx + 1}</span>
                    <input
                      type="text"
                      className="bus-tracker-form-input sm"
                      placeholder="Stop name"
                      value={stop.name}
                      onChange={e => updateStop(idx, 'name', e.target.value, 'stops')}
                    />
                    <input
                      type="time"
                      className="bus-tracker-form-input time"
                      value={stop.time}
                      onChange={e => updateStop(idx, 'time', e.target.value, 'stops')}
                    />
                    {form.stops.length > 1 && (
                      <button className="bus-tracker-stop-remove" onClick={() => removeStop(idx, 'stops')}>
                        <X size={12} />
                      </button>
                    )}
                    <input
                      type="text"
                      className="bus-tracker-form-input bus-tracker-stop-details-input"
                      placeholder="Details, e.g. near main gate"
                      value={stop.details || ''}
                      onChange={e => updateStop(idx, 'details', e.target.value, 'stops')}
                    />
                  </div>
                ))}
                <button className="bus-tracker-add-stop-btn" onClick={() => addStop('stops')}>
                  <Plus size={12} /> Add Stop
                </button>
              </div>

              {/* Return Stops (From Campus) */}
              <div className="bus-tracker-form-section">
                <div className="bus-tracker-form-section-header">
                  <label className="bus-tracker-form-label">Return Stops (From Campus) *</label>
                  {formErrors.returnStops && <span className="bus-tracker-form-error">{formErrors.returnStops}</span>}
                </div>
                {form.returnStops.map((stop, idx) => (
                  <div key={idx} className="bus-tracker-stop-row">
                    <span className="bus-tracker-stop-number">{idx + 1}</span>
                    <input
                      type="text"
                      className="bus-tracker-form-input sm"
                      placeholder="Stop name"
                      value={stop.name}
                      onChange={e => updateStop(idx, 'name', e.target.value, 'returnStops')}
                    />
                    <input
                      type="time"
                      className="bus-tracker-form-input time"
                      value={stop.time}
                      onChange={e => updateStop(idx, 'time', e.target.value, 'returnStops')}
                    />
                    {form.returnStops.length > 1 && (
                      <button className="bus-tracker-stop-remove" onClick={() => removeStop(idx, 'returnStops')}>
                        <X size={12} />
                      </button>
                    )}
                    <input
                      type="text"
                      className="bus-tracker-form-input bus-tracker-stop-details-input"
                      placeholder="Details, e.g. near main gate"
                      value={stop.details || ''}
                      onChange={e => updateStop(idx, 'details', e.target.value, 'returnStops')}
                    />
                  </div>
                ))}
                <button className="bus-tracker-add-stop-btn" onClick={() => addStop('returnStops')}>
                  <Plus size={12} /> Add Stop
                </button>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bus-tracker-modal-footer">
              <button className="bus-tracker-modal-cancel" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button className="bus-tracker-modal-save" onClick={handleSaveBus}>
                <Save size={14} />
                {editingBusId ? 'Update Bus' : 'Save Bus'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
