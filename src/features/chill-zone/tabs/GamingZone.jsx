import { Link } from 'react-router-dom';
import { Gamepad2, ArrowRight, CalendarDays, Users } from 'lucide-react';
import { useGz } from '../../gaming/gamingApi';
import { GameIcon, GzEmpty } from '../../gaming/gamingUi';
import { EventRow } from '../../gaming/tabs/LobbyTab';
import '../../gaming/GamingZone.css';
import './ChillMasthead.css';

/** DownTime tab: a live peek into the Gaming Zone with a link to the full page. */
export default function GamingZone() {
  const overview = useGz('/overview');
  const games = overview.data?.games || [];
  const busiest = [...games].sort((a, b) => (b.openSquads + b.inLounge) - (a.openSquads + a.inLounge)).slice(0, 4);
  const openSquads = games.reduce((sum, game) => sum + game.openSquads, 0);

  return (
    <div className="gz cz-mst">
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <Gamepad2 size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">DownTime</span>
            <p className="schedule-title">Gaming Zone</p>
            <span className="schedule-subtitle">
              {overview.data ? `${overview.data.onlineNow} online · ${openSquads} open squads` : 'Squads, game nights and tournaments'}
            </span>
          </div>
        </div>
        <div className="schedule-masthead-center" />
      </div>
      <div className="schedule-dotted-divider" />

      <div className="gmz-widget gmz-preview">
        {overview.error ? (
          <div className="gmz-card"><GzEmpty icon={Gamepad2} hint={overview.error.message} /></div>
        ) : (
          <div className="gmz-main-grid">
            <section className="gmz-card">
              <div className="gmz-card-head-row is-ruled">
                <h3 className="gmz-card-title"><Users size={14} /> Busy right now</h3>
                <Link to="/gaming" className="gmz-card-link">Open Gaming Zone <ArrowRight size={12} /></Link>
              </div>
              {overview.loading && !overview.data ? <p className="gmz-loading">Loading…</p> : (
                <div className="gmz-list">
                  {busiest.map((game) => (
                    <Link key={game.id} to={`/gaming/g/${game.slug}`} className="gmz-row">
                      <span className="gmz-row-icon"><GameIcon iconKey={game.iconKey} size={15} /></span>
                      <span className="gmz-row-body">
                        <span className="gmz-row-title">{game.name}</span>
                        <span className="gmz-row-meta">{game.openSquads} squads · {game.inLounge} in the lounge</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
            <section className="gmz-card">
              <div className="gmz-card-head-row is-ruled">
                <h3 className="gmz-card-title"><CalendarDays size={14} /> Up next</h3>
              </div>
              {overview.data?.events?.length ? (
                <div className="gmz-list">{overview.data.events.slice(0, 3).map((event) => <EventRow key={event.id} event={event} />)}</div>
              ) : (
                <GzEmpty icon={CalendarDays} hint="No game nights scheduled yet." />
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
