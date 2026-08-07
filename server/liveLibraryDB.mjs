/**
 * Live Library Occupancy — real-time geofence tracking backed by MSSQL.
 *
 * Table: live_library_occupancy
 *   id            INT IDENTITY(1,1) PRIMARY KEY
 *   user_id       INT NOT NULL UNIQUE
 *   is_inside     BIT DEFAULT 0
 *   last_updated  DATETIME DEFAULT GETDATE()
 *
 * Falls back to a JSON file when no SQL Server connection is configured,
 * mirroring the pattern used across the other DB modules.
 */

import { query, sql } from './db.mjs';
import { readJson, writeJson } from './jsonDB.mjs';

// Library center = AUST library (user's plus code QC74+CX Dhaka).
const LIBRARY_LAT = Number(process.env.LIBRARY_LAT || 23.7635625);
const LIBRARY_LNG = Number(process.env.LIBRARY_LNG || 90.4074375);
const LIBRARY_RADIUS_M = Number(process.env.LIBRARY_RADIUS_M || 60);
const LIBRARY_CAPACITY = Number(process.env.LIBRARY_CAPACITY || 350);
const STALE_MINUTES = 5;

// Library open hours used to build the live Hourly Peak Tracker series.
const OPEN_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

// Real-time per-hour peaks, keyed by "YYYY-M-D:HH". Built only from actual
// occupancy pulses — no mock data. Survives for the life of the server
// process, mirroring the in-memory JSON fallback design.
const HOUR_PEAKS = {};

function hourKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}:${date.getHours()}`;
}

function fmtHour(h) {
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}${ap}`;
}

function recordPeak(occupied) {
  const key = hourKey(new Date());
  HOUR_PEAKS[key] = Math.max(HOUR_PEAKS[key] || 0, Number(occupied) || 0);
}

function buildHourPeaks() {
  const now = new Date();
  const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  return OPEN_HOURS.map((h) => ({
    label: fmtHour(h),
    hour: h,
    value: HOUR_PEAKS[`${today}:${h}`] || 0,
  }));
}

let useJsonFallback = !process.env.DB_PASSWORD;

/**
 * Haversine distance between two coordinates, in meters.
 */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Server-side geofence check: is (lat, lng) inside the library radius?
 */
export function isInsideGeofence(lat, lng) {
  const distance = haversineMeters(LIBRARY_LAT, LIBRARY_LNG, Number(lat), Number(lng));
  return { inside: distance <= LIBRARY_RADIUS_M, distance: Math.round(distance) };
}

/**
 * Stable non-negative numeric key derived from any user/device id string, so
 * the INT-backed table works whether the app id is numeric ("12345") or not
 * ("ADM-001", "dev-xxxx").
 */
function hashUserId(userId) {
  const str = String(userId);
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

/**
 * UPSERT a single user's presence using MSSQL MERGE.
 * lat/lng are the user's last reported GPS position (used for the heatmap).
 * Returns the updated occupancy snapshot.
 */
export async function trackUserPresence(userId, isInside, lat, lng) {
  const inside = Boolean(isInside);
  // If it's a plain positive integer keep it verbatim; otherwise hash to a
  // stable non-negative integer so the value always fits in the INT column.
  const raw = String(userId).trim();
  const numeric = /^\d+$/.test(raw) ? Number(raw) : hashUserId(raw);
  const normUserId = numeric;

  const hasLat = Number.isFinite(Number(lat));
  const hasLng = Number.isFinite(Number(lng));
  const latVal = hasLat ? Number(lat) : null;
  const lngVal = hasLng ? Number(lng) : null;
  const normLat = latVal === null ? { type: sql.Float, value: null } : { type: sql.Float, value: latVal };
  const normLng = lngVal === null ? { type: sql.Float, value: null } : { type: sql.Float, value: lngVal };

  if (!useJsonFallback) {
    try {
      if (inside) {
        await query(
          `MERGE live_library_occupancy AS target
           USING (SELECT @userId AS user_id) AS source ON target.user_id = source.user_id
           WHEN MATCHED THEN UPDATE
             SET is_inside = @isInside,
                 lat = COALESCE(@lat, target.lat),
                 lng = COALESCE(@lng, target.lng),
                 last_updated = GETDATE()
           WHEN NOT MATCHED THEN INSERT (user_id, is_inside, lat, lng, last_updated)
             VALUES (@userId, @isInside, @lat, @lng, GETDATE());`,
          {
            userId: { type: sql.Int, value: normUserId },
            isInside: { type: sql.Bit, value: 1 },
            lat: normLat,
            lng: normLng,
          }
        );
      } else {
        // Outside the library geofence → collect NO data for this user.
        await query(
          `DELETE FROM live_library_occupancy WHERE user_id = @userId;`,
          { userId: { type: sql.Int, value: normUserId } }
        );
      }
      return getLivePulse();
    } catch (err) {
      console.warn('⚠️  SQL Server track failed, using JSON database fallback:', err.message);
      useJsonFallback = true;
    }
  }

  // JSON fallback
  let list = await readJson('library_occupancy.json');
  list = list.filter((c) => Number(c.user_id) !== normUserId);
  if (inside) {
    list.push({
      user_id: normUserId,
      is_inside: 1,
      lat: latVal,
      lng: lngVal,
      last_updated: new Date().toISOString(),
    });
  }
  await writeJson('library_occupancy.json', pruneStale(list));

  const insideEntries = list.filter((c) => c.is_inside === 1);
  return pulsePayload(list.length, insideEntries.length, insideEntries);
}

/**
 * Remove rows whose heartbeat is older than STALE_MINUTES.
 * Mirrors the scheduled SQL cleanup job below.
 */
function pruneStale(list) {
  const cutoff = Date.now() - STALE_MINUTES * 60 * 1000;
  return list.filter((c) => new Date(c.last_updated).getTime() >= cutoff);
}

/**
 * Real-time occupancy pulse — count users who are inside AND sent a
 * heartbeat within the last STALE_MINUTES.
 */
export async function getLivePulse() {
  if (!useJsonFallback) {
    try {
      await query(
        `UPDATE live_library_occupancy
         SET is_inside = 0
         WHERE last_updated < DATEADD(MINUTE, @stale, GETDATE());`,
        { stale: { type: sql.Int, value: STALE_MINUTES } }
      );
      const r = await query(
        `SELECT user_id, lat, lng
         FROM live_library_occupancy
         WHERE is_inside = 1 AND last_updated >= DATEADD(MINUTE, -@stale, GETDATE());`,
        { stale: { type: sql.Int, value: STALE_MINUTES } }
      );
      const insideEntries = r.recordset || [];
      const reportingRows = await query(
        `SELECT COUNT(*) AS cnt
         FROM live_library_occupancy
         WHERE last_updated >= DATEADD(MINUTE, -@stale, GETDATE());`,
        { stale: { type: sql.Int, value: STALE_MINUTES } }
      );
      const reporting = reportingRows.recordset[0]?.cnt || 0;
      return pulsePayload(reporting, insideEntries.length, insideEntries);
    } catch (err) {
      console.warn('⚠️  SQL Server pulse failed, using JSON database fallback:', err.message);
      useJsonFallback = true;
    }
  }

  // JSON fallback
  let list = await readJson('library_occupancy.json');
  list = pruneStale(list);
  await writeJson('library_occupancy.json', list);
  const insideEntries = list.filter((c) => c.is_inside === 1);
  return pulsePayload(list.length, insideEntries.length, insideEntries);
}

function pulsePayload(reporting, occupied, entries) {
  const capacity = LIBRARY_CAPACITY;
  const points = (entries || [])
    .filter((e) => Number.isFinite(Number(e.lat)) && Number.isFinite(Number(e.lng)))
    .map((e) => ({ lat: Number(e.lat), lng: Number(e.lng) }));
  recordPeak(occupied);
  return {
    occupied,
    reporting,
    points,
    capacity,
    hourPeaks: buildHourPeaks(),
    occupancyPercent: capacity > 0 ? Math.round((occupied / capacity) * 100) : 0,
    freeSeats: Math.max(capacity - occupied, 0),
    staleMinutes: STALE_MINUTES,
    updatedAt: new Date().toISOString(),
  };
}

