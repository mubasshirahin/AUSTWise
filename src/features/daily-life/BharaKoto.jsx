import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banknote,
  MapPin,
  Bus,
  BusFront,
  Bike,
  Car,
  CarTaxiFront,
  TrainFront,
  Zap,
  Navigation,
  Search,
  X,
  ChevronDown,
  Info,
  Send,
  RouteOff,
  ArrowUpRight,
} from 'lucide-react';
import {
  DESTINATION,
  DHKA_AREAS,
  AREA_INDEX,
  TRACKED_BUS_META,
  FARE_CARD_NOTES,
  METRO_RICKSHAW_BDT,
  METRO_STATIONS,
  rickshawCutoffKm,
} from '../../data/fareData';
import '../campus/SemesterViewWidget.css';
import './BharaKoto.css';

// ─── Fuzzy search ───────────────────────────────────────────────

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function subsequenceScore(needle, hay) {
  let ni = 0;
  let score = 0;
  for (let hi = 0; hi < hay.length && ni < needle.length; hi++) {
    if (needle[ni] === hay[hi]) {
      ni++;
      score += 2;
    }
  }
  return ni === needle.length ? score : -1;
}

function fuzzyScore(query, target) {
  const q = normalize(query);
  const t = normalize(target);
  if (!q) return 0;
  const idx = t.indexOf(q);
  if (idx !== -1) return 1000 - idx;
  let score = 0;
  for (const token of q.split(' ')) {
    if (!token) continue;
    const s = subsequenceScore(token, t);
    if (s < 0) return -1;
    score += s;
  }
  return score;
}

function searchAreas(query, limit = 8) {
  const q = normalize(query);
  if (!q) return AREA_INDEX.slice(0, limit);
  const scored = [];
  for (const { area, haystack } of AREA_INDEX) {
    let best = -1;
    for (const h of haystack) {
      const s = fuzzyScore(q, h);
      if (s > best) best = s;
    }
    if (best >= 0) scored.push({ area, best });
  }
  scored.sort((a, b) => b.best - a.best);
  return scored.slice(0, limit).map((s) => s.area);
}

// ─── Bus Tracker cross-reference ────────────────────────────────

const BUS_STORAGE_KEY = 'aust-bus-custom-routes';

function loadTrackedRoutes() {
  try {
    const raw = localStorage.getItem(BUS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function stopMatchesArea(stopName, area) {
  const names = [area.name, ...(area.aliases || [])].map((n) => normalize(n));
  const stop = normalize(stopName);
  if (!stop) return false;
  return names.some((n) => stop.includes(n) || n.includes(stop));
}

function findTrackedBuses(area) {
  const routes = loadTrackedRoutes();
  const found = [];
  for (const route of routes) {
    const stops = [...(route.stops || []), ...(route.returnStops || [])];
    if (stops.some((s) => s && stopMatchesArea(s.name, area))) {
      found.push({
        id: route.id,
        name: route.name,
        color: route.color || '#22d3ee',
        bg: route.bg || '#22d3ee1F',
      });
    }
  }
  return found;
}

// ─── Formatting ─────────────────────────────────────────────────

function formatRange(range) {
  if (!Array.isArray(range)) return '—';
  const [min, max] = range;
  if (min === 0 && max === 0) return 'Free';
  if (min === max) return `৳${min}`;
  return `৳${min} – ৳${max}`;
}

// ─── Error boundary (graceful fallback if any data path throws) ──

class BkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('[Bhara Koto] render error:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="bk-fallback animate-fadeInUp">
          <div className="bk-fallback-icon">
            <RouteOff size={26} />
          </div>
          <h3>Something went wrong loading fares</h3>
          <p>
            This area&apos;s data may be incomplete. Try another area, or refresh to load
            the latest estimates.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Mode card (simple fare card) ───────────────────────────────

function FareCard({ icon: Icon, title, accent, fare, note, children, muted }) {
  return (
    <div className={`bk-fare-card ${accent ? `bk-accent-${accent}` : ''} ${muted ? 'bk-muted' : ''}`}>
      <div className="bk-fare-card-top">
        <span className="bk-fare-card-icon">
          <Icon size={18} strokeWidth={2.2} />
        </span>
        <span className="bk-fare-card-title">{title}</span>
      </div>
      {children}
      <div className="bk-fare-card-fare">{fare}</div>
      {note && (
        <div className="bk-fare-card-note">
          <Info size={12} />
          <span>{note}</span>
        </div>
      )}
    </div>
  );
}

// ─── Ride-sharing card (Uber / Pathao × Car / Bike) ─────────────

function RideShareCard({ area }) {
  const rs = area.ride_share || {};
  const u = rs.uber || {};
  const p = rs.pathao || {};
  return (
    <div className="bk-fare-card bk-fare-card-rideshare bk-accent-rideshare">
      <div className="bk-fare-card-top">
        <span className="bk-fare-card-icon">
          <Car size={18} strokeWidth={2.2} />
        </span>
        <span className="bk-fare-card-title">Ride-sharing</span>
      </div>

      <div className="bk-rideshare-grid">
        {[
          { label: 'Uber', icon: Car, rows: [
              { key: 'car', name: 'Car', range: u.car, noteKey: 'uber_car' },
              { key: 'bike', name: 'Bike', range: u.bike, noteKey: 'uber_bike' },
            ] },
          { label: 'Pathao', icon: Bike, rows: [
              { key: 'car', name: 'Car', range: p.car, noteKey: 'pathao_car' },
              { key: 'bike', name: 'Bike', range: p.bike, noteKey: 'pathao_bike' },
            ] },
        ].map((provider) => (
          <div className="bk-rideshare-provider" key={provider.label}>
            <div className="bk-rideshare-provider-name">
              <provider.icon size={13} />
              {provider.label}
            </div>
            {provider.rows.map((row) => (
              <div className="bk-rideshare-row" key={row.key}>
                <span className="bk-rideshare-row-name">{row.name}</span>
                <span className="bk-rideshare-row-fare">{formatRange(row.range)}</span>
              </div>
            ))}
            <div className="bk-rideshare-note">
              <Info size={11} />
              {FARE_CARD_NOTES[provider.rows[0].noteKey]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Results panel ──────────────────────────────────────────────

function ResultsPanel({ area, onGoToBusTracker }) {
  const tracked = useMemo(() => findTrackedBuses(area), [area]);
  const rickshawApplicable = Array.isArray(area.rickshaw_fare);
  const localBusAvailable = Boolean(area.local_bus && area.local_bus.available);
  const metro = METRO_STATIONS[area.id];

  return (
    <div className="bk-results animate-fadeInUp">
      <div className="bk-results-header">
        <div className="bk-route-summary">
          <span className="bk-route-stop bk-route-from">
            <MapPin size={13} /> {area.name}
          </span>
          <span className="bk-route-arrow">
            <ArrowUpRight size={14} />
          </span>
          <span className="bk-route-stop bk-route-to">
            <MapPin size={13} /> {DESTINATION.name}
          </span>
          <span className="bk-route-distance">≈ {area.distance_km} km</span>
        </div>
        <p className="bk-results-hint">
          Estimate only — fares vary with traffic, time &amp; weather.
        </p>
      </div>

      <div className="bk-fare-grid">
        <FareCard
          icon={Bike}
          title="Rickshaw"
          accent="rickshaw"
          fare={rickshawApplicable ? formatRange(area.rickshaw_fare) : 'Not applicable'}
          note={rickshawApplicable ? FARE_CARD_NOTES.rickshaw : `Only for trips under ~${rickshawCutoffKm()} km`}
          muted={!rickshawApplicable}
        >
          {rickshawApplicable && (
            <span className="bk-fare-card-meta">{area.distance_km} km · short hop</span>
          )}
        </FareCard>

        <FareCard
          icon={BusFront}
          title="Local Bus"
          accent="local-bus"
          fare={localBusAvailable ? formatRange(area.local_bus.fare_range) : 'Not available'}
          note={localBusAvailable ? FARE_CARD_NOTES.local_bus : 'No direct public bus route found'}
          muted={!localBusAvailable}
        >
          {localBusAvailable && (
            <div className="bk-bus-chips">
              {area.local_bus.bus_names.slice(0, 3).map((name) => (
                <span className="bk-bus-chip" key={name}>{name}</span>
              ))}
            </div>
          )}
        </FareCard>

        <FareCard
          icon={TrainFront}
          title="Metro + Rickshaw"
          accent="metro"
          fare={metro ? `৳${metro.fare} + ৳${METRO_RICKSHAW_BDT} rickshaw` : 'Not available'}
          note={metro ? FARE_CARD_NOTES.metro : 'No MRT-6 station nearby'}
          muted={!metro}
        >
          {metro && (
            <span className="bk-fare-card-meta">
              {metro.station} → Farmgate (MRT-6)
            </span>
          )}
        </FareCard>

        <FareCard
          icon={Bus}
          title={TRACKED_BUS_META.label}
          accent="tracked-bus"
          fare={tracked.length > 0 ? formatRange(TRACKED_BUS_META.fare_range) : 'No route found'}
          note={tracked.length > 0 ? FARE_CARD_NOTES.tracked_bus : 'No tracked AUST shuttle for this area'}
          muted={tracked.length === 0}
        >
          {tracked.length > 0 && (
            <div className="bk-bus-chips">
              {tracked.slice(0, 3).map((b) => (
                <span
                  className="bk-bus-chip bk-bus-chip-tracked"
                  key={b.id}
                  style={{ '--chip-color': b.color, '--chip-bg': b.bg }}
                >
                  {b.name}
                </span>
              ))}
            </div>
          )}
          {tracked.length > 0 && (
            <button className="bk-bus-tracker-link" onClick={onGoToBusTracker}>
              <Navigation size={12} /> View in Bus Tracker
            </button>
          )}
        </FareCard>

        <FareCard
          icon={Zap}
          title="CNG / Auto"
          accent="cng"
          fare={formatRange(area.cng_fare)}
          note={FARE_CARD_NOTES.cng}
        >
          <span className="bk-fare-card-meta">meter + fuel surcharge</span>
        </FareCard>

        <FareCard
          icon={CarTaxiFront}
          title="Taxi"
          accent="taxi"
          fare={formatRange(area.taxi_fare)}
          note={FARE_CARD_NOTES.taxi}
        >
          <span className="bk-fare-card-meta">metered (Bangla-Taxi / etc.)</span>
        </FareCard>

        <RideShareCard area={area} />
      </div>
    </div>
  );
}

// ─── No-data fallback ───────────────────────────────────────────

function NoDataFallback({ place, onRequest }) {
  return (
    <div className="bk-fallback animate-fadeInUp">
      <div className="bk-fallback-icon">
        <RouteOff size={26} />
      </div>
      <h3>Fare data not available for this area yet</h3>
      <p>
        We don&apos;t have estimates for <strong>{place}</strong> yet. Submit a request and
        we&apos;ll add it in a future update.
      </p>
      <button className="bk-fallback-btn" onClick={() => onRequest(place)}>
        <Send size={14} /> Request update
      </button>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────

export default function BharaKoto() {
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [requested, setRequested] = useState(false);

  const boxRef = useRef(null);
  const inputRef = useRef(null);

  const matches = useMemo(() => searchAreas(query, 8), [query]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const selectArea = useCallback((area) => {
    setSelected(area);
    setQuery(area.name);
    setOpen(false);
    setRequested(false);
  }, []);

  const handleChange = (e) => {
    setQuery(e.target.value);
    setSelected(null);
    setRequested(false);
    setOpen(true);
    setHighlight(0);
  };

  const handleKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
      setOpen(true);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(matches.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && query.trim() && matches.length > 0) {
        e.preventDefault();
        const area = matches[Math.min(highlight, matches.length - 1)];
        if (area) selectArea(area);
      } else {
        setOpen(true);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const clearSelection = () => {
    setQuery('');
    setSelected(null);
    setRequested(false);
    inputRef.current?.focus();
  };

  const goToBusTracker = () => {
    try {
      localStorage.setItem('aust-campus-active-tab', 'bus');
    } catch {
      /* noop */
    }
    navigate('/campus');
  };

  const requestUpdate = (place) => {
    console.log('[Bhara Koto] Fare update requested for:', place);
    setRequested(true);
    setOpen(false);
  };

  const showDropdown = open && query.trim().length > 0;

  return (
    <div className="glass-card-static schedule-widget sv-widget bk-widget animate-fadeInUp">
      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile bk-icon-tile">
            <Banknote size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Daily Life</span>
            <div className="schedule-title">Bhara Koto</div>
            <span className="schedule-subtitle">Fare estimator → {DESTINATION.shortName}</span>
          </div>
        </div>

        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="schedule-stat-value bk-stat-accent">{DHKA_AREAS.length}</span>
              <span className="schedule-stat-label">Areas</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">7</span>
              <span className="schedule-stat-label">Modes</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">{DESTINATION.shortName}</span>
              <span className="schedule-stat-label">Target</span>
            </div>
          </div>
        </div>

        <div className="schedule-actions">
          <span className="bk-badge">
            <Info size={12} /> Estimates
          </span>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {/* ── Route picker ── */}
      <div className="bk-picker">
        <div className="bk-picker-label">From</div>
        <div className="bk-picker-row">
          <div className="bk-combobox" ref={boxRef}>
            <div className="bk-input-wrap">
              <Search size={15} className="bk-input-icon" />
              <input
                ref={inputRef}
                type="text"
                className="bk-input"
                role="combobox"
                aria-expanded={showDropdown}
                aria-controls="bk-listbox"
                aria-activedescendant={
                  showDropdown && matches.length > 0
                    ? `bk-opt-${Math.min(highlight, matches.length - 1)}`
                    : undefined
                }
                aria-autocomplete="list"
                aria-label="Choose starting area in Dhaka"
                placeholder="Type an area, e.g. Mirpur, Uttara, Farmgate…"
                value={query}
                onChange={handleChange}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
              />
              {query && (
                <button className="bk-clear-btn" onClick={clearSelection} aria-label="Clear area">
                  <X size={14} />
                </button>
              )}
              <button
                className="bk-chevron-btn"
                onClick={() => { setOpen((o) => !o); setHighlight(0); }}
                aria-label="Toggle area list"
              >
                <ChevronDown size={15} />
              </button>
            </div>

            {showDropdown && (
              <ul className="bk-listbox" id="bk-listbox" role="listbox" aria-label="Matching areas">
                {matches.length > 0 ? (
                  matches.map((area, i) => {
                    const isActive = i === Math.min(highlight, matches.length - 1);
                    return (
                      <li
                        key={area.id ?? i}
                        id={`bk-opt-${i}`}
                        role="option"
                        aria-selected={isActive}
                        className={`bk-option${isActive ? ' active' : ''}`}
                        onMouseEnter={() => setHighlight(i)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectArea(area)}
                      >
                        <MapPin size={14} className="bk-option-icon" />
                        <span className="bk-option-name">{area.name}</span>
                        <span className="bk-option-meta">≈ {area.distance_km} km</span>
                      </li>
                    );
                  })
                ) : (
                  <li className="bk-option bk-option-empty" role="option" aria-disabled="true">
                    <span>No matching area — try a nearby Dhaka location</span>
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Fixed destination */}
          <div className="bk-dest">
            <div className="bk-dest-pin">
              <MapPin size={16} />
            </div>
            <div className="bk-dest-info">
              <span className="bk-dest-label">To</span>
              <span className="bk-dest-name">{DESTINATION.name}</span>
            </div>
          </div>
        </div>
        <p className="bk-picker-hint">
          Pick where you&apos;re leaving from — we estimate the trip to AUST for every transport mode.
        </p>
      </div>

      {/* ── Results / fallback / idle ── */}
      <div className="bk-body">
        <BkErrorBoundary>
        {selected ? (
          <ResultsPanel area={selected} onGoToBusTracker={goToBusTracker} />
        ) : query.trim() && matches.length === 0 && open ? (
          <NoDataFallback
            place={query.trim()}
            onRequest={requestUpdate}
          />
        ) : requested ? (
          <div className="bk-fallback bk-fallback-ok animate-fadeInUp">
            <div className="bk-fallback-icon ok">
              <Send size={22} />
            </div>
            <h3>Update requested</h3>
            <p>
              Thanks! We&apos;ve logged your request for <strong>{query.trim() || selected?.name}</strong>.
              It&apos;ll be added in a future data update.
            </p>
          </div>
        ) : (
          <div className="bk-idle">
            <div className="bk-idle-icon">
              <Banknote size={30} />
            </div>
            <p>
              Search above for your starting area to see estimated fares for
              rickshaw, metro, bus, shuttle, CNG, taxi and ride-sharing.
            </p>
          </div>
        )}
        </BkErrorBoundary>
      </div>

      {/* ── Footer note ── */}
      <div className="bk-footer">
        <Info size={12} />
        <span>
          Static estimates — fares update from <code>src/data/fareData.js</code>. Tracked Bus
          routes are pulled live from your saved Bus Tracker routes.
        </span>
      </div>
    </div>
  );
}
