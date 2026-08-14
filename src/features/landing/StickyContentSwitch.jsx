import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CalendarDays, MousePointerClick, Network, Radar, Sparkles } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    heading: 'Your Day,',
    highlight: 'Mapped',
    sub: 'Classes, deadlines, and canteen rush in one calm timeline.',
    color: 'var(--accent-cyan)',
    glow: 'var(--accent-cyan-glow)',
    icon: CalendarDays,
    stat: '09:40 AM',
    statLabel: 'Next class · CSE 3102',
    rows: [92, 76, 84],
  },
  {
    heading: 'One Hub,',
    highlight: 'Every Tool',
    sub: 'Messages, notes, payments and transport — connected in one place.',
    color: 'var(--accent-amber)',
    glow: 'var(--accent-amber-glow)',
    icon: Network,
    stat: '6 modules',
    statLabel: 'All synced, zero switching',
    rows: [80, 88, 70],
  },
  {
    heading: 'Know',
    highlight: 'Before You Go',
    sub: 'Live seat availability, transport ETAs and canteen peaks in real time.',
    color: 'var(--accent-emerald)',
    glow: 'var(--accent-emerald-glow)',
    icon: Radar,
    stat: 'LIVE',
    statLabel: 'Library seats · 128 free',
    rows: [70, 92, 78],
  },
  {
    heading: 'Built for',
    highlight: 'AUST Students',
    sub: 'Made by your own peers — and improved with every semester.',
    color: 'var(--accent-rose)',
    glow: 'var(--accent-rose-glow)',
    icon: Sparkles,
    stat: '100%',
    statLabel: 'Free, for every AUST student',
    rows: [84, 74, 90],
  },
];

/**
 * StickyContentSwitch — left heading stays pinned while right panels scroll.
 *
 * GSAP pins the left column; as each 100vh panel reaches the viewport centre
 * the pinned heading crossfades to that step's title and the matching panel
 * lights up. A vertical progress rail fills across the whole run.
 */
export default function StickyContentSwitch() {
  const sectionRef = useRef(null);
  const leftRef = useRef(null);
  const headingRef = useRef(null);
  const subRef = useRef(null);
  const countRef = useRef(null);
  const currentRef = useRef(-1);

  useEffect(() => {
    const section = sectionRef.current;
    const left = leftRef.current;
    const heading = headingRef.current;
    const sub = subRef.current;
    if (!section || !left || !heading || !sub) return;

    const ctx = gsap.context(() => {
      const panels = Array.from(section.querySelectorAll('.landing-switch-panel'));
      const dots = Array.from(left.querySelectorAll('.landing-switch-dot'));

      const swapTo = (i) => {
        const s = steps[i];
        const tl = gsap.timeline({ overwrite: 'auto' });
        tl.to([heading, sub], { opacity: 0, y: -20, filter: 'blur(8px)', duration: 0.3, ease: 'power2.in', stagger: 0.04 })
          .add(() => {
            heading.innerHTML = `${s.heading} <span class="landing-hero-highlight">${s.highlight}</span>`;
            sub.textContent = s.sub;
            left.style.setProperty('--switch-accent', s.color);
            if (countRef.current) {
              countRef.current.textContent = `${String(i + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}`;
            }
            dots.forEach((d, j) => d.classList.toggle('active', j === i));
            panels.forEach((p, j) => p.classList.toggle('active', j === i));
          })
          .fromTo(
            [heading, sub],
            { opacity: 0, y: 20, filter: 'blur(8px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.42, ease: 'power3.out', stagger: 0.05 }
          );
      };

      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        pin: left,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const idx = Math.min(steps.length - 1, Math.max(0, Math.floor(self.progress * steps.length)));
          if (idx !== currentRef.current) {
            currentRef.current = idx;
            swapTo(idx);
          }
          gsap.set('.landing-switch-progress-fill', { scaleY: self.progress });
        },
      });
    }, section);

    const raf = requestAnimationFrame(() => ScrollTrigger.refresh());
    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener('load', onLoad);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('load', onLoad);
      ctx.revert();
    };
  }, []);

  return (
    <section className="landing-switch-section" ref={sectionRef} style={{ '--switch-count': steps.length }}>
      <div className="landing-switch-layout">
        <aside className="landing-switch-left" ref={leftRef} style={{ '--switch-accent': steps[0].color }}>
          <div className="landing-switch-progress" aria-hidden="true">
            <div className="landing-switch-progress-fill" />
          </div>

          <div className="landing-badge pulse-badge">
            <MousePointerClick size={12} />
            <span>Scroll to Explore</span>
          </div>

          <h2 className="landing-switch-heading" ref={headingRef}>
            {steps[0].heading} <span className="landing-hero-highlight">{steps[0].highlight}</span>
          </h2>

          <p className="landing-switch-sub" ref={subRef}>{steps[0].sub}</p>

          <div className="landing-switch-meta">
            <div className="landing-switch-dots">
              {steps.map((_, i) => (
                <span key={i} className={`landing-switch-dot ${i === 0 ? 'active' : ''}`} />
              ))}
            </div>
            <span className="landing-switch-count" ref={countRef}>
              01 / 04
            </span>
          </div>
        </aside>

        <div className="landing-switch-right">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className={`landing-switch-panel ${i === 0 ? 'active' : ''}`}>
                <div className="landing-switch-card" style={{ '--node-color': s.color, '--node-glow': s.glow }}>
                  <div className="landing-switch-card-glow" aria-hidden="true" />
                  <span className="landing-switch-panel-index" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="landing-switch-screen-head">
                    <div className="landing-switch-head-left">
                      <span className="landing-switch-dotp" style={{ background: s.color }} />
                      <span className="landing-switch-screen-name">{s.statLabel}</span>
                    </div>
                    <Icon size={16} style={{ color: s.color }} />
                  </div>
                  <div className="landing-switch-screen-body">
                    <div className="landing-switch-stat" style={{ color: s.color }}>{s.stat}</div>
                    <div className="landing-switch-rows">
                      {s.rows.map((w, j) => (
                        <div
                          key={j}
                          className="landing-switch-row"
                          style={{ width: `${w}%`, background: `color-mix(in srgb, ${s.color} 16%, transparent)` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}