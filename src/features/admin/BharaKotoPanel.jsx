import { useEffect, useState } from 'react';

const emptyForm = {
  source: '',
  distance_km: '',
  walking_time: '',
  walking_cost: '0',
  rickshaw_cost: '',
  metro_cost: '',
  metro_station: '',
  local_bus_cost: '',
  aust_shuttle_cost: '-',
  tempo_cost: '',
  taxi_cost: '',
  rideshare_cost: '',
};

export default function BharaKotoPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/admin/bhara-koto', { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load');
      setRows(data.rows || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => !q || r.source.toLowerCase().includes(q.toLowerCase()));

  const handleAdd = async (e) => {
    e.preventDefault();
    setErr('');
    if (!form.source.trim()) { setErr('Source is required'); return; }
    try {
      const res = await fetch('/api/admin/bhara-koto', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          distance_km: Number(form.distance_km),
          walking_cost: Number(form.walking_cost),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Add failed');
      setForm(emptyForm);
      await load();
    } catch (e) { setErr(e.message); }
  };

  const startEdit = (row) => {
    setEditing(row.source);
    setEditForm({ ...row, newSource: row.source });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/bhara-koto', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: editing,
          newSource: editForm.newSource,
          distance_km: editForm.distance_km,
          walking_time: editForm.walking_time,
          walking_cost: editForm.walking_cost,
          rickshaw_cost: editForm.rickshaw_cost,
          metro_cost: editForm.metro_cost,
          metro_station: editForm.metro_station,
          local_bus_cost: editForm.local_bus_cost,
          aust_shuttle_cost: editForm.aust_shuttle_cost,
          tempo_cost: editForm.tempo_cost,
          taxi_cost: editForm.taxi_cost,
          rideshare_cost: editForm.rideshare_cost,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Update failed');
      setEditing(null);
      await load();
    } catch (e) { setErr(e.message); }
  };

  const handleDelete = async (source) => {
    if (!confirm(`Delete "${source}"?`)) return;
    try {
      const res = await fetch(`/api/admin/bhara-koto?source=${encodeURIComponent(source)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Delete failed');
      await load();
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="glass-card-static" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'bold', marginBottom: '8px' }}>Bhara Koto — Admin Table</h3>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
        Ekhane admin je table input korbe, setai Daily Life → Bhara Koto te public dekhbe. Add / Edit / Delete — only admin.
      </p>

      {err && <div style={{ background: 'var(--accent-rose-glow)', color: 'var(--accent-rose)', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: 'var(--fs-sm)' }}>{err}</div>}

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '16px', padding: '12px', background: 'var(--bg-input)', borderRadius: '12px', border: '1px solid var(--border-primary)' }}>
        <input className="input" placeholder="Source (e.g. Aftab Nagar Block A)" value={form.source} onChange={e=>setForm({...form, source:e.target.value})} required style={{ gridColumn: '1 / -1' }} />
        <input className="input" placeholder="Distance km" type="number" step="0.1" value={form.distance_km} onChange={e=>setForm({...form, distance_km:e.target.value})} />
        <input className="input" placeholder="Walking time" value={form.walking_time} onChange={e=>setForm({...form, walking_time:e.target.value})} />
        <input className="input" placeholder="Walking cost" value={form.walking_cost} onChange={e=>setForm({...form, walking_cost:e.target.value})} />
        <input className="input" placeholder="Rickshaw" value={form.rickshaw_cost} onChange={e=>setForm({...form, rickshaw_cost:e.target.value})} />
        <input className="input" placeholder="Metro" value={form.metro_cost} onChange={e=>setForm({...form, metro_cost:e.target.value})} />
        <input className="input" placeholder="Metro station" value={form.metro_station} onChange={e=>setForm({...form, metro_station:e.target.value})} />
        <input className="input" placeholder="Local Bus" value={form.local_bus_cost} onChange={e=>setForm({...form, local_bus_cost:e.target.value})} />
        <input className="input" placeholder="Tempo" value={form.tempo_cost} onChange={e=>setForm({...form, tempo_cost:e.target.value})} />
        <input className="input" placeholder="Taxi" value={form.taxi_cost} onChange={e=>setForm({...form, taxi_cost:e.target.value})} />
        <input className="input" placeholder="Rideshare" value={form.rideshare_cost} onChange={e=>setForm({...form, rideshare_cost:e.target.value})} />
        <button type="submit" className="btn btn-primary" style={{ gridColumn: '1 / -1' }}>Add Row</button>
      </form>

      {/* Search */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
        <input className="input" placeholder="Search source..." value={q} onChange={e=>setQ(e.target.value)} style={{ flex: 1 }} />
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{filtered.length} / {rows.length} rows</span>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Reload'}</button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto', border: '1px solid var(--border-primary)', borderRadius: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
            <tr>
              {['Source','Km','Walk Time','Rickshaw','Metro','Bus','Tempo','Taxi','Rideshare','Actions'].map(h=>(
                <th key={h} style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border-primary)', whiteSpace: 'nowrap', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: '20px', textAlign: 'center' }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No rows</td></tr>
            ) : filtered.map(row=>(
              editing === row.source ? (
                <tr key={row.source} style={{ background: 'var(--accent-blue-glow)' }}>
                  <td style={{ padding: '4px' }}><input className="input" value={editForm.newSource} onChange={e=>setEditForm({...editForm, newSource:e.target.value})} style={{ minWidth: '140px' }} /></td>
                  <td style={{ padding: '4px' }}><input className="input" type="number" step="0.1" value={editForm.distance_km} onChange={e=>setEditForm({...editForm, distance_km:e.target.value})} style={{ width: '60px' }} /></td>
                  <td style={{ padding: '4px' }}><input className="input" value={editForm.walking_time} onChange={e=>setEditForm({...editForm, walking_time:e.target.value})} style={{ width: '80px' }} /></td>
                  <td style={{ padding: '4px' }}><input className="input" value={editForm.rickshaw_cost} onChange={e=>setEditForm({...editForm, rickshaw_cost:e.target.value})} style={{ width: '80px' }} /></td>
                  <td style={{ padding: '4px' }}><input className="input" value={editForm.metro_cost} onChange={e=>setEditForm({...editForm, metro_cost:e.target.value})} style={{ width: '80px' }} /></td>
                  <td style={{ padding: '4px' }}><input className="input" value={editForm.local_bus_cost} onChange={e=>setEditForm({...editForm, local_bus_cost:e.target.value})} style={{ width: '80px' }} /></td>
                  <td style={{ padding: '4px' }}><input className="input" value={editForm.tempo_cost} onChange={e=>setEditForm({...editForm, tempo_cost:e.target.value})} style={{ width: '80px' }} /></td>
                  <td style={{ padding: '4px' }}><input className="input" value={editForm.taxi_cost} onChange={e=>setEditForm({...editForm, taxi_cost:e.target.value})} style={{ width: '80px' }} /></td>
                  <td style={{ padding: '4px' }}><input className="input" value={editForm.rideshare_cost} onChange={e=>setEditForm({...editForm, rideshare_cost:e.target.value})} style={{ width: '80px' }} /></td>
                  <td style={{ padding: '4px', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-primary btn-sm" onClick={handleUpdate} style={{ marginRight: '4px' }}>Save</button>
                    <button className="btn btn-secondary btn-sm" onClick={()=>setEditing(null)}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={row.source} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  <td style={{ padding: '8px', fontWeight: 600, whiteSpace: 'nowrap' }}>{row.source}</td>
                  <td style={{ padding: '8px' }}>{row.distance_km}</td>
                  <td style={{ padding: '8px' }}>{row.walking_time}</td>
                  <td style={{ padding: '8px' }}>{row.rickshaw_cost}</td>
                  <td style={{ padding: '8px' }}>{row.metro_cost}</td>
                  <td style={{ padding: '8px' }}>{row.local_bus_cost}</td>
                  <td style={{ padding: '8px' }}>{row.tempo_cost}</td>
                  <td style={{ padding: '8px' }}>{row.taxi_cost}</td>
                  <td style={{ padding: '8px' }}>{row.rideshare_cost}</td>
                  <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-secondary btn-sm" onClick={()=>startEdit(row)} style={{ marginRight: '4px' }}>Edit</button>
                    <button className="btn btn-rose btn-sm" onClick={()=>handleDelete(row.source)}>Delete</button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
