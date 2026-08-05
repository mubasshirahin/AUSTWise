import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Sparkles, Check, X, Crown, Star, Zap,
  ArrowRight, Gift, Heart, Rocket, Shield, Infinity as InfinityIcon,
  BadgePercent, PartyPopper, Activity,
  BarChart3, Archive, Users, ChevronDown, TrendingUp,
  Wallet, PiggyBank, Sparkle, MonitorSmartphone, Brain,
  Palette, Lock, FileDown,
} from 'lucide-react';
import './ProPage.css';

// ─── Plan Definitions ───
const PLANS = [
  {
    id: 'free',
    name: 'Node',
    subtitle: 'Get started with basics',
    price: { monthly: 0, yearly: 0 },
    period: 'forever',
    originalPrice: null,
    icon: Star,
    iconClass: 'node',
    ctaClass: 'node',
    ctaText: 'Current Plan',
    accent: 'var(--accent-amber)',
    features: [
      { text: 'Dashboard & CGPA tracking', included: true },
      { text: 'Class routine management', included: true },
      { text: 'Resource Vault access', included: true },
      { text: 'Basic analytics', included: true },
      { text: 'Community access', included: true },
      { text: 'Ads supported', included: true, highlight: true },
      { text: 'Premium themes', included: false },
      { text: 'AI-powered study tools', included: false },
      { text: 'Priority support', included: false },
      { text: 'Export & download', included: false },
      { text: 'Advanced analytics', included: false },
      { text: 'Ad-free experience', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Helix',
    subtitle: 'Level up your experience',
    price: { monthly: 50, yearly: 40 },
    period: '/month',
    originalPrice: null,
    icon: Crown,
    iconClass: 'helix',
    ctaClass: 'helix',
    ctaText: 'Get Helix',
    badge: 'Most Popular',
    featured: true,
    accent: 'var(--accent-amber)',
    features: [
      { text: 'Everything in Node', included: true },
      { text: 'Ad-free experience', included: true },
      { text: 'Premium themes & layouts', included: true },
      { text: 'Advanced analytics & insights', included: true },
      { text: 'Export data (PDF, Excel)', included: true },
      { text: 'Priority email support', included: true },
      { text: 'Extended vault storage', included: true, highlight: true },
      { text: 'AI chat assistant', included: false },
      { text: 'Custom branding', included: false },
    ],
  },
  {
    id: 'premium',
    name: 'Apex',
    subtitle: 'The ultimate experience',
    price: { monthly: 60, yearly: 45 },
    period: '/month',
    originalPrice: { monthly: 75, yearly: 60 },
    icon: Zap,
    iconClass: 'apex',
    ctaClass: 'apex',
    ctaText: 'Go Apex',
    accent: 'var(--accent-purple)',
    features: [
      { text: 'Everything in Helix', included: true },
      { text: 'AI-powered study assistant', included: true, highlight: true },
      { text: 'Custom branding & themes', included: true },
      { text: 'Priority 24/7 support', included: true },
      { text: 'Unlimited vault storage', included: true },
      { text: 'Early access to new features', included: true },
      { text: 'Direct mentorship access', included: true },
      { text: 'Exclusive community badges', included: true },
      { text: 'Beta feature access', included: true },
    ],
  },
];

// ─── Premium Benefits (Why Upgrade) ───
const PREMIUM_BENEFITS = [
  {
    icon: Sparkles,
    title: 'Ad-Free Experience',
    desc: 'Clean, distraction-free interface. Zero ads, zero interruptions — pure focus.',
    glow: 'var(--accent-amber-glow)',
    color: 'var(--accent-amber)',
  },
  {
    icon: TrendingUp,
    title: 'Advanced Analytics',
    desc: 'Predictive CGPA tracking, department heatmaps, and syllabus insight.',
    glow: 'var(--accent-emerald-glow)',
    color: 'var(--accent-emerald)',
  },
  {
    icon: Archive,
    title: 'Unlimited Vault',
    desc: 'Store unlimited resources, notes, and past papers without limits.',
    glow: 'var(--accent-purple-glow)',
    color: 'var(--accent-purple)',
  },
  {
    icon: Brain,
    title: 'AI Study Assistant',
    desc: 'Apex only — AI-powered explanations, quiz generation, and revision plans.',
    glow: 'var(--accent-cyan-glow)',
    color: 'var(--accent-cyan)',
  },
];

// ─── Theme Showcase (Premium themes available with Helix+) ───
const PREMIUM_THEMES = [
  { name: 'Nexus', desc: 'Deep operation-deck', color: 'var(--accent-emerald)' },
  { name: 'Cyberpunk', desc: 'Neon-noir terminal', color: 'var(--accent-rose)' },
  { name: 'Art Deco', desc: 'Gatsby luxury gold', color: 'var(--accent-amber)' },
  { name: 'Bitcoin DeFi', desc: 'Blockchain orange', color: 'var(--accent-orange)' },
  { name: 'Midnight', desc: 'Cool slate dark', color: 'var(--accent-cyan)' },
  { name: 'Poster', desc: 'Bold vermillion', color: 'var(--accent-rose)' },
];

// ─── Feature Comparison Data ───
const COMPARISON_FEATURES = [
  { name: 'CGPA & Grade Tracking', free: true, pro: true, premium: true },
  { name: 'Class Routine Management', free: true, pro: true, premium: true },
  { name: 'Resource Vault', free: true, pro: true, premium: true },
  { name: 'Community Access', free: true, pro: true, premium: true },
  { name: 'Ad-Free Experience', free: false, pro: true, premium: true },
  { name: 'Premium Themes', free: false, pro: true, premium: true },
  { name: 'Advanced Analytics', free: false, pro: true, premium: true },
  { name: 'Data Export (PDF/Excel)', free: false, pro: true, premium: true },
  { name: 'Priority Support', free: false, pro: true, premium: true },
  { name: 'Extended Storage', free: false, pro: '5GB', premium: 'Unlimited' },
  { name: 'AI Study Assistant', free: false, pro: false, premium: true },
  { name: 'Custom Branding', free: false, pro: false, premium: true },
  { name: 'Exclusive Badges', free: false, pro: false, premium: true },
];

// ─── FAQ Data ───
const FAQ_DATA = [
  {
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes, cancel anytime from Settings. Your premium features stay active until the end of your billing period. No questions asked.',
  },
  {
    question: 'What happens if I don\'t upgrade?',
    answer: 'Your free Node plan stays active with all core features. You just miss out on ad-free, advanced analytics, and AI tools.',
  },
  {
    question: 'Is there a student discount?',
    answer: 'Our pricing is student-first already. Yearly billing saves 20% — that\'s ৳120/year on Helix. No promo codes needed.',
  },
  {
    question: 'Can I switch between Helix and Apex?',
    answer: 'Absolutely. You can upgrade or downgrade anytime. We\'ll prorate the difference automatically.',
  },
];

// ─── Testimonials ───
const testimonials = [
  {
    quote: 'AUSTWise Pro changed how I study. The analytics are unreal — I raised my CGPA 0.3 in one semester!',
    name: 'Fahim Rahman',
    role: 'CSE, Batch 49',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=FahimRahman',
  },
  {
    quote: 'No more ads interrupting my revision. The premium themes alone are worth it.',
    name: 'Nusrat Jahan',
    role: 'EEE, Batch 51',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=NusratJahan',
  },
  {
    quote: 'The AI assistant quizzed me on last year\'s papers. Aced my finals with confidence!',
    name: 'Ariful Islam',
    role: 'CE, Batch 48',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=ArifulIslam',
  },
  {
    quote: 'Priority support answered in minutes. Felt like a VIP from day one.',
    name: 'Tasnim Ahmed',
    role: 'ME, Batch 52',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=TasnimAhmed',
  },
];

// ─── Animated Count-up hook ───
function useCountUp(target, duration = 600) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    prevRef.current = to;
    if (from === to) { setDisplay(to); return; }

    const start = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

// ─── Reveal-on-scroll hook ───
function useReveal(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('pro-revealed');
          observer.unobserve(el);
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
}

// ─── 3D Tilt Card ───
function TiltCard({ className, children, maxTilt = 8 }) {
  const ref = useRef(null);

  const handleMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    el.style.setProperty('--px', px);
    el.style.setProperty('--py', py);
    el.style.setProperty('--rx', `${(py - 0.5) * -maxTilt}deg`);
    el.style.setProperty('--ry', `${(px - 0.5) * maxTilt}deg`);
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--px', '0.5');
    el.style.setProperty('--py', '0.5');
  };

  return (
    <div
      ref={ref}
      className={`pro-tilt ${className || ''}`}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ '--px': 0.5, '--py': 0.5, '--rx': '0deg', '--ry': '0deg' }}
    >
      {children}
    </div>
  );
}

// ─── Confetti (DOM-based) ───
function Confetti({ count = 24 }) {
  const pieces = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: 30 + Math.random() * 40,
      delay: Math.random() * 0.35,
      duration: 0.9 + Math.random() * 0.9,
      size: 6 + Math.random() * 8,
      color: ['#F59E0B', '#A78BFA', '#34D399', '#60A5FA', '#F87171'][i % 5],
      shape: i % 3 === 0 ? 'square' : 'circle',
    })), [count]);
  return (
    <div className="pro-confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`pro-confetti-piece ${p.shape}`}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.shape === 'circle' ? p.size : p.size * 1.4,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Animated Stat (hero) ───
function HeroStat({ icon: Icon, value, label, delay = 0, endValue }) {
  const ref = useRef(null);
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const isFloat = String(value).includes('.');
          const target = endValue ?? (isFloat ? parseFloat(value) : parseInt(String(value).replace(/\D/g, '') || '0'));
          let start = 0;
          const dur = 1600;
          const t0 = performance.now();
          const tick = (now) => {
            const p = Math.min((now - t0) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            const current = isFloat ? start + (target - start) * eased : Math.floor(start + (target - start) * eased);
            setCount(current);
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          observer.unobserve(el);
        }
      },
      { threshold: 0.4 }
    );
    const el = ref.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [value, endValue, hasAnimated]);

  const displayVal = hasAnimated
    ? String(value).includes('.')
      ? count.toFixed(1)
      : String(Math.round(count)) + (String(value).endsWith('+') ? '+' : '')
    : '0';

  return (
    <div ref={ref} className="pro-hero-stat" style={{ animationDelay: `${delay}ms` }}>
      <Icon size={18} />
      <div>
        <span className="pro-hero-stat-value">{displayVal}</span>
        <span className="pro-hero-stat-label">{label}</span>
      </div>
    </div>
  );
}

// ─── Theme Showcase (premium themes — locked/unlocked) ───
function ThemeShowcase() {
  const [hovered, setHovered] = useState(null);

  return (
    <div className="pro-demo pro-demo-themes">
      <div className="pro-demo-label">
        <Palette size={14} />
        <span>Demo · Premium Themes</span>
      </div>
      <div className="pro-theme-carousel">
        {PREMIUM_THEMES.map((themeObj, i) => (
          <div
            key={i}
            className={`pro-theme-item ${hovered === i ? 'hovered' : ''}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="pro-theme-swatch" style={{ background: themeObj.color }} />
            <div className="pro-theme-info">
              <span className="pro-theme-name">{themeObj.name}</span>
              <span className="pro-theme-desc">{themeObj.desc}</span>
            </div>
            <Lock size={12} className="pro-theme-lock" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Storage Meter Demo (interactive) ───
function StorageDemo() {
  const [storage, setStorage] = useState('free');

  return (
    <div className="pro-demo pro-demo-storage">
      <div className="pro-demo-label">
        <Archive size={14} />
        <span>Demo · Vault Storage</span>
      </div>
      <div className="pro-storage-meter">
        <div className="pro-storage-track">
          <div className={`pro-storage-fill ${storage}`} />
        </div>
        <div className="pro-storage-labels">
          <span>0</span>
          <span>Node (500MB)</span>
          <span>Helix (5GB)</span>
          <span>Apex (∞)</span>
        </div>
      </div>
      <div className="pro-storage-toggle">
        <button className={storage === 'free' ? 'active' : ''} onClick={() => setStorage('free')}>
          Node
        </button>
        <button className={storage === 'pro' ? 'active' : ''} onClick={() => setStorage('pro')}>
          Helix
        </button>
        <button className={storage === 'apex' ? 'active' : ''} onClick={() => setStorage('apex')}>
          Apex
        </button>
      </div>
      <div className="pro-storage-info">
        {storage === 'free' && <span className="muted">Only 500MB — you'll hit the limit quickly with past papers.</span>}
        {storage === 'pro' && <span className="pro-amber">5GB — store 10× more question banks and notes.</span>}
        {storage === 'apex' && <span className="pro-emerald">∞ Unlimited — never worry about space again.</span>}
      </div>
    </div>
  );
}

// ─── Export Demo ───
function ExportDemo() {
  const [format, setFormat] = useState('PDF');

  const handleExport = () => {
    const formats = ['PDF', 'Excel', 'CSV'];
    const next = formats[(formats.indexOf(format) + 1) % formats.length];
    setFormat(next);
  };

  return (
    <div className="pro-demo pro-demo-export">
      <div className="pro-demo-label">
        <FileDown size={14} />
        <span>Demo · Data Export</span>
      </div>
      <div className="pro-export-screen">
        <div className="pro-export-row">
          <span className="pro-export-file">cgpa_report.{format.toLowerCase()}</span>
          <span className="pro-export-size">2.4 MB</span>
        </div>
        <div className="pro-export-row">
          <span className="pro-export-file">routine.pdf</span>
          <span className="pro-export-size">1.1 MB</span>
        </div>
      </div>
      <button className="pro-export-btn" onClick={handleExport}>
        <FileDown size={14} />
        Export as {format}
      </button>
    </div>
  );
}

// ─── Ad-Free Demo Widget (interactive toggle) ───
function AdFreeDemo() {
  const [isPro, setIsPro] = useState(false);

  return (
    <div className="pro-demo pro-demo-adfree">
      <div className="pro-demo-label">
        <MonitorSmartphone size={14} />
        <span>Demo · Ad-Free Mode</span>
      </div>
      <div className={`pro-demo-screen ${isPro ? 'pro' : ''}`}>
        {!isPro && (
          <div className="pro-demo-ad">
            <span className="pro-demo-ad-badge">AD</span>
            <div className="pro-demo-ad-text">
              <span className="pro-demo-ad-title">Study Smarter with Tutorify</span>
              <span className="pro-demo-ad-sub">Sponsored · Learn more</span>
            </div>
          </div>
        )}
        <div className="pro-demo-content">
          <span className="pro-demo-content-title">CGPA 3.72 → 3.85</span>
          <span className="pro-demo-content-line" />
          <span className="pro-demo-content-line short" />
        </div>
      </div>
      <button
        className={`pro-demo-toggle ${isPro ? 'on' : ''}`}
        onClick={() => setIsPro(!isPro)}
      >
        <span className="pro-demo-toggle-track">
          <span className="pro-demo-toggle-thumb" />
        </span>
        <span>{isPro ? 'Premium — Ads Removed' : 'Tap to see Premium'}</span>
      </button>
    </div>
  );
}

// ─── Live Analytics Demo (animated chart) ───
function AnalyticsDemo() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(entry.target); } },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const bars = [42, 58, 52, 70, 64, 82, 76, 90];

  return (
    <div ref={ref} className="pro-demo pro-demo-analytics">
      <div className="pro-demo-label">
        <BarChart3 size={14} />
        <span>Live Preview · Grade Lab</span>
      </div>
      <div className="pro-demo-chart-wrap">
        <div className="pro-demo-chart">
          {bars.map((h, i) => (
            <div key={i} className="pro-demo-chart-col">
              <div
                className={`pro-demo-chart-bar ${visible ? 'grow' : ''}`}
                style={{
                  height: `${h}%`,
                  transitionDelay: `${i * 90}ms`,
                  background: i === bars.length - 1 ? 'var(--accent-amber)' : 'var(--accent-amber-glow)',
                }}
              />
            </div>
          ))}
        </div>
        <div className="pro-demo-chart-labels">
          {['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', 'Now'].map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      </div>
      <div className="pro-demo-insight">
        <TrendingUp size={12} />
        <span>Predicted CGPA: 3.85 (+0.13 this semester)</span>
      </div>
    </div>
  );
}

// ─── Savings Calculator (interactive) ───
function SavingsCalculator() {
  const [billing, setBilling] = useState('yearly');

  const calculate = () => {
    if (billing === 'monthly') {
      return {
        perMonth: 50,
        perYear: 600,
        saved: 0,
        days: 2.1,
        perDay: 1.67,
      };
    }
    return {
      perMonth: 40,
      perYear: 480,
      saved: 120,
      days: 1.7,
      perDay: 1.33,
    };
  };

  const { perMonth, perYear, saved, days, perDay } = calculate();
  const animPerDay = useCountUp(Math.round(perDay * 100) / 100, 400);

  return (
    <div className="pro-savings">
      <div className="pro-savings-head">
        <Wallet size={18} />
        <div>
          <span className="pro-savings-title">Smart Savings Calculator</span>
          <span className="pro-savings-sub">See how little Helix costs per day</span>
        </div>
      </div>

      <div className="pro-savings-toggle">
        <button className={`${billing === 'monthly' ? 'active' : ''}`} onClick={() => setBilling('monthly')}>
          Monthly
        </button>
        <button className={`${billing === 'yearly' ? 'active' : ''}`} onClick={() => setBilling('yearly')}>
          Yearly · Save 20%
        </button>
      </div>

      <div className="pro-savings-grid">
        <div className="pro-savings-stat">
          <span className="pro-savings-stat-label">Per month</span>
          <span className="pro-savings-stat-value">৳{perMonth}</span>
        </div>
        <div className="pro-savings-stat">
          <span className="pro-savings-stat-label">Per year</span>
          <span className="pro-savings-stat-value">৳{perYear}</span>
        </div>
        <div className="pro-savings-stat highlight">
          <span className="pro-savings-stat-label">That's only</span>
          <span className="pro-savings-stat-value">৳{animPerDay.toFixed(2)}<small>/day</small></span>
        </div>
      </div>

      {saved > 0 && (
        <div className="pro-savings-badge">
          <PiggyBank size={12} />
          <span>You save ৳{saved}/year with yearly billing</span>
        </div>
      )}

      <div className="pro-savings-equivalent">
        <span className="pro-savings-eq-label">That's less than a cup of tea</span>
        <div className="pro-savings-eq-bar">
          <span style={{ width: `${Math.min(perDay / 2.5 * 100, 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

// ─── FAQ Accordion ───
function FaqAccordion() {
  const [openId, setOpenId] = useState(null);
  const ref = useRef(null);
  useReveal(ref);

  return (
    <div ref={ref} className="pro-faq pro-reveal">
      {FAQ_DATA.map((item, idx) => (
        <div key={idx} className="pro-faq-item">
          <button
            className={`pro-faq-question ${openId === idx ? 'open' : ''}`}
            onClick={() => setOpenId(openId === idx ? null : idx)}
          >
            <span>{item.question}</span>
            <ChevronDown size={18} className={`pro-faq-icon ${openId === idx ? 'open' : ''}`} />
          </button>
          <div className={`pro-faq-answer ${openId === idx ? 'open' : ''}`}>
            <p>{item.answer}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Testimonial Marquee ───
function TestimonialMarquee() {
  const ref = useRef(null);
  useReveal(ref);

  return (
    <div ref={ref} className="pro-testimonials pro-reveal">
      <div className="pro-testimonials-track">
        {[...testimonials, ...testimonials, ...testimonials].map((t, i) => (
          <div key={i} className="pro-testimonial-card">
            <div className="pro-testimonial-stars">★★★★★</div>
            <p className="pro-testimonial-quote">"{t.quote}"</p>
            <div className="pro-testimonial-user">
              <img src={t.avatar} alt={t.name} className="pro-testimonial-avatar" />
              <div className="pro-testimonial-info">
                <div className="pro-testimonial-name">{t.name}</div>
                <div className="pro-testimonial-role">{t.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pricing Card ───
function PricingCard({ plan, billing, isCurrent, onSelect }) {
  const Icon = plan.icon;
  const activePrice = billing === 'yearly' ? plan.price.yearly : plan.price.monthly;
  const originalPrice = plan.originalPrice
    ? billing === 'yearly' ? plan.originalPrice.yearly : plan.originalPrice.monthly
    : null;
  const animatedPrice = useCountUp(activePrice);
  const isFree = plan.id === 'free';

  return (
    <TiltCard className={`pro-card ${plan.featured ? 'featured' : ''} ${isCurrent ? 'pro-card-current' : ''}`}>
      <span
        className="pro-card-glare"
        aria-hidden="true"
        style={{ '--glare-color': plan.accent }}
      />
      <span className="pro-card-shine" aria-hidden="true" />

      {plan.badge && (
        <div className="pro-card-badge">
          <Gift size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          {plan.badge}
        </div>
      )}

      <div className="pro-card-header">
        <div className={`pro-card-icon ${plan.iconClass}`} style={{ '--icon-accent': plan.accent }}>
          <Icon size={28} />
        </div>
        <div className="pro-card-name">{plan.name}</div>
        <div className="pro-card-subtitle">{plan.subtitle}</div>
      </div>

      <div className="pro-card-price">
        <div className={`pro-card-amount ${isFree ? 'free-amount' : ''}`}>
          {isFree ? (
            'Free'
          ) : (
            <>
              <span className="currency">৳</span>
              <span className="pro-card-amount-num">{animatedPrice}</span>
              <span className="period">{plan.period}</span>
            </>
          )}
        </div>
        {originalPrice ? (
          <div className="pro-card-original-price">
            <span className="pro-strike">৳{originalPrice}/month</span>
            <span className="pro-save-pill">Save 20%</span>
          </div>
        ) : plan.originalPrice ? (
          <div className="pro-card-original-price">
            ৳{plan.originalPrice.monthly}/month
          </div>
        ) : null}

        {/* Value proposition — price per day */}
        {!isFree && (
          <div className="pro-card-perday">
            <span>≈ ৳{(activePrice / 30).toFixed(1)}</span>
            <small>/day</small>
          </div>
        )}
      </div>

      <div className="pro-card-features">
        {plan.features.map((feature, i) => (
          <div
            key={i}
            className={`pro-feature-item ${!feature.included ? 'disabled' : ''}`}
            style={{ animationDelay: `${i * 45}ms` }}
          >
            {feature.included ? (
              <Check size={14} className={`pro-feature-check ${feature.highlight ? 'plus' : ''}`} />
            ) : (
              <X size={14} className="pro-feature-check muted" />
            )}
            <span>
              {feature.text}
              {feature.highlight && (
                <span className="pro-feature-highlight"> ★</span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="pro-card-cta">
        <button
          className={`pro-cta-btn ${plan.ctaClass}`}
          onClick={() => onSelect(plan.id)}
          disabled={isCurrent}
          style={isCurrent ? { opacity: 0.7, cursor: 'default' } : {}}
        >
          {isCurrent ? (
            <>
              <Check size={16} />
              Current Plan
            </>
          ) : isFree ? (
            <>
              Get Started
              <ArrowRight size={16} />
            </>
          ) : (
            <>
              {plan.ctaText}
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </TiltCard>
  );
}

// ─── Main Page ───
export default function ProPage() {
  const [billing, setBilling] = useState('monthly');
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(() => localStorage.getItem('austwise_plan') || 'free');
  const [upgradeState, setUpgradeState] = useState('pick');

  const heroRef = useRef(null);
  const pricingRef = useRef(null);
  const compareRef = useRef(null);
  const benefitsRef = useRef(null);
  const faqRef = useRef(null);
  const savingsRef = useRef(null);
  useReveal(heroRef);
  useReveal(pricingRef);
  useReveal(compareRef);
  useReveal(benefitsRef);
  useReveal(faqRef);
  useReveal(savingsRef);

  const handleSelectPlan = (planId) => {
    if (planId === 'free') return;
    setSelectedPlan(planId);
    setUpgradeState('pick');
    setShowModal(true);
  };

  const handleUpgrade = () => {
    if (!selectedPlan) return;
    setUpgradeState('loading');
    setTimeout(() => {
      localStorage.setItem('austwise_plan', selectedPlan);
      setCurrentPlan(selectedPlan);
      setUpgradeState('success');
    }, 900);
  };

  const closeModal = () => {
    if (upgradeState === 'loading') return;
    setShowModal(false);
    setSelectedPlan(null);
    setUpgradeState('pick');
  };

  const renderCheck = (value) => {
    if (value === true) return <Check size={14} className="check" />;
    if (value === false) return <X size={14} className="cross" />;
    return <span className="highlight">{value}</span>;
  };

  return (
    <div className="pro-page">
      {/* ═══════════ HERO ═══════════ */}
      <section ref={heroRef} className="pro-hero pro-reveal">
        <div className="pro-hero-aurora" aria-hidden="true">
          <span className="pro-orb pro-orb-1" />
          <span className="pro-orb pro-orb-2" />
          <span className="pro-orb pro-orb-3" />
        </div>
        <div className="pro-hero-grid" aria-hidden="true" />

        <div className="pro-hero-content">
          <div className="pro-hero-badge">
            <Sparkles size={12} />
            <span>Premium Plans from ৳40/month</span>
          </div>

          <h1 className="pro-hero-title">
            Unlock Your Full <br />
            <span className="pro-hero-highlight">Academic Potential</span>
          </h1>

          <p className="pro-hero-subtitle">
            Three tiers, one goal — your academic edge. Node gets you started, Helix unlocks the full
            toolkit, and Apex gives you everything plus AI-powered mastery. All built for AUST students.
          </p>

          <div className="pro-hero-stats">
            <HeroStat icon={Users} value="2,400+" label="Premium Users" delay={0} endValue={2400} />
            <HeroStat icon={Star} value="4.9" label="User Rating" delay={100} endValue={4.9} />
            <HeroStat icon={Activity} value="40+" label="Premium Features" delay={200} endValue={40} />
          </div>

          <div className="pro-hero-actions">
            <button className="pro-btn pro-btn-primary pro-btn-lg ripple-btn">
              Start Free Trial <ArrowRight size={16} />
              <span className="ripple-overlay" aria-hidden="true" />
            </button>
            <a href="#pricing" className="pro-btn pro-btn-secondary pro-btn-lg">
              Explore Plans <ChevronDown size={16} />
            </a>
          </div>

          <div className="pro-hero-chips">
            <span className="pro-hero-chip"><Rocket size={12} /> No hidden fees</span>
            <span className="pro-hero-chip"><Shield size={12} /> Cancel anytime</span>
            <span className="pro-hero-chip"><InfinityIcon size={12} /> Lifetime upgrades</span>
          </div>
        </div>

        {/* Hero visual mockup */}
        <div className="pro-hero-visual">
          <TiltCard className="pro-hero-phone" maxTilt={10}>
            <div className="pro-phone-notch" />
            <div className="pro-phone-screen">
              <div className="pro-phone-header">
                <div className="pro-phone-avatar" />
                <div className="pro-phone-header-lines">
                  <span />
                  <span />
                </div>
                <div className="pro-phone-badge">PRO</div>
              </div>
              <div className="pro-phone-card pro-phone-card-amber">
                <span className="pro-phone-card-label">CGPA Trend</span>
                <span className="pro-phone-card-value">3.85</span>
                <div className="pro-phone-mini-bars">
                  {[30, 45, 40, 60, 55, 75, 70, 90].map((h, i) => (
                    <span key={i} style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
              <div className="pro-phone-card pro-phone-card-purple">
                <span className="pro-phone-card-label">AI Study Plan</span>
                <span className="pro-phone-card-value">Ready</span>
              </div>
              <div className="pro-phone-card pro-phone-card-emerald">
                <span className="pro-phone-card-label">Vault Storage</span>
                <span className="pro-phone-card-value">Unlimited</span>
              </div>
            </div>
          </TiltCard>
        </div>
      </section>

      {/* ═══════════ BILLING TOGGLE ═══════════ */}
      <div className="pro-billing-row" id="pricing">
        <div className="pro-billing-toggle" role="group" aria-label="Billing period">
          <button
            className={`pro-billing-btn ${billing === 'monthly' ? 'active' : ''}`}
            onClick={() => setBilling('monthly')}
          >
            Monthly
          </button>
          <button
            className={`pro-billing-btn ${billing === 'yearly' ? 'active' : ''}`}
            onClick={() => setBilling('yearly')}
          >
            Yearly
            <span className="pro-billing-save">Save 20%</span>
          </button>
          <span className={`pro-billing-thumb ${billing === 'yearly' ? 'right' : ''}`} aria-hidden="true" />
        </div>
        <span className="pro-billing-note">
          <BadgePercent size={12} />
          {billing === 'yearly' ? 'Yearly billing — you save ৳160/year on Helix' : 'Switch to yearly to save 20%'}
        </span>
      </div>

      {/* ═══════════ PRICING CARDS ═══════════ */}
      <div ref={pricingRef} className="pro-pricing-grid pro-reveal">
        {PLANS.map((plan) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            billing={billing}
            isCurrent={currentPlan === plan.id}
            onSelect={handleSelectPlan}
          />
        ))}
      </div>

      {/* ═══════════ INTERACTIVE DEMOS ═══════════ */}
      <section className="pro-demos-section pro-reveal">
        <div className="pro-section-header">
          <div className="pro-section-badge">
            <Sparkle size={12} />
            <span>Try Before You Buy</span>
          </div>
          <h2 className="pro-section-title">
            Experience Premium <span className="pro-section-highlight">Live</span>
          </h2>
          <p className="pro-section-desc">
            Don't just take our word for it — interact with these live demos of premium features.
          </p>
        </div>

        <div className="pro-demos-grid">
          <div className="pro-demo-card">
            <AdFreeDemo />
          </div>
          <div className="pro-demo-card">
            <AnalyticsDemo />
          </div>
          <div className="pro-demo-card pro-demo-card-savings">
            <SavingsCalculator />
          </div>
          <div className="pro-demo-card">
            <ThemeShowcase />
          </div>
          <div className="pro-demo-card">
            <StorageDemo />
          </div>
          <div className="pro-demo-card">
            <ExportDemo />
          </div>
        </div>
      </section>

      {/* ═══════════ WHY PREMIUM ═══════════ */}
      <section ref={benefitsRef} className="pro-benefits-section pro-reveal">
        <div className="pro-section-header">
          <div className="pro-section-badge">
            <Crown size={12} />
            <span>Why Upgrade</span>
          </div>
          <h2 className="pro-section-title">
            More Than Just Removing <span className="pro-section-highlight">Ads</span>
          </h2>
          <p className="pro-section-desc">
            Premium plans remove every friction point between you and academic success.
          </p>
        </div>
        <div className="pro-benefits-grid">
          {PREMIUM_BENEFITS.map((b, i) => {
            const Icon = b.icon;
            return (
              <TiltCard key={i} className="pro-benefit-card" maxTilt={5}>
                <div className="pro-benefit-icon" style={{ background: b.glow, color: b.color }}>
                  <Icon size={24} />
                </div>
                <h3 className="pro-benefit-title">{b.title}</h3>
                <p className="pro-benefit-desc">{b.desc}</p>
              </TiltCard>
            );
          })}
        </div>
      </section>

      {/* ═══════════ COMPARISON ═══════════ */}
      <section ref={compareRef} className="pro-comparison-section pro-reveal">
        <div className="pro-section-header">
          <div className="pro-section-badge">
            <BarChart3 size={12} />
            <span>Compare Features</span>
          </div>
          <h2 className="pro-section-title">
            Side-by-Side <span className="pro-section-highlight">Comparison</span>
          </h2>
          <p className="pro-section-desc">See exactly what you get with each plan.</p>
        </div>
        <div className="pro-comparison-table">
          <div className="pro-compare-row header">
            <div className="pro-compare-cell">Feature</div>
            <div className="pro-compare-cell pro-compare-plan-head"><Star size={12} /> Node</div>
            <div className="pro-compare-cell pro-compare-plan-head pro-reco">
              <Crown size={12} /> Helix
              <span className="pro-reco-pill">Popular</span>
            </div>
            <div className="pro-compare-cell pro-compare-plan-head"><Zap size={12} /> Apex</div>
          </div>
          {COMPARISON_FEATURES.map((feature, i) => (
            <div key={i} className="pro-compare-row" style={{ animationDelay: `${i * 30}ms` }}>
              <div className="pro-compare-cell">{feature.name}</div>
              <div className="pro-compare-cell">{renderCheck(feature.free)}</div>
              <div className="pro-compare-cell pro-reco">{renderCheck(feature.pro)}</div>
              <div className="pro-compare-cell">{renderCheck(feature.premium)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════ TESTIMONIALS ═══════════ */}
      <section className="pro-testimonials-section pro-reveal">
        <div className="pro-section-header">
          <div className="pro-section-badge">
            <Gift size={12} />
            <span>Student Love</span>
          </div>
          <h2 className="pro-section-title">
            What <span className="pro-section-highlight">Students</span> Say
          </h2>
          <p className="pro-section-desc">Join 2,400+ premium users who've upgraded their academic game.</p>
        </div>
        <TestimonialMarquee />
      </section>

      {/* ═══════════ FAQ ═══════════ */}
      <section ref={faqRef} className="pro-faq-section pro-reveal">
        <div className="pro-section-header">
          <div className="pro-section-badge">
            <Shield size={12} />
            <span>Questions?</span>
          </div>
          <h2 className="pro-section-title">
            Frequently Asked <span className="pro-section-highlight">Questions</span>
          </h2>
          <p className="pro-section-desc">Everything you need to know before upgrading.</p>
        </div>
        <FaqAccordion />
      </section>

      {/* ═══════════ BOTTOM CTA ═══════════ */}
      <section className="pro-bottom-cta">
        <div className="pro-cta-card">
          <div className="pro-cta-visual" aria-hidden="true">
            <Crown size={44} className="pro-cta-crown" />
          </div>
          <h3 className="pro-cta-title">Ready to Go Premium?</h3>
          <p className="pro-cta-desc">
            <Heart size={14} style={{ verticalAlign: 'middle', color: 'var(--accent-rose)', marginRight: 4 }} />
            Your support keeps AUSTWise running and improving. Every subscription goes toward new features
            and making education better for every AUST student.
          </p>
          <div className="pro-cta-guarantee">
            <Shield size={14} />
            <span>7-day money-back guarantee · Cancel anytime</span>
          </div>
          <button className="pro-btn pro-btn-primary pro-btn-lg" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
            Choose Your Plan <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* ═══════════ PAYMENT MODAL ═══════════ */}
      {showModal && selectedPlan && (
        <div className="pro-payment-modal" onClick={closeModal}>
          <div className="pro-payment-modal-content" onClick={(e) => e.stopPropagation()}>
            {upgradeState === 'success' && <Confetti />}

            {upgradeState === 'pick' && (
              <>
                <div className="pro-payment-modal-icon upgrade">
                  <Crown size={32} />
                </div>
                <h3>Upgrade Your Plan</h3>
                <p>
                  Choose your subscription plan to unlock premium features.
                  You can switch or cancel anytime.
                </p>

                <div className="pro-modal-plans">
                  {PLANS.filter((p) => p.id !== 'free').map((plan) => {
                    const Icon = plan.icon;
                    const price = billing === 'yearly' ? plan.price.yearly : plan.price.monthly;
                    const period = billing === 'yearly' ? '/mo · billed yearly' : '/month';
                    return (
                      <label
                        key={plan.id}
                        className={`pro-modal-plan-option ${selectedPlan === plan.id ? 'selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="plan"
                          value={plan.id}
                          checked={selectedPlan === plan.id}
                          onChange={() => setSelectedPlan(plan.id)}
                        />
                        <Icon size={18} style={{ color: plan.id === 'pro' ? 'var(--accent-amber)' : 'var(--accent-purple)' }} />
                        <div className="pro-modal-plan-info">
                          <div className="pro-modal-plan-name">{plan.name}</div>
                          <div className="pro-modal-plan-price">৳{price}{period}</div>
                        </div>
                        <div style={{ fontWeight: 'bold', fontSize: 'var(--fs-sm)' }}>
                          ৳{price}
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8 }}>
                  <button className="pro-btn pro-btn-secondary" onClick={closeModal}>
                    Cancel
                  </button>
                  <button className="pro-btn pro-btn-primary pro-upgrade-btn" onClick={handleUpgrade}>
                    <Crown size={16} />
                    Upgrade Now
                  </button>
                </div>
              </>
            )}

            {upgradeState === 'loading' && (
              <div className="pro-modal-state">
                <div className="pro-modal-icon pending pro-spin-ring">
                  <Sparkles size={28} />
                </div>
                <h3>Activating {PLANS.find((p) => p.id === selectedPlan)?.name}…</h3>
                <p>Wiring up your premium features.</p>
                <div className="pro-loading-bar"><span /></div>
              </div>
            )}

            {upgradeState === 'success' && (
              <div className="pro-modal-state">
                <div className="pro-modal-icon success pro-pop">
                  <PartyPopper size={30} />
                </div>
                <h3>Welcome to {PLANS.find((p) => p.id === selectedPlan)?.name}!</h3>
                <p>You're all set. Enjoy your premium AUSTWise experience.</p>
                <button className="pro-btn pro-btn-primary" onClick={closeModal} style={{ marginTop: 8 }}>
                  <Check size={16} />
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
