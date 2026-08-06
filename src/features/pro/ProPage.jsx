import { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Check, X, Crown, Star, Zap,
  ArrowRight, Gift, Shield, Infinity as InfinityIcon,
  BarChart3, Archive, Brain, Palette,
  Cloud,
  ChevronDown,
} from 'lucide-react';
import './ProPage.css';

// ─── Plan Definitions ───
const PLANS = [
  {
    id: 'free',
    name: 'Node',
    subtitle: 'The foundation',
    price: { monthly: 0, yearly: 0 },
    period: 'forever',
    originalPrice: null,
    icon: Star,
    iconClass: 'node',
    ctaClass: 'node',
    ctaText: 'Current',
    accent: 'var(--accent-amber)',
    features: [
      { text: 'Dashboard & CGPA tracking', included: true },
      { text: 'Class routine management', included: true },
      { text: 'Resource Vault (500MB)', included: true },
      { text: 'Basic analytics', included: true },
      { text: 'Community access', included: true },
      { text: 'Ads supported', included: true, highlight: true },
      { text: 'Premium themes', included: false },
      { text: 'AI-powered study tools', included: false },
      { text: 'Priority support', included: false },
      { text: 'Data export', included: false },
      { text: 'Ad-free experience', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Helix',
    subtitle: 'The toolkit',
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
      { text: 'All premium themes', included: true },
      { text: 'Advanced analytics', included: true },
      { text: 'Export (PDF, Excel)', included: true },
      { text: 'Priority email support', included: true },
      { text: 'Extended Vault (5GB)', included: true, highlight: true },
      { text: 'AI chat assistant', included: false },
      { text: 'Custom branding', included: false },
    ],
  },
  {
    id: 'premium',
    name: 'Apex',
    subtitle: 'The full suite',
    price: { monthly: 60, yearly: 45 },
    period: '/month',
    originalPrice: { monthly: 75, yearly: 60 },
    icon: Zap,
    iconClass: 'apex',
    ctaClass: 'apex',
    ctaText: 'Go Apex',
    accent: 'var(--accent-emerald)',
    features: [
      { text: 'Everything in Helix', included: true },
      { text: 'AI-powered study assistant', included: true, highlight: true },
      { text: 'Custom branding & themes', included: true },
      { text: 'Priority 24/7 support', included: true },
      { text: 'Unlimited Vault storage', included: true },
      { text: 'Early access features', included: true },
      { text: 'Direct mentorship access', included: true },
      { text: 'Exclusive community badges', included: true },
      { text: 'Beta feature access', included: true },
    ],
  },
];

// ─── Feature Comparison Data ───
const COMPARISON_FEATURES = [
  {
    category: 'Core Experience',
    features: [
      { name: 'Dashboard & CGPA Tracking', free: true, pro: true, premium: true },
      { name: 'Class Routine Management', free: true, pro: true, premium: true },
      { name: 'Resource Vault Access', free: '500MB', pro: '5GB', premium: '∞' },
      { name: 'Community Access', free: true, pro: true, premium: true },
      { name: 'Ad-Free Experience', free: false, pro: true, premium: true },
      { name: 'Premium Themes', free: false, pro: true, premium: true },
      { name: 'Advanced Analytics', free: false, pro: true, premium: true },
      { name: 'Data Export (PDF/Excel)', free: false, pro: true, premium: true },
      { name: 'Priority Support', free: false, pro: 'Email', premium: '24/7' },
      { name: 'AI Study Assistant', free: false, pro: false, premium: true },
      { name: 'Custom Branding', free: false, pro: false, premium: true },
      { name: 'Exclusive Badges', free: false, pro: false, premium: true },
    ],
  },
];

// ─── Benefits ───
const BENEFITS = [
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    desc: 'Predictive CGPA tracking with department heatmaps and syllabus insights.',
    color: 'var(--accent-amber)',
    glow: 'var(--accent-amber-glow)',
  },
  {
    icon: Archive,
    title: 'Unlimited Vault',
    desc: 'Store unlimited resources, notes, and past papers without any limits.',
    color: 'var(--accent-emerald)',
    glow: 'var(--accent-emerald-glow)',
  },
  {
    icon: Brain,
    title: 'AI Study Assistant',
    desc: 'Apex exclusive — AI-powered explanations, quiz generation, and revision plans.',
    color: 'var(--accent-cyan)',
    glow: 'var(--accent-cyan-glow)',
  },
  {
    icon: Sparkles,
    title: 'Zero Distractions',
    desc: 'Clean, ad-free interface. Pure focus on what matters — your studies.',
    color: 'var(--accent-amber)',
    glow: 'var(--accent-amber-glow)',
  },
  {
    icon: Cloud,
    title: 'Cloud Sync',
    desc: 'Access your vault and progress from any device, anytime, anywhere.',
    color: 'var(--accent-purple)',
    glow: 'var(--accent-purple-glow)',
  },
  {
    icon: Palette,
    title: 'Premium Themes',
    desc: 'Choose from 6 exclusive themes including Nexus, Cyberpunk, and Art Deco.',
    color: 'var(--accent-amber)',
    glow: 'var(--accent-amber-glow)',
  },
];

// ─── Testimonials ───
const testimonials = [
  {
    quote: 'AUSTWise Pro changed how I study. The analytics helped me raise my CGPA from 3.32 to 3.71 in one semester.',
    name: 'Fahim Rahman',
    role: 'CSE\'25',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=FahimRahman',
  },
  {
    quote: 'Zero ads, zero interruptions. The premium themes alone make studying so much more enjoyable.',
    name: 'Nusrat Jahan',
    role: 'EEE\'24',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=NusratJahan',
  },
  {
    quote: 'The AI assistant generated a revision plan that nailed my exam prep. Aced everything!',
    name: 'Ariful Islam',
    role: 'CE\'24',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=ArifulIslam',
  },
  {
    quote: 'Priority support responded in under 10 minutes. Felt like a VIP from day one.',
    name: 'Tasnim Ahmed',
    role: 'ME\'25',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=TasnimAhmed',
  },
];

// ─── FAQ Data ───
const FAQ_DATA = [
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. Cancel anytime from Settings. Premium features stay active until the end of your billing period.',
  },
  {
    question: 'What if I don\'t upgrade?',
    answer: 'Your free Node plan stays active with all core features. You just miss ad-free, advanced analytics, and AI tools.',
  },
  {
    question: 'Is there a student discount?',
    answer: 'Our pricing is already student-first. Yearly billing saves 20% — that\'s ৳160/year on Helix. No promo codes needed.',
  },
  {
    question: 'Can I switch between Helix and Apex?',
    answer: 'Absolutely. Upgrade or downgrade anytime — we prorate the difference automatically.',
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes — 7 days free on any premium plan. Full access, no credit card required.',
  },
];

// ─── Reveal-on-scroll Hook ───
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
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
}

// ─── 3D Tilt Card ───
function TiltCard({ className, children, maxTilt = 6, deckIndex, onClick, isTop = true }) {
  const ref = useRef(null);

  const handleMove = (e) => {
    const el = ref.current;
    if (!el || !isTop) return; // tilt only the front card
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
      onClick={onClick}
      style={{ '--px': 0.5, '--py': 0.5, '--rx': '0deg', '--ry': '0deg', '--deck': deckIndex }}
    >
      {children}
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
            <ChevronDown
              size={18}
              className={`pro-faq-icon ${openId === idx ? 'open' : ''}`}
            />
          </button>
          <div className={`pro-faq-answer ${openId === idx ? 'open' : ''}`}>
            <p>{item.answer}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Testimonial List ───
function TestimonialList() {
  const ref = useRef(null);
  useReveal(ref);

  return (
    <div ref={ref} className="pro-testimonials pro-reveal">
      <div className="pro-testimonial-grid">
        {testimonials.map((t, i) => (
          <div key={i} className="pro-testimonial-card" style={{ animationDelay: `${i * 100}ms` }}>
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
function PricingCard({ plan, billing, isCurrent, onSelect, isTop, deckIndex, onBringToFront }) {
  const Icon = plan.icon;
  const activePrice = billing === 'yearly' ? plan.price.yearly : plan.price.monthly;
  const originalPrice = plan.originalPrice
    ? billing === 'yearly'
      ? plan.originalPrice.yearly
      : plan.originalPrice.monthly
    : null;

  const isFree = plan.id === 'free';

  // Clicking a stacked (non-top) card brings it to the front.
  // The front card is only cycled via its grip handle or the deck arrows.
  const handleBodyClick = () => {
    if (!isTop && onBringToFront) onBringToFront();
  };

  return (
    <TiltCard
      className={`pro-card ${plan.featured ? 'featured' : ''} ${plan.iconClass} ${isTop ? 'top' : ''}`}
      deckIndex={deckIndex}
      onClick={handleBodyClick}
    >
      {isTop && (
        <button
          className="pro-card-grip"
          aria-label={`Move ${plan.name} to the back`}
          onClick={(e) => {
            e.stopPropagation();
            onBringToFront();
          }}
        >
          <span className="pro-card-grip-line" />
          <span className="pro-card-grip-line" />
          <span className="pro-card-grip-line" />
        </button>
      )}
      {plan.badge && (
        <div className="pro-card-badge">
          <Gift size={10} />
          {plan.badge}
        </div>
      )}

      <div className="pro-card-header">
        <div className={`pro-card-icon ${plan.iconClass}`}>
          <Icon size={32} />
        </div>
        <div className="pro-card-name">{plan.name}</div>
        <div className="pro-card-subtitle">{plan.subtitle}</div>
      </div>

      <div className="pro-card-divider" aria-hidden="true" />

      <div className="pro-card-price">
        <div className={`pro-card-amount ${isFree ? 'free-amount' : ''}`}>
          {isFree ? (
            'Free'
          ) : (
            <>
              <span className="currency">৳</span>
              <span className="pro-card-amount-num">{activePrice}</span>
              <span className="period">{plan.period}</span>
            </>
          )}
        </div>

        {originalPrice && (
          <div className="pro-card-original-price">
            <span className="pro-strike">৳{originalPrice}/month</span>
            <span className="pro-save-pill">Save 20%</span>
          </div>
        )}

        {!isFree && (
          <div className="pro-card-perday">
            ≈ ৳{(activePrice / 30).toFixed(1)}/day
          </div>
        )}
      </div>

      <div className="pro-card-features">
        {plan.features.map((feature, i) => (
          <div
            key={i}
            className={`pro-feature-item ${!feature.included ? 'disabled' : ''}`}
            style={{ animationDelay: `${i * 30}ms` }}
          >
            {feature.included ? (
              <Check size={14} className={`pro-feature-check ${feature.highlight ? 'plus' : ''}`} />
            ) : (
              <X size={14} className="pro-feature-check muted" />
            )}
            <span>
              {feature.text}
              {feature.highlight && <span className="pro-feature-highlight"> ★</span>}
            </span>
          </div>
        ))}
      </div>

      <div className="pro-card-cta">
        <button
          className={`pro-cta-btn ${plan.ctaClass}`}
          onClick={(e) => {
            if (!isTop && onBringToFront) {
              // Not in front yet — bring to front instead of acting on a hidden card
              e.stopPropagation();
              onBringToFront();
              return;
            }
            onSelect(plan.id);
          }}
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
  // Fixed yearly billing — the toggle was removed; prices show the yearly rate
  const billing = 'yearly';
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [upgradeState, setUpgradeState] = useState('pick');
  const [currentPlan, setCurrentPlan] = useState(() => localStorage.getItem('austwise_plan') || 'free');

  const heroRef = useRef(null);
  const pricingRef = useRef(null);
  const benefitsRef = useRef(null);
  const compareRef = useRef(null);
  const faqRef = useRef(null);

  useReveal(heroRef);
  useReveal(pricingRef);
  useReveal(benefitsRef);
  useReveal(compareRef);
  useReveal(faqRef);

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

  // Rotate helpers were removed — plans render side by side in a grid.

  return (
    <div className="pro-page">
      {/* ═══════════ HERO ═══════════ */}
      <section ref={heroRef} className="pro-hero pro-reveal">
        <div className="pro-hero-grid" aria-hidden="true" />

        <div className="pro-hero-content">
          <div className="pro-hero-badge">
            <Sparkles size={12} />
            <span>Premium from ৳40/month</span>
          </div>

          <h1 className="pro-hero-title">
            Go Beyond the <br />
            <span className="pro-hero-highlight">Standard Experience</span>
          </h1>

          <p className="pro-hero-subtitle">
            Three tiers, one goal — your academic advantage. Node gets you started,
            Helix unlocks the full toolkit, and Apex adds AI-powered mastery.
            Built exclusively for AUST students.
          </p>

          <div className="pro-hero-features">
            <span className="pro-hero-feature">
              <Shield size={14} />
              <span>Built for AUST students</span>
            </span>
            <span className="pro-hero-feature">
              <InfinityIcon size={14} />
              <span>Cancel anytime</span>
            </span>
            <span className="pro-hero-feature">
              <Gift size={14} />
              <span>7-day free trial</span>
            </span>
          </div>

          <div className="pro-hero-actions">
            <button
              className="pro-btn pro-btn-primary pro-btn-lg"
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Explore Plans <ArrowRight size={16} />
            </button>
            <a href="#comparison" className="pro-btn pro-btn-secondary pro-btn-lg">
              Compare Features <ChevronDown size={16} />
            </a>
          </div>

          <div className="pro-hero-chips">
            <span className="pro-hero-chip">
              <Shield size={12} />
              <span>Built for AUST students</span>
            </span>
            <span className="pro-hero-chip">
              <InfinityIcon size={12} />
              <span>Cancel anytime</span>
            </span>
            <span className="pro-hero-chip">
              <Gift size={12} />
              <span>7-day free trial</span>
            </span>
          </div>
        </div>
      </section>

      {/* ═══════════ PRICING ═══════════ */}
      <div ref={pricingRef} className="pro-deck-wrap pro-reveal" id="pricing">
        <div className="pro-deck pro-deck-grid" role="group" aria-label="Plans">
          {PLANS.map((plan, i) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              billing={billing}
              isCurrent={currentPlan === plan.id}
              isTop
              deckIndex={i}
              onSelect={handleSelectPlan}
            />
          ))}
        </div>
      </div>

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
          <p className="pro-section-desc">
            Everything you need to know before upgrading.
          </p>
        </div>
        <FaqAccordion />
      </section>

      {/* ═══════════ WHY PREMIUM ═══════════ */}
      <section ref={benefitsRef} className="pro-benefits-section pro-reveal">
        <div className="pro-section-header">
          <div className="pro-section-badge">
            <Crown size={12} />
            <span>Why Upgrade</span>
          </div>
          <h2 className="pro-section-title">
            More Than Just <span className="pro-section-highlight">Removing Ads</span>
          </h2>
          <p className="pro-section-desc">
            Premium plans remove every friction between you and academic success.
          </p>
        </div>
        <div className="pro-benefits-grid">
          {BENEFITS.map((b, i) => {
            const Icon = b.icon;
            return (
              <TiltCard key={i} className="pro-benefit-card" maxTilt={5}>
                <div
                  className="pro-benefit-icon"
                  style={{ background: b.glow, color: b.color }}
                >
                  <Icon size={26} />
                </div>
                <h3 className="pro-benefit-title">{b.title}</h3>
                <p className="pro-benefit-desc">{b.desc}</p>
              </TiltCard>
            );
          })}
        </div>
      </section>

      {/* ═══════════ COMPARISON ═══════════ */}
      <section ref={compareRef} id="comparison" className="pro-comparison-section pro-reveal">
        <div className="pro-section-header">
          <div className="pro-section-badge">
            <BarChart3 size={12} />
            <span>Compare Features</span>
          </div>
          <h2 className="pro-section-title">
            Side-by-Side <span className="pro-section-highlight">Comparison</span>
          </h2>
          <p className="pro-section-desc">
            See exactly what each plan offers — all built for AUST students.
          </p>
        </div>

        <div className="pro-comparison-table">
          <div className="pro-compare-row header">
            <div className="pro-compare-cell">Feature</div>
            <div className="pro-compare-cell pro-compare-plan-head">
              <Star size={12} />
              <span>Node</span>
            </div>
            <div className="pro-compare-cell pro-compare-plan-head pro-reco">
              <Crown size={12} />
              <span>Helix</span>
              <span className="pro-reco-pill">Popular</span>
            </div>
            <div className="pro-compare-cell pro-compare-plan-head">
              <Zap size={12} />
              <span>Apex</span>
            </div>
          </div>
          {COMPARISON_FEATURES[0].features.map((feature, i) => (
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
            <span>Student Stories</span>
          </div>
          <h2 className="pro-section-title">
            What <span className="pro-section-highlight">Students</span> Are Saying
          </h2>
          <p className="pro-section-desc">
            Join 2,400+ premium users who\'ve upgraded their academic game.
          </p>
        </div>
        <TestimonialList />
      </section>

      {/* ═══════════ BOTTOM CTA ═══════════ */}
      <section className="pro-bottom-cta pro-reveal">
        <div className="pro-cta-card">
          <div className="pro-cta-visual" aria-hidden="true">
            <Crown size={48} className="pro-cta-crown" />
          </div>
          <h3 className="pro-cta-title">Ready to Go Premium?</h3>
          <p className="pro-cta-desc">
            Your support keeps AUSTWise running and improving. Every subscription
            funds new features that make education better for every AUST student.
          </p>
          <div className="pro-cta-guarantee">
            <Shield size={14} />
            <span>7-day money-back guarantee · Cancel anytime</span>
          </div>
          <button
            className="pro-btn pro-btn-primary pro-btn-lg"
            onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Choose Your Plan <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* ═══════════ PAYMENT MODAL ═══════════ */}
      {showModal && selectedPlan && (
        <div className="pro-payment-overlay" onClick={closeModal}>
          <div
            className="pro-payment-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {upgradeState === 'pick' && (
              <>
                <div className="pro-modal-header">
                  <div className="pro-modal-icon upgrade">
                    <Crown size={32} />
                  </div>
                  <h3>Upgrade Your Plan</h3>
                  <p>Choose your subscription to unlock premium features.</p>
                </div>

                <div className="pro-modal-plans">
                  {PLANS.filter((p) => p.id !== 'free').map((plan) => {
                    const Icon = plan.icon;
                    const price = billing === 'yearly' ? plan.price.yearly : plan.price.monthly;
                    const period = billing === 'yearly' ? '/mo · billed yearly' : '/month';
                    return (
                      <label
                        key={plan.id}
                        className={`pro-modal-plan ${selectedPlan === plan.id ? 'selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="plan"
                          value={plan.id}
                          checked={selectedPlan === plan.id}
                          onChange={() => setSelectedPlan(plan.id)}
                        />
                        <div className="pro-modal-plan-left">
                          <Icon size={20} style={{ color: plan.id === 'pro' ? 'var(--accent-amber)' : 'var(--accent-emerald)' }} />
                          <div>
                            <div className="pro-modal-plan-name">{plan.name}</div>
                            <div className="pro-modal-plan-price">
                              ৳{price}{period}
                            </div>
                          </div>
                        </div>
                        <div className="pro-modal-plan-tag">{plan.ctaText}</div>
                      </label>
                    );
                  })}
                </div>

                <div className="pro-modal-actions">
                  <button className="pro-btn pro-btn-secondary" onClick={closeModal}>
                    Cancel
                  </button>
                  <button className="pro-btn pro-btn-primary" onClick={handleUpgrade}>
                    <Crown size={16} />
                    Upgrade Now
                  </button>
                </div>
              </>
            )}

            {upgradeState === 'loading' && (
              <div className="pro-modal-state">
                <div className="pro-modal-spinner">
                  <div className="pro-spinner-ring">
                    <div className="pro-spinner" />
                  </div>
                </div>
                <h3>Activating {PLANS.find((p) => p.id === selectedPlan)?.name}…</h3>
                <p>Wiring up your premium features.</p>
                <div className="pro-loading-bar">
                  <span style={{ width: '60%' }} />
                </div>
              </div>
            )}

            {upgradeState === 'success' && (
              <div className="pro-modal-state">
                <div className="pro-modal-icon success">
                  <Crown size={30} />
                </div>
                <h3>Welcome to {PLANS.find((p) => p.id === selectedPlan)?.name}!</h3>
                <p>You're all set. Enjoy your premium AUSTWise experience.</p>
                <button className="pro-btn pro-btn-primary" onClick={closeModal}>
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
