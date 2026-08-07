import { useNavigate } from 'react-router-dom';
import logoSilver from '../assets/logo-silver.png';
import './InfoPage.css';

export default function ChangelogPage() {
  const navigate = useNavigate();
  return (
    <div className="info-page">
      <header className="info-page-header">
        <a href="/" className="info-page-logo" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
          <img src={logoSilver} alt="" />
          <span>AUSTWise</span>
        </a>
        <button className="info-page-back" onClick={() => navigate('/')}>← Back to Home</button>
      </header>
      <div className="info-page-body">
        <h1>Changelog</h1>
        <p className="info-page-subtitle">Every update, feature, and fix — tracked here.</p>

        <h2>v2.0 — January 2025</h2>
        <ul>
          <li>Complete UI redesign with 12 new themes</li>
          <li>Campus Hub with interactive floor maps and room finder</li>
          <li>Grade Lab enhancements — department comparison charts</li>
          <li>Resource Vault topic heatmaps for exam preparation</li>
          <li>Real-time messaging with course-specific chat rooms</li>
          <li>Marketplace with To-Let listings and Lost & Found</li>
          <li>Student and alumni directories with search</li>
          <li>Smart push notifications for deadlines and classes</li>
        </ul>

        <hr />

        <h2>v1.3 — October 2024</h2>
        <ul>
          <li>Added canteen menu and crowd index</li>
          <li>Library seat occupancy tracker</li>
          <li>Improved CGPA visualisation with semester breakdown</li>
          <li>Performance optimisations and bug fixes</li>
        </ul>

        <hr />

        <h2>v1.2 — July 2024</h2>
        <ul>
          <li>Anonymous confession feed</li>
          <li>Faculty office hours and status</li>
          <li>Dark mode refinements</li>
        </ul>

        <hr />

        <h2>v1.1 — April 2024</h2>
        <ul>
          <li>Guest login support</li>
          <li>Course-specific resource organisation</li>
          <li>Notification preferences</li>
        </ul>

        <hr />

        <h2>v1.0 — January 2024</h2>
        <ul>
          <li>Initial launch of AUSTWise</li>
          <li>Dashboard with CGPA Calculator</li>
          <li>Resource Vault with 500+ past papers</li>
          <li>Basic community features</li>
        </ul>
      </div>
      <div className="info-page-footer">&copy; {new Date().getFullYear()} AUSTWise. All rights reserved.</div>
    </div>
  );
}
