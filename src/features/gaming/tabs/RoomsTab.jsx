import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Plus, Lock, LogIn } from 'lucide-react';
import { useGz, gz } from '../gamingApi';
import { GameIcon, GzEmpty, statusBadge, rankRange, useFlash } from '../gamingUi';

export function RoomRow({ room, game, onJoin, busy }) {
  const full = room.memberCount >= room.capacity;
  return (
    <div className="gmz-row gmz-room-row">
      <span className="gmz-row-icon"><GameIcon iconKey={game?.iconKey} size={15} /></span>
      <Link to={`/gaming/room/${room.id}`} className="gmz-row-body">
        <span className="gmz-row-title">
          {room.visibility === 'private' && <Lock size={11} />} {room.title}
        </span>
        <span className="gmz-row-meta">
          {[room.owner?.name, game?.name, rankRange(room), room.platform, room.region].filter(Boolean).join(' · ')}
        </span>
      </Link>
      <span className="gmz-row-side">
        <span className="gmz-count">{room.memberCount}/{room.capacity}</span>
        {statusBadge(room)}
        {onJoin && !full && room.status !== 'closed' && (
          <button type="button" className="btn btn-primary gmz-btn" disabled={busy} onClick={() => onJoin(room)}>
            <LogIn size={12} /> Join
          </button>
        )}
      </span>
    </div>
  );
}

export default function RoomsTab({ games, canCreate, onCreate }) {
  const navigate = useNavigate();
  const [game, setGame] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const rooms = useGz(`/rooms?type=squad${game ? `&game=${encodeURIComponent(game)}` : ''}${openOnly ? '&open=1' : ''}`);
  const [busy, setBusy] = useState(null);
  const [flash, showFlash] = useFlash();
  const gameById = Object.fromEntries(games.map((item) => [item.id, item]));
  const { reload } = rooms;

  useEffect(() => {
    const timer = setInterval(reload, 20000);
    return () => clearInterval(timer);
  }, [reload]);

  const join = async (room) => {
    setBusy(room.id);
    try {
      await gz(`/rooms/${room.id}/join`, { method: 'POST', body: {} });
      navigate(`/gaming/room/${room.id}`);
    } catch (err) {
      showFlash(err.message);
      reload();
    } finally {
      setBusy(null);
    }
  };

  const list = rooms.data || [];
  return (
    <section className="gmz-card">
      <div className="gmz-card-head-row is-ruled">
        <h3 className="gmz-card-title"><Users size={14} /> Squad rooms</h3>
        <div className="gmz-filters">
          <select className="input gmz-select" value={game} onChange={(event) => setGame(event.target.value)} aria-label="Filter by game">
            <option value="">All games</option>
            {games.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
          </select>
          <label className="gmz-check">
            <input type="checkbox" checked={openOnly} onChange={(event) => setOpenOnly(event.target.checked)} /> Open slots
          </label>
        </div>
      </div>
      {flash}
      {rooms.loading && !rooms.data ? (
        <p className="gmz-loading">Loading rooms…</p>
      ) : list.length ? (
        <div className="gmz-list">
          {list.map((room) => (
            <RoomRow key={room.id} room={room} game={gameById[room.gameId]} onJoin={join} busy={busy === room.id} />
          ))}
        </div>
      ) : (
        <GzEmpty
          icon={Users}
          hint={game || openOnly ? 'No rooms match these filters right now.' : 'No squads are open right now. Start one and others can join.'}
          actionLabel={canCreate ? 'Create room' : null}
          actionIcon={Plus}
          onAction={onCreate}
        />
      )}
    </section>
  );
}
