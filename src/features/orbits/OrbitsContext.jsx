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

const STORAGE_KEY = 'orbits-checkpoints-v1';
const OrbitsContext = createContext(null);

const clone = (value) => JSON.parse(JSON.stringify(value));

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
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (Array.isArray(parsed)) parsed.forEach((cp) => { savedMap[cp.id] = cp; });
    } catch { /* ignore corrupt cache */ }
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checkpoints));
    } catch { /* storage unavailable */ }
  }, [checkpoints]);

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

  const updateCheckpointOrder = useCallback((id, newOrder) => {
    setCheckpoints((prev) => (
      [...prev.map((c) => (c.id === id ? { ...c, order: newOrder } : c))].sort((a, b) => a.order - b.order)
    ));
  }, []);

  const toggleVisibility = useCallback((id) => {
    setCheckpoints((prev) => prev.map((c) => (c.id === id ? { ...c, isVisible: !c.isVisible } : c)));
  }, []);

  const updateCheckpointFields = useCallback((id, updatedFields) => {
    setCheckpoints((prev) => prev.map((c) => (c.id === id ? { ...c, fields: { ...c.fields, ...updatedFields } } : c)));
  }, []);

  const resetCheckpoints = useCallback(() => setCheckpoints(buildInitial(user, false)), [user]);

  const value = useMemo(() => {
    const sorted = [...checkpoints].sort((a, b) => a.order - b.order);
    return {
      checkpoints: sorted,
      visibleCheckpoints: sorted.filter((c) => c.isVisible),
      updateCheckpointOrder,
      toggleVisibility,
      updateCheckpointFields,
      resetCheckpoints,
    };
  }, [checkpoints, updateCheckpointOrder, toggleVisibility, updateCheckpointFields, resetCheckpoints]);

  return <OrbitsContext.Provider value={value}>{children}</OrbitsContext.Provider>;
}

export function useOrbits() {
  const ctx = useContext(OrbitsContext);
  if (!ctx) throw new Error('useOrbits must be used inside <OrbitsProvider>');
  return ctx;
}