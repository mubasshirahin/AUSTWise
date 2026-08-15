import { useNavigate } from 'react-router-dom';
import './InfoPage.css';
import LandingNav from '../features/landing/LandingNav';

export default function ChangelogPage() {
  const navigate = useNavigate();
  return (
    <div className="info-page has-landing-nav">
      <LandingNav />
      <div className="info-page-body">
        <div className="info-page-title-block">
          <div className="info-page-title-row">
            <h1>Changelog</h1>
            <button className="info-page-back" onClick={() => navigate('/')}>← Back to Home</button>
          </div>
          <p className="info-page-subtitle">Every update, feature, and fix — tracked here.</p>
        </div>

        <h2>v3.0 — August 2026</h2>
        <ul>
          <li>Daily Life — Mess Meal Tracker with cost splitting and BharaKoto fare estimates</li>
          <li>Productivity — Pomodoro sessions, study room with ambient sounds, and Zen mode</li>
          <li>DownTime — media trackers, gaming zone, and trivia</li>
          <li>Shadow — anonymous AUST forum posts and 10-minute anonymous chats</li>
          <li>Workspace — Google Classroom integration for courses, assignments, and materials</li>
          <li>Money Tracker — expense logging, budget goals, and monthly summaries</li>
          <li>CP Hub, Money Tracker, and Cover Page Generator</li>
          <li>Notebook — personal, searchable study notes library</li>
          <li>ConnectBox — reactions, read receipts, and richer course/lab messaging</li>
        </ul>

        <hr />

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
