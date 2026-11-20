import { Tag } from 'lucide-react';
import InfoShell from './InfoShell';

const Tk = () => <span className="tos-tk">৳</span>;

const SECTIONS = [
  { id: 'overview', title: 'Plans at a glance', body: (
    <ul className="tos-list">
      <li><strong>Node</strong> — free. The core of AUSTWise, no card needed.</li>
      <li><strong>Helix</strong> — <Tk />50 for 30 days. Unlocks the premium tools for a month.</li>
      <li><strong>Apex</strong> — <Tk />500 per year. Everything in Helix for a full year, at a lower monthly cost.</li>
    </ul>
  ) },
  { id: 'node', title: 'Node (Free)', body: (
    <ul className="tos-list">
      <li>Dashboard &amp; CGPA tracking</li>
      <li>Class routine</li>
      <li>Resource Vault (500MB)</li>
      <li>Basic analytics</li>
      <li>Community</li>
    </ul>
  ) },
  { id: 'helix', title: 'Helix — ৳50 / 30 days', body: (
    <ul className="tos-list">
      <li>Everything in Node</li>
      <li>No ads on any page</li>
      <li>Premium themes and advanced analytics</li>
      <li>Export to PDF and Excel</li>
      <li>Priority email support</li>
      <li><strong>Vault storage up to 5GB</strong></li>
    </ul>
  ) },
  { id: 'apex', title: 'Apex — ৳500 / year', body: (
    <>
      <p>Normally <Tk />600 — a full year from the day you pay.</p>
      <ul className="tos-list">
        <li>Everything in Helix</li>
        <li><strong>AI study assistant</strong></li>
        <li>Unlimited Vault storage</li>
        <li>Priority 24/7 support and direct mentorship access</li>
        <li>Early and beta features, exclusive community badges</li>
      </ul>
    </>
  ) },
  { id: 'payment', title: 'Payment & renewal', body: <p>Payments are handled by <strong>PipraPay</strong>; AUSTWise never stores your payment details. Nothing renews automatically — when a plan ends your account goes back to Node and keeps its data. You can buy Apex any time, even while Helix is active (unused Helix days aren&apos;t refunded). Full comparison on <a href="/see-plans">See Plans</a>.</p> },
  { id: 'why', title: 'Why paid plans?', body: <p>AUSTWise is an independent, solo-built project. Paid plans cover server and storage costs so the free Node plan can stay free for everyone.</p> },
  { id: 'start', title: 'Get started', body: <p><a href="/login">Create your free account</a>, or compare plans on <a href="/see-plans">See Plans</a>.</p> },
];

export default function PricingPage() {
  return (
    <InfoShell
      icon={Tag}
      overline="Why AUSTWise"
      title="Pricing"
      subtitle="Free to start — upgrade only if you want more"
      stats={[{ label: 'Plans', value: 3 }, { label: 'From', value: 'Free' }]}
      sections={SECTIONS}
    />
  );
}
