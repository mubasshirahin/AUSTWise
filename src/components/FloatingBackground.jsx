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
    const PARTICLE_COUNT = 40;
    const MOUSE_RADIUS = 180;
    const mouse = { x: -9999, y: -9999 };

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
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

    const readAccent = () =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--accent-blue')
        .trim() || '#f59e0b';

    const hexToRgb = (hex) => {
      const m = hex.replace('#', '');
      const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
      const int = parseInt(n, 16);
      return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
    };

    let raf, t = 0;
    const draw = () => {
      t++;
      const accent = readAccent();
      const [r, g, b] = hexToRgb(accent.startsWith('#') ? accent : '#f59e0b');
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
        const pulse = 0.7 + 0.3 * Math.sin(t * 0.015 + p.phase);
        const alpha = 0.12 + 0.08 * pulse;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fill();

        // Subtle glow on mouse proximity
        if (dist < MOUSE_RADIUS * 0.5) {
          const glow = 1 - dist / (MOUSE_RADIUS * 0.5);
          ctx.shadowBlur = 6 * glow;
          ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${glow * 0.15})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * pulse * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      raf = requestAnimationFrame(draw);
    };

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

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', () => { resize(); initParticles(); });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', resize);
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
