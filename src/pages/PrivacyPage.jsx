import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ListOrdered, ShieldCheck } from 'lucide-react';
import './InfoPage.css';
import './TermsPage.css';
import LandingNav from '../features/landing/LandingNav';

const CONTACT_EMAIL = 'austwise59@gmail.com';

const SECTIONS = [
  {
    id: 'overview',
    title: 'Overview',
    body: <p>This policy explains what AUSTWise (austwise.vercel.app) collects, why, who else handles it, and what you can do about it. AUSTWise is a student-built project for AUST students and is not run by AUST. We do not sell your data and we do not show third-party ads.</p>,
  },
  {
    id: 'collect',
    title: 'What We Collect',
    body: (
      <>
        <ul className="tos-list">
          <li><strong>Account details:</strong> name, email, password (stored only as a bcrypt hash), department, batch, section, semester and role. If you sign in with Google, we receive your name, email and profile photo from Google.</li>
          <li><strong>Profile extras you choose to add:</strong> photo, blood group, company or designation, and social links such as LinkedIn, Facebook, WhatsApp or Discord.</li>
          <li><strong>Academic data:</strong> routine, CGPA and results, attendance, and courses you add or import.</li>
          <li><strong>Things you create:</strong> notes, Notebook pages, Life Planner tasks, TakaGeloKoi expenses, Bhara Koto and Mess Meal entries, saved passwords, uploads, community and Shadow posts, chats, marketplace and ToLet listings, reviews and feedback.</li>
          <li><strong>Technical data:</strong> your login cookie, settings and theme saved in your browser, push-notification subscriptions, your browser's user-agent, and the IP address used for rate limiting and abuse prevention.</li>
          <li><strong>Payments:</strong> plan, amount, status and the PipraPay transaction ID. We never receive your card or mobile-wallet details.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'use',
    title: 'How We Use It',
    body: (
      <ul className="tos-list">
        <li>Run the features you use: routine, GradeLab, attendance, trackers, chat and so on</li>
        <li>Show your profile in the student directory and community, within your privacy settings</li>
        <li>Send the notifications you turn on: in-app, push, Telegram and email (for example invites and password resets)</li>
        <li>Turn on Pro plans after PipraPay confirms a payment</li>
        <li>Keep AUSTWise safe: rate limits, moderation, and investigating reports of abuse</li>
        <li>Fix bugs and improve features, using the feedback you send us</li>
      </ul>
    ),
  },
  {
    id: 'visible',
    title: 'What Other Students Can See',
    body: <p>Your name, photo, department and batch appear on your profile, posts and listings. Your CGPA and attendance are shown only if you allow it in your privacy settings. Private tools such as Notebook, the Password Vault, TakaGeloKoi and Life Planner are visible only to you. Admins and moderators can see account details when they need to manage roles or handle reports.</p>,
  },
  {
    id: 'anonymous',
    title: 'Anonymous Spaces',
    body: <p>In Shadow and other anonymous features, other students do not see who you are. Your posts are still linked to your account on our side, so moderators can act on reports of harassment, threats or illegal content, and we may share that link if the law requires it.</p>,
  },
  {
    id: 'services',
    title: 'Services That Handle Your Data',
    body: (
      <>
        <p>We do not sell or rent your data. We share it only with the services that run AUSTWise, and only what each one needs:</p>
        <ul className="tos-list">
          <li><strong>Vercel</strong> hosts the website, and <strong>Render</strong> runs the server</li>
          <li><strong>Supabase</strong> hosts the PostgreSQL database where your data is stored</li>
          <li><strong>Google</strong> for Google sign-in and Google Classroom, if you connect them</li>
          <li><strong>Google Gemini</strong> and <strong>OpenAI</strong> process the text or images you send to AI features, such as the AI chat or reading a routine screenshot</li>
          <li><strong>PipraPay</strong> processes Pro payments</li>
          <li><strong>Telegram</strong> and your browser's push service deliver notifications you turn on</li>
        </ul>
        <p>Each service has its own privacy policy. We may also disclose data if the law requires it.</p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: <p>All traffic uses HTTPS. Passwords are hashed with bcrypt and are never stored in plain text. Your login is kept in an HttpOnly cookie that page scripts cannot read. Saved passwords in the Password Vault are encrypted with AES-256-GCM before they are stored. No system is perfectly secure, so use a strong, unique password and tell us right away if you think your account has been misused.</p>,
  },
  {
    id: 'retention',
    title: 'How Long We Keep It',
    body: <p>We keep your data while your account exists. Content you delete is removed from the app, but it may stay in backups for a short time. We keep payment records as long as we need them to handle disputes and keep accounts accurate. When your account is deleted, we remove or anonymise your personal data, except where we must keep it to handle abuse reports.</p>,
  },
  {
    id: 'rights',
    title: 'Your Choices and Rights',
    body: (
      <ul className="tos-list">
        <li>View and edit your profile and privacy settings in <Link to="/settings">Settings</Link></li>
        <li>Turn push, Telegram and email notifications on or off at any time</li>
        <li>Disconnect Google or Telegram whenever you like</li>
        <li>Ask for a copy of your data, or for your account and data to be deleted, by emailing <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from your account email. We aim to reply within 30 days.</li>
      </ul>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and Local Storage',
    body: <p>We use a login cookie and your browser's local storage to keep you signed in and remember settings such as your theme and layout. We do not use advertising or tracking cookies. See the <Link to="/cookie-policy">Cookie Policy</Link> for details.</p>,
  },
  {
    id: 'changes',
    title: 'Changes to This Policy',
    body: <p>When we change how we handle data, we update this page and the date at the top. For important changes we also post a notice in the app. If you keep using AUSTWise after an update, the new policy applies.</p>,
  },
  {
    id: 'contact',
    title: 'Contact',
    body: <p>Privacy questions or requests: email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or use the <Link to="/feedback">Feedback form</Link>.</p>,
  },
];

const pad = (n) => String(n).padStart(2, '0');

export default function PrivacyPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const ddRef = useRef(null);

  const jump = (id) => (e) => {
    e.preventDefault();
    setOpen(false);
    setCurrentId(id);
    document.getElementById(`tos-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ddRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const idx = SECTIONS.findIndex((s) => s.id === currentId);
  const current = idx >= 0 ? { ...SECTIONS[idx], n: idx + 1 } : null;

  return (
    <div className="info-page has-landing-nav">
      <LandingNav />
      <div className="tos-widget">
        <header className="tos-head">
          <div className="tos-head-title">
            <div className="tos-head-tile" aria-hidden="true"><ShieldCheck size={20} strokeWidth={2.1} /></div>
            <div className="tos-head-text">
              <span className="tos-head-overline">Legal</span>
              <h1 className="tos-head-name">Privacy Policy</h1>
              <span className="tos-head-subtitle">What we collect and how we use it</span>
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

        <div className="tos-main-grid is-dd">
          <nav className="tos-dd" ref={ddRef} aria-label="Contents">
            <button
              type="button"
              className="tos-dd-btn"
              aria-expanded={open}
              aria-controls="tos-dd-menu"
              onClick={() => setOpen((v) => !v)}
            >
              <ListOrdered size={14} className="tos-dd-icon" />
              <span className="tos-dd-label">Contents</span>
              <span className="tos-dd-current">
                {current ? <><span className="tos-num">{pad(current.n)}</span>{current.title}</> : `${SECTIONS.length} sections`}
              </span>
              <ChevronDown size={15} className="tos-dd-caret" />
            </button>
            {open && (
              <ol className="tos-toc-list tos-dd-menu" id="tos-dd-menu">
                {SECTIONS.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#tos-${s.id}`}
                      onClick={jump(s.id)}
                      aria-current={current?.id === s.id ? 'true' : undefined}
                    >
                      <span className="tos-num">{pad(i + 1)}</span>
                      <span className="tos-toc-name">{s.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            )}
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
