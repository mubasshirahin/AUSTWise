// Long-press (touch) helper for Life Planner rows — opens comments on mobile.

const LONG_PRESS_MS = 480;
const pressState = { timer: null, x: 0, y: 0, fired: false };

function clearPress() {
  clearTimeout(pressState.timer);
  pressState.timer = null;
}

/** Spread onto a row: on touch, holding ~0.5s calls onLongPress (the tap that
 *  ends the hold is swallowed). Mouse/pen input is ignored. */
export function longPressProps(onLongPress) {
  return {
    onPointerDown: (e) => {
      if (e.pointerType !== 'touch') return;
      pressState.fired = false;
      pressState.x = e.clientX;
      pressState.y = e.clientY;
      clearPress();
      pressState.timer = setTimeout(() => {
        pressState.timer = null;
        pressState.fired = true;
        navigator.vibrate?.(10);
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e) => {
      if (pressState.timer && Math.hypot(e.clientX - pressState.x, e.clientY - pressState.y) > 10) clearPress();
    },
    onPointerUp: clearPress,
    onPointerCancel: clearPress,
    onContextMenu: (e) => { if (pressState.timer || pressState.fired) e.preventDefault(); },
    onClickCapture: (e) => {
      if (!pressState.fired) return;
      pressState.fired = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
