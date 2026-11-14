import { useEffect, useState } from 'react';
import { UserCog, Plus, Trash2 } from 'lucide-react';
import { gz } from '../gamingApi';
import { GzModal, Badge, useFlash } from '../gamingUi';

const PLATFORMS = ['PC', 'Mobile', 'Console'];
const DAYS = [['sat', 'Sat'], ['sun', 'Sun'], ['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri']];
const SLOT_RE = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

export default function ProfileModal({ games, onClose, onSaved }) {
  const [profile, setProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, showFlash] = useFlash();

  useEffect(() => {
    gz('/profile').then((data) => {
      const p = data.profile;
      setProfile({
        games: p.games || [],
        platforms: p.platforms || [],
        lookingForSquad: !!p.lookingForSquad,
        lfgGameIds: p.lfgGameIds || [],
        bio: p.bio || '',
        availability: Object.fromEntries(DAYS.map(([day]) => [day, p.availability?.[day]?.[0] || ''])),
        reputation: p.reputation || 0,
      });
    }).catch((err) => showFlash(err.message));
  }, [showFlash]);

  const gameById = Object.fromEntries(games.map((game) => [game.id, game]));
  const update = (patch) => setProfile((current) => ({ ...current, ...patch }));
  const setEntry = (index, patch) => update({ games: profile.games.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)) });
  const unused = games.filter((game) => !profile?.games.some((entry) => entry.gameId === game.id));
  const toggle = (list, value) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  const save = async (event) => {
    event.preventDefault();
    const bad = Object.entries(profile.availability).find(([, slot]) => slot && !SLOT_RE.test(slot));
    if (bad) { showFlash('Times look like 20:00-23:00.'); return; }
    setBusy(true);
    try {
      await gz('/profile', {
        method: 'PUT',
        body: {
          ...profile,
          availability: Object.fromEntries(Object.entries(profile.availability).filter(([, slot]) => slot).map(([day, slot]) => [day, [slot]])),
        },
      });
      onSaved();
    } catch (err) {
      showFlash(err.message);
      setBusy(false);
    }
  };

  return (
    <GzModal
      title="Gamer profile"
      icon={UserCog}
      onClose={onClose}
      wide
      summary={profile && (
        <>
          <Badge>Games: <strong>{profile.games.length}</strong></Badge>
          <Badge tone={profile.lookingForSquad ? 'amber' : 'muted'}>{profile.lookingForSquad ? 'Looking for squad' : 'Not looking'}</Badge>
          <Badge>Rep: <strong>{profile.reputation}</strong></Badge>
        </>
      )}
    >
      {!profile ? (flash || <p className="gmz-loading">Loading profile…</p>) : (
        <form onSubmit={save}>
          <span className="gmz-section-label">Games you play</span>
          {profile.games.map((entry, index) => {
            const game = gameById[entry.gameId];
            return (
              <div key={entry.gameId} className="gmz-form-row gmz-game-entry">
                <span className="gmz-entry-name">{game?.name || 'Game'}</span>
                <input className="input gmz-field is-grow" placeholder="In-game name" maxLength={32} value={entry.ign} onChange={(e) => setEntry(index, { ign: e.target.value })} />
                {game?.ranks?.length > 0 && (
                  <select className="input gmz-field" value={entry.rank || ''} onChange={(e) => setEntry(index, { rank: e.target.value })} aria-label="Rank">
                    <option value="">Rank</option>
                    {game.ranks.map((rank) => <option key={rank} value={rank}>{rank}</option>)}
                  </select>
                )}
                <input className="input gmz-field" placeholder="Role (IGL, support…)" maxLength={24} value={entry.position || ''} onChange={(e) => setEntry(index, { position: e.target.value })} />
                <button type="button" className="gmz-icon-btn is-danger" aria-label={`Remove ${game?.name}`} onClick={() => update({ games: profile.games.filter((_, i) => i !== index), lfgGameIds: profile.lfgGameIds.filter((id) => id !== entry.gameId) })}>
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
          {unused.length > 0 && profile.games.length < 12 && (
            <div className="gmz-form-row">
              <select
                className="input gmz-field is-grow"
                value=""
                aria-label="Add a game"
                onChange={(e) => e.target.value && update({ games: [...profile.games, { gameId: e.target.value, ign: '', rank: '', position: '' }] })}
              >
                <option value="">+ Add a game</option>
                {unused.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}
              </select>
            </div>
          )}

          <span className="gmz-section-label">Platforms</span>
          <div className="gmz-chips is-toggles">
            {PLATFORMS.map((platform) => (
              <button key={platform} type="button" className="gmz-chip" data-on={profile.platforms.includes(platform) ? 'true' : undefined} onClick={() => update({ platforms: toggle(profile.platforms, platform) })}>
                {platform}
              </button>
            ))}
          </div>

          <span className="gmz-section-label">Squad finder</span>
          <label className="gmz-check">
            <input type="checkbox" checked={profile.lookingForSquad} onChange={(e) => update({ lookingForSquad: e.target.checked })} /> I'm looking for a squad
          </label>
          {profile.lookingForSquad && profile.games.length > 0 && (
            <div className="gmz-chips is-toggles">
              {profile.games.map((entry) => (
                <button key={entry.gameId} type="button" className="gmz-chip" data-on={profile.lfgGameIds.includes(entry.gameId) ? 'true' : undefined} onClick={() => update({ lfgGameIds: toggle(profile.lfgGameIds, entry.gameId) })}>
                  <Plus size={10} /> {gameById[entry.gameId]?.name}
                </button>
              ))}
            </div>
          )}

          <span className="gmz-section-label">Usually free (HH:MM-HH:MM)</span>
          <div className="gmz-avail-grid">
            {DAYS.map(([day, label]) => (
              <label key={day} className="gmz-avail-cell">
                <span>{label}</span>
                <input
                  className="input gmz-field"
                  placeholder="20:00-23:00"
                  maxLength={11}
                  value={profile.availability[day]}
                  onChange={(e) => update({ availability: { ...profile.availability, [day]: e.target.value.trim() } })}
                />
              </label>
            ))}
          </div>

          <span className="gmz-section-label">Bio</span>
          <textarea className="input gmz-field is-grow gmz-textarea" maxLength={200} placeholder="Main roles, mic, the vibe you want" value={profile.bio} onChange={(e) => update({ bio: e.target.value })} />
          {flash}
          <div className="gmz-form-row gmz-modal-actions">
            <button type="submit" className="btn btn-primary gmz-btn" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
            <button type="button" className="btn btn-ghost gmz-btn" onClick={onClose}>Cancel</button>
          </div>
        </form>
      )}
    </GzModal>
  );
}
