import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/* Touch gestures for a Course Structure row (see skill-slider-button).
 *
 *  - swipe left  → the row stays open, revealing Edit and + (add child)
 *  - swipe right → past the trigger asks to delete (caller shows a confirm)
 *  - long-press, release without moving → comment
 *  - long-press, then drag up/down        → reorder among siblings
 *
 * Touch only: mouse/keyboard keep the row's normal buttons. Listeners are
 * native (touchmove is non-passive) so a hold-drag can stop the page from
 * scrolling while the row is being moved.
 */

export const SWIPE_TRIGGER = 72; // px that arms delete / opens the left actions
const SWIPE_MAX = 110;
export const SWIPE_OPEN = 104; // resting offset while the left actions are open
const HOLD_MS = 450;
const SLOP = 8;
const EDGE = 40; // px from the scroll box edge that auto-scrolls while dragging

export default function useCourseRowGestures({ enabled, index, onDelete, onComment, onReorder }) {
  const [card, setCard] = useState(null); // callback ref target
  const [dx, setDx] = useState(0);
  const [open, setOpen] = useState(false);
  const [holding, setHolding] = useState(false);
  const [dragging, setDragging] = useState(false);
  const live = useRef({ open: false, dx: 0 });
  const handlers = useRef({ onDelete, onComment, onReorder, index });
  useLayoutEffect(() => { handlers.current = { onDelete, onComment, onReorder, index }; });

  const setOffset = useCallback((v) => { live.current.dx = v; setDx(v); }, []);
  const close = useCallback(() => { live.current.open = false; setOpen(false); setOffset(0); }, [setOffset]);

  // Close the open actions when touching anywhere else
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      const wrap = card?.parentElement;
      if (wrap && !wrap.contains(e.target)) close();
    };
    document.addEventListener('touchstart', onDoc, { passive: true });
    return () => document.removeEventListener('touchstart', onDoc);
  }, [open, card, close]);

  useEffect(() => {
    if (!enabled || !card) return undefined;
    let st = null;
    let suppressUntil = 0;

    const rowEl = () => card.closest('.cs-node');
    const scrollBox = () => card.closest('.cs-tree');

    const startDrag = () => {
      const row = rowEl();
      const parent = row?.parentElement;
      if (!row || !parent) return;
      const sibs = [...parent.children].filter((el) => el.classList.contains('cs-node'));
      const self = sibs.indexOf(row);
      const gap = parseFloat(getComputedStyle(parent).rowGap) || 0;
      const box = scrollBox();
      st.drag = {
        row, sibs, self, target: self,
        rects: sibs.map((el) => el.getBoundingClientRect()),
        step: row.getBoundingClientRect().height + gap,
        box, scroll0: box ? box.scrollTop : 0,
      };
      setDragging(true);
    };

    const paintDrag = (dy) => {
      const d = st.drag;
      const scrolled = d.box ? d.box.scrollTop - d.scroll0 : 0;
      const move = dy + scrolled;
      const r = d.rects[d.self];
      const center = r.top + r.height / 2 + move;
      let target = d.self;
      for (let i = d.self - 1; i >= 0; i -= 1) {
        const m = d.rects[i].top + d.rects[i].height / 2;
        if (center < m) target = i; else break;
      }
      for (let i = d.self + 1; i < d.sibs.length; i += 1) {
        const m = d.rects[i].top + d.rects[i].height / 2;
        if (center > m) target = i; else break;
      }
      d.target = target;
      d.row.style.transform = `translateY(${move}px)`;
      d.sibs.forEach((el, i) => {
        if (i === d.self) return;
        let shift = 0;
        if (d.self < i && i <= target) shift = -d.step;
        else if (target <= i && i < d.self) shift = d.step;
        el.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    };

    const clearDrag = (d) => {
      if (d) d.sibs.forEach((el) => { el.style.transform = ''; });
      setDragging(false);
    };

    const onStart = (e) => {
      const t = e.touches[0];
      if (!t || e.touches.length > 1) return;
      st = { x: t.clientX, y: t.clientY, axis: null, mode: null, base: live.current.open ? -SWIPE_OPEN : 0 };
      st.timer = setTimeout(() => {
        if (!st || st.axis) return;
        st.mode = 'hold';
        setHolding(true);
        if (navigator.vibrate) navigator.vibrate(12);
      }, HOLD_MS);
    };

    const onMove = (e) => {
      const t = e.touches[0];
      if (!st || !t) return;
      const mx = t.clientX - st.x;
      const my = t.clientY - st.y;

      if (st.mode === 'hold' || st.mode === 'drag') {
        e.preventDefault(); // the row is lifted: don't scroll the page
        if (st.mode === 'hold' && Math.abs(my) > 6) { st.mode = 'drag'; startDrag(); }
        if (st.mode === 'drag' && st.drag) {
          const box = st.drag.box;
          if (box) {
            const b = box.getBoundingClientRect();
            if (t.clientY < b.top + EDGE) box.scrollTop -= 8;
            else if (t.clientY > b.bottom - EDGE) box.scrollTop += 8;
          }
          paintDrag(my);
        }
        return;
      }

      if (!st.axis) {
        if (Math.abs(mx) < SLOP && Math.abs(my) < SLOP) return;
        clearTimeout(st.timer);
        st.axis = Math.abs(mx) > Math.abs(my) * 1.2 ? 'x' : 'y';
      }
      if (st.axis !== 'x') return;
      setOffset(Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, st.base + mx)));
    };

    const onEnd = () => {
      if (!st) return;
      clearTimeout(st.timer);
      const s = st;
      st = null;
      setHolding(false);

      if (s.mode === 'hold') {
        suppressUntil = Date.now() + 400;
        handlers.current.onComment?.();
        return;
      }
      if (s.mode === 'drag') {
        suppressUntil = Date.now() + 400;
        const d = s.drag;
        clearDrag(d);
        if (d && d.target !== d.self) handlers.current.onReorder?.(handlers.current.index + (d.target - d.self));
        return;
      }
      if (s.axis !== 'x') return;

      suppressUntil = Date.now() + 350;
      const v = live.current.dx;
      if (v <= -SWIPE_TRIGGER) { live.current.open = true; setOpen(true); setOffset(-SWIPE_OPEN); }
      else if (v >= SWIPE_TRIGGER) { close(); handlers.current.onDelete?.(); }
      else close();
    };

    const onCancel = () => {
      if (!st) return;
      clearTimeout(st.timer);
      if (st.drag) clearDrag(st.drag);
      st = null;
      setHolding(false);
      if (!live.current.open) setOffset(0); else setOffset(-SWIPE_OPEN);
    };

    // A gesture must not also tick the checkbox / toggle the chapter
    const onClickCapture = (e) => {
      if (Date.now() < suppressUntil) { e.preventDefault(); e.stopPropagation(); }
    };
    const onContext = (e) => { if (st) e.preventDefault(); };

    card.addEventListener('touchstart', onStart, { passive: true });
    card.addEventListener('touchmove', onMove, { passive: false });
    card.addEventListener('touchend', onEnd);
    card.addEventListener('touchcancel', onCancel);
    card.addEventListener('click', onClickCapture, true);
    card.addEventListener('contextmenu', onContext);
    return () => {
      if (st) clearTimeout(st.timer);
      card.removeEventListener('touchstart', onStart);
      card.removeEventListener('touchmove', onMove);
      card.removeEventListener('touchend', onEnd);
      card.removeEventListener('touchcancel', onCancel);
      card.removeEventListener('click', onClickCapture, true);
      card.removeEventListener('contextmenu', onContext);
    };
  }, [enabled, card, close, setOffset]);

  return { bindCard: setCard, dx, open, holding, dragging, close };
}
