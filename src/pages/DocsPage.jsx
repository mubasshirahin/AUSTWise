import { useNavigate } from 'react-router-dom';
import logoSilver from '../assets/logo-silver.png';
import './InfoPage.css';

export default function DocsPage() {
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
        <h1>Documentation</h1>
        <p className="info-page-subtitle">Everything you need to know about using AUSTWise.</p>

        <h2>Getting Started</h2>
        <p>AUSTWise is your all-in-one academic assistant. Create an account using your AUST credentials, then explore the dashboard for a personalised overview of your academic life.</p>

        <h3>Dashboard</h3>
        <p>Your command centre — CGPA snapshot, today's schedule, pending deadlines, and quick-access to all features.</p>

        <h3>Grade Lab</h3>
        <p>Track your CGPA across semesters, compare with department averages, and review course-by-course performance with interactive charts.</p>

        <h3>Resource Vault</h3>
        <p>Browse 1,200+ past question papers organised by department, semester, and course. Topic heatmaps show which topics appear most frequently in exams.</p>

        <h3>Campus Hub</h3>
        <p>Interactive floor maps, faculty office locations, library seat availability, and canteen crowd index — all in real time.</p>

        <h3>Community</h3>
        <p>Connect with classmates through the Buzz forum, student directory, alumni network, and course-specific groups.</p>

        <h3>Marketplace</h3>
        <p>Buy and sell used textbooks, find bachelor rentals near campus, report lost items, and request mentorship from seniors.</p>

        <h2>Need Help?</h2>
        <p>Reach out via the <a href="/feedback">Feedback</a> form or contact <a href="mailto:support@austwise.com">support@austwise.com</a>.</p>
      </div>
      <div className="info-page-footer">&copy; {new Date().getFullYear()} AUSTWise. All rights reserved.</div>
    </div>
  );
}
