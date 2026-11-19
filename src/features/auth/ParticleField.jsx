import { useEffect, useRef } from 'react';

/**
 * Semantic particle background — a grid of glowing "data nodes" that bend
 * toward the cursor like a magnetic field. When `energized` (the user is
 * typing their password) the nodes speed up and gather tightly toward the
 * centre of the screen, behind the auth card, as if powering their entry.
 *
 * Purely decorative canvas; respects prefers-reduced-motion.
 *
 * Props:
 *  - energized: boolean   — pulls nodes toward centre + speeds them up
 *  - intensity: number    — 0..1, brightens/tightens the gather (password strength)
 *  - blueprint: boolean   — ARCH easter-egg: draw as blueprint ruler grid
 */
export default function ParticleField({ theme, energized = false, intensity = 0, blueprint = false }) {
  const canvasRef = useRef(null);
  // Live values the animation loop reads without re-subscribing.
  const stateRef = useRef({ energized, intensity, blueprint });

  // Keep the ref in sync so the rAF loop always reads current props.
  useEffect(() => {
    stateRef.current = { energized, intensity, blueprint };
  }, [energized, intensity, blueprint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const readAccent = () => {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue('--accent-blue')
        .trim();
      return v || '#b0975d';
    };
    let accent = readAccent();
    const blueprintColor = '#5b8bd0';

    const SPACING = 42;
    const mouse = { x: -9999, y: -9999 };
    let nodes = [];
    let w = 0;
    let h = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let t = 0;

    const build = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      accent = readAccent();
      nodes = [];
      const cols = Math.ceil(w / SPACING) + 1;
      const rows = Math.ceil(h / SPACING) + 1;
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          const bx = i * SPACING;
          const by = j * SPACING;
          nodes.push({
            bx,
            by,
            x: bx,
            y: by,
            // per-node phase so the idle shimmer isn't uniform
            phase: (i * 7 + j * 13) % 628 / 100,
          });
        }
      }
    };

    const hexToRgb = (hex) => {
      const m = hex.replace('#', '');
      const n = m.length === 3
        ? m.split('').map((c) => c + c).join('')
        : m;
      const int = parseInt(n, 16);
      return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
    };

    const draw = () => {
      const { energized: en, intensity: inten, blueprint: bp } = stateRef.current;
      // Re-read accent every frame so theme changes apply instantly (no refresh needed).
      accent = readAccent();
      t += 1;
      ctx.clearRect(0, 0, w, h);

      const col = bp ? blueprintColor : accent;
      const [r, g, b] = hexToRgb(col.startsWith('#') ? col : '#b0975d');
      const cx = w / 2;
      const cy = h / 2;
      const radius = 150;
      const speed = en ? 0.18 : 0.06;
      const gather = en ? 0.06 + inten * 0.10 : 0;

      for (let k = 0; k < nodes.length; k += 1) {
        const p = nodes[k];
        // Target starts at the node's home position.
        let tx = p.bx;
        let ty = p.by;

        // Magnetic bend toward the cursor within a radius.
        const mdx = mouse.x - p.x;
        const mdy = mouse.y - p.y;
        const md = Math.hypot(mdx, mdy);
        if (md < radius) {
          const pull = (1 - md / radius) * 26;
          tx += (mdx / (md || 1)) * pull;
          ty += (mdy / (md || 1)) * pull;
        }

        // Energized: drift toward screen centre (behind the card).
        if (gather > 0) {
          tx += (cx - p.bx) * gather;
          ty += (cy - p.by) * gather;
        }

        // Idle shimmer.
        const shimmer = reduced ? 0 : Math.sin(t * 0.02 + p.phase) * (en ? 1.6 : 0.7);
        tx += shimmer;

        // Ease current position toward the target.
        p.x += (tx - p.x) * speed;
        p.y += (ty - p.y) * speed;

        // Brightness: brighter near the cursor and when energized.
        const near = md < radius ? 1 - md / radius : 0;
        const baseA = bp ? 0.16 : 0.10;
        const alpha = Math.min(0.9, baseA + near * 0.7 + (en ? 0.12 + inten * 0.25 : 0));
        const size = (bp ? 0.6 : 1) * (1 + near * 1.6 + (en ? inten * 0.8 : 0));

        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fill();

        // Glow + link lines for nodes close to the cursor.
        if (near > 0.15) {
          ctx.shadowBlur = 8 * near;
          ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${near})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size + 0.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Blueprint: faint ruler ticks along the top + left edges (ARCH).
      if (bp) {
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.28)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= w; x += SPACING) {
          const long = (Math.round(x / SPACING) % 5) === 0;
          ctx.moveTo(x + 0.5, 0);
          ctx.lineTo(x + 0.5, long ? 12 : 6);
        }
        for (let y = 0; y <= h; y += SPACING) {
          const long = (Math.round(y / SPACING) % 5) === 0;
          ctx.moveTo(0, y + 0.5);
          ctx.lineTo(long ? 12 : 6, y + 0.5);
        }
        ctx.stroke();
      }

      raf = window.requestAnimationFrame(draw);
    };

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      // Don't attract particles when hovering over the logo/brand area
      const brand = document.querySelector('.auth-head');
      if (brand) {
        const br = brand.getBoundingClientRect();
        if (
          e.clientX >= br.left && e.clientX <= br.right &&
          e.clientY >= br.top && e.clientY <= br.bottom
        ) {
          mouse.x = -9999;
          mouse.y = -9999;
        }
      }
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    build();
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseout', onLeave);
    window.addEventListener('resize', build);
    raf = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseout', onLeave);
      window.removeEventListener('resize', build);
    };
  }, [theme]);

  return <canvas ref={canvasRef} className="auth-particle-canvas" aria-hidden="true" />;
}
