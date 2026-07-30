/**
 * Auth endpoints — issues JWT in HttpOnly cookie so the role is never
 * client-editable. The client calls /api/auth/me to get the current user.
 */
import jwt from 'jsonwebtoken';
import {
  createUser, validateLogin, getUserById,
} from './userStore.mjs';
import { authRateLimiter } from './rateLimiter.mjs';

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.warn('⚠️  JWT_SECRET not set in .env — using insecure default. Set JWT_SECRET in production!');
  return 'aust-wise-dev-secret-change-in-production';
})();
const COOKIE_NAME = 'aust_token';
const TOKEN_EXPIRY = '7d';

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY },
  );
}

function setAuthCookie(res, token) {
  const cookie = `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`;
  res.setHeader('Set-Cookie', cookie);
}

function clearAuthCookie(res) {
  const cookie = `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
  res.setHeader('Set-Cookie', cookie);
}

/** Read JWT from cookie and return payload or null */
export function readTokenCookie(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
  if (!match) return null;
  try {
    return jwt.verify(match[1], JWT_SECRET);
  } catch {
    return null;
  }
}

async function handleSignup(req, res) {
  if (!authRateLimiter(req, res)) return;
  const body = await readJsonBody(req);
  try {
    const user = await createUser(body);
    const token = signToken(user);
    setAuthCookie(res, token);
    return sendJson(res, 201, { success: true, user: sanitizeUser(user) });
  } catch (err) {
    return sendJson(res, 400, { success: false, error: err.message });
  }
}

async function handleLogin(req, res) {
  if (!authRateLimiter(req, res)) return;
  const body = await readJsonBody(req);
  try {
    const user = await validateLogin(body.email, body.password);
    const token = signToken(user);
    setAuthCookie(res, token);
    return sendJson(res, 200, { success: true, user: sanitizeUser(user) });
  } catch (err) {
    return sendJson(res, 401, { success: false, error: err.message });
  }
}

async function handleLogout(req, res) {
  clearAuthCookie(res);
  return sendJson(res, 200, { success: true });
}

async function handleAdminCheck(req, res) {
  const payload = readTokenCookie(req);
  if (!payload || (payload.role !== 'admin' && payload.role !== 'moderator')) {
    return sendJson(res, 403, { success: false, error: 'Forbidden: admin access required' });
  }
  const user = await getUserById(payload.id);
  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    return sendJson(res, 403, { success: false, error: 'Forbidden: admin access required' });
  }
  return sendJson(res, 200, { success: true });
}

async function handleMe(req, res) {
  const payload = readTokenCookie(req);
  if (!payload) {
    return sendJson(res, 401, { success: false, error: 'Not authenticated' });
  }
  const user = await getUserById(payload.id);
  if (!user) {
    clearAuthCookie(res);
    return sendJson(res, 401, { success: false, error: 'User not found' });
  }
  return sendJson(res, 200, { success: true, user: sanitizeUser(user) });
}

/** Return user without sensitive fields */
function sanitizeUser(user) {
  const { password, ...safe } = user;
  // Add helper that matches the expected frontend shape
  const baseRoles = [safe.role];
  const extraRoles = Array.isArray(safe.roles) ? safe.roles : [];
  const metadataRoles = [
    safe.department,
    safe.yearSemester,
    safe.labSection ? `lab.${safe.labSection}` : null,
    safe.batchNo ? `batch.${safe.batchNo}` : null,
    safe.section ? `sec.${safe.section}` : null,
  ].filter(Boolean);
  const mergedRoles = [...new Set([...baseRoles, ...extraRoles, ...metadataRoles])];
  return {
    ...safe,
    roles: mergedRoles,
    hasRole(roleType) { return mergedRoles.includes(roleType) || safe.role === roleType; },
    initials: getInitials(safe.name),
    isGuest: false,
    batchName: safe.batchName || safe.batchNo || '',
    // We can't serialize the function, so it'll be recreated on the client
  };
}

function getInitials(name) {
  return String(name || 'AU').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || 'AU';
}

// ─── Utils (match dev.mjs conventions) ───

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1024 * 1024) reject(new Error('Body too large')); });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/** Main route handler — returns true if it handled the request */
export async function handleAuthRoute(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;

  if (url === '/api/auth/signup' && req.method === 'POST') {
    await handleSignup(req, res);
    return true;
  }
  if (url === '/api/auth/login' && req.method === 'POST') {
    await handleLogin(req, res);
    return true;
  }
  if (url === '/api/auth/logout' && req.method === 'POST') {
    await handleLogout(req, res);
    return true;
  }
  if (url === '/api/auth/me' && req.method === 'GET') {
    await handleMe(req, res);
    return true;
  }
  if (url === '/api/auth/admin' && req.method === 'GET') {
    await handleAdminCheck(req, res);
    return true;
  }

  return false;
}
