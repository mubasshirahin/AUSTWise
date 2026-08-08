import { useState } from 'react';
import {
  Calendar, Sparkles, Gamepad2,
} from 'lucide-react';
import './GamingZone.css';
import './ChillMasthead.css';

/* ══════════════════════════════════════════════════════════════════
   WATCH PARTY / GAME NIGHT EVENTS
   ══════════════════════════════════════════════════════════════════ */

const EVENTS = [
  { title: 'Valorant Custom Room', game: 'Valorant', time: 'Tonight 10 PM', joined: 3, max: 5, icon: '🔫', color: '#FF6B6B' },
  { title: 'AOT Watch Party S4', anime: 'Attack on Titan', time: 'Tomorrow 8 PM', joined: 5, max: 8, icon: '📺', color: '#5865F2' },
  { title: 'FIFA 24 Tournament', game: 'FIFA 24', time: 'Sat 9 PM', joined: 7, max: 16, icon: '⚽', color: '#00d4aa' },
  { title: 'CS2 Late Night Squad', game: 'CS2', time: '11:30 PM', joined: 2, max: 5, icon: '🎯', color: '#ffc107' },
];

/* ══════════════════════════════════════════════════════════════════
   COMPONENTS
   ══════════════════════════════════════════════════════════════════ */

/* ── Section Title ── */
function SectionTitle({ icon: Icon, children }) {
  return <div className="gz-section-title">{Icon && <Icon size={16} />}{children}</div>;
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

/* ══════════════════════════════════════════════════════════════════
   MAIN GAMING ZONE
   ══════════════════════════════════════════════════════════════════ */

export default function GamingZone() {
  return (
    <div className="gz cz-mst">
      {/* ── Masthead (matches Mess Meal Tracker header) ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <Gamepad2 size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">DownTime</span>
            <p className="schedule-title">Gaming Zone</p>
            <span className="schedule-subtitle">Mini games &amp; game nights</span>
          </div>
        </div>

        <div className="schedule-masthead-center" />
      </div>

      <div className="schedule-dotted-divider" />

      {/* ═══ Watch Parties / Game Nights ═══ */}
      <div className="gz-events-section">
        <SectionTitle icon={Calendar}>Watch Party &amp; Game Night Planner</SectionTitle>
        <div className="gz-events-grid">
          {EVENTS.map((e, i) => <EventCard key={i} event={e} />)}
        </div>
      </div>

      {/* ═══ AI Recommender ═══ */}
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
