import { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { buildStalkPortfolio } from './mockStalkData';
import { loadUserOrbit, loadUserFavoriteColor } from '../orbits/OrbitsContext';

const StalkContext = createContext(null);

// Survives a page refresh so the road-trip doesn't kick you out.
const STORAGE_KEY = 'stalk-target';
const SCROLL_KEY = 'stalk-scroll';

// The stored trip is now { member, customStops, favoriteColor } so the
// "Drive My Orbit" road-trip can persist its own editable checkpoints and
// route color across refreshes too.
function loadTrip() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { member: null, customStops: null, favoriteColor: '' };
    const parsed = JSON.parse(raw);
    return {
      member: parsed?.member || null,
      customStops: Array.isArray(parsed?.customStops) ? parsed.customStops : null,
      favoriteColor: parsed?.favoriteColor || '',
    };
  } catch {
    return { member: null, customStops: null, favoriteColor: '' };
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

  const stalk = useCallback((member, customStops, favoriteColor) => {
    let stops = customStops || null;
    let color = favoriteColor || '';
    // Visiting a member without explicit stops (member-list "Visit Orbit"):
    // use the orbit they configured in My Orbits — it lives on the server so
    // it shows for every visitor, on any device. The generated mock portfolio
    // is only a fallback for members with no saved orbit.
    if (!stops && member) {
      const serverOrbit = member?.orbit;
      const serverStops = serverOrbit && Array.isArray(serverOrbit.checkpoints)
        ? serverOrbit.checkpoints
          .filter((cp) => cp.isVisible !== false)
          .map((cp) => ({ key: cp.id, label: cp.label, fields: cp.fields }))
        : null;
      if (serverStops && serverStops.length) {
        stops = serverStops;
        color = serverOrbit.favoriteColor || color;
      } else {
        // Offline / stale cache fallback: this browser's copy of their orbit.
        const saved = loadUserOrbit(member.id, member.awid);
        if (saved && saved.length) {
          stops = saved
            .filter((cp) => cp.isVisible !== false)
            .map((cp) => ({ key: cp.id, label: cp.label, fields: cp.fields }));
          if (!stops.length) stops = null; // everything hidden → fall back to mock
          color = loadUserFavoriteColor(member.id) || color;
        }
      }
    }
    const next = {
      member: member || null,
      customStops: stops,
      favoriteColor: color,
    };
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
    setTrip({ member: null, customStops: null, favoriteColor: '' });
  }, []);

  const value = useMemo(() => {
    const portfolio = trip.member ? buildStalkPortfolio(trip.member) : null;
    return {
      target: trip.member,
      portfolio,
      customStops: trip.customStops,
      favoriteColor: trip.favoriteColor,
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