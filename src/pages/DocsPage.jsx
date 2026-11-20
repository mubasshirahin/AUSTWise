import { BookOpen } from 'lucide-react';
import InfoShell from './InfoShell';

const EMAIL = 'austwise59@gmail.com';

const SECTIONS = [
  { id: 'start', title: 'Getting Started', body: <p>AUSTWise is your all-in-one academic assistant. Create an account, accept the Terms, then explore the dashboard for a personalised overview of your academic life.</p> },
  { id: 'dashboard', title: 'Dashboard', body: <p>Your command centre — CGPA snapshot, today&apos;s schedule, pending deadlines, attendance, and quick access to every feature. Widgets surface your exam tracker and routine at a glance.</p> },
  { id: 'daily', title: 'Daily Life', body: <p>Campus tools beyond the classroom — track meals and split mess costs with the Mess Meal Tracker, or estimate fares for rickshaw, bus, metro and CNG trips around Dhaka with BharaKoto.</p> },
  { id: 'grade', title: 'Grade Lab', body: <p>Track your CGPA across semesters, compare with department averages, review courses, follow prerequisite trees, and monitor syllabus completion with interactive charts.</p> },
  { id: 'inside', title: 'InsideAUST', body: <p>Interactive floor plans, classroom and building finders, faculty office status, library seat occupancy, canteen menus with crowd levels, and bus schedules — all in one map.</p> },
  { id: 'vault', title: 'Resource Vault', body: <p>Browse past question papers organised by department, semester and course. Topic heatmaps show which topics appear most often in exams, with playlists, cheatsheets and materials alongside.</p> },
  { id: 'notebook', title: 'Notebook', body: <p>Keep your own study notes in a searchable library. Capture, tag and reorganise notes per course so revision is always one click away.</p> },
  { id: 'community', title: 'Community', body: <p>Connect with classmates through confession feeds, the student directory, alumni network, club hub and mentor requests.</p> },
  { id: 'connectbox', title: 'ConnectBox', body: <p>Real-time messaging for your courses, lab groups and faculty — with file sharing, reactions and read receipts.</p> },
  { id: 'productivity', title: 'Productivity & Study', body: <p>Pomodoro sessions, a study room with ambient sounds, and Zen mode for focused deep work. CP Hub for competitive programming and Money Tracker for your budget round out the toolkit.</p> },
  { id: 'market', title: 'Marketplace', body: <p>Buy and sell used textbooks, find bachelor rentals near campus, report lost items, and request mentorship from seniors — free, with no commissions.</p> },
  { id: 'downtime', title: 'DownTime & Shadow', body: <p>Recharge with media trackers, gaming and trivia in DownTime. In Shadow, post anonymously to the AUST forum or chat with a stranger for 10 minutes.</p> },
  { id: 'workspace', title: 'Workspace', body: <p>Connect your Google Classroom account to track courses, assignments and materials in one organised grid.</p> },
  { id: 'help', title: 'Need Help?', body: <p>Reach out via the <a href="/feedback">Feedback</a> form or email <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.</p> },
];

export default function DocsPage() {
  return (
    <InfoShell
      icon={BookOpen}
      overline="Resources"
      title="Documentation"
      subtitle="Everything you need to know about using AUSTWise"
      stats={[{ label: 'Topics', value: SECTIONS.length }, { label: 'Updated', value: 'Nov 2026' }]}
      sections={SECTIONS}
    />
  );
}
