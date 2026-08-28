/*
 * CinematicLandingPage — Scroll-to-explore landing experience
 *
 * Scroll-progress-to-3D-state mapping:
 *   0.00 – 0.12  Hero: idle float, "Your All-in-One Campus Companion"
 *   0.12 – 0.32  Problems: hub scatters, chaos text crossfades
 *   0.32 – 0.52  Reassembly: pieces rejoin, "Everything you need"
 *   0.52 – 0.82  Feature showcase: camera dollying through module chapters
 *   0.82 – 0.92  Roles/trust beat
 *   0.92 – 1.00  Final CTA: settled hero, strong CTA
 *
 * To switch back to the original landing page, change the route in App.jsx
 * from CinematicLandingPage to LandingPage.
 */
import { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, Sparkles } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import LandingNav from '../LandingNav';
import './CinematicLandingPage.css';

// Lazy-load Three.js canvas — keeps it out of initial bundle
const ScrollCanvas = lazy(() => import('./ScrollCanvas'));

// ─── Feature modules data ───
const featureModules = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    tagline: 'Your command centre',
    features: ['Quick Stats', 'Daily Flow', 'Notice Board', 'Deadlines', 'Routine Grid', 'Attendance Tracker'],
    color: '#F5A623',
  },
  {
    id: 'daily-life',
    title: 'Daily Life',
    tagline: 'Campus life, simplified',
    features: ['Cover Page Generator', 'Bhara Koto', 'TakaGeloKoi', 'Mass Meal Manager'],
    color: '#3ECF8E',
  },
  {
    id: 'grade-lab',
    title: 'Grade Lab',
    tagline: 'Know your numbers',
    features: ['CGPA Calculator', 'Semester Tracking', 'Dept. Heatmap', 'Prerequisites Tree'],
    color: '#3AC1D9',
  },
  {
    id: 'insideaust',
    title: 'InsideAUST',
    tagline: 'Navigate your campus',
    features: ['Floor Map', 'Faculty Live Status', 'Library Crowd Pulse', 'Canteen Menu', 'Bus Tracker'],
    color: '#F0554A',
  },
  {
    id: 'vault',
    title: 'Resource Vault',
    tagline: 'Knowledge, curated',
    features: ['Batch Vault', 'Atlas Vault', 'Carbon Vault'],
    color: '#8b7e74',
  },
  {
    id: 'community',
    title: 'Community',
    tagline: 'Connections that matter',
    features: ['Alumni Directory', 'Student Directory', 'Mentor Request'],
    color: '#f97316',
  },
  {
    id: 'marketplace',
    title: 'Marketplace',
    tagline: 'Buy, sell, find',
    features: ['AW Market', 'To-Let Mama', 'Lost & Found'],
    color: '#F5A623',
  },
  {
    id: 'productivity',
    title: 'Productivity & Shadow',
    tagline: 'Level up daily',
    features: ['Study Zone', 'Cheat Sheets', 'Workspace', 'Shadow Chat', 'Buzz'],
    color: '#3ECF8E',
  },
];

// ─── Problem statements ───
const problems = [
  { text: 'Routines lost in screenshots', icon: '📋' },
  { text: 'Deadlines buried in group chats', icon: '💬' },
  { text: 'No clarity on attendance / CGPA', icon: '📊' },
  { text: 'Scattered Drive links everywhere', icon: '📂' },
  { text: 'No single source of truth', icon: '🔍' },
];

// ─── Roles ───
const roles = [
  { label: 'Student', desc: 'Full access to all features' },
  { label: 'CR', desc: 'Class representative tools' },
  { label: 'SR', desc: 'Section representative dashboard' },
  { label: 'Faculty', desc: 'Course management & insights' },
  { label: 'Admin', desc: 'Platform administration' },
];

export default function CinematicLandingPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState('hero');
  const [hasWebGL, setHasWebGL] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const containerRef = useRef(null);
  const sectionsRef = useRef([]);

  // Feature-detect WebGL
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) setHasWebGL(false);
    } catch {
      setHasWebGL(false);
    }
    setPrefersReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // Scroll tracking
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = Math.min(1, Math.max(0, scrollTop / docHeight));
      setScrollProgress(progress);

      // Determine active section
      if (progress < 0.12) setActiveSection('hero');
      else if (progress < 0.32) setActiveSection('problems');
      else if (progress < 0.52) setActiveSection('reassembly');
      else if (progress < 0.82) setActiveSection('features');
      else if (progress < 0.92) setActiveSection('roles');
      else setActiveSection('cta');
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = useCallback((index) => {
    const section = sectionsRef.current[index];
    if (section) {
      section.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
  }, [prefersReducedMotion]);

  return (
    <div className="cine-root" ref={containerRef}>
      <LandingNav />

      {/* 3D Canvas — fixed behind content */}
      {hasWebGL && !prefersReducedMotion && (
        <div className="cine-canvas-wrap">
          <Suspense fallback={<div className="cine-canvas-loader" />}>
            <ScrollCanvas scrollProgress={scrollProgress} />
          </Suspense>
        </div>
      )}

      {/* Fallback gradient for no-WebGL / reduced-motion */}
      {(!hasWebGL || prefersReducedMotion) && (
        <div className="cine-fallback-bg" />
      )}

      {/* ═══════ SECTION 0: HERO ═══════ */}
      <section
        className="cine-section cine-hero"
        ref={(el) => (sectionsRef.current[0] = el)}
      >
        <div className="cine-hero-content">
          <div className="cine-badge">
            <Sparkles size={14} />
            <span>Campus Companion</span>
          </div>
          <h1 className="cine-hero-title">
            Your All-in-One<br />
            <span className="cine-accent">Campus Companion</span>
          </h1>
          <p className="cine-hero-sub">
            One app to rule your entire AUST experience — routines, grades, resources, community, and everything in between.
          </p>
          <div className="cine-hero-actions">
            <button className="cine-btn cine-btn-primary" onClick={() => navigate('/login')}>
              Get Started <ArrowRight size={18} />
            </button>
            <button className="cine-btn cine-btn-ghost" onClick={() => scrollToSection(2)}>
              See Features
            </button>
          </div>
          <button className="cine-scroll-indicator" onClick={() => scrollToSection(1)} aria-label="Scroll to explore">
            <span>Scroll to explore</span>
            <ChevronDown size={20} className="cine-scroll-arrow" />
          </button>
        </div>
      </section>

      {/* ═══════ SECTION 1: PROBLEMS ═══════ */}
      <section
        className="cine-section cine-problems"
        ref={(el) => (sectionsRef.current[1] = el)}
      >
        <div className="cine-problems-inner">
          <h2 className="cine-section-title">
            Problems?<br />
            <span className="cine-accent">We solve them.</span>
          </h2>
          <div className="cine-problems-grid">
            {problems.map((p, i) => (
              <div
                key={i}
                className="cine-problem-card"
                style={{
                  opacity: Math.min(1, Math.max(0, (scrollProgress - 0.12 - i * 0.03) * 8)),
                  transform: `translateY(${Math.max(0, (1 - (scrollProgress - 0.12) * 5) * 30)}px)`,
                }}
              >
                <span className="cine-problem-icon">{p.icon}</span>
                <span className="cine-problem-text">{p.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ SECTION 2: REASSEMBLY ═══════ */}
      <section
        className="cine-section cine-reassembly"
        ref={(el) => (sectionsRef.current[2] = el)}
      >
        <div className="cine-reassembly-content">
          <h2 className="cine-section-title">
            Everything you need.<br />
            <span className="cine-accent">One place.</span>
          </h2>
          <p className="cine-section-sub">
            The chaos reorganises. Scattered tools become a unified system.
          </p>
        </div>
      </section>

      {/* ═══════ SECTION 3: FEATURE SHOWCASE ═══════ */}
      <section
        className="cine-section cine-features"
        ref={(el) => (sectionsRef.current[3] = el)}
      >
        <div className="cine-features-track">
          {featureModules.map((mod, i) => {
            const sectionStart = 0.52 + (i / featureModules.length) * 0.30;
            const sectionEnd = 0.52 + ((i + 1) / featureModules.length) * 0.30;
            const isActive = scrollProgress >= sectionStart && scrollProgress < sectionEnd;
            const localProgress = isActive
              ? (scrollProgress - sectionStart) / (sectionEnd - sectionStart)
              : scrollProgress < sectionStart ? 0 : 1;

            return (
              <div
                key={mod.id}
                className={`cine-feature-chapter ${isActive ? 'active' : ''}`}
                style={{
                  opacity: isActive ? 1 : scrollProgress < sectionStart ? 0.3 : 0.5,
                  transform: `translateX(${isActive ? 0 : scrollProgress < sectionStart ? 60 : -60}px)`,
                }}
              >
                <div className="cine-feature-card" style={{ borderColor: mod.color + '40' }}>
                  <div className="cine-feature-header">
                    <div className="cine-feature-dot" style={{ background: mod.color }} />
                    <h3 className="cine-feature-title">{mod.title}</h3>
                  </div>
                  <p className="cine-feature-tagline">{mod.tagline}</p>
                  <ul className="cine-feature-list">
                    {mod.features.map((f, j) => (
                      <li
                        key={j}
                        style={{
                          opacity: Math.min(1, Math.max(0, (localProgress - j * 0.1) * 4)),
                          transform: `translateY(${Math.max(0, (1 - localProgress * 3 + j * 0.1) * 12)}px)`,
                        }}
                      >
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══════ SECTION 4: ROLES ═══════ */}
      <section
        className="cine-section cine-roles"
        ref={(el) => (sectionsRef.current[4] = el)}
      >
        <div className="cine-roles-inner">
          <h2 className="cine-section-title">
            Built for <span className="cine-accent">everyone</span> at AUST
          </h2>
          <div className="cine-roles-grid">
            {roles.map((role, i) => (
              <div
                key={role.label}
                className="cine-role-card"
                style={{
                  opacity: Math.min(1, Math.max(0, (scrollProgress - 0.82 - i * 0.015) * 10)),
                  transform: `scale(${0.8 + Math.min(0.2, (scrollProgress - 0.82) * 2)})`,
                }}
              >
                <div className="cine-role-badge">{role.label}</div>
                <p className="cine-role-desc">{role.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ SECTION 5: FINAL CTA ═══════ */}
      <section
        className="cine-section cine-cta"
        ref={(el) => (sectionsRef.current[5] = el)}
      >
        <div className="cine-cta-content">
          <h2 className="cine-cta-title">
            Ready to transform<br />
            your <span className="cine-accent">campus life</span>?
          </h2>
          <p className="cine-cta-sub">
            Join thousands of AUST students already using AUSTWise.
          </p>
          <div className="cine-cta-actions">
            <button className="cine-btn cine-btn-primary cine-btn-lg" onClick={() => navigate('/login')}>
              Get Started Free <ArrowRight size={20} />
            </button>
          </div>
          <div className="cine-cta-stats">
            <div className="cine-stat">
              <span className="cine-stat-num">5,000+</span>
              <span className="cine-stat-label">Students</span>
            </div>
            <div className="cine-stat">
              <span className="cine-stat-num">1,200+</span>
              <span className="cine-stat-label">Resources</span>
            </div>
            <div className="cine-stat">
              <span className="cine-stat-num">8</span>
              <span className="cine-stat-label">Departments</span>
            </div>
          </div>
        </div>
      </section>

      {/* Progress bar */}
      <div className="cine-progress-bar">
        <div className="cine-progress-fill" style={{ height: `${scrollProgress * 100}%` }} />
        {['hero', 'problems', 'reassembly', 'features', 'roles', 'cta'].map((s, i) => (
          <button
            key={s}
            className={`cine-progress-dot ${activeSection === s ? 'active' : ''}`}
            style={{ top: `${(i / 5) * 100}%` }}
            onClick={() => scrollToSection(i)}
            aria-label={`Go to ${s}`}
          />
        ))}
      </div>
    </div>
  );
}
