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

// ─── Fare cell ──────────────────────────────────────────────────

function FareCell({ value, title }) {
  const na = isDash(value);
  const isFree = !na && /free/i.test(String(value));
  return (
    <td className="dr-td dr-fare" title={title}>
      <span className={`dr-fare-chip${na ? ' dr-fare-na' : ''}${isFree ? ' dr-fare-free' : ''}`}>
        {value}
      </span>
    </td>
  );
}

// ─── Main table ─────────────────────────────────────────────────

function RouteTable({ rows }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(null);

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
                    <FareCell key={col.key} value={row[col.key]} title={col.label} />
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

      {/* ── Banner note ── */}
      <div className="dr-banner">
        <Info size={14} />
        <span>
          Distances via <strong>{meta.api || 'OSRM public routing'}</strong>. Transport costs are
          estimated using standard Dhaka local fare logic as of{' '}
          <strong>{meta.generatedAt ? new Date(meta.generatedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Aug 2026'}</strong>{' '}
          — verify against current rates before publishing.
        </span>
      </div>

      {/* ── Live table ── */}
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

      {/* ── Footer note ── */}
      <div className="dr-footer">
        <Info size={12} />
        <span>
          Admin er inputted table ekhane show kore — edit korte <code>Admin → Bhara Koto</code> e jan (only admin). Tap any column header to sort; search filters by area name.
        </span>
      </div>
    </div>
  );
}