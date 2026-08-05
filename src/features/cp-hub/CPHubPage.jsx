import { Code2, ExternalLink, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './CPHubPage.css';
import '../../components/PageHero.css';

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
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <Code2 size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Productivity</span>
            <div className="schedule-title">Code Pulse</div>
            <span className="schedule-subtitle">Your competitive programming launchpad — jump into contests, track progress, and level up.</span>
          </div>
        </div>
        <div className="schedule-masthead-center" />
      </div>

      <div className="schedule-dotted-divider" style={{ marginTop: 0 }} />

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
