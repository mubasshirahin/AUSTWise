import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { GraduationCap, Briefcase, BookOpen, Moon, Sun, Newspaper, Terminal, SquareTerminal, Gauge, MoonStar, Pen, PenTool, Building2, Check, Eye, EyeOff, Zap, Type, Grid2x2, Cpu, ArrowLeft, Orbit } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getYearSemOptions } from '../../utils/semester';
import { getPasswordGrade } from '../../utils/passwordStrength';
import { getAllAccounts } from '../../utils/authStorage';
import ParticleField from './ParticleField';
import brandMark from '../../assets/austwise-icon-final.svg';
import './AuthPage.css';

const EMAIL_DOMAIN = '@aust.edu';

const departments = ['CSE', 'EEE', 'CE', 'ME', 'IPE', 'TE', 'ARCH', 'BBA'];

const roleOptions = [
  { id: 'student', label: 'Student', icon: GraduationCap },
  { id: 'faculty', label: 'Faculty', icon: BookOpen },
  { id: 'alumni', label: 'Alumni', icon: Briefcase },
];

const darkThemeOptions = [
  { id: 'dark',                  label: 'Dark',       icon: Moon       },
  { id: 'midnight',              label: 'Midnight',   icon: MoonStar   },
  { id: 'nexus',                 label: 'Nexus',      icon: Cpu        },
  { id: 'cyberpunk',             label: 'Cyberpunk',  icon: Terminal   },
  { id: 'terminal',              label: 'Terminal',   icon: SquareTerminal },
  { id: 'art-deco',              label: 'Art Deco',   icon: Building2  },
  { id: 'poster',                label: 'Bold Type',  icon: Type       },
  { id: 'bitcoindefi',           label: 'Bitcoin Defi', icon: Zap      },
  { id: 'meshtopo',              label: 'Mesh Topology', icon: Orbit   },
];

const lightThemeOptions = [
  { id: 'light',                 label: 'Light',      icon: Sun        },
  { id: 'swiss',                 label: 'Swiss',      icon: Grid2x2    },
  { id: 'newsprint',             label: 'Newsprint',  icon: Newspaper  },
  { id: 'sketchbook',            label: 'Sketchbook', icon: PenTool    },
  { id: 'minimalist-monochrome', label: 'Monochrome', icon: Pen        },
  { id: 'industrial',            label: 'Industrial', icon: Gauge      },
];

const themeOptions = [...darkThemeOptions, ...lightThemeOptions];

const parseBatchInput = (input) => {
  const raw = String(input || '').trim();
  const match = raw.match(/^([A-Za-z]+)\s+(\d+)$/);
  return match ? { batchName: match[1], batchNo: match[2] } : null;
};
const batchFormatHint = 'Use one word for the batch name, then a space and the batch number (for example: Batch 45).';

const defaultSignup = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'student',
  department: 'CSE',
  batchNo: '',
  yearSemester: '1.1',
  designation: '',
  company: '',
  graduationYear: '',
  previousEmail: '',
};

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

function formatMemberCount(count) {
  if (!Number.isFinite(count) || count < 0) return '—';
  if (count >= 1000) return `${(Math.floor(count / 100) / 10).toFixed(1)}K+`;
  if (count >= 100) return `${Math.floor(count / 100) * 100}+`;
  if (count >= 10) return `${Math.floor(count / 10) * 10}+`;
  return count > 0 ? '1+' : '0+';
}


export default function AuthPage() {
  const { isAuthenticated, isLoading, login, loginDirect, loginGuest, signup } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = location.state?.from || '/';

  const [mode, setMode] = useState('login');
  const [signupStep, setSignupStep] = useState(1);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState(defaultSignup);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [focusKind, setFocusKind] = useState(null);
  const [sending, setSending] = useState(false);
  const [memberCount, setMemberCount] = useState(null);
  const signupFormRef = useRef(null);
  const yearSemOptions = useMemo(() => getYearSemOptions(signupForm.department), [signupForm.department]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [socialErr, setSocialErr] = useState('');
  const [accessRequestSent, setAccessRequestSent] = useState(false);
  const [pendingGoogleAccount, setPendingGoogleAccount] = useState(null);
  const pendingCredentialRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/stats/count', { credentials: 'same-origin' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!cancelled && data?.success) {
          setMemberCount(data.count);
        }
      })
      .catch(() => {});

    const stream = new EventSource('/api/stats/count/stream');
    stream.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Number.isFinite(data.count)) setMemberCount(data.count);
      } catch { /* Ignore malformed stream events. */ }
    };

    return () => {
      cancelled = true;
      stream.close();
    };
  }, []);

  // Redirect after all hooks so the hook order stays constant on every render
  // (an early return before these hooks would make React throw "Rendered fewer
  // hooks than expected" whenever a session resolves mid-render).
  const shouldRedirect = !isLoading && isAuthenticated;

  const activeTheme = themeOptions.find((t) => t.id === theme) || themeOptions[0];
  const ThemeIcon = activeTheme.icon;
  const isAustEmail = (email) => /@(?:[a-z0-9-]+\.)*aust\.edu$/i.test(String(email || '').trim());
  const isAccessRequest = false;

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setAccessRequestSent(false);
    setSocialErr('');
    setPendingGoogleAccount(null);
    pendingCredentialRef.current = null;
    setSignupStep(1);
  };

  const handleContinue = () => {
    setError('');
    // Google signup skips step 1 entirely (name/email/password already handled)
    if (pendingGoogleAccount) {
      setSignupStep(2);
      return;
    }
    // Let the browser surface native inline validation for the step-1 fields
    // (required / email format / minLength) before advancing.
    if (signupFormRef.current && !signupFormRef.current.reportValidity()) {
      return;
    }
    if (signupForm.role === 'student' && !isAustEmail(signupForm.email)) {
      setError('Student accounts must use an @aust.edu email address.');
      return;
    }
    // Password match isn't expressible in HTML constraints — check it here.
    if (signupForm.password !== signupForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSignupStep(2);
  };

  const decodeJwtPayload = (token) => {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch { return null; }
  };


  const fetchGooglePicture = useCallback(async (idToken) => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.picture || null;
    } catch { return null; }
  }, []);

  // Mirror a server user into the localStorage accounts list so client-side
  // features (directories, user-scoped storage) keep working with the same id.
  const syncGoogleAccountToLocal = useCallback((serverUser) => {
    try {
      const accounts = getAllAccounts().filter((a) => a.id !== 'guest');
      const idx = accounts.findIndex((a) => a.id === serverUser.id || a.email === serverUser.email);
      const record = {
        id: serverUser.id,
        awid: serverUser.awid || '',
        name: serverUser.name,
        email: serverUser.email,
        password: (idx >= 0 && accounts[idx].password) || btoa(crypto.randomUUID()),
        role: serverUser.role || 'student',
        department: serverUser.department || '',
        batch: serverUser.batch || '',
        batchNo: serverUser.batchNo || '',
        batchName: serverUser.batchName || '',
        designation: serverUser.designation || '',
        company: serverUser.company || '',
        graduationYear: serverUser.graduationYear || '',
        yearSemester: serverUser.yearSemester || '',
        section: serverUser.section || '',
        labSection: serverUser.labSection || '',
        semester: serverUser.semester ?? 1,
        avatar: serverUser.avatar || null,
        linkedSocial: serverUser.linkedSocial || {},
        linkedAccounts: serverUser.linkedAccounts || [],
        cgpa: serverUser.cgpa || 0,
        creditsCompleted: serverUser.creditsCompleted || 0,
        totalCredits: serverUser.totalCredits || 160,
        createdAt: serverUser.createdAt || new Date().toISOString(),
      };
      if (idx >= 0) accounts[idx] = { ...accounts[idx], ...record };
      else accounts.push(record);
      localStorage.setItem('aust-auth-accounts-v1', JSON.stringify(accounts));
    } catch { /* best effort */ }
  }, []);

  const finalizeGoogleLogin = useCallback(async (payload, credential) => {
    // Google JWT may omit the picture claim for some accounts.
    let pictureUrl = payload.picture;
    if (!pictureUrl) {
      pictureUrl = await fetchGooglePicture(credential);
    }

    // Preferred path: server-side find-or-create. The account persists in
    // users.json (appears in member counts / directories) and gets an auth
    // cookie so the session survives reloads. Never create a client-only
    // signed-in session because protected APIs require the server cookie.
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.success || !data.user) throw new Error(data?.error || 'Google auth failed');

      pendingCredentialRef.current = credential;
      const serverUser = {
        ...data.user,
        avatar: pictureUrl || data.user.avatar || null,
        linkedSocial: { ...(data.user.linkedSocial || {}), gmail: payload.email },
      };

      if (data.existing && !serverUser.signupIncomplete) {
        // Already registered — straight to the dashboard.
        await loginDirect(serverUser);
        syncGoogleAccountToLocal(serverUser);
        return;
      }

      // Brand-new Google account — collect role/department/batch in step 2.
      setPendingGoogleAccount(serverUser);
      setSignupForm((prev) => ({
        ...prev,
        name: payload.name || '',
        email: payload.email || '',
        password: '',
        confirmPassword: '',
      }));
      setMode('signup');
      setSignupStep(2);
      setError('');
      setSocialErr('');
      return;
    } catch (authError) {
      pendingCredentialRef.current = null;
      setSocialErr(authError.message || 'Could not verify your sign-in with the server. Please try again.');
      return;
    }

    // ── Fallback: client-side only (server down) ──
  }, [loginDirect, syncGoogleAccountToLocal]);

  const googleBtnRef = useRef(null);
  const gsiRenderedRef = useRef(false);
  const finalizeRef = useRef(finalizeGoogleLogin);
  useEffect(() => { finalizeRef.current = finalizeGoogleLogin; }, [finalizeGoogleLogin]);

  /* Load GIS and initialize once (popup mode avoids FedCM dependency) */
  useEffect(() => {
    if (gsiRenderedRef.current) return;

    const init = () => {
      if (typeof google === 'undefined' || !google.accounts) return;
      // Cancel any previous initialization to avoid "called multiple times" warning
      google.accounts.id.cancel();
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        ux_mode: 'popup',
        callback: (response) => {
          const payload = decodeJwtPayload(response.credential);
          if (!payload || !payload.email) { setSocialErr('Invalid Google credential'); return; }
          finalizeRef.current(payload, response.credential);
        },
      });
    };

    // Avoid loading the GIS script twice (React StrictMode double-mount)
    const existingScript = document.querySelector('script[src*="gsi/client"]');
    if (!existingScript && typeof window.google === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        init();
        gsiRenderedRef.current = true;
        if (googleBtnRef.current) {
          google.accounts.id.renderButton(googleBtnRef.current, {
            type: 'standard', theme: 'outline', size: 'large',
            width: googleBtnRef.current.parentElement?.offsetWidth || 280,
            shape: 'rectangular', text: 'signin_with', logo_alignment: 'left',
          });
        }
      };
      document.head.appendChild(script);
    } else if (typeof window.google !== 'undefined' && window.google.accounts) {
      init();
      gsiRenderedRef.current = true;
      if (googleBtnRef.current) {
        google.accounts.id.renderButton(googleBtnRef.current, {
          type: 'standard', theme: 'outline', size: 'large',
          width: googleBtnRef.current.parentElement?.offsetWidth || 280,
          shape: 'rectangular', text: 'signin_with', logo_alignment: 'left',
        });
      }
    }
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(loginForm.email, loginForm.password);
      navigate(redirectPath, { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    setError('');
    setAccessRequestSent(false);
    const signupBatch = ['student', 'alumni'].includes(signupForm.role) ? parseBatchInput(signupForm.batchNo) : null;
    if (['student', 'alumni'].includes(signupForm.role) && !signupBatch) {
      setError(batchFormatHint);
      return;
    }

    // Google signup: no password needed, just update the account with remaining fields
    if (pendingGoogleAccount) {
      // Only @aust.edu emails are allowed — no role exceptions.
      const googleEmail = (pendingGoogleAccount.email || '').toLowerCase().trim();
      if (!isAustEmail(googleEmail)) {
        setError('Only @aust.edu email addresses are allowed with Google login.');
        return;
      }

      setSubmitting(true);
      try {
        const [yr, term] = (signupForm.yearSemester || '1.1').split('.').map(Number);
        const semesterNum = (yr - 1) * 2 + term;
        const { batchName, batchNo } = signupBatch;
        const profile = {
          role: signupForm.role,
          department: signupForm.department,
          batchNo,
          batchName,
          batch: `${batchName} ${batchNo}`.trim(),
          yearSemester: signupForm.yearSemester,
          semester: semesterNum,
          designation: signupForm.designation,
          company: signupForm.company,
          graduationYear: signupForm.graduationYear,
        };

        const credential = pendingCredentialRef.current;
        if (credential) {
          // Server-side completion — persists to users.json and sets the cookie.
          const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential, profile }),
          });
          const data = await res.json().catch(() => null);
          if (!data?.success || !data.user) throw new Error(data?.error || 'Failed to complete Google signup.');
          const updatedUser = {
            ...data.user,
            avatar: pendingGoogleAccount.avatar || data.user.avatar,
            linkedSocial: { ...(data.user.linkedSocial || {}), gmail: googleEmail },
          };
          await loginDirect(updatedUser);
          syncGoogleAccountToLocal(updatedUser);
          setPendingGoogleAccount(null);
          pendingCredentialRef.current = null;
          navigate(redirectPath, { replace: true });
        } else {
          throw new Error('Google sign-in session expired. Start Google sign-in again to finish creating your account.');
        }
      } catch (e) {
        setError(e.message || 'Signup failed.');
        setSubmitting(false);
      }
      return;
    }

    if (signupForm.role === 'student' && !isAustEmail(signupForm.email)) {
      setError('Student accounts must use an @aust.edu email address.');
      return;
    }

    if (isAccessRequest) {
      setSubmitting(true);
      try {
        const response = await fetch('/api/access-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: signupForm.name,
            email: signupForm.email,
            password: signupForm.password,
            role: signupForm.role,
            department: signupForm.department,
            designation: signupForm.designation,
            batch: signupBatch ? `${signupBatch.batchName} ${signupBatch.batchNo}` : '',
            batchName: signupBatch?.batchName || '',
            batchNo: signupBatch?.batchNo || '',
            graduationYear: signupForm.graduationYear,
            company: signupForm.company,
            previousEmail: signupForm.previousEmail,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.error || 'Could not send your access request.');
        setAccessRequestSent(true);
        setSubmitting(false);
      } catch (requestError) {
        setError(requestError.message || 'Could not send your access request.');
        setSubmitting(false);
      }
      return;
    }

    if (signupForm.password !== signupForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      // Map yearSemester (e.g. "3.1") to semester number (e.g. 5)
      const [yr, term] = (signupForm.yearSemester || '1.1').split('.').map(Number);
      const semesterNum = (yr - 1) * 2 + term;
      const { batchName, batchNo } = signupBatch;

      const signupResult = await signup({
        name: signupForm.name,
        email: signupForm.email,
        password: signupForm.password,
        role: signupForm.role,
        department: signupForm.department,
        batchNo,
        batchName,
        batch: `${batchName} ${batchNo}`.trim(),
        yearSemester: signupForm.yearSemester,
        semester: semesterNum,
        designation: signupForm.designation,
        company: signupForm.company,
        graduationYear: signupForm.graduationYear,
      });
      if (signupResult?.pendingApproval) {
        setAccessRequestSent(true);
        setSubmitting(false);
        return;
      }

      // ─── "Drop the mic" success ───
      // Reward the long form: fold the card up like an exam paper into an
      // envelope and zip it away, then slide into the dashboard.
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        navigate(redirectPath, { replace: true });
        return;
      }
      setSending(true);
      setTimeout(() => navigate(redirectPath, { replace: true }), 1150);
    } catch (signupError) {
      setError(signupError.message || 'Signup failed.');
      setSubmitting(false);
    }
  };

  const isStudent = signupForm.role === 'student';
  const isFaculty = signupForm.role === 'faculty';
  const isAlumni = signupForm.role === 'alumni';

  // ─── Mascot mood ───
  // Reacts to the focused field: covers its eyes on a masked password,
  // peeks when the password is revealed, glances down while typing else.
  const anyPwRevealed =
    (mode === 'login' && showLoginPw) ||
    (mode === 'signup' && (showSignupPw || (focusKind === 'confirm' && showConfirmPw)));
  let mascotMood = 'idle';
  if (focusKind === 'password' || focusKind === 'confirm') {
    mascotMood = anyPwRevealed ? 'peek' : 'cover';
  } else if (focusKind === 'text') {
    mascotMood = 'look';
  }

  // ─── Password strength (AUST grading scale) ───
  const activePassword = mode === 'login' ? loginForm.password : signupForm.password;
  const pwGrade = getPasswordGrade(activePassword);
  // The grid "powers up" while a password field is focused; its intensity
  // (and the logo glow) scale with how strong the password is.
  const energized = focusKind === 'password' || focusKind === 'confirm';
  const energyIntensity = energized ? Math.max(0.15, pwGrade.strength || 0) : 0;

  // ─── Department easter egg ───
  const activeDept = mode === 'signup' && signupStep === 2 ? signupForm.department : null;
  const blueprintMode = activeDept === 'ARCH';

  // ─── Email domain auto-complete ───
  const shouldSuggest = (value) => {
    const v = (value || '').trim();
    return v.length > 0 && !v.includes('@');
  };
  const completeLoginEmail = () =>
    setLoginForm((c) => ({ ...c, email: `${c.email.trim()}${EMAIL_DOMAIN}` }));
  const completeSignupEmail = () =>
    setSignupForm((c) => ({ ...c, email: `${c.email.trim()}${EMAIL_DOMAIN}` }));
  const onEmailKeyDown = (complete, suggest) => (e) => {
    if (suggest && (e.key === 'Tab' || e.key === 'Enter') && !e.shiftKey) {
      e.preventDefault();
      complete();
    }
  };
  const suggestLogin = shouldSuggest(loginForm.email);
  const suggestSignup = shouldSuggest(signupForm.email);

  if (shouldRedirect) {
    return <Navigate to={redirectPath} replace />;
  }

  return (
    <div
      className={`auth-page animate-fadeIn ${blueprintMode ? 'is-blueprint' : ''}`}
      style={{ '--pw-strength': energyIntensity }}
    >
      <div className="auth-page-bg">
        <div className="auth-page-grid" />
        <ParticleField theme={theme} energized={energized} intensity={energyIntensity} blueprint={blueprintMode} />
        <div key={`${theme}-orb-1`} className="auth-page-orb auth-page-orb-1" />
        <div key={`${theme}-orb-2`} className="auth-page-orb auth-page-orb-2" />
        <div key={`${theme}-orb-3`} className="auth-page-orb auth-page-orb-3" />
        <div className="auth-page-noise" aria-hidden="true" />
      </div>
      <button
        type="button"
        className="auth-back-home-btn"
        onClick={() => navigate('/')}
        aria-label="Back to home"
      >
        <ArrowLeft size={16} />
        <span>Back to Home</span>
      </button>
      <div className={`auth-shell ${sending ? 'is-sending' : ''}`}>
        <div className="auth-brand-outside">
          <div className="topbar-logo auth-topbar-logo">
            <img src={brandMark} alt="AUSTWise" className="topbar-wordmark-img" />
            <span className="topbar-brand-name">AUSTWise</span>
          </div>
        </div>

        {/* Live, rounded member count with fixed product stats. */}
        <div className="auth-impact">
          <div className="auth-impact-item">
            <strong>{formatMemberCount(memberCount)}</strong>
            <span>Members</span>
          </div>
          <div className="auth-impact-sep" />
          <div className="auth-impact-item">
            <strong>40+</strong>
            <span>Features</span>
          </div>
          <div className="auth-impact-sep" />
          <div className="auth-impact-item">
            <strong>24/7</strong>
            <span>Uptime</span>
          </div>
        </div>

        <div
          className={`auth-card glass-card-static stagger-children ${activeDept ? 'has-dept-egg' : ''} ${sending ? 'auth-card--sending' : ''}`}
          data-dept={activeDept || undefined}
        >
          {activeDept && <span className="auth-dept-fx" aria-hidden="true" data-dept={activeDept} />}
          <div className="auth-theme-switcher">
            <button
              type="button"
              className="auth-theme-btn"
              onClick={() => setThemeMenuOpen((open) => !open)}
              aria-label={`Theme: ${activeTheme.label}`}
            >
              <div className={`auth-theme-icon ${theme}`}>
                <ThemeIcon size={16} />
              </div>
            </button>
            {themeMenuOpen && (
              <div className="auth-theme-menu" role="menu">
                <span className="auth-theme-menu-heading">Dark Mode</span>
                {darkThemeOptions.map(({ id, label, icon: Icon }) => {
                  const isActive = theme === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isActive}
                      className={`auth-theme-menu-item ${isActive ? 'active' : ''}`}
                      onClick={() => { setTheme(id); setThemeMenuOpen(false); }}
                    >
                      <Icon size={14} />
                      <span>{label}</span>
                      {isActive && <Check size={12} className="auth-theme-menu-check" />}
                    </button>
                  );
                })}

                <div className="auth-theme-menu-divider" />

                <span className="auth-theme-menu-heading">Light Mode</span>
                {lightThemeOptions.map(({ id, label, icon: Icon }) => {
                  const isActive = theme === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isActive}
                      className={`auth-theme-menu-item ${isActive ? 'active' : ''}`}
                      onClick={() => { setTheme(id); setThemeMenuOpen(false); }}
                    >
                      <Icon size={14} />
                      <span>{label}</span>
                      {isActive && <Check size={12} className="auth-theme-menu-check" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`auth-mascot mood-${mascotMood}`} aria-hidden="true">
            <div className="auth-mascot-face">
              <span className="auth-mascot-eye left"><i className="auth-mascot-pupil" /></span>
              <span className="auth-mascot-eye right"><i className="auth-mascot-pupil" /></span>
              <span className="auth-mascot-paw left" />
              <span className="auth-mascot-paw right" />
            </div>
          </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            Sign Up
          </button>
        </div>

        {error && <div className="auth-message error">{error}</div>}
        {accessRequestSent && <div className="auth-message success">Request submitted. After admin approval, sign in with this email and password.</div>}
        {socialErr && <div className="auth-message error">{socialErr}</div>}

        <div className="auth-form-container">
        {mode === 'login' ? (
          <form className="auth-form" onSubmit={handleLogin} key="login">
            <label className="auth-field">
              Email
              <div className="auth-email-wrap">
                <input
                  id="login-email"
                  name="email"
                  autoComplete="username"
                  className="input"
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm((c) => ({ ...c, email: e.target.value }))}
                  onFocus={() => setFocusKind('text')}
                  onBlur={() => setFocusKind(null)}
                  onKeyDown={onEmailKeyDown(completeLoginEmail, suggestLogin)}
                  placeholder="you@aust.edu"
                  required
                />
                {suggestLogin && (
                  <span className="auth-email-suffix" aria-hidden="true">
                    {EMAIL_DOMAIN}
                  </span>
                )}
              </div>
            </label>
            <label className="auth-field">
              Password
              <div className="auth-input-eye">
                <input
                  id="login-password"
                  name="password"
                  autoComplete="current-password"
                  className="input"
                  type={showLoginPw ? 'text' : 'password'}
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((c) => ({ ...c, password: e.target.value }))}
                  onFocus={() => setFocusKind('password')}
                  onBlur={() => setFocusKind(null)}
                  placeholder="Password"
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowLoginPw((v) => !v)}
                  tabIndex={-1}
                  aria-label={showLoginPw ? 'Hide password' : 'Show password'}
                >
                  {showLoginPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>
            <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Login'}
            </button>
            <div className="auth-social-divider"><span>or</span></div>
            <div className="auth-social-buttons">
              <div className="btn-google-overlay-wrap">
                <button type="button" className="btn btn-social btn-gmail" tabIndex={-1}>
                  <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Login with Google
                </button>
                <div ref={googleBtnRef} className="btn-google-overlay"></div>
              </div>
            </div>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleSignup} ref={signupFormRef} key="signup">
            <div className="auth-steps" aria-hidden="true">
              <span className={`auth-step-dot ${signupStep === 1 ? 'active' : 'done'}`} />
              <span className="auth-step-line" />
              <span className={`auth-step-dot ${signupStep === 2 ? 'active' : ''}`} />
            </div>
            <p className="auth-step-label">
              Step {signupStep} of 2 — {signupStep === 1 ? 'Your account' : 'Role details'}
            </p>

            {signupStep === 1 && (
            <div className="auth-step-panel">
            <label className="auth-field">
              Full name
              <input
                id="signup-name"
                name="name"
                autoComplete="name"
                className="input"
                value={signupForm.name}
                onChange={(e) => setSignupForm((c) => ({ ...c, name: e.target.value }))}
                onFocus={() => setFocusKind('text')}
                onBlur={() => setFocusKind(null)}
                placeholder="Your name"
                required
              />
            </label>

            <label className="auth-field">
              Email
              <div className="auth-email-wrap">
                <input
                  id="signup-email"
                  name="email"
                  autoComplete="email"
                  className="input"
                  type="email"
                  value={signupForm.email}
                  onChange={(e) => setSignupForm((c) => ({ ...c, email: e.target.value }))}
                  onFocus={() => setFocusKind('text')}
                  onBlur={() => setFocusKind(null)}
                  onKeyDown={onEmailKeyDown(completeSignupEmail, suggestSignup)}
                  placeholder={['faculty', 'alumni'].includes(signupForm.role) ? 'name@aust.edu or personal email' : 'you@aust.edu'}
                  required
                />
                {suggestSignup && (
                  <span className="auth-email-suffix" aria-hidden="true">
                    {EMAIL_DOMAIN}
                  </span>
                )}
              </div>
            </label>

            <div style={{ display: 'grid', gap: '10px' }}>
              <label className="auth-field">
                Password
                <div className="auth-input-eye">
                  <input
                    id="signup-password"
                    name="password"
                    autoComplete="new-password"
                    className="input"
                    type={showSignupPw ? 'text' : 'password'}
                    value={signupForm.password}
                    onChange={(e) => setSignupForm((c) => ({ ...c, password: e.target.value }))}
                    onFocus={() => setFocusKind('password')}
                    onBlur={() => setFocusKind(null)}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="auth-eye-btn"
                    onClick={() => setShowSignupPw((v) => !v)}
                    tabIndex={-1}
                    aria-label={showSignupPw ? 'Hide password' : 'Show password'}
                  >
                    {showSignupPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </label>
              <label className="auth-field">
                Confirm Password
                <div className="auth-input-eye">
                  <input
                    id="signup-confirm-password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    className="input"
                    type={showConfirmPw ? 'text' : 'password'}
                    value={signupForm.confirmPassword}
                    onChange={(e) => setSignupForm((c) => ({ ...c, confirmPassword: e.target.value }))}
                    onFocus={() => setFocusKind('confirm')}
                    onBlur={() => setFocusKind(null)}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="auth-eye-btn"
                    onClick={() => setShowConfirmPw((v) => !v)}
                    tabIndex={-1}
                    aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </label>
            </div>

            {signupForm.password && (
              <div className={`auth-pw-grade tone-${pwGrade.tone}`}>
                <div className="auth-pw-grade-bar">
                  <span
                    className="auth-pw-grade-fill"
                    style={{ width: `${pwGrade.pct}%` }}
                  />
                </div>
                <div className="auth-pw-grade-row">
                  <span className="auth-pw-grade-badge">{pwGrade.grade}</span>
                  <span className="auth-pw-grade-label">{pwGrade.label}</span>
                </div>
              </div>
            )}

            <div className="auth-role-grid">
              {roleOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`auth-role-card ${signupForm.role === option.id ? 'active' : ''}`}
                  onClick={() => setSignupForm((c) => ({ ...c, role: option.id }))}
                >
                  <option.icon size={18} />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>

            <button type="button" className="btn btn-primary auth-submit" onClick={handleContinue}>
              Continue →
            </button>
            </div>
            )}

            {signupStep === 2 && (
            <div className="auth-step-panel">
            <div className={`auth-dept-row ${!isFaculty && !isAlumni ? 'grid-2' : ''}`} style={{ gap: '10px' }}>
              <div className="auth-field">
                Department
                <div className={`auth-btn-grid ${!isFaculty && !isAlumni ? 'auth-btn-grid-4' : 'auth-btn-grid-8'}`}>
                  {departments.map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      className={`auth-btn-option ${signupForm.department === dept ? 'active' : ''}`}
                      onClick={() => setSignupForm((c) => ({ ...c, department: dept }))}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>
              {!isFaculty && !isAlumni && (
                <div className="auth-field">
                  Year-Sem
                  <div className="auth-btn-grid auth-btn-grid-2">
                    {yearSemOptions.map((ys) => (
                      <button
                        key={ys}
                        type="button"
                        className={`auth-btn-option ${signupForm.yearSemester === ys ? 'active' : ''}`}
                        onClick={() => setSignupForm((c) => ({ ...c, yearSemester: ys }))}
                      >
                        {ys}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {isStudent && (
              <label className="auth-field">
                Batch name &amp; no.
                <input
                  id="signup-batch-student"
                  name="batchNo"
                  className="input"
                  value={signupForm.batchNo}
                  onChange={(e) => setSignupForm((c) => ({ ...c, batchNo: e.target.value }))}
                  placeholder="e.g. Batch 45"
                  pattern="[A-Za-z]+\\s+[0-9]+"
                  title={batchFormatHint}
                  required
                />
              </label>
            )}

            {isAlumni && (
              <label className="auth-field">
                Batch name &amp; no.
                <input
                  id="signup-batch-alumni"
                  name="batchNo"
                  className="input"
                  value={signupForm.batchNo}
                  onChange={(e) => setSignupForm((c) => ({ ...c, batchNo: e.target.value }))}
                  placeholder="e.g. Batch 45"
                  pattern="[A-Za-z]+\\s+[0-9]+"
                  title={batchFormatHint}
                  required
                />
              </label>
            )}

            {isFaculty && (
              <>
                <div className="auth-field">
                  Designation
                  <div className="auth-btn-grid auth-btn-grid-2">
                    {['Lecturer', 'Senior Lecturer', 'Assistant Professor', 'Associate Professor', 'Professor', 'Other'].map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`auth-btn-option ${signupForm.designation === d ? 'active' : ''}`}
                        onClick={() => setSignupForm((c) => ({ ...c, designation: d }))}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="auth-field">
                  Batch name &amp; no.
                  <input
                    id="signup-batch-faculty"
                    name="batchNo"
                    className="input"
                    value={signupForm.batchNo}
                    onChange={(e) => setSignupForm((c) => ({ ...c, batchNo: e.target.value }))}
                    placeholder="e.g. Quanta 52"
                  />
                </label>
              </>
            )}

            {isAlumni && (
              <>
                <label className="auth-field">
                  Previous AUST email (optional, for account migration)
                  <input
                    id="signup-previous-email"
                    name="previousEmail"
                    className="input"
                    type="email"
                    value={signupForm.previousEmail}
                    onChange={(e) => setSignupForm((c) => ({ ...c, previousEmail: e.target.value }))}
                    placeholder="your-old-id@aust.edu"
                  />
                </label>
                <label className="auth-field">
                  Graduation year
                  <input
                    id="signup-grad-year"
                    name="graduationYear"
                    className="input"
                    value={signupForm.graduationYear}
                    onChange={(e) => setSignupForm((c) => ({ ...c, graduationYear: e.target.value }))}
                    placeholder="2024"
                  />
                </label>
                <label className="auth-field">
                  Company (optional)
                  <input
                    id="signup-company"
                    name="company"
                    className="input"
                    value={signupForm.company}
                    onChange={(e) => setSignupForm((c) => ({ ...c, company: e.target.value }))}
                    placeholder="Where you work now"
                  />
                </label>
              </>
            )}

            {['faculty', 'alumni'].includes(signupForm.role) && !isAustEmail(signupForm.email) && (
              <div className="auth-message success" style={{ marginTop: 0 }}>
                Your account will be created and held for admin approval before you can sign in.
              </div>
            )}

            <div className="auth-step-nav">
              <button
                type="button"
                className="btn btn-secondary auth-back-btn"
                onClick={() => { setError(''); setSignupStep(1); }}
              >
                ← Back
              </button>
              <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
                {submitting ? (isAccessRequest ? 'Sending request...' : 'Creating account...') : isAccessRequest ? 'Request access' : `Sign up as ${roleOptions.find((r) => r.id === signupForm.role)?.label}`}
              </button>
            </div>
            </div>
            )}
          </form>
        )}
        </div>

        <button
          type="button"
          className="btn btn-secondary auth-submit"
          onClick={() => { loginGuest(); navigate('/'); }}
        >
          Guest Mode
        </button>
        </div>
        {sending && (
          <div className="auth-envelope" aria-hidden="true">
            <div className="auth-envelope-flap" />
            <div className="auth-envelope-body" />
            <span className="auth-envelope-check">✓</span>
          </div>
        )}
      </div>
    </div>
  );
}
