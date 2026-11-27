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
  '.bsheet-layer > .theme-menu',
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

// Browsers without :has() skip the CSS rule that stops a menu's ancestors
// from trapping the fixed sheet (a transform/filter/backdrop-filter makes the
// ancestor its containing block, so the sheet sticks to that box, often far up
// the page). There, mark the open sheet's ancestors with .msheet-lift instead.
const LIFT = 'msheet-lift';
let lifted = [];
let liftQueued = false;

function supportsHas() {
  try { return CSS.supports('selector(:has(*))'); } catch { return false; }
}

function updateLift() {
  liftQueued = false;
  const sheet = openSheet();
  const next = [];
  for (let el = sheet?.parentElement; el; el = el.parentElement) next.push(el);
  lifted.forEach((el) => { if (!next.includes(el)) el.classList.remove(LIFT); });
  next.forEach((el) => { if (!el.classList.contains(LIFT)) el.classList.add(LIFT); });
  lifted = next;
}

const withoutLift = (cls) => String(cls || '').split(/\s+/).filter((c) => c && c !== LIFT).join(' ');

function queueLift(mutations) {
  // Our own .msheet-lift changes must not re-trigger the check.
  if (mutations && mutations.every((m) => m.type === 'attributes'
    && withoutLift(m.oldValue) === withoutLift(m.target.getAttribute('class')))) return;
  if (liftQueued) return;
  liftQueued = true;
  requestAnimationFrame(updateLift);
}

function installLiftFallback() {
  if (supportsHas() || typeof MutationObserver === 'undefined') return;
  new MutationObserver(queueLift).observe(document.body, {
    subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['class'],
  });
  window.matchMedia(MOBILE).addListener?.(() => queueLift());
}

let installed = false;
export function installMobileMenuSheet() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  installLiftFallback();
  const opts = { capture: true, passive: false };
  ['pointerdown', 'touchstart', 'mousedown'].forEach((t) => window.addEventListener(t, onDown, opts));
  ['pointerup', 'touchend', 'mouseup', 'click'].forEach((t) => window.addEventListener(t, onRest, opts));
  ['touchmove', 'wheel'].forEach((t) => window.addEventListener(t, onMove, opts));
}
