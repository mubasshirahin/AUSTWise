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

function poolConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
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
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

const pool = new Pool(poolConfig());

export async function getPool() {
  return pool;
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

export async function query(queryStr, params) {
  const { text, values } = toPositional(queryStr, params);
  const result = await pool.query(text, values);
  const rows = result.rows || [];
  // Array-like so storeDB/userStore can do `rows[0]` / `rows.map`, plus the
  // mssql-shaped `.recordset` / `.rowsAffected` that telegramDB/dev.mjs use.
  const out = rows.slice();
  out.recordset = rows;
  out.rowsAffected = [result.rowCount ?? rows.length];
  return out;
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
  "Routine"   TEXT         NULL,
  "Enabled"   BOOLEAN      NOT NULL DEFAULT TRUE,
  "CreatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "UpdatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

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
  CONSTRAINT "UQ_PasswordVault_User" UNIQUE ("UserId", "Platform")
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
