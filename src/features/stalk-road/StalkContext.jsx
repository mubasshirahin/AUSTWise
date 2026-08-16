import { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { buildStalkPortfolio } from './mockStalkData';

const StalkContext = createContext(null);

// Survives a page refresh so the road-trip doesn't kick you out.
const STORAGE_KEY = 'stalk-target';
const SCROLL_KEY = 'stalk-scroll';

function loadTarget() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearTrip() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(SCROLL_KEY);
  } catch { /* ignore */ }
}

export function StalkProvider({ children }) {
  const [target, setTarget] = useState(loadTarget);

  const stalk = useCallback((member) => {
    if (member) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(member));
        sessionStorage.removeItem(SCROLL_KEY);
      } catch { /* ignore */ }
    }
    setTarget(member || null);
  }, []);

  const close = useCallback(() => {
    clearTrip();
    setTarget(null);
  }, []);

  const value = useMemo(() => {
    const portfolio = target ? buildStalkPortfolio(target) : null;
    return { target, portfolio, stalk, close };
  }, [target, stalk, close]);

  return <StalkContext.Provider value={value}>{children}</StalkContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStalk() {
  const ctx = useContext(StalkContext);
  if (!ctx) throw new Error('useStalk must be used inside <StalkProvider>');
  return ctx;
}