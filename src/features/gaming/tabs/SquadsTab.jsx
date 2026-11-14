import { useState } from 'react';
import { UserSearch, UserCog, Radio } from 'lucide-react';
import { useGz, gz } from '../gamingApi';
import { Avatar, GzEmpty, UserLine, Badge, useFlash } from '../gamingUi';

const DAY_LABEL = { sat: 'Sat', sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri' };

export function availabilityText(availability = {}) {
  const days = Object.entries(availability).filter(([, slots]) => slots?.length);
  if (!days.length) return '';
  return days.map(([day, slots]) => `${DAY_LABEL[day] || day} ${slots[0]}`).join(', ');
}

export default function SquadsTab({ games, me, onEditProfile, onProfileSaved }) {
  const [game, setGame] = useState('');
  const lfg = useGz(`/lfg${game ? `?game=${encodeURIComponent(game)}` : ''}`);
  const gameById = Object.fromEntries(games.map((item) => [item.id, item]));
  const [saving, setSaving] = useState(false);
  const [flash, showFlash] = useFlash();
  const profile = me?.profile;
  const looking = !!profile?.lookingForSquad;
  const canParticipate = !!me?.capabilities?.participate;

  const toggleLooking = async () => {
    if (!profile) { onEditProfile(); return; }
    setSaving(true);
    try {
      await gz('/profile', { method: 'PUT', body: { ...profile, lookingForSquad: !looking } });
      onProfileSaved();
      lfg.reload();
    } catch (err) {
      showFlash(err.message);
    } finally {
      setSaving(false);
    }
  };

  const list = lfg.data || [];
  const selected = games.find((item) => item.slug === game);
  return (
    <div className="gmz-main-grid">
      <section className="gmz-card">
        <div className="gmz-card-head-row is-ruled">
          <h3 className="gmz-card-title"><UserSearch size={14} /> Looking for a squad</h3>
          <select className="input gmz-select" value={game} onChange={(event) => setGame(event.target.value)} aria-label="Filter by game">
            <option value="">All games</option>
            {games.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
          </select>
        </div>
        {lfg.loading && !lfg.data ? (
          <p className="gmz-loading">Loading players…</p>
        ) : list.length ? (
          <div className="gmz-list">
            {list.map((player) => {
              const shown = (player.games || []).filter((entry) => !selected || entry.gameId === selected.id).slice(0, 3);
              const when = availabilityText(player.availability);
              return (
                <div key={player.userId} className="gmz-row gmz-player-row">
                  <Avatar user={player.user} />
                  <span className="gmz-row-body">
                    <UserLine user={player.user} extra={player.online ? <span className="gmz-online">Online</span> : null} />
                    <span className="gmz-row-meta">
                      {[player.user.department, player.user.batch, when].filter(Boolean).join(' · ')}
                    </span>
                    {shown.length > 0 && (
                      <span className="gmz-chips">
                        {shown.map((entry) => (
                          <span key={entry.gameId} className="gmz-chip">
                            {gameById[entry.gameId]?.name || 'Game'}{entry.ign ? ` · ${entry.ign}` : ''}{entry.rank ? ` · ${entry.rank}` : ''}
                          </span>
                        ))}
                      </span>
                    )}
                    {player.bio && <span className="gmz-row-note">{player.bio}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <GzEmpty icon={UserSearch} hint={game ? 'Nobody is looking for this game right now.' : 'Nobody is looking for a squad right now.'} />
        )}
      </section>

      <aside className="gmz-rail">
        <section className="gmz-card">
          <div className="gmz-card-head-row is-ruled">
            <h3 className="gmz-card-title"><Radio size={14} /> Your status</h3>
            {looking ? <Badge tone="emerald">Looking</Badge> : <Badge>Not looking</Badge>}
          </div>
          {flash}
          <p className="gmz-text">
            {looking
              ? 'Squads with an open slot in your games can ping you.'
              : 'Turn this on and room hosts can ping you when they need one more player.'}
          </p>
          <div className="gmz-actions">
            <button type="button" className="btn btn-primary gmz-btn" disabled={!canParticipate || saving} onClick={toggleLooking}>
              {looking ? 'Stop looking' : 'Look for a squad'}
            </button>
            <button type="button" className="btn btn-ghost gmz-btn" disabled={!canParticipate} onClick={onEditProfile}>
              <UserCog size={12} /> Edit profile
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}
