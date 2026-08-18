/**
 * Role application store (CR/SR) — dual-mode like storeDB.mjs.
 *   SQL Server (via db.mjs) when configured, else the legacy JSON file
 *   (server/roleApplications.json) as fallback.
 *
 * The role application flow used to live entirely in the browser's
 * localStorage, which meant applications never reached the admin on a
 * different device and the notification was shown to the applicant instead
 * of the admin. Persisting them server-side lets the admin reliably see every
 * application and be notified (bell + native popup) the moment one arrives.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, sql } from './db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'roleApplications.json');

// ── SQL table ────────────────────────────────────────────────────────────────

const ROLE_APP_DDL = `
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RoleApplications')
BEGIN
  CREATE TABLE RoleApplications (
    id    NVARCHAR(50) PRIMARY KEY,
    data  NVARCHAR(MAX) DEFAULT '{}'
  );
END;
`;

let _tablesEnsured = false;
let _dbAvailable = null;

async function isDbAvailable() {
  if (_dbAvailable !== null) return _dbAvailable;
  try {
    await query('SELECT 1');
    _dbAvailable = true;
  } catch {
    _dbAvailable = false;
  }
  return _dbAvailable;
}

async function ensureTables() {
  if (_tablesEnsured) return;
  try {
    for (const stmt of ROLE_APP_DDL.split(';').map((s) => s.trim()).filter(Boolean)) {
      await query(stmt);
    }
    _tablesEnsured = true;
  } catch (err) {
    console.warn('⚠️  roleAppDB: could not create RoleApplications table:', err.message);
  }
}

async function listFromDb() {
  await ensureTables();
  const rows = await query('SELECT data FROM RoleApplications');
  return rows.map((r) => {
    try { return JSON.parse(r.data); } catch { return null; }
  }).filter(Boolean);
}

async function upsertRow(app) {
  const data = typeof app === 'string' ? app : JSON.stringify(app);
  await query(`
    MERGE RoleApplications AS target
    USING (SELECT @id AS id, @data AS data) AS source
    ON target.id = source.id
    WHEN MATCHED THEN UPDATE SET data = source.data
    WHEN NOT MATCHED THEN INSERT (id, data) VALUES (source.id, source.data);
  `, [
    { name: 'id', type: sql.NVarChar(50), value: app.id },
    { name: 'data', type: sql.NVarChar(-1), value: data },
  ]);
}

// ── API ──────────────────────────────────────────────────────────────────────

export async function listRoleApplications() {
  if (await isDbAvailable()) {
    try {
      const rows = await listFromDb();
      // One-time migration from the JSON file if SQL is empty.
      if (rows.length === 0) {
        try {
          const legacy = JSON.parse(await readFile(DB_PATH, 'utf8'));
          if (Array.isArray(legacy) && legacy.length) {
            for (const app of legacy) await upsertRow(app);
            return legacy;
          }
        } catch { /* invalid/absent file — ignore */ }
      }
      return rows;
    } catch (err) {
      console.warn('⚠️  roleAppDB: SQL read failed, using JSON fallback:', err.message);
    }
  }
  try {
    const raw = await readFile(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function getRoleApplicationsByUser(userId) {
  const all = await listRoleApplications();
  return all.filter((a) => a.userId === userId);
}

export async function createRoleApplication(app) {
  if (await isDbAvailable()) {
    try {
      await ensureTables();
      await upsertRow(app);
    } catch (err) {
      console.warn('⚠️  roleAppDB: SQL write failed, using JSON fallback:', err.message);
    }
  }
  const all = await listRoleApplications();
  all.push(app);
  await writeFile(DB_PATH, JSON.stringify(all, null, 2));
  return app;
}

export async function updateRoleApplication(id, patch) {
  const all = await listRoleApplications();
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch };
  if (await isDbAvailable()) {
    try {
      await ensureTables();
      await upsertRow(all[idx]);
    } catch (err) {
      console.warn('⚠️  roleAppDB: SQL write failed, using JSON fallback:', err.message);
    }
  }
  await writeFile(DB_PATH, JSON.stringify(all, null, 2));
  return all[idx];
}