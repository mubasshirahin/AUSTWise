import { useEffect, useRef } from 'react';
import {
  Info, Mail, AtSign, ArrowUpRight, FolderGit2, GraduationCap, MapPin,
  UserRound, Layers,
} from 'lucide-react';
import '../daily-life/DailyMasthead.css';
import './AboutUs.css';

// Credits — developer profile in the AUSTWise house style
// (.claude/skills/skill-style). Motion reuses the site's own keyframes from
// index.css (fadeInUp with a 50ms stagger, scaleIn, float, pulse).

const DEV = {
  name: 'Mubasshir Mehedi',
  initials: 'MM',
  title: 'CSE Undergraduate · Web & App Developer',
  email: 'erumthakbe@gmail.com',
  batch: 'Quanta 52',
  department: 'CSE',
};

const SOCIALS = [
  { label: 'GitHub',   href: 'https://github.com/erumthakbe' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/erumthakbe' },
  { label: 'Facebook', href: 'https://www.facebook.com/erumthakbe' },
];

const ABOUT = [
  'Computer Science & Engineering student at Ahsanullah University of Science & Technology, building web and mobile apps that make student life a little easier.',
  'AUSTWise brings academics, daily planning, productivity and community tools for AUST students into one place. Outside of code I enjoy games, taking electronics apart, and nature photography.',
];

const PROJECTS = [
  { name: 'AUSTWise', kind: 'Web platform', here: true, desc: 'All-in-one campus platform for AUST students — academics, daily life, productivity and community.', stack: ['React', 'Node.js', 'Vite', 'WebSockets'], link: 'https://github.com/mubasshirahin/AUSTWise' },
  { name: 'TakaGeloKoi', kind: 'Expense tracker', desc: 'Personal expense tracker built around a student\'s monthly budget.', stack: ['React', 'Express', 'MongoDB'], link: 'https://github.com/mubasshirahin/TakaGeloKoi-' },
  { name: 'ToLet-Mama', kind: 'Housing finder', desc: 'Mess and flat finder for students looking for housing near AUST.', stack: ['React', 'Tailwind', 'Framer Motion'], link: 'https://github.com/mubasshirahin/ToLet-Mama' },
  { name: 'Pixel Alchemist', kind: '2D puzzle game', desc: 'Adventure puzzle game where players merge elements to guide a character home.', stack: ['C', 'C++', 'iGraphics'], link: 'https://github.com/mubasshirahin/PIXEL-ALCHEMIST' },
  { name: 'TimelyDose', kind: 'Mobile app', desc: 'Medicine reminders and personal health tracking.', stack: ['Flutter', 'Dart', 'Firebase'], link: 'https://github.com/mubasshirahin/TimelyDose' },
  { name: 'EduConnect', kind: 'Web app', desc: 'Connects students with the study resources they need.', stack: ['React', 'Vite'], link: 'https://github.com/mubasshirahin/EduConnect' },
];

const EXPERTISE = [
  { area: 'Frontend', items: ['React', 'JavaScript', 'Vite', 'CSS', 'Tailwind'] },
  { area: 'Backend', items: ['Node.js', 'Express', 'WebSockets'] },
  { area: 'Data', items: ['PostgreSQL', 'MongoDB', 'Firebase'] },
  { area: 'Mobile', items: ['Flutter', 'Dart'] },
  { area: 'Other', items: ['C', 'C++', 'Chart.js', 'PDF.js'] },
];

const EDUCATION = [
  { period: '2024 – 2028', degree: 'BSc in Computer Science & Engineering', school: 'Ahsanullah University of Science & Technology', detail: 'CGPA 3.64 / 4.00', ongoing: true },
  { period: '2023', degree: 'Higher Secondary Certificate', school: 'Govt. City College, Chattogram', detail: 'GPA 5.00 / 5.00' },
  { period: '2021', degree: 'Secondary School Certificate', school: 'Halishahar Cantonment Public School & College', detail: 'GPA 5.00 / 5.00' },
];

const prefersReduced = () => typeof window !== 'undefined'
  && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function CardTitle({ icon: Icon, children, aside }) {
  return (
    <div className="crd-card-head">
      <h3 className="crd-card-title"><Icon size={14} aria-hidden="true" />{children}</h3>
      {aside && <span className="crd-card-aside">{aside}</span>}
    </div>
  );
}

export default function AboutUs() {
  const rootRef = useRef(null);
  const year = new Date().getFullYear();

  // Scroll reveal — same fadeInUp + 50ms stagger the dashboard uses.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const items = root.querySelectorAll('.crd-reveal');
    if (prefersReduced() || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-in'));
      return undefined;
    }
    root.classList.add('is-anim');
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); obs.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    items.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const d = (n) => ({ '--d': n });

  return (
    <div className="crd-widget" ref={rootRef}>
      <header className="dl-head crd-head crd-reveal" style={d(0)}>
        <div className="dl-head-title">
          <div className="dl-head-tile" aria-hidden="true"><Info size={20} strokeWidth={2.1} /></div>
          <div className="dl-head-text">
            <span className="dl-head-overline">Settings</span>
            <h2 className="dl-head-name">Credits</h2>
            <span className="dl-head-subtitle">The developer behind AUSTWise</span>
          </div>
        </div>
        <dl className="dl-head-stats">
          <div className="dl-head-stat"><dt>Projects</dt><dd>{PROJECTS.length}</dd></div>
          <div className="dl-head-stat"><dt>Features</dt><dd>30+</dd></div>
          <div className="dl-head-stat"><dt>Batch</dt><dd className="is-small">{DEV.batch}</dd></div>
        </dl>
      </header>

      {/* ── Profile ── */}
      <section className="crd-card crd-hero crd-reveal" style={d(1)} aria-label="Developer">
        <div className="crd-hero-main">
          <div className="crd-avatar" aria-hidden="true">{DEV.initials}</div>
          <div className="crd-hero-text">
            <span className="crd-overline">Designed &amp; developed by</span>
            <h3 className="crd-hero-name">{DEV.name}</h3>
            <p className="crd-hero-role">{DEV.title}</p>
            <ul className="crd-hero-meta">
              <li><GraduationCap size={13} aria-hidden="true" />{DEV.department} · {DEV.batch}</li>
              <li><MapPin size={13} aria-hidden="true" />AUST, Dhaka</li>
            </ul>
          </div>
        </div>
        <div className="crd-hero-actions">
          <a className="crd-btn crd-btn-primary" href={`mailto:${DEV.email}`}>
            <Mail size={14} aria-hidden="true" /> Get in touch
          </a>
          <div className="crd-socials">
            {SOCIALS.map((s) => (
              <a key={s.label} className="crd-social" href={s.href} target="_blank" rel="noopener noreferrer">
                <AtSign size={12} aria-hidden="true" />{s.label}
                <ArrowUpRight size={12} aria-hidden="true" className="crd-social-arrow" />
              </a>
            ))}
          </div>
        </div>
      </section>

      <div className="crd-grid">
        <div className="crd-col">
          <section className="crd-card crd-reveal" style={d(0)}>
            <CardTitle icon={UserRound}>About</CardTitle>
            <div className="crd-about">
              {ABOUT.map((p) => <p key={p.slice(0, 16)}>{p}</p>)}
            </div>
          </section>

          <section className="crd-card crd-reveal" style={d(1)}>
            <CardTitle icon={FolderGit2} aside={`${PROJECTS.length} projects`}>Projects</CardTitle>
            <div className="crd-projects">
              {PROJECTS.map((p, i) => (
                <a key={p.name} className={`crd-project crd-reveal${p.here ? ' is-here' : ''}`} style={d(i)} href={p.link} target="_blank" rel="noopener noreferrer">
                  <span className="crd-project-top">
                    <span className="crd-project-tile" aria-hidden="true">{p.name[0]}</span>
                    <span className="crd-project-head">
                      <span className="crd-project-name">{p.name}</span>
                      <span className="crd-project-kind">{p.kind}</span>
                    </span>
                    {p.here
                      ? <span className="crd-chip is-accent">This app</span>
                      : <ArrowUpRight size={15} aria-hidden="true" className="crd-project-arrow" />}
                  </span>
                  <span className="crd-project-desc">{p.desc}</span>
                  <span className="crd-tags">
                    {p.stack.map((t) => <span key={t} className="crd-tag">{t}</span>)}
                  </span>
                </a>
              ))}
            </div>
          </section>
        </div>

        <aside className="crd-col crd-rail">
          <section className="crd-card crd-reveal" style={d(0)}>
            <CardTitle icon={Layers}>Tech stack</CardTitle>
            <dl className="crd-expertise">
              {EXPERTISE.map((g, gi) => (
                <div key={g.area} className="crd-exp-row">
                  <dt>{g.area}</dt>
                  <dd>
                    {g.items.map((t, i) => <span key={t} className="crd-stack-chip" style={d(gi * 2 + i)}>{t}</span>)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="crd-card crd-reveal" style={d(1)}>
            <CardTitle icon={GraduationCap}>Education</CardTitle>
            <ol className="crd-edu">
              {EDUCATION.map((e) => (
                <li key={e.period} className="crd-edu-row">
                  <span className="crd-edu-dot" aria-hidden="true" />
                  <div className="crd-edu-body">
                    <span className="crd-edu-period">{e.period}</span>
                    <span className="crd-edu-degree">{e.degree}</span>
                    <span className="crd-edu-school">{e.school}</span>
                    <span className="crd-edu-detail">
                      {e.detail}
                      {e.ongoing && <span className="crd-chip is-accent">Ongoing</span>}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <p className="crd-foot crd-reveal" style={d(0)}>
        © {year} AUSTWise · Thanks to every AUST student who uses it and shares feedback.
      </p>
    </div>
  );
}
