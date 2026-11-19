import { useCallback, useEffect, useRef, useState } from 'react';
import { userStore } from '../../../utils/storageService';

// QA progress lives in localStorage first (instant, works offline) and is
// mirrored to the signed-in admin's server store so the final tour can move
// between laptop and phone. The newer copy (updatedAt) wins on load.
export const QA_STORE_KEY = 'aust-qa-checklist-v1';

export const blankQaState = () => ({ v: 1, updatedAt: 0, marks: {}, notes: {}, matrix: {}, bugs: [], auto: {} });

function readLocal() {
  try {
    const raw = localStorage.getItem(QA_STORE_KEY);
    return raw ? { ...blankQaState(), ...JSON.parse(raw) } : blankQaState();
  } catch {
    return blankQaState();
  }
}

export default function useQaState() {
  const [state, setState] = useState(readLocal);
  // local | loading | saving | synced | offline | blocked
  const [sync, setSync] = useState('loading');
  const stateRef = useRef(state);
  const savedAt = useRef(state.updatedAt);
  const timer = useRef(null);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    let cancelled = false;
    userStore.get(QA_STORE_KEY).then((remote) => {
      if (cancelled) return;
      if (remote && typeof remote === 'object' && (remote.updatedAt || 0) > (stateRef.current.updatedAt || 0)) {
        const next = { ...blankQaState(), ...remote };
        savedAt.current = next.updatedAt;
        try { localStorage.setItem(QA_STORE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        setState(next);
      }
      setSync(remote ? 'synced' : 'local');
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!state.updatedAt || state.updatedAt === savedAt.current) return undefined;
    savedAt.current = state.updatedAt;
    try { localStorage.setItem(QA_STORE_KEY, JSON.stringify(state)); } catch { /* quota */ }
    setSync('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const ok = await userStore.set(QA_STORE_KEY, stateRef.current);
      setSync(ok === 'moderated' ? 'blocked' : ok ? 'synced' : 'offline');
    }, 1200);
    return undefined;
  }, [state]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const update = useCallback((fn) => {
    setState((prev) => ({ ...fn(prev), updatedAt: Date.now() }));
  }, []);

  const replace = useCallback((next) => {
    setState({ ...blankQaState(), ...next, updatedAt: Date.now() });
  }, []);

  return { state, update, replace, sync };
}
