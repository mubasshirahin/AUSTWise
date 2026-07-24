import { useState } from 'react';
import {
  Sparkles, Check, X, Crown, Star, Zap,
  ArrowRight, Gift, Heart
} from 'lucide-react';
import './ProPage.css';

// ─── Plan Definitions ───
const PLANS = [
  {
    id: 'free',
    name: 'Node',
    subtitle: 'Get started with basics',
    price: 0,
    period: 'forever',
    originalPrice: null,
    icon: Star,
    iconClass: 'node',
    ctaClass: 'node',
    ctaText: 'Current Plan',
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
    price: 50,
    period: '/month',
    originalPrice: null,
    icon: Crown,
    iconClass: 'helix',
    ctaClass: 'helix',
    ctaText: 'Get Helix',
    badge: 'Most Popular',
    featured: true,
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
    price: 500,
    period: '/year',
    originalPrice: null,
    icon: Zap,
    iconClass: 'apex',
    ctaClass: 'apex',
    ctaText: 'Go Apex',
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

export default function ProPage() {
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(() => localStorage.getItem('austwise_plan') || 'free');

  const handleSelectPlan = (planId) => {
    if (planId === 'free') return; // Already on free
    setSelectedPlan(planId);
    setShowModal(true);
  };

  const handleUpgrade = () => {
    // In a real app, this would initiate payment
    // For now, store in localStorage and update UI
    if (selectedPlan) {
      localStorage.setItem('austwise_plan', selectedPlan);
      setCurrentPlan(selectedPlan);
      setShowModal(false);
    }
  };

  const renderCheck = (value) => {
    if (value === true) return <Check size={14} className="check" />;
    if (value === false) return <X size={14} className="cross" />;
    return <span className="highlight">{value}</span>;
  };

  return (
    <div className="pro-page">
      {/* ─── Hero Section ─── */}
      <section className="pro-hero">
        <div className="pro-hero-bg" aria-hidden="true">
          <div className="pro-hero-grid" />
          <div className="pro-hero-particle" />
          <div className="pro-hero-particle" />
          <div className="pro-hero-particle" />
          <div className="pro-hero-particle" />
          <div className="pro-hero-particle" />
          <div className="pro-hero-particle" />
          <div className="pro-hero-glow pro-hero-glow-1" />
          <div className="pro-hero-glow pro-hero-glow-2" />
          <div className="pro-hero-orb pro-hero-orb-1" />
          <div className="pro-hero-orb pro-hero-orb-2" />
        </div>
        <div className="pro-hero-content">
          <div className="pro-hero-badge">
            <Sparkles size={12} />
            <span>Unlock Premium Features</span>
          </div>            <h1>
            Go <span>See Plans</span>
          </h1>
          <p>
            Three tiers, one goal — your academic edge. Node gets you started, Helix unlocks the
            full toolkit, and Apex gives you everything plus AI-powered mastery.
          </p>
        </div>
      </section>

      <div className="section-header">
        <h2 className="section-title">
          <span className="icon" style={{ background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>
            <Sparkles size={16} />
          </span>
          Choose Your Plan
        </h2>
        <p className="section-subtitle">Unlock premium features and take control of your academic journey</p>
      </div>

      {/* ─── Pricing Cards ─── */}
      <div className="pro-pricing-grid">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = currentPlan === plan.id;
          const isFree = plan.id === 'free';

          return (
            <div
              key={plan.id}
              className={`pro-card ${plan.featured ? 'featured' : ''} ${isCurrent ? 'pro-card-current' : ''}`}
            >
              {plan.badge && (
                <div className="pro-card-badge">
                  <Gift size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  {plan.badge}
                </div>
              )}

              <div className="pro-card-header">
                <div className={`pro-card-icon ${plan.iconClass}`}>
                  <Icon size={24} />
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
                      {plan.price}
                      <span className="period">{plan.period}</span>
                    </>
                  )}
                </div>
                {plan.originalPrice && (
                  <div className="pro-card-original-price">
                    ৳{plan.originalPrice}/month
                  </div>
                )}
              </div>

              <div className="pro-card-features">
                {plan.features.map((feature, i) => (
                  <div
                    key={i}
                    className={`pro-feature-item ${!feature.included ? 'disabled' : ''}`}
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
                  onClick={() => handleSelectPlan(plan.id)}
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
            </div>
          );
        })}
      </div>

      {/* ─── Feature Comparison Table ─── */}
      <section className="pro-comparison-section">
        <div className="section-header">
          <h2 className="section-title">
            <span className="icon" style={{ background: 'var(--accent-purple-glow)', color: 'var(--accent-purple)' }}>
              <Crown size={16} />
            </span>
            Compare All Features
          </h2>
          <p className="section-subtitle">See exactly what you get with each plan</p>
        </div>
        <div className="pro-comparison-table">
          <div className="pro-compare-row header">
            <div className="pro-compare-cell">Feature</div>
            <div className="pro-compare-cell">Node</div>
            <div className="pro-compare-cell">Helix</div>
            <div className="pro-compare-cell">Apex</div>
          </div>
          {COMPARISON_FEATURES.map((feature, i) => (
            <div key={i} className="pro-compare-row">
              <div className="pro-compare-cell">{feature.name}</div>
              <div className="pro-compare-cell">{renderCheck(feature.free)}</div>
              <div className="pro-compare-cell">{renderCheck(feature.pro)}</div>
              <div className="pro-compare-cell">{renderCheck(feature.premium)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Bottom CTA ─── */}
      <section className="pro-bottom-cta">
        <p>
          <Heart size={14} style={{ verticalAlign: 'middle', color: 'var(--accent-rose)', marginRight: 4 }} />
          Your support helps keep AUSTWise running and improving. Every subscription
          goes toward server costs, new features, and making education better for everyone.
        </p>
      </section>

      {/* ─── Upgrade / Payment Modal ─── */}
      {showModal && selectedPlan && (
        <div className="pro-payment-modal" onClick={() => setShowModal(false)}>
          <div className="pro-payment-modal-content" onClick={e => e.stopPropagation()}>
            <div className="pro-payment-modal-icon upgrade">
              <Crown size={32} />
            </div>
            <h3>Upgrade Your Plan</h3>
            <p>
              Choose your subscription plan to unlock premium features.
              You can switch or cancel anytime.
            </p>

            <div className="pro-modal-plans">
              {PLANS.filter(p => p.id !== 'free').map((plan) => {
                const Icon = plan.icon;
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
                    <Icon size={18} style={{ color:                        plan.id === 'pro' ? 'var(--accent-amber)' : 'var(--accent-purple)' }} />
                    <div className="pro-modal-plan-info">
                      <div className="pro-modal-plan-name">{plan.name}</div>
                      <div className="pro-modal-plan-price">৳{plan.price}{plan.period}</div>
                    </div>
                    <div style={{ fontWeight: 'bold', fontSize: 'var(--fs-sm)' }}>
                      ৳{plan.price}
                    </div>
                  </label>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleUpgrade} style={{ background: 'linear-gradient(135deg, var(--accent-amber), #b8860b)', border: 'none' }}>
                <Crown size={16} />
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
