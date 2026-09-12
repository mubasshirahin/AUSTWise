import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ShieldCheck,
  Mail,
  Check,
  Loader2,
  Search,
  Lock,
  Globe,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  RefreshCw,
  KeyRound,
  FileSearch,
  Zap,
  History,
  XCircle,
  Layers,
  LayoutGrid,
  Users,
  Clapperboard,
  Gamepad2,
  Briefcase,
  Cpu,
  GraduationCap,
  ShoppingBag,
  Plane,
  Landmark,
  HeartPulse,
  Newspaper,
  Smartphone,
  Building2,
  Shapes,
} from 'lucide-react';
import './DigitalFootprintCleaner.css';

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GSI_SRC = 'https://accounts.google.com/gsi/client';
const FAVICON_URL = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// How many result cards are rendered initially; the rest reveal on demand so
// a 200+ platform list never blocks the first paint of the results screen.
const PAGE_SIZE_CARDS = 60;
const PAGE_STEP_CARDS = 60;

// Category display config — order mirrors the server's grouping so the most
// personally-identifying categories (Social, Streaming…) surface first.
const CATEGORY_ORDER = [
  'Social', 'Streaming', 'Gaming', 'Work', 'Tech', 'Education',
  'Shopping', 'Travel', 'Fintech', 'Health', 'News', 'Telecom', 'Government', 'Other',
];

const CATEGORY_META = {
  Social:      { icon: Users,         label: 'Social' },
  Streaming:   { icon: Clapperboard,  label: 'Streaming' },
  Gaming:      { icon: Gamepad2,      label: 'Gaming' },
  Work:        { icon: Briefcase,     label: 'Work & Tools' },
  Tech:        { icon: Cpu,           label: 'Tech' },
  Education:   { icon: GraduationCap, label: 'Education' },
  Shopping:    { icon: ShoppingBag,   label: 'Shopping' },
  Travel:      { icon: Plane,         label: 'Travel & Ride' },
  Fintech:     { icon: Landmark,      label: 'Fintech' },
  Health:      { icon: HeartPulse,    label: 'Health' },
  News:        { icon: Newspaper,     label: 'News' },
  Telecom:     { icon: Smartphone,    label: 'Telecom' },
  Government:  { icon: Building2,     label: 'Government' },
  Other:       { icon: Shapes,        label: 'Other' },
};

const STEPS = [
  { n: 1, label: 'Enter your Gmail' },
  { n: 2, label: 'Verify it\'s you (Google login)' },
  { n: 3, label: 'Grant Inbox read access' },
  { n: 4, label: 'Scan your history' },
];

export default function DigitalFootprintCleaner() {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('locked'); // locked | auth | permission | mode | scanning | results | error
  const [gisLoaded, setGisLoaded] = useState(
    () => typeof window !== 'undefined' && Boolean(window.google?.accounts?.oauth2)
  );
  const [authError, setAuthError] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [scanProgress, setScanProgress] = useState({ processed: 0, total: 0, found: 0 });
  const [listCount, setListCount] = useState(0);
  const [platforms, setPlatforms] = useState([]);
  const [scanStats, setScanStats] = useState({ scanned: 0, total: 0, skipped: 0, mode: 'quick' });
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE_CARDS);

  const emailValid = EMAIL_RE.test(email.trim());
  const stepRef = useRef(step);
  const accessTokenRef = useRef(null);
  const abortRef = useRef(null);
  const cancelRequestedRef = useRef(false);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const startOver = useCallback(() => {
    cancelRequestedRef.current = true;
    if (abortRef.current) abortRef.current.abort();
    setStep('locked');
    setAuthError(null);
    setScanError(null);
    setPlatforms([]);
    setScanStats({ scanned: 0, total: 0, skipped: 0, mode: 'quick' });
    setScanProgress({ processed: 0, total: 0, found: 0 });
    setListCount(0);
    setFilter('');
    setCategory('all');
    setVisibleCount(PAGE_SIZE_CARDS);
    accessTokenRef.current = null;
  }, []);

  // ── Load Google Identity Services (GIS) once ──
  useEffect(() => {
    if (window.google?.accounts?.oauth2) {
      return;
    }
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => setGisLoaded(true));
      return;
    }
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => setGisLoaded(true);
    document.head.appendChild(script);
  }, []);

  // ── Step 1 · Authenticate with the entered Gmail ──
  const handleAuthenticate = () => {
    if (!gisLoaded) {
      setAuthError('Google sign-in is still loading. Please try again in a moment.');
      return;
    }
    if (!emailValid) {
      setAuthError('Please enter a valid Gmail address first.');
      return;
    }
    setAuthError(null);
    setStep('authing');

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email',
      prompt: 'consent',
      callback: async (response) => {
        if (response.error) {
          setAuthError('Google authentication was cancelled or failed. Please try again.');
          setStep('auth');
          return;
        }
        try {
          const res = await fetch(USERINFO_URL, {
            headers: { Authorization: `Bearer ${response.access_token}` },
          });
          const profile = await res.json();
          const authedEmail = (profile.email || '').toLowerCase();
          const entered = email.trim().toLowerCase();
          if (!authedEmail || authedEmail !== entered) {
            setAuthError(
              profile.email
                ? `You authenticated as ${profile.email}, but you entered ${email.trim()}. Please authenticate with the Gmail you entered.`
                : 'Could not read the authenticated Gmail address. Please try again.'
            );
            setStep('auth');
            return;
          }
          setStep('permission');
        } catch {
          setAuthError('Could not verify your Gmail address. Please try again.');
          setStep('auth');
        }
      },
      error_callback: () => {
        setAuthError('Google authentication failed. Please try again.');
        setStep('auth');
      },
    });
    client.requestAccessToken();
  };

  // ── Step 2 · Grant Inbox read permission, then pick a scan mode ──
  const handleGrantRead = () => {
    if (!gisLoaded) {
      setAuthError('Google sign-in is still loading. Please try again in a moment.');
      return;
    }
    setAuthError(null);
    setStep('granting');

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GMAIL_READONLY_SCOPE,
      login_hint: email.trim(),
      prompt: 'consent',
      callback: async (response) => {
        if (response.error) {
          setAuthError('Inbox read permission was denied. This step is required to scan your inbox.');
          setStep('permission');
          return;
        }
        accessTokenRef.current = response.access_token;
        setStep('mode');
      },
      error_callback: () => {
        setAuthError('Inbox read permission was denied. Please try again.');
        setStep('permission');
      },
    });
    client.requestAccessToken();
  };

  // ── Consume the SSE scan stream from /api/cleaner/scan ──
  const runScan = async (mode) => {
    const token = accessTokenRef.current;
    if (!token) {
      setStep('permission');
      return;
    }
    cancelRequestedRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;

    setScanProgress({ processed: 0, total: 0, found: 0 });
    setListCount(0);
    setScanError(null);
    setStep('scanning');
    try {
      const res = await fetch('/api/cleaner/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: token,
          email: email.trim(),
          mode,
          ...(mode === 'quick' ? { maxResults: 1000 } : {}),
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error('The scan could not be started. Please try again.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finished = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop();
        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith('data:')) continue;
          let evt;
          try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
          if (evt.type === 'list') {
            setListCount(evt.listed || 0);
          } else if (evt.type === 'progress') {
            setScanProgress({
              processed: evt.processed || 0,
              total: evt.total || 0,
              found: evt.found || 0,
            });
          } else if (evt.type === 'done') {
            finished = true;
            setPlatforms(evt.platforms || []);
            setScanStats({
              scanned: evt.scanned || 0,
              total: evt.total || 0,
              skipped: evt.skipped || 0,
              mode: evt.mode || mode,
            });
            setVisibleCount(PAGE_SIZE_CARDS);
            setFilter('');
            setCategory('all');
            setStep('results');
          } else if (evt.type === 'error') {
            finished = true;
            setScanError(evt.error || 'Gmail scan failed.');
            setStep('error');
          }
        }
      }
      if (!finished && stepRef.current === 'scanning') {
        setScanError('The scan ended without a result. Please try again.');
        setStep('error');
      }
    } catch (err) {
      if (cancelRequestedRef.current) {
        // User pressed Cancel — return to the mode picker, not the error screen.
        if (stepRef.current === 'scanning') setStep('mode');
        return;
      }
      if (stepRef.current === 'scanning' || stepRef.current === 'error') {
        setScanError(err.message || 'Scan failed.');
        setStep('error');
      }
    } finally {
      abortRef.current = null;
    }
  };

  const handleCancelScan = () => {
    cancelRequestedRef.current = true;
    if (abortRef.current) abortRef.current.abort();
  };

  // ── Derived ──
  const progressPct = scanProgress.total
    ? Math.min(100, Math.round((scanProgress.processed / scanProgress.total) * 100))
    : 0;

  const scanPhase =
    scanProgress.total === 0
      ? listCount > 0
        ? `Indexing mailbox… ${listCount} messages listed`
        : 'Fetching mailbox index…'
      : scanProgress.processed < scanProgress.total
        ? `Scanned ${scanProgress.processed.toLocaleString()} of ${scanProgress.total.toLocaleString()} emails`
        : 'Finalizing your digital footprint…';

  const filteredPlatforms = platforms.filter((p) => {
    if (category !== 'all' && p.category !== category) return false;
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.domain.toLowerCase().includes(q) ||
      (p.sender || '').toLowerCase().includes(q)
    );
  });

  const categoryCounts = {};
  for (const p of platforms) {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  }
  const activeCategories = CATEGORY_ORDER.filter((c) => categoryCounts[c] > 0);

  // Split the filtered list into category sections, then reveal lazily across
  // section boundaries so large scans still paint fast.
  const sections = [];
  let shownTotal = 0;
  for (const cat of activeCategories) {
    const items = filteredPlatforms.filter((p) => p.category === cat);
    if (items.length === 0) continue;
    const slice = shownTotal < visibleCount
      ? items.slice(0, visibleCount - shownTotal)
      : [];
    shownTotal += slice.length;
    sections.push({ category: cat, items: slice, total: items.length });
  }
  const hiddenCount = filteredPlatforms.length - shownTotal;

  const notConfigured = !GOOGLE_CLIENT_ID;

  // ── Locked / permission-required default state ──
  if (step === 'locked') {
    return (
      <section className="dfc dfc-locked">
        <div className="dfc-orb dfc-orb-1" />
        <div className="dfc-orb dfc-orb-2" />

        <div className="dfc-lock-header">
          <div className="dfc-lock-icon">
            <ShieldCheck size={26} />
          </div>
          <span className="dfc-eyebrow">Digital Footprint Cleaner</span>
          <h2 className="dfc-title">Clean Your Digital Footprint</h2>
          <p className="dfc-subtitle">
            This tool scans <strong>your entire Gmail account</strong> via Google&apos;s official API to
            map every website where you registered or logged in with your Gmail address — from account
            creation to today. No guesswork, no scraping, no breach databases.
          </p>
        </div>

        {notConfigured ? (
          <div className="dfc-banner dfc-banner-error">
            <AlertTriangle size={18} />
            <div>
              <strong>Google client not configured.</strong> Set <code>VITE_GOOGLE_CLIENT_ID</code> in your{' '}
              <code>.env</code> file (a Google Cloud OAuth 2.0 Web client ID) and rebuild to enable this tool.
            </div>
          </div>
        ) : (
          <>
            <ol className="dfc-steps">
              {STEPS.map((s) => (
                <li key={s.n} className="dfc-step">
                  <span className="dfc-step-num">{s.n}</span>
                  <span className="dfc-step-label">{s.label}</span>
                </li>
              ))}
            </ol>

            <div className="dfc-lock-form">
              <label className="dfc-field-label" htmlFor="dfc-email">
                Your Gmail address
              </label>
              <div className="dfc-email-row">
                <div className="dfc-email-input-wrap">
                  <Mail size={18} />
                  <input
                    id="dfc-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && emailValid) handleAuthenticate();
                    }}
                    placeholder="you@gmail.com"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <button
                  type="button"
                  className="dfc-btn dfc-btn-primary"
                  onClick={handleAuthenticate}
                  disabled={!emailValid}
                >
                  <Lock size={16} />
                  Secure Login with Google
                </button>
              </div>
              <p className="dfc-field-hint">
                You&apos;ll complete two quick Google steps: verify the account, then grant read access.
              </p>
            </div>

            <div className="dfc-privacy">
              <Globe size={15} />
              <span>
                <strong>Privacy first:</strong> your token and inbox senders are analysed in memory and never
                stored. Revoke access anytime at{' '}
                <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
                  myaccount.google.com/permissions
                </a>
                .
              </span>
            </div>
          </>
        )}
      </section>
    );
  }

  // ── Step 1 / Step 2 wizard (authing | auth | granting | permission) ──
  if (step === 'auth' || step === 'authing' || step === 'permission' || step === 'granting') {
    const busy = step === 'authing' || step === 'granting';
    const onAuthStep = step === 'auth' || step === 'authing';
    const currentStepNum = onAuthStep ? 2 : 3;

    return (
      <section className="dfc dfc-wizard">
        <div className="dfc-wizard-head">
          <span className="dfc-eyebrow">Permission Required</span>
          <h3 className="dfc-wizard-title">
            {onAuthStep ? 'Verify your Gmail' : 'Grant Inbox read access'}
          </h3>
          <p className="dfc-wizard-desc">
            {onAuthStep
              ? `Google will ask you to sign in as ${email.trim()}.`
              : 'One more step: allow AUSTWise to read your inbox senders so the scan can list your platforms.'}
          </p>
        </div>

        <div className="dfc-wizard-stepper">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className={`dfc-stepper-item ${s.n < currentStepNum ? 'is-done' : ''} ${s.n === currentStepNum ? 'is-active' : ''}`}
            >
              <span className="dfc-stepper-dot">
                {s.n < currentStepNum ? <Check size={14} /> : s.n}
              </span>
              <span className="dfc-stepper-label">{s.label}</span>
            </div>
          ))}
        </div>

        {authError && (
          <div className="dfc-banner dfc-banner-error">
            <AlertTriangle size={18} />
            <span>{authError}</span>
          </div>
        )}

        <div className="dfc-wizard-actions">
          {onAuthStep ? (
            <button
              type="button"
              className="dfc-btn dfc-btn-primary dfc-btn-lg"
              onClick={handleAuthenticate}
              disabled={busy}
            >
              {busy ? <Loader2 size={18} className="dfc-spin" /> : <KeyRound size={18} />}
              {busy ? 'Opening Google…' : 'Continue with Google'}
            </button>
          ) : (
            <button
              type="button"
              className="dfc-btn dfc-btn-primary dfc-btn-lg"
              onClick={handleGrantRead}
              disabled={busy}
            >
              {busy ? <Loader2 size={18} className="dfc-spin" /> : <ShieldCheck size={18} />}
              {busy ? 'Requesting access…' : 'Grant Inbox Read Access'}
            </button>
          )}
          <button type="button" className="dfc-btn dfc-btn-ghost" onClick={startOver} disabled={busy}>
            <RotateCcw size={15} />
            Start over
          </button>
        </div>

        <div className="dfc-wizard-note">
          <Lock size={14} />
          <span>The token stays in your browser session and is used in memory only.</span>
        </div>
      </section>
    );
  }

  // ── Step 3 · Choose scan depth ──
  if (step === 'mode') {
    return (
      <section className="dfc dfc-wizard">
        <div className="dfc-wizard-head">
          <span className="dfc-eyebrow">Access granted</span>
          <h3 className="dfc-wizard-title">Choose your scan depth</h3>
          <p className="dfc-wizard-desc">
            How much of <strong>{email.trim()}</strong>&apos;s history should be searched for platform signups?
          </p>
        </div>

        <div className="dfc-wizard-stepper">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className={`dfc-stepper-item ${s.n < 4 ? 'is-done' : ''} ${s.n === 4 ? 'is-active' : ''}`}
            >
              <span className="dfc-stepper-dot">
                {s.n < 4 ? <Check size={14} /> : s.n}
              </span>
              <span className="dfc-stepper-label">{s.label}</span>
            </div>
          ))}
        </div>

        {authError && (
          <div className="dfc-banner dfc-banner-error">
            <AlertTriangle size={18} />
            <span>{authError}</span>
          </div>
        )}

        <div className="dfc-modes">
          <button
            type="button"
            className="dfc-mode-card"
            onClick={() => runScan('quick')}
          >
            <span className="dfc-mode-icon dfc-mode-icon-quick">
              <Zap size={20} />
            </span>
            <span className="dfc-mode-name">Quick Scan</span>
            <span className="dfc-mode-desc">
              Latest ~1,000 emails across your whole account. Fast preview — takes seconds.
            </span>
            <span className="dfc-mode-meta">⚡ Best for a quick look</span>
          </button>

          <button
            type="button"
            className="dfc-mode-card dfc-mode-card-full"
            onClick={() => runScan('full')}
          >
            <span className="dfc-mode-icon dfc-mode-icon-full">
              <History size={20} />
            </span>
            <span className="dfc-mode-name">Full Footprint Scan</span>
            <span className="dfc-mode-desc">
              Every email since your account was created — archived, spam and all. Finds years-old signups.
            </span>
            <span className="dfc-mode-meta">🕰 Complete history · can take a few minutes</span>
          </button>
        </div>

        <div className="dfc-wizard-actions">
          <button type="button" className="dfc-btn dfc-btn-ghost" onClick={startOver}>
            <RotateCcw size={15} />
            Start over
          </button>
        </div>

        <div className="dfc-wizard-note">
          <Lock size={14} />
          <span>Only sender addresses are read — message bodies are never opened or stored.</span>
        </div>
      </section>
    );
  }

  // ── Scanning state ──
  if (step === 'scanning') {
    return (
      <section className="dfc dfc-scanning">
        <div className="dfc-scan-stage">
          <div className="dfc-scan-icon">
            <Mail size={30} />
            <span className="dfc-scan-ring dfc-scan-ring-1" />
            <span className="dfc-scan-ring dfc-scan-ring-2" />
            <span className="dfc-scan-line" />
          </div>
          <h3 className="dfc-scan-title">Scanning your mailbox</h3>
          <p className="dfc-scan-phase">{scanPhase}</p>

          <div className="dfc-progress-track">
            <div
              className={`dfc-progress-fill ${scanProgress.total === 0 ? 'is-indeterminate' : ''}`}
              style={scanProgress.total === 0 ? undefined : { width: `${progressPct}%` }}
            />
          </div>
          <div className="dfc-progress-meta">
            <span>
              {scanStats.mode === 'full' || scanProgress.total === 0
                ? 'Full history scan in progress…'
                : `Scanning latest ${scanProgress.total || 1000} messages…`}
            </span>
            <span>{scanProgress.total ? `${progressPct}%` : ''}</span>
          </div>

          <div className="dfc-scan-live">
            <div className="dfc-live-stat">
              <Mail size={15} />
              <span className="dfc-live-num">{scanProgress.processed.toLocaleString()}</span>
              <span className="dfc-live-label">emails scanned</span>
            </div>
            <div className="dfc-live-stat is-accent">
              <Layers size={15} />
              <span className="dfc-live-num">{scanProgress.found.toLocaleString()}</span>
              <span className="dfc-live-label">unique services found</span>
            </div>
          </div>
        </div>

        <ul className="dfc-scan-checks">
          <li>
            <Check size={14} /> Authenticated as {email.trim()}
          </li>
          <li>
            <Check size={14} /> Inbox read permission granted
          </li>
          <li className="is-active">
            <Loader2 size={14} className="dfc-spin" /> Mapping every sender to a platform…
          </li>
        </ul>

        <button type="button" className="dfc-btn dfc-btn-danger" onClick={handleCancelScan}>
          <XCircle size={15} />
          Cancel scan
        </button>

        <p className="dfc-privacy-inline">
          <FileSearch size={14} />
          Extracting sender domains only — message bodies are never read or stored.
        </p>
      </section>
    );
  }

  // ── Error state ──
  if (step === 'error') {
    return (
      <section className="dfc dfc-error">
        <div className="dfc-error-icon">
          <AlertTriangle size={28} />
        </div>
        <h3 className="dfc-error-title">Scan failed</h3>
        <p className="dfc-error-desc">{scanError}</p>
        <div className="dfc-wizard-actions">
          {accessTokenRef.current ? (
            <button
              type="button"
              className="dfc-btn dfc-btn-primary"
              onClick={() => {
                setScanError(null);
                setStep('mode');
              }}
            >
              <RefreshCw size={16} />
              Try again
            </button>
          ) : (
            <button
              type="button"
              className="dfc-btn dfc-btn-primary"
              onClick={() => {
                setStep('permission');
                setScanError(null);
              }}
            >
              <RefreshCw size={16} />
              Grant access again
            </button>
          )}
          <button type="button" className="dfc-btn dfc-btn-ghost" onClick={startOver}>
            <RotateCcw size={15} />
            Start over
          </button>
        </div>
      </section>
    );
  }

  // ── Results dashboard ──
  const totalPlatforms = platforms.length;
  return (
    <section className="dfc dfc-results">
      <div className="dfc-results-head">
        <div className="dfc-results-title-wrap">
          <span className="dfc-eyebrow">Scan complete</span>
          <h3 className="dfc-results-title">Your Digital Footprint</h3>
          <p className="dfc-results-sub">
            <strong>{totalPlatforms}</strong> platform{totalPlatforms === 1 ? '' : 's'} found across{' '}
            {scanStats.scanned.toLocaleString()} inbox message{scanStats.scanned === 1 ? '' : 's'} for{' '}
            <strong>{email.trim()}</strong>
            {scanStats.skipped > 0 ? ` · ${scanStats.skipped.toLocaleString()} unreadable messages skipped` : ''}
          </p>
          <span className={`dfc-mode-badge ${scanStats.mode === 'full' ? 'is-full' : ''}`}>
            {scanStats.mode === 'full' ? 'Full history scan' : 'Quick scan (~1,000)'}
          </span>
        </div>
        <div className="dfc-results-actions">
          <button
            type="button"
            className="dfc-btn dfc-btn-ghost"
            onClick={() => {
              setScanError(null);
              setStep(accessTokenRef.current ? 'mode' : 'permission');
            }}
          >
            <RefreshCw size={15} />
            Rescan
          </button>
          <button type="button" className="dfc-btn dfc-btn-ghost" onClick={startOver}>
            <RotateCcw size={15} />
            Start over
          </button>
        </div>
      </div>

      {totalPlatforms > 0 && (
        <div className="dfc-chips" aria-label="Filter by category">
          <button
            type="button"
            className={`dfc-chip ${category === 'all' ? 'is-active' : ''}`}
            onClick={() => {
              setCategory('all');
              setVisibleCount(PAGE_SIZE_CARDS);
            }}
          >
            <LayoutGrid size={13} />
            All
            <span className="dfc-chip-count">{totalPlatforms}</span>
          </button>
          {activeCategories.map((cat) => (
            <CategoryChip
              key={cat}
              cat={cat}
              count={categoryCounts[cat]}
              active={category === cat}
              onClick={() => {
                setCategory(category === cat ? 'all' : cat);
                setVisibleCount(PAGE_SIZE_CARDS);
              }}
            />
          ))}
        </div>
      )}

      <div className="dfc-search">
        <Search size={17} />
        <input
          type="text"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setVisibleCount(PAGE_SIZE_CARDS);
          }}
          placeholder="Filter platforms… e.g. Netflix, spotify.com"
        />
        <span className="dfc-search-count">{filteredPlatforms.length} shown</span>
      </div>

      {filteredPlatforms.length === 0 ? (
        <div className="dfc-empty">
          <Globe size={28} />
          <p>
            {totalPlatforms === 0
              ? 'No platforms found in the messages scanned. Try a Full Footprint Scan to search your entire account history.'
              : 'No platforms match your filter.'}
          </p>
          {totalPlatforms > 0 && (
            <button
              type="button"
              className="dfc-btn dfc-btn-ghost"
              onClick={() => {
                setFilter('');
                setCategory('all');
                setVisibleCount(PAGE_SIZE_CARDS);
              }}
            >
              <RotateCcw size={14} />
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          {sections.map(({ category: cat, items, total }) => {
            const meta = CATEGORY_META[cat] || CATEGORY_META.Other;
            const CatIcon = meta.icon;
            return (
              <section key={cat} className="dfc-cat-section">
                <header className="dfc-cat-head">
                  <span className="dfc-cat-icon">
                    <CatIcon size={14} />
                  </span>
                  <h4 className="dfc-cat-title">{meta.label}</h4>
                  <span className="dfc-cat-count">{total.toLocaleString()}</span>
                  {items.length < total && (
                    <span className="dfc-cat-partial">
                      showing {items.length.toLocaleString()} — use “Show more” below
                    </span>
                  )}
                </header>
                <div className="dfc-grid">
                  {items.map((p) => (
                    <article key={p.domain} className="dfc-card">
                      <div className="dfc-card-top">
                        <PlatformAvatar name={p.name} domain={p.domain} />
                        <span className="dfc-badge">
                          <span className="dfc-badge-dot" /> Active Account
                        </span>
                      </div>
                      <h4 className="dfc-card-name">{p.name}</h4>
                      <a
                        className="dfc-card-domain"
                        href={`https://${p.domain}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {p.domain}
                        <ExternalLink size={12} />
                      </a>
                      <div className="dfc-card-stats">
                        <span>{p.emailCount.toLocaleString()} email{p.emailCount === 1 ? '' : 's'}</span>
                        <span>·</span>
                        <span>{p.accountCount.toLocaleString()} sender{p.accountCount === 1 ? '' : 's'}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
          {hiddenCount > 0 && (
            <div className="dfc-show-more">
              <span className="dfc-show-more-info">
                Showing {shownTotal.toLocaleString()} of {filteredPlatforms.length.toLocaleString()} platforms
              </span>
              <button
                type="button"
                className="dfc-btn dfc-btn-ghost"
                onClick={() => setVisibleCount((c) => c + PAGE_STEP_CARDS)}
              >
                <Layers size={15} />
                Show {Math.min(PAGE_STEP_CARDS, hiddenCount)} more
              </button>
            </div>
          )}
        </>
      )}

      <div className="dfc-privacy dfc-results-foot">
        <Globe size={15} />
        <span>
          This list is rebuilt from your mailbox every scan. It is never saved — revoke access anytime at{' '}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
            myaccount.google.com/permissions
          </a>
          .
        </span>
      </div>
    </section>
  );
}

function CategoryChip({ cat, count, active, onClick }) {
  const meta = CATEGORY_META[cat] || CATEGORY_META.Other;
  const Icon = meta.icon;
  return (
    <button
      type="button"
      className={`dfc-chip ${active ? 'is-active' : ''}`}
      onClick={onClick}
      title={`Show only ${meta.label} platforms`}
    >
      <Icon size={13} />
      {meta.label}
      <span className="dfc-chip-count">{count}</span>
    </button>
  );
}

function PlatformAvatar({ name, domain }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || domain || '?').charAt(0).toUpperCase();

  if (failed) {
    return (
      <div className="dfc-avatar dfc-avatar-fallback" aria-hidden="true">
        {initial}
      </div>
    );
  }
  return (
    <div className="dfc-avatar">
      <img
        src={FAVICON_URL(domain)}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
