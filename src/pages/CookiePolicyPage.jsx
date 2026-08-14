import { useNavigate } from 'react-router-dom';
import './InfoPage.css';
import LandingNav from '../features/landing/LandingNav';

export default function CookiePolicyPage() {
  const navigate = useNavigate();
  return (
    <div className="info-page has-landing-nav">
      <LandingNav />
      <div className="info-page-body">
        <div className="info-page-title-block">
          <div className="info-page-title-row">
            <h1>Cookie Policy</h1>
            <button className="info-page-back" onClick={() => navigate('/')}>← Back to Home</button>
          </div>
          <p className="info-page-subtitle">Last updated: August 2026</p>
        </div>

        <h2>What Are Cookies</h2>
        <p>Cookies are small text files stored on your device by your browser. They help us remember your preferences and keep you logged in.</p>

        <h2>How We Use Cookies</h2>
        <p>AUSTWise uses the following types of cookies:</p>
        <ul>
          <li><strong>Essential cookies</strong> — required for the platform to function (session management, authentication)</li>
          <li><strong>Preference cookies</strong> — remember your theme selection and layout preferences</li>
          <li><strong>Analytics cookies</strong> — help us understand how the platform is used to improve your experience</li>
        </ul>

        <h2>Third-Party Cookies</h2>
        <p>We may use third-party services (e.g., analytics providers) that set their own cookies. We do not control these cookies.</p>

        <h2>Managing Cookies</h2>
        <p>You can control cookies through your browser settings. Disabling essential cookies may affect platform functionality. Most browsers allow you to block or delete cookies from their privacy settings.</p>

        <h2>Updates</h2>
        <p>We may update this policy as our cookie usage evolves. Changes will be posted on this page.</p>

        <h2>Contact</h2>
        <p>Questions about our cookie usage? Reach us at <a href="mailto:support@austwise.com">support@austwise.com</a>.</p>
      </div>
      <div className="info-page-footer">&copy; {new Date().getFullYear()} AUSTWise. All rights reserved.</div>
    </div>
  );
}
