import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, Flag, Gavel, Boxes, Plus, Ban, VolumeX, CheckCircle2, Undo2, ShieldAlert, Eye, EyeOff,
} from 'lucide-react';
import { useGz, gz, timeAgo, formatWhen } from './gamingApi';
import { GzMasthead, GzPills, GzEmpty, GzModal, Avatar, UserLine, Badge, GameIcon, useFlash } from './gamingUi';
import '../daily-life/DailyMasthead.css';
import './GamingZone.css';

const VIEWS = [
  { id: 'reports', label: 'Reports', icon: Flag },
  { id: 'sanctions', label: 'Sanctions', icon: Gavel },
  { id: 'games', label: 'Games', icon: Boxes },
];
const REASON_LABEL = {
  toxicity: 'Toxicity', harassment: 'Harassment', cheating: 'Cheating', spam: 'Spam', scam: 'Scam', no_show: 'No-show', other: 'Other',
};
const TYPE_LABEL = { mute: 'Mute', room_ban: 'Room ban', zone_ban: 'Zone ban' };

function SanctionModal({ target, report, tier, onClose, onDone }) {
  const maxDays = tier === 'gaming_mod' ? 7 : 3650;
  const [type, setType] = useState('mute');
  const [days, setDays] = useState(1);
  const [reason, setReason] = useState(report ? `${REASON_LABEL[report.reason] || report.reason}${report.details ? `: ${report.details}` : ''}`.slice(0, 200) : '');
  const [busy, setBusy] = useState(false);
  const [flash, showFlash] = useFlash();
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await gz('/sanctions', {
        method: 'POST',
        body: {
          userId: target.id, type, days: days === '' ? null : Number(days), reason,
          roomId: type === 'room_ban' ? report?.roomId : undefined, reportId: report?.id,
        },
      });
      onDone();
    } catch (err) {
      showFlash(err.message);
      setBusy(false);
    }
  };
  return (
    <GzModal
      title={`Sanction ${target.name}`}
      icon={Gavel}
      onClose={onClose}
      summary={<><Badge>{tier === 'gaming_mod' ? `Max ${maxDays} days` : 'Any length'}</Badge>{report && <Badge tone="amber">From report</Badge>}</>}
    >
      <form onSubmit={submit}>
        <div className="gmz-form-row">
          <select className="input gmz-field is-grow" value={type} onChange={(event) => setType(event.target.value)} aria-label="Type">
            <option value="mute">Mute everywhere</option>
            {report?.roomId && <option value="room_ban">Ban from the room</option>}
            <option value="zone_ban">Suspend from Gaming Zone</option>
          </select>
          <label className="gmz-field-label">
            Days
            <input className="input gmz-field" type="number" min={1} max={maxDays} value={days} onChange={(event) => setDays(event.target.value)} placeholder={tier === 'gaming_mod' ? '' : 'Blank = permanent'} />
          </label>
        </div>
        <div className="gmz-form-row">
          <input className="input gmz-field is-grow" placeholder="Reason (shown to the user)" maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        {flash}
        <div className="gmz-form-row gmz-modal-actions">
          <button type="submit" className="btn btn-primary gmz-btn" disabled={busy || reason.trim().length < 3}>{busy ? 'Saving…' : 'Apply'}</button>
          <button type="button" className="btn btn-ghost gmz-btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </GzModal>
  );
}

function ReportsView({ tier }) {
  const [status, setStatus] = useState('open');
  const reports = useGz(`/reports?status=${status}`);
  const [sanction, setSanction] = useState(null);
  const [flash, showFlash] = useFlash();
  const dismiss = async (report) => {
    try {
      await gz(`/reports/${report.id}`, { method: 'POST', body: { status: 'dismissed', resolution: 'No action needed' } });
      reports.reload();
    } catch (err) { showFlash(err.message); }
  };
  const list = reports.data || [];
  return (
    <section className="gmz-card">
      <div className="gmz-card-head-row is-ruled">
        <h3 className="gmz-card-title"><Flag size={14} /> Reports</h3>
        <GzPills items={[{ id: 'open', label: 'Open' }, { id: 'actioned', label: 'Actioned' }, { id: 'dismissed', label: 'Dismissed' }]} value={status} onChange={setStatus} label="Report status" />
      </div>
      {flash}
      {reports.loading && !reports.data ? <p className="gmz-loading">Loading reports…</p> : list.length ? (
        <div className="gmz-list">
          {list.map((report) => (
            <div key={report.id} className="gmz-row gmz-report-row">
              <Avatar user={report.target} />
              <span className="gmz-row-body">
                <UserLine user={report.target} extra={<Badge tone="rose">{REASON_LABEL[report.reason] || report.reason}</Badge>} />
                <span className="gmz-row-meta">Reported by {report.reporter?.name || 'someone'} · {timeAgo(report.createdAt)}{report.handler ? ` · handled by ${report.handler.name}` : ''}</span>
                {report.message?.text && <blockquote className="gmz-quote">{report.message.text}</blockquote>}
                {report.details && <span className="gmz-row-note">{report.details}</span>}
                {report.resolution && <span className="gmz-row-note">→ {report.resolution}</span>}
              </span>
              {report.status === 'open' && report.target && (
                <span className="gmz-row-side gmz-row-side-actions">
                  <button type="button" className="btn btn-primary gmz-btn" onClick={() => setSanction(report)}><Gavel size={11} /> Act</button>
                  <button type="button" className="btn btn-ghost gmz-btn" onClick={() => dismiss(report)}>Dismiss</button>
                  {report.roomId && <Link to={`/gaming/room/${report.roomId}`} className="gmz-icon-btn" aria-label="Open room"><Eye size={12} /></Link>}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : <GzEmpty icon={CheckCircle2} hint={status === 'open' ? 'No open reports. All quiet.' : 'Nothing here.'} />}
      {sanction && (
        <SanctionModal target={sanction.target} report={sanction} tier={tier} onClose={() => setSanction(null)} onDone={() => { setSanction(null); reports.reload(); }} />
      )}
    </section>
  );
}

function SanctionsView() {
  const [active, setActive] = useState('1');
  const sanctions = useGz(`/sanctions?active=${active}`);
  const [flash, showFlash] = useFlash();
  const revoke = async (row) => {
    try {
      await gz(`/sanctions/${row.id}/revoke`, { method: 'POST', body: {} });
      sanctions.reload();
    } catch (err) { showFlash(err.message); }
  };
  const list = sanctions.data || [];
  return (
    <section className="gmz-card">
      <div className="gmz-card-head-row is-ruled">
        <h3 className="gmz-card-title"><Gavel size={14} /> Sanctions</h3>
        <GzPills items={[{ id: '1', label: 'Active' }, { id: '0', label: 'All' }]} value={active} onChange={setActive} label="Sanction filter" />
      </div>
      {flash}
      {sanctions.loading && !sanctions.data ? <p className="gmz-loading">Loading…</p> : list.length ? (
        <div className="gmz-list">
          {list.map((row) => {
            const live = !row.revokedAt && (!row.until || new Date(row.until) > new Date());
            const Icon = row.type === 'mute' ? VolumeX : Ban;
            return (
              <div key={row.id} className="gmz-row">
                <span className="gmz-row-icon"><Icon size={14} /></span>
                <span className="gmz-row-body">
                  <UserLine user={row.user} extra={<Badge tone={live ? 'rose' : 'muted'}>{TYPE_LABEL[row.type]}</Badge>} />
                  <span className="gmz-row-meta">
                    {row.until ? `Until ${formatWhen(row.until)}` : 'Permanent'} · by {row.issuer?.name || 'mod'} · {timeAgo(row.createdAt)}
                    {row.revokedAt ? ' · revoked' : ''}
                  </span>
                  <span className="gmz-row-note">{row.reason}</span>
                </span>
                {live && (
                  <span className="gmz-row-side">
                    <button type="button" className="btn btn-ghost gmz-btn" onClick={() => revoke(row)}><Undo2 size={11} /> Revoke</button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : <GzEmpty icon={Gavel} hint="No sanctions." />}
    </section>
  );
}

function GamesView() {
  const games = useGz('/games?all=1');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', genre: '', platforms: 'PC, Mobile', maxSquad: 5, ranks: '', iconKey: 'gamepad' });
  const [flash, showFlash] = useFlash();
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const split = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);

  const add = async (event) => {
    event.preventDefault();
    try {
      await gz('/games', { method: 'POST', body: { ...form, platforms: split(form.platforms), ranks: split(form.ranks), maxSquad: Number(form.maxSquad) } });
      setAdding(false);
      setForm({ name: '', genre: '', platforms: 'PC, Mobile', maxSquad: 5, ranks: '', iconKey: 'gamepad' });
      games.reload();
    } catch (err) { showFlash(err.message); }
  };
  const toggle = async (game) => {
    try {
      await gz(`/games/${game.id}`, { method: 'PATCH', body: { active: !game.active } });
      games.reload();
    } catch (err) { showFlash(err.message); }
  };

  return (
    <section className="gmz-card">
      <div className="gmz-card-head-row is-ruled">
        <h3 className="gmz-card-title"><Boxes size={14} /> Games</h3>
        <button type="button" className="gmz-add-icon-btn" aria-label="Add game" data-on={adding ? 'true' : undefined} onClick={() => setAdding((value) => !value)}><Plus size={14} /></button>
      </div>
      {flash}
      {adding && (
        <form className="gmz-pop-panel" aria-label="Add a game" onSubmit={add} onKeyDown={(event) => { if (event.key === 'Escape') setAdding(false); }}>
          <span className="gmz-pop-title"><Plus size={11} /> Add a game</span>
          <input className="input gmz-pop-input is-title" placeholder="Name" maxLength={40} value={form.name} onChange={set('name')} autoFocus />
          <div className="gmz-pop-row">
            <input className="input gmz-pop-input is-half" placeholder="Genre" maxLength={40} value={form.genre} onChange={set('genre')} />
            <input className="input gmz-pop-input is-half" placeholder="Platforms, comma separated" value={form.platforms} onChange={set('platforms')} />
            <input className="input gmz-pop-input is-half" type="number" min={2} max={50} value={form.maxSquad} onChange={set('maxSquad')} aria-label="Max squad size" />
            <select className="input gmz-pop-input is-half" value={form.iconKey} onChange={set('iconKey')} aria-label="Icon">
              {['gamepad', 'crosshair', 'target', 'flame', 'swords', 'trophy', 'crown', 'pickaxe', 'rocket', 'dice'].map((key) => <option key={key} value={key}>{key}</option>)}
            </select>
          </div>
          <input className="input gmz-pop-input" placeholder="Ranks low → high, comma separated (optional)" value={form.ranks} onChange={set('ranks')} />
          <div className="gmz-pop-actions">
            <button type="submit" className="btn btn-primary gmz-btn" disabled={form.name.trim().length < 2}>Add game</button>
            <button type="button" className="btn btn-ghost gmz-btn" onClick={() => setAdding(false)}>Cancel</button>
            <span className="gmz-pop-note">A lounge is created with it</span>
          </div>
        </form>
      )}
      {games.loading && !games.data ? <p className="gmz-loading">Loading…</p> : (
        <div className="gmz-list">
          {(games.data || []).map((game) => (
            <div key={game.id} className={`gmz-row${game.active ? '' : ' is-muted'}`}>
              <span className="gmz-row-icon"><GameIcon iconKey={game.iconKey} size={15} /></span>
              <span className="gmz-row-body">
                <span className="gmz-row-title">{game.name}</span>
                <span className="gmz-row-meta">{[game.genre, game.platforms.join(', '), `up to ${game.maxSquad}`, game.ranks.length ? `${game.ranks.length} ranks` : null].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="gmz-row-side">
                <button type="button" className="btn btn-ghost gmz-btn" onClick={() => toggle(game)}>
                  {game.active ? <><EyeOff size={11} /> Hide</> : <><Eye size={11} /> Show</>}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function GamingModPage() {
  const [params, setParams] = useSearchParams();
  const me = useGz('/me');
  const caps = me.data?.capabilities;
  const view = VIEWS.some((item) => item.id === params.get('view')) ? params.get('view') : 'reports';
  const views = VIEWS.filter((item) => item.id !== 'games' || caps?.manageGames);

  return (
    <div className="gmz-widget glass-card-static animate-fadeInUp">
      <Link to="/gaming" className="gmz-back"><ArrowLeft size={13} /> Gaming Zone</Link>
      <GzMasthead icon={ShieldCheck} overline="Gaming Zone" title="Moderation" subtitle="Reports, sanctions and the game catalog" />
      {me.loading && !me.data ? <p className="gmz-loading">Loading…</p> : !caps?.moderate ? (
        <div className="gmz-card"><GzEmpty icon={ShieldAlert} hint="Only gaming mods and staff can open moderation." /></div>
      ) : (
        <>
          <div className="gmz-toolbar">
            <GzPills items={views} value={view} onChange={(next) => setParams({ view: next }, { replace: true })} label="Moderation sections" />
          </div>
          {view === 'reports' && <ReportsView tier={caps.tier} />}
          {view === 'sanctions' && <SanctionsView />}
          {view === 'games' && caps.manageGames && <GamesView />}
        </>
      )}
    </div>
  );
}
