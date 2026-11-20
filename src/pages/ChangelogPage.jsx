import { History } from 'lucide-react';
import InfoShell from './InfoShell';

// To ship a new version, add an object at the TOP of this list:
// { version: 'v1.1', date: 'December 2026', title: 'Short summary', groups: [['Group name', ['change', ...]], ...] }
const RELEASES = [
  {
    version: 'v1.0',
    date: '20 November 2026',
    title: 'First public release',
    groups: [
      ['Academics', [
        'Dashboard with CGPA snapshot, class routine, deadlines and exam tracker',
        'Grade Lab analytics — CGPA graphs, course reviews and prerequisite trees',
        'Resource Vault with past papers, topic heatmaps and the Question Bank Analyzer',
        'Workspace — Google Classroom courses, assignments and materials',
        'Cover Page Generator and certificate tools',
      ]],
      ['Campus', [
        'InsideAUST — floor maps, room finder and empty classroom finder',
        'Notice Board, CR/SR directory and auditorium bookings',
        'Marketplace — textbooks, To-Let listings and Lost & Found',
      ]],
      ['Daily Life & Productivity', [
        'Life Planner — goals, milestones, tasks and courses',
        'TakaGeloKoi money tracker and BharaKoto fare estimates',
        'Pomodoro, Study Room with ambient sounds, and Zen mode',
        'Password Manager and auto alarm',
        'CP Hub for competitive programming',
      ]],
      ['Community', [
        'ConnectBox messaging with course and lab groups',
        'Community hub — clubs, directories and mentors',
        'Buzz forum and Shadow anonymous chat',
        'Orbits profiles and active members list',
        'DownTime — gaming rooms, media trackers and trivia',
      ]],
      ['Platform', [
        'Hand-crafted themes, each with a matching layout',
        'Node (free), Helix and Apex plans through PipraPay',
        'Admin panel with roles, feedback inbox and moderation tools',
        'Terms, Privacy and Cookie policies, with consent at signup',
      ]],
    ],
  },
];

const SECTIONS = RELEASES.map((r) => ({
  id: r.version.replace(/\./g, '-'),
  title: `${r.version} — ${r.title}`,
  meta: r.date,
  body: r.groups.map(([name, items]) => (
    <div className="tos-group" key={name}>
      <h3 className="tos-group-title">{name}</h3>
      <ul className="tos-list">{items.map((t) => <li key={t}>{t}</li>)}</ul>
    </div>
  )),
}));

export default function ChangelogPage() {
  const latest = RELEASES[0];
  return (
    <InfoShell
      icon={History}
      overline="Resources"
      title="Changelog"
      subtitle="Every release, newest first"
      stats={[{ label: 'Releases', value: RELEASES.length }, { label: 'Latest', value: latest.version }]}
      sections={SECTIONS}
      numbered={false}
    />
  );
}
