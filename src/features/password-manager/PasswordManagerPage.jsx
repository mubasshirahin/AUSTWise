import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyRound,
  MoreVertical,
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
  Dices,
  RefreshCw,
} from 'lucide-react';
import './PasswordManagerPage.css';

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

export default function PasswordManagerPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [revealedId, setRevealedId] = useState(null);

  // Add-form fields
  const [platform, setPlatform] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [genLen, setGenLen] = useState(16);

  // Edit modal
  const [editing, setEditing] = useState(null);
  const [editFields, setEditFields] = useState({ platform: '', email: '', username: '', password: '' });
  const [editShowPass, setEditShowPass] = useState(false);

  // Clipboard auto-clear timer (30s)
  const clipboardTimer = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/passwords/list', { credentials: 'same-origin' });
      const data = await res.json();
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
    };
  }, [load]);

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!platform.trim() || !email.trim() || !password) {
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
        body: JSON.stringify({ platform: platform.trim(), email: email.trim(), username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save credential.');
      setPlatform('');
      setEmail('');
      setUsername('');
      setPassword('');
      setShowPass(false);
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
    if (!window.confirm(`Delete credential for ${rec.platform}?`)) return;
    try {
      const res = await fetch(`/api/passwords/${encodeURIComponent(rec.id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
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
            <Lock size={12} /> AES-256-GCM encrypted
          </span>
        </div>

        <div className="schedule-actions">
          <button className="schedule-nav-btn" disabled aria-label="More options">
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {/* ── Notices / errors ── */}
      {notice && <div className="pm-notice pm-notice-ok">{notice}</div>}
      {error && <div className="pm-notice pm-notice-error"><AlertTriangle size={14} /> {error}</div>}

      <div className="pm-layout">

        {/* ── Left: Add new credential ── */}
        <section className="pm-form-card" aria-label="Add a new credential">
          <h3 className="pm-section-title"><Plus size={14} /> Add New Credential</h3>
          <form onSubmit={handleSave}>
            <label className="pm-field">
              <span>Platform / Site <em>*</em></span>
              <input
                list="pm-platforms"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                placeholder="e.g. Facebook, GitHub, bKash…"
                required
              />
              <datalist id="pm-platforms">
                {PLATFORM_SUGGESTIONS.map((p) => <option key={p} value={p} />)}
              </datalist>
            </label>

            <label className="pm-field">
              <span>Email / Phone <em>*</em></span>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com or 01XXXXXXXXX"
                required
              />
            </label>

            <label className="pm-field">
              <span>Username / Handle <small>(optional)</small></span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="@username"
              />
            </label>

            <label className="pm-field">
              <span>Password <em>*</em></span>
              <div className="pm-pass-input">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="pm-icon-btn"
                  onClick={() => setShowPass((s) => !s)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <div className="pm-gen">
              <span className="pm-gen-label"><Dices size={13} /> Generate strong password</span>
              <div className="pm-gen-row">
                <input
                  type="number"
                  min="8"
                  max="48"
                  value={genLen}
                  onChange={(e) => setGenLen(Math.max(8, Math.min(48, Number(e.target.value) || 16)))}
                  aria-label="Password length"
                />
                <button
                  type="button"
                  className="pm-icon-btn"
                  onClick={() => setPassword(generatePassword(genLen))}
                  aria-label="Generate password"
                  title="Generate"
                >
                  <RefreshCw size={15} />
                </button>
              </div>
            </div>

            <button type="submit" className="pm-submit" disabled={saving}>
              <Lock size={14} /> {saving ? 'Encrypting…' : 'Save Credential'}
            </button>
          </form>
        </section>

        {/* ── Right: Saved credentials ── */}
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
            </div>
          </div>

          {loading ? (
            <div className="pm-empty">Loading your vault…</div>
          ) : filtered.length === 0 ? (
            <div className="pm-empty">
              <KeyRound size={34} />
              <p>{records.length === 0 ? 'No credentials saved yet — add your first one on the left.' : `No account matches "${query}".`}</p>
            </div>
          ) : (
            <div className="pm-grid">
              {filtered.map((rec, i) => {
                const revealed = revealedId === rec.id;
                return (
                  <article className="pm-card" key={rec.id} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                    <div className="pm-card-top">
                      <div className="pm-platform-mark">{String(rec.platform)[0]?.toUpperCase() || '?'}</div>
                      <div className="pm-card-id">
                        <h4>{rec.platform}</h4>
                        <span className="pm-card-email">{rec.email}</span>
                      </div>
                    </div>

                    {rec.username && <div className="pm-card-username">@ {rec.username}</div>}

                    <div className="pm-card-pass">
                      <span className="pm-pass-text">{revealed ? rec.password : masked(rec.password?.length || 8)}</span>
                      <div className="pm-card-actions">
                      <button
                          className="pm-icon-btn"
                          onClick={() => openEdit(rec)}
                          aria-label="Edit credential"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="pm-icon-btn"
                          onClick={() => setRevealedId(revealed ? null : rec.id)}
                          aria-label={revealed ? 'Hide password' : 'Reveal password'}
                          title={revealed ? 'Hide' : 'Reveal'}
                        >
                          {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button
                          className="pm-icon-btn"
                          onClick={() => copyPassword(rec)}
                          aria-label="Copy password"
                          title="Copy password"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          className="pm-icon-btn pm-icon-danger"
                          onClick={() => handleDelete(rec)}
                          aria-label="Delete credential"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="pm-card-foot">
                      <span>Updated {new Date(rec.updatedAt || rec.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      {rec.decrypted === false && <span className="pm-decrypt-warn"><AlertTriangle size={11} /> cannot decrypt</span>}
                    </div>
                  </article>
                );
              })}
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
              <label className="pm-field">
                <span>Platform / Site <em>*</em></span>
                <input value={editFields.platform} onChange={(e) => setEditFields((f) => ({ ...f, platform: e.target.value }))} required />
              </label>
              <label className="pm-field">
                <span>Email / Phone <em>*</em></span>
                <input value={editFields.email} onChange={(e) => setEditFields((f) => ({ ...f, email: e.target.value }))} required />
              </label>
              <label className="pm-field">
                <span>Username / Handle <small>(optional)</small></span>
                <input value={editFields.username} onChange={(e) => setEditFields((f) => ({ ...f, username: e.target.value }))} />
              </label>
              <label className="pm-field">
                <span>Password <em>*</em></span>
                <div className="pm-pass-input">
                  <input
                    type={editShowPass ? 'text' : 'password'}
                    value={editFields.password}
                    onChange={(e) => setEditFields((f) => ({ ...f, password: e.target.value }))}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="pm-icon-btn"
                    onClick={() => setEditShowPass((s) => !s)}
                    aria-label={editShowPass ? 'Hide password' : 'Show password'}
                  >
                    {editShowPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
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