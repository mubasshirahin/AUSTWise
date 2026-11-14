import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Plus, CalendarDays, Trophy, Gamepad2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useGz, gz } from './gamingApi';
import { GzMasthead, GzEmpty, Avatar, UserLine, useFlash } from './gamingUi';
import ChatPanel from './ChatPanel';
import { RoomRow } from './tabs/RoomsTab';
import { EventRow } from './tabs/LobbyTab';
import CreateRoomPanel from './panels/CreateRoomPanel';
import '../daily-life/DailyMasthead.css';
import './GamingZone.css';

export default function GameHubPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const me = useGz('/me');
  const overview = useGz('/overview');
  const rooms = useGz(`/rooms?type=squad&game=${encodeURIComponent(slug)}`);
  const events = useGz(`/events?game=${encodeURIComponent(slug)}`);
  const board = useGz(`/leaderboard?game=${encodeURIComponent(slug)}`);
  const [composer, setComposer] = useState(false);
  const [flash, showFlash] = useFlash();

  const games = overview.data?.games || [];
  const game = games.find((item) => item.slug === slug);
  const caps = me.data?.capabilities;

  if (overview.error || me.error) {
    return (
      <div className="gmz-widget glass-card-static animate-fadeInUp">
        <Link to="/gaming" className="gmz-back"><ArrowLeft size={13} /> Gaming Zone</Link>
        <div className="gmz-card"><GzEmpty icon={Gamepad2} hint={(overview.error || me.error).message} /></div>
      </div>
    );
  }
  if (!overview.data) return <div className="gmz-widget glass-card-static"><p className="gmz-loading">Loading…</p></div>;
  if (!game) {
    return (
      <div className="gmz-widget glass-card-static animate-fadeInUp">
        <Link to="/gaming" className="gmz-back"><ArrowLeft size={13} /> Gaming Zone</Link>
        <div className="gmz-card"><GzEmpty icon={Gamepad2} hint="That game isn’t in the Gaming Zone." /></div>
      </div>
    );
  }

  const join = async (room) => {
    try {
      await gz(`/rooms/${room.id}/join`, { method: 'POST', body: {} });
      navigate(`/gaming/room/${room.id}`);
    } catch (err) {
      showFlash(err.message);
      rooms.reload();
    }
  };

  const chatBlocked = caps?.tier === 'guest'
    ? 'Guests can read the lounge. Sign in with a student, faculty or alumni account to chat.'
    : me.data?.zoneBan ? 'You are suspended from the Gaming Zone.' : me.data?.zoneMuted ? 'You are muted for now.' : 'You can’t chat here.';
  const squads = rooms.data || [];
  const top = (board.data?.players || []).slice(0, 5);

  return (
    <div className="gmz-widget glass-card-static animate-fadeInUp">
      <Link to="/gaming" className="gmz-back"><ArrowLeft size={13} /> Gaming Zone</Link>
      <GzMasthead
        iconKey={game.iconKey}
        overline={game.genre || 'Game'}
        title={game.name}
        subtitle={`${game.platforms.join(' · ')} · squads up to ${game.maxSquad}`}
        stats={[
          { label: 'In lounge', value: game.inLounge },
          { label: 'Open squads', value: game.openSquads },
          { label: 'Events', value: events.data?.length ?? '–' },
        ]}
      />
      {flash}
      {composer && (
        <CreateRoomPanel games={games} defaultGameId={game.id} onCancel={() => setComposer(false)} onCreated={(detail) => navigate(`/gaming/room/${detail.room.id}`)} />
      )}

      <div className="gmz-main-grid">
        {game.loungeId ? (
          <ChatPanel
            roomId={game.loungeId}
            title={`${game.name} lounge`}
            meId={user?.id}
            canRead
            canChat={!!caps?.participate && !me.data?.zoneMuted}
            blockedReason={chatBlocked}
            canDelete={(message) => caps?.moderate || message.fromId === user?.id}
            emptyHint={`Nobody has said anything in the ${game.name} lounge yet.`}
          />
        ) : (
          <div className="gmz-card"><GzEmpty icon={Gamepad2} hint="This game has no lounge yet." /></div>
        )}

        <aside className="gmz-rail">
          <section className="gmz-card">
            <div className="gmz-card-head-row is-ruled">
              <h3 className="gmz-card-title"><Users size={14} /> Open squads</h3>
              {caps?.createRoom && (
                <button type="button" className="gmz-add-icon-btn" aria-label="Create room" data-on={composer ? 'true' : undefined} onClick={() => setComposer((value) => !value)}><Plus size={14} /></button>
              )}
            </div>
            {squads.length ? (
              <div className="gmz-list">{squads.map((room) => <RoomRow key={room.id} room={room} game={game} onJoin={caps?.participate ? join : null} />)}</div>
            ) : (
              <GzEmpty icon={Users} hint={`No ${game.name} squads open right now.`} actionLabel={caps?.createRoom ? 'Create room' : null} actionIcon={Plus} onAction={() => setComposer(true)} />
            )}
          </section>

          <section className="gmz-card">
            <div className="gmz-card-head-row is-ruled">
              <h3 className="gmz-card-title"><CalendarDays size={14} /> Events</h3>
            </div>
            {events.data?.length ? (
              <div className="gmz-list">{events.data.map((event) => <EventRow key={event.id} event={event} />)}</div>
            ) : (
              <GzEmpty icon={CalendarDays} hint={`No ${game.name} events scheduled.`} />
            )}
          </section>

          <section className="gmz-card">
            <div className="gmz-card-head-row is-ruled">
              <h3 className="gmz-card-title"><Trophy size={14} /> Top players</h3>
              <Link to="/gaming?view=ranks" className="gmz-card-link">All ranks</Link>
            </div>
            {top.length ? (
              <ol className="gmz-list gmz-rank-list">
                {top.map((player, index) => (
                  <li key={player.userId} className="gmz-row gmz-rank-row">
                    <span className="gmz-rank-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="gmz-rank-body">
                      <Avatar user={player.user} size="sm" />
                      <span className="gmz-row-body"><UserLine user={player.user} /></span>
                    </span>
                    <span className="gmz-rank-points">{player.points}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <GzEmpty icon={Trophy} hint="No ranked matches yet." />
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
