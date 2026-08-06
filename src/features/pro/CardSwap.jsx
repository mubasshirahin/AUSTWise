/**
 * CardSwap — GSAP 3D card-deck swap animation
 *
 * An elegant auto-cycling card stack with perspective depth, ported from a
 * Tailwind implementation to AUSTWise's Aura token system (no Tailwind here).
 * All visual styling lives in ProPage.css under the `.pro-swap-*` namespace.
 *
 * Improvements over the upstream:
 *  - Drop distance is height-relative (`offsetHeight * 1.5`) instead of a
 *    fixed `+=500`, so it works for any card size, including responsive
 *    `clamp()` width/height strings.
 *  - The ref array is keyed on the memoized children array (not `.length`),
 *    so refs are rebuilt only when the children actually change.
 *  - `prefers-reduced-motion` disables auto-cycling (static fanned stack);
 *    manual nav (via the exposed `swap()`) still steps one card using the
 *    gentler linear easing.
 */
import React, {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import gsap from 'gsap';

// ─── Easing presets (upstream parity) ───
const EASING_CONFIG = {
  elastic: {
    ease: 'elastic.out(0.6,0.9)',
    durDrop: 2,
    durMove: 2,
    durReturn: 2,
    promoteOverlap: 0.9,
    returnDelay: 0.05,
  },
  linear: {
    ease: 'power1.inOut',
    durDrop: 0.8,
    durMove: 0.8,
    durReturn: 0.8,
    promoteOverlap: 0.45,
    returnDelay: 0.2,
  },
};

// ─── Slot math — where the i-th card sits in the fan ───
const makeSlot = (i, distX, distY, total) => ({
  x: i * distX,
  y: -i * distY,
  z: -i * distX * 1.5,
  zIndex: total - i,
});

// Place a card into a slot instantly (no animation)
const placeNow = (el, slot, skew) =>
  gsap.set(el, {
    x: slot.x,
    y: slot.y,
    z: slot.z,
    xPercent: -50,
    yPercent: -50,
    skewY: skew,
    transformOrigin: 'center center',
    zIndex: slot.zIndex,
    force3D: true,
  });

// ─── Card ───
export const Card = forwardRef(function Card({ children, className = '', onClick, ...rest }, ref) {
  return (
    <div
      ref={ref}
      {...rest}
      className={`pro-swap-card ${className}`.trim()}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      {children}
    </div>
  );
});
Card.displayName = 'Card';

// ─── CardSwap ───
export const CardSwap = forwardRef(function CardSwap(
  {
    children,
    width = 500,
    height = 400,
    cardDistance = 60,
    verticalDistance = 70,
    delay = 5000,
    pauseOnHover = false,
    onCardClick,
    skewAmount = 6,
    easing = 'elastic',
    className = '',
  },
  ref
) {
  const config = EASING_CONFIG[easing] ?? EASING_CONFIG.elastic;

  // Use the gentler linear preset for any (manual) swap under reduced motion.
  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );
  const effConfig = prefersReducedMotion ? EASING_CONFIG.linear : config;

  const container = useRef(null);
  const childArr = useMemo(() => Children.toArray(children), [children]);
  // Keyed on the memoized array itself so refs rebuild only on real child change.
  const refs = useMemo(() => childArr.map(() => React.createRef()), [childArr]);
  const order = useRef([]);
  const tlRef = useRef(null);
  const intervalRef = useRef(null);

  // Move the deck one step: drop the front card, promote the rest, return front to back.
  const swap = () => {
    if (order.current.length < 2) return;
    const [front, ...rest] = order.current;
    const elFront = refs[front]?.current;
    if (!elFront) return;

    const tl = gsap.timeline();
    tlRef.current = tl;

    // Drop distance relative to the card's rendered height (handles clamp() sizes).
    const dropDistance = (elFront.offsetHeight || 300) * 1.5;
    tl.to(elFront, { y: `+=${dropDistance}`, duration: effConfig.durDrop, ease: effConfig.ease });

    tl.addLabel('promote', `-=${effConfig.durDrop * effConfig.promoteOverlap}`);
    rest.forEach((idx, i) => {
      const el = refs[idx]?.current;
      if (!el) return;
      const slot = makeSlot(i, cardDistance, verticalDistance, refs.length);
      tl.set(el, { zIndex: slot.zIndex }, 'promote');
      tl.to(
        el,
        { x: slot.x, y: slot.y, z: slot.z, duration: effConfig.durMove, ease: effConfig.ease },
        `promote+=${i * 0.15}`
      );
    });

    const backSlot = makeSlot(refs.length - 1, cardDistance, verticalDistance, refs.length);
    tl.addLabel('return', `promote+=${effConfig.durMove * effConfig.returnDelay}`);
    tl.call(() => {
      gsap.set(elFront, { zIndex: backSlot.zIndex });
    }, undefined, 'return');

    tl.to(
      elFront,
      { x: backSlot.x, y: backSlot.y, z: backSlot.z, duration: effConfig.durReturn, ease: effConfig.ease },
      'return'
    );

    tl.call(() => {
      order.current = [...rest, front];
    });
  };

  // Expose swap() so parent nav controls can step the deck (works under reduced motion).
  useImperativeHandle(ref, () => ({ swap }), [swap]);

  // Initial placement + auto-cycle + pause-on-hover.
  useEffect(() => {
    const total = refs.length;
    order.current = Array.from({ length: total }, (_, i) => i);
    refs.forEach((r, i) => {
      if (r.current) placeNow(r.current, makeSlot(i, cardDistance, verticalDistance, total), skewAmount);
    });

    if (prefersReducedMotion) return; // static fanned stack, no auto-cycle

    intervalRef.current = window.setInterval(swap, delay);

    if (pauseOnHover && container.current) {
      const node = container.current;
      // Note: if a swap is mid-flight at mouseleave, the timeline restarts from
      // its paused spot and may leave one card slightly offset until the next
      // full cycle. Accepted trade-off, matches upstream.
      const pause = () => {
        tlRef.current?.pause();
        clearInterval(intervalRef.current);
      };
      const resume = () => {
        tlRef.current?.play();
        intervalRef.current = window.setInterval(swap, delay);
      };
      node.addEventListener('mouseenter', pause);
      node.addEventListener('mouseleave', resume);
      return () => {
        node.removeEventListener('mouseenter', pause);
        node.removeEventListener('mouseleave', resume);
        clearInterval(intervalRef.current);
        tlRef.current?.kill();
      };
    }

    return () => {
      clearInterval(intervalRef.current);
      tlRef.current?.kill();
    };
  }, [refs, cardDistance, verticalDistance, skewAmount, delay, pauseOnHover, swap, prefersReducedMotion]);

  const rendered = childArr.map((child, i) =>
    isValidElement(child)
      ? cloneElement(child, {
          key: i,
          ref: refs[i],
          style: { width, height, ...(child.props.style ?? {}) },
          'aria-label': child.props['aria-label'] || child.props['data-label'],
          onClick: (e) => {
            child.props.onClick?.(e);
            onCardClick?.(i);
          },
        })
      : child
  );

  return (
    <div
      ref={container}
      className={`pro-swap-deck ${className}`.trim()}
      style={{ width, height }}
      role="group"
      aria-label="Premium benefits carousel"
    >
      <div className="pro-swap-layer">{rendered}</div>
    </div>
  );
});
CardSwap.displayName = 'CardSwap';

export default CardSwap;
