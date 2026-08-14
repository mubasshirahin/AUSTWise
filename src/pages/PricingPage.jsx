import { useNavigate } from 'react-router-dom';
import './InfoPage.css';
import LandingNav from '../features/landing/LandingNav';

export default function PricingPage() {
  const navigate = useNavigate();
  return (
    <div className="info-page has-landing-nav">
      <LandingNav />
      <div className="info-page-body">
        <div className="info-page-title-block">
          <div className="info-page-title-row">
            <h1>Pricing</h1>
            <button className="info-page-back" onClick={() => navigate('/')}>← Back to Home</button>
          </div>
          <p className="info-page-subtitle">AUSTWise is and always will be free for AUST students.</p>
        </div>

        <h2>Free Plan</h2>
        <p>All core features are completely free for AUST students, faculty, and staff:</p>
        <ul>
          <li>Dashboard with CGPA Calculator and schedule view</li>
          <li>Daily Life — Mess Meal Tracker and BharaKoto fare estimates</li>
          <li>Grade Lab with interactive analytics</li>
          <li>InsideAUST with floor maps, bus schedules, and live campus data</li>
          <li>Resource Vault with 1,200+ past papers</li>
          <li>Notebook for your own study notes</li>
          <li>Community features including directories, clubs, and mentors</li>
          <li>ConnectBox messaging with course and lab groups</li>
          <li>Productivity tools — Pomodoro, Study Room, and Zen mode</li>
          <li>Marketplace for textbooks, housing, and more</li>
          <li>All 12 visual themes</li>
          <li>Push notifications for deadlines and classes</li>
        </ul>

        <h2>Why Free?</h2>
        <p>AUSTWise is an independent, solo-built project. We believe that academic tools should never be a financial burden. Our mission is to make campus life easier for every AUST student — regardless of their financial situation.</p>

        <h2>Future Plans</h2>
        <p>If we introduce premium features in the future, they will be optional additions that enhance the experience without limiting access to core functionality. Core features will remain free.</p>

        <h2>Get Started</h2>
        <p>Ready to simplify your academic life? <a href="/login">Create your free account</a> today.</p>
      </div>
      <div className="info-page-footer">&copy; {new Date().getFullYear()} AUSTWise. All rights reserved.</div>
    </div>
  );
}
