import { query, sql } from './db.mjs';
import { readJson, writeJson } from './jsonDB.mjs';

const LIBRARY_LAT = Number(process.env.LIBRARY_LAT || 23.7634);
const LIBRARY_LNG = Number(process.env.LIBRARY_LNG || 90.4074);
const LIBRARY_RADIUS_M = Number(process.env.LIBRARY_RADIUS_M || 80);
const LIBRARY_CAPACITY = Number(process.env.LIBRARY_CAPACITY || 350);

let useJsonFallback = !process.env.DB_PASSWORD;

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export async function recordCheckIn(deviceId, lat, lng) {
  if (!deviceId || !Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('deviceId, lat and lng are required.');

  const distance = haversineMeters(LIBRARY_LAT, LIBRARY_LNG, lat, lng);
  const inside = distance <= LIBRARY_RADIUS_M;

  if (!useJsonFallback) {
    try {
      if (inside) {
        await query(`
          MERGE LibraryPresence AS target
          USING (SELECT @deviceId AS DeviceId) AS source ON target.DeviceId = source.DeviceId
          WHEN MATCHED THEN UPDATE SET Lat = @lat, Lng = @lng, UpdatedAt = GETDATE()
          WHEN NOT MATCHED THEN INSERT (DeviceId, Lat, Lng, UpdatedAt) VALUES (@deviceId, @lat, @lng, GETDATE());
        `, { deviceId: { value: deviceId }, lat: { type: sql.Float, value: lat }, lng: { type: sql.Float, value: lng } });
      } else {
        await query('DELETE FROM LibraryPresence WHERE DeviceId = @deviceId', { deviceId: { value: deviceId } });
      }
      const r = await query("DELETE FROM LibraryPresence WHERE UpdatedAt < DATEADD(MINUTE, -10, GETDATE()); SELECT COUNT(*) AS cnt FROM LibraryPresence;");
      const occupied = r.recordset[1]?.cnt || 0;
      return { inside, distance: Math.round(distance), radius: LIBRARY_RADIUS_M, occupied, capacity: LIBRARY_CAPACITY };
    } catch (err) {
      console.warn('⚠️  SQL Server check-in failed, using JSON database fallback:', err.message);
      useJsonFallback = true;
    }
  }

  // JSON Fallback
  let list = await readJson('library_presence.json');
  if (inside) {
    const idx = list.findIndex(c => c.deviceId === deviceId);
    const entry = {
      deviceId,
      lat,
      lng,
      updatedAt: new Date().toISOString()
    };
    if (idx !== -1) {
      list[idx] = entry;
    } else {
      list.push(entry);
    }
  } else {
    list = list.filter(c => c.deviceId !== deviceId);
  }

  // Filter older than 10 mins
  const tenMinAgo = Date.now() - 10 * 60 * 1000;
  list = list.filter(c => new Date(c.updatedAt).getTime() >= tenMinAgo);

  await writeJson('library_presence.json', list);
  const occupied = list.length;

  return { inside, distance: Math.round(distance), radius: LIBRARY_RADIUS_M, occupied, capacity: LIBRARY_CAPACITY };
}

export async function recordCheckOut(deviceId) {
  if (!useJsonFallback) {
    try {
      await query('DELETE FROM LibraryPresence WHERE DeviceId = @deviceId', { deviceId: { value: deviceId } });
      const r = await query('SELECT COUNT(*) AS cnt FROM LibraryPresence');
      return { occupied: r.recordset[0]?.cnt || 0, capacity: LIBRARY_CAPACITY };
    } catch (err) {
      console.warn('⚠️  SQL Server checkout failed, using JSON database fallback:', err.message);
      useJsonFallback = true;
    }
  }

  // JSON Fallback
  let list = await readJson('library_presence.json');
  list = list.filter(c => c.deviceId !== deviceId);
  await writeJson('library_presence.json', list);
  return { occupied: list.length, capacity: LIBRARY_CAPACITY };
}

export async function getOccupancy() {
  if (!useJsonFallback) {
    try {
      const r = await query("DELETE FROM LibraryPresence WHERE UpdatedAt < DATEADD(MINUTE, -10, GETDATE()); SELECT COUNT(*) AS cnt FROM LibraryPresence;");
      const occupied = r.recordset[1]?.cnt || 0;
      return { occupied, capacity: LIBRARY_CAPACITY, occupancyPercent: LIBRARY_CAPACITY > 0 ? Math.round(occupied / LIBRARY_CAPACITY * 100) : 0, updatedAt: new Date().toISOString() };
    } catch (err) {
      console.warn('⚠️  SQL Server occupancy check failed, using JSON database fallback:', err.message);
      useJsonFallback = true;
    }
  }

  // JSON Fallback
  let list = await readJson('library_presence.json');
  const tenMinAgo = Date.now() - 10 * 60 * 1000;
  list = list.filter(c => new Date(c.updatedAt).getTime() >= tenMinAgo);
  await writeJson('library_presence.json', list);
  const occupied = list.length;
  return {
    occupied,
    capacity: LIBRARY_CAPACITY,
    occupancyPercent: LIBRARY_CAPACITY > 0 ? Math.round(occupied / LIBRARY_CAPACITY * 100) : 0,
    updatedAt: new Date().toISOString()
  };
}
