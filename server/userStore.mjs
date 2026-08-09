/**
 * File-based user store — replaces client-side localStorage auth.
 * Passwords are hashed with bcrypt. Users persist in server/users.json.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'users.json');
const BCRYPT_ROUNDS = 10;

const ALLOWED_DOMAINS = ['aust.edu', 'www.aust.edu'];
const VALID_ROLES = ['student', 'faculty', 'alumni', 'admin', 'cr', 'sr', 'senior', 'moderator'];

async function readUsers() {
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
    process.env.VITE_ADMIN_DEFAULT_PASSWORD || 'changeme',
    BCRYPT_ROUNDS
  );
  const admin = {
    id: 'ADM-001',
    name: 'Prof. Dr. Md. Abdur Rahim',
    email: 'admin@aust.edu',
    password: hash,
    role: 'admin',
    department: 'Admin Department',
    designation: 'Registrar',
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
  console.log('✅ Default admin account seeded (admin@aust.edu)');
  return admin;
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
  if (role !== 'alumni' && !isValidAustEmail(email)) {
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

  const [yr, term] = (payload.yearSemester || '1.1').split('.').map(Number);
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
    yearSemester: payload.yearSemester || '1.1',
    section: String(payload.section || '').trim(),
    labSection: String(payload.labSection || '').trim(),
    semester: semesterNum,
    avatar: payload.avatar || null,
    openForTalk: false,
    linkedSocial: payload.linkedSocial || {},
    linkedAccounts: [],
    cgpa: 0,
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
