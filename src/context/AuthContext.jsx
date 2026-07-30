import { createContext, useContext, useEffect, useState } from 'react';
import {
  clearSession,
  getInitials,
  guestUser,
  updateAccountProfile,
  getAllAccounts,
} from '../utils/authStorage';

const AuthContext = createContext();
const userStorageKey = 'aust-user-profile';

/** Call server API */
async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok && !data.success) throw new Error(data.error || 'Request failed');
  return data;
}

/**
 * Re-hydrate the user object with a hasRole function since JSON
 * deserialization strips functions.
 */
function hydrateUser(raw) {
  if (!raw) return null;
  const roles = Array.isArray(raw.roles) ? raw.roles : [raw.role];
  // Merge metadata roles
  const metaRoles = [
    raw.department,
    raw.yearSemester,
    raw.labSection ? `lab.${raw.labSection}` : null,
    raw.batchNo ? `batch.${raw.batchNo}` : null,
    raw.section ? `sec.${raw.section}` : null,
  ].filter(Boolean);
  const mergedRoles = [...new Set([...roles, ...metaRoles])];
  return {
    ...raw,
    roles: mergedRoles,
    hasRole(roleType) { return this.roles?.includes(roleType) || this.role === roleType; },
    initials: getInitials(raw.name),
    isGuest: false,
    batchName: raw.batchName || raw.batchNo || '',
  };
}

export function AuthProvider({ children }) {
  const [sessionUser, setSessionUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = Boolean(sessionUser);
  const user = sessionUser ?? guestUser;

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
        } else {
          // Server says not authenticated — clear stale cache
          localStorage.removeItem(userStorageKey);
        }
      } catch (err) {
        // Server unreachable — fall back to cached user so the
        // user doesn't get kicked to the landing page on every
        // server restart / HMR cycle.
        if (cancelled) return;
        console.warn('[Auth] /api/auth/me failed, trying localStorage fallback:', err.message);
        try {
          const cached = localStorage.getItem(userStorageKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.id && parsed.id !== 'guest') {
              const hydrated = hydrateUser(parsed);
              setSessionUser(hydrated);
            }
          }
        } catch { /* ignore corrupt cache */ }
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
    return hydrated;
  };

  const signup = async (payload) => {
    const data = await api('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
    return hydrated;
  };

  const loginDirect = (account) => {
    // For social/OAuth flows — the account was already created/updated
    // on the client side. Start a local session (server auth not involved
    // for OAuth yet, but we still verify via /me).
    const hydrated = hydrateUser({
      id: account.id,
      email: account.email,
      name: account.name,
      role: account.role || 'student',
      department: account.department || '',
      batch: account.batch || '',
      batchNo: account.batchNo || '',
      batchName: account.batchName || '',
      designation: account.designation || '',
      company: account.company || '',
      graduationYear: account.graduationYear || '',
      yearSemester: account.yearSemester || '',
      section: account.section || '',
      labSection: account.labSection || '',
      semester: account.semester || 1,
      avatar: account.avatar || null,
      linkedSocial: account.linkedSocial || {},
      linkedAccounts: account.linkedAccounts || [],
      cgpa: account.cgpa || 0,
      creditsCompleted: account.creditsCompleted || 0,
      totalCredits: account.totalCredits || 160,
    });
    setSessionUser(hydrated);
    localStorage.setItem(userStorageKey, JSON.stringify(hydrated));
    return hydrated;
  };

  const loginGuest = () => {
    const guestAccount = { id: 'guest', role: 'guest', name: 'Guest', email: '', initials: 'GU' };
    setSessionUser(null);
    localStorage.setItem('aust-auth-session-v1', JSON.stringify({
      userId: 'guest', role: 'guest', startedAt: new Date().toISOString(),
    }));
    localStorage.setItem(userStorageKey, JSON.stringify(guestUser));
  };

  const logout = async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* best effort */ }
    clearSession();
    setSessionUser(null);
  };

  const updateUser = (nextUserData) => {
    if (!sessionUser) return false;
    const updatedUser = {
      ...sessionUser,
      ...nextUserData,
      initials: nextUserData.name ? getInitials(nextUserData.name) : sessionUser.initials,
    };
    setSessionUser(updatedUser);
    localStorage.setItem(userStorageKey, JSON.stringify(updatedUser));
    const accountId = nextUserData.id || sessionUser.id;
    updateAccountProfile(accountId, nextUserData);
    return true;
  };

  const hasRole = (roleType) => user?.hasRole ? user.hasRole(roleType) : user?.role === roleType;

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
      hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
