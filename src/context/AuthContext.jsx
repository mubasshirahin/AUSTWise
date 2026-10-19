import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  clearSession,
  getInitials,
  guestUser,
  updateAccountProfile,
  getAllAccounts,
} from '../utils/authStorage';
import { runMigrationOnLogin } from '../utils/storageService';
import { initLiveStore, destroyLiveStore } from '../utils/liveStore';

const AuthContext = createContext();
const userStorageKey = 'aust-user-profile';
const MOCKABLE_ROLES = new Set(['student', 'faculty', 'alumni', 'alumni_with_carry', 'readd', 'admin', 'moderator', 'guest', 'cr', 'sr', 'senior', 'vp', 'gs', 'bus_coordinator', 'clubs_representative', 'help_desk', 'banned']);

function readMockRole(search) {
  if (!import.meta.env.DEV) return '';
  const requested = new URLSearchParams(search).get('mockRole')?.trim().toLowerCase().replaceAll('-', '_');
  if (requested === 'alumni_carry') return 'alumni_with_carry';
  return MOCKABLE_ROLES.has(requested) ? requested : '';
}

/** Call server API */
async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok && !data.success) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    const isCredentialExchange = ['/api/auth/login', '/api/auth/signup', '/api/auth/google'].includes(path);
    if (res.status === 401 && !isCredentialExchange) {
      window.dispatchEvent(new CustomEvent('austwise:auth-expired', { detail: { message: data.error } }));
    }
    throw err;
  }
  return data;
}

/**
 * Re-hydrate the user object with a hasRole function since JSON
 * deserialization strips functions.
 */
/** Normalize "3.1" → "Year 3 - Semester 1"; passthrough anything already canonical. */
function normalizeYearSemester(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (/Year\s*\d+\s*-\s*Semester\s*\d+/i.test(s)) return s;
  const parts = s.split('.');
  const yr = Number(parts[0]);
  const term = Number(parts[1]);
  if (Number.isFinite(yr) && Number.isFinite(term) && yr >= 1 && term >= 1) {
    return `Year ${yr} - Semester ${term}`;
  }
  return s;
}

function hydrateUser(raw) {
  if (!raw) return null;
  const primaryRole = String(raw.role || 'guest').toLowerCase();
  const roles = Array.isArray(raw.roles) ? raw.roles : [primaryRole];
  const yearSemester = normalizeYearSemester(raw.yearSemester);
  // Merge metadata roles
  const metaRoles = [
    raw.department,
    yearSemester,
    raw.labSection ? `lab.${raw.labSection}` : null,
    raw.batchNo ? `batch.${raw.batchNo}` : null,
    raw.section ? `sec.${raw.section}` : null,
  ].filter(Boolean);
  const mergedRoles = [...new Set([...roles, ...metaRoles])];
  return {
    ...raw,
    role: primaryRole,
    yearSemester,
    roles: mergedRoles,
    hasRole(roleType) {
      const wanted = String(roleType || '').toLowerCase();
      return this.roles?.some(role => String(role).toLowerCase() === wanted) || String(this.role).toLowerCase() === wanted;
    },
    initials: getInitials(raw.name),
    isGuest: false,
    batchName: raw.batchName || raw.batchNo || '',
  };
}

export function AuthProvider({ children }) {
  const location = useLocation();
  const [sessionUser, setSessionUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const profileWriteRevisionRef = useRef(0);

  useEffect(() => {
    const expireSession = () => {
      clearSession();
      destroyLiveStore();
      setSessionUser(null);
    };
    window.addEventListener('austwise:auth-expired', expireSession);
    return () => window.removeEventListener('austwise:auth-expired', expireSession);
  }, []);

  const mockRole = readMockRole(location.search);
  const isRoleMocked = Boolean(mockRole);
  const mockedPrimaryRole = mockRole === 'readd' ? 'student' : mockRole;
  const mockedRoles = mockRole === 'readd' ? ['student', 'readd'] : [mockRole];
  const user = isRoleMocked
    ? hydrateUser({ ...(sessionUser || guestUser), id: sessionUser?.id || `mock-${mockRole}`, role: mockedPrimaryRole, roles: mockedRoles, isGuest: false })
    : sessionUser ?? guestUser;
  const isAuthenticated = Boolean(sessionUser) || isRoleMocked;

  // On mount: try restoring session from server
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api('/api/auth/me');
        if (cancelled) return;
        if (data.success && data.user) {
          const hydrated = hydrateUser(data.user);
          setSessionUser(hydrated);
          localStorage.setItem(userStorageKey, JSON.stringify(hydrated));
          // Sync localStorage → server on first load after login
          runMigrationOnLogin(data.user.id);
          // Open the real-time channel so data changes propagate across devices
          initLiveStore(data.user.id);
        } else {
          // Server says not authenticated — keep the cached session (login
          // writes it) so the app doesn't log the user out on every reload
          // when the cookie is missing (e.g. no DB configured).
          const cached = localStorage.getItem(userStorageKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.id && parsed.id !== 'guest') {
              const hydrated = hydrateUser(parsed);
              setSessionUser(hydrated);
              initLiveStore(parsed.id);
            }
          } else {
            localStorage.removeItem(userStorageKey);
          }
        }
      } catch (err) {
        if (cancelled) return;
        // Server reachable but no valid session cookie (401) → the user is
        // genuinely logged out on this device. Do NOT restore the cached
        // profile here, or this device silently stops syncing (its store
        // writes all return 401) while still looking logged in.
        if (err?.status === 401) {
          localStorage.removeItem(userStorageKey);
        } else {
          // Server unreachable — fall back to cached user so the
          // user doesn't get kicked to the landing page on every
          // server restart / HMR cycle.
          console.warn('[Auth] /api/auth/me failed, trying localStorage fallback:', err.message);
          try {
            const cached = localStorage.getItem(userStorageKey);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed && parsed.id && parsed.id !== 'guest') {
                const hydrated = hydrateUser(parsed);
                setSessionUser(hydrated);
                initLiveStore(parsed.id);
              }
            }
          } catch { /* ignore corrupt cache */ }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = async (email, password) => {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    // Sync to localStorage for backward compat with existing features
    try {
      const accounts = getAllAccounts().filter(a => a.id !== 'guest');
      const existing = accounts.find(a => a.email === data.user.email);
      if (!existing) {
        // Push to localStorage accounts store
        const all = accounts.concat({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          department: data.user.department || '',
          batch: data.user.batch || '',
          batchNo: data.user.batchNo || '',
          batchName: data.user.batchName || '',
          designation: data.user.designation || '',
          company: data.user.company || '',
          graduationYear: data.user.graduationYear || '',
          yearSemester: data.user.yearSemester || '',
          section: data.user.section || '',
          labSection: data.user.labSection || '',
          semester: data.user.semester || 1,
          avatar: data.user.avatar || null,
          initials: getInitials(data.user.name),
          linkedSocial: data.user.linkedSocial || {},
          linkedAccounts: data.user.linkedAccounts || [],
          cgpa: data.user.cgpa || 0,
          creditsCompleted: data.user.creditsCompleted || 0,
          totalCredits: data.user.totalCredits || 160,
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem('aust-auth-accounts-v1', JSON.stringify(all));
      }
    } catch { /* best effort */ }
    const hydrated = hydrateUser(data.user);
    setSessionUser(hydrated);
    localStorage.setItem(userStorageKey, JSON.stringify(hydrated));
    runMigrationOnLogin(data.user.id);
    initLiveStore(data.user.id);
    return hydrated;
  };

  const signup = async (payload) => {
    const data = await api('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data.pendingApproval) return { pendingApproval: true, message: data.message };
    const hydrated = hydrateUser(data.user);
    setSessionUser(hydrated);
    localStorage.setItem(userStorageKey, JSON.stringify(hydrated));
    // Also sync to localStorage accounts for backward compat
    try {
      const accounts = getAllAccounts().filter(a => a.id !== 'guest');
      accounts.push({
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        department: data.user.department || '',
        batch: data.user.batch || '',
        batchNo: data.user.batchNo || '',
        batchName: data.user.batchName || '',
        designation: data.user.designation || '',
        company: data.user.company || '',
        graduationYear: data.user.graduationYear || '',
        yearSemester: data.user.yearSemester || '',
        section: data.user.section || '',
        labSection: data.user.labSection || '',
        semester: data.user.semester || 1,
        avatar: data.user.avatar || null,
        initials: getInitials(data.user.name),
        linkedSocial: data.user.linkedSocial || {},
        linkedAccounts: data.user.linkedAccounts || [],
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('aust-auth-accounts-v1', JSON.stringify(accounts));
    } catch { /* best effort */ }
    runMigrationOnLogin(data.user.id);
    initLiveStore(data.user.id);
    return { pendingApproval: false, user: hydrated };
  };

  const loginDirect = async (account) => {
    // This is only for OAuth/dev-switch responses that have just set the
    // server's HttpOnly auth cookie. Never create a client-only signed-in
    // session: protected APIs require that cookie and otherwise return 401.
    const data = await api('/api/auth/me');
    if (!data?.success || !data.user || String(data.user.id) !== String(account.id)) {
      throw new Error('Server session could not be verified. Please sign in again.');
    }
    const hydrated = hydrateUser({
      ...account,
      ...data.user,
      avatar: account.avatar || data.user.avatar,
      linkedSocial: account.linkedSocial || data.user.linkedSocial,
    });
    setSessionUser(hydrated);
    localStorage.setItem(userStorageKey, JSON.stringify(hydrated));
    initLiveStore(hydrated.id);
    return hydrated;
  };

  const loginGuest = () => {
    setSessionUser(null);
    destroyLiveStore();
    localStorage.setItem('aust-auth-session-v1', JSON.stringify({
      userId: 'guest', role: 'guest', startedAt: new Date().toISOString(),
    }));
    localStorage.setItem(userStorageKey, JSON.stringify(guestUser));
  };

  const logout = async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* best effort */ }
    clearSession();
    destroyLiveStore();
    setSessionUser(null);
  };

  const updateUser = (nextUserData) => {
    if (!sessionUser) return false;
    const revision = ++profileWriteRevisionRef.current;
    // The account id is the user's identity — a profile edit (e.g. the
    // editable "Student ID" field) must never rewrite it. The server ignores
    // `id` on /api/auth/profile too, so drop it before applying anything.
    const { id: _ignoredId, ...patch } = nextUserData || {};
    const updatedUser = {
      ...sessionUser,
      ...patch,
      initials: patch.name ? getInitials(patch.name) : sessionUser.initials,
    };
    setSessionUser(updatedUser);
    localStorage.setItem(userStorageKey, JSON.stringify(updatedUser));
    const accountId = sessionUser.id;
    updateAccountProfile(accountId, patch);
    // Persist self-editable profile fields to the server so changes survive a
    // reload. The server whitelists fields, so unsafe keys are ignored.
    if (accountId !== 'guest') {
      try {
        fetch('/api/auth/profile', {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
          .then((res) => res.json())
          .then((data) => {
            if (revision === profileWriteRevisionRef.current && data?.success && data.user) {
              // Server wins for persisted fields, but keep the client's just-made
              // local-only changes (linked accounts, privacy, etc.) intact.
              const hydrated = hydrateUser({ ...data.user, ...patch });
              setSessionUser(hydrated);
              localStorage.setItem(userStorageKey, JSON.stringify(hydrated));
            }
          })
          .catch(() => {});
      } catch { /* best effort — local session stays intact */ }
    }
    return true;
  };

  const saveUserProfile = async (nextUserData) => {
    if (!sessionUser || sessionUser.id === 'guest') {
      throw new Error('Log in to save your profile.');
    }
    const revision = ++profileWriteRevisionRef.current;
    const { id: _ignoredId, ...patch } = nextUserData || {};
    const data = await api('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    if (!data?.success || !data.user) {
      throw new Error(data?.error || 'Profile could not be saved.');
    }

    // Use the server response as the saved account state. In particular, don't
    // report a lab group as saved until it has come back from persistent storage.
    const hydrated = hydrateUser({ ...sessionUser, ...data.user });
    if (revision === profileWriteRevisionRef.current) {
      setSessionUser(hydrated);
      localStorage.setItem(userStorageKey, JSON.stringify(hydrated));
    }
    updateAccountProfile(sessionUser.id, data.user);
    return hydrated;
  };

  const hasRole = (roleType) => {
    if (isRoleMocked) return roleType === mockRole || (mockRole === 'readd' && roleType === 'student');
    return user?.hasRole ? user.hasRole(roleType) : user?.role === roleType;
  };

  /**
   * Re-fetch the current user from the server and sync the session + local
   * account store. Used so role changes made on another device (e.g. the
   * admin approving a CR/SR application) show up without a manual reload.
   */
  const refreshUserFromServer = async () => {
    if (!sessionUser) return null;
    try {
      const data = await api('/api/auth/me');
      if (data.success && data.user) {
        const hydrated = hydrateUser(data.user);
        setSessionUser(hydrated);
        localStorage.setItem(userStorageKey, JSON.stringify(hydrated));
        updateAccountProfile(hydrated.id, { role: hydrated.role, roles: hydrated.roles });
        return hydrated;
      }
    } catch (err) {
      console.warn('[Auth] refreshUserFromServer failed:', err.message);
    }
    return null;
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isGuest: !isAuthenticated,
      isLoading,
      login,
      loginDirect,
      loginGuest,
      signup,
      logout,
      updateUser,
      saveUserProfile,
      refreshUserFromServer,
      hasRole,
      isRoleMocked,
      mockRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
