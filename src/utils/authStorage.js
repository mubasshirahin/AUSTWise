// TODO: Swap localStorage for API calls — see MIGRATION.md Phase 3
//   GET  /api/grades  → getSemesterResults()
//   POST /api/grades  → saveSemesterResult()
// Keep userStoragePrefixes helpers until phased out.
import { addNotification, makeNotifId, showNativeNotification } from './inAppNotifications';

const accountsKey = 'aust-auth-accounts-v1';
const sessionKey = 'aust-auth-session-v1';
const profileKey = 'aust-user-profile';
const applicationsKey = 'aust-role-applications-v1';

// User-specific storage key prefixes
const userStoragePrefixes = {
  semesterResults: 'aust-user-semester-results',
  routineAttendanceEnabled: 'aust-user-routine-attendance-enabled',
  routineAttendanceData: 'aust-user-routine-attendance-data',
  routineAttendanceSessions: 'aust-user-routine-attendance-sessions',
  userRoutine: 'aust-user-routine',
  userWeekDays: 'aust-user-weekdays',
  // Semester Tracker
  semesterTrackerCourses: 'aust-user-tracker-courses',
  semesterTrackerMarks:   'aust-user-tracker-marks',
  semesterTrackerLabCourses: 'aust-user-tracker-lab-courses',
  semesterTrackerLabConfig:  'aust-user-tracker-lab-config',
  semesterTrackerLabMarks:   'aust-user-tracker-lab-marks',
};

// Get current session user ID for user-specific storage
// Falls back to the cached user profile (written on every server-side
// login/signup) so user-specific keys keep working even though the
// legacy session key isn't written by the server auth flow.
export function getCurrentUserId() {
  try {
    const session = loadSession();
    if (session?.userId) return session.userId;
    // Server auth (/api/auth/*) persists the hydrated profile instead of
    // the legacy session key — derive the user id from it.
    const raw = localStorage.getItem(profileKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id && parsed.id !== 'guest') return parsed.id;
    }
    return null;
  } catch {
    return null;
  }
}

// Get user-specific storage key
export function getUserStorageKey(keyType) {
  const userId = getCurrentUserId();
  const prefix = userStoragePrefixes[keyType];
  if (!prefix) return null;
  // If no user is logged in, use a fixed guest key so reads & writes match
  return userId ? `${prefix}-${userId}` : `${prefix}-guest`;
}

// User-specific localStorage operations
export function getUserStorageItem(keyType) {
  const key = getUserStorageKey(keyType);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Read from the shared guest bucket. Used as a fallback so data that was
// saved before the profile-based user id existed (or while browsing as a
// guest) isn't lost when an authenticated user views the same feature.
export function getGuestStorageItem(keyType) {
  const prefix = userStoragePrefixes[keyType];
  if (!prefix) return null;
  try {
    const raw = localStorage.getItem(`${prefix}-guest`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Remove the shared guest bucket value, so "reset all" clears data that
// was saved while browsing as a guest (which getUserStorageItemWithGuestFallback
// would otherwise resurrect).
export function removeGuestStorageItem(keyType) {
  const prefix = userStoragePrefixes[keyType];
  if (!prefix) return;
  try {
    localStorage.removeItem(`${prefix}-guest`);
  } catch {
    // Ignore errors
  }
}

// User-specific read with guest-bucket fallback, so previously saved
// results remain visible for authenticated users.
export function getUserStorageItemWithGuestFallback(keyType) {
  const value = getUserStorageItem(keyType);
  if (value !== null && value !== undefined) return value;
  return getGuestStorageItem(keyType);
}

export function setUserStorageItem(keyType, value) {
  const key = getUserStorageKey(keyType);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or other error
  }
}

export function removeUserStorageItem(keyType) {
  const key = getUserStorageKey(keyType);
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore errors
  }
}

// Clear all user-specific storage (called on logout)
export function clearUserStorage() {
  try {
    const userId = getCurrentUserId();
    if (!userId) return;
    
    Object.values(userStoragePrefixes).forEach(prefix => {
      const key = `${prefix}-${userId}`;
      localStorage.removeItem(key);
    });
  } catch {
    // Ignore errors
  }
}

export function resetAllLocalData() {
  try {
    localStorage.clear();
    const accounts = loadAccounts();
    return { success: true, adminCreated: accounts.some(acc => acc.role === 'admin') };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export const AUTH_ROLES = ['student', 'faculty', 'alumni', 'admin', 'cr', 'sr', 'senior', 'moderator'];
export const ALLOWED_EMAIL_DOMAINS = ['aust.edu', 'www.aust.edu'];

export const guestUser = {
  id: 'guest',
  name: 'Guest',
  email: '',
  role: 'guest',
  roles: ['guest'],
  department: '',
  batch: '',
  batchNo: '',
  initials: 'GU',
  isGuest: true,
  designation: '',
  hasRole(roleType) { return this.roles?.includes(roleType) || this.role === roleType; },
};

const rolePrefixes = {
  student: 'STU',
  faculty: 'FAC',
  alumni: 'ALU',
  cr: 'CR',
  sr: 'SR',
  senior: 'SNR',
  moderator: 'MOD',
};

export function getInitials(name) {
  const initials = String(name || 'AU')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return initials || 'AU';
}

/**
 * Legacy: auth is now server-side via JWT. These password helpers
 * remain for backward compat but are no longer the primary mechanism.
 */
export function encodePassword(password) {
  return btoa(unescape(encodeURIComponent(password)));
}

export function verifyPassword(password, encoded) {
  return encodePassword(password) === encoded;
}

/**
 * ⚠️ DEPRECATED — use server /api/auth/login instead.
 * Kept for backward compatibility with existing code that
 * still reads localStorage accounts.
 */
export function loginAccount(email, password) {
  const account = getAccountByEmail(email);
  if (!account || !verifyPassword(password, account.password)) {
    throw new Error('Invalid email or password.');
  }
  // Only @aust.edu may sign in — admins (site owner) are the exception.
  if (account.role !== 'admin' && !isValidAustEmail(account.email)) {
    throw new Error('Only AUST university email addresses (@aust.edu) are allowed to sign in.');
  }
  return account;
}

function loadAccounts() {
  try {
    const raw = localStorage.getItem(accountsKey);
    let list = raw ? JSON.parse(raw) : [];

    // Remove leftover dummy/DEV/QA accounts that were previously seeded or
    // synced during testing (e.g. "QA Verify", "qa-free-…@aust.edu").
    const before = list.length;
    const isDummy = (acc) =>
      acc.id?.startsWith('DEV-') ||
      acc.id?.startsWith('ALU-DEMO-') ||
      /^QA(\s|$)/i.test(String(acc.name || '').trim()) ||
      /^qa-[\w-]*@/i.test(String(acc.email || '').trim());
    list = list.filter(acc => !isDummy(acc));
    if (list.length !== before) {
      localStorage.setItem(accountsKey, JSON.stringify(list));
    }

    // The one true admin identity. Any OTHER admin-role account in
    // localStorage is leftover from before the admin swap (e.g. the old
    // ADM-001 / admin@aust.edu) and must be dropped so the admin panel and
    // directories only ever show the real admin.
    const DEFAULT_ADMIN_ID = 'ADM-MSOP6VG6BVL4';

    // Explicitly purge the old admin identity so browsers that cached it
    // before the swap stop showing "Prof. Dr. Md. Abdur Rahim".
    const isOldAdmin = (acc) =>
      acc.id === 'ADM-001' || acc.email === 'admin@aust.edu';
    list = list.filter(acc => !isOldAdmin(acc));

    const adminExists = list.some(acc => acc.id === DEFAULT_ADMIN_ID);
    if (!adminExists) {
      // The real admin password is a server-only secret (ADMIN_DEFAULT_PASSWORD,
      // never a VITE_ var) and is stored in users.json as a bcrypt hash. The
      // localStorage record is only for directory/admin-panel display, so it
      // gets a random throwaway password that can never authenticate.
      list.push({
        id: DEFAULT_ADMIN_ID,
        name: 'Admin',
        email: 'austwise59@gmail.com',
        password: btoa(String(Math.random()).slice(2)),
        role: 'admin',
        department: 'Admin Department',
        designation: 'Administrator',
        company: 'Ahsanullah University of Science and Technology',
        initials: 'A',
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(accountsKey, JSON.stringify(list));
    }

    // NOTE: we intentionally do NOT prune accounts to "admin + signed-in user"
    // here. That filter ran on every read and wiped accounts that were created
    // before a session existed (e.g. the Google sign-up flow writes the account
    // to localStorage, then completes department/batch in step 2 before any
    // session is started). That made Google accounts vanish after the first
    // sign-in, so the next sign-in created a brand-new account. The pattern
    // cleanup above (DEV-/QA/demo + old admin) is enough to keep directories
    // free of known test data without deleting real accounts.
    return list;
  } catch {
    return [];
  }
}

function saveAccounts(accounts) {
  localStorage.setItem(accountsKey, JSON.stringify(accounts));
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(sessionKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

export function clearSession() {
  clearUserStorage();
  localStorage.removeItem(sessionKey);
  localStorage.removeItem(profileKey);
}

export function getAccountById(userId) {
  return loadAccounts().find((account) => account.id === userId) ?? null;
}

// All registered accounts (used by admin views and directories).
export function getAllAccounts() {
  return loadAccounts();
}

// All registered alumni, as lightweight profile objects for the directory.
export function getAlumniAccounts() {
  return loadAccounts()
    .filter((account) => account.role === 'alumni')
    .map((account) => ({
      id: account.id,
      name: account.name,
      email: account.email,
      department: account.department || 'Undeclared',
      batchNo: String(account.batchNo || '').trim(),
      batch: account.batch || account.batchNo || 'N/A',
      company: account.company || '',
      designation: account.designation || '',
      graduationYear: account.graduationYear || '',
      initials: getInitials(account.name),
      openForTalk: Boolean(account.openForTalk),
    }));
}

// Toggle the "Open for Talk" availability flag on an alumni account.
export function setOpenForTalk(userId, value) {
  return updateAccountProfile(userId, { openForTalk: Boolean(value) });
}

export function deleteAccountById(userId) {
  const accounts = loadAccounts();
  const filtered = accounts.filter((a) => a.id !== userId && a.id !== 'guest');
  saveAccounts(filtered);
}

export function getAccountByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return loadAccounts().find((account) => account.email === normalized) ?? null;
}

export function updateAccountProfile(userId, patch) {
  const accounts = loadAccounts();
  let index = accounts.findIndex((account) => account.id === userId);
  if (index === -1 && patch.email) {
    index = accounts.findIndex((account) => account.email === patch.email);
  }
  if (index === -1) return null;

  accounts[index] = {
    ...accounts[index],
    ...patch,
    name: patch.name ?? accounts[index].name,
    email: patch.email ?? accounts[index].email,
  };

  saveAccounts(accounts);
  return accounts[index];
}

export function createAwid(department) {
  const dept = (department || 'GEN').toUpperCase();
  const accounts = loadAccounts();
  const existing = accounts.filter((a) => a.awid && a.awid.includes(`-${dept}-AW`));
  const maxNum = existing.reduce((max, a) => {
    const match = a.awid.match(/AW(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  const nextNum = String(maxNum + 1).padStart(6, '0');
  return `STU-${dept}-AW${nextNum}`;
}

function createAccountId(role) {
  const prefix = rolePrefixes[role] || 'USR';
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export function accountToUser(account) {
  const baseRoles = [account.role];
  const extraRoles = Array.isArray(account.roles) ? account.roles : [];
  // Merge all role-like attributes so hasRole() can check them:
  // department, year-semester (1.2, 2.1), lab group, batch, section
  const metadataRoles = [
    account.department,
    account.yearSemester,
    account.labSection ? `lab.${account.labSection}` : null,
    account.batchNo ? `batch.${account.batchNo}` : null,
    account.section ? `sec.${account.section}` : null,
  ].filter(Boolean);
  const mergedRoles = [...new Set([...baseRoles, ...extraRoles, ...metadataRoles])];

  return {
    id: account.id,
    awid: account.awid || createAwid(account.department),
    name: account.name,
    email: account.email,
    role: account.role,
    roles: mergedRoles,
    hasRole(roleType) { return this.roles?.includes(roleType) || this.role === roleType; },
    department: account.department || '',
    batch: account.batch || '',
    batchNo: account.batchNo || '',
    batchName: account.batchName || account.batchNo || '',
    designation: account.designation || '',
    company: account.company || '',
    graduationYear: account.graduationYear || '',
    yearSemester: account.yearSemester || '',
    section: account.section || '',
    labSection: account.labSection || '',
    openForTalk: Boolean(account.openForTalk),
    semester: account.semester ?? 1,
    avatar: account.avatar || null,
    initials: getInitials(account.name),
    bloodGroup: account.bloodGroup || '',
    facebook: account.facebook || '',
    whatsapp: account.whatsapp || '',
    linkedin: account.linkedin || '',
    discord: account.discord || '',
    linkedSocial: account.linkedSocial || {},
    linkedAccounts: account.linkedAccounts || [],
    cgpa: account.cgpa ?? 0,
    creditsCompleted: account.creditsCompleted ?? 0,
    totalCredits: account.totalCredits ?? 160,
  };
}

export function persistUserProfile(user) {
  localStorage.setItem(profileKey, JSON.stringify(user));
}

function isValidAustEmail(email) {
  const normalized = email.toLowerCase().trim();
  return ALLOWED_EMAIL_DOMAINS.some(domain => 
    normalized.endsWith(`@${domain}`) || normalized.endsWith(`@www.${domain}`)
  );
}

/**
 * Signup with Google OAuth data — creates an account with minimal fields
 * since the user's identity is verified by Google. No @aust.edu email
 * requirement or department/batch validation needed.
 */
export function signupWithGoogle(googlePayload) {
  const name = String(googlePayload.name || '').trim();
  const email = String(googlePayload.email || '').trim().toLowerCase();
  const picture = googlePayload.picture || null;

  if (!name) throw new Error('Full name is required.');
  if (!email || !email.includes('@')) throw new Error('Enter a valid email address.');

  if (getAccountByEmail(email)) {
    throw new Error('An account with this email already exists.');
  }

  // Generate a random password since the user will only log in via Google
  const randomPassword = crypto.randomUUID();

  // Extract student ID from email: "cse.12345@aust.edu" or "cse12345@aust.edu" -> "12345"
  const emailPrefix = email.split('@')[0] || '';
  const studentId = emailPrefix.replace(/^[a-z.]+/i, '');

  const generatedId = createAccountId('student');
  const account = {
    id: studentId || generatedId,
    awid: createAwid('Undeclared'),
    name,
    email,
    password: encodePassword(randomPassword),
    role: 'student',
    department: 'Undeclared',
    batch: '',
    batchNo: '',
    batchName: '',
    designation: '',
    company: '',
    graduationYear: '',
    yearSemester: '',
    section: '',
    semester: 1,
    avatar: picture,
    linkedSocial: { gmail: email },
    createdAt: new Date().toISOString(),
  };

  const accounts = loadAccounts();
  accounts.push(account);
  saveAccounts(accounts);

  return account;
}

export function signupAccount(payload) {
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const role = AUTH_ROLES.includes(payload.role) ? payload.role : 'student';
  const department = String(payload.department || '').trim();

  if (!name) throw new Error('Full name is required.');
  if (!email || !email.includes('@')) throw new Error('Enter a valid email address.');
  if (!isValidAustEmail(email)) {
    throw new Error('Only AUST university email addresses (@aust.edu) are allowed for registration.');
  }
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');
  if (!department) throw new Error('Department is required.');

  if (getAccountByEmail(email)) {
    throw new Error('An account with this email already exists.');
  }

  if (role === 'student' || role === 'alumni') {
    if (!String(payload.batchNo || payload.batch || '').trim()) {
      throw new Error('Batch is required for students and alumni.');
    }
  }

  if (role === 'faculty' && !String(payload.designation || '').trim()) {
    throw new Error('Designation is required for faculty accounts.');
  }

  const batchNo = String(payload.batchNo || '').trim();
  // Extract student ID from email: "cse.12345@aust.edu" or "cse12345@aust.edu" -> "12345"
  const emailPrefix = email.split('@')[0] || '';
  const studentId = emailPrefix.replace(/^[a-z.]+/i, '');
  const generatedId = createAccountId(role);
  const awid = createAwid(department);
  const account = {
    id: studentId || generatedId,
    awid,
    name,
    email,
    password: encodePassword(password),
    role,
    department,
    batch: String(payload.batch || batchNo || '').trim(),
    batchNo,
    batchName: String(payload.batchName || batchNo).trim(),
    designation: String(payload.designation || '').trim(),
    company: String(payload.company || '').trim(),
    graduationYear: String(payload.graduationYear || '').trim(),
    yearSemester: String(payload.yearSemester || '').trim(),
    section: String(payload.section || '').trim(),
    semester: Number(payload.semester) || 1,
    createdAt: new Date().toISOString(),
  };

  const accounts = loadAccounts();
  accounts.push(account);
  saveAccounts(accounts);

  return account;
}

/**
 * ⚠️ DEPRECATED — use server /api/auth/login instead.
 * Kept for backward compatibility.
 */
export function loginByAccount(account) {
  if (!account || !account.id) {
    throw new Error('Invalid account.');
  }
  return account;
}

export function startSession(account) {
  const user = accountToUser(account);
  saveSession({ userId: account.id, role: account.role, startedAt: new Date().toISOString() });
  persistUserProfile(user);
  return user;
}

export function restoreSessionUser() {
  const session = loadSession();
  if (!session?.userId) return null;

  // Guest sessions don't have an account entry — restore directly.
  if (session.userId === 'guest') {
    persistUserProfile(guestUser);
    return guestUser;
  }

  const account = getAccountById(session.userId);
  if (!account) {
    clearSession();
    return null;
  }
  const user = accountToUser(account);

  // Fallback: if the account is missing some profile data (avatar,
  // linkedAccounts, etc.) that was saved in the cached user profile
  // from a previous session, restore it.
  try {
    const cached = localStorage.getItem(profileKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (!user.avatar && parsed.avatar) user.avatar = parsed.avatar;
      if ((!user.linkedAccounts || user.linkedAccounts.length === 0) && parsed.linkedAccounts?.length) {
        user.linkedAccounts = parsed.linkedAccounts;
      }
      if ((!user.linkedSocial || Object.keys(user.linkedSocial).length === 0) && parsed.linkedSocial && Object.keys(parsed.linkedSocial).length > 0) {
        user.linkedSocial = { ...parsed.linkedSocial };
      }
    }
  } catch { /* ignore */ }

  persistUserProfile(user);
  return user;
}

export function getRoleLabel(role) {
  if (role === 'guest') return 'Guest';
  if (role === 'faculty') return 'Faculty';
  if (role === 'alumni') return 'Alumni';
  if (role === 'admin') return 'Admin';
  if (role === 'moderator') return 'Moderator';
  if (role === 'cr') return 'Class Representative (CR)';
  if (role === 'sr') return 'Student Representative (SR)';
  if (role === 'vp') return 'Vice President';
  if (role === 'gs') return 'General Secretary';
  if (role === 'senior') return 'Senior';
  return 'Student';
}

export function getRoleBadgeClass(role) {
  switch (role) {
    case 'admin': return 'badge-rose';
    case 'moderator': return 'badge-rose';
    case 'faculty': return 'badge-purple';
    case 'alumni': return 'badge-cyan';
    case 'cr': return 'badge-amber';
    case 'sr': return 'badge-emerald';
    case 'vp': return 'badge-amber';
    case 'gs': return 'badge-emerald';
    case 'senior': return 'badge-purple';
    default: return 'badge-blue';
  }
}

export function getPortalSubtitle(role) {
  if (!role || role === 'guest') return 'AUST Campus Hub';
  if (role === 'faculty') return 'Faculty Portal';
  if (role === 'alumni') return 'Alumni Portal';
  if (role === 'admin' || role === 'moderator') return 'Admin Panel';
  return 'Student Portal';
}

// CR/SR Application Functions
function loadApplications() {
  try {
    const raw = localStorage.getItem(applicationsKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveApplications(applications) {
  localStorage.setItem(applicationsKey, JSON.stringify(applications));
}

/**
 * Submit a CR/SR application. The server is the source of truth — it persists
 * the application and notifies ONLY admins/moderators. The applicant is never
 * notified about their own submission.
 *
 * If the server is unreachable, falls back to the local store so the flow still
 * works offline (still no self-notification).
 */
export async function submitRoleApplication(payload) {
  try {
    const res = await fetch('/api/role-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.application) {
      // Mirror server state locally so existing localStorage-based reads
      // (settings status, vacancy map) stay consistent.
      const applications = loadApplications();
      if (!applications.some(a => a.id === data.application.id)) {
        applications.push(data.application);
        saveApplications(applications);
      }
      return data.application;
    }
    throw new Error(data.error || 'Failed to submit application.');
  } catch (err) {
    // Genuine network failure (server offline) → local fallback.
    if (err instanceof TypeError || /fetch|network|ECONNREFUSED/i.test(String(err?.message))) {
      return submitRoleApplicationLocal(payload);
    }
    throw err;
  }
}

function submitRoleApplicationLocal(payload) {
  const applications = loadApplications();
  const userId = payload.userId;
  const appliedRole = payload.appliedRole; // 'cr' or 'sr'
  const department = payload.department;
  const semester = payload.semester;

  // Check if user already has an active application
  const existingPending = applications.find(
    app => app.userId === userId && app.status === 'pending'
  );
  if (existingPending) {
    throw new Error('You already have a pending application.');
  }

  // Check if user already has this role
  const user = getAccountById(userId);
  if (user && user.role === appliedRole) {
    throw new Error('You already have this role.');
  }

  // ─── Slot vacancy check ───
  const targetSection = appliedRole === 'sr' ? payload.targetSection : null;
  const targetLabSection = appliedRole === 'cr' ? payload.targetLabSection : null;

  const { vacant, occupant } = checkSlotVacancy(
    department,
    semester,
    appliedRole,
    targetSection,
    targetLabSection
  );

  if (!vacant && occupant) {
    if (occupant.id === userId) {
      throw new Error('You already hold this position.');
    }
    throw new Error(`This position is already taken by ${occupant.name}. You can only apply for vacant positions.`);
  }

  const application = {
    id: `APP-${Date.now()}`,
    userId,
    userName: user?.name || payload.userName,
    userEmail: user?.email || payload.userEmail,
    userDepartment: department,
    userBatch: user?.batch || user?.batchNo || payload.batch,
    userSemester: String(semester),
    userSection: user?.section || payload.userSection,
    userLabSection: user?.labSection || payload.userLabSection,
    appliedRole,
    targetLabSection,
    targetSection,
    statement: payload.statement || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
  };

  applications.push(application);
  saveApplications(applications);

  return application;
}

export function getApplicationsByUserId(userId) {
  const applications = loadApplications();
  return applications.filter(app => app.userId === userId);
}

export function getAllRoleApplications() {
  return loadApplications();
}

/**
 * Review (approve/reject) a CR/SR application. Server-first so the decision
 * is persisted and the applicant is notified regardless of which device they
 * are on. Falls back to the local store when the server is unreachable.
 */
export async function reviewRoleApplication(applicationId, status, adminId) {
  try {
    const res = await fetch('/api/role-applications/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ applicationId, status }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.application) {
      const app = data.application;
      mirrorRoleApplication(app);
      if (status === 'approved') {
        updateAccountProfile(app.userId, { role: app.appliedRole });
        // If the applicant is the current session user, refresh the cached
        // profile too so their CR/SR powers activate without a re-login.
        try {
          const cached = localStorage.getItem(profileKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.id === app.userId) {
              persistUserProfile({ ...parsed, role: app.appliedRole });
            }
          }
        } catch { /* ignore */ }
      }
      notifyRoleReview(app);
      return app;
    }
    throw new Error(data.error || 'Failed to review application.');
  } catch (err) {
    // Genuine network failure (server offline) → local fallback.
    if (err instanceof TypeError || /fetch|network|ECONNREFUSED/i.test(String(err?.message))) {
      return reviewRoleApplicationLocal(applicationId, status, adminId);
    }
    throw err;
  }
}

function reviewRoleApplicationLocal(applicationId, status, adminId) {
  const applications = loadApplications();
  const index = applications.findIndex(app => app.id === applicationId);

  if (index === -1) {
    throw new Error('Application not found.');
  }

  const application = applications[index];
  if (application.status !== 'pending') {
    throw new Error('Application has already been reviewed.');
  }

  application.status = status; // 'approved' or 'rejected'
  application.reviewedAt = new Date().toISOString();
  application.reviewedBy = adminId;

  // If approved, update user's role
  if (status === 'approved') {
    updateAccountProfile(application.userId, { role: application.appliedRole });
    // If the applicant is the current session user, refresh the cached
    // profile too so their CR/SR powers activate without a re-login.
    try {
      const cached = localStorage.getItem(profileKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id === application.userId) {
          persistUserProfile({ ...parsed, role: application.appliedRole });
        }
      }
    } catch { /* ignore */ }
  }

  applications[index] = application;
  saveApplications(applications);

  notifyRoleReview(application);

  return application;
}

function notifyRoleReview(application) {
  // Notify the applicant (bell + native) with the decision, so the
  // confirmation lands in their notification area.
  const approved = application.status === 'approved';
  const roleLabel = application.appliedRole === 'cr' ? 'Class Representative (CR)' : 'Student Representative (SR)';
  const notif = {
    id: makeNotifId('rolereview'),
    title: approved ? '🎉 Application approved' : 'Application rejected',
    body: approved
      ? `Congratulations ${application.userName}! You are now the ${roleLabel}.`
      : `Your ${application.appliedRole === 'cr' ? 'CR' : 'SR'} application was rejected by the admin. You can re-apply for a vacant slot.`,
    type: 'info',
    icon: approved ? 'CheckCircle2' : 'XCircle',
    path: '/settings',
    timestamp: Date.now(),
    read: false,
    priority: approved ? 'high' : 'medium',
  };
  addNotification(notif);
  showNativeNotification(notif);
}

/**
 * Upsert a single application into the local mirror so existing
 * localStorage-based reads (settings status, vacancy map) stay consistent.
 */
function mirrorRoleApplication(app) {
  const applications = loadApplications();
  const idx = applications.findIndex(a => a.id === app.id);
  if (idx !== -1) {
    applications[idx] = { ...applications[idx], ...app };
  } else {
    applications.push(app);
  }
  saveApplications(applications);
}

/**
 * Pull the current user's applications from the server and mirror them
 * locally. Used so an approval made on another device shows up without a
 * manual reload.
 */
export async function syncRoleApplicationsFromServer(userId) {
  try {
    const res = await fetch('/api/role-applications/mine', { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(data.applications)) {
      const applications = loadApplications();
      const merged = [...applications];
      for (const app of data.applications) {
        const idx = merged.findIndex(a => a.id === app.id);
        if (idx !== -1) merged[idx] = { ...merged[idx], ...app };
        else merged.push(app);
      }
      saveApplications(merged);
      return merged.filter(app => app.userId === userId);
    }
  } catch { /* offline — keep local */ }
  return getApplicationsByUserId(userId);
}

export function saveRoleApplications(applications) {
  saveApplications(applications);
}

/** ─── Slot Vacancy ─── */

/**
 * Check if a CR/SR slot is vacant for a given department + semester.
 * @param {string} department - e.g. 'CSE'
 * @param {number|string} semester - e.g. 3
 * @param {string} appliedRole - 'cr' or 'sr'
 * @param {string} [targetSection] - 'A', 'B', 'C', or 'D' (for SR)
 * @param {string} [targetLabSection] - 'A1', 'A2', etc. (for CR)
 * @returns {{ vacant: boolean, occupant: object|null }}
 */
export function checkSlotVacancy(department, semester, appliedRole, targetSection, targetLabSection) {
  const accounts = loadAccounts();
  
  const occupant = accounts.find(acc => {
    if (acc.role !== appliedRole) return false;
    if (acc.department !== department) return false;
    if (Number(acc.semester) !== Number(semester)) return false;
    
    if (appliedRole === 'sr') {
      return acc.section === targetSection;
    }
    if (appliedRole === 'cr') {
      return acc.labSection === targetLabSection;
    }
    return false;
  });

  return {
    vacant: !occupant,
    occupant: occupant || null,
  };
}

/**
 * Get the full vacancy map for all CR/SR slots in a department+semester.
 */
export function getSlotVacancyMap(department, semester) {
  const srSlots = ['A', 'B', 'C', 'D'].map(sec => ({
    slot: `Section ${sec}`,
    key: sec,
    type: 'sr',
    ...checkSlotVacancy(department, semester, 'sr', sec, null),
  }));

  const crSlots = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'].map(lab => ({
    slot: `Lab ${lab}`,
    key: lab,
    type: 'cr',
    ...checkSlotVacancy(department, semester, 'cr', null, lab),
  }));

  return { srSlots, crSlots };
}

/** ─── Resign from CR/SR ─── */

/**
 * Resign from CR/SR role — revert account role back to 'student'.
 * Server-first so the vacancy opens up for everyone; falls back locally.
 */
export async function resignFromRole(userId) {
  try {
    const res = await fetch('/api/role-applications/resign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const account = getAccountById(userId);
      updateAccountProfile(userId, { role: 'student' });
      const applications = loadApplications();
      const updated = applications.map(app => {
        if (app.userId === userId && app.status === 'approved') {
          return { ...app, status: 'resigned', reviewedAt: new Date().toISOString() };
        }
        return app;
      });
      saveApplications(updated);
      return { resignedRole: data.resignedRole || account?.role || null };
    }
    throw new Error(data.error || 'Failed to resign.');
  } catch (err) {
    if (err instanceof TypeError || /fetch|network|ECONNREFUSED/i.test(String(err?.message))) {
      const account = getAccountById(userId);
      if (!account) throw new Error('Account not found.', { cause: err });
      if (account.role !== 'cr' && account.role !== 'sr') {
        throw new Error('You do not have a CR or SR role to resign from.', { cause: err });
      }

      const resignedRole = account.role;

      updateAccountProfile(userId, { role: 'student' });

      const applications = loadApplications();
      const updated = applications.map(app => {
        if (app.userId === userId && app.status === 'approved') {
          return { ...app, status: 'resigned', reviewedAt: new Date().toISOString() };
        }
        return app;
      });
      saveApplications(updated);

      return { resignedRole };
    }
    throw err;
  }
}

export async function withdrawApplication(userId, applicationId) {
  try {
    const res = await fetch('/api/role-applications/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ applicationId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.application) {
      mirrorRoleApplication(data.application);
      return data.application;
    }
    throw new Error(data.error || 'Failed to withdraw application.');
  } catch (err) {
    if (err instanceof TypeError || /fetch|network|ECONNREFUSED/i.test(String(err?.message))) {
      const applications = loadApplications();
      const pending = applications.find(app => app.userId === userId && app.status === 'pending');
      if (!pending) {
        throw new Error('No pending application found to withdraw.', { cause: err });
      }

      const updated = applications.map(app => {
        if (app.id === pending.id) {
          return { ...app, status: 'withdrawn', reviewedAt: new Date().toISOString() };
        }
        return app;
      });
      saveApplications(updated);
      return updated.find(app => app.id === pending.id);
    }
    throw err;
  }
}

export function getUserApplicationStatus(userId) {
  const applications = getApplicationsByUserId(userId);
  const pending = applications.find(app => app.status === 'pending');
  
  // Check actual account role for active CR/SR status
  const account = getAccountById(userId);
  const hasActiveCrSr = account && (account.role === 'cr' || account.role === 'sr');
  
  return {
    hasPending: !!pending,
    pendingApplication: pending || null,
    hasActiveRole: hasActiveCrSr,
    activeRole: hasActiveCrSr ? account.role : null,
  };
}
