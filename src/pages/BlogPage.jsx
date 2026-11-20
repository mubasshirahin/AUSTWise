import { Link } from 'react-router-dom';
import { Newspaper } from 'lucide-react';
import { DISCORD_URL } from '../constants/social';
import InfoShell from './InfoShell';

// Newest post first. To publish, add an object at the top.
const POSTS = [
  {
    id: 'v1-launch',
    title: 'AUSTWise v1.0 is live',
    meta: '20 November 2026 · 2 min read',
    body: (
      <>
        <p>After five months of building since June, AUSTWise is open to every AUST student, faculty member and alumnus. It brings the things you used to juggle across WhatsApp groups, spreadsheets and notebooks into one place.</p>
        <ul className="tos-list">
          <li><strong>Academics</strong> — dashboard, Grade Lab, Resource Vault and Google Classroom in Workspace.</li>
          <li><strong>Daily life</strong> — Life Planner, TakaGeloKoi, BharaKoto and the Study Room.</li>
          <li><strong>Community</strong> — ConnectBox chats, clubs, Shadow and DownTime.</li>
        </ul>
        <p>Everything that shipped is listed in the <Link to="/changelog">changelog</Link>. Sign up with your @aust.edu email to get started.</p>
      </>
    ),
  },
  {
    id: 'plans',
    title: 'Node, Helix and Apex: how our plans work',
    meta: '20 November 2026 · 1 min read',
    body: (
      <>
        <p>AUSTWise is built and run by one student, and servers cost money. So the core stays free on <strong>Node</strong>, and two optional plans help pay for it:</p>
        <ul className="tos-list">
          <li><strong>Helix</strong> — ৳50 for 30 days: no ads, premium themes, exports and 5GB Vault storage.</li>
          <li><strong>Apex</strong> — ৳500 a year: everything in Helix plus the AI study assistant and unlimited storage.</li>
        </ul>
        <p>Nothing renews on its own — when a plan ends you go back to Node and keep your data. Details on <Link to="/pricing">Pricing</Link>.</p>
      </>
    ),
  },
  {
    id: 'community',
    title: 'Join the AUSTWise Discord',
    meta: '20 November 2026 · 1 min read',
    body: <p>We now have a Discord server for questions, bug reports and feature ideas. <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">Join here</a> — or send feedback any time through the <Link to="/feedback">Feedback</Link> form.</p>,
  },
];

export default function BlogPage() {
  return (
    <InfoShell
      icon={Newspaper}
      overline="Resources"
      title="Blog"
      subtitle="News and updates from the AUSTWise team"
      stats={[{ label: 'Posts', value: POSTS.length }, { label: 'Latest', value: 'Nov 2026' }]}
      sections={POSTS}
      numbered={false}
    />
  );
}
