/**
 * Generic key-value store backed by SQL Server.
 * Replaces localStorage for cross-device data sync.
 *
 * Tables (create via prisma db push):
 *   UserStore  — per-user data (userId + key → JSON value)
 *   SharedStore — global/shared data (key → JSON value)
 */

import { randomUUID } from 'node:crypto';
import { query, sql } from './db.mjs';
import { readJson, writeJson } from './jsonDB.mjs';

// ── JSON-file fallback (when DB is unavailable) ──────────────────────────────

const USER_STORE_FILE = 'userStore.json';     // { [userId]: { [key]: value } }
const SHARED_STORE_FILE = 'sharedStore.json'; // { [key]: value }

async function readUserStoreFile() { return (await readJson(USER_STORE_FILE, {})) || {}; }
async function writeUserStoreFile(data) { await writeJson(USER_STORE_FILE, data); }
async function readSharedStoreFile() { return (await readJson(SHARED_STORE_FILE, {})) || {}; }
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
CREATE TABLE IF NOT EXISTS "UserStore" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "key"       TEXT NOT NULL,
  "value"     TEXT NOT NULL DEFAULT '{}',
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_userstore UNIQUE ("userId", "key")
);
CREATE INDEX IF NOT EXISTS ix_userstore_userid ON "UserStore" ("userId");

CREATE TABLE IF NOT EXISTS "SharedStore" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "key"       TEXT NOT NULL UNIQUE,
  "value"     TEXT NOT NULL DEFAULT '{}',
  "updatedBy" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tombstones remember keys that were deliberately deleted, so the
-- localStorage→server migration never resurrects them from a stale copy
-- on a device that missed the live delete broadcast.
CREATE TABLE IF NOT EXISTS "UserStoreDeleted" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "key"       TEXT NOT NULL,
  "deletedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_userstore_deleted UNIQUE ("userId", "key")
);
CREATE INDEX IF NOT EXISTS ix_userstore_deleted_userid ON "UserStoreDeleted" ("userId");

CREATE TABLE IF NOT EXISTS "SharedStoreDeleted" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "key"       TEXT NOT NULL UNIQUE,
  "deletedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
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
        'SELECT value FROM "UserStore" WHERE "userId" = @userId AND "key" = @key',
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
        INSERT INTO "UserStore" ("id", "userId", "key", value, "updatedAt")
        VALUES (@id, @userId, @key, @val, NOW())
        ON CONFLICT ("userId", "key") DO UPDATE SET
          value = EXCLUDED.value,
          "updatedAt" = NOW();
      `, [
        { name: 'id', type: sql.NVarChar(50), value: randomUUID() },
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
  // Remember the deletion so a stale localStorage copy on another device can't
  // resurrect this key during the login migration.
  await markUserStoreDeleted(userId, key);
  if (await isDbAvailable()) {
    await ensureTables();
    try {
      await query(
        'DELETE FROM "UserStore" WHERE "userId" = @userId AND "key" = @key',
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
        'SELECT "key" FROM "UserStore" WHERE "userId" = @userId',
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
        'SELECT value FROM "SharedStore" WHERE "key" = @key',
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
        INSERT INTO "SharedStore" ("id", "key", value, "updatedBy", "updatedAt")
        VALUES (@id, @key, @val, @by, NOW())
        ON CONFLICT ("key") DO UPDATE SET
          value = EXCLUDED.value,
          "updatedBy" = EXCLUDED."updatedBy",
          "updatedAt" = NOW();
      `, [
        { name: 'id', type: sql.NVarChar(50), value: randomUUID() },
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
  // Remember the deletion so stale local copies can't resurrect it on migrate.
  await markSharedStoreDeleted(key);
  if (await isDbAvailable()) {
    await ensureTables();
    try {
      await query('DELETE FROM "SharedStore" WHERE "key" = @key',
        [{ name: 'key', type: sql.NVarChar(200), value: key }]);
      return;
    } catch { /* fall through */ }
  }
  const store = await readSharedStoreFile();
  delete store[key];
  await writeSharedStoreFile(store);
}

// ── Tombstones (deleted-key memory, prevents migration resurrection) ─────────

const USER_DELETED_FILE = 'userStoreDeleted.json'; // { [userId]: { [key]: timestamp } }
const SHARED_DELETED_FILE = 'sharedStoreDeleted.json'; // { [key]: timestamp }

async function readUserDeletedFile() { return (await readJson(USER_DELETED_FILE, {})) || {}; }
async function writeUserDeletedFile(data) { await writeJson(USER_DELETED_FILE, data); }
async function readSharedDeletedFile() { return (await readJson(SHARED_DELETED_FILE, {})) || {}; }
async function writeSharedDeletedFile(data) { await writeJson(SHARED_DELETED_FILE, data); }

/** Record that a user's key was deliberately deleted. */
export async function markUserStoreDeleted(userId, key) {
  if (!userId || !key) return;
  if (await isDbAvailable()) {
    await ensureTables();
    try {
      await query(`
        INSERT INTO "UserStoreDeleted" ("id", "userId", "key", "deletedAt")
        VALUES (@id, @userId, @key, NOW())
        ON CONFLICT ("userId", "key") DO UPDATE SET "deletedAt" = NOW();
      `, [
        { name: 'id', type: sql.NVarChar(50), value: randomUUID() },
        { name: 'userId', type: sql.NVarChar(50), value: userId },
        { name: 'key', type: sql.NVarChar(200), value: key },
      ]);
      return;
    } catch (err) {
      console.warn('⚠️  markUserStoreDeleted DB error:', err.message);
    }
  }
  const store = await readUserDeletedFile();
  if (!store[userId]) store[userId] = {};
  store[userId][key] = new Date().toISOString();
  await writeUserDeletedFile(store);
}

/** Was a user's key deliberately deleted (so migration should skip it)? */
export async function isUserStoreDeleted(userId, key) {
  if (!userId || !key) return false;
  if (await isDbAvailable()) {
    await ensureTables();
    try {
      const rows = await query(
        'SELECT 1 FROM "UserStoreDeleted" WHERE "userId" = @userId AND "key" = @key',
        [
          { name: 'userId', type: sql.NVarChar(50), value: userId },
          { name: 'key', type: sql.NVarChar(200), value: key },
        ]
      );
      return rows.length > 0;
    } catch { /* fall through */ }
  }
  const store = await readUserDeletedFile();
  return Boolean(store[userId]?.[key]);
}

/** Record that a shared key was deliberately deleted. */
export async function markSharedStoreDeleted(key) {
  if (!key) return;
  if (await isDbAvailable()) {
    await ensureTables();
    try {
      await query(`
        INSERT INTO "SharedStoreDeleted" ("id", "key", "deletedAt")
        VALUES (@id, @key, NOW())
        ON CONFLICT ("key") DO UPDATE SET "deletedAt" = NOW();
      `, [
        { name: 'id', type: sql.NVarChar(50), value: randomUUID() },
        { name: 'key', type: sql.NVarChar(200), value: key },
      ]);
      return;
    } catch (err) {
      console.warn('⚠️  markSharedStoreDeleted DB error:', err.message);
    }
  }
  const store = await readSharedDeletedFile();
  store[key] = new Date().toISOString();
  await writeSharedDeletedFile(store);
}

/** Was a shared key deliberately deleted (so migration should skip it)? */
export async function isSharedStoreDeleted(key) {
  if (!key) return false;
  if (await isDbAvailable()) {
    await ensureTables();
    try {
      const rows = await query(
        'SELECT 1 FROM "SharedStoreDeleted" WHERE "key" = @key',
        [{ name: 'key', type: sql.NVarChar(200), value: key }]
      );
      return rows.length > 0;
    } catch { /* fall through */ }
  }
  const store = await readSharedDeletedFile();
  return Boolean(store[key]);
}
