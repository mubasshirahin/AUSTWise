// Mobile ⋮ menus open as a bottom sheet (src/styles/mobileMenuSheet.css).
// While a sheet is open, the page behind it must not react to touches: a tap
// anywhere outside the sheet only closes the sheet, and scrolling the page is
// blocked. Every ⋮ menu closes itself through a document-level
// mousedown/pointerdown "outside click" check, so closing = sending that
// signal; the real event never reaches the page underneath.

const MOBILE = '(max-width: 640px)';
// Every ⋮ menu panel - keep in sync with src/styles/mobileMenuSheet.css.
const SHEET_SELECTOR = [
  '.export-dropdown .export-menu',
  '.lp-menu-list',
  '.pb-menu',
  '.cpgen-menu-list',
  '.ws-menu-list',
  '.qa-menu',
  '.cb-menu-list',
  '.profile-dropdown',
  '.notif-dropdown',
  '.theme-switcher.open .theme-menu',
  '.auth-theme-menu',
  '.landing-theme-menu.open',
  '.prereq-dept-menu',
  '.sr-bg-menu',
].join(',');
const SWALLOW_MS = 700;
let swallowUntil = 0;
let internal = false;

function openSheet() {
  if (!window.matchMedia(MOBILE).matches) return null;
  // Only a menu that is actually shown (some stay mounted but hidden).
  return Array.from(document.querySelectorAll(SHEET_SELECTOR))
    .find((el) => el.getClientRects().length > 0
      && getComputedStyle(el).visibility !== 'hidden') || null;
}

function isOutside(e, sheet) {
  return !(e.target instanceof Node && sheet.contains(e.target));
}

function swallow(e) {
  if (e.cancelable) e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}

function closeSheet(sheet) {
  internal = true;
  try {
    for (const type of ['pointerdown', 'mousedown']) {
      document.body.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
    }
  } finally {
    internal = false;
  }
  // Fallback for a menu that only toggles from its own button.
  setTimeout(() => {
    // Some menus stay mounted when closed (top bar theme picker), so check
    // that it is still showing, not just still in the DOM.
    if (openSheet() !== sheet) return;
    const trigger = sheet.parentElement?.querySelector(':scope > button[aria-expanded="true"], :scope > button');
    if (trigger) { internal = true; try { trigger.click(); } finally { internal = false; } }
  }, 60);
}

function onDown(e) {
  if (internal) return;
  const sheet = openSheet();
  if (!sheet || !isOutside(e, sheet)) return;
  swallow(e);
  const first = Date.now() > swallowUntil;
  swallowUntil = Date.now() + SWALLOW_MS;
  if (first) closeSheet(sheet);
}

// The rest of the tap (up/end/click) must not land on what was underneath.
function onRest(e) {
  if (internal || Date.now() > swallowUntil) return;
  const sheet = openSheet();
  if (sheet && !isOutside(e, sheet)) return;
  swallow(e);
}

function onMove(e) {
  const sheet = openSheet();
  if (sheet && isOutside(e, sheet) && e.cancelable) e.preventDefault();
}

let installed = false;
export function installMobileMenuSheet() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const opts = { capture: true, passive: false };
  ['pointerdown', 'touchstart', 'mousedown'].forEach((t) => window.addEventListener(t, onDown, opts));
  ['pointerup', 'touchend', 'mouseup', 'click'].forEach((t) => window.addEventListener(t, onRest, opts));
  ['touchmove', 'wheel'].forEach((t) => window.addEventListener(t, onMove, opts));
}
