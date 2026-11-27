import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, Palette, LayoutTemplate, Check } from 'lucide-react';
import { THEMES } from '../../context/ThemeContext';
import { LAYOUTS, layoutForTheme } from '../../context/themeConstants';

const nice = (id) => id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// Admin → Themes & layouts: tick the themes and layouts users may pick.
// Unticked ones are hidden from every theme / layout picker on the site.
export default function ThemeVisibilityPanel() {
  const [themes, setThemes] = useState(null);
  const [layouts, setLayouts] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/appearance', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load theme settings.'))))
      .then((d) => {
        setThemes(d.themes || ['dark']);
        setLayouts(d.layouts || ['classic']);
        setSaved(JSON.stringify({ themes: d.themes, layouts: d.layouts }));
      })
      .catch((e) => setError(e.message));
  }, []);

  const dirty = useMemo(() => themes && layouts && JSON.stringify({ themes, layouts }) !== saved, [themes, layouts, saved]);

  const toggle = (list, setList, id) => {
    setMessage('');
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const save = async () => {
    if (!themes.length || !layouts.length) { setError('Keep at least one theme and one layout ticked.'); return; }
    setSaving(true); setError(''); setMessage('');
    try {
      const res = await fetch('/api/admin/appearance', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themes, layouts }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || 'Could not save.');
      setThemes(d.themes); setLayouts(d.layouts);
      setSaved(JSON.stringify({ themes: d.themes, layouts: d.layouts }));
      setMessage('Saved. Open pages update right away.');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const box = { display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', border: '1px solid var(--border-primary)', borderRadius: '10px', background: 'var(--bg-card)', cursor: 'pointer' };
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' };

  const renderList = (all, list, setList, sub) => (
    <div style={grid}>
      {all.map((id) => (
        <label key={id} style={box}>
          <input type="checkbox" checked={list.includes(id)} onChange={() => toggle(list, setList, id)} aria-label={`Show ${nice(id)}`} />
          <span style={{ minWidth: 0 }}>
            <strong style={{ display: 'block', fontSize: '12px' }}>{nice(id)}</strong>
            {sub && <small style={{ color: 'var(--text-tertiary)' }}>{sub(id)}</small>}
          </span>
        </label>
      ))}
    </div>
  );

  return (
    <section className="glass-card-static" style={{ padding: '20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div>
          <h2 style={{ fontSize: '16px', margin: 0 }}>Themes &amp; layouts</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '5px 0 0' }}>Ticked themes and layouts show in the website's pickers. Unticked ones are hidden, and anyone using one moves to an available one.</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || saving} onClick={save} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          {saving ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />} Save
        </button>
      </div>
      {error && <p role="alert" style={{ color: 'var(--accent-rose)', fontSize: '12px' }}>{error}</p>}
      {message && <p role="status" style={{ color: 'var(--accent-emerald)', fontSize: '12px' }}>{message}</p>}
      {!themes || !layouts ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}><LoaderCircle size={16} /> Loading…</div>
      ) : (
        <>
          <h3 style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0 8px' }}><Palette size={14} /> Themes ({themes.length}/{THEMES.length})</h3>
          {renderList(THEMES, themes, setThemes, (id) => `Own layout: ${nice(layoutForTheme(id))}`)}
          <h3 style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', margin: '18px 0 8px' }}><LayoutTemplate size={14} /> Layouts ({layouts.length}/{LAYOUTS.length})</h3>
          {renderList(LAYOUTS, layouts, setLayouts)}
          <p style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginTop: '12px' }}>If a theme's own layout is unticked, that theme uses the first ticked layout instead.</p>
        </>
      )}
    </section>
  );
}
