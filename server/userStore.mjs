/**
 * PostgreSQL-backed user store compatibility layer.
 * Public function names are kept stable for the auth routes.
 */

import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import {
  prisma,
  findUserByEmail,
  findUserById,
  createUserRecord,
  updateUserRecord,
  deleteUserRecord,
} from './prisma.js';

const BCRYPT_ROUNDS = 10;
const ALLOWED_DOMAINS = ['aust.edu', 'www.aust.edu'];
const VALID_ROLES = ['student', 'faculty', 'alumni', 'admin', 'cr', 'sr', 'senior', 'moderator'];

function isValidAustEmail(email) {
  const normalized = email.toLowerCase().trim();
  return ALLOWED_DOMAINS.some(domain => normalized.endsWith(`@${domain}`));
}

function makeUserId(role) {
  const prefix = {
    student: 'STU', faculty: 'FAC', alumni: 'ALU', admin: 'ADM',
    cr: 'CR', sr: 'SR', senior: 'SNR', moderator: 'MOD',
  }[role] || 'USR';
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

function safeUser(user) {
  if (!user) return null;
  const { passwordHash: _passwordHash, password: _password, linkedSocial, linkedAccounts, ...safe } = user;
  return {
    ...safe,
    linkedSocial: typeof linkedSocial === 'string' ? parseJson(linkedSocial, {}) : (linkedSocial || {}),
    linkedAccounts: typeof linkedAccounts === 'string' ? parseJson(linkedAccounts, []) : (linkedAccounts || []),
  };
}

function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function normalizeUserData(data) {
  return {
    id: data.id,
    awid: data.awid,
    email: data.email,
    name: data.name,
    passwordHash: data.passwordHash,
    role: data.role,
    department: data.department || '',
    batch: data.batch || '',
    batchNo: data.batchNo || '',
    batchName: data.batchName || '',
    designation: data.designation || '',
    company: data.company || '',
    graduationYear: data.graduationYear || '',
    yearSemester: data.yearSemester || '',
    section: data.section || '',
    labSection: data.labSection || '',
    semester: Number(data.semester) || 1,
    avatar: data.avatar || null,
    openForTalk: Boolean(data.openForTalk),
    bloodGroup: data.bloodGroup || '',
    facebook: data.facebook || '',
    whatsapp: data.whatsapp || '',
    linkedin: data.linkedin || '',
    discord: data.discord || '',
    linkedSocial: typeof data.linkedSocial === 'string' ? data.linkedSocial : JSON.stringify(data.linkedSocial || {}),
    linkedAccounts: typeof data.linkedAccounts === 'string' ? data.linkedAccounts : JSON.stringify(data.linkedAccounts || []),
    cgpa: Number(data.cgpa) || 0,
    creditsCompleted: Number(data.creditsCompleted) || 0,
    totalCredits: Number(data.totalCredits) || 160,
  };
}

async function buildUser(payload, { invited = false } = {}) {
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const role = VALID_ROLES.includes(payload.role) ? payload.role : 'student';
  const department = String(payload.department || '').trim();
  const batchNo = String(payload.batchNo || '').trim();
  const batch = String(payload.batch || batchNo).trim();

  if (!name) throw new Error('Full name is required.');
  if (!email || !email.includes('@')) throw new Error('Enter a valid email address.');
  if (!invited && role !== 'alumni' && !isValidAustEmail(email)) {
    throw new Error('Only AUST university email addresses (@aust.edu) are allowed for registration.');
  }
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');
  if (!invited && !department) throw new Error('Department is required.');
  if (!invited && (role === 'student' || role === 'alumni') && !batch) {
    throw new Error('Batch is required for students and alumni.');
  }
  if (!invited && role === 'faculty' && !String(payload.designation || '').trim()) {
    throw new Error('Designation is required for faculty accounts.');
  }

  const existing = await findUserByEmail(email);
  if (existing) throw new Error('An account with this email already exists.');

  const yearSemester = String(payload.yearSemester || (invited ? '' : '1.1'));
  const [year, term] = yearSemester.split('.').map(Number);
  const semester = Number.isFinite(year) && Number.isFinite(term) && year > 0 && term > 0
    ? (year - 1) * 2 + term
    : 1;

  return normalizeUserData({
    id: payload.id || makeUserId(role),
    awid: payload.awid || email.split('@')[0] || makeUserId(role),
    email,
    name,
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    role,
    department,
    batch,
    batchNo,
    batchName: String(payload.batchName || batch).trim(),
    designation: String(payload.designation || (invited ? 'Invited member' : '')).trim(),
    company: String(payload.company || '').trim(),
    graduationYear: String(payload.graduationYear || '').trim(),
    yearSemester,
    section: String(payload.section || '').trim(),
    labSection: String(payload.labSection || '').trim(),
    semester,
    avatar: payload.avatar || null,
    openForTalk: false,
    bloodGroup: String(payload.bloodGroup || '').trim(),
    facebook: '',
    whatsapp: '',
    linkedin: '',
    discord: '',
    linkedSocial: payload.linkedSocial || {},
    linkedAccounts: [],
    cgpa: 0,
    creditsCompleted: 0,
    totalCredits: 160,
  });
}

/** Seed a default admin account after the database schema exists. */
export async function seedDefaultAdmin() {
  const existing = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (existing) return null;

  const password = process.env.ADMIN_DEFAULT_PASSWORD || (process.env.NODE_ENV === 'production' ? null : 'changeme');
  if (!password) throw new Error('ADMIN_DEFAULT_PASSWORD must be set in production before seeding the admin account.');
  const admin = await buildUser({
    id: 'ADM-001',
    awid: 'admin',
    name: 'Prof. Dr. Md. Abdur Rahim',
    email: 'admin@aust.edu',
    password,
    role: 'admin',
    department: 'Admin Department',
    designation: 'Registrar',
  }, { invited: true });

  const created = await createUserRecord(admin);
  console.log('✅ Default admin account seeded (admin@aust.edu)');
  return safeUser(created);
}

export function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export async function createUser(payload) {
  const user = await buildUser(payload);
  return safeUser(await createUserRecord(user));
}

export async function createInvitedUser(payload) {
  const user = await buildUser(payload, { invited: true });
  return safeUser(await createUserRecord(user));
}

export async function validateLogin(email, password) {
  const user = await findUserByEmail(email);
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    throw new Error('Invalid email or password.');
  }
  return safeUser(user);
}

export async function getUserById(id) {
  return safeUser(await findUserById(id));
}

export async function getAllUsersSafe() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  return users.map(safeUser);
}

export async function updateUserProfile(id, patch) {
  const data = { ...patch };
  delete data.id;
  delete data.email;
  delete data.password;
  if (data.linkedSocial && typeof data.linkedSocial !== 'string') data.linkedSocial = JSON.stringify(data.linkedSocial);
  if (data.linkedAccounts && typeof data.linkedAccounts !== 'string') data.linkedAccounts = JSON.stringify(data.linkedAccounts);
  if (patch.password) data.passwordHash = await hashPassword(patch.password);
  return safeUser(await updateUserRecord(id, data));
}

export async function deleteUserById(id) {
  return deleteUserRecord(id);
}
