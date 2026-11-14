import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarDays, Users, Trophy, Swords, MessagesSquare, CheckCircle2, XCircle, Play, Flag, GitBranch, Pencil, ShieldAlert,
} from 'lucide-react';
import { useGz, gz, formatWhen } from './gamingApi';
import { GzMasthead, GzEmpty, Avatar, UserLine, Badge, useFlash } from './gamingUi';
import '../daily-life/DailyMasthead.css';
import './GamingZone.css';

const STATUS_LABEL = { scheduled: 'Scheduled', live: 'Live', finished: 'Finished', cancelled: 'Cancelled' };
const MATCH_TONE = { reported: 'amber', disputed: 'rose', confirmed: 'emerald' };

function roundName(round, total) {
  if (round === total) return 'Final';
  if (round === total - 1) return 'Semi-finals';
  if (round === total - 2) return 'Quarter-finals';
  return `Round ${round}`;
}

function ScorePanel({ match, nameOf, onSubmit, onCancel, label }) {
  const [scoreA, setScoreA] = useState(match.scoreA ?? '');
  const [scoreB, setScoreB] = useState(match.scoreB ?? '');
  return (
    <div className="gmz-pop-panel" role="group" aria-label={label}>
      <span className="gmz-pop-title"><Pencil size={11} /> {label}</span>
      <div className="gmz-pop-row gmz-score-row">
        <label className="gmz-score-field"><span>{nameOf(match.entryAId)}</span>
          <input className="input gmz-pop-input" type="number" min={0} max={999} value={scoreA} onChange={(event) => setScoreA(event.target.value)} />
        </label>
        <label className="gmz-score-field"><span>{nameOf(match.entryBId)}</span>
          <input className="input gmz-pop-input" type="number" min={0} max={999} value={scoreB} onChange={(event) => setScoreB(event.target.value)} />
        </label>
      </div>
      <div className="gmz-pop-actions">
        <button type="button" className="btn btn-primary gmz-btn" disabled={scoreA === '' || scoreB === '' || scoreA === scoreB} onClick={() => onSubmit(Number(scoreA), Number(scoreB))}>Save</button>
        <button type="button" className="btn btn-ghost gmz-btn" onClick={onCancel}>Cancel</button>
        <span className="gmz-pop-note">No draws</span>
      </div>
    </div>
  );
}

export default function EventPage() {
  const { eventId } = useParams();
  const detail = useGz(`/events/${encodeURIComponent(eventId)}`);
  const [teamName, setTeamName] = useState('');
  const [teamMembers, setTeamMembers] = useState('');
  const [scoring, setScoring] = useState(null); // { id, mode: 'report' | 'resolve' }
  const [busy, setBusy] = useState(false);
  const [flash, showFlash] = useFlash();

  const run = async (path, body = {}, method = 'POST') => {
    setBusy(true);
    try {
      await gz(path, { method, body });
      setScoring(null);
      await detail.reload();
    } catch (err) {
      showFlash(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (detail.error) {
    return (
      <div className="gmz-widget glass-card-static animate-fadeInUp">
        <Link to="/gaming?view=events" className="gmz-back"><ArrowLeft size={13} /> Events</Link>
        <div className="gmz-card"><GzEmpty icon={ShieldAlert} hint={detail.error.message} /></div>
      </div>
    );
  }
  if (!detail.data) return <div className="gmz-widget glass-card-static"><p className="gmz-loading">Loading event…</p></div>;

  const { event, game, entries, matches, champion, myEntry, capabilities: caps } = detail.data;
  const isCup = event.kind === 'tournament';
  const entryById = Object.fromEntries(entries.map((entry) => [entry.id, entry]));
  const nameOf = (entryId) => {
    const entry = entryById[entryId];
    if (!entry) return 'TBD';
    return entry.teamName || entry.user?.name || 'Player';
  };
  const rounds = matches.length ? Math.max(...matches.map((match) => match.round)) : 0;
  const myEntryId = myEntry?.id;
  const startsAt = new Date(event.startsAt).getTime();
  const checkInOpen = Date.now() >= startsAt - 60 * 60 * 1000 && event.status !== 'finished' && event.status !== 'cancelled';
  const championEntry = champion ? entryById[champion] : null;

  const matchActions = (match) => {
    if (!match.entryAId || !match.entryBId || match.status === 'confirmed') return null;
    const mine = match.entryAId === myEntryId || match.entryBId === myEntryId;
    const reporterEntry = entries.find((entry) => entry.userId === match.reportedBy);
    const iReported = reporterEntry?.id === myEntryId;
    return (
      <span className="gmz-match-actions">
        {mine && (match.status === 'pending' || match.status === 'disputed') && (
          <button type="button" className="btn btn-ghost gmz-btn" onClick={() => setScoring({ id: match.id, mode: 'report' })}><Flag size={11} /> Report score</button>
        )}
        {mine && match.status === 'reported' && !iReported && (
          <>
            <button type="button" className="btn btn-primary gmz-btn" disabled={busy} onClick={() => run(`/matches/${match.id}/confirm`)}><CheckCircle2 size={11} /> Confirm</button>
            <button type="button" className="btn btn-ghost gmz-btn" disabled={busy} onClick={() => run(`/matches/${match.id}/dispute`)}><XCircle size={11} /> Dispute</button>
          </>
        )}
        {mine && match.status === 'reported' && iReported && <span className="gmz-pop-note">Waiting for your opponent</span>}
        {caps.resolve && (
          <button type="button" className="btn btn-ghost gmz-btn" onClick={() => setScoring({ id: match.id, mode: 'resolve' })}>Settle</button>
        )}
      </span>
    );
  };

  const menu = caps.manage ? [
    ...(event.status === 'scheduled' && !isCup ? [{ key: 'live', label: 'Mark as live', icon: Play, onSelect: () => run(`/events/${event.id}`, { status: 'live' }, 'PATCH') }] : []),
    ...(isCup && event.status !== 'finished' && event.status !== 'cancelled'
      ? [{ key: 'bracket', label: matches.length ? 'Rebuild bracket' : 'Build bracket', icon: GitBranch, onSelect: () => run(`/events/${event.id}/bracket`) }] : []),
    ...(event.status !== 'finished' && event.status !== 'cancelled'
      ? [{ key: 'finish', label: 'Mark as finished', icon: CheckCircle2, onSelect: () => run(`/events/${event.id}`, { status: 'finished' }, 'PATCH') },
        { key: 'cancel', label: 'Cancel event', icon: XCircle, danger: true, onSelect: () => { if (window.confirm('Cancel this event? Entrants will be told.')) run(`/events/${event.id}`, { status: 'cancelled' }, 'PATCH'); } }]
      : []),
  ] : [];

  return (
    <div className="gmz-widget glass-card-static animate-fadeInUp">
      <Link to="/gaming?view=events" className="gmz-back"><ArrowLeft size={13} /> Events</Link>
      <GzMasthead
        iconKey={game?.iconKey}
        overline={`${game?.name || 'Game'} · ${isCup ? 'Tournament' : 'Game night'}`}
        title={event.title}
        subtitle={`Hosted by ${event.creator?.name || 'AUSTWise'}`}
        stats={[
          { label: 'Starts', value: formatWhen(event.startsAt), small: true },
          { label: isCup ? 'Entries' : 'Going', value: `${event.entryCount}/${event.capacity}` },
          { label: 'Status', value: STATUS_LABEL[event.status] || event.status, small: true, alert: event.status === 'cancelled' },
        ]}
        menu={menu}
      />
      {flash}

      <div className="gmz-main-grid">
        <section className="gmz-card">
          {isCup ? (
            <>
              <div className="gmz-card-head-row is-ruled">
                <h3 className="gmz-card-title"><Swords size={14} /> Bracket</h3>
                {championEntry && <Badge tone="amber"><Trophy size={10} /> {nameOf(championEntry.id)}</Badge>}
              </div>
              {matches.length ? (
                <div className="gmz-bracket" role="list">
                  {Array.from({ length: rounds }, (_, index) => index + 1).map((round) => (
                    <div key={round} className="gmz-bracket-round" role="listitem">
                      <span className="gmz-section-label">{roundName(round, rounds)}</span>
                      {matches.filter((match) => match.round === round).map((match) => {
                        const bye = match.status === 'confirmed' && (!match.entryAId || !match.entryBId);
                        return (
                          <div key={match.id} className={`gmz-match${match.entryAId === myEntryId || match.entryBId === myEntryId ? ' is-mine' : ''}`}>
                            {[['A', match.entryAId, match.scoreA], ['B', match.entryBId, match.scoreB]].map(([side, entryId, score]) => (
                              <span key={side} className={`gmz-match-side${match.winnerEntryId && match.winnerEntryId === entryId ? ' is-winner' : ''}`}>
                                <span className="gmz-match-name">{entryId ? nameOf(entryId) : (bye ? 'Bye' : 'TBD')}</span>
                                <span className="gmz-match-score">{score ?? ''}</span>
                              </span>
                            ))}
                            {match.status !== 'pending' && !bye && <Badge tone={MATCH_TONE[match.status] || 'muted'}>{match.status}</Badge>}
                            {matchActions(match)}
                            {scoring?.id === match.id && (
                              <ScorePanel
                                match={match}
                                nameOf={nameOf}
                                label={scoring.mode === 'resolve' ? 'Settle result' : 'Report your score'}
                                onCancel={() => setScoring(null)}
                                onSubmit={(scoreA, scoreB) => run(`/matches/${match.id}/${scoring.mode}`, { scoreA, scoreB })}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <GzEmpty
                  icon={GitBranch}
                  hint={caps.manage ? 'Build the bracket once registration is done. Checked-in entries are used if anyone checked in.' : 'The bracket appears when the organisers build it.'}
                  actionLabel={caps.manage && entries.length >= 2 ? 'Build bracket' : null}
                  actionIcon={GitBranch}
                  onAction={() => run(`/events/${event.id}/bracket`)}
                />
              )}
            </>
          ) : (
            <>
              <div className="gmz-card-head-row is-ruled">
                <h3 className="gmz-card-title"><Users size={14} /> Who’s coming</h3>
                <span className="gmz-count">{entries.length}</span>
              </div>
              {entries.length ? (
                <div className="gmz-list">
                  {entries.map((entry) => (
                    <div key={entry.id} className="gmz-row">
                      <Avatar user={entry.user} />
                      <span className="gmz-row-body">
                        <UserLine user={entry.user} />
                        <span className="gmz-row-meta">{[entry.user?.department, entry.user?.batch].filter(Boolean).join(' · ') || ' '}</span>
                      </span>
                      {entry.checkedIn && <span className="gmz-row-side"><Badge tone="emerald">Checked in</Badge></span>}
                    </div>
                  ))}
                </div>
              ) : (
                <GzEmpty icon={Users} hint="Nobody has signed up yet. Be the first." />
              )}
            </>
          )}
        </section>

        <aside className="gmz-rail">
          <section className="gmz-card">
            <div className="gmz-card-head-row is-ruled">
              <h3 className="gmz-card-title"><CalendarDays size={14} /> Details</h3>
              <Badge tone={event.status === 'live' ? 'amber' : event.status === 'cancelled' ? 'rose' : 'muted'}>{STATUS_LABEL[event.status]}</Badge>
            </div>
            <dl className="gmz-facts">
              <div><dt>When</dt><dd>{formatWhen(event.startsAt)}{event.endsAt ? ` – ${formatWhen(event.endsAt)}` : ''}</dd></div>
              <div><dt>Game</dt><dd>{game?.name}</dd></div>
              {isCup && <div><dt>Format</dt><dd>Single elimination{event.teamSize > 1 ? ` · teams of ${event.teamSize}` : ''}</dd></div>}
            </dl>
            {event.description && <p className="gmz-text gmz-prewrap">{event.description}</p>}

            {myEntry ? (
              <div className="gmz-actions">
                <Badge tone="emerald">{myEntry.teamName ? `Registered as ${myEntry.teamName}` : 'You’re in'}</Badge>
                {checkInOpen && !myEntry.checkedIn && (
                  <button type="button" className="btn btn-primary gmz-btn" disabled={busy} onClick={() => run(`/events/${event.id}/checkin`)}><CheckCircle2 size={12} /> Check in</button>
                )}
                {!matches.length && event.status === 'scheduled' && (
                  <button type="button" className="btn btn-ghost gmz-btn" disabled={busy} onClick={() => run(`/events/${event.id}/unregister`)}>Leave</button>
                )}
              </div>
            ) : caps.register ? (
              <>
                {event.teamSize > 1 && (
                  <div className="gmz-pop-panel" role="group" aria-label="Team details">
                    <span className="gmz-pop-title"><Users size={11} /> Your team</span>
                    <input className="input gmz-pop-input is-title" placeholder="Team name" maxLength={40} value={teamName} onChange={(e) => setTeamName(e.target.value)} />
                    <input className="input gmz-pop-input" placeholder={`Teammates’ IGNs, comma separated (${event.teamSize - 1})`} value={teamMembers} onChange={(e) => setTeamMembers(e.target.value)} />
                  </div>
                )}
                <div className="gmz-actions">
                  <button
                    type="button"
                    className="btn btn-primary gmz-btn"
                    disabled={busy || event.entryCount >= event.capacity || (event.teamSize > 1 && teamName.trim().length < 2)}
                    onClick={() => run(`/events/${event.id}/register`, { teamName, teamMembers: teamMembers.split(',').map((name) => name.trim()).filter(Boolean) })}
                  >
                    {event.entryCount >= event.capacity ? 'Event full' : isCup ? 'Register' : 'I’m going'}
                  </button>
                </div>
              </>
            ) : (
              <p className="gmz-text">{event.status === 'scheduled' ? 'Your account can’t register for events.' : 'Registration is closed.'}</p>
            )}
            {event.roomId && (myEntry || caps.manage) && (
              <Link to={`/gaming/room/${event.roomId}`} className="gmz-card-link gmz-room-link"><MessagesSquare size={12} /> Event chat</Link>
            )}
          </section>

          {isCup && (
            <section className="gmz-card">
              <div className="gmz-card-head-row is-ruled">
                <h3 className="gmz-card-title"><Users size={14} /> Entries</h3>
                <span className="gmz-count">{entries.length}/{event.capacity}</span>
              </div>
              {entries.length ? (
                <div className="gmz-list">
                  {entries.map((entry) => (
                    <div key={entry.id} className="gmz-row">
                      <Avatar user={entry.user} size="sm" />
                      <span className="gmz-row-body">
                        <span className="gmz-row-title">{entry.teamName || entry.user?.name}</span>
                        <span className="gmz-row-meta">{entry.teamName ? [entry.user?.name, ...entry.teamMembers].join(', ') : entry.user?.department || ' '}</span>
                      </span>
                      <span className="gmz-row-side">
                        {entry.seed && <span className="gmz-count">#{entry.seed}</span>}
                        {entry.checkedIn && <Badge tone="emerald">In</Badge>}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <GzEmpty icon={Users} hint="No entries yet." />
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
