import { Brain, Trophy, Clock, BookOpen, Sparkles } from 'lucide-react';
import '../ChillZonePage.css';

export default function Trivia() {
  return (
    <div className="cz-tab-page">
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
  );
}
