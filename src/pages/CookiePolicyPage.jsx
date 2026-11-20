import { Cookie } from 'lucide-react';
import { DISCORD_URL } from '../constants/social';
import InfoShell from './InfoShell';

const EMAIL = 'austwise59@gmail.com';

const SECTIONS = [
  { id: 'what', title: 'What cookies are', body: <p>Cookies are small text files your browser stores for a website. Browsers also offer <strong>local storage</strong>, which works in a similar way. AUSTWise uses both only to keep the app working for you.</p> },
  { id: 'use', title: 'What we store', body: (
    <ul className="tos-list">
      <li><strong>Session cookie</strong> — an HTTP-only cookie that keeps you signed in. Page scripts cannot read it, and it is cleared when you log out.</li>
      <li><strong>Preferences</strong> — your theme, layout and similar settings, kept in your browser&apos;s local storage.</li>
      <li><strong>Feature data</strong> — some tools keep drafts or cached copies in local storage so they load quickly.</li>
    </ul>
  ) },
  { id: 'none', title: 'What we don’t use', body: <p>We do <strong>not</strong> use advertising, tracking or analytics cookies, and we don&apos;t sell or share cookie data with anyone.</p> },
  { id: 'third', title: 'Third-party services', body: <p>If you choose to sign in with Google, connect Google Classroom, or pay through PipraPay, those services may set their own cookies on their own pages. Their policies apply there.</p> },
  { id: 'manage', title: 'Managing cookies', body: <p>You can clear or block cookies and site data in your browser settings. Blocking the session cookie signs you out and stops most features from working.</p> },
  { id: 'updates', title: 'Updates', body: <p>If how we use cookies changes, we&apos;ll update this page and its date. See also our <a href="/privacy">Privacy Policy</a>.</p> },
  { id: 'contact', title: 'Contact', body: <p>Questions? Email <a href={`mailto:${EMAIL}`}>{EMAIL}</a>, or join us on <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">Discord</a>.</p> },
];

export default function CookiePolicyPage() {
  return (
    <InfoShell
      icon={Cookie}
      overline="Legal"
      title="Cookie Policy"
      subtitle="How AUSTWise uses cookies and browser storage"
      stats={[{ label: 'Sections', value: SECTIONS.length }, { label: 'Updated', value: 'Nov 2026' }]}
      sections={SECTIONS}
    />
  );
}
