/**
 * User store — dual-mode like storeDB.mjs / passwordVaultDB.mjs.
 *   SQL Server (via db.mjs) when the database is configured,
 *   else the legacy JSON file (server/users.json) as fallback.
 *
 * Accounts previously lived ONLY in users.json, which is gitignored so it is
 * ephemeral on Railway — a redeploy wiped every account. SQL keeps accounts
 * persistent across redeploys so the same email always resolves to the same
 * user on every device.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { query, sql } from './db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'users.json');
const BCRYPT_ROUNDS = 10;

// ── SQL table (AuthUsers) ────────────────────────────────────────────────────

const AUTH_USERS_DDL = `
CREATE TABLE IF NOT EXISTS "AuthUsers" (
  id    TEXT PRIMARY KEY,
  awid  TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  name  TEXT NOT NULL DEFAULT '',
  data  TEXT DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS ix_authusers_email ON "AuthUsers" (email);
CREATE INDEX IF NOT EXISTS ix_authusers_awid ON "AuthUsers" (awid);
`;

let _authTablesEnsured = false;
let _dbAvailable = null; // null = untested → true/false

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

async function ensureAuthTables() {
  if (_authTablesEnsured) return;
  try {
    // Run the DDL as a single batch — the IF NOT EXISTS … BEGIN…END wrapper is
    // already atomic. Splitting on ';' breaks the block apart and produces a
    // dangling ')' fragment ("Incorrect syntax near ')'").
    await query(AUTH_USERS_DDL);
    _authTablesEnsured = true;
  } catch (err) {
    console.warn('⚠️  userStore: could not create AuthUsers table:', err.message);
  }
}

// The `data` column stores the FULL user object (minus `id`/`email`, which are
// columns) so this module keeps byte-compatible shapes with the old JSON format.
function toUserRow(user) {
  const { id, email, ...rest } = user;
  return { id, email, data: JSON.stringify({ ...rest, id, email }) };
}

function fromUserRow(row) {
  try { return JSON.parse(row.data); } catch { return null; }
}

// ── Data access ──────────────────────────────────────────────────────────────

/** Every role the system understands. */
export const FACULTY_DEPARTMENTS = ['CSE', 'EEE', 'CE', 'ME', 'IPE', 'TE', 'ARCH', 'BBA'];
export const facultyDepartmentRole = (department) => `faculty_${String(department || '').trim().toLowerCase()}`;
const facultyDepartmentRoles = FACULTY_DEPARTMENTS.map(facultyDepartmentRole);
export const VALID_ROLES = ['student', 'faculty', 'alumni', 'alumni_with_carry', 'admin', 'cr', 'sr', 'senior', 'moderator', 'vp', 'gs', 'readd', 'bus_coordinator', 'guest', 'clubs_representative', 'help_desk', 'banned', ...facultyDepartmentRoles];
/** Roles an admin may assign to another user via the admin panel / approvals. */
export const ADMIN_ASSIGNABLE_ROLES = ['student', 'cr', 'sr', 'vp', 'gs', 'readd', 'faculty', ...facultyDepartmentRoles, 'alumni', 'alumni_with_carry', 'moderator', 'bus_coordinator', 'guest', 'clubs_representative', 'help_desk', 'banned'];
const DEV_PASSWORD = 'Dev@123456';

const DEPARTMENTS = ['CSE', 'EEE', 'CE', 'ME', 'IPE', 'TE', 'ARCH', 'BBA'];
const SECTIONS = ['A', 'B', 'C', 'D'];
const LAB_GROUPS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'];
const NAME_POOL = [
  'Rafi', 'Nadia', 'Arif', 'Samira', 'Farhan', 'Tasnim', 'Mahi', 'Riyad',
  'Jannat', 'Sami', 'Ayesha', 'Imran', 'Fahim', 'Rahim', 'Sadia', 'Khalid',
  'Nusrat', 'Shakil', 'Mitu', 'Rashed', 'Prome', 'Asif', 'Lamia', 'Hasan', 'Mim'
];

export async function readUsers() {
  if (await isDbAvailable()) {
    await ensureAuthTables();
    try {
      const rows = await query('SELECT id, email, data FROM "AuthUsers"');
      const users = rows.map(fromUserRow).filter(Boolean);
      // One-time migration: if the JSON file has rows and SQL is empty, push
      // the file's accounts up so nothing the user created before survives on
      // the persistent store.
      if (users.length === 0 && existsSync(DB_PATH)) {
        try {
          const legacy = JSON.parse(await readFile(DB_PATH, 'utf-8'));
          if (Array.isArray(legacy) && legacy.length) {
            for (const user of legacy) {
              await upsertUserRow(toUserRow(user));
            }
            users.push(...legacy);
          }
        } catch { /* invalid/absent file — ignore */ }
      }
      return users;
    } catch (err) {
      console.warn('⚠️  userStore: SQL read failed, using JSON fallback:', err.message);
    }
  }
  try {
    if (!existsSync(DB_PATH)) return [];
    const raw = await readFile(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch { return []; }
}

async function upsertUserRow(row) {
  await query(`
    INSERT INTO "AuthUsers" (id, awid, email, data)
    VALUES (@id, COALESCE(@data::jsonb->>'awid', ''), @email, @data)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, data = EXCLUDED.data;
  `, [
    { name: 'id', type: sql.NVarChar(50), value: row.id },
    { name: 'email', type: sql.NVarChar(200), value: row.email },
    { name: 'data', type: sql.NVarChar(-1), value: row.data },
  ]);
}

async function deleteUserRow(id) {
  if (await isDbAvailable()) {
    await ensureAuthTables();
    try {
      await query('DELETE FROM "AuthUsers" WHERE id = @id',
        [{ name: 'id', type: sql.NVarChar(50), value: id }]);
    } catch (err) {
      console.warn('⚠️  userStore: SQL delete failed:', err.message);
    }
  }
}

async function writeUsers(users) {
  // Fire-and-forget SQL write when possible; always refresh the JSON file so
  // offline/local fallback stays coherent.
  if (await isDbAvailable()) {
    await ensureAuthTables();
    try {
      for (const user of users) {
        await upsertUserRow(toUserRow(user));
      }
    } catch (err) {
      console.warn('⚠️  userStore: SQL write failed, writing JSON only:', err.message);
    }
  }
  await writeFile(DB_PATH, JSON.stringify(users, null, 2));
}

/** Read the JSON fallback file as an array (never throws). */
async function readJsonUsers() {
  try {
    if (!existsSync(DB_PATH)) return [];
    const list = JSON.parse(await readFile(DB_PATH, 'utf-8'));
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

/**
 * Read ONE raw user (password included) by id, preferring SQL. Unlike
 * readUsers() this never pulls the whole table, and unlike getUserById() it
 * keeps the password hash so callers can merge without losing it.
 */
async function readRawUser(id) {
  if (await isDbAvailable()) {
    await ensureAuthTables();
    try {
      const rows = await query('SELECT data FROM "AuthUsers" WHERE id = @id',
        [{ name: 'id', type: sql.NVarChar(50), value: id }]);
      if (rows && rows[0]) return fromUserRow(rows[0]);
      // Not in SQL yet — fall through to the JSON mirror below.
    } catch (err) {
      console.warn('⚠️  userStore: SQL single read failed, using JSON fallback:', err.message);
    }
  }
  const users = await readJsonUsers();
  return users.find((u) => u && u.id === id) || null;
}

/**
 * Persist ONE user with a single SQL upsert plus a one-row JSON mirror.
 *
 * writeUsers() rewrites the ENTIRE table row by row, so on a remote database
 * with thousands of accounts a single profile save becomes a multi-minute
 * stall — the request never finishes and the edit is dropped. Every
 * single-user path must go through this instead.
 */
async function persistUser(user) {
  let wroteSql = false;
  if (await isDbAvailable()) {
    await ensureAuthTables();
    try {
      await upsertUserRow(toUserRow(user));
      wroteSql = true;
    } catch (err) {
      console.warn('⚠️  userStore: SQL write failed, writing JSON only:', err.message);
    }
  }
  // Keep the JSON fallback coherent. When SQL is the source of truth, only
  // touch a file that already exists so we never fabricate a partial mirror.
  if (wroteSql && !existsSync(DB_PATH)) return;
  const list = await readJsonUsers();
  const idx = list.findIndex((u) => u && u.id === user.id);
  if (idx === -1) list.push(user); else list[idx] = user;
  await writeFile(DB_PATH, JSON.stringify(list, null, 2));
}

/** Remove ONE user (SQL row + JSON mirror entry) without rewriting the table. */
async function removePersistedUser(id) {
  await deleteUserRow(id);
  if (!existsSync(DB_PATH)) return;
  const list = await readJsonUsers();
  const filtered = list.filter((u) => u && u.id !== id);
  if (filtered.length !== list.length) {
    await writeFile(DB_PATH, JSON.stringify(filtered, null, 2));
  }
}

/**
 * Normalize a year-semester value ("3.1" or "Year 3 - Semester 1") to the
 * canonical server format "Year 3 - Semester 1". Returns '' for junk.
 */
function toYearSemester(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (/Year\s*\d+\s*-\s*Semester\s*\d+/i.test(s)) return s;
  const parts = s.split('.');
  const yr = Number(parts[0]);
  const term = Number(parts[1]);
  if (Number.isFinite(yr) && Number.isFinite(term) && yr >= 1 && term >= 1) {
    return `Year ${yr} - Semester ${term}`;
  }
  return '';
}

/**
 * Generate a unique AUSTWise ID (AWID) for a user, e.g. STU-CSE-AW000042.
 * AWID is the app's internal identifier and is deliberately separate from
 * the university student ID (which is derived from the email address).
 */
function generateAwid(users, role, department) {
  const prefixes = { student: 'STU', faculty: 'FAC', alumni: 'ALU', alumni_with_carry: 'ALU', admin: 'ADM', moderator: 'MOD', guest: 'GST', help_desk: 'HLP', banned: 'BAN' };
  const prefix = prefixes[String(role || '').toLowerCase()] || 'USR';
  const dept = String(department || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!dept || dept === 'UNDECLARED') throw new Error('Choose your department before your AUSTWise ID is created.');
  const existing = users.filter((u) => u.awid && u.awid.startsWith(`${prefix}-${dept}-AW`));
  const maxNum = existing.reduce((max, u) => {
    const match = String(u.awid).match(/AW(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  const nextNum = String(maxNum + 1).padStart(6, '0');
  return `${prefix}-${dept}-AW${nextNum}`;
}

/**
 * Backfill AWIDs for users created before AWID generation existed, so
 * every account ends up with a unique app ID distinct from the student ID.
 */
export async function ensureAllAwids() {
  const users = await readUsers();
  let changed = false;
  for (const user of users) {
    const department = String(user.department || '').toUpperCase();
    const hasValidDepartment = FACULTY_DEPARTMENTS.includes(department);
    if (department === 'UNDECLARED') {
      user.department = '';
      user.awid = '';
      user.signupIncomplete = true;
      changed = true;
      continue;
    }
    const prefix = ({ student: 'STU', faculty: 'FAC', alumni: 'ALU', alumni_with_carry: 'ALU', admin: 'ADM', moderator: 'MOD', guest: 'GST', help_desk: 'HLP', banned: 'BAN' })[String(user.role || '').toLowerCase()] || 'USR';
    const expectedPrefix = `${prefix}-${hasValidDepartment ? department : 'GEN'}-AW`;
    if (hasValidDepartment && !String(user.awid || '').startsWith(expectedPrefix)) {
      user.awid = generateAwid(users.filter((candidate) => candidate.id !== user.id), user.role, department);
      changed = true;
    } else if (!user.awid && !['student', 'faculty', 'alumni', 'alumni_with_carry'].includes(user.role)) {
      user.awid = generateAwid(users, user.role, 'GEN');
      changed = true;
    }
  }
  if (changed) await writeUsers(users);
  return changed;
}

/** Seed a default admin account if no admin exists */
export async function seedDefaultAdmin() {
  const users = await readUsers();
  if (users.some(u => u.role === 'admin')) return null;
  const isProduction = process.env.NODE_ENV === 'production';
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD;
  if (isProduction && (!adminPassword || adminPassword.length < 12)) {
    console.error('❌ Refusing to seed the default admin account: set a strong ADMIN_DEFAULT_PASSWORD (>= 12 characters) in production.');
    return null;
  }
  const hash = await bcrypt.hash(
    adminPassword || 'changeme',
    BCRYPT_ROUNDS
  );
  const admin = {
    id: 'ADM-MSOP6VG6BVL4',
    awid: 'ADM-GEN-AW000001',
    name: 'Admin',
    email: 'austwise59@gmail.com',
    password: hash,
    role: 'admin',
    department: 'Admin Department',
    designation: 'Administrator',
    company: 'Ahsanullah University of Science and Technology',
    batch: '',
    batchNo: '',
    batchName: '',
    yearSemester: '',
    section: '',
    labSection: '',
    semester: 1,
    graduationYear: '',
    avatar: null,
    openForTalk: false,
    linkedSocial: {},
    linkedAccounts: [],
    cgpa: 0,
    attendancePct: null,
    privacy: {
      showCgpa: true,
      showAttendance: false,
    },
    creditsCompleted: 0,
    totalCredits: 160,
    bloodGroup: '',
    facebook: '',
    whatsapp: '',
    linkedin: '',
    discord: '',
    createdAt: new Date().toISOString(),
  };
  await persistUser(admin);
  console.log('✅ Default admin account seeded (austwise59@gmail.com)');
  return admin;
}

/**
 * Deterministic pseudo-random value from a seed (no Math.random — the seed is
 * re-runnable and produces identical data every time).
 */
function seeded(seed) {
  let x = Math.abs(seed) % 2147483647;
  if (x <= 0) x += 2147483646;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

function isDevUser(u) {
  return !!(
    u &&
    ((u.id && String(u.id).startsWith('DEV-')) ||
      (u.email && String(u.email).toLowerCase().startsWith('dev-')))
  );
}

/**
 * Number of CR slots in the current section × lab-group matrix —
 * one slot per (dept × semester × section × lab group), derived from the same
 * dev config that seeds users, so it tracks section additions (3 → 4 sections)
 * automatically instead of holding a hardcoded total.
 */
export async function countCrSlots() {
  const cfg = await readDevConfig();
  const semCount = cfg.semesters.length || 8;
  const deptCount = cfg.departments.length || DEPARTMENTS.length;
  let sum = 0;
  for (const section of cfg.sections) {
    const labs = cfg.labGroups.filter((lab) => String(lab).toUpperCase().startsWith(String(section).toUpperCase()));
    sum += labs.length;
  }
  return deptCount * semCount * sum;
}

/** Load the dev-user generation config from dev/devUsers.json (with defaults). */
async function readDevConfig() {
  const defaults = {
    departments: DEPARTMENTS,
    semesters: [1, 2, 3, 4, 5, 6, 7, 8],
    sections: SECTIONS,
    labGroups: LAB_GROUPS,
    studentsPerCombo: 5,
    namePool: NAME_POOL,
  };
  try {
    const raw = await readFile(path.join(__dirname, '..', 'dev', 'devUsers.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    const cfg = Array.isArray(parsed) ? parsed[0] : parsed;
    return {
      departments: Array.isArray(cfg.departments) && cfg.departments.length ? cfg.departments : defaults.departments,
      semesters: Array.isArray(cfg.semesters) && cfg.semesters.length ? cfg.semesters : defaults.semesters,
      sections: Array.isArray(cfg.sections) && cfg.sections.length ? cfg.sections : defaults.sections,
      labGroups: Array.isArray(cfg.labGroups) && cfg.labGroups.length ? cfg.labGroups : defaults.labGroups,
      studentsPerCombo: Number(cfg.studentsPerCombo) > 0 ? Number(cfg.studentsPerCombo) : defaults.studentsPerCombo,
      namePool: Array.isArray(cfg.namePool) && cfg.namePool.length ? cfg.namePool : defaults.namePool,
    };
  } catch {
    return defaults;
  }
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const DESIGNATIONS = ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer'];

/**
 * Seed a full org-matrix of realistic dev users, configurable via
 * dev/devUsers.json:
 *
 *   every department × every semester × every section × every lab group
 *   gets `studentsPerCombo` students (1 CR per lab group, 1 SR per section),
 *   plus faculty + alumni + senior + moderator accounts per department.
 *
 * Re-runs REPLACE the previous dev users (id `DEV-*` / email `dev-*@…`) so the
 * matrix is always deterministic — real users are never touched. All dev
 * accounts share the password `Dev@123456` so the dev switch button can log in
 * as any of them.
 */
export async function seedDevUsers() {
  const cfg = await readDevConfig();
  const hash = await hashPassword(DEV_PASSWORD);
  const now = new Date().toISOString();

  const users = await readUsers();
  const realUsers = users.filter((u) => !isDevUser(u));
  const devUsers = [];
  const seenEmails = new Set(realUsers.map((u) => String(u.email || '').toLowerCase()));

  let awidCounter = 1;
  const nextAwid = (dept) => {
    const d = String(dept || 'GEN').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'GEN';
    const num = String(awidCounter++).padStart(6, '0');
    return `DEV-${d}-AW${num}`;
  };

  const pushUser = (user) => {
    devUsers.push(user);
    seenEmails.add(String(user.email).toLowerCase());
  };

  const labsForSection = (section) =>
    cfg.labGroups.filter((lab) => String(lab).toUpperCase().startsWith(String(section).toUpperCase()));

  const deptUsers = new Map(); // dept -> [] (for faculty/alumni/senior lookup)

  for (const dept of cfg.departments) {
    const deptKey = String(dept).toUpperCase();
    deptUsers.set(deptKey, []);

    for (const sem of cfg.semesters) {
      const year = Math.ceil(Number(sem) / 2);
      const term = ((Number(sem) - 1) % 2) + 1;
      const yearSemester = `Year ${year} - Semester ${term}`;
      const batchNo = String(2027 - year);
      const batchName = `${batchNo} Batch`;
      const graduationYear = String(Number(batchNo) + 4);

      for (const section of cfg.sections) {
        const secKey = String(section).toUpperCase();
        const labs = labsForSection(secKey);

        for (const lab of labs) {
          const labKey = String(lab).toUpperCase();
          for (let n = 1; n <= cfg.studentsPerCombo; n += 1) {
            const nn = String(n).padStart(2, '0');
            const rand = seeded((deptKey + sem + secKey + labKey + n).split('').reduce((a, c) => a + c.charCodeAt(0), 0));
            const first = cfg.namePool[(n - 1) % cfg.namePool.length];
            const isCr = n === 1;
            const role = isCr ? 'cr' : 'student';
            const email = `dev-${deptKey.toLowerCase()}-s${sem}-${secKey.toLowerCase()}${labKey.toLowerCase()}-${n}@aust.edu`;
            if (seenEmails.has(email)) continue;

            const user = {
              id: `DEV-${deptKey}-S${sem}-${secKey}${labKey}-${nn}`,
              awid: nextAwid(deptKey),
              email,
              name: `${first} ${deptKey} ${secKey}${labKey} ${nn}`,
              password: hash,
              role,
              department: deptKey,
              batch: `${batchNo}-${deptKey}`,
              batchNo,
              batchName,
              designation: '',
              company: 'AUST',
              graduationYear,
              yearSemester,
              section: secKey,
              labSection: labKey,
              semester: Number(sem),
              avatar: null,
              openForTalk: n % 3 === 0,
              linkedSocial: n % 4 === 0 ? { facebook: 'dev' } : {},
              linkedAccounts: [],
              cgpa: isCr ? 3.2 + rand() * 0.6 : 2.4 + rand() * 1.5,
              attendancePct: Math.round(58 + rand() * 40),
              privacy: { showCgpa: n % 4 !== 0, showAttendance: n % 5 === 0 },
              creditsCompleted: (Number(sem) - 1) * 20 + (n % 3) * 4,
              totalCredits: 160,
              bloodGroup: BLOOD_GROUPS[(n + deptKey.length) % BLOOD_GROUPS.length],
              facebook: n % 3 === 0 ? `https://facebook.com/${deptKey.toLowerCase()}.${secKey.toLowerCase()}${labKey.toLowerCase()}.${nn}` : '',
              whatsapp: n % 2 === 0 ? `+8801${String(6000000000 + ((n * 7919) % 100000000)).slice(0, 9)}` : '',
              linkedin: n % 4 === 0 ? `https://linkedin.com/in/${first.toLowerCase()}-${deptKey.toLowerCase()}-${nn}` : '',
              discord: '',
              createdAt: now,
            };
            pushUser(user);
            deptUsers.get(deptKey).push(user);
          }
        }

        // Section Representative — one per section.
        const srEmail = `dev-${deptKey.toLowerCase()}-s${sem}-s${secKey.toLowerCase()}-sr@aust.edu`;
        if (!seenEmails.has(srEmail)) {
          const rand = seeded((deptKey + sem + secKey + 'SR').split('').reduce((a, c) => a + c.charCodeAt(0), 0));
          const user = {
            id: `DEV-${deptKey}-S${sem}-${secKey}-SR`,
            awid: nextAwid(deptKey),
            email: srEmail,
            name: `Section Rep ${deptKey} ${yearSemester} Sec ${secKey}`,
            password: hash,
            role: 'sr',
            department: deptKey,
            batch: `${batchNo}-${deptKey}`,
            batchNo,
            batchName,
            designation: '',
            company: 'AUST',
            graduationYear,
            yearSemester,
            section: secKey,
            labSection: '',
            semester: Number(sem),
            avatar: null,
            openForTalk: true,
            linkedSocial: {},
            linkedAccounts: [],
            cgpa: 3.0 + rand() * 0.7,
            attendancePct: Math.round(70 + rand() * 25),
            privacy: { showCgpa: true, showAttendance: true },
            creditsCompleted: (Number(sem) - 1) * 20,
            totalCredits: 160,
            bloodGroup: BLOOD_GROUPS[(sem + secKey.length) % BLOOD_GROUPS.length],
            facebook: '',
            whatsapp: `+8801${String(6000000000 + ((sem * 7919) % 100000000)).slice(0, 9)}`,
            linkedin: '',
            discord: '',
            createdAt: now,
          };
          pushUser(user);
        }
      }
    }

    // Faculty per department (covers the `faculty` role + department visibility).
    const facEmail = `dev-faculty-${deptKey.toLowerCase()}@aust.edu`;
    if (!seenEmails.has(facEmail)) {
      const user = {
        id: `DEV-${deptKey}-FAC`,
        awid: nextAwid(deptKey),
        email: facEmail,
        name: `Dr. ${deptKey} Faculty`,
        password: hash,
        role: 'faculty',
        department: deptKey,
        batch: '',
        batchNo: '',
        batchName: '',
        designation: DESIGNATIONS[deptKey.length % DESIGNATIONS.length],
        company: 'Ahsanullah University of Science and Technology',
        graduationYear: '',
        yearSemester: '',
        section: '',
        labSection: '',
        semester: 1,
        avatar: null,
        openForTalk: false,
        linkedSocial: {},
        linkedAccounts: [],
        cgpa: 0,
        attendancePct: null,
        privacy: { showCgpa: true, showAttendance: false },
        creditsCompleted: 0,
        totalCredits: 0,
        bloodGroup: '',
        facebook: '',
        whatsapp: '',
        linkedin: `https://linkedin.com/in/${deptKey.toLowerCase()}-faculty`,
        discord: '',
        createdAt: now,
      };
      pushUser(user);
    }

    // Alumni per department.
    const aluEmail = `dev-alumni-${deptKey.toLowerCase()}@aust.edu`;
    if (!seenEmails.has(aluEmail)) {
      const user = {
        id: `DEV-${deptKey}-ALU`,
        awid: nextAwid(deptKey),
        email: aluEmail,
        name: `${deptKey} Alumni Rep`,
        password: hash,
        role: 'alumni',
        department: deptKey,
        batch: `2020-${deptKey}`,
        batchNo: '2020',
        batchName: '2020 Batch',
        designation: '',
        company: 'Software Engineer',
        graduationYear: '2024',
        yearSemester: '',
        section: '',
        labSection: '',
        semester: 8,
        avatar: null,
        openForTalk: true,
        linkedSocial: {},
        linkedAccounts: [],
        cgpa: 3.1,
        attendancePct: null,
        privacy: { showCgpa: true, showAttendance: false },
        creditsCompleted: 160,
        totalCredits: 160,
        bloodGroup: '',
        facebook: '',
        whatsapp: '',
        linkedin: `https://linkedin.com/in/${deptKey.toLowerCase()}-alumni`,
        discord: '',
        createdAt: now,
      };
      pushUser(user);
    }

    // Senior (student body representative) per department.
    const snrEmail = `dev-senior-${deptKey.toLowerCase()}@aust.edu`;
    if (!seenEmails.has(snrEmail)) {
      const user = {
        id: `DEV-${deptKey}-SENIOR`,
        awid: nextAwid(deptKey),
        email: snrEmail,
        name: `${deptKey} Senior Rep`,
        password: hash,
        role: 'senior',
        department: deptKey,
        batch: `2024-${deptKey}`,
        batchNo: '2024',
        batchName: '2024 Batch',
        designation: '',
        company: 'AUST',
        graduationYear: '2028',
        yearSemester: 'Year 4 - Semester 1',
        section: '',
        labSection: '',
        semester: 7,
        avatar: null,
        openForTalk: true,
        linkedSocial: {},
        linkedAccounts: [],
        cgpa: 3.4,
        attendancePct: 88,
        privacy: { showCgpa: true, showAttendance: false },
        creditsCompleted: 140,
        totalCredits: 160,
        bloodGroup: '',
        facebook: '',
        whatsapp: '',
        linkedin: '',
        discord: '',
        createdAt: now,
      };
      pushUser(user);
    }
  }

  // Global moderator — can manage role applications etc.
  if (!seenEmails.has('dev-moderator@aust.edu')) {
    devUsers.push({
      id: 'DEV-MOD-01',
      awid: nextAwid('GEN'),
      email: 'dev-moderator@aust.edu',
      name: 'Dev Moderator',
      password: hash,
      role: 'moderator',
      department: 'CSE',
      batch: '',
      batchNo: '',
      batchName: '',
      designation: 'Moderator',
      company: 'AUST',
      graduationYear: '',
      yearSemester: '',
      section: '',
      labSection: '',
      semester: 1,
      avatar: null,
      openForTalk: false,
      linkedSocial: {},
      linkedAccounts: [],
      cgpa: 0,
      attendancePct: null,
      privacy: { showCgpa: true, showAttendance: false },
      creditsCompleted: 0,
      totalCredits: 160,
      bloodGroup: '',
      facebook: '',
      whatsapp: '',
      linkedin: '',
      discord: '',
      createdAt: now,
    });
  }

  await writeUsers([...realUsers, ...devUsers]);
  return { created: devUsers.length, skipped: 0, total: realUsers.length + devUsers.length };
}

/** Dev users only (id `DEV-*`) — used by the dev switch button fixture. */
export async function getDevUsers() {
  const users = await readUsers();
  return users.filter((u) => u.id && String(u.id).startsWith('DEV-')).map(({ _password, ...safe }) => safe);
}

/** Permanently remove dev-seeded accounts from PostgreSQL and the JSON mirror. */
export async function removeDevSeededUsers() {
  let deletedCount = 0;
  const isSeededDemoUser = (user) =>
    /^DEV-|^ALU-DEMO-/i.test(String(user?.id || '')) ||
    /^QA(?:\s|$)/i.test(String(user?.name || '').trim()) ||
    /^qa-[\w-]*@/i.test(String(user?.email || '').trim());

  if (await isDbAvailable()) {
    await ensureAuthTables();
    const dbUsers = await readUsers();
    const extraDemoIds = dbUsers
      .filter((user) => isSeededDemoUser(user) && !/^DEV-|^ALU-DEMO-/i.test(String(user.id || '')))
      .map((user) => user.id);
    const deletedRows = await query(`DELETE FROM "AuthUsers" WHERE id LIKE 'DEV-%' OR id LIKE 'ALU-DEMO-%' RETURNING id`);
    deletedCount = deletedRows.length;
    for (const id of extraDemoIds) {
      const rows = await query('DELETE FROM "AuthUsers" WHERE id = @id RETURNING id', [
        { name: 'id', type: sql.NVarChar(50), value: id },
      ]);
      deletedCount += rows.length;
    }
  }

  if (existsSync(DB_PATH)) {
    const users = await readJsonUsers();
    const keptUsers = users.filter((user) => !isSeededDemoUser(user));
    deletedCount = Math.max(deletedCount, users.length - keptUsers.length);
    if (keptUsers.length !== users.length) {
      await writeFile(DB_PATH, JSON.stringify(keptUsers, null, 2));
    }
  }

  return deletedCount;
}

/** Hash password with bcrypt */
export function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** Compare plain password against hash */
export function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function isValidAustEmail(email) {
  const normalized = email.toLowerCase().trim();
  // Anchor the domain so `evil@aust.edu.attacker.com` is rejected. Matches
  // `@aust.edu` and subdomains like `@www.aust.edu`.
  return /^[^@\s]+@(?:[a-z0-9-]+\.)*aust\.edu$/.test(normalized);
}

/** Create a new user (self-registration) */
export async function createUser(payload, { invitationAuthorized = false, passwordHash = '' } = {}) {
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  // The server is the sole role authority. Students require AUST addresses;
  // personal-email Faculty and Alumni accounts require admin approval.
  const requestedRole = String(payload.role || 'student').toLowerCase().trim();
  const allowedRoles = invitationAuthorized
    ? ['faculty', 'alumni']
    : ['student', 'faculty', 'alumni'];
  if (!allowedRoles.includes(requestedRole)) {
    throw new Error(invitationAuthorized
      ? 'This invitation is not valid for that account role.'
      : 'Choose Student, Faculty, or Alumni. Personal-email Faculty and Alumni accounts require admin approval.');
  }
  const role = requestedRole;
  const department = String(payload.department || '').trim();
  let batchName = String(payload.batchName || '').trim();
  let batchNo = String(payload.batchNo || '').trim();
  if (['student', 'alumni'].includes(role)) {
    const batchInput = String(payload.batch || `${batchName} ${batchNo}`).trim();
    const match = batchInput.match(/^([A-Za-z]+)\s+(\d+)$/);
    if (!match) throw new Error('Enter the batch as one word followed by its number, for example: Batch 45.');
    if ((batchName && batchName.toLowerCase() !== match[1].toLowerCase()) || (batchNo && batchNo !== match[2])) {
      throw new Error('Batch name and batch number must match the format you entered.');
    }
    batchName = match[1];
    batchNo = match[2];
  }

  if (!name) throw new Error('Full name is required.');
  if (!email || !email.includes('@')) throw new Error('Enter a valid email address.');
  if (role === 'student' && !isValidAustEmail(email)) {
    throw new Error('Student accounts require an @aust.edu email address.');
  }
  if (['faculty', 'alumni'].includes(role) && !isValidAustEmail(email) && !email.endsWith('@gmail.com')) {
    throw new Error('Use your @aust.edu address or a personal Gmail address.');
  }
  if (!passwordHash && password.length < 8) throw new Error('Password must be at least 8 characters.');
  if (passwordHash && !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(passwordHash)) throw new Error('Invalid stored password hash.');
  if (['student', 'faculty', 'alumni'].includes(role) && !FACULTY_DEPARTMENTS.includes(department.toUpperCase())) {
    throw new Error('Choose a valid department before creating your account.');
  }

  const users = await readUsers();
  if (users.find(u => u.email === email)) {
    throw new Error('An account with this email already exists.');
  }

  if (['student', 'alumni'].includes(role) && !String(payload.batchNo || payload.batch || '').trim()) {
    throw new Error('Batch is required for student and alumni accounts.');
  }
  if (role === 'faculty' && !String(payload.designation || '').trim()) {
    throw new Error('Designation is required for faculty accounts.');
  }

  const hash = passwordHash || await hashPassword(password);
  const rnd = Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  const prefix = { student: 'STU', faculty: 'FAC', alumni: 'ALU', admin: 'ADM', cr: 'CR', sr: 'SR', senior: 'SNR', moderator: 'MOD', bus_coordinator: 'BUS', guest: 'GST', clubs_representative: 'CLB', help_desk: 'HLP', banned: 'BAN' }[role] || 'USR';
  const id = `${prefix}-${rnd}`;
  const awid = generateAwid(users, role, department || 'GEN');

  // Canonical year-semester + its semester number (e.g. "Year 3 - Semester 1" → 5).
  const yearSemester = toYearSemester(payload.yearSemester) || 'Year 1 - Semester 1';
  const [yr, term] = yearSemester.match(/Year\s*(\d+)\s*-\s*Semester\s*(\d+)/).slice(1, 3).map(Number);
  const semesterNum = (yr - 1) * 2 + (term || 1);

  const user = {
    id,
    awid,
    email,
    name,
    password: hash,
    role,
    roles: role === 'faculty' ? ['faculty', facultyDepartmentRole(department)] : [role],
    status: (role === 'faculty' && !isValidAustEmail(email) && !invitationAuthorized) || (role === 'alumni' && !isValidAustEmail(email) && !invitationAuthorized) ? 'PENDING_APPROVAL' : 'ACTIVE',
    personalEmail: String(payload.personalEmail || '').trim().toLowerCase(),
    originalBatch: String(payload.originalBatch || batchNo || '').trim(),
    currentAcademicBatch: String(payload.currentAcademicBatch || batchNo || '').trim(),
    currentSemester: String(payload.currentSemester || yearSemester.match(/Year\s*(\d+)\s*-\s*Semester\s*(\d+)/i)?.slice(1).join('.') || '1.1'),
    maxSemester: String(payload.maxSemester || (department === 'ARCH' ? '5.2' : '4.2')),
    emailAccessApproved: Boolean(invitationAuthorized && role === 'faculty' && !isValidAustEmail(email)),
    department,
    batch: ['student', 'alumni'].includes(role) ? `${batchName} ${batchNo}` : String(payload.batch || batchNo || '').trim(),
    batchNo,
    batchName: batchName || String(payload.batchName || batchNo).trim(),
    designation: String(payload.designation || '').trim(),
    company: String(payload.company || '').trim(),
    graduationYear: String(payload.graduationYear || '').trim(),
    yearSemester,
    section: String(payload.section || '').trim(),
    labSection: String(payload.labSection || '').trim(),
    semester: semesterNum,
    avatar: payload.avatar || null,
    openForTalk: false,
    linkedSocial: payload.linkedSocial || {},
    linkedAccounts: [],
    cgpa: payload.cgpa ?? 0,
    attendancePct: payload.attendancePct ?? null,
    privacy: {
      showCgpa: payload.privacy?.showCgpa !== false,
      showAttendance: payload.privacy?.showAttendance === true,
    },
    creditsCompleted: 0,
    totalCredits: 160,
    bloodGroup: '',
    facebook: '',
    whatsapp: '',
    linkedin: '',
    discord: '',
    createdAt: new Date().toISOString(),
  };

  await persistUser(user);
  return user;
}

/** Validate credentials and return user (without password) if valid */
export async function validateLogin(email, password) {
  const normalized = String(email || '').trim().toLowerCase();
  const users = await readUsers();
  const user = users.find(u => u.email === normalized);
  if (!user) throw new Error('Invalid email or password.');
  if (user.status === 'PENDING_APPROVAL') throw new Error('Your account is pending admin approval.');
  // Students must use AUST addresses. Approved Faculty and Alumni may sign in
  // with the personal address used for their approved account.
  if (user.role === 'student' && !isValidAustEmail(normalized)) {
    throw new Error('Student accounts must use their @aust.edu email address.');
  }
  if (user.role === 'faculty' && !isValidAustEmail(normalized) && !user.emailAccessApproved) {
    throw new Error('Faculty accounts without an @aust.edu email need admin approval or an invitation.');
  }
  const valid = await comparePassword(password, user.password);
  if (!valid) throw new Error('Invalid email or password.');
  const { password: _, ...safe } = user;
  return safe;
}

/** Get user by ID (without password hash) */
export async function getUserById(id) {
  const users = await readUsers();
  const user = users.find(u => u.id === id);
  if (!user) return null;
  const { password: _, ...safe } = user;
  return safe;
}

/** Get a user by email (without password hash) */
export async function getUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const users = await readUsers();
  const user = users.find(u => u.email === normalized);
  if (!user) return null;
  const { password: _, ...safe } = user;
  return safe;
}

/**
 * Find-or-create a user from a verified Google profile.
 * Google accounts never use a real password, so a random one is hashed in.
 * New accounts remain incomplete until role/department/batch details are
 * provided in signup step 2; no AWID is assigned before that information.
 */
export async function findOrCreateGoogleUser(profile) {
  const email = String(profile.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('Google account has no email address.');
  const name = String(profile.name || '').trim() || email.split('@')[0];
  const picture = profile.picture || null;

  const existing = await getUserByEmail(email);
  if (existing) {
    // Re-login — refresh avatar / social link if they changed.
    const patch = {};
    if (picture && existing.avatar !== picture) patch.avatar = picture;
    if (!existing.linkedSocial || !existing.linkedSocial.gmail) {
      patch.linkedSocial = { ...(existing.linkedSocial || {}), gmail: email };
    }
    if (Object.keys(patch).length) await updateUserProfile(existing.id, patch);
    return { user: await getUserByEmail(email), created: false };
  }

  // New registrations — only @aust.edu university emails are allowed.
  if (!isValidAustEmail(email)) {
    throw new Error('Only AUST university email addresses (@aust.edu) are allowed for registration.');
  }

  const users = await readUsers();
  const passwordHash = await hashPassword(randomUUID());
  const rnd = Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  const id = `STU-${rnd}`;

  const user = {
    id,
    awid: '',
    email,
    name,
    password: passwordHash,
    role: 'student',
    department: '',
    signupIncomplete: true,
    batch: '',
    batchNo: '',
    batchName: '',
    designation: '',
    company: '',
    graduationYear: '',
    yearSemester: toYearSemester('1.1') || 'Year 1 - Semester 1',
    section: '',
    labSection: '',
    semester: 1,
    avatar: picture,
    openForTalk: false,
    linkedSocial: { gmail: email },
    linkedAccounts: [],
    cgpa: 0,
    attendancePct: null,
    privacy: { showCgpa: true, showAttendance: false },
    creditsCompleted: 0,
    totalCredits: 160,
    bloodGroup: '',
    facebook: '',
    whatsapp: '',
    linkedin: '',
    discord: '',
    createdAt: new Date().toISOString(),
  };

  await persistUser(user);
  const { password: _, ...safe } = user;
  return { user: safe, created: true };
}

/** Get all users (for admin views — without password hashes) */
export async function getAllUsersSafe() {
  const users = await readUsers();
  return users.map(({ password: _, ...safe }) => safe);
}

/** Fast count of registered users — uses SQL COUNT(*) when available. */
export async function countUsers() {
  if (await isDbAvailable()) {
    try {
      const rows = await query('SELECT COUNT(*)::int AS cnt FROM "AuthUsers"');
      return rows?.[0]?.cnt ?? 0;
    } catch { /* fall through to JSON */ }
  }
  const users = await readUsers();
  return users.length;
}

// Profile rows are stored as one JSON object. Serialize partial updates per
// user so two near-simultaneous saves cannot write stale snapshots over fields
// such as labSection.
const userProfileUpdateQueues = new Map();

/** Update a user profile. Role changes require opts.allowRole (admin-only paths). */
export function updateUserProfile(id, patch, opts = {}) {
  const previous = userProfileUpdateQueues.get(id) || Promise.resolve();
  const update = previous.catch(() => {}).then(async () => {
    const current = await readRawUser(id);
    if (!current) return null;
    const next = { ...patch };
    if (next.role !== undefined && !opts.allowRole) {
      // Defense-in-depth: only admin-role paths may change a user's role.
      delete next.role;
    }
    const academicSlotChanged = ['department', 'yearSemester', 'section']
      .some((field) => field in next && String(next[field] || '') !== String(current[field] || ''));
    if (academicSlotChanged && !('labSection' in next)) {
      // A lab group belongs to a specific academic slot. Changing that slot
      // clears the old group so the user can choose the correct one again.
      next.labSection = '';
    } else if (next.labSection === '' && current.labSection && !academicSlotChanged) {
      // Ignore accidental blank profile payloads. An assigned group remains
      // attached to the account until a different group is explicitly saved.
      delete next.labSection;
    }
    const merged = { ...current, ...next };
    if (opts.regenerateAwid) {
      const users = await readUsers();
      merged.awid = generateAwid(users.filter((user) => user.id !== current.id), merged.role, merged.department);
      merged.roles = [...new Set([merged.role, ...(merged.role === 'faculty' ? [facultyDepartmentRole(merged.department)] : [])])];
      merged.signupIncomplete = false;
    }
    // Don't allow password overwrite via this method
    if (next.password) {
      merged.password = await hashPassword(next.password);
    }
    await persistUser(merged);
    const { password: _, ...safe } = merged;
    return safe;
  });
  userProfileUpdateQueues.set(id, update);
  return update.finally(() => {
    if (userProfileUpdateQueues.get(id) === update) userProfileUpdateQueues.delete(id);
  });
}

/** Set a password hash produced by this server for an approved access request. */
export async function setUserPasswordHash(id, passwordHash) {
  if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(String(passwordHash || ''))) {
    throw new Error('Invalid stored password hash.');
  }
  const current = await readRawUser(id);
  if (!current) return null;
  const merged = { ...current, password: passwordHash };
  await persistUser(merged);
  const { password: _, ...safe } = merged;
  return safe;
}

/** Delete a user */
export async function deleteUserById(id) {
  const current = await readRawUser(id);
  if (!current) return false;
  await removePersistedUser(id);
  return true;
}

// Seed admin and backfill AWIDs on first import
seedDefaultAdmin().catch(() => {});
ensureAllAwids().catch(() => {});
