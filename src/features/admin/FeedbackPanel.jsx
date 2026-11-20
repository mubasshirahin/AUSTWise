import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, LoaderCircle, Mail, RefreshCw, Trash2, Undo2 } from 'lucide-react';
import './FeedbackPanel.css';

const FILTERS = ['All', 'Unread', 'Idea', 'Bug', 'Other'];

const fmtDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export default function FeedbackPanel() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState('All');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy('load');
    setError('');
    try {
      const res = await fetch('/api/admin/feedback', { credentials: 'same-origin' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Could not load feedback.');
      setItems(data.items || []);
    } catch (e) {
      setError(e.message);
      setItems((prev) => prev || []);
    } finally {
      setBusy('');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (id, method, extra = {}) => {
    setBusy(id);
    setError('');
    try {
      const res = await fetch('/api/admin/feedback', {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...extra }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Could not update feedback.');
      setItems(data.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const remove = (item) => {
    if (window.confirm(`Delete this ${item.type.toLowerCase()} from ${item.name || 'Anonymous'}? This can't be undone.`)) {
      update(item.id, 'DELETE');
    }
  };

  const unread = items ? items.filter((x) => !x.read).length : 0;
  const shown = useMemo(() => {
    if (!items) return [];
    if (filter === 'All') return items;
    if (filter === 'Unread') return items.filter((x) => !x.read);
    return items.filter((x) => x.type === filter);
  }, [items, filter]);

  return (
    <section className="glass-card-static fbp-panel">
      <header className="fbp-head">
        <div>
          <h2>Feedback</h2>
          <p>Messages sent from the public Feedback page.{items ? ` ${items.length} total, ${unread} unread.` : ''}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={load}>
          {busy === 'load' ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
        </button>
      </header>

      <div className="fbp-filters" role="tablist" aria-label="Filter feedback">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={filter === f ? 'is-on' : ''}
            onClick={() => setFilter(f)}
          >
            {f}{f === 'Unread' && unread ? ` (${unread})` : ''}
          </button>
        ))}
      </div>

      {error && <p className="fbp-error" role="alert">{error}</p>}

      {items === null ? (
        <p className="fbp-muted"><LoaderCircle size={14} className="animate-spin" /> Loading feedback...</p>
      ) : shown.length === 0 ? (
        <div className="fbp-empty">
          <span className="fbp-empty-icon"><Mail size={16} /></span>
          <p>{items.length ? 'Nothing matches this filter.' : 'No feedback yet. Messages from /feedback will show up here.'}</p>
        </div>
      ) : (
        <ul className="fbp-list">
          {shown.map((item) => (
            <li key={item.id} className={`fbp-item${item.read ? '' : ' is-unread'}`}>
              <div className="fbp-meta">
                <span className={`fbp-type is-${item.type.toLowerCase()}`}>{item.type}</span>
                <strong className="fbp-name">{item.name || 'Anonymous'}</strong>
                {item.email && <a className="fbp-email" href={`mailto:${item.email}`}>{item.email}</a>}
                <time className="fbp-date" dateTime={item.createdAt}>{fmtDate(item.createdAt)}</time>
              </div>
              <p className="fbp-message">{item.message}</p>
              <div className="fbp-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy === item.id}
                  onClick={() => update(item.id, 'PATCH', { read: !item.read })}
                >
                  {item.read ? <><Undo2 size={13} /> Mark unread</> : <><Check size={13} /> Mark read</>}
                </button>
                {item.email && (
                  <a className="btn btn-ghost btn-sm" href={`mailto:${item.email}?subject=${encodeURIComponent('Re: your AUSTWise feedback')}`}>
                    <Mail size={13} /> Reply
                  </a>
                )}
                <button type="button" className="btn btn-ghost btn-sm fbp-delete" disabled={busy === item.id} onClick={() => remove(item)}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
