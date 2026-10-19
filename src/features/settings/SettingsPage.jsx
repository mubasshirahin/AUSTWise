import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { useTheme, getThemeAccent } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useRoutine } from '../../context/RoutineContext';
import { Camera, CheckCircle, Pencil, Settings, User, Bell, Info, Save, BellOff, BellRing, Clock, AlertTriangle, ShieldCheck, ShieldAlert, GraduationCap, Users, Send, CheckCircle2, Clock3, Moon, Sun, Newspaper, Terminal, SquareTerminal, Gauge, MoonStar, Pen, PenTool, Building2, Type, Zap, Grid2x2, Cpu, MapPin, Trash2, Orbit, PawPrint, Palette } from 'lucide-react';
import AboutUs from './AboutUs';
import LinkedAccountsSection from './LinkedAccountsSection';
import GliderTabs from '../../components/GliderTabs';
import { useNotifications } from '../../hooks/useNotifications';
import useAdminMode from '../../hooks/useAdminMode';
import MastheadAccessControl from '../../components/MastheadAccessControl';
import FeatureAccessGate from '../admin/FeatureAccessGate';
import SidebarPageAccessPanel, { SidebarPageAccessHeader } from '../admin/SidebarPageAccessPanel';
import useWebSocket from '../../hooks/useWebSocket';
import { OrbitsProvider, useOrbits } from '../orbits/OrbitsContext';
import OrbitsConfigurationPanel from '../orbits/OrbitsConfigurationPanel';
import { useStalk } from '../stalk-road/StalkContext';
import { submitRoleApplication, getApplicationsByUserId, getUserApplicationStatus, getSlotVacancyMap, resignFromRole, withdrawApplication, deleteAccountById, createAwid, syncRoleApplicationsFromServer } from '../../utils/authStorage';
import './SettingsPage.css';
import '../../components/PageHero.css';

const departments = ['CSE', 'EEE', 'CE', 'ME', 'IPE', 'TE', 'ARCH', 'BBA'];
const juniorBatchByDepartment = {
  CSE: 55,
  EEE: 55,
  CE: 55,
  BBA: 55,
  ARCH: 55,
  TE: 45,
  IPE: 35,
  ME: 29,
};
const getYearSemesters = (department) => {
  const maxYear = department === 'ARCH' ? 5 : 4;
  const options = [];
  for (let y = 1; y <= maxYear; y++) {
    options.push(`Year ${y} - Semester 1`);
    options.push(`Year ${y} - Semester 2`);
  }
  return options;
};
const sections = ['A', 'B', 'C', 'D'];

function InviteLinkQr({ value }) {
  const [qrImage, setQrImage] = useState('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { width: 220, margin: 2, errorCorrectionLevel: 'M' })
      .then((dataUrl) => { if (active) setQrImage(dataUrl); })
      .catch(() => { if (active) setQrImage(''); });
    return () => { active = false; };
  }, [value]);

  return (
    <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
      {qrImage && <img src={qrImage} alt="QR code for this invitation link" width="176" height="176" style={{ background: '#fff', padding: '8px', borderRadius: '10px' }} />}
      <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', maxWidth: '260px' }}>
        Scan this QR code to open the invitation link.
      </span>
    </div>
  );
}

const quickProfileFields = ['department', 'yearSemester', 'section', 'labSection'];

const getLabSectionOptions = (section) => {
  if (!section) return [];
  return [`${section}1`, `${section}2`];
};

const getBatchOptions = (department) => {
  const juniorBatch = juniorBatchByDepartment[department];
  if (!juniorBatch) return [];

  return Array.from({ length: juniorBatch }, (_, index) => {
    const batchNo = index + 1;
    const batchName = String(batchNo);

    return {
      label: batchName,
      batchName,
      batchNo: String(batchNo),
    };
  });
};

const getYearSemesterShortName = (yearSemester) => {
  const match = yearSemester.match(/Year (\d+) - Semester (\d+)/);
  return match ? `${match[1]}.${match[2]}` : yearSemester;
};

const formatAppDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
};

const getInitials = (name) => {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'ST';
};

const getYearSemesterFromSemester = (semester) => {
  if (!semester) return '';
  const year = Math.ceil(Number(semester) / 2);
  const term = Number(semester) % 2 === 0 ? 2 : 1;
  return `Year ${year} - Semester ${term}`;
};

const getBatchNoFromUser = (user) => {
  if (user.batchNo) return String(user.batchNo);
  const batchDigits = String(user.batch || '').match(/\d+/)?.[0];
  return batchDigits || '';
};

const parseBatchInput = (input) => {
  const raw = String(input || '').trim();
  const match = raw.match(/^(.*?)\s*(\d{1,2})$/);
  if (match) {
    const name = match[1].trim();
    const num = match[2];
    return { batchName: name || num, batchNo: num };
  }
  return { batchName: raw, batchNo: raw };
};

const darkThemes = [
  { id: 'dark', label: 'Dark', desc: 'Dark Mode standard', icon: Moon },
  { id: 'midnight', label: 'Midnight', desc: 'Atmospheric dark + amber glow', icon: MoonStar },
  { id: 'nexus', label: 'Nexus', desc: 'Emerald dashboard command center', icon: Cpu },
  { id: 'cyberpunk', label: 'Cyberpunk', desc: 'Neon-noir / glitch terminal', icon: Terminal },
  { id: 'terminal', label: 'Terminal', desc: 'Green phosphor command line', icon: SquareTerminal },
  { id: 'art-deco', label: 'Art Deco', desc: 'Gatsby luxury / geometric gold', icon: Building2 },
  { id: 'poster', label: 'Bold Type', desc: 'Typography-first poster design', icon: Type },
  { id: 'bitcoindefi', label: 'Bitcoin Defi', desc: 'Bitcoin orange / crypto dark', icon: Zap },
  { id: 'meshtopo', label: 'Mesh Topology', desc: 'Emerald mesh / neon-neo grid', icon: Orbit },
];

const lightThemes = [
  { id: 'light', label: 'Light', desc: 'Light Mode standard', icon: Sun },
  { id: 'swiss', label: 'Swiss', desc: 'International / Swiss Style', icon: Grid2x2 },
  { id: 'newsprint', label: 'Newsprint', desc: 'Editorial ink-on-paper', icon: Newspaper },
  { id: 'sketchbook', label: 'Sketchbook', desc: 'Rough sketch aesthetic', icon: PenTool },
  { id: 'minimalist-monochrome', label: 'Monochrome', desc: 'Editorial stark minimalism', icon: Pen },
  { id: 'industrial', label: 'Industrial', desc: 'Neumorphic machine realism', icon: Gauge },
];

const themeOptions = [...darkThemes, ...lightThemes];

const ACCENT_DEFAULT_HEX = '#F5A623';

// Accent color — the hex field re-skins the app's accent theme instantly.
// Defaults to the active theme's native color; the user can override per theme.
function AccentColorSection() {
  const { theme, accent, accentOverridden, setAccent } = useTheme();
  const defaultHex = getThemeAccent(theme) || '#F5A623';
  const [hexDraft, setHexDraft] = useState(() => (accent || defaultHex).toUpperCase());

  // Follow theme resets / external changes.
  useEffect(() => {
    setHexDraft((accent || defaultHex).toUpperCase());
  }, [accent, defaultHex]);

  const hex = accent || defaultHex;
  const isDefault = !accentOverridden;
  const hexDraftClean = hexDraft.replace(/^#/, '');
  const hexValid = /^[0-9A-F]{6}$/.test(hexDraftClean);

  // Manual hex entry — commits live once the field holds 6 hex digits.
  const onHexInput = (e) => {
    let raw = e.target.value.toUpperCase().replace(/[^0-9A-F#]/g, '');
    if (raw.length > 7) raw = raw.slice(0, 7);
    setHexDraft(raw);
    const cleaned = raw.replace(/^#/, '');
    if (/^[0-9A-F]{6}$/.test(cleaned)) {
      setAccent(`#${cleaned}`);
    }
  };

  // Leaving the field with an incomplete value snaps back to the real color.
  const onHexBlur = () => setHexDraft((accent || defaultHex).toUpperCase());

  return (
    <section className="cfg-section">
      <div className="cfg-section-head">
        <h3 className="cfg-section-title">Accent Color</h3>
        <p className="cfg-section-desc">
          Default color follows the active theme; type a hex code to override it for this theme.
        </p>
      </div>

      <div className="accent-custom-row">
        <div className="cfg-row-main">
          <span className="cfg-row-icon is-amber"><Palette size={18} /></span>
          <div className="cfg-row-text">
            <h4 className="cfg-row-title">Current color</h4>
            <p className="cfg-row-desc">Preview updates live as you type.</p>
          </div>
        </div>
        <div className="accent-custom-controls">
          <span className="accent-preview-chip" style={{ background: isDefault ? ACCENT_DEFAULT_HEX : hex }} />
          <input
            type="text"
            id="accent-hex-input"
            name="accentHex"
            autoComplete="off"
            className={`accent-hex-input${hexValid ? '' : ' is-invalid'}`}
            value={hexDraft}
            onChange={onHexInput}
            onBlur={onHexBlur}
            spellCheck={false}
            maxLength={7}
            aria-label="Accent color hex code"
            title="Enter a 6-digit hex code, e.g. #F5A623"
          />
          <button
            type="button"
            className="accent-reset-btn"
            onClick={() => setAccent(null)}
            disabled={isDefault}
          >
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}

// Shared subtab masthead — same style as the Identity masthead.
function SettingsMasthead({ icon: Icon, title, subtitle }) {
  return (
    <div className="profile-panel-header schedule-masthead">
      <div className="schedule-title-block">
        <div className="schedule-icon-tile">
          <Icon size={20} strokeWidth={2.2} />
        </div>
        <div>
          <span className="schedule-overline">Settings</span>
          <p className="schedule-title">{title}</p>
          <span className="schedule-subtitle">{subtitle}</span>
        </div>
      </div>
      <div className="schedule-masthead-center" />
    </div>
  );
}

// "Drive My Orbit" reuses the exact stalk road-trip interface, but drives it
// with the editable checkpoints from Checkpoint Control instead of the classic
// five stops. Fields are edited in the control panel; this just previews them.
function DriveOrbitButton({ user }) {
  const { visibleCheckpoints, favoriteColor } = useOrbits();
  const { stalk } = useStalk();
  const drive = () => {
    stalk(user, visibleCheckpoints.map((cp) => ({ key: cp.id, label: cp.label, fields: cp.fields })), favoriteColor || '');
  };
  return (
    <button className="btn btn-primary" onClick={drive}>
      <PawPrint size={16} /> Drive My Orbit
    </button>
  );
}

// Favorite color picker — the road-trip accent follows this live.
function FavoriteColorInput() {
  const { favoriteColor, setFavoriteColor } = useOrbits();
  const color = favoriteColor || '#00ffcc';
  return (
    <div className="orbits-color-row">
      <span>Favorite color</span>
      <input
        type="color"
        id="orbits-favorite-color"
        name="favoriteColor"
        className="orbits-color-input"
        value={color}
        onChange={(e) => setFavoriteColor(e.target.value)}
        aria-label="Choose favorite color"
      />
      <span className="orbits-swatch" style={{ background: color }} />
      <code>{color.toUpperCase()}</code>
    </div>
  );
}

export default function SettingsPage() {
  const { isAdmin } = useAdminMode();
  const { theme, setTheme } = useTheme();
  const { user, isAuthenticated, updateUser, saveUserProfile, logout, refreshUserFromServer } = useAuth();
  const { routine, weekDays } = useRoutine();
  const { supported, permission, settings: notifSettings, enable: enableNotifs, disable: disableNotifs, updateSetting } = useNotifications(routine, weekDays);

  // Real-time: when another device edits this user's profile, refresh from server
  // TEMP DISABLED — blink debug: comment out to isolate loop
  // useWebSocket(isAuthenticated ? user?.id : null, {
  //   onProfileUpdate: useCallback(({ userId: changedId }) => {
  //     if (changedId === user?.id) refreshUserFromServer();
  //   }, [user?.id, refreshUserFromServer]),
  // });

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeSubTab, setActiveSubTab] = useState(() => {
    const tab = searchParams.get('tab');
    return ['profile', 'theme', 'notifications', 'about', 'orbits', 'invite'].includes(tab) ? tab : 'profile';
  });
  const orbitInitials = (user?.name || '?').split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  // Fall back to themed initials when the avatar image fails to load — the
  // browser's broken-image placeholder would clash with the active theme.
  const [orbitAvatarError, setOrbitAvatarError] = useState(false);

  // AWID (AUSTWise ID) is the app-generated identifier — always separate
  // from the student ID. Fall back to a freshly generated AWID instead of
  // ever reusing the student ID (which is what made both look identical).
  const displayAwid = useMemo(
      () => user.awid || (user.department ? createAwid(user.department, user.role) : ''),
    [user.awid, user.department]
  );

  // Persist the generated AWID once so it stays stable for accounts that
  // don't have one yet (localStorage/social auth flows).
  const awidPersistedRef = useRef(false);
  useEffect(() => {
    if (isAuthenticated && user.id && !user.awid && !awidPersistedRef.current) {
      awidPersistedRef.current = true;
      updateUser({ awid: displayAwid });
    }
    if (user.awid) awidPersistedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayAwid, isAuthenticated, user.id, user.awid]);

  // Sync activeSubTab to URL search params so refresh preserves the tab
  const handleSetActiveSubTab = useCallback((tab) => {
    setActiveSubTab(tab);
    setSearchParams(tab === 'profile' ? {} : { tab }, { replace: true });
  }, [setSearchParams]);

  const settingsTabs = [
    { id: 'profile', label: 'Identity', icon: User, desc: 'Identity & academic info', accessKey: 'feature:settings:profile', color: 'blue' },
    { id: 'orbits', label: 'My Orbits', icon: Orbit, desc: 'Your stalk journey', accessKey: 'feature:settings:orbits', color: 'cyan' },
    { id: 'theme', label: 'UI', icon: Settings, desc: 'Themes & appearance', accessKey: 'feature:settings:theme', color: 'purple' },
    { id: 'notifications', label: 'Configure', icon: Bell, desc: 'Alerts & reminders', accessKey: 'feature:settings:notifications', color: 'amber' },
    { id: 'about', label: 'Credits', icon: Info, desc: 'Developer credits & info', accessKey: 'feature:settings:about', color: 'emerald' },
    ...(isAuthenticated && user?.role === 'admin' ? [{ id: 'invite', label: 'Invite Member', icon: Send, desc: 'Send invites', color: 'cyan' }] : []),
  ];

  const [roleApplicationForm, setRoleApplicationForm] = useState({ appliedRole: 'cr', statement: '' });
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [, setUserApplications] = useState([]);
  const [applicationMessage, setApplicationMessage] = useState('');
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [executiveApplications, setExecutiveApplications] = useState([]);
  const [submittingExecutiveRole, setSubmittingExecutiveRole] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [inviteRole, setInviteRole] = useState('alumni');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [inviteMsgType, setInviteMsgType] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [invitations, setInvitations] = useState([]);
  const [invitePage, setInvitePage] = useState(1);
  const [inviteTotalPages, setInviteTotalPages] = useState(1);
  const [notifEnabling, setNotifEnabling] = useState(false);
  const [notifMsg, setNotifMsg] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [vacancyMap, setVacancyMap] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    let cancelled = false;
    const syncExecutiveApplications = async () => {
      try {
        const res = await fetch('/api/role-applications/mine', { credentials: 'same-origin' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && Array.isArray(data.applications)) {
          setExecutiveApplications(data.applications.filter((app) => ['vp', 'gs'].includes(app.appliedRole)));
        }
      } catch { /* offline: use local submission state */ }
    };
    syncExecutiveApplications();
    const timer = setInterval(syncExecutiveApplications, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [isAuthenticated, user?.id]);

  const handleExecutiveRoleApplication = async (appliedRole) => {
    setSubmittingExecutiveRole(appliedRole);
    setApplicationMessage('');
    try {
      const application = await submitRoleApplication({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        department: user.department,
        semester: user.semester,
        batch: user.batch || user.batchNo,
        appliedRole,
        statement: '',
      });
      setExecutiveApplications((current) => [...current.filter((item) => item.id !== application.id), application]);
      setApplicationMessage(`${appliedRole.toUpperCase()} application submitted. Admin will review it.`);
    } catch (error) {
      setApplicationMessage(error.message || 'Failed to submit application.');
    } finally {
      setSubmittingExecutiveRole('');
    }
  };
  const [resignConfirm, setResignConfirm] = useState(false);
  const [resigning, setResigning] = useState(false);
  const [withdrawConfirm, setWithdrawConfirm] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteTypedConfirm, setDeleteTypedConfirm] = useState('');
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [yearSemTouched, setYearSemTouched] = useState(false);

  // Member-list privacy toggle (show CGPA to others; attendance is always private)
  const [privacySettings, setPrivacySettings] = useState(() => ({
    showCgpa: user?.privacy?.showCgpa !== false,
  }));
  const [privacySaving, setPrivacySaving] = useState(false);
  const [privacyMsg, setPrivacyMsg] = useState('');
  const [semesterDropSaving, setSemesterDropSaving] = useState(false);
  const [semesterDropMessage, setSemesterDropMessage] = useState('');
  const [alumniCarrySaving, setAlumniCarrySaving] = useState(false);
  const [alumniCarryMessage, setAlumniCarryMessage] = useState('');

  const setSemesterDropped = async (dropped) => {
    setSemesterDropSaving(true);
    setSemesterDropMessage('');
    try {
      const response = await fetch('/api/auth/semester-drop', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dropped }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not update your status.');
      await refreshUserFromServer();
      setSemesterDropMessage(dropped
        ? 'Your account is now marked as Re-add.'
        : 'Your account is back to Student status.');
    } catch (error) {
      setSemesterDropMessage(error.message || 'Could not update your status.');
    } finally {
      setSemesterDropSaving(false);
    }
  };

  const setAlumniCarryStatus = async (hasCarry) => {
    setAlumniCarrySaving(true);
    setAlumniCarryMessage('');
    try {
      const response = await fetch('/api/auth/alumni-carry', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasCarry }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not update your Alumni status.');
      await refreshUserFromServer();
      setAlumniCarryMessage(hasCarry
        ? 'Your account is now marked as Alumni With Carry.'
        : 'Your account is now marked as Alumni.');
    } catch (error) {
      setAlumniCarryMessage(error.message || 'Could not update your Alumni status.');
    } finally {
      setAlumniCarrySaving(false);
    }
  };

  const savePrivacySetting = async (key, value) => {
    const next = { ...privacySettings, [key]: value };
    setPrivacySettings(next);
    setPrivacySaving(true);
    setPrivacyMsg('');
    try {
      const res = await fetch('/api/presence/privacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (data.success) {
        setPrivacyMsg('Saved');
        updateUser({ privacy: data.privacy });
      } else {
        setPrivacyMsg(data.error === 'Authentication required.'
          ? 'Log in to change privacy settings.'
          : (data.error || 'Failed to save.'));
        setPrivacySettings(prev => ({ ...prev, [key]: !value }));
      }
    } catch {
      setPrivacyMsg('Network error.');
      setPrivacySettings(prev => ({ ...prev, [key]: !value }));
    } finally {
      setPrivacySaving(false);
      setTimeout(() => setPrivacyMsg(''), 2500);
    }
  };
  
  // Telegram notification settings
  const [telegramEnabled, setTelegramEnabled] = useState(() => {
    const saved = localStorage.getItem('telegram_notifications_enabled');
    return saved === 'true';
  });
  const [telegramChatId, setTelegramChatId] = useState(() => {
    return localStorage.getItem('telegram_chat_id') || '';
  });
  const [telegramTesting, setTelegramTesting] = useState(false);
  const [telegramMsg, setTelegramMsg] = useState('');
  const [isTelegramRegistered, setIsTelegramRegistered] = useState(() => {
    const saved = localStorage.getItem('telegram_is_registered');
    if (saved === 'true') return true;
    if (saved === 'false') return false;
    return null; // null = checking, false = not registered, true = registered
  });
  
  // Library location tracking toggle
  const [libraryTracking, setLibraryTracking] = useState(() => {
    return localStorage.getItem('library_tracking_enabled') === 'true';
  });

  // The Chat ID that is actually registered for THIS account on the server.
  // Used to detect when the user edits the input to a different Chat ID, so we
  // stop showing a stale "registered" status for the old one.
  const registeredChatIdRef = useRef('');

  // Telegram Chat ID + registration status are per-account (one Chat ID ↔ one
  // awid). Load them from the server on mount so a different user logging in on
  // the same browser sees THEIR OWN Chat ID — not a leftover from localStorage.
  // TEMP DISABLED — blink debug (entire fetch disabled)
  useEffect(() => {
    return () => {};
  }, []);
  
  // Webhook status
  const [webhookInfo, setWebhookInfo] = useState(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  
  // Fetch webhook info on mount — TEMP DISABLED blink debug
  useEffect(() => {
    return () => {};
  }, []);

  // Persist Telegram settings to localStorage
  useEffect(() => {
    localStorage.setItem('telegram_notifications_enabled', telegramEnabled.toString());
  }, [telegramEnabled]);

  useEffect(() => {
    localStorage.setItem('library_tracking_enabled', libraryTracking ? 'true' : 'false');
  }, [libraryTracking]);

  useEffect(() => {
    localStorage.setItem('telegram_chat_id', telegramChatId);
  }, [telegramChatId]);

  useEffect(() => {
    if (isTelegramRegistered !== null) {
      localStorage.setItem('telegram_is_registered', isTelegramRegistered.toString());
    }
  }, [isTelegramRegistered]);

  // Load application status & vacancy map on mount, then keep it fresh by
  // polling the server. This way an approval made on another device shows up
  // here (and the resign button appears) without a manual reload.
  // TEMP DISABLED — blink debug: polling can cause render loop via refreshUserFromServer
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    let cancelled = false;

    const syncStatus = async () => {
      try {
        // await syncRoleApplicationsFromServer(user.id);
        // await refreshUserFromServer();
      } catch { /* offline — local state stays */ }
      if (cancelled) return;
      const nextStatus = getUserApplicationStatus(user.id);
      const nextApps = getApplicationsByUserId(user.id);
      // Only update state if actually changed — prevents rapid re-render loop
      setApplicationStatus(prev => JSON.stringify(prev) === JSON.stringify(nextStatus) ? prev : nextStatus);
      setUserApplications(prev => JSON.stringify(prev) === JSON.stringify(nextApps) ? prev : nextApps);
    };

    syncStatus();
    const interval = setInterval(syncStatus, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isAuthenticated, user?.id]);

  // Load vacancy map when department/semester is known
  useEffect(() => {
    if (user?.department && (user?.semester || user?.yearSemester)) {
      const sem = user.semester || 1;
      const map = getSlotVacancyMap(user.department, sem);
      setVacancyMap(map);
    }
  }, [user?.department, user?.semester, isAuthenticated]);

  // The live session role (server-authoritative via /api/auth/me) wins over
  // the localStorage account mirror when deciding CR/SR status — the mirror
  // can lag behind an approval or strip DEV users entirely, which would
  // otherwise make an active CR/SR see "Apply Now".
  const crSrStatus = useMemo(() => {
    const s = applicationStatus || {};
    const serverRole = user?.role;
    const hasActiveRole = Boolean(
      s.hasActiveRole || serverRole === 'cr' || serverRole === 'sr'
    );
    return {
      ...s,
      hasActiveRole,
      activeRole: hasActiveRole
        ? (s.activeRole || (serverRole === 'cr' || serverRole === 'sr' ? serverRole : null))
        : null,
    };
  }, [applicationStatus, user?.role]);

  // Fetch invitations list
  const fetchInvites = useCallback(async (page = 1) => {
    try {
      const res = await fetch(`/api/invites?page=${page}&limit=10`);
      const data = await res.json();
      if (data.success) {
        setInvitations(data.invitations);
        setInviteTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error('Failed to fetch invites:', err);
    }
  }, []);

  useEffect(() => {
    if (activeSubTab === 'invite') fetchInvites(invitePage);
  }, [activeSubTab, invitePage, fetchInvites]);

  // Send invitation
  const sendInvite = async (emailOverride = '', roleOverride = '') => {
    const targetEmail = String(emailOverride || emailInput).trim();
    const targetRole = roleOverride || inviteRole;
    if (!targetEmail) {
      setInviteMsg('Please enter an email address.');
      setInviteMsgType('error');
      return;
    }
    setInviteSending(true);
    setInviteMsg('');
    setInviteLink('');
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, role: targetRole, invitedBy: user?.name || 'Admin' }),
      });
      const data = await res.json();
      if (data.success) {
        setInviteMsg(`${data.resent || emailOverride ? 'Invitation email resent' : 'Gmail accepted the invitation email'} for ${targetEmail}. Final inbox delivery is controlled by the recipient’s mail provider.`);
        setInviteLink(data.inviteLink || '');
        setInviteMsgType('success');
        if (!emailOverride) setEmailInput('');
        fetchInvites(1);
        setInvitePage(1);
      } else {
        setInviteMsg(data.error || 'Failed to send invitation.');
        setInviteMsgType('error');
      }
    } catch {
      setInviteMsg('Network error. Please try again.');
      setInviteMsgType('error');
    } finally {
      setInviteSending(false);
    }
  };
  const initialBatchNo = getBatchNoFromUser(user);
  
  // Extract student ID from @aust.edu email: "cse12345@aust.edu" -> "12345"
  const detectedStudentId = (() => {
    const email = user.email || '';
    if (email.includes('@aust.edu')) {
      const prefix = email.split('@')[0] || '';
      const id = prefix.replace(/^[a-z.]+/i, '');
      if (id) return id;
    }
    return user.id || '';
  })();
  const [profileDetails, setProfileDetails] = useState({
    id: detectedStudentId,
    name: user.name || '',
    email: user.email || '',
    avatar: user.avatar || '',
    bloodGroup: user.bloodGroup || '',
  });
  const [quickProfile, setQuickProfile] = useState({
    department: user.department || '',
    batchName: user.batchName || initialBatchNo || '',
    batchNo: initialBatchNo,
    batchCustomName: '',
    yearSemester: user.yearSemester || getYearSemesterFromSemester(user.semester),
    section: user.section || '',
    labSection: user.labSection || '',
  });

  // Keep the read-only profile and the next edit draft tied to the server
  // account. Do not touch an in-progress draft while the user is editing.
  useEffect(() => {
    if (isEditingProfile) return;
    const email = user.email || '';
    const emailId = email.includes('@aust.edu')
      ? (email.split('@')[0] || '').replace(/^[a-z.]+/i, '')
      : '';
    const batchNo = getBatchNoFromUser(user);
    setProfileDetails({
      id: emailId || user.id || '',
      name: user.name || '',
      email,
      avatar: user.avatar || '',
      bloodGroup: user.bloodGroup || '',
    });
    setQuickProfile({
      department: user.department || '',
      batchName: user.batchName || batchNo || '',
      batchNo,
      batchCustomName: '',
      yearSemester: user.yearSemester || getYearSemesterFromSemester(user.semester),
      section: user.section || '',
      labSection: user.labSection || '',
    });
    setYearSemTouched(false);
  }, [isEditingProfile, user.id, user.email, user.name, user.avatar, user.bloodGroup, user.department, user.batchName, user.yearSemester, user.section, user.labSection, user.semester]);

  const resetProfileDrafts = () => {
    const nextBatchNo = getBatchNoFromUser(user);
    const email = user.email || '';
    const resetId = email.includes('@aust.edu')
      ? (email.split('@')[0] || '').replace(/^[a-z.]+/i, '') || user.id
      : user.id || '';
    setProfileDetails({
      id: resetId,
      name: user.name || '',
      email: user.email || '',
      avatar: user.avatar || '',
      bloodGroup: user.bloodGroup || '',

    });
    setQuickProfile({
      department: user.department || '',
      batchName: user.batchName || nextBatchNo || '',
      batchNo: nextBatchNo,
      batchCustomName: '',
      yearSemester: user.yearSemester || getYearSemesterFromSemester(user.semester),
      section: user.section || '',
      labSection: user.labSection || '',
    });
    setSaveMessage('');
  };

  const toggleProfileEditing = () => {
    if (isEditingProfile) {
      resetProfileDrafts();
    }
    setIsEditingProfile((current) => !current);
  };

  const updateQuickProfileField = (field, value) => {
    if (field !== 'batch' && quickProfile[field] === value) return;
    if (field === 'yearSemester') setYearSemTouched(true);
    if (field === 'department') setYearSemTouched(false);
    setQuickProfile((currentProfile) => {
      const fieldIndex = quickProfileFields.indexOf(field);
      const nextProfile = {
        ...currentProfile,
      };

      if (field === 'batch') {
        nextProfile.batchName = value.batchName;
        nextProfile.batchNo = value.batchNo;
        nextProfile.batchCustomName = '';
      } else {
        nextProfile[field] = value;
      }

      quickProfileFields.slice(fieldIndex + 1).forEach((nextField) => {
        if (nextField !== 'batch') nextProfile[nextField] = '';
      });

      return nextProfile;
    });
  };

  const quickProfileReady = Boolean(
    quickProfile.department &&
    quickProfile.yearSemester &&
    quickProfile.section &&
    quickProfile.labSection
  );

  const profileDetailsReady = Boolean(profileDetails.id.trim() && profileDetails.name.trim() && profileDetails.email.trim());
  const allChangesReady = profileDetailsReady && quickProfileReady;





  const updateProfileDetailsField = (field, value) => {
    setProfileDetails((currentDetails) => {
      const next = { ...currentDetails, [field]: value };
      // Auto-detect student ID from @aust.edu email
      if (field === 'email' && value.includes('@aust.edu')) {
        const prefix = value.split('@')[0] || '';
        const detectedId = prefix.replace(/^[a-z]+/i, '');
        if (detectedId) next.id = detectedId;
      }
      return next;
    });
  };

  const handleRoleApplication = async (e) => {
    e.preventDefault();
    if (!isAuthenticated || !user?.id) {
      setApplicationMessage('Please login to apply.');
      return;
    }

    // Validate target selection
    if (roleApplicationForm.appliedRole === 'cr' && !roleApplicationForm.targetLabSection) {
      setApplicationMessage('Please select a lab group for CR application.');
      return;
    }
    if (roleApplicationForm.appliedRole === 'sr' && !roleApplicationForm.targetSection) {
      setApplicationMessage('Please select a section for SR application.');
      return;
    }

    setSubmittingApplication(true);
    try {
      await submitRoleApplication({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        department: user.department,
        semester: user.semester || 1,
        batch: user.batch,
        appliedRole: roleApplicationForm.appliedRole,
        targetLabSection: roleApplicationForm.targetLabSection,
        targetSection: roleApplicationForm.targetSection,
        statement: roleApplicationForm.statement,
      });
      setApplicationMessage('Application submitted successfully! Admin will review it soon.');
      setRoleApplicationForm({ appliedRole: 'cr', targetLabSection: '', targetSection: '', statement: '' });
      setShowApplyForm(false);
      
      // Refresh status & vacancy
      const status = getUserApplicationStatus(user.id);
      setApplicationStatus(status);
      const applications = getApplicationsByUserId(user.id);
      setUserApplications(applications);
      const map = getSlotVacancyMap(user.department, user.semester || 1);
      setVacancyMap(map);
    } catch (err) {
      setApplicationMessage(err.message || 'Failed to submit application.');
    } finally {
      setSubmittingApplication(false);
      setTimeout(() => setApplicationMessage(''), 5000);
    }
  };

  const handleProfileImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateProfileDetailsField('avatar', reader.result);
    };
    reader.readAsDataURL(file);
  };

  const saveAllChanges = async () => {
    if (!allChangesReady) return;

    if (!isAuthenticated) {
      setSaveMessage('Login to save your profile');
      window.setTimeout(() => setSaveMessage(''), 2200);
      return;
    }

    const nextName = profileDetails.name.trim();
    const finalBatchName = quickProfile.batchCustomName.trim() || quickProfile.batchName;

    const semesterNum = (() => {
      const m = (quickProfile.yearSemester || '').match(/Year (\d+) - Semester (\d+)/);
      if (m) { const y = parseInt(m[1]), s = parseInt(m[2]); if (y >= 1 && y <= 4 && s >= 1 && s <= 2) return (y - 1) * 2 + s; }
      return 1;
    })();

    setIsProfileSaving(true);
    setSaveMessage('');
    try {
      await saveUserProfile({
        name: nextName,
        avatar: profileDetails.avatar,
        bloodGroup: profileDetails.bloodGroup,
        department: quickProfile.department,
        batch: finalBatchName,
        batchName: finalBatchName,
        batchNo: quickProfile.batchNo,
        yearSemester: quickProfile.yearSemester,
        semester: semesterNum,
        section: quickProfile.section,
        labSection: quickProfile.labSection,
      });
      setSaveMessage('Saved');
      setIsEditingProfile(false);
      window.setTimeout(() => setSaveMessage(''), 2200);
    } catch (error) {
      setSaveMessage(error.message || 'Could not save profile. Please try again.');
    } finally {
      setIsProfileSaving(false);
    }
  };

  const visibleBatchName = quickProfile.batchName && quickProfile.batchNo
    ? (quickProfile.batchName === quickProfile.batchNo ? quickProfile.batchName : `${quickProfile.batchName} ${quickProfile.batchNo}`)
    : quickProfile.batchName || quickProfile.batchNo || 'Not selected';

  const quickChangeSteps = [
    { label: 'Department', field: 'department', options: departments, visible: true },
    { label: 'Batch', field: 'batch', options: getBatchOptions(quickProfile.department), visible: false },
    { label: 'Year-Sem', field: 'yearSemester', options: getYearSemesters(quickProfile.department), visible: Boolean(quickProfile.department) },
    { label: 'Section', field: 'section', options: sections, visible: Boolean(quickProfile.yearSemester && yearSemTouched) },
    { label: 'Lab Section', field: 'labSection', options: getLabSectionOptions(quickProfile.section), visible: Boolean(quickProfile.section) },
  ];

  const renderOptionGroup = (label, field, options) => {
    const isBatchField = field === 'batch';

    if (isBatchField) {
      return (
        <div className="quick-option-group">
          <span>Batch</span>
          <input
            type="text"
            id="batch-input"
            name="batchName"
            autoComplete="off"
            className="input"
            value={quickProfile.batchName && quickProfile.batchNo
              ? (quickProfile.batchName === quickProfile.batchNo ? quickProfile.batchName : `${quickProfile.batchName} ${quickProfile.batchNo}`)
              : quickProfile.batchName || quickProfile.batchNo || ''}
            placeholder="e.g. Quanta 52"
            onChange={(event) => {
              const parsed = parseBatchInput(event.target.value);
              setQuickProfile((currentProfile) => ({
                ...currentProfile,
                batchName: parsed.batchName,
                batchNo: parsed.batchNo,
                batchCustomName: '',
              }));
            }}
          />
        </div>
      );
    }

    return (
    <div className="quick-option-group">
      <span>{label}</span>
      <div className={`quick-option-grid ${field === 'yearSemester' ? 'wide-options' : ''}`}>
        {options.map((option) => {
          const optionLabel = field === 'yearSemester'
            ? getYearSemesterShortName(option)
            : typeof option === 'string'
              ? option
              : option.label;
          const value = option;

          return (
            <button
              key={optionLabel}
              type="button"
              className={`quick-option ${quickProfile[field] === value ? 'selected' : ''}`}
              aria-pressed={quickProfile[field] === value}
              onClick={() => updateQuickProfileField(field, value)}
            >
              {optionLabel}
            </button>
          );
        })}
      </div>
    </div>
    );
  };

  const profileFields = [
    { key: 'id', label: 'Student ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'department', label: 'Department' },
    { key: 'batch', label: 'Batch' },
    { key: 'yearSemester', label: 'Year-Semester' },
    { key: 'section', label: 'Section' },
    { key: 'labSection', label: 'Lab Group' },
    { key: 'bloodGroup', label: 'Blood Group' },
  ];
  const filledFields = profileFields.filter((f) => {
    const val = f.key === 'department' ? quickProfile.department
      : f.key === 'batch' ? quickProfile.batchName
      : f.key === 'yearSemester' ? quickProfile.yearSemester
      : f.key === 'section' ? quickProfile.section
      : f.key === 'labSection' ? quickProfile.labSection
      : profileDetails[f.key];
    return Boolean(val && val.trim());
  });
  const profilePercent = Math.round((filledFields.length / profileFields.length) * 100);

  return (
    <div className="settings-page animate-fadeIn">

      {/* ── 1. Hero box (own card) ── */}
      {isAdmin && activeSubTab !== 'invite' ? <SidebarPageAccessHeader pageKey="/settings" /> : <header className="st-hero">
        <div className="st-hero-content">
          <div className="st-hero-eyebrow">
            <span className="st-hero-period-icon">
              <Settings size={16} />
            </span>
            <span className="st-hero-date-label">
              Account &amp; preferences
            </span>
          </div>
          <h1 className="st-hero-title">
            Sett<span className="st-hero-name">ings</span>
          </h1>
          <p className="st-hero-subtitle">
            Manage your profile, choose a theme, configure notifications, and more.
          </p>
          {isAuthenticated && (
            <div className="st-hero-status">
              <span className="st-hero-status-dot" />
              <span className="st-hero-status-text">
                {profilePercent === 100 ? 'Profile complete' : `Profile ${profilePercent}% complete`}
              </span>
            </div>
          )}
        </div>
      </header>}

      {/* ── 2. Tabs bar (own card) ── */}
      {isAdmin && activeSubTab !== 'invite' && <SidebarPageAccessPanel pageKey="/settings" part="parent" />}
      <div className="glass-card-static st-tabs-card">
        <GliderTabs
          tabs={settingsTabs}
          activeTab={activeSubTab}
          onChange={handleSetActiveSubTab}
          variant="dashboard"
          compact
        />
      </div>

      {/* ── 3. Main content box (own card) ── */}
      {isAdmin && activeSubTab !== 'invite' ? <SidebarPageAccessPanel pageKey="/settings" featureKey={`feature:settings:${activeSubTab}`} part="child" /> : <MastheadAccessControl pageKey="/settings">
        <div className="st-content-card" key={activeSubTab}>
        {activeSubTab === 'about' && (
          <div className="st-mac-chrome" aria-hidden="true">
            <span className="st-mac-dot st-mac-dot--red" />
            <span className="st-mac-dot st-mac-dot--amber" />
            <span className="st-mac-dot st-mac-dot--green" />
          </div>
        )}
        <FeatureAccessGate featureKey={`feature:settings:${activeSubTab}`}>
        <div className="settings-panel">
          {activeSubTab === 'profile' && (
            <div className="animate-fadeIn">
              <div className="profile-panel-header schedule-masthead">
                <div className="schedule-title-block">
                  <div className="schedule-icon-tile">
                    <User size={20} strokeWidth={2.2} />
                  </div>
                  <div>
                    <span className="schedule-overline">Settings</span>
                    <p className="schedule-title">Identity</p>
                    <span className="schedule-subtitle">Identity &amp; academic info</span>
                  </div>
                </div>

                <div className="schedule-masthead-center" />

                <div className="profile-save-actions">
                  <div className="profile-completion-circle" title={`${profilePercent}% complete`}>
                    <svg viewBox="0 0 36 36">
                      <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="circle-fill" strokeDasharray={`${profilePercent}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <span className="profile-completion-text">{profilePercent}%</span>
                  </div>
                  {saveMessage && (
                    <span className="save-status" style={{ color: saveMessage === 'Saved' ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                      {saveMessage === 'Saved' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />} {saveMessage}
                    </span>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={toggleProfileEditing}>
                    <Pencil size={14} /> {isEditingProfile ? 'Cancel' : 'Edit'}
                  </button>
                </div>
              </div>

              <div className="schedule-dotted-divider" />

              {isAuthenticated && user?.role === 'student' && (
                <section className="cfg-section" style={{ margin: '0 0 18px' }}>
                  <div className="cfg-section-head">
                    <h3 className="cfg-section-title">Semester Status</h3>
                    <p className="cfg-section-desc">If you drop your semester, your account will be marked as Re-add so access can be managed for that status.</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', padding: '14px', border: '1px solid var(--border-primary)', borderRadius: '12px', background: 'var(--bg-input)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="cfg-row-icon is-blue"><GraduationCap size={18} /></span>
                      <div>
                        <strong style={{ display: 'block', color: 'var(--text-primary)' }}>Current status: {user.roles?.includes('readd') ? 'Re-add' : 'Regular Student'}</strong>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>This updates your account role immediately.</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={user.roles?.includes('readd') ? 'btn btn-secondary' : 'btn btn-primary'}
                      onClick={() => setSemesterDropped(!user.roles?.includes('readd'))}
                      disabled={semesterDropSaving}
                      aria-label={user.roles?.includes('readd') ? 'Cancel semester drop and return to regular student status' : 'Mark semester dropped and add Re-add status'}
                    >
                      {semesterDropSaving ? 'Saving…' : user.roles?.includes('readd') ? 'Cancel Semester Drop' : 'I Dropped This Semester'}
                    </button>
                  </div>
                  {semesterDropMessage && <p role="status" style={{ marginTop: '8px', fontSize: '12px', color: semesterDropMessage.startsWith('Could not') ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>{semesterDropMessage}</p>}
                </section>
              )}

              {isAuthenticated && (user?.role === 'alumni' || user?.role === 'alumni_with_carry') && (
                <section className="cfg-section" style={{ margin: '0 0 18px' }}>
                  <div className="cfg-section-head">
                    <h3 className="cfg-section-title">Alumni Status</h3>
                    <p className="cfg-section-desc">Tell us whether you still have courses to complete. This switches your access role between Alumni and Alumni With Carry.</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', padding: '14px', border: '1px solid var(--border-primary)', borderRadius: '12px', background: 'var(--bg-input)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="cfg-row-icon is-blue"><GraduationCap size={18} /></span>
                      <div>
                        <strong style={{ display: 'block', color: 'var(--text-primary)' }}>Current status: {user.role === 'alumni_with_carry' ? 'Alumni With Carry' : 'Alumni'}</strong>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>You can update this whenever your carry-course status changes.</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={user.role === 'alumni_with_carry' ? 'btn btn-secondary' : 'btn btn-primary'}
                      onClick={() => setAlumniCarryStatus(user.role !== 'alumni_with_carry')}
                      disabled={alumniCarrySaving}
                      aria-label={user.role === 'alumni_with_carry' ? 'Change status to Alumni without carry courses' : 'Mark as Alumni with carry courses'}
                    >
                      {alumniCarrySaving ? 'Saving…' : user.role === 'alumni_with_carry' ? 'No Carry Courses' : 'I Have Carry Courses'}
                    </button>
                  </div>
                  {alumniCarryMessage && <p role="status" style={{ marginTop: '8px', fontSize: '12px', color: alumniCarryMessage.startsWith('Could not') ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>{alumniCarryMessage}</p>}
                </section>
              )}

              <div className="profile-content-stack">
                <div className="profile-editor">
                  <label className={`profile-photo-picker ${!isEditingProfile ? 'is-locked' : ''}`}>
                    {isEditingProfile && <input type="file" id="profile-avatar" name="avatar" accept="image/*" onChange={handleProfileImageUpload} />}
                    <span className="avatar xl profile-photo-preview">
                      {profileDetails.avatar ? (
                        <img src={profileDetails.avatar} alt="Profile preview" crossOrigin="anonymous" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        getInitials(profileDetails.name)
                      )}
                    </span>
                    {isEditingProfile && (
                      <span className="profile-photo-action">
                        <Camera size={14} />
                      </span>
                    )}
                  </label>
                  <div>
                    <h4 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'bold' }}>{profileDetails.name || user.name}</h4>
                    <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>AWID: <strong style={{ color: 'var(--accent-purple)' }}>{displayAwid}</strong></p>
                  </div>
                </div>

                {isEditingProfile ? (
                  <div className="profile-details-form">
                    <div className="profile-details-stack">
                      <label>
                        <span>Student ID</span>
                        <input
                          type="text"
                          value={profileDetails.id}
                          className="input mt-1"
                          disabled
                          style={{ opacity: 0.6, cursor: 'not-allowed' }}
                        />
                      </label>
                      <label>
                        <span>Email Address</span>
                        <input
                          type="email"
                          value={profileDetails.email}
                          className="input mt-1"
                          disabled
                          style={{ opacity: 0.6, cursor: 'not-allowed' }}
                        />
                      </label>
                    </div>
                    <label>
                        <span>Name</span>
                        <input
                          type="text"
                          id="profile-name"
                          name="profileName"
                          autoComplete="name"
                          value={profileDetails.name}
                          onChange={(event) => updateProfileDetailsField('name', event.target.value)}
                          className="input mt-1"
                        />
                      </label>
                    <label>
                      <span>Blood Group</span>
                      <select
                        value={profileDetails.bloodGroup}
                        onChange={(event) => updateProfileDetailsField('bloodGroup', event.target.value)}
                        className="input mt-1"
                      >
                        <option value="">Not set</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </label>

                  </div>
                ) : (
                  <div className="profile-read-grid">
                    <div>
                      <span>Student ID</span>
                      <strong>{profileDetails.id || 'Not set'}</strong>
                      <span className="profile-read-sub-label">Email</span>
                      <strong>{profileDetails.email || 'Not set'}</strong>
                      <span className="profile-read-sub-label">Blood Group</span>
                      <strong>{profileDetails.bloodGroup || 'Not set'}</strong>
                    </div>
                  </div>
                )}

                <div className="profile-summary-grid">
                  <div>
                    <span>Department</span>
                    <strong>{quickProfile.department || 'Not selected'}</strong>
                  </div>
                  <div>
                    <span>Batch</span>
                    <strong>{visibleBatchName}</strong>
                  </div>
                  <div>
                    <span>Year-Sem</span>
                    <strong>{quickProfile.yearSemester ? getYearSemesterShortName(quickProfile.yearSemester) : 'Not selected'}</strong>
                  </div>
                  <div>
                    <span>Section</span>
                    <strong>{quickProfile.section || 'Not selected'}</strong>
                  </div>
                  <div>
                    <span>Lab Group</span>
                    <strong>{quickProfile.labSection || 'Not selected'}</strong>
                  </div>
                </div>

                <LinkedAccountsSection user={user} updateUser={updateUser} />

                {isEditingProfile && (
                  <div className="settings-quick-change">
                    <div className="quick-change-header">
                      <h4>Academic Details</h4>
                      <p>Choose the fields you want to change. Your lab group stays saved until you choose another one.</p>
                    </div>

                    <div className="quick-change-stack">
                      {quickChangeSteps
                        .filter((step) => step.visible)
                        .map((step) => renderOptionGroup(step.label, step.field, step.options))}
                    </div>
                  </div>
                )}

                {isEditingProfile && (
                  <div className="profile-bottom-actions">
                    <button className="btn btn-primary" onClick={saveAllChanges} disabled={!allChangesReady || isProfileSaving}>
                      <Save size={16} /> {isProfileSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSubTab === 'theme' && (
            <div className="animate-fadeIn">
              <SettingsMasthead icon={Settings} title="UI" subtitle="Themes &amp; appearance" />
              <div className="schedule-dotted-divider" />

              <div className="p-4" style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ marginBottom: '14px' }}>
                  <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold' }}>Interface Theme</h4>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Current: {themeOptions.find((t) => t.id === theme)?.desc || 'Dark Mode standard'}
                  </p>
                </div>

                {/* ─── Dark Themes ─── */}
                <div style={{ marginBottom: '20px' }}>
                  <h5 style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px', fontWeight: 600 }}>
                    Dark Mode
                  </h5>
                  <div
                    role="radiogroup"
                    aria-label="Dark themes"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                      gap: 'var(--sp-2)',
                    }}
                  >
                    {darkThemes.map(({ id, label, desc, icon: Icon }) => {
                      const isActive = theme === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          role="radio"
                          aria-checked={isActive}
                          onClick={() => setTheme(id)}
                          className="flex flex-col items-start gap-1 p-3"
                          style={{
                            textAlign: 'left',
                            borderRadius: 'var(--radius-md)',
                            border: `1px solid ${isActive ? 'var(--accent-blue)' : 'var(--border-primary)'}`,
                            background: isActive ? 'var(--accent-blue-glow)' : 'var(--bg-secondary)',
                            color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)',
                            transition: 'all var(--transition-base)',
                            fontSize: 'var(--fs-xs)',
                          }}
                        >
                          <Icon size={16} />
                          <span style={{ fontWeight: 'var(--fw-semibold)' }}>{label}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', lineHeight: 1.3 }}>{desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ─── Light Themes ─── */}
                <div>
                  <h5 style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px', fontWeight: 600 }}>
                    Light Mode
                  </h5>
                  <div
                    role="radiogroup"
                    aria-label="Light themes"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                      gap: 'var(--sp-2)',
                    }}
                  >
                    {lightThemes.map(({ id, label, desc, icon: Icon }) => {
                      const isActive = theme === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          role="radio"
                          aria-checked={isActive}
                          onClick={() => setTheme(id)}
                          className="flex flex-col items-start gap-1 p-3"
                          style={{
                            textAlign: 'left',
                            borderRadius: 'var(--radius-md)',
                            border: `1px solid ${isActive ? 'var(--accent-blue)' : 'var(--border-primary)'}`,
                            background: isActive ? 'var(--accent-blue-glow)' : 'var(--bg-secondary)',
                            color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)',
                            transition: 'all var(--transition-base)',
                            fontSize: 'var(--fs-xs)',
                          }}
                        >
                          <Icon size={16} />
                          <span style={{ fontWeight: 'var(--fw-semibold)' }}>{label}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', lineHeight: 1.3 }}>{desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'notifications' && (
            <div className="animate-fadeIn cfg-stack">
              <SettingsMasthead icon={Bell} title="Configure" subtitle="Alerts &amp; reminders" />
              <div className="schedule-dotted-divider" />

              <AccentColorSection />

              {!supported && (
                <div className="cfg-banner cfg-banner--rose">
                  <AlertTriangle size={18} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
                  <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-rose)' }}>Your browser does not support notifications.</p>
                </div>
              )}

              {supported && permission === 'denied' && (
                <div className="cfg-banner cfg-banner--rose">
                  <BellOff size={18} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--accent-rose)' }}>Notifications blocked by browser</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Go to your browser site settings and allow notifications for this site, then reload.</p>
                  </div>
                </div>
              )}

              {supported && permission !== 'denied' && (
                <>
                  <section className="cfg-section">
                    <div className="cfg-section-head">
                      <h3 className="cfg-section-title">Smart Reminders</h3>
                      <p className="cfg-section-desc">Browser alerts for classes and deadlines.</p>
                    </div>

                    <div className="cfg-row">
                      <div className="cfg-row-main">
                        <span className={`cfg-row-icon ${notifSettings.enabled && permission === 'granted' ? 'is-emerald' : ''}`}>
                          {notifSettings.enabled && permission === 'granted'
                            ? <BellRing size={18} />
                            : <BellOff size={18} />
                          }
                        </span>
                        <div className="cfg-row-text">
                          <h4 className="cfg-row-title">Enable smart reminders</h4>
                          <p className="cfg-row-desc">
                            {permission === 'granted'
                              ? notifSettings.enabled ? 'Active — reminders running in background' : 'Permission granted — click to enable'
                              : 'Browser will ask for permission when you enable'}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`toggle-switch ${notifSettings.enabled && permission === 'granted' ? 'active' : ''}`}
                        onClick={async () => {
                          if (notifSettings.enabled) {
                            disableNotifs();
                            setNotifMsg('Reminders disabled.');
                          } else {
                            setNotifEnabling(true);
                            const result = await enableNotifs();
                            setNotifEnabling(false);
                            if (result === 'granted') setNotifMsg('Reminders enabled! You\'ll get alerts before classes and deadlines.');
                            else if (result === 'denied') setNotifMsg('Permission denied. Allow notifications in browser settings.');
                            else setNotifMsg('Permission not granted.');
                          }
                          setTimeout(() => setNotifMsg(''), 3500);
                        }}
                        style={{ opacity: notifEnabling ? 0.6 : 1, cursor: notifEnabling ? 'not-allowed' : 'pointer' }}
                      />
                    </div>

                    <div className="cfg-perm">
                      <ShieldCheck size={13} style={{ color: 'var(--accent-amber)' }} />
                      <p>
                        <strong>Why this permission?</strong> Turning this on asks your browser for <strong>notification permission</strong> — used only to alert you before classes and deadlines. Nothing is shared; you can revoke it anytime from your browser's site settings.
                      </p>
                    </div>

                    {notifMsg && (
                      <p className="animate-fadeIn" style={{ fontSize: 'var(--fs-xs)', color: permission === 'granted' ? 'var(--accent-emerald)' : 'var(--accent-rose)', padding: '0 4px' }}>
                        {notifMsg}
                      </p>
                    )}
                  </section>
                </>
              )}

              {supported && notifSettings.enabled && permission === 'granted' && (
                <section className="cfg-section animate-fadeIn">
                  <div className="cfg-divider" />
                  <div className="cfg-section-head">
                    <h3 className="cfg-section-title">Reminder Settings</h3>
                    <p className="cfg-section-desc">Choose how early you want to be alerted.</p>
                  </div>

                  <div className="cfg-row">
                    <div className="cfg-row-main">
                      <span className="cfg-row-icon is-blue"><Clock size={18} /></span>
                      <div className="cfg-row-text">
                        <h4 className="cfg-row-title">Class reminders</h4>
                        <p className="cfg-row-desc">Alert before class starts</p>
                      </div>
                    </div>
                    <div
                      className={`toggle-switch ${notifSettings.notifyClass ? 'active' : ''}`}
                      onClick={() => updateSetting('notifyClass', !notifSettings.notifyClass)}
                    />
                  </div>

                  {notifSettings.notifyClass && (
                    <div className="cfg-range-card animate-fadeIn">
                      <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontWeight: 'bold' }}>Alert me <strong style={{ color: 'var(--accent-blue)' }}>{notifSettings.classReminderMins} minutes</strong> before class</span>
                        <input
                          type="range"
                          min={5} max={30} step={5}
                          value={notifSettings.classReminderMins}
                          onChange={(e) => updateSetting('classReminderMins', Number(e.target.value))}
                          style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
                        />
                        <div className="flex justify-between" style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                          <span>5 min</span><span>10 min</span><span>15 min</span><span>20 min</span><span>25 min</span><span>30 min</span>
                        </div>
                      </label>
                    </div>
                  )}

                  <div className="cfg-row">
                    <div className="cfg-row-main">
                      <span className="cfg-row-icon is-amber"><AlertTriangle size={18} /></span>
                      <div className="cfg-row-text">
                        <h4 className="cfg-row-title">Deadline reminders</h4>
                        <p className="cfg-row-desc">Alert for upcoming assignments &amp; exams</p>
                      </div>
                    </div>
                    <div
                      className={`toggle-switch ${notifSettings.notifyDeadline ? 'active' : ''}`}
                      onClick={() => updateSetting('notifyDeadline', !notifSettings.notifyDeadline)}
                    />
                  </div>

                  {notifSettings.notifyDeadline && (
                    <div className="cfg-range-card animate-fadeIn">
                      <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontWeight: 'bold' }}>Alert me <strong style={{ color: 'var(--accent-amber)' }}>{notifSettings.deadlineReminderHours} hours</strong> before deadline</span>
                        <input
                          type="range"
                          min={6} max={48} step={6}
                          value={notifSettings.deadlineReminderHours}
                          onChange={(e) => updateSetting('deadlineReminderHours', Number(e.target.value))}
                          style={{ width: '100%', accentColor: 'var(--accent-amber)' }}
                        />
                        <div className="flex justify-between" style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                          <span>6h</span><span>12h</span><span>18h</span><span>24h</span><span>30h</span><span>36h</span><span>42h</span><span>48h</span>
                        </div>
                      </label>
                    </div>
                  )}

                  <div className="cfg-banner cfg-banner--emerald">
                    <ShieldCheck size={18} style={{ color: 'var(--accent-emerald)', flexShrink: 0 }} />
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Reminders are checked every minute. Notifications only fire once per event and won't repeat.
                    </p>
                  </div>
                </section>
              )}

              <div className="cfg-divider" />

              <section className="cfg-section">
                <div className="cfg-section-head">
                  <h3 className="cfg-section-title">Telegram Notifications</h3>
                  <p className="cfg-section-desc">Class briefing at 12 AM, first-class alert 30 min before, attendance prompts at class end, and a 9 PM confirmation reminder.</p>
                </div>

                <div className="cfg-row">
                  <div className="cfg-row-main">
                    <span className={`cfg-row-icon ${telegramEnabled ? 'is-emerald' : ''}`}><Send size={18} /></span>
                    <div className="cfg-row-text">
                      <h4 className="cfg-row-title">Enable Telegram notifications</h4>
                      <p className="cfg-row-desc">Tomorrow's class digest at 12 AM + smart reminders all day</p>
                    </div>
                  </div>
                  <div
                    className={`toggle-switch ${telegramEnabled ? 'active' : ''}`}
                    onClick={() => setTelegramEnabled(!telegramEnabled)}
                  />
                </div>

                {telegramEnabled && (
                  <>
                    <div className="cfg-row animate-fadeIn">
                      <div className="cfg-row-main">
                        <span className={`cfg-row-icon ${notifSettings.notifyDigest !== false ? 'is-blue' : ''}`}><Moon size={18} /></span>
                        <div className="cfg-row-text">
                          <h4 className="cfg-row-title">12 AM class digest</h4>
                          <p className="cfg-row-desc">Next day's full class list at midnight — set your alarm from it</p>
                        </div>
                      </div>
                      <div
                        className={`toggle-switch ${notifSettings.notifyDigest !== false ? 'active' : ''}`}
                        onClick={() => updateSetting('notifyDigest', !(notifSettings.notifyDigest !== false))}
                      />
                    </div>

                    <div className="cfg-row animate-fadeIn">
                      <div className="cfg-row-main">
                        <span className={`cfg-row-icon ${notifSettings.notifyClass !== false ? 'is-blue' : ''}`}><Clock size={18} /></span>
                        <div className="cfg-row-text">
                          <h4 className="cfg-row-title">Pre-class alert</h4>
                          <p className="cfg-row-desc">One reminder 30 minutes before your first class</p>
                        </div>
                      </div>
                      <div
                        className={`toggle-switch ${notifSettings.notifyClass !== false ? 'active' : ''}`}
                        onClick={() => updateSetting('notifyClass', !notifSettings.notifyClass)}
                      />
                    </div>

                    <div className="cfg-row animate-fadeIn">
                      <div className="cfg-row-main">
                        <span className={`cfg-row-icon ${notifSettings.notifyAttendance !== false ? 'is-emerald' : ''}`}><CheckCircle2 size={18} /></span>
                        <div className="cfg-row-text">
                          <h4 className="cfg-row-title">Attendance prompts</h4>
                          <p className="cfg-row-desc">Yes/No prompt after each class ends + 9 PM reminder; unanswered classes are auto-marked missed at midnight</p>
                        </div>
                      </div>
                      <div
                        className={`toggle-switch ${notifSettings.notifyAttendance !== false ? 'active' : ''}`}
                        onClick={() => updateSetting('notifyAttendance', !(notifSettings.notifyAttendance !== false))}
                      />
                    </div>
                  </>
                )}

              {telegramEnabled && (
                <div className="animate-fadeIn cfg-stack cfg-stack--tight">
                  <div>
                    <span className="cfg-field-label">Telegram Chat ID</span>
                    <input 
                      type="text"
                      id="telegram-chat-id"
                      name="telegramChatId"
                      autoComplete="off"
                      value={telegramChatId} 
                      onChange={(e) => {
                        const value = e.target.value;
                        setTelegramChatId(value);
                        // If the user types a different Chat ID than the one
                        // registered, don't show the old "registered" status.
                        if (value.trim() !== registeredChatIdRef.current) {
                          setIsTelegramRegistered(false);
                        }
                      }} 
                      className="input" 
                      placeholder="Enter your Telegram Chat ID"
                    />
                    <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                      Get your ID from <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)' }}>@userinfobot</a> on Telegram
                    </p>
                  </div>
                  
                  {/* Registration status indicator */}
                  {isTelegramRegistered !== null && (
                    <div className={`cfg-status-card ${isTelegramRegistered ? 'is-ok' : ''}`}>
                      <p style={{ color: isTelegramRegistered ? 'var(--accent-emerald)' : 'var(--text-tertiary)' }}>
                        {isTelegramRegistered 
                          ? '✅ You are registered for daily notifications' 
                          : '⭕ Not registered for notifications'}
                      </p>
                    </div>
                  )}
                  
                  <div className="cfg-actions">
                    {/* Register button */}
                    {!isTelegramRegistered ? (
                      <button 
                        className="btn btn-primary" 
                        onClick={async () => {
                          if (!telegramChatId) {
                            setTelegramMsg('❌ Please enter your Chat ID');
                            setTimeout(() => setTelegramMsg(''), 3000);
                            return;
                          }
                          
                          setTelegramTesting(true);
                          try {
                            const response = await fetch('/api/telegram/register', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ 
                                chatId: telegramChatId,
                                routine 
                              })
                            });
                            const result = await response.json();
                            if (result.success) {
                              setTelegramMsg('✅ Registered! Your class digest arrives at 12 AM, plus pre-class alerts and attendance prompts.');
                              registeredChatIdRef.current = telegramChatId.trim();
                              setIsTelegramRegistered(true);
                            } else {
                              setTelegramMsg('❌ Failed: ' + (result.error || 'Unknown error'));
                            }
                          } catch (err) {
                            setTelegramMsg('❌ Error: ' + err.message);
                          }
                          setTelegramTesting(false);
                          setTimeout(() => setTelegramMsg(''), 5000);
                        }}
                        disabled={telegramTesting}
                      >
                        <BellRing size={14} /> {telegramTesting ? 'Registering...' : 'Register for Notifications'}
                      </button>
                    ) : (
                      <button 
                        className="btn btn-secondary" 
                        onClick={async () => {
                          if (!window.confirm('Are you sure you want to stop receiving Telegram notifications?')) return;
                          
                          setTelegramTesting(true);
                          try {
                            const response = await fetch('/api/telegram/unregister', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ chatId: telegramChatId })
                            });
                            const result = await response.json();
                            if (result.success) {
                              setTelegramMsg('✅ You have been unsubscribed from notifications.');
                              registeredChatIdRef.current = '';
                              setIsTelegramRegistered(false);
                            } else {
                              setTelegramMsg('❌ Failed: ' + (result.error || 'Unknown error'));
                            }
                          } catch (err) {
                            setTelegramMsg('❌ Error: ' + err.message);
                          }
                          setTelegramTesting(false);
                          setTimeout(() => setTelegramMsg(''), 5000);
                        }}
                        disabled={telegramTesting}
                      >
                        <BellOff size={14} /> Unsubscribe
                      </button>
                    )}
                    
                    {/* Test button for 8 AM notification */}
                    <button 
                      className="btn btn-ghost" 
                      onClick={async () => {
                        if (!telegramChatId) {
                          setTelegramMsg('❌ Please enter your Chat ID');
                          setTimeout(() => setTelegramMsg(''), 3000);
                          return;
                        }
                        
                        setTelegramTesting(true);
                        try {
                          const response = await fetch('/api/telegram/test', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              routine,
                              chatId: telegramChatId
                            })
                          });
                          const result = await response.json();
                          if (result.success) {
                            setTelegramMsg("✅ Test digest sent! This is what arrives at 12 AM with tomorrow's classes.");
                          } else {
                            setTelegramMsg('❌ Failed: ' + (result.error || 'Unknown error'));
                          }
                        } catch (err) {
                          setTelegramMsg('❌ Error: ' + err.message);
                        }
                        setTelegramTesting(false);
                        setTimeout(() => setTelegramMsg(''), 5000);
                      }}
                      disabled={telegramTesting}
                      title="Sends the notification that would be sent at the next 8 AM"
                    >
                      <Send size={14} /> Test (8 AM)
                    </button>
                    
                    {/* Test button for 9 PM Attendance notification */}
                    <button 
                      className="btn btn-ghost" 
                      onClick={async () => {
                        if (!telegramChatId) {
                          setTelegramMsg('❌ Please enter your Chat ID');
                          setTimeout(() => setTelegramMsg(''), 3000);
                          return;
                        }
                        
                        setTelegramTesting(true);
                        try {
                          const response = await fetch('/api/telegram/test-attendance', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              routine,
                              chatId: telegramChatId
                            })
                          });
                          const result = await response.json();
                          if (result.success) {
                            setTelegramMsg('✅ Test attendance message sent! You will receive prompts after each class and a 9 PM reminder with Yes/No buttons.');
                          } else {
                            setTelegramMsg('❌ Failed: ' + (result.error || 'Unknown error'));
                          }
                        } catch (err) {
                          setTelegramMsg('❌ Error: ' + err.message);
                        }
                        setTelegramTesting(false);
                        setTimeout(() => setTelegramMsg(''), 5000);
                      }}
                      disabled={telegramTesting}
                      title="Sends the attendance confirmation message that would be sent at 9 PM"
                    >
                      <Send size={14} /> Test (9 PM Attendance)
                    </button>
                  </div>
                  
                  {telegramMsg && (
                    <p style={{ fontSize: 'var(--fs-xs)', color: telegramMsg.includes('✅') ? 'var(--accent-emerald)' : 'var(--accent-rose)', padding: '4px' }}>
                      {telegramMsg}
                    </p>
                  )}
                  
                  {/* Webhook Status */}
                  <div className={`cfg-status-card ${webhookInfo?.ok ? 'is-ok' : 'is-warn'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {webhookLoading ? (
                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Checking webhook status...</span>
                      ) : webhookInfo?.ok ? (
                        <>
                          <CheckCircle2 size={14} style={{ color: 'var(--accent-emerald)' }} />
                          <span style={{ fontSize: '10px', color: 'var(--accent-emerald)', fontWeight: 'bold' }}>Webhook is active</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={14} style={{ color: 'var(--accent-amber)' }} />
                          <span style={{ fontSize: '10px', color: 'var(--accent-amber)', fontWeight: 'bold' }}>Webhook not configured</span>
                        </>
                      )}
                    </div>
                    {webhookInfo?.ok && webhookInfo.result?.url && (
                      <p style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                        URL: {webhookInfo.result.url}
                      </p>
                    )}
                    {!webhookInfo?.ok && (
                      <div style={{ marginTop: '8px' }}>
                        <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          For Telegram buttons to work, the webhook must be configured with a public HTTPS URL.
                        </p>
                        <div className="flex gap-2">
                          <button 
                            className="btn btn-sm btn-primary"
                            onClick={async () => {
                              // Instructions for setting up ngrok
                              setTelegramMsg('📝 Setup Instructions:\n\n1. Install ngrok: npm install -g ngrok\n2. Run: ngrok http 5174\n3. Copy the HTTPS URL from ngrok output\n4. Click "Set Webhook URL" below and paste the URL\n\nExample: https://abc123.ngrok.io/api/telegram/webhook');
                              setTimeout(() => setTelegramMsg(''), 10000);
                            }}
                            style={{ fontSize: '10px' }}
                          >
                            Show Setup Guide
                          </button>
                          <button 
                            className="btn btn-sm btn-secondary"
                            onClick={async () => {
                              const webhookUrl = prompt('Enter your ngrok webhook URL:\n\nExample: https://abc123.ngrok.io/api/telegram/webhook');
                              if (webhookUrl) {
                                try {
                                  const response = await fetch('/api/telegram/set-webhook', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ webhookUrl })
                                  });
                                  const result = await response.json();
                                  if (result.ok) {
                                    setTelegramMsg('✅ Webhook configured successfully! Buttons should now work.');
                                    // Refresh webhook info
                                    const infoResponse = await fetch('/api/telegram/webhook-info');
                                    const infoResult = await infoResponse.json();
                                    setWebhookInfo(infoResult);
                                  } else {
                                    setTelegramMsg('❌ Failed: ' + (result.description || 'Unknown error'));
                                  }
                                } catch (err) {
                                  setTelegramMsg('❌ Error: ' + err.message);
                                }
                                setTimeout(() => setTelegramMsg(''), 5000);
                              }
                            }}
                            style={{ fontSize: '10px' }}
                          >
                            Set Webhook URL
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="cfg-note">
                    <p style={{ color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                      <strong>How it works:</strong>
                    </p>
                    <ol>
                      <li>Get your Chat ID from <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)' }}>@userinfobot</a> on Telegram</li>
                      <li>Enter your Chat ID above and click "Register for Notifications"</li>
                      <li>You'll receive a welcome message from our bot</li>
                      <li>Class digest every night at 12 AM (tomorrow's classes) + alert 30 min before your first class</li>
                      <li>Attendance prompt after each class ends, 9 PM reminder, auto-missed at midnight</li>
                      <li>Urgent deadline alerts (high priority) and a 12-hour-before reminder</li>
                      <li style={{ marginTop: '4px', color: 'var(--accent-amber)' }}><strong>Important:</strong> For attendance buttons to work, the webhook must be configured with a public HTTPS URL (use ngrok for local testing)</li>
                    </ol>
                  </div>
                </div>
              )}
              </section>

              <div className="cfg-divider" />

              <section className="cfg-section">
                <div className="cfg-section-head">
                  <h3 className="cfg-section-title">Library Location Tracking</h3>
                  <p className="cfg-section-desc">Automatically share your presence to power the live Library Occupancy Pulse.</p>
                </div>

                <div className="cfg-row">
                  <div className="cfg-row-main">
                    <span className={`cfg-row-icon ${libraryTracking ? 'is-emerald' : ''}`}><MapPin size={18} /></span>
                    <div className="cfg-row-text">
                      <h4 className="cfg-row-title">Enable location tracking</h4>
                      <p className="cfg-row-desc">
                        {libraryTracking
                          ? 'Active — the library will count you when you are within 60m'
                          : 'Off — you are not counted in the live occupancy count'}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`toggle-switch ${libraryTracking ? 'active' : ''}`}
                    onClick={() => setLibraryTracking(!libraryTracking)}
                  />
                </div>

                <div className="cfg-banner cfg-banner--blue">
                  <ShieldCheck size={18} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--accent-blue)' }}>Why this permission?</strong> Turning this on asks your browser for <strong>location access</strong> — used only to check if you are inside the library geofence (~60m) so you get counted in the live occupancy, and only while the app is open. Nothing is stored or shared, and you can turn it off anytime.
                  </p>
                </div>
              </section>

              <div className="cfg-divider" />

              <div className="am-settings-privacy">
                <div className="am-settings-privacy-head">
                  <div className="am-settings-privacy-title">
                    <ShieldCheck size={16} />
                    <div>
                      <h4>Member List Privacy</h4>
                      <p>Control what others see in the Active Members sidebar.</p>
                    </div>
                  </div>
                  {privacySaving && <span className="am-settings-privacy-saving">Saving…</span>}
                  {privacyMsg && <span className="am-settings-privacy-saved">{privacyMsg}</span>}
                </div>
                <div className="am-settings-privacy-row">
                  <div>
                    <strong>Show my CGPA</strong>
                    <span>Display your current CGPA in your member profile popup.</span>
                  </div>
                  <div
                    className={`toggle-switch ${privacySettings.showCgpa ? 'active' : ''}`}
                    onClick={() => savePrivacySetting('showCgpa', !privacySettings.showCgpa)}
                    role="switch"
                    aria-checked={privacySettings.showCgpa}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); savePrivacySetting('showCgpa', !privacySettings.showCgpa); } }}
                  />
                </div>
              </div>
            </div>
          )}

{activeSubTab === 'orbits' && (
            <div className="animate-fadeIn">
              <SettingsMasthead icon={Orbit} title="My Orbits" subtitle="Configure checkpoints, then drive a road-trip through your orbit" />
              <div className="schedule-dotted-divider" />

              <OrbitsProvider user={user}>
                <div className="orbits-hero">
                  <div className="orbits-avatar">
                    {user?.avatar && !orbitAvatarError ? (
                      <img src={user.avatar} alt="Your orbit avatar" crossOrigin="anonymous" referrerPolicy="no-referrer" onError={() => setOrbitAvatarError(true)} />
                    ) : (
                      orbitInitials
                    )}
                  </div>
                  <div className="orbits-hero-info">
                    <span className="orbits-eyebrow">YOUR ORBIT</span>
                    <h4 className="orbits-name">{user?.name || 'Guest'}</h4>
                    <p className="orbits-desc">
                      {user?.department}
                      {user?.yearSemester ? ` · ${getYearSemesterShortName(user.yearSemester)}` : ''}
                    </p>
                    <FavoriteColorInput />
                  </div>
                  <div className="orbits-start">
                    <DriveOrbitButton user={user} />
                    <p>Reuses the stalk road-trip — drives your checkpoints with the details you set in Checkpoint Control.</p>
                  </div>
                </div>

                {!isAuthenticated ? (
                  <div className="cfg-banner cfg-banner--rose">
                    <ShieldAlert size={18} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-rose)', margin: 0 }}>
                        Firewall active — you're in guest mode. Log in to unlock your checkpoint data and configure your route.
                      </p>
                      <button className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={() => navigate('/login')}>
                        Bypass Firewall
                      </button>
                    </div>
                  </div>
                ) : (
                  <OrbitsConfigurationPanel />
                )}
              </OrbitsProvider>
            </div>
          )}

          {activeSubTab === 'about' && (
            <div className="animate-fadeIn">
              <AboutUs />
            </div>
          )}

          {activeSubTab === 'invite' && isAuthenticated && user?.role === 'admin' && (
            <div className="animate-fadeIn">
              <SettingsMasthead icon={Send} title="Invite Member" subtitle="Send invites" />
              <div className="schedule-dotted-divider" />

              {/* Invite Form */}
              <div className="invite-member-panel" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-xs)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Email</label>
                    <input
                      className="input"
                      type="email"
                      id="invite-email"
                      name="inviteEmail"
                      autoComplete="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="member@example.com"
                      onKeyDown={(e) => { if (e.key === 'Enter') sendInvite(); }}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 140px' }}>
                    <label style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-xs)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Invite as</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)' }}
                    >
                      <option value="faculty">Faculty</option>
                      <option value="alumni">Alumni</option>
                    </select>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={sendInvite}
                    disabled={inviteSending}
                    style={{ height: '38px', whiteSpace: 'nowrap' }}
                  >
                    {inviteSending ? 'Creating link...' : 'Create invite link'}
                  </button>
                </div>

                {inviteMsg && (
                  <div style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    fontSize: 'var(--fs-xs)',
                    borderRadius: 'var(--radius-sm)',
                    background: inviteMsgType === 'success' ? 'var(--accent-emerald-glow)' : 'var(--accent-rose-glow)',
                    border: `1px solid ${inviteMsgType === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)'}`,
                    color: inviteMsgType === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                  }}>
                    {inviteMsg}
                  </div>
                )}
                {inviteLink && (
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '10px' }}>
                      <input className="input" readOnly value={inviteLink} aria-label="Invitation link" style={{ flex: '1 1 280px', fontSize: '11px' }} />
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard?.writeText(inviteLink)}>Copy invitation link</button>
                    </div>
                    <InviteLinkQr value={inviteLink} />
                  </div>
                )}
              </div>

              {/* Invitation History */}
              <div className="invite-member-history">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', margin: 0 }}>Invitation History</h4>
                </div>

                {invitations.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
                    No invitations sent yet.
                  </div>
                ) : (
                  <>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-xs)' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 'bold' }}>Email</th>
                            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 'bold' }}>Role</th>
                            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 'bold' }}>Invite status</th>
                            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 'bold' }}>Email status</th>
                            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 'bold' }}>Created</th>
                            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 'bold' }}>Accepted</th>
                            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 'bold' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invitations.map((inv) => (
                            <tr key={inv.Id} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                              <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{inv.Email}</td>
                              <td style={{ padding: '8px 10px', textTransform: 'capitalize' }}>{inv.Role}</td>
                              <td style={{ padding: '8px 10px' }}>
                                <span className={`badge ${inv.Status === 'accepted' ? 'badge-emerald' : inv.Status === 'expired' ? 'badge-rose' : 'badge-blue'}`} style={{ fontSize: '9px' }}>
                                  {inv.Status === 'accepted' ? 'Accepted' : inv.Status === 'expired' ? 'Expired' : 'Pending'}
                                </span>
                              </td>
                              <td style={{ padding: '8px 10px' }} title={inv.EmailStatus === 'accepted_by_gmail' ? 'Gmail accepted this message for delivery. This does not confirm inbox delivery.' : inv.EmailStatus === 'failed' ? `Email submission failed (${inv.EmailErrorCode || 'unknown'}). Submit the same address again to retry.` : 'Email submission status is unavailable for this invitation.'}>
                                <span className={`badge ${inv.EmailStatus === 'accepted_by_gmail' ? 'badge-emerald' : inv.EmailStatus === 'failed' ? 'badge-rose' : 'badge-blue'}`} style={{ fontSize: '9px' }}>
                                  {inv.EmailStatus === 'accepted_by_gmail' ? 'Accepted by Gmail' : inv.EmailStatus === 'failed' ? 'Failed' : 'Not tracked'}
                                </span>
                                {inv.EmailSubmittedAt && <div style={{ marginTop: '4px', color: 'var(--text-tertiary)', fontSize: '10px' }}>{new Date(inv.EmailSubmittedAt).toLocaleString()}</div>}
                              </td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-tertiary)', fontSize: '11px' }}>
                                {new Date(inv.CreatedAt).toLocaleDateString()}
                              </td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-tertiary)', fontSize: '11px' }}>
                                {inv.AcceptedAt ? new Date(inv.AcceptedAt).toLocaleDateString() : '—'}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                {inv.Status === 'pending' && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    disabled={inviteSending}
                                    onClick={() => sendInvite(inv.Email, inv.Role)}
                                    style={{ minHeight: '40px', whiteSpace: 'nowrap' }}
                                  >
                                    {inviteSending ? 'Sending…' : 'Resend email'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {inviteTotalPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '16px' }}>
                        {Array.from({ length: inviteTotalPages }, (_, i) => i + 1).map((p) => (
                          <button
                            key={p}
                            onClick={() => setInvitePage(p)}
                            style={{
                              width: '30px', height: '30px',
                              border: `1px solid ${p === invitePage ? 'var(--border-focus)' : 'var(--border-primary)'}`,
                              borderRadius: 'var(--radius-sm)',
                              background: p === invitePage ? 'var(--accent-blue-glow)' : 'transparent',
                              color: p === invitePage ? 'var(--accent-blue)' : 'var(--text-secondary)',
                              fontWeight: p === invitePage ? 'bold' : 'normal',
                              cursor: 'pointer', fontSize: 'var(--fs-xs)',
                            }}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        </FeatureAccessGate>
      </div>
      </MastheadAccessControl>}

      {/* ── 4. CR / SR Leadership (own card, below the content box) ── */}
{activeSubTab === 'profile' && isAuthenticated && !isEditingProfile && !['vp', 'gs'].includes(user?.role) && (
            <div className="st-cr-sr-cta" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-5)', boxShadow: 'var(--shadow-lift)' }}>
              <div className="animate-fadeIn">
              {/* One-line status bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <span style={{
                    width: 34, height: 34, borderRadius: 'var(--radius-full)', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--accent-amber-glow)',
                    color: crSrStatus?.hasActiveRole ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                  }}>
                    {crSrStatus?.hasActiveRole ? <ShieldCheck size={16} /> : crSrStatus?.hasPending ? <Clock3 size={16} /> : <GraduationCap size={16} />}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', margin: 0, whiteSpace: 'nowrap' }}>
                      {crSrStatus?.hasActiveRole
                        ? `You're the ${crSrStatus.activeRole === 'cr' ? 'Class Representative (CR)' : 'Student Representative (SR)'}`
                        : 'CR / SR Leadership'}
                    </p>
                    <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '420px' }}>
                      {crSrStatus?.hasActiveRole
                        ? `${user?.department} • ${crSrStatus.activeRole === 'cr' ? `Lab ${user?.labSection}` : `Section ${user?.section}`}`
                        : crSrStatus?.hasPending
                          ? `Applied for ${{ cr: 'CR', sr: 'SR', vp: 'VP', gs: 'GS' }[crSrStatus.pendingApplication.appliedRole] || 'position'} · ${formatAppDate(crSrStatus.pendingApplication.createdAt)} · Awaiting review`
                          : allChangesReady
                            ? 'CR/SR positions are open for your batch'
                            : 'Complete your academic details to apply'}
                    </p>
                  </div>
                </div>

                {crSrStatus?.hasActiveRole ? (
                  <button
                    className="btn btn-sm"
                    onClick={() => setResignConfirm(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: 'var(--accent-rose-glow)', border: '1px solid var(--accent-rose)',
                      color: 'var(--accent-rose)', fontWeight: 'bold', fontSize: '12px',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    Resign / Step Down
                  </button>
                ) : crSrStatus?.hasPending ? (
                  <button
                    className="btn btn-sm"
                    onClick={() => setWithdrawConfirm(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: 'var(--accent-amber-glow)', border: '1px solid var(--accent-amber)',
                      color: 'var(--accent-amber)', fontWeight: 'bold', fontSize: '12px',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    <Clock3 size={14} /> Withdraw Request
                  </button>
                ) : allChangesReady ? (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowApplyForm((v) => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <GraduationCap size={14} /> {showApplyForm ? 'Close' : 'Apply Now'}
                  </button>
                ) : (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsEditingProfile(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Pencil size={14} /> Complete Profile
                  </button>
                )}
              </div>

              {applicationMessage && (
                <div className="p-4" style={{ 
                  background: applicationMessage.includes('success') || applicationMessage.includes('successfully') ? 'var(--accent-emerald-glow)' : 'var(--accent-rose-glow)',
                  border: `1px solid ${applicationMessage.includes('success') || applicationMessage.includes('successfully') ? 'var(--accent-emerald)' : 'var(--accent-rose)'}`,
                  borderRadius: 'var(--radius-lg)',
                  fontSize: 'var(--fs-xs)',
                  color: applicationMessage.includes('success') || applicationMessage.includes('successfully') ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '14px',
                }}>
                  {applicationMessage.includes('success') || applicationMessage.includes('successfully') ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  {applicationMessage}
                </div>
              )}

              {/* Apply area — expands from the one-line bar (hidden once applied/active) */}
              {showApplyForm && !crSrStatus?.hasPending && !crSrStatus?.hasActiveRole && (
                <>
              {/* Profile Completion Check */}
              {(!crSrStatus?.hasPending && !crSrStatus?.hasActiveRole) && !allChangesReady && (
                <div className="glass-card-static" style={{ border: '1px solid var(--accent-amber)', borderRadius: 'var(--radius-lg)', padding: '20px', background: 'var(--accent-amber-glow)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <AlertTriangle size={20} style={{ color: 'var(--accent-amber)' }} />
                    <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', color: 'var(--accent-amber)' }}>Profile Incomplete</h4>
                  </div>
                  <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    Before applying for CR/SR, you must complete your profile with all academic details including <strong>Section</strong> and <strong>Lab Group</strong>.
                  </p>
                  <button 
                    className="btn btn-primary btn-sm" 
                    onClick={() => handleSetActiveSubTab('profile')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Pencil size={14} /> Complete Your Profile
                  </button>
                </div>
              )}

              {/* Application Form */}
              {(!crSrStatus?.hasPending && !crSrStatus?.hasActiveRole) && allChangesReady && (
                <form onSubmit={handleRoleApplication} className="glass-card-static" style={{ border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
                  <div className="mb-6">
                    <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Apply for Position</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className={`btn flex-1 ${roleApplicationForm.appliedRole === 'cr' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setRoleApplicationForm({ ...roleApplicationForm, appliedRole: 'cr', targetLabSection: '', targetSection: '' })}
                      >
                        <Users size={16} /> Class Representative (CR)
                      </button>
                      <button
                        type="button"
                        className={`btn flex-1 ${roleApplicationForm.appliedRole === 'sr' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setRoleApplicationForm({ ...roleApplicationForm, appliedRole: 'sr', targetLabSection: '', targetSection: '' })}
                      >
                        <GraduationCap size={16} /> Student Representative (SR)
                      </button>
                    </div>
                  </div>

                  {/* Target Selection based on role */}
                  {roleApplicationForm.appliedRole && (
                    <div className="mb-4">
                      <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                        {roleApplicationForm.appliedRole === 'cr' ? 'Select Lab Group' : 'Select Section'}
                      </label>
                      {roleApplicationForm.appliedRole === 'cr' ? (
                        <div className="flex gap-2 flex-wrap">
                          {['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'].map((lab) => {
                            const slotInfo = vacancyMap?.crSlots?.find(s => s.key === lab);
                            const isVacant = slotInfo?.vacant !== false;
                            const occupantName = slotInfo?.occupant?.name;
                            const isSelected = roleApplicationForm.targetLabSection === lab;
                            const isDisabled = !isVacant;
                            return (
                              <button
                                key={lab}
                                type="button"
                                className={`btn btn-sm ${isSelected ? 'btn-primary' : isVacant ? 'btn-secondary' : 'btn-ghost'}`}
                                onClick={() => {
                                  if (!isVacant) return;
                                  setRoleApplicationForm({ ...roleApplicationForm, targetLabSection: lab });
                                }}
                                disabled={isDisabled}
                                title={isVacant ? `${lab} - Vacant` : `${lab} - Taken by ${occupantName}`}
                                style={{
                                  opacity: isDisabled ? 0.5 : 1,
                                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                {lab}
                                {isVacant ? (
                                  <span style={{ fontSize: '9px', color: 'var(--accent-emerald)' }}>✅</span>
                                ) : (
                                  <span style={{ fontSize: '9px', color: 'var(--accent-rose)' }}>❌</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex gap-2 flex-wrap">
                          {['A', 'B', 'C', 'D'].map((section) => {
                            const slotInfo = vacancyMap?.srSlots?.find(s => s.key === section);
                            const isVacant = slotInfo?.vacant !== false;
                            const occupantName = slotInfo?.occupant?.name;
                            const isSelected = roleApplicationForm.targetSection === section;
                            const isDisabled = !isVacant;
                            return (
                              <button
                                key={section}
                                type="button"
                                className={`btn btn-sm ${isSelected ? 'btn-primary' : isVacant ? 'btn-secondary' : 'btn-ghost'}`}
                                onClick={() => {
                                  if (!isVacant) return;
                                  setRoleApplicationForm({ ...roleApplicationForm, targetSection: section });
                                }}
                                disabled={isDisabled}
                                title={isVacant ? `Section ${section} - Vacant` : `Section ${section} - Taken by ${occupantName}`}
                                style={{
                                  opacity: isDisabled ? 0.5 : 1,
                                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                {section}
                                {isVacant ? (
                                  <span style={{ fontSize: '9px', color: 'var(--accent-emerald)' }}>✅</span>
                                ) : (
                                  <span style={{ fontSize: '9px', color: 'var(--accent-rose)' }}>❌</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mb-4">
                    <label htmlFor="cr-sr-application-statement" style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                      Statement <span style={{ color: 'var(--text-tertiary)', fontWeight: 'normal' }}>(Optional)</span>
                    </label>
                    <textarea
                      id="cr-sr-application-statement"
                      className="input"
                      rows={4}
                      maxLength={1000}
                      value={roleApplicationForm.statement || ''}
                      onChange={(event) => setRoleApplicationForm({ ...roleApplicationForm, statement: event.target.value })}
                      placeholder="Share why you'd like to take this role or anything the admin should consider."
                      aria-describedby="cr-sr-application-statement-hint"
                      style={{ width: '100%', resize: 'vertical', minHeight: '96px' }}
                    />
                    <span id="cr-sr-application-statement-hint" style={{ display: 'block', marginTop: '5px', color: 'var(--text-tertiary)', fontSize: '11px' }}>
                      This will be visible to the admin reviewing your application. {roleApplicationForm.statement?.length || 0}/1000
                    </span>
                  </div>

                  <div className="mb-4">
                    <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Your Information</label>
                    <div className="p-4" style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-xs)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div><span style={{ color: 'var(--text-tertiary)' }}>Name:</span> {user?.name}</div>
                        <div><span style={{ color: 'var(--text-tertiary)' }}>Email:</span> {user?.email}</div>
                        <div><span style={{ color: 'var(--text-tertiary)' }}>Department:</span> {user?.department}</div>
                        <div><span style={{ color: 'var(--text-tertiary)' }}>Batch:</span> {user?.batch || user?.batchNo}</div>
                        <div><span style={{ color: 'var(--text-tertiary)' }}>Section:</span> {user?.section}</div>
                        <div><span style={{ color: 'var(--text-tertiary)' }}>Lab Group:</span> {user?.labSection}</div>
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={submittingApplication || (roleApplicationForm.appliedRole === 'cr' && !roleApplicationForm.targetLabSection) || (roleApplicationForm.appliedRole === 'sr' && !roleApplicationForm.targetSection)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Send size={16} /> {submittingApplication ? 'Submitting...' : 'Submit Application'}
                  </button>
                </form>
              )}
                </>
              )}

              {/* Resign Confirmation Dialog */}
              {resignConfirm && (
                <div style={{
                  position: 'fixed',
                  top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                  padding: '16px',
                }}
                  onClick={() => setResignConfirm(false)}
                >
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      maxWidth: '440px',
                      width: '100%',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '28px 24px',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <div style={{
                        width: '44px', height: '44px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--accent-rose-glow)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-rose)',
                        flexShrink: 0,
                      }}>
                        <AlertTriangle size={22} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', margin: 0 }}>Resign from Position?</h4>
                        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                          You are currently a {crSrStatus?.activeRole === 'cr' ? 'Class Representative (CR)' : 'Student Representative (SR)'}
                          {user?.labSection && ` (${user.labSection})`}
                          {user?.section && !user?.labSection && ` (Section ${user.section})`}
                        </p>
                      </div>
                    </div>

                    <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px' }}>
                      Are you sure you want to step down? Your position will become vacant and others can apply for it.
                    </p>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        className="btn btn-secondary flex-1"
                        onClick={() => setResignConfirm(false)}
                        disabled={resigning}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn flex-1"
                        onClick={async () => {
                          setResigning(true);
                          try {
                            await resignFromRole(user.id);
                            // Sync AuthContext so role updates everywhere immediately
                            updateUser({ role: 'student' });
                            setApplicationMessage('You have successfully resigned from your position.');
                            setResignConfirm(false);
                            // Refresh status
                            const status = getUserApplicationStatus(user.id);
                            setApplicationStatus(status);
                            const applications = getApplicationsByUserId(user.id);
                            setUserApplications(applications);
                            const map = getSlotVacancyMap(user.department, user.semester || 1);
                            setVacancyMap(map);
                          } catch (err) {
                            setApplicationMessage(err.message || 'Failed to resign.');
                          } finally {
                            setResigning(false);
                            setTimeout(() => setApplicationMessage(''), 5000);
                          }
                        }}
                        style={{
                          background: 'var(--accent-rose)',
                          border: 'none',
                          color: '#fff',
                          fontWeight: 'bold',
                          opacity: resigning ? 0.6 : 1,
                          cursor: resigning ? 'not-allowed' : 'pointer',
                        }}
                        disabled={resigning}
                      >
                        {resigning ? 'Resigning...' : 'Yes, Resign'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Withdraw Confirmation Dialog */}
              {withdrawConfirm && (
                <div style={{
                  position: 'fixed',
                  top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                  padding: '16px',
                }}
                  onClick={() => setWithdrawConfirm(false)}
                >
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      maxWidth: '440px',
                      width: '100%',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '28px 24px',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <div style={{
                        width: '44px', height: '44px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--accent-amber-glow)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-amber)',
                        flexShrink: 0,
                      }}>
                        <Clock3 size={22} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', margin: 0 }}>Withdraw Application?</h4>
                        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                          Applied for {{ cr: 'CR', sr: 'SR', vp: 'VP', gs: 'GS' }[crSrStatus?.pendingApplication?.appliedRole] || 'position'}
                        </p>
                      </div>
                    </div>

                    <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px' }}>
                      Are you sure you want to withdraw your pending application? You can re-apply later.
                    </p>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        className="btn btn-secondary flex-1"
                        onClick={() => setWithdrawConfirm(false)}
                        disabled={withdrawing}
                      >
                        Keep Application
                      </button>
                      <button
                        className="btn flex-1"
                        onClick={async () => {
                          setWithdrawing(true);
                          try {
                            await withdrawApplication(user.id, crSrStatus?.pendingApplication?.id);
                            setApplicationMessage('Application withdrawn successfully. You can re-apply anytime.');
                            setWithdrawConfirm(false);
                            setShowApplyForm(false);
                            const status = getUserApplicationStatus(user.id);
                            setApplicationStatus(status);
                            const applications = getApplicationsByUserId(user.id);
                            setUserApplications(applications);
                            const map = getSlotVacancyMap(user.department, user.semester || 1);
                            setVacancyMap(map);
                          } catch (err) {
                            setApplicationMessage(err.message || 'Failed to withdraw application.');
                          } finally {
                            setWithdrawing(false);
                            setTimeout(() => setApplicationMessage(''), 5000);
                          }
                        }}
                        style={{
                          background: 'var(--accent-amber)',
                          border: 'none',
                          color: '#fff',
                          fontWeight: 'bold',
                          opacity: withdrawing ? 0.6 : 1,
                          cursor: withdrawing ? 'not-allowed' : 'pointer',
                        }}
                        disabled={withdrawing}
                      >
                        {withdrawing ? 'Withdrawing...' : 'Yes, Withdraw'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
            </div>
          )}

      {/* Department Executive applications */}
      {activeSubTab === 'profile' && isAuthenticated && !isEditingProfile && (
        <section className="glass-card-static" style={{ marginBottom: 'var(--sp-5)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-5)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <span style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 12, color: 'var(--accent-amber)', background: 'var(--accent-amber-glow)' }}><GraduationCap size={18} /></span>
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--fs-sm)', fontWeight: 700 }}>Department Executive Roles</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)' }}>Other departments: GS from semester 7 and VP from semester 8. ARCH: GS from semester 9 and VP from semester 10. Admin approval is required.</p>
            </div>
          </div>
          {['vp', 'gs'].includes(user?.role) ? (
            <p style={{ margin: 0, color: 'var(--accent-emerald)', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>You are listed in the Student Directory as {user.role.toUpperCase()}.</p>
          ) : (() => {
            const semester = Number(user?.semester || 0);
            const department = String(user?.department || '').trim().toUpperCase();
            const isArchitecture = department === 'ARCH';
            const vpMinimumSemester = isArchitecture ? 10 : 8;
            const gsMinimumSemester = isArchitecture ? 9 : 7;
            const isCurrentStudent = ['student', 'cr', 'sr'].includes(user?.role);
            const pending = executiveApplications.find((app) => app.status === 'pending') || (applicationStatus?.pendingApplication?.status === 'pending' ? applicationStatus.pendingApplication : null);
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {pending ? (
                  <span style={{ color: 'var(--accent-amber)', fontSize: 'var(--fs-xs)' }}>Your {pending.appliedRole?.toUpperCase()} application is awaiting admin review.</span>
                ) : (
                  <>
                    {isCurrentStudent && department && semester >= vpMinimumSemester && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleExecutiveRoleApplication('vp')} disabled={submittingExecutiveRole !== '' || Boolean(applicationStatus?.hasPending)}>
                        <Send size={14} /> {submittingExecutiveRole === 'vp' ? 'Submitting…' : 'Apply for VP'}
                      </button>
                    )}
                    {isCurrentStudent && department && semester >= gsMinimumSemester && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleExecutiveRoleApplication('gs')} disabled={submittingExecutiveRole !== '' || Boolean(applicationStatus?.hasPending)}>
                        <Send size={14} /> {submittingExecutiveRole === 'gs' ? 'Submitting…' : 'Apply for GS'}
                      </button>
                    )}
                    {(!isCurrentStudent || !department || semester < Math.min(gsMinimumSemester, vpMinimumSemester)) && <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>{!department ? 'Complete your department and semester in your profile to check eligibility.' : `Applications are available from semester ${gsMinimumSemester} for GS and ${vpMinimumSemester} for VP.`}</span>}
                    {applicationStatus?.hasPending && <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>You already have a role application awaiting review.</span>}
                  </>
                )}
              </div>
            );
          })()}
        </section>
      )}

      {activeSubTab === 'profile' && isAuthenticated && !isEditingProfile && (
        <div className="st-delete-account" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-5)', boxShadow: 'var(--shadow-lift)' }}>
          <div className="animate-fadeIn">
            {!deleteConfirm ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <span style={{
                    width: 34, height: 34, borderRadius: 'var(--radius-full)', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--accent-rose-glow)', color: 'var(--accent-rose)',
                  }}>
                    <Trash2 size={16} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', color: 'var(--accent-rose)', margin: 0 }}>
                      Delete Account
                    </h4>
                    <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                      Permanently remove your account and all associated data.
                    </p>
                  </div>
                </div>
                <button
                  className="btn btn-sm"
                  style={{
                    background: 'var(--accent-rose-glow)',
                    color: 'var(--accent-rose)',
                    border: '1px solid var(--accent-rose)',
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => { setDeleteConfirm(true); setDeleteTypedConfirm(''); }}
                >
                  Delete Account
                </button>
              </div>
            ) : (
              <div style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--accent-rose)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}>
                <div>
                  <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', color: 'var(--accent-rose)', margin: '0 0 8px' }}>
                    Type <code style={{ background: 'var(--accent-rose-glow)', padding: '2px 8px', borderRadius: '6px', fontFamily: 'var(--font-mono)' }}>BYEBYE AUSTWISE</code> to confirm
                  </h4>
                  <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                    This action is irreversible. All your data will be permanently removed.
                  </p>
                </div>

                <input
                  type="text"
                  id="delete-confirm"
                  name="deleteConfirm"
                  autoComplete="off"
                  value={deleteTypedConfirm}
                  onChange={(e) => setDeleteTypedConfirm(e.target.value)}
                  placeholder="BYEBYE AUSTWISE"
                  className="input"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    borderColor: deleteTypedConfirm === 'BYEBYE AUSTWISE' ? 'var(--accent-emerald)' : 'var(--border-primary)',
                  }}
                />

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setDeleteConfirm(false); setDeleteTypedConfirm(''); }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-sm"
                    disabled={deleteTypedConfirm !== 'BYEBYE AUSTWISE'}
                    style={{
                      background: deleteTypedConfirm === 'BYEBYE AUSTWISE' ? 'var(--accent-rose)' : 'var(--accent-rose-glow)',
                      color: '#fff',
                      border: 'none',
                      whiteSpace: 'nowrap',
                      opacity: deleteTypedConfirm === 'BYEBYE AUSTWISE' ? 1 : 0.6,
                      cursor: deleteTypedConfirm === 'BYEBYE AUSTWISE' ? 'pointer' : 'not-allowed',
                    }}
                    onClick={() => {
                      if (user?.id) deleteAccountById(user.id);
                      logout();
                    }}
                  >
                    Yes, Delete My Account
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
