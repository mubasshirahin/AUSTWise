import { useNavigate } from 'react-router-dom';
import './InfoPage.css';
import LandingNav from '../features/landing/LandingNav';

export default function DocsPage() {
  const navigate = useNavigate();
  return (
    <div className="info-page has-landing-nav">
      <LandingNav />
      <div className="info-page-body">
        <div className="info-page-title-block">
          <div className="info-page-title-row">
            <h1>Documentation</h1>
            <button className="info-page-back" onClick={() => navigate('/')}>← Back to Home</button>
          </div>
          <p className="info-page-subtitle">Everything you need to know about using AUSTWise.</p>
        </div>

        <h2>Getting Started</h2>
        <p>AUSTWise is your all-in-one academic assistant. Create an account using your AUST credentials, then explore the dashboard for a personalised overview of your academic life.</p>

        <h3>Dashboard</h3>
        <p>Your command centre — CGPA snapshot, today's schedule, pending deadlines, attendance, and quick-access to all features. Widgets surface your exam tracker and routine at a glance.</p>

        <h3>Daily Life</h3>
        <p>Campus tools beyond the classroom — track meals and split mess costs with the Mess Meal Tracker, or estimate fares for rickshaw, bus, metro, and CNG trips around Dhaka with BharaKoto.</p>

        <h3>Grade Lab</h3>
        <p>Track your CGPA across semesters, compare with department averages, review courses, follow prerequisite trees, and monitor syllabus completion with interactive charts.</p>

        <h3>InsideAUST</h3>
        <p>Interactive floor plans, classroom and building finders, faculty office status, library seat occupancy, canteen menus with crowd levels, and real-time bus schedules — all in one map.</p>

        <h3>Resource Vault</h3>
        <p>Browse 1,200+ past question papers organised by department, semester, and course. Topic heatmaps show which topics appear most frequently in exams, with playlists, cheatsheets, and materials alongside.</p>

        <h3>Notebook</h3>
        <p>Keep your own study notes in a searchable library. Capture, tag, and reorganise notes per course so revision is always one click away.</p>

        <h3>Community</h3>
        <p>Connect with classmates through anonymous confession feeds, student directory, alumni network, club hub, and mentor requests.</p>

        <h3>ConnectBox</h3>
        <p>Real-time messaging for your courses, lab groups, and faculty — with file sharing, reactions, and read receipts. Your whole academic conversation in one place.</p>

        <h3>Productivity & Study</h3>
        <p>Pomodoro sessions, a study room with ambient sounds, and Zen mode for focused deep work. Use the Exam Checklist to plan exam season, the CP Hub for competitive programming, and Money Tracker to manage your budget.</p>

        <h3>Marketplace</h3>
        <p>Buy and sell used textbooks, find bachelor rentals near campus, report lost items, and request mentorship from seniors — free, with no commissions.</p>

        <h3>DownTime & Shadow</h3>
        <p>Recharge with media trackers, gaming, and trivia in DownTime. In Shadow, post anonymously to the AUST forum or chat with a stranger for 10 minutes — completely anonymous.</p>

        <h3>Workspace</h3>
        <p>Connect your Google Classroom account to track courses, assignments, and materials in a single organised grid.</p>

        <h2>Need Help?</h2>
        <p>Reach out via the <a href="/feedback">Feedback</a> form or contact <a href="mailto:support@austwise.com">support@austwise.com</a>.</p>
      </div>
      <div className="info-page-footer">&copy; {new Date().getFullYear()} AUSTWise. All rights reserved.</div>
    </div>
  );
}
