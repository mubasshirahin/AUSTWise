import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ExternalLink, BookOpen, Clock, ChevronRight, ArrowLeft,
  LogIn, Loader2, CheckCircle, AlertCircle, AlertTriangle, FileText,
  RefreshCw, X, Plus, Search, MoreVertical, Trash2,
  Eye, EyeOff, Settings, CheckSquare, Square,
  Users, Mail, Award, CalendarClock, TrendingUp, GraduationCap, Layers,
  File, Image, Video, Link, Clipboard, Megaphone,
} from 'lucide-react';
import './WorkspacePage.css';
import '../daily-life/DailyMasthead.css';
import { useAuth } from '../../context/AuthContext';

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

// ─── Overview (cross-course deadlines) ───
const OVERVIEW_KEY = 'workspace_overview';
const OVERVIEW_TTL = 10 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

function loadOverview() {
  try { return JSON.parse(localStorage.getItem(OVERVIEW_KEY)) || {}; } catch { return {}; }
}
function saveOverview(overview) {
  try { localStorage.setItem(OVERVIEW_KEY, JSON.stringify(overview)); } catch {}
}

// Classroom due dates/times are UTC. No dueTime = end of that day.
function dueOf(cw) {
  if (!cw?.dueDate) return null;
  const { year, month, day } = cw.dueDate;
  const h = cw.dueTime ? (cw.dueTime.hours || 0) : 23;
  const m = cw.dueTime ? (cw.dueTime.minutes || 0) : 59;
  return Date.UTC(year, month - 1, day, h, m);
}

function compactWork(cw) {
  return {
    id: cw.id,
    title: cw.title || 'Untitled',
    due: dueOf(cw),
    state: cw.submissionState || 'NEW',
    maxPoints: cw.maxPoints || null,
    link: cw.alternateLink || null,
    // Teacher picked individual students and none of them is this one
    notMine: cw.assigneeMode === 'INDIVIDUAL_STUDENTS' && cw.submissionsKnown && !cw.hasSubmission,
  };
}

// ─── Lab groups / sections ───
// Every group's task is posted to the whole class; who it's for is written in
// the title: "Online 3 - A2", "Quiz – B1", "Task -A1/A2", "Viva (C2)", "Lab 4 [B2]",
// "Online 2 for B2. Upload here", "Proposal Submission - B sec", "Report (Section A)".
// Lab tag: a standalone A1…H2 token anywhere ("A 2" only at the very end).
const LAB_TOKEN_RE = /(?<![A-Za-z0-9])([A-H][12])(?![A-Za-z0-9])/gi;
const LAB_SPACED_END_RE = /(?:^|[^A-Za-z0-9])([A-H]) ([12])[\s)\]}.,;:!*]*$/i;
// Section tag: "B sec", "B-section", "sec B", "Section: A"
const SEC_RE = /(?<![A-Za-z0-9])(?:([A-H])[\s.\-_]*sec(?:tion)?|sec(?:tion)?[\s.\-_:]*([A-H]))(?![A-Za-z0-9])/gi;

function cleanTitle(title) {
  // Unify odd dashes/spaces Classroom titles pick up from copy-paste
  return String(title || '').normalize('NFKC').replace(/[‐-―−]/g, '-').replace(/\s+/g, ' ').trim();
}

// { labs: ['A2'], secs: ['B'] } — empty arrays when the title names nobody
function scopeOf(title) {
  const t = cleanTitle(title);
  const labs = new Set([...t.matchAll(LAB_TOKEN_RE)].map(m => m[1].toUpperCase()));
  const spaced = t.match(LAB_SPACED_END_RE);
  if (spaced) labs.add(`${spaced[1]}${spaced[2]}`.toUpperCase());
  const secs = new Set([...t.matchAll(SEC_RE)].map(m => (m[1] || m[2]).toUpperCase()));
  return { labs: [...labs], secs: [...secs] };
}

function scopeLabel(title) {
  const { labs, secs } = scopeOf(title);
  if (labs.length) return `Lab ${labs.join('/')}`;
  if (secs.length) return `Sec ${secs.join('/')}`;
  return 'Not assigned';
}

function normLab(lab) {
  const v = String(lab || '').toUpperCase().replace(/^\s*LAB\s*(GROUP)?\s*/, '').replace(/[\s-]/g, '');
  return /^[A-H][12]$/.test(v) ? v : '';
}

function normSec(sec) {
  const v = String(sec || '').toUpperCase().replace(/^\s*SEC(TION)?\s*/, '').trim();
  return /^[A-H]$/.test(v) ? v : '';
}

// Untagged work is for everyone. A lab tag wins over a section tag:
// "A2" counts only for lab A2; "B sec" counts for B1 and B2.
function isForMe(item, myLab, mySec) {
  if (item.notMine) return false;
  const { labs, secs } = scopeOf(item.title);
  if (labs.length) {
    if (myLab) return labs.includes(myLab);
    return !mySec || labs.some(l => l[0] === mySec);
  }
  if (secs.length && mySec) return secs.includes(mySec);
  return true;
}

// 'done' | 'returned' | 'missing' | 'assigned' — Classroom's own words
function workState(item, now) {
  if (item.state === 'TURNED_IN') return 'done';
  if (item.state === 'RETURNED') return 'returned';
  if (item.due && item.due < now) return 'missing';
  return 'assigned';
}
const STATE_LABEL = { done: 'Turned in', returned: 'Returned', missing: 'Missing', assigned: 'Assigned' };
const isFinished = (st) => st === 'done' || st === 'returned';

function relDue(due, now) {
  if (!due) return 'No due date';
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const d = new Date(due);
  const dueDay = new Date(due); dueDay.setHours(0, 0, 0, 0);
  const days = Math.round((dueDay - today) / DAY);
  if (days < -1) return `${-days}d late`;
  if (days === -1) return 'Yesterday';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fullDue(due) {
  if (!due) return '';
  return new Date(due).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function dateParts(due) {
  if (!due) return { day: '–', mon: 'Any' };
  const d = new Date(due);
  return { day: d.getDate(), mon: d.toLocaleDateString('en-US', { month: 'short' }) };
}

function courseInitials(name) {
  const code = (name || '').match(/^\s*([A-Za-z]{2,4})(?=[\s\d\-:_.]|$)/);
  if (code) return code[1].toUpperCase();
  const parts = (name || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
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

// Coursework + this student's submission states in 2 parallel calls.
async function fetchCourseWorkWithState(courseId, token) {
  const [data, subData] = await Promise.all([
    fetchClassroom(`/courses/${courseId}/courseWork?pageSize=50&orderBy=dueDate`, token),
    fetchClassroom(`/courses/${courseId}/courseWork/-/studentSubmissions?pageSize=100`, token)
      .catch(() => null),
  ]);
  const subs = subData?.studentSubmissions || [];
  // Only trust "no submission = not assigned to me" when the whole list came back.
  const submissionsKnown = !!subData && !subData.nextPageToken;
  const stateById = new Map(subs.map(sub => [sub.courseWorkId, sub.state]));
  return (data.courseWork || []).map(cw => ({
    ...cw,
    submissionState: stateById.get(cw.id) || 'NEW',
    hasSubmission: stateById.has(cw.id),
    submissionsKnown,
  }));
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

// ─── Shared overlay (skill-style §7: portal on <body>, day-modal look) ───
function WsModal({ title, icon: Icon, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="modal-overlay ws-overlay" onClick={onClose}>
      <div
        className={`modal ws-modal${wide ? ' is-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
      >
        <div className="ws-modal-head">
          <span className="ws-modal-title">{Icon && <Icon size={13} />}<span>{title}</span></span>
          <button type="button" className="ws-modal-close" aria-label="Close" onClick={onClose}><X size={12} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function WsEmpty({ icon: Icon, hint, action, onAction, tone }) {
  return (
    <div className={`ws-empty${tone ? ` is-${tone}` : ''}`}>
      <span className="ws-empty-icon"><Icon size={16} /></span>
      <p className="ws-empty-hint">{hint}</p>
      {action && <button type="button" className="ws-empty-action" onClick={onAction}>{action}</button>}
    </div>
  );
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
  const { user } = useAuth() || {};
  const myLab = normLab(user?.labSection);
  // Section comes from the lab group (A2 → A); fall back to the profile section
  const mySec = myLab ? myLab[0] : normSec(user?.section);
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
  const [overview, setOverview] = useState(loadOverview);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [courseFilter, setCourseFilter] = useState('all');
  const [courseQuery, setCourseQuery] = useState('');
  const [railTab, setRailTab] = useState('next');
  const [streamTab, setStreamTab] = useState('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  // Clock for relative due labels (Today / 2d late); ticks every minute.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(t);
  }, []);
  const accountsRef = useRef(accounts);
  const overviewRef = useRef(overview);
  const overviewBusyRef = useRef(false);
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
        ...(acc?.email ? { hint: acc.email } : {}),
        callback: (response) => {
          if (response.error) {
            isRefreshFlowRef.current = false;
            const code = response.error || 'unknown_error';
            const desc = response.error_description || response.error_subtype || '';
            reject(new Error(desc ? `${code}: ${desc}` : code));
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
        error_callback: (err) => {
          isRefreshFlowRef.current = false;
          const type = err?.type || err?.error || 'unknown';
          const msg = err?.message || err?.error_description || '';
          reject(new Error(msg ? `${type}: ${msg}` : type));
        },
      });
      // No prompt = let Google silently return token if session is valid.
      // hint above tells Google which account to use.
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
      // Missing/expired session is expected after reload; prompt re-auth without surfacing a scary error.
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

  // ─── Derived: all accounts with their counts ───
  const accountSummary = accounts.map(acc => ({
    ...acc,
    totalCourses: (acc.courses || []).length,
    selectedCount: (acc.selectedCourseIds || []).length,
  }));

  // ─── Persist accounts whenever they change ───
  useEffect(() => { saveAccounts(accounts); accountsRef.current = accounts; }, [accounts]);
  useEffect(() => { saveOverview(overview); overviewRef.current = overview; }, [overview]);

  // ─── Cross-course overview: coursework + states for every visible course.
  // Uses only still-valid tokens (never opens a popup); cached for 10 min.
  const refreshOverview = useCallback(async ({ force = false } = {}) => {
    if (overviewBusyRef.current) return;
    const now = Date.now();
    const jobs = [];
    for (const acc of accountsRef.current) {
      if (!acc.accessToken || !acc.expiresAt || now >= acc.expiresAt - 300000) continue;
      for (const c of acc.courses || []) {
        if (!(acc.selectedCourseIds || []).includes(c.id)) continue;
        const cached = overviewRef.current[c.id];
        if (!force && cached && now - cached.fetchedAt < OVERVIEW_TTL) continue;
        jobs.push({ token: acc.accessToken, courseId: c.id });
      }
    }
    if (jobs.length === 0) return;
    overviewBusyRef.current = true;
    setLoadingOverview(true);
    const results = {};
    for (let i = 0; i < jobs.length; i += 4) {
      await Promise.all(jobs.slice(i, i + 4).map(async ({ token, courseId }) => {
        try {
          const list = await fetchCourseWorkWithState(courseId, token);
          results[courseId] = { fetchedAt: Date.now(), items: list.map(compactWork) };
        } catch (err) {
          console.warn('[Workspace] overview fetch failed for course', courseId, err.message);
        }
      }));
    }
    if (Object.keys(results).length) setOverview(prev => ({ ...prev, ...results }));
    overviewBusyRef.current = false;
    setLoadingOverview(false);
  }, []);

  const overviewKey = accounts
    .map(a => `${a.accountId}:${a.expiresAt || 0}:${(a.selectedCourseIds || []).join(',')}`)
    .join('|');
  useEffect(() => { refreshOverview(); }, [overviewKey, refreshOverview]);

  // ─── ⋮ menu: close on outside click / Escape ───
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

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
          if (isRefreshFlowRef.current) return;
          const code = response.error || 'unknown_error';
          const desc = response.error_description || response.error_subtype || '';
          if (code === 'access_denied') {
            setError('Google sign-in was cancelled or access was denied. Grant the requested permissions to connect Classroom.');
          } else {
            setError(`Google authorization failed: ${code}${desc ? ` — ${desc}` : ''}.`);
          }
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
      error_callback: (err) => {
        if (isRefreshFlowRef.current) return;
        const type = err?.type || err?.error || 'unknown';
        if (type === 'popup_closed') {
          setError('Google sign-in popup was closed before completing. Please try again.');
        } else if (type === 'popup_failed_to_open') {
          setError('Could not open the Google sign-in popup. Allow popups for this site and try again.');
        } else {
          const msg = err?.message || err?.error_description || '';
          setError(`Google sign-in failed: ${type}${msg ? ` — ${msg}` : ''}.`);
        }
        setIsAuthorizing(false);
      },
    });
    setTokenClient(client);
  }, [isLoaded]);

  // ─── Process newly obtained token: fetch courses + profile ───
  useEffect(() => {
    if (!pendingAuth) return;
    const { token, scopes, expiresIn } = pendingAuth;
    const expiresAt = Date.now() + (expiresIn || 3600) * 1000;
    setPendingAuth(null);

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
        const msg = String(err?.message || '');
        if (msg.includes('403') || msg.includes('accessNotConfigured') || msg.includes('has not been used') || msg.includes('disabled')) {
          setError('Google Classroom access failed (403). In Google Cloud Console for this OAuth client/project: enable "Google Classroom API", add this app origin as an Authorized JavaScript origin, and if the app is in Testing add your Google account as a Test user. Then try Sign in again.');
        } else if (msg.includes('401')) {
          setError('Google Classroom authorization expired or is invalid (401). Please sign in again.');
        } else {
          setError(msg || 'Failed to load Classroom courses.');
        }
        setLoadingCourses(false);
        return;
      }

      // Use Google UserInfo API instead of Classroom profile API
      // (classroom.profile.emails scope may be dropped by Google for unverified apps)
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          profile = await res.json();
        } else {
          let detail = '';
          try { const body = await res.json(); detail = body.error?.message || body.error_description || ''; } catch {}
          if (res.status !== 403) {
            throw new Error(detail || `UserInfo API returned ${res.status}`);
          }
          // 403 can happen if userinfo scopes weren't granted; continue without profile
          profileError = detail || 'userinfo_unavailable';
        }
      } catch (err) {
        profileError = err.message;
        console.warn('Profile fetch failed (non-critical):', err.message);
      }

      // UserInfo API returns different field names than Classroom profile API
      // https://www.googleapis.com/oauth2/v2/userinfo → { email, name (string), picture, id }
      const email = profile?.email || '';
      const googleId = profile?.sub || profile?.id || '';
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
      setError('Session expired. Use Reconnect in the Accounts card to sign in again.');
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
    Promise.all(accounts.map(acc => refreshAccount(acc.accountId)))
      .then(() => refreshOverview({ force: true }));
  }, [accounts, refreshAccount, refreshOverview, tokenClient, isAuthorizing]);

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
    localStorage.removeItem(OVERVIEW_KEY);
    setAccounts([]);
    setOverview({});
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

    // Coursework + all of this student's submissions in 2 parallel calls
    // (was 1 + N sequential-ish calls), and materials start at the same time.
    const courseworkTask = (async () => {
      try {
        const list = await fetchCourseWorkWithState(course.id, token);
        setCoursework(list);
        // Opening a course also refreshes its row in the overview
        setOverview(prev => ({ ...prev, [course.id]: { fetchedAt: Date.now(), items: list.map(compactWork) } }));
      } catch { setCoursework([]); }
      setLoadingCoursework(false);
    })();

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
    await courseworkTask;
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

  // ─── Derived: per-course stats + cross-course work list ───
  const multiAccount = accounts.length > 1;
  const courseEntries = accounts.flatMap(acc =>
    (acc.courses || [])
      .filter(c => (acc.selectedCourseIds || []).includes(c.id))
      .map(course => ({ course, acc }))
  );
  const courseStats = new Map();
  const allWork = [];
  for (const { course, acc } of courseEntries) {
    const ov = overview[course.id];
    const s = { loaded: !!ov, total: 0, done: 0, missing: 0, assigned: 0, dueWeek: 0, next: null };
    for (const it of ov?.items || []) {
      if (!isForMe(it, myLab, mySec)) continue;
      const st = workState(it, now);
      s.total++;
      if (isFinished(st)) s.done++;
      else if (st === 'missing') s.missing++;
      else {
        s.assigned++;
        if (it.due && it.due <= now + 7 * DAY) s.dueWeek++;
        if (it.due && (!s.next || it.due < s.next.due)) s.next = it;
      }
      allWork.push({ ...it, st, course, acc });
    }
    courseStats.set(course.id, s);
  }
  const hasOverview = courseEntries.some(e => overview[e.course.id]);
  const upNext = allWork
    .filter(w => w.st === 'assigned')
    .sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity));
  const missingWork = allWork.filter(w => w.st === 'missing').sort((a, b) => b.due - a.due);
  const doneCount = allWork.filter(w => isFinished(w.st)).length;
  const dueWeekCount = upNext.filter(w => w.due && w.due <= now + 7 * DAY).length;
  const donePct = allWork.length ? Math.round((doneCount / allWork.length) * 100) : 0;
  const noDueCount = upNext.filter(w => !w.due).length;

  const query = courseQuery.trim().toLowerCase();
  const filteredEntries = courseEntries.filter(({ course }) => {
    const s = courseStats.get(course.id);
    if (courseFilter === 'due' && !(s?.dueWeek > 0)) return false;
    if (courseFilter === 'missing' && !(s?.missing > 0)) return false;
    if (query && !`${course.name} ${course.section || ''}`.toLowerCase().includes(query)) return false;
    return true;
  });
  const courseCountFor = (key) => courseEntries.filter(({ course }) => {
    const s = courseStats.get(course.id);
    return key === 'due' ? s?.dueWeek > 0 : s?.missing > 0;
  }).length;
  const totalCourses = accounts.reduce((sum, a) => sum + (a.courses || []).length, 0);
  const anyLimited = accounts.some(acc => !hasMaterialsAccess(acc));
  const anyExpired = accounts.some(acc => isTokenExpired(acc));

  const openCourse = (course) => {
    setStreamTab('all');
    handleCourseClick(course);
  };

  const startReconnect = () => {
    if (!tokenClient) return;
    setNeedsReauth(false);
    setError(null);
    setIsAuthorizing(true);
    tokenClient.requestAccessToken({ prompt: 'consent' });
  };

  // ─── Pieces ───
  const renderDueRow = (w) => {
    const { day, mon } = dateParts(w.due);
    const tone = w.st === 'missing' ? 'rose' : (w.due && w.due - now < 2 * DAY ? 'amber' : 'muted');
    return (
      <li key={`${w.course.id}-${w.id}`} className="ws-due-row">
        <button type="button" className="ws-due-main" onClick={() => openCourse(w.course)}>
          <span className="ws-date" aria-hidden="true">
            <span className="ws-date-day">{day}</span>
            <span className="ws-date-mon">{mon}</span>
          </span>
          <span className="ws-due-body">
            <span className="ws-due-title">{w.title}</span>
            <span className="ws-due-course">{w.course.name}</span>
          </span>
          <span className={`ws-chip is-${tone}`}>{relDue(w.due, now)}</span>
        </button>
        {w.link && (
          <a className="ws-icon-link" href={w.link} target="_blank" rel="noopener noreferrer" aria-label={`Open “${w.title}” in Classroom`} title="Open in Classroom">
            <ExternalLink size={12} />
          </a>
        )}
      </li>
    );
  };

  const renderCourseCard = ({ course, acc }) => {
    const s = courseStats.get(course.id);
    const hasNew = course.updateTime && course.lastViewTime
      ? new Date(course.updateTime).getTime() > course.lastViewTime
      : false;
    const pct = s?.total ? Math.round((s.done / s.total) * 100) : 0;
    return (
      <button
        type="button"
        key={`${acc.accountId}-${course.id}`}
        className="ws-course"
        onClick={() => openCourse(course)}
      >
        <span className="ws-course-top">
          <span className="ws-course-tile" aria-hidden="true">{courseInitials(course.name)}</span>
          <span className="ws-course-head">
            <span className="ws-course-name" title={course.name}>{course.name}</span>
            <span className="ws-course-section">{course.section || course.descriptionHeading || 'Google Classroom'}</span>
          </span>
          {hasNew && <span className="ws-new-dot" title="New activity" aria-label="New activity" />}
        </span>
        {multiAccount && acc.email && (
          <span className="ws-course-acc"><Mail size={10} /><span>{acc.email}</span></span>
        )}
        {s?.loaded ? (
          <span className="ws-course-foot">
            <span className="ws-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
            <span className="ws-course-foot-row">
              <span className="ws-course-counts">
                {s.missing > 0 && <span className="is-rose">{s.missing} missing</span>}
                {s.assigned > 0 && <span>{s.assigned} assigned</span>}
                {s.missing === 0 && s.assigned === 0 && <span>{s.total ? 'All caught up' : 'No classwork yet'}</span>}
              </span>
              {s.next && <span className="ws-course-next"><Clock size={10} />{relDue(s.next.due, now)}</span>}
            </span>
          </span>
        ) : (
          <span className="ws-course-foot is-pending">
            <span className="ws-course-foot-row">
              <span className="ws-course-counts"><span>{loadingOverview ? 'Syncing classwork…' : 'Open to load classwork'}</span></span>
              <ChevronRight size={13} />
            </span>
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="ws-widget workspace-page animate-fadeIn">
      {/* ─── Masthead ─── */}
      <header className={`dl-head pr-head${accounts.length > 0 ? ' has-actions' : ''}`}>
        <div className="dl-head-title">
          <div className="dl-head-tile" aria-hidden="true"><GraduationCap size={20} strokeWidth={2.1} /></div>
          <div className="dl-head-text">
            <span className="dl-head-overline">Productivity</span>
            <h2 className="dl-head-name">Workspace</h2>
            <span className="dl-head-subtitle">{myLab ? `Lab ${myLab} · only tasks assigned to you are counted` : 'Every Google Classroom account, course and deadline in one place.'}</span>
          </div>
        </div>
        <dl className="dl-head-stats">
          <div className="dl-head-stat"><dt>Due 7d</dt><dd>{hasOverview ? dueWeekCount : '–'}</dd></div>
          <div className={`dl-head-stat${missingWork.length > 0 ? ' is-alert' : ''}`}><dt>Missing</dt><dd>{hasOverview ? missingWork.length : '–'}</dd></div>
          <div className="dl-head-stat"><dt>Done</dt><dd>{hasOverview && allWork.length ? `${donePct}%` : '–'}</dd></div>
          <div className="dl-head-stat"><dt>Courses</dt><dd>{courseEntries.length}</dd></div>
        </dl>
        {accounts.length > 0 && (
          <div className="dl-head-actions">
            <div className="ws-menu" ref={menuRef}>
              <button
                type="button"
                className="dl-head-menu-btn"
                aria-label="Workspace options"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(v => !v)}
              >
                <MoreVertical size={17} />
              </button>
              {menuOpen && (
                <div className="ws-menu-list" role="menu">
                  <button type="button" role="menuitem" className="ws-menu-item" disabled={loadingCourses} onClick={() => { setMenuOpen(false); handleRefreshAll(); }}>
                    <RefreshCw size={14} /> Refresh everything
                  </button>
                  <button type="button" role="menuitem" className="ws-menu-item" onClick={() => { setMenuOpen(false); handleBack(); setIsManaging(true); setCourseFilter('all'); }}>
                    <Settings size={14} /> Choose courses
                  </button>
                  <button type="button" role="menuitem" className="ws-menu-item" disabled={!tokenClient || isAuthorizing} onClick={() => { setMenuOpen(false); handleConnect(); }}>
                    <Plus size={14} /> Add account
                  </button>
                  <div className="ws-menu-sep" />
                  <button type="button" role="menuitem" className="ws-menu-item is-danger" onClick={() => { setMenuOpen(false); setConfirmResetAll(true); }}>
                    <Trash2 size={14} /> Reset workspace
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ─── Notices ─── */}
      {needsConfig && (
        <div className="ws-notice is-rose" role="alert">
          <AlertCircle size={15} />
          <div className="ws-notice-body">
            <strong>Google Classroom isn’t configured.</strong>
            <span>Set <code>VITE_GOOGLE_CLIENT_ID</code> in <code>.env</code>.</span>
          </div>
        </div>
      )}

      {error && (
        <div className="ws-notice is-rose" role="alert">
          <AlertCircle size={15} />
          <div className="ws-notice-body"><span>{error}</span></div>
          <button type="button" className="ws-notice-close" aria-label="Dismiss" onClick={() => setError(null)}><X size={13} /></button>
        </div>
      )}

      {needsReauth && (
        <div className="ws-notice is-amber">
          <AlertCircle size={15} />
          <div className="ws-notice-body">
            <strong>Session expired.</strong>
            <span>Sign in again to keep your courses and deadlines up to date.</span>
          </div>
          <button type="button" className="ws-btn ws-btn-primary" onClick={startReconnect} disabled={!tokenClient || isAuthorizing}>
            <LogIn size={13} /> {isAuthorizing ? 'Connecting…' : 'Reconnect'}
          </button>
        </div>
      )}

      {anyLimited && (
        <div className="ws-notice is-rose">
          <AlertTriangle size={15} />
          <div className="ws-notice-body">
            <strong>Materials and announcements can’t load yet.</strong>
            <span>Google hasn’t granted access to course materials for this account. To fix it:</span>
            <ol className="ws-notice-steps">
              <li>
                Open{' '}
                <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noopener noreferrer">
                  Google Cloud Console → OAuth consent screen
                </a>
              </li>
              <li>Add <strong>{accounts.find(a => !hasMaterialsAccess(a))?.email || 'your AUST email'}</strong> as a <strong>Test user</strong></li>
              <li>Re-authorize below and tick every permission</li>
            </ol>
          </div>
          <button type="button" className="ws-btn ws-btn-ghost" onClick={handleReauthorize} disabled={!tokenClient || isAuthorizing}>
            <RefreshCw size={13} /> Re-authorize
          </button>
        </div>
      )}

      {accounts.length > 0 && user && !myLab && (
        <div className="ws-notice is-amber">
          <Users size={15} />
          <div className="ws-notice-body">
            <strong>Showing every lab group’s tasks.</strong>
            <span>Your profile has no lab group. Set it so tasks ending in “- A2”, “- B1”… only count for your group.</span>
          </div>
          <a className="ws-btn ws-btn-primary" href="/settings">
            <Settings size={13} /> Set lab group
          </a>
        </div>
      )}

      {loadingCourses && (
        <div className="ws-notice is-muted"><Loader2 size={15} className="ws-spin" /><div className="ws-notice-body"><span>Refreshing courses…</span></div></div>
      )}

      {/* ─── No accounts: connect ─── */}
      {accounts.length === 0 && (
        <section className="ws-card ws-connect">
          <div className="ws-connect-intro">
            <span className="ws-connect-tile" aria-hidden="true"><GraduationCap size={22} /></span>
            <div className="ws-connect-text">
              <span className="ws-overline">Google Classroom</span>
              <h3 className="ws-connect-title">All your classes, one clear view</h3>
              <p className="ws-connect-hint">
                Sign in with your AUST Google account. Workspace only <strong>reads</strong> your courses, classwork and posts. It never posts or submits anything.
              </p>
            </div>
          </div>
          <ul className="ws-benefits">
            <li>
              <span className="ws-benefit-icon"><Users size={15} /></span>
              <span><strong>Every account together</strong><span>AUST and personal Classroom accounts side by side.</span></span>
            </li>
            <li>
              <span className="ws-benefit-icon"><CalendarClock size={15} /></span>
              <span><strong>One deadline list</strong><span>Due dates from every course, sorted for you.</span></span>
            </li>
            <li>
              <span className="ws-benefit-icon"><AlertTriangle size={15} /></span>
              <span><strong>Missing work flagged</strong><span>Late assignments stand out before they pile up.</span></span>
            </li>
            <li>
              <span className="ws-benefit-icon"><Eye size={15} /></span>
              <span><strong>Only what matters</strong><span>Hide old or finished courses in one tap.</span></span>
            </li>
          </ul>
          <div className="ws-connect-actions">
            <button type="button" className="ws-btn ws-btn-primary ws-btn-lg" onClick={handleConnect} disabled={!isLoaded || isAuthorizing || needsConfig}>
              {!isLoaded ? <><Loader2 size={14} className="ws-spin" /> Loading Google…</>
                : isAuthorizing ? <><Loader2 size={14} className="ws-spin" /> Authorizing…</>
                : <><LogIn size={14} /> Sign in with Google</>}
            </button>
            <span className="ws-connect-note">Read-only · you can disconnect anytime</span>
          </div>
        </section>
      )}

      {/* ─── Course detail ─── */}
      {accounts.length > 0 && selectedCourse && (() => {
        const owner = accounts.find(acc => (acc.courses || []).some(c => c.id === selectedCourse.id));
        const allItems = coursework.map(compactWork);
        const work = allItems.filter(it => isForMe(it, myLab, mySec)).map(it => ({ ...it, st: workState(it, now) }));
        // Other lab groups' tasks: listed last, never counted
        const otherWork = allItems.filter(it => !isForMe(it, myLab, mySec)).map(it => ({ ...it, st: 'other' }));
        const groups = [
          { key: 'missing', label: 'Missing', items: work.filter(w => w.st === 'missing').sort((a, b) => b.due - a.due) },
          { key: 'upcoming', label: 'Upcoming', items: work.filter(w => w.st === 'assigned' && w.due).sort((a, b) => a.due - b.due) },
          { key: 'nodue', label: 'No due date', items: work.filter(w => w.st === 'assigned' && !w.due) },
          { key: 'done', label: 'Turned in', items: work.filter(w => isFinished(w.st)).sort((a, b) => (b.due || 0) - (a.due || 0)) },
          { key: 'other', label: (myLab || mySec) ? 'Other groups' : 'Not assigned to you', items: otherWork.sort((a, b) => (b.due || 0) - (a.due || 0)) },
        ].filter(g => g.items.length);
        const doneN = work.filter(w => isFinished(w.st)).length;
        const pct = work.length ? Math.round((doneN / work.length) * 100) : 0;
        const announcements = courseMaterials.filter(m => m._itemType === 'announcement');
        const materials = courseMaterials.filter(m => m._itemType !== 'announcement');
        const stream = streamTab === 'materials' ? materials : streamTab === 'posts' ? announcements : courseMaterials;
        const metaBits = [selectedCourse.section, selectedCourse.descriptionHeading, selectedCourse.room && `Room ${selectedCourse.room}`]
          .filter(Boolean)
          .filter((v, i, arr) => arr.indexOf(v) === i);

        return (
          <div className="ws-detail">
            <section className="ws-card ws-context">
              <div className="ws-context-top">
                <button type="button" className="ws-back" onClick={handleBack}><ArrowLeft size={14} /> All courses</button>
                {selectedCourse.alternateLink && (
                  <a className="ws-btn ws-btn-ghost" href={selectedCourse.alternateLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={13} /> <span>Open in Classroom</span>
                  </a>
                )}
              </div>
              <div className="ws-context-main">
                <span className="ws-course-tile is-lg" aria-hidden="true">{courseInitials(selectedCourse.name)}</span>
                <div className="ws-context-text">
                  <span className="ws-overline">Course{owner?.email ? ` · ${owner.email}` : ''}</span>
                  <h3 className="ws-context-title">{selectedCourse.name}</h3>
                  {metaBits.length > 0 && <p className="ws-context-meta">{metaBits.join(' · ')}</p>}
                </div>
              </div>
              <div className="ws-context-progress">
                <span className="ws-bar" aria-hidden="true"><span style={{ width: `${loadingCoursework ? 0 : pct}%` }} /></span>
                <span className="ws-context-pct">{loadingCoursework ? 'Loading…' : `${doneN}/${work.length} turned in`}</span>
              </div>
              <div className="ws-badges">
                <span className="ws-badge is-muted">Assigned <strong>{loadingCoursework ? '–' : work.filter(w => w.st === 'assigned').length}</strong></span>
                <span className={`ws-badge ${groups.some(g => g.key === 'missing') ? 'is-rose' : 'is-muted'}`}>Missing <strong>{loadingCoursework ? '–' : work.filter(w => w.st === 'missing').length}</strong></span>
                <span className={`ws-badge ${materials.length ? 'is-amber' : 'is-muted'}`}>Materials <strong>{loadingMaterials ? '–' : materials.length}</strong></span>
                <span className="ws-badge is-muted">Posts <strong>{loadingMaterials ? '–' : announcements.length}</strong></span>
              </div>
            </section>

            <div className="ws-detail-grid">
              {/* Assignments */}
              <section className="ws-card ws-panel">
                <div className="ws-card-head is-ruled">
                  <h3 className="ws-card-title"><Clipboard size={14} /> Classwork</h3>
                  <span className="ws-head-meta">
                    {myLab && <span className="ws-lab-chip" title="Only your lab group's tasks are counted">Lab {myLab}</span>}
                    {!loadingCoursework && <span className="ws-count">{work.length}</span>}
                  </span>
                </div>
                {loadingCoursework ? (
                  <div className="ws-loading"><Loader2 size={15} className="ws-spin" /> Loading classwork…</div>
                ) : work.length === 0 ? (
                  <WsEmpty icon={FileText} hint="No assignments in this course yet." />
                ) : (
                  <div className="ws-groups">
                    {groups.map(g => (
                      <div key={g.key} className={`ws-group is-${g.key}`}>
                        <span className="ws-group-label">{g.label} <span>{g.items.length}</span></span>
                        <ul className="ws-list">
                          {g.items.map(w => {
                            const { day, mon } = dateParts(w.due);
                            const StIcon = w.st === 'other' ? Users : w.st === 'done' ? CheckCircle : w.st === 'returned' ? Award : w.st === 'missing' ? AlertTriangle : Clock;
                            const stLabel = w.st === 'other' ? scopeLabel(w.title) : STATE_LABEL[w.st];
                            return (
                              <li key={w.id} className={`ws-work-row is-${w.st}`}>
                                <span className="ws-date" aria-hidden="true">
                                  <span className="ws-date-day">{day}</span>
                                  <span className="ws-date-mon">{mon}</span>
                                </span>
                                <span className="ws-work-body">
                                  <span className="ws-work-title" title={w.title}>{w.title}</span>
                                  <span className="ws-work-meta">
                                    <span className={`ws-state is-${w.st}`}><StIcon size={11} /> {stLabel}</span>
                                    {w.due && <span>{fullDue(w.due)}</span>}
                                    {w.maxPoints && <span>{w.maxPoints} pts</span>}
                                  </span>
                                </span>
                                {w.link && (
                                  <a className="ws-icon-link" href={w.link} target="_blank" rel="noopener noreferrer" aria-label={`Open “${w.title}” in Classroom`} title="Open in Classroom">
                                    <ExternalLink size={13} />
                                  </a>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Stream: materials + announcements */}
              <section className="ws-card ws-panel">
                <div className="ws-card-head is-ruled">
                  <h3 className="ws-card-title"><Megaphone size={14} /> Stream</h3>
                  <div className="ws-pills" role="tablist" aria-label="Stream filter">
                    {[['all', 'All', courseMaterials.length], ['materials', 'Materials', materials.length], ['posts', 'Posts', announcements.length]].map(([key, label, n]) => (
                      <button key={key} type="button" role="tab" aria-selected={streamTab === key} className={`ws-pill${streamTab === key ? ' is-active' : ''}`} onClick={() => setStreamTab(key)}>
                        {label}{!loadingMaterials && <span className="ws-pill-n">{n}</span>}
                      </button>
                    ))}
                  </div>
                </div>
                {loadingMaterials ? (
                  <div className="ws-loading"><Loader2 size={15} className="ws-spin" /> Loading stream…</div>
                ) : materialsError && courseMaterials.length === 0 ? (
                  <div className="ws-empty is-rose">
                    <span className="ws-empty-icon"><AlertCircle size={16} /></span>
                    <p className="ws-empty-hint">Couldn’t load materials. This account may need extra permissions.</p>
                    <button type="button" className="ws-empty-action" onClick={() => selectedCourse && handleCourseClick(selectedCourse)}>
                      <RefreshCw size={13} /> Retry
                    </button>
                    {(owner?.grantedScopes || []).length > 0 && (
                      <details className="ws-debug">
                        <summary>Granted scopes</summary>
                        <ul>{owner.grantedScopes.map((s, i) => <li key={i}>{s}</li>)}</ul>
                      </details>
                    )}
                  </div>
                ) : stream.length === 0 ? (
                  <WsEmpty icon={BookOpen} hint={streamTab === 'posts' ? 'No announcements yet.' : streamTab === 'materials' ? 'No materials shared yet.' : 'Nothing posted in this course yet.'} />
                ) : (
                  <ul className="ws-list">
                    {stream.map(item => {
                      const isPost = item._itemType === 'announcement';
                      const hasMats = item.materials && item.materials.length > 0;
                      const MatIcon = isPost ? Megaphone : getMaterialIcon(item.materials);
                      const typeLabel = isPost ? 'Announcement' : getMaterialTypeLabel(item.materials);
                      const title = item.title || item.text?.substring(0, 90) || (hasMats ? getMaterialTitle(item.materials) : 'Untitled');
                      const desc = item.title ? (item.description || item.text || '') : '';
                      return (
                        <li key={item.id}>
                          <button type="button" className="ws-stream-row" onClick={() => setSelectedMaterial(item)}>
                            <span className="ws-stream-icon"><MatIcon size={14} /></span>
                            <span className="ws-stream-body">
                              <span className="ws-stream-title">{title}</span>
                              <span className="ws-stream-meta">
                                <span className="ws-type">{typeLabel}</span>
                                {item.creationTime && <span>{new Date(item.creationTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                                {hasMats && <span>{item.materials.length} attachment{item.materials.length > 1 ? 's' : ''}</span>}
                              </span>
                              {desc && <span className="ws-stream-desc">{desc}</span>}
                            </span>
                            <ChevronRight size={14} className="ws-stream-caret" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          </div>
        );
      })()}

      {/* ─── Dashboard: courses · up next · progress · accounts ─── */}
      {accounts.length > 0 && !selectedCourse && (
        <div className="ws-main-grid">
          <section className="ws-card ws-courses">
            <div className="ws-card-head">
              <h3 className="ws-card-title"><BookOpen size={14} /> {isManaging ? 'Choose courses' : 'My courses'}</h3>
              <button
                type="button"
                className={`ws-btn ${isManaging ? 'ws-btn-primary' : 'ws-btn-ghost'}`}
                onClick={() => { setIsManaging(v => !v); setCourseFilter('all'); }}
              >
                {isManaging ? <><CheckSquare size={13} /> Done</> : <><Settings size={13} /> Manage</>}
              </button>
            </div>

            {isManaging ? (
              <>
                <p className="ws-manage-hint"><EyeOff size={12} /> Tap a course to show or hide it. Hidden courses stay out of your stats.</p>
                {accountSummary.map(acc => {
                  const total = (acc.courses || []).length;
                  const allSelected = total > 0 && total === acc.selectedCount;
                  return (
                    <div key={acc.accountId} className="ws-manage-group">
                      <div className="ws-manage-head">
                        <span className="ws-avatar is-sm" aria-hidden="true">{(acc.name || acc.email || '?').charAt(0).toUpperCase()}</span>
                        <span className="ws-manage-name">{acc.email || acc.name}</span>
                        <span className="ws-count">{acc.selectedCount}/{total}</span>
                        {total > 0 && (
                          <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm" onClick={() => toggleSelectAllForAccount(acc.accountId)}>
                            {allSelected ? <><EyeOff size={12} /> Hide all</> : <><Eye size={12} /> Show all</>}
                          </button>
                        )}
                      </div>
                      {total === 0 ? (
                        <WsEmpty icon={Layers} hint="No active courses in this account." />
                      ) : (
                        <div className="ws-course-grid">
                          {(acc.courses || []).map(course => {
                            const on = (acc.selectedCourseIds || []).includes(course.id);
                            return (
                              <button
                                type="button"
                                key={`${acc.accountId}-${course.id}`}
                                className={`ws-course is-manage${on ? '' : ' is-off'}`}
                                aria-pressed={on}
                                onClick={() => toggleCourseSelection(acc.accountId, course.id)}
                              >
                                <span className="ws-course-top">
                                  <span className="ws-course-tile" aria-hidden="true">{courseInitials(course.name)}</span>
                                  <span className="ws-course-head">
                                    <span className="ws-course-name" title={course.name}>{course.name}</span>
                                    <span className="ws-course-section">{course.section || 'Google Classroom'}</span>
                                  </span>
                                  <span className="ws-check" aria-hidden="true">{on ? <CheckSquare size={17} /> : <Square size={17} />}</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                {courseEntries.length > 0 && (
                  <div className="ws-toolbar">
                    <div className="ws-pills" role="tablist" aria-label="Filter courses">
                      {[['all', 'All', courseEntries.length], ['due', 'Due this week', courseCountFor('due')], ['missing', 'Missing', courseCountFor('missing')]].map(([key, label, n]) => (
                        <button key={key} type="button" role="tab" aria-selected={courseFilter === key} className={`ws-pill${courseFilter === key ? ' is-active' : ''}`} onClick={() => setCourseFilter(key)}>
                          {label}<span className="ws-pill-n">{n}</span>
                        </button>
                      ))}
                    </div>
                    {courseEntries.length > 4 && (
                      <label className="ws-search">
                        <Search size={13} />
                        <input
                          type="search"
                          className="ws-search-input"
                          placeholder="Search courses"
                          value={courseQuery}
                          onChange={e => setCourseQuery(e.target.value)}
                          aria-label="Search courses"
                        />
                      </label>
                    )}
                  </div>
                )}

                {courseEntries.length === 0 && !loadingCourses ? (
                  <WsEmpty
                    icon={EyeOff}
                    hint={totalCourses > 0 ? 'All your courses are hidden. Pick the ones you want to follow.' : 'No active courses found in your connected accounts.'}
                    action={totalCourses > 0 ? <><Settings size={13} /> Choose courses</> : <><RefreshCw size={13} /> Refresh</>}
                    onAction={totalCourses > 0 ? () => setIsManaging(true) : handleRefreshAll}
                  />
                ) : filteredEntries.length === 0 ? (
                  <WsEmpty
                    icon={courseFilter === 'missing' ? CheckCircle : Search}
                    hint={query ? `No course matches “${courseQuery}”.` : courseFilter === 'missing' ? 'Nothing missing. Nice work.' : 'Nothing due in the next 7 days.'}
                    action={<>Show all courses</>}
                    onAction={() => { setCourseFilter('all'); setCourseQuery(''); }}
                  />
                ) : (
                  <div className="ws-course-grid">{filteredEntries.map(renderCourseCard)}</div>
                )}
              </>
            )}
          </section>

          <aside className="ws-rail">
            {/* Up next / Missing */}
            <section className="ws-card ws-upnext">
              <div className="ws-card-head is-ruled">
                <h3 className="ws-card-title">
                  <CalendarClock size={14} /> Deadlines
                  {loadingOverview && <Loader2 size={12} className="ws-spin ws-title-spin" />}
                </h3>
                <div className="ws-pills is-sm" role="tablist" aria-label="Deadline list">
                  <button type="button" role="tab" aria-selected={railTab === 'next'} className={`ws-pill${railTab === 'next' ? ' is-active' : ''}`} onClick={() => setRailTab('next')}>
                    Up next<span className="ws-pill-n">{upNext.length}</span>
                  </button>
                  <button type="button" role="tab" aria-selected={railTab === 'missing'} className={`ws-pill${railTab === 'missing' ? ' is-active' : ''}${missingWork.length ? ' has-alert' : ''}`} onClick={() => setRailTab('missing')}>
                    Missing<span className="ws-pill-n">{missingWork.length}</span>
                  </button>
                </div>
              </div>
              {!hasOverview ? (
                <WsEmpty
                  icon={CalendarClock}
                  hint={loadingOverview ? 'Collecting deadlines from your courses…' : anyExpired ? 'Reconnect your account to pull deadlines from every course.' : 'Deadlines from all your courses will show up here.'}
                  action={!loadingOverview && anyExpired ? <><LogIn size={13} /> Reconnect</> : null}
                  onAction={startReconnect}
                />
              ) : (railTab === 'next' ? upNext : missingWork).length === 0 ? (
                <WsEmpty
                  icon={CheckCircle}
                  hint={railTab === 'next' ? 'Nothing assigned right now. You’re all caught up.' : 'No missing work. Keep it up.'}
                />
              ) : (
                <>
                  <ul className="ws-list ws-due-list">
                    {(railTab === 'next' ? upNext : missingWork).slice(0, 6).map(renderDueRow)}
                  </ul>
                  {(railTab === 'next' ? upNext : missingWork).length > 6 && (
                    <p className="ws-more">+{(railTab === 'next' ? upNext : missingWork).length - 6} more · open a course to see all</p>
                  )}
                </>
              )}
            </section>

            {/* Progress */}
            <section className="ws-card ws-progress">
              <h3 className="ws-card-title">
                <TrendingUp size={14} /> Progress
                {myLab && <span className="ws-lab-chip is-end" title="Only your lab group's tasks are counted">Lab {myLab}</span>}
              </h3>
              {hasOverview && allWork.length > 0 ? (
                <>
                  <div className="ws-progress-top">
                    <span className="ws-progress-pct">{donePct}%</span>
                    <span className="ws-progress-label">of classwork turned in<br /><strong>{doneCount}</strong> of <strong>{allWork.length}</strong> assignments</span>
                  </div>
                  <span className="ws-bar is-lg" aria-hidden="true"><span style={{ width: `${donePct}%` }} /></span>
                  <dl className="ws-mini-stats">
                    <div><dt>Assigned</dt><dd>{upNext.length - noDueCount}</dd></div>
                    <div className={missingWork.length ? 'is-rose' : ''}><dt>Missing</dt><dd>{missingWork.length}</dd></div>
                    <div><dt>Turned in</dt><dd>{doneCount}</dd></div>
                    <div><dt>No due date</dt><dd>{noDueCount}</dd></div>
                  </dl>
                </>
              ) : (
                <WsEmpty icon={TrendingUp} hint={loadingOverview ? 'Working out your progress…' : 'Your completion rate appears once classwork syncs.'} />
              )}
            </section>

            {/* Accounts */}
            <section className="ws-card ws-accounts">
              <div className="ws-card-head is-ruled">
                <h3 className="ws-card-title"><Users size={14} /> Accounts <span className="ws-count">{accounts.length}</span></h3>
                <button type="button" className="ws-add-icon-btn" onClick={handleConnect} disabled={!tokenClient || isAuthorizing} aria-label="Add account" title="Add account">
                  <Plus size={15} />
                </button>
              </div>
              <ul className="ws-list">
                {accountSummary.map(acc => {
                  const limited = !hasMaterialsAccess(acc);
                  const expired = isTokenExpired(acc);
                  return (
                    <li key={acc.accountId} className="ws-acc-row">
                      <span className={`ws-avatar${limited ? ' is-rose' : expired ? ' is-amber' : ''}`} aria-hidden="true">
                        {acc.photoUrl
                          ? <img src={acc.photoUrl} alt="" referrerPolicy="no-referrer" />
                          : (acc.name || acc.email || '?').charAt(0).toUpperCase()}
                      </span>
                      <span className="ws-acc-body">
                        <span className="ws-acc-name">{acc.name || acc.email || 'Classroom account'}</span>
                        <span className="ws-acc-meta">
                          {acc.email && <span className="ws-acc-email">{acc.email}</span>}
                          <span className={limited ? 'is-rose' : expired ? 'is-amber' : ''}>
                            {limited ? 'Limited access' : expired ? 'Session expired' : `${acc.selectedCount}/${acc.totalCourses} courses`}
                          </span>
                        </span>
                      </span>
                      {expired ? (
                        <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm" onClick={startReconnect} disabled={!tokenClient || isAuthorizing}>
                          <LogIn size={12} /> Reconnect
                        </button>
                      ) : (
                        <button type="button" className="ws-icon-btn" onClick={() => refreshAccount(acc.accountId)} disabled={loadingCourses} aria-label={`Refresh ${acc.email || acc.name}`} title="Refresh courses">
                          <RefreshCw size={13} className={loadingCourses ? 'ws-spin' : ''} />
                        </button>
                      )}
                      <button type="button" className="ws-icon-btn is-danger" onClick={() => setPendingRemoveEmail(acc.accountId)} aria-label={`Remove ${acc.email || acc.name}`} title="Remove account">
                        <X size={13} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </aside>
        </div>
      )}

      {/* ─── Remove account ─── */}
      {pendingRemoveEmail && (() => {
        const acc = accounts.find(a => a.accountId === pendingRemoveEmail);
        return (
          <WsModal title="Remove account" icon={Users} onClose={() => setPendingRemoveEmail(null)}>
            <div className="ws-modal-summary">
              <span className="ws-badge is-muted">Courses <strong>{(acc?.courses || []).length}</strong></span>
              {acc?.email && <span className="ws-badge is-amber">{acc.email}</span>}
            </div>
            <p className="ws-modal-text">
              <strong>{acc?.name || 'This account'}</strong> and its courses will be hidden from Workspace. You can add it back anytime.
            </p>
            <div className="ws-modal-actions">
              <button type="button" className="ws-btn ws-btn-danger" onClick={() => removeAccount(pendingRemoveEmail)}>
                <Trash2 size={13} /> Remove
              </button>
              <button type="button" className="ws-btn ws-btn-ghost" onClick={() => setPendingRemoveEmail(null)}>Cancel</button>
            </div>
          </WsModal>
        );
      })()}

      {/* ─── Reset everything ─── */}
      {confirmResetAll && (
        <WsModal title="Reset workspace" icon={Trash2} onClose={() => setConfirmResetAll(false)}>
          <div className="ws-modal-summary">
            <span className="ws-badge is-muted">Accounts <strong>{accounts.length}</strong></span>
            <span className="ws-badge is-rose">Can’t be undone</span>
          </div>
          <p className="ws-modal-text">
            This removes every connected account, course choice and cached deadline from this device. You’ll need to sign in to Google Classroom again.
          </p>
          <div className="ws-modal-actions">
            <button type="button" className="ws-btn ws-btn-danger" onClick={handleResetAll}><Trash2 size={13} /> Reset everything</button>
            <button type="button" className="ws-btn ws-btn-ghost" onClick={() => setConfirmResetAll(false)}>Cancel</button>
          </div>
        </WsModal>
      )}

      {/* ─── Material / announcement preview ─── */}
      {selectedMaterial && (() => {
        const item = selectedMaterial;
        const isPost = item._itemType === 'announcement';
        const hasMats = item.materials && item.materials.length > 0;
        const typeLabel = isPost ? 'Announcement' : getMaterialTypeLabel(item.materials);
        const displayTitle = item.title || (hasMats ? getMaterialTitle(item.materials) : (isPost ? 'Announcement' : 'Untitled'));
        const fullText = item.text || item.description || '';
        return (
          <WsModal title={isPost ? 'Announcement' : 'Material'} icon={isPost ? Megaphone : BookOpen} onClose={() => setSelectedMaterial(null)} wide>
            <div className="ws-modal-summary">
              <span className="ws-badge is-amber">{typeLabel}</span>
              {item.creationTime && (
                <span className="ws-badge is-muted">
                  {new Date(item.creationTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
              {hasMats && <span className="ws-badge is-muted">Files <strong>{item.materials.length}</strong></span>}
            </div>
            {(item.title || !isPost) && <h4 className="ws-modal-heading">{displayTitle}</h4>}
            {fullText
              ? <div className="ws-modal-body-text">{fullText}</div>
              : <p className="ws-modal-text is-muted">No text with this post.</p>}

            {hasMats && (
              <div className="ws-modal-section">
                <span className="ws-group-label">Attachments <span>{item.materials.length}</span></span>
                <ul className="ws-list">
                  {item.materials.map((mat, i) => {
                    const AIcon = getMaterialIcon([mat]);
                    const link = getMaterialLink([mat]);
                    const inner = (
                      <>
                        <span className="ws-stream-icon"><AIcon size={14} /></span>
                        <span className="ws-stream-body">
                          <span className="ws-stream-title">{getMaterialTitle([mat])}</span>
                          <span className="ws-stream-meta"><span className="ws-type">{getMaterialTypeLabel([mat])}</span></span>
                        </span>
                        {link && <ExternalLink size={13} className="ws-stream-caret" />}
                      </>
                    );
                    return (
                      <li key={i}>
                        {link
                          ? <a className="ws-stream-row" href={link} target="_blank" rel="noopener noreferrer">{inner}</a>
                          : <span className="ws-stream-row is-static">{inner}</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="ws-modal-foot">
              <BookOpen size={12} />
              <span>From <strong>{selectedCourse?.name || 'this course'}</strong></span>
              {item.alternateLink && (
                <a className="ws-btn ws-btn-ghost ws-btn-sm" href={item.alternateLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={12} /> Open in Classroom
                </a>
              )}
            </div>
          </WsModal>
        );
      })()}
    </div>
  );
}
