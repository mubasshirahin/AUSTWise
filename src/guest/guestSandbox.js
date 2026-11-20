// Guest sandbox ("Take a Visit").
//
// A guest must never see real AUSTWise data. While a guest visit is active:
//   - every /api call (except sign-in, guest counters and page config) is
//     answered here with demo data, never by the server;
//   - localStorage is swapped for an empty, tab-only overlay, so cached data
//     from an account that used this browser before is invisible, and nothing
//     the guest does is kept after the visit;
//   - every write (save, post, message, add class...) is refused with a
//     "sign up" prompt.
// The server enforces the same rule on its side (server/publicApi.mjs): a
// signed-out request gets 401 on everything outside the public allowlist, and
// signed-out sockets are refused, so chats can't leak even if this is bypassed.

import { DEMO_MEMBERS, DEMO_SHARED } from './guestDemoData';

const VISIT_FLAG = 'aust-guest-visit';          // set by AuthContext.loginGuest
const OVERLAY_KEY = 'aust-guest-sandbox-v1';    // sessionStorage, dies with the tab
export const GUEST_BLOCKED_EVENT = 'austwise:guest-blocked';

// Server calls a guest may still make for real: they carry no member data.
const API_PASSTHROUGH = [
  /^\/api\/auth\//,
  /^\/api\/guest\//,
  /^\/api\/stats\/count/,
  /^\/api\/testimonials$/,
  /^\/api\/feedback$/,
  /^\/api\/access-requests$/,
  /^\/api\/invite\//,
  /^\/api\/page-availability/,
  /^\/api\/role-access/,
];

// localStorage keys that are UI preferences only; they keep using the real
// storage so the theme does not flip when a guest starts a visit.
const STORAGE_PASSTHROUGH = /^(aust-theme|aust-members-open-v1|aust-sidebar|aust-font|aust-accent)/;

let installed = false;
let originalFetch = null;
const originals = {};
let overlay = new Map();

export function isGuestVisitFlagged() {
  try { return sessionStorage.getItem(VISIT_FLAG) === '1'; } catch { return false; }
}

export function isGuestSandboxActive() {
  return installed;
}

/** Ask the UI to show the "sign up to do this" prompt. */
export function notifyGuestBlocked(action = '') {
  try { window.dispatchEvent(new CustomEvent(GUEST_BLOCKED_EVENT, { detail: { action } })); } catch { /* ignore */ }
}

/**
 * Call before any change a guest makes. Returns true (and shows the sign-up
 * prompt) when the action must not run.
 */
export function blockIfGuest(action = '') {
  if (!installed) return false;
  notifyGuestBlocked(action);
  return true;
}

// ── localStorage overlay ────────────────────────────────────────────────

function loadOverlay() {
  try {
    const raw = sessionStorage.getItem(OVERLAY_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    overlay = new Map(Object.entries(obj && typeof obj === 'object' ? obj : {}));
  } catch { overlay = new Map(); }
}

function saveOverlay() {
  try { sessionStorage.setItem(OVERLAY_KEY, JSON.stringify(Object.fromEntries(overlay))); } catch { /* full/blocked */ }
}

function patchLocalStorage() {
  const proto = Storage.prototype;
  originals.getItem = proto.getItem;
  originals.setItem = proto.setItem;
  originals.removeItem = proto.removeItem;
  originals.clear = proto.clear;
  originals.key = proto.key;
  originals.length = Object.getOwnPropertyDescriptor(proto, 'length');
  const isLocal = (s) => { try { return s === window.localStorage; } catch { return false; } };
  const real = (k) => STORAGE_PASSTHROUGH.test(String(k));

  proto.getItem = function getItem(k) {
    if (!isLocal(this) || real(k)) return originals.getItem.call(this, k);
    const key = String(k);
    return overlay.has(key) ? overlay.get(key) : null;
  };
  proto.setItem = function setItem(k, v) {
    if (!isLocal(this) || real(k)) return originals.setItem.call(this, k, v);
    overlay.set(String(k), String(v));
    saveOverlay();
    return undefined;
  };
  proto.removeItem = function removeItem(k) {
    if (!isLocal(this) || real(k)) return originals.removeItem.call(this, k);
    overlay.delete(String(k));
    saveOverlay();
    return undefined;
  };
  proto.clear = function clear() {
    if (!isLocal(this)) return originals.clear.call(this);
    overlay.clear();
    saveOverlay();
    return undefined;
  };
  proto.key = function key(i) {
    if (!isLocal(this)) return originals.key.call(this, i);
    return Array.from(overlay.keys())[i] ?? null;
  };
  Object.defineProperty(proto, 'length', {
    configurable: true,
    get() { return isLocal(this) ? overlay.size : originals.length.get.call(this); },
  });
}

function restoreLocalStorage() {
  const proto = Storage.prototype;
  proto.getItem = originals.getItem;
  proto.setItem = originals.setItem;
  proto.removeItem = originals.removeItem;
  proto.clear = originals.clear;
  proto.key = originals.key;
  if (originals.length) Object.defineProperty(proto, 'length', originals.length);
}

// ── fetch interception ──────────────────────────────────────────────────

function json(status, body) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-AUSTWise-Sandbox': 'guest' },
  }));
}

function apiPath(input) {
  try {
    const raw = typeof input === 'string' ? input : (input instanceof URL ? input.href : input?.url);
    const url = new URL(raw, window.location.href);
    const apiBase = import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL).origin : null;
    if (url.origin !== window.location.origin && url.origin !== apiBase) return null;
    return url.pathname.startsWith('/api/') ? url.pathname : null;
  } catch { return null; }
}

function demoResponse(path, method) {
  const authRequired = { success: false, error: 'Authentication required.', guest: true };

  if (method !== 'GET' && method !== 'HEAD') {
    // Only prompt when the guest just clicked/typed — background saves the app
    // makes on its own (sync, heartbeats, migrations) are refused silently.
    if (navigator.userActivation?.isActive) notifyGuestBlocked('save');
    return json(403, { success: false, guest: true, error: 'Sign up to save changes. Guest visits are view-only.' });
  }

  if (path === '/api/presence/members') {
    return json(200, { success: true, members: DEMO_MEMBERS });
  }
  if (path.startsWith('/api/store/shared/')) {
    const key = decodeURIComponent(path.slice('/api/store/shared/'.length));
    return json(200, { success: true, key, value: Object.prototype.hasOwnProperty.call(DEMO_SHARED, key) ? DEMO_SHARED[key] : null });
  }
  if (path.startsWith('/api/store/user/')) {
    const key = decodeURIComponent(path.slice('/api/store/user/'.length));
    return json(200, { success: true, key, value: null });
  }
  if (path === '/api/store/user') return json(200, { success: true, keys: [] });
  if (path === '/api/streak/leaderboard') return json(200, { success: true, total: 0, top: [], me: null });
  if (path === '/api/routines/shared' || path === '/api/routines/shared/mine') return json(200, { success: true, routines: [], routine: null });

  // Everything else (chats, directories, papers, notes, admin...) behaves
  // exactly like the server does for a signed-out visitor.
  return json(401, authRequired);
}

function patchFetch() {
  originalFetch = window.fetch;
  window.fetch = function guestFetch(input, init) {
    const path = apiPath(input);
    if (!path || API_PASSTHROUGH.some((re) => re.test(path))) return originalFetch.call(this, input, init);
    const method = String(init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
    return demoResponse(path, method);
  };
}

// ── action blocker ──────────────────────────────────────────────────────
// One rule for every feature: a guest clicking a button whose label starts
// with an action word (Add, Save, Post, Send, Delete, Join...) gets the sign-up
// prompt and the click never reaches the feature. Form submits and
// Enter-to-send in text areas are stopped the same way. Opt a control out
// with data-guest-allow.

const ACTION_LABEL = /^[+\s]*(add|new|create|post|publish|save|send|submit|upload|delete|remove|edit|update|rename|share|unshare|join|book|reserve|request|import|load|apply|buy|sell|list|comment|reply|vote|upvote|downvote|rsvp|register|claim|redeem|reset|clear|mark|follow|unfollow|connect|link|invite|report|accept|approve|reject|confirm|duplicate|archive|restore|move|attach|replace|quick add|set as|pin|unpin|like|react|enroll|subscribe|log expense|record|check in|check-in)\b/i;
const SAFE_LABEL = /\b(search|filters?|zoom|view|more|selection|preview|close|cancel|dismiss|sign up|log ?in|log ?out)\b/i;
const AUTH_PATHS = ['/login', '/reset-password', '/accept-invite'];
const CONTROL = 'button, [role="button"], [role="menuitem"], input[type="submit"], input[type="button"], a.btn';

function onAuthPage() {
  return AUTH_PATHS.includes(window.location.pathname);
}

function isExempt(el) {
  return Boolean(el.closest('[data-guest-allow], .guest-signup-modal'));
}

function controlLabel(el) {
  const text = el.getAttribute('aria-label') || el.getAttribute('title') || el.value || el.textContent || '';
  return text.replace(/\s+/g, ' ').trim();
}

function stop(e) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  notifyGuestBlocked('action');
}

function onGuestClick(e) {
  if (onAuthPage()) return;
  const el = e.target instanceof Element ? e.target.closest(CONTROL) : null;
  if (!el || isExempt(el)) return;
  const label = controlLabel(el);
  if (!label || SAFE_LABEL.test(label) || !ACTION_LABEL.test(label)) return;
  stop(e);
}

function onGuestSubmit(e) {
  if (onAuthPage()) return;
  const form = e.target;
  if (!(form instanceof HTMLFormElement) || isExempt(form)) return;
  if (form.getAttribute('role') === 'search' || form.querySelector('input[type="search"]')) return;
  stop(e);
}

function onGuestKeydown(e) {
  if (onAuthPage() || e.key !== 'Enter' || e.shiftKey) return;
  const el = e.target;
  if (!(el instanceof HTMLTextAreaElement) || isExempt(el)) return;
  if (!el.value.trim()) return;
  stop(e);
}

function addBlockers() {
  window.addEventListener('click', onGuestClick, true);
  window.addEventListener('submit', onGuestSubmit, true);
  window.addEventListener('keydown', onGuestKeydown, true);
}

function removeBlockers() {
  window.removeEventListener('click', onGuestClick, true);
  window.removeEventListener('submit', onGuestSubmit, true);
  window.removeEventListener('keydown', onGuestKeydown, true);
}

// ── public API ──────────────────────────────────────────────────────────

/** Start the sandbox (idempotent). Call when a guest visit starts or resumes. */
export function installGuestSandbox() {
  if (installed || typeof window === 'undefined') return;
  loadOverlay();
  // Seed demo content where features read their cached shared values. Always
  // overwrite: guests can't change it, and a page may have cached an empty list.
  for (const [key, value] of Object.entries(DEMO_SHARED)) {
    overlay.set(key, JSON.stringify(value));
  }
  saveOverlay();
  patchLocalStorage();
  patchFetch();
  addBlockers();
  installed = true;
}

/** Stop the sandbox and throw away everything the guest did. */
export function uninstallGuestSandbox() {
  if (!installed) return;
  restoreLocalStorage();
  removeBlockers();
  if (originalFetch) window.fetch = originalFetch;
  originalFetch = null;
  overlay = new Map();
  try { sessionStorage.removeItem(OVERLAY_KEY); } catch { /* ignore */ }
  installed = false;
}
