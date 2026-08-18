/**
 * Generic key-value store backed by SQL Server.
 * Replaces localStorage for cross-device data sync.
 *
 * Tables (create via prisma db push):
 *   UserStore  — per-user data (userId + key → JSON value)
 *   SharedStore — global/shared data (key → JSON value)
 */

import { query, sql } from './db.mjs';
import { readJson, writeJson } from './jsonDB.mjs';

// ── JSON-file fallback (when DB is unavailable) ──────────────────────────────

const USER_STORE_FILE = 'userStore.json';     // { [userId]: { [key]: value } }
const SHARED_STORE_FILE = 'sharedStore.json'; // { [key]: value }

async function readUserStoreFile() { return (await readJson(USER_STORE_FILE)) || {}; }
async function writeUserStoreFile(data) { await writeJson(USER_STORE_FILE, data); }
async function readSharedStoreFile() { return (await readJson(SHARED_STORE_FILE)) || {}; }
async function writeSharedStoreFile(data) { await writeJson(SHARED_STORE_FILE, data); }

let _dbAvailable = null; // null = untested, true/false

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

// ── Ensure tables exist ──────────────────────────────────────────────────────

const TABLES_DDL = `
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'UserStore')
BEGIN
  CREATE TABLE UserStore (
    id        NVARCHAR(50) DEFAULT (NEWID()) PRIMARY KEY,
    userId    NVARCHAR(50) NOT NULL,
    [key]     NVARCHAR(200) NOT NULL,
    value     NVARCHAR(MAX) DEFAULT '{}',
    updatedAt DATETIME2 DEFAULT GETDATE(),
    createdAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT UQ_UserStore UNIQUE (userId, [key])
  );
  CREATE INDEX IX_UserStore_userId ON UserStore(userId);
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SharedStore')
BEGIN
  CREATE TABLE SharedStore (
    id        NVARCHAR(50) DEFAULT (NEWID()) PRIMARY KEY,
    [key]     NVARCHAR(200) NOT NULL UNIQUE,
    value     NVARCHAR(MAX) DEFAULT '{}',
    updatedBy NVARCHAR(50) DEFAULT '',
    updatedAt DATETIME2 DEFAULT GETDATE(),
    createdAt DATETIME2 DEFAULT GETDATE()
  );
END;
`;

let _tablesEnsured = false;

async function ensureTables() {
  if (_tablesEnsured) return;
  try {
    for (const stmt of TABLES_DDL.split(';').map(s => s.trim()).filter(Boolean)) {
      await query(stmt);
    }
    _tablesEnsured = true;
  } catch (err) {
    console.warn('⚠️  storeDB: Could not ensure tables:', err.message);
  }
}

// ── Per-user store ───────────────────────────────────────────────────────────

/** Get a user's stored value for a key. Returns parsed JSON or fallback. */
export async function getUserStoreValue(userId, key, fallback = null) {
  if (!userId || !key) return fallback;
  if (await isDbAvailable()) {
    await ensureTables();
    try {
      const rows = await query(
        'SELECT value FROM UserStore WHERE userId = @userId AND [key] = @key',
        [
          { name: 'userId', type: sql.NVarChar(50), value: userId },
          { name: 'key', type: sql.NVarChar(200), value: key },
        ]
      );
      if (rows.length > 0) {
        try { return JSON.parse(rows[0].value); } catch { return rows[0].value; }
      }
      return fallback;
    } catch (err) {
      console.warn('⚠️  getUserStoreValue DB error:', err.message);
    }
  }
  // JSON fallback
  const store = await readUserStoreFile();
  return store[userId]?.[key] ?? fallback;
}

/** Set a user's stored value for a key. Accepts any JSON-serializable value. */
export async function setUserStoreValue(userId, key, value) {
  if (!userId || !key) return;
  const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
  if (await isDbAvailable()) {
    await ensureTables();
    try {
      await query(`
        MERGE UserStore AS target
        USING (SELECT @userId AS userId, @key AS [key], @val AS value) AS source
        ON target.userId = source.userId AND target.[key] = source.[key]
        WHEN MATCHED THEN
          UPDATE SET value = source.value, updatedAt = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (userId, [key], value) VALUES (source.userId, source.[key], source.value);
      `, [
        { name: 'userId', type: sql.NVarChar(50), value: userId },
        { name: 'key', type: sql.NVarChar(200), value: key },
        { name: 'val', type: sql.NVarChar(-1), value: jsonValue },
      ]);
      return;
    } catch (err) {
      console.warn('⚠️  setUserStoreValue DB error:', err.message);
    }
  }
  // JSON fallback
  const store = await readUserStoreFile();
  if (!store[userId]) store[userId] = {};
  store[userId][key] = value;
  await writeUserStoreFile(store);
}

/** Delete a user's stored value for a key. */
export async function deleteUserStoreValue(userId, key) {
  if (!userId || !key) return;
  if (await isDbAvailable()) {
    await ensureTables();
    try {
      await query(
        'DELETE FROM UserStore WHERE userId = @userId AND [key] = @key',
        [
          { name: 'userId', type: sql.NVarChar(50), value: userId },
          { name: 'key', type: sql.NVarChar(200), value: key },
        ]
      );
      return;
    } catch (err) {
      console.warn('⚠️  deleteUserStoreValue DB error:', err.message);
    }
  }
  const store = await readUserStoreFile();
  if (store[userId]) { delete store[userId][key]; await writeUserStoreFile(store); }
}

/** Get all keys for a user. */
export async function listUserStoreKeys(userId) {
  if (!userId) return [];
  if (await isDbAvailable()) {
    await ensureTables();
    try {
      const rows = await query(
        'SELECT [key] FROM UserStore WHERE userId = @userId',
        [{ name: 'userId', type: sql.NVarChar(50), value: userId }]
      );
      return rows.map(r => r.key);
    } catch { /* fall through */ }
  }
  const store = await readUserStoreFile();
  return Object.keys(store[userId] || {});
}

// ── Shared (global) store ────────────────────────────────────────────────────

/** Get a shared stored value for a key. */
export async function getSharedStoreValue(key, fallback = null) {
  if (!key) return fallback;
  if (await isDbAvailable()) {
    await ensureTables();
    try {
      const rows = await query(
        'SELECT value FROM SharedStore WHERE [key] = @key',
        [{ name: 'key', type: sql.NVarChar(200), value: key }]
      );
      if (rows.length > 0) {
        try { return JSON.parse(rows[0].value); } catch { return rows[0].value; }
      }
      return fallback;
    } catch (err) {
      console.warn('⚠️  getSharedStoreValue DB error:', err.message);
    }
  }
  const store = await readSharedStoreFile();
  return store[key] ?? fallback;
}

/** Set a shared stored value for a key. */
export async function setSharedStoreValue(key, value, updatedBy = '') {
  if (!key) return;
  const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
  if (await isDbAvailable()) {
    await ensureTables();
    try {
      await query(`
        MERGE SharedStore AS target
        USING (SELECT @key AS [key], @val AS value, @by AS updatedBy) AS source
        ON target.[key] = source.[key]
        WHEN MATCHED THEN
          UPDATE SET value = source.value, updatedBy = source.updatedBy, updatedAt = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT ([key], value, updatedBy) VALUES (source.[key], source.value, source.updatedBy);
      `, [
        { name: 'key', type: sql.NVarChar(200), value: key },
        { name: 'val', type: sql.NVarChar(-1), value: jsonValue },
        { name: 'by', type: sql.NVarChar(50), value: updatedBy },
      ]);
      return;
    } catch (err) {
      console.warn('⚠️  setSharedStoreValue DB error:', err.message);
    }
  }
  const store = await readSharedStoreFile();
  store[key] = value;
  await writeSharedStoreFile(store);
}

/** Delete a shared stored value for a key. */
export async function deleteSharedStoreValue(key) {
  if (!key) return;
  if (await isDbAvailable()) {
    await ensureTables();
    try {
      await query('DELETE FROM SharedStore WHERE [key] = @key',
        [{ name: 'key', type: sql.NVarChar(200), value: key }]);
      return;
    } catch { /* fall through */ }
  }
  const store = await readSharedStoreFile();
  delete store[key];
  await writeSharedStoreFile(store);
}
