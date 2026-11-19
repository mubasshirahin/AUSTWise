import { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, RotateCcw } from 'lucide-react';
import { getAllAccounts } from '../../utils/authStorage';

/** Admin list of gali strikes (system:moderation-strikes) with a reset action. */
export default function ModerationStrikesPanel() {
  const [strikes, setStrikes] = useState(null);
  const [busy, setBusy] = useState('');

  const load = () => fetch('/api/store/shared/system%3Amoderation-strikes', { credentials: 'same-origin' })
    .then((r) => r.json()).then((d) => setStrikes(d?.value || {})).catch(() => setStrikes({}));
  useEffect(() => { load(); }, []);

  const names = useMemo(() => {
    const m = {};
    try { for (const a of getAllAccounts() || []) m[a.id] = a.name || a.email; } catch { /* ignore */ }
    return m;
  }, []);

  const rows = Object.entries(strikes || {}).sort((a, b) => (b[1].lastOffenceAt || 0) - (a[1].lastOffenceAt || 0));
  const now = Date.now();

  const reset = async (id) => {
    setBusy(id);
    await fetch(`/api/admin/strikes/${encodeURIComponent(id)}/reset`, { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    setBusy('');
    load();
  };

  return (
    <div className="glass-card-static" style={{ padding: 'var(--sp-4)' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 4px' }}><ShieldAlert size={18} /> Gali strikes</h3>
      <p style={{ margin: '0 0 var(--sp-3)', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>
        1st = warning, 2nd = 2-day ban, 3rd+ = 10-day ban. Resets 30 days after the first strike.
      </p>
      {strikes === null ? <p>Loading…</p> : rows.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)' }}>No strikes yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(([id, r]) => {
            const banned = r.banUntil > now;
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{names[id] || id}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.count} strike{r.count === 1 ? '' : 's'} · {banned ? `banned until ${new Date(r.banUntil).toLocaleString('en-GB')}` : 'not banned'}
                    {r.lastSnippet ? ` · "${r.lastSnippet}"` : ''}
                  </div>
                </div>
                <button type="button" className="btn btn-secondary" disabled={busy === id} onClick={() => reset(id)}>
                  <RotateCcw size={14} /> Clear
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
