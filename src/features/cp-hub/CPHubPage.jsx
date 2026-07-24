import { Code2, ExternalLink, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './CPHubPage.css';
import '../../components/PageHero.css';

const PLATFORMS = [
  { name: 'Codeforces', url: 'https://codeforces.com', color: '#1f8acb', desc: 'Contests & problem solving' },
  { name: 'LeetCode', url: 'https://leetcode.com', color: '#ffa116', desc: 'Interview prep & DSA' },
  { name: 'AtCoder', url: 'https://atcoder.jp', color: '#5a5a5a', desc: 'Japanese contest platform' },
  { name: 'CodeChef', url: 'https://codechef.com', color: '#5b4636', desc: 'Monthly challenges' },
  { name: 'HackerRank', url: 'https://hackerrank.com', color: '#00ea64', desc: 'Skill-based challenges' },
  { name: 'CSES', url: 'https://cses.fi', color: '#9b59b6', desc: 'Problem set collection' },
  { name: 'VJudge', url: 'https://vjudge.net', color: '#e74c3c', desc: 'Virtual contest judge' },
  { name: 'StopStalk', url: 'https://stopstalk.com', color: '#3498db', desc: 'Track CP progress' },
];

export default function CPHubPage() {
  const navigate = useNavigate();

  return (
    <div className="cp-hub-page animate-fadeIn">
      {/* ── Hero ── */}
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <Code2 size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">Code Pulse</span>
              </h1>
              <p className="page-hero-subtitle">
                Your competitive programming launchpad — jump into contests, track progress, and level up.
              </p>
            </div>
          </div>
        </div>
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
            style={{ '--plat-color': platform.color }}
          >
            <div className="cp-platform-top">
              <div className="cp-platform-dot" style={{ background: platform.color }} />
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
