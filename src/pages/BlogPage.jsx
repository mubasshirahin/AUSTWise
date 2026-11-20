import { Newspaper } from 'lucide-react';
import InfoShell from './InfoShell';

const SECTIONS = [
  { id: 'campus-life', title: 'Campus Life, Fully Covered', meta: 'August 2026 · 3 min read', body: <p>AUSTWise is no longer just a dashboard — it&apos;s a full campus companion. New additions like the Mess Meal Tracker with cost splitting, BharaKoto fare estimates, Pomodoro and Zen study modes, anonymous Shadow spaces, and Google Classroom integration mean there&apos;s now a home for every part of your day, from morning mess meals to late-night study sessions.</p> },
  { id: 'v2', title: 'Introducing AUSTWise v2.0', meta: 'January 2025 · 3 min read', body: <><p>We are thrilled to announce AUSTWise v2.0 — a complete redesign focused on performance, accessibility and user experience. New features include the Campus Hub with interactive floor maps, enhanced Grade Lab analytics, and a rebuilt messaging system.</p><p>Read the full <a href="/changelog">changelog</a> for details.</p></> },
  { id: 'heatmaps', title: 'Study Smarter with Topic Heatmaps', meta: 'December 2024 · 2 min read', body: <p>Ever wondered which topics appear most often in your exams? The topic heatmap in the Resource Vault analyses past question papers to show you what to focus on. Spend less time guessing and more time studying what matters.</p> },
  { id: 'new-semester', title: 'A Fresh Start: New Semester, New Features', meta: 'November 2024 · 4 min read', body: <p>As a new semester begins, we are rolling out features to make academic life easier — from the improved CGPA Calculator to the new marketplace for textbooks and housing.</p> },
  { id: 'behind-build', title: 'Behind the Build: Engineering AUSTWise', meta: 'October 2024 · 5 min read', body: <p>A look at how AUSTWise is built — real-time notifications, a theme system that switches without a reload, and serving students across campus without breaking a sweat.</p> },
];

export default function BlogPage() {
  return (
    <InfoShell
      icon={Newspaper}
      overline="Resources"
      title="Blog"
      subtitle="Updates, tips and stories from the AUSTWise team"
      stats={[{ label: 'Posts', value: SECTIONS.length }, { label: 'Latest', value: 'Aug 2026' }]}
      sections={SECTIONS}
      numbered={false}
    />
  );
}
