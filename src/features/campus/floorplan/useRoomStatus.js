import { useCallback, useEffect, useState } from 'react';
import { computeRoomAvailability, currentDayOfWeek, currentTimeString } from '../../../data/mockData';

const REFRESH_MS = 5 * 60 * 1000;

const normalize = (id) => String(id || '').replace(/[^a-z0-9]/gi, '').toUpperCase();

function indexFloors(floors) {
  const map = new Map();
  for (const floor of floors || []) {
    for (const room of floor.rooms || []) {
      map.set(normalize(room.id), { status: room.status, details: room.details || null });
    }
  }
  return map;
}

/**
 * Free/busy status for every catalog room right now, keyed by normalized
 * room code. Starts from the local estimate (same source the Free Rooms tab
 * uses), then swaps in the server's answer, and refreshes every 5 minutes.
 */
export default function useRoomStatus() {
  const [statusMap, setStatusMap] = useState(() =>
    indexFloors(computeRoomAvailability(currentDayOfWeek(), currentTimeString())));

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const day = currentDayOfWeek();
      const time = currentTimeString();
      try {
        const params = new URLSearchParams({ day, time });
        const res = await fetch(`/api/rooms/availability?${params}`);
        if (!res.ok) throw new Error('availability');
        const data = await res.json();
        if (!data.success || !Array.isArray(data.floors)) throw new Error('payload');
        if (!cancelled) setStatusMap(indexFloors(computeRoomAvailability(day, time, data.floors)));
      } catch {
        if (!cancelled) setStatusMap(indexFloors(computeRoomAvailability(day, time)));
      }
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return useCallback((roomId) => statusMap.get(normalize(roomId)) || null, [statusMap]);
}
