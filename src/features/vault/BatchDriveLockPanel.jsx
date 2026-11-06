import { useState } from 'react';
import { Check, KeyRound, Loader2, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './BatchDriveLock.css';

/**
 * Batch Drive lock panel. Rendered above the normal Batch
 * Drive content; when `status.locked` is true the caller hides the
 * materials and this panel is the only thing shown.
 */
export default function BatchDriveLockPanel({ status, loading, onRedeem, showLockForm = true }) {
  const { user } = useAuth();
  const [codeInput, setCodeInput] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  if (!status) {
    if (!loading) return null;
    return (
      <div className="bdl-card">
        <Loader2 size={18} className="animate-spin" />
        <span>Checking Batch Drive access…</span>
      </div>
    );
  }

  const locked = Boolean(status.locked);
  if (!locked) return null;

  const handleRedeem = async (event) => {
    event.preventDefault();
    const code = codeInput.trim();
    if (!/^\d{8}$/.test(code)) {
      setMessage('Enter the 8-digit code sent by a student in Semester 3.1 or above from your department.');
      return;
    }
    setBusy('redeem');
    setMessage('');
    try {
      await onRedeem(code);
      setCodeInput('');
      setMessage('Unlocked! Batch Drive is open now.');
    } catch (err) {
      setMessage(err?.message || 'Could not unlock. Check the code.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="bdl-wrap">
      {showLockForm && locked && (
        <form className="bdl-card is-locked" onSubmit={handleRedeem}>
          <div className="bdl-head">
            <span className="bdl-icon"><Lock size={18} /></span>
            <div>
              <strong>Batch Drive is locked</strong>
              <span>Semester 1.1–2.2 and CR/SR need an 8-digit code from a student in Semester 3.1 or above in their own department to open it.</span>
            </div>
          </div>
          <div className="bdl-code-row">
            <KeyRound size={16} className="bdl-code-icon" />
            <input
              className="bdl-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              pattern="[0-9]*"
              placeholder="8-digit code"
              value={codeInput}
              onChange={(event) => { setCodeInput(event.target.value.replace(/\D/g, '').slice(0, 8)); setMessage(''); }}
              aria-label="8-digit code"
            />
            <button type="submit" className="bdl-primary" disabled={busy === 'redeem' || codeInput.length !== 8}>
              {busy === 'redeem' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Unlock
            </button>
          </div>
          {message && <p className="bdl-message">{message}</p>}
          {user && <p className="bdl-hint">Signed in as {user.name} — one code unlocks this account on every device.</p>}
        </form>
      )}
    </div>
  );
}
