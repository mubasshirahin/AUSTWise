import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Sparkles, GraduationCap, Users, Map, Archive, TrendingUp, MessageSquare,
  ShoppingBag, Settings, Shield, Zap,
  ChevronDown, Check, Star, Layers, Clock, Award, BarChart3,
  ChevronRight, ChevronUp, Target, AlertCircle,
  Coffee, Sun as SunIcon, Book, Bell,
  Smartphone, Eye, Activity, List,
  ChevronLeft, MessageCircle,
  X, Search, Hash,
} from 'lucide-react';
import { THEMES } from '../../context/ThemeContext';
// GSAP-powered sections are below the fold, so they load in their own async
// chunk (keeps GSAP + ScrollTrigger out of the main bundle).
const HorizontalFeatures = lazy(() => import('./HorizontalFeatures'));
const StickyContentSwitch = lazy(() => import('./StickyContentSwitch'));
const ImageTrailShowcase = lazy(() => import('./ImageTrailShowcase'));
import LandingNav from './LandingNav';
import logoSilver from '../../assets/logo-silver.png';
import './LandingPage.css';
import { topTestimonials, bottomTestimonials } from '../../data/testimonials';

// ─── RICH FEATURE DATA ───
const features = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    tagline: 'Your academic command center',
    description: 'Everything you need to start your day — at a glance. Your CGPA, upcoming classes, pending deadlines, attendance, and weekly schedule, all in one place.',
    benefits: [
      'Track your CGPA across semesters with animated stats',
      'Never miss a class with smart reminders before each lecture',
      'View your full weekly routine with room numbers & faculty names',
      'Get deadline alerts for assignments, quizzes, and exams',
      'Monitor attendance percentage per course in real time',
    ],
    useCase: 'Start your morning by checking today\'s classes, see what assignments are due this week, and track your CGPA progress — all from one screen.',
    color: 'var(--accent-blue)',
    glow: 'var(--accent-blue-glow)',
  },
  {
    icon: BarChart3,
    title: 'Grade Lab (Analytics)',
    tagline: 'Visualise your academic performance',
    description: 'Go beyond the numbers. See your CGPA trajectory across semesters, compare with department averages, and identify which topics need more attention.',
    benefits: [
      'Interactive CGPA graph — track your growth semester by semester',
      'Department heatmap — see grade distributions across batches',
      'Course reviews & ratings — know which courses to prepare for',
      'Syllabus completion tracker — never fall behind on your syllabus',
      'Semester-by-semester result breakdown with credit analysis',
    ],
    useCase: 'After midterms, check how your CGPA has changed, compare your grades with your department\'s average, and review which courses need more focus before finals.',
    color: 'var(--accent-emerald)',
    glow: 'var(--accent-emerald-glow)',
  },
  {
    icon: Archive,
    title: 'Resource Vault',
    tagline: 'All your study materials, one click away',
    description: 'No more hunting for past papers in WhatsApp groups. The vault organises question banks, topic heatmaps, notes, and video playlists by department, semester, and course.',
    benefits: [
      '1,200+ past question papers from previous final exams',
      'Topic heatmap — see which topics appear most frequently in exams',
      'Curated YouTube playlists — entire semester syllabi in one playlist',
      'Course notes, slides & materials organised by topic',
      'Cheat sheets & formula summaries for quick revision',
    ],
    useCase: 'The night before your CSE 3101 final, open Vault, pick your course, and practice with 5 previous years\' question papers — all from the same page.',
    color: 'var(--accent-purple)',
    glow: 'var(--accent-purple-glow)',
  },
  {
    icon: Map,
    title: 'Campus Hub',
    tagline: 'Navigate AUST like a pro',
    description: 'Find any room, check faculty availability, see if the canteen is crowded, and know exactly how many library seats are free — all updated in real time.',
    benefits: [
      'Interactive floor plans — find any classroom, lab, or office instantly',
      'Faculty status — see which teachers are in their offices right now',
      'Library pulse — live seat occupancy across all study zones',
      'Canteen menu & crowd index — avoid the lunch rush',
      'Course prerequisite trees — plan your semester roadmap',
    ],
    useCase: 'Between classes, check the library pulse to grab a quiet study spot, see which faculty members are in their offices for quick questions, and check the canteen crowd level before heading for lunch.',
    color: 'var(--accent-cyan)',
    glow: 'var(--accent-cyan-glow)',
  },
  {
    icon: Users,
    title: 'Community (Social Square)',
    tagline: 'Connect with the entire AUST community',
    description: 'Share anonymously, network with alumni, find clubs, and look up any student\'s contact info, blood group, and batch — all in one social hub.',
    benefits: [
      'Anonymous confession feed — share freely, no judgement',
      'Alumni directory — network with graduates by batch & company',
      'Club hub — discover and join active AUST clubs',
      'Student directory — find classmates by name, batch, or blood group',
      'In-app messaging — chat directly with classmates & faculty',
    ],
    useCase: 'Need a study partner for your EEE lab? Look up classmates in the Student Directory. Want career advice? Message an alumnus from your department who works at your dream company.',
    color: 'var(--accent-amber)',
    glow: 'var(--accent-amber-glow)',
  },
  {
    icon: ShoppingBag,
    title: 'Campus Market',
    tagline: 'Buy, sell, rent, and find housing',
    description: 'The ultimate AUST marketplace — exchange used textbooks, find bachelor/rental listings near campus, report lost items, and request mentorship from senior students.',
    benefits: [
      'Exchange kits — buy & sell used textbooks and academic equipment',
      'ToLet Mama — find bachelor rentals & shared apartments near campus',
      'Lost & Found — report lost items and help others find theirs',
      'Mentor requests — connect with seniors for academic guidance',
      'All free — no listing fees, no commission, no charges',
    ],
    useCase: 'Starting a new semester? Buy used CSE books from seniors at half price. Need a place near campus? Check the To-Let listings. Lost your calculator? Report it in Lost & Found.',
    color: 'var(--accent-orange)',
    glow: 'var(--accent-orange-glow)',
  },
  {
    icon: MessageSquare,
    title: 'Messaging',
    tagline: 'Real-time chat for your courses & groups',
    description: 'Stop juggling between WhatsApp, Messenger, and Email. AUSTWise Messaging brings all your course conversations into one organised space.',
    benefits: [
      'Course-specific chat rooms — discuss with batchmates in your section',
      'Lab group messaging — coordinate with your lab team members',
      'Smart notifications — never miss an important class announcement',
      'File sharing — share notes, assignments, and resources instantly',
      'Private faculty DMs — ask questions directly to your professors',
    ],
    useCase: 'Your CSE 3102 lab group has a project submission tomorrow. Use the lab group chat to coordinate who brings what, share the latest code, and ask the CR for deadline clarifications.',
    color: 'var(--accent-orange)',
    glow: 'var(--accent-orange-glow)',
  },
  {
    icon: Settings,
    title: 'Themes & Customisation',
    tagline: 'Make AUSTWise truly yours',
    description: '15 uniquely crafted visual themes — from minimalist dark to neon cyberpunk, from editorial newsprint to hand-drawn sketchbook. Your campus experience, your style.',
    benefits: [
      '15 hand-crafted themes — Dark, Light, Midnight, Cyberpunk & more',
      'Automatic light/dark switching based on your preference',
      'Each theme has unique personality — fonts, shadows, borders, colors',
      'Real-time theme switching — no reload, no delay',
      'Customisable per-session — change your theme anytime',
    ],
    useCase: 'Study mode? Switch to "Monochrome" for distraction-free focus. Late-night coding? Flip to "Cyberpunk" for that neon terminal vibe. Reading articles? "Newsprint" turns the app into a beautiful digital newspaper.',
    color: 'var(--accent-blue)',
    glow: 'var(--accent-blue-glow)',
  },
  {
    icon: Shield,
    title: 'Admin Panel',
    tagline: 'For CRs, SRs, Faculty & Moderators',
    description: 'Powerful management tools for class representatives, student representatives, faculty, and admins — manage notices, applications, and campus data from one dashboard.',
    benefits: [
      'Publish official notices — exam schedules, holiday announcements & more',
      'Update canteen status & crowd levels in real time',
      'Monitor library seat occupancy across all zones',
      'Manage user accounts — roles, batches, sections & permissions',
      'Review & approve CR/SR applications with vacancy checks',
    ],
    useCase: 'As a CR, post an urgent notice about tomorrow\'s quiz postponement. As a faculty member, update your office hours. As admin, review SR applications and assign roles — all from one panel.',
    color: 'var(--accent-rose)',
    glow: 'var(--accent-rose-glow)',
  },
];

// ─── PAIN POINTS → SOLUTIONS ───
const problemSolutions = [
  {
    problem: '"I miss important notices and deadlines"',
    solution: 'AUSTWise sends you smart push notifications before every class, deadline, and exam. The dashboard shows all pending tasks at a glance.',
  },
  {
    problem: '"Finding past question papers is a nightmare"',
    solution: 'The Vault organises 1,200+ question papers by department, semester, and course — with topic heatmaps showing what actually appears in exams.',
  },
  {
    problem: '"I don\'t know how my CGPA is trending"',
    solution: 'Grade Lab visualises your CGPA across semesters, compares with department averages, and shows which courses need improvement.',
  },
  {
    problem: '"I need affordable housing near campus"',
    solution: 'The Marketplace has dedicated To-Let listings for AUST students — find shared apartments, bachelor rentals, and negotiate directly with landlords.',
  },
  {
    problem: '"I want to connect with alumni & seniors"',
    solution: 'The Alumni Directory lets you search graduates by batch, company, and department. The Student Directory helps you find seniors instantly.',
  },
  {
    problem: '"I can\'t find which room my class is in"',
    solution: 'Interactive Floor Maps with room numbers and faculty office locations make navigating AUST buildings effortless.',
  },
];

// ─── DAILY STUDENT TIMELINE ───
const dailyTimeline = [
  {
    time: '8:00 AM',
    icon: SunIcon,
    title: 'Morning Briefing',
    desc: 'Get today\'s class schedule delivered to your Telegram or browser. Know which rooms to go to and what subjects you have.',
    color: 'var(--accent-amber)',
  },
  {
    time: '9:00 AM',
    icon: Book,
    title: 'Attend Classes',
    desc: 'Open the interactive campus map to find your classroom. Check faculty office hours if you need to ask questions after class.',
    color: 'var(--accent-blue)',
  },
  {
    time: '1:00 PM',
    icon: Coffee,
    title: 'Lunch Break',
    desc: 'Check the Canteen Menu & Crowd Index to avoid the rush. See what\'s being served today and how busy each counter is.',
    color: 'var(--accent-orange)',
  },
  {
    time: '3:00 PM',
    icon: Users,
    title: 'Study & Collaborate',
    desc: 'Use the Vault to practice past papers. Chat with classmates in course-specific groups. Post in the community if you need help.',
    color: 'var(--accent-purple)',
  },
  {
    time: '6:00 PM',
    icon: List,
    title: 'Evening Review',
    desc: 'Check the Grade Lab for syllabus progress. Review upcoming deadlines on the dashboard. Mark attendance for today\'s classes.',
    color: 'var(--accent-emerald)',
  },
  {
    time: '9:00 PM',
    icon: Bell,
    title: 'Daily Wrap-Up',
    desc: 'Receive an attendance confirmation prompt on Telegram. Plan tomorrow\'s schedule. Get a notification if you have any pending assignments.',
    color: 'var(--accent-rose)',
  },
];

const steps = [
  {
    step: 1,
    title: 'Create Your Account',
    desc: 'Sign up with your @aust.edu email or use Google Login. Choose your role — Student, Faculty, or Alumni.',
    icon: GraduationCap,
  },
  {
    step: 2,
    title: 'Set Up Your Profile',
    desc: 'Pick your department, batch, year-semester, section, and lab group to unlock personalised features.',
    icon: Settings,
  },
  {
    step: 3,
    title: 'Explore & Stay Ahead',
    desc: 'Track your routine, browse past papers, check campus occupancy, connect with peers, and never miss a deadline.',
    icon: Zap,
  },
];

const stats = [
  { icon: Users, label: 'Members', value: '0', plus: true },
  { icon: Layers, label: 'Built-in Features', value: '40+' },
  { icon: Star, label: 'Theme Variants', value: `${THEMES.length}` },
];

const valueHighlights = [
  { icon: Zap, title: 'Free & Premium Plans', desc: 'Get started with powerful free features, or upgrade to premium for exclusive perks and advanced tools.' },
  { icon: Smartphone, title: 'Works Everywhere', desc: 'Access from any device — laptop, tablet, or phone. Install as a PWA app for a native-like experience, or just open your browser.' },
  { icon: Eye, title: 'Privacy Focused', desc: 'Your personal data is protected. We prioritize your privacy while providing a great user experience.' },
  { icon: Activity, title: 'Always Improving', desc: 'New features added regularly based on student feedback. The roadmap is shaped by the AUST community.' },
];

function LayoutDashboard(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

// ─── Interactive Particle Canvas ───
function ParticleCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w, h, dpr;
    const particles = [];
    const PARTICLE_COUNT = 60;
    const CONNECTION_DIST = 120;
    const MOUSE_RADIUS = 200;
    const mouse = { x: -9999, y: -9999 };

    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const initParticles = () => {
      particles.length = 0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
          r: Math.random() * 2 + 1, phase: Math.random() * Math.PI * 2,
        });
      }
    };

    const getAccent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent-blue').trim() || '#b0975d';
    const hexToRgb = (hex) => { const m = hex.replace('#', ''); const n = m.length === 3 ? m.split('').map(c => c + c).join('') : m; const int = parseInt(n, 16); return [(int >> 16) & 255, (int >> 8) & 255, int & 255]; };

    let raf, t = 0;
    const draw = () => {
      t++; const accent = getAccent(); const [r, g, b] = hexToRgb(accent.startsWith('#') ? accent : '#b0975d');
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!reduced) {
          const dx = mouse.x - p.x, dy = mouse.y - p.y, dist = Math.hypot(dx, dy);
          if (dist < MOUSE_RADIUS && dist > 0) { const force = (1 - dist / MOUSE_RADIUS) * 0.6; p.vx -= (dx / dist) * force; p.vy -= (dy / dist) * force; }
          p.vx += (Math.random() - 0.5) * 0.04; p.vy += (Math.random() - 0.5) * 0.04;
          p.vx *= 0.98; p.vy *= 0.98; p.x += p.vx; p.y += p.vy;
        }
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0; if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        const pulse = reduced ? 1 : 0.7 + 0.3 * Math.sin(t * 0.02 + p.phase);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2); ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.25)`; ctx.fill();
        ctx.shadowBlur = 6; ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.15)`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * pulse * 0.6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j]; const dx = p.x - p2.x; const dy = p.y - p2.y; const dist = Math.hypot(dx, dy);
          if (dist < CONNECTION_DIST) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(1 - dist / CONNECTION_DIST) * 0.12})`; ctx.lineWidth = 0.5; ctx.stroke(); }
        }
      }
      raf = requestAnimationFrame(draw);
    };

    resize(); initParticles(); raf = requestAnimationFrame(draw);
    const onMove = (e) => { const rect = canvas.getBoundingClientRect(); mouse.x = e.clientX - rect.left; mouse.y = e.clientY - rect.top; };
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    window.addEventListener('mousemove', onMove, { passive: true }); window.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', () => { resize(); initParticles(); });
    return () => { cancelAnimationFrame(raf); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseleave', onLeave); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="landing-particle-canvas" aria-hidden="true" />;
}

// ─── Scroll Reveal ───
function ScrollReveal({ children, className = '', delay = 0, direction = 'up' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setTimeout(() => setVisible(true), delay); observer.unobserve(el); } }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    observer.observe(el); return () => observer.disconnect();
  }, [delay]);
  const dirClass = direction === 'up' ? 'reveal-up' : direction === 'down' ? 'reveal-down' : direction === 'left' ? 'reveal-left' : direction === 'right' ? 'reveal-right' : 'reveal-scale';
  return <div ref={ref} className={`scroll-reveal ${dirClass} ${visible ? 'visible' : ''} ${className}`}>{children}</div>;
}

// ─── 3D Tilt Card ───
function TiltCard({ children, className = '', maxTilt = 8 }) {
  const cardRef = useRef(null);
  const handleMouseMove = useCallback((e) => {
    const card = cardRef.current; if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    card.style.setProperty('--rx', `${((y - rect.height / 2) / (rect.height / 2)) * -maxTilt}deg`);
    card.style.setProperty('--ry', `${((x - rect.width / 2) / (rect.width / 2)) * maxTilt}deg`);
  }, [maxTilt]);
  const handleMouseLeave = useCallback(() => { const card = cardRef.current; if (!card) return; card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); }, []);
  return (
    <div ref={cardRef} className={`tilt-card ${className}`} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      {children}
      <div className="tilt-card-shine" aria-hidden="true" />
    </div>
  );
}

// ─── Animated Counter ───
function AnimatedCounter({ end, suffix = '', duration = 2000 }) {
  const [count, setCount] = useState(0); const ref = useRef(null); const counted = useRef(false);
  useEffect(() => {
    // Re-animate whenever the target value changes — without this, a counter
    // that first ran with end=0 (e.g. the Members stat before its fetch lands)
    // would stay stuck at 0 once the real value arrives.
    counted.current = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !counted.current) {
        counted.current = true; const startTime = performance.now(); const numEnd = parseInt(end.replace(/[^0-9]/g, ''));
        const tick = (now) => { const progress = Math.min((now - startTime) / duration, 1); const eased = 1 - (1 - progress) ** 3; setCount(Math.floor(eased * numEnd)); if (progress < 1) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current); return () => observer.disconnect();
  }, [end, duration]);
  return <span ref={ref}>{count}{suffix}</span>;
}




// ─── EXPANDABLE FEATURE CARD ───
function FeatureCard({ feature, index }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = feature.icon;

  return (
    <ScrollReveal delay={index * 80} direction="up">
      <TiltCard className="landing-feature-card" maxTilt={6}>
        <div
          className={`landing-feature-card-inner ${expanded ? 'is-expanded' : ''}`}
          style={{ '--card-accent': feature.color, '--card-glow': feature.glow }}
        >
          <div className="landing-feature-card-main" onClick={() => setExpanded(!expanded)}>
            <div className="landing-feature-icon" style={{ background: feature.glow, color: feature.color }}>
              <Icon size={22} />
            </div>
            <div className="landing-feature-header">
              <span className="landing-feature-tagline">{feature.tagline}</span>
              <h3 className="landing-feature-title">{feature.title}</h3>
            </div>
            <p className="landing-feature-desc">{feature.description}</p>
            <button className="landing-feature-expand-btn" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
              {expanded ? 'Show Less' : 'See What You Get'}
              {expanded ? <ChevronUp size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>

          <div className={`landing-feature-details ${expanded ? 'visible' : ''}`}>
            <div className="landing-feature-divider" />
            <div className="landing-feature-benefits">
              <h4 className="landing-feature-benefits-title">✓ What you get:</h4>
              {feature.benefits.map((benefit, j) => (
                <div key={j} className="landing-feature-benefit">
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
            <div className="landing-feature-use-case">
              <h4 className="landing-feature-use-case-title">Real-life scenario:</h4>
              <p>{feature.useCase}</p>
            </div>
          </div>
        </div>
      </TiltCard>
    </ScrollReveal>
  );
}

// ─── STACKING CARDS (deck that stacks as you scroll) ───
// Curated "portfolio" of the core modules, shown as a sticky deck.
const stackingFeatures = [
  features[0], // Dashboard
  features[1], // Grade Lab
  features[2], // Resource Vault
  features[3], // Campus Hub
  features[4], // Community
];

function StackingCards({ items }) {
  return (
    <div className="stacking-deck">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <article
            key={i}
            className="stacking-card"
            style={{ '--deck-index': i, '--card-accent': item.color, '--card-glow': item.glow }}
          >
            <div className="stacking-card-top">
              <div className="stacking-card-icon" style={{ background: `${item.color}1A`, color: item.color }}>
                <Icon size={22} />
              </div>
              <div className="stacking-card-head">
                <span className="stacking-card-tagline">{item.tagline}</span>
                <h3 className="stacking-card-title">{item.title}</h3>
              </div>
              <span className="stacking-card-index">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <p className="stacking-card-desc">{item.description}</p>
            <div className="stacking-card-benefits">
              {item.benefits.slice(0, 3).map((b, j) => (
                <div key={j} className="stacking-card-benefit">
                  <span className="stacking-card-check" style={{ color: item.color }}>
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

// ─── APP PREVIEW CAROUSEL (real app screens) ───
const mockScreens = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    color: 'var(--accent-blue)',
    glow: 'var(--accent-blue-glow)',
    icon: LayoutDashboard,
    elements: [
      // Hero greeting + Zap icon
      { type: 'stats-row', stats: [
        { label: 'Current CGPA', value: '3.72', color: 'var(--accent-blue)' },
        { label: 'Attendance', value: '92%', color: 'var(--accent-emerald)' },
        { label: 'Deadlines', value: '3', color: 'var(--accent-amber)' },
        { label: 'Credits', value: '48', color: 'var(--accent-purple)' },
      ]},
      // Weekly schedule
      { type: 'label', text: "Today's Schedule" },
      { type: 'schedule-row', schedule: [
        { label: 'CSE 3101', value: '9:00 AM', subtitle: 'Room 401 · D. Rahman', color: 'var(--accent-blue)' },
        { label: 'EEE 2101', value: '11:00 AM', subtitle: 'Room 205 · Ms. Farhana', color: 'var(--accent-emerald)' },
        { label: 'MATH 2201', value: '2:00 PM', subtitle: 'Room 103 · Dr. Kader', color: 'var(--accent-amber)' },
      ]},
      // Deadline ticker
      { type: 'ticker', text: '⚠ CSE 3102 Assignment due Friday', color: 'var(--accent-rose)' },
    ],
  },
  {
    id: 'vault',
    title: 'Resource Vault',
    color: 'var(--accent-purple)',
    glow: 'var(--accent-purple-glow)',
    icon: Archive,
    elements: [
      // Step progress: Dept → Sem → Course
      { type: 'steps', steps: ['CSE', 'Sem 2.2', 'CSE 3101'], active: 2 },
      // Stat pills
      { type: 'stat-pills', pills: [
        { label: '12 papers', color: 'var(--accent-purple)' },
        { label: '4 resource types', color: 'var(--accent-cyan)' },
      ]},
      // Question bank entries
      { type: 'label', text: 'Question Bank' },
      { type: 'qb-entry', code: 'CSE 3101', name: 'Final Exam 2025', tag: 'Solved', color: 'var(--accent-emerald)' },
      { type: 'qb-entry', code: 'CSE 3101', name: 'Midterm 2025', tag: 'Unsolved', color: 'var(--accent-amber)' },
      { type: 'qb-entry', code: 'CSE 3101', name: 'Final Exam 2024', tag: 'Solved', color: 'var(--accent-emerald)' },
    ],
  },
  {
    id: 'gradelab',
    title: 'Grade Lab',
    color: 'var(--accent-emerald)',
    glow: 'var(--accent-emerald-glow)',
    icon: BarChart3,
    elements: [
      // Tab bar
      { type: 'mini-tabs', tabs: ['CGPA', 'Semester View', 'Heatmap', 'Reviews'], active: 0 },
      // CGPA chart
      { type: 'label', text: 'CGPA Calculator' },
      { type: 'chart', bars: [55, 62, 58, 71, 68, 78, 75], labels: ['1.1','1.2','2.1','2.2','3.1','3.2','4.1'] },
      // Stats row
      { type: 'stats-row', stats: [
        { label: 'Current CGPA', value: '3.72', color: 'var(--accent-emerald)' },
        { label: 'Credits', value: '48', color: 'var(--accent-blue)' },
      ]},
    ],
  },
  {
    id: 'campus',
    title: 'Campus Hub',
    color: 'var(--accent-cyan)',
    glow: 'var(--accent-cyan-glow)',
    icon: Map,
    elements: [
      // Mini tabs
      { type: 'mini-tabs', tabs: ['Floors', 'Faculty', 'Library', 'Canteen'], active: 0 },
      // Floor map - key locations
      { type: 'label', text: 'Ground Floor · Key Locations' },
      { type: 'status', label: 'M.H Khan Auditorium', status: 'G-01', statusColor: 'var(--accent-amber)' },
      { type: 'status', label: 'Canteen', status: 'G-06', statusColor: 'var(--accent-cyan)' },
      { type: 'status', label: 'Library', status: '1-LIB', statusColor: 'var(--accent-emerald)' },
      { type: 'status', label: 'Redex Photocopy', status: 'G-02', statusColor: 'var(--accent-amber)' },
    ],
  },
  {
    id: 'community',
    title: 'Social Square',
    color: 'var(--accent-amber)',
    glow: 'var(--accent-amber-glow)',
    icon: Users,
    elements: [
      // Tab bar
      { type: 'mini-tabs', tabs: ['Feed', 'Alumni', 'Clubs', 'Students'], active: 0 },
      // Story feed posts
      { type: 'story-post', text: 'CSE 3102 lab final postponed to next week! Anyone else relieved?', likes: 24 },
      { type: 'story-post', text: 'Selling used CSE books (Data Structure, Algorithm) — DM for price', likes: 15 },
      { type: 'story-post', text: 'Anyone know if Dr. Kader is taking student projects this sem?', likes: 31 },
      // Student directory entry
      { type: 'directory-entry', name: 'Fahim Rahman', id: '2021-3-60-001', dept: 'CSE' },
    ],
  },
  {
    id: 'marketplace',
    title: 'Campus Market',
    color: 'var(--accent-orange)',
    glow: 'var(--accent-orange-glow)',
    icon: ShoppingBag,
    elements: [
      // Tab bar
      { type: 'mini-tabs', tabs: ['Exchange', 'ToLet Mama', 'Lost', 'Mentors'], active: 0 },
      { type: 'label', text: 'AW Market' },
      // Listing cards
      { type: 'listing', title: 'Data Structure Book', desc: 'Good condition · CSE 2101', price: 'Tk 350', color: 'var(--accent-blue)' },
      { type: 'listing', title: 'Scientific Calculator', desc: 'Casio fx-991EX · barely used', price: 'Tk 800', color: 'var(--accent-purple)' },
      { type: 'listing', title: 'CSE Lab Manual Bundle', desc: '5 semesters · all solved', price: 'Tk 250', color: 'var(--accent-emerald)' },
    ],
  },
  {
    id: 'messages',
    title: 'ConnectBox',
    color: 'var(--accent-orange)',
    glow: 'var(--accent-orange-glow)',
    icon: MessageSquare,
    elements: [
      // Chat list
      { type: 'chat-item', name: 'CSE 3101 Group', msg: 'Sir: Tomorrow\'s class is cancelled', time: '2m ago', unread: 3, color: 'var(--accent-blue)' },
      { type: 'chat-item', name: 'Lab G6', msg: 'Fahim: I\'ll bring the soldering kit', time: '15m ago', unread: 1, color: 'var(--accent-emerald)' },
      { type: 'chat-item', name: 'Dr. Rahman', msg: 'Please submit your report by Friday', time: '1h ago', unread: 0, color: 'var(--accent-amber)' },
      { type: 'chat-item', name: 'Nusrat Jahan', msg: 'Did you get the EEE notes?', time: '2h ago', unread: 0, color: 'var(--accent-purple)' },
      { type: 'dummy-search', text: 'Search conversations...' },
    ],
  },
];

function AppPreviewCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isPaused) return;
    intervalRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % mockScreens.length);
    }, 5000);
    return () => clearInterval(intervalRef.current);
  }, [isPaused]);

  const screen = mockScreens[activeIndex];
  const Icon = screen.icon;

  const renderElements = () => {
    return screen.elements.map((el, i) => {
      // Stats row (Dashboard, Grade Lab)
      if (el.type === 'stats-row') {
        return (
          <div key={i} className="mock-stats-row">
            {el.stats.map((s, j) => (
              <div key={j} className="mock-stat-card" style={{ '--s-color': s.color, animationDelay: `${j * 0.08}s` }}>
                <span className="mock-stat-card-value" style={{ color: s.color }}>{s.value}</span>
                <span className="mock-stat-card-label">{s.label}</span>
              </div>
            ))}
          </div>
        );
      }
      // Section label
      if (el.type === 'label') {
        return <div key={i} className="mock-label">{el.text}</div>;
      }
      // Schedule cards
      if (el.type === 'schedule-row') {
        return (
          <div key={i} className="mock-schedule-row">
            {el.schedule.map((item, j) => (
              <div key={j} className="mock-schedule-card" style={{ '--s-color': item.color, animationDelay: `${j * 0.12}s` }}>
                <span className="mock-schedule-label">{item.label}</span>
                <span className="mock-schedule-value" style={{ color: item.color }}>{item.value}</span>
                <span className="mock-schedule-subtitle">{item.subtitle}</span>
              </div>
            ))}
          </div>
        );
      }
      // Deadline ticker
      if (el.type === 'ticker') {
        return (
          <div key={i} className="mock-ticker">
            <AlertCircle size={10} />
            <span>{el.text}</span>
          </div>
        );
      }
      // Steps indicator (Vault selection)
      if (el.type === 'steps') {
        return (
          <div key={i} className="mock-steps">
            {el.steps.map((s, j) => (
              <div key={j} className={`mock-step ${j <= el.active ? 'active' : ''}`}>
                <div className={`mock-step-dot ${j <= el.active ? 'done' : ''}`} style={j <= el.active ? { background: 'var(--accent-purple)' } : {}}>
                  {j <= el.active && <Check size={8} />}
                </div>
                <span className="mock-step-label" style={j === el.active ? { color: 'var(--accent-purple)', fontWeight: '600' } : {}}>{s}</span>
              </div>
            ))}
          </div>
        );
      }
      // Stat pills (Vault)
      if (el.type === 'stat-pills') {
        return (
          <div key={i} className="mock-stat-pills">
            {el.pills.map((p, j) => (
              <span key={j} className="mock-pill" style={{ borderColor: p.color, color: p.color }}>{p.label}</span>
            ))}
          </div>
        );
      }
      // Question bank entry (Vault)
      if (el.type === 'qb-entry') {
        return (
          <div key={i} className="mock-qb-entry">
            <Archive size={10} />
            <div className="mock-qb-info">
              <span className="mock-qb-name">{el.name}</span>
              <span className="mock-qb-code">{el.code}</span>
            </div>
            <span className="mock-qb-tag" style={{ background: `${el.color}18`, color: el.color }}>{el.tag}</span>
          </div>
        );
      }
      // Mini tab bar
      if (el.type === 'mini-tabs') {
        return (
          <div key={i} className="mock-mini-tabs">
            {el.tabs.map((t, j) => (
              <span key={j} className={`mock-mini-tab ${j === el.active ? 'active' : ''}`}>{t}</span>
            ))}
          </div>
        );
      }
      // Chart (Grade Lab)
      if (el.type === 'chart') {
        return (
          <div key={i} className="mock-chart-wrap">
            <div className="mock-chart">
              {el.bars.map((h, j) => (
                <div key={j} className="mock-chart-bar-wrap">
                  <div className="mock-chart-bar" style={{ height: `${h}%`, animationDelay: `${j * 0.08}s` }} />
                </div>
              ))}
            </div>
            <div className="mock-chart-labels">
              {el.labels?.map((l, j) => <span key={j} className="mock-chart-label">{l}</span>)}
            </div>
          </div>
        );
      }
      // Library zone (Campus)
      if (el.type === 'library-zone') {
        const pct = ((el.total - el.free) / el.total) * 100;
        return (
          <div key={i} className="mock-library-zone">
            <div className="mock-zone-header">
              <span className="mock-zone-name">{el.name}</span>
              <span className="mock-zone-count" style={{ color: el.color }}>{el.free}/{el.total} free</span>
            </div>
            <div className="mock-zone-bar">
              <div className="mock-zone-fill" style={{ width: `${pct}%`, background: el.color }} />
            </div>
          </div>
        );
      }
      // Status row
      if (el.type === 'status') {
        return (
          <div key={i} className="mock-status">
            <span className="mock-status-dot" style={{ background: el.statusColor }} />
            <span className="mock-status-label">{el.label}</span>
            <span className="mock-status-value" style={{ color: el.statusColor }}>{el.status}</span>
          </div>
        );
      }
      // Story post (Community)
      if (el.type === 'story-post') {
        return (
          <div key={i} className="mock-story-post">
            <div className="mock-story-avatar" />
            <div className="mock-story-body">
              <span className="mock-story-text">"{el.text}"</span>
              <span className="mock-story-likes">♥ {el.likes}</span>
            </div>
          </div>
        );
      }
      // Directory entry (Community)
      if (el.type === 'directory-entry') {
        return (
          <div key={i} className="mock-dir-entry">
            <div className="mock-dir-avatar" style={{ background: 'var(--accent-amber)' }}>{el.name.charAt(0)}</div>
            <div className="mock-dir-info">
              <span className="mock-dir-name">{el.name}</span>
              <span className="mock-dir-id">{el.id}</span>
            </div>
            <span className="mock-dir-dept">{el.dept}</span>
          </div>
        );
      }
      // Marketplace listing
      if (el.type === 'listing') {
        return (
          <div key={i} className="mock-listing">
            <div className="mock-listing-icon" style={{ background: `${el.color}18`, color: el.color }}>
              <ShoppingBag size={12} />
            </div>
            <div className="mock-listing-info">
              <span className="mock-listing-title">{el.title}</span>
              <span className="mock-listing-desc">{el.desc}</span>
            </div>
            <span className="mock-listing-price" style={{ color: el.color }}>{el.price}</span>
          </div>
        );
      }
      // Chat item
      if (el.type === 'chat-item') {
        return (
          <div key={i} className="mock-chat-item">
            <div className="mock-chat-avatar" style={{ background: el.color }}>
              {el.name.charAt(0)}
            </div>
            <div className="mock-chat-info">
              <div className="mock-chat-top">
                <span className="mock-chat-name">{el.name}</span>
                <span className="mock-chat-time">{el.time}</span>
              </div>
              <span className="mock-chat-msg">{el.msg}</span>
            </div>
            {el.unread > 0 && <span className="mock-chat-badge" style={{ background: el.color }}>{el.unread}</span>}
          </div>
        );
      }
      // Search bar
      if (el.type === 'dummy-search') {
        return (
          <div key={i} className="mock-dummy-search">
            <Search size={10} />
            <span>{el.text}</span>
          </div>
        );
      }
      return null;
    });
  };

  return (
    <div
      className="app-preview-carousel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="app-preview-mockup" style={{ '--screen-accent': screen.color, '--screen-glow': screen.glow }}>
        <div className="mock-notch">
          <div className="mock-notch-inner">
            <span style={{ background: 'var(--accent-rose)', width: 8, height: 8, borderRadius: '50%' }} />
            <span style={{ background: 'var(--accent-amber)', width: 8, height: 8, borderRadius: '50%' }} />
            <span style={{ background: 'var(--accent-emerald)', width: 8, height: 8, borderRadius: '50%' }} />
          </div>
          <div className="mock-notch-label">
            <Icon size={12} />
            <span>{screen.title}</span>
          </div>
        </div>
        <div className="mock-screen-content" key={activeIndex}>
          {renderElements()}
        </div>
      </div>

      <div className="carousel-controls">
        <button
          className="carousel-arrow"
          onClick={() => setActiveIndex((prev) => (prev - 1 + mockScreens.length) % mockScreens.length)}
          aria-label="Previous screen"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="carousel-dots">
          {mockScreens.map((s, i) => (
            <button
              key={i}
              className={`carousel-dot ${i === activeIndex ? 'active' : ''}`}
              style={i === activeIndex ? { background: s.color } : {}}
              onClick={() => setActiveIndex(i)}
              aria-label={`View ${s.title}`}
            />
          ))}
        </div>
        <button
          className="carousel-arrow"
          onClick={() => setActiveIndex((prev) => (prev + 1) % mockScreens.length)}
          aria-label="Next screen"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="carousel-status">
        <span className={`carousel-pause-btn ${isPaused ? 'paused' : ''}`} onClick={() => setIsPaused(!isPaused)}>
          {isPaused ? '▶ Playing' : '⏸ Pause'}
        </span>
        <span className="carousel-screen-name" style={{ color: screen.color }}>
          <Icon size={12} /> {screen.title}
        </span>
      </div>
    </div>
  );
}

// ─── THE AUSTWISE EFFECT ───
const beforeAfterData = {
  before: [
    { icon: MessageCircle, text: 'Missed deadlines in group chats', color: 'var(--accent-rose)' },
    { icon: X, text: 'Hunting for past papers in WhatsApp', color: 'var(--accent-rose)' },
    { icon: Hash, text: 'No idea what your CGPA trend is', color: 'var(--accent-rose)' },
    { icon: AlertCircle, text: 'Forgetting class schedules & rooms', color: 'var(--accent-rose)' },
    { icon: Search, text: 'Wondering if library has free seats', color: 'var(--accent-rose)' },
    { icon: Users, text: 'No way to find seniors & alumni', color: 'var(--accent-rose)' },
  ],
  after: [
    { icon: Bell, text: 'Smart notifications for every deadline', color: 'var(--accent-emerald)' },
    { icon: Archive, text: '1,200+ past papers organized by course', color: 'var(--accent-emerald)' },
    { icon: TrendingUp, text: 'Interactive CGPA Calculator with graphs', color: 'var(--accent-emerald)' },
    { icon: Map, text: 'Full weekly schedule with room numbers', color: 'var(--accent-emerald)' },
    { icon: Activity, text: 'Live library pulse & canteen crowd index', color: 'var(--accent-emerald)' },
    { icon: Users, text: 'Find seniors, alumni & batchmates instantly', color: 'var(--accent-emerald)' },
  ],
};

function BeforeAfterSection() {
  const [showAfter, setShowAfter] = useState(false);
  const sectionRef = useRef(null);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setTimeout(() => setShowAfter(true), 400);
        observer.unobserve(el);
      }
    }, { threshold: 0.2 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="before-after-section" ref={sectionRef}>
      <div className={`before-column ${showAfter ? 'dimmed' : ''}`}>
        <div className="before-after-header before">
          <X size={18} />
          <span>Without AUSTWise</span>
        </div>
        <div className="before-after-list">
          {beforeAfterData.before.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="before-after-item" style={{ '--item-color': item.color }}>
                <div className="before-after-item-icon" style={{ background: `${item.color}18`, color: item.color }}>
                  <Icon size={14} />
                </div>
                <span className="before-after-item-text">{item.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="before-after-divider">
        <div className="divider-line" />
        <div className={`divider-arrow ${showAfter ? 'revealed' : ''}`}>
          <ArrowRight size={24} />
        </div>
        <div className="divider-line" />
      </div>

      <div className={`after-column ${showAfter ? 'visible' : ''}`}>
        <div className="before-after-header after">
          <Check size={18} />
          <span>With AUSTWise</span>
        </div>
        <div className="before-after-list">
          {beforeAfterData.after.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="before-after-item after" style={{ '--item-delay': `${i * 0.1}s` }}>
                <div className="before-after-item-icon" style={{ background: `${item.color}18`, color: item.color }}>
                  <Icon size={14} />
                </div>
                <span className="before-after-item-text">{item.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}



export default function LandingPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [activeMembers, setActiveMembers] = useState(null);

  // Total registered members from the members API. We count ALL members, not
  // just those online right now — the online count is a transient in-memory
  // WebSocket state that resets on server restart, so it often shows 0 even
  // though the site has registered users.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await fetch('/api/presence/members', { credentials: 'same-origin' }).catch(() => null);
      if (cancelled || !res) return;
      const data = await res.json().catch(() => null);
      if (cancelled || !data?.success) return;
      setActiveMembers((data.members || []).length);
    };
    load();
    const t = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);
  const heroRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    document.title = 'AUSTWise — Your Campus Companion';
    const timer = setTimeout(() => setHeroLoaded(true), 100);

    // Restore scroll position when returning from an info page
    const savedScroll = sessionStorage.getItem('landingScrollY');
    if (savedScroll) {
      sessionStorage.removeItem('landingScrollY');
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(savedScroll, 10));
      });
    }

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => { setCursorPos({ x: e.clientX, y: e.clientY }); };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const scrollTo = (id) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };
  const currentYear = new Date().getFullYear();

  return (
    <div className={`landing-page ${mounted ? 'mounted' : ''}`}>
      {/* ─── Background Reveal (fixed, behind everything) ─── */}
      <div className="landing-reveal-bg">
        <div className="landing-reveal-inner">
          <span className="landing-reveal-text">
            {'AUSTWise'.split('').map((char, i) => (
              <span key={i} className="glitch-char" data-text={char}>{char}</span>
            ))}
          </span>
        </div>
      </div>

      {/* Cursor Glow — outside shutter so position:fixed stays viewport-relative */}
      <div className="landing-cursor-glow" style={{ left: `${cursorPos.x}px`, top: `${cursorPos.y}px` }} aria-hidden="true" />

      {/* Background particles / grid — outside shutter to keep position:fixed */}
      <div className="landing-bg" aria-hidden="true">
        <div className="landing-grid" />
        <div className="landing-noise" />
        <ParticleCanvas />
      </div>

      {/* ─── NAV ─── (outside shutter so position:fixed stays viewport-relative) ─── */}
      <LandingNav />

      {/* ─── SHUTTER LAYER — slides up to reveal the fixed background ─── */}
      <div className="landing-shutter-layer">

      {/* ─── HERO ─── */}
      <section className="landing-hero" ref={heroRef}>
        <div className={`landing-hero-content ${heroLoaded ? 'hero-visible' : ''}`}>
          <div className="landing-badge pulse-badge"><Sparkles size={12} className="sparkle-icon" /><span>Your All-in-One Campus Companion</span></div>
          <h1 className="landing-hero-title">
            <span className="title-line">Everything You Need</span><br />
            <span className="landing-hero-highlight title-line-accent">to Ace Your Semester</span>
          </h1>
          <p className="landing-hero-desc">
            <span className="typewriter-text">
              AUSTWise brings together your routine, grades, question banks, campus maps,
              community feed, marketplace, and more — all in one beautifully designed platform
              built specifically for AUST students. <strong>And it's completely free.</strong>
            </span>
          </p>
          <div className="landing-hero-actions">
            <button className="landing-btn landing-btn-primary landing-btn-lg ripple-btn" onClick={() => navigate('/login')}>Jump Right In <ArrowRight size={18} /><span className="ripple-overlay" aria-hidden="true" /></button>
            <button className="landing-btn landing-btn-secondary landing-btn-lg" onClick={() => scrollTo('landing-features')}>Explore Features <ChevronDown size={16} className="chevron-bounce" /></button>
          </div>
          <div className="landing-hero-stats">
            {stats.map((stat, i) => {
              const showPlus = stat.plus === true || (typeof stat.value === 'string' && stat.value.endsWith('+'));
              const liveValue = (i === 0 && activeMembers != null) ? String(activeMembers) : stat.value;
              const endVal = showPlus ? liveValue.replace('+', '') : liveValue;
              return (
                <div key={i} className="landing-hero-stat">
                  <stat.icon size={18} />
                  <div>
                    <span className="landing-hero-stat-value">
                      <AnimatedCounter end={endVal} suffix={showPlus ? '+' : ''} />
                    </span>
                    <span className="landing-hero-stat-label">{stat.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className={`landing-hero-visual ${heroLoaded ? 'hero-visible' : ''}`}>
          <TiltCard className="landing-hero-card-stack" maxTilt={12}>
            <div className="landing-hero-card card-1" data-depth="0.2">
              <div className="card-mock-icon" style={{ background: 'var(--accent-blue-glow)', color: 'var(--accent-blue)' }}><LayoutDashboard size={18} /></div>
              <div className="card-mock-content"><div className="card-mock-line title" style={{ width: '60%' }} /><div className="card-mock-line" style={{ width: '90%' }} /><div className="card-mock-line" style={{ width: '70%' }} /></div>
            </div>
            <div className="landing-hero-card card-2" data-depth="0.4">
              <div className="card-mock-icon" style={{ background: 'var(--accent-emerald-glow)', color: 'var(--accent-emerald)' }}><BarChart3 size={18} /></div>
              <div className="card-mock-content"><div className="card-mock-bar" style={{ height: '24px', width: '45%', background: 'var(--accent-emerald)' }} /><div className="card-mock-bar" style={{ height: '30px', width: '60%', background: 'var(--accent-amber)' }} /><div className="card-mock-bar" style={{ height: '18px', width: '35%', background: 'var(--accent-rose)' }} /><div className="card-mock-bar" style={{ height: '26px', width: '50%', background: 'var(--accent-blue)' }} /></div>
            </div>
            <div className="landing-hero-card card-3" data-depth="0.6">
              <div className="card-mock-icon" style={{ background: 'var(--accent-purple-glow)', color: 'var(--accent-purple)' }}><Archive size={18} /></div>
              <div className="card-mock-content"><div className="card-mock-dots"><span style={{ background: 'var(--accent-purple)' }} /><span style={{ background: 'var(--accent-cyan)' }} /><span style={{ background: 'var(--accent-amber)' }} /><span style={{ background: 'var(--accent-emerald)' }} /></div><div className="card-mock-line" style={{ width: '85%' }} /><div className="card-mock-line" style={{ width: '65%' }} /></div>
            </div>
          </TiltCard>
        </div>
      </section>

      {/* ─── PROBLEMS WE SOLVE ─── */}
      <section id="landing-problems" className="landing-section landing-section-alt">
        <ScrollReveal>
          <div className="landing-section-header">
            <div className="landing-badge pulse-badge"><Target size={12} /><span>Problems? We Solve Them</span></div>
            <h2 className="landing-section-title">Common Student Problems, <span className="landing-hero-highlight">Solved</span></h2>
            <p className="landing-section-desc">
              Every feature in AUSTWise exists because a real AUST student faced a real problem. 
              Here's how we fix the pain points you deal with every semester.
            </p>
          </div>
        </ScrollReveal>

        <div className="landing-problems-grid">
          {problemSolutions.map((item, i) => (
            <ScrollReveal key={i} delay={i * 80} direction="up">
              <div className="landing-problem-card">
                <div className="landing-problem-statement">
                  <AlertCircle size={16} className="problem-icon" />
                  <span>{item.problem}</span>
                </div>
                <div className="landing-solution-statement">
                  <ArrowRight size={14} className="solution-arrow" />
                  <span>{item.solution}</span>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <div className="landing-problems-cta">
            <p>Still facing a problem we haven't listed? <button className="landing-inline-link" onClick={() => navigate('/login')}>Join AUSTWise and let us know →</button></p>
          </div>
        </ScrollReveal>
      </section>

      {/* ─── FEATURES SECTION ─── */}
      <section id="landing-features" className="landing-section">
        <ScrollReveal>
          <div className="landing-section-header">
            <div className="landing-badge pulse-badge"><Zap size={12} /><span>Everything You Need</span></div>
            <h2 className="landing-section-title">Powerful Features for <span className="landing-hero-highlight">Every Aspect</span> of Campus Life</h2>
            <p className="landing-section-desc">
              Click on any feature to see exactly what you get — detailed benefits and real-life scenarios for each tool.
            </p>
          </div>
        </ScrollReveal>

        <div className="landing-features-grid">
          {features.map((feature, i) => (
            <FeatureCard key={i} feature={feature} index={i} />
          ))}
        </div>
      </section>

      {/* ─── APP PREVIEW CAROUSEL ─── */}
      <section className="landing-section">
        <ScrollReveal>
          <div className="landing-section-header">
            <div className="landing-badge pulse-badge"><Smartphone size={12} /><span>See It Live</span></div>
            <h2 className="landing-section-title">AUSTWise <span className="landing-hero-highlight">in Action</span></h2>
            <p className="landing-section-desc">
              Browse through live previews of each feature. Hover to pause the carousel and explore at your own pace.
            </p>
          </div>
        </ScrollReveal>
        <ScrollReveal direction="scale">
          <AppPreviewCarousel />
        </ScrollReveal>
      </section>

      {/* ─── STICKY CONTENT SWITCH (pinned heading, scrolling panels) ─── */}
      <Suspense fallback={null}>
        <StickyContentSwitch />

        {/* ─── HORIZONTAL FEATURE ROLL (GSAP ScrollTrigger) ─── */}
        <HorizontalFeatures items={features} />

        {/* ─── IMAGE TRAIL SHOWCASE (GSAP cursor trail) ─── */}
        <ImageTrailShowcase items={features} />
      </Suspense>

      {/* ─── STACKING CARDS (sticky deck) ─── */}
      <section className="landing-section landing-stacking-section">
        <ScrollReveal>
          <div className="landing-section-header">
            <div className="landing-badge pulse-badge"><Layers size={12} /><span>The Portfolio</span></div>
            <h2 className="landing-section-title">Your Campus Companion, <span className="landing-hero-highlight">One Card at a Time</span></h2>
            <p className="landing-section-desc">
              Keep scrolling — every core module stacks into a deck as you go, so the whole
              AUSTWise experience builds up right in front of you.
            </p>
          </div>
        </ScrollReveal>
        <StackingCards items={stackingFeatures} />
      </section>

      {/* ─── THE AUSTWISE EFFECT ─── */}
      <section className="landing-section landing-section-alt">
        <ScrollReveal>
          <div className="landing-section-header">
            <div className="landing-badge pulse-badge"><Zap size={12} /><span>The AUSTWise Effect</span></div>
            <h2 className="landing-section-title">Before vs. <span className="landing-hero-highlight">After</span></h2>
            <p className="landing-section-desc">
              See how AUSTWise transforms your daily student experience. Watch the "After" column reveal itself as you scroll.
            </p>
          </div>
        </ScrollReveal>
        <ScrollReveal direction="up">
          <BeforeAfterSection />
        </ScrollReveal>
      </section>

      {/* ─── YOUR DAY WITH AUSTWISE ─── */}
      <section className="landing-section">
        <ScrollReveal>
          <div className="landing-section-header">
            <div className="landing-badge pulse-badge"><Clock size={12} /><span>A Day in the Life</span></div>
            <h2 className="landing-section-title">What Your Day Looks Like <span className="landing-hero-highlight">With AUSTWise</span></h2>
            <p className="landing-section-desc">
              From morning briefing to evening wrap-up — see how AUSTWise fits into your daily routine 
              and makes every part of your student life smoother.
            </p>
          </div>
        </ScrollReveal>

        <div className="landing-timeline">
          <div className="landing-timeline-line" aria-hidden="true" />
          {dailyTimeline.map((item, i) => {
            const Icon = item.icon;
            return (
              <ScrollReveal key={i} delay={i * 100} direction={i % 2 === 0 ? 'left' : 'right'}>
                <div className="landing-timeline-item">
                  <div className="landing-timeline-dot" style={{ background: item.color, boxShadow: `0 0 12px ${item.color}33` }} />
                  <div className="landing-timeline-time">{item.time}</div>
                  <div className="landing-timeline-card" style={{ '--tl-color': item.color }}>
                    <div className="landing-timeline-icon" style={{ background: `${item.color}1A`, color: item.color }}><Icon size={18} /></div>
                    <div className="landing-timeline-content">
                      <h4 className="landing-timeline-title">{item.title}</h4>
                      <p className="landing-timeline-desc">{item.desc}</p>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      {/* ─── WHAT YOU GET / VALUE HIGHLIGHTS ─── */}
      <section className="landing-section">
        <ScrollReveal>
          <div className="landing-section-header">
            <div className="landing-badge pulse-badge"><Award size={12} /><span>Why Choose AUSTWise</span></div>
            <h2 className="landing-section-title">Built for AUST Students, <span className="landing-hero-highlight">by One Developer</span></h2>
            <p className="landing-section-desc">
              AUSTWise isn't another corporate student app — it's an independent project, built and maintained by one developer who understands exactly what you need.
            </p>
          </div>
        </ScrollReveal>

        <div className="landing-value-grid">
          {valueHighlights.map((item, i) => {
            const Icon = item.icon;
            return (
              <ScrollReveal key={i} delay={i * 100} direction="up">
                <div className="landing-value-card">
                  <div className="landing-value-icon"><Icon size={24} /></div>
                  <h3 className="landing-value-title">{item.title}</h3>
                  <p className="landing-value-desc">{item.desc}</p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="landing-section landing-section-alt">
        <ScrollReveal>
          <div className="landing-section-header">
            <div className="landing-badge pulse-badge"><Layers size={12} /><span>Simple Setup</span></div>
            <h2 className="landing-section-title">Get Started in <span className="landing-hero-highlight">3 Easy Steps</span></h2>
            <p className="landing-section-desc">From zero to fully set up in under two minutes. No complex configurations, no waiting.</p>
          </div>
        </ScrollReveal>

        <div className="landing-steps">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <ScrollReveal key={i} delay={i * 150} direction="up">
                <div className="landing-step">
                  <div className="landing-step-number">{step.step}</div>
                  <div className="landing-step-icon-wrapper">
                    <div className="landing-step-icon-pulse" style={{ background: i === 0 ? 'var(--accent-blue-glow)' : i === 1 ? 'var(--accent-amber-glow)' : 'var(--accent-emerald-glow)' }} />
                    <div className="landing-step-icon" style={{ background: i === 0 ? 'var(--accent-blue-glow)' : i === 1 ? 'var(--accent-amber-glow)' : 'var(--accent-emerald-glow)', color: i === 0 ? 'var(--accent-blue)' : i === 1 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}><Icon size={24} /></div>
                  </div>
                  <h3 className="landing-step-title">{step.title}</h3>
                  <p className="landing-step-desc">{step.desc}</p>
                  {i < steps.length - 1 && <div className="landing-step-connector" />}
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="landing-section landing-testimonials-section">
        <ScrollReveal>
          <div className="landing-section-header">
            <div className="landing-badge pulse-badge"><Award size={12} /><span>Student Love</span></div>
            <h2 className="landing-section-title">What <span className="landing-hero-highlight">Students</span> Say</h2>
            <p className="landing-section-desc">Join hundreds of AUST students who use AUSTWise every day.</p>
          </div>
        </ScrollReveal>

        {/* Top Slider (Right to Left) */}
        <div className="testimonials-slider-wrapper" onMouseEnter={(e) => e.currentTarget.querySelector('.testimonials-slider').style.animationPlayState = 'paused'} onMouseLeave={(e) => e.currentTarget.querySelector('.testimonials-slider').style.animationPlayState = 'running'}>
          <div className="testimonials-slider track-right">
            {[...topTestimonials, ...topTestimonials, ...topTestimonials].map((t, i) => (
              <div key={i} className="testimonial-card">
                <p className="testimonial-quote">{t.quote}</p>
                <div className="testimonial-user">
                  <img src={t.avatar} alt={t.name} className="testimonial-avatar" />
                  <div className="testimonial-user-info">
                    <div className="testimonial-name">{t.name}</div>
                    <div className="testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Slider (Left to Right) */}
        <div className="testimonials-slider-wrapper" onMouseEnter={(e) => e.currentTarget.querySelector('.testimonials-slider').style.animationPlayState = 'paused'} onMouseLeave={(e) => e.currentTarget.querySelector('.testimonials-slider').style.animationPlayState = 'running'}>
          <div className="testimonials-slider track-left">
            {[...bottomTestimonials, ...bottomTestimonials, ...bottomTestimonials].map((t, i) => (
              <div key={i} className="testimonial-card">
                <p className="testimonial-quote">{t.quote}</p>
                <div className="testimonial-user">
                  <img src={t.avatar} alt={t.name} className="testimonial-avatar" />
                  <div className="testimonial-user-info">
                    <div className="testimonial-name">{t.name}</div>
                    <div className="testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      {/* ─── FOOTER ─── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <ScrollReveal direction="left">
            <div className="landing-footer-brand">
              <div className="landing-logo"><img src={logoSilver} alt="AUSTWise" className="landing-logo-img" /><span className="landing-logo-text"><span className="landing-logo-wm"></span><span className="landing-logo-wm accent"></span></span></div>
              <p className="landing-footer-desc"></p>
              <p className="landing-footer-copy">&copy; {currentYear} AUSTWise. All rights reserved.</p>
            </div>
          </ScrollReveal>
          <div className="landing-footer-links">
            {[
              { title: 'Terms', items: ['Terms of Service', 'Privacy Policy', 'Cookie Policy'] },
              { title: 'Resources', items: ['Docs', 'Blog', 'Changelog'] },
              { title: 'Connect', items: ['Feedback', 'Discord', 'Reddit'] },
              { title: 'Why AUSTWise', items: ['Features', 'Pricing', 'About Us'] },
            ].map((col, i) => (
              <ScrollReveal key={i} delay={i * 100} direction="up">
                <div className="landing-footer-col"><h4>{col.title}</h4>{col.items.map((item, j) => {
                  const routes = {
                    'Terms of Service': '/terms',
                    'Privacy Policy': '/privacy',
                    'Cookie Policy': '/cookie-policy',
                    Docs: '/docs',
                    Blog: '/blog',
                    Changelog: '/changelog',
                    Feedback: '/feedback',
                    Discord: null,
                    Reddit: null,
                    Features: '/features',
                    Pricing: '/pricing',
                    'About Us': '/about',
                  };
                  const external = {
                    Discord: 'https://discord.gg/austwise',
                    Reddit: 'https://reddit.com/r/austwise',
                  };
                  const route = routes[item];
                  const ext = external[item];
                  if (ext) {
                    return <a key={j} href={ext} target="_blank" rel="noopener noreferrer" className="landing-footer-link">{item}</a>;
                  }
                  const handleNav = () => {
                    sessionStorage.setItem('landingScrollY', window.scrollY);
                    navigate(route);
                  };
                  return <button key={j} className="landing-footer-link" onClick={handleNav}>{item}</button>;
                })}</div>
              </ScrollReveal>
            ))}
          </div>
        </div>
        <div className="landing-footer-bottom">
          <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="landing-footer-social" aria-label="Facebook">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
          </a>
        </div>
      </footer>
      </div>{/* ─── end .landing-shutter-layer ─── */}
    </div>
  );
}
