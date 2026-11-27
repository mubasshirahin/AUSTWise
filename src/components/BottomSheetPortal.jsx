import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

// Phones (≤640px) show header menus as bottom sheets (src/styles/mobileMenuSheet.css).
// A sheet is `position: fixed`, but any ancestor with transform, filter or
// backdrop-filter (the Studio and Aurora top bars blur) becomes its
// containing block, so the sheet ends up pinned to the bottom of the bar and
// rises off the top of the screen. The CSS `:has()` rescue only works where
// `:has()` is supported. Rendering the open panel into <body> takes it out of
// those ancestors everywhere.
const PHONE = '(max-width: 640px)';

function subscribe(onChange) {
  const mq = window.matchMedia(PHONE);
  // addListener: Safari < 14 has no addEventListener on MediaQueryList.
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else mq.addListener?.(onChange);
  return () => {
    if (mq.removeEventListener) mq.removeEventListener('change', onChange);
    else mq.removeListener?.(onChange);
  };
}

function useIsPhone() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}

/**
 * Desktop: renders `children` in place (a normal dropdown).
 * Phone + open: renders `children` in <body> as a bottom sheet over a
 * backdrop. A tap on the backdrop calls `onClose` (the global sheet handler in
 * src/utils/mobileMenuSheet.js usually closes it first).
 */
export default function BottomSheetPortal({ open, onClose, children }) {
  const phone = useIsPhone();
  if (!phone || !open || typeof document === 'undefined') return children;
  return createPortal(
    <div className="bsheet-layer">
      <div className="bsheet-backdrop" aria-hidden="true" onClick={onClose} />
      {children}
    </div>,
    document.body,
  );
}
