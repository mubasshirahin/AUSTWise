/**
 * File-based user store — replaces client-side localStorage auth.
 * Passwords are hashed with bcrypt. Users persist in server/users.json.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'users.json');
const BCRYPT_ROUNDS = 10;

const ALLOWED_DOMAINS = ['aust.edu', 'www.aust.edu'];
const VALID_ROLES = ['student', 'faculty', 'alumni', 'admin', 'cr', 'sr', 'senior', 'moderator'];
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
  try {
    if (!existsSync(DB_PATH)) return [];
    const raw = await readFile(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch { return []; }
}

async function writeUsers(users) {
  await writeFile(DB_PATH, JSON.stringify(users, null, 2));
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
function generateAwid(users, department) {
  const dept = String(department || 'GEN').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'GEN';
  const existing = users.filter((u) => u.awid && u.awid.includes(`-${dept}-AW`));
  const maxNum = existing.reduce((max, u) => {
    const match = String(u.awid).match(/AW(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  const nextNum = String(maxNum + 1).padStart(6, '0');
  return `STU-${dept}-AW${nextNum}`;
}

/**
 * Backfill AWIDs for users created before AWID generation existed, so
 * every account ends up with a unique app ID distinct from the student ID.
 */
export async function ensureAllAwids() {
  const users = await readUsers();
  let changed = false;
  for (const user of users) {
    if (!user.awid) {
      user.awid = generateAwid(users, user.department);
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
  const hash = await bcrypt.hash(
    process.env.ADMIN_DEFAULT_PASSWORD || 'changeme',
    BCRYPT_ROUNDS
  );
  const admin = {
    id: 'ADM-MSOP6VG6BVL4',
    awid: 'STU-ADM-AW000001',
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
  users.push(admin);
  await writeUsers(users);
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
  return users.filter((u) => u.id && String(u.id).startsWith('DEV-')).map(({ password, ...safe }) => safe);
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
  return ALLOWED_DOMAINS.some(d => normalized.endsWith(`@${d}`) || normalized.endsWith(`@www.${d}`));
}

function generateId(role) {
  const prefix = {
    student: 'STU', faculty: 'FAC', alumni: 'ALU', admin: 'ADM',
    cr: 'CR', sr: 'SR', senior: 'SNR', moderator: 'MOD',
  }[role] || 'USR';
  const crypto = await_import_crypto();
  // Synchronous random — use Date.now + Math.random for simplicity
  const rnd = Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${rnd}`;
}

// We import crypto lazily
let _crypto;
function await_import_crypto() {
  // handled below
}

/** Create a new user */
export async function createUser(payload) {
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const role = VALID_ROLES.includes(payload.role) ? payload.role : 'student';
  const department = String(payload.department || '').trim();

  if (!name) throw new Error('Full name is required.');
  if (!email || !email.includes('@')) throw new Error('Enter a valid email address.');
  if (!isValidAustEmail(email)) {
    throw new Error('Only AUST university email addresses (@aust.edu) are allowed for registration.');
  }
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');
  if (!department) throw new Error('Department is required.');

  const users = await readUsers();
  if (users.find(u => u.email === email)) {
    throw new Error('An account with this email already exists.');
  }

  if ((role === 'student' || role === 'alumni') && !String(payload.batchNo || payload.batch || '').trim()) {
    throw new Error('Batch is required for students and alumni.');
  }
  if (role === 'faculty' && !String(payload.designation || '').trim()) {
    throw new Error('Designation is required for faculty accounts.');
  }

  const hash = await hashPassword(password);
  const batchNo = String(payload.batchNo || '').trim();
  const rnd = Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  const prefix = { student: 'STU', faculty: 'FAC', alumni: 'ALU', admin: 'ADM', cr: 'CR', sr: 'SR', senior: 'SNR', moderator: 'MOD' }[role] || 'USR';
  const id = `${prefix}-${rnd}`;
  const awid = generateAwid(users, department);

  // Extract student ID from email prefix
  const emailPrefix = email.split('@')[0] || '';

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
    department,
    batch: String(payload.batch || batchNo || '').trim(),
    batchNo,
    batchName: String(payload.batchName || batchNo).trim(),
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

  users.push(user);
  await writeUsers(users);
  return user;
}

/** Validate credentials and return user (without password) if valid */
export async function validateLogin(email, password) {
  const normalized = String(email || '').trim().toLowerCase();
  const users = await readUsers();
  const user = users.find(u => u.email === normalized);
  if (!user) throw new Error('Invalid email or password.');
  // Only @aust.edu accounts may sign in — admins (e.g. the site owner) are the
  // single exception, so a non-AUST admin gmail keeps working.
  if (user.role !== 'admin' && !isValidAustEmail(normalized)) {
    throw new Error('Only AUST university email addresses (@aust.edu) are allowed to sign in.');
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
 * New accounts start as 'student' with an 'Undeclared' department until the
 * client completes role/department/batch details in signup step 2.
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
  const awid = generateAwid(users, 'Undeclared');

  const user = {
    id,
    awid,
    email,
    name,
    password: passwordHash,
    role: 'student',
    department: 'Undeclared',
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

  users.push(user);
  await writeUsers(users);
  const { password: _, ...safe } = user;
  return { user: safe, created: true };
}

/** Get all users (for admin views — without password hashes) */
export async function getAllUsersSafe() {
  const users = await readUsers();
  return users.map(({ password: _, ...safe }) => safe);
}

/** Update a user profile */
export async function updateUserProfile(id, patch) {
  const users = await readUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...patch };
  // Don't allow password overwrite via this method
  if (patch.password) {
    users[idx].password = await hashPassword(patch.password);
  }
  await writeUsers(users);
  const { password: _, ...safe } = users[idx];
  return safe;
}

/** Delete a user */
export async function deleteUserById(id) {
  const users = await readUsers();
  const filtered = users.filter(u => u.id !== id);
  if (filtered.length === users.length) return false;
  await writeUsers(filtered);
  return true;
}

// Seed admin and backfill AWIDs on first import
seedDefaultAdmin().catch(() => {});
ensureAllAwids().catch(() => {});
