import { useNavigate } from 'react-router-dom';
import logoSilver from '../assets/logo-silver.png';
import './InfoPage.css';

export default function FeaturesPage() {
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
        <h1>Features</h1>
        <p className="info-page-subtitle">Everything AUSTWise offers to make your campus life easier.</p>

        <h2>Dashboard</h2>
        <p>Your academic command centre. See your CGPA, upcoming classes, pending deadlines, attendance, and weekly schedule — all in one place. Smart reminders ensure you never miss a class.</p>

        <h2>Grade Lab</h2>
        <p>Advanced analytics for your academic performance. Interactive CGPA graphs, department comparison charts, course reviews, syllabus completion tracking, and semester-by-semester breakdowns.</p>

        <h2>Resource Vault</h2>
        <p>A library of 1,200+ past question papers organised by department, semester, and course. Topic heatmaps show exam frequency, and curated YouTube playlists cover entire syllabi.</p>

        <h2>Campus Hub</h2>
        <p>Navigate AUST with interactive floor maps. Check faculty availability, library seat occupancy, canteen menus and crowd levels — all updated in real time.</p>

        <h2>Community</h2>
        <p>Connect with the entire AUST ecosystem. The Buzz forum, alumni directory, club hub, student directory with contact info, and in-app messaging with classmates and faculty.</p>

        <h2>Campus Market</h2>
        <p>The ultimate AUST marketplace. Exchange used textbooks, find bachelor rentals near campus, report lost items, and request mentorship from seniors — all free, no commissions.</p>

        <h2>Messaging</h2>
        <p>Real-time chat for courses and groups. Course-specific rooms, lab group messaging, file sharing, smart notifications, and private faculty DMs. No more juggling between WhatsApp and Messenger.</p>

        <h2>Themes & Customisation</h2>
        <p>12 hand-crafted visual themes — from minimalist dark to cyberpunk, from editorial newsprint to sketchbook. Switch in real time with no reload.</p>
      </div>
      <div className="info-page-footer">&copy; {new Date().getFullYear()} AUSTWise. All rights reserved.</div>
    </div>
  );
}
