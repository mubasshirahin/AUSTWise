import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote, MapPin, Search, X, TrainFront, BusFront, CarTaxiFront, Car, Bike, Motorbike,
  Footprints, Info, Lightbulb, ExternalLink, BadgeCheck, Calculator, CircleHelp,
  ListOrdered, ChevronRight, PencilLine,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { ORIGINS, ZONES, SOURCES, LAST_VERIFIED } from './bhara-koto/fareData';
import routeCostData from '../../data/dhakaRouteCosts.json';
import { buildOptions, formatTaka } from './bhara-koto/fareEngine';
import '../campus/SemesterViewWidget.css';
import './DhakaRoutes.css';
import './bhara-koto/BharaKoto.css';

// ─── Presentation helpers ───────────────────────────────────────

const MODE_ICON = {
  walk: Footprints, rickshaw: Bike, bus: BusFront, metro: TrainFront,
  cng: CarTaxiFront, bike: Motorbike, car: Car,
};

const STATUS_META = {
  official: { label: 'Official', icon: BadgeCheck, hint: 'Straight from a published fare chart / tariff' },
  computed: { label: 'Official rate', icon: Calculator, hint: 'Official per-km rate × road distance' },
  estimate: { label: 'Estimate', icon: CircleHelp, hint: 'No official fare published — negotiation / app-price guide' },
};

const VERIFIED_LABEL = new Date(`${LAST_VERIFIED}T00:00:00`).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric',
});

const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const ALL_ORIGINS = routeCostData.rows.map((row, index) => {
  const curated = ORIGINS.find((origin) => normalize(origin.name) === normalize(row.source));
  return {
    ...(curated || {}),
    id: curated?.id || `legacy-area-${index}`,
    name: row.source,
    zone: curated?.zone || 'Other areas',
    km: curated?.km ?? row.distance_km,
    aliases: curated?.aliases || [],
    bus: curated ? curated.bus : {
      kind: 'satrasta',
      board: `${row.source} bus stop`,
      side: 'toward Satrasta / Tejgaon',
      km: row.distance_km,
      routesNote: 'Check the bus route board and confirm it goes toward Satrasta / Tejgaon before boarding.',
    },
    metro: curated?.metro || (row.metro_station && row.metro_station !== 'Farmgate' ? {
      station: row.metro_station === 'Secretariat' ? 'Bangladesh Secretariat' : row.metro_station,
      accessKm: 0.7,
      access: `Take a local ride from ${row.source} to ${row.metro_station} station, then ride MRT-6 to Farmgate.`,
    } : undefined),
  };
});
const fmtTime = ([a, b]) => (b >= 90 ? `${Math.round(a / 6) / 10}–${Math.round(b / 6) / 10} h` : `${a}–${b} min`);
const fareText = (fare) => (fare[1] === 0 ? 'Free' : formatTaka(fare));

function StatusBadge({ status, compact = false }) {
  const meta = STATUS_META[status];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span className={`bk-badge bk-badge-${status}`} title={meta.hint}>
      <Icon size={11} aria-hidden="true" />
      {!compact && meta.label}
      {compact && <span className="bk-sr">{meta.label}</span>}
    </span>
  );
}

function matchesQuery(origin, q) {
  if (!q) return true;
  if (normalize(origin.name).includes(q)) return true;
  return origin.aliases?.some((a) => normalize(a).includes(q));
}

// ─── Route panel (opens when a fare card is clicked) ───────────

function RoutePanel({ origin, option, onClose, isAdmin, note, onSaveNote }) {
  const closeRef = useRef(null);
  const [draft, setDraft] = useState(note || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const Icon = MODE_ICON[option.key] || BusFront;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSaveNote(draft);
    } catch (err) {
      setError(err.message || 'Could not save fare details.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="bk-overlay" onClick={onClose}>
      <div
        className="bk-panel animate-fadeInUp"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bk-panel-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bk-panel-head">
          <span className={`bk-mode-icon bk-mode-${option.key}`}><Icon size={18} /></span>
          <div className="bk-panel-titles">
            <span className="bk-panel-over">{origin.name} → AUST</span>
            <h3 id="bk-panel-title" className="bk-panel-title">{option.label}</h3>
          </div>
          <button ref={closeRef} type="button" className="bk-close" onClick={onClose} aria-label="Close route details">
            <X size={14} />
          </button>
        </div>

        <div className="bk-panel-summary">
          <div>
            <span className="bk-sum-label">Fare</span>
            <span className="bk-sum-value">{fareText(option.fare)}</span>
          </div>
          <div>
            <span className="bk-sum-label">Time</span>
            <span className="bk-sum-value">{fmtTime(option.time)}</span>
          </div>
          <div>
            <span className="bk-sum-label">Data</span>
            <StatusBadge status={option.status} />
          </div>
        </div>

        {option.metroFare && (
          <p className="bk-panel-official">
            <BadgeCheck size={13} /> Train fare is official: ৳{option.metroFare.single} single ticket · ৳{option.metroFare.card} with MRT/Rapid Pass.
          </p>
        )}
        {option.meter != null && (
          <p className="bk-panel-official">
            <Calculator size={13} /> Official meter fare ≈ ৳{option.meter} (+ ৳2/min waiting) — real asking price is higher.
          </p>
        )}

        {option.legs?.length > 1 && (
          <section className="bk-section">
            <h4 className="bk-section-title"><ChevronRight size={13} /> Fare breakdown</h4>
            <ul className="bk-legs">
              {option.legs.map((leg, i) => (
                <li key={i}>
                  <span>{leg.text}</span>
                  {leg.fare && <strong>{fareText(leg.fare)}</strong>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="bk-section">
          <h4 className="bk-section-title"><ListOrdered size={13} /> How to get there</h4>
          <ol className="bk-steps">
            {option.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </section>

        {option.tips?.length > 0 && (
          <section className="bk-section">
            <h4 className="bk-section-title"><Lightbulb size={13} /> Tips</h4>
            <ul className="bk-tips">
              {option.tips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </section>
        )}

        {(isAdmin || (note || '').trim()) && (
          <section className="bk-section">
            <h4 className="bk-section-title"><PencilLine size={13} /> Notes from AUSTWise team</h4>
            {isAdmin ? (
              <>
                <textarea
                  className="input bk-note-input"
                  rows={3}
                  maxLength={1000}
                  placeholder="Add an extra tip for students (shared with everyone)…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <div className="bk-note-actions">
                  <span className="bk-note-count">{draft.length} / 1000</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft('')}>Clear</button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                    {saving ? 'Saving…' : 'Save note'}
                  </button>
                </div>
                {error && <p role="alert" className="bk-note-error">{error}</p>}
              </>
            ) : (
              <p className="bk-note-text">{note}</p>
            )}
          </section>
        )}

        <section className="bk-section bk-section-muted">
          <h4 className="bk-section-title"><Info size={13} /> Where this number comes from</h4>
          {option.reason && <p className="bk-reason">{option.reason}</p>}
          <ul className="bk-source-list">
            {option.sources.map((id) => SOURCES[id] && (
              <li key={id}>
                <a href={SOURCES[id].url} target="_blank" rel="noopener noreferrer">
                  {SOURCES[id].label} <ExternalLink size={11} />
                </a>
              </li>
            ))}
          </ul>
          <p className="bk-verified">Last verified {VERIFIED_LABEL}</p>
        </section>
      </div>
    </div>,
    document.body,
  );
}

// ─── Main component ─────────────────────────────────────────────

export default function DhakaRoutes() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole?.('admin') || hasRole?.('moderator');

  const [query, setQuery] = useState('');
  const [zone, setZone] = useState('All');
  const [originId, setOriginId] = useState(() => ALL_ORIGINS.find((o) => o.id === 'mirpur-10')?.id || ALL_ORIGINS[0]?.id);
  const [activeKey, setActiveKey] = useState(null);
  const [fareDetails, setFareDetails] = useState({});
  const closePanel = useCallback(() => setActiveKey(null), []);

  // Admin-written notes per "<area>__<fareKey>" (same API as before).
  useEffect(() => {
    let cancelled = false;
    fetch('/api/bhara-koto/fare-details', { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (!cancelled && data?.success) setFareDetails(data.details || {}); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return ALL_ORIGINS.filter((o) => (zone === 'All' || o.zone === zone) && matchesQuery(o, q));
  }, [query, zone]);

  const origin = ALL_ORIGINS.find((o) => o.id === originId) || ALL_ORIGINS[0];
  const options = useMemo(() => buildOptions(origin), [origin]);
  const activeOption = options.find((o) => o.key === activeKey) || null;
  const noteKey = activeOption?.legacyKey ? `${origin.name}__${activeOption.legacyKey}` : null;

  const routeOptionsById = useMemo(() => {
    const map = {};
    for (const o of filtered) map[o.id] = buildOptions(o);
    return map;
  }, [filtered]);

  const openFare = (area, option) => {
    setOriginId(area.id);
    setActiveKey(option.key);
  };

  const saveNote = async (text) => {
    if (!activeOption?.legacyKey) return;
    const response = await fetch('/api/bhara-koto/fare-details', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: origin.name, fareKey: activeOption.legacyKey, details: text }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Could not save fare details.');
    setFareDetails(data.details || {});
  };

  return (
    <div className="glass-card-static schedule-widget sv-widget dr-widget bk-widget animate-fadeInUp">
      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile dr-icon-tile">
            <Banknote size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Daily Life</span>
            <div className="schedule-title">Bhara Koto</div>
            <span className="schedule-subtitle">Fares &amp; step-by-step routes from {ALL_ORIGINS.length} Dhaka areas to AUST</span>
          </div>
        </div>
        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="schedule-stat-value dr-stat-accent">{ALL_ORIGINS.length}</span>
              <span className="schedule-stat-label">Areas</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">7</span>
              <span className="schedule-stat-label">Modes</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value bk-stat-date">{VERIFIED_LABEL}</span>
              <span className="schedule-stat-label">Verified</span>
            </div>
          </div>
        </div>
        <div className="schedule-actions" />
      </div>

      <div className="schedule-dotted-divider" />

      {/* ── How to read the numbers ── */}
      {/* ── Search + zone filter ── */}
      <div className="bk-toolbar">
        <div className="dr-search bk-search">
          <Search size={15} className="dr-search-icon" />
          <input
            type="text"
            className="dr-search-input"
            aria-label="Search your area"
            placeholder="Where are you coming from? e.g. Mirpur, Uttara, Jatrabari…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="dr-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="bk-zones" role="group" aria-label="Filter by zone">
          {['All', ...ZONES].map((z) => (
            <button
              key={z}
              type="button"
              className={`bk-zone${zone === z ? ' active' : ''}`}
              aria-pressed={zone === z}
              onClick={() => setZone(z)}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      <section className="bk-route-table-wrap" aria-label="Fares by starting area">
        <table className="bk-route-table">
          <thead>
            <tr>
              <th scope="col">Starting area</th>
              <th scope="col">Destination</th>
              {[
                ['walk', 'Walk'], ['rickshaw', 'Rickshaw'], ['bus', 'Bus'], ['metro', 'Metro'],
                ['cng', 'CNG'], ['bike', 'Ride-share bike'], ['car', 'Ride-share car'],
              ].map(([key, label]) => <th scope="col" key={key}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td className="bk-empty-cell" colSpan={9}>No areas match “{query.trim()}”.</td></tr>
            ) : filtered.map((area) => {
              const areaOptions = routeOptionsById[area.id] || [];
              const selected = area.id === origin.id;
              return (
                <tr key={area.id} className={selected ? 'bk-route-row active' : 'bk-route-row'}>
                  <th scope="row" className="bk-route-area">
                    <MapPin size={13} aria-hidden="true" />
                    <span>{area.name}<small>{area.km.toFixed(1)} km · {area.zone}</small></span>
                  </th>
                  <td className="bk-route-destination">AUST · Love Road</td>
                  {['walk', 'rickshaw', 'bus', 'metro', 'cng', 'bike', 'car'].map((key) => {
                    const option = areaOptions.find((item) => item.key === key);
                    return (
                      <td key={key}>
                        {option ? (
                          <button
                            type="button"
                            className={`bk-fare-button${key === 'walk' ? ' bk-fare-free' : ''}`}
                            onClick={() => openFare(area, option)}
                            aria-label={`${area.name} to AUST by ${option.label}: ${fareText(option.fare)}. Show route details`}
                            aria-haspopup="dialog"
                          >
                            {fareText(option.fare)}
                          </button>
                        ) : <span className="bk-fare-unavailable" aria-label="Not available">—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {activeOption && (
        <RoutePanel
          key={`${origin.id}-${activeOption.key}`}
          origin={origin}
          option={activeOption}
          onClose={closePanel}
          isAdmin={isAdmin}
          note={noteKey ? fareDetails[noteKey] || '' : ''}
          onSaveNote={saveNote}
        />
      )}
    </div>
  );
}
