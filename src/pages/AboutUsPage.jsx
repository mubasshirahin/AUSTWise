import { useNavigate } from 'react-router-dom';
import './InfoPage.css';
import LandingNav from '../features/landing/LandingNav';

export default function AboutUsPage() {
  const navigate = useNavigate();
  return (
    <div className="info-page has-landing-nav">
      <LandingNav />
      <div className="info-page-body">
        <div className="info-page-title-block">
          <div className="info-page-title-row">
            <h1>About AUSTWise</h1>
            <button className="info-page-back" onClick={() => navigate('/')}>← Back to Home</button>
          </div>
          <p className="info-page-subtitle">An independent project, built for AUST students.</p>
        </div>

        <h2>Our Mission</h2>
        <p>AUSTWise was created to solve the everyday problems that AUST students face — from missing deadlines and hunting for past paper to finding affordable housing near campus. We believe technology should make student life simpler, not more complicated.</p>

        <h2>What Makes Us Different</h2>
        <p>Every feature in AUSTWise exists because a real AUST student faced a real problem. We do not build features for the sake of it — we build solutions to real pain points. The result is a platform that actually understands what students need.</p>
        <ul>
          <li>Purpose-built for AUST students as a solo developer project</li>
          <li>All core features are completely free</li>
          <li>12 unique visual themes to match your style</li>
          <li>Privacy-first approach — your data stays yours</li>
          <li>Grows with you — from Daily Life and Productivity to Study Rooms and anonymous Community spaces</li>
        </ul>

        <h2>Our Values</h2>
        <ul>
          <li><strong>Student-first</strong> — every decision starts with "how does this help students?"</li>
          <li><strong>Free & open</strong> — core features remain free for all AUST students</li>
          <li><strong>Privacy-respecting</strong> — we do not sell or misuse your data</li>
          <li><strong>Community-driven</strong> — shaped by feedback from the AUST community</li>
        </ul>

        <h2>Contact</h2>
        <p>Have questions or suggestions? We would love to hear from you. Reach out via <a href="/feedback">Feedback</a> or email <a href="mailto:hello@austwise.com">hello@austwise.com</a>.</p>
      </div>
      <div className="info-page-footer">&copy; {new Date().getFullYear()} AUSTWise. All rights reserved.</div>
    </div>
  );
}
