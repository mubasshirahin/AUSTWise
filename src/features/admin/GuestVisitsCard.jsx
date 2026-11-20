import { useEffect, useState } from 'react';
import { Compass } from 'lucide-react';

const REFRESH_MS = 20_000;

const COUNTERS = [
  { key: 'onlineNow', label: 'Visiting now', hint: 'Guests browsing right now' },
  { key: 'visits', label: 'Total visits', hint: 'Times "Take a Visit" was used' },
  { key: 'loggedIn', label: 'Then logged in', hint: 'Visited, then signed in' },
  { key: 'signedUp', label: 'Then signed up', hint: 'Visited, then made an account' },
  { key: 'neither', label: 'Did neither', hint: 'Left without login or signup' },
];

/** Live guest-visit counters ("Take a Visit" on the landing page). */
export default function GuestVisitsCard() {
  const [stats, setStats] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/admin/guest-visits', { credentials: 'same-origin', cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (alive) { setStats(data); setFailed(false); }
      } catch {
        if (alive) setFailed(true);
      }
    };
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  return (
    <section className="admin-guest-card" aria-label="Guest visits">
      <header className="admin-nav-card-heading">
        <span><Compass size={13} /></span>
        <div><strong>Guest visits</strong><small>{failed && !stats ? 'Could not load guest visits' : 'Take a Visit from the landing page · updates every 20s'}</small></div>
      </header>
      <dl className="admin-guest-stats">
        {COUNTERS.map(({ key, label, hint }) => (
          <div key={key} className={key === 'onlineNow' ? 'is-live' : undefined} title={hint}>
            <dt>{label}</dt>
            <dd>{stats ? Number(stats[key] || 0).toLocaleString() : '–'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
