import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Users, KeyRound, Copy, Pencil, CheckCircle2, Circle, BellRing, Play, Pause, LogOut, XCircle,
  Settings2, LogIn, Crown, ShieldAlert, Flag, Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useGz, gz } from './gamingApi';
import {
  GzMasthead, GzEmpty, GzMenu, Avatar, UserLine, Badge, statusBadge, rankRange, useFlash,
} from './gamingUi';
import ChatPanel from './ChatPanel';
import ReportModal from './panels/ReportModal';
import '../daily-life/DailyMasthead.css';
import './GamingZone.css';

const ROLE_LABEL = { owner: 'Owner', cohost: 'Co-host' };

function LobbyCard({ room, canHost, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(room.lobbyCode || '');
  const [copied, setCopied] = useState(false);
  const [flash, showFlash] = useFlash();
  useEffect(() => { if (!editing) setValue(room.lobbyCode || ''); }, [room.lobbyCode, editing]);

  const save = async () => {
    try {
      await gz(`/rooms/${room.id}`, { method: 'PATCH', body: { lobbyCode: value } });
      setEditing(false);
      onSaved();
    } catch (err) { showFlash(err.message); }
  };
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <section className="gmz-card">
      <div className="gmz-card-head-row is-ruled">
        <h3 className="gmz-card-title"><KeyRound size={14} /> Lobby</h3>
        {canHost && !editing && (
          <button type="button" className="gmz-add-icon-btn" aria-label="Edit lobby code" onClick={() => setEditing(true)}><Pencil size={13} /></button>
        )}
      </div>
      {editing ? (
        <div className="gmz-pop-panel" role="group" aria-label="Edit lobby code">
          <span className="gmz-pop-title"><Pencil size={11} /> Lobby code or party link</span>
          <input
            className="input gmz-pop-input is-title"
            value={value}
            maxLength={120}
            placeholder="e.g. party code, room ID + password, Discord link"
            autoFocus
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') save(); if (event.key === 'Escape') setEditing(false); }}
          />
          {flash}
          <div className="gmz-pop-actions">
            <button type="button" className="btn btn-primary gmz-btn" onClick={save}>Save</button>
            <button type="button" className="btn btn-ghost gmz-btn" onClick={() => setEditing(false)}>Cancel</button>
            <span className="gmz-pop-note">Only members see this</span>
          </div>
        </div>
      ) : room.lobbyCode ? (
        <div className="gmz-lobby-code">
          <code>{room.lobbyCode}</code>
          <button type="button" className="gmz-icon-btn" aria-label="Copy lobby code" onClick={() => copy(room.lobbyCode)}><Copy size={12} /></button>
          {copied && <span className="gmz-pop-note">Copied</span>}
        </div>
      ) : (
        <GzEmpty
          icon={KeyRound}
          hint={canHost ? 'Add the in-game party code here once everyone is in.' : 'The host hasn’t shared a lobby code yet.'}
          actionLabel={canHost ? 'Add lobby code' : null}
          actionIcon={Pencil}
          onAction={() => setEditing(true)}
        />
      )}
      {canHost && room.visibility === 'private' && room.inviteCode && (
        <div className="gmz-invite-line">
          <span className="gmz-section-label">Invite code</span>
          <code>{room.inviteCode}</code>
          <button type="button" className="gmz-icon-btn" aria-label="Copy invite code" onClick={() => copy(room.inviteCode)}><Copy size={12} /></button>
        </div>
      )}
    </section>
  );
}

function SettingsPanel({ room, game, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: room.title, description: room.description || '', capacity: room.capacity, visibility: room.visibility,
    slowModeSec: room.slowModeSec || 0, rankMin: room.rankMin || '', rankMax: room.rankMax || '',
  });
  const [flash, showFlash] = useFlash();
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const save = async (event) => {
    event.preventDefault();
    try {
      await gz(`/rooms/${room.id}`, {
        method: 'PATCH',
        body: { ...form, capacity: Number(form.capacity), slowModeSec: Number(form.slowModeSec), rankMin: form.rankMin || null, rankMax: form.rankMax || null },
      });
      onSaved();
      onClose();
    } catch (err) { showFlash(err.message); }
  };
  return (
    <form className="gmz-pop-panel gmz-composer" aria-label="Room settings" onSubmit={save} onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}>
      <span className="gmz-pop-title"><Settings2 size={11} /> Room settings</span>
      <input className="input gmz-pop-input is-title" value={form.title} maxLength={60} onChange={set('title')} aria-label="Title" />
      <div className="gmz-pop-row">
        <select className="input gmz-pop-input is-half" value={form.capacity} onChange={set('capacity')} aria-label="Squad size">
          {Array.from({ length: Math.max(1, (game?.maxSquad || 5) - 1) }, (_, index) => index + 2).map((size) => (
            <option key={size} value={size} disabled={size < (room.memberCount || 0)}>{size} players</option>
          ))}
        </select>
        <select className="input gmz-pop-input is-half" value={form.visibility} onChange={set('visibility')} aria-label="Visibility">
          <option value="public">Public</option>
          <option value="private">Private (invite code)</option>
        </select>
        <select className="input gmz-pop-input is-half" value={form.slowModeSec} onChange={set('slowModeSec')} aria-label="Slow mode">
          <option value={0}>Slow mode off</option>
          <option value={5}>Slow mode 5s</option>
          <option value={15}>Slow mode 15s</option>
          <option value={60}>Slow mode 60s</option>
        </select>
      </div>
      {game?.ranks?.length > 0 && (
        <div className="gmz-pop-row">
          <select className="input gmz-pop-input is-half" value={form.rankMin} onChange={set('rankMin')} aria-label="Lowest rank">
            <option value="">Lowest rank: any</option>
            {game.ranks.map((rank) => <option key={rank} value={rank}>{rank}</option>)}
          </select>
          <select className="input gmz-pop-input is-half" value={form.rankMax} onChange={set('rankMax')} aria-label="Highest rank">
            <option value="">Highest rank: any</option>
            {game.ranks.map((rank) => <option key={rank} value={rank}>{rank}</option>)}
          </select>
        </div>
      )}
      <input className="input gmz-pop-input" value={form.description} maxLength={280} placeholder="Note for players" onChange={set('description')} aria-label="Note" />
      {flash}
      <div className="gmz-pop-actions">
        <button type="submit" className="btn btn-primary gmz-btn">Save</button>
        <button type="button" className="btn btn-ghost gmz-btn" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

export default function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const detail = useGz(`/rooms/${encodeURIComponent(roomId)}`);
  const [settings, setSettings] = useState(false);
  const [ended, setEnded] = useState(null);
  const [report, setReport] = useState(null);
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, showFlash] = useFlash();
  const { reload, setData } = detail;

  const act = useCallback(async (path, body = {}, { after } = {}) => {
    setBusy(true);
    try {
      const result = await gz(`/rooms/${encodeURIComponent(roomId)}${path}`, { method: 'POST', body });
      if (after) after(result); else await reload();
      return result;
    } catch (err) {
      showFlash(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  }, [roomId, reload, showFlash]);

  const onRoom = useCallback((room) => setData((current) => (current ? { ...current, room: { ...current.room, ...room, inviteCode: current.room.inviteCode } } : current)), [setData]);
  const onMembers = useCallback((members) => {
    setData((current) => {
      if (!current) return current;
      const mine = members.find((member) => member.userId === user?.id) || null;
      return { ...current, members, membership: mine || current.membership };
    });
    reload();
  }, [setData, reload, user?.id]);
  const onClosed = useCallback((reason) => setEnded(reason), []);
  const patchRoom = useCallback(async (body) => {
    setBusy(true);
    try {
      await gz(`/rooms/${encodeURIComponent(roomId)}`, { method: 'PATCH', body });
      await reload();
    } catch (err) {
      showFlash(err.message);
    } finally {
      setBusy(false);
    }
  }, [roomId, reload, showFlash]);

  const lounge = detail.data?.room?.type === 'lounge' ? detail.data.game?.slug : null;
  useEffect(() => {
    if (lounge) navigate(`/gaming/g/${lounge}`, { replace: true });
  }, [lounge, navigate]);

  if (detail.error) {
    return (
      <div className="gmz-widget glass-card-static animate-fadeInUp">
        <Link to="/gaming?view=rooms" className="gmz-back"><ArrowLeft size={13} /> Gaming Zone</Link>
        <div className="gmz-card"><GzEmpty icon={ShieldAlert} hint={detail.error.message} /></div>
      </div>
    );
  }
  if (!detail.data) {
    return <div className="gmz-widget glass-card-static"><p className="gmz-loading">Loading room…</p></div>;
  }

  const { room, game, members, membership, capabilities: caps } = detail.data;
  if (lounge) return null;
  const isMember = !!membership;
  const closed = room.status === 'closed' || ended === 'closed' || ended === 'idle' || ended === 'empty';
  const removed = ended === 'kicked' || ended === 'banned';
  const readyCount = members.filter((member) => member.ready).length;
  const canDeleteMessage = (message) => caps.moderate || message.fromId === user?.id || caps.host;

  const menu = [
    ...(caps.manage ? [{ key: 'settings', label: 'Room settings', icon: Settings2, onSelect: () => setSettings(true) }] : []),
    ...(room.ownerId && room.ownerId !== user?.id && detail.data.owner
      ? [{ key: 'report', label: 'Report the host', icon: Flag, onSelect: () => setReport({ target: detail.data.owner }) }] : []),
    ...(isMember ? [{ key: 'leave', label: 'Leave room', icon: LogOut, onSelect: () => act('/leave', {}, { after: () => navigate('/gaming?view=rooms') }) }] : []),
    ...(caps.manage ? [{ key: 'close', label: 'Close room', icon: XCircle, danger: true, onSelect: () => { if (window.confirm('Close this room for everyone?')) act('/close'); } }] : []),
  ];

  const memberMenu = (member) => {
    if (member.userId === user?.id) return [];
    const items = [];
    if (caps.manage && member.roomRole !== 'owner') {
      items.push(member.roomRole === 'cohost'
        ? { key: 'demote', label: 'Make member', icon: Users, onSelect: () => act('/role', { userId: member.userId, roomRole: 'member' }) }
        : { key: 'promote', label: 'Make co-host', icon: Crown, onSelect: () => act('/role', { userId: member.userId, roomRole: 'cohost' }) });
      items.push({ key: 'transfer', label: 'Hand over room', icon: Crown, onSelect: () => { if (window.confirm(`Make ${member.user?.name} the owner?`)) act('/transfer', { userId: member.userId }); } });
    }
    if (caps.host || caps.moderate) {
      items.push({ key: 'mute', label: 'Mute 10 min', icon: Pause, onSelect: () => act('/mute', { userId: member.userId, minutes: 10 }) });
      items.push({ key: 'unmute', label: 'Unmute', icon: Play, onSelect: () => act('/mute', { userId: member.userId, minutes: 0 }) });
      items.push({ key: 'kick', label: 'Remove', icon: LogOut, danger: true, onSelect: () => act('/kick', { userId: member.userId }) });
      items.push({ key: 'ban', label: 'Remove and block', icon: XCircle, danger: true, onSelect: () => { if (window.confirm(`Remove ${member.user?.name} and block them from this room?`)) act('/kick', { userId: member.userId, ban: true }); } });
    }
    if (member.user) {
      if (items.length) items.push({ key: 'sep', separator: true });
      items.push({ key: 'report', label: 'Report', icon: Flag, onSelect: () => setReport({ target: member.user }) });
    }
    return items;
  };

  const joinBlocked = !caps.join && !isMember;
  const chatBlocked = (() => {
    if (closed) return 'This room is closed.';
    if (removed) return 'You were removed from this room.';
    if (caps.muted) return 'You are muted here for now.';
    if (!isMember) return 'Join the room to chat.';
    return 'You can’t chat here.';
  })();

  return (
    <div className="gmz-widget glass-card-static animate-fadeInUp">
      <Link to="/gaming?view=rooms" className="gmz-back"><ArrowLeft size={13} /> Gaming Zone</Link>
      <GzMasthead
        iconKey={game?.iconKey}
        overline={game?.name || 'Squad room'}
        title={room.title}
        subtitle={[rankRange(room), room.platform, room.region, room.description].filter(Boolean).join(' · ')}
        stats={[
          { label: 'Players', value: `${room.memberCount ?? members.length}/${room.capacity}` },
          { label: 'Ready', value: `${readyCount}/${members.length || 0}` },
          { label: 'Status', value: closed ? 'Closed' : room.status === 'in_game' ? 'In game' : room.status === 'full' ? 'Full' : 'Open', small: true, alert: closed },
        ]}
        menu={menu}
      />

      {(closed || removed) && (
        <div className="gmz-card gmz-notice is-rose" role="status">
          <XCircle size={14} />
          <span>{removed ? (ended === 'banned' ? 'You were removed and blocked from this room.' : 'You were removed from this room.') : 'This room is closed.'}</span>
          <Link to="/gaming?view=rooms" className="gmz-card-link">Find another squad</Link>
        </div>
      )}
      {flash}
      {settings && <SettingsPanel room={room} game={game} onClose={() => setSettings(false)} onSaved={reload} />}

      <div className="gmz-main-grid">
        <ChatPanel
          roomId={room.id}
          meId={user?.id}
          canRead={caps.read && !removed}
          canChat={caps.chat && !closed && !removed}
          blockedReason={chatBlocked}
          canDelete={canDeleteMessage}
          onRoom={onRoom}
          onMembers={onMembers}
          onClosed={onClosed}
          emptyHint="Room created. Say hi and share the plan."
        />

        <aside className="gmz-rail">
          {!isMember && !closed && !removed && (
            <section className="gmz-card">
              <div className="gmz-card-head-row is-ruled">
                <h3 className="gmz-card-title"><LogIn size={14} /> Join this squad</h3>
                {statusBadge(room)}
              </div>
              {room.visibility === 'private' && !caps.join && (
                <div className="gmz-form-row">
                  <input className="input gmz-field is-grow gmz-code-input" placeholder="Invite code" maxLength={6} value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} />
                </div>
              )}
              <div className="gmz-actions">
                <button
                  type="button"
                  className="btn btn-primary gmz-btn"
                  disabled={busy || (joinBlocked && !(room.visibility === 'private' && inviteCode.length === 6))}
                  onClick={() => act('/join', { inviteCode })}
                >
                  {room.visibility === 'private' ? <Lock size={12} /> : <LogIn size={12} />} Join
                </button>
              </div>
              {joinBlocked && room.visibility !== 'private' && (
                <p className="gmz-text">{room.memberCount >= room.capacity ? 'This squad is full.' : 'Your account can’t join rooms.'}</p>
              )}
            </section>
          )}

          {(isMember || caps.moderate) && <LobbyCard room={room} canHost={caps.host && !closed} onSaved={reload} />}

          {isMember && !closed && (
            <section className="gmz-card">
              <div className="gmz-card-head-row is-ruled">
                <h3 className="gmz-card-title"><CheckCircle2 size={14} /> Ready up</h3>
                <span className="gmz-count">{readyCount}/{members.length}</span>
              </div>
              <div className="gmz-bar"><span className="gmz-bar-fill" style={{ width: `${members.length ? Math.round((readyCount / members.length) * 100) : 0}%` }} /></div>
              <div className="gmz-actions">
                <button type="button" className="btn btn-primary gmz-btn" disabled={busy} onClick={() => act('/ready', { ready: !membership.ready })}>
                  {membership.ready ? <><Circle size={12} /> Not ready</> : <><CheckCircle2 size={12} /> I'm ready</>}
                </button>
                {caps.host && <button type="button" className="btn btn-ghost gmz-btn" disabled={busy} onClick={() => act('/ready-check')}>Ready check</button>}
                {caps.host && room.status !== 'in_game' && (
                  <button type="button" className="btn btn-ghost gmz-btn" disabled={busy} onClick={() => patchRoom({ status: 'in_game' })}>
                    <Play size={12} /> Game on
                  </button>
                )}
                {caps.host && room.status === 'in_game' && (
                  <button type="button" className="btn btn-ghost gmz-btn" disabled={busy} onClick={() => patchRoom({ status: 'open' })}>
                    <Pause size={12} /> Back to lobby
                  </button>
                )}
                {caps.host && room.visibility === 'public' && room.memberCount < room.capacity && (
                  <button
                    type="button"
                    className="btn btn-ghost gmz-btn"
                    disabled={busy}
                    onClick={() => act('/ping', {}, { after: (result) => showFlash(`Pinged ${result.notified} player${result.notified === 1 ? '' : 's'}.`, 'info') })}
                  >
                    <BellRing size={12} /> Need {room.capacity - room.memberCount} more
                  </button>
                )}
              </div>
            </section>
          )}

          {(isMember || caps.moderate) && (
            <section className="gmz-card">
              <div className="gmz-card-head-row is-ruled">
                <h3 className="gmz-card-title"><Users size={14} /> Squad</h3>
                <span className="gmz-count">{members.length}/{room.capacity}</span>
              </div>
              <div className="gmz-list">
                {members.map((member) => {
                  const muted = member.mutedUntil && new Date(member.mutedUntil) > new Date();
                  const entry = member.profile?.games?.find((item) => item.gameId === room.gameId);
                  const items = memberMenu(member);
                  return (
                    <div key={member.userId} className="gmz-row gmz-member-row">
                      <Avatar user={member.user} />
                      <span className="gmz-row-body">
                        <UserLine user={member.user} />
                        <span className="gmz-row-meta">
                          {[entry?.ign, entry?.rank, entry?.position].filter(Boolean).join(' · ') || member.user?.department || ' '}
                        </span>
                      </span>
                      <span className="gmz-row-side">
                        {ROLE_LABEL[member.roomRole] && <Badge tone={member.roomRole === 'owner' ? 'amber' : 'muted'}>{ROLE_LABEL[member.roomRole]}</Badge>}
                        {muted && <Badge tone="rose">Muted</Badge>}
                        <span className={`gmz-ready${member.ready ? ' is-on' : ''}`} title={member.ready ? 'Ready' : 'Not ready'}>
                          {member.ready ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                        </span>
                        {items.length > 0 && <GzMenu items={items} label={`Actions for ${member.user?.name || 'member'}`} />}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </aside>
      </div>
      {report && <ReportModal target={report.target} roomId={room.id} onClose={() => setReport(null)} />}
    </div>
  );
}
