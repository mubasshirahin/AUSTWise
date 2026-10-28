import { useMemo, useState, useEffect } from 'react';
import {
  Banknote,
  MapPin,
  Search,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  TrainFront,
  BusFront,
  Bus,
  CarTaxiFront,
  Bike,
  Footprints,
  Info,
  ShieldAlert,
  RefreshCw,
  PencilLine,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import staticData from '../../data/dhakaRouteCosts.json';
import needsReviewData from '../../data/dhakaRouteCosts.needsReview.json';
import '../campus/SemesterViewWidget.css';
import './DhakaRoutes.css';

// ─── Column model ───────────────────────────────────────────────

const META_COLS = [
  { key: 'source', label: 'Source', sortable: true, numeric: false },
  { key: 'destination', label: 'Destination', sortable: false, numeric: false },
  { key: 'distance_km', label: 'Distance (km)', sortable: true, numeric: true },
  { key: 'walking_time', label: 'Walking (Time)', sortable: true, numeric: false },
  { key: 'walking_cost', label: 'Walking (Cost)', sortable: true, numeric: true },
];

const FARE_COLS = [
  { key: 'rickshaw_cost', label: 'Rickshaw', icon: Bike },
  { key: 'metro_cost', label: 'Metro', icon: TrainFront },
  { key: 'local_bus_cost', label: 'Local Bus', icon: BusFront },
  { key: 'aust_shuttle_cost', label: 'AUST Shuttle', icon: Bus },
  { key: 'tempo_cost', label: 'Tampoo/Leguna', icon: Bike },
  { key: 'taxi_cost', label: 'Taxi', icon: CarTaxiFront },
  { key: 'rideshare_cost', label: 'Uber/Pathao', icon: CarTaxiFront },
];

// ─── Helpers ────────────────────────────────────────────────────

const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function parseFare(v) {
  const nums = String(v).match(/৳?(\d+(?:\.\d+)?)/g);
  if (!nums) return null;
  return nums.map((n) => parseFloat(n.replace(/৳/g, '')));
}

function sortValue(row, col) {
  if (col.key === 'source') return row.source.toLowerCase();
  if (col.key === 'walking_time') {
    const m = String(row.walking_time).match(/(\d+)/g);
    if (!m) return Infinity;
    const [first] = m;
    return /h/.test(row.walking_time) ? Number(first) * 60 + (m[1] ? Number(m[1]) : 0) : Number(first);
  }
  const v = row[col.key];
  if (col.key === 'distance_km') return Number(v) || 0;
  if (col.key === 'walking_cost') return Number(v) || 0;
  const nums = parseFare(v);
  if (!nums) return -1;
  return nums[0];
}

function isDash(v) {
  return v == null || String(v).trim() === '-';
}

// ─── Sortable header cell ───────────────────────────────────────

function Th({ col, sort, onSort }) {
  if (!col.sortable) {
    return <th className="dr-th">{col.label}</th>;
  }
  const active = sort?.key === col.key;
  const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className="dr-th dr-th-sort" onClick={() => onSort(col.key)} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <span>{col.label}</span>
      <Icon size={13} className={`dr-sort-icon${active ? ' active' : ''}`} />
    </th>
  );
}

// ─── Fare cell — pill inside table, click → details writing (optional, briefly) ──

function FareCell({ value, title, fareKey, source, activeFare, openFareDetails }) {
  const na = isDash(value);
  const isFree = !na && /free/i.test(String(value));
  const isActive = activeFare && activeFare.source === source && activeFare.fareKey === fareKey;
  return (
    <td className="dr-td dr-fare" title={title}>
      <button
        type="button"
        className={`dr-fare-chip${na ? ' dr-fare-na' : ''}${isFree ? ' dr-fare-free' : ''}${isActive ? ' dr-fare-active' : ''}`}
        onClick={() => {
          if (na) return;
          openFareDetails(isActive ? null : { source, fareKey });
        }}
        aria-expanded={isActive}
        style={{ cursor: na ? 'default' : 'pointer' }}
        disabled={na}
      >
        {value}
      </button>
    </td>
  );
}

// ─── Main table ─────────────────────────────────────────────────

function RouteTable({ rows }) {
  const { hasRole } = useAuth();
  const isAdmin = hasRole?.('admin') || hasRole?.('moderator');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(null);
  const [activeFare, setActiveFare] = useState(null);
  const [fareDetails, setFareDetails] = useState({});
  const [detailDraft, setDetailDraft] = useState('');
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return rows;
    return rows.filter((r) => normalize(r.source).includes(q));
  }, [rows, query]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const arr = [...filtered];
    const col = [...META_COLS, ...FARE_COLS].find((c) => c.key === sort.key);
    arr.sort((a, b) => {
      const va = sortValue(a, col);
      const vb = sortValue(b, col);
      const d = va < vb ? -1 : va > vb ? 1 : 0;
      return sort.dir === 'asc' ? d : -d;
    });
    return arr;
  }, [filtered, sort]);

  const toggleSort = (key) => {
    setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }));
  };

  const activeKey = activeFare ? `${activeFare.source}__${activeFare.fareKey}` : null;
  const activeLabel = activeFare ? FARE_COLS.find((c) => c.key === activeFare.fareKey)?.label : null;

  useEffect(() => {
    let cancelled = false;
    fetch('/api/bhara-koto/fare-details', { credentials: 'same-origin' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (!cancelled && data?.success) setFareDetails(data.details || {}); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const openFareDetails = (fare) => {
    if (!fare) { setActiveFare(null); return; }
    const key = `${fare.source}__${fare.fareKey}`;
    setDetailsError('');
    setDetailDraft(fareDetails[key] || '');
    setActiveFare(fare);
  };

  const saveFareDetails = async () => {
    if (!activeFare) return;
    setDetailsSaving(true);
    setDetailsError('');
    try {
      const response = await fetch('/api/bhara-koto/fare-details', {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: activeFare.source, fareKey: activeFare.fareKey, details: detailDraft }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not save fare details.');
      setFareDetails(data.details || {});
      setActiveFare(null);
    } catch (error) {
      setDetailsError(error.message || 'Could not save fare details.');
    } finally {
      setDetailsSaving(false);
    }
  };

  return (
    <div className="dr-table-area">
      <div className="dr-toolbar">
        <div className="dr-search">
          <Search size={15} className="dr-search-icon" />
          <input
            type="text"
            className="dr-search-input"
            aria-label="Search areas"
            placeholder="Search area — e.g. Mirpur, Uttara, Farmgate…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="dr-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
        <span className="dr-count">
          {sorted.length} of {rows.length} areas
        </span>
      </div>

      <div className="dr-table-wrap">
        <table className="dr-table">
          <thead>
            <tr>
              {META_COLS.map((col) => (
                <Th key={col.key} col={col} sort={sort} onSort={toggleSort} />
              ))}
              {FARE_COLS.map((col) => (
                <th key={col.key} className="dr-th dr-th-fare">
                  <col.icon size={11} className="dr-th-icon" />
                  <span>{col.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length > 0 ? (
              sorted.map((row, i) => (
                <tr
                  className="dr-row"
                  key={row.source}
                  style={{ animationDelay: `${Math.min(i, 28) * 22}ms` }}
                >
                  <td className="dr-td dr-source">
                    <span className="dr-source-inner">
                      <MapPin size={12} />
                      {row.source}
                    </span>
                  </td>
                  <td className="dr-td dr-dest">AUST Tejgaon Campus</td>
                  <td className="dr-td dr-num">≈ {row.distance_km} km</td>
                  <td className="dr-td dr-walk">
                    {isDash(row.walking_time) ? (
                      '-'
                    ) : (
                      <span className="dr-walk-inner">
                        <Footprints size={12} />
                        {row.walking_time}
                      </span>
                    )}
                  </td>
                  <td className="dr-td dr-num dr-free">৳{row.walking_cost}</td>
                  {FARE_COLS.map((col) => (
                    <FareCell key={col.key} value={row[col.key]} title={col.label} fareKey={col.key} source={row.source} activeFare={activeFare} openFareDetails={openFareDetails} />
                  ))}
                </tr>
              ))
            ) : (
              <tr className="dr-row-empty">
                <td colSpan={META_COLS.length + FARE_COLS.length}>
                  No area matches &ldquo;{query.trim()}&rdquo; — try a nearby Dhaka location.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Fare pill details — OVERLAY (not niche) — click pill inside table → overlay ── */}
      {activeFare && (
        <div className="bhara-details-overlay" onClick={() => setActiveFare(null)}>
          <div className="bhara-details-panel dr-details-panel animate-fadeInUp" onClick={(e) => e.stopPropagation()}>
            <div className="bhara-details-head">
              <span className="bhara-details-title">
                <PencilLine size={13} /> {activeFare.source} — {activeLabel} — Fare details
              </span>
              <button type="button" className="bhara-details-close" onClick={() => setActiveFare(null)} aria-label="Close">
                <X size={12} />
              </button>
            </div>
            {isAdmin ? (
              <>
                <p className="bhara-details-hint"><Info size={11} /> {FARE_PILL_DETAILS[activeFare.fareKey]}</p>
                <textarea
                  className="input bhara-details-input"
                  rows={3}
                  maxLength={1000}
                  placeholder="Add fare details for users…"
                  value={detailDraft}
                  onChange={(e) => setDetailDraft(e.target.value)}
                  autoFocus
                />
                <div className="bhara-details-actions">
                  <span className="bhara-details-count">{detailDraft.length} / 1000</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetailDraft('')}>Clear</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveFare(null)}>Cancel</button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={saveFareDetails} disabled={detailsSaving}>{detailsSaving ? 'Saving…' : 'Save'}</button>
                </div>
                {detailsError && <p role="alert" className="bhara-details-error">{detailsError}</p>}
              </>
            ) : (
              <div className="bhara-details-preview">
                {(fareDetails[activeKey] || '').trim()
                  ? <p>{fareDetails[activeKey]}</p>
                  : <p className="bhara-details-empty">No extra details added yet.</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Needs Review (admin-only) ──────────────────────────────────

function NeedsReview({ list }) {
  const [expanded, setExpanded] = useState(false);
  if (!list || list.length === 0) {
    return (
      <div className="dr-review dr-review-ok">
        <ShieldAlert size={16} />
        <span>All areas geocoded successfully — nothing needs review.</span>
      </div>
    );
  }
  return (
    <div className="dr-review">
      <button className="dr-review-head" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
        <ShieldAlert size={16} />
        <span>
          <strong>{list.length} areas</strong> need manual review
          {expanded ? ' (click to hide)' : ' (click to view)'}
        </span>
      </button>
      {expanded && (
        <table className="dr-review-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {list.map((item, i) => (
              <tr key={`${item.source}-${i}`}>
                <td>{item.source}</td>
                <td className="dr-review-reason">{item.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Pill details hints per fare mode (used inside table fare chips) ──
const FARE_PILL_DETAILS = {
  rickshaw_cost: 'Rickshaw — e.g., Farmgate → AUST 40৳, traffic er upor 30-60৳ range — briefly bhenge likho (optional)',
  metro_cost: 'Metro — e.g., Uttara → Farmgate 20৳ + Farmgate → AUST rickshaw 30৳ = 50৳ — optional details',
  local_bus_cost: 'Local Bus — e.g., Mirpur → Tejgaon 15৳ + hete 10 min — briefly (optional)',
  aust_shuttle_cost: 'AUST Shuttle — free / 10৳ — route & time briefly (optional)',
  tempo_cost: 'Tempo/Leguna — e.g., Mohammadpur → Farmgate 20৳ — optional',
  taxi_cost: 'Taxi — e.g., Dhanmondi → AUST 120-180৳ meter — optional',
  rideshare_cost: 'Uber/Pathao — e.g., surge e 200-300৳ — briefly (optional)',
};

// ─── Main component ─────────────────────────────────────────────

export default function DhakaRoutes() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole?.('admin') || hasRole?.('moderator');
  const [liveData, setLiveData] = useState(staticData);
  const needsReview = needsReviewData?.needsReview || [];
  useEffect(() => {
    fetch('/api/bhara-koto', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.success && Array.isArray(d.rows)) {
          setLiveData({ meta: d.meta || staticData.meta, rows: d.rows });
        }
      })
      .catch(() => {});
  }, []);
  const meta = liveData?.meta || {};
  const rows = liveData?.rows || [];

  return (
    <div className="glass-card-static schedule-widget sv-widget dr-widget animate-fadeInUp">
      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile dr-icon-tile">
            <Banknote size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Daily Life</span>
            <div className="schedule-title">Bhara Koto</div>
            <span className="schedule-subtitle">
              {rows.length} areas · live distance &amp; cost table
            </span>
          </div>
        </div>

        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="schedule-stat-value dr-stat-accent">{rows.length}</span>
              <span className="schedule-stat-label">Areas</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">7</span>
              <span className="schedule-stat-label">Modes</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">{meta.destination_km ? '' : 'AUST'}</span>
              <span className="schedule-stat-label">Target</span>
            </div>
          </div>
        </div>

        <div className="schedule-actions" />
      </div>

      <div className="schedule-dotted-divider" />

      {/* ── Live table — fare chips inside are clickable pills (details optional) ── */}
      <RouteTable rows={rows} />

      {/* ── Needs Review (admin only) ── */}
      {isAdmin && (
        <div className="dr-admin">
          <div className="dr-admin-head">
            <span className="dr-admin-title">
              <ShieldAlert size={14} /> Needs Review
            </span>
            <button
              className="dr-refresh-btn"
              onClick={() => {
                try {
                  window.open('/admin/overview', '_self');
                } catch { /* noop */ }
              }}
            >
              <RefreshCw size={13} /> Refresh data
            </button>
          </div>
          <NeedsReview list={needsReview} />
          <p className="dr-admin-hint">
            Re-run the research process with{' '}
            <code>node scripts/generate-route-costs.mjs</code> — it re-geocodes, re-routes and
            regenerates <code>src/data/dhakaRouteCosts.json</code>.
          </p>
        </div>
      )}

    </div>
  );
}
