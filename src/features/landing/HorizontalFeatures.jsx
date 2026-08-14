import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Layers, Check } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

/**
 * HorizontalFeatures — the feature cards rolled sideways by vertical scroll.
 *
 * Instead of full-screen slides, all cards flow next to each other in one
 * flex container (a continuous band), and GSAP ScrollTrigger scrubs the band
 * horizontally while the user scrolls the page — a ticker, not a slide deck.
 *
 * Mechanics:
 *  - The section provides the scroll runway (tall, unpinned).
 *  - GSAP pins a 100vh viewport (position:fixed) that clips the band.
 *  - `band.x` scrubs 0 → -(bandWidth - viewportWidth) across the section.
 */

export default function HorizontalFeatures({ items }) {
  const sectionRef = useRef(null);
  const viewportRef = useRef(null);
  const trackRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!section || !viewport || !track) return;

    const ctx = gsap.context(() => {
      const dist = () => Math.max(track.scrollWidth - viewport.clientWidth, 0);
      const navH = () => {
        const nav = document.querySelector('.landing-nav');
        return nav ? nav.getBoundingClientRect().height : 0;
      };
      section.style.setProperty('--hscroll-pin-offset', `${navH()}px`);
      const settings = {
        trigger: section,
        start: () => `top top+=${navH()}`,
        end: 'bottom bottom',
        scrub: 1,
        invalidateOnRefresh: true,
      };

      gsap.to(track, {
        x: () => -dist(),
        ease: 'none',
        scrollTrigger: {
          ...settings,
          // GSAP pin (position:fixed) is far more reliable than CSS sticky —
          // it holds the viewport while the band scrubs, no matter the browser.
          pin: viewport,
          anticipatePin: 1,
        },
      });

      const fill = viewport.querySelector('.landing-hscroll-progress-fill');
      if (fill) {
        gsap.fromTo(fill, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: settings });
      }
    }, section);

    // Re-measure once fonts/layout settle so the band distance is exact.
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
    <section className="landing-hscroll-section" ref={sectionRef}>
      <div className="landing-hscroll-viewport" ref={viewportRef}>
        <header className="landing-hscroll-header">
          <div className="landing-badge pulse-badge">
            <Layers size={12} />
            <span>Keep Scrolling</span>
          </div>
          <h2 className="landing-hscroll-title">
            The Whole Feature Set, <span className="landing-hero-highlight">Rolling By</span>
          </h2>
          <p className="landing-hscroll-sub">
            Every tool that makes campus life effortless — gliding past you in one continuous flow.
          </p>
        </header>

        <div className="landing-hscroll-track" ref={trackRef}>
          {items.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <article
                key={i}
                className="landing-feature-card"
                style={{ '--card-accent': feature.color, '--card-glow': feature.glow }}
              >
                <div className="landing-feature-card-inner">
                  <span className="landing-hscroll-index">{String(i + 1).padStart(2, '0')}</span>
                  <div className="landing-feature-icon" style={{ background: feature.glow, color: feature.color }}>
                    <Icon size={22} />
                  </div>
                  <span className="landing-feature-tagline">{feature.tagline}</span>
                  <h3 className="landing-feature-title">{feature.title}</h3>
                  <p className="landing-feature-desc">{feature.description}</p>
                  <div className="landing-hscroll-benefits">
                    {feature.benefits.slice(0, 3).map((b, j) => (
                      <div key={j} className="landing-hscroll-benefit">
                        <span className="landing-hscroll-check" style={{ color: feature.color }}>
                          <Check size={12} strokeWidth={3} />
                        </span>
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="landing-hscroll-progress" aria-hidden="true">
          <div className="landing-hscroll-progress-fill" />
        </div>
      </div>
    </section>
  );
}