import { useState } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { useGz } from '../gamingApi';
import { GzEmpty } from '../gamingUi';
import { EventRow } from './LobbyTab';

export default function EventsTab({ games, caps, onHost }) {
  const [kind, setKind] = useState('');
  const [game, setGame] = useState('');
  const [past, setPast] = useState(false);
  const query = new URLSearchParams();
  if (kind) query.set('kind', kind);
  if (game) query.set('game', game);
  if (past) query.set('past', '1');
  const events = useGz(`/events${query.toString() ? `?${query}` : ''}`);
  const list = events.data || [];
  const canHost = !!(caps?.createGameNight || caps?.createTournament);

  return (
    <section className="gmz-card">
      <div className="gmz-card-head-row is-ruled">
        <h3 className="gmz-card-title"><CalendarDays size={14} /> Events</h3>
        <div className="gmz-filters">
          <select className="input gmz-select" value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Event type">
            <option value="">All types</option>
            <option value="game_night">Game nights</option>
            <option value="tournament">Tournaments</option>
          </select>
          <select className="input gmz-select" value={game} onChange={(event) => setGame(event.target.value)} aria-label="Filter by game">
            <option value="">All games</option>
            {games.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
          </select>
          <label className="gmz-check">
            <input type="checkbox" checked={past} onChange={(event) => setPast(event.target.checked)} /> Past
          </label>
        </div>
      </div>
      {events.loading && !events.data ? (
        <p className="gmz-loading">Loading events…</p>
      ) : list.length ? (
        <div className="gmz-list">{list.map((event) => <EventRow key={event.id} event={event} />)}</div>
      ) : (
        <GzEmpty
          icon={CalendarDays}
          hint="No events here yet. Game nights are hosted by faculty, club reps and gaming mods."
          actionLabel={canHost ? 'Host event' : null}
          actionIcon={Plus}
          onAction={onHost}
        />
      )}
    </section>
  );
}
