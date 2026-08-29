import { useState } from 'react';
import {
  Sparkles, Check, X, Crown, Star, Zap,
  ArrowRight, Gift, Shield, Infinity as InfinityIcon,
  BarChart3, Archive, Brain, Palette,
  Cloud, ChevronDown,
} from 'lucide-react';
import './ProPage.css';
import { topTestimonials, bottomTestimonials } from '../../data/testimonials';
import { API_URL, wakeBackend } from '../../utils/api';

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
    ctaText: 'Get Started',
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
    price: { monthly: 50 },
    period: '/month',
    originalPrice: null,
    note: '1-month access, then back to Node (free)',
    icon: Crown,
    iconClass: 'helix',
    ctaClass: 'helix',
    ctaText: 'Get Helix',
    badge: 'Most Popular',
    featured: true,
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
    price: { yearly: 500 },
    period: '/year',
    originalPrice: { yearly: 600 },
    icon: Zap,
    iconClass: 'apex',
    ctaClass: 'apex',
    ctaText: 'Go Apex',
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
// ─── FAQ Data ───
const FAQ_DATA = [
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. Cancel anytime from Settings. Premium features stay active until the end of your billing period. Helix auto-reverts to Node (free) after 1 month.',
  },
  {
    question: 'What if I don\'t upgrade?',
    answer: 'Your free Node plan stays active with all core features. You just miss ad-free, advanced analytics, and AI tools.',
  },
  {
    question: 'Is there a student discount?',
    answer: 'Our pricing is already student-first. Helix is ৳50/month (1-month access, then back to Node free), Apex is ৳500/year (normally ৳600). No promo codes needed.',
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

// ─── FAQ Accordion ───
function FaqAccordion() {
  const [openId, setOpenId] = useState(null);

  return (
    <div className="pro-faq">
      {FAQ_DATA.map((item, idx) => (
        <div key={idx} className="pro-faq-item">
          <button
            className={`pro-faq-question ${openId === idx ? 'open' : ''}`}
            onClick={() => setOpenId(openId === idx ? null : idx)}
          >
            <span>{item.question}</span>
            <ChevronDown size={18} />
          </button>
          <div className={`pro-faq-answer ${openId === idx ? 'open' : ''}`}>
            <p>{item.answer}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Sliding Testimonials (dual marquee — same as the landing page) ───
function TestimonialMarquee() {
  const pauseTrack = (e, state) => {
    e.currentTarget.querySelector('.pro-tm-track').style.animationPlayState = state;
  };

  const renderCard = (t, i) => (
    <div key={i} className="pro-tm-card">
      <div className="pro-tm-stars">★★★★★</div>
      <p className="pro-tm-quote">"{t.quote}"</p>
      <div className="pro-tm-user">
        <img src={t.avatar} alt={t.name} className="pro-tm-avatar" />
        <div className="pro-tm-user-info">
          <div className="pro-tm-name">{t.name}</div>
          <div className="pro-tm-role">{t.role}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="pro-tm">
      <div
        className="pro-tm-wrapper"
        onMouseEnter={(e) => pauseTrack(e, 'paused')}
        onMouseLeave={(e) => pauseTrack(e, 'running')}
      >
        <div className="pro-tm-track track-right">
          {[...topTestimonials, ...topTestimonials, ...topTestimonials].map(renderCard)}
        </div>
      </div>

      <div
        className="pro-tm-wrapper"
        onMouseEnter={(e) => pauseTrack(e, 'paused')}
        onMouseLeave={(e) => pauseTrack(e, 'running')}
      >
        <div className="pro-tm-track track-left">
          {[...bottomTestimonials, ...bottomTestimonials, ...bottomTestimonials].map(renderCard)}
        </div>
      </div>
    </div>
  );
}

// ─── Pricing Card ───
function PricingCard({ plan, isCurrent, onSelect }) {
  const Icon = plan.icon;
  const activePrice = plan.price.monthly || plan.price.yearly;
  const originalPrice = plan.originalPrice
    ? plan.originalPrice.monthly || plan.originalPrice.yearly
    : null;
  const isFree = plan.id === 'free';
  const periodLabel = plan.price.monthly ? '/month' : '/year';

  return (
    <div className={`pro-plan ${plan.featured ? 'featured' : ''}`}>
      {plan.badge && (
        <div className="pro-plan-ribbon">
          <Gift size={11} />
          {plan.badge}
        </div>
      )}

      <div className="pro-plan-header">
        <div className={`pro-plan-icon ${plan.iconClass}`}>
          <Icon size={24} />
        </div>
        <div className="pro-plan-name">{plan.name}</div>
        <div className="pro-plan-subtitle">{plan.subtitle}</div>
        {plan.note && (
          <div className="pro-plan-note">{plan.note}</div>
        )}
      </div>

      <div className="pro-plan-price">
        {isFree ? (
          <div className="pro-plan-amount free-amount">Free</div>
        ) : (
          <>
            <div className="pro-plan-amount">
              <span className="cur">৳</span>
              <span className="num">{activePrice}</span>
              <span className="per">{periodLabel}</span>
            </div>
            {originalPrice && (
              <div className="pro-plan-original">
                <span className="pro-strike">৳{originalPrice}{periodLabel}</span>
                <span className="pro-save">Save ৳{originalPrice - activePrice}</span>
              </div>
            )}
            <div className="pro-plan-perday">≈ ৳{(activePrice / (plan.price.monthly ? 30 : 365)).toFixed(1)}/day</div>
          </>
        )}
      </div>

      <div className="pro-plan-features">
        {plan.features.map((feature, i) => (
          <div
            key={i}
            className={`pro-plan-feature ${!feature.included ? 'off' : ''} ${feature.highlight ? 'hl' : ''}`}
          >
            {feature.included ? (
              <Check size={14} className="on" />
            ) : (
              <X size={14} className="off" />
            )}
            <span>
              {feature.text}
              {feature.highlight && <em> ★</em>}
            </span>
          </div>
        ))}
      </div>

      <div className="pro-plan-cta">
        <button
          className={`pro-cta ${plan.ctaClass}`}
          onClick={() => onSelect(plan.id)}
          disabled={isCurrent}
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
    </div>
  );
}

// ─── Main Page ───
export default function ProPage() {
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [upgradeState, setUpgradeState] = useState('pick');

  const checkPlanExpiry = () => {
    const stored = localStorage.getItem('austwise_plan');
    const storedDate = localStorage.getItem('austwise_plan_date');
    if (stored === 'pro' && storedDate) {
      const subDate = new Date(storedDate);
      const now = new Date();
      const diffDays = (now - subDate) / (1000 * 60 * 60 * 24);
      if (diffDays > 30) {
        localStorage.setItem('austwise_plan', 'free');
        localStorage.removeItem('austwise_plan_date');
      }
    }
  };

  checkPlanExpiry();
  const [currentPlan] = useState(() => localStorage.getItem('austwise_plan') || 'free');

  const handleSelectPlan = (planId) => {
    if (planId === 'free') return;
    setSelectedPlan(planId);
    setUpgradeState('pick');
    setShowModal(true);
  };

  const handleUpgrade = async () => {
    if (!selectedPlan) return;
    const plan = PLANS.find((p) => p.id === selectedPlan);
    if (!plan) return;

    setUpgradeState('loading');
    wakeBackend();

    try {
      const amount = plan.price.monthly || plan.price.yearly;
      const res = await fetch(`${API_URL}/api/payment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount,
          purpose: `pro-${selectedPlan}`,
          description: `AUSTWise ${plan.name} plan`,
        }),
      });
      const data = await res.json();
      if (data.success && data.ppUrl) {
        window.location.href = data.ppUrl;
      } else {
        alert(data.error || 'Payment creation failed. Please try again.');
        setUpgradeState('pick');
      }
    } catch {
      alert('Network error. Please try again.');
      setUpgradeState('pick');
    }
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
      {/* ═══════════ MASTHEAD ═══════════ */}
      <header className="glass-card-static pro-masthead">
        <div className="schedule-masthead">
          <div className="schedule-title-block">
            <div className="schedule-icon-tile">
              <Crown size={22} strokeWidth={2.2} />
            </div>
            <div>
              <span className="schedule-overline">See Plans</span>
              <p className="schedule-title">Premium Subscriptions</p>
              <span className="schedule-subtitle">Node gets you started, Helix unlocks the toolkit, Apex adds AI mastery.</span>
            </div>
          </div>
          <div className="pro-stats">
            <div className="pro-stat">
              <strong>2,400+</strong>
              <span>Students</span>
            </div>
            <div className="pro-stat">
              <strong>7-day</strong>
              <span>Free trial</span>
            </div>
            <div className="pro-stat">
              <strong>৳50</strong>
              <span>From /month</span>
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════ PRICING ═══════════ */}
      <section id="pricing" className="pro-section">
        <div className="pro-pricing-grid">
          {PLANS.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              isCurrent={currentPlan === plan.id}
              onSelect={handleSelectPlan}
            />
          ))}
        </div>
      </section>

      {/* ═══════════ WHY PREMIUM ═══════════ */}
      <section className="pro-section">
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
              <div key={i} className="pro-benefit">
                <div className="pro-benefit-icon" style={{ background: b.glow, color: b.color }}>
                  <Icon size={24} />
                </div>
                <h3 className="pro-benefit-title">{b.title}</h3>
                <p className="pro-benefit-desc">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══════════ COMPARISON ═══════════ */}
      <section id="comparison" className="pro-section">
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

        <div className="glass-card-static pro-comparison">
          <div className="pro-cmp-row header">
            <div className="pro-cmp-cell">Feature</div>
            <div className="pro-cmp-cell plan-head">
              <Star size={12} />
              <span>Node</span>
            </div>
            <div className="pro-cmp-cell plan-head reco">
              <Crown size={12} />
              <span>Helix</span>
              <span className="pro-reco-pill">Popular</span>
            </div>
            <div className="pro-cmp-cell plan-head">
              <Zap size={12} />
              <span>Apex</span>
            </div>
          </div>
          {COMPARISON_FEATURES[0].features.map((feature, i) => (
            <div key={i} className="pro-cmp-row">
              <div className="pro-cmp-cell">{feature.name}</div>
              <div className="pro-cmp-cell">{renderCheck(feature.free)}</div>
              <div className="pro-cmp-cell reco">{renderCheck(feature.pro)}</div>
              <div className="pro-cmp-cell">{renderCheck(feature.premium)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════ TESTIMONIALS ═══════════ */}
      <section className="pro-section">
        <div className="pro-section-header">
          <div className="pro-section-badge">
            <Sparkles size={12} />
            <span>Student Stories</span>
          </div>
          <h2 className="pro-section-title">
            What <span className="pro-section-highlight">Students</span> Are Saying
          </h2>
          <p className="pro-section-desc">
            Join 2,400+ premium users who've upgraded their academic game.
          </p>
        </div>
        <TestimonialMarquee />
      </section>

      {/* ═══════════ FAQ ═══════════ */}
      <section className="pro-section">
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

      {/* ═══════════ BOTTOM CTA ═══════════ */}
      <section className="pro-bottom">
        <div className="glass-card-static pro-cta-card">
          <div className="pro-cta-crown" aria-hidden="true">
            <Crown size={40} />
          </div>
          <h3 className="pro-cta-title">Ready to Go Premium?</h3>
          <p className="pro-cta-desc">
            Your support keeps AUSTWise running and improving. Every subscription
            funds new features that make education better for every AUST student.
          </p>
          <div className="pro-cta-chips">
            <span className="pro-cta-chip">
              <Shield size={12} />
              7-day money-back guarantee
            </span>
            <span className="pro-cta-chip">
              <InfinityIcon size={12} />
              Cancel anytime
            </span>
            <span className="pro-cta-chip">
              <Gift size={12} />
              Built for AUST students
            </span>
          </div>
          <button
            className="pro-btn-primary"
            onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Choose Your Plan <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* ═══════════ PAYMENT MODAL ═══════════ */}
      {showModal && selectedPlan && (
        <div className="pro-payment-overlay" onClick={closeModal}>
          <div className="pro-payment-modal" onClick={(e) => e.stopPropagation()}>
            {upgradeState === 'pick' && (
              <>
                <div className="pro-modal-header">
                  <div className="pro-modal-icon upgrade">
                    <Crown size={30} />
                  </div>
                  <h3>Upgrade Your Plan</h3>
                  <p>Choose your subscription to unlock premium features.</p>
                </div>

                <div className="pro-modal-plans">
                  {PLANS.filter((p) => p.id !== 'free').map((plan) => {
                    const Icon = plan.icon;
                    const price = plan.price.monthly || plan.price.yearly;
                    const period = plan.price.monthly ? '/month' : '/year';
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
                            <div className="pro-modal-plan-price">৳{price}{period}</div>
                          </div>
                        </div>
                        <div className="pro-modal-plan-tag">{plan.ctaText}</div>
                      </label>
                    );
                  })}
                </div>

                <div className="pro-modal-actions">
                  <button className="pro-btn-secondary" onClick={closeModal}>Cancel</button>
                  <button className="pro-btn-primary" onClick={handleUpgrade}>
                    <Crown size={16} />
                    Upgrade Now
                  </button>
                </div>
              </>
            )}

            {upgradeState === 'loading' && (
              <div className="pro-modal-state">
                <div className="pro-spinner-ring" />
                <h3>Activating {PLANS.find((p) => p.id === selectedPlan)?.name}…</h3>
                <p>Wiring up your premium features.</p>
                <div className="pro-loading-bar"><span /></div>
              </div>
            )}

            {upgradeState === 'success' && (
              <div className="pro-modal-state">
                <div className="pro-modal-icon success">
                  <Crown size={28} />
                </div>
                <h3>Welcome to {PLANS.find((p) => p.id === selectedPlan)?.name}!</h3>
                <p>You're all set. Enjoy your premium AUSTWise experience.</p>
                <button className="pro-btn-primary" onClick={closeModal}>
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
