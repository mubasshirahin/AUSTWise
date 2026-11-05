import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyRound,
  Search,
  X,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Pencil,
  Plus,
  Lock,
  AlertTriangle,
  Download,
  RefreshCw,
} from 'lucide-react';
import './PasswordManagerPage.css';
import { getPasswordGrade } from '../../utils/passwordStrength';

const masked = (len) => '•'.repeat(Math.max(6, Math.min(len, 22)));

const PLATFORM_SUGGESTIONS = ['Facebook', 'Instagram', 'Twitter / X', 'LinkedIn', 'GitHub', 'Google', 'YouTube', 'Discord', 'WhatsApp', 'Telegram', 'Snapchat', 'TikTok', 'Reddit', 'Pinterest', 'Netflix', 'Spotify', 'Amazon', 'Daraz', 'Pathao', 'bKash', 'Nagad', 'Rocket', 'Outlook', 'Gmail', 'AUST'];

// Cryptographically-strong random password — no ambiguous chars.
function generatePassword(len = 16) {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (x) => charset[x % charset.length]).join('');
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const BRAND_STYLES = {
  facebook: ['#1877f2', 'f'], instagram: ['#d62976', '◎'], insta: ['#d62976', '◎'], 'twitter / x': ['#111111', 'X'],
  'x': ['#111111', 'X'], linkedin: ['#0a66c2', 'in'], github: ['#181717', '⌘'], google: ['#4285f4', 'G'],
  youtube: ['#ff0000', '▶'], discord: ['#5865f2', '◉'], whatsapp: ['#25d366', '◔'], telegram: ['#26a5e4', '➤'],
  tiktok: ['#111111', '♪'], snapchat: ['#fffc00', 'S'], reddit: ['#ff4500', 'r'], pinterest: ['#bd081c', 'P'],
  netflix: ['#e50914', 'N'], spotify: ['#1db954', '●'], amazon: ['#ff9900', 'a'], gmail: ['#ea4335', 'M'],
  outlook: ['#0078d4', 'O'], bkash: ['#e2136e', 'b'], nagad: ['#f15a24', 'n'], pathao: ['#00b56a', 'P'],
  daraz: ['#f85606', 'd'], rocket: ['#8b3393', 'R'], aust: ['#168141', 'A'],
};

const BRAND_ASSETS = {
  facebook: 'facebook.svg', instagram: 'instagram.svg', insta: 'instagram.svg', 'twitter / x': 'x.svg', x: 'x.svg',
  linkedin: 'linkedin.svg', github: 'github.svg', google: 'google.svg', youtube: 'youtube.svg', discord: 'discord.svg',
  whatsapp: 'whatsapp.svg', telegram: 'telegram.svg', snapchat: 'snapchat.svg', tiktok: 'tiktok.svg', reddit: 'reddit.svg',
  pinterest: 'pinterest.svg', netflix: 'netflix.svg', spotify: 'spotify.svg', amazon: 'amazon.svg', daraz: 'daraz.png',
  pathao: 'pathao.png', bkash: 'bkash.png', nagad: 'nagad.png', rocket: 'rocket.svg', outlook: 'outlook.svg',
  gmail: 'gmail.svg', aust: 'aust.png',
};

// Renders the real brand logo on a light chip so dark marks (GitHub, X, TikTok,
// Amazon…) stay legible against both dark and light themes. The chip tint picks
// up the active theme's card colour instead of a flat white.
function PlatformMark({ platform }) {
  const key = String(platform || '').trim().toLowerCase();
  const [color, mark] = BRAND_STYLES[key] || [null, String(platform || '?')[0]?.toUpperCase() || '?'];
  const instagram = key === 'instagram' || key === 'insta';
  const logoUrl = BRAND_ASSETS[key] ? `/brand-icons/${BRAND_ASSETS[key]}` : '';
  return (
    <div className={`pm-platform-mark${color || logoUrl ? ' pm-brand-mark' : ''}${key === 'facebook' ? ' pm-facebook-mark' : ''}${instagram ? ' pm-instagram-mark' : ''}`} style={color ? { '--brand-color': color } : undefined} aria-hidden="true">
      <span className="pm-brand-fallback">{key === 'facebook' ? <svg viewBox="0 0 24 24"><path d="M13.5 21v-8.2h2.8l.4-3.2h-3.2v-2c0-.9.3-1.6 1.6-1.6h1.7V3.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.3v3.2h2.8V21h3.4Z" /></svg>
        : instagram ? <svg viewBox="0 0 24 24" fill="none"><rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5.25" /><circle cx="12" cy="12" r="4.05" /><circle className="pm-instagram-dot" cx="17.65" cy="6.55" r="1" /></svg>
          : mark}</span>
      {logoUrl && (
        <img
          className="pm-brand-logo"
          src={logoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
    </div>
  );
}

// Ring meter shared by the saved cards and the live password fields.
function StrengthRing({ pct = 0, tone = 'muted', grade = '', variant }) {
  const value = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div
      className={`pm-password-strength${variant === 'live' ? ' pm-strength-live' : ''}`}
      data-tone={tone || 'muted'}
      style={{ '--val': `${value}%` }}
    >
      <div
        className="pm-strength-ring"
        role="meter"
        aria-label="Password strength"
        aria-valuemin={1}
        aria-valuemax={100}
        aria-valuenow={Math.max(1, value)}
      >
        <span>{grade ? value : '—'}</span>
      </div>
    </div>
  );
}

export default function PasswordManagerPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [revealedId, setRevealedId] = useState(null);
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);
  const [addFormOpen, setAddFormOpen] = useState(false);

  // Add-form fields
  const [platform, setPlatform] = useState('');
  const [rows, setRows] = useState([{ email: '', username: '', password: '', showPass: false }]);
  const [genLen] = useState(16);

  // Edit modal
  const [editing, setEditing] = useState(null);
  const [editFields, setEditFields] = useState({ platform: '', email: '', username: '', password: '' });
  const [editShowPass, setEditShowPass] = useState(false);

  // Clipboard auto-clear timer (30s)
  const clipboardTimer = useRef(null);
  // Auto-hide password after 5s
  const showPassTimer = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/passwords/list', { credentials: 'same-origin', cache: 'no-store' });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        setRecords([]);
        throw new Error('Please sign in to open your vault.');
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load credentials.');
      setRecords(data.credentials || []);
    } catch (err) {
      setError(err.message || 'Failed to load credentials.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (clipboardTimer.current) clearTimeout(clipboardTimer.current);
      if (showPassTimer.current) clearTimeout(showPassTimer.current);
    };
  }, [load]);

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const row = rows[0];
    if (!platform.trim() || !row.email.trim() || !row.password) {
      setError('Platform, Email/Phone and Password are all required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/passwords/save', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: platform.trim(), email: row.email.trim(), username: row.username.trim(), password: row.password }),
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) throw new Error('Please sign in to save credentials.');
      if (!res.ok) throw new Error(data.error || 'Failed to save credential.');
      setPlatform('');
      setRows([{ email: '', username: '', password: '', showPass: false }]);
      setPlatformDropdownOpen(false);
      flash('Credential saved securely.');
      await load();
    } catch (err) {
      setError(err.message || 'Failed to save credential.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (rec) => {
    setEditing(rec);
    setEditFields({ platform: rec.platform, email: rec.email, username: rec.username || '', password: rec.password || '' });
    setEditShowPass(false);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editing) return;
    if (!editFields.platform.trim() || !editFields.email.trim() || !editFields.password) {
      setError('Platform, Email/Phone and Password are all required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/passwords/${encodeURIComponent(editing.id)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: editFields.platform.trim(),
          email: editFields.email.trim(),
          username: editFields.username.trim(),
          password: editFields.password,
        }),
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) throw new Error('Please sign in to update credentials.');
      if (!res.ok) throw new Error(data.error || 'Failed to update credential.');
      setEditing(null);
      flash('Credential updated.');
      await load();
    } catch (err) {
      setError(err.message || 'Failed to update credential.');
    } finally {
      setSaving(false);
    }
  };

  const copyPassword = async (rec) => {
    try {
      await navigator.clipboard.writeText(rec.password || '');
    } catch {
      // Clipboard API blocked (insecure context) — fall back to execCommand.
      const ta = document.createElement('textarea');
      ta.value = rec.password || '';
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    flash('Password copied — clipboard clears in 30s.');
    if (clipboardTimer.current) clearTimeout(clipboardTimer.current);
    clipboardTimer.current = setTimeout(() => {
      try { navigator.clipboard.writeText(''); } catch { /* noop */ }
    }, 30_000);
  };

  const handleDelete = async (rec) => {
    try {
      const res = await fetch(`/api/passwords/${encodeURIComponent(rec.id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (res.status === 401 || res.status === 403) throw new Error('Please sign in to delete credentials.');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete credential.');
      }
      setRevealedId(null);
      flash('Credential deleted.');
      await load();
    } catch (err) {
      setError(err.message || 'Failed to delete credential.');
    }
  };

  const exportCsv = () => {
    if (!records.length) {
      flash('No credentials to export.');
      return;
    }
    const header = 'Platform,Email,Username,Password';
    const rows = records.map((r) => [r.platform, r.email, r.username || '', r.password || ''].map(csvCell).join(','));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `passwords-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    flash('Vault exported as CSV.');
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      String(r.platform).toLowerCase().includes(q) ||
      String(r.email).toLowerCase().includes(q)
    );
  }, [records, query]);

  const vaultStats = useMemo(() => {
    const grades = records.map((rec) => getPasswordGrade(rec.password || ''));
    const strong = grades.filter((grade) => grade.score >= 4).length;
    const reused = records.length - new Set(records.map((rec) => rec.password).filter(Boolean)).size;
    return { total: records.length, strong, weak: records.length - strong, reused };
  }, [records]);
  const matchingPlatforms = PLATFORM_SUGGESTIONS.filter((item) =>
    !platform.trim() || item.toLowerCase().includes(platform.trim().toLowerCase())
  );

  // Live strength for the edit password field — recomputed on every keystroke.
  const editStrength = useMemo(() => getPasswordGrade(editFields.password), [editFields.password]);

  return (
    <div className="glass-card-static schedule-widget pm-widget animate-fadeInUp">

      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile pm-icon-tile">
            <KeyRound size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Daily Life</span>
            <p className="schedule-title">Password Manager</p>
            <span className="schedule-subtitle">Secure login vault · AES-256 encrypted</span>
          </div>
        </div>

        <div className="schedule-masthead-center">
          <span className="pm-badge">
            <span className="pm-badge-dot" aria-hidden="true" /> AES-256-GCM encrypted
          </span>
        </div>

      </div>

      <div className="schedule-dotted-divider" />

      <section className="pm-overview" aria-label="Vault overview">
        <div className="pm-overview-intro">
          <span className="pm-overview-kicker">YOUR DIGITAL LIFE, IN ONE PLACE</span>
          <h2>Your vault, at a glance</h2>
          <p>Keep every login organized and your accounts protected.</p>
        </div>
        <div className="pm-stat-card"><span className="pm-stat-icon"><KeyRound size={16} /></span><strong>{vaultStats.total}</strong><span>Saved accounts</span><small>Across your services</small></div>
        <div className="pm-stat-card pm-stat-secure"><span className="pm-stat-icon"><Lock size={16} /></span><strong>{vaultStats.strong}<small>/{vaultStats.total}</small></strong><span>Strong passwords</span><small>{vaultStats.total ? Math.round((vaultStats.strong / vaultStats.total) * 100) : 0}% of your vault</small></div>
        <div className="pm-health-card">
          <div className="pm-health-copy"><span>Vault health</span><strong>{vaultStats.total ? Math.round((vaultStats.strong / vaultStats.total) * 100) : 0}<small>%</small></strong><em>{vaultStats.total ? (vaultStats.weak ? `${vaultStats.weak} to review` : 'Looking good') : 'Add your first login'}</em></div>
          <div className="pm-health-ring" style={{ '--health': `${vaultStats.total ? (vaultStats.strong / vaultStats.total) * 100 : 0}%` }} role="img" aria-label={`${vaultStats.total ? Math.round((vaultStats.strong / vaultStats.total) * 100) : 0}% strong passwords`}><span><Lock size={18} /></span></div>
        </div>
      </section>

      {/* ── Notices / errors ── */}
      {notice && <div className="pm-notice pm-notice-ok">{notice}</div>}
      {error && <div className="pm-notice pm-notice-error"><AlertTriangle size={14} /> {error}</div>}

      <div className="pm-layout">

        {/* ── Add new credential form — shown when open ── */}
        {addFormOpen && (
          <section className="pm-form-card is-open" aria-label="Add a new credential">
              <div className="pm-add-head">
                <h3 className="pm-section-title"><Plus size={14} /> Add New Credential</h3>
                <button
                  type="button"
                  className="pm-icon-btn"
                  onClick={() => { setAddFormOpen(false); setPlatform(''); setRows([{ email: '', username: '', password: '', showPass: false }]); }}
                  aria-label="Close add credential form"
                  title="Close"
                >
                  <X size={15} />
                </button>
              </div>
              <form id="pm-add-form" className="pm-add-form" onSubmit={handleSave}>
            <label className="pm-field" htmlFor="pm-add-platform">
              <span>Platform / Site <em>*</em></span>
              <div className="pm-platform-control">
                <div className="pm-platform-input-row">
                  {platform.trim() && <PlatformMark platform={platform} />}
                  <input
                    id="pm-add-platform"
                    name="platform"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={platformDropdownOpen}
                    aria-controls="pm-platform-options"
                    value={platform}
                    onChange={(e) => { setPlatform(e.target.value); setPlatformDropdownOpen(true); }}
                    onFocus={() => setPlatformDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setPlatformDropdownOpen(false), 100)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setPlatformDropdownOpen(false);
                      if (e.key === 'Enter' && platformDropdownOpen && matchingPlatforms.length) {
                        e.preventDefault();
                        setPlatform(matchingPlatforms[0]);
                        setPlatformDropdownOpen(false);
                      }
                    }}
                    placeholder="e.g. Facebook, GitHub, bKash…"
                    autoComplete="off"
                    required
                  />
                </div>
                {platformDropdownOpen && matchingPlatforms.length > 0 && (
                  <div className="pm-platform-options" id="pm-platform-options" role="listbox" aria-label="Popular platforms">
                    {matchingPlatforms.map((item) => (
                      <button
                        className="pm-platform-option"
                        type="button"
                        role="option"
                        aria-selected={platform === item}
                        key={item}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setPlatform(item); setPlatformDropdownOpen(false); }}
                      >
                        <PlatformMark platform={item} />
                        <span>{item}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </label>

            {(() => {
              const row = rows[0];
              const rowStrength = getPasswordGrade(row.password);
              return (
                <>
                  <label className="pm-field" htmlFor="pm-add-email-0">
                    <span>Email / Phone <em>*</em></span>
                    <input
                      id="pm-add-email-0"
                      name="email"
                      type="text"
                      autoComplete="email"
                      value={row.email}
                      onChange={(e) => setRows([{ ...row, email: e.target.value }])}
                      placeholder="email@example.com or 01XXXXXXXXX"
                      required
                    />
                  </label>

                  <label className="pm-field" htmlFor="pm-add-username-0">
                    <span>Username / Handle <small>(optional)</small></span>
                    <input
                      id="pm-add-username-0"
                      name="username"
                      type="text"
                      autoComplete="off"
                      value={row.username}
                      onChange={(e) => setRows([{ ...row, username: e.target.value }])}
                      placeholder="@username"
                    />
                  </label>

                  <label className="pm-field" htmlFor="pm-add-password-0">
                    <span>
                      Password <em>*</em>
                      <span className="pm-gen-tag">one click = strong</span>
                    </span>
                    <div className="pm-pass-row">
                      <div className="pm-pass-input">
                        <input
                          id="pm-add-password-0"
                          type={row.showPass ? 'text' : 'password'}
                          value={row.password}
                          onChange={(e) => setRows([{ ...row, password: e.target.value }])}
                          placeholder="••••••••"
                          required
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="pm-icon-btn pm-show-btn"
                          onClick={() => {
                            const next = !row.showPass;
                            setRows([{ ...row, showPass: next }]);
                            clearTimeout(showPassTimer.current);
                            if (next) {
                              showPassTimer.current = setTimeout(() => setRows((prev) => [{ ...prev[0], showPass: false }]), 5000);
                            }
                          }}
                          aria-label={row.showPass ? 'Hide password' : 'Show password'}
                          title={row.showPass ? 'Hide password' : 'Show password'}
                        >
                          {row.showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <button
                        type="button"
                        className="pm-gen-pill"
                        onClick={() => setRows([{ ...row, password: generatePassword(genLen) }])}
                        aria-label="Generate password"
                        title="Generate strong password"
                      >
                        <RefreshCw size={14} strokeWidth={2.4} />
                      </button>
                      <StrengthRing
                        variant="live"
                        pct={rowStrength.pct}
                        tone={rowStrength.tone}
                        grade={rowStrength.grade}
                      />
                    </div>
                  </label>
                </>
              );
            })()}

            <button type="submit" className="pm-submit" disabled={saving}>
              <Lock size={14} /> {saving ? 'Encrypting…' : 'Save Credential'}
            </button>
          </form>
        </section>
        )}

        {/* ── Saved credentials — full width ── */}
        <section className="pm-list-card" aria-label="Saved credentials">
          <div className="pm-list-head">
            <h3 className="pm-section-title">Saved Accounts <span className="pm-count">({filtered.length})</span></h3>
            <div className="pm-list-tools">
              <button className="pm-export" onClick={exportCsv} disabled={records.length === 0}>
                <Download size={13} /> Export CSV
              </button>
              <div className="pm-search">
                <Search size={14} className="pm-search-icon" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search platform or email…"
                  aria-label="Search credentials"
                />
                {query && (
                  <button className="pm-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                    <X size={13} />
                  </button>
                )}
              </div>
              <button
                type="button"
                className="pm-add-toggle"
                onClick={() => setAddFormOpen(true)}
                aria-label="Add new credential"
                title="Add new credential"
              >
                <Plus size={18} strokeWidth={2.4} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="pm-empty">Loading your vault…</div>
          ) : filtered.length === 0 ? (
            <div className="pm-empty">
              <KeyRound size={34} />
              <p>{records.length === 0 ? 'No credentials saved yet — use the + button to add your first login.' : `No account matches "${query}".`}</p>
            </div>
          ) : (
            <div className="pm-platform-groups">
              {(() => {
                // Group by platform (case-insensitive key, preserve original casing)
                const groups = new Map();
                filtered.forEach((rec) => {
                  const key = String(rec.platform || '').trim().toLowerCase();
                  if (!groups.has(key)) groups.set(key, { platform: rec.platform, recs: [] });
                  groups.get(key).recs.push(rec);
                });
                return [...groups.values()].map(({ platform: pName, recs }) => {
                  const brandHue = (BRAND_STYLES[String(pName || '').trim().toLowerCase()] || [])[0];
                  return (
                    <div
                      key={pName}
                      className="pm-platform-group"
                      style={brandHue ? { '--brand-hue': brandHue } : undefined}
                    >
                      <div className="pm-group-header">
                        <PlatformMark platform={pName} />
                        <span className="pm-group-name">{pName}</span>
                        <span className="pm-group-count">{recs.length} account{recs.length > 1 ? 's' : ''}</span>
                      </div>
                      <table className="pm-table">
                        <thead>
                          <tr>
                            <th>Email / Phone</th>
                            <th>Username</th>
                            <th>Password</th>
                            <th className="pm-th-strength">Strength</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {recs.map((rec) => {
                            const revealed = revealedId === rec.id;
                            const strength = getPasswordGrade(rec.password || '');
                            return (
                              <tr key={rec.id}>
                                <td className="pm-td-email">{rec.email}</td>
                                <td className="pm-td-username">{rec.username ? `@${rec.username.replace(/^@/, '')}` : <span className="pm-td-empty">—</span>}</td>
                                <td className="pm-td-pass">
                                  <span className="pm-pass-text">{revealed ? rec.password : masked(rec.password?.length || 8)}</span>
                                </td>
                                <td className="pm-td-strength">
                                  <StrengthRing pct={strength.pct} tone={strength.tone} grade={strength.grade} />
                                </td>
                                <td className="pm-td-actions">
                                  <button className="pm-icon-btn" onClick={() => openEdit(rec)} aria-label="Edit" title="Edit"><Pencil size={14} /></button>
                                  <button className="pm-icon-btn" onClick={() => setRevealedId(revealed ? null : rec.id)} aria-label={revealed ? 'Hide' : 'Reveal'} title={revealed ? 'Hide' : 'Reveal'}>{revealed ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                                  <button className="pm-icon-btn" onClick={() => copyPassword(rec)} aria-label="Copy" title="Copy"><Copy size={14} /></button>
                                  <button className="pm-icon-btn pm-icon-danger" onClick={() => handleDelete(rec)} aria-label="Delete" title="Delete"><Trash2 size={14} /></button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </section>
      </div>

      {/* ── Edit modal ── */}
      {editing && (
        <div className="pm-modal" role="dialog" aria-modal="true" aria-label={`Edit ${editing.platform}`}>
          <div className="pm-modal-box">
            <div className="pm-modal-head">
              <h3 className="pm-section-title"><Pencil size={14} /> Edit Credential</h3>
              <button className="pm-icon-btn" onClick={() => setEditing(null)} aria-label="Close edit dialog">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleUpdate}>
              <label className="pm-field" htmlFor="pm-edit-platform">
                <span>Platform / Site <em>*</em></span>
                <input id="pm-edit-platform" name="platform" value={editFields.platform} onChange={(e) => setEditFields((f) => ({ ...f, platform: e.target.value }))} required />
              </label>
              <label className="pm-field" htmlFor="pm-edit-email">
                <span>Email / Phone <em>*</em></span>
                <input id="pm-edit-email" name="email" type="text" autoComplete="email" value={editFields.email} onChange={(e) => setEditFields((f) => ({ ...f, email: e.target.value }))} required />
              </label>
              <label className="pm-field" htmlFor="pm-edit-username">
                <span>Username / Handle <small>(optional)</small></span>
                <input id="pm-edit-username" name="username" type="text" autoComplete="off" value={editFields.username} onChange={(e) => setEditFields((f) => ({ ...f, username: e.target.value }))} />
              </label>
              <label className="pm-field" htmlFor="pm-edit-password">
                <span>
                  Password <em>*</em>
                  <span className="pm-gen-tag">one click = strong</span>
                </span>
                <div className="pm-pass-row">
                  <div className="pm-pass-input">
                    <input
                      id="pm-edit-password"
                      name="password"
                      type={editShowPass ? 'text' : 'password'}
                      value={editFields.password}
                      onChange={(e) => setEditFields((f) => ({ ...f, password: e.target.value }))}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="pm-icon-btn"
                      onClick={() => {
                        const next = !editShowPass;
                        setEditShowPass(next);
                        clearTimeout(showPassTimer.current);
                        if (next) {
                          showPassTimer.current = setTimeout(() => setEditShowPass(false), 5000);
                        }
                      }}
                      aria-label={editShowPass ? 'Hide password' : 'Show password'}
                      title="Show / hide"
                    >
                      {editShowPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <StrengthRing
                    variant="live"
                    pct={editStrength.pct}
                    tone={editStrength.tone}
                    grade={editStrength.grade}
                  />
                </div>
              </label>
              <div className="pm-modal-actions">
                <button type="button" className="pm-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="pm-submit" disabled={saving}>
                  <Lock size={14} /> {saving ? 'Updating…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Footer note ── */}
      <div className="pm-footer">
        <Lock size={12} />
        <span>
          Passwords are encrypted with AES-256-GCM and stored per-account — never in plaintext. Copy clears
          your clipboard after 30 seconds.
        </span>
      </div>
    </div>
  );
}
