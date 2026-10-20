/**
 * useQbaChecklist — solved / pending marks for one course.
 *
 * The state is optimistic: the checkbox flips immediately, is written to a
 * small localStorage cache, and is then debounced to the server. If the
 * request fails the mark stays on this device and is retried on the next
 * toggle, on unmount, or through `syncNow`.
 */

/* eslint-disable react-hooks/set-state-in-effect -- checklist state is hydrated from the server/cache after mount */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { courseSlug } from './qbaImageStore';
import {
  mergeChecklistItems,
  toggleChecklistIds,
} from './qbaChecklist';
import {
  getChecklistFromServer,
  readChecklistCache,
  saveChecklistToServer,
  writeChecklistCache,
} from './qbaChecklistStore';

const SAVE_DELAY_MS = 650;
const CHECKLIST_EVENT = 'qba-checklist-change';

function uniqueIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).filter(Boolean))];
}

export default function useQbaChecklist(courseCode) {
  const courseKey = useMemo(() => courseSlug(courseCode), [courseCode]);
  const enabled = Boolean(String(courseCode || '').trim());

  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const itemsRef = useRef({});
  const timerRef = useRef(null);
  const dirtyRef = useRef(false);
  const mountedRef = useRef(true);

  const persist = useCallback(async (next) => {
    if (!enabled) return false;
    setSaving(true);
    try {
      const ok = await saveChecklistToServer(courseKey, next);
      if (!ok) throw new Error('rejected');
      dirtyRef.current = false;
      if (mountedRef.current) setError('');
      return true;
    } catch {
      if (mountedRef.current) {
        setError('Progress could not be saved to your account. It is kept on this device.');
      }
      return false;
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [courseKey, enabled]);

  const scheduleSave = useCallback((next) => {
    itemsRef.current = next;
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (dirtyRef.current) void persist(itemsRef.current);
    }, SAVE_DELAY_MS);
  }, [persist]);

  // Load the cached copy at once, then reconcile with the server.
  useEffect(() => {
    mountedRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    dirtyRef.current = false;
    setError('');
    setSaving(false);

    if (!enabled) {
      itemsRef.current = {};
      setItems({});
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const cached = readChecklistCache(courseKey);
    itemsRef.current = cached;
    setItems(cached);
    setLoading(true);

    (async () => {
      try {
        const serverItems = await getChecklistFromServer(courseKey);
        if (cancelled) return;
        // `itemsRef` may already hold a newer tick made while the request was
        // in flight — merge the current local copy, not only the cached one.
        const localItems = itemsRef.current || cached;
        const merged = mergeChecklistItems(serverItems, localItems);
        itemsRef.current = merged;
        setItems(merged);
        writeChecklistCache(courseKey, merged);

        if (JSON.stringify(merged) !== JSON.stringify(serverItems)) {
          const ok = await saveChecklistToServer(courseKey, merged);
          if (!ok) throw new Error('rejected');
          if (itemsRef.current === merged) dirtyRef.current = false;
        }
      } catch {
        if (!cancelled) {
          setError('Progress could not be loaded from your account. Showing the copy on this device.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Do not lose a tick made just before switching course / closing.
      if (dirtyRef.current) {
        void saveChecklistToServer(courseKey, itemsRef.current).catch(() => {});
      }
    };
  }, [courseKey, enabled]);

  // Another panel (Analyzer / Saved) toggled the same course — stay in step.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleChange = (event) => {
      const detail = event?.detail;
      if (!detail || detail.courseKey !== courseKey) return;
      const next = detail.items || {};
      itemsRef.current = next;
      setItems(next);
    };
    window.addEventListener(CHECKLIST_EVENT, handleChange);
    return () => window.removeEventListener(CHECKLIST_EVENT, handleChange);
  }, [courseKey]);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const toggle = useCallback((ids) => {
    if (!enabled) return;
    const list = uniqueIds(ids);
    if (!list.length) return;
    const next = toggleChecklistIds(itemsRef.current, list);
    itemsRef.current = next;
    setItems(next);
    writeChecklistCache(courseKey, next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CHECKLIST_EVENT, {
        detail: { courseKey, items: next },
      }));
    }
    scheduleSave(next);
  }, [courseKey, enabled, scheduleSave]);

  const syncNow = useCallback(async () => {
    if (!enabled) return false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return persist(itemsRef.current);
  }, [enabled, persist]);

  return {
    courseKey,
    items,
    toggle,
    syncNow,
    loading,
    saving,
    error,
    enabled,
  };
}
