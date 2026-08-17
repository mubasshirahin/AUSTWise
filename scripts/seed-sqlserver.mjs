/**
 * One-time migration: seed the real catalog data from the legacy JSON files
 * into the SQL Server tables (Prisma schema).
 *
 * Migrates:
 *   server/courses.json   -> Course
 *   server/locations.json -> CampusLocation
 *
 * Dev/test data (users, shared_routines, messages, role applications) is
 * deliberately NOT imported so production starts clean.
 *
 * Run: node scripts/seed-sqlserver.mjs
 */

import 'dotenv/config';
import sql from 'mssql';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, '..', 'server');

const useTrusted = process.env.DB_TRUSTED === 'true';
const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_DATABASE || 'AUSTWise',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: true,
    connectTimeout: 10000,
    requestTimeout: 60000,
  },
};

if (useTrusted) {
  config.authentication = { type: 'ntlm', options: { userName: '', password: '', domain: '' } };
} else {
  config.user = process.env.DB_USER || 'sa';
  config.password = process.env.DB_PASSWORD || '';
}

async function readJson(name) {
  try {
    return JSON.parse(await readFile(path.join(serverDir, name), 'utf-8'));
  } catch {
    return null;
  }
}

async function seedCourses(pool) {
  const courses = await readJson('courses.json');
  if (!Array.isArray(courses) || courses.length === 0) {
    console.log('courses.json empty/missing — skipped');
    return 0;
  }
  // Idempotent: skip codes that already exist (table may be partially seeded).
  const existing = await pool.request().query('SELECT code FROM Course');
  const seen = new Set(existing.recordset.map((r) => r.code));
  let inserted = 0;
  let skipped = 0;
  for (const c of courses) {
    if (!c.code || !c.name) continue;
    if (seen.has(c.code)) { skipped++; continue; }
    await pool.request()
      .input('code', sql.NVarChar(50), c.code)
      .input('name', sql.NVarChar(200), c.name)
      .input('credit', sql.Float, Number(c.credit) || 0)
      .input('department', sql.NVarChar(50), c.department || '')
      .query('INSERT INTO Course (code, name, credit, department) VALUES (@code, @name, @credit, @department)');
    seen.add(c.code);
    inserted++;
  }
  console.log(`✅ Seeded ${inserted} courses (${skipped} duplicates skipped)`);
  return inserted;
}

async function seedLocations(pool) {
  const locations = await readJson('locations.json');
  if (!Array.isArray(locations) || locations.length === 0) {
    console.log('locations.json empty/missing — skipped');
    return 0;
  }
  const existing = await pool.request().query('SELECT roomId, floor FROM CampusLocation');
  const seen = new Set(existing.recordset.map((r) => `${r.floor}::${r.roomId}`));
  let inserted = 0;
  for (const loc of locations) {
    const key = `${String(loc.floor || '')}::${String(loc.roomId || '')}`;
    if (seen.has(key)) continue;
    await pool.request()
      .input('floor', sql.NVarChar(100), String(loc.floor || ''))
      .input('roomId', sql.NVarChar(100), String(loc.roomId || ''))
      .input('name', sql.NVarChar(200), String(loc.name || ''))
      .input('type', sql.NVarChar(100), String(loc.type || ''))
      .input('hotspotData', sql.NVarChar(sql.MAX), loc.hotspotData != null ? String(loc.hotspotData) : '{}')
      .input('x', sql.Float, loc.x != null ? Number(loc.x) : null)
      .input('y', sql.Float, loc.y != null ? Number(loc.y) : null)
      .input('mapImage', sql.NVarChar(500), String(loc.mapImage || ''))
      .query(
        'INSERT INTO CampusLocation (floor, roomId, name, type, hotspotData, x, y, mapImage) VALUES (@floor, @roomId, @name, @type, @hotspotData, @x, @y, @mapImage)',
      );
    seen.add(key);
    inserted++;
  }
  console.log(`✅ Seeded ${inserted} campus locations`);
  return inserted;
}

try {
  const pool = await sql.connect(config);
  console.log(`Connected to ${config.database} (${config.server}:${config.port})`);
  await seedCourses(pool);
  await seedLocations(pool);
  await pool.close();
  console.log('Migration complete.');
} catch (e) {
  console.error('Migration failed:', e.message);
  process.exitCode = 1;
}