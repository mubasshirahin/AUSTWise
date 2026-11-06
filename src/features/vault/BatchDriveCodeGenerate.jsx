import { useState } from 'react';
import {
  KeyRound,
  Loader2,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Info,
  RefreshCw,
  Users,
  Lock,
  ShieldCheck,
  Plus,
  Inbox,
  Share2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './BatchDriveCodeGenerate.css';

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* ignore */ }
    area.remove();
    return ok;
  }
}

export default function BatchDriveCodeGenerate({ status, loading, onGenerate, onToggle, onRefresh }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);
  const [copiedCode, setCopiedCode] = useState('');

  if (loading) {
    return (
      <div className="bc-wrap">
        <div className="bc-skeleton-card">
          <div className="bc-skeleton-line" style={{ width: '45%' }} />
          <div className="bc-skeleton-line" style={{ width: '70%', marginTop: '10px' }} />
          <div className="bc-skeleton-line" style={{ width: '55%', marginTop: '10px' }} />
        </div>
        <div className="bc-skeleton-card">
          <div className="bc-skeleton-line" style={{ width: '60%' }} />
          <div className="bc-skeleton-line" style={{ width: '40%', marginTop: '10px' }} />
        </div>
      </div>
    );
  }
  if (!status) return null;

  const canShare = Boolean(status.canShare);
  const share = status.share || null;
  const myDept = status.department || user?.department || '';
  const mySem = status.yearSemLabel || '';

  const usedCount = share?.usedCount ?? 0;
  const maxUses = share?.maxUses ?? 5;
  const remaining = share?.remaining ?? Math.max(0, maxUses - usedCount);
  const codes = Array.isArray(share?.codes) ? share.codes : [];
  const derivedUses = codes
    .filter((entry) => entry.usedById)
    .map((entry) => ({
      userId: entry.usedById,
      studentId: entry.usedById,
      name: entry.usedByName || 'Junior',
      code: entry.code,
      department: myDept,
      batchLabel: '',
      yearSemLabel: '',
      avatar: entry.avatar || '',
    }));
  const uses = Array.isArray(share?.uses) && share.uses.length > 0 ? share.uses : derivedUses;
  const isFull = usedCount >= maxUses;
  const busyGenerate = busy === 'generate';
  const busyRefresh = busy === 'refresh';

  const handleGenerate = async () => {
    setBusy('generate');
    setMessage(null);
    try {
      const data = await onGenerate();
      setCopiedCode('');
      setMessage({
        type: 'success',
        text: `New code ${data?.code || ''} is ready. Copy it and share it with a junior.`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Could not generate a code. Please try again.' });
    } finally {
      setBusy('');
    }
  };

  const handleCopy = async (code) => {
    const ok = await copyText(code);
    setCopiedCode(ok ? code : '');
    if (!ok) {
      setMessage({ type: 'error', text: 'Could not copy. Please copy the code manually.' });
    }
    if (ok) {
      setTimeout(() => setCopiedCode((current) => (current === code ? '' : current)), 1800);
    }
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setBusy('refresh');
    setMessage(null);
    try {
      await onRefresh();
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Could not refresh. Please try again.' });
    } finally {
      setBusy('');
    }
  };

  const MessageIcon = message?.type === 'success' ? CheckCircle2 : message?.type === 'error' ? XCircle : Info;

  return (
    <div className="bc-wrap">
      {/* ── Header ── */}
      <div className="bc-masthead">
        <div className="bc-title-block">
          <div className="bc-icon-tile">
            <KeyRound size={22} />
          </div>
          <div className="bc-title-text">
            <span className="bc-overline">Batch Drive</span>
            <p className="bc-title">Share Codes</p>
            <span className="bc-subtitle">
              {myDept ? `${myDept} · ` : ''}{mySem ? `Semester ${mySem}` : 'Semester 3.1+'}
            </span>
          </div>
        </div>
        <div className="bc-masthead-actions">
          {!canShare && (
            <span className="bc-status-pill is-locked">
              <Lock size={12} /> 3.1 and above only
            </span>
          )}
          {onRefresh && (
            <button type="button" className="bc-icon-btn" onClick={handleRefresh} disabled={busy !== ''} title="Refresh" aria-label="Refresh">
              <RefreshCw size={14} className={busyRefresh ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="bc-stats">
        <div className="bc-stat">
          <span className="bc-stat-label">Used</span>
          <strong>{usedCount} / {maxUses}</strong>
        </div>
        <span className="bc-stat-sep" />
        <div className="bc-stat">
          <span className="bc-stat-label">Left</span>
          <strong>{remaining}</strong>
        </div>
        <span className="bc-stat-sep" />
        <div className="bc-stat">
          <span className="bc-stat-label">Total codes</span>
          <strong>{codes.length}</strong>
        </div>
        <span className="bc-stat-sep" />
        <div className="bc-stat">
          <span className="bc-stat-label">Redeemed</span>
          <strong>{uses.length}</strong>
        </div>
      </div>

      {!canShare && (
        <div className="bc-note">
          <ShieldCheck size={16} />
          <p>
            <strong>Only Semester 3.1 and above can generate codes.</strong>{' '}
            <span>Your profile shows {mySem ? `Semester ${mySem}` : 'no semester yet'} — check Settings → Year-Semester. Students in Semester 1–4 and CR/SR need a code from a senior in their own department to unlock Batch Drive.</span>
          </p>
        </div>
      )}

      <div className="bc-grid">
        <div className="bc-col-main">
          {/* ── Generate ── */}
          <section className="bc-card" aria-label="Generate a code">
            <div className="bc-card-head">
              <div className="bc-card-title-block">
                <h3>Create a code</h3>
                <p>One code unlocks one account. Up to {maxUses} per student.</p>
              </div>
              <span className="bc-slot-chip">{remaining} left</span>
            </div>

            <div className="bc-progress">
              <div className="bc-progress-head">
                <span>Slots</span>
                <span>{usedCount} of {maxUses} used</span>
              </div>
              <div className="bc-progress-track" role="progressbar" aria-valuenow={usedCount} aria-valuemin={0} aria-valuemax={maxUses}>
                <div className="bc-progress-fill" style={{ width: `${maxUses ? Math.min(100, (usedCount / maxUses) * 100) : 0}%` }} />
              </div>
            </div>

            <div className="bc-actions">
              <button
                type="button"
                className="bc-btn-primary"
                onClick={handleGenerate}
                disabled={busyGenerate || !canShare || isFull}
              >
                {busyGenerate ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                {busyGenerate ? 'Creating…' : isFull ? 'All slots used' : 'Generate code'}
              </button>
            </div>

            {message && (
              <div className={`bc-message is-${message.type}`} role="status">
                <MessageIcon size={14} />
                <span>{message.text}</span>
              </div>
            )}

            {isFull && canShare && (
              <p className="bc-hint">All {maxUses} slots used. You cannot generate more codes.</p>
            )}
          </section>

          {/* ── Your codes ── */}
          <section className="bc-card" aria-label="Your codes">
            <div className="bc-card-head">
              <div className="bc-card-title-block">
                <h3>Your codes</h3>
                <p>Copy an unused code and send it to a junior.</p>
              </div>
              <span className="bc-count-pill">
                <KeyRound size={12} /> {codes.length}
              </span>
            </div>

            {!canShare ? (
              <div className="bc-empty">
                <div className="bc-empty-icon"><Lock size={22} /></div>
                <p>Not available for your semester</p>
                <span>Only Semester 3.1 and above students can generate codes.</span>
              </div>
            ) : codes.length > 0 ? (
              <ul className="bc-codes">
                {[...codes].reverse().map((entry) => {
                  const isUsed = Boolean(entry.usedById);
                  const isCopied = copiedCode === entry.code;
                  return (
                    <li key={entry.code} className={`bc-code-row ${isUsed ? 'is-used' : 'is-free'}`}>
                      <code className="bc-code">{entry.code}</code>
                      <div className="bc-code-meta">
                        <span className={`bc-code-state ${isUsed ? 'is-used' : 'is-free'}`}>
                          {isUsed ? `Used by ${entry.usedByName || 'a junior'}` : 'Available'}
                        </span>
                        <span className="bc-code-date">
                          {entry.createdAt ? `Created ${formatDate(entry.createdAt)}` : ''}
                          {entry.usedAt ? ` · Redeemed ${formatDate(entry.usedAt)}` : ''}
                        </span>
                      </div>
                      {!isUsed && (
                        <button
                          type="button"
                          className={`bc-copy-btn ${isCopied ? 'is-copied' : ''}`}
                          onClick={() => handleCopy(entry.code)}
                          title="Copy code"
                        >
                          {isCopied ? <Check size={13} /> : <Copy size={13} />}
                          {isCopied ? 'Copied' : 'Copy'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="bc-empty">
                <div className="bc-empty-icon"><Inbox size={22} /></div>
                <p>No codes yet</p>
                <span>Generate your first code to get started.</span>
              </div>
            )}
          </section>
        </div>

        <aside className="bc-col-side">
          {/* ── How it works ── */}
          <section className="bc-card bc-side-card" aria-label="How it works">
            <div className="bc-card-head">
              <div className="bc-card-title-block">
                <h3>How it works</h3>
                <p>Three simple steps.</p>
              </div>
            </div>
            <ol className="bc-steps">
              <li>
                <span className="bc-step-num">1</span>
                <div>
                  <strong>Generate a code</strong>
                  <span>You get a single-use 8-digit code.</span>
                </div>
              </li>
              <li>
                <span className="bc-step-num">2</span>
                <div>
                  <strong>Share it</strong>
                  <span>Send it to a junior in your department.</span>
                </div>
              </li>
              <li>
                <span className="bc-step-num">3</span>
                <div>
                  <strong>They get access</strong>
                  <span>The code locks after one use. You have {maxUses} total.</span>
                </div>
              </li>
            </ol>
            <p className="bc-side-note">
              <Share2 size={12} /> Sharing is always on. Copy a code and send it to a junior.
            </p>
          </section>

          {/* ── Redeemed by ── */}
          {uses.length > 0 && (
            <section className="bc-card bc-side-card" aria-label="Redeemed by">
              <div className="bc-card-head">
                <div className="bc-card-title-block">
                  <h3>Redeemed by</h3>
                  <p>Students who unlocked with your code.</p>
                </div>
                <span className="bc-count-pill">
                  <Users size={12} /> {uses.length}
                </span>
              </div>
              <ul className="bc-users">
                {uses.map((entry) => (
                  <li key={`${entry.userId || entry.studentId || entry.name}-${entry.code}`}>
                    <button
                      type="button"
                      className="bc-user-avatar"
                      onClick={() => {
                        window.location.href = `/members/${encodeURIComponent(entry.studentId || entry.userId || '')}`;
                      }}
                      title={entry.name}
                    >
                      {entry.avatar ? (
                        <img src={entry.avatar} alt="" />
                      ) : (
                        (entry.name || '?').slice(0, 2).toUpperCase()
                      )}
                    </button>
                    <div className="bc-user-info">
                      <strong>{entry.name}</strong>
                      <span>
                        {entry.department || myDept || '—'}
                        {entry.batchLabel ? ` · ${entry.batchLabel}` : ''}
                        {entry.yearSemLabel ? ` · ${entry.yearSemLabel}` : ''}
                      </span>
                    </div>
                    <code>{entry.code}</code>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
