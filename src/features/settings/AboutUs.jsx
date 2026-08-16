import { useEffect, useRef, useState } from 'react';
import {
  Mail, FileText, Braces, ScrollText, Cpu, Terminal, Zap, ArrowRight, GitCommit,
  GraduationCap, FolderGit2
} from 'lucide-react';
import './AboutUs.css';

// ═══════════════════════════════════════════════════════════════
//  FACTUAL SUBJECT DATA — Mubasshir Mehedi
// ═══════════════════════════════════════════════════════════════
const DEV = {
  name: 'Mubasshir Mehedi',
  handle: 'mubasshir_mehedi',
  title: 'Just a student',
  tagline: 'CSE @ AUST · nothing special, really',
  email: 'erumthakbe@gmail.com',
  github: 'erumthakbe',
  facebook: 'erumthakbe',
  linkedin: 'erumthakbe',
  instagram: 'erumthakbe',
  batch: 'Quanta 52',
  department: 'CSE',
  university: 'Ahsanullah University of Science & Technology',
};

// ─── File tree — one entry per content section ───
const FILES = [
  { id: 'about',      file: 'about.md',       ext: 'md',   icon: Terminal   },
  { id: 'stats',      file: 'stats.json',     ext: 'json', icon: Braces     },
  { id: 'story',      file: 'story.md',       ext: 'md',   icon: FileText   },
  { id: 'education',  file: 'education.yml',  ext: 'yml',  icon: GraduationCap },
  { id: 'projects',   file: 'projects.json',  ext: 'json', icon: FolderGit2 },
  { id: 'facts',      file: 'facts.log',      ext: 'log',  icon: ScrollText },
  { id: 'stack',      file: 'stack.cfg',      ext: 'cfg',  icon: Cpu        },
  { id: 'contact',    file: 'contact.sh',     ext: 'sh',   icon: Terminal   },
  { id: 'collab',     file: 'collab.exe',     ext: 'exe',  icon: Zap        },
];

const BOOT_LINES = [
  'AUSTWise portfolio v2.1.0',
  '> initializing shell .......... OK',
  '> reading subject.json ........ OK',
  '> mounting /dev/ideas ......... OK',
  '> shell ready',
];

const TERMINAL_SCRIPT = `$ whoami
${DEV.handle}

$ cat about.txt
I chose CSE cz it seemed cool. Now my code has more red lines than my Discord DMs. When I'm not sleeping, I'm either fighting with my IDE,getting lost in a new game,breaking some perfectly good electronics to see what's inside,or just clicking pictures of nature to prove to my friends that I actually go outside.

$ cat work.txt
Built a few things. AUSTWise is one of them. You're on it.

$ cat skills.txt
I sure know how to make AI dance to my tune.

[Core Competencies]
├── AI Prompting & Googling ─── 100% (Expert)
├── Handling IDE Red Lines ─────  95% (Advanced)
├── Understanding my own code ──  15% (Beginner)
└── Vibe Management ───────── 100% (God Tier)

$ cat status.txt
Doing things. Quietly.`;

const STATS = [
  { key: 'months_of_dev',     value: 12,  suffix: '+' },
  { key: 'features_built',    value: 30,  suffix: '+ (somehow)' },
  { key: 'solo_carrying',     raw: true },
  { key: 'bugs_created',      value: 999, suffix: '+' },
  { key: 'existential_dread', value: 100, suffix: '%' },
];

const EDUCATION = [
  {
    degree: 'BSc in Computer Science & Engineering',
    school: 'Ahsanullah University of Science & Technology',
    period: '2024 — 2028',
    batch: 'Quanta 52',
    status: 'ongoing',
    detail: 'CGPA 3.64/4.0',
  },
  {
    degree: 'Higher Secondary Certificate (HSC)',
    school: 'Govt. City College, Chattogram',
    period: '2023',
    batch: 'Science Group',
    status: 'completed',
    detail: 'GPA 5.00/5.00',
  },
  {
    degree: 'Secondary School Certificate (SSC)',
    school: 'Halishahar Cantonment Public School & College',
    period: '2021',
    batch: 'Science Group',
    status: 'completed',
    detail: 'GPA 5.00/5.00',
  },
];

const PROJECTS = [
  {
    name: 'AUSTWise',
    desc: 'A small academic platform for AUSTians. You\'re looking at it. I built it alone — not that I count.',
    stack: ['React', 'Node.js', 'Vite', 'WebSockets'],
    link: 'https://github.com/mubasshirahin/AUSTWise.git',
  },
  {
    name: 'TakaGeloKoi-',
    desc: 'The ultimate question every university student asks by the 10th of every month. Expense tracking made self-deprecating.',
    stack: ['React', 'Express', 'MongoDB', 'Vite'],
    link: 'https://github.com/mubasshirahin/TakaGeloKoi-.git',
  },
  {
    name: 'ToLet-Mama',
    desc: 'Mess or flat hunting near AUST? Let Mama handle the grind while you complain about rent prices.',
    stack: ['React', 'Tailwind CSS', 'Vite', 'Framer Motion'],
    link: 'https://github.com/mubasshirahin/ToLet-Mama.git',
  },
  {
    name: 'PIXEL-ALCHEMIST',
    desc: 'A 2D adventure puzzle game built with the iGraphics library — merge elements to guide a lost character home.',
    stack: ['C', 'C++', 'iGraphics'],
    link: 'https://github.com/mubasshirahin/PIXEL-ALCHEMIST.git',
  },
  {
    name: 'TimelyDose',
    desc: 'A medicine reminder and health tracker. Because remembering prescriptions shouldn\'t require another brain cell.',
    stack: ['Flutter', 'Dart', 'Firebase'],
    link: 'https://github.com/mubasshirahin/TimelyDose.git',
  },
  {
    name: 'EduConnect',
    desc: 'Bridging the gap between students and resources before the semester finals panic drops in.',
    stack: ['React', 'Vite'],
    link: 'https://github.com/mubasshirahin/EduConnect.git',
  },
];

const STORY = [
  'I\'d love to tell you there\'s a whole team behind this, but it\'s just me, an overstretched IDE, and an AI assistant that\'s probably tired of my prompts.',
  'AUSTWise is what happens when you combine academic panic with an absolute refusal to do things manually. It works, it\'s live, and it\'s saving us all some clicks. Scroll down to see the rest of my digital chaos—or don\'t, I\'m not the boss of you.',
];

const FACTS = [
  { hash: '4f2a9c1', msg: 'Built AUSTWise alone. Yes, alone. Moving on.' },
  { hash: 'b8e7d02', msg: 'Fixes bugs at 3 AM so you don\'t have to know they existed' },
  { hash: '91c3f5a', msg: 'Doesn\'t brag. The code does enough talking.' },
  { hash: 'd1a6e84', msg: 'Has never lost a merge conflict. (Not that I keep count.)' },
  { hash: 'e2c9a77', msg: 'Writes code, ships features, goes to class. In that order.' },
  { hash: 'f7b21a5', msg: 'Coffee ☕ and deadlines — the fuel behind AUSTWise' },
];

const STACK = [
  { key: 'react',        version: '^18.3.1' },
  { key: 'vite',         version: '^5.4.0'  },
  { key: 'javascript',   version: 'ES2024'  },
  { key: 'css3',         version: 'grid+flex'},
  { key: 'node.js',      version: '>=18'    },
  { key: 'chart.js',     version: '^4.4.0'  },
  { key: 'pdf.js',       version: '^3.11.0' },
  { key: 'mermaid',      version: '^10.9.0' },
];

const CONTACT = [
  { method: 'GET',  path: '/email',    code: '200 OK', value: 'erumthakbe@gmail.com' },
  { method: 'GET',  path: '/github',   code: '200 OK', value: '@erumthakbe' },
  { method: 'GET',  path: '/linkedin', code: '200 OK', value: '@erumthakbe' },
  { method: 'GET',  path: '/facebook', code: '200 OK', value: '@erumthakbe' },
  { method: 'GET',  path: '/resume',   code: '200 OK', value: 'open to requests' },
];

const CODE_SYMBOLS = [
  { char: '{', left: '5%',  delay: '0s',   dur: '24s' },
  { char: '}', left: '13%', delay: '-5s',  dur: '28s' },
  { char: '<', left: '22%', delay: '-10s', dur: '26s' },
  { char: '>', left: '31%', delay: '-2s',  dur: '30s' },
  { char: '0', left: '41%', delay: '-7s',  dur: '23s' },
  { char: '1', left: '52%', delay: '-12s', dur: '27s' },
  { char: ';', left: '61%', delay: '-4s',  dur: '25s' },
  { char: '/', left: '71%', delay: '-9s',  dur: '29s' },
  { char: '*', left: '81%', delay: '-13s', dur: '26s' },
  { char: '=', left: '90%', delay: '-6s',  dur: '28s' },
];

const reduced = typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── Animated count-up — numbers rise when scrolled into view ───
function CountUp({ value, suffix }) {
  const [n, setN] = useState(reduced ? value : 0);
  const ref = useRef(null);
  const done = useRef(false);

  useEffect(() => {
    if (reduced || done.current) return;
    const obs = new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !done.current) {
        done.current = true;
        const start = performance.now();
        const dur = 1500;
        const tick = (now) => {
          const p = Math.min((now - start) / dur, 1);
          setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [value]);

  return <span ref={ref}>{n}{suffix}</span>;
}

export default function AboutUs() {
  const [bootLineIdx, setBootLineIdx] = useState(reduced ? BOOT_LINES.length : 0);
  const [booted, setBooted] = useState(reduced);
  const [activeFile, setActiveFile] = useState('about');
  const [scrollPct, setScrollPct] = useState(0);
  const [typed, setTyped] = useState(reduced ? TERMINAL_SCRIPT : '');
  const rootRef = useRef(null);
  const termRef = useRef(null);
  const typedLen = useRef(reduced ? TERMINAL_SCRIPT.length : 0);

  // ─── Boot sequence ───
  useEffect(() => {
    if (bootLineIdx < BOOT_LINES.length) {
      const t = setTimeout(() => setBootLineIdx((i) => i + 1), 210);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setBooted(true), 520);
    return () => clearTimeout(t);
  }, [bootLineIdx]);

  // ─── Terminal typing — one continuous keystroke stream ───
  useEffect(() => {
    if (!booted || reduced) return;
    const timer = setInterval(() => {
      typedLen.current += 1;
      setTyped(TERMINAL_SCRIPT.slice(0, typedLen.current));
      if (typedLen.current >= TERMINAL_SCRIPT.length) clearInterval(timer);
    }, 22);
    return () => clearInterval(timer);
  }, [booted]);

  // ─── Scroll spy + panel reveal ───
  useEffect(() => {
    if (!booted) return;
    const sections = rootRef.current?.querySelectorAll('.cred-section');
    if (!sections) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          setActiveFile(entry.target.dataset.file);
        }
      });
    }, { root: rootRef.current, rootMargin: '-30% 0px -55% 0px', threshold: 0 });
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [booted]);

  // ─── Top progress bar — tracks this panel's own scroll ───
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onScroll = () => {
      const h = el.scrollHeight - el.clientHeight;
      setScrollPct(h > 0 ? Math.min(100, (el.scrollTop / h) * 100) : 0);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // ─── 3D tilt on the terminal window ───
  const onTermMove = (e) => {
    if (reduced) return;
    const el = termRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
    el.style.setProperty('--tx', nx.toFixed(2));
    el.style.setProperty('--ty', ny.toFixed(2));
  };
  const resetTerm = () => {
    const el = termRef.current;
    if (!el) return;
    el.style.setProperty('--tx', '0');
    el.style.setProperty('--ty', '0');
  };

  // ─── Magnetic collab button ───
  const onCollabMove = (e) => {
    if (reduced) return;
    const btn = e.currentTarget;
    const r = btn.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    btn.style.transform = `translate(${(dx * 0.28).toFixed(1)}px, ${(dy * 0.28).toFixed(1)}px)`;
  };
  const resetCollab = (e) => { e.currentTarget.style.transform = ''; };

  const activeIdx = FILES.findIndex((f) => f.id === activeFile);
  const activeMeta = FILES[activeIdx] || FILES[0];

  return (
    <div className={`cred-root ${booted ? 'is-booted' : 'is-booting'}`} ref={rootRef}>
      {/* ─── Atmosphere ─── */}
      <div className="cred-bg" aria-hidden="true">
        <div className="cred-aurora cred-aurora--gold" />
        <div className="cred-aurora cred-aurora--cyan" />
        <div className="cred-aurora cred-aurora--violet" />
        <div className="cred-symbols">
          {CODE_SYMBOLS.map((s, i) => (
            <span
              key={i}
              className="cred-symbol"
              style={{ left: s.left, animationDelay: s.delay, animationDuration: s.dur }}
            >
              {s.char}
            </span>
          ))}
        </div>
        <div className="cred-scanlines" />
        <div className="cred-grain" />
      </div>

      {/* ─── Top scroll progress ─── */}
      <div className="cred-progress"><i style={{ width: `${scrollPct}%` }} /></div>

      {/* ─── Boot overlay ─── */}
      <div className={`cred-boot ${booted ? 'is-done' : ''}`} aria-hidden={booted}>
        <div className="cred-boot-card">
          <div className="cred-boot-head">AUSTWise — portfolio session</div>
          <div className="cred-boot-body">
            {BOOT_LINES.slice(0, bootLineIdx).map((l, i) => (
              <div key={i} className="cred-boot-line">{l}</div>
            ))}
            <span className="cred-cursor" />
          </div>
        </div>
      </div>

      {/* ─── Sidebar file tree (desktop) ─── */}
      <aside className="cred-sidebar">
        <div className="cred-side-title">
          <span className="cred-side-dot" />
          AUSTWise<span className="cred-side-at">@</span>dev
        </div>
        <nav className="cred-tree">
          {FILES.map((f, i) => (
            <a
              key={f.id}
              href={`#${f.id}`}
              className={`cred-tree-item ${
                activeFile === f.id ? 'is-active'
                : i < activeIdx ? 'is-passed'
                : ''
              }`}
            >
              <i className="cred-tree-dot" />
              <f.icon size={13} className="cred-tree-icon" />
              {f.file}
            </a>
          ))}
        </nav>
        <div className="cred-side-foot">~/workspace · nothing to see here</div>
      </aside>

      {/* ─── Mobile "currently viewing" pill ─── */}
      <div className="cred-mobile-pill">
        <span className="cred-mobile-dot" />
        <span className="cred-mobile-label">viewing</span>
        <b>{activeMeta.file}</b>
      </div>

      {/* ─── Main content ─── */}
      <main className="cred-main">
        {/* about.md → terminal */}
        <section id="about" className="cred-section" data-file="about">
          <div className="cred-file-head"><FileText size={14} /><span>about.md</span></div>
          <div
            className="term-window cred-window"
            ref={termRef}
            onMouseMove={onTermMove}
            onMouseLeave={resetTerm}
          >
            <div className="term-bar">
              <span className="term-title">{DEV.handle}@austwise: ~</span>
            </div>
            <pre className="term-body">{typed}<span className="cred-cursor" /></pre>
          </div>
        </section>

        {/* stats.json → JSON block */}
        <section id="stats" className="cred-section" data-file="stats">
          <div className="cred-file-head"><Braces size={14} /><span>stats.json</span></div>
          <div className="json-window cred-window">
            <div className="json-line"><span className="json-ln">1</span><span className="json-brace">{'{'}</span></div>
            {STATS.map((s, i) => (
              <div key={s.key} className="json-line">
                <span className="json-ln">{i + 2}</span>
                <span className="json-key">"{s.key}"</span>
                <span className="json-punct">: </span>
                {s.raw !== undefined ? (
                  <span className="json-bool">{String(s.raw)}</span>
                ) : (
                  <span className="json-num"><CountUp value={s.value} suffix={s.suffix} /></span>
                )}
                {i < STATS.length - 1 && <span className="json-punct">,</span>}
              </div>
            ))}
            <div className="json-line"><span className="json-ln">{STATS.length + 2}</span><span className="json-brace">{'}'}</span></div>
          </div>
        </section>

        {/* education.yml → academic history */}
        <section id="education" className="cred-section" data-file="education">
          <div className="cred-file-head"><GraduationCap size={14} /><span>education.yml</span></div>
          <div className="yml-window cred-window">
            <div className="yml-head"># Academic history — {DEV.name}</div>
            {EDUCATION.map((e) => (
              <div key={e.period} className="edu-card">
                <div className="edu-dot" />
                <div className="edu-body">
                  <div className="edu-row">
                    <span className="edu-degree">{e.degree}</span>
                    <span className={`edu-status edu-status--${e.status}`}>{e.status}</span>
                  </div>
                  <div className="edu-meta">
                    <span className="edu-school">{e.school}</span>
                    <span className="edu-period">· {e.period}</span>
                    <span className="edu-batch">· {e.batch}</span>
                  </div>
                  <p className="edu-detail">{e.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* projects.json → project cards */}
        <section id="projects" className="cred-section" data-file="projects">
          <div className="cred-file-head"><FolderGit2 size={14} /><span>projects.json</span></div>
          <div className="proj-grid cred-window">
            {PROJECTS.map((p) => (
              <div key={p.name} className="proj-card">
                <div className="proj-head">
                  <FolderGit2 size={16} className="proj-icon" />
                  <span className="proj-name">{p.name}</span>
                </div>
                <p className="proj-desc">{p.desc}</p>
                <div className="proj-stack">
                  {p.stack.map((t) => <span key={t} className="proj-tag">{t}</span>)}
                </div>
                <div className="proj-meta">
                  {p.stars != null && <span className="proj-stat">★ {p.stars}</span>}
                  {p.forks != null && <span className="proj-stat">⑂ {p.forks}</span>}
                  <a className="proj-link" href={p.link} target="_blank" rel="noopener noreferrer">{p.link.replace(/^https?:\/\/github\.com\//, '')}</a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* story.md → markdown */}
        <section id="story" className="cred-section" data-file="story">
          <div className="cred-file-head"><FileText size={14} /><span>story.md</span></div>
          <div className="md-window cred-window">
            <h2 className="md-h"># Under the <span className="md-accent">hood.</span></h2>
            {STORY.map((p, i) => <p key={i} className="md-p">{p}</p>)}
          </div>
        </section>

        {/* facts.log → git log */}
        <section id="facts" className="cred-section" data-file="facts">
          <div className="cred-file-head"><ScrollText size={14} /><span>facts.log</span></div>
          <div className="log-window cred-window">
            <div className="log-head">git log --oneline --author={DEV.handle}</div>
            {FACTS.map((f) => (
              <div key={f.hash} className="log-line">
                <span className="log-hash">{f.hash}</span>
                <span className="log-msg">{f.msg}</span>
              </div>
            ))}
          </div>
        </section>

        {/* stack.cfg → package.json deps */}
        <section id="stack" className="cred-section" data-file="stack">
          <div className="cred-file-head"><Cpu size={14} /><span>stack.cfg</span></div>
          <div className="cfg-window cred-window">
            <div className="cfg-title">"dependencies": {'{'}</div>
            {STACK.map((d, i) => (
              <div key={d.key} className="cfg-line">
                <span className="cfg-key">"{d.key}"</span>
                <span className="cfg-punct">: </span>
                <span className="cfg-ver">"{d.version}"</span>
                {i < STACK.length - 1 && <span className="cfg-punct">,</span>}
              </div>
            ))}
            <div className="cfg-title">{'}'}</div>
          </div>
        </section>

        {/* contact.sh → API responses */}
        <section id="contact" className="cred-section" data-file="contact">
          <div className="cred-file-head"><Terminal size={14} /><span>contact.sh</span></div>
          <div className="sh-window cred-window">
            <div className="sh-head">$ curl --silent https://api.austwise.dev/contact</div>
            {CONTACT.map((c) => (
              <div key={c.path} className="sh-line">
                <span className="sh-method">{c.method}</span>
                <span className="sh-path">{c.path}</span>
                <span className="sh-code">{c.code}</span>
                <span className="sh-value">{c.value}</span>
              </div>
            ))}
            <div className="sh-note"># replies within 24h — usually faster</div>
          </div>
        </section>

        {/* collab.exe → CTA */}
        <section id="collab" className="cred-section" data-file="collab">
          <div className="cred-file-head"><Zap size={14} /><span>collab.exe</span></div>
          <div className="exe-window cred-window">
            <p className="exe-prompt"><span className="exe-dollar">$</span> ./collab.exe --with "{DEV.name}"</p>
            <div className="exe-btn-wrap">
              <a
                className="exe-btn"
                href={`mailto:${DEV.email}`}
                onMouseMove={onCollabMove}
                onMouseLeave={resetCollab}
              >
                <Mail size={18} />
                <span>Get In Touch</span>
                <ArrowRight size={16} className="exe-btn-arrow" />
                <span className="exe-cursor" />
              </a>
            </div>
            <p className="exe-hint">I reply to interesting people. That is the best I can offer.</p>
          </div>
        </section>

        {/* ─── Footer — closing commit + push ─── */}
        <footer className="cred-footer">
          <div className="cred-footer-cmd">
            <span className="cred-footer-prompt">$</span>
            <span>git commit -m "minor update. nothing important." --author="{DEV.name} &lt;{DEV.email}&gt;"</span>
          </div>
          <div className="cred-footer-cmd">
            <span className="cred-footer-prompt">$</span>
            <span>git push origin main</span>
          </div>
          <div className="cred-footer-cmd cred-footer-out">
            <GitCommit size={13} />
            <span>[main 8c1a4b7] minor update. nothing important. · {DEV.batch} · {DEV.department} @ AUST · {new Date().getFullYear()}</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
