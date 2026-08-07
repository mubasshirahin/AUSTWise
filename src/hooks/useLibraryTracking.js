import { useState, useEffect, useRef } from 'react';

// AUST Library geofence (center + allowed radius for indoor GPS fluctuation).
// Center from the user's plus code QC74+CX Dhaka.
const LIBRARY_LAT = 23.7635625;
const LIBRARY_LNG = 90.4074375;
const LIBRARY_RADIUS_M = 60;

const TRACKING_KEY = 'library_tracking_enabled';
const USER_KEY = 'aust-user-profile';
const DEVICE_KEY = 'aust-device-id';

/**
 * Haversine distance between two coordinates, in meters.
 */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function getTrackingEnabled() {
  try {
    return localStorage.getItem(TRACKING_KEY) === 'true';
  } catch {
    return false;
  }
}

function getUserId() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id) return parsed.id;
    }
  } catch {
    /* ignore */
  }
  // Stable anonymous device id fallback so the pulse still gets updates.
  let device = localStorage.getItem(DEVICE_KEY);
  if (!device) {
    device = 'dev-' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(DEVICE_KEY, device);
  }
  return device;
}

/**
 * Background geofencing engine.
 * - Reads the tracking preference from localStorage (library_tracking_enabled).
 * - Runs only while the hosting component is mounted.
 * - watchPosition → Haversine → inside/outside → POST /api/library/track.
 * - clearWatch on unmount to avoid leaks / battery drain.
 *
 * @param {boolean|undefined} enabledOverride - force on/off regardless of the stored preference.
 * @returns {{enabled: boolean, supported: boolean, watching: boolean, inside: boolean|null, error: string|null}}
 */
export default function useLibraryTracking(enabledOverride) {
  const [state, setState] = useState({
    enabled: false,
    supported: false,
    watching: false,
    inside: null,
    position: null,
    error: null,
  });

  const watchIdRef = useRef(null);
  const userIdRef = useRef(null);

  useEffect(() => {
    const enabled = enabledOverride !== undefined ? enabledOverride : getTrackingEnabled();
    const supported = typeof navigator !== 'undefined' && Boolean(navigator.geolocation);

    if (!enabled || !supported) {
      setState({ enabled, supported, inside: false, watching: false, inside: null, error: null });
      return;
    }

    userIdRef.current = getUserId();
    setState((s) => ({ ...s, enabled: true, supported: true, error: null }));

    let cancelled = false;
    let lastSentInside = null;

    const handlePosition = (position) => {
      if (cancelled) return;
      const { latitude, longitude } = position.coords;
      const distance = haversineMeters(LIBRARY_LAT, LIBRARY_LNG, latitude, longitude);
      const inside = distance <= LIBRARY_RADIUS_M;
      setState((s) => ({ ...s, watching: true, inside, position: { lat: latitude, lng: longitude }, error: null }));
      sendUpdate(inside, latitude, longitude);
    };

    const handleError = (err) => {
      if (cancelled) return;
      setState((s) => ({ ...s, watching: false, error: err.message || 'Location unavailable' }));
      // Best-effort: mark ourselves outside so we don't linger as "inside".
      sendUpdate(false);
    };

    const sendUpdate = async (inside, latitude, longitude) => {
      if (inside === lastSentInside && latitude === undefined) return; // avoid redundant requests
      lastSentInside = inside;
      try {
        const res = await fetch('/api/library/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userIdRef.current,
            isInside: inside,
            lat: latitude,
            lng: longitude,
          }),
        });
        await res.json();
      } catch {
        /* network error — retried on the next position update */
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
    });

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabledOverride]);

  return state;
}