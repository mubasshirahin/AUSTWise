import { Sparkles } from 'lucide-react';
import InfoShell from './InfoShell';

const FEATURES = [
  ['dashboard', 'Dashboard', 'Your academic command centre. See your CGPA, upcoming classes, pending deadlines, attendance and weekly schedule in one place. Quick widgets surface your routine, exam tracker and deadlines the moment you open the app.'],
  ['daily', 'Daily Life', 'Campus tools outside the classroom. The Mess Meal Tracker logs meals, plans your weekly menu and splits costs with roommates, while BharaKoto estimates rickshaw, bus, metro and CNG fares around Dhaka.'],
  ['grade', 'Grade Lab', 'Analytics for your academic performance — interactive CGPA graphs, department comparisons, course reviews and polls, syllabus tracking, prerequisite trees and semester breakdowns.'],
  ['inside', 'InsideAUST', 'Navigate AUST with interactive floor maps, classroom finders and building views. Check faculty availability, library seats, canteen menus and crowd levels, and bus schedules.'],
  ['vault', 'Resource Vault', 'Past question papers organised by department, semester and course. Topic heatmaps show exam frequency, and curated playlists, material folders, cheatsheets and skill roadmaps keep revision organised.'],
  ['notebook', 'Notebook', 'A private space for your study notes in a searchable library. Capture ideas during lectures, tag them by course, and pull them back up during revision.'],
  ['community', 'Community', 'Confession feeds, alumni directory, club hub, student directory and mentor requests — the whole AUST ecosystem in one social hub.'],
  ['connectbox', 'ConnectBox', 'Real-time chat for courses and groups — course rooms, lab group messaging, file sharing, read receipts, reactions and private faculty DMs.'],
  ['productivity', 'Productivity', 'Pomodoro sessions, a study room with ambient sounds, Zen mode for distraction-free work, and tracking across your sessions.'],
  ['market', 'Marketplace', 'Exchange used textbooks and kits, find bachelor rentals near campus, report lost items and request mentorship from seniors — no commissions.'],
  ['downtime', 'DownTime', 'Media trackers for shows and games, a gaming zone, trivia and light entertainment to recharge between study sessions.'],
  ['shadow', 'Shadow', 'An anonymous corner of AUSTWise. Post to the AUST forum without your name, or match with a stranger for a 10-minute anonymous chat.'],
  ['tools', 'Study Tools', 'CP Hub for competitive programming practice, and TakaGeloKoi to log expenses, set budgets and review monthly spending.'],
  ['workspace', 'Workspace & More', 'Connect Google Classroom to track courses, assignments and materials in one grid. The Cover Page Generator builds assignment cover pages in seconds.'],
  ['admin', 'Admin Panel', 'Tools for CRs, SRs, faculty and admins — publish notices, update canteen and library status, manage accounts and roles, review applications, read feedback and manage auditorium bookings.'],
  ['themes', 'Themes & Customisation', 'Hand-crafted visual themes, each with its own matching layout — switch instantly with no reload and make AUSTWise feel like yours.'],
];

const SECTIONS = FEATURES.map(([id, title, text]) => ({ id, title, body: <p>{text}</p> }));

export default function FeaturesPage() {
  return (
    <InfoShell
      icon={Sparkles}
      overline="Why AUSTWise"
      title="Features"
      subtitle="Everything AUSTWise offers to make campus life easier"
      stats={[{ label: 'Features', value: SECTIONS.length }]}
      sections={SECTIONS}
    />
  );
}
