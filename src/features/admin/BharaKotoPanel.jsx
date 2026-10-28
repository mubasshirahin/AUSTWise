import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Bike, Bus, BusFront, CarTaxiFront, Footprints, Info, MapPin, Pencil, PencilLine, RefreshCw, Search, TrainFront, X } from 'lucide-react';
import '../campus/SemesterViewWidget.css';
import '../daily-life/DhakaRoutes.css';

const emptyForm = {
  source: '', distance_km: '', walking_time: '', walking_cost: '0', rickshaw_cost: '',
  metro_cost: '', metro_station: '', local_bus_cost: '', aust_shuttle_cost: '-',
  tempo_cost: '', taxi_cost: '', rideshare_cost: '',
};

const META_COLUMNS = [
  { key: 'source', label: 'Source', sortable: true },
  { key: 'destination', label: 'Destination' },
  { key: 'distance_km', label: 'Distance (km)', sortable: true },
  { key: 'walking_time', label: 'Walking (Time)', sortable: true },
  { key: 'walking_cost', label: 'Walking (Cost)', sortable: true },
];
const FARE_COLUMNS = [
  { key: 'rickshaw_cost', label: 'Rickshaw', icon: Bike },
  { key: 'metro_cost', label: 'Metro', icon: TrainFront },
  { key: 'local_bus_cost', label: 'Local Bus', icon: BusFront },
  { key: 'aust_shuttle_cost', label: 'AUST Shuttle', icon: Bus },
  { key: 'tempo_cost', label: 'Tampoo/Leguna', icon: Bike },
  { key: 'taxi_cost', label: 'Taxi', icon: CarTaxiFront },
  { key: 'rideshare_cost', label: 'Uber/Pathao', icon: CarTaxiFront },
];
const isDash = (value) => value == null || String(value).trim() === '-';

export default function BharaKotoPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editMode, setEditMode] = useState(false);
  const [editRows, setEditRows] = useState({});
  const [sort, setSort] = useState(null);
  const [fareDetails, setFareDetails] = useState({});
  const [activeFare, setActiveFare] = useState(null);
  const [detailDraft, setDetailDraft] = useState('');
  const [detailsSaving, setDetailsSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/admin/bhara-koto', { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load');
      setRows(data.rows || []);
      setEditRows(Object.fromEntries((data.rows || []).map((row) => [row.source, { ...row, newSource: row.source }])));
      fetch('/api/bhara-koto/fare-details', { credentials: 'same-origin' })
        .then((response) => response.ok ? response.json() : null)
        .then((detailsData) => { if (detailsData?.success) setFareDetails(detailsData.details || {}); })
        .catch(() => {});
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const result = rows.filter((row) => !query || row.source.toLowerCase().includes(query));
    if (!sort) return result;
    return [...result].sort((a, b) => {
      const left = a[sort.key] ?? '';
      const right = b[sort.key] ?? '';
      const comparison = sort.key === 'source' || sort.key === 'walking_time'
        ? String(left).localeCompare(String(right), undefined, { numeric: true })
        : (Number(left) || 0) - (Number(right) || 0);
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [rows, q, sort]);

  const handleAdd = async (event) => {
    event.preventDefault();
    setErr('');
    if (!form.source.trim()) { setErr('Source is required'); return; }
    try {
      const res = await fetch('/api/admin/bhara-koto', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, distance_km: Number(form.distance_km), walking_cost: Number(form.walking_cost) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Add failed');
      setForm(emptyForm);
      await load();
    } catch (e) { setErr(e.message); }
  };

  const handleUpdate = async (source) => {
    setErr('');
    const editForm = editRows[source];
    try {
      const res = await fetch('/api/admin/bhara-koto', {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, ...editForm }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Update failed');
      await load();
    } catch (e) { setErr(e.message); }
  };

  const handleDelete = async (source) => {
    if (!confirm(`Delete "${source}"?`)) return;
    try {
      const res = await fetch(`/api/admin/bhara-koto?source=${encodeURIComponent(source)}`, { method: 'DELETE', credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Delete failed');
      await load();
    } catch (e) { setErr(e.message); }
  };

  const toggleSort = (key) => setSort((current) => current?.key === key
    ? current.direction === 'asc' ? { key, direction: 'desc' } : null
    : { key, direction: 'asc' });

  const updateEditRow = (source, key, value) => setEditRows((current) => ({
    ...current,
    [source]: { ...current[source], [key]: value },
  }));

  const openFareDetails = (source, fareKey) => {
    setActiveFare({ source, fareKey });
    setDetailDraft(fareDetails[`${source}__${fareKey}`] || '');
  };

  const saveFareDetails = async () => {
    if (!activeFare) return;
    setDetailsSaving(true);
    setErr('');
    try {
      const response = await fetch('/api/bhara-koto/fare-details', {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...activeFare, details: detailDraft }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not save fare details.');
      setFareDetails(data.details || {});
      setActiveFare(null);
    } catch (error) { setErr(error.message || 'Could not save fare details.'); }
    finally { setDetailsSaving(false); }
  };

  return (
    <div className="glass-card-static dr-admin-page" style={{ padding: '20px' }}>
      <div className="dr-admin-page-head">
        <div>
          <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'bold', marginBottom: '6px' }}>Bhara Koto</h3>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', margin: 0 }}>
            Daily Life-এর Bhara Koto table-এ যেভাবে দেখা যায়, এখানেও একইভাবে দেখানো হয়।
          </p>
        </div>
        <div className="dr-admin-page-actions">
          <div className="dr-admin-view-toggle" role="group" aria-label="Table mode">
            <button type="button" className={!editMode ? 'active' : ''} onClick={() => setEditMode(false)}>View</button>
            <button type="button" className={editMode ? 'active' : ''} onClick={() => setEditMode(true)}><Pencil size={13} /> Edit</button>
          </div>
          <button type="button" className="dr-refresh-btn" onClick={load} disabled={loading}>
            <RefreshCw size={13} /> {loading ? 'Loading…' : 'Reload'}
          </button>
        </div>
      </div>

      {err && <div role="alert" className="dr-admin-error">{err}</div>}

      {editMode && (
        <form onSubmit={handleAdd} className="dr-admin-add-form">
          <input className="input" placeholder="Source (e.g. Aftab Nagar Block A)" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} required />
          <input className="input" placeholder="Distance km" type="number" step="0.1" value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: e.target.value })} />
          <input className="input" placeholder="Walking time" value={form.walking_time} onChange={(e) => setForm({ ...form, walking_time: e.target.value })} />
          <input className="input" placeholder="Walking cost" value={form.walking_cost} onChange={(e) => setForm({ ...form, walking_cost: e.target.value })} />
          <input className="input" placeholder="Rickshaw" value={form.rickshaw_cost} onChange={(e) => setForm({ ...form, rickshaw_cost: e.target.value })} />
          <input className="input" placeholder="Metro" value={form.metro_cost} onChange={(e) => setForm({ ...form, metro_cost: e.target.value })} />
          <input className="input" placeholder="Metro station" value={form.metro_station} onChange={(e) => setForm({ ...form, metro_station: e.target.value })} />
          <input className="input" placeholder="Local bus" value={form.local_bus_cost} onChange={(e) => setForm({ ...form, local_bus_cost: e.target.value })} />
          <input className="input" placeholder="AUST shuttle" value={form.aust_shuttle_cost} onChange={(e) => setForm({ ...form, aust_shuttle_cost: e.target.value })} />
          <input className="input" placeholder="Tempo" value={form.tempo_cost} onChange={(e) => setForm({ ...form, tempo_cost: e.target.value })} />
          <input className="input" placeholder="Taxi" value={form.taxi_cost} onChange={(e) => setForm({ ...form, taxi_cost: e.target.value })} />
          <input className="input" placeholder="Uber/Pathao" value={form.rideshare_cost} onChange={(e) => setForm({ ...form, rideshare_cost: e.target.value })} />
          <button type="submit" className="btn btn-primary">Add area</button>
        </form>
      )}

      <div className="dr-toolbar dr-admin-table-toolbar">
        <label className="dr-search">
          <Search size={15} className="dr-search-icon" />
          <input className="dr-search-input" placeholder="Search areas — e.g. Mirpur, Uttara, Farmgate…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <span className="dr-count">{filtered.length} of {rows.length} areas</span>
      </div>

      <div className="dr-table-wrap dr-admin-table-wrap">
        <table className="dr-table">
          <thead><tr>
            {META_COLUMNS.map((col) => {
              const active = sort?.key === col.key;
              const SortIcon = active ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
              return <th key={col.key} className={col.sortable ? 'dr-th dr-th-sort' : 'dr-th'} onClick={() => col.sortable && toggleSort(col.key)}>
                {col.sortable ? <><span>{col.label}</span><SortIcon size={13} className={`dr-sort-icon${active ? ' active' : ''}`} /></> : col.label}
              </th>;
            })}
            {FARE_COLUMNS.map(({ key, label, icon: Icon }) => <th key={key} className="dr-th dr-th-fare"><Icon size={11} className="dr-th-icon" /><span>{label}</span></th>)}
            {editMode && <th className="dr-th">Actions</th>}
          </tr></thead>
          <tbody>
            {loading ? <tr className="dr-row-empty"><td colSpan={META_COLUMNS.length + FARE_COLUMNS.length + Number(editMode)}>Loading…</td></tr>
              : filtered.length === 0 ? <tr className="dr-row-empty"><td colSpan={META_COLUMNS.length + FARE_COLUMNS.length + Number(editMode)}>No area matches “{q.trim()}”.</td></tr>
                : filtered.map((row, index) => {
                  const draft = editRows[row.source] || row;
                  const field = (key, numeric = false) => <input aria-label={`${row.source} ${key}`} className="input dr-admin-cell-input" type={numeric ? 'number' : 'text'} step={numeric ? '0.1' : undefined} value={draft[key] ?? ''} onChange={(event) => updateEditRow(row.source, key, event.target.value)} />;
                  return <tr className="dr-row" key={row.source} style={{ animationDelay: `${Math.min(index, 28) * 22}ms` }}>
                    <td className="dr-td dr-source"><span className="dr-source-inner"><MapPin size={12} />{editMode ? field('newSource') : row.source}</span></td>
                    <td className="dr-td dr-dest">AUST Tejgaon Campus</td>
                    <td className="dr-td dr-num">{editMode ? field('distance_km', true) : <>≈ {row.distance_km} km</>}</td>
                    <td className="dr-td dr-walk">{editMode ? field('walking_time') : isDash(row.walking_time) ? '-' : <span className="dr-walk-inner"><Footprints size={12} />{row.walking_time}</span>}</td>
                    <td className="dr-td dr-num dr-free">{editMode ? field('walking_cost', true) : `৳${row.walking_cost}`}</td>
                    {FARE_COLUMNS.map(({ key }) => <td className="dr-td dr-fare" key={key}>{editMode ? field(key) : <button type="button" className={`dr-fare-chip${isDash(row[key]) ? ' dr-fare-na' : /free/i.test(String(row[key])) ? ' dr-fare-free' : ''}`} disabled={isDash(row[key])} onClick={() => openFareDetails(row.source, key)}>{row[key] ?? '-'}</button>}</td>)}
                    {editMode && <td className="dr-td dr-admin-row-actions"><button type="button" className="btn btn-primary btn-sm" onClick={() => handleUpdate(row.source)}>Save</button><button type="button" className="btn btn-rose btn-sm" onClick={() => handleDelete(row.source)}>Delete</button></td>}
                  </tr>;
                })}
          </tbody>
        </table>
      </div>

      {activeFare && (
        <div className="bhara-details-overlay" onClick={() => setActiveFare(null)}>
          <div className="bhara-details-panel dr-details-panel animate-fadeInUp" onClick={(event) => event.stopPropagation()}>
            <div className="bhara-details-head">
              <span className="bhara-details-title"><PencilLine size={13} /> {activeFare.source} — {FARE_COLUMNS.find((column) => column.key === activeFare.fareKey)?.label} — Fare details</span>
              <button type="button" className="bhara-details-close" onClick={() => setActiveFare(null)} aria-label="Close"><X size={12} /></button>
            </div>
            <p className="bhara-details-hint"><Info size={11} /> These details are shared with all users.</p>
            <textarea className="input bhara-details-input" rows={3} maxLength={1000} placeholder="Add fare details for users…" value={detailDraft} onChange={(event) => setDetailDraft(event.target.value)} autoFocus />
            <div className="bhara-details-actions">
              <span className="bhara-details-count">{detailDraft.length} / 1000</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetailDraft('')}>Clear</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveFare(null)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={saveFareDetails} disabled={detailsSaving}>{detailsSaving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
