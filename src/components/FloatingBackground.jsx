import { useEffect, useRef } from 'react';
import './FloatingBackground.css';

/**
 * FloatingBackground — Ambient animated background for all authenticated pages.
 *
 * Composes two visual layers:
 *  1. Grid overlay — subtle grid pattern
 *  2. Particle canvas — lightweight dot field with subtle mouse attraction
 *
 * All layers respect prefers-reduced-motion and read the current theme's
 * accent colours in real time.
 *
 * Performance notes:
 *  - The accent colour is cached and only re-read when the theme actually
 *    changes (MutationObserver on <html>), NOT every animation frame. Reading
 *    getComputedStyle 60x/s forces a style recalculation every frame and made
 *    the whole app feel laggy on click.
 *  - The RAF loop is throttled to ~30fps and paused while the tab is hidden.
 */
export default function FloatingBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return; // skip canvas entirely if user prefers reduced motion

    let w, h, dpr;
    const particles = [];
    const PARTICLE_COUNT = window.innerWidth < 900 ? 12 : 20;
    const MOUSE_RADIUS = 180;
    const FRAME_MS = 1000 / 30; // ~30fps — plenty for a subtle dot field
    const mouse = { x: -9999, y: -9999 };

    // Cached accent (rgb triplet). Re-read only when the theme changes.
    let accentRgb = [245, 158, 11];

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const initParticles = () => {
      particles.length = 0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          r: Math.random() * 1.5 + 0.8,
          phase: Math.random() * Math.PI * 2,
        });
      }
    };

    const hexToRgb = (hex) => {
      const m = hex.replace('#', '');
      const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
      const int = parseInt(n, 16);
      if (!Number.isFinite(int)) return null;
      return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
    };

    // Read the accent once per theme change (not per frame).
    const readAccent = () => {
      const hex = getComputedStyle(document.documentElement)
        .getPropertyValue('--accent-blue')
        .trim();
      const rgb = hex && hex.startsWith('#') ? hexToRgb(hex) : null;
      if (rgb) accentRgb = rgb;
    };

    // Theme / accent overrides touch <html>'s attributes or inline style vars.
    const observer = new MutationObserver(readAccent);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });

    let raf;
    let last = 0;
    let t = 0;
    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      if (now - last < FRAME_MS) return; // throttle to ~30fps
      last = now;
      t++;
      const [r, g, b] = accentRgb;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Mouse repulsion / attraction
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = (1 - dist / MOUSE_RADIUS) * 0.4;
          p.vx -= (dx / dist) * force;
          p.vy -= (dy / dist) * force;
        }

        // Random walk
        p.vx += (Math.random() - 0.5) * 0.03;
        p.vy += (Math.random() - 0.5) * 0.03;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        // Draw particle
        const pulse = 0.7 + 0.3 * Math.sin(t * 0.03 + p.phase);
        const alpha = 0.12 + 0.08 * pulse;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fill();
      }
    };

    readAccent();
    resize();
    initParticles();
    raf = requestAnimationFrame(draw);

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    const onResize = () => { resize(); initParticles(); };

    // Pause the loop while the tab is hidden — no point burning frames offscreen.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        raf = requestAnimationFrame(draw);
      }
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div className="floating-bg" aria-hidden="true">
      {/* Grid overlay */}
      <div className="floating-bg-grid" />



      {/* Particle canvas */}
      <canvas ref={canvasRef} className="floating-bg-canvas" />
    </div>
  );
}
