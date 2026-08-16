import { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { buildStalkPortfolio } from './mockStalkData';

const StalkContext = createContext(null);

// Survives a page refresh so the road-trip doesn't kick you out.
const STORAGE_KEY = 'stalk-target';
const SCROLL_KEY = 'stalk-scroll';

// The stored trip is now { member, customStops } so the "Drive My Orbit"
// road-trip can persist its own editable checkpoints across refreshes too.
function loadTrip() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { member: null, customStops: null };
    const parsed = JSON.parse(raw);
    return {
      member: parsed?.member || null,
      customStops: Array.isArray(parsed?.customStops) ? parsed.customStops : null,
    };
  } catch {
    return { member: null, customStops: null };
  }
}

function clearTrip() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(SCROLL_KEY);
  } catch { /* ignore */ }
}

export function StalkProvider({ children }) {
  const [trip, setTrip] = useState(loadTrip);

  const stalk = useCallback((member, customStops) => {
    const next = { member: member || null, customStops: customStops || null };
    if (member) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        sessionStorage.removeItem(SCROLL_KEY);
      } catch { /* ignore */ }
    }
    setTrip(next);
  }, []);

  const close = useCallback(() => {
    clearTrip();
    setTrip({ member: null, customStops: null });
  }, []);

  const value = useMemo(() => {
    const portfolio = trip.member ? buildStalkPortfolio(trip.member) : null;
    return {
      target: trip.member,
      portfolio,
      customStops: trip.customStops,
      stalk,
      close,
    };
  }, [trip, stalk, close]);

  return <StalkContext.Provider value={value}>{children}</StalkContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStalk() {
  const ctx = useContext(StalkContext);
  if (!ctx) throw new Error('useStalk must be used inside <StalkProvider>');
  return ctx;
}