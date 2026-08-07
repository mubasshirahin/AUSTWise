import { useNavigate } from 'react-router-dom';
import logoSilver from '../assets/logo-silver.png';
import './InfoPage.css';

export default function PricingPage() {
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
        <h1>Pricing</h1>
        <p className="info-page-subtitle">AUSTWise is and always will be free for AUST students.</p>

        <h2>Free Plan</h2>
        <p>All core features are completely free for AUST students, faculty, and staff:</p>
        <ul>
          <li>Dashboard with CGPA Calculator and schedule view</li>
          <li>Grade Lab with interactive analytics</li>
          <li>Resource Vault with 1,200+ past papers</li>
          <li>Campus Hub with floor maps and live data</li>
          <li>Community features including directories and messaging</li>
          <li>Marketplace for textbooks, housing, and more</li>
          <li>All 12 visual themes</li>
          <li>Push notifications for deadlines and classes</li>
        </ul>

        <h2>Why Free?</h2>
        <p>AUSTWise was built by students for students. We believe that academic tools should never be a financial burden. Our mission is to make campus life easier for every AUST student — regardless of their financial situation.</p>

        <h2>Future Plans</h2>
        <p>If we introduce premium features in the future, they will be optional additions that enhance the experience without limiting access to core functionality. Core features will remain free.</p>

        <h2>Get Started</h2>
        <p>Ready to simplify your academic life? <a href="/login">Create your free account</a> today.</p>
      </div>
      <div className="info-page-footer">&copy; {new Date().getFullYear()} AUSTWise. All rights reserved.</div>
    </div>
  );
}
