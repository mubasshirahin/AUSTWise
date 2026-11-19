import { Code2, ExternalLink, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './CPHubPage.css';
import '../../components/PageHero.css';
import '../daily-life/DailyMasthead.css';

// Platform identity is carried by name/logo, not color — the dot uses the
// brand accent so the grid reads as one system.
const PLATFORMS = [
  { name: 'Codeforces', url: 'https://codeforces.com', desc: 'Contests & problem solving' },
  { name: 'LeetCode', url: 'https://leetcode.com', desc: 'Interview prep & DSA' },
  { name: 'AtCoder', url: 'https://atcoder.jp', desc: 'Japanese contest platform' },
  { name: 'CodeChef', url: 'https://codechef.com', desc: 'Monthly challenges' },
  { name: 'HackerRank', url: 'https://hackerrank.com', desc: 'Skill-based challenges' },
  { name: 'CSES', url: 'https://cses.fi', desc: 'Problem set collection' },
  { name: 'VJudge', url: 'https://vjudge.net', desc: 'Virtual contest judge' },
  { name: 'StopStalk', url: 'https://stopstalk.com', desc: 'Track CP progress' },
];

export default function CPHubPage() {
  const navigate = useNavigate();

  return (
    <div className="cp-hub-page animate-fadeIn">
      {/* ── Masthead ── */}
      <header className="dl-head pr-head">
        <div className="dl-head-title">
          <div className="dl-head-tile" aria-hidden="true"><Code2 size={20} strokeWidth={2.1} /></div>
          <div className="dl-head-text">
            <span className="dl-head-overline">Productivity</span>
            <h2 className="dl-head-name">Code Pulse</h2>
            <span className="dl-head-subtitle">Your competitive programming launchpad.</span>
          </div>
        </div>
        <dl className="dl-head-stats">
          <div className="dl-head-stat"><dt>Platforms</dt><dd>{PLATFORMS.length}</dd></div>
        </dl>
      </header>

      {/* ── Platform Cards ── */}
      <div className="cp-grid">
        {PLATFORMS.map((platform) => (
          <a
            key={platform.name}
            href={platform.url}
            target="_blank"
            rel="noopener noreferrer"
            className="cp-platform-card"
            style={{ '--plat-color': 'var(--accent-amber)' }}
          >
            <div className="cp-platform-top">
              <div className="cp-platform-dot" style={{ background: 'var(--accent-amber)' }} />
              <h3 className="cp-platform-name">{platform.name}</h3>
              <ExternalLink size={14} className="cp-platform-ext" />
            </div>
            <p className="cp-platform-desc">{platform.desc}</p>
          </a>
        ))}
      </div>

      {/* ─── Study Room CTA ── */}
      <div className="cp-cta-card">
        <div className="cp-cta-icon">
          <Code2 size={22} />
        </div>
        <div>
          <h3>Ready to focus?</h3>
          <p>Head to the Study Room for a distraction-free coding session with a Pomodoro timer.</p>
        </div>
        <button className="cp-cta-btn" onClick={() => navigate('/study-room')}>
          <span>Open Study Room</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
