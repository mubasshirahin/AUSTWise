import { useEffect, useRef } from 'react';

// ─── Global Mesh Topology — animated network mesh ───
// A living topology field: nodes drift in a full-bleed void, connected by
// proximity links that fade with distance. Respects the design system's
// "minimal motion" directive by keeping velocity low and easing soft.
export default function MeshTopology({ className = '', nodeCount = 70, linkDistance = 150 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      width = rect ? rect.width : window.innerWidth;
      height = rect ? rect.height : window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const nodes = Array.from({ length: nodeCount }, () => ({
      x: Math.random() * (width || 1),
      y: Math.random() * (height || 1),
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.6 + 0.8,
      phase: Math.random() * Math.PI * 2,
    }));

    const draw = (t) => {
      ctx.clearRect(0, 0, width, height);

      // links — connect any two nodes inside linkDistance
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < linkDistance * linkDistance) {
            const alpha = (1 - Math.sqrt(d2) / linkDistance) * 0.18;
            ctx.strokeStyle = `rgba(16, 185, 129, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // nodes — soft emerald cores with a faint pulse
      for (const n of nodes) {
        const pulse = 0.5 + 0.5 * Math.sin(t / 1000 + n.phase);
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4);
        grad.addColorStop(0, `rgba(16, 185, 129, ${0.5 + 0.4 * pulse})`);
        grad.addColorStop(1, 'rgba(16, 185, 129, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(5, 5, 5, 1)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(16, 185, 129, ${0.85})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const step = () => {
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = width + 20;
        if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        if (n.y > height + 20) n.y = -20;
      }
    };

    const loop = (now) => {
      step();
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    resize();
    raf = requestAnimationFrame(loop);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [nodeCount, linkDistance]);

  return <canvas ref={canvasRef} className={`mesh-topology-canvas ${className}`} aria-hidden="true" />;
}
