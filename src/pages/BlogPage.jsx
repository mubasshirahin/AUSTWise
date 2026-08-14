import { useNavigate } from 'react-router-dom';
import './InfoPage.css';
import LandingNav from '../features/landing/LandingNav';

export default function BlogPage() {
  const navigate = useNavigate();
  return (
    <div className="info-page has-landing-nav">
      <LandingNav />
      <div className="info-page-body">
        <div className="info-page-title-block">
          <div className="info-page-title-row">
            <h1>Blog</h1>
            <button className="info-page-back" onClick={() => navigate('/')}>← Back to Home</button>
          </div>
          <p className="info-page-subtitle">Updates, tips, and stories from the AUSTWise team.</p>
        </div>

        <h2>Campus Life, Fully Covered</h2>
        <p className="info-page-meta">August 2026 · 3 min read</p>
        <p>AUSTWise is no longer just a dashboard — it's a full campus companion. New additions like the Mess Meal Tracker with cost splitting, BharaKoto fare estimates, Pomodoro and Zen study modes, anonymous Shadow community spaces, and Google Classroom integration mean there's now a home for every part of your day, from morning mess meals to late-night study sessions.</p>

        <hr />

        <h2>Introducing AUSTWise v2.0</h2>
        <p className="info-page-meta">January 2025 · 3 min read</p>
        <p>We are thrilled to announce the launch of AUSTWise v2.0 — a complete redesign of the platform with a focus on performance, accessibility, and user experience. New features include the Campus Hub with interactive floor maps, enhanced Grade Lab analytics, and a completely rebuilt messaging system.</p>
        <p>Read the full <a href="/changelog">changelog</a> for details.</p>

        <hr />

        <h2>Study Smarter with Topic Heatmaps</h2>
        <p className="info-page-meta">December 2024 · 2 min read</p>
        <p>Ever wondered which topics appear most frequently in your exams? The new topic heatmap feature in the Resource Vault analyses 1,200+ past question papers to show you exactly what to focus on. Spend less time guessing and more time studying what matters.</p>

        <hr />

        <h2>A Fresh Start: New Semester, New Features</h2>
        <p className="info-page-meta">November 2024 · 4 min read</p>
        <p>As a new semester begins, we are rolling out features designed to make your academic life easier. From the improved CGPA Calculator to the new marketplace for textbooks and housing, AUSTWise has everything you need to start the semester strong.</p>

        <hr />

        <h2>Behind the Build: Engineering AUSTWise</h2>
        <p className="info-page-meta">October 2024 · 5 min read</p>
        <p>A deep dive into the technical architecture of AUSTWise — how we handle real-time notifications, manage 12 visual themes, and serve thousands of students without breaking a sweat.</p>
      </div>
      <div className="info-page-footer">&copy; {new Date().getFullYear()} AUSTWise. All rights reserved.</div>
    </div>
  );
}
