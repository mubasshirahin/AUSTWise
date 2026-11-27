import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check, Crown, ArrowRight, Minus,
  BarChart3, Archive, Brain, Cloud, Ban, ChevronDown, Paintbrush,
} from 'lucide-react';
import './ProPage.css';
import TestimonialRail from '../../components/TestimonialRail';
import { API_URL, wakeBackend } from '../../utils/api';
import { useTheme } from '../../context/ThemeContext';
import { THEME_ACCENTS, THEME_LAYOUT, PRO_LAYOUTS, THEME_STYLES } from '../../context/themeConstants';

// ─── Plans ───
const NODE = {
  id: 'free',
  name: 'Node',
  includes: ['Dashboard & CGPA tracking', 'Class routine', 'Resource Vault (500MB)', 'Basic analytics', 'Community'],
};

const PAID_PLANS = [
  {
    id: 'pro',
    name: 'Helix',
    subtitle: 'The toolkit',
    price: 50,
    period: 'month',
    days: 30,
    note: 'One month of access, then back to Node. Nothing renews.',
    ctaText: 'Get Helix',
    badge: 'Most popular',
    featured: true,
    features: [
      { text: 'Everything in Node' },
      { text: 'No ads on any page' },
      { text: 'Premium themes' },
      { text: 'Advanced analytics' },
      { text: 'Export to PDF and Excel' },
      { text: 'Priority email support' },
      { text: 'Vault storage up to 5GB', key: true },
    ],
  },
  {
    id: 'premium',
    name: 'Apex',
    subtitle: 'The full suite',
    price: 500,
    original: 600,
    period: 'year',
    days: 365,
    note: 'A full year from the day you pay.',
    ctaText: 'Get Apex',
    features: [
      { text: 'Everything in Helix' },
      { text: 'AI study assistant', key: true },
      { text: 'Unlimited Vault storage' },
      { text: 'Priority 24/7 support' },
      { text: 'Direct mentorship access' },
      { text: 'Early and beta features' },
      { text: 'Exclusive community badges' },
    ],
  },
];

const ALL_PLANS = [{ ...NODE, price: 0 }, ...PAID_PLANS];

// ─── Comparison ───
const COMPARISON = [
  { name: 'Dashboard & CGPA tracking', free: true, pro: true, premium: true },
  { name: 'Class routine management', free: true, pro: true, premium: true },
  { name: 'Resource Vault', free: '500MB', pro: '5GB', premium: 'Unlimited' },
  { name: 'Community access', free: true, pro: true, premium: true },
  { name: 'No ads', free: false, pro: true, premium: true },
  { name: 'Premium themes', free: false, pro: true, premium: true },
  { name: 'Advanced analytics', free: false, pro: true, premium: true },
  { name: 'Export (PDF, Excel)', free: false, pro: true, premium: true },
  { name: 'Priority support', free: false, pro: 'Email', premium: '24/7' },
  { name: 'AI study assistant', free: false, pro: false, premium: true },
  { name: 'Exclusive badges', free: false, pro: false, premium: true },
];

// ─── Premium themes. Tile colours are content (other themes' own palettes).
const THEME_LIST = [
  ['midnight', 'Midnight', '#0A0A0F'],
  ['nexus', 'Nexus', '#0A0A0C'],
  ['cyberpunk', 'Cyberpunk', '#0a0a0f'],
  ['terminal', 'Terminal', '#0a0a0a'],
  ['bitcoindefi', 'Bitcoin DeFi', '#1a1b1e'],
  ['art-deco', 'Art Deco', '#0A0A0A'],
  ['poster', 'Bold Type', '#0A0A0A'],
  ['meshtopo', 'Mesh Topology', '#050505'],
  ['obsidian', 'Obsidian', '#0B0B0C'],
  ['prism', 'Prism', '#0E0F13'],
  ['lofi', 'Lo-fi', '#151412'],
  ['arcade', 'Arcade', '#090A0F'],
  ['nightowl', 'Night Owl', '#000000'],
  ['light', 'Light', '#f8f7f4'],
  ['swiss', 'Swiss', '#ffffff'],
  ['newsprint', 'Newsprint', '#f9f9f7'],
  ['sketchbook', 'Sketchbook', '#fdfbf7'],
  ['industrial', 'Industrial', '#e0e5ec'],
  ['minimalist-monochrome', 'Monochrome', '#ffffff'],
  ['pastel', 'Pastel', '#F8F7F5'],
  ['toon', 'Toon', '#FBF8F3'],
  ['sakura', 'Sakura', '#FBF8F9'],
  ['notebook', 'Notebook', '#F6F6F6'],
].filter(([id]) => PRO_LAYOUTS.includes(THEME_LAYOUT[id]));

const LAYOUT_NAMES = { hud: 'HUD' };
const layoutName = (id) => LAYOUT_NAMES[id] || id.charAt(0).toUpperCase() + id.slice(1);
const isLightHex = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150;
};

// ─── Benefits ───
const BENEFITS = [
  { icon: Paintbrush, title: 'Premium themes', desc: `${THEME_LIST.length} designs, each with its own colours, type and layout.` },
  { icon: Ban, title: 'No ads', desc: 'Both paid plans remove ads from every page.' },
  { icon: BarChart3, title: 'Advanced analytics', desc: 'Predictive CGPA tracking, department heatmaps and syllabus insights.' },
  { icon: Archive, title: 'More Vault storage', desc: '5GB on Helix and unlimited on Apex, for notes and past papers.' },
  { icon: Brain, title: 'AI study assistant', desc: 'Apex only. Explanations, quizzes and revision plans.' },
  { icon: Cloud, title: 'Cloud sync', desc: 'Your vault and progress on any device.' },
];

// ─── FAQ ───
const FAQ_DATA = [
  {
    question: 'What happens when Helix ends?',
    answer: 'Helix lasts 30 days. After that your account goes back to Node (free) on its own. Nothing renews and you are not charged again.',
  },
  {
    question: 'What if I don\'t upgrade?',
    answer: 'Node stays free with all core features. You just won\'t get ad-free pages, premium themes, advanced analytics or the AI tools.',
  },
  {
    question: 'Is there a student discount?',
    answer: 'Pricing is already set for students. Helix is ৳50 for one month and Apex is ৳500 a year (normally ৳600). There are no promo codes.',
  },
  {
    question: 'Can I move from Helix to Apex?',
    answer: 'Yes. You can buy Apex at any time, even while Helix is active. Unused Helix days are not refunded or credited.',
  },
  {
    question: 'How do I pay?',
    answer: 'You pick a plan here and finish the payment on PipraPay. The plan turns on once the payment is confirmed.',
  },
];

const perDay = (price, days) => (price / days).toFixed(1);

// ─── Pieces ───
/* The ৳ sign: theme fonts fall back to Segoe UI, whose ৳ renders tiny. */
const Tk = () => <span className="pro-tk">৳</span>;

function SectionHeader({ title, desc, id }) {
  return (
    <div className="pro-sh">
      <h2 className="pro-sh-title" id={id}>{title}</h2>
      {desc && <p className="pro-sh-desc">{desc}</p>}
    </div>
  );
}

function PlanCard({ plan, isCurrent, onSelect }) {
  return (
    <article className={`glass-card-static pro-card ${plan.featured ? 'is-featured' : ''}`} aria-labelledby={`plan-${plan.id}`}>
      <header className="pro-card-head">
        <div className="pro-card-name-row">
          <h3 className="pro-card-name" id={`plan-${plan.id}`}>{plan.name}</h3>
          {plan.badge && <span className="pro-card-badge">{plan.badge}</span>}
        </div>
        <p className="pro-card-sub">{plan.subtitle}</p>
      </header>

      <div className="pro-card-price">
        <div className="pro-price">
          <span className="pro-price-cur pro-tk">৳</span>
          <span className="pro-price-num">{plan.price}</span>
          <span className="pro-price-per">/ {plan.period}</span>
        </div>
        <p className="pro-price-meta pro-mono">
          ≈ <Tk />{perDay(plan.price, plan.days)} a day
          {plan.original && (
            <>
              <span aria-hidden="true"> · </span>
              <s><Tk />{plan.original}</s> save <Tk />{plan.original - plan.price}
            </>
          )}
        </p>
      </div>

      <ul className="pro-card-list">
        {plan.features.map((f) => (
          <li key={f.text} className={f.key ? 'is-key' : ''}>
            <Check size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>{f.text}</span>
          </li>
        ))}
      </ul>

      <div className="pro-card-foot">
        <button
          type="button"
          className={`pro-btn ${plan.featured ? 'pro-btn-accent' : 'pro-btn-ink'}`}
          onClick={() => onSelect(plan.id)}
          disabled={isCurrent}
        >
          {isCurrent ? 'Current plan' : plan.ctaText}
          {!isCurrent && <ArrowRight size={16} strokeWidth={1.75} />}
        </button>
        <p className="pro-card-note">{plan.note}</p>
      </div>
    </article>
  );
}

function NodeRow({ isCurrent }) {
  return (
    <div className="glass-card-static pro-node">
      <div className="pro-node-id">
        <span className="pro-node-name">Node</span>
        <span className="pro-node-price pro-mono"><Tk />0 forever</span>
      </div>
      <p className="pro-node-list">
        {NODE.includes.join(' · ')}
        <span className="pro-node-ads"> · with ads</span>
      </p>
      <span className={`pro-node-state ${isCurrent ? 'is-current' : ''}`}>
        {isCurrent ? <><Check size={16} strokeWidth={1.75} /> Your plan</> : 'Free'}
      </span>
    </div>
  );
}

// Live theme preview: the stage carries data-theme, so every token inside it
// (colours, radii, fonts) comes from that theme's own stylesheet.
function ThemeStudio() {
  const { theme, setTheme, themes: visibleThemes } = useTheme();
  const paidIds = THEME_LIST.map(([id]) => id);
  const [sel, setSel] = useState(() => (paidIds.includes(theme) ? theme : 'newsprint'));
  const current = THEME_LIST.find(([id]) => id === sel) || THEME_LIST[0];

  useEffect(() => { THEME_STYLES[sel]?.().catch(() => {}); }, [sel]);
  const prefetch = (id) => THEME_STYLES[id]?.().catch(() => {});

  return (
    <div className="glass-card-static pro-studio">
      <div className="pro-studio-stage-wrap">
        <div className="pro-stage" data-theme={sel} aria-label={`${current[1]} theme preview`}>
          <div className="pro-stage-bar">
            <span className="pro-stage-brand">AUSTWise</span>
            <span className="pro-stage-pill">Routine</span>
          </div>
          <div className="pro-stage-body">
            <span className="pro-stage-over">Thursday, 20 November</span>
            <div className="pro-stage-title">Good morning, <span>Nabila</span></div>
            <div className="pro-stage-grid">
              <div className="pro-stage-card pro-stage-today">
                <div className="pro-stage-card-head">
                  <span>Today</span>
                  <span className="pro-stage-chip">3 classes</span>
                </div>
                <ul>
                  <li className="is-now"><b>08:00</b><span>CSE 3101 · Database Systems</span><i>7A01</i></li>
                  <li><b>09:40</b><span>CSE 3103 · Microprocessors</span><i>7A04</i></li>
                  <li><b>11:20</b><span>HUM 3101 · Economics</span><i>5B02</i></li>
                </ul>
              </div>
              <div className="pro-stage-side">
                <div className="pro-stage-card pro-stage-stat">
                  <span>CGPA</span>
                  <strong>3.62</strong>
                </div>
                <div className="pro-stage-card pro-stage-stat">
                  <span>Study streak</span>
                  <strong>12 days</strong>
                </div>
                <span className="pro-stage-btn">Load routine</span>
              </div>
            </div>
          </div>
        </div>
        <div className="pro-studio-caption">
          <div>
            <span className="pro-studio-name">{current[1]}</span>
            <span className="pro-studio-layout pro-mono">{layoutName(THEME_LAYOUT[sel])} layout</span>
          </div>
          <button
            type="button"
            className="pro-btn pro-btn-quiet"
            onClick={() => setTheme(sel)}
            disabled={theme === sel || !visibleThemes.includes(sel)}
          >
            {theme === sel ? 'In use' : visibleThemes.includes(sel) ? 'Use this theme' : 'Coming soon'}
          </button>
        </div>
      </div>

      <ul className="pro-studio-list" role="listbox" aria-label="Premium themes">
        {THEME_LIST.map(([id, label, bg]) => {
          const ink = isLightHex(bg) ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.82)';
          return (
            <li key={id} role="none">
              <button
                type="button"
                role="option"
                aria-selected={sel === id}
                className={`pro-swatch ${sel === id ? 'is-on' : ''}`}
                onClick={() => setSel(id)}
                onMouseEnter={() => prefetch(id)}
                onFocus={() => prefetch(id)}
              >
                <span className="pro-swatch-chip" style={{ background: bg }} aria-hidden="true">
                  <span style={{ background: ink }} />
                  <span style={{ background: THEME_ACCENTS[id] }} />
                </span>
                <span className="pro-swatch-name">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FaqList() {
  const [openId, setOpenId] = useState(0);
  return (
    <div className="glass-card-static pro-faq">
      {FAQ_DATA.map((item, idx) => {
        const open = openId === idx;
        return (
          <div key={item.question} className={`pro-faq-item ${open ? 'is-open' : ''}`}>
            <button
              type="button"
              className="pro-faq-q"
              onClick={() => setOpenId(open ? null : idx)}
              aria-expanded={open}
            >
              <span>{item.question}</span>
              <ChevronDown size={16} strokeWidth={1.75} />
            </button>
            <div className="pro-faq-a"><p>{item.answer}</p></div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ───
export default function ProPage() {
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [upgradeState, setUpgradeState] = useState('pick');

  const checkPlanExpiry = () => {
    const stored = localStorage.getItem('austwise_plan');
    const storedDate = localStorage.getItem('austwise_plan_date');
    if (stored === 'pro' && storedDate) {
      const diffDays = (new Date() - new Date(storedDate)) / (1000 * 60 * 60 * 24);
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
    const plan = PAID_PLANS.find((p) => p.id === selectedPlan);
    if (!plan) return;
    setUpgradeState('loading');
    wakeBackend();
    try {
      const res = await fetch(`${API_URL}/api/payment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: plan.price,
          purpose: `pro-${selectedPlan}`,
          description: `AUSTWise ${plan.name} plan`,
        }),
      });
      const data = await res.json();
      if (data.success && data.ppUrl) {
        window.location.href = data.ppUrl;
      } else {
        alert(data.error || 'Payment could not be created. Please try again.');
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

  useEffect(() => {
    if (!showModal) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const cell = (value) => {
    if (value === true) return <Check size={16} strokeWidth={1.75} className="pro-yes" aria-label="Included" />;
    if (value === false) return <Minus size={16} strokeWidth={1.5} className="pro-no" aria-label="Not included" />;
    return <span className="pro-val pro-mono">{value}</span>;
  };

  const chosen = PAID_PLANS.find((p) => p.id === selectedPlan);

  return (
    <div className="pro-page">
      {/* Masthead */}
      <header className="glass-card-static pro-masthead">
        <div className="schedule-masthead">
          <div className="schedule-title-block">
            <div className="schedule-icon-tile" aria-hidden="true">
              <Crown size={20} strokeWidth={1.75} />
            </div>
            <div>
              <span className="schedule-overline">See plans</span>
              <h1 className="schedule-title">Plans and pricing</h1>
              <span className="schedule-subtitle">Node is free. Helix and Apex add premium themes, more storage and better tools.</span>
            </div>
          </div>
          <dl className="pro-stats">
            <div><dt>Students</dt><dd>2,400+</dd></div>
            <div><dt>Premium themes</dt><dd>{THEME_LIST.length}</dd></div>
            <div><dt>From</dt><dd><Tk />50</dd></div>
          </dl>
        </div>
      </header>

      {/* Plans */}
      <section className="pro-section" id="pricing" aria-label="Plans">
        <div className="pro-cards">
          {PAID_PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} isCurrent={currentPlan === plan.id} onSelect={handleSelectPlan} />
          ))}
        </div>
        <NodeRow isCurrent={currentPlan === 'free'} />
      </section>

      {/* Theme studio */}
      <section className="pro-section" aria-labelledby="pro-themes-title">
        <SectionHeader
          id="pro-themes-title"
          title="Every theme is a full design"
          desc="Each premium theme brings its own colours, type and page layout. Pick one to preview it."
        />
        <ThemeStudio />
      </section>

      {/* Benefits */}
      <section className="pro-section" aria-labelledby="pro-adds-title">
        <SectionHeader id="pro-adds-title" title="What the paid plans add" />
        <ul className="pro-adds">
          {BENEFITS.map(({ icon: Icon, title, desc }) => (
            <li key={title}>
              <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
              <div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Comparison */}
      <section className="pro-section" id="comparison" aria-labelledby="pro-cmp-title">
        <SectionHeader id="pro-cmp-title" title="Compare plans" desc="Every feature, plan by plan" />
        <div className="glass-card-static pro-table-wrap">
          <table className="pro-table">
            <thead>
              <tr>
                <th scope="col">Feature</th>
                <th scope="col">Node</th>
                <th scope="col" className="is-featured">Helix</th>
                <th scope="col">Apex</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.name}>
                  <th scope="row">{row.name}</th>
                  <td>{cell(row.free)}</td>
                  <td className="is-featured">{cell(row.pro)}</td>
                  <td>{cell(row.premium)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Price</th>
                {ALL_PLANS.map((p) => (
                  <td key={p.id} className={p.featured ? 'is-featured' : ''}>
                    <span className="pro-val pro-mono"><Tk />{p.price}{p.period ? ` / ${p.period}` : ''}</span>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Testimonials */}
      <section className="pro-section" aria-labelledby="pro-tm-title">
        <SectionHeader id="pro-tm-title" title="What students say" desc="From 2,400+ AUST students using AUSTWise" />
        <TestimonialRail />
      </section>

      {/* FAQ */}
      <section className="pro-section pro-faq-section" aria-labelledby="pro-faq-title">
        <SectionHeader id="pro-faq-title" title="Questions" desc="Before you pay" />
        <FaqList />
      </section>

      {/* Closing */}
      <section className="glass-card-static pro-close">
        <div className="pro-close-text">
          <h2>Pick a plan</h2>
          <p>Every payment keeps AUSTWise running and pays for new features for AUST students.</p>
          <span className="pro-mono">One-time payment · nothing renews</span>
        </div>
        <div className="pro-close-actions">
          <button type="button" className="pro-btn pro-btn-accent" onClick={() => handleSelectPlan('pro')}>
            Get Helix · <Tk />50
          </button>
          <button type="button" className="pro-btn pro-btn-quiet" onClick={() => handleSelectPlan('premium')}>
            Get Apex · <Tk />500
          </button>
        </div>
      </section>

      {/* Payment modal */}
      {showModal && chosen && createPortal(
        <div className="pro-overlay" onClick={closeModal}>
          <div className="pro-modal" role="dialog" aria-modal="true" aria-labelledby="pro-modal-title" onClick={(e) => e.stopPropagation()}>
            {upgradeState === 'pick' && (
              <>
                <div className="pro-modal-head">
                  <h3 id="pro-modal-title">Choose a plan</h3>
                  <p>You'll finish the payment on PipraPay.</p>
                </div>
                <div className="pro-modal-plans" role="radiogroup">
                  {PAID_PLANS.map((plan) => (
                    <label key={plan.id} className={`pro-modal-plan ${selectedPlan === plan.id ? 'is-on' : ''}`}>
                      <input
                        type="radio"
                        name="plan"
                        value={plan.id}
                        checked={selectedPlan === plan.id}
                        onChange={() => setSelectedPlan(plan.id)}
                      />
                      <span className="pro-modal-plan-text">
                        <b>{plan.name}</b>
                        <i>for one {plan.period}</i>
                      </span>
                      <span className="pro-mono"><Tk />{plan.price}</span>
                    </label>
                  ))}
                </div>
                <div className="pro-modal-actions">
                  <button type="button" className="pro-btn pro-btn-quiet" onClick={closeModal}>Cancel</button>
                  <button type="button" className="pro-btn pro-btn-accent" onClick={handleUpgrade}>
                    Continue to payment <ArrowRight size={16} strokeWidth={1.75} />
                  </button>
                </div>
              </>
            )}
            {upgradeState === 'loading' && (
              <div className="pro-modal-state">
                <div className="pro-spinner" />
                <h3>Opening payment</h3>
                <p>Taking you to PipraPay for {chosen.name}</p>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
