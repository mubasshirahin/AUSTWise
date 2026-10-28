/**
 * Auth endpoints — issues JWT in HttpOnly cookie so the role is never
 * client-editable. The client calls /api/auth/me to get the current user.
 */
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import {
  createUser, validateLogin, getUserById, getUserByEmail,
  findOrCreateGoogleUser, updateUserProfile,
} from './userStore.mjs';
import { authRateLimiter, loginRateLimiter } from './rateLimiter.mjs';

export { handleDevSwitchUser, handleDevSeedUsers, handleDevUsers };

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.warn('⚠️  JWT_SECRET not set in .env — using insecure default. Set JWT_SECRET in production!');
  return 'aust-wise-dev-secret-change-in-production';
})();
const COOKIE_NAME = 'aust_token';
const TOKEN_EXPIRY = '7d';

// Cookie security varies by environment:
// - Production (Vercel → Railway proxy): SameSite=None; Secure so the auth
//   cookie is forwarded across origins. This MUST be paired with Secure
//   (HTTPS) — browsers reject SameSite=None without the Secure flag.
// - Development: SameSite=Lax keeps the CSRF surface minimal while still
//   permitting same-site navigation. Secure is omitted so localhost HTTP
//   works during local testing.
const isProdEnv = () => process.env.NODE_ENV === 'production';
const cookieFlags = () =>
  isProdEnv()
    ? `HttpOnly; SameSite=None; Secure; Path=/; Max-Age=${7 * 24 * 60 * 60}`
    : `HttpOnly; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`;
const cookieClearFlags = () =>
  isProdEnv()
    ? `HttpOnly; SameSite=None; Secure; Path=/; Max-Age=0`
    : `HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, roles: [...new Set([...(Array.isArray(user.roles) ? user.roles : []), user.role])], email: user.email },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY },
  );
}

function setAuthCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; ${cookieFlags()}`);
}

export function issueAuthCookie(res, user) {
  setAuthCookie(res, signToken(user));
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; ${cookieClearFlags()}`);
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
  if (!loginRateLimiter(req, res, body?.email)) return;
  try {
    const user = await createUser(body);
    if (user.status === 'PENDING_APPROVAL') {
      const { password: _password, ...safe } = user;
      return sendJson(res, 202, { success: true, pendingApproval: true, user: safe, message: 'Your account was created and is waiting for admin approval.' });
    }
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
  if (!loginRateLimiter(req, res, body?.email)) return;
  try {
    const user = await validateLogin(body.email, body.password);
    loginRateLimiter.success(req, body?.email);
    const token = signToken(user);
    setAuthCookie(res, token);
    return sendJson(res, 200, { success: true, user: sanitizeUser(user) });
  } catch (err) {
    // Lock this account+IP with exponential backoff (per-account anti-brute-force).
    loginRateLimiter.fail(req, body?.email);
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

/** Verify a Google ID token via Google's tokeninfo endpoint.
 *  Enforces audience (aud), expiry (exp), issue time (iat) and email_verified
 *  so a token minted for another Google client is rejected. */
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
          try {
            const payload = JSON.parse(data);
            const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
            if (clientId && payload.aud !== clientId) {
              reject(new Error('Google token was issued to a different client.'));
              return;
            }
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp && Number(payload.exp) < now) {
              reject(new Error('Google token has expired.'));
              return;
            }
            if (payload.iat && Number(payload.iat) > now + 300) {
              reject(new Error('Google token has an invalid issue time.'));
              return;
            }
            if (payload.email_verified !== true && payload.email_verified !== 'true') {
              reject(new Error('Google email address is not verified.'));
              return;
            }
            resolve(payload);
          }
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
  // Anchor the domain so `evil@aust.edu.attacker.com` is rejected.
  return /^[^@\s]+@(?:[a-z0-9-]+\.)*aust\.edu$/.test(normalized);
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
    if (!existingUser && !isAllowedAustEmail(googleEmail)) {
      return sendJson(res, 400, { success: false, error: 'Student and direct Faculty accounts require an @aust.edu email. Use an approved invitation for non-AUST Faculty or Alumni access.' });
    }
    if (existingUser?.role === 'student' && !isAllowedAustEmail(googleEmail)) {
      return sendJson(res, 400, { success: false, error: 'Student accounts must use their @aust.edu email address.' });
    }
    if (existingUser?.role === 'alumni' && isAllowedAustEmail(googleEmail)) {
      return sendJson(res, 400, { success: false, error: 'Alumni must use a personal email. Submit an Alumni access request to move your account from your former AUST email.' });
    }
    if (existingUser?.role === 'faculty' && !isAllowedAustEmail(googleEmail) && !existingUser.emailAccessApproved) {
      return sendJson(res, 400, { success: false, error: 'Faculty accounts without an @aust.edu email need admin approval or an invitation.' });
    }

    const profilePatch = body.profile && typeof body.profile === 'object' ? body.profile : null;

    // Signup step 2 — complete the account created on the first sign-in.
    // Student/Faculty can be selected for a new, incomplete account. Existing
    // accounts cannot use this endpoint to change their role.
    const GOOGLE_SIGNUP_FIELDS = [
      'name', 'avatar',
      'department', 'batch', 'batchNo', 'batchName',
      'yearSemester', 'semester', 'section', 'labSection',
      'designation', 'company', 'graduationYear',
      'openForTalk',
    ];
    const patch = {};
    if (profilePatch) {
      for (const key of GOOGLE_SIGNUP_FIELDS) {
        if (key in profilePatch) {
          patch[key] = typeof profilePatch[key] === 'string' ? profilePatch[key].trim() : profilePatch[key];
        }
      }
      if ('role' in profilePatch) {
        const requestedRole = String(profilePatch.role || '').toLowerCase().trim();
        const canSelectSignupRole = !existingUser || (
          existingUser.role === 'student'
          && existingUser.signupIncomplete === true
          && !existingUser.batchNo
          && !existingUser.designation
        );
        if (!canSelectSignupRole || !['student', 'faculty'].includes(requestedRole)) {
          return sendJson(res, 400, { success: false, error: 'Role can only be selected during new account setup.' });
        }
        if (requestedRole === 'faculty' && !String(profilePatch.designation || '').trim()) {
          return sendJson(res, 400, { success: false, error: 'Designation is required for faculty accounts.' });
        }
        if (!['CSE', 'EEE', 'CE', 'ME', 'IPE', 'TE', 'ARCH', 'BBA'].includes(String(profilePatch.department || '').trim().toUpperCase())) {
          return sendJson(res, 400, { success: false, error: 'Choose a valid department before creating your account.' });
        }
        if (requestedRole === 'student') {
          const batchInput = String(profilePatch.batch || `${profilePatch.batchName || ''} ${profilePatch.batchNo || ''}`).trim();
          const batchMatch = batchInput.match(/^([A-Za-z]+)\s+(\d+)$/);
          if (!batchMatch) {
            return sendJson(res, 400, { success: false, error: 'Enter the batch as one word followed by its number, for example: Batch 45.' });
          }
          if ((profilePatch.batchName && String(profilePatch.batchName).trim().toLowerCase() !== batchMatch[1].toLowerCase()) || (profilePatch.batchNo && String(profilePatch.batchNo).trim() !== batchMatch[2])) {
            return sendJson(res, 400, { success: false, error: 'Batch name and batch number must match the format you entered.' });
          }
          patch.batchName = batchMatch[1];
          patch.batchNo = batchMatch[2];
          patch.batch = `${batchMatch[1]} ${batchMatch[2]}`;
        }
        patch.role = requestedRole;
        patch.roles = requestedRole === 'faculty'
          ? ['faculty', `faculty_${String(profilePatch.department).trim().toLowerCase()}`]
          : ['student'];
        patch.signupIncomplete = false;
      }
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
    }

    let user;
    let created = false;

    if (!existingUser && !profilePatch) {
      // Keep the OAuth identity in the browser only until required signup
      // fields (including department) are submitted; do not create a partial
      // account or an AWID with a placeholder department.
      return sendJson(res, 200, {
        success: true,
        existing: false,
        pendingSignup: true,
        user: { name: verified.name || googleEmail.split('@')[0], email: googleEmail, avatar: verified.picture || null, signupIncomplete: true },
      });
    } else if (!existingUser && profilePatch) {
      if (!patch.role || !patch.department) {
        return sendJson(res, 400, { success: false, error: 'Choose your role and department to finish signup.' });
      }
      user = await createUser({
        ...patch,
        name: verified.name || googleEmail.split('@')[0],
        email: googleEmail,
        password: `google-${randomUUID()}`,
      });
      created = true;
    } else if (Object.keys(patch).length > 0) {
      const existing = await getUserByEmail(googleEmail);
      if (!existing) {
        return sendJson(res, 404, { success: false, error: 'User not found.' });
      }
      user = await updateUserProfile(existing.id, patch, { allowRole: Boolean(patch.role), regenerateAwid: Boolean(existing.signupIncomplete && patch.role) });
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
  const hasStaffRole = (account) => {
    const roles = [...new Set([...(Array.isArray(account?.roles) ? account.roles : []), account?.role])];
    return roles.some((role) => ['admin', 'moderator'].includes(String(role || '').toLowerCase()));
  };
  if (!payload || !hasStaffRole(payload)) {
    return sendJson(res, 403, { success: false, error: 'Forbidden: admin access required' });
  }
  const user = await getUserById(payload.id);
  if (!user || !hasStaffRole(user)) {
    return sendJson(res, 403, { success: false, error: 'Forbidden: admin access required' });
  }
  return sendJson(res, 200, { success: true });
}

export async function handleMe(req, res) {
  const payload = readTokenCookie(req);
  if (!payload) {
    return sendJson(res, 401, { success: false, error: 'Not authenticated' });
  }
  const user = await getUserById(payload.id);
  if (!user) {
    clearAuthCookie(res);
    return sendJson(res, 401, { success: false, error: 'User not found' });
  }
  if (user.role === 'alumni' && isAllowedAustEmail(user.email)) {
    clearAuthCookie(res);
    return sendJson(res, 401, { success: false, error: 'Alumni must use a personal email. Submit an Alumni access request to move your account from your former AUST email.' });
  }
  if (user.status === 'PENDING_APPROVAL') {
    clearAuthCookie(res);
    return sendJson(res, 403, { success: false, error: 'Your account is pending admin approval.' });
  }
  setAuthCookie(res, signToken(user));
  return sendJson(res, 200, { success: true, user: sanitizeUser(user) });
}

// Fields a user may edit about themselves. id/email/role/awid/privacy etc.
// are deliberately excluded so the server stays the source of truth.
const SELF_EDITABLE_FIELDS = [
  'name', 'avatar', 'bloodGroup',
  'department', 'batch', 'batchNo', 'batchName',
  'yearSemester', 'section', 'labSection',
  'designation', 'company', 'graduationYear',
  'personalEmail',
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
  if ('personalEmail' in patch) {
    const email = String(patch.personalEmail || '').trim().toLowerCase();
    if (!/^[^\s@]+@gmail\.com$/.test(email)) delete patch.personalEmail;
    else patch.personalEmail = email;
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

// A student may mark their own semester drop and return to student status if
// the drop is cancelled. No other roles can be self-assigned through this API.
async function handleSemesterDrop(req, res) {
  const payload = readTokenCookie(req);
  if (!payload) return sendJson(res, 401, { success: false, error: 'Not authenticated' });
  const body = await readJsonBody(req).catch(() => ({}));
  if (typeof body.dropped !== 'boolean') {
    return sendJson(res, 400, { success: false, error: 'Choose whether the semester is dropped.' });
  }
  try {
    const current = await getUserById(payload.id);
    if (!current || current.role !== 'student') {
      return sendJson(res, 403, { success: false, error: 'Only student accounts can change semester drop status.' });
    }
    const currentRoles = new Set([...(Array.isArray(current.roles) ? current.roles : []), current.role]);
    const inactiveLeadershipRoles = ['cr', 'sr', 'vp', 'gs'];
    const roles = body.dropped
      ? [...new Set([...currentRoles].filter((role) => !inactiveLeadershipRoles.includes(role)).concat(['student', 'readd']))]
      : [...new Set([...currentRoles].filter((role) => role !== 'readd').concat('student'))];
    const user = await updateUserProfile(payload.id, { role: 'student', roles }, { allowRole: true });
    if (!user) return sendJson(res, 404, { success: false, error: 'User not found.' });
    return sendJson(res, 200, { success: true, user: sanitizeUser(user) });
  } catch (err) {
    return sendJson(res, 500, { success: false, error: err.message });
  }
}

// Alumni can mark whether they still have carry courses. The carry status is
// represented by the Alumni With Carry role so existing role-access rules
// continue to apply consistently across the app.
async function handleAlumniCarry(req, res) {
  const payload = readTokenCookie(req);
  if (!payload) return sendJson(res, 401, { success: false, error: 'Not authenticated' });
  const body = await readJsonBody(req).catch(() => ({}));
  if (typeof body.hasCarry !== 'boolean') {
    return sendJson(res, 400, { success: false, error: 'Choose whether you have carry courses.' });
  }
  try {
    const current = await getUserById(payload.id);
    const currentRoles = new Set([...(Array.isArray(current?.roles) ? current.roles : []), current?.role].filter(Boolean));
    if (!current || (!currentRoles.has('alumni') && !currentRoles.has('alumni_with_carry'))) {
      return sendJson(res, 403, { success: false, error: 'Only Alumni accounts can change carry-course status.' });
    }
    const alumniRole = body.hasCarry ? 'alumni_with_carry' : 'alumni';
    const role = currentRoles.has('faculty') ? 'faculty' : alumniRole;
    const roles = [...new Set([...currentRoles].filter(item => item !== 'alumni' && item !== 'alumni_with_carry').concat('alumni', ...(body.hasCarry ? ['alumni_with_carry'] : [])))];
    const user = await updateUserProfile(payload.id, { role, roles }, { allowRole: true });
    if (!user) return sendJson(res, 404, { success: false, error: 'User not found.' });
    return sendJson(res, 200, { success: true, user: sanitizeUser(user) });
  } catch (err) {
    return sendJson(res, 500, { success: false, error: err.message });
  }
}

/** Return user without sensitive fields */
function sanitizeUser(user) {
  const { password: _password, ...safe } = user;
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
  if (url === '/api/auth/semester-drop' && req.method === 'POST') {
    await handleSemesterDrop(req, res);
    return true;
  }
  if (url === '/api/auth/alumni-carry' && req.method === 'POST') {
    await handleAlumniCarry(req, res);
    return true;
  }
  if (url === '/api/auth/admin' && req.method === 'GET') {
    await handleAdminCheck(req, res);
    return true;
  }

  return false;
}
