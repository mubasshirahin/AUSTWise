import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { gz } from '../gamingApi';
import { GzModal, Badge, useFlash } from '../gamingUi';

function defaultStart() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setHours(21, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EventModal({ games, caps, defaultGameId, onClose, onCreated }) {
  const active = games.filter((game) => game.active !== false);
  const canNight = !!caps?.createGameNight;
  const canCup = !!caps?.createTournament;
  const [form, setForm] = useState({
    kind: canNight ? 'game_night' : 'tournament',
    gameId: defaultGameId || active[0]?.id || '',
    title: '',
    startsAt: defaultStart(),
    capacity: canNight ? 40 : 16,
    teamSize: 1,
    description: '',
  });
  const [busy, setBusy] = useState(false);
  const [flash, showFlash] = useFlash();
  const game = active.find((item) => item.id === form.gameId);
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const created = await gz('/events', {
        method: 'POST',
        body: {
          ...form,
          startsAt: new Date(form.startsAt).toISOString(),
          capacity: Number(form.capacity),
          teamSize: Number(form.teamSize),
        },
      });
      onCreated(created);
    } catch (err) {
      showFlash(err.message);
      setBusy(false);
    }
  };

  const isCup = form.kind === 'tournament';
  return (
    <GzModal
      title="Host an event"
      icon={CalendarPlus}
      onClose={onClose}
      summary={(
        <>
          <Badge>{isCup ? 'Tournament' : 'Game night'}</Badge>
          <Badge tone="amber">{game?.name || 'Pick a game'}</Badge>
        </>
      )}
    >
      <form onSubmit={submit}>
        {canNight && canCup && (
          <div className="gmz-form-row">
            <select className="input gmz-field" value={form.kind} onChange={set('kind')} aria-label="Event type">
              <option value="game_night">Game night</option>
              <option value="tournament">Tournament (bracket)</option>
            </select>
          </div>
        )}
        <div className="gmz-form-row">
          <input className="input gmz-field is-grow" placeholder="Event title" maxLength={60} value={form.title} onChange={set('title')} autoFocus />
        </div>
        <div className="gmz-form-row">
          <select className="input gmz-field is-grow" value={form.gameId} onChange={set('gameId')} aria-label="Game">
            {active.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <input className="input gmz-field is-grow" type="datetime-local" value={form.startsAt} onChange={set('startsAt')} aria-label="Starts at" />
        </div>
        <div className="gmz-form-row">
          <label className="gmz-field-label">
            {isCup ? 'Entries' : 'Spots'}
            <input className="input gmz-field" type="number" min={2} max={isCup ? 64 : 500} value={form.capacity} onChange={set('capacity')} />
          </label>
          {isCup && (
            <label className="gmz-field-label">
              Team size
              <input className="input gmz-field" type="number" min={1} max={game?.maxSquad || 5} value={form.teamSize} onChange={set('teamSize')} />
            </label>
          )}
        </div>
        <div className="gmz-form-row">
          <textarea className="input gmz-field is-grow gmz-textarea" placeholder="Details: rules, map pool, prizes (optional)" maxLength={600} value={form.description} onChange={set('description')} />
        </div>
        {flash}
        <div className="gmz-form-row gmz-modal-actions">
          <button type="submit" className="btn btn-primary gmz-btn" disabled={busy || form.title.trim().length < 3}>{busy ? 'Creating…' : 'Create event'}</button>
          <button type="button" className="btn btn-ghost gmz-btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </GzModal>
  );
}
