import { useState } from 'react';
import { Trophy, Building2 } from 'lucide-react';
import { useGz } from '../gamingApi';
import { Avatar, GzEmpty, UserLine, GzPills } from '../gamingUi';

const PERIODS = [
  { id: 'all', label: 'All time' },
  { id: 'month', label: '30 days' },
];

export default function RanksTab({ games }) {
  const [game, setGame] = useState('');
  const [period, setPeriod] = useState('all');
  const query = new URLSearchParams();
  if (game) query.set('game', game);
  if (period === 'month') query.set('period', 'month');
  const board = useGz(`/leaderboard${query.toString() ? `?${query}` : ''}`);
  const players = board.data?.players || [];
  const departments = board.data?.departments || [];
  const top = departments[0]?.points || 1;

  return (
    <div className="gmz-main-grid">
      <section className="gmz-card">
        <div className="gmz-card-head-row is-ruled">
          <h3 className="gmz-card-title"><Trophy size={14} /> Top players</h3>
          <div className="gmz-filters">
            <GzPills items={PERIODS} value={period} onChange={setPeriod} label="Period" />
            <select className="input gmz-select" value={game} onChange={(event) => setGame(event.target.value)} aria-label="Filter by game">
              <option value="">All games</option>
              {games.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
            </select>
          </div>
        </div>
        {board.loading && !board.data ? (
          <p className="gmz-loading">Loading ranks…</p>
        ) : players.length ? (
          <ol className="gmz-list gmz-rank-list">
            {players.map((player, index) => (
              <li key={player.userId} className="gmz-row gmz-rank-row">
                <span className="gmz-rank-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="gmz-rank-body">
                  <Avatar user={player.user} size="sm" />
                  <span className="gmz-row-body">
                    <UserLine user={player.user} />
                    <span className="gmz-row-meta">
                      {[player.user.department, `${player.wins} win${player.wins === 1 ? '' : 's'}`, player.titles ? `${player.titles} title${player.titles === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </span>
                <span className="gmz-rank-points">{player.points}</span>
              </li>
            ))}
          </ol>
        ) : (
          <GzEmpty icon={Trophy} hint="Ranks fill up as tournament matches are played. 3 points a win, 10 for a title." />
        )}
      </section>

      <aside className="gmz-rail">
        <section className="gmz-card">
          <div className="gmz-card-head-row is-ruled">
            <h3 className="gmz-card-title"><Building2 size={14} /> Dept wars</h3>
          </div>
          {departments.length ? (
            <div className="gmz-list">
              {departments.map((dept) => (
                <div key={dept.department} className="gmz-row gmz-dept-row">
                  <span className="gmz-row-body">
                    <span className="gmz-row-title">{dept.department}</span>
                    <span className="gmz-bar-line">
                      <span className="gmz-bar"><span className="gmz-bar-fill" style={{ width: `${Math.round((dept.points / top) * 100)}%` }} /></span>
                      <span className="gmz-count">{dept.points} pts</span>
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <GzEmpty icon={Building2} hint="Departments score from their players' tournament wins." />
          )}
        </section>
      </aside>
    </div>
  );
}
