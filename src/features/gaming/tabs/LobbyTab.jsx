import { Link } from 'react-router-dom';
import { Gamepad2, Users, CalendarDays, Plus, MessagesSquare } from 'lucide-react';
import { GameIcon, GzEmpty, statusBadge, Badge } from '../gamingUi';
import { formatWhen } from '../gamingApi';

export function EventDate({ value }) {
  const date = new Date(value);
  return (
    <span className="gmz-date-block" aria-hidden="true">
      <strong>{date.getDate()}</strong>
      <span>{date.toLocaleString(undefined, { month: 'short' })}</span>
    </span>
  );
}

export function EventRow({ event }) {
  return (
    <Link to={`/gaming/event/${event.id}`} className="gmz-row gmz-event-row">
      <EventDate value={event.startsAt} />
      <span className="gmz-row-body">
        <span className="gmz-row-title">{event.title}</span>
        <span className="gmz-row-meta">
          {event.kind === 'tournament' ? 'Tournament' : 'Game night'} · {formatWhen(event.startsAt)}
        </span>
      </span>
      <span className="gmz-row-side">
        {event.status === 'live' ? <Badge tone="amber">Live</Badge> : <span className="gmz-count">{event.entryCount}/{event.capacity}</span>}
      </span>
    </Link>
  );
}

export default function LobbyTab({ games, myRooms, events, loading, canCreate, onCreate }) {
  return (
    <div className="gmz-main-grid">
      <section className="gmz-card">
        <div className="gmz-card-head-row is-ruled">
          <h3 className="gmz-card-title"><Gamepad2 size={14} /> Games</h3>
          <span className="gmz-card-note">{games.length} games</span>
        </div>
        {loading ? (
          <p className="gmz-loading">Loading games…</p>
        ) : (
          <div className="gmz-game-grid">
            {games.map((game) => (
              <Link key={game.id} to={`/gaming/g/${game.slug}`} className="gmz-game-tile">
                <span className="gmz-game-icon"><GameIcon iconKey={game.iconKey} size={18} /></span>
                <span className="gmz-game-name">{game.name}</span>
                <span className="gmz-game-genre">{game.genre}</span>
                <span className="gmz-game-meta">
                  <span><Users size={11} /> {game.openSquads} {game.openSquads === 1 ? 'squad' : 'squads'}</span>
                  <span><MessagesSquare size={11} /> {game.inLounge} here</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <aside className="gmz-rail">
        <section className="gmz-card">
          <div className="gmz-card-head-row is-ruled">
            <h3 className="gmz-card-title"><Users size={14} /> My rooms</h3>
            {canCreate && (
              <button type="button" className="gmz-add-icon-btn" aria-label="Create room" onClick={onCreate}><Plus size={14} /></button>
            )}
          </div>
          {myRooms.length ? (
            <div className="gmz-list">
              {myRooms.map((room) => (
                <Link key={room.id} to={room.type === 'lounge' ? '/gaming' : `/gaming/room/${room.id}`} className="gmz-row">
                  <span className="gmz-row-body">
                    <span className="gmz-row-title">{room.title}</span>
                    <span className="gmz-row-meta">{room.myRole === 'owner' ? 'Owner' : room.myRole === 'cohost' ? 'Co-host' : 'Member'} · {room.memberCount}/{room.capacity}</span>
                  </span>
                  <span className="gmz-row-side">{statusBadge(room)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <GzEmpty
              icon={Users}
              hint="You're not in any room yet. Open a game to find a squad, or start one."
              actionLabel={canCreate ? 'Create room' : null}
              actionIcon={Plus}
              onAction={onCreate}
            />
          )}
        </section>

        <section className="gmz-card">
          <div className="gmz-card-head-row is-ruled">
            <h3 className="gmz-card-title"><CalendarDays size={14} /> Up next</h3>
            <Link to="/gaming?view=events" className="gmz-card-link">All events</Link>
          </div>
          {events.length ? (
            <div className="gmz-list">{events.map((event) => <EventRow key={event.id} event={event} />)}</div>
          ) : (
            <GzEmpty icon={CalendarDays} hint="No game nights or tournaments scheduled yet." />
          )}
        </section>
      </aside>
    </div>
  );
}
