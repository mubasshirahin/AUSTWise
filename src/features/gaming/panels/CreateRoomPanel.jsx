import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { gz } from '../gamingApi';
import { useFlash } from '../gamingUi';

/** Inline composer under the toolbar (skill-style §7b). */
export default function CreateRoomPanel({ games, defaultGameId, onCancel, onCreated }) {
  const active = games.filter((game) => game.active !== false);
  const [form, setForm] = useState(() => {
    const first = active.find((game) => game.id === defaultGameId) || active[0];
    return {
      gameId: first?.id || '', title: '', capacity: first?.maxSquad || 5, visibility: 'public',
      rankMin: '', rankMax: '', platform: first?.platforms?.[0] || '', region: '', description: '',
    };
  });
  const [busy, setBusy] = useState(false);
  const [flash, showFlash] = useFlash();
  const game = useMemo(() => active.find((item) => item.id === form.gameId), [active, form.gameId]);
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const pickGame = (event) => {
    const next = active.find((item) => item.id === event.target.value);
    setForm((current) => ({
      ...current, gameId: next?.id || '', capacity: Math.min(Number(current.capacity) || next?.maxSquad, next?.maxSquad || 5),
      rankMin: '', rankMax: '', platform: next?.platforms?.[0] || '',
    }));
  };

  const submit = async (event) => {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const detail = await gz('/rooms', {
        method: 'POST',
        body: { ...form, capacity: Number(form.capacity), rankMin: form.rankMin || null, rankMax: form.rankMax || null },
      });
      onCreated(detail);
    } catch (err) {
      showFlash(err.message);
      setBusy(false);
    }
  };

  return (
    <form
      className="gmz-pop-panel gmz-composer"
      aria-label="Create a squad room"
      onSubmit={submit}
      onKeyDown={(event) => { if (event.key === 'Escape') onCancel(); }}
    >
      <span className="gmz-pop-title"><Plus size={11} /> New squad room</span>
      <input
        className="input gmz-pop-input is-title"
        placeholder="Room title, e.g. Ranked grind, need a smoke main"
        value={form.title}
        maxLength={60}
        onChange={set('title')}
        autoFocus
      />
      <div className="gmz-pop-row">
        <select className="input gmz-pop-input is-half" value={form.gameId} onChange={pickGame} aria-label="Game">
          {active.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className="input gmz-pop-input is-half" value={form.capacity} onChange={set('capacity')} aria-label="Squad size">
          {Array.from({ length: Math.max(1, (game?.maxSquad || 5) - 1) }, (_, index) => index + 2).map((size) => (
            <option key={size} value={size}>{size} players</option>
          ))}
        </select>
        <select className="input gmz-pop-input is-half" value={form.visibility} onChange={set('visibility')} aria-label="Visibility">
          <option value="public">Public</option>
          <option value="private">Private (invite code)</option>
        </select>
        {game?.platforms?.length > 1 && (
          <select className="input gmz-pop-input is-half" value={form.platform} onChange={set('platform')} aria-label="Platform">
            {game.platforms.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
          </select>
        )}
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
          <input className="input gmz-pop-input is-half" placeholder="Region / server (optional)" maxLength={30} value={form.region} onChange={set('region')} />
        </div>
      )}
      <input
        className="input gmz-pop-input"
        placeholder="Note for players (optional): mic needed, chill vibes, etc."
        maxLength={280}
        value={form.description}
        onChange={set('description')}
      />
      {flash}
      <div className="gmz-pop-actions">
        <button type="submit" className="btn btn-primary gmz-btn" disabled={busy || form.title.trim().length < 3}>
          {busy ? 'Creating…' : 'Create room'}
        </button>
        <button type="button" className="btn btn-ghost gmz-btn" onClick={onCancel}>Cancel</button>
        <span className="gmz-pop-note">Idle rooms close after 2 hours</span>
      </div>
    </form>
  );
}
