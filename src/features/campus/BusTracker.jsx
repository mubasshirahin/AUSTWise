import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Bus,
  MapPin,
  Clock,
  Search,
  Navigation,
  AlertCircle,
  RefreshCw,
  Plus,
  X,
  Trash2,
  Save,
  Edit3,
} from 'lucide-react';
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

function formatMinutes(min) {
  if (min <= 0) return 'Now';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
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

function getAllStops(routes) {
  const stops = [];
  for (const route of routes) {
    for (const stop of route.stops) {
      if (!stops.find(s => s.name === stop.name)) {
        stops.push({ name: stop.name, routeId: route.id, routeName: route.name });
      }
    }
    for (const stop of route.returnStops) {
      if (!stops.find(s => s.name === stop.name)) {
        stops.push({ name: stop.name, routeId: route.id, routeName: route.name });
      }
    }
  }
  return stops;
}

// ─── Default Form State ───

const EMPTY_STOP = { name: '', time: '', direction: 'to-campus', details: '' };

const INITIAL_FORM_STATE = {
  name: '',
  color: '#06b6d4',
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

  const allStops = useMemo(() => getAllStops(routes), [routes]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allStops.filter(s => s.name.toLowerCase().includes(q));
  }, [search, allStops]);

  const isTodayActive = useMemo(() => {
    const day = new Date().getDay();
    return day !== 5;
  }, []);

  const toggleDirection = () => {
    setDirection(d => d === 'to-campus' ? 'from-campus' : 'to-campus');
  };

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
    const validReturnStops = form.returnStops.filter(s => s.name.trim() && s.time.trim());
    if (validReturnStops.length === 0) errors.returnStops = 'At least one return stop is required';
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
      color: form.color,
      bg: form.color + '1F',
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
      color: bus.color,
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
      setActiveRoute(allRoutes[0]?.id || null);
    }
  }, [customBuses, activeRoute, allRoutes]);

  return (
    <div className="bus-tracker-root">
      {/* ─── Header Section ─── */}
      <div className="bus-tracker-header">
        <div className="bus-tracker-header-row">
          <div className="bus-tracker-heading-icon">
            <Bus size={22} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="bus-tracker-title">Bus Tracker</h2>
            <p className="bus-tracker-desc">
              Your custom bus routes & real-time next departure
            </p>
          </div>
        </div>

        <div className="bus-tracker-header-actions">
          <div className={`bus-tracker-live-badge ${isTodayActive ? 'active' : ''}`}>
            <span className="bus-tracker-live-dot" />
            {isTodayActive ? 'Service Active' : 'No Service (Friday)'}
          </div>

          <button className="bus-tracker-add-btn" onClick={() => { setEditingBusId(null); setForm(INITIAL_FORM_STATE); setShowAddModal(true); }}>
            <Plus size={14} />
            Add Bus
          </button>
        </div>
      </div>

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
          {searchResults.slice(0, 8).map((stop, i) => (
            <button
              key={`${stop.routeId}-${stop.name}-${i}`}
              className="bus-tracker-search-result-item"
              onClick={() => {
                setActiveRoute(stop.routeId);
                setSearch('');
                setView('route');
              }}
            >
              <MapPin size={13} />
              <span>{stop.name}</span>
              <span className="bus-tracker-search-result-route">{stop.routeName}</span>
            </button>
          ))}
        </div>
      )}

      {/* ─── Empty State ─── */}
      {!search.trim() && routes.length === 0 && (
        <div className="bus-tracker-empty">
          <div className="bus-tracker-empty-icon">
            <Bus size={36} strokeWidth={1.5} />
          </div>
          <h3 className="bus-tracker-empty-title">No Bus Routes Yet</h3>
          <p className="bus-tracker-empty-desc">
            Add your first bus route to start tracking schedules, stops, and departure times.
          </p>
          <button className="bus-tracker-add-btn" onClick={() => { setEditingBusId(null); setForm(INITIAL_FORM_STATE); setShowAddModal(true); }}>
            <Plus size={16} />
            Add Your First Bus
          </button>
        </div>
      )}

      {/* ─── Route Tabs ─── */}
      {!search.trim() && routes.length > 0 && (
        <>
          <div className="bus-tracker-tabs">
            {routes.map(route => (
              <div key={route.id} className="bus-tracker-tab-wrapper">
                <button
                  className={`bus-tracker-tab ${activeRoute === route.id ? 'active' : ''}`}
                  style={{
                    '--tab-color': route.color,
                    '--tab-bg': route.bg,
                  }}
                  onClick={() => setActiveRoute(route.id)}
                >
                  <span className="bus-tracker-tab-icon" style={{ background: route.color }}>
                    {route.icon}
                  </span>
                  <span className="bus-tracker-tab-label">{route.name}</span>
                </button>
                {route.id.startsWith('custom-') && (
                  <div className="bus-tracker-tab-actions">
                    <button
                      className="bus-tracker-tab-action-btn"
                      title="Edit bus"
                      onClick={(e) => { e.stopPropagation(); handleEditBus(route); }}
                    >
                      <Edit3 size={10} />
                    </button>
                    <button
                      className="bus-tracker-tab-action-btn danger"
                      title="Delete bus"
                      onClick={(e) => { e.stopPropagation(); handleDeleteBus(route.id); }}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button className="bus-tracker-add-tab-btn" onClick={() => { setEditingBusId(null); setForm(INITIAL_FORM_STATE); setShowAddModal(true); }}>
              <Plus size={14} />
            </button>
          </div>

          {/* ─── Direction Toggle & Next Bus ─── */}
          <div className="bus-tracker-info-bar">
            <button className="bus-tracker-direction-btn" onClick={toggleDirection}>
              <Navigation size={13} />
              {direction === 'to-campus' ? 'To Campus' : 'From Campus'}
              <RefreshCw size={11} className="bus-tracker-direction-icon" />
            </button>

            <div className="bus-tracker-next-bus">
              <Clock size={13} />
              {nextDeparture.time ? (
                <>
                  Next: <strong>{nextDeparture.time}</strong>
                  <span className="bus-tracker-next-countdown">
                    ({formatMinutes(nextDeparture.minutesUntil)})
                  </span>
                </>
              ) : (
                <span className="bus-tracker-no-service">No scheduled service today</span>
              )}
            </div>
          </div>

          {/* ─── Schedule Chip ─── */}
          {selectedRoute?.id && todayTimes[selectedRoute.id] && (
            <div className="bus-tracker-schedule-chips">
              <span className="bus-tracker-schedule-chip">
                Departures: {todayTimes[selectedRoute.id].departures.join(', ')}
              </span>
              <span className="bus-tracker-schedule-chip">
                Returns: {todayTimes[selectedRoute.id].returns.join(', ')}
              </span>
            </div>
          )}

          {/* ─── Route Details with Timeline ─── */}
          <div className="bus-tracker-route-detail">
            <div className="bus-tracker-route-header">
              <span
                className="bus-tracker-route-badge"
                style={{ background: selectedRoute.bg, color: selectedRoute.color, borderColor: selectedRoute.color }}
              >
                <Bus size={12} strokeWidth={2.5} />
                {selectedRoute.name}
              </span>
              <span className="bus-tracker-route-stop-count">
                {currentDirectionStops.length} stops
              </span>
            </div>

            <div className="bus-tracker-timeline">
              {currentDirectionStops.map((stop, idx) => {
                const isLast = idx === currentDirectionStops.length - 1;
                const isFirst = idx === 0;
                return (
                  <div key={idx} className={`bus-tracker-timeline-stop ${isLast ? 'last' : ''} ${isFirst ? 'first' : ''}`}>
                    <div className="bus-tracker-timeline-marker">
                      <div
                        className="bus-tracker-timeline-dot"
                        style={{
                          background: isLast ? selectedRoute.color : undefined,
                          borderColor: selectedRoute.color,
                        }}
                      />
                      {!isLast && (
                        <div
                          className="bus-tracker-timeline-line"
                          style={{ background: selectedRoute.color + '33' }}
                        />
                      )}
                    </div>
                    <div className="bus-tracker-stop-info">
                      <span className="bus-tracker-stop-name">
                        {isLast && <MapPin size={11} style={{ color: selectedRoute.color }} />}
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
                        style={{ background: selectedRoute.bg, color: selectedRoute.color }}
                      >
                        Start
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
            <span>
              Add your bus routes using the + button. Times are approximate and subject to traffic.
            </span>
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

              {/* Color */}
              <div className="bus-tracker-form-group">
                <label className="bus-tracker-form-label">Route Color</label>
                <div className="bus-tracker-color-picker">
                  {['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#f97316', '#3b82f6', '#14b8a6', '#a855f7'].map(c => (
                    <button
                      key={c}
                      className={`bus-tracker-color-swatch ${form.color === c ? 'active' : ''}`}
                      style={{ background: c }}
                      onClick={() => updateForm({ color: c })}
                    />
                  ))}
                  <input
                    type="color"
                    className="bus-tracker-color-custom"
                    value={form.color}
                    onChange={e => updateForm({ color: e.target.value })}
                    title="Custom color"
                  />
                </div>
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
