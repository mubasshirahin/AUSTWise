import { Brain, Trophy, Clock, BookOpen, Sparkles } from 'lucide-react';
import '../ChillZonePage.css';
import './ChillMasthead.css';

export default function Trivia() {
  return (
    <div className="cz-tab-page oz-tab">
      <div className="cz-mst">
        {/* ── Masthead (matches Mess Meal Tracker header) ── */}
        <div className="schedule-masthead">
          <div className="schedule-title-block">
            <div className="schedule-icon-tile">
              <Brain size={20} strokeWidth={2.2} />
            </div>
            <div>
              <span className="schedule-overline">DownTime</span>
              <p className="schedule-title">Trivia</p>
              <span className="schedule-subtitle">Test your brain</span>
            </div>
          </div>

          <div className="schedule-masthead-center" />
        </div>

        <div className="schedule-dotted-divider" />

        <div className="cz-coming-card">
          <div className="cz-coming-icon" style={{ background: 'var(--accent-purple-glow)', color: 'var(--accent-purple)' }}>
            <Brain size={32} strokeWidth={1.5} />
          </div>
          <h2>Trivia</h2>
          <p>
            Quick-fire quizzes on AUST history, CSE concepts, general knowledge, and more.
            Compete on the leaderboard and prove you're the campus brainiac.
          </p>
          <div className="cz-feature-pills" style={{ '--pill-color': 'var(--accent-purple)' }}>
            <span><Trophy size={13} /> Leaderboard</span>
            <span><Clock size={13} /> Timed Rounds</span>
            <span><BookOpen size={13} /> CSE &amp; General</span>
            <span><Sparkles size={13} /> Coming Soon</span>
          </div>
        </div>
      </div>
    </div>
  );
}
