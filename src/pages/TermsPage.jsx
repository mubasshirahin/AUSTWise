import { useNavigate } from 'react-router-dom';
import './InfoPage.css';
import LandingNav from '../features/landing/LandingNav';

export default function TermsPage() {
  const navigate = useNavigate();
  return (
    <div className="info-page has-landing-nav">
      <LandingNav />
      <div className="info-page-body">
        <div className="info-page-title-block">
          <div className="info-page-title-row">
            <h1>Terms of Service</h1>
            <button className="info-page-back" onClick={() => navigate('/')}>← Back to Home</button>
          </div>
          <p className="info-page-subtitle">Last updated: January 2025</p>
        </div>

        <h2>1. Acceptance of Terms</h2>
        <p>By accessing or using AUSTWise, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.</p>

        <h2>2. Description of Service</h2>
        <p>AUSTWise is an academic assistant platform designed for students, faculty, and staff of Ahsanullah University of Science and Technology (AUST). It provides tools including but not limited to academic analytics, a resource vault, campus navigation, community features, marketplace listings, productivity and study tools, anonymous community spaces, and optional integrations such as Google Classroom.</p>

        <h2>3. User Accounts</h2>
        <p>You are responsible for maintaining the confidentiality of your account credentials. You must provide accurate information during registration. AUSTWise reserves the right to suspend accounts that violate these terms.</p>

        <h2>4. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul className="info-list">
          <li>Use the platform for any unlawful purpose</li>
          <li>Post false, misleading, harmful, or defamatory content — including in anonymous spaces such as Shadow</li>
          <li>Use anonymous features to harass, threaten, or impersonate others</li>
          <li>Attempt to access another user's account</li>
          <li>Use automated tools to scrape or abuse the platform</li>
          <li>Upload malicious code or interfere with platform operations</li>
        </ul>

        <h2>5. User-Generated Content</h2>
        <p>You are solely responsible for content you post — including forum posts, anonymous messages, marketplace listings, reviews, and notes. Anonymous spaces do not shield you from the consequences of abusive or unlawful content; AUSTWise may remove such content and suspend responsible accounts. Your Notebook is private to you and is not shared.</p>

        <h2>6. Marketplace Listings</h2>
        <p>AUSTWise facilitates peer-to-peer listings. We do not endorse, guarantee, or verify any listings. Transactions are solely between buyers and sellers. AUSTWise is not responsible for disputes arising from marketplace transactions.</p>

        <h2>7. Third-Party Integrations</h2>
        <p>Features such as Google Classroom integration rely on third-party services. You are responsible for authorising and managing those connections. AUSTWise is not responsible for the availability, data practices, or terms of third-party services.</p>

        <h2>8. Intellectual Property</h2>
        <p>All content, trademarks, and intellectual property on AUSTWise are owned by AUSTWise or its licensors. You may not reproduce, distribute, or create derivative works without permission.</p>

        <h2>9. Limitation of Liability</h2>
        <p>AUSTWise is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the platform.</p>

        <h2>10. Changes to Terms</h2>
        <p>We reserve the right to modify these terms at any time. Users will be notified of material changes via email or platform notice.</p>

        <h2>11. Contact</h2>
        <p>For questions about these terms, please reach out via the Feedback form or contact us at <a href="mailto:support@austwise.com">support@austwise.com</a>.</p>
      </div>
      <div className="info-page-footer">&copy; {new Date().getFullYear()} AUSTWise. All rights reserved.</div>
    </div>
  );
}
