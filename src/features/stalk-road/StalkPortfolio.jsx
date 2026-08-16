import { useRef, useState } from 'react';
import gsap from 'gsap';
import {
  X, PawPrint, Flag, Star, Clapperboard, Gamepad2, Trophy, Eye, Music4, Headphones,
  Disc3, MonitorPlay, Smartphone, Tv, CheckCircle2, MinusCircle, Circle, Swords, Sparkles,
  Route, GraduationCap, Users, Timer,
} from 'lucide-react';
import { STATUS_META } from './mockStalkData';

function PlatformIcon({ platform }) {
  if (platform === 'Mobile') return <Smartphone size={12} />;
  if (platform === 'PS5' || platform === 'Switch') return <Tv size={12} />;
  return <MonitorPlay size={12} />;
}

/* ─── Movie posters ─── */
export function MoviesSection({ movies, accent }) {
  return (
    <section className="sp-section sp-movies" style={{ '--sec-accent': accent }}>
      <div className="sp-section-head">
        <span className="sp-eyebrow"><Clapperboard size={13} /> FAVORITE MOVIES</span>
        <span className="sp-head-hint">{movies.length} reels</span>
      </div>
      <div className="sp-poster-grid">
        {movies.map((m) => (
          <div key={m.title} className="sp-poster" style={{ background: `linear-gradient(160deg, ${m.colors[0]} 0%, ${m.colors[1]} 100%)` }}>
            <div className="sp-poster-shine" />
            <div className="sp-poster-top">
              <span className="sp-poster-genre">{m.genre}</span>
              <span className="sp-poster-rating"><Star size={10} fill="currentColor" />{m.rating}</span>
            </div>
            <div className="sp-poster-bottom">
              <div className="sp-poster-title">{m.title}</div>
              <div className="sp-poster-year">{m.year}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Retro arcade game zone ─── */
export function GamingSection({ games, accent }) {
  const maxHours = Math.max(...games.map((g) => g.hours), 1);
  return (
    <section className="sp-section sp-gaming" style={{ '--sec-accent': accent }}>
      <div className="sp-section-head">
        <span className="sp-eyebrow"><Gamepad2 size={13} /> GAMING ZONE</span>
        <span className="sp-head-hint">INSERT COIN</span>
      </div>
      <div className="sp-arcade">
        <div className="sp-arcade-grid">
          {games.map((g) => (
            <div key={g.name} className="sp-game">
              <div className="sp-game-head">
                <span className="sp-game-name">{g.name}</span>
                <span className="sp-game-rank"><Trophy size={11} />{g.rank}</span>
              </div>
              <div className="sp-game-meta">
                <span className="sp-chip"><PlatformIcon platform={g.platform} />{g.platform}</span>
                <span className="sp-chip">{g.hours} hrs</span>
                <span className="sp-chip">{g.achievements}/{g.total} earned</span>
              </div>
              <div className="sp-game-bar">
                <span style={{ width: `${Math.round((g.hours / maxHours) * 100)}%`, background: accent }} />
              </div>
              <div className="sp-game-bar-label">time played</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Anime tracker ─── */
export function AnimeSection({ anime, accent }) {
  const statusIcon = (s) => {
    if (s === 'Completed') return <CheckCircle2 size={13} />;
    if (s === 'Watching') return <Circle size={13} />;
    return <MinusCircle size={13} />;
  };
  return (
    <section className="sp-section sp-anime" style={{ '--sec-accent': accent }}>
      <div className="sp-section-head">
        <span className="sp-eyebrow"><Eye size={13} /> ANIME TRACKER</span>
        <span className="sp-head-hint">{anime.length} titles</span>
      </div>
      <div className="sp-anime-list">
        {anime.map((a) => {
          const meta = STATUS_META[a.status] || STATUS_META['Plan to Watch'];
          const pct = a.total ? Math.round((a.episodes / a.total) * 100) : 0;
          return (
            <div key={a.title} className="sp-anime-row">
              <div className="sp-anime-main">
                <span className="sp-anime-title">{a.title}</span>
                <span className="sp-anime-studio">{a.studio}</span>
              </div>
              <span className="sp-anime-status" style={{ color: meta.color, background: `${meta.color}1a`, borderColor: `${meta.color}44` }}>
                {statusIcon(a.status)}{meta.label}
              </span>
              <div className="sp-anime-progress">
                <span style={{ width: `${pct}%`, background: accent }} />
              </div>
              <div className="sp-anime-meta">
                <span>{a.episodes}/{a.total} ep</span>
                {a.score > 0 && <span className="sp-anime-score"><Star size={10} fill="currentColor" />{a.score}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Music stop — spinning vinyl ─── */
export function MusicSection({ portfolio, accent }) {
  const { topTracks, topArtists } = portfolio;
  return (
    <section className="sp-section sp-music" style={{ '--sec-accent': accent }}>
      <div className="sp-section-head">
        <span className="sp-eyebrow"><Music4 size={13} /> MUSIC STOP</span>
        <span className="sp-head-hint"><Headphones size={12} /> on repeat</span>
      </div>
      <div className="sp-music-layout">
        <div className="vt-player">
          <div className="vt-disc">
            <div className="vt-disc-label" style={{ background: accent }} />
          </div>
          <div className="vt-arm">
            <span className="vt-arm-head" />
          </div>
        </div>
        <div className="vt-tracks">
          {topTracks.map((t, i) => (
            <div key={`${t.title}-${i}`} className="vt-track">
              <span className="vt-track-num">{i + 1}</span>
              <div className="vt-track-body">
                <span className="vt-track-title">{t.title}</span>
                <span className="vt-track-artist">{t.artist}</span>
              </div>
              <span className="vt-track-dur">{t.duration}</span>
            </div>
          ))}
          <div className="vt-artists">
            <span className="vt-artists-label">top artists</span>
            <div className="vt-artist-chips">
              {topArtists.map((a) => (
                <span key={a} className="vt-artist-chip" style={{ borderColor: `${accent}55`, color: accent }}>
                  <Disc3 size={10} />{a}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── This or That ─── */
function TotCard({ matchup, accent }) {
  const rootRef = useRef(null);
  const [choice, setChoice] = useState(null);

  const pick = (side) => {
    if (choice) return;
    setChoice(side);
    const el = rootRef.current?.querySelector(`[data-tot-opt="${side}"]`);
    if (el) {
      gsap.fromTo(el, { scale: 1 }, { scale: 1.06, duration: 0.22, yoyo: true, repeat: 1, ease: 'power1.inOut' });
    }
  };

  const bPct = 100 - matchup.aPct;

  return (
    <div className="tot-card" ref={rootRef} style={{ '--tot-accent': accent }}>
      <div className="tot-options">
        <button
          type="button"
          data-tot-opt="a"
          className={`tot-option${choice === 'a' ? ' chosen' : ''}`}
          onClick={() => pick('a')}
        >
          <span className="tot-option-big">{matchup.a}</span>
          <span className="tot-option-sub">pick side A</span>
        </button>
        <span className="tot-vs">VS</span>
        <button
          type="button"
          data-tot-opt="b"
          className={`tot-option${choice === 'b' ? ' chosen' : ''}`}
          onClick={() => pick('b')}
        >
          <span className="tot-option-big">{matchup.b}</span>
          <span className="tot-option-sub">pick side B</span>
        </button>
      </div>
      {choice ? (
        <div className="tot-result">
          <div className="tot-bar">
            <span className="tot-bar-a" style={{ width: `${matchup.aPct}%`, background: accent }} />
            <span className="tot-bar-b" style={{ width: `${bPct}%` }} />
          </div>
          <div className="tot-bar-labels">
            <span>{matchup.a} · {matchup.aPct}%</span>
            <span>{bPct}% · {matchup.b}</span>
          </div>
          <div className="tot-note">
            You sided with <strong>{choice === 'a' ? matchup.a : matchup.b}</strong> — that&apos;s the
            {choice === 'a' ? (matchup.aPct >= 50 ? ' majority' : ' minority') : (bPct >= 50 ? ' majority' : ' minority')} pick in the community.
          </div>
        </div>
      ) : (
        <div className="tot-hint">Tap a side to cast your vote</div>
      )}
    </div>
  );
}

function ThisOrThatSection({ matchups, accent }) {
  return (
    <section className="sp-section sp-thisorthat" style={{ '--sec-accent': accent }}>
      <div className="sp-section-head">
        <span className="sp-eyebrow"><Swords size={13} /> THIS OR THAT</span>
        <span className="sp-head-hint">pick your poison</span>
      </div>
      <div className="tot-grid">
        {matchups.map((m) => <TotCard key={m.id} matchup={m} accent={accent} />)}
      </div>
    </section>
  );
}

export { ThisOrThatSection };

/* ─── Root portfolio ─── */
export default function StalkPortfolio({ portfolio, onClose }) {
  const accent = portfolio.favoriteColor;
  const roleLabel = { admin: 'Admin', moderator: 'Moderator', faculty: 'Faculty', alumni: 'Alumni', cr: 'CR', sr: 'SR' }[portfolio.role] || 'Student';

  return (
    <div className="sp-portfolio" style={{ '--stalk-accent': accent }}>
      {/* top bar */}
      <header className="sp-topbar">
        <div className="sp-topbar-left">
          <span className="sp-avatar">
            {portfolio.avatar ? <img src={portfolio.avatar} alt="" /> : portfolio.initials}
          </span>
          <div className="sp-id">
            <div className="sp-id-name">{portfolio.name}</div>
            <div className="sp-id-meta">{roleLabel}{portfolio.department ? ` · ${portfolio.department}` : ''}{portfolio.semester ? ` · Sem ${portfolio.semester}` : ''}</div>
          </div>
        </div>
        <div className="sp-topbar-right">
          <span className="sp-done-chip"><Flag size={12} /> Journey complete</span>
          <button type="button" className="sp-close" onClick={onClose} aria-label="Close portfolio">
            <X size={18} />
          </button>
        </div>
      </header>

      {/* hero strip */}
      <div className="sp-hero" style={{ '--hero-accent': accent }}>
        <div className="sp-hero-text">
          <div className="sp-hero-eyebrow"><Sparkles size={12} /> ROAD TRIP COMPLETE</div>
          <h2 className="sp-hero-title">{portfolio.name}&apos;s <span>Vibe Universe</span></h2>
          <p className="sp-hero-sub">
            You drove {portfolio.miles} miles to reach {portfolio.name.split(' ')[0]}&apos;s corner of the community.
            Favorite color everywhere: <b style={{ color: accent }}>#{accent.slice(1).toUpperCase()}</b>.
          </p>
        </div>
        <div className="sp-stat-chips">
          <span className="sp-stat-chip"><PawPrint size={12} /> {portfolio.vibe}</span>
          <span className="sp-stat-chip"><Route size={12} /> {portfolio.miles} mi</span>
          <span className="sp-stat-chip"><GraduationCap size={12} /> {portfolio.department || 'Undeclared'}</span>
          <span className="sp-stat-chip"><Users size={12} /> {roleLabel}</span>
          <span className="sp-stat-chip"><Timer size={12} /> {portfolio.hobbies.length} passions</span>
        </div>
      </div>

      {/* sections */}
      <div className="sp-sections">
        <MoviesSection movies={portfolio.movies} accent={accent} />
        <GamingSection games={portfolio.games} accent={accent} />
        <AnimeSection anime={portfolio.anime} accent={accent} />
        <MusicSection portfolio={portfolio} accent={accent} />
        <ThisOrThatSection matchups={portfolio.matchups} accent={accent} />
      </div>

      <footer className="sp-footer">
        <button type="button" className="sp-stalk-again" onClick={onClose}>
          <PawPrint size={15} /> Done stalking
        </button>
      </footer>
    </div>
  );
}