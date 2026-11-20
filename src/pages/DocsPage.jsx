import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { DISCORD_URL } from '../constants/social';
import InfoShell from './InfoShell';

const EMAIL = 'austwise59@gmail.com';

const SECTIONS = [
  { id: 'account', title: 'Create your account', body: (
    <>
      <p>Go to <Link to="/login">Sign up</Link> and pick your role: <strong>Student</strong>, <strong>Faculty</strong> or <strong>Alumni</strong>.</p>
      <ul className="tos-list">
        <li>Use your <strong>@aust.edu</strong> email, or continue with Google.</li>
        <li>Fill in your department and role details (batch, designation and so on).</li>
        <li>Tick the box to accept the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link> — it&apos;s required.</li>
        <li>Faculty and alumni can also join through an invitation link sent by an admin.</li>
      </ul>
    </>
  ) },
  { id: 'dashboard', title: 'Dashboard', body: <p>The <Link to="/dashboard">Dashboard</Link> is your home: CGPA snapshot, today&apos;s routine, upcoming deadlines and the exam tracker. Use the sidebar to open any other tool.</p> },
  { id: 'academics', title: 'Grades & routine', body: (
    <ul className="tos-list">
      <li><Link to="/gradelab">Grade Lab</Link> — enter your results to see CGPA trends, course reviews and prerequisite trees.</li>
      <li><Link to="/routine-templates">Routine templates</Link> — set up your class routine once and it shows on the dashboard.</li>
      <li><Link to="/workspace">Workspace</Link> — connect Google Classroom to see courses, assignments and materials in one grid.</li>
    </ul>
  ) },
  { id: 'vault', title: 'Resource Vault', body: <p>Open the <Link to="/resource-vault">Resource Vault</Link> to browse past papers by department, semester and course, and keep your own material folders. The <Link to="/question-bank-analyzer">Question Bank Analyzer</Link> shows which topics come up most. Storage is 500MB on Node, 5GB on Helix and unlimited on Apex.</p> },
  { id: 'campus', title: 'Campus', body: (
    <ul className="tos-list">
      <li><Link to="/insideaust">InsideAUST</Link> — floor maps and room finder.</li>
      <li><Link to="/empty-classroom">Empty Classroom</Link> — find a free room right now.</li>
      <li><Link to="/marketplace">Marketplace</Link> — textbooks, To-Let listings and Lost &amp; Found.</li>
    </ul>
  ) },
  { id: 'daily', title: 'Daily Life & productivity', body: (
    <ul className="tos-list">
      <li><Link to="/daily-life">Daily Life</Link> — Life Planner for goals, milestones and tasks.</li>
      <li><Link to="/takagelokoi">TakaGeloKoi</Link> — set a monthly budget and log daily spending.</li>
      <li><Link to="/aust-bhara">BharaKoto</Link> — fare estimates for trips around Dhaka.</li>
      <li><Link to="/study-room">Study Room</Link> and <Link to="/zen">Zen mode</Link> — Pomodoro timer and ambient sounds.</li>
      <li><Link to="/cp-hub">CP Hub</Link> — competitive programming practice.</li>
    </ul>
  ) },
  { id: 'community', title: 'Community & chat', body: (
    <ul className="tos-list">
      <li><Link to="/connectbox">ConnectBox</Link> — course and lab group chats, plus direct messages.</li>
      <li><Link to="/community">Community</Link> — clubs, directories and mentors.</li>
      <li><Link to="/shadow">Shadow</Link> — anonymous forum posts and 10-minute anonymous chats.</li>
      <li><Link to="/downtime">DownTime</Link> — gaming rooms, trivia and media trackers.</li>
    </ul>
  ) },
  { id: 'tools', title: 'Handy tools', body: <p><Link to="/cover-page-generator">Cover Page Generator</Link> builds assignment cover pages; the Password Manager and <Link to="/wakemeup">auto alarm</Link> live under Daily Life.</p> },
  { id: 'settings', title: 'Themes & settings', body: <p>Open <Link to="/settings">Settings</Link> to change your theme (each has its own layout), edit your profile, link accounts and manage notifications.</p> },
  { id: 'plans', title: 'Plans & billing', body: <p>Node is free. <strong>Helix</strong> (৳50 for 30 days) and <strong>Apex</strong> (৳500 a year) add more storage and premium tools, paid through PipraPay. Nothing auto-renews. Compare them on <Link to="/see-plans">See Plans</Link>.</p> },
  { id: 'privacy', title: 'Your data', body: <p>You can ask for a copy of your data or delete your account at any time — see the <Link to="/privacy">Privacy Policy</Link>.</p> },
  { id: 'help', title: 'Need help?', body: <p>Use the <Link to="/feedback">Feedback</Link> form, email <a href={`mailto:${EMAIL}`}>{EMAIL}</a>, or ask on <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">Discord</a>.</p> },
];

export default function DocsPage() {
  return (
    <InfoShell
      icon={BookOpen}
      overline="Resources"
      title="Documentation"
      subtitle="How to get started and find your way around AUSTWise"
      stats={[{ label: 'Topics', value: SECTIONS.length }, { label: 'Version', value: 'v1.0' }]}
      sections={SECTIONS}
    />
  );
}
