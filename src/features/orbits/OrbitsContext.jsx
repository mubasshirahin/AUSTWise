import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';

/* eslint-disable react-refresh/only-export-components */

/* ─── User Orbits — state store ───
   Holds the master checkpoint array, persists edits to localStorage, and
   exposes the three core actions: updateCheckpointOrder / toggleVisibility /
   updateCheckpointFields. Adapted to the app's React-context + useState
   pattern (no Zustand dependency needed). */

export const MASTER_CHECKPOINTS = [
  { id: 'cp-01', type: 'user_details', label: 'User Details', isVisible: true, order: 1, fields: { name: '', id: '', dept: '', batch: '', blood_group: '', about_me: '' } },
  { id: 'cp-02', type: 'favourites', label: 'Favourites', isVisible: true, order: 2, fields: { movies_tv: [], games: [], anime_manga: [], comics: [], books_literature: [], music_soundtracks: [], quotes: [], food: [], color: [], city: [], country: [], youtubers: [], vloggers: [] } },
  { id: 'cp-03', type: 'association', label: 'Association', isVisible: true, order: 3, fields: { clubs: [{ name: '', designation: '' }], societies: [{ name: '', designation: '' }] } },
  { id: 'cp-04', type: 'social_connects', label: 'Social Connects', isVisible: true, order: 4, fields: { github: '', linkedin: '', discord: '', facebook: '', instagram: '' } },
  { id: 'cp-05', type: 'this_or_that', label: 'This or That Question', isVisible: true, order: 5, fields: { questions: [{ q_id: '', question: '', option_a: '', option_b: '', selected_option: '' }] } },
  { id: 'cp-06', type: 'aw_blueprints', label: 'AW Blueprints', isVisible: true, order: 6, fields: { account_created_at: '', reviews_posted_count: 0, system_clearance_level: '' } },
  { id: 'cp-07', type: 'hobbies', label: 'Hobbies', isVisible: true, order: 7, fields: { list: [] } },
  { id: 'cp-08', type: 'achievements', label: 'Achievements', isVisible: true, order: 8, fields: { items: [{ title: '', year: '', certificate_url: '' }] } },
  { id: 'cp-09', type: 'travel_log', label: 'Travel Log', isVisible: true, order: 9, fields: { logs: [{ destination: '', year: '', experience: '' }] } },
  { id: 'cp-10', type: 'bucket_list', label: 'Bucket List & Goals', isVisible: true, order: 10, fields: { items: [] } },
];

// Orbit data is stored per user so each account's configured orbit survives
// account switches (dev quick-login etc.). The old shared keys are kept as a
// legacy fallback — trusted only when the stored user_details id matches.
const LEGACY_STORAGE_KEY = 'orbits-checkpoints-v1';
const LEGACY_FAV_COLOR_KEY = 'orbits-favorite-color';
const getCheckpointsKey = (userId) => (userId && userId !== 'guest' ? `orbits-checkpoints-v1-${userId}` : LEGACY_STORAGE_KEY);
const getFavoriteColorKey = (userId) => (userId && userId !== 'guest' ? `orbits-favorite-color-${userId}` : LEGACY_FAV_COLOR_KEY);
const OrbitsContext = createContext(null);

const clone = (value) => JSON.parse(JSON.stringify(value));

/**
 * Read a user's saved orbit checkpoints. Checks the per-user key first; the
 * legacy shared key is only trusted when its cp-01 user_details id matches the
 * target user (id or awid), so other accounts' old data is never shown.
 */
export function loadUserOrbit(userId, awid) {
  try {
    const perUser = localStorage.getItem(getCheckpointsKey(userId));
    const raw = perUser || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return null;
    if (!perUser) {
      const owner = parsed.find((cp) => cp.id === 'cp-01')?.fields?.id;
      if (owner && String(owner).trim() && ![userId, awid].filter(Boolean).some((v) => String(v) === String(owner))) {
        return null; // legacy data belongs to a different account
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Read a user's favorite orbit color (per-user key, legacy key as fallback). */
export function loadUserFavoriteColor(userId) {
  try {
    return localStorage.getItem(getFavoriteColorKey(userId)) || localStorage.getItem(LEGACY_FAV_COLOR_KEY) || '';
  } catch {
    return '';
  }
}

function persistFavoriteColor(userId, color) {
  try {
    const key = getFavoriteColorKey(userId);
    if (color) localStorage.setItem(key, color);
    else localStorage.removeItem(key);
  } catch { /* storage unavailable */ }
}

/* ─── schema helpers (shared by the config panel + preview renderer) ─── */
export function humanizeKey(key) {
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getFieldKind(type, key) {
  const cp = MASTER_CHECKPOINTS.find((c) => c.type === type);
  const val = cp?.fields?.[key];
  if (Array.isArray(val)) return val.length && typeof val[0] === 'object' ? 'objectList' : 'list';
  if (typeof val === 'number') return 'number';
  return 'string';
}

export function getListItemTemplate(type, key) {
  const cp = MASTER_CHECKPOINTS.find((c) => c.type === type);
  const arr = cp?.fields?.[key];
  return Array.isArray(arr) ? clone(arr[0] ?? {}) : {};
}

/* ─── initial state: master schema + saved edits + user prefill ─── */
function prefillUserDetails(fields, user) {
  if (!user) return fields;
  const next = { ...fields };
  if (!next.name) next.name = user.name || '';
  if (!next.id) next.id = user.awid || user.id || '';
  if (!next.dept) next.dept = user.department || '';
  if (!next.batch) next.batch = user.batchName || user.batchNo || '';
  if (!next.blood_group) next.blood_group = user.bloodGroup || '';
  return next;
}

function buildInitial(user, fromSaved) {
  const savedMap = {};
  if (fromSaved) {
    const parsed = loadUserOrbit(user?.id, user?.awid);
    if (parsed) parsed.forEach((cp) => { savedMap[cp.id] = cp; });
  }
  return MASTER_CHECKPOINTS.map((master) => {
    const saved = savedMap[master.id];
    const fields = saved?.fields ? { ...clone(master.fields), ...saved.fields } : clone(master.fields);
    return {
      ...master,
      isVisible: saved && typeof saved.isVisible === 'boolean' ? saved.isVisible : master.isVisible,
      order: saved && Number.isFinite(saved.order) ? saved.order : master.order,
      fields: master.id === 'cp-01' && user && user.id !== 'guest' ? prefillUserDetails(fields, user) : fields,
    };
  }).sort((a, b) => a.order - b.order);
}

export function OrbitsProvider({ user, children }) {
  const [checkpoints, setCheckpoints] = useState(() => buildInitial(user, true));

  useEffect(() => {
    try {
      localStorage.setItem(getCheckpointsKey(user?.id), JSON.stringify(checkpoints));
    } catch { /* storage unavailable */ }
  }, [checkpoints, user?.id]);

  // The auth user may resolve after this provider first mounts (guest →
  // authenticated). When a real user appears, backfill any empty user_details
  // fields so the schema picks up the account without clobbering edits.
  const lastUserId = useRef(null);
  useEffect(() => {
    const uid = user?.id;
    if (uid && uid !== 'guest' && lastUserId.current !== uid) {
      lastUserId.current = uid;
      setCheckpoints((prev) => prev.map((cp) => (
        cp.id === 'cp-01' ? { ...cp, fields: prefillUserDetails(cp.fields, user) } : cp
      )));
    }
  }, [user]);

  // The config panel edits are user actions — only those push the orbit to the
  // server (debounced), so opening the tab never writes default checkpoints.
  const dirtyRef = useRef(false);
  const markDirty = useCallback(() => { dirtyRef.current = true; }, []);

  const updateCheckpointOrder = useCallback((id, newOrder) => {
    markDirty();
    setCheckpoints((prev) => (
      [...prev.map((c) => (c.id === id ? { ...c, order: newOrder } : c))].sort((a, b) => a.order - b.order)
    ));
  }, [markDirty]);

  const toggleVisibility = useCallback((id) => {
    markDirty();
    setCheckpoints((prev) => prev.map((c) => (c.id === id ? { ...c, isVisible: !c.isVisible } : c)));
  }, [markDirty]);

  const updateCheckpointFields = useCallback((id, updatedFields) => {
    markDirty();
    setCheckpoints((prev) => prev.map((c) => (c.id === id ? { ...c, fields: { ...c.fields, ...updatedFields } } : c)));
  }, [markDirty]);

  const resetCheckpoints = useCallback(() => {
    markDirty();
    setCheckpoints(buildInitial(user, false));
  }, [user, markDirty]);

  // The road-trip accent. Defaults to the deterministic portfolio color unless
  // the user picks their own — then the drive uses theirs, live.
  const [favoriteColor, setFavoriteColorState] = useState(() => loadUserFavoriteColor(user?.id));
  const setFavoriteColor = useCallback((color) => {
    markDirty();
    const hex = /^#[0-9a-fA-F]{6}$/.test(color || '') ? color.toLowerCase() : '';
    setFavoriteColorState(hex);
    persistFavoriteColor(user?.id, hex);
  }, [user?.id, markDirty]);

  // Persist the configured orbit to the server (debounced) so other users — on
  // any device — see the same orbit when they visit it. localStorage stays as
  // the fast offline cache.
  const orbitUserId = user?.id;
  useEffect(() => {
    if (!orbitUserId || orbitUserId === 'guest' || !dirtyRef.current) return undefined;
    const timer = setTimeout(() => {
      const orbit = { checkpoints, favoriteColor };
      fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ orbit }),
      }).catch(() => { /* offline — localStorage still holds the config */ });
    }, 500);
    return () => clearTimeout(timer);
  }, [checkpoints, favoriteColor, orbitUserId]);

  const value = useMemo(() => {
    const sorted = [...checkpoints].sort((a, b) => a.order - b.order);
    return {
      checkpoints: sorted,
      visibleCheckpoints: sorted.filter((c) => c.isVisible),
      favoriteColor,
      setFavoriteColor,
      updateCheckpointOrder,
      toggleVisibility,
      updateCheckpointFields,
      resetCheckpoints,
    };
  }, [checkpoints, favoriteColor, setFavoriteColor, updateCheckpointOrder, toggleVisibility, updateCheckpointFields, resetCheckpoints]);

  return <OrbitsContext.Provider value={value}>{children}</OrbitsContext.Provider>;
}

export function useOrbits() {
  const ctx = useContext(OrbitsContext);
  if (!ctx) throw new Error('useOrbits must be used inside <OrbitsProvider>');
  return ctx;
}