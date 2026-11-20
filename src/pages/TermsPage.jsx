import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, ListOrdered } from 'lucide-react';
import './InfoPage.css';
import './TermsPage.css';
import LandingNav from '../features/landing/LandingNav';

const CONTACT_EMAIL = 'austwise59@gmail.com';

const SECTIONS = [
  {
    id: 'acceptance',
    title: 'Acceptance of Terms',
    body: <p>By creating an account or using AUSTWise (austwise.vercel.app), you agree to these Terms of Service and to our <Link to="/privacy">Privacy Policy</Link> and <Link to="/cookie-policy">Cookie Policy</Link>. If you do not agree, please do not use the platform.</p>,
  },
  {
    id: 'service',
    title: 'What AUSTWise Is',
    body: (
      <>
        <p>AUSTWise is a student-built campus companion for Ahsanullah University of Science and Technology (AUST). It is an independent project and is not run or endorsed by AUST. It includes, among others:</p>
        <ul className="tos-list">
          <li>Academics: Dashboard, GradeLab and CGPA tools, Routine, Attendance, Question Bank, Cheat Sheets and the Resource Vault</li>
          <li>Campus: campus and floor maps, Free Rooms, Canteen Menu, Bus Tracker and Library Pulse</li>
          <li>Daily life: TakaGeloKoi, Bhara Koto, Life Planner, Mess Meal and Cover Page</li>
          <li>Community: Community, ConnectBox, Chat, Clubs Hub, Lost &amp; Found, AW Market, ToLet Mama and the anonymous Shadow space</li>
          <li>Study and fun: Workspace, Notebook, Study Time, Zen study room, Code Pulse, Gaming Zone and Chill Zone</li>
        </ul>
        <p>Features may be added, changed or removed at any time. Some are still in beta.</p>
      </>
    ),
  },
  {
    id: 'accounts',
    title: 'Accounts',
    body: <p>You can sign up with email or with Google. Give accurate details, keep your login private, and use one account per person. You are responsible for anything done from your account. Roles such as CR/SR or moderator are approved by the AUSTWise team and can be withdrawn if misused. We may suspend or delete accounts that break these terms.</p>,
  },
  {
    id: 'use',
    title: 'Acceptable Use',
    body: (
      <>
        <p>You agree not to:</p>
        <ul className="tos-list">
          <li>Use AUSTWise for anything unlawful or against AUST rules, including sharing exam papers or answers you are not allowed to share</li>
          <li>Post false, hateful, sexual, harmful or defamatory content, including in Shadow, Rumour or Real and Chat</li>
          <li>Use anonymous features to harass, threaten, dox or impersonate anyone</li>
          <li>Access another user's account or data, or try to get around roles and permissions</li>
          <li>Scrape, spam or overload the platform with bots or scripts</li>
          <li>Upload malware or interfere with how the platform runs</li>
        </ul>
      </>
    ),
  },
  {
    id: 'content',
    title: 'Your Content',
    body: <p>You own what you post: notes, files, posts, reviews, listings and messages. By posting it on shared spaces you let AUSTWise store and show it to other users so the feature works. Anonymous posts are hidden from other students, but they are not hidden from moderators when abuse is reported, and we can remove content or suspend accounts. Private tools such as Notebook, TakaGeloKoi and Life Planner are visible only to you.</p>,
  },
  {
    id: 'marketplace',
    title: 'Marketplace and Listings',
    body: <p>AW Market, ToLet Mama and Lost &amp; Found let students list items, rooms and found things. AUSTWise does not check, guarantee or take part in any deal. Payments, meetups and disputes are between the people involved. Meet in safe places and never pay in advance to someone you have not verified.</p>,
  },
  {
    id: 'pro',
    title: 'AUSTWise Pro and Payments',
    body: (
      <>
        <p>Node is free and keeps all core features. Paid plans add extras such as ad-free pages, premium themes, advanced analytics and AI tools:</p>
        <ul className="tos-list">
          <li><strong>Helix</strong>: <span className="tos-tk">৳</span>50 for 30 days. It does not renew. Your account goes back to Node when it ends.</li>
          <li><strong>Apex</strong>: <span className="tos-tk">৳</span>500 for one year.</li>
        </ul>
        <p>Payments are handled by PipraPay, and the plan turns on once the payment is confirmed. We do not store your card or mobile-wallet details. Unused days are not refunded or credited, including when you move from Helix to Apex. If a payment went through but your plan did not turn on, contact us with the transaction ID. See <Link to="/pro">Pro plans</Link> for the current details.</p>
      </>
    ),
  },
  {
    id: 'integrations',
    title: 'Third-Party Services',
    body: <p>Some features rely on other services, such as Google sign-in and Google Classroom, PipraPay for payments, and push notifications. Their own terms and privacy policies apply, and AUSTWise is not responsible for their availability or how they handle your data. You can disconnect them at any time.</p>,
  },
  {
    id: 'ip',
    title: 'Intellectual Property',
    body: <p>The AUSTWise name, logo, design and code belong to the AUSTWise team. Course material, question papers and other files shared by users remain the property of their owners. If you believe something on AUSTWise infringes your rights, contact us and we will review it and take it down if needed.</p>,
  },
  {
    id: 'liability',
    title: 'Disclaimer and Liability',
    body: <p>AUSTWise is provided "as is". Data such as routines, CGPA calculations, bus times, canteen menus and free rooms may be wrong or out of date. Always check official AUST notices before making decisions. To the extent the law allows, AUSTWise is not liable for losses that come from using the platform, including downtime or lost data.</p>,
  },
  {
    id: 'changes',
    title: 'Changes to These Terms',
    body: <p>We may update these terms as AUSTWise grows. When the changes are important we will tell you through a notice or notification in the app, and the date at the top of this page will change. If you keep using AUSTWise after an update, you accept the new terms.</p>,
  },
  {
    id: 'contact',
    title: 'Contact',
    body: <p>Questions, reports or takedown requests: use the <Link to="/feedback">Feedback form</Link> or email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>,
  },
];

const pad = (n) => String(n).padStart(2, '0');

export default function TermsPage() {
  const navigate = useNavigate();
  const jump = (id) => (e) => {
    e.preventDefault();
    document.getElementById(`tos-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="info-page has-landing-nav">
      <LandingNav />
      <div className="tos-widget">
        <header className="tos-head">
          <div className="tos-head-title">
            <div className="tos-head-tile" aria-hidden="true"><FileText size={20} strokeWidth={2.1} /></div>
            <div className="tos-head-text">
              <span className="tos-head-overline">Legal</span>
              <h1 className="tos-head-name">Terms of Service</h1>
              <span className="tos-head-subtitle">The rules for using AUSTWise</span>
            </div>
          </div>
          <dl className="tos-head-stats">
            <div className="tos-head-stat"><dt>Sections</dt><dd>{SECTIONS.length}</dd></div>
            <div className="tos-head-stat"><dt>Updated</dt><dd>Nov 2026</dd></div>
          </dl>
          <button type="button" className="tos-back" onClick={() => navigate('/')}>
            <ArrowLeft size={13} /> Home
          </button>
        </header>

        <div className="tos-main-grid">
          <nav className="tos-card tos-toc" aria-label="Contents">
            <h2 className="tos-card-title"><ListOrdered size={14} /> Contents</h2>
            <ol className="tos-toc-list">
              {SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <a href={`#tos-${s.id}`} onClick={jump(s.id)}>
                    <span className="tos-num">{pad(i + 1)}</span>
                    <span className="tos-toc-name">{s.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="tos-sections">
            {SECTIONS.map((s, i) => (
              <section key={s.id} id={`tos-${s.id}`} className="tos-card tos-section">
                <h2 className="tos-section-title">
                  <span className="tos-num">{pad(i + 1)}</span>
                  {s.title}
                </h2>
                <div className="tos-section-body">{s.body}</div>
              </section>
            ))}
          </div>
        </div>
      </div>
      <div className="tos-footer">&copy; {new Date().getFullYear()} AUSTWise. All rights reserved.</div>
    </div>
  );
}
