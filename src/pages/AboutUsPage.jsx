import { Info } from 'lucide-react';
import { DISCORD_URL } from '../constants/social';
import InfoShell from './InfoShell';

const EMAIL = 'austwise59@gmail.com';

const SECTIONS = [
  { id: 'mission', title: 'Our Mission', body: <p>AUSTWise was created to solve the everyday problems AUST students face — from missing deadlines and hunting for past papers to finding affordable housing near campus. Technology should make student life simpler, not more complicated.</p> },
  { id: 'different', title: 'What Makes Us Different', body: (
    <>
      <p>Every feature exists because a real AUST student faced a real problem.</p>
      <ul className="tos-list">
        <li>Purpose-built for AUST, as an independent solo project</li>
        <li>A free Node plan with all the core features</li>
        <li>Hand-crafted themes, each with its own layout</li>
        <li>Privacy-first — no tracking, your data stays yours</li>
        <li>Grows with you — from Daily Life and Productivity to Study Rooms and anonymous spaces</li>
      </ul>
    </>
  ) },
  { id: 'values', title: 'Our Values', body: (
    <ul className="tos-list">
      <li><strong>Student-first</strong> — every decision starts with “how does this help students?”</li>
      <li><strong>Free core</strong> — the essentials stay free for every AUST student</li>
      <li><strong>Privacy-respecting</strong> — we don&apos;t sell or misuse your data</li>
      <li><strong>Community-driven</strong> — shaped by feedback from the AUST community</li>
    </ul>
  ) },
  { id: 'contact', title: 'Contact', body: <p>Questions or suggestions? Use the <a href="/feedback">Feedback</a> form or email <a href={`mailto:${EMAIL}`}>{EMAIL}</a>, or join us on <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">Discord</a>.</p> },
];

export default function AboutUsPage() {
  return (
    <InfoShell
      icon={Info}
      overline="Why AUSTWise"
      title="About AUSTWise"
      subtitle="An independent project, built for AUST students"
      stats={[{ label: 'Founded', value: '2024' }]}
      sections={SECTIONS}
    />
  );
}
