import { useState, useMemo } from 'react';
import {
  Gamepad2, Users, Star, Sparkles, Trophy, ChevronRight,
  Monitor, Headphones, Music, Tv, Clock, Plus, UserPlus,
  Search, Sword, Crosshair, Joystick, Dice5, Calendar,
  MessageCircle, ExternalLink, Crown, Swords,
} from 'lucide-react';
import './GamingZone.css';

/* ══════════════════════════════════════════════════════════════════
   MOCK DATA
   ══════════════════════════════════════════════════════════════════ */

const STEAM_PROFILE = {
  username: 'NexusRogue',
  level: 42,
  avatar: 'NR',
  gamesOwned: 187,
  totalHours: 1428,
  achievements: 356,
  status: 'In-Game',
  currentGame: 'Counter-Strike 2',
  sessionHours: 2.4,
  topGames: [
    { name: 'Counter-Strike 2', hours: 412, icon: '🎯' },
    { name: 'Elden Ring', hours: 286, icon: '⚔️' },
    { name: 'Valorant', hours: 198, icon: '🔫' },
  ],
};

const DISCORD_FRIENDS = [
  { name: 'Fahim Rahman', status: 'Playing Valorant', elapsed: '1h 20m', icon: 'FR', color: '#5865F2', type: 'game' },
  { name: 'Nusrat Jahan', status: 'Listening to Spotify — "Blinding Lights"', elapsed: '12m', icon: 'NJ', color: '#1DB954', type: 'music' },
  { name: 'Sakib Al Hasan', status: 'Watching Attack on Titan on Crunchyroll', elapsed: '32m', icon: 'SA', color: '#FF6B6B', type: 'watching' },
  { name: 'Tasnim Ahmed', status: 'Idle — AFK', elapsed: '45m', icon: 'TA', color: '#808080', type: 'idle' },
  { name: 'Ariful Islam', status: 'Playing FIFA 24', elapsed: '2h 15m', icon: 'AI', color: '#00d4aa', type: 'game' },
];

const STUDENTS = [
  { name: 'Fahim Rahman', tag: 'fahim_r', bio: 'Valorant addict • CS grad', steam: 'FahimX', favAnime: 'AOT', favGame: 'Valorant', status: 'playing', activity: 'Playing Valorant • Rank: Diamond 2', badges: ['🔫 FPS King', '🌙 Night Owl'], avatar: 'FR', color: '#5865F2' },
  { name: 'Nusrat Jahan', tag: 'nusrat_j', bio: 'Genshin enjoyer • Anime lover', steam: 'NusJ', favAnime: 'Demon Slayer', favGame: 'Genshin Impact', status: 'watching', activity: 'Watching Jujutsu Kaisen S2', badges: ['⛩️ Otaku', '⭐ Casual'], avatar: 'NJ', color: '#FF6B6B' },
  { name: 'Sakib Al Hasan', tag: 'sakib_ah', bio: 'FIFA street legend  • EEE batch 50', steam: 'Sakib99', favAnime: 'One Piece', favGame: 'FIFA 24', status: 'playing', activity: 'Playing FIFA 24 • Ultimate Team', badges: ['⚽ GOAT', '🎮 Tryhard'], avatar: 'SA', color: '#00d4aa' },
  { name: 'Tasnim Ahmed', tag: 'tasnim_a', bio: 'Elden Ring no-hit runner', steam: 'Tasnim7', favAnime: 'Vinland Saga', favGame: 'Elden Ring', status: 'idle', activity: 'AFK — Grabbing Coffee', badges: ['👑 Souls Veteran', '🏆 Achievement Hunter'], avatar: 'TA', color: '#ffc107' },
  { name: 'Ariful Islam', tag: 'arif_i', bio: 'Dota 2 veteran • Party player', steam: 'ArifDota', favAnime: 'Naruto', favGame: 'Dota 2', status: 'playing', activity: 'Playing Dota 2 • Rank: Ancient 4', badges: ['🛡️ Support Main', '🎯 Tryhard'], avatar: 'AI', color: '#0d6efd' },
  { name: 'Maisha Tabassum', tag: 'maisha_t', bio: 'Stardew Valley farmer  • ARCH', steam: 'MaishaT', favAnime: 'Spy x Family', favGame: 'Stardew Valley', status: 'offline', activity: 'Offline • Last seen 2h ago', badges: ['🌾 Chill', '⭐ Casual'], avatar: 'MT', color: '#adb5bd' },
];

const EVENTS = [
  { title: 'Valorant Custom Room', game: 'Valorant', time: 'Tonight 10 PM', joined: 3, max: 5, icon: '🔫', color: '#FF6B6B' },
  { title: 'AOT Watch Party S4', anime: 'Attack on Titan', time: 'Tomorrow 8 PM', joined: 5, max: 8, icon: '📺', color: '#5865F2' },
  { title: 'FIFA 24 Tournament', game: 'FIFA 24', time: 'Sat 9 PM', joined: 7, max: 16, icon: '⚽', color: '#00d4aa' },
  { title: 'CS2 Late Night Squad', game: 'CS2', time: '11:30 PM', joined: 2, max: 5, icon: '🎯', color: '#ffc107' },
];

const LEADERBOARD = [
  { name: 'Sakib Al Hasan', hours: 48, badge: '🔥 Grinder', rank: 1, avatar: 'SA', color: '#00d4aa' },
  { name: 'Fahim Rahman', hours: 42, badge: 'Night Owl', rank: 2, avatar: 'FR', color: '#5865F2' },
  { name: 'Nusrat Jahan', hours: 36, badge: 'Otaku Master', rank: 3, avatar: 'NJ', color: '#FF6B6B' },
  { name: 'Ariful Islam', hours: 31, badge: 'Support Main', rank: 4, avatar: 'AI', color: '#0d6efd' },
  { name: 'Tasnim Ahmed', hours: 27, badge: 'Souls Veteran', rank: 5, avatar: 'TA', color: '#ffc107' },
  { name: 'Maisha Tabassum', hours: 18, badge: 'Casual Gamer', rank: 6, avatar: 'MT', color: '#adb5bd' },
];

const GAMES_LIST = ['Valorant', 'FIFA 24', 'CS2', 'Dota 2', 'Elden Ring', 'Genshin Impact', 'Stardew Valley'];

/* ══════════════════════════════════════════════════════════════════
   COMPONENTS
   ══════════════════════════════════════════════════════════════════ */

/* ── Live Dot ── */
function LiveDot() { return <span className="gz-live-dot" />; }

/* ── Section Title ── */
function SectionTitle({ icon: Icon, children }) {
  return <div className="gz-section-title">{Icon && <Icon size={16} />}{children}</div>;
}

/* ── Steam Profile Card ── */
function SteamProfileCard() {
  const p = STEAM_PROFILE;
  return (
    <div className="gz-steam-card">
      <div className="gz-steam-header">
        <div className="gz-steam-avatar">{p.avatar}</div>
        <div className="gz-steam-name">
          <span className="gz-steam-username">{p.username}</span>
          <span className="gz-steam-tag">Level {p.level} • {p.gamesOwned} games</span>
        </div>
        <div className="gz-steam-status">
          <LiveDot /> {p.currentGame}
        </div>
      </div>

      <div className="gz-steam-stats">
        <div className="gz-steam-stat">
          <div className="gz-steam-stat-value">{p.gamesOwned}</div>
          <div className="gz-steam-stat-label">Games</div>
        </div>
        <div className="gz-steam-stat">
          <div className="gz-steam-stat-value">{p.totalHours}h</div>
          <div className="gz-steam-stat-label">Played</div>
        </div>
        <div className="gz-steam-stat">
          <div className="gz-steam-stat-value">{p.achievements}</div>
          <div className="gz-steam-stat-label">Achievements</div>
        </div>
      </div>

      <div className="gz-top-games">
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Top Games</span>
        {p.topGames.map((g, i) => (
          <div key={g.name} className="gz-top-game">
            <span className="gz-top-game-rank">#{i + 1}</span>
            <span className="gz-top-game-icon">{g.icon}</span>
            <span className="gz-top-game-name">{g.name}</span>
            <span className="gz-top-game-hours">{g.hours}h</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Discord Rich Presence Card ── */
function DiscordRPCard() {
  return (
    <div className="gz-discord-card">
      <div className="gz-discord-header">
        <div className="gz-discord-icon"><MessageCircle size={18} /></div>
        <span className="gz-discord-title">Discord Rich Presence</span>
        <div className="gz-discord-status"><LiveDot /> 5 Online</div>
      </div>

      <div className="gz-rp-list">
        {DISCORD_FRIENDS.map((f) => (
          <div key={f.name} className="gz-rp-item">
            <div className="gz-rp-avatar" style={{ background: f.color }}>
              {f.icon}
              <span className="gz-rp-online"
                style={{ background: f.type === 'idle' ? '#ffc107' : f.type === 'offline' ? '#808080' : '#00d4aa' }}
              />
            </div>
            <div className="gz-rp-info">
              <span className="gz-rp-name">{f.name}</span>
              <span className="gz-rp-activity">
                {f.type === 'music' ? <><Music size={10} style={{ display: 'inline', marginRight: 2 }} />{f.status}</>
                : f.type === 'watching' ? <><Tv size={10} style={{ display: 'inline', marginRight: 2 }} />{f.status}</>
                : f.status}
              </span>
            </div>
            <span className="gz-rp-elapsed">{f.elapsed}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Student Gaming Card ── */
function StudentCard({ student, isPreview }) {
  const [joined, setJoined] = useState(false);

  if (isPreview) {
    return (
      <div className="gz-hover-reveal">
        <div className="gz-hover-header">
          <div className="gz-hover-avatar" style={{ background: student.color }}>{student.avatar}</div>
          <div className="gz-hover-info">
            <div className="gz-hover-name">{student.name}</div>
            <div className="gz-hover-bio">{student.bio}</div>
          </div>
        </div>
        <div className="gz-hover-detail"><span className="gz-hover-detail-label">Steam</span><span className="gz-hover-detail-value">{student.steam}</span></div>
        <div className="gz-hover-detail"><span className="gz-hover-detail-label">Fav Anime</span><span className="gz-hover-detail-value">{student.favAnime}</span></div>
        <div className="gz-hover-detail"><span className="gz-hover-detail-label">Fav Game</span><span className="gz-hover-detail-value">{student.favGame}</span></div>
      </div>
    );
  }

  return (
    <div className="gz-student-card">
      <StudentCard student={student} isPreview />
      <div className="gz-student-card-inner">
        <div className="gz-student-top">
          <div className="gz-student-avatar" style={{ background: student.color }}>{student.avatar}</div>
          <div className="gz-student-meta">
            <div className="gz-student-name">{student.name}</div>
            <div className="gz-student-tag">@{student.tag}</div>
          </div>
          <span className={`gz-student-status ${student.status}`}>
            {student.status === 'playing' ? '▶ Playing' : student.status === 'watching' ? '▶ Watching' : student.status === 'idle' ? '○ Idle' : '○ Offline'}
          </span>
        </div>
        <div className="gz-student-activity">{student.activity}</div>
        <div className="gz-student-badges">
          {student.badges.map((b) => <span key={b} className="gz-student-badge">{b}</span>)}
        </div>
        <button className="gz-join-btn" onClick={() => setJoined(!joined)}>
          <UserPlus size={12} />
          {joined ? 'Requested ✓' : 'Join Party / Spectate'}
        </button>
      </div>
    </div>
  );
}

/* ── Watch Party Event Card ── */
function EventCard({ event }) {
  const [joined, setJoined] = useState(false);
  const pct = Math.round((event.joined / event.max) * 100);
  return (
    <div className="gz-event-card">
      <div className="gz-event-top">
        <div className="gz-event-icon" style={{ background: `${event.color}15`, color: event.color }}>{event.icon}</div>
        <div className="gz-event-title">{event.title}</div>
        <button className="gz-event-join-btn" onClick={() => setJoined(!joined)}>
          {joined ? 'Joined ✓' : 'Join'}
        </button>
      </div>
      <div className="gz-event-join-bar">
        <Calendar size={11} style={{ color: 'var(--text-tertiary)' }} />
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{event.time}</span>
      </div>
      <div className="gz-event-join-bar">
        <div className="gz-event-progress">
          <div className="gz-event-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="gz-event-join-count">{event.joined + (joined ? 1 : 0)}/{event.max}</span>
      </div>
    </div>
  );
}

/* ── Matchmaker ── */
function Matchmaker() {
  const [selectedGame, setSelectedGame] = useState('');
  const [matched, setMatched] = useState([]);
  const [searched, setSearched] = useState(false);

  const handleMatch = () => {
    if (!selectedGame) return;
    const shuffled = [...STUDENTS].sort(() => Math.random() - 0.5).slice(0, 4);
    setMatched(shuffled.map((s) => ({ ...s, matchedGame: selectedGame })));
    setSearched(true);
  };

  return (
    <div className="gz-matchmaker-section">
      <SectionTitle icon={Crosshair}>Teammate Finder</SectionTitle>
      <div className="gz-matchmaker-row">
        <select className="gz-game-select" value={selectedGame} onChange={(e) => setSelectedGame(e.target.value)}>
          <option value="">Select a game...</option>
          {GAMES_LIST.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <button className="gz-match-btn" onClick={handleMatch} disabled={!selectedGame}>
          <Search size={14} /> Find Teammates
        </button>
      </div>
      {searched && matched.length === 0 && (
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', padding: 'var(--sp-3)' }}>
          No players found for {selectedGame}. Try another game!
        </div>
      )}
      {matched.length > 0 && (
        <div className="gz-match-results">
          {matched.map((s) => (
            <div key={s.name} className="gz-match-card">
              <div className="gz-match-avatar" style={{ background: s.color }}>{s.avatar}</div>
              <div className="gz-match-info">
                <div className="gz-match-name">{s.name}</div>
                <div className="gz-match-game">Plays {s.matchedGame}</div>
              </div>
              <button className="gz-match-add-btn" title="Add as teammate"><Plus size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Weekly Leaderboard ── */
function WeeklyLeaderboard() {
  const rankIcons = ['🥇', '🥈', '🥉'];
  return (
    <div className="gz-leaderboard-section">
      <SectionTitle icon={Trophy}>Grinder of the Week</SectionTitle>
      <div className="gz-leaderboard">
        <div className="gz-lb-header">
          <span>#</span>
          <span>Player</span>
          <span style={{ textAlign: 'right' }}>Hours</span>
          <span style={{ textAlign: 'center' }}>Badge</span>
        </div>
        {LEADERBOARD.map((p) => (
          <div key={p.name} className={`gz-lb-row ${p.rank === 1 ? 'top1' : p.rank === 2 ? 'top2' : p.rank === 3 ? 'top3' : ''}`}>
            <span className={`gz-lb-rank ${p.rank === 1 ? 'gold' : p.rank === 2 ? 'silver' : p.rank === 3 ? 'bronze' : ''}`}>
              {p.rank <= 3 ? rankIcons[p.rank - 1] : `#${p.rank}`}
            </span>
            <div className="gz-lb-player">
              <div className="gz-lb-avatar" style={{ background: p.color }}>{p.avatar}</div>
              <span className="gz-lb-player-name">{p.name}</span>
            </div>
            <span className="gz-lb-hours">{p.hours}h</span>
            <span className="gz-lb-badge">{p.badge}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN GAMING ZONE
   ══════════════════════════════════════════════════════════════════ */

export default function GamingZone() {
  return (
    <div className="gz">
      {/* ═══ 1. Gaming Deck ═══ */}
      <SectionTitle icon={Joystick}>Gaming Deck</SectionTitle>
      <div className="gz-deck-grid">
        <SteamProfileCard />
        <DiscordRPCard />
      </div>

      {/* ═══ 2. Student Lounge ═══ */}
      <div className="gz-lounge-section">
        <div className="gz-lounge-header">
          <SectionTitle icon={Users}>Student Gaming Lounge</SectionTitle>
          <div className="gz-lounge-actions">
            <div className="gz-lounge-filter">
              {['All', 'Online', 'In-Game', 'Watching'].map((f) => (
                <button key={f} className="gz-lounge-filter-btn active">{f}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="gz-student-grid">
          {STUDENTS.map((s) => <StudentCard key={s.name} student={s} />)}
        </div>
      </div>

      {/* ═══ 3. Watch Parties / Game Nights ═══ */}
      <div className="gz-events-section">
        <SectionTitle icon={Calendar}>Watch Party &amp; Game Night Planner</SectionTitle>
        <div className="gz-events-grid">
          {EVENTS.map((e, i) => <EventCard key={i} event={e} />)}
        </div>
      </div>

      {/* ═══ 4. Matchmaker ═══ */}
      <Matchmaker />

      {/* ═══ 5. Weekly Leaderboard ═══ */}
      <WeeklyLeaderboard />

      {/* ═══ 6. AI Recommender (Bonus) ═══ */}
      <div className="gz-events-section">
        <SectionTitle icon={Sparkles}>What to Watch Next?</SectionTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', flex: 1, margin: 0, lineHeight: 1.6 }}>
            Based on what other AUSTians are binge-watching — <strong>Jujutsu Kaisen S2</strong>, <strong>One Piece Live Action</strong>, and <strong>Blue Lock</strong> are trending this week!
          </p>
          <button className="gz-match-btn" style={{ background: 'linear-gradient(135deg, #FF6B6B, #5865F2)' }}>
            <Sparkles size={14} /> Get Recommendations
          </button>
        </div>
      </div>
    </div>
  );
}
