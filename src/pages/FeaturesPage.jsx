import { useNavigate } from 'react-router-dom';
import './InfoPage.css';
import LandingNav from '../features/landing/LandingNav';

export default function FeaturesPage() {
  const navigate = useNavigate();
  return (
    <div className="info-page has-landing-nav">
      <LandingNav />
      <div className="info-page-body">
        <div className="info-page-title-block">
          <div className="info-page-title-row">
            <h1>Features</h1>
            <button className="info-page-back" onClick={() => navigate('/')}>← Back to Home</button>
          </div>
          <p className="info-page-subtitle">Everything AUSTWise offers to make your campus life easier.</p>
        </div>

        <h2>Dashboard</h2>
        <p>Your academic command centre. See your CGPA, upcoming classes, pending deadlines, attendance, and weekly schedule — all in one place. Smart reminders ensure you never miss a class, and quick widgets surface your routine, exam tracker, and deadlines the moment you open the app.</p>

        <h2>Daily Life</h2>
        <p>Campus life tools that live outside the classroom. The Mess Meal Tracker helps you log meals, plan your weekly menu, and split costs with roommates, while BharaKoto estimates rickshaw, bus, metro, and CNG fares for trips around Dhaka.</p>

        <h2>Grade Lab (Analytics)</h2>
        <p>Advanced analytics for your academic performance. Interactive CGPA graphs, department comparison charts, course reviews and polls, syllabus completion tracking, prerequisite trees, and semester-by-semester breakdowns.</p>

        <h2>InsideAUST (Campus)</h2>
        <p>Navigate AUST with interactive floor maps, classroom finders, and building structure views. Check faculty availability, library seat occupancy, canteen menus and crowd levels, and real-time bus schedules — all updated live.</p>

        <h2>Resource Vault</h2>
        <p>A library of 1,200+ past question papers organised by department, semester, and course. Topic heatmaps show exam frequency, curated YouTube playlists cover entire syllabi, and material folders, cheatsheets, and skill roadmaps keep your revision organised.</p>

        <h2>Notebook</h2>
        <p>A private space for your own study notes, organised into a searchable library. Capture ideas during lectures, tag them by course, and pull them back up during revision.</p>

        <h2>Community</h2>
        <p>Connect with the entire AUST ecosystem. Anonymous confession feeds, alumni directory, club hub, student directory with contact info, and mentor requests — all in one social hub.</p>

        <h2>ConnectBox (Messaging)</h2>
        <p>Real-time chat for courses and groups. Course-specific rooms, lab group messaging, file sharing, read receipts, reactions, smart notifications, and private faculty DMs. No more juggling between WhatsApp and Messenger.</p>

        <h2>Productivity</h2>
        <p>Focus tools to get real work done. Pomodoro sessions, a study room with ambient sounds, Zen mode for distraction-free deep work, and productivity tracking across your sessions.</p>

        <h2>Marketplace</h2>
        <p>The ultimate AUST marketplace. Exchange used textbooks and academic kits, find bachelor rentals near campus, report lost items, and request mentorship from seniors — all free, no commissions.</p>

        <h2>DownTime</h2>
        <p>When you need a break, DownTime has you covered — media trackers for shows and games, a gaming zone, trivia, and light entertainment to recharge between study sessions.</p>

        <h2>Shadow</h2>
        <p>An anonymous corner of AUSTWise. Post to the AUST forum under the "Buzz" tag without your name, or match with a stranger for a 10-minute anonymous conversation through Shadow Chat.</p>

        <h2>Study Tools</h2>
        <p>A growing toolbox for exam season and beyond — an Exam Checklist to plan and track your preparation, a CP Hub for competitive programming practice, and a Money Tracker to log expenses, set budget goals, and review monthly summaries.</p>

        <h2>Workspace & More</h2>
        <p>The Workspace connects your Google Classroom so you can track courses, assignments, and materials in one grid. The Cover Page Generator creates polished assignment cover pages in seconds, and Transcript Templates streamline official transcript formatting.</p>

        <h2>Admin Panel</h2>
        <p>Powerful management tools for CRs, SRs, faculty, and admins — publish official notices, update canteen and library status in real time, manage user accounts and roles, review CR/SR applications, maintain the CR/SR directory, and manage auditorium bookings.</p>

        <h2>Themes & Customisation</h2>
        <p>12 hand-crafted visual themes — from minimalist dark to cyberpunk, from editorial newsprint to sketchbook. Switch in real time with no reload, and make AUSTWise feel like yours.</p>
      </div>
      <div className="info-page-footer">&copy; {new Date().getFullYear()} AUSTWise. All rights reserved.</div>
    </div>
  );
}
