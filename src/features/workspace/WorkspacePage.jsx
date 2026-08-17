import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ExternalLink, BookOpen, Clock, ChevronRight,
  LogIn, Loader2, CheckCircle, AlertCircle, FileText,
  RefreshCw, X, Plus,
  Eye, EyeOff, Settings, CheckSquare, Square,
  Users, Mail, Award,
  File, Image, Video, Link, Clipboard, Megaphone,
} from 'lucide-react';
import './WorkspacePage.css';
import '../../components/PageHero.css';

// ─── Google Classroom OAuth Configuration ───
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
  'https://www.googleapis.com/auth/classroom.profile.emails',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

const API_BASE = 'https://classroom.googleapis.com/v1';
const ACCOUNTS_KEY = 'workspace_accounts';

// ─── Helpers ───
function formatDate(dateStr) {
  if (!dateStr) return 'No due date';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (days < 0) return `Overdue (${formatted})`;
  if (days === 0) return `Due today (${formatted})`;
  if (days === 1) return `Due tomorrow (${formatted})`;
  if (days <= 7) return `Due in ${days} days (${formatted})`;
  return formatted;
}

function getStatusColor(status) {
  // Semantic only: green for completed work, amber for pending, muted otherwise.
  switch (status) {
    case 'TURNED_IN': return 'var(--accent-emerald)';
    case 'RETURNED': return 'var(--accent-amber)';
    case 'NEW': return 'var(--accent-amber)';
    default: return 'var(--text-secondary)';
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'TURNED_IN': return 'Turned In';
    case 'RETURNED': return 'Returned';
    case 'NEW': return 'Pending';
    default: return status || 'Unknown';
  }
}

async function fetchClassroom(endpoint, token) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let detail = '';
    try { const body = await res.json(); detail = body.error?.message || JSON.stringify(body.error || ''); }
    catch { try { detail = await res.text(); } catch {} }
    throw new Error(`Google Classroom API returned ${res.status}: ${detail}`.trim());
  }
  return res.json();
}

// ─── Material type helpers ───
function getMaterialIcon(materials) {
  if (!materials || materials.length === 0) return FileText;
  const mat = materials[0];
  if (mat.driveFile) {
    const mime = mat.driveFile.driveFile?.mimeType || '';
    if (mime.startsWith('image/')) return Image;
    if (mime === 'application/pdf') return FileText;
    if (mime.includes('video/')) return Video;
    return File;
  }
  if (mat.youtubeVideo) return Video;
  if (mat.link) return Link;
  if (mat.form) return Clipboard;
  return File;
}

function getMaterialTypeLabel(materials) {
  if (!materials || materials.length === 0) return 'Text';
  const labels = materials.map(mat => {
    if (mat.driveFile) {
      const mime = mat.driveFile.driveFile?.mimeType || '';
      if (mime.startsWith('image/')) return 'Photo';
      if (mime === 'application/pdf') return 'PDF';
      if (mime.includes('video/')) return 'Video';
      if (mime.includes('spreadsheet')) return 'Sheet';
      if (mime.includes('document') || mime.includes('docs')) return 'Doc';
      if (mime.includes('presentation') || mime.includes('slides')) return 'Slides';
      return 'File';
    }
    if (mat.youtubeVideo) return 'Video';
    if (mat.link) return 'Link';
    if (mat.form) return 'Form';
    return 'File';
  });
  return [...new Set(labels)].join(', ');
}

function getMaterialColor(_materials) {
  // Material type is conveyed by the icon + label, not color — all use the brand accent.
  return 'var(--accent-amber)';
}

function getMaterialLink(materials) {
  if (!materials || materials.length === 0) return null;
  const mat = materials[0];
  if (mat.driveFile) return mat.driveFile.driveFile?.alternateLink || null;
  if (mat.youtubeVideo) return mat.youtubeVideo.video?.alternateLink || null;
  if (mat.link) return mat.link.url || null;
  if (mat.form) return mat.form.form?.url || null;
  return null;
}

function getMaterialTitle(materials) {
  if (!materials || materials.length === 0) return '';
  const mat = materials[0];
  if (mat.driveFile) return mat.driveFile.driveFile?.title || 'Untitled';
  if (mat.youtubeVideo) return mat.youtubeVideo.video?.title || 'Untitled Video';
  if (mat.link) return mat.link.title || mat.link.url || 'Untitled Link';
  if (mat.form) return mat.form.form?.title || 'Untitled Form';
  return 'Untitled';
}

function generateAvatarColor(_email) {
  // Account identity is shown via initials — avatars use the brand accent consistently.
  return 'var(--accent-amber)';
}

// ─── Load accounts from localStorage (with cleanups) ───
function loadAccounts() {
  try {
    const saved = localStorage.getItem(ACCOUNTS_KEY);
    if (!saved) return [];
    const accounts = JSON.parse(saved);
    // 1. Remove ghost accounts that have no email AND no courses (failed auths)
    // 2. Migrate old accounts that lack a unique accountId
    // 3. Deduplicate by email (keep the one with the latest lastFetched)
    const emailMap = new Map();
    for (const acc of accounts) {
      // Skip only completely empty ghost accounts: no email, no googleId, AND no courses
      // Accounts with courses survive even if email is missing (backward compat with old data)
      if (!acc.email && !acc.googleId && (!acc.courses || acc.courses.length === 0)) {
        continue;
      }
      // Ensure accountId
      if (!acc.accountId) {
        acc.accountId = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${Math.random().toString(36).substring(2, 4)}`;
      }
      // Deduplicate by email if present
      if (acc.email) {
        const existing = emailMap.get(acc.email);
        if (existing) {
          // Keep the one with the latest lastFetched
          if ((acc.lastFetched || 0) > (existing.lastFetched || 0)) {
            emailMap.set(acc.email, acc);
          }
        } else {
          emailMap.set(acc.email, acc);
        }
      } else {
        // No email, keep as-is (but it has courses, so it's a valid account)
        emailMap.set(acc.accountId, acc);
      }
    }
    return Array.from(emailMap.values());
  } catch { return []; }
}

function saveAccounts(accounts) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {}
}

function mergeCourses(courseList, existingCourses) {
  return courseList.map(c => ({
    ...c,
    lastViewTime: existingCourses?.find(ex => ex.id === c.id)?.lastViewTime || 0,
  }));
}

export default function WorkspacePage() {
  const [accounts, setAccounts] = useState(loadAccounts);
  const [isLoaded, setIsLoaded] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const [selectedCourse, setSelectedCourse] = useState(null);
  const [coursework, setCoursework] = useState([]);
  const [courseMaterials, setCourseMaterials] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingCoursework, setLoadingCoursework] = useState(false);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [error, setError] = useState(null);
  const [isManaging, setIsManaging] = useState(false);
  const [pendingRemoveEmail, setPendingRemoveEmail] = useState(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [materialsError, setMaterialsError] = useState(null);
  const [pendingAuth, setPendingAuth] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const gsiInitialized = useRef(false);
  const isRefreshFlowRef = useRef(false);
  const findAccountRef = useRef(null);
  const awaitingReauthRef = useRef(false);
  
  // Keep the findAccountRef updated with current accounts
  useEffect(() => {
    findAccountRef.current = (id) => accounts.find(a => a.accountId === id) || null;
  }, [accounts]);

  // ─── Required scopes for materials/announcements ───
  const REQUIRED_MATERIALS_SCOPES = [
    'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
    'https://www.googleapis.com/auth/classroom.announcements.readonly',
  ];

  // ─── Helper: check if an account has materials scopes ───
  function hasMaterialsAccess(acc) {
    if (!acc.grantedScopes || acc.grantedScopes.length === 0) return false;
    return REQUIRED_MATERIALS_SCOPES.every(s => acc.grantedScopes.includes(s));
  }

  // ─── Helper: check if token is expired ───
  function isTokenExpired(acc) {
    if (!acc.expiresAt) return true;
    // Consider expired 5 minutes early to avoid edge-case failures
    return Date.now() >= acc.expiresAt - 300000;
  }

  // ─── Silent token refresh using GIS (no popup) ───
  const silentRefreshToken = useCallback((accountId) => {
    return new Promise((resolve, reject) => {
      if (!window.google?.accounts?.oauth2) {
        reject(new Error('GIS not loaded'));
        return;
      }
      isRefreshFlowRef.current = true;
      
      // Look up the account to get email and googleId for hints
      // Access accounts via a ref to avoid dependency issues
      const acc = findAccountRef.current?.(accountId);
      
      const refreshClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        // Pass the stored email as a hint so Google knows which account to use silently
        ...(acc?.email ? { login_hint: acc.email } : {}),
        callback: (response) => {
          if (response.error) {
            isRefreshFlowRef.current = false;
            reject(new Error(response.error));
            return;
          }
          const scopes = (response.scope || '').split(' ').filter(Boolean);
          const expiresAt = Date.now() + (response.expires_in || 3600) * 1000;
          setAccounts(prev => prev.map(a =>
            a.accountId === accountId
              ? {
                  ...a,
                  accessToken: response.access_token,
                  grantedScopes: scopes,
                  expiresAt,
                  lastFetched: Date.now(),
                }
              : a
          ));
          isRefreshFlowRef.current = false;
          resolve(response.access_token);
        },
        error_callback: () => {
          isRefreshFlowRef.current = false;
          reject(new Error('Token refresh failed'));
        },
      });
      // No prompt = let Google silently return token if session is valid.
      // login_hint above tells Google which account to use.
      refreshClient.requestAccessToken({});
    });
  }, []);

  // ─── Ensure a valid token: refresh if expired, set reauth flag on failure ───
  const getValidToken = useCallback(async (account) => {
    if (!account) return null;
    if (!isTokenExpired(account)) return account.accessToken;
    try {
      const newToken = await silentRefreshToken(account.accountId);
      return newToken;
    } catch (err) {
      console.warn('[Workspace] Token refresh failed, needs re-auth:', err.message);
      setNeedsReauth(true);
      return null;
    }
  }, [silentRefreshToken]);

  // ─── Refresh expired tokens on mount — flag re-auth needed if all fail ───
  useEffect(() => {
    if (!isLoaded || accounts.length === 0 || !tokenClient) return;
    const expiredAccounts = accounts.filter(a => a.accessToken && isTokenExpired(a));
    if (expiredAccounts.length === 0) return;
    console.log(`[Workspace] Refreshing ${expiredAccounts.length} expired token(s)...`);
    
    Promise.allSettled(
      expiredAccounts.map(acc => silentRefreshToken(acc.accountId))
    ).then(results => {
      const allFailed = results.every(r => r.status === 'rejected');
      if (allFailed) {
        console.log('[Workspace] All silent refreshes failed — user must re-authorize');
        setNeedsReauth(true);
      }
    });
  }, [isLoaded, tokenClient]);

  // ─── Proactive token refresh every 25 min to avoid expiry ───
  useEffect(() => {
    if (!isLoaded || accounts.length === 0) return;
    const interval = setInterval(() => {
      const nearExpiry = accounts.filter(a =>
        a.accessToken && Date.now() >= a.expiresAt - 600000
      );
      if (nearExpiry.length === 0) return;
      nearExpiry.forEach(acc => {
        silentRefreshToken(acc.accountId).catch(() => {});
      });
    }, 25 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isLoaded, accounts.length]);

  // ─── Derived: all unique courses from all accounts (only selected ones) ───
  const visibleCourses = accounts.flatMap(acc =>
    (acc.courses || []).filter(c => acc.selectedCourseIds?.includes(c.id))
  );

  // ─── Derived: all accounts with their counts ───
  const accountSummary = accounts.map(acc => ({
    ...acc,
    totalCourses: (acc.courses || []).length,
    selectedCount: (acc.selectedCourseIds || []).length,
  }));

  // ─── Persist accounts whenever they change ───
  useEffect(() => { saveAccounts(accounts); }, [accounts]);

  // ─── Load GIS library ───
  useEffect(() => {
    if (gsiInitialized.current) return;
    gsiInitialized.current = true;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setIsLoaded(true);
    document.head.appendChild(script);
    return () => {
      const s = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (s) document.head.removeChild(s);
    };
  }, []);  // ─── Initialize token client once GIS is loaded ───
  useEffect(() => {
    if (!isLoaded || !window.google?.accounts?.oauth2) return;
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          setError('Authorization failed. Please try again.');
          setIsAuthorizing(false);
          return;
        }
        // If this is a silent refresh flow, skip — handled separately
        if (isRefreshFlowRef.current) return;
        setPendingAuth({
          token: response.access_token,
          scopes: (response.scope || '').split(' ').filter(Boolean),
          expiresIn: response.expires_in || 3600,
        });
        setIsAuthorizing(false);
        setError(null);
      },
      error_callback: () => {
        if (isRefreshFlowRef.current) return;
        setError('Authorization failed. Please try again.');
        setIsAuthorizing(false);
      },
    });
    setTokenClient(client);
  }, [isLoaded]);

  // ─── Process newly obtained token: fetch courses + profile ───
  useEffect(() => {
    if (!pendingAuth) return;
    const { token, scopes, expiresIn } = pendingAuth;
    setPendingAuth(null);

    const expiresAt = Date.now() + (expiresIn || 3600) * 1000;

    (async () => {
      setLoadingCourses(true);
      setError(null);

      let courseList = [];
      let profile = null;
      let profileError = null;

      try {
        const data = await fetchClassroom('/courses?courseStates=ACTIVE&pageSize=100', token);
        courseList = (data.courses || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      } catch (err) {
        console.error('Failed to fetch courses:', err);
        setError(err.message);
        setLoadingCourses(false);
        return;
      }

      // Use Google UserInfo API instead of Classroom profile API
      // (classroom.profile.emails scope may be dropped by Google for unverified apps)
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          profile = await res.json();
        } else {
          let detail = '';
          try { const body = await res.json(); detail = body.error?.message || ''; } catch {}
          throw new Error(detail || `UserInfo API returned ${res.status}`);
        }
      } catch (err) {
        profileError = err.message;
        console.warn('Profile fetch failed (non-critical):', err.message);
      }

      // UserInfo API returns different field names than Classroom profile API
      // https://www.googleapis.com/oauth2/v2/userinfo → { email, name (string), picture, id }
      const email = profile?.email || '';
      const googleId = profile?.id || '';
      const name = typeof profile?.name === 'string' ? profile.name : (profile?.given_name || email.split('@')[0] || '');
      const photoUrl = profile?.picture || '';

      setAccounts(prev => {
        let idx = -1;
        if (email) idx = prev.findIndex(a => a.email === email);
        if (idx < 0 && googleId) idx = prev.findIndex(a => a.googleId === googleId);

        // If we have NO profile info at all (email + googleId empty), try to find
        // an existing account by checking if the new courses overlap with stored courses.
        // This handles the re-auth case where profile API flakes out after page refresh.
        if (idx < 0 && !email && !googleId && courseList.length > 0) {
          // Find the account whose course IDs overlap the most with the fetched courses
          let bestMatch = -1;
          let bestScore = -1;
          prev.forEach((acc, i) => {
            const storedIds = new Set((acc.courses || []).map(c => c.id));
            const score = courseList.filter(c => storedIds.has(c.id)).length;
            if (score > bestScore) {
              bestScore = score;
              bestMatch = i;
            }
          });
          // Only use match if overlap > 0 (at least one common course)
          if (bestMatch >= 0 && bestScore > 0) idx = bestMatch;
        }

        const courseIds = courseList.map(c => c.id);

        if (idx >= 0) {
          const updated = [...prev];
          const existing = updated[idx];
          const keptSelections = (existing.selectedCourseIds || []).filter(id => courseIds.includes(id));
          updated[idx] = {
            ...existing,
            accessToken: token,
            grantedScopes: scopes,
            expiresAt,
            email: email || existing.email,
            googleId: googleId || existing.googleId,
            courses: mergeCourses(courseList, existing.courses),
            selectedCourseIds: keptSelections.length > 0 ? keptSelections : [...courseIds],
            lastFetched: Date.now(),
          };
          return updated;
        }

        // Only create a new account if we actually have an identity (email or name)
        // Otherwise skip — prevents ghost accounts when profile fetch fails
        if (!email && !name) {
          console.warn('[Workspace] No profile info — created without email; finding best match...');
          return prev;
        }

        return [...prev, {
          accountId: email || googleId || `acc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          email,
          googleId,
          name,
          photoUrl,
          accessToken: token,
          grantedScopes: scopes,
          expiresAt,
          courses: courseList.map(c => ({ ...c, lastViewTime: 0 })),
          selectedCourseIds: courseIds,
          lastFetched: Date.now(),
        }];
      });

      setLoadingCourses(false);
      if (profileError && !email) {
        console.info('Profile info unavailable — courses loaded successfully.');
      }
    })();
  }, [pendingAuth]);

  // ─── Re-authorize an account to request full scopes ───
  const handleReauthorize = useCallback(() => {
    if (!tokenClient || isAuthorizing) return;
    setIsAuthorizing(true);
    setError(null);
    // requestAccessToken with prompt=consent forces the consent screen
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }, [tokenClient, isAuthorizing]);

  // ─── Handle Connect (first-time connect only) ───
  const handleConnect = useCallback(() => {
    if (!tokenClient || isAuthorizing) return;
    setIsAuthorizing(true);
    setError(null);
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }, [tokenClient, isAuthorizing]);

  // ─── Refresh a single account (courses list) with token refresh if needed ───
  const refreshAccount = useCallback(async (id) => {
    const account = accounts.find(a => a.accountId === id);
    if (!account) return;

    setLoadingCourses(true);
    setError(null);

    // Get a valid token — refresh if expired
    const token = await getValidToken(account);
    if (!token) {
      setError('Session expired. Please re-authorize this account by clicking the red avatar.');
      setLoadingCourses(false);
      return;
    }

    try {
      const data = await fetchClassroom('/courses?courseStates=ACTIVE&pageSize=100', token);
      const courseList = (data.courses || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const courseIds = courseList.map(c => c.id);

      setAccounts(prev => prev.map(a => {
        if (a.accountId !== account.accountId) return a;
        const kept = (a.selectedCourseIds || []).filter(id => courseIds.includes(id));
        return {
          ...a,
          courses: mergeCourses(courseList, a.courses),
          selectedCourseIds: kept.length > 0 ? kept : [...courseIds],
          lastFetched: Date.now(),
        };
      }));
    } catch (err) {
      console.error('Refresh error:', err);
      setError(err.message);
    }
    setLoadingCourses(false);
  }, [accounts, getValidToken]);

  // ─── Refresh all accounts ───
  const handleRefreshAll = useCallback(() => {
    if (tokenClient && isAuthorizing) return;
    accounts.forEach(acc => refreshAccount(acc.accountId));
  }, [accounts, refreshAccount, tokenClient, isAuthorizing]);

  // ─── Close material preview modal on Escape key ───
  useEffect(() => {
    if (!selectedMaterial) return;
    const handler = (e) => { if (e.key === 'Escape') setSelectedMaterial(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedMaterial]);

  // ─── Remove an account (by accountId or email) ───
  const removeAccount = useCallback((id) => {
    // Find the account first for debugging
    const target = accounts.find(a => a.accountId === id);
    if (!target) {
      // Fallback: try by email
      setAccounts(prev => prev.filter(a => a.email !== id));
    } else {
      setAccounts(prev => prev.filter(a => a.accountId !== id));
    }
    setPendingRemoveEmail(null);
  }, [accounts]);

  // ─── Reset all workspace data ───
  const handleResetAll = useCallback(() => {
    localStorage.removeItem(ACCOUNTS_KEY);
    setAccounts([]);
    setConfirmResetAll(false);
    setSelectedCourse(null);
    setCoursework([]);
    setCourseMaterials([]);
    setError(null);
    setMaterialsError(null);
  }, []);

  // ─── Toggle course selection ───
  const toggleCourseSelection = useCallback((accountId, courseId) => {
    setAccounts(prev => prev.map(a => {
      if (a.accountId !== accountId) return a;
      const selected = a.selectedCourseIds || [];
      const has = selected.includes(courseId);
      return {
        ...a,
        selectedCourseIds: has
          ? selected.filter(id => id !== courseId)
          : [...selected, courseId],
      };
    }));
  }, []);

  // ─── Select/deselect all courses for an account ───
  const toggleSelectAllForAccount = useCallback((id) => {
    setAccounts(prev => prev.map(a => {
      if (a.accountId !== id) return a;
      const allSelected = (a.courses || []).length === (a.selectedCourseIds || []).length;
      return {
        ...a,
        selectedCourseIds: allSelected ? [] : (a.courses || []).map(c => c.id),
      };
    }));
  }, []);

  // ─── Fetch coursework for selected course (with auto token refresh) ───
  const handleCourseClick = useCallback(async (course) => {
    if (isManaging) {
      for (const acc of accounts) {
        if ((acc.courses || []).some(c => c.id === course.id)) {
          toggleCourseSelection(acc.accountId, course.id);
          return;
        }
      }
      return;
    }

    setSelectedCourse(course);

    // Mark this course as viewed
    setAccounts(prev => prev.map(acc => ({
      ...acc,
      courses: (acc.courses || []).map(c =>
        c.id === course.id ? { ...c, lastViewTime: Date.now() } : c
      ),
    })));

    setLoadingCoursework(true);
    setLoadingMaterials(true);
    setCoursework([]);
    setCourseMaterials([]);
    setMaterialsError(null);

    const owner = accounts.find(acc =>
      (acc.courses || []).some(c => c.id === course.id)
    );

    // Get valid token — refresh silently if expired; if that fails, show consent popup
    const token = await getValidToken(owner);
    if (!token) {
      // User just clicked a course — direct user interaction, popup won't be blocked
      awaitingReauthRef.current = true;
      // IMPORTANT: clear the refresh flow flag so the main tokenClient callback
      // is NOT skipped when the consent popup callback fires.
      isRefreshFlowRef.current = false;
      setIsAuthorizing(true);
      tokenClient?.requestAccessToken({ prompt: 'consent' });
      // Keep loading states true — the useEffect watching accounts will
      // re-trigger handleCourseClick once the token is refreshed
      return;
    }

    try {
      const data = await fetchClassroom(`/courses/${course.id}/courseWork?pageSize=50&orderBy=dueDate`, token);
      const items = data.courseWork || [];
      const itemsWithStatus = await Promise.all(
        items.map(async (cw) => {
          try {
            const subData = await fetchClassroom(
              `/courses/${course.id}/courseWork/${cw.id}/studentSubmissions?states=NEW,TURNED_IN,RETURNED`,
              token,
            );
            const subs = subData.studentSubmissions || [];
            const latestState = subs.length > 0 ? subs[0].state : 'NEW';
            return { ...cw, submissionState: latestState };
          } catch { return { ...cw, submissionState: 'NEW' }; }
        })
      );
      setCoursework(itemsWithStatus);
    } catch { setCoursework([]); }
    setLoadingCoursework(false);

    // Fetch materials & announcements with proper error logging
    // Token was already validated by getValidToken above
    const materialsErrors = [];
    try {
      const [matData, annData] = await Promise.all([
        fetchClassroom(`/courses/${course.id}/courseWorkMaterials?pageSize=50`, token).catch(err => {
          console.error('[Workspace] courseWorkMaterials API error:', err.message);
          materialsErrors.push(`Materials: ${err.message}`);
          return { courseWorkMaterial: [] };
        }),
        fetchClassroom(`/courses/${course.id}/announcements?pageSize=50`, token).catch(err => {
          console.error('[Workspace] announcements API error:', err.message);
          materialsErrors.push(`Announcements: ${err.message}`);
          return { announcements: [] };
        }),
      ]);
      const allMaterials = [
        ...(annData.announcements || []).map(a => ({ ...a, _itemType: 'announcement' })),
        ...(matData.courseWorkMaterial || []).map(m => ({ ...m, _itemType: 'material' })),
      ].sort((a, b) => {
        const dateA = a.creationTime || a.updateTime || '';
        const dateB = b.creationTime || b.updateTime || '';
        return dateB.localeCompare(dateA);
      });
      setCourseMaterials(allMaterials);
      if (materialsErrors.length > 0) {
        setMaterialsError(materialsErrors.join('; '));
      } else {
        setMaterialsError(null);
      }
    } catch (err) {
      console.error('[Workspace] Failed to fetch materials:', err);
      setCourseMaterials([]);
      setMaterialsError(err.message || 'Unknown error fetching materials');
    }
    setLoadingMaterials(false);
  }, [accounts, isManaging, toggleCourseSelection, getValidToken]);

  // ─── Auto-retry loading course data after re-auth completes ───
  useEffect(() => {
    if (!awaitingReauthRef.current || !selectedCourse) return;
    const owner = accounts.find(acc =>
      (acc.courses || []).some(c => c.id === selectedCourse.id)
    );
    if (owner && !isTokenExpired(owner)) {
      awaitingReauthRef.current = false;
      handleCourseClick(selectedCourse);
    }
  }, [accounts, selectedCourse, handleCourseClick]);

  const handleBack = useCallback(() => {
    setSelectedCourse(null);
    setCoursework([]);
    setCourseMaterials([]);
    setMaterialsError(null);
  }, []);

  const needsConfig = GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

  return (
    <div className="workspace-page animate-fadeIn">
      {/* Masthead */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <ExternalLink size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Productivity</span>
            <div className="schedule-title">Workspace</div>
            <span className="schedule-subtitle">Connect multiple Google Classroom accounts and choose which courses to track.</span>
          </div>
        </div>
        <div className="schedule-masthead-center" />
      </div>

      <div className="schedule-dotted-divider" style={{ marginTop: 0 }} />

      {/* Quick Stats Row */}
      {accounts.length > 0 && (
        <div className="workspace-stats-row animate-fadeInUp" style={{ animationDelay: '0.25s' }}>
          <div className="workspace-quick-stat-card">
            <div className="workspace-quick-stat-shine" aria-hidden="true" />
            <div className="workspace-quick-stat-icon" style={{ background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>
              <Users size={18} />
            </div>
            <div className="workspace-quick-stat-body">
              <span className="workspace-quick-stat-value" style={{ color: 'var(--accent-amber)' }}>{accounts.length}</span>
              <span className="workspace-quick-stat-label">Connected Accounts</span>
            </div>
            <div className="workspace-quick-stat-bar" style={{ background: 'var(--accent-amber)' }} aria-hidden="true" />
          </div>
          <div className="workspace-quick-stat-card">
            <div className="workspace-quick-stat-shine" aria-hidden="true" />
            <div className="workspace-quick-stat-icon" style={{ background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>
              <BookOpen size={18} />
            </div>
            <div className="workspace-quick-stat-body">
              <span className="workspace-quick-stat-value" style={{ color: 'var(--accent-amber)' }}>{visibleCourses.length}</span>
              <span className="workspace-quick-stat-label">Visible Courses</span>
            </div>
            <div className="workspace-quick-stat-bar" style={{ background: 'var(--accent-amber)' }} aria-hidden="true" />
          </div>
          <div className="workspace-quick-stat-card">
            <div className="workspace-quick-stat-shine" aria-hidden="true" />
            <div className="workspace-quick-stat-icon" style={{ background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>
              <ExternalLink size={18} />
            </div>
            <div className="workspace-quick-stat-body">
              <span className="workspace-quick-stat-value" style={{ color: 'var(--accent-amber)' }}>{accounts.reduce((sum, a) => sum + (a.courses || []).length, 0)}</span>
              <span className="workspace-quick-stat-label">Total Courses</span>
            </div>
            <div className="workspace-quick-stat-bar" style={{ background: 'var(--accent-amber)' }} aria-hidden="true" />
          </div>
        </div>
      )}

      {needsConfig && (
        <div className="workspace-config-warning">
          <AlertCircle size={18} />
          <div>
            <strong>Google Classroom API not configured.</strong>
            <p>Set <code>VITE_GOOGLE_CLIENT_ID</code> in <code>.env</code>.</p>
          </div>
        </div>
      )}

      {/* ─── Account Bar ─── */}
      {accounts.length > 0 && (
        <div className="workspace-account-bar">
          <div className="workspace-account-avatars">
            {accountSummary.map((acc) => (
              <div key={acc.accountId} className="workspace-account-chip">
                <div
                  className="workspace-account-avatar"
                  style={{
                    background: !hasMaterialsAccess(acc)
                      ? 'var(--accent-rose)'
                      : isTokenExpired(acc)
                        ? 'var(--accent-amber)'
                        : generateAvatarColor(acc.email || acc.accountId),
                    boxShadow: !hasMaterialsAccess(acc)
                      ? '0 0 0 2px var(--accent-rose)'
                      : isTokenExpired(acc)
                        ? '0 0 0 2px var(--accent-amber)'
                        : 'none',
                  }}
                  title={`${acc.name} — ${acc.selectedCount}/${acc.totalCourses} courses${!hasMaterialsAccess(acc) ? ' · ⚠️ No materials access' : isTokenExpired(acc) ? ' · 🔑 Session expired — click to re-authorize' : ''}`}
                  onClick={() => {
                    if (isTokenExpired(acc)) {
                      // Re-authorize this account by re-triggering connect
                      if (tokenClient) {
                        setIsAuthorizing(true);
                        setError(null);
                        tokenClient.requestAccessToken({ prompt: 'consent' });
                      }
                    } else {
                      refreshAccount(acc.accountId);
                    }
                  }}
                >
                  {hasMaterialsAccess(acc) ? (acc.name || '?').charAt(0).toUpperCase() : <X size={14} />}
                </div>
                <div className="workspace-account-chip-info">
                  <span className="workspace-account-chip-name">{acc.name}</span>
                  {acc.email && <span className="workspace-account-chip-email">{acc.email}</span>}
                  <span className="workspace-account-chip-count" style={{ color: !hasMaterialsAccess(acc) ? 'var(--accent-rose)' : isTokenExpired(acc) ? 'var(--accent-amber)' : 'var(--accent-amber)' }}>
                    {acc.selectedCount}/{acc.totalCourses} courses
                    {!hasMaterialsAccess(acc) ? ` · ⚠️ No materials` : isTokenExpired(acc) ? ` · 🔑 Expired` : ''}
                  </span>
                </div>
                <button
                  className="workspace-account-remove-btn"
                  onClick={() => setPendingRemoveEmail(acc.accountId)}
                  title="Remove account"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button className="workspace-account-add-btn" onClick={handleConnect} disabled={!tokenClient || isAuthorizing}>
              <Plus size={16} />
              <span>Add Account</span>
            </button>
            {accounts.some(acc => !hasMaterialsAccess(acc)) && (
              <button className="workspace-account-add-btn" onClick={handleReauthorize} disabled={!tokenClient || isAuthorizing} style={{ borderColor: 'var(--accent-rose)', color: 'var(--accent-rose)' }}>
                <RefreshCw size={14} />
                <span>Re-authorize for Materials</span>
              </button>
            )}
            {accounts.some(acc => isTokenExpired(acc)) && (
              <button className="workspace-account-add-btn" onClick={handleReauthorize} disabled={!tokenClient || isAuthorizing} style={{ borderColor: 'var(--accent-amber)', color: 'var(--accent-amber)' }}>
                <RefreshCw size={14} />
                <span>Refresh Expired Session</span>
              </button>
            )}
          </div>
          <div className="workspace-account-actions">
            <button
              className="workspace-btn workspace-btn-secondary"
              onClick={handleRefreshAll}
              disabled={loadingCourses}
            >
              <RefreshCw size={14} className={loadingCourses ? 'workspace-spin' : ''} />
              Refresh All
            </button>
            <button
              className={`workspace-btn ${isManaging ? 'workspace-btn-active' : 'workspace-btn-ghost'}`}
              onClick={() => setIsManaging(v => !v)}
            >
              {isManaging ? <CheckSquare size={14} /> : <Settings size={14} />}
              {isManaging ? 'Done' : 'Manage Courses'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Confirm Remove Dialog ─── */}
      {pendingRemoveEmail && (() => {
        const acc = accounts.find(a => a.accountId === pendingRemoveEmail);
        return (
          <div className="workspace-confirm-overlay" onClick={() => setPendingRemoveEmail(null)}>
            <div className="workspace-confirm-dialog" onClick={e => e.stopPropagation()}>
              <h3>Remove Account?</h3>
              <p style={{ margin: '4px 0' }}>
                <strong>{acc?.name || 'Unknown'}</strong>
                {acc?.email && <> ({acc.email})</>}
              </p>
              <p>
                Courses from this account will be hidden. You can re-add it anytime.
              </p>
              <div className="workspace-confirm-actions">
                <button className="workspace-btn workspace-btn-secondary" onClick={() => setPendingRemoveEmail(null)}>
                  Cancel
                </button>
                <button className="workspace-btn workspace-btn-danger" onClick={() => removeAccount(pendingRemoveEmail)}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── No Accounts: Connect Card ─── */}
      {accounts.length === 0 && (
        <div className="workspace-connect-card">
          <div className="workspace-connect-icon"><ExternalLink size={36} /></div>
          <h2 className="workspace-connect-title">Connect Google Classroom</h2>
          <p className="workspace-connect-desc">
            Sign in with your AUST Google accounts to see all your courses, assignments, and deadlines — unified in one place.
          </p>
          <button
            className="workspace-connect-btn"
            onClick={handleConnect}
            disabled={!isLoaded || isAuthorizing || needsConfig}
          >
            {!isLoaded ? (
              <><Loader2 size={18} className="workspace-spin" /> Loading Google API...</>
            ) : isAuthorizing ? (
              <><Loader2 size={18} className="workspace-spin" /> Authorizing...</>
            ) : (
              <><LogIn size={18} /> Sign in with Google Classroom</>
            )}
          </button>
          {error && <p className="workspace-error">{error}</p>}
        </div>
      )}

      {/* ─── Scope Warning Banner ─── */}
      {accounts.some(acc => !hasMaterialsAccess(acc)) && (
        <div className="workspace-manage-banner" style={{ background: 'var(--accent-rose-glow)', borderColor: 'var(--accent-rose)', color: 'var(--accent-rose)', flexWrap: 'wrap' }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div style={{ flex: 1, minWidth: 0, lineHeight: '1.6' }}>
            <strong>🔒 Materials &amp; announcements not loading.</strong>
            <br />
            Your Google account was not granted access to course materials because these are{' '}
            <strong>restricted scopes</strong> required by Google.{' '}
            To fix this:
            <ol style={{ margin: '4px 0 0 18px', padding: 0, fontSize: 'var(--fs-xs)' }}>
              <li>
                Go to{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials/consent"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  Google Cloud Console → OAuth consent screen
                </a>
              </li>
              <li>Add your email (<strong>{accounts.find(a => !hasMaterialsAccess(a))?.email || 'your AUST email'}</strong>) as a <strong>Test User</strong></li>
              <li>Then click{' '}
                <button
                  onClick={handleReauthorize}
                  disabled={!tokenClient || isAuthorizing}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    font: 'inherit',
                    fontWeight: 'var(--fw-bold)',
                    padding: 0,
                  }}
                >
                  Re-authorize below
                </button>
                {' '}and check ALL permissions
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* ─── Re-auth Needed Banner ─── */}
      {needsReauth && (
        <div className="workspace-manage-banner" style={{ background: 'var(--accent-amber-glow)', borderColor: 'var(--accent-amber)', color: 'var(--accent-amber)', flexWrap: 'wrap' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong>Session expired.</strong> Your Google Classroom session has timed out.
            {' '}Click the button to sign in again and restore access to all your courses.
          </span>
          <button
            className="workspace-btn"
            style={{
              background: 'var(--accent-amber)',
              color: '#fff',
              border: 'none',
              fontWeight: 'var(--fw-bold)',
              fontSize: 'var(--fs-sm)',
            }}
            onClick={() => {
              setNeedsReauth(false);
              setError(null);
              setIsAuthorizing(true);
              tokenClient?.requestAccessToken({ prompt: 'consent' });
            }}
            disabled={!tokenClient || isAuthorizing}
          >
            <LogIn size={14} />
            {isAuthorizing ? 'Connecting...' : 'Re-authorize Now'}
          </button>
        </div>
      )}

      {/* ─── Manage Mode Banner ─── */}
      {isManaging && accounts.length > 0 && (
        <div className="workspace-manage-banner">
          <EyeOff size={16} />
          <span>Tap any course to toggle its visibility. Only visible courses appear in the grid.</span>
        </div>
      )}

      {/* ─── Loading ─── */}
      {loadingCourses && (
        <div className="workspace-loading"><Loader2 size={20} className="workspace-spin" /><span>Refreshing courses...</span></div>
      )}

      {/* ─── Error ─── */}
      {error && (
        <div className="workspace-error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {/* ─── Course Detail View (Split Pane) ─── */}
      {selectedCourse ? (
        <div className="workspace-course-detail">
          <button className="workspace-back-btn" onClick={handleBack}>
            <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /> Back to Courses
          </button>
          <div className="workspace-course-header">
            <div className="workspace-course-color" style={{ background: 'var(--accent-amber)' }} />
            <div>
              <h2 className="workspace-course-title">{selectedCourse.name}</h2>
              <p className="workspace-course-meta">
                {selectedCourse.section && `${selectedCourse.section} · `}
                {selectedCourse.descriptionHeading || ''}
              </p>
            </div>
          </div>

          <div className="workspace-split-pane">
            {/* ─── Left: Assignments ─── */}
            <div className="workspace-pane workspace-pane-left">
              <div className="workspace-pane-header">
                <div className="workspace-pane-header-icon" style={{ background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>
                  <Clipboard size={14} />
                </div>
                <span className="workspace-pane-header-title">Assignments</span>
                {!loadingCoursework && <span className="workspace-pane-header-count">{coursework.length}</span>}
              </div>

              {loadingCoursework ? (
                <div className="workspace-pane-loading"><Loader2 size={16} className="workspace-spin" /><span>Loading...</span></div>
              ) : coursework.length === 0 ? (
                <div className="workspace-pane-empty">
                  <FileText size={24} />
                  <span>No assignments yet</span>
                </div>
              ) : (
                <div className="workspace-pane-scroll">
                  {coursework.map((cw) => {
                    const dueDate = cw.dueDate ? new Date(cw.dueDate.year, cw.dueDate.month - 1, cw.dueDate.day, cw.dueTime?.hours || 23, cw.dueTime?.minutes || 59) : null;
                    return (
                      <div key={cw.id} className="workspace-material-item workspace-material-item-assignment">
                        <div className="workspace-material-item-badge" style={{ background: getStatusColor(cw.submissionState) }}>
                          {cw.submissionState === 'TURNED_IN' ? <CheckCircle size={12} /> : cw.submissionState === 'RETURNED' ? <Award size={12} /> : <Clock size={12} />}
                        </div>
                        <div className="workspace-material-item-body">
                          <span className="workspace-material-item-title">{cw.title}</span>
                          <span className="workspace-material-item-meta">
                            <span style={{ color: getStatusColor(cw.submissionState) }}>{getStatusLabel(cw.submissionState)}</span>
                            {dueDate && (
                              <>
                                <span className="workspace-mat-sep">·</span>
                                <span className={dueDate < new Date() && cw.submissionState !== 'TURNED_IN' ? 'workspace-overdue' : ''}>{formatDate(dueDate.toISOString())}</span>
                              </>
                            )}
                            {cw.maxPoints && <><span className="workspace-mat-sep">·</span><span>{cw.maxPoints} pts</span></>}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── Right: Materials ─── */}
            <div className="workspace-pane workspace-pane-right">
              <div className="workspace-pane-header">
                <div className="workspace-pane-header-icon" style={{ background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>
                  <BookOpen size={14} />
                </div>
                <span className="workspace-pane-header-title">Materials</span>
                {!loadingMaterials && <span className="workspace-pane-header-count">{courseMaterials.length}</span>}
              </div>

              {loadingMaterials ? (
                <div className="workspace-pane-loading"><Loader2 size={16} className="workspace-spin" /><span>Loading...</span></div>
              ) : materialsError && courseMaterials.length === 0 ? (
                <div className="workspace-pane-empty">
                  <AlertCircle size={24} style={{ color: 'var(--accent-rose)' }} />
                  <span style={{ color: 'var(--accent-rose)', fontSize: 'var(--fs-sm)', textAlign: 'center', maxWidth: '280px' }}>
                    Could not load materials. The API may require additional permissions.
                  </span>
                  <button
                    className="workspace-btn workspace-btn-secondary"
                    style={{ marginTop: 'var(--sp-2)' }}
                    onClick={() => {
                      if (selectedCourse && accounts.length > 0) {
                        handleCourseClick(selectedCourse);
                      }
                    }}
                  >
                    <RefreshCw size={14} /> Retry
                  </button>
                  {(() => {
                    // Show scopes for the account that owns this course
                    const owner = accounts.find(acc =>
                      (acc.courses || []).some(c => c.id === selectedCourse?.id)
                    );
                    const scopes = owner?.grantedScopes || [];
                    if (scopes.length > 0) return (
                      <div style={{ marginTop: 'var(--sp-3)', fontSize: '9px', color: 'var(--text-tertiary)', maxWidth: '300px', wordBreak: 'break-all', textAlign: 'center' }}>
                        <details>
                          <summary style={{ cursor: 'pointer', color: 'var(--accent-amber)' }}>Debug: granted scopes</summary>
                          <ul style={{ textAlign: 'left', marginTop: '4px', paddingLeft: '16px', lineHeight: '1.6' }}>
                            {scopes.map((s, i) => (
                              <li key={i} style={{ fontSize: '8px' }}>{s}</li>
                            ))}
                          </ul>
                        </details>
                      </div>
                    );
                    return null;
                  })()}
                </div>
              ) : courseMaterials.length === 0 ? (
                <div className="workspace-pane-empty">
                  <BookOpen size={24} />
                  <span>No materials yet</span>
                </div>
              ) : (
                <div className="workspace-pane-scroll">
                  {courseMaterials.map((item) => {
                    const MatIcon = item.materials && item.materials.length > 0 ? getMaterialIcon(item.materials) : Megaphone;
                    const matColor = item.materials && item.materials.length > 0 ? getMaterialColor(item.materials) : 'var(--accent-amber)';
                    const matLabel = item.materials && item.materials.length > 0 ? getMaterialTypeLabel(item.materials) : 'Announcement';
                    const displayTitle = item.title || item.text?.substring(0, 80) || (item.materials ? getMaterialTitle(item.materials) : 'Untitled');
                    return (
                      <div
                        key={item.id}
                        className={`workspace-material-item ${item._itemType === 'announcement' ? 'workspace-material-item-announce' : ''} workspace-material-item-clickable`}
                        onClick={() => setSelectedMaterial(item)}
                      >
                        <div className="workspace-material-item-badge" style={{ background: matColor }}>
                          {item._itemType === 'announcement' ? <Megaphone size={14} /> : <MatIcon size={14} />}
                        </div>
                        <div className="workspace-material-item-body">
                          <div className="workspace-material-item-header">
                            <span className="workspace-material-item-title" title={displayTitle}>{displayTitle}</span>
                            <span className="workspace-material-item-expand">
                              <ExternalLink size={11} />
                            </span>
                          </div>
                          <span className="workspace-material-item-meta">
                            <span className="workspace-material-item-type-badge" style={{ background: `${matColor}18`, color: matColor }}>
                              {item._itemType === 'announcement' ? 'Announcement' : matLabel}
                            </span>
                            {item.creationTime && (
                              <>
                                <span className="workspace-mat-sep">·</span>
                                <span>{new Date(item.creationTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                              </>
                            )}
                          </span>
                          {(item.text || item.description) && (
                            <p className="workspace-material-item-desc">
                              {(item.text || item.description || '').substring(0, 120)}
                              {(item.text || item.description || '').length > 120 ? '...' : ''}
                            </p>
                          )}
                          {item.materials && item.materials.length > 0 && (
                            <span className="workspace-material-item-attachments">
                              {item.materials.length} attachment{item.materials.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ─── Course Grid (only visible/selected courses) ─── */
        <>
          {/* Manage mode: select-all per account */}
          {isManaging && accountSummary.map(acc => {
            const total = (acc.courses || []).length;
            const selected = (acc.selectedCourseIds || []).length;
            if (total === 0) return null;
            const allSelected = total === selected;
            const key = acc.accountId;
            return (
              <div key={key} className="workspace-manage-account-header">
                <div className="workspace-manage-account-info">
                  <div className="workspace-account-avatar-sm" style={{ background: generateAvatarColor(acc.email || key) }}>
                    {(acc.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <span>{acc.name}{acc.email && <span> ({acc.email})</span>}</span>
                </div>
                <button className="workspace-btn workspace-btn-ghost workspace-btn-sm" onClick={() => toggleSelectAllForAccount(key)}>
                  {allSelected ? <EyeOff size={14} /> : <Eye size={14} />}
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            );
          })}

          {isManaging && (
            /* Show all courses in manage mode (even unselected ones so user can toggle them on) */              <div className="workspace-course-grid workspace-course-grid-manage">
              {accounts.flatMap(acc =>
                (acc.courses || []).map(course => {
                  const isSelected = (acc.selectedCourseIds || []).includes(course.id);
                  const accKey = acc.accountId;
                  const hasNew = course.updateTime && course.lastViewTime
                    ? new Date(course.updateTime).getTime() > course.lastViewTime
                    : false;
                  return (
                    <button
                      key={`${accKey}-${course.id}`}
                      className={`workspace-course-card${hasNew ? ' has-new' : ''} ${isSelected ? '' : 'workspace-course-card-hidden'}`}
                      onClick={() => toggleCourseSelection(accKey, course.id)}
                    >
                      {hasNew && <span className="workspace-course-card-dot" />}
                      <div className="workspace-course-card-color" style={{ background: isSelected ? 'var(--accent-amber)' : 'var(--border-primary)' }} />
                      <div className="workspace-course-card-body">
                        <div className="workspace-course-card-toggle">
                          {isSelected ? <CheckSquare size={18} className="workspace-course-checked" /> : <Square size={18} className="workspace-course-unchecked" />}
                          <span className="workspace-course-card-toggle-label">{isSelected ? 'Visible' : 'Hidden'}</span>
                        </div>
                        <h3 className="workspace-course-card-title">{course.name}</h3>
                        {course.section && <span className="workspace-course-card-section">{course.section}</span>}
                        {acc.email && (
                          <div className="workspace-course-card-account">
                            <Mail size={10} />
                            <span>{acc.email}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {!isManaging && (
            /* Normal mode: only show selected courses */
            <div className="workspace-course-grid">
              {accounts.flatMap(acc =>
                (acc.courses || [])
                  .filter(course => (acc.selectedCourseIds || []).includes(course.id))
                  .map(course => {
                    const accKey = acc.accountId;
                    const hasNew = course.updateTime && course.lastViewTime
                      ? new Date(course.updateTime).getTime() > course.lastViewTime
                      : false;
                    return (
                    <button
                      key={`${accKey}-${course.id}`}
                      className={`workspace-course-card${hasNew ? ' has-new' : ''}`}
                      onClick={() => handleCourseClick(course)}
                    >
                      {hasNew && <span className="workspace-course-card-dot" />}
                      <div className="workspace-course-card-color" style={{ background: 'var(--accent-amber)' }} />
                      <div className="workspace-course-card-body">
                        <h3 className="workspace-course-card-title">{course.name}</h3>
                        {course.section && <span className="workspace-course-card-section">{course.section}</span>}
                        {course.descriptionHeading && <p className="workspace-course-card-desc">{course.descriptionHeading}</p>}
                        {acc.email && (
                          <div className="workspace-course-card-account">
                            <Mail size={10} />
                            <span>{acc.email}</span>
                          </div>
                        )}
                      </div>
                      <div className="workspace-course-card-footer">
                        <span className="workspace-course-card-link">View Assignments <ChevronRight size={14} /></span>
                      </div>
                    </button>
                  )})
              )}

              {visibleCourses.length === 0 && !loadingCourses && (
                <div className="workspace-empty">
                  <BookOpen size={40} />
                  <h3>No courses visible</h3>
                  <p>
                    {accounts.length > 0
                      ? 'All courses are hidden. Click "Manage Courses" to show some courses.'
                      : 'Connect a Google Classroom account to get started.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {accounts.length > 0 && (
        <div className="workspace-footer-note" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <Users size={12} />
            {accounts.length} account{accounts.length > 1 ? 's' : ''} connected · {visibleCourses.length} course{visibleCourses.length !== 1 ? 's' : ''} visible
          </span>
          <button
            className="workspace-btn workspace-btn-ghost workspace-btn-sm"
            style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}
            onClick={() => setConfirmResetAll(true)}
          >
            Reset All Data
          </button>
        </div>
      )}

      {/* ─── Confirm Reset All Dialog ─── */}
      {confirmResetAll && (
        <div className="workspace-confirm-overlay" onClick={() => setConfirmResetAll(false)}>
          <div className="workspace-confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>Reset All Workspace Data?</h3>
            <p>
              This will <strong>permanently remove</strong> all connected accounts, courses, and settings.
              You will need to connect Google Classroom again.
            </p>
            <div className="workspace-confirm-actions">
              <button className="workspace-btn workspace-btn-secondary" onClick={() => setConfirmResetAll(false)}>
                Cancel
              </button>
              <button className="workspace-btn workspace-btn-danger" onClick={handleResetAll}>
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Material Preview Modal ─── */}
      {selectedMaterial && (() => {
        const item = selectedMaterial;
        const MatIcon = item.materials && item.materials.length > 0 ? getMaterialIcon(item.materials) : Megaphone;
        const matColor = item.materials && item.materials.length > 0 ? getMaterialColor(item.materials) : 'var(--accent-amber)';
        const matLabel = item.materials && item.materials.length > 0 ? getMaterialTypeLabel(item.materials) : 'Announcement';
        const displayTitle = item.title || item.text?.substring(0, 80) || (item.materials ? getMaterialTitle(item.materials) : 'Untitled');
        const fullText = item.text || item.description || '';

        return (
          <div className="workspace-material-overlay" onClick={() => setSelectedMaterial(null)}>
            <div className="workspace-material-modal" onClick={e => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="workspace-material-modal-header">
                <div className="workspace-material-modal-badge" style={{ background: matColor }}>
                  <MatIcon size={18} />
                </div>
                <div className="workspace-material-modal-header-text">
                  <h2 className="workspace-material-modal-title">{displayTitle}</h2>
                  <div className="workspace-material-modal-meta">
                    <span className="workspace-material-item-type-badge" style={{ background: `${matColor}18`, color: matColor }}>
                      {item._itemType === 'announcement' ? 'Announcement' : matLabel}
                    </span>
                    {item.creationTime && (
                      <>
                        <span className="workspace-mat-sep">·</span>
                        <span>{new Date(item.creationTime).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                      </>
                    )}
                  </div>
                </div>
                <button className="workspace-material-modal-close" onClick={() => setSelectedMaterial(null)}>
                  <X size={18} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="workspace-material-modal-body">
                {fullText ? (
                  <div className="workspace-material-modal-text">
                    {fullText.split('\n').map((line, i) => (
                      <p key={i}>{line || '\u00A0'}</p>
                    ))}
                  </div>
                ) : (
                  <div className="workspace-material-modal-text workspace-material-modal-text-empty">
                    <p>No additional text content.</p>
                  </div>
                )}

                {/* Attached Materials */}
                {item.materials && item.materials.length > 0 && (
                  <div className="workspace-material-modal-attachments">
                    <h3 className="workspace-material-modal-section-title">
                      <FileText size={14} />
                      Attachments ({item.materials.length})
                    </h3>
                    <div className="workspace-material-modal-attachment-list">
                      {item.materials.map((mat, i) => {
                        const mColor = getMaterialColor([mat]);
                        const mTitle = getMaterialTitle([mat]);
                        const mLink = getMaterialLink([mat]);
                        const mType = getMaterialTypeLabel([mat]);
                        return (
                          <a
                            key={i}
                            href={mLink || '#'}
                            target={mLink ? '_blank' : undefined}
                            rel={mLink ? 'noopener noreferrer' : undefined}
                            className="workspace-material-modal-attachment"
                            style={{ borderLeftColor: mColor }}
                            onClick={!mLink ? e => e.preventDefault() : undefined}
                          >
                            <div className="workspace-material-modal-attachment-icon" style={{ background: `${mColor}18`, color: mColor }}>
                              <mIcon size={18} />
                            </div>
                            <div className="workspace-material-modal-attachment-info">
                              <span className="workspace-material-modal-attachment-name">{mTitle}</span>
                              <span className="workspace-material-modal-attachment-type">{mType}</span>
                            </div>
                            {mLink && <ExternalLink size={14} className="workspace-material-modal-attachment-link" />}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Source course info */}
                <div className="workspace-material-modal-footer">
                  <BookOpen size={12} />
                  <span>
                    From: <strong>{selectedCourse?.name || 'Unknown course'}</strong>
                    {item.creator?.userId && (
                      <> · Posted by user ID: {item.creator.userId}</>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
