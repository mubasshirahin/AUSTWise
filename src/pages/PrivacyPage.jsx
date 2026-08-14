import { useNavigate } from 'react-router-dom';
import './InfoPage.css';
import LandingNav from '../features/landing/LandingNav';

export default function PrivacyPage() {
  const navigate = useNavigate();
  return (
    <div className="info-page has-landing-nav">
      <LandingNav />
      <div className="info-page-body">
        <div className="info-page-title-block">
          <div className="info-page-title-row">
            <h1>Privacy Policy</h1>
            <button className="info-page-back" onClick={() => navigate('/')}>← Back to Home</button>
          </div>
          <p className="info-page-subtitle">Last updated: January 2025</p>
        </div>

        <h2>1. Information We Collect</h2>
        <p>We collect information you provide when creating an account, including your name, email address, student ID, department, batch, and academic data such as grades and course schedules. Depending on which features you use, we may also store content you create — such as notes, marketplace listings, forum or anonymous posts, expense entries, and meal logs — as well as data from third-party integrations you authorise, such as Google Classroom.</p>

        <h2>2. How We Use Your Information</h2>
        <p>Your information is used to:</p>
        <ul className="info-list">
          <li>Provide and improve AUSTWise features</li>
          <li>Display CGPA analytics and academic insights</li>
          <li>Facilitate community, messaging, and marketplace interactions</li>
          <li>Power productivity, finance, and study tools (e.g., Pomodoro, Money Tracker, Mess Meal Tracker)</li>
          <li>Send notifications about classes, deadlines, and platform updates</li>
          <li>Ensure platform security and prevent abuse</li>
        </ul>

        <h2>3. Data Sharing</h2>
        <p>We do not sell your personal data. Information may be shared with:</p>
        <ul className="info-list">
          <li>Other AUSTWise users only as needed for platform features (e.g., student directory, community posts, marketplace listings)</li>
          <li>Service providers who help operate the platform</li>
          <li>Legal authorities if required by law</li>
        </ul>

        <h2>4. Anonymous Spaces</h2>
        <p>Features like Shadow are designed to be anonymous. We do not display your identity alongside anonymous posts or chats, but we may still hold account-level logs to investigate abuse, harassment, or unlawful activity when required.</p>

        <h2>5. Data Storage & Security</h2>
        <p>Your data is stored securely using industry-standard encryption. We retain your data for as long as your account is active. You may request deletion of your data by contacting us.</p>

        <h2>6. Your Rights</h2>
        <p>You have the right to access, correct, or delete your personal data. You can manage most of this through your account settings.</p>

        <h2>7. Cookies</h2>
        <p>We use essential cookies to maintain your session and preferences. See our <a href="/cookie-policy">Cookie Policy</a> for details.</p>

        <h2>8. Contact</h2>
        <p>For privacy-related inquiries, contact <a href="mailto:privacy@austwise.com">privacy@austwise.com</a>.</p>
      </div>
      <div className="info-page-footer">&copy; {new Date().getFullYear()} AUSTWise. All rights reserved.</div>
    </div>
  );
}
