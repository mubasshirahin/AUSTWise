/**
 * PostgreSQL connection module.
 * Auto-creates tables on first run.
 *
 * Env (Railway injects DATABASE_URL automatically):
 *   DATABASE_URL=postgresql://user:pass@host:port/db
 *   — or the split form:
 *   DB_SERVER / PGHOST, DB_PORT / PGPORT, DB_DATABASE / PGDATABASE,
 *   DB_USER / PGUSER, DB_PASSWORD / PGPASSWORD
 *
 * query() keeps the old mssql shape ({ recordset, rowsAffected }) so
 * feature modules didn't have to change their result handling. Named
 * @params are rewritten to $n::cast internally.
 */

import pg from 'pg';

const { Pool } = pg;

// A short connect timeout locally keeps the JSON fallbacks responsive when a
// remote dev DB is unreachable; production keeps the longer default.
const CONNECT_TIMEOUT_MS = Number(
  process.env.DB_CONNECT_TIMEOUT_MS || (process.env.NODE_ENV === 'production' ? 10000 : 2500)
);

// Local dev shares the production Supabase session pooler (~15 slots total),
// so a dev process takes a smaller, faster-released share. `--vite` is read
// from argv because NODE_ENV is only pinned by dev.mjs after imports run.
const IS_LOCAL_DEV = process.argv.includes('--vite') || process.env.NODE_ENV === 'development';
const POOL_MAX = Number(process.env.PG_POOL_MAX || (IS_LOCAL_DEV ? 3 : 5));
const POOL_IDLE_MS = IS_LOCAL_DEV ? 10000 : 30000;

function poolConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      // Session poolers cap the total number of clients across app instances.
      // Keep each process small; deployments can tune this when their DB allows it.
      max: POOL_MAX,
      idleTimeoutMillis: POOL_IDLE_MS,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
      ssl: process.env.DATABASE_URL.includes('localhost')
        ? false
        : { rejectUnauthorized: false },
    };
  }
  return {
    host: process.env.PGHOST || process.env.DB_SERVER || 'localhost',
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_DATABASE || 'AUSTWise',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    max: POOL_MAX,
    idleTimeoutMillis: POOL_IDLE_MS,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  };
}

const pool = new Pool(poolConfig());

export async function getPool() {
  return pool;
}

/**
 * A standalone connection outside the pool, for long-held sessions such as
 * the scheduler's advisory lock. Keeping those out of the pool means request
 * traffic always gets all PG_POOL_MAX slots. Caller must connect() and end().
 */
export function createDedicatedClient() {
  // Pool-only options (max, idleTimeoutMillis) are dropped for a single client.
  const { max: _max, idleTimeoutMillis: _idle, ...clientConfig } = poolConfig();
  return new pg.Client(clientConfig);
}

function pgType(t) {
  if (!t) return null;
  if (typeof t === 'string') return t;
  return null;
}

function toPositional(sqlStr, params) {
  if (!params) return { text: sqlStr, values: [] };
  const map = {};
  if (Array.isArray(params)) {
    for (const p of params) map[p.name] = p;
  } else {
    for (const [name, p] of Object.entries(params)) {
      map[name] = p && typeof p === 'object' && 'value' in p ? p : { value: p };
    }
  }
  const values = [];
  const used = new Map();
  const text = sqlStr.replace(/@(\w+)/g, (m, name) => {
    // Leave @@ROWCOUNT-style tokens (none should remain after the SQL port).
    if (!(name in map)) return m;
    if (!used.has(name)) {
      used.set(name, values.length + 1);
      values.push(map[name].value);
    }
    const n = used.get(name);
    const cast = pgType(map[name].type);
    return cast ? `$${n}::${cast}` : `$${n}`;
  });
  return { text, values };
}

// Circuit breaker: once the DB starts timing out, fail fast for a short
// cooldown so callers hit their JSON fallbacks immediately instead of paying
// the connect timeout on every single request (which made admin toggles hang).
const DB_CIRCUIT_THRESHOLD = Number(process.env.DB_CIRCUIT_THRESHOLD || 3);
const DB_CIRCUIT_COOLDOWN_MS = Number(process.env.DB_CIRCUIT_COOLDOWN_MS || 30000);
let _dbFailures = 0;
let _dbCircuitUntil = 0;

export async function query(queryStr, params) {
  if (Date.now() < _dbCircuitUntil) throw new Error('database circuit open');
  const { text, values } = toPositional(queryStr, params);
  try {
    const result = await pool.query(text, values);
    _dbFailures = 0;
    const rows = result.rows || [];
    // Array-like so storeDB/userStore can do `rows[0]` / `rows.map`, plus the
    // mssql-shaped `.recordset` / `.rowsAffected` that telegramDB/dev.mjs use.
    const out = rows.slice();
    out.recordset = rows;
    out.rowsAffected = [result.rowCount ?? rows.length];
    return out;
  } catch (err) {
    _dbFailures += 1;
    if (_dbFailures >= DB_CIRCUIT_THRESHOLD) {
      _dbCircuitUntil = Date.now() + DB_CIRCUIT_COOLDOWN_MS;
      _dbFailures = 0;
      console.warn(`⚠️ db: circuit opened for ${DB_CIRCUIT_COOLDOWN_MS}ms after repeated failures`);
    }
    throw err;
  }
}

/**
 * mssql-compatible type tags. query() only reads the string they produce
 * (`text`/`int`/`float`/`boolean`) to emit `$n::cast`.
 */
function NVarChar() { return 'text'; }
NVarChar.MAX = 'text';

export const sql = {
  NVarChar,
  MAX: -1,
  Int: 'int',
  Float: 'float',
  Bit: 'boolean',
  DateTime: 'timestamptz',
};

const TABLE_DDL = `
CREATE TABLE IF NOT EXISTS "TelegramUsers" (
  "ChatId"    TEXT         NOT NULL PRIMARY KEY,
  "Awid"      TEXT         NULL,
  "Routine"   TEXT         NULL,
  "Enabled"   BOOLEAN      NOT NULL DEFAULT TRUE,
  "CreatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "UpdatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE "TelegramUsers" ADD COLUMN IF NOT EXISTS "Awid" TEXT NULL;

CREATE TABLE IF NOT EXISTS "AttendanceRecords" (
  "Id"         SERIAL       PRIMARY KEY,
  "ChatId"     TEXT         NOT NULL,
  "CourseCode" TEXT         NOT NULL,
  "Attended"   BOOLEAN      NOT NULL,
  "RecordDate" DATE         NOT NULL DEFAULT CURRENT_DATE,
  "Timestamp"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_Attendance_TelegramUsers"
    FOREIGN KEY ("ChatId") REFERENCES "TelegramUsers"("ChatId") ON DELETE CASCADE,
  CONSTRAINT "UQ_Attendance_Daily" UNIQUE ("ChatId", "CourseCode", "RecordDate")
);
CREATE INDEX IF NOT EXISTS "IX_Attendance_ChatId" ON "AttendanceRecords" ("ChatId");

CREATE TABLE IF NOT EXISTS "LibraryPresence" (
  "DeviceId"  TEXT         NOT NULL PRIMARY KEY,
  "Lat"       DOUBLE PRECISION NOT NULL,
  "Lng"       DOUBLE PRECISION NOT NULL,
  "UpdatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS live_library_occupancy (
  id            SERIAL       PRIMARY KEY,
  user_id       INT          NOT NULL,
  is_inside     BOOLEAN      NOT NULL DEFAULT FALSE,
  lat           DOUBLE PRECISION NULL,
  lng           DOUBLE PRECISION NULL,
  last_updated  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_live_library_occupancy_user UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS "PasswordVault" (
  "Id"         UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "UserId"     TEXT         NOT NULL,
  "Platform"   TEXT         NOT NULL,
  "Email"      TEXT         NOT NULL,
  "Username"   TEXT         NULL,
  "EncIv"      TEXT         NOT NULL,
  "EncContent" TEXT         NOT NULL,
  "EncAuthTag" TEXT         NOT NULL,
  "CreatedAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "UpdatedAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "UQ_PasswordVault_User" UNIQUE ("UserId", "Platform", "Email")
);
CREATE INDEX IF NOT EXISTS "IX_PasswordVault_UserId" ON "PasswordVault" ("UserId");

CREATE TABLE IF NOT EXISTS "Invitations" (
  "Id"         SERIAL       PRIMARY KEY,
  "Email"      TEXT         NOT NULL,
  "Role"       TEXT         NOT NULL,
  "Token"      TEXT         NOT NULL,
  "Status"     TEXT         NOT NULL DEFAULT 'pending',
  "InvitedBy"  TEXT         NULL,
  "CreatedAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "ExpiresAt"  TIMESTAMPTZ  NULL,
  "AcceptedAt" TIMESTAMPTZ  NULL,
  CONSTRAINT "UQ_Invitations_Token" UNIQUE ("Token")
);
CREATE INDEX IF NOT EXISTS "IX_Invitations_Email" ON "Invitations" ("Email");
CREATE INDEX IF NOT EXISTS "IX_Invitations_Status" ON "Invitations" ("Status");
`;

export async function initializeDatabase() {
  await pool.query(TABLE_DDL);
  console.log('✅ Database tables ready (auto-created if missing)');

  // Migration: widen PasswordVault unique constraint to include Email
  // so multiple accounts per platform are allowed.
  try {
    // Check current constraint columns
    const constraintCheck = await pool.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_name = kcu.table_name
      WHERE tc.table_name = 'PasswordVault'
        AND tc.constraint_type = 'UNIQUE'
        AND tc.constraint_name = 'UQ_PasswordVault_User'
      ORDER BY kcu.ordinal_position
    `);
    const cols = constraintCheck.rows.map(r => r.column_name);
    const needsMigration = !cols.includes('Email');
    if (needsMigration) {
      await pool.query(`ALTER TABLE "PasswordVault" DROP CONSTRAINT IF EXISTS "UQ_PasswordVault_User"`);
      await pool.query(`ALTER TABLE "PasswordVault" ADD CONSTRAINT "UQ_PasswordVault_User" UNIQUE ("UserId", "Platform", "Email")`);
      console.log('✅ PasswordVault constraint migrated → (UserId, Platform, Email)');
    }
  } catch (err) {
    console.log('ℹ️ PasswordVault constraint migration skipped:', err.message);
  }

  return true;
}

export async function testConnection() {
  try {
    const result = await pool.query('SELECT version() AS version');
    const v = result.rows[0]?.version || '';
    console.log('✅ PostgreSQL:', v.substring(0, 60) + (v.length > 60 ? '...' : ''));
    return true;
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    return false;
  }
}

export async function resetDatabase() {
  await pool.query('DELETE FROM "AttendanceRecords"');
  await pool.query('DELETE FROM "TelegramUsers"');
  await pool.query('DELETE FROM "LibraryPresence"');
  await pool.query('DELETE FROM "Invitations"');
  return true;
}

export { pool };
