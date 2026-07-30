// TODO: Swap localStorage for API calls — see MIGRATION.md Phase 3
//   GET  /api/grades  → getSemesterResults()
//   POST /api/grades  → saveSemesterResult()
// Keep userStoragePrefixes helpers until phased out.
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
export function getCurrentUserId() {
  try {
    const session = loadSession();
    return session?.userId || null;
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
    return { success: true, adminCreated: accounts.some(acc => acc.email === 'admin@aust.edu') };
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
  return account;
}

function loadAccounts() {
  try {
    const raw = localStorage.getItem(accountsKey);
    let list = raw ? JSON.parse(raw) : [];

    // Remove leftover dummy/DEV accounts that were previously seeded
    const before = list.length;
    list = list.filter(acc => !acc.id?.startsWith('DEV-') && !acc.id?.startsWith('ALU-DEMO-'));
    if (list.length !== before) {
      localStorage.setItem(accountsKey, JSON.stringify(list));
    }

    const adminExists = list.some(acc => acc.email === 'admin@aust.edu');
    if (!adminExists) {
      list.push({
        id: 'ADM-001',
        name: 'Prof. Dr. Md. Abdur Rahim',
        email: 'admin@aust.edu',
        password: btoa(import.meta.env.VITE_ADMIN_DEFAULT_PASSWORD || 'changeme'),
        role: 'admin',
        department: 'Admin Department',
        designation: 'Registrar',
        company: 'Ahsanullah University of Science and Technology',
        initials: 'AR',
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(accountsKey, JSON.stringify(list));
    }

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
  if (role !== 'alumni' && !isValidAustEmail(email)) {
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

export function submitRoleApplication(payload) {
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

export function reviewRoleApplication(applicationId, status, adminId) {
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
  }

  applications[index] = application;
  saveApplications(applications);
  return application;
}

/** ─── Slot Vacancy ─── */

/**
 * Check if a CR/SR slot is vacant for a given department + semester.
 * @param {string} department - e.g. 'CSE'
 * @param {number|string} semester - e.g. 3
 * @param {string} appliedRole - 'cr' or 'sr'
 * @param {string} [targetSection] - 'A', 'B', or 'C' (for SR)
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
  const accounts = loadAccounts();
  
  const srSlots = ['A', 'B', 'C'].map(sec => ({
    slot: `Section ${sec}`,
    key: sec,
    type: 'sr',
    ...checkSlotVacancy(department, semester, 'sr', sec, null),
  }));

  const crSlots = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(lab => ({
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
 * Also marks the application as 'resigned'.
 */
export function resignFromRole(userId) {
  const account = getAccountById(userId);
  if (!account) throw new Error('Account not found.');
  if (account.role !== 'cr' && account.role !== 'sr') {
    throw new Error('You do not have a CR or SR role to resign from.');
  }

  const resignedRole = account.role;

  // Update account role back to student
  updateAccountProfile(userId, { role: 'student' });

  // Mark all approved applications for this role as resigned
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
