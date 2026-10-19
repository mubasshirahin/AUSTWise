import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, LoaderCircle, Search } from 'lucide-react';

// Route keys match App.jsx paths. Add new public routes here when they ship.
export const MANAGED_PAGES = [
  { key: '/', label: 'Dashboard' },
  { key: '/routine-templates', label: 'Routine Templates' },
  { key: '/analytics', label: 'GradeLab' },
  { key: '/vault', label: 'Resource Vault' },
  { key: '/notebook', label: 'Notebook' },
  { key: '/cheatsheets', label: 'Cheat Sheets' },
  { key: '/campus', label: 'InsideAUST' },
  { key: '/community', label: 'Community' },
  { key: '/marketplace', label: 'Marketplace' },
  { key: '/settings', label: 'Settings' },
  { key: '/messages', label: 'ConnectBox' },
  { key: '/workspace', label: 'Workspace' },
  { key: '/study-room', label: 'Study Room' },
  { key: '/cp-hub', label: 'CP Hub' },
  { key: '/money-tracker', label: 'Money Tracker' },
  { key: '/question-bank-analyzer', label: 'Question Bank Analyzer' },
  { key: '/cover-page-generator', label: 'Cover Page Generator' },
  { key: '/chill-zone', label: 'DownTime' },
  { key: '/roast-cv', label: 'Roast CV' },
  { key: '/certificate', label: 'Certificate' },
  { key: '/auto-alarm', label: 'Auto Alarm' },
  { key: '/austeddit', label: 'Austeddit' },
  { key: '/shadow', label: 'Shadow' },
  { key: '/daily-life', label: 'Daily Life' },
  { key: '/productivity', label: 'Productivity' },
  { key: '/terminal', label: 'Terminal' },
  { key: '/zen', label: 'Zen Study' },
];

export function usePageAvailability(pageKey) {
  const [state, setState] = useState({ loading: true, enabled: true });
  useEffect(() => {
    let active = true;
    fetch(`/api/page-availability?key=${encodeURIComponent(pageKey)}`, { credentials: 'same-origin' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (active && data?.success) setState({ loading: false, enabled: data.enabled !== false }); })
      .catch(() => { if (active) setState({ loading: false, enabled: true }); });
    return () => { active = false; };
  }, [pageKey]);
  return state;
}

export default function PageAvailabilityPanel() {
  const [enabledPages, setEnabledPages] = useState(null);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const reload = () => fetch('/api/page-availability', { credentials: 'same-origin' })
    .then((res) => res.ok ? res.json() : Promise.reject(new Error('Could not load page settings.')))
    .then((data) => setEnabledPages(data.enabledPages || {}))
    .catch((err) => setError(err.message));

  useEffect(() => { reload(); }, []);

  const toggle = async (page) => {
    const enabled = enabledPages?.[page.key] === false;
    setPending(page.key);
    setError('');
    try {
      const res = await fetch('/api/admin/page-availability', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageKey: page.key, enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not save this setting.');
      setEnabledPages((current) => ({ ...current, [page.key]: enabled }));
    } catch (err) { setError(err.message); }
    finally { setPending(''); }
  };

  const filtered = MANAGED_PAGES.filter((p) => p.label.toLowerCase().includes(query.toLowerCase()) || p.key.includes(query));

  return (
    <section className="glass-card-static" style={{ padding: '20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div>
          <h2 style={{ fontSize: '16px', margin: 0 }}>Page publishing</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '5px 0 0' }}>Turn pages on as each MVP is ready. Sidebar links stay visible; unpublished pages show a coming soon message.</p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 10px', border: '1px solid var(--border-primary)', borderRadius: '9px' }}>
          <Search size={14} /><input aria-label="Search pages" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a page" style={{ width: '130px', background: 'transparent', color: 'var(--text-primary)', border: 0, outline: 0 }} />
        </label>
      </div>
      {error && <p role="alert" style={{ color: 'var(--accent-rose)', fontSize: '12px' }}>{error}</p>}
      {!enabledPages ? <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}><LoaderCircle size={16} /> Loading page settings…</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '9px' }}>
          {filtered.map((page) => {
            const enabled = enabledPages[page.key] !== false;
            const busy = pending === page.key;
            return <div key={page.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '1px solid var(--border-primary)', borderRadius: '10px', background: 'var(--bg-card)' }}>
              <span style={{ color: enabled ? 'var(--accent-emerald)' : 'var(--text-tertiary)', display: 'flex' }}>{enabled ? <Eye size={16} /> : <EyeOff size={16} />}</span>
              <span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', fontSize: '12px' }}>{page.label}</strong><small style={{ color: 'var(--text-tertiary)' }}>{enabled ? 'Published' : 'Coming soon'}</small></span>
              <button type="button" disabled={busy} aria-label={`${enabled ? 'Turn off' : 'Turn on'} ${page.label}`} aria-pressed={enabled} onClick={() => toggle(page)} className={`btn btn-sm ${enabled ? 'btn-secondary' : 'btn-primary'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', minWidth: '74px', justifyContent: 'center' }}>
                {busy ? <LoaderCircle size={13} className="animate-spin" /> : enabled ? <><Check size={13} /> On</> : 'Turn on'}
              </button>
            </div>;
          })}
          {filtered.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No matching pages.</p>}
        </div>
      )}
    </section>
  );
}
