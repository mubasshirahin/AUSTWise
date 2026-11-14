import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Gamepad2, LayoutGrid, Users, UserSearch, CalendarDays, Trophy, Plus, KeyRound, UserCog, ShieldCheck, Boxes, ShieldAlert,
} from 'lucide-react';
import { useGz, useGzEvent, formatWhen } from './gamingApi';
import { GzMasthead, GzPills, GzEmpty } from './gamingUi';
import LobbyTab from './tabs/LobbyTab';
import RoomsTab from './tabs/RoomsTab';
import SquadsTab from './tabs/SquadsTab';
import EventsTab from './tabs/EventsTab';
import RanksTab from './tabs/RanksTab';
import CreateRoomPanel from './panels/CreateRoomPanel';
import EventModal from './panels/EventModal';
import ProfileModal from './panels/ProfileModal';
import JoinCodeModal from './panels/JoinCodeModal';
import '../daily-life/DailyMasthead.css';
import './GamingZone.css';

const VIEWS = [
  { id: 'lobby', label: 'Lobby', icon: LayoutGrid },
  { id: 'rooms', label: 'Rooms', icon: Users },
  { id: 'squads', label: 'Squad finder', icon: UserSearch },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'ranks', label: 'Ranks', icon: Trophy },
];

export default function GamingPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = VIEWS.some((item) => item.id === params.get('view')) ? params.get('view') : 'lobby';
  const setView = (next) => setParams((current) => { const out = new URLSearchParams(current); out.set('view', next); return out; }, { replace: true });

  const me = useGz('/me');
  const overview = useGz('/overview');
  const [composer, setComposer] = useState(false);
  const [modal, setModal] = useState(null); // 'event' | 'profile' | 'code'

  // Keep counts fresh when rooms open/close around the user.
  useGzEvent('gz-room-closed', () => { me.reload(); overview.reload(); });

  const caps = me.data?.capabilities;
  const games = useMemo(() => overview.data?.games || [], [overview.data]);
  const openSquads = games.reduce((sum, game) => sum + (game.openSquads || 0), 0);

  if (me.error || overview.error) {
    const err = me.error || overview.error;
    return (
      <div className="gmz-widget glass-card-static animate-fadeInUp">
        <GzMasthead overline="Campus play" title="Gaming Zone" subtitle="Squads, game nights and tournaments" />
        <div className="gmz-card">
          <GzEmpty icon={err.status === 403 ? ShieldAlert : Gamepad2} hint={err.message} />
        </div>
      </div>
    );
  }

  const menu = [
    { key: 'profile', label: 'My gamer profile', icon: UserCog, onSelect: () => setModal('profile'), disabled: !caps?.participate },
    { key: 'code', label: 'Join with invite code', icon: KeyRound, onSelect: () => setModal('code'), disabled: !caps?.participate },
    ...(caps?.moderate ? [
      { key: 'sep', separator: true },
      { key: 'mod', label: 'Moderation', icon: ShieldCheck, onSelect: () => navigate('/gaming/mod') },
      ...(caps.manageGames ? [{ key: 'games', label: 'Manage games', icon: Boxes, onSelect: () => navigate('/gaming/mod?view=games') }] : []),
    ] : []),
  ];

  const action = (() => {
    if (view === 'events' && (caps?.createGameNight || caps?.createTournament)) {
      return { label: 'Host event', onClick: () => setModal('event') };
    }
    if (view === 'squads' && caps?.participate) return { label: 'My profile', onClick: () => setModal('profile'), icon: UserCog };
    if ((view === 'lobby' || view === 'rooms') && caps?.createRoom) return { label: 'Create room', onClick: () => setComposer((value) => !value), on: composer };
    return null;
  })();
  const ActionIcon = action?.icon || Plus;
  const nextEvent = overview.data?.events?.[0];

  return (
    <div className="gmz-widget glass-card-static animate-fadeInUp">
      <GzMasthead
        overline="Campus play"
        title="Gaming Zone"
        subtitle="Squads, game nights and tournaments with fellow AUSTians"
        stats={[
          { label: 'Online', value: overview.data?.onlineNow ?? '–' },
          { label: 'Open squads', value: overview.data ? openSquads : '–' },
          { label: 'My rooms', value: me.data?.rooms?.length ?? '–' },
        ]}
        menu={menu}
      />

      {me.data?.zoneBan && (
        <div className="gmz-card gmz-notice is-rose" role="alert">
          <ShieldAlert size={14} />
          <span>
            You are suspended from the Gaming Zone
            {me.data.zoneBan.until ? ` until ${formatWhen(me.data.zoneBan.until)}` : ''}.
            {me.data.zoneBan.reason ? ` Reason: ${me.data.zoneBan.reason}` : ''}
          </span>
        </div>
      )}
      {caps?.tier === 'guest' && (
        <div className="gmz-card gmz-notice">
          <Gamepad2 size={14} /> <span>Guest accounts can look around. Sign in with a student, faculty or alumni account to join rooms and chat.</span>
        </div>
      )}

      <div className="gmz-toolbar">
        <GzPills items={VIEWS} value={view} onChange={(next) => { setView(next); setComposer(false); }} label="Gaming Zone sections" />
        {action && (
          <button type="button" className="btn btn-primary gmz-toolbar-action" data-on={action.on ? 'true' : undefined} onClick={action.onClick}>
            <ActionIcon size={13} /> {action.label}
          </button>
        )}
      </div>

      {composer && (view === 'lobby' || view === 'rooms') && (
        <CreateRoomPanel
          games={games}
          onCancel={() => setComposer(false)}
          onCreated={(detail) => navigate(`/gaming/room/${detail.room.id}`)}
        />
      )}

      {view === 'lobby' && (
        <LobbyTab
          games={games}
          myRooms={me.data?.rooms || []}
          events={overview.data?.events || []}
          loading={overview.loading && !overview.data}
          canCreate={!!caps?.createRoom}
          onCreate={() => setComposer(true)}
          nextEvent={nextEvent}
        />
      )}
      {view === 'rooms' && <RoomsTab games={games} canCreate={!!caps?.createRoom} onCreate={() => setComposer(true)} />}
      {view === 'squads' && <SquadsTab games={games} me={me.data} onEditProfile={() => setModal('profile')} onProfileSaved={me.reload} />}
      {view === 'events' && <EventsTab games={games} caps={caps} onHost={() => setModal('event')} />}
      {view === 'ranks' && <RanksTab games={games} />}

      {modal === 'event' && (
        <EventModal games={games} caps={caps} onClose={() => setModal(null)} onCreated={(event) => navigate(`/gaming/event/${event.id}`)} />
      )}
      {modal === 'profile' && (
        <ProfileModal games={games} onClose={() => setModal(null)} onSaved={() => { me.reload(); setModal(null); }} />
      )}
      {modal === 'code' && (
        <JoinCodeModal onClose={() => setModal(null)} onJoined={(detail) => navigate(`/gaming/room/${detail.room.id}`)} />
      )}
    </div>
  );
}
