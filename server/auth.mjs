/**
 * Auth endpoints — issues JWT in HttpOnly cookie so the role is never
 * client-editable. The client calls /api/auth/me to get the current user.
 */
import jwt from 'jsonwebtoken';
import {
  createUser, validateLogin, getUserById, getUserByEmail,
  findOrCreateGoogleUser, updateUserProfile,
} from './userStore.mjs';
import { authRateLimiter } from './rateLimiter.mjs';

export { handleDevSwitchUser, handleDevSeedUsers, handleDevUsers };

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

/** Dev-only endpoints - only run with an explicit NODE_ENV=development. */
function devEndpointsEnabled() {
  return process.env.NODE_ENV === 'development';
}

async function handleDevSwitchUser(req, res) {
  if (!devEndpointsEnabled()) {
    return sendJson(res, 403, { success: false, error: 'Dev endpoints disabled outside development' });
  }
  const body = await readJsonBody(req);
  const userId = String(body?.userId || '').trim();
  if (!userId) return sendJson(res, 400, { success: false, error: 'userId is required' });
  try {
    const user = await getUserById(userId);
    if (!user) return sendJson(res, 404, { success: false, error: 'User not found' });
    const token = signToken(user);
    setAuthCookie(res, token);
    return sendJson(res, 200, { success: true, user: sanitizeUser(user) });
  } catch (err) {
    return sendJson(res, 500, { success: false, error: err.message || 'Switch failed' });
  }
}

async function handleDevSeedUsers(req, res) {
  if (!devEndpointsEnabled()) {
    return sendJson(res, 403, { success: false, error: 'Dev endpoints disabled outside development' });
  }
  try {
    const { seedDevUsers } = await import('./userStore.mjs');
    const { seedDevData } = await import('./devDataSeed.mjs');
    const result = await seedDevUsers();
    // Realistic internal data (shared routines + messages) for the dev users.
    const data = await seedDevData();
    return sendJson(res, 200, { success: true, ...result, data });
  } catch (err) {
    return sendJson(res, 500, { success: false, error: err.message || 'Seeding failed' });
  }
}

async function handleDevUsers(req, res) {
  if (!devEndpointsEnabled()) {
    return sendJson(res, 403, { success: false, error: 'Dev endpoints disabled outside development' });
  }
  try {
    const { getDevUsers } = await import('./userStore.mjs');
    const users = await getDevUsers();
    return sendJson(res, 200, { success: true, users });
  } catch (err) {
    return sendJson(res, 500, { success: false, error: err.message || 'Failed to load users' });
  }
}

/** Verify a Google ID token via Google's tokeninfo endpoint */
async function verifyGoogleToken(credential) {
  const https = await import('node:https');
  const verifyUrl = new URL('https://oauth2.googleapis.com/tokeninfo');
  verifyUrl.searchParams.set('id_token', credential);
  return new Promise((resolve, reject) => {
    https.get(verifyUrl.toString(), (resp) => {
      let data = '';
      resp.on('data', (chunk) => data += chunk);
      resp.on('end', () => {
        if (resp.statusCode === 200) {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid response')); }
        } else {
          reject(new Error(data));
        }
      });
    }).on('error', reject);
  });
}

function isAllowedAustEmail(email) {
  const normalized = String(email || '').toLowerCase().trim();
  return ['aust.edu', 'www.aust.edu'].some(d =>
    normalized.endsWith(`@${d}`) || normalized.endsWith(`@www.${d}`)
  );
}

/**
 * POST /api/auth/google
 * Body: { credential, profile? }
 *   - credential: Google ID token (verified against Google).
 *   - profile (optional): sent when completing signup step 2 — patches the
 *     account created on first sign-in with role/department/batch/etc.
 * Always issues an auth cookie so the session survives reloads.
 */
async function handleGoogle(req, res) {
  const body = await readJsonBody(req);
  const credential = body.credential;
  if (!credential) {
    return sendJson(res, 400, { success: false, error: 'Credential is required.' });
  }
  try {
    const verified = await verifyGoogleToken(credential);
    if (!verified || !verified.email) {
      return sendJson(res, 401, { success: false, error: 'Invalid Google credential.' });
    }
    const googleEmail = String(verified.email).toLowerCase().trim();

    // Only @aust.edu emails may sign in or register — admins (site owner) are
    // the single exception, so their non-AUST gmail keeps working.
    const existingUser = await getUserByEmail(googleEmail);
    if (existingUser?.role !== 'admin' && !isAllowedAustEmail(googleEmail)) {
      return sendJson(res, 400, { success: false, error: 'Only AUST university email addresses (@aust.edu) are allowed for registration.' });
    }

    const profilePatch = body.profile && typeof body.profile === 'object' ? body.profile : null;
    let user;
    let created = false;

    if (profilePatch && profilePatch.role) {
      // Signup step 2 — complete the account created on the first sign-in.
      const existing = await getUserByEmail(googleEmail);
      if (!existing) {
        return sendJson(res, 404, { success: false, error: 'User not found.' });
      }
      user = await updateUserProfile(existing.id, profilePatch);
    } else {
      const result = await findOrCreateGoogleUser({
        name: verified.name,
        email: verified.email,
        picture: verified.picture,
      });
      user = result.user;
      created = result.created;
    }

    const token = signToken(user);
    setAuthCookie(res, token);
    return sendJson(res, 200, { success: true, user: sanitizeUser(user), existing: !created });
  } catch (err) {
    return sendJson(res, 401, { success: false, error: err.message || 'Google verification failed.' });
  }
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

// Fields a user may edit about themselves. id/email/role/awid/privacy etc.
// are deliberately excluded so the server stays the source of truth.
const SELF_EDITABLE_FIELDS = [
  'name', 'avatar', 'bloodGroup',
  'department', 'batch', 'batchNo', 'batchName',
  'yearSemester', 'section', 'labSection',
  'designation', 'company', 'graduationYear',
  'facebook', 'whatsapp', 'linkedin', 'discord',
  'openForTalk',
  'orbit', // { checkpoints, favoriteColor } — public, shown to anyone visiting the orbit
];

/** Normalize "3.1" or "3.1.x" → "Year 3 - Semester 1"; passthrough otherwise. */
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

async function handleProfileUpdate(req, res) {
  const payload = readTokenCookie(req);
  if (!payload) {
    return sendJson(res, 401, { success: false, error: 'Not authenticated' });
  }
  const body = await readJsonBody(req).catch(() => ({}));
  const patch = {};
  for (const key of SELF_EDITABLE_FIELDS) {
    if (key in body) {
      patch[key] = typeof body[key] === 'string' ? body[key].trim() : body[key];
    }
  }
  // Orbit payload is user-controlled JSON — sanity-check its shape and size so
  // one account can't bloat the shared member directory.
  if ('orbit' in patch && patch.orbit != null) {
    const o = patch.orbit;
    const ok = o && typeof o === 'object'
      && (o.checkpoints === undefined || Array.isArray(o.checkpoints))
      && (o.favoriteColor === undefined || typeof o.favoriteColor === 'string')
      && JSON.stringify(o).length <= 100_000;
    if (!ok) delete patch.orbit;
  }
  // Keep yearSemester + semester consistent regardless of the format sent.
  if ('yearSemester' in patch) {
    const canonical = toYearSemester(patch.yearSemester);
    if (canonical) {
      patch.yearSemester = canonical;
      const m = canonical.match(/Year\s*(\d+)\s*-\s*Semester\s*(\d+)/);
      if (m) patch.semester = (Number(m[1]) - 1) * 2 + Number(m[2]);
    } else {
      delete patch.yearSemester;
    }
  }
  if (Object.keys(patch).length === 0) {
    return sendJson(res, 400, { success: false, error: 'No updatable fields.' });
  }
  try {
    const user = await updateUserProfile(payload.id, patch);
    if (!user) {
      return sendJson(res, 404, { success: false, error: 'User not found.' });
    }
    return sendJson(res, 200, { success: true, user: sanitizeUser(user) });
  } catch (err) {
    return sendJson(res, 500, { success: false, error: err.message });
  }
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

/** Decode req.url pathname safely — null on malformed/undecodable input */
function safePathname(req) {
  try {
    return new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  } catch {
    return null;
  }
}

/** Main route handler — returns true if it handled the request */
export async function handleAuthRoute(req, res) {
  const url = safePathname(req) || '';
  if (!url) return false;

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
  if (url === '/api/auth/google' && req.method === 'POST') {
    await handleGoogle(req, res);
    return true;
  }
  if (url === '/api/auth/me' && req.method === 'GET') {
    await handleMe(req, res);
    return true;
  }
  if (url === '/api/auth/profile' && req.method === 'PUT') {
    await handleProfileUpdate(req, res);
    return true;
  }
  if (url === '/api/auth/admin' && req.method === 'GET') {
    await handleAdminCheck(req, res);
    return true;
  }

  return false;
}
