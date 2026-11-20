import { History } from 'lucide-react';
import InfoShell from './InfoShell';

const RELEASES = [
  ['v3.0', 'August 2026', [
    'Daily Life — Mess Meal Tracker with cost splitting and BharaKoto fare estimates',
    'Productivity — Pomodoro sessions, study room with ambient sounds, and Zen mode',
    'DownTime — media trackers, gaming zone, and trivia',
    'Shadow — anonymous AUST forum posts and 10-minute anonymous chats',
    'Workspace — Google Classroom integration for courses, assignments, and materials',
    'Money Tracker — expense logging, budget goals, and monthly summaries',
    'CP Hub and Cover Page Generator',
    'Notebook — personal, searchable study notes library',
    'ConnectBox — reactions, read receipts, and richer course/lab messaging',
  ]],
  ['v2.0', 'January 2025', [
    'Complete UI redesign with new themes',
    'Campus Hub with interactive floor maps and room finder',
    'Grade Lab enhancements — department comparison charts',
    'Resource Vault topic heatmaps for exam preparation',
    'Real-time messaging with course-specific chat rooms',
    'Marketplace with To-Let listings and Lost & Found',
    'Student and alumni directories with search',
    'Smart push notifications for deadlines and classes',
  ]],
  ['v1.3', 'October 2024', ['Canteen menu and crowd index', 'Library seat occupancy tracker', 'Improved CGPA visualisation with semester breakdown', 'Performance optimisations and bug fixes']],
  ['v1.2', 'July 2024', ['Anonymous confession feed', 'Faculty office hours and status', 'Dark mode refinements']],
  ['v1.1', 'April 2024', ['Guest login support', 'Course-specific resource organisation', 'Notification preferences']],
  ['v1.0', 'January 2024', ['Initial launch of AUSTWise', 'Dashboard with CGPA Calculator', 'Resource Vault with past papers', 'Basic community features']],
];

const SECTIONS = RELEASES.map(([v, date, items]) => ({
  id: v.replace('.', '-'),
  title: v,
  meta: date,
  body: <ul className="tos-list">{items.map((t) => <li key={t}>{t}</li>)}</ul>,
}));

export default function ChangelogPage() {
  return (
    <InfoShell
      icon={History}
      overline="Resources"
      title="Changelog"
      subtitle="Every update, feature and fix — tracked here"
      stats={[{ label: 'Releases', value: SECTIONS.length }, { label: 'Latest', value: 'v3.0' }]}
      sections={SECTIONS}
      numbered={false}
    />
  );
}
